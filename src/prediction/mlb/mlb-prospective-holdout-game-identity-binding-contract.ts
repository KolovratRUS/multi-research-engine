import crypto from 'node:crypto';
import {
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
  type MLBProspectivePregameEvidence,
  type MLBProspectivePregameEvidenceReceipt,
  computeArtifactId,
  canonicalSerialize as canonicalSerializeEvidence,
  validateMLBProspectivePregameEvidence,
  isPlainObject,
} from './mlb-prospective-pregame-evidence-artifact-contract';
import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
} from './mlb-prospective-holdout-protocol-contract';

/* -------------------------------------------------------------------------- */
/*  Contract versions                                                         */
/* -------------------------------------------------------------------------- */

export const MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION =
  'mlb-prospective-holdout-game-identity-binding-v1' as const;

export const MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION =
  'mlb-prospective-holdout-game-identity-binding-store-v1' as const;

export const MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_DIRECTORY =
  'var/mlb-development/mlb-prospective-holdout-game-identity-bindings' as const;

/* -------------------------------------------------------------------------- */
/*  Failure codes                                                             */
/* -------------------------------------------------------------------------- */

export const MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_FAILURE_CODES = Object.freeze([
  'INVALID_BINDING_INPUT',
  'SCHEDULE_GAME_VALIDATION_FAILED',
  'GAME_PK_EVIDENCE_IDENTITY_MISMATCH',
  'SOURCE_CROSSCHECK_MISMATCH',
  'EVIDENCE_REVALIDATION_FAILED',
  'ARTIFACT_ID_MISMATCH',
  'RECEIPT_SHA_MISMATCH',
  'RECEIPT_BYTE_LENGTH_MISMATCH',
  'INVALID_PERSISTED_AT',
  'BINDING_TIMING_VIOLATION',
  'BINDING_ALREADY_EXISTS',
  'WRITE_FAILED',
  'HASH_VERIFICATION_FAILED',
  'TEMPORARY_FILE_CLEANUP_FAILED',
  'PROHIBITED_FIELD',
  'MISSING_FIELD',
  'IDENTITY_MISMATCH',
  'INVALID_STRING',
  'INVALID_DATE',
  'INVALID_TIMESTAMP',
  'INVALID_JSON_VALUE',
] as const);

export type MLBProspectiveHoldoutGameIdentityBindingFailureCode =
  typeof MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_FAILURE_CODES[number];

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveHoldoutGameIdentityBindingPrepared = Readonly<{
  contractVersion: typeof MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION;
  protocolId: typeof MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID;
  activationId: string;
  authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1';
  scheduleGame: unknown;
  evidence: MLBProspectivePregameEvidence;
  evidenceReceipt: MLBProspectivePregameEvidenceReceipt;
}>;

export type MLBProspectiveHoldoutGameIdentityBinding = Readonly<{
  contractVersion: typeof MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION;
  protocolId: typeof MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID;
  activationId: string;
  authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1';
  gamePk: number;
  gameId: string;
  evidenceArtifactId: string;
  evidenceSha256: string;
  evidenceArtifactContractVersion: typeof MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION;
  evidenceStoreVersion: typeof MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION;
  snapshotId: string;
  officialDate: string;
  scheduledStartAt: string;
  scientificCutoffAt: string;
  evidencePersistedAt: string;
  persistedAt: string;
}>;

export type MLBProspectiveHoldoutGameIdentityBindingPersistedValidationResult =
  | Readonly<{ ok: true; value: MLBProspectiveHoldoutGameIdentityBinding }>
  | Readonly<{ ok: false; issues: readonly MLBProspectiveHoldoutGameIdentityBindingIssue[] }>;

export type MLBProspectiveHoldoutGameIdentityBindingPersistenceResult =
  | Readonly<{ ok: true; receipt: MLBProspectiveHoldoutGameIdentityBindingReceipt }>
  | Readonly<{ ok: false; issues: readonly MLBProspectiveHoldoutGameIdentityBindingIssue[] }>;

export type MLBProspectiveHoldoutGameIdentityBindingReadResult =
  | Readonly<{ ok: true; value: MLBProspectiveHoldoutGameIdentityBinding; receipt: MLBProspectiveHoldoutGameIdentityBindingReceipt }>
  | Readonly<{ ok: false; issues: readonly MLBProspectiveHoldoutGameIdentityBindingIssue[] }>;

export type MLBProspectiveHoldoutGameIdentityBindingReceipt = Readonly<{
  storeVersion: typeof MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION;
  bindingContractVersion: typeof MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION;
  bindingId: string;
  protocolId: typeof MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID;
  activationId: string;
  gamePk: number;
  gameId: string;
  evidenceArtifactId: string;
  evidenceSha256: string;
  relativePath: string;
  sha256: string;
  byteLength: number;
  persistedAt: string;
}>;

export type MLBProspectiveHoldoutGameIdentityBindingIssue = Readonly<{
  code: MLBProspectiveHoldoutGameIdentityBindingFailureCode;
  path: string;
  message: string;
}>;

/* -------------------------------------------------------------------------- */
/*  Validation helpers                                                        */
/* -------------------------------------------------------------------------- */

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F]/;

