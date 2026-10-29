/* MRS-7 P5F-C7B-S2. One-game, explicitly authorized, read-only readiness probe.
 * This is NOT a prospective prediction, model execution or scientific artifact.
 * No filesystem writes. Module imports must be inert.
 * NOTE: The existing MLBStatsApiClient contains automatic retries and a
 * Promise.race timeout which does not abort underlying network fetches.
 * These limits are not hard request count or transport timeout guarantees.
 */
import type { MLBScheduleResult } from '@/lib/research-data/types';
import {
  runMLBOperationalLiveReadonlyPreflight,
  type MLBOperationalLivePreflightDependencies,
  type MLBOperationalLivePreflightTimingInfo,
} from './mlb-operational-live-readonly-preflight';
import { pathToFileURL } from 'node:url';

export type MLBReadOnlyProbeConfig = Readonly<{
  date: string;
  gamePk: number;
  allowLiveReadonly: boolean;
  environmentAcknowledgement: string | undefined;
}>;

export type MLBReadOnlyProbeResult = Readonly<{
  date: string;
  gamePk: number;
  status: 'READY' | 'NOT_READY' | 'NOT_FOUND' | 'DENIED' | 'PROVIDER_ERROR';
  scheduleStatus?: string;
  timing?: MLBOperationalLivePreflightTimingInfo;
  featureCount?: number;
  provenanceCount?: number;
  reasons?: readonly string[];
}>;

function validIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

function validGamePk(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function checkMLBReadOnlyProbeAuthorization(config: MLBReadOnlyProbeConfig): readonly string[] {
  const errors: string[] = [];
  if (config.allowLiveReadonly !== true) errors.push('EXPLICIT_FLAG_REQUIRED');
  if (config.environmentAcknowledgement !== 'YES') errors.push('ENVIRONMENT_ACK_REQUIRED');
  if (!validIsoDate(config.date)) errors.push('INVALID_DATE');
  if (!validGamePk(config.gamePk)) errors.push('INVALID_GAME_PK');
  return errors;
}

/** Provider-like dependencies are injected; no network client is instantiated here. */
export async function runMLBOperationalLiveReadonlyProbe(
  config: MLBReadOnlyProbeConfig,
  provider: Pick<MLBOperationalLivePreflightDependencies, 'fetchSchedule' | 'buildGameSnapshot'>,
  now: () => Date,
): Promise<MLBReadOnlyProbeResult> {
  const failures = checkMLBReadOnlyProbeAuthorization(config);
  if (failures.length) {
    return { date: config.date, gamePk: config.gamePk, status: 'DENIED', reasons: failures };
  }

  let scheduleStatus: string | undefined;
  let discovery: 'MISSING' | 'DUPLICATE' | 'DATE_MISMATCH' | null = null;
  let snapshotCalls = 0;

  const deps: MLBOperationalLivePreflightDependencies = {
    now,
    fetchSchedule: async (date: string): Promise<MLBScheduleResult> => {
      const schedule = await provider.fetchSchedule(date);
      if (!schedule || !Array.isArray(schedule.games)) throw new Error('INVALID_SCHEDULE');
      const matches = schedule.games.filter((g) => g.gamePk === config.gamePk);
      if (matches.length === 0) discovery = 'MISSING';
      if (matches.length > 1) discovery = 'DUPLICATE';
      if (matches.length === 1 && matches[0].officialDate !== config.date) {
        discovery = 'DATE_MISMATCH';
      }
      if (discovery !== null) return { ...schedule, games: [] };
      scheduleStatus = matches[0].status;
      return { ...schedule, games: matches };
    },
    buildGameSnapshot: async (game, options) => {
      if (game.gamePk !== config.gamePk || snapshotCalls++ > 0) {
        throw new Error('UNAUTHORIZED_ADAPTER_CALL');
      }
      return provider.buildGameSnapshot(game, { ...options, includeWeather: false });
    },
  };

  try {
    const result = await runMLBOperationalLiveReadonlyPreflight(config.date, deps);
    if (discovery === 'MISSING') {
      return { date: config.date, gamePk: config.gamePk, status: 'NOT_FOUND', reasons: ['GAME_PK_NOT_FOUND'] };
    }
    if (discovery === 'DUPLICATE' || discovery === 'DATE_MISMATCH') {
      return {
        date: config.date, gamePk: config.gamePk, status: 'NOT_READY',
        reasons: [discovery === 'DUPLICATE' ? 'AMBIGUOUS_GAME_PK' : 'OFFICIAL_DATE_MISMATCH'],
      };
    }
    if (result.games.length !== 1 || result.totalGameCount !== 1) {
      return { date: config.date, gamePk: config.gamePk, status: 'PROVIDER_ERROR', reasons: ['INVALID_S1_RESULT'] };
    }
    const item = result.games[0];
    if (item.eligibility === 'NOT_READY') {
      return {
        date: config.date, gamePk: config.gamePk, status: 'NOT_READY', scheduleStatus,
        timing: item.timing,
        reasons: item.rejectionReasons,
      };
    }
    return {
      date: config.date, gamePk: config.gamePk, status: 'READY', scheduleStatus,
      timing: item.timing, featureCount: item.featureVector.values.length,
      provenanceCount: item.provenance.length,
    };
  } catch {
    // Never surface raw provider response, endpoint URLs, credentials or stack traces.
    return { date: config.date, gamePk: config.gamePk, status: 'PROVIDER_ERROR', reasons: ['READ_ONLY_PROVIDER_FAILURE'] };
  }
}

export type MLBReadOnlyProbeCliParse =
  | Readonly<{ ok: true; config: MLBReadOnlyProbeConfig }>
  | Readonly<{ ok: false; help: boolean; reasons: readonly string[] }>;

export function parseMLBReadOnlyProbeCli(
  args: readonly string[], ack: string | undefined,
): MLBReadOnlyProbeCliParse {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    return { ok: false, help: true, reasons: [] };
  }
  const parsed: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--allow-live-readonly') {
      if (parsed[arg] !== undefined) return { ok: false, help: false, reasons: ['DUPLICATE_FLAG'] };
      parsed[arg] = true;
      continue;
    }
    if (arg === '--date' || arg === '--game-pk') {
      if (parsed[arg] !== undefined || !args[i + 1]) return { ok: false, help: false, reasons: ['INVALID_ARGUMENTS'] };
      parsed[arg] = args[++i];
      continue;
    }
    return { ok: false, help: false, reasons: ['UNKNOWN_ARGUMENT'] };
  }
  const pkRaw = parsed['--game-pk'];
  const gamePk = typeof pkRaw === 'string' && /^[1-9]\d*$/.test(pkRaw)
    ? Number(pkRaw) : NaN;
  const config: MLBReadOnlyProbeConfig = {
    date: typeof parsed['--date'] === 'string' ? parsed['--date'] : '',
    gamePk,
    allowLiveReadonly: parsed['--allow-live-readonly'] === true,
    environmentAcknowledgement: ack,
  };
  const errors = checkMLBReadOnlyProbeAuthorization(config);
  return errors.length ? { ok: false, help: false, reasons: errors } : { ok: true, config };
}

