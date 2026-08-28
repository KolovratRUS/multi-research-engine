import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
  MLB_PROSPECTIVE_HOLDOUT_SCI_CUTOFF_MINUTES,
} from './mlb-prospective-holdout-protocol-contract';
import {
  MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
  MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
  computeScientificCutoffAt,
  type MLBProspectiveT360T360Validation,
} from './mlb-prospective-t360-capture-contract';
import {
  validateMLBCanonicalPregameSnapshot,
  type MLBCanonicalPregameSnapshot,
} from './mlb-pregame-snapshot-contract';
import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
} from './mlb-real-pregame-winner-feature-manifest-v1';
import {
  extractMLBLeakageSafeFeatureVector,
  validateMLBFeatureVector,
  type MLBFeatureVector,
} from './mlb-feature-vector-contract';
import {
  applyCandidate003ProspectiveFeatureCompatibility,
} from './mlb-candidate-003-prospective-feature-compatibility';

/* -------------------------------------------------------------------------- */
/*  Contract versions                                                         */
/* -------------------------------------------------------------------------- */

export const MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION =
  'mlb-prospective-pregame-evidence-artifact-v1' as const;

export const MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION =
  'mlb-prospective-pregame-evidence-store-v1' as const;

export const MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_DIRECTORY =
  'var/mlb-development/mlb-prospective-pregame-evidence' as const;

/* -------------------------------------------------------------------------- */
/*  Failure codes                                                             */
/* -------------------------------------------------------------------------- */

export const MLB_PROSPECTIVE_PREGAME_EVIDENCE_FAILURE_CODES = Object.freeze([
  'INVALID_EVIDENCE_INPUT',
  'ARTIFACT_VALIDATION_FAILED',
  'INVALID_PERSISTENCE_TIMESTAMP',
  'PERSISTENCE_AFTER_SCHEDULED_START',
  'PERSISTENCE_BEFORE_CAPTURE',
  'PATH_DERIVATION_FAILED',
  'ARTIFACT_ALREADY_EXISTS',
  'WRITE_FAILED',
  'HASH_VERIFICATION_FAILED',
  'TEMPORARY_FILE_CLEANUP_FAILED',
] as const);

export type MLBProspectivePregameEvidenceFailureCode =
  typeof MLB_PROSPECTIVE_PREGAME_EVIDENCE_FAILURE_CODES[number];

/* -------------------------------------------------------------------------- */
/*  Prepared evidence (caller-supplied, before store ownership)               */
/* -------------------------------------------------------------------------- */

export type MLBProspectivePregameEvidencePrepared = Readonly<{
  contractVersion: typeof MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION;
  protocolId: typeof MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID;
  activationId: string;
  captureContractVersion: typeof MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION;
  compatibilityLayerId: typeof MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1;
  gameId: string;
  snapshotId: string;
  officialDate: string;
  scheduledStartAt: string;
  scientificCutoffAt: string;
  actualDataCutoffAt: string;
  rawSnapshot: MLBCanonicalPregameSnapshot;
  rawFeatureVector: MLBFeatureVector;
  candidate003CompatibleFeatureVector: MLBFeatureVector;
  t360Validation: MLBProspectiveT360T360Validation;
}>;

/* -------------------------------------------------------------------------- */
/*  Persisted evidence (store-owned persistedAt added)                        */
/* -------------------------------------------------------------------------- */

export type MLBProspectivePregameEvidence = Readonly<
  MLBProspectivePregameEvidencePrepared & { persistedAt: string }
>;

/* -------------------------------------------------------------------------- */
/*  Store receipt                                                             */
/* -------------------------------------------------------------------------- */

export type MLBProspectivePregameEvidenceReceipt = Readonly<{
  storeVersion: typeof MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION;
  artifactContractVersion: typeof MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION;
  artifactId: string;
  protocolId: typeof MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID;
  activationId: string;
  gameId: string;
  snapshotId: string;
  relativePath: string;
  sha256: string;
  byteLength: number;
  persistedAt: string;
}>;

/* -------------------------------------------------------------------------- */
/*  Issue types                                                               */
/* -------------------------------------------------------------------------- */

export type MLBProspectivePregameEvidenceIssue = Readonly<{
  code: MLBProspectivePregameEvidenceFailureCode;
  path: string;
  message: string;
}>;

export type MLBProspectivePregameEvidenceValidationResult =
  | Readonly<{ ok: true; value: MLBProspectivePregameEvidencePrepared }>
  | Readonly<{ ok: false; issues: readonly MLBProspectivePregameEvidenceIssue[] }>;

export type MLBProspectivePregameEvidencePersistedValidationResult =
  | Readonly<{ ok: true; value: MLBProspectivePregameEvidence }>
  | Readonly<{ ok: false; issues: readonly MLBProspectivePregameEvidenceIssue[] }>;

