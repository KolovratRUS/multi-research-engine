import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export type PregamePitcherObservationContext = 'PROSPECTIVE_LIVE' | 'RETROSPECTIVE_BACKTEST';

export type PregamePitcherObservationProvenance =
  | 'SCHEDULE_PROBABLE_OBSERVED_AT'
  | 'SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN'
  | 'UNAVAILABLE';

export const ELIGIBLE_PREGAME_PROVENANCES = new Set<PregamePitcherObservationProvenance>([
  'SCHEDULE_PROBABLE_OBSERVED_AT',
]);

export interface PregamePitcherObservation {
  readonly schemaVersion: string;
  readonly sport: string;
  readonly gamePk: number;
  readonly observedAt: Date;
  readonly scheduledStart: Date;
  readonly homeProbablePitcherId: number | null;
  readonly awayProbablePitcherId: number | null;
  readonly homeTeamId: number;
  readonly awayTeamId: number;
  readonly sourceEndpoint: string;
  readonly sourceRequestParameters: Record<string, unknown>;
  readonly sourceResponseHash: string;
  readonly observationContext: PregamePitcherObservationContext;
  readonly provenance: PregamePitcherObservationProvenance;
  readonly warnings: readonly string[];
}

export interface AppendObservationResult {
  readonly observationsConsidered: number;
  readonly observationsWritten: number;
  readonly exactDuplicatesSkipped: number;
  readonly retrospectiveWritesBlocked: number;
  readonly corruptRecords: number;
  readonly eligibleSelectionHits: number;
  readonly eligibleSelectionMisses: number;
  readonly warnings: readonly string[];
}

export interface PregamePitcherObservationStore {
  append(observation: PregamePitcherObservation): Promise<AppendObservationResult>;
  listForGame(gamePk: number): Promise<readonly PregamePitcherObservation[]>;
  findLatestEligible(gamePk: number, predictionCutoff: Date): Promise<PregamePitcherObservation | null>;
}

export interface PregamePitcherObservationWriter {
  recordProspectivePitcherObservations(params: {
    readonly games: readonly {
      readonly gamePk: number;
      readonly scheduledStart: Date;
      readonly homeTeamId: number;
      readonly awayTeamId: number;
      readonly homeProbablePitcherId: number | null;
      readonly awayProbablePitcherId: number | null;
      readonly warnings: readonly string[];
    }[];
    readonly context: PregamePitcherObservationContext;
    readonly sourceEndpoint: string;
    readonly sourceRequestParameters: unknown;
  }): Promise<AppendObservationResult>;
}

export class PregamePitcherObservationStoreError extends Error {
  constructor(
    public readonly operation: string,
    public readonly filePath: string,
    public readonly gamePk: number | null,
    cause?: unknown,
  ) {
    super(`observation-store ${operation} failure: ${filePath}${gamePk !== null ? ` (game ${gamePk})` : ''}`, { cause });
  }
}

const SCHEMA_VERSION = 'phase1g-a-v1';

export type CanonicalJson =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalJson[]
  | { readonly [key: string]: CanonicalJson };

export function canonicalize(value: unknown, visited = new WeakSet()): CanonicalJson {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('non-finite number in canonical payload');
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (visited.has(value)) {
      throw new Error('cyclic structure in canonical payload');
    }
    visited.add(value);
    try {
      return value.map((item) => canonicalize(item, visited));
    } finally {
      visited.delete(value);
    }
  }
  if (typeof value === 'object') {
    if (!isPlainRecord(value)) {
      throw new Error('non-plain object in canonical payload');
    }
    if (visited.has(value)) {
      throw new Error('cyclic structure in canonical payload');
    }
    visited.add(value);
    const keys = Object.keys(value);
    const result: Record<string, CanonicalJson> = {};
    try {
      for (const key of keys.sort()) {
        result[key] = canonicalize(value[key], visited);
      }
    } finally {
      visited.delete(value);
    }
    return result;
  }
  throw new Error('unsupported value in canonical payload');
}

