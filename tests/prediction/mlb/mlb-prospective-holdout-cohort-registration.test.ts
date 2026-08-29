import { promises as fs } from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_COHORT_REGISTRATION_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE,
  validateMLBProspectiveHoldoutActivation,
  validateMLBProspectiveHoldoutActivationPersisted,
  type MLBProspectiveHoldoutActivation,
  type MLBProspectiveHoldoutActivationPersisted,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-contract';
import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
} from '@/prediction/mlb/mlb-prospective-holdout-protocol-contract';
import {
  MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
  MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
  computeScientificCutoffAt,
} from '@/prediction/mlb/mlb-prospective-t360-capture-contract';
import {
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
  validateMLBProspectivePregameEvidencePrepared,
  validateMLBProspectivePregameEvidence,
  computeArtifactId,
  canonicalSerialize as canonicalSerializeEvidence,
  type MLBProspectivePregameEvidencePrepared,
  type MLBProspectivePregameEvidence,
  type MLBProspectivePregameEvidenceReceipt,
} from '@/prediction/mlb/mlb-prospective-pregame-evidence-artifact-contract';
import {
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
  validateMLBCanonicalPregameSnapshot,
  type MLBCanonicalPregameSnapshot,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';
import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';
import {
  validateMLBFeatureVector,
  extractMLBLeakageSafeFeatureVector,
  type MLBFeatureVector,
} from '@/prediction/mlb/mlb-feature-vector-contract';
import {
  applyCandidate003ProspectiveFeatureCompatibility,
} from '@/prediction/mlb/mlb-candidate-003-prospective-feature-compatibility';
import {
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION as BINDING_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION as BINDING_STORE_VERSION,
  validateMLBProspectiveHoldoutGameIdentityBinding,
  validateMLBProspectiveHoldoutGameIdentityBindingPrepared,
  type MLBProspectiveHoldoutGameIdentityBinding,
  type MLBProspectiveHoldoutGameIdentityBindingPrepared,
  type MLBProspectiveHoldoutGameIdentityBindingReceipt,
} from '@/prediction/mlb/mlb-prospective-holdout-game-identity-binding-contract';
import {
  writeMLBProspectiveHoldoutActivation,
  readMLBProspectiveHoldoutActivation,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-store';
import {
  persistProspectivePregameEvidence,
  readProspectivePregameEvidence,
} from '@/prediction/mlb/mlb-prospective-pregame-evidence-store';
import {
  persistProspectiveHoldoutGameIdentityBinding,
  readProspectiveHoldoutGameIdentityBinding,
} from '@/prediction/mlb/mlb-prospective-holdout-game-identity-binding-store';
import {
  registerMLBProspectiveHoldoutCohorts,
  type MLBProspectiveHoldoutCohortRegistrationCandidate,
} from '@/prediction/mlb/mlb-prospective-holdout-cohort-registration';
import {
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
} from '@/prediction/mlb/mlb-inner-development-third-real-candidate-recipe';

/* -------------------------------------------------------------------------- */
/*  Coherent September synthetic timeline                                       */
/* -------------------------------------------------------------------------- */

// Source/cutoff must be strictly before any game scheduledStartAt
const SEPT_SOURCE_TS = '2026-09-01T04:00:00Z';
const SEPT_DATA_CUTOFF = '2026-09-01T04:00:00Z';

function mustComputeScientificCutoffAt(scheduledStartAt: string): string {
  const result = computeScientificCutoffAt(scheduledStartAt);
  if (!result.ok) {
    throw new Error(`Failed to compute scientific cutoff: ${result.message}`);
  }
  return result.scientificCutoffAt;
}

/* -------------------------------------------------------------------------- */
/*  Snapshot / vector helpers (mirrors locked H tests)                         */
/* -------------------------------------------------------------------------- */

function buildSourceReference(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sourceRefId: 'src-official',
    sourceName: 'MLB Stats API',
    sourceCategory: 'OFFICIAL',
    roles: ['GAME_IDENTITY'],
    providerRecordId: null,
    fetchedAt: SEPT_SOURCE_TS,
    sourceUpdatedAt: SEPT_SOURCE_TS,
    ...overrides,
  };
}

function buildStartingPitcher(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    state: 'PROBABLE' as const,
    pitcherId: 'p-1',
    announcedAt: SEPT_SOURCE_TS,
    sourceRefIds: ['src-official'],
    ...overrides,
  };
}

function buildSection(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sectionId: 'sec-1',
    kind: 'GAME_CONTEXT' as const,
    entity: {
      scope: 'GAME' as const,
      entityId: null,
    },
    status: 'AVAILABLE' as const,
    asOfAt: SEPT_SOURCE_TS,
    sourceRefIds: ['src-official'],
    payload: {},
    ...overrides,
  };
}

function buildWarning(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code: 'PATCHY_WIND',
    path: '$.venue.wind',
    message: 'Wind speed varies across reported sources.',
    ...overrides,
  };
}

function buildValidSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const baseGame = {
    gameId: '1',
    scheduledStartAt: '2026-09-10T18:00:00Z',
    officialDate: '2026-09-10',
    season: 2026,
    gameType: 'REGULAR_SEASON' as const,
    status: 'SCHEDULED' as const,
    homeTeamId: 'home-1',
    awayTeamId: 'away-1',
    venueId: null,
    neutralSite: null,
    doubleheader: null,
  };
  const gameOverrides = overrides.game as Record<string, unknown> | undefined;
  const { game: _game, ...restOverrides } = overrides;
  const game = gameOverrides ? { ...baseGame, ...gameOverrides } : baseGame;

  const base = {
    contractVersion: MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
    sport: 'MLB' as const,
    target: 'OFFICIAL_FINAL_GAME_WINNER' as const,
    snapshotId: 'snapshot-1',
    capturedAt: SEPT_DATA_CUTOFF,
    dataCutoffAt: SEPT_DATA_CUTOFF,
    game,
    startingPitchers: {
      home: buildStartingPitcher(),
      away: buildStartingPitcher({ pitcherId: 'p-2', sourceRefIds: ['src-away'] }),
    },
    sourceReferences: [
      buildSourceReference({ sourceRefId: 'src-away', roles: ['STARTING_PITCHER'] }),
      buildSourceReference(),
    ],
    sections: [
      buildSection({
        sectionId: 'section-game-context',
        kind: 'GAME_CONTEXT' as const,
        entity: { scope: 'GAME' as const, entityId: null },
        payload: { doubleHeaderGameNumber: 1, scheduledInnings: 9 },
      }),
    ],
    dataCompleteness: 'COMPLETE' as const,
    warnings: [buildWarning()],
    ...restOverrides,
  };
  return base;
}

function buildValidSnapshotObject(overrides: Record<string, unknown> = {}): MLBCanonicalPregameSnapshot {
  const raw = buildValidSnapshot(overrides);
  const validation = validateMLBCanonicalPregameSnapshot(raw);
  expect(validation.ok).toBe(true);
  if (validation.ok) {
    return validation.value;
  }
  throw new Error('Failed to build valid snapshot');
}

function extractRawVector(snapshot: MLBCanonicalPregameSnapshot): MLBFeatureVector {
  const result = extractMLBLeakageSafeFeatureVector(
    MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    snapshot,
  );
  if (!result.ok) {
    throw new Error('Failed to extract raw feature vector: ' + JSON.stringify(result.issues));
  }
  return result.value;
}

/* -------------------------------------------------------------------------- */
/*  Evidence helpers                                                           */
/* -------------------------------------------------------------------------- */

function buildValidPreparedEvidence(
  snapshotOverrides: Record<string, unknown> = {},
  evidenceOverrides: Record<string, unknown> = {},
): MLBProspectivePregameEvidencePrepared {
  const snapshot = buildValidSnapshotObject(snapshotOverrides);
  const rawVector = extractRawVector(snapshot);
  const compatibleResult = applyCandidate003ProspectiveFeatureCompatibility(rawVector);
  expect(compatibleResult.ok).toBe(true);
  if (!compatibleResult.ok) {
    throw new Error('Failed to build compatible vector');
  }
  const compatibleVector = compatibleResult.value;

  const scheduledStartAt = snapshot.game.scheduledStartAt as string;
  const scientificCutoffAt = mustComputeScientificCutoffAt(scheduledStartAt);

  const t360Validation = {
    status: 'ACCEPTED' as const,
    actualDataCutoffAtLteScientificCutoff: true,
    sourceTimestampsProvenLteScientificCutoff: true,
  } as const;

  const base: MLBProspectivePregameEvidencePrepared = {
    contractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: 'activation-1',
    captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
    compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
    gameId: snapshot.game.gameId,
    snapshotId: snapshot.snapshotId,
    officialDate: snapshot.game.officialDate,
    scheduledStartAt,
    scientificCutoffAt,
    actualDataCutoffAt: snapshot.dataCutoffAt,
    rawSnapshot: snapshot,
    rawFeatureVector: rawVector,
    candidate003CompatibleFeatureVector: compatibleVector,
    t360Validation,
    ...evidenceOverrides,
  };

  return { ...base } as MLBProspectivePregameEvidencePrepared;
}

function withPersistedAt(
  prepared: MLBProspectivePregameEvidencePrepared,
  persistedAt: string,
): MLBProspectivePregameEvidence {
  return {
    ...prepared,
    persistedAt,
  };
}

function buildValidEvidence(
  options: { snapshotOverrides?: Record<string, unknown>; evidenceOverrides?: Record<string, unknown> } = {},
): MLBProspectivePregameEvidence {
  const prepared = buildValidPreparedEvidence(options.snapshotOverrides, options.evidenceOverrides);
  const persisted = withPersistedAt(prepared, prepared.scientificCutoffAt);
  const validation = validateMLBProspectivePregameEvidence(persisted);
  if (!validation.ok) {
    throw new Error('Failed to validate evidence: ' + JSON.stringify(validation.issues));
  }
  return validation.value;
}

/* -------------------------------------------------------------------------- */
/*  Activation helpers                                                        */
/* -------------------------------------------------------------------------- */