export type MLBProspectivePregameEvidencePersistenceResult =
  | Readonly<{ ok: true; receipt: MLBProspectivePregameEvidenceReceipt }>
  | Readonly<{ ok: false; issues: readonly MLBProspectivePregameEvidenceIssue[] }>;

export type MLBProspectivePregameEvidenceReadResult =
  | Readonly<{ ok: true; value: MLBProspectivePregameEvidence; receipt: MLBProspectivePregameEvidenceReceipt }>
  | Readonly<{ ok: false; issues: readonly MLBProspectivePregameEvidenceIssue[] }>;

/* -------------------------------------------------------------------------- */
/*  Artifact identity                                                         */
/* -------------------------------------------------------------------------- */

export function computeArtifactId(
  evidence: MLBProspectivePregameEvidencePrepared,
): string {
  const parts = [
    evidence.protocolId,
    evidence.activationId,
    evidence.gameId,
    evidence.snapshotId,
    evidence.scientificCutoffAt,
  ];
  return parts.join('::');
}

/* -------------------------------------------------------------------------- */
/*  Canonical serialization                                                   */
/* -------------------------------------------------------------------------- */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function sortObjectKeys(value: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.getOwnPropertyNames(value).sort();
  const sorted: Record<string, unknown> = {};
  for (const key of keys) {
    sorted[key] = sortValue(value[key]);
  }
  return sorted;
}

function sortValue(value: unknown): unknown {
  if (isPlainObject(value)) {
    return sortObjectKeys(value);
  }
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  return value;
}

export function canonicalSerialize(artifact: MLBProspectivePregameEvidence): string {
  if (isPlainObject(artifact)) {
    return JSON.stringify(sortObjectKeys(artifact));
  }
  throw new TypeError('canonicalSerialize requires a plain object');
}

/* -------------------------------------------------------------------------- */
/*  Strict own-key validation helpers                                         */
/* -------------------------------------------------------------------------- */

export type OwnDataPropertyResult =
  | Readonly<{ kind: 'missing' }>
  | Readonly<{ kind: 'accessor' }>
  | Readonly<{ kind: 'data'; value: unknown }>;

export function ownDataProperty(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBProspectivePregameEvidenceIssue[],
): OwnDataPropertyResult {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (!descriptor) {
    return { kind: 'missing' };
  }
  if (!isDataDescriptor(descriptor)) {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', path, `${path} is an accessor property`);
    return { kind: 'accessor' };
  }
  return { kind: 'data', value: descriptor.value };
}

function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { value: unknown } {
  return !!descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value');
}

export function pushIssue(
  issues: MLBProspectivePregameEvidenceIssue[],
  code: MLBProspectivePregameEvidenceIssue['code'],
  path: string,
  message: string,
): void {
  const exists = issues.some((item) => item.path === path && item.code === code);
  if (!exists) {
    issues.push({ code, path, message });
  }
}

export function sortIssues(
  issues: MLBProspectivePregameEvidenceIssue[],
): MLBProspectivePregameEvidenceIssue[] {
  return issues
    .slice()
    .sort((a, b) => {
      const pathDiff = a.path < b.path ? -1 : a.path === b.path ? 0 : 1;
      if (pathDiff !== 0) return pathDiff;
      const codeDiff = a.code < b.code ? -1 : a.code === b.code ? 0 : 1;
      return codeDiff;
    })
    .filter(
      (item, index, array) =>
        index === 0 || item.path !== array[index - 1].path || item.code !== array[index - 1].code,
    );
}

/* -------------------------------------------------------------------------- */
/*  Identifier / timestamp helpers                                            */
/* -------------------------------------------------------------------------- */

function validateIdentifier(
  value: unknown,
  path: string,
  label: string,
  issues: MLBProspectivePregameEvidenceIssue[],
): void {
  if (typeof value !== 'string' || value !== value.trim() || value.length === 0) {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', path, `${label} must be a non-empty trimmed string`);
  }
}

function validatePathSafeIdentifier(
  value: unknown,
  path: string,
  label: string,
  issues: MLBProspectivePregameEvidenceIssue[],
): void {
  if (typeof value !== 'string' || value !== value.trim() || value.length === 0) {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', path, `${label} must be a non-empty trimmed string`);
    return;
  }
  if (value.includes('..') || value.includes('/') || value.includes('\\') || value.includes('\0')) {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', path, `${label} contains path-unsafe characters`);
  }
}

function validateRFC3339Timestamp(
  value: unknown,
  path: string,
  label: string,
  issues: MLBProspectivePregameEvidenceIssue[],
): void {
  if (typeof value !== 'string' || value !== value.trim() || value.length === 0) {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', path, `${label} must be a non-empty trimmed string`);
    return;
  }
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  ) {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', path, `${label} is not a valid RFC3339 timestamp`);
    return;
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', path, `${label} is not a valid RFC3339 timestamp`);
  }
}