export function buildObservationResponseHash(params: {
  readonly gamePk: number;
  readonly scheduledStart: Date;
  readonly homeTeamId: number;
  readonly awayTeamId: number;
  readonly homeProbablePitcherId: number | null;
  readonly awayProbablePitcherId: number | null;
  readonly sourceEndpoint: string;
  readonly sourceRequestParameters: Record<string, unknown>;
  readonly observationContext: PregamePitcherObservationContext;
  readonly provenance: PregamePitcherObservationProvenance;
}): string {
  const payload = JSON.stringify({
    v: SCHEMA_VERSION,
    gamePk: params.gamePk,
    scheduledStart: params.scheduledStart.toISOString(),
    homeTeamId: params.homeTeamId,
    awayTeamId: params.awayTeamId,
    homeProbablePitcherId: params.homeProbablePitcherId,
    awayProbablePitcherId: params.awayProbablePitcherId,
    endpoint: params.sourceEndpoint,
    params: canonicalize(params.sourceRequestParameters),
    context: params.observationContext,
    provenance: params.provenance,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function buildObservationPath(root: string, observation: PregamePitcherObservation): string {
  const gameDir = path.join(root, 'pregame-pitcher-observations', 'mlb', String(observation.gamePk));
  const epoch = String(observation.observedAt.getTime());
  const fileName = `${epoch}-${observation.sourceResponseHash.slice(0, 16)}.json`;
  return path.join(gameDir, fileName);
}

function sanitizeSport(sport: string): string {
  return sport.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function isObservationEligible(observation: PregamePitcherObservation, predictionCutoff: Date): boolean {
  if (observation.observationContext !== 'PROSPECTIVE_LIVE') return false;
  if (!ELIGIBLE_PREGAME_PROVENANCES.has(observation.provenance)) return false;
  if (observation.observedAt.getTime() > predictionCutoff.getTime()) return false;
  if (observation.observedAt.getTime() > observation.scheduledStart.getTime()) return false;
  return true;
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && Math.floor(value) === value;
}

function isNullablePositiveInteger(value: unknown): value is number | null {
  return value === null || isPositiveInteger(value);
}

function isValidSchemaVersion(value: unknown): value is string {
  return value === SCHEMA_VERSION;
}

function isValidHash(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function isObservationContext(value: unknown): value is PregamePitcherObservationContext {
  return value === 'PROSPECTIVE_LIVE' || value === 'RETROSPECTIVE_BACKTEST';
}

function isObservationProvenance(value: unknown): value is PregamePitcherObservationProvenance {
  return (
    value === 'SCHEDULE_PROBABLE_OBSERVED_AT' ||
    value === 'SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN' ||
    value === 'UNAVAILABLE'
  );
}

function isExactDuplicate(
  existing: PregamePitcherObservation,
  incoming: PregamePitcherObservation,
): boolean {
  return (
    existing.schemaVersion === incoming.schemaVersion &&
    existing.sport === incoming.sport &&
    existing.gamePk === incoming.gamePk &&
    existing.observedAt.getTime() === incoming.observedAt.getTime() &&
    existing.scheduledStart.getTime() === incoming.scheduledStart.getTime() &&
    existing.homeTeamId === incoming.homeTeamId &&
    existing.awayTeamId === incoming.awayTeamId &&
    existing.homeProbablePitcherId === incoming.homeProbablePitcherId &&
    existing.awayProbablePitcherId === incoming.awayProbablePitcherId &&
    existing.sourceEndpoint === incoming.sourceEndpoint &&
    JSON.stringify(canonicalize(existing.sourceRequestParameters)) ===
      JSON.stringify(canonicalize(incoming.sourceRequestParameters)) &&
    existing.sourceResponseHash === incoming.sourceResponseHash &&
    existing.observationContext === incoming.observationContext &&
    existing.provenance === incoming.provenance &&
    existing.warnings.length === incoming.warnings.length &&
    existing.warnings.every((value, index) => value === incoming.warnings[index])
  );
}

function parseRecord(record: unknown): PregamePitcherObservation {
  if (!isPlainRecord(record)) {
    throw new PregamePitcherObservationStoreError('read', 'invalid record', null);
  }

  const observedAt = parseDateField(record.observedAt);
  const scheduledStart = parseDateField(record.scheduledStart);
  if (!observedAt || !scheduledStart) {
    throw new PregamePitcherObservationStoreError('read', 'invalid dates', null);
  }
  if (!isPositiveInteger(record.gamePk)) {
    throw new PregamePitcherObservationStoreError('read', 'invalid gamePk', null);
  }
  if (
    typeof record.sourceEndpoint !== 'string' ||
    record.sourceEndpoint.length === 0 ||
    !isPlainRecord(record.sourceRequestParameters) ||
    typeof record.sourceResponseHash !== 'string' ||
    record.sport !== 'mlb' ||
    !isValidSchemaVersion(record.schemaVersion)
  ) {
    throw new PregamePitcherObservationStoreError('read', 'missing fields', null);
  }
  if (!isValidHash(record.sourceResponseHash)) {
    throw new PregamePitcherObservationStoreError('read', 'invalid hash', null);
  }
  if (!isObservationContext(record.observationContext)) {
    throw new PregamePitcherObservationStoreError('read', 'invalid context', null);
  }
  if (!isObservationProvenance(record.provenance)) {
    throw new PregamePitcherObservationStoreError('read', 'invalid provenance', null);
  }
  if (!isStringArray(record.warnings)) {
    throw new PregamePitcherObservationStoreError('read', 'invalid warnings', null);
  }
  if (!isPositiveInteger(record.homeTeamId)) {
    throw new PregamePitcherObservationStoreError('read', 'invalid homeTeamId', null);
  }
  if (!isPositiveInteger(record.awayTeamId)) {
    throw new PregamePitcherObservationStoreError('read', 'invalid awayTeamId', null);
  }
  if (!isNullablePositiveInteger(record.homeProbablePitcherId)) {
    throw new PregamePitcherObservationStoreError('read', 'invalid homeProbablePitcherId', null);
  }
  if (!isNullablePositiveInteger(record.awayProbablePitcherId)) {
    throw new PregamePitcherObservationStoreError('read', 'invalid awayProbablePitcherId', null);
  }

  const observationContext = record.observationContext;
  const provenance = record.provenance;

  return {
    schemaVersion: record.schemaVersion,
    sport: record.sport,
    gamePk: record.gamePk,
    observedAt,
    scheduledStart,
    homeProbablePitcherId: record.homeProbablePitcherId,
    awayProbablePitcherId: record.awayProbablePitcherId,
    homeTeamId: record.homeTeamId,
    awayTeamId: record.awayTeamId,
    sourceEndpoint: record.sourceEndpoint,
    sourceRequestParameters: record.sourceRequestParameters,
    sourceResponseHash: record.sourceResponseHash,
    observationContext,
    provenance,
    warnings: record.warnings,
  };
}

function hasErrorCode(error: unknown, code: string): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  return error.code === code;
}

function isNodeEnoent(error: unknown): boolean {
  return hasErrorCode(error, 'ENOENT');
}

function isNodeEexist(error: unknown): boolean {
  return hasErrorCode(error, 'EEXIST');
}

function parseDateField(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

export function createMLBPregamePitcherObservationStore(
  root: string,
  now = () => new Date(),
): PregamePitcherObservationStore {
  const baseDir = path.join(root, 'pregame-pitcher-observations', 'mlb');

  async function readObservation(filePath: string): Promise<PregamePitcherObservation> {
    let raw: string;
    try {
      raw = await fs.readFile(filePath, 'utf8');
    } catch (e) {
      throw new PregamePitcherObservationStoreError('read', filePath, null, e);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new PregamePitcherObservationStoreError('read', filePath, null);
    }
    return parseRecord(parsed);
  }

  async function readGameObservations(gamePk: number): Promise<PregamePitcherObservation[]> {
    const gameDir = path.join(baseDir, String(gamePk));
    let entries: string[];
    try {
      entries = await fs.readdir(gameDir);
    } catch (e) {
      if (isNodeEnoent(e)) {
        return [];
      }
      throw new PregamePitcherObservationStoreError('list', gameDir, gamePk, e);
    }
    const observations: PregamePitcherObservation[] = [];
    for (const entry of entries) {
      const filePath = path.join(gameDir, entry);
      try {
        observations.push(await readObservation(filePath));
      } catch (e) {
        if (e instanceof PregamePitcherObservationStoreError) throw e;
        throw new PregamePitcherObservationStoreError('read', filePath, gamePk, e);
      }
    }
    return observations;
  }

  return {
    async append(observation) {
      if (observation.observationContext !== 'PROSPECTIVE_LIVE') {
        return {
          observationsConsidered: 1,
          observationsWritten: 0,
          exactDuplicatesSkipped: 0,
          retrospectiveWritesBlocked: 1,
          corruptRecords: 0,
          eligibleSelectionHits: 0,
          eligibleSelectionMisses: 0,
          warnings: [],
        };
      }

      if (
        !(observation.observedAt instanceof Date) ||
        Number.isNaN(observation.observedAt.getTime())
      ) {
        return {
          observationsConsidered: 1,
          observationsWritten: 0,
          exactDuplicatesSkipped: 0,
          retrospectiveWritesBlocked: 0,
          corruptRecords: 1,
          eligibleSelectionHits: 0,
          eligibleSelectionMisses: 0,
          warnings: [],
        };
      }

      if (
        !(observation.scheduledStart instanceof Date) ||
        Number.isNaN(observation.scheduledStart.getTime())
      ) {
        return {
          observationsConsidered: 1,
          observationsWritten: 0,
          exactDuplicatesSkipped: 0,
          retrospectiveWritesBlocked: 0,
          corruptRecords: 1,
          eligibleSelectionHits: 0,
          eligibleSelectionMisses: 0,
          warnings: [],
        };
      }

      const filePath = buildObservationPath(root, observation);
      try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(observation, null, 2), { encoding: 'utf8', flag: 'wx' });
      } catch (e) {
        if (isNodeEnoent(e)) {
          return {
            observationsConsidered: 1,
            observationsWritten: 0,
            exactDuplicatesSkipped: 0,
            retrospectiveWritesBlocked: 0,
            corruptRecords: 1,
            eligibleSelectionHits: 0,
            eligibleSelectionMisses: 0,
            warnings: [],
          };
        }
        if (isNodeEexist(e)) {
          const existing = await readObservation(filePath);
          if (isExactDuplicate(existing, observation)) {
            return {
              observationsConsidered: 1,
              observationsWritten: 0,
              exactDuplicatesSkipped: 1,
              retrospectiveWritesBlocked: 0,
              corruptRecords: 0,
              eligibleSelectionHits: 0,
              eligibleSelectionMisses: 0,
              warnings: [],
            };
          }
          throw new PregamePitcherObservationStoreError('append', filePath, observation.gamePk, new Error('hash collision'));
        }
        throw new PregamePitcherObservationStoreError('append', filePath, observation.gamePk, e);
      }

      return {
        observationsConsidered: 1,
        observationsWritten: 1,
        exactDuplicatesSkipped: 0,
        retrospectiveWritesBlocked: 0,
        corruptRecords: 0,
        eligibleSelectionHits: 0,
        eligibleSelectionMisses: 0,
        warnings: [],
      };
    },

    async listForGame(gamePk) {
      const observations = await readGameObservations(gamePk);
      return observations.sort((a, b) => {
        const timeDiff = a.observedAt.getTime() - b.observedAt.getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.sourceResponseHash.localeCompare(b.sourceResponseHash);
      });
    },

    async findLatestEligible(gamePk, predictionCutoff) {
      const observations = await readGameObservations(gamePk);
      const sorted = [...observations].sort((a, b) => {
        const timeDiff = b.observedAt.getTime() - a.observedAt.getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.sourceResponseHash.localeCompare(b.sourceResponseHash);
      });
      for (const observation of sorted) {
        if (isObservationEligible(observation, predictionCutoff)) {
          return observation;
        }
      }
      return null;
    },
  };
}
