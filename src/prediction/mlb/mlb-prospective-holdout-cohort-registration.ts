import {
  validateMLBProspectiveHoldoutActivation,
  validateMLBProspectiveHoldoutActivationPersisted,
  type MLBProspectiveHoldoutActivation,
  type MLBProspectiveHoldoutActivationPersisted,
} from './mlb-prospective-holdout-activation-contract';
import {
  computeArtifactId,
  canonicalSerialize as canonicalSerializeEvidence,
  isPlainObject,
  validateMLBProspectivePregameEvidence,
  type MLBProspectivePregameEvidence,
} from './mlb-prospective-pregame-evidence-artifact-contract';
import {
  validateMLBProspectiveHoldoutGameIdentityBinding,
  computeBindingId,
  type MLBProspectiveHoldoutGameIdentityBinding,
} from './mlb-prospective-holdout-game-identity-binding-contract';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveHoldoutCohortSide = 'VALIDATION' | 'TEST';

export type MLBProspectiveHoldoutCohortRegistration = Readonly<{
  activationId: string;
  artifactId: string;
  gameId: string;
  gamePk: number;
  snapshotId: string;
  officialDate: string;
  scheduledStartAt: string;
  scientificCutoffAt: string;
  side: MLBProspectiveHoldoutCohortSide;
  stableOrderKey: readonly [string, number];
}>;

export type MLBProspectiveHoldoutCohortFinalizationResult =
  | Readonly<{
      ok: true;
      ready: boolean;
      validation: {
        selected: readonly MLBProspectiveHoldoutCohortRegistration[];
        reserve: readonly MLBProspectiveHoldoutCohortRegistration[];
        totalEligible: number;
      };
      test: {
        selected: readonly MLBProspectiveHoldoutCohortRegistration[];
        reserve: readonly MLBProspectiveHoldoutCohortRegistration[];
        totalEligible: number;
        ready: boolean;
      };
    }>
  | Readonly<{
      ok: false;
      code: 'INSUFFICIENT_VALIDATION_CAPTURES';
      validation: {
        selected: readonly MLBProspectiveHoldoutCohortRegistration[];
        reserve: readonly MLBProspectiveHoldoutCohortRegistration[];
        totalEligible: number;
      };
      test: {
        selected: readonly MLBProspectiveHoldoutCohortRegistration[];
        reserve: readonly MLBProspectiveHoldoutCohortRegistration[];
        totalEligible: number;
        ready: boolean;
      };
      message: string;
    }>;

export type MLBProspectiveHoldoutCohortRegistrationCandidate = Readonly<{
  evidence: MLBProspectivePregameEvidence;
  binding: MLBProspectiveHoldoutGameIdentityBinding;
}>;

export type MLBProspectiveHoldoutCohortRegistrationInput = Readonly<{
  activation: MLBProspectiveHoldoutActivationPersisted;
  registrations: readonly MLBProspectiveHoldoutCohortRegistrationCandidate[];
}>;

export type MLBProspectiveHoldoutCohortRegistrationIssue = Readonly<{
  code:
    | 'ACTIVATION_MISMATCH'
    | 'PROTOCOL_MISMATCH'
    | 'CAPTURE_CONTRACT_MISMATCH'
    | 'COMPATIBILITY_MISMATCH'
    | 'EVIDENCE_CONTRACT_MISMATCH'
    | 'EVIDENCE_STORE_MISMATCH'
    | 'BINDING_ACTIVATION_MISMATCH'
    | 'BINDING_PROTOCOL_MISMATCH'
    | 'BINDING_CONTRACT_VERSION_MISMATCH'
    | 'BINDING_AUTHORITATIVE_SOURCE_MISMATCH'
    | 'EVIDENCE_BINDING_IDENTITY_MISMATCH'
    | 'ACTIVATION_NOT_FROZEN_BEFORE_SCIENTIFIC_CUTOFF'
    | 'INVALID_DATE_SIDE'
    | 'DUPLICATE_REGISTRATIONS'
    | 'PROHIBITED_FIELD'
    | 'MISSING_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_INPUT';
  path: string;
  message: string;
}>;