function isDirectExecution(moduleUrl: string, argvEntry: string | undefined): boolean {
  return argvEntry !== undefined && moduleUrl === pathToFileURL(argvEntry).href;
}

const USAGE = 'Usage: mlb-operational-live-readonly-probe.ts --date YYYY-MM-DD --game-pk INTEGER --allow-live-readonly (requires MRS_LIVE_READONLY_PROBE_ACK=YES)';

async function runAuthorizedCli(config: MLBReadOnlyProbeConfig): Promise<void> {
  // Only reach dynamic provider import after all two explicit authorization gates.
  // The locked existing client is GET-only, but its retry / non-aborting timeout
  // behavior remains a known limitation subject to review before live execution.
  const [{ MLBResearchDataAdapter }, { MLBStatsApiClient }] = await Promise.all([
    import('@/lib/research-data/mlb/provider'),
    import('@/lib/research-data/mlb/stats-api-client'),
  ]);
  const client = new MLBStatsApiClient({
    baseUrl: 'https://statsapi.mlb.com/api/v1', quiet: true, timeoutMs: 20000,
  });
  const provider = new MLBResearchDataAdapter({ client });
  const result = await runMLBOperationalLiveReadonlyProbe(config, provider, () => new Date());
  // Sanitize even S1 rejection messages: research acquisition errors may
  // otherwise contain an endpoint, credentials or raw provider content.
  const sanitizedReasons = result.reasons?.map((reason) => {
    if (/^(GAME_PK_NOT_FOUND|AMBIGUOUS_GAME_PK|OFFICIAL_DATE_MISMATCH|READ_ONLY_PROVIDER_FAILURE|INVALID_S1_RESULT)$/.test(reason)) return reason;
    if (reason.startsWith('Schedule status')) return 'NOT_UPCOMING';
    if (reason.startsWith('Research snapshot acquisition failed')) return 'RESEARCH_ACQUISITION_FAILED';
    if (reason.startsWith('Canonical snapshot bridge rejected')) return 'CANONICAL_REJECTED';
    if (reason.startsWith('Feature vector extraction rejected')) return 'FEATURE_EXTRACTION_REJECTED';
    if (reason.includes('time') || reason.includes('cutoff') || reason.includes('provenance')) return 'TIMING_OR_PROVENANCE_REJECTED';
    return 'S1_READINESS_REJECTED';
  });
  const summary = {
    date: result.date, gamePk: result.gamePk, status: result.status,
    scheduleStatus: result.scheduleStatus, timing: result.timing,
    featureCount: result.featureCount, provenanceCount: result.provenanceCount,
    reasons: sanitizedReasons ? [...new Set(sanitizedReasons)] : undefined,
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  if (result.status !== 'READY') process.exitCode = 1;
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  const parsed = parseMLBReadOnlyProbeCli(
    process.argv.slice(2), process.env.MRS_LIVE_READONLY_PROBE_ACK,
  );
  if (!parsed.ok) {
    if (parsed.help) {
      process.stdout.write(`${USAGE}\n`);
    } else {
      process.stderr.write(`LIVE_READONLY_PROBE_NOT_AUTHORIZED: ${parsed.reasons.join(',')}\n${USAGE}\n`);
      process.exitCode = 2;
    }
  } else {
    void runAuthorizedCli(parsed.config).catch(() => {
      process.stderr.write('READ_ONLY_PROVIDER_FAILURE\n');
      process.exitCode = 1;
    });
  }
}