function parseTimestampToMs(value: unknown): number {
  if (typeof value !== 'string') {
    return NaN;
  }
  const trimmed = value.trim();
  if (trimmed !== value || trimmed.length === 0) {
    return NaN;
  }
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(trimmed)
  ) {
    return NaN;
  }
  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? ms : NaN;
}

/* -------------------------------------------------------------------------- */
/*  Known field sets                                                          */
/* -------------------------------------------------------------------------- */

const KNOWN_PREPARED_FIELDS = new Set([
  'contractVersion',
  'protocolId',
  'activationId',
  'captureContractVersion',
  'compatibilityLayerId',
  'gameId',
  'snapshotId',
  'officialDate',
  'scheduledStartAt',
  'scientificCutoffAt',
  'actualDataCutoffAt',
  'rawSnapshot',
  'rawFeatureVector',
  'candidate003CompatibleFeatureVector',
  't360Validation',
]);

const KNOWN_PERSISTED_FIELDS = new Set([
  ...KNOWN_PREPARED_FIELDS,
  'persistedAt',
]);

const KNOWN_T360_VALIDATION_FIELDS = new Set([
  'status',
  'actualDataCutoffAtLteScientificCutoff',
  'sourceTimestampsProvenLteScientificCutoff',
]);

/* -------------------------------------------------------------------------- */
/*  Feature vector exact comparison                                           */
/* -------------------------------------------------------------------------- */