/* -------------------------------------------------------------------------- */
/*  Stable order                                                              */
/* -------------------------------------------------------------------------- */

function toStableOrderKey(
  registration: MLBProspectiveHoldoutCohortRegistration,
): readonly [string, number] {
  return registration.stableOrderKey;
}

function sortRegistrations(
  registrations: MLBProspectiveHoldoutCohortRegistration[],
): MLBProspectiveHoldoutCohortRegistration[] {
  return registrations.slice().sort((a, b) => {
    const keyA = toStableOrderKey(a);
    const keyB = toStableOrderKey(b);
    const startDiff = keyA[0] < keyB[0] ? -1 : keyA[0] === keyB[0] ? 0 : 1;
    if (startDiff !== 0) return startDiff;
    return keyA[1] - keyB[1];
  });
}

/* -------------------------------------------------------------------------- */
/*  Candidate validation                                                     */
/* -------------------------------------------------------------------------- */

function validateInputRoot(
  input: unknown,
):
  | { ok: true; value: MLBProspectiveHoldoutCohortRegistrationInput }
  | { ok: false; message: string } {
  if (!isPlainObject(input)) {
    return { ok: false, message: 'Registration input must be a plain object' };
  }
  const root = input as Record<string, unknown>;

  const knownInputFields = new Set(['activation', 'registrations']);
  for (const key of Object.getOwnPropertyNames(root)) {
    if (!knownInputFields.has(key)) {
      return { ok: false, message: `Unknown input field: ${key}` };
    }
  }
  for (const symbol of Object.getOwnPropertySymbols(root)) {
    return { ok: false, message: `Unknown symbol input: ${String(symbol)}` };
  }

  if (!isPlainObject(root.activation)) {
    return { ok: false, message: 'activation must be a plain object' };
  }

  if (!Array.isArray(root.registrations)) {
    return { ok: false, message: 'registrations must be an array' };
  }

  for (let i = 0; i < root.registrations.length; i++) {
    const candidate = root.registrations[i];
    if (!isPlainObject(candidate)) {
      return { ok: false, message: `registration[${i}] must be a plain object` };
    }
    const candidateRoot = candidate as Record<string, unknown>;
    const knownCandidateFields = new Set(['evidence', 'binding']);
    for (const key of Object.getOwnPropertyNames(candidateRoot)) {
      if (!knownCandidateFields.has(key)) {
        return { ok: false, message: `Unknown field: registration[${i}].${key}` };
      }
    }
    for (const symbol of Object.getOwnPropertySymbols(candidateRoot)) {
      return { ok: false, message: `Unknown symbol in registration[${i}]` };
    }
  }

  return {
    ok: true,
    value: {
      activation: root.activation as MLBProspectiveHoldoutActivationPersisted,
      registrations: root.registrations as readonly MLBProspectiveHoldoutCohortRegistrationCandidate[],
    },
  };
}