function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { value: unknown } {
  return !!descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value');
}

function isStrictNonEmptyTrimmedString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    !CONTROL_CHARACTER_PATTERN.test(value)
  );
}

function ownDataProperty(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBProspectiveHoldoutGameIdentityBindingIssue[],
): { kind: 'data'; value: unknown } | { kind: 'missing' } | { kind: 'accessor' } {
  const descriptor = Object.getOwnPropertyDescriptor(root, key);
  if (!descriptor) {
    return { kind: 'missing' };
  }
  if (!isDataDescriptor(descriptor)) {
    pushBindingIssue(issues, 'INVALID_BINDING_INPUT', path, `${path} is an accessor property`);
    return { kind: 'accessor' };
  }
  return { kind: 'data', value: descriptor.value };
}

export function pushBindingIssue(
  issues: MLBProspectiveHoldoutGameIdentityBindingIssue[],
  code: MLBProspectiveHoldoutGameIdentityBindingIssue['code'],
  path: string,
  message: string,
): void {
  const exists = issues.some((item) => item.path === path && item.code === code);
  if (!exists) {
    issues.push({ code, path, message });
  }
}

export function sortBindingIssues(
  issues: MLBProspectiveHoldoutGameIdentityBindingIssue[],
): readonly MLBProspectiveHoldoutGameIdentityBindingIssue[] {
  return Object.freeze(
    issues
      .slice()
      .sort((a, b) => (a.path < b.path ? -1 : a.path === b.path ? 0 : 1)
        || (a.code < b.code ? -1 : a.code === b.code ? 0 : 1))
      .filter((item, index, array) =>
        index === 0 || item.path !== array[index - 1].path || item.code !== array[index - 1].code,
      ),
  );
}

/* -------------------------------------------------------------------------- */
/*  Known persisted fields                                                    */
/* -------------------------------------------------------------------------- */

const KNOWN_PREPARED_BINDING_FIELDS = new Set([
  'contractVersion',
  'protocolId',
  'activationId',
  'authoritativeSource',
  'scheduleGame',
  'evidence',
  'evidenceReceipt',
]);

const KNOWN_PERSISTED_BINDING_FIELDS = new Set([
  'contractVersion',
  'protocolId',
  'activationId',
  'authoritativeSource',
  'gamePk',
  'gameId',
  'evidenceArtifactId',
  'evidenceSha256',
  'evidenceArtifactContractVersion',
  'evidenceStoreVersion',
  'snapshotId',
  'officialDate',
  'scheduledStartAt',
  'scientificCutoffAt',
  'evidencePersistedAt',
  'persistedAt',
]);

const PROHIBITED_BINDING_FIELDS = new Set([
  'winner',
  'homeScore',
  'awayScore',
  'label',
  'result',
  'finalStatus',
  'prediction',
  'probability',
  'gateResult',
  'odds',
  'marketPrice',
  'impliedProbability',
  'edge',
  'staking',
  'bindingSha256',
  'bindingByteLength',
  'bindingRelativePath',
]);

/* -------------------------------------------------------------------------- */
/*  Schedule game validation (narrowest safe runtime check)                  */
/* -------------------------------------------------------------------------- */

function validateScheduleGameFields(
  scheduleGame: unknown,
  issues: MLBProspectiveHoldoutGameIdentityBindingIssue[],
): { ok: boolean; gamePk: number | null; officialDate: string | null; startTimeUtc: Date | null } {
  if (!isPlainObject(scheduleGame)) {
    pushBindingIssue(issues, 'SCHEDULE_GAME_VALIDATION_FAILED', '$.scheduleGame', 'Expected plain object');
    return { ok: false, gamePk: null, officialDate: null, startTimeUtc: null };
  }

  const root = scheduleGame as Record<string, unknown>;

  const gamePkResult = ownDataProperty(root, 'gamePk', '$.scheduleGame.gamePk', issues);
  if (gamePkResult.kind === 'missing') {
    pushBindingIssue(issues, 'SCHEDULE_GAME_VALIDATION_FAILED', '$.scheduleGame.gamePk', 'gamePk is required');
    return { ok: false, gamePk: null, officialDate: null, startTimeUtc: null };
  }
  if (gamePkResult.kind === 'accessor') {
    return { ok: false, gamePk: null, officialDate: null, startTimeUtc: null };
  }
  const gamePk = gamePkResult.value;
  if (typeof gamePk !== 'number' || !Number.isSafeInteger(gamePk) || gamePk <= 0) {
    pushBindingIssue(issues, 'SCHEDULE_GAME_VALIDATION_FAILED', '$.scheduleGame.gamePk', 'gamePk must be a positive safe integer');
    return { ok: false, gamePk: null, officialDate: null, startTimeUtc: null };
  }

  const officialDateResult = ownDataProperty(root, 'officialDate', '$.scheduleGame.officialDate', issues);
  if (officialDateResult.kind === 'missing') {
    pushBindingIssue(issues, 'SCHEDULE_GAME_VALIDATION_FAILED', '$.scheduleGame.officialDate', 'officialDate is required');
    return { ok: false, gamePk, officialDate: null, startTimeUtc: null };
  }
  if (officialDateResult.kind === 'accessor') {
    return { ok: false, gamePk, officialDate: null, startTimeUtc: null };
  }
  const officialDate = officialDateResult.value;
  if (typeof officialDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(officialDate)) {
    pushBindingIssue(issues, 'SCHEDULE_GAME_VALIDATION_FAILED', '$.scheduleGame.officialDate', 'officialDate must be YYYY-MM-DD');
    return { ok: false, gamePk, officialDate: null, startTimeUtc: null };
  }

  const startTimeUtcResult = ownDataProperty(root, 'startTimeUtc', '$.scheduleGame.startTimeUtc', issues);
  if (startTimeUtcResult.kind === 'missing') {
    pushBindingIssue(issues, 'SCHEDULE_GAME_VALIDATION_FAILED', '$.scheduleGame.startTimeUtc', 'startTimeUtc is required');
    return { ok: false, gamePk, officialDate, startTimeUtc: null };
  }
  if (startTimeUtcResult.kind === 'accessor') {
    return { ok: false, gamePk, officialDate, startTimeUtc: null };
  }
  const startTimeUtc = startTimeUtcResult.value;
  if (!(startTimeUtc instanceof Date) || Number.isNaN(startTimeUtc.getTime())) {
    pushBindingIssue(issues, 'SCHEDULE_GAME_VALIDATION_FAILED', '$.scheduleGame.startTimeUtc', 'startTimeUtc must be a valid Date');
    return { ok: false, gamePk, officialDate, startTimeUtc: null };
  }

  return { ok: issues.length === 0, gamePk, officialDate, startTimeUtc: startTimeUtc as Date };
}