function buildValidActivation(overrides: Record<string, unknown> = {}): MLBProspectiveHoldoutActivation {
  const base = {
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: 'activation-1',
    candidateRecipeId: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
    candidateFingerprint: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
    featureManifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
    featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
    preprocessingPolicyId: 'raw-finite-feature-values-with-default-missing-v1',
    captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
    compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
    evidenceArtifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
    evidenceStoreVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
    validationBoundaryOfficialDate: '2026-09-10',
    validationTargetCount: 67,
    testTargetCount: 69,
    stableOrderPolicy: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY,
    validationSideDateRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE,
    testSideDateRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE,
    noSmallerN: true,
    resultIndependentSelection: true,
    testAuthorizationRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE,
    gameIdentityBindingContractVersion: BINDING_CONTRACT_VERSION,
    gameIdentityBindingStoreVersion: BINDING_STORE_VERSION,
  };
  return { ...base, ...overrides } as MLBProspectiveHoldoutActivation;
}

function buildValidPersistedActivation(
  overrides: Record<string, unknown> = {},
): MLBProspectiveHoldoutActivationPersisted {
  const base: MLBProspectiveHoldoutActivationPersisted = {
    ...buildValidActivation(),
    persistedAt: '2026-09-01T04:00:00Z',
    ...overrides,
  };
  const validation = validateMLBProspectiveHoldoutActivationPersisted(base);
  expect(validation.ok).toBe(true);
  if (!validation.ok) {
    throw new Error('Failed to validate persisted activation: ' + JSON.stringify(validation.issues));
  }
  return validation.value;
}

/* -------------------------------------------------------------------------- */
/*  Binding helpers                                                           */
/* -------------------------------------------------------------------------- */

function buildScheduleGame(gamePk: number, officialDate: string, scheduledStartAt: string): Record<string, unknown> {
  return {
    gamePk,
    officialDate,
    startTimeUtc: new Date(scheduledStartAt),
  };
}

function buildValidPreparedBinding(
  evidencePrepared: MLBProspectivePregameEvidencePrepared,
  evidenceReceipt: MLBProspectivePregameEvidenceReceipt,
  scheduleGame: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
): MLBProspectiveHoldoutGameIdentityBindingPrepared {
  const base: MLBProspectiveHoldoutGameIdentityBindingPrepared = {
    contractVersion: BINDING_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: evidencePrepared.activationId,
    authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
    scheduleGame,
    evidence: withPersistedAt(evidencePrepared, evidenceReceipt.persistedAt),
    evidenceReceipt,
    ...overrides,
  };
  return base;
}

function buildValidPersistedBinding(
  prepared: MLBProspectiveHoldoutGameIdentityBindingPrepared,
): MLBProspectiveHoldoutGameIdentityBinding {
  const validation = validateMLBProspectiveHoldoutGameIdentityBindingPrepared(prepared);
  expect(validation.ok).toBe(true);
  if (!validation.ok) {
    throw new Error('Failed to validate prepared binding: ' + JSON.stringify(validation.issues));
  }
  return validation.value;
}

function buildValidBinding(
  evidence: MLBProspectivePregameEvidence,
  overrides: Record<string, unknown> = {},
): MLBProspectiveHoldoutGameIdentityBinding {
  const scheduledStartAt = evidence.scheduledStartAt;
  const bindingPersistedAt = new Date(new Date(scheduledStartAt).getTime() - 30 * 60 * 1000).toISOString();
  const base: MLBProspectiveHoldoutGameIdentityBinding = {
    contractVersion: BINDING_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: evidence.activationId,
    authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
    gamePk: Number(evidence.gameId),
    gameId: evidence.gameId,
    evidenceArtifactId: computeArtifactId(evidence),
    evidenceSha256: (() => {
      const bytes = Buffer.from(canonicalSerializeEvidence(evidence), 'utf-8');
      return crypto.createHash('sha256').update(bytes).digest('hex');
    })(),
    evidenceArtifactContractVersion: evidence.contractVersion,
    evidenceStoreVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
    snapshotId: evidence.snapshotId,
    officialDate: evidence.officialDate,
    scheduledStartAt: evidence.scheduledStartAt,
    scientificCutoffAt: evidence.scientificCutoffAt,
    evidencePersistedAt: evidence.persistedAt,
    persistedAt: bindingPersistedAt,
  };
  return { ...base, ...overrides } as MLBProspectiveHoldoutGameIdentityBinding;
}

/* -------------------------------------------------------------------------- */
/*  Dummy helper for sufficient validation captures                           */
/* -------------------------------------------------------------------------- */

function buildDummyValidationCandidates(count: number): MLBProspectiveHoldoutCohortRegistrationCandidate[] {
  const candidates: MLBProspectiveHoldoutCohortRegistrationCandidate[] = [];
  for (let i = 0; i < count; i++) {
    const evidence = buildValidEvidence({
      snapshotOverrides: {
        snapshotId: `dummy-snapshot-${i}`,
        game: { gameId: String(1000 + i), officialDate: '2026-09-09', scheduledStartAt: '2026-09-09T18:00:00Z' },
      },
    });
    candidates.push({ evidence, binding: buildValidBinding(evidence) });
  }
  return candidates;
}

/* -------------------------------------------------------------------------- */
/*  Real-persistence helpers                                                  */
/* -------------------------------------------------------------------------- */

async function createTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'mlb-prospective-holdout-cohort-test-'));
}