function areFeatureVectorsEqual(a: MLBFeatureVector, b: MLBFeatureVector): boolean {
  if (a.contractVersion !== b.contractVersion) return false;
  if (a.sport !== b.sport) return false;
  if (a.target !== b.target) return false;
  if (a.manifestId !== b.manifestId) return false;
  if (a.snapshotId !== b.snapshotId) return false;
  if (a.gameId !== b.gameId) return false;
  if (a.officialDate !== b.officialDate) return false;
  if (a.dataCutoffAt !== b.dataCutoffAt) return false;
  if (a.values.length !== b.values.length) return false;
  for (let i = 0; i < a.values.length; i++) {
    if (a.values[i].featureId !== b.values[i].featureId) return false;
    if (a.values[i].value !== b.values[i].value) return false;
    if (a.values[i].wasMissing !== b.values[i].wasMissing) return false;
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/*  T-360 evidence revalidation                                               */
/* -------------------------------------------------------------------------- */

function validateT360Timestamps(
  snapshot: MLBCanonicalPregameSnapshot,
  scientificCutoffAt: string,
  issues: MLBProspectivePregameEvidenceIssue[],
): void {
  const cutoffMs = parseTimestampToMs(scientificCutoffAt);
  if (!Number.isFinite(cutoffMs)) {
    pushIssue(
      issues,
      'INVALID_EVIDENCE_INPUT',
      '$.scientificCutoffAt',
      'scientificCutoffAt is not a valid timestamp',
    );
    return;
  }

  for (let i = 0; i < snapshot.sourceReferences.length; i++) {
    const sourceRef = snapshot.sourceReferences[i];
    const fetchedMs = parseTimestampToMs(sourceRef.fetchedAt);
    if (!Number.isFinite(fetchedMs) || fetchedMs > cutoffMs) {
      pushIssue(
        issues,
        'ARTIFACT_VALIDATION_FAILED',
        `$.rawSnapshot.sourceReferences[${i}].fetchedAt`,
        `Source reference fetchedAt ${sourceRef.fetchedAt} is after or unprovable before scientific cutoff ${scientificCutoffAt}`,
      );
    }
    const updatedAt = sourceRef.sourceUpdatedAt;
    if (updatedAt !== null) {
      const updatedMs = parseTimestampToMs(updatedAt);
      if (!Number.isFinite(updatedMs) || updatedMs > cutoffMs) {
        pushIssue(
          issues,
          'ARTIFACT_VALIDATION_FAILED',
          `$.rawSnapshot.sourceReferences[${i}].sourceUpdatedAt`,
          `Source reference sourceUpdatedAt ${updatedAt} is after or unprovable before scientific cutoff ${scientificCutoffAt}`,
        );
      }
    }
  }

  const homeAnnounced = snapshot.startingPitchers.home.announcedAt;
  if (homeAnnounced !== null) {
    const homeMs = parseTimestampToMs(homeAnnounced);
    if (!Number.isFinite(homeMs) || homeMs > cutoffMs) {
      pushIssue(
        issues,
        'ARTIFACT_VALIDATION_FAILED',
        '$.rawSnapshot.startingPitchers.home.announcedAt',
        `Home starting pitcher announcedAt ${homeAnnounced} is after or unprovable before scientific cutoff ${scientificCutoffAt}`,
      );
    }
  }

  const awayAnnounced = snapshot.startingPitchers.away.announcedAt;
  if (awayAnnounced !== null) {
    const awayMs = parseTimestampToMs(awayAnnounced);
    if (!Number.isFinite(awayMs) || awayMs > cutoffMs) {
      pushIssue(
        issues,
        'ARTIFACT_VALIDATION_FAILED',
        '$.rawSnapshot.startingPitchers.away.announcedAt',
        `Away starting pitcher announcedAt ${awayAnnounced} is after or unprovable before scientific cutoff ${scientificCutoffAt}`,
      );
    }
  }

  for (let i = 0; i < snapshot.sections.length; i++) {
    const section = snapshot.sections[i];
    const asOfMs = parseTimestampToMs(section.asOfAt);
    if (!Number.isFinite(asOfMs) || asOfMs > cutoffMs) {
      pushIssue(
        issues,
        'ARTIFACT_VALIDATION_FAILED',
        `$.rawSnapshot.sections[${i}].asOfAt`,
        `Section ${section.sectionId} asOfAt ${section.asOfAt} is after or unprovable before scientific cutoff ${scientificCutoffAt}`,
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Prepared evidence validation                                              */
/* -------------------------------------------------------------------------- */

export function validateMLBProspectivePregameEvidencePrepared(
  value: unknown,
): MLBProspectivePregameEvidenceValidationResult {
  const issues: MLBProspectivePregameEvidenceIssue[] = [];

  // 1. Strict plain-object + own-key check
  if (!isPlainObject(value)) {
    return { ok: false, issues: [{ code: 'INVALID_EVIDENCE_INPUT', path: '$', message: 'Evidence must be a plain object' }] };
  }
  const root = value as Record<string, unknown>;

  const rootOwnNames = Object.getOwnPropertyNames(root);
  for (const key of rootOwnNames) {
    if (!KNOWN_PREPARED_FIELDS.has(key)) {
      pushIssue(issues, 'INVALID_EVIDENCE_INPUT', `$.${key}`, `Unknown prepared field: ${key}`);
    }
  }
  for (const symbol of Object.getOwnPropertySymbols(root)) {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', `$[${String(symbol)}]`, `Unknown symbol property: ${symbol.description ?? symbol.toString()}`);
  }

  // 2. Required scalar fields
  const contractVersionResult = ownDataProperty(root, 'contractVersion', '$.contractVersion', issues);
  if (contractVersionResult.kind === 'missing') {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', '$.contractVersion', 'contractVersion is required');
  } else if (contractVersionResult.kind === 'data' && contractVersionResult.value !== MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION) {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', '$.contractVersion', `contractVersion must be ${MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION}`);
  }

  const protocolIdResult = ownDataProperty(root, 'protocolId', '$.protocolId', issues);
  if (protocolIdResult.kind === 'missing') {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', '$.protocolId', 'protocolId is required');
  } else if (protocolIdResult.kind === 'data' && protocolIdResult.value !== MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID) {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', '$.protocolId', `protocolId must be ${MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID}`);
  }

  const activationIdResult = ownDataProperty(root, 'activationId', '$.activationId', issues);
  if (activationIdResult.kind === 'missing') {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', '$.activationId', 'activationId is required');
  } else if (activationIdResult.kind === 'data') {
    validatePathSafeIdentifier(activationIdResult.value, '$.activationId', 'activationId', issues);
  }

  const captureContractVersionResult = ownDataProperty(root, 'captureContractVersion', '$.captureContractVersion', issues);
  if (captureContractVersionResult.kind === 'missing') {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', '$.captureContractVersion', 'captureContractVersion is required');
  } else if (captureContractVersionResult.kind === 'data' && captureContractVersionResult.value !== MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION) {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', '$.captureContractVersion', `captureContractVersion must be ${MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION}`);
  }

  const compatibilityLayerIdResult = ownDataProperty(root, 'compatibilityLayerId', '$.compatibilityLayerId', issues);
  if (compatibilityLayerIdResult.kind === 'missing') {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', '$.compatibilityLayerId', 'compatibilityLayerId is required');
  } else if (compatibilityLayerIdResult.kind === 'data' && compatibilityLayerIdResult.value !== MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1) {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', '$.compatibilityLayerId', `compatibilityLayerId must be ${MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1}`);
  }

  const gameIdResult = ownDataProperty(root, 'gameId', '$.gameId', issues);
  if (gameIdResult.kind === 'missing') {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', '$.gameId', 'gameId is required');
  } else if (gameIdResult.kind === 'data') {
    validatePathSafeIdentifier(gameIdResult.value, '$.gameId', 'gameId', issues);
  }

  const snapshotIdResult = ownDataProperty(root, 'snapshotId', '$.snapshotId', issues);
  if (snapshotIdResult.kind === 'missing') {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', '$.snapshotId', 'snapshotId is required');
  } else if (snapshotIdResult.kind === 'data') {
    validatePathSafeIdentifier(snapshotIdResult.value, '$.snapshotId', 'snapshotId', issues);
  }

  const officialDateResult = ownDataProperty(root, 'officialDate', '$.officialDate', issues);
  if (officialDateResult.kind === 'missing') {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', '$.officialDate', 'officialDate is required');
  } else if (officialDateResult.kind === 'data') {
    validateIdentifier(officialDateResult.value, '$.officialDate', 'officialDate', issues);
  }

  const scheduledStartAtResult = ownDataProperty(root, 'scheduledStartAt', '$.scheduledStartAt', issues);
  if (scheduledStartAtResult.kind === 'missing') {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', '$.scheduledStartAt', 'scheduledStartAt is required');
  } else if (scheduledStartAtResult.kind === 'data') {
    validateRFC3339Timestamp(scheduledStartAtResult.value, '$.scheduledStartAt', 'scheduledStartAt', issues);
  }

  const scientificCutoffAtResult = ownDataProperty(root, 'scientificCutoffAt', '$.scientificCutoffAt', issues);
  if (scientificCutoffAtResult.kind === 'missing') {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', '$.scientificCutoffAt', 'scientificCutoffAt is required');
  } else if (scientificCutoffAtResult.kind === 'data') {
    validateRFC3339Timestamp(scientificCutoffAtResult.value, '$.scientificCutoffAt', 'scientificCutoffAt', issues);
  }

  const actualDataCutoffAtResult = ownDataProperty(root, 'actualDataCutoffAt', '$.actualDataCutoffAt', issues);
  if (actualDataCutoffAtResult.kind === 'missing') {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', '$.actualDataCutoffAt', 'actualDataCutoffAt is required');
  } else if (actualDataCutoffAtResult.kind === 'data') {
    validateRFC3339Timestamp(actualDataCutoffAtResult.value, '$.actualDataCutoffAt', 'actualDataCutoffAt', issues);
  }

  // 3. Reject derived/persistence fields that caller must NOT provide
  const rejectedCallerFields = new Set([
    'artifactId',
    'persistedAt',
    'sha256',
    'byteLength',
    'relativeStoragePath',
    'homeScore',
    'awayScore',
    'winner',
    'homeWon',
    'label',
    'targetValue',
    'result',
    'finalStatus',
    'postgame',
    'gateResult',
    'prediction',
    'probability',
    'sportsbookOdds',
    'marketPrice',
    'impliedProbability',
    'value',
    'edge',
    'staking',
    'recommendedUnits',
    'cohortIndex',
    'cohortMembership',
    'validationMembership',
    'testMembership',
  ]);
  for (const key of rootOwnNames) {
    if (rejectedCallerFields.has(key)) {
      pushIssue(issues, 'INVALID_EVIDENCE_INPUT', `$.${key}`, `Caller must not supply ${key}`);
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) };
  }

  // 4. Type narrowing for required objects
  const activationId = activationIdResult.kind === 'data' ? String(activationIdResult.value) : '';
  const gameId = gameIdResult.kind === 'data' ? String(gameIdResult.value) : '';
  const snapshotId = snapshotIdResult.kind === 'data' ? String(snapshotIdResult.value) : '';
  const officialDate = officialDateResult.kind === 'data' ? String(officialDateResult.value) : '';
  const scheduledStartAt = scheduledStartAtResult.kind === 'data' ? String(scheduledStartAtResult.value) : '';
  const scientificCutoffAt = scientificCutoffAtResult.kind === 'data' ? String(scientificCutoffAtResult.value) : '';
  const actualDataCutoffAt = actualDataCutoffAtResult.kind === 'data' ? String(actualDataCutoffAtResult.value) : '';

  // 5. Validate rawSnapshot
  const rawSnapshotResult = validateMLBCanonicalPregameSnapshot(root.rawSnapshot);
  if (!rawSnapshotResult.ok) {
    const snapshotIssues: MLBProspectivePregameEvidenceIssue[] = rawSnapshotResult.issues.map(
      (issue): MLBProspectivePregameEvidenceIssue => ({
        code: 'ARTIFACT_VALIDATION_FAILED',
        path: `$.rawSnapshot${issue.path.slice(1)}`,
        message: `Snapshot validation failed: ${issue.message}`,
      }),
    );
    return { ok: false, issues: sortIssues([...issues, ...snapshotIssues]) };
  }
  const validatedSnapshot = rawSnapshotResult.value;

  // 6. Validate t360Validation
  const t360ValidationResult = ownDataProperty(root, 't360Validation', '$.t360Validation', issues);
  if (t360ValidationResult.kind === 'missing') {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', '$.t360Validation', 't360Validation is required');
  } else if (t360ValidationResult.kind === 'data') {
    const t360Val = t360ValidationResult.value as Record<string, unknown>;
    const t360OwnNames = Object.getOwnPropertyNames(t360Val);
    for (const key of t360OwnNames) {
      if (!KNOWN_T360_VALIDATION_FIELDS.has(key)) {
        pushIssue(issues, 'INVALID_EVIDENCE_INPUT', `$.t360Validation.${key}`, `Unknown t360Validation field: ${key}`);
      }
    }
    for (const symbol of Object.getOwnPropertySymbols(t360Val)) {
      pushIssue(issues, 'INVALID_EVIDENCE_INPUT', `$.t360Validation[${String(symbol)}]`, `Unknown symbol property in t360Validation`);
    }
    const statusResult = ownDataProperty(t360Val, 'status', '$.t360Validation.status', issues);
    if (statusResult.kind === 'missing') {
      pushIssue(issues, 'INVALID_EVIDENCE_INPUT', '$.t360Validation.status', 't360Validation.status is required');
    } else if (statusResult.kind === 'data' && statusResult.value !== 'ACCEPTED') {
      pushIssue(issues, 'ARTIFACT_VALIDATION_FAILED', '$.t360Validation.status', 't360Validation.status must be ACCEPTED');
    }
    const actualDataResult = ownDataProperty(t360Val, 'actualDataCutoffAtLteScientificCutoff', '$.t360Validation.actualDataCutoffAtLteScientificCutoff', issues);
    if (actualDataResult.kind === 'missing') {
      pushIssue(issues, 'INVALID_EVIDENCE_INPUT', '$.t360Validation.actualDataCutoffAtLteScientificCutoff', 't360Validation.actualDataCutoffAtLteScientificCutoff is required');
    } else if (actualDataResult.kind === 'data' && actualDataResult.value !== true) {
      pushIssue(issues, 'ARTIFACT_VALIDATION_FAILED', '$.t360Validation.actualDataCutoffAtLteScientificCutoff', 't360Validation.actualDataCutoffAtLteScientificCutoff must be true');
    }
    const sourceTimestampsResult = ownDataProperty(t360Val, 'sourceTimestampsProvenLteScientificCutoff', '$.t360Validation.sourceTimestampsProvenLteScientificCutoff', issues);
    if (sourceTimestampsResult.kind === 'missing') {
      pushIssue(issues, 'INVALID_EVIDENCE_INPUT', '$.t360Validation.sourceTimestampsProvenLteScientificCutoff', 't360Validation.sourceTimestampsProvenLteScientificCutoff is required');
    } else if (sourceTimestampsResult.kind === 'data' && sourceTimestampsResult.value !== true) {
      pushIssue(issues, 'ARTIFACT_VALIDATION_FAILED', '$.t360Validation.sourceTimestampsProvenLteScientificCutoff', 't360Validation.sourceTimestampsProvenLteScientificCutoff must be true');
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) };
  }

  // 7. Cross-field identity invariants
  if (gameId !== validatedSnapshot.game.gameId) {
    pushIssue(issues, 'ARTIFACT_VALIDATION_FAILED', '$.gameId', `gameId ${gameId} does not match snapshot gameId ${validatedSnapshot.game.gameId}`);
  }
  if (snapshotId !== validatedSnapshot.snapshotId) {
    pushIssue(issues, 'ARTIFACT_VALIDATION_FAILED', '$.snapshotId', `snapshotId ${snapshotId} does not match snapshot snapshotId ${validatedSnapshot.snapshotId}`);
  }
  if (officialDate !== validatedSnapshot.game.officialDate) {
    pushIssue(issues, 'ARTIFACT_VALIDATION_FAILED', '$.officialDate', `officialDate ${officialDate} does not match snapshot officialDate ${validatedSnapshot.game.officialDate}`);
  }
  if (scheduledStartAt !== validatedSnapshot.game.scheduledStartAt) {
    pushIssue(issues, 'ARTIFACT_VALIDATION_FAILED', '$.scheduledStartAt', `scheduledStartAt ${scheduledStartAt} does not match snapshot scheduledStartAt ${validatedSnapshot.game.scheduledStartAt}`);
  }
  if (actualDataCutoffAt !== validatedSnapshot.dataCutoffAt) {
    pushIssue(issues, 'ARTIFACT_VALIDATION_FAILED', '$.actualDataCutoffAt', `actualDataCutoffAt ${actualDataCutoffAt} does not match snapshot dataCutoffAt ${validatedSnapshot.dataCutoffAt}`);
  }

  // 8. Scientific cutoff exactness: scheduledStartAt - 360 minutes
  const computedCutoffResult = computeScientificCutoffAt(scheduledStartAt);
  if (!computedCutoffResult.ok) {
    pushIssue(issues, 'ARTIFACT_VALIDATION_FAILED', '$.scientificCutoffAt', `Computed scientific cutoff is invalid: ${computedCutoffResult.message}`);
  } else if (computedCutoffResult.scientificCutoffAt !== scientificCutoffAt) {
    pushIssue(issues, 'ARTIFACT_VALIDATION_FAILED', '$.scientificCutoffAt', `scientificCutoffAt ${scientificCutoffAt} does not equal scheduledStartAt - 360 minutes (${computedCutoffResult.scientificCutoffAt})`);
  }

  // 9. actualDataCutoffAt <= scientificCutoffAt
  const actualDataMs = parseTimestampToMs(actualDataCutoffAt);
  const scientificMs = parseTimestampToMs(scientificCutoffAt);
  if (Number.isFinite(actualDataMs) && Number.isFinite(scientificMs) && actualDataMs > scientificMs) {
    pushIssue(issues, 'ARTIFACT_VALIDATION_FAILED', '$.actualDataCutoffAt', `actualDataCutoffAt ${actualDataCutoffAt} is after scientificCutoffAt ${scientificCutoffAt}`);
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) };
  }

  // 10. T-360 evidence revalidation: do not trust booleans
  validateT360Timestamps(validatedSnapshot, scientificCutoffAt, issues);

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) };
  }

  // 11. Raw feature vector recomputation
  const rawVectorResult = extractMLBLeakageSafeFeatureVector(
    MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    validatedSnapshot,
  );
  if (!rawVectorResult.ok) {
    const extractionIssues: MLBProspectivePregameEvidenceIssue[] = rawVectorResult.issues.map(
      (issue): MLBProspectivePregameEvidenceIssue => ({
        code: 'ARTIFACT_VALIDATION_FAILED',
        path: `$.rawFeatureVector${issue.path.slice(1)}`,
        message: `Raw feature vector recomputation failed: ${issue.message}`,
      }),
    );
    return { ok: false, issues: sortIssues([...issues, ...extractionIssues]) };
  }
  const recomputedRawVector = rawVectorResult.value;

  const rawFeatureVectorResult = validateMLBFeatureVector(root.rawFeatureVector);
  if (!rawFeatureVectorResult.ok) {
    const rawVecIssues: MLBProspectivePregameEvidenceIssue[] = rawFeatureVectorResult.issues.map(
      (issue): MLBProspectivePregameEvidenceIssue => ({
        code: 'ARTIFACT_VALIDATION_FAILED',
        path: `$.rawFeatureVector${issue.path.slice(1)}`,
        message: `Stored rawFeatureVector invalid: ${issue.message}`,
      }),
    );
    return { ok: false, issues: sortIssues([...issues, ...rawVecIssues]) };
  }
  const storedRawVector = rawFeatureVectorResult.value;

  if (!areFeatureVectorsEqual(recomputedRawVector, storedRawVector)) {
    pushIssue(issues, 'ARTIFACT_VALIDATION_FAILED', '$.rawFeatureVector', 'Recomputed raw feature vector does not match stored rawFeatureVector exactly');
  }

  // 12. Candidate-003 vector recomputation
  const compatibleResult = applyCandidate003ProspectiveFeatureCompatibility(recomputedRawVector);
  if (!compatibleResult.ok) {
    const compatIssues: MLBProspectivePregameEvidenceIssue[] = compatibleResult.issues.map(
      (issue): MLBProspectivePregameEvidenceIssue => ({
        code: 'ARTIFACT_VALIDATION_FAILED',
        path: `$.candidate003CompatibleFeatureVector${issue.path.slice(1)}`,
        message: `Candidate-003 compatibility projection failed: ${issue.message}`,
      }),
    );
    return { ok: false, issues: sortIssues([...issues, ...compatIssues]) };
  }
  const recomputedCompatibleVector = compatibleResult.value;

  const compatibleVectorResult = validateMLBFeatureVector(root.candidate003CompatibleFeatureVector);
  if (!compatibleVectorResult.ok) {
    const compatVecIssues: MLBProspectivePregameEvidenceIssue[] = compatibleVectorResult.issues.map(
      (issue): MLBProspectivePregameEvidenceIssue => ({
        code: 'ARTIFACT_VALIDATION_FAILED',
        path: `$.candidate003CompatibleFeatureVector${issue.path.slice(1)}`,
        message: `Stored candidate003CompatibleFeatureVector invalid: ${issue.message}`,
      }),
    );
    return { ok: false, issues: sortIssues([...issues, ...compatVecIssues]) };
  }
  const storedCompatibleVector = compatibleVectorResult.value;

  if (!areFeatureVectorsEqual(recomputedCompatibleVector, storedCompatibleVector)) {
    pushIssue(issues, 'ARTIFACT_VALIDATION_FAILED', '$.candidate003CompatibleFeatureVector', 'Recomputed candidate-003 compatible vector does not match stored candidate003CompatibleFeatureVector exactly');
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) };
  }

  // 13. Build immutable prepared evidence with deterministic key order
  const prepared: MLBProspectivePregameEvidencePrepared = Object.freeze({
    contractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId,
    captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
    compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
    gameId,
    snapshotId,
    officialDate,
    scheduledStartAt,
    scientificCutoffAt,
    actualDataCutoffAt,
    rawSnapshot: Object.freeze(validatedSnapshot),
    rawFeatureVector: Object.freeze(storedRawVector),
    candidate003CompatibleFeatureVector: Object.freeze(storedCompatibleVector),
    t360Validation: Object.freeze({
      status: 'ACCEPTED' as const,
      actualDataCutoffAtLteScientificCutoff: true,
      sourceTimestampsProvenLteScientificCutoff: true,
    }),
  });

  return { ok: true, value: prepared };
}