function validateCandidate(
  activation: MLBProspectiveHoldoutActivationPersisted,
  candidate: MLBProspectiveHoldoutCohortRegistrationCandidate,
  seen: Set<string>,
):
  | { ok: true; registration: MLBProspectiveHoldoutCohortRegistration; side: MLBProspectiveHoldoutCohortSide }
  | { ok: false; code: string; message: string } {
  // 1. Validate persisted H evidence
  const evidenceValidation = validateMLBProspectivePregameEvidence(candidate.evidence);
  if (!evidenceValidation.ok) {
    return { ok: false, code: 'INVALID_EVIDENCE', message: 'Invalid persisted H evidence' };
  }
  const validEvidence = evidenceValidation.value;

  // 2. Validate persisted PRE2 binding
  const bindingValidation = validateMLBProspectiveHoldoutGameIdentityBinding(candidate.binding);
  if (!bindingValidation.ok) {
    return { ok: false, code: 'INVALID_BINDING', message: 'Invalid persisted PRE2 binding' };
  }
  const validBinding = bindingValidation.value;

  // 3. Activation ↔ evidence identity
  if (validEvidence.activationId !== activation.activationId) {
    return { ok: false, code: 'ACTIVATION_MISMATCH', message: 'evidence.activationId does not match activation' };
  }
  if (validEvidence.protocolId !== activation.protocolId) {
    return { ok: false, code: 'PROTOCOL_MISMATCH', message: 'evidence.protocolId does not match activation' };
  }
  if (validEvidence.captureContractVersion !== activation.captureContractVersion) {
    return { ok: false, code: 'CAPTURE_CONTRACT_MISMATCH', message: 'evidence.captureContractVersion does not match activation' };
  }
  if (validEvidence.compatibilityLayerId !== activation.compatibilityLayerId) {
    return { ok: false, code: 'COMPATIBILITY_MISMATCH', message: 'evidence.compatibilityLayerId does not match activation' };
  }
  if (validEvidence.contractVersion !== activation.evidenceArtifactContractVersion) {
    return { ok: false, code: 'EVIDENCE_CONTRACT_MISMATCH', message: 'evidence.contractVersion does not match activation' };
  }

  // 4. Activation ↔ binding identity
  if (validBinding.activationId !== activation.activationId) {
    return { ok: false, code: 'BINDING_ACTIVATION_MISMATCH', message: 'binding.activationId does not match activation' };
  }
  if (validBinding.protocolId !== activation.protocolId) {
    return { ok: false, code: 'BINDING_PROTOCOL_MISMATCH', message: 'binding.protocolId does not match activation' };
  }
  if (validBinding.contractVersion !== activation.gameIdentityBindingContractVersion) {
    return { ok: false, code: 'BINDING_CONTRACT_VERSION_MISMATCH', message: 'binding.contractVersion does not match activation' };
  }

  // 5. Binding ↔ evidence exact scientific link
  if (validBinding.gameId !== validEvidence.gameId) {
    return { ok: false, code: 'EVIDENCE_BINDING_IDENTITY_MISMATCH', message: 'binding.gameId does not match evidence.gameId' };
  }
  if (validBinding.snapshotId !== validEvidence.snapshotId) {
    return { ok: false, code: 'EVIDENCE_BINDING_IDENTITY_MISMATCH', message: 'binding.snapshotId does not match evidence.snapshotId' };
  }
  if (validBinding.officialDate !== validEvidence.officialDate) {
    return { ok: false, code: 'EVIDENCE_BINDING_IDENTITY_MISMATCH', message: 'binding.officialDate does not match evidence.officialDate' };
  }
  if (validBinding.scheduledStartAt !== validEvidence.scheduledStartAt) {
    return { ok: false, code: 'EVIDENCE_BINDING_IDENTITY_MISMATCH', message: 'binding.scheduledStartAt does not match evidence.scheduledStartAt' };
  }
  if (validBinding.scientificCutoffAt !== validEvidence.scientificCutoffAt) {
    return { ok: false, code: 'EVIDENCE_BINDING_IDENTITY_MISMATCH', message: 'binding.scientificCutoffAt does not match evidence.scientificCutoffAt' };
  }
  if (validBinding.evidencePersistedAt !== validEvidence.persistedAt) {
    return { ok: false, code: 'EVIDENCE_BINDING_IDENTITY_MISMATCH', message: 'binding.evidencePersistedAt does not match evidence.persistedAt' };
  }

  const computedArtifactId = computeArtifactId({
    contractVersion: validEvidence.contractVersion,
    protocolId: validEvidence.protocolId,
    activationId: validEvidence.activationId,
    captureContractVersion: validEvidence.captureContractVersion,
    compatibilityLayerId: validEvidence.compatibilityLayerId,
    gameId: validEvidence.gameId,
    snapshotId: validEvidence.snapshotId,
    officialDate: validEvidence.officialDate,
    scheduledStartAt: validEvidence.scheduledStartAt,
    scientificCutoffAt: validEvidence.scientificCutoffAt,
    actualDataCutoffAt: validEvidence.actualDataCutoffAt,
    rawSnapshot: validEvidence.rawSnapshot,
    rawFeatureVector: validEvidence.rawFeatureVector,
    candidate003CompatibleFeatureVector: validEvidence.candidate003CompatibleFeatureVector,
    t360Validation: validEvidence.t360Validation,
  });
  if (validBinding.evidenceArtifactId !== computedArtifactId) {
    return { ok: false, code: 'EVIDENCE_BINDING_IDENTITY_MISMATCH', message: 'binding.evidenceArtifactId does not match recomputed evidence artifactId' };
  }

  const expectedBytes = Buffer.from(canonicalSerializeEvidence(validEvidence), 'utf8');
  const expectedSha256 = require('crypto')
    .createHash('sha256')
    .update(expectedBytes)
    .digest('hex');
  if (validBinding.evidenceSha256 !== expectedSha256) {
    return { ok: false, code: 'EVIDENCE_BINDING_IDENTITY_MISMATCH', message: 'binding.evidenceSha256 does not match recomputed evidence SHA256' };
  }

  if (validBinding.evidenceArtifactContractVersion !== validEvidence.contractVersion) {
    return { ok: false, code: 'EVIDENCE_BINDING_IDENTITY_MISMATCH', message: 'binding.evidenceArtifactContractVersion does not match evidence.contractVersion' };
  }
  if (validBinding.evidenceStoreVersion !== activation.evidenceStoreVersion) {
    return { ok: false, code: 'EVIDENCE_BINDING_IDENTITY_MISMATCH', message: 'binding.evidenceStoreVersion does not match activation.evidenceStoreVersion' };
  }

  // 6. Defensive gameId / gamePk link
  if (validBinding.gameId !== String(validBinding.gamePk)) {
    return { ok: false, code: 'EVIDENCE_BINDING_IDENTITY_MISMATCH', message: 'binding.gameId does not round-trip binding.gamePk' };
  }

  // 7. Activation before T-360
  const activationPersistedMs = Date.parse(activation.persistedAt);
  const scientificCutoffMs = Date.parse(validEvidence.scientificCutoffAt);
  if (
    Number.isFinite(activationPersistedMs) &&
    Number.isFinite(scientificCutoffMs) &&
    activationPersistedMs >= scientificCutoffMs
  ) {
    return { ok: false, code: 'ACTIVATION_NOT_FROZEN_BEFORE_SCIENTIFIC_CUTOFF', message: 'activation.persistedAt must be strictly before evidence.scientificCutoffAt' };
  }

  // 8. Duplicate scientific identity
  const bindingId = computeBindingId({
    protocolId: validBinding.protocolId,
    activationId: validBinding.activationId,
    gamePk: validBinding.gamePk,
    evidenceArtifactId: validBinding.evidenceArtifactId,
    evidenceSha256: validBinding.evidenceSha256,
  });
  const duplicateKey = JSON.stringify({
    bindingId,
    evidenceArtifactId: validBinding.evidenceArtifactId,
    gamePk: validBinding.gamePk,
    gameId: validBinding.gameId,
    snapshotId: validBinding.snapshotId,
  });
  if (seen.has(duplicateKey)) {
    return { ok: false, code: 'DUPLICATE_REGISTRATIONS', message: 'Duplicate scientific identity detected' };
  }
  seen.add(duplicateKey);

  // 9. Date-side classification
  const officialDate = validEvidence.officialDate;
  const side: MLBProspectiveHoldoutCohortSide =
    officialDate <= activation.validationBoundaryOfficialDate ? 'VALIDATION' : 'TEST';

  // 10. Build registration
  const registration: MLBProspectiveHoldoutCohortRegistration = Object.freeze({
    activationId: activation.activationId,
    artifactId: validBinding.evidenceArtifactId,
    gameId: validBinding.gameId,
    gamePk: validBinding.gamePk,
    snapshotId: validBinding.snapshotId,
    officialDate,
    scheduledStartAt: validEvidence.scheduledStartAt,
    scientificCutoffAt: validEvidence.scientificCutoffAt,
    side,
    stableOrderKey: [validEvidence.scheduledStartAt, validBinding.gamePk] as const,
  });

  return { ok: true, registration, side };
}