/* -------------------------------------------------------------------------- */
/*  Identity / provenance helpers                                             */
/* -------------------------------------------------------------------------- */

function parseTimestampToMs(value: string): number {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : NaN;
}

export function computeBindingId(input: {
  protocolId: string;
  activationId: string;
  gamePk: number;
  evidenceArtifactId: string;
  evidenceSha256: string;
}): string {
  return [
    input.protocolId,
    input.activationId,
    String(input.gamePk),
    input.evidenceArtifactId,
    input.evidenceSha256,
  ].join('::');
}

/* -------------------------------------------------------------------------- */
/*  Canonical serialization                                                   */
/* -------------------------------------------------------------------------- */

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

export function canonicalSerializeGameIdentityBinding(
  binding: MLBProspectiveHoldoutGameIdentityBinding,
): string {
  return JSON.stringify(sortObjectKeys(binding as Record<string, unknown>));
}

/* -------------------------------------------------------------------------- */
/*  Prepared binding validation                                               */
/* -------------------------------------------------------------------------- */

export function validateMLBProspectiveHoldoutGameIdentityBindingPrepared(
  value: unknown,
): MLBProspectiveHoldoutGameIdentityBindingPersistedValidationResult {
  const issues: MLBProspectiveHoldoutGameIdentityBindingIssue[] = [];

  if (!isPlainObject(value)) {
    pushBindingIssue(issues, 'INVALID_BINDING_INPUT', '$', 'Expected plain object');
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  const root = value as Record<string, unknown>;

  // 1. Strict own-key check
  const rootOwnNames = Object.getOwnPropertyNames(root);
  for (const key of rootOwnNames) {
    if (!KNOWN_PREPARED_BINDING_FIELDS.has(key) && !PROHIBITED_BINDING_FIELDS.has(key)) {
      const descriptor = Object.getOwnPropertyDescriptor(root, key);
      if (descriptor && isDataDescriptor(descriptor)) {
        pushBindingIssue(issues, 'PROHIBITED_FIELD', `$.${key}`, `Unknown field: ${key}`);
      } else if (descriptor) {
        pushBindingIssue(issues, 'INVALID_BINDING_INPUT', `$.${key}`, 'Accessor property');
      }
    }
  }
  for (const symbol of Object.getOwnPropertySymbols(root)) {
    pushBindingIssue(issues, 'PROHIBITED_FIELD', `$[${String(symbol)}]`, `Symbol property: ${symbol.description ?? symbol.toString()}`);
  }

  // 2. Reject prohibited fields
  for (const key of rootOwnNames) {
    if (PROHIBITED_BINDING_FIELDS.has(key)) {
      pushBindingIssue(issues, 'PROHIBITED_FIELD', `$.${key}`, `Prohibited field: ${key}`);
    }
  }

  // 3. contractVersion
  const contractVersionResult = ownDataProperty(root, 'contractVersion', '$.contractVersion', issues);
  if (contractVersionResult.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.contractVersion', 'contractVersion is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (contractVersionResult.kind === 'accessor') {
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (contractVersionResult.value !== MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION) {
    pushBindingIssue(issues, 'IDENTITY_MISMATCH', '$.contractVersion', 'contractVersion does not match frozen binding');
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  // 4. protocolId
  const protocolIdResult = ownDataProperty(root, 'protocolId', '$.protocolId', issues);
  if (protocolIdResult.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.protocolId', 'protocolId is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (protocolIdResult.kind === 'accessor') {
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (!isStrictNonEmptyTrimmedString(protocolIdResult.value) || protocolIdResult.value !== MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID) {
    pushBindingIssue(issues, 'IDENTITY_MISMATCH', '$.protocolId', 'protocolId does not match frozen protocol');
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  // 5. activationId
  const activationIdResult = ownDataProperty(root, 'activationId', '$.activationId', issues);
  if (activationIdResult.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.activationId', 'activationId is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (activationIdResult.kind === 'accessor') {
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (!isStrictNonEmptyTrimmedString(activationIdResult.value)) {
    pushBindingIssue(issues, 'INVALID_STRING', '$.activationId', 'activationId must be a non-empty trimmed string');
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  // 6. authoritativeSource
  const authoritativeSourceResult = ownDataProperty(root, 'authoritativeSource', '$.authoritativeSource', issues);
  if (authoritativeSourceResult.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.authoritativeSource', 'authoritativeSource is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (authoritativeSourceResult.kind === 'accessor') {
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (authoritativeSourceResult.value !== 'MLB_STATS_API_SCHEDULE_GAMEPK_V1') {
    pushBindingIssue(issues, 'IDENTITY_MISMATCH', '$.authoritativeSource', 'authoritativeSource must be MLB_STATS_API_SCHEDULE_GAMEPK_V1');
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  // 7. scheduleGame
  const scheduleGameResult = ownDataProperty(root, 'scheduleGame', '$.scheduleGame', issues);
  if (scheduleGameResult.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.scheduleGame', 'scheduleGame is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (scheduleGameResult.kind === 'accessor') {
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  const scheduleGameValidation = validateScheduleGameFields(scheduleGameResult.value, issues);
  if (!scheduleGameValidation.ok) {
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  const gamePk = scheduleGameValidation.gamePk as number;
  const officialDate = scheduleGameValidation.officialDate as string;
  const startTimeUtc = scheduleGameValidation.startTimeUtc as Date;

  // 8. evidence
  const evidenceResult = ownDataProperty(root, 'evidence', '$.evidence', issues);
  if (evidenceResult.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.evidence', 'evidence is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (evidenceResult.kind === 'accessor') {
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  const evidenceValidation = validateMLBProspectivePregameEvidence(evidenceResult.value);
  if (!evidenceValidation.ok) {
    const mappedIssues: MLBProspectiveHoldoutGameIdentityBindingIssue[] = evidenceValidation.issues.map(
      (issue): MLBProspectiveHoldoutGameIdentityBindingIssue => ({
        ...issue,
        code: 'EVIDENCE_REVALIDATION_FAILED',
      }),
    );
    return { ok: false, issues: sortBindingIssues([...issues, ...mappedIssues]) };
  }

  // 9. evidenceReceipt
  const evidenceReceiptResult = ownDataProperty(root, 'evidenceReceipt', '$.evidenceReceipt', issues);
  if (evidenceReceiptResult.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.evidenceReceipt', 'evidenceReceipt is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (evidenceReceiptResult.kind === 'accessor') {
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (!isPlainObject(evidenceReceiptResult.value)) {
    pushBindingIssue(issues, 'INVALID_BINDING_INPUT', '$.evidenceReceipt', 'evidenceReceipt must be a plain object');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  const receipt = evidenceReceiptResult.value as Record<string, unknown>;

  // 10. Core identity: String(scheduleGame.gamePk) === evidence.gameId
  if (evidenceValidation.value.gameId !== String(gamePk)) {
    pushBindingIssue(
      issues,
      'GAME_PK_EVIDENCE_IDENTITY_MISMATCH',
      '$.evidence.gameId',
      `evidence.gameId must equal String(scheduleGame.gamePk) (${String(gamePk)})`,
    );
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  // 11. Additional source cross-checks
  if (evidenceValidation.value.officialDate !== officialDate) {
    pushBindingIssue(
      issues,
      'SOURCE_CROSSCHECK_MISMATCH',
      '$.evidence.officialDate',
      `evidence.officialDate must match scheduleGame.officialDate`,
    );
  }
  const evidenceStartMs = parseTimestampToMs(evidenceValidation.value.scheduledStartAt);
  const scheduleStartMs = startTimeUtc!.getTime();
  if (!Number.isFinite(evidenceStartMs) || evidenceStartMs !== scheduleStartMs) {
    pushBindingIssue(
      issues,
      'SOURCE_CROSSCHECK_MISMATCH',
      '$.evidence.scheduledStartAt',
      `evidence.scheduledStartAt must match scheduleGame.startTimeUtc`,
    );
  }

  // 12. ArtifactId recomputation
  const computedArtifactId = computeArtifactId(evidenceValidation.value);
  const receiptArtifactIdResult = ownDataProperty(receipt, 'artifactId', '$.evidenceReceipt.artifactId', issues);
  if (receiptArtifactIdResult.kind === 'missing') {
    pushBindingIssue(issues, 'ARTIFACT_ID_MISMATCH', '$.evidenceReceipt.artifactId', 'evidenceReceipt.artifactId is required');
  } else if (receiptArtifactIdResult.kind === 'data') {
    if (receiptArtifactIdResult.value !== computedArtifactId) {
      pushBindingIssue(issues, 'ARTIFACT_ID_MISMATCH', '$.evidenceReceipt.artifactId', 'evidenceReceipt.artifactId does not match recomputed artifact ID');
    }
  }

  // 13. Receipt identity cross-checks
  const receiptProtocolIdResult = ownDataProperty(receipt, 'protocolId', '$.evidenceReceipt.protocolId', issues);
  if (receiptProtocolIdResult.kind === 'data' && receiptProtocolIdResult.value !== evidenceValidation.value.protocolId) {
    pushBindingIssue(issues, 'ARTIFACT_ID_MISMATCH', '$.evidenceReceipt.protocolId', 'protocolId mismatch');
  }
  const receiptActivationIdResult = ownDataProperty(receipt, 'activationId', '$.evidenceReceipt.activationId', issues);
  if (receiptActivationIdResult.kind === 'data' && receiptActivationIdResult.value !== evidenceValidation.value.activationId) {
    pushBindingIssue(issues, 'ARTIFACT_ID_MISMATCH', '$.evidenceReceipt.activationId', 'activationId mismatch');
  }
  const receiptGameIdResult = ownDataProperty(receipt, 'gameId', '$.evidenceReceipt.gameId', issues);
  if (receiptGameIdResult.kind === 'data' && receiptGameIdResult.value !== evidenceValidation.value.gameId) {
    pushBindingIssue(issues, 'ARTIFACT_ID_MISMATCH', '$.evidenceReceipt.gameId', 'gameId mismatch');
  }
  const receiptSnapshotIdResult = ownDataProperty(receipt, 'snapshotId', '$.evidenceReceipt.snapshotId', issues);
  if (receiptSnapshotIdResult.kind === 'data' && receiptSnapshotIdResult.value !== evidenceValidation.value.snapshotId) {
    pushBindingIssue(issues, 'ARTIFACT_ID_MISMATCH', '$.evidenceReceipt.snapshotId', 'snapshotId mismatch');
  }
  const receiptPersistedAtResult = ownDataProperty(receipt, 'persistedAt', '$.evidenceReceipt.persistedAt', issues);
  if (receiptPersistedAtResult.kind === 'data' && receiptPersistedAtResult.value !== evidenceValidation.value.persistedAt) {
    pushBindingIssue(issues, 'ARTIFACT_ID_MISMATCH', '$.evidenceReceipt.persistedAt', 'persistedAt mismatch');
  }
  const receiptStoreVersionResult = ownDataProperty(receipt, 'storeVersion', '$.evidenceReceipt.storeVersion', issues);
  let receiptStoreVersionValue = MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION;
  if (receiptStoreVersionResult.kind === 'data') {
    receiptStoreVersionValue = receiptStoreVersionResult.value as typeof MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION;
    if (receiptStoreVersionValue !== MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION) {
      pushBindingIssue(issues, 'ARTIFACT_ID_MISMATCH', '$.evidenceReceipt.storeVersion', 'storeVersion mismatch');
    }
  } else if (receiptStoreVersionResult.kind === 'accessor') {
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  // 14. Receipt SHA format
  const receiptShaResult = ownDataProperty(receipt, 'sha256', '$.evidenceReceipt.sha256', issues);
  if (receiptShaResult.kind === 'missing') {
    pushBindingIssue(issues, 'RECEIPT_SHA_MISMATCH', '$.evidenceReceipt.sha256', 'evidenceReceipt.sha256 is required');
  } else if (receiptShaResult.kind === 'data') {
    if (typeof receiptShaResult.value !== 'string' || !/^[a-f0-9]{64}$/.test(receiptShaResult.value)) {
      pushBindingIssue(issues, 'RECEIPT_SHA_MISMATCH', '$.evidenceReceipt.sha256', 'evidenceReceipt.sha256 must be strict lowercase 64-hex SHA256');
    }
  } else if (receiptShaResult.kind === 'accessor') {
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  // 15. Receipt byteLength
  const receiptByteLengthResult = ownDataProperty(receipt, 'byteLength', '$.evidenceReceipt.byteLength', issues);
  if (receiptByteLengthResult.kind === 'missing') {
    pushBindingIssue(issues, 'RECEIPT_BYTE_LENGTH_MISMATCH', '$.evidenceReceipt.byteLength', 'evidenceReceipt.byteLength is required');
  } else if (receiptByteLengthResult.kind === 'data') {
    if (typeof receiptByteLengthResult.value !== 'number' || !Number.isFinite(receiptByteLengthResult.value) || receiptByteLengthResult.value <= 0) {
      pushBindingIssue(issues, 'RECEIPT_BYTE_LENGTH_MISMATCH', '$.evidenceReceipt.byteLength', 'evidenceReceipt.byteLength must be a positive integer');
    }
  } else if (receiptByteLengthResult.kind === 'accessor') {
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  // 16. Prove receipt SHA is for exact evidence bytes
  const expectedBytes = Buffer.from(canonicalSerializeEvidence(evidenceValidation.value), 'utf8');
  const expectedSha256 = crypto.createHash('sha256').update(expectedBytes).digest('hex');

  let evidenceSha256Value = '';
  if (receiptShaResult.kind === 'data') {
    evidenceSha256Value = receiptShaResult.value as string;
  }

  let evidenceByteLengthValue = 0;
  if (receiptByteLengthResult.kind === 'data') {
    evidenceByteLengthValue = receiptByteLengthResult.value as number;
  }

  if (expectedSha256 !== evidenceSha256Value) {
    pushBindingIssue(issues, 'RECEIPT_SHA_MISMATCH', '$.evidenceReceipt.sha256', 'Recomputed evidence SHA does not match receipt');
  }
  if (expectedBytes.byteLength !== evidenceByteLengthValue) {
    pushBindingIssue(issues, 'RECEIPT_BYTE_LENGTH_MISMATCH', '$.evidenceReceipt.byteLength', 'Recomputed evidence byteLength does not match receipt');
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  // 17. Build persisted binding (persistedAt filled by store)
  const persisted: MLBProspectiveHoldoutGameIdentityBinding = Object.freeze({
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: evidenceValidation.value.activationId,
    authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
    gamePk,
    gameId: evidenceValidation.value.gameId,
    evidenceArtifactId: computedArtifactId,
    evidenceSha256: evidenceSha256Value,
    evidenceArtifactContractVersion: evidenceValidation.value.contractVersion,
    evidenceStoreVersion: receiptStoreVersionValue,
    snapshotId: evidenceValidation.value.snapshotId,
    officialDate: evidenceValidation.value.officialDate,
    scheduledStartAt: evidenceValidation.value.scheduledStartAt,
    scientificCutoffAt: evidenceValidation.value.scientificCutoffAt,
    evidencePersistedAt: evidenceValidation.value.persistedAt,
    persistedAt: '', // filled by store
  });

  return { ok: true, value: persisted };
}

/* -------------------------------------------------------------------------- */
/*  Persisted binding validation                                              */
/* -------------------------------------------------------------------------- */

export function validateMLBProspectiveHoldoutGameIdentityBinding(
  value: unknown,
): MLBProspectiveHoldoutGameIdentityBindingPersistedValidationResult {
  const issues: MLBProspectiveHoldoutGameIdentityBindingIssue[] = [];

  // 1. Strict plain-object + own-key check
  if (!isPlainObject(value)) {
    pushBindingIssue(issues, 'INVALID_BINDING_INPUT', '$', 'Persisted binding must be a plain object');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  const root = value as Record<string, unknown>;

  const rootOwnNames = Object.getOwnPropertyNames(root);
  for (const key of rootOwnNames) {
    if (!KNOWN_PERSISTED_BINDING_FIELDS.has(key)) {
      const descriptor = Object.getOwnPropertyDescriptor(root, key);
      if (descriptor && isDataDescriptor(descriptor)) {
        pushBindingIssue(issues, 'PROHIBITED_FIELD', `$.${key}`, `Unknown field: ${key}`);
      } else if (descriptor) {
        pushBindingIssue(issues, 'INVALID_BINDING_INPUT', `$.${key}`, 'Accessor property');
      }
    }
  }
  for (const symbol of Object.getOwnPropertySymbols(root)) {
    pushBindingIssue(issues, 'PROHIBITED_FIELD', `$[${String(symbol)}]`, `Symbol property: ${symbol.description ?? symbol.toString()}`);
  }

  // 2. Reject prohibited fields
  for (const key of rootOwnNames) {
    if (PROHIBITED_BINDING_FIELDS.has(key)) {
      pushBindingIssue(issues, 'PROHIBITED_FIELD', `$.${key}`, `Prohibited field: ${key}`);
    }
  }

  // 3. contractVersion
  const contractVersionResult = ownDataProperty(root, 'contractVersion', '$.contractVersion', issues);
  if (contractVersionResult.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.contractVersion', 'contractVersion is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (contractVersionResult.kind === 'accessor') return { ok: false, issues: sortBindingIssues(issues) };
  if (contractVersionResult.value !== MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION) {
    pushBindingIssue(issues, 'IDENTITY_MISMATCH', '$.contractVersion', 'contractVersion does not match frozen binding');
  }

  // 4. protocolId
  const protocolIdResult = ownDataProperty(root, 'protocolId', '$.protocolId', issues);
  if (protocolIdResult.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.protocolId', 'protocolId is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (protocolIdResult.kind === 'accessor') return { ok: false, issues: sortBindingIssues(issues) };
  if (!isStrictNonEmptyTrimmedString(protocolIdResult.value) || protocolIdResult.value !== MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID) {
    pushBindingIssue(issues, 'IDENTITY_MISMATCH', '$.protocolId', 'protocolId does not match frozen protocol');
  }

  // 5. activationId
  const activationIdResult = ownDataProperty(root, 'activationId', '$.activationId', issues);
  if (activationIdResult.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.activationId', 'activationId is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (activationIdResult.kind === 'accessor') return { ok: false, issues: sortBindingIssues(issues) };
  if (!isStrictNonEmptyTrimmedString(activationIdResult.value)) {
    pushBindingIssue(issues, 'INVALID_STRING', '$.activationId', 'activationId must be a non-empty trimmed string');
  }

  // 6. authoritativeSource
  const authoritativeSourceResult = ownDataProperty(root, 'authoritativeSource', '$.authoritativeSource', issues);
  if (authoritativeSourceResult.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.authoritativeSource', 'authoritativeSource is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (authoritativeSourceResult.kind === 'accessor') return { ok: false, issues: sortBindingIssues(issues) };
  if (authoritativeSourceResult.value !== 'MLB_STATS_API_SCHEDULE_GAMEPK_V1') {
    pushBindingIssue(issues, 'IDENTITY_MISMATCH', '$.authoritativeSource', 'authoritativeSource must be MLB_STATS_API_SCHEDULE_GAMEPK_V1');
  }

  // 7. gamePk
  const gamePkResult = ownDataProperty(root, 'gamePk', '$.gamePk', issues);
  if (gamePkResult.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.gamePk', 'gamePk is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (gamePkResult.kind === 'accessor') return { ok: false, issues: sortBindingIssues(issues) };
  if (typeof gamePkResult.value !== 'number' || !Number.isSafeInteger(gamePkResult.value) || gamePkResult.value <= 0) {
    pushBindingIssue(issues, 'INVALID_JSON_VALUE', '$.gamePk', 'gamePk must be a positive safe integer');
  }

  // 8. gameId
  const gameIdResult = ownDataProperty(root, 'gameId', '$.gameId', issues);
  if (gameIdResult.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.gameId', 'gameId is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (gameIdResult.kind === 'accessor') return { ok: false, issues: sortBindingIssues(issues) };
  if (!isStrictNonEmptyTrimmedString(gameIdResult.value)) {
    pushBindingIssue(issues, 'INVALID_STRING', '$.gameId', 'gameId must be a non-empty trimmed string');
  }

  // 9. evidenceArtifactId
  const evidenceArtifactIdResult = ownDataProperty(root, 'evidenceArtifactId', '$.evidenceArtifactId', issues);
  if (evidenceArtifactIdResult.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.evidenceArtifactId', 'evidenceArtifactId is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (evidenceArtifactIdResult.kind === 'accessor') return { ok: false, issues: sortBindingIssues(issues) };
  if (!isStrictNonEmptyTrimmedString(evidenceArtifactIdResult.value)) {
    pushBindingIssue(issues, 'INVALID_STRING', '$.evidenceArtifactId', 'evidenceArtifactId must be a non-empty trimmed string');
  }

  // 10. evidenceSha256
  const evidenceSha256Result = ownDataProperty(root, 'evidenceSha256', '$.evidenceSha256', issues);
  if (evidenceSha256Result.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.evidenceSha256', 'evidenceSha256 is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (evidenceSha256Result.kind === 'accessor') return { ok: false, issues: sortBindingIssues(issues) };
  if (typeof evidenceSha256Result.value !== 'string' || !/^[a-f0-9]{64}$/.test(evidenceSha256Result.value)) {
    pushBindingIssue(issues, 'INVALID_JSON_VALUE', '$.evidenceSha256', 'evidenceSha256 must be strict lowercase 64-hex SHA256');
  }

  // 11. evidenceArtifactContractVersion
  const evidenceArtifactContractVersionResult = ownDataProperty(root, 'evidenceArtifactContractVersion', '$.evidenceArtifactContractVersion', issues);
  if (evidenceArtifactContractVersionResult.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.evidenceArtifactContractVersion', 'evidenceArtifactContractVersion is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (evidenceArtifactContractVersionResult.kind === 'accessor') return { ok: false, issues: sortBindingIssues(issues) };
  if (evidenceArtifactContractVersionResult.value !== MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION) {
    pushBindingIssue(issues, 'IDENTITY_MISMATCH', '$.evidenceArtifactContractVersion', 'evidenceArtifactContractVersion does not match frozen evidence contract');
  }

  // 12. evidenceStoreVersion
  const evidenceStoreVersionResult = ownDataProperty(root, 'evidenceStoreVersion', '$.evidenceStoreVersion', issues);
  if (evidenceStoreVersionResult.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.evidenceStoreVersion', 'evidenceStoreVersion is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (evidenceStoreVersionResult.kind === 'accessor') return { ok: false, issues: sortBindingIssues(issues) };
  if (evidenceStoreVersionResult.value !== MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION) {
    pushBindingIssue(issues, 'IDENTITY_MISMATCH', '$.evidenceStoreVersion', 'evidenceStoreVersion does not match frozen evidence store');
  }

  // 13. snapshotId
  const snapshotIdResult = ownDataProperty(root, 'snapshotId', '$.snapshotId', issues);
  if (snapshotIdResult.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.snapshotId', 'snapshotId is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (snapshotIdResult.kind === 'accessor') return { ok: false, issues: sortBindingIssues(issues) };
  if (!isStrictNonEmptyTrimmedString(snapshotIdResult.value)) {
    pushBindingIssue(issues, 'INVALID_STRING', '$.snapshotId', 'snapshotId must be a non-empty trimmed string');
  }

  // 14. officialDate
  const persistedOfficialDateResult = ownDataProperty(root, 'officialDate', '$.officialDate', issues);
  if (persistedOfficialDateResult.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.officialDate', 'officialDate is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (persistedOfficialDateResult.kind === 'accessor') return { ok: false, issues: sortBindingIssues(issues) };
  if (typeof persistedOfficialDateResult.value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(persistedOfficialDateResult.value as string)) {
    pushBindingIssue(issues, 'INVALID_DATE', '$.officialDate', 'officialDate must be YYYY-MM-DD');
  }

  // 15. scheduledStartAt
  const scheduledStartAtResult = ownDataProperty(root, 'scheduledStartAt', '$.scheduledStartAt', issues);
  if (scheduledStartAtResult.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.scheduledStartAt', 'scheduledStartAt is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (scheduledStartAtResult.kind === 'accessor') return { ok: false, issues: sortBindingIssues(issues) };
  if (typeof scheduledStartAtResult.value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(scheduledStartAtResult.value as string)) {
    pushBindingIssue(issues, 'INVALID_TIMESTAMP', '$.scheduledStartAt', 'scheduledStartAt is not a valid RFC3339 timestamp');
  }

  // 16. scientificCutoffAt
  const scientificCutoffAtResult = ownDataProperty(root, 'scientificCutoffAt', '$.scientificCutoffAt', issues);
  if (scientificCutoffAtResult.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.scientificCutoffAt', 'scientificCutoffAt is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (scientificCutoffAtResult.kind === 'accessor') return { ok: false, issues: sortBindingIssues(issues) };
  if (typeof scientificCutoffAtResult.value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(scientificCutoffAtResult.value as string)) {
    pushBindingIssue(issues, 'INVALID_TIMESTAMP', '$.scientificCutoffAt', 'scientificCutoffAt is not a valid RFC3339 timestamp');
  }

  // 17. evidencePersistedAt
  const evidencePersistedAtResult = ownDataProperty(root, 'evidencePersistedAt', '$.evidencePersistedAt', issues);
  if (evidencePersistedAtResult.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.evidencePersistedAt', 'evidencePersistedAt is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (evidencePersistedAtResult.kind === 'accessor') return { ok: false, issues: sortBindingIssues(issues) };
  if (typeof evidencePersistedAtResult.value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(evidencePersistedAtResult.value as string)) {
    pushBindingIssue(issues, 'INVALID_TIMESTAMP', '$.evidencePersistedAt', 'evidencePersistedAt is not a valid RFC3339 timestamp');
  }

  // 18. persistedAt
  const persistedAtResult = ownDataProperty(root, 'persistedAt', '$.persistedAt', issues);
  if (persistedAtResult.kind === 'missing') {
    pushBindingIssue(issues, 'MISSING_FIELD', '$.persistedAt', 'persistedAt is required');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (persistedAtResult.kind === 'accessor') return { ok: false, issues: sortBindingIssues(issues) };
  if (typeof persistedAtResult.value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(persistedAtResult.value as string)) {
    pushBindingIssue(issues, 'INVALID_PERSISTED_AT', '$.persistedAt', 'persistedAt is not a valid RFC3339 timestamp');
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  // 19. Timing checks: persistedAt >= evidencePersistedAt AND persistedAt < scheduledStartAt
  const persistedMs = parseTimestampToMs(persistedAtResult.value as string);
  const evidencePersistedMs = parseTimestampToMs(evidencePersistedAtResult.value as string);
  const scheduledMs = parseTimestampToMs(scheduledStartAtResult.value as string);

  if (Number.isFinite(persistedMs) && Number.isFinite(evidencePersistedMs) && persistedMs < evidencePersistedMs) {
    pushBindingIssue(issues, 'BINDING_TIMING_VIOLATION', '$.persistedAt', `persistedAt ${persistedAtResult.value} must be >= evidencePersistedAt ${evidencePersistedAtResult.value}`);
  }
  if (Number.isFinite(persistedMs) && Number.isFinite(scheduledMs) && persistedMs >= scheduledMs) {
    pushBindingIssue(issues, 'BINDING_TIMING_VIOLATION', '$.persistedAt', `persistedAt ${persistedAtResult.value} must be < scheduledStartAt ${scheduledStartAtResult.value}`);
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  // 20. Build frozen persisted binding
  const persisted: MLBProspectiveHoldoutGameIdentityBinding = Object.freeze({
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
    protocolId: protocolIdResult.value as typeof MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: activationIdResult.value as string,
    authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
    gamePk: gamePkResult.value as number,
    gameId: gameIdResult.value as string,
    evidenceArtifactId: evidenceArtifactIdResult.value as string,
    evidenceSha256: evidenceSha256Result.value as string,
    evidenceArtifactContractVersion: evidenceArtifactContractVersionResult.value as typeof MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
    evidenceStoreVersion: evidenceStoreVersionResult.value as typeof MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
    snapshotId: snapshotIdResult.value as string,
    officialDate: persistedOfficialDateResult.value as string,
    scheduledStartAt: scheduledStartAtResult.value as string,
    scientificCutoffAt: scientificCutoffAtResult.value as string,
    evidencePersistedAt: evidencePersistedAtResult.value as string,
    persistedAt: persistedAtResult.value as string,
  });

  return { ok: true, value: persisted };
}