/* -------------------------------------------------------------------------- */
/*  Persisted evidence validation                                              */
/* -------------------------------------------------------------------------- */

export function validateMLBProspectivePregameEvidence(
  value: unknown,
): MLBProspectivePregameEvidencePersistedValidationResult {
  const issues: MLBProspectivePregameEvidenceIssue[] = [];

  // 1. Strict plain-object + own-key check
  if (!isPlainObject(value)) {
    return { ok: false, issues: [{ code: 'INVALID_EVIDENCE_INPUT', path: '$', message: 'Persisted evidence must be a plain object' }] };
  }
  const root = value as Record<string, unknown>;

  const rootOwnNames = Object.getOwnPropertyNames(root);
  for (const key of rootOwnNames) {
    if (!KNOWN_PERSISTED_FIELDS.has(key)) {
      pushIssue(issues, 'INVALID_EVIDENCE_INPUT', `$.${key}`, `Unknown persisted field: ${key}`);
    }
  }
  for (const symbol of Object.getOwnPropertySymbols(root)) {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', `$[${String(symbol)}]`, `Unknown symbol property: ${symbol.description ?? symbol.toString()}`);
  }

  // 2. Reject store metadata that must not be embedded in durable bytes
  const rejectedStoreFields = new Set([
    'sha256',
    'byteLength',
    'relativeStoragePath',
    'relativePath',
  ]);
  for (const key of rootOwnNames) {
    if (rejectedStoreFields.has(key)) {
      pushIssue(issues, 'INVALID_EVIDENCE_INPUT', `$.${key}`, `Store metadata must not be embedded: ${key}`);
    }
  }

  // 3. Extract persistedAt
  const persistedAtResult = ownDataProperty(root, 'persistedAt', '$.persistedAt', issues);
  if (persistedAtResult.kind === 'missing') {
    pushIssue(issues, 'INVALID_EVIDENCE_INPUT', '$.persistedAt', 'persistedAt is required in persisted artifact');
  } else if (persistedAtResult.kind === 'data') {
    validateRFC3339Timestamp(persistedAtResult.value, '$.persistedAt', 'persistedAt', issues);
  }

  // 4. Build prepared-shaped object and reuse prepared validator
  const preparedRoot: Record<string, unknown> = {};
  for (const key of rootOwnNames) {
    if (key === 'persistedAt') continue;
    const desc = Object.getOwnPropertyDescriptor(root, key);
    if (desc && Object.prototype.hasOwnProperty.call(desc, 'value')) {
      preparedRoot[key] = desc.value;
    }
  }

  const preparedValidation = validateMLBProspectivePregameEvidencePrepared(preparedRoot);
  if (!preparedValidation.ok) {
    const preparedIssues: MLBProspectivePregameEvidenceIssue[] = preparedValidation.issues.map(
      (issue): MLBProspectivePregameEvidenceIssue => ({
        ...issue,
        code: 'ARTIFACT_VALIDATION_FAILED',
      }),
    );
    return { ok: false, issues: sortIssues([...issues, ...preparedIssues]) };
  }

  // 5. Validate persistedAt relationships
  if (persistedAtResult.kind === 'data') {
    const persistedAt = String(persistedAtResult.value);
    const capturedMs = parseTimestampToMs(preparedValidation.value.rawSnapshot.capturedAt);
    const persistedMs = parseTimestampToMs(persistedAt);
    const scheduledMs = parseTimestampToMs(preparedValidation.value.scheduledStartAt);

    if (Number.isFinite(capturedMs) && Number.isFinite(persistedMs) && persistedMs < capturedMs) {
      pushIssue(issues, 'PERSISTENCE_BEFORE_CAPTURE', '$.persistedAt', `persistedAt ${persistedAt} must be >= capturedAt ${preparedValidation.value.rawSnapshot.capturedAt}`);
    }
    if (Number.isFinite(persistedMs) && Number.isFinite(scheduledMs) && persistedMs >= scheduledMs) {
      pushIssue(issues, 'PERSISTENCE_AFTER_SCHEDULED_START', '$.persistedAt', `persistedAt ${persistedAt} must be < scheduledStartAt ${preparedValidation.value.scheduledStartAt}`);
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) };
  }

  // 6. Build frozen persisted artifact
  const persistedAt =
    persistedAtResult.kind === 'data'
      ? String(persistedAtResult.value)
      : '';
  const artifact: MLBProspectivePregameEvidence = Object.freeze({
    ...preparedValidation.value,
    persistedAt,
  });

  return { ok: true, value: artifact };
}

export { isPlainObject };
export type MLBProspectivePregameEvidenceClockReader = () => string;