/* -------------------------------------------------------------------------- */
/*  Public cohort registration                                               */
/* -------------------------------------------------------------------------- */

export function registerMLBProspectiveHoldoutCohorts(
  input: unknown,
): MLBProspectiveHoldoutCohortFinalizationResult {
  // 1. Validate input root strictly
  const rootValidation = validateInputRoot(input);
  if (!rootValidation.ok) {
    return failClosed(
      undefined,
      [],
      [],
      [],
      [],
      0,
      0,
      rootValidation.message,
    );
  }
  const { activation, registrations } = rootValidation.value;

  // 2. Validate persisted activation
  const activationValidation = validateMLBProspectiveHoldoutActivationPersisted(activation);
  if (!activationValidation.ok) {
    return failClosed(
      undefined,
      [],
      [],
      [],
      [],
      0,
      0,
      'Persisted activation validation failed',
    );
  }
  const validActivation = activationValidation.value;

  // 3. Process registrations
  const seen = new Set<string>();
  const validationRegistrations: MLBProspectiveHoldoutCohortRegistration[] = [];
  const testRegistrations: MLBProspectiveHoldoutCohortRegistration[] = [];

  for (const candidate of registrations) {
    const candidateResult = validateCandidate(validActivation, candidate, seen);
    if (!candidateResult.ok) {
      if (candidateResult.code === 'DUPLICATE_REGISTRATIONS') {
        return failClosed(
          validActivation,
          [],
          [],
          [],
          [],
          0,
          0,
          candidateResult.message,
        );
      }
      continue;
    }
    if (candidateResult.side === 'VALIDATION') {
      validationRegistrations.push(candidateResult.registration);
    } else {
      testRegistrations.push(candidateResult.registration);
    }
  }

  // 4. Deterministic stable ordering
  const sortedValidation = sortRegistrations(validationRegistrations);
  const sortedTest = sortRegistrations(testRegistrations);

  // 5. Finalize cohorts (fail-closed on insufficient N)
  const validationSelected = sortedValidation.slice(0, validActivation.validationTargetCount);
  const validationReserve = sortedValidation.slice(validActivation.validationTargetCount);

  if (validationSelected.length < validActivation.validationTargetCount) {
    return failClosed(
      validActivation,
      validationSelected,
      validationReserve,
      sortedTest.slice(0, Math.min(validActivation.testTargetCount, sortedTest.length)),
      sortedTest.slice(validActivation.testTargetCount),
      validationSelected.length,
      sortedTest.length,
      `Insufficient validation captures: ${validationSelected.length} < ${validActivation.validationTargetCount}`,
    );
  }

  const testSelected = sortedTest.slice(0, validActivation.testTargetCount);
  const testReserve = sortedTest.slice(validActivation.testTargetCount);

  return {
    ok: true,
    ready: testSelected.length >= validActivation.testTargetCount,
    validation: {
      selected: Object.freeze(validationSelected),
      reserve: Object.freeze(validationReserve),
      totalEligible: sortedValidation.length,
    },
    test: {
      selected: Object.freeze(testSelected),
      reserve: Object.freeze(testReserve),
      totalEligible: sortedTest.length,
      ready: testSelected.length >= validActivation.testTargetCount,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function failClosed(
  _activation: MLBProspectiveHoldoutActivation | undefined,
  validationSelected: MLBProspectiveHoldoutCohortRegistration[],
  validationReserve: MLBProspectiveHoldoutCohortRegistration[],
  testSelected: MLBProspectiveHoldoutCohortRegistration[],
  testReserve: MLBProspectiveHoldoutCohortRegistration[],
  validationTotal: number,
  testTotal: number,
  message: string,
): MLBProspectiveHoldoutCohortFinalizationResult {
  return {
    ok: false,
    code: 'INSUFFICIENT_VALIDATION_CAPTURES',
    validation: {
      selected: Object.freeze(validationSelected),
      reserve: Object.freeze(validationReserve),
      totalEligible: validationTotal,
    },
    test: {
      selected: Object.freeze(testSelected),
      reserve: Object.freeze(testReserve),
      totalEligible: testTotal,
      ready: false,
    },
    message,
  };
}

export { isPlainObject } from './mlb-prospective-pregame-evidence-artifact-contract';