async function persistSyntheticActivation(
  root: string,
  activation: MLBProspectiveHoldoutActivation,
  clock: () => string,
): Promise<MLBProspectiveHoldoutActivationPersisted> {
  const result = await writeMLBProspectiveHoldoutActivation(root, activation, clock);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Failed to persist synthetic activation');
  const readResult = await readMLBProspectiveHoldoutActivation(root);
  expect(readResult.ok).toBe(true);
  if (!readResult.ok) throw new Error('Failed to read synthetic activation');
  return readResult.value;
}

async function persistSyntheticEvidence(
  root: string,
  prepared: MLBProspectivePregameEvidencePrepared,
  clock: () => string,
): Promise<MLBProspectivePregameEvidenceReceipt> {
  const result = await persistProspectivePregameEvidence(root, prepared, clock);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Failed to persist synthetic evidence: ' + JSON.stringify(result.issues));
  return result.receipt;
}

async function persistSyntheticBinding(
  root: string,
  prepared: MLBProspectiveHoldoutGameIdentityBindingPrepared,
  clock: () => string,
): Promise<MLBProspectiveHoldoutGameIdentityBinding> {
  const result = await persistProspectiveHoldoutGameIdentityBinding(root, prepared, clock);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Failed to persist synthetic binding');
  const readResult = await readProspectiveHoldoutGameIdentityBinding(root, result.receipt.bindingId);
  expect(readResult.ok).toBe(true);
  if (!readResult.ok) throw new Error('Failed to read synthetic binding');
  return readResult.value;
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

function makeRegistrationInput(
  activation: MLBProspectiveHoldoutActivationPersisted,
  candidates: MLBProspectiveHoldoutCohortRegistrationCandidate[],
): unknown {
  return { activation, registrations: candidates };
}

describe('mlb-prospective-holdout-cohort-registration', () => {
  describe('date side classification', () => {
    it('classifies officialDate <= boundary as VALIDATION', () => {
      const activation = buildValidPersistedActivation();
      const evidence = buildValidEvidence({
        snapshotOverrides: {
          snapshotId: 'snapshot-1',
          game: { gameId: '1', officialDate: '2026-09-09', scheduledStartAt: '2026-09-09T18:00:00Z' },
        },
      });
      const binding = buildValidBinding(evidence);
      const dummy = buildDummyValidationCandidates(66);
      const result = registerMLBProspectiveHoldoutCohorts(
        makeRegistrationInput(activation, [...dummy, { evidence, binding }]),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.validation.selected.some((r) => r.gameId === '1')).toBe(true);
      }
    });

    it('classifies officialDate == boundary as VALIDATION', () => {
      const activation = buildValidPersistedActivation();
      const evidence = buildValidEvidence({
        snapshotOverrides: {
          snapshotId: 'snapshot-1',
          game: { gameId: '1', officialDate: '2026-09-10', scheduledStartAt: '2026-09-10T18:00:00Z' },
        },
      });
      const binding = buildValidBinding(evidence);
      const dummy = buildDummyValidationCandidates(66);
      const result = registerMLBProspectiveHoldoutCohorts(
        makeRegistrationInput(activation, [...dummy, { evidence, binding }]),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.validation.selected.some((r) => r.gameId === '1')).toBe(true);
      }
    });

    it('classifies officialDate > boundary as TEST', () => {
      const activation = buildValidPersistedActivation();
      const evidence = buildValidEvidence({
        snapshotOverrides: {
          snapshotId: 'snapshot-1',
          game: { gameId: '1', officialDate: '2026-09-11', scheduledStartAt: '2026-09-11T18:00:00Z' },
        },
      });
      const binding = buildValidBinding(evidence);
      const dummy = buildDummyValidationCandidates(67);
      const result = registerMLBProspectiveHoldoutCohorts(
        makeRegistrationInput(activation, [...dummy, { evidence, binding }]),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.test.selected.some((r) => r.gameId === '1')).toBe(true);
      }
    });
  });

  describe('stable ordering', () => {
    it('orders by scheduledStartAt ASC then numeric gamePk ASC', () => {
      const activation = buildValidPersistedActivation();
      const candidates = [
        (() => {
          const e = buildValidEvidence({
            snapshotOverrides: {
              snapshotId: 'snapshot-3',
              game: { gameId: '3', officialDate: '2026-09-10', scheduledStartAt: '2026-09-10T20:00:00Z' },
            },
          });
          return { evidence: e, binding: buildValidBinding(e) };
        })(),
        (() => {
          const e = buildValidEvidence({
            snapshotOverrides: {
              snapshotId: 'snapshot-1',
              game: { gameId: '1', officialDate: '2026-09-10', scheduledStartAt: '2026-09-10T18:00:00Z' },
            },
          });
          return { evidence: e, binding: buildValidBinding(e) };
        })(),
        (() => {
          const e = buildValidEvidence({
            snapshotOverrides: {
              snapshotId: 'snapshot-2',
              game: { gameId: '2', officialDate: '2026-09-10', scheduledStartAt: '2026-09-10T18:00:00Z' },
            },
          });
          return { evidence: e, binding: buildValidBinding(e) };
        })(),
      ];
      const dummy = buildDummyValidationCandidates(64);
      const result = registerMLBProspectiveHoldoutCohorts(makeRegistrationInput(activation, [...dummy, ...candidates]));
      expect(result.ok).toBe(true);
      if (result.ok) {
        const selected = result.validation.selected;
        const idx1 = selected.findIndex((r) => r.gameId === '1');
        const idx2 = selected.findIndex((r) => r.gameId === '2');
        const idx3 = selected.findIndex((r) => r.gameId === '3');
        expect(idx1).toBeLessThan(idx2);
        expect(idx2).toBeLessThan(idx3);
      }
    });

    it('is independent of input order', () => {
      const activation = buildValidPersistedActivation();
      const makeCandidates = () => [
        (() => {
          const e = buildValidEvidence({
            snapshotOverrides: {
              snapshotId: 'snapshot-3',
              game: { gameId: '3', officialDate: '2026-09-10', scheduledStartAt: '2026-09-10T20:00:00Z' },
            },
          });
          return { evidence: e, binding: buildValidBinding(e) };
        })(),
        (() => {
          const e = buildValidEvidence({
            snapshotOverrides: {
              snapshotId: 'snapshot-1',
              game: { gameId: '1', officialDate: '2026-09-10', scheduledStartAt: '2026-09-10T18:00:00Z' },
            },
          });
          return { evidence: e, binding: buildValidBinding(e) };
        })(),
        (() => {
          const e = buildValidEvidence({
            snapshotOverrides: {
              snapshotId: 'snapshot-2',
              game: { gameId: '2', officialDate: '2026-09-10', scheduledStartAt: '2026-09-10T18:00:00Z' },
            },
          });
          return { evidence: e, binding: buildValidBinding(e) };
        })(),
      ];
      const baseCandidates = makeCandidates();
      const dummy = buildDummyValidationCandidates(64);
      const ordered = registerMLBProspectiveHoldoutCohorts(makeRegistrationInput(activation, [...dummy, ...baseCandidates]));
      const reversed = registerMLBProspectiveHoldoutCohorts(
        makeRegistrationInput(activation, [...dummy, ...baseCandidates].reverse()),
      );
      const shuffled = registerMLBProspectiveHoldoutCohorts(
        makeRegistrationInput(activation, [...dummy, baseCandidates[1], baseCandidates[2], baseCandidates[0]]),
      );
      if (ordered.ok && reversed.ok && shuffled.ok) {
        expect(ordered.validation.selected.map((r) => r.gameId)).toEqual(reversed.validation.selected.map((r) => r.gameId));
        expect(ordered.validation.selected.map((r) => r.gameId)).toEqual(shuffled.validation.selected.map((r) => r.gameId));
      }
    });
  });

  describe('input permutation', () => {
    it('produces identical selected identities for permuted inputs', () => {
      const activation = buildValidPersistedActivation({ validationBoundaryOfficialDate: '2026-09-10' });
      const makeCandidates = () => [
        (() => {
          const e = buildValidEvidence({
            snapshotOverrides: {
              snapshotId: 'snapshot-a',
              game: { gameId: '1', officialDate: '2026-09-09', scheduledStartAt: '2026-09-09T18:00:00Z' },
            },
          });
          return { evidence: e, binding: buildValidBinding(e) };
        })(),
        (() => {
          const e = buildValidEvidence({
            snapshotOverrides: {
              snapshotId: 'snapshot-b',
              game: { gameId: '2', officialDate: '2026-09-09', scheduledStartAt: '2026-09-09T20:00:00Z' },
            },
          });
          return { evidence: e, binding: buildValidBinding(e) };
        })(),
      ];
      const dummy = buildDummyValidationCandidates(65);
      const ordered = registerMLBProspectiveHoldoutCohorts(makeRegistrationInput(activation, [...dummy, ...makeCandidates()]));
      const reversed = registerMLBProspectiveHoldoutCohorts(
        makeRegistrationInput(activation, [...dummy, ...makeCandidates()].reverse()),
      );
      if (ordered.ok && reversed.ok) {
        expect(ordered.validation.selected.map((r) => r.gameId)).toEqual(reversed.validation.selected.map((r) => r.gameId));
      }
    });
  });

  describe('exact three-way valid registration', () => {
    it('accepts persisted activation + persisted evidence + persisted binding', async () => {
      const root = await createTempRoot();
      try {
        const activation = buildValidActivation();
        const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-09-09T04:00:00Z');

        const evidencePrepared = buildValidPreparedEvidence({
          snapshotId: 'snapshot-1',
          game: { gameId: '1', officialDate: '2026-09-10', scheduledStartAt: '2026-09-10T18:00:00Z' },
        });
        const evidenceResult = await persistProspectivePregameEvidence(root, evidencePrepared, () => '2026-09-10T04:30:00Z');
        expect(evidenceResult.ok).toBe(true);
        if (!evidenceResult.ok) throw new Error('Failed to persist synthetic evidence');
        const evidenceReceipt = evidenceResult.receipt;
        const persistedEvidence = withPersistedAt(evidencePrepared, evidenceReceipt.persistedAt);

        const scheduleGame = buildScheduleGame(1, '2026-09-10', '2026-09-10T18:00:00Z');
        const bindingPrepared = buildValidPreparedBinding(evidencePrepared, evidenceReceipt, scheduleGame);
        const persistedBinding = await persistSyntheticBinding(root, bindingPrepared, () => '2026-09-10T11:00:00Z');

        const dummy = buildDummyValidationCandidates(66);
        const result = registerMLBProspectiveHoldoutCohorts(
          makeRegistrationInput(persistedActivation, [...dummy, { evidence: persistedEvidence, binding: persistedBinding }]),
        );
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.validation.selected.some((r) => r.gamePk === 1)).toBe(true);
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('binding-evidence mismatch', () => {
    it('rejects binding A + evidence B', () => {
      const activation = buildValidPersistedActivation();
      const evidenceA = buildValidEvidence({
        snapshotOverrides: {
          snapshotId: 'snapshot-a',
          game: { gameId: '1', officialDate: '2026-09-10', scheduledStartAt: '2026-09-10T18:00:00Z' },
        },
      });
      const bindingA = buildValidBinding(evidenceA);
      const evidenceB = buildValidEvidence({
        snapshotOverrides: {
          snapshotId: 'snapshot-b',
          game: { gameId: '2', officialDate: '2026-09-10', scheduledStartAt: '2026-09-10T18:00:00Z' },
        },
      });
      const result = registerMLBProspectiveHoldoutCohorts(makeRegistrationInput(activation, [{ evidence: evidenceB, binding: bindingA }]));
      expect(result.ok).toBe(false);
    });
  });

  describe('wrong activation', () => {
    it('rejects binding/evidence tied to activation A with activation B', () => {
      const activationA = buildValidPersistedActivation({ activationId: 'activation-a' });
      const activationB = buildValidPersistedActivation({ activationId: 'activation-b' });
      const evidence = buildValidEvidence({
        snapshotOverrides: {
          snapshotId: 'snapshot-1',
          game: { gameId: '1', officialDate: '2026-09-10', scheduledStartAt: '2026-09-10T18:00:00Z' },
        },
      });
      const binding = buildValidBinding(evidence, { activationId: 'activation-a' });
      const result = registerMLBProspectiveHoldoutCohorts(makeRegistrationInput(activationB, [{ evidence, binding }]));
      expect(result.ok).toBe(false);
    });
  });

  describe('activation before T360', () => {
    it('accepts activation strictly before evidence scientific cutoff', () => {
      const evidence = buildValidEvidence({
        snapshotOverrides: {
          snapshotId: 'snapshot-1',
          game: { gameId: '1', officialDate: '2026-09-10', scheduledStartAt: '2026-09-10T18:00:00Z' },
        },
      });
      const activation = buildValidPersistedActivation({ persistedAt: '2026-09-09T11:59:59Z' });
      const binding = buildValidBinding(evidence);
      const dummy = buildDummyValidationCandidates(67);
      const result = registerMLBProspectiveHoldoutCohorts(
        makeRegistrationInput(activation, [...dummy, { evidence, binding }]),
      );
      expect(result.ok).toBe(true);
    });

    it('rejects activation persisted at equal to scientific cutoff', () => {
      const evidence = buildValidEvidence({
        snapshotOverrides: {
          snapshotId: 'snapshot-1',
          game: { gameId: '1', officialDate: '2026-09-10', scheduledStartAt: '2026-09-10T18:00:00Z' },
        },
      });
      const activation = buildValidPersistedActivation({ persistedAt: evidence.scientificCutoffAt });
      const binding = buildValidBinding(evidence);
      const result = registerMLBProspectiveHoldoutCohorts(makeRegistrationInput(activation, [{ evidence, binding }]));
      expect(result.ok).toBe(false);
    });

    it('rejects activation persisted after scientific cutoff', () => {
      const evidence = buildValidEvidence({
        snapshotOverrides: {
          snapshotId: 'snapshot-1',
          game: { gameId: '1', officialDate: '2026-09-10', scheduledStartAt: '2026-09-10T18:00:00Z' },
        },
      });
      const activation = buildValidPersistedActivation({ persistedAt: '2026-09-10T12:00:01Z' });
      const binding = buildValidBinding(evidence);
      const result = registerMLBProspectiveHoldoutCohorts(makeRegistrationInput(activation, [{ evidence, binding }]));
      expect(result.ok).toBe(false);
    });
  });

  describe('boundary classification', () => {
    it('classifies VALIDATION and TEST by frozen official date boundary', () => {
      const activation = buildValidPersistedActivation({ validationBoundaryOfficialDate: '2026-09-10' });
      const candidates: MLBProspectiveHoldoutCohortRegistrationCandidate[] = [
        (() => {
          const e = buildValidEvidence({
            snapshotOverrides: {
              snapshotId: 'snapshot-v',
              game: { gameId: '1', officialDate: '2026-09-09', scheduledStartAt: '2026-09-09T18:00:00Z' },
            },
          });
          return { evidence: e, binding: buildValidBinding(e) };
        })(),
        (() => {
          const e = buildValidEvidence({
            snapshotOverrides: {
              snapshotId: 'snapshot-v2',
              game: { gameId: '2', officialDate: '2026-09-10', scheduledStartAt: '2026-09-10T18:00:00Z' },
            },
          });
          return { evidence: e, binding: buildValidBinding(e) };
        })(),
        (() => {
          const e = buildValidEvidence({
            snapshotOverrides: {
              snapshotId: 'snapshot-t',
              game: { gameId: '3', officialDate: '2026-09-11', scheduledStartAt: '2026-09-11T18:00:00Z' },
            },
          });
          return { evidence: e, binding: buildValidBinding(e) };
        })(),
      ];
      const dummy = buildDummyValidationCandidates(65);
      const result = registerMLBProspectiveHoldoutCohorts(makeRegistrationInput(activation, [...dummy, ...candidates]));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.validation.selected.some((r) => r.gameId === '1')).toBe(true);
        expect(result.validation.selected.some((r) => r.gameId === '2')).toBe(true);
        expect(result.test.selected.some((r) => r.gameId === '3')).toBe(true);
      }
    });
  });

  describe('numeric sort proof', () => {
    it('sorts by numeric gamePk, not lexicographic gameId', () => {
      const activation = buildValidPersistedActivation({ validationBoundaryOfficialDate: '2026-09-10' });
      const candidates = [
        (() => {
          const e = buildValidEvidence({
            snapshotOverrides: {
              snapshotId: 'snapshot-10',
              game: { gameId: '10', officialDate: '2026-09-10', scheduledStartAt: '2026-09-10T18:00:00Z' },
            },
          });
          return { evidence: e, binding: buildValidBinding(e) };
        })(),
        (() => {
          const e = buildValidEvidence({
            snapshotOverrides: {
              snapshotId: 'snapshot-9',
              game: { gameId: '9', officialDate: '2026-09-10', scheduledStartAt: '2026-09-10T18:00:00Z' },
            },
          });
          return { evidence: e, binding: buildValidBinding(e) };
        })(),
      ];
      const dummy = buildDummyValidationCandidates(65);
      const result = registerMLBProspectiveHoldoutCohorts(makeRegistrationInput(activation, [...dummy, ...candidates]));
      expect(result.ok).toBe(true);
      if (result.ok) {
        const selected = result.validation.selected;
        const idx9 = selected.findIndex((r) => r.gameId === '9');
        const idx10 = selected.findIndex((r) => r.gameId === '10');
        expect(idx9).toBeLessThan(idx10);
      }
    });
  });

  describe('input permutation', () => {
    it('produces identical selected identities for permuted inputs', () => {
      const activation = buildValidPersistedActivation({ validationBoundaryOfficialDate: '2026-09-10' });
      const makeCandidates = () => [
        (() => {
          const e = buildValidEvidence({
            snapshotOverrides: {
              snapshotId: 'snapshot-a',
              game: { gameId: '1', officialDate: '2026-09-09', scheduledStartAt: '2026-09-09T18:00:00Z' },
            },
          });
          return { evidence: e, binding: buildValidBinding(e) };
        })(),
        (() => {
          const e = buildValidEvidence({
            snapshotOverrides: {
              snapshotId: 'snapshot-b',
              game: { gameId: '2', officialDate: '2026-09-09', scheduledStartAt: '2026-09-09T20:00:00Z' },
            },
          });
          return { evidence: e, binding: buildValidBinding(e) };
        })(),
      ];
      const dummy = buildDummyValidationCandidates(65);
      const ordered = registerMLBProspectiveHoldoutCohorts(makeRegistrationInput(activation, [...dummy, ...makeCandidates()]));
      const reversed = registerMLBProspectiveHoldoutCohorts(
        makeRegistrationInput(activation, [...dummy, ...makeCandidates()].reverse()),
      );
      if (ordered.ok && reversed.ok) {
        expect(ordered.validation.selected.map((r) => r.gameId)).toEqual(reversed.validation.selected.map((r) => r.gameId));
      }
    });
  });

  describe('validation counts', () => {
    it('fails closed with 66', () => {
      const activation = buildValidPersistedActivation({ validationBoundaryOfficialDate: '2026-09-10' });
      const candidates: MLBProspectiveHoldoutCohortRegistrationCandidate[] = [];
      for (let i = 0; i < 66; i++) {
        const e = buildValidEvidence({
          snapshotOverrides: {
            snapshotId: `snapshot-${i}`,
            game: { gameId: String(i + 1), officialDate: '2026-09-09', scheduledStartAt: '2026-09-09T18:00:00Z' },
          },
        });
        candidates.push({ evidence: e, binding: buildValidBinding(e) });
      }
      const result = registerMLBProspectiveHoldoutCohorts(makeRegistrationInput(activation, candidates));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INSUFFICIENT_VALIDATION_CAPTURES');
      }
    });

    it('selects exactly 67 from 68', () => {
      const activation = buildValidPersistedActivation({ validationBoundaryOfficialDate: '2026-09-10' });
      const candidates: MLBProspectiveHoldoutCohortRegistrationCandidate[] = [];
      for (let i = 0; i < 68; i++) {
        const e = buildValidEvidence({
          snapshotOverrides: {
            snapshotId: `snapshot-${i}`,
            game: { gameId: String(i + 1), officialDate: '2026-09-09', scheduledStartAt: '2026-09-09T18:00:00Z' },
          },
        });
        candidates.push({ evidence: e, binding: buildValidBinding(e) });
      }
      const result = registerMLBProspectiveHoldoutCohorts(makeRegistrationInput(activation, candidates));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.validation.selected.length).toBe(67);
        expect(result.validation.reserve.length).toBe(1);
      }
    });
  });

  describe('test counts', () => {
    it('reports TEST pregame cohort not ready with 68', () => {
      const activation = buildValidPersistedActivation({ validationBoundaryOfficialDate: '2026-09-10' });
      const dummy = buildDummyValidationCandidates(67);
      const candidates: MLBProspectiveHoldoutCohortRegistrationCandidate[] = [];
      for (let i = 0; i < 68; i++) {
        const e = buildValidEvidence({
          snapshotOverrides: {
            snapshotId: `snapshot-${i}`,
            game: { gameId: String(i + 1), officialDate: '2026-09-11', scheduledStartAt: '2026-09-11T18:00:00Z' },
          },
        });
        candidates.push({ evidence: e, binding: buildValidBinding(e) });
      }
      const result = registerMLBProspectiveHoldoutCohorts(makeRegistrationInput(activation, [...dummy, ...candidates]));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.test.ready).toBe(false);
        expect(result.test.selected.length).toBe(68);
      }
    });

    it('selects exactly 69 from 70', () => {
      const activation = buildValidPersistedActivation({ validationBoundaryOfficialDate: '2026-09-10' });
      const dummy = buildDummyValidationCandidates(67);
      const candidates: MLBProspectiveHoldoutCohortRegistrationCandidate[] = [];
      for (let i = 0; i < 70; i++) {
        const e = buildValidEvidence({
          snapshotOverrides: {
            snapshotId: `snapshot-${i}`,
            game: { gameId: String(i + 1), officialDate: '2026-09-11', scheduledStartAt: '2026-09-11T18:00:00Z' },
          },
        });
        candidates.push({ evidence: e, binding: buildValidBinding(e) });
      }
      const result = registerMLBProspectiveHoldoutCohorts(makeRegistrationInput(activation, [...dummy, ...candidates]));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.test.selected.length).toBe(69);
        expect(result.test.reserve.length).toBe(1);
        expect(result.test.ready).toBe(true);
      }
    });
  });

  describe('duplicates', () => {
    it('rejects duplicate evidenceArtifactId', () => {
      const activation = buildValidPersistedActivation({ validationBoundaryOfficialDate: '2026-09-10' });
      const evidence = buildValidEvidence({
        snapshotOverrides: {
          snapshotId: 'snapshot-1',
          game: { gameId: '1', officialDate: '2026-09-09', scheduledStartAt: '2026-09-09T18:00:00Z' },
        },
      });
      const binding = buildValidBinding(evidence);
      const candidate = { evidence, binding };
      const result = registerMLBProspectiveHoldoutCohorts(makeRegistrationInput(activation, [candidate, candidate]));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INSUFFICIENT_VALIDATION_CAPTURES');
      }
    });
  });

  describe('hostile caller fields', () => {
    it('rejects top-level gamePk', () => {
      const activation = buildValidPersistedActivation({ validationBoundaryOfficialDate: '2026-09-10' });
      const evidence = buildValidEvidence({
        snapshotOverrides: {
          snapshotId: 'snapshot-1',
          game: { gameId: '1', officialDate: '2026-09-09', scheduledStartAt: '2026-09-09T18:00:00Z' },
        },
      });
      const binding = buildValidBinding(evidence);
      const result = registerMLBProspectiveHoldoutCohorts({
        ...{ activation, registrations: [{ evidence, binding }] },
        gamePk: 123,
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('no gameId parser', () => {
    it('has zero numeric gameId parse equivalents in production', async () => {
      const productionPath = path.resolve(process.cwd(), 'src/prediction/mlb/mlb-prospective-holdout-cohort-registration.ts');
      const production = await fs.readFile(productionPath, 'utf-8');
      expect(production.includes('Number(evidence.gameId)')).toBe(false);
      expect(production.includes('parseInt(evidence.gameId)')).toBe(false);
      expect(production.includes('parseFloat(evidence.gameId)')).toBe(false);
      expect(production.includes('evidence.gameId')).toBe(true);
    });
  });

  describe('no result input surface', () => {
    it('rejects activation with unknown result-like keys', () => {
      const tampered = buildValidActivation() as Record<string, unknown>;
      tampered.winner = 'home';
      const result = validateMLBProspectiveHoldoutActivation(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.code === 'PROHIBITED_FIELD')).toBe(true);
      }
    });
  });

  describe('input non-mutation', () => {
    it('does not mutate inputs', () => {
      const activation = buildValidPersistedActivation();
      const evidence = buildValidEvidence({
        snapshotOverrides: {
          snapshotId: 'snapshot-1',
          game: { gameId: '1', officialDate: '2026-09-10', scheduledStartAt: '2026-09-10T18:00:00Z' },
        },
      });
      const binding = buildValidBinding(evidence);
      const activationBefore = JSON.stringify(activation);
      const evidenceBefore = JSON.stringify(evidence);
      const bindingBefore = JSON.stringify(binding);
      registerMLBProspectiveHoldoutCohorts(makeRegistrationInput(activation, [{ evidence, binding }]));
      expect(JSON.stringify(activation)).toBe(activationBefore);
      expect(JSON.stringify(evidence)).toBe(evidenceBefore);
      expect(JSON.stringify(binding)).toBe(bindingBefore);
    });
  });
});
