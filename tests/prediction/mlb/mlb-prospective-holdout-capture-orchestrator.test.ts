import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  runProspectiveHoldoutCaptureOrchestrator,
  type MLBProspectiveHoldoutCaptureClock,
  type MLBProspectiveHoldoutCaptureSnapshotBuilder,
} from '@/prediction/mlb/mlb-prospective-holdout-capture-orchestrator';
import {
  buildMLBRealDataPregameSnapshot,
  type MLBRealDataPregameSnapshotBridgeInput,
} from '@/prediction/mlb/mlb-real-data-pregame-snapshot-bridge';

import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
  MLB_PROSPECTIVE_HOLDOUT_SCI_CUTOFF_MINUTES,
} from '@/prediction/mlb/mlb-prospective-holdout-protocol-contract';

import {
  MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
  MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
  computeScientificCutoffAt,
  type MLBProspectiveT360CaptureRequest,
  type MLBProspectiveT360T360Validation,
} from '@/prediction/mlb/mlb-prospective-t360-capture-contract';

import {
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
  validateMLBCanonicalPregameSnapshot,
  type MLBCanonicalPregameSnapshot,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';

import {
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
  type MLBProspectivePregameEvidence,
  type MLBProspectivePregameEvidencePrepared,
  type MLBProspectivePregameEvidenceReceipt,
  computeArtifactId,
  validateMLBProspectivePregameEvidencePrepared,
} from '@/prediction/mlb/mlb-prospective-pregame-evidence-artifact-contract';

import {
  persistProspectivePregameEvidence,
  readProspectivePregameEvidence,
  resolveMLBProspectivePregameEvidenceStorePaths,
  resolveMLBProspectivePregameEvidenceArtifactPaths,
} from '@/prediction/mlb/mlb-prospective-pregame-evidence-store';

import {
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
  type MLBProspectiveHoldoutGameIdentityBindingPrepared,
  type MLBProspectiveHoldoutGameIdentityBinding,
  type MLBProspectiveHoldoutGameIdentityBindingReceipt,
  computeBindingId,
  validateMLBProspectiveHoldoutGameIdentityBindingPrepared,
} from '@/prediction/mlb/mlb-prospective-holdout-game-identity-binding-contract';

import {
  persistProspectiveHoldoutGameIdentityBinding,
  readProspectiveHoldoutGameIdentityBinding,
  resolveMLBProspectiveHoldoutGameIdentityBindingStorePaths,
  resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths,
} from '@/prediction/mlb/mlb-prospective-holdout-game-identity-binding-store';

import {
  writeMLBProspectiveHoldoutActivation,
  readMLBProspectiveHoldoutActivation,
  resolveMLBProspectiveHoldoutActivationStorePaths,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-store';

import {
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
  validateMLBProspectiveHoldoutActivation,
  validateMLBProspectiveHoldoutActivationPersisted,
  type MLBProspectiveHoldoutActivationPersisted,
  type MLBProspectiveHoldoutActivation,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-contract';

import {
  discoverMLBProspectiveHoldoutArtifacts,
  type MLBProspectiveHoldoutArtifactDiscoveryResult,
} from '@/prediction/mlb/mlb-prospective-holdout-artifact-discovery';

import {
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
} from '@/prediction/mlb/mlb-inner-development-third-real-candidate-recipe';

import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';

import {
  extractMLBLeakageSafeFeatureVector,
  type MLBFeatureVector,
} from '@/prediction/mlb/mlb-feature-vector-contract';

import {
  applyCandidate003ProspectiveFeatureCompatibility,
} from '@/prediction/mlb/mlb-candidate-003-prospective-feature-compatibility';

import type { MLBScheduleGame } from '@/lib/research-data/types';

/* -------------------------------------------------------------------------- */
/*  Timeline                                                                  */
/* -------------------------------------------------------------------------- */

const FROZEN_SOURCE_TS = '2026-08-15T04:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-08-15T04:00:00Z';
const FROZEN_SCHEDULED_START = '2026-08-15T12:00:00Z';

const SCIENTIFIC_CUTOFF_RESULT = computeScientificCutoffAt(FROZEN_SCHEDULED_START);
if (!SCIENTIFIC_CUTOFF_RESULT.ok) {
  throw new Error('Failed to compute scientific cutoff: ' + SCIENTIFIC_CUTOFF_RESULT.message);
}
const SCIENTIFIC_CUTOFF = SCIENTIFIC_CUTOFF_RESULT.scientificCutoffAt;

/* -------------------------------------------------------------------------- */
/*  Schedule game helper                                                      */
/* -------------------------------------------------------------------------- */

function buildScheduleGame(overrides?: Partial<MLBScheduleGame>): MLBScheduleGame {
  const base: MLBScheduleGame = {
    gamePk: 900001,
    gameType: 'REGULAR_SEASON',
    gameNumber: 1,
    officialDate: '2026-08-15',
    gameDate: '2026-08-15',
    startTimeUtc: new Date(FROZEN_SCHEDULED_START),
    status: 'UPCOMING',
    homeTeamId: 1,
    homeTeamName: 'Home',
    awayTeamId: 2,
    awayTeamName: 'Away',
    venueId: 1,
    venueName: 'Venue',
    dayNight: 'night',
    scheduledInnings: 9,
    doubleHeader: 'N',
    seriesGameNumber: 1,
    gamesInSeries: 3,
    seriesDescription: 'Regular Season',
    leagueRecord: {
      home: { wins: 0, losses: 0, pct: '0' },
      away: { wins: 0, losses: 0, pct: '0' },
    },
    probablePitchers: {
      home: {
        availability: 'UNAVAILABLE',
        teamId: 1,
        status: 'UNAVAILABLE',
        fetchedAt: new Date(FROZEN_SOURCE_TS),
        warnings: [],
      },
      away: {
        availability: 'UNAVAILABLE',
        teamId: 2,
        status: 'UNAVAILABLE',
        fetchedAt: new Date(FROZEN_SOURCE_TS),
        warnings: [],
      },
    },
  };
  return { ...base, ...overrides };
}

/* -------------------------------------------------------------------------- */
/*  Clock helpers                                                             */
/* -------------------------------------------------------------------------- */

function createConstantClock(ts: string): MLBProspectiveHoldoutCaptureClock {
  return { now: () => new Date(ts) };
}

function createSequenceClock(startMs: number, stepMs = 1000): MLBProspectiveHoldoutCaptureClock {
  let counter = 0;
  return {
    now: () => {
      const ms = startMs + counter * stepMs;
      counter++;
      return new Date(ms);
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Snapshot helpers                                                          */
/* -------------------------------------------------------------------------- */

function buildSourceReference(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sourceRefId: 'src-official',
    sourceName: 'MLB Stats API',
    sourceCategory: 'OFFICIAL',
    roles: ['GAME_IDENTITY'],
    providerRecordId: null,
    fetchedAt: FROZEN_SOURCE_TS,
    sourceUpdatedAt: FROZEN_SOURCE_TS,
    ...overrides,
  };
}

function buildStartingPitcher(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    state: 'PROBABLE',
    pitcherId: 'p-1',
    announcedAt: FROZEN_SOURCE_TS,
    sourceRefIds: ['src-official'],
    ...overrides,
  };
}

function buildSection(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sectionId: 'sec-1',
    kind: 'GAME_CONTEXT',
    entity: { scope: 'GAME', entityId: null },
    status: 'AVAILABLE',
    asOfAt: FROZEN_SOURCE_TS,
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
    gameId: '900001',
    scheduledStartAt: FROZEN_SCHEDULED_START,
    officialDate: '2026-08-15',
    season: 2026,
    gameType: 'REGULAR_SEASON',
    status: 'SCHEDULED',
    homeTeamId: 'home-1',
    awayTeamId: 'away-1',
    venueId: 'venue-1',
    neutralSite: false,
    doubleheader: null,
  };
  const gameOverrides = overrides.game as Record<string, unknown> | undefined;
  const { game: _game, ...restOverrides } = overrides;
  const game = gameOverrides ? { ...baseGame, ...gameOverrides } : baseGame;

  const base = {
    contractVersion: MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    snapshotId: 'snapshot-1',
    capturedAt: FROZEN_DATA_CUTOFF,
    dataCutoffAt: FROZEN_DATA_CUTOFF,
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
        kind: 'GAME_CONTEXT',
        entity: { scope: 'GAME', entityId: null },
        payload: { doubleHeaderGameNumber: 1, scheduledInnings: 9 },
      }),
    ],
    dataCompleteness: 'COMPLETE',
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
  throw new Error('Failed to build valid snapshot: ' + JSON.stringify(validation.issues));
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
/*  Evidence helpers                                                          */
/* -------------------------------------------------------------------------- */

type EvidenceOverrides = Readonly<{
  game?: Readonly<{ gameId?: string; scheduledStartAt?: string; officialDate?: string }>;
  activationId?: string;
  snapshotId?: string;
  officialDate?: string;
  scheduledStartAt?: string;
  scientificCutoffAt?: string;
  actualDataCutoffAt?: string;
  t360Validation?: MLBProspectiveT360T360Validation;
}>;

function buildValidPreparedEvidence(
  snapshotOverrides: Record<string, unknown> = {},
  evidenceOverrides: EvidenceOverrides = {},
): MLBProspectivePregameEvidencePrepared {
  const snapshot = buildValidSnapshotObject(snapshotOverrides);
  const rawVector = extractRawVector(snapshot);
  const compatibleResult = applyCandidate003ProspectiveFeatureCompatibility(rawVector);
  if (!compatibleResult.ok) {
    throw new Error('Failed to build compatible vector: ' + JSON.stringify(compatibleResult.issues));
  }
  const compatibleVector = compatibleResult.value;

  const effectiveScheduledStartAt = snapshot.game.scheduledStartAt;
  const cutoffResult = computeScientificCutoffAt(effectiveScheduledStartAt);
  if (!cutoffResult.ok) {
    throw new Error('Failed to compute scientific cutoff: ' + cutoffResult.message);
  }
  const effectiveScientificCutoffAt = cutoffResult.scientificCutoffAt;

  const t360Validation = {
    status: 'ACCEPTED' as const,
    actualDataCutoffAtLteScientificCutoff: true,
    sourceTimestampsProvenLteScientificCutoff: true,
  } as const;

  const base: MLBProspectivePregameEvidencePrepared = {
    contractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: 'activation-900001',
    captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
    compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
    gameId: snapshot.game.gameId,
    snapshotId: snapshot.snapshotId,
    officialDate: snapshot.game.officialDate,
    scheduledStartAt: effectiveScheduledStartAt,
    scientificCutoffAt: effectiveScientificCutoffAt,
    actualDataCutoffAt: snapshot.dataCutoffAt,
    rawSnapshot: snapshot,
    rawFeatureVector: rawVector,
    candidate003CompatibleFeatureVector: compatibleVector,
    t360Validation,
  };

  return { ...base, ...evidenceOverrides };
}


function buildPreparedEvidenceForIdentity(
  gamePk: number,
  snapshotId: string,
  officialDate: string,
  scheduledStartAt: string,
  activationId: string,
): MLBProspectivePregameEvidencePrepared {
  const snapshot = buildValidSnapshotObject({
    game: {
      gameId: String(gamePk),
      scheduledStartAt,
      officialDate,
    },
  });
  const rawSnapshot = { ...snapshot, snapshotId };
  const rawVector = extractRawVector(rawSnapshot);
  const compatibleResult = applyCandidate003ProspectiveFeatureCompatibility(rawVector);
  if (!compatibleResult.ok) {
    throw new Error('Failed to build compatible vector: ' + JSON.stringify(compatibleResult.issues));
  }
  const cutoffResult = computeScientificCutoffAt(scheduledStartAt);
  if (!cutoffResult.ok) {
    throw new Error('Failed to compute scientific cutoff: ' + cutoffResult.message);
  }
  return {
    contractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId,
    captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
    compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
    gameId: String(gamePk),
    snapshotId,
    officialDate,
    scheduledStartAt,
    scientificCutoffAt: cutoffResult.scientificCutoffAt,
    actualDataCutoffAt: rawSnapshot.dataCutoffAt,
    rawSnapshot,
    rawFeatureVector: rawVector,
    candidate003CompatibleFeatureVector: compatibleResult.value,
    t360Validation: {
      status: 'ACCEPTED' as const,
      actualDataCutoffAtLteScientificCutoff: true,
      sourceTimestampsProvenLteScientificCutoff: true,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Activation helpers                                                        */
/* -------------------------------------------------------------------------- */

type ActivationOverrides = Readonly<{
  persistedAt?: string;
  activationId?: string;
  validationBoundaryOfficialDate?: string;
}>;

function buildValidActivation(overrides: ActivationOverrides = {}): MLBProspectiveHoldoutActivation {
  const base: MLBProspectiveHoldoutActivation = {
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: 'activation-900001',
    candidateRecipeId: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
    candidateFingerprint: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
    featureManifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
    featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
    preprocessingPolicyId: 'raw-finite-feature-values-with-default-missing-v1',
    captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
    compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
    evidenceArtifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
    evidenceStoreVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
    validationBoundaryOfficialDate: '2026-08-15',
    validationTargetCount: 67,
    testTargetCount: 69,
    stableOrderPolicy: 'scheduledStartAt_ASC_gamePk_ASC',
    validationSideDateRule: 'OFFICIAL_DATE_LTE_BOUNDARY',
    testSideDateRule: 'OFFICIAL_DATE_GT_BOUNDARY',
    noSmallerN: true,
    resultIndependentSelection: true,
    testAuthorizationRule: 'NO_TEST_AUTHORIZATION',
    gameIdentityBindingContractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
    gameIdentityBindingStoreVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
  };
  return { ...base, ...overrides };
}

function buildValidPersistedActivation(
  overrides: ActivationOverrides = {},
): MLBProspectiveHoldoutActivationPersisted {
  const base = buildValidActivation(overrides);
  const validation = validateMLBProspectiveHoldoutActivation(base);
  expect(validation.ok).toBe(true);
  if (!validation.ok) {
    throw new Error('Invalid activation: ' + JSON.stringify(validation.issues));
  }
  const persisted: MLBProspectiveHoldoutActivationPersisted = {
    ...validation.value,
    persistedAt: overrides.persistedAt ?? '2026-08-15T05:00:00Z',
  };
  const persistedValidation = validateMLBProspectiveHoldoutActivationPersisted(persisted);
  expect(persistedValidation.ok).toBe(true);
  if (!persistedValidation.ok) {
    throw new Error('Invalid persisted activation: ' + JSON.stringify(persistedValidation.issues));
  }
  return persistedValidation.value;
}

/* -------------------------------------------------------------------------- */
/*  Binding helpers                                                           */
/* -------------------------------------------------------------------------- */

type BindingOverrides = Readonly<{
  activationId?: string;
  evidence?: MLBProspectivePregameEvidence;
  evidenceReceipt?: MLBProspectivePregameEvidenceReceipt;
}>;

function buildValidPreparedBinding(
  evidence: MLBProspectivePregameEvidence,
  evidenceReceipt: MLBProspectivePregameEvidenceReceipt,
  scheduleGame: MLBScheduleGame,
  overrides: BindingOverrides = {},
): MLBProspectiveHoldoutGameIdentityBindingPrepared {
  const base: MLBProspectiveHoldoutGameIdentityBindingPrepared = {
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: evidence.activationId,
    authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
    scheduleGame: {
      gamePk: scheduleGame.gamePk,
      officialDate: scheduleGame.officialDate,
      startTimeUtc: scheduleGame.startTimeUtc,
    },
    evidence,
    evidenceReceipt,
  };

  const result = {
    ...base,
    ...(overrides.activationId !== undefined ? { activationId: overrides.activationId } : {}),
    ...(overrides.evidence !== undefined ? { evidence: overrides.evidence } : {}),
    ...(overrides.evidenceReceipt !== undefined ? { evidenceReceipt: overrides.evidenceReceipt } : {}),
  };

  const validation = validateMLBProspectiveHoldoutGameIdentityBindingPrepared(result);
  if (!validation.ok) {
    throw new Error('Invalid prepared binding: ' + JSON.stringify(validation.issues));
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/*  Persistence helpers                                                       */
/* -------------------------------------------------------------------------- */

async function createTempRoot(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function persistSyntheticActivation(
  root: string,
  activation: MLBProspectiveHoldoutActivation,
  clock: () => string,
): Promise<MLBProspectiveHoldoutActivationPersisted> {
  const result = await writeMLBProspectiveHoldoutActivation(root, activation, clock);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error('Failed to persist synthetic activation: ' + JSON.stringify(result.issues));
  }
  const readResult = await readMLBProspectiveHoldoutActivation(root);
  expect(readResult.ok).toBe(true);
  if (!readResult.ok) {
    throw new Error('Failed to read synthetic activation');
  }
  return readResult.value;
}

async function persistSyntheticEvidence(
  root: string,
  prepared: MLBProspectivePregameEvidencePrepared,
  clock: () => string,
): Promise<MLBProspectivePregameEvidenceReceipt> {
  const result = await persistProspectivePregameEvidence(root, prepared, clock);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error('Failed to persist synthetic evidence: ' + JSON.stringify(result.issues));
  }
  return result.receipt;
}

async function persistSyntheticBinding(
  root: string,
  prepared: MLBProspectiveHoldoutGameIdentityBindingPrepared,
  clock: () => string,
): Promise<MLBProspectiveHoldoutGameIdentityBindingReceipt> {
  const result = await persistProspectiveHoldoutGameIdentityBinding(root, prepared, clock);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error('Failed to persist synthetic binding: ' + JSON.stringify(result.issues));
  }
  return result.receipt;
}

/* -------------------------------------------------------------------------- */
/*  Snapshot builder tracker                                                  */
/* -------------------------------------------------------------------------- */

let builderCallCount = 0;

function createSnapshotBuilder(
  snapshotOverrides: Record<string, unknown> = {},
): MLBProspectiveHoldoutCaptureSnapshotBuilder {
  return (game) => {
    builderCallCount++;
    const gameOverrides = snapshotOverrides.game as Record<string, unknown> | undefined;
    const { game: _game, ...restOverrides } = snapshotOverrides;
    const snapshotGame = gameOverrides
      ? {
          gameId: String(game.gamePk),
          scheduledStartAt: game.startTimeUtc.toISOString(),
          officialDate: game.officialDate,
          ...gameOverrides,
        }
      : {
          gameId: String(game.gamePk),
          scheduledStartAt: game.startTimeUtc.toISOString(),
          officialDate: game.officialDate,
        };
    return buildValidSnapshotObject({
      game: snapshotGame,
      ...restOverrides,
    });
  };
}

function resetBuilderCount(): void {
  builderCallCount = 0;
}

/* -------------------------------------------------------------------------- */
/*  Stage B: activation / T360 worker tests                                   */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-capture-orchestrator: activation + T360', () => {
  it('1. activation absent → ACTIVATION_UNAVAILABLE → builder 0', async () => {
    const root = await createTempRoot('mlb-capture-activation-');
    try {
      const game = buildScheduleGame();
      const clock = createConstantClock('2026-08-15T05:59:59.999Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame: game,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('ACTIVATION_UNAVAILABLE');
      expect(builderCallCount).toBe(0);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('2. malformed activation durable bytes → fail closed → builder 0', async () => {
    const root = await createTempRoot('mlb-capture-activation-');
    try {
      const activationStorePaths = resolveMLBProspectiveHoldoutActivationStorePaths(root);
      await fs.mkdir(activationStorePaths.activationDirectory, { recursive: true });
      await fs.writeFile(activationStorePaths.activationPath, 'not-json', 'utf-8');

      const game = buildScheduleGame();
      const clock = createConstantClock('2026-08-15T05:59:59.999Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame: game,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('ACTIVATION_UNAVAILABLE');
      if (result.kind === 'ACTIVATION_UNAVAILABLE') {
        expect(result.issues.some((issue) => issue.includes('ACTIVATION_JSON_INVALID'))).toBe(true);
      }
      expect(builderCallCount).toBe(0);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('3. activation.persistedAt exactly scientific cutoff → ACTIVATION_NOT_FROZEN_BEFORE_CUTOFF → builder 0', async () => {
    const root = await createTempRoot('mlb-capture-activation-');
    try {
      const activation = buildValidActivation();
      await persistSyntheticActivation(root, activation, () => SCIENTIFIC_CUTOFF);

      const game = buildScheduleGame();
      const clock = createConstantClock('2026-08-15T05:59:59.999Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame: game,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('ACTIVATION_NOT_FROZEN_BEFORE_CUTOFF');
      expect(builderCallCount).toBe(0);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('4. activation.persistedAt after cutoff → same fail closed → builder 0', async () => {
    const root = await createTempRoot('mlb-capture-activation-');
    try {
      const activation = buildValidActivation();
      await persistSyntheticActivation(root, activation, () => '2026-08-15T06:00:00.001Z');

      const game = buildScheduleGame();
      const clock = createConstantClock('2026-08-15T05:59:59.999Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame: game,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('ACTIVATION_NOT_FROZEN_BEFORE_CUTOFF');
      expect(builderCallCount).toBe(0);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('5. worker before cutoff → fresh capture succeeds', async () => {
    const root = await createTempRoot('mlb-capture-worker-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const game = buildScheduleGame();
      const clock = createConstantClock('2026-08-15T05:59:59.999Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame: game,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('CAPTURED_AND_BOUND');
      expect(builderCallCount).toBe(1);
      if (result.kind !== 'CAPTURED_AND_BOUND') {
        throw new Error('Expected CAPTURED_AND_BOUND for gameId assertion');
      }
      expect(result.gameId).toBe(String(game.gamePk));
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('6. worker exactly cutoff → accepted → builder invoked', async () => {
    const root = await createTempRoot('mlb-capture-worker-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const game = buildScheduleGame();
      const clock = createConstantClock(SCIENTIFIC_CUTOFF);
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame: game,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('CAPTURED_AND_BOUND');
      expect(builderCallCount).toBe(1);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('7. worker 1ms after cutoff → CAPTURE_REJECTED → builder 0 → no H → no binding', async () => {
    const root = await createTempRoot('mlb-capture-worker-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const game = buildScheduleGame();
      const clock = createConstantClock('2026-08-15T06:00:00.001Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame: game,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('CAPTURE_REJECTED');
      expect(builderCallCount).toBe(0);

      const evidencePaths = resolveMLBProspectivePregameEvidenceStorePaths(root);
      const bindingPaths = resolveMLBProspectiveHoldoutGameIdentityBindingStorePaths(root);
      const evidenceCount = (await fs.readdir(evidencePaths.evidenceDirectory).catch(() => [])).filter(
        (entry) => entry.endsWith('.json'),
      ).length;
      const bindingCount = (await fs.readdir(bindingPaths.bindingDirectory).catch(() => [])).filter(
        (entry) => entry.endsWith('.json'),
      ).length;
      expect(evidenceCount).toBe(0);
      expect(bindingCount).toBe(0);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Stage C: fresh capture + orphan recovery tests                            */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-capture-orchestrator: fresh + orphan', () => {
  it('10. clean state happy path', async () => {
    const root = await createTempRoot('mlb-capture-fresh-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const game = buildScheduleGame();
      const clock = createConstantClock('2026-08-15T05:59:59.999Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame: game,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('CAPTURED_AND_BOUND');
      expect(builderCallCount).toBe(1);
      if (result.kind !== 'CAPTURED_AND_BOUND') {
        throw new Error('Expected CAPTURED_AND_BOUND for gameId assertion');
      }
      expect(result.gameId).toBe(String(game.gamePk));
      expect(result.evidenceArtifactId).toBeDefined();
      expect(result.bindingId).toBeDefined();

      const evidencePaths = resolveMLBProspectivePregameEvidenceStorePaths(root);
      const bindingPaths = resolveMLBProspectiveHoldoutGameIdentityBindingStorePaths(root);
      const evidenceCount = (await fs.readdir(evidencePaths.evidenceDirectory).catch(() => [])).filter(
        (entry) => entry.endsWith('.json'),
      ).length;
      const bindingCount = (await fs.readdir(bindingPaths.bindingDirectory).catch(() => [])).filter(
        (entry) => entry.endsWith('.json'),
      ).length;
      expect(evidenceCount).toBe(1);
      expect(bindingCount).toBe(1);

      const discovery = await discoverMLBProspectiveHoldoutArtifacts(root, persistedActivation);
      expect(discovery.ok).toBe(true);
      if (!discovery.ok) {
        throw new Error(
          `artifact discovery fixture failed: ${JSON.stringify(discovery.issues)}`,
        );
      }
      expect(discovery.orphanEvidence).toHaveLength(0);
      expect(discovery.candidates).toHaveLength(1);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('11. one schedule-matching orphan H before cutoff → RECOVERED_BINDING_FROM_ORPHAN_H → builder 0', async () => {
    const root = await createTempRoot('mlb-capture-orphan-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const game = buildScheduleGame();
      const snapshot = buildValidSnapshotObject({
        game: {
          gameId: String(game.gamePk),
          scheduledStartAt: game.startTimeUtc.toISOString(),
          officialDate: game.officialDate,
        },
      });
      const rawVector = extractRawVector(snapshot);
      const compatibleResult = applyCandidate003ProspectiveFeatureCompatibility(rawVector);
      if (!compatibleResult.ok) {
        throw new Error('Compatibility failed');
      }
      const cutoffResult = computeScientificCutoffAt(snapshot.game.scheduledStartAt);
      if (!cutoffResult.ok) {
        throw new Error('Cutoff failed');
      }
      const prepared: MLBProspectivePregameEvidencePrepared = {
        contractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: activation.activationId,
        captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
        compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
        gameId: snapshot.game.gameId,
        snapshotId: snapshot.snapshotId,
        officialDate: snapshot.game.officialDate,
        scheduledStartAt: snapshot.game.scheduledStartAt,
        scientificCutoffAt: cutoffResult.scientificCutoffAt,
        actualDataCutoffAt: snapshot.dataCutoffAt,
        rawSnapshot: snapshot,
        rawFeatureVector: rawVector,
        candidate003CompatibleFeatureVector: compatibleResult.value,
        t360Validation: {
          status: 'ACCEPTED',
          actualDataCutoffAtLteScientificCutoff: true,
          sourceTimestampsProvenLteScientificCutoff: true,
        },
      };
      const orphanPersistedAt = '2026-08-15T05:30:00.000Z';
      const evidenceReceipt = await persistSyntheticEvidence(root, prepared, () => orphanPersistedAt);
      const persistedEvidence = await readProspectivePregameEvidence(root, evidenceReceipt.artifactId);
      if (!persistedEvidence.ok) {
        throw new Error('Failed to read persisted evidence: ' + JSON.stringify(persistedEvidence.issues));
      }


      const scheduleGame = buildScheduleGame();
      const binding = buildValidPreparedBinding(persistedEvidence.value, evidenceReceipt, scheduleGame);
      const bindingReceipt = await persistSyntheticBinding(root, binding, () => orphanPersistedAt);

      const bindingArtifactPaths = resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths(
        root,
        bindingReceipt.bindingId,
      );
      await fs.unlink(bindingArtifactPaths.bindingPath);

      const clock = createConstantClock('2026-08-15T05:59:59.999Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('RECOVERED_BINDING_FROM_ORPHAN_H');
      expect(builderCallCount).toBe(0);
      if (result.kind !== 'RECOVERED_BINDING_FROM_ORPHAN_H') {
        throw new Error('Expected RECOVERED_BINDING_FROM_ORPHAN_H for binding assertion');
      }
      expect(result.evidenceArtifactId).toBe(evidenceReceipt.artifactId);
      expect(result.bindingId).toBe(bindingReceipt.bindingId);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('12. one schedule-matching orphan after T360 but before start → recovery succeeds → builder 0', async () => {
    const root = await createTempRoot('mlb-capture-orphan-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const game = buildScheduleGame();
      const snapshot = buildValidSnapshotObject({
        game: {
          gameId: String(game.gamePk),
          scheduledStartAt: game.startTimeUtc.toISOString(),
          officialDate: game.officialDate,
        },
      });
      const rawVector = extractRawVector(snapshot);
      const compatibleResult = applyCandidate003ProspectiveFeatureCompatibility(rawVector);
      if (!compatibleResult.ok) {
        throw new Error('Compatibility failed');
      }
      const cutoffResult = computeScientificCutoffAt(snapshot.game.scheduledStartAt);
      if (!cutoffResult.ok) {
        throw new Error('Cutoff failed');
      }
      const prepared: MLBProspectivePregameEvidencePrepared = {
        contractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: activation.activationId,
        captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
        compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
        gameId: snapshot.game.gameId,
        snapshotId: snapshot.snapshotId,
        officialDate: snapshot.game.officialDate,
        scheduledStartAt: snapshot.game.scheduledStartAt,
        scientificCutoffAt: cutoffResult.scientificCutoffAt,
        actualDataCutoffAt: snapshot.dataCutoffAt,
        rawSnapshot: snapshot,
        rawFeatureVector: rawVector,
        candidate003CompatibleFeatureVector: compatibleResult.value,
        t360Validation: {
          status: 'ACCEPTED',
          actualDataCutoffAtLteScientificCutoff: true,
          sourceTimestampsProvenLteScientificCutoff: true,
        },
      };
      const orphanPersistedAt = '2026-08-15T06:00:00.001Z';
      const evidenceReceipt = await persistSyntheticEvidence(root, prepared, () => orphanPersistedAt);
      const persistedEvidence = await readProspectivePregameEvidence(root, evidenceReceipt.artifactId);
      if (!persistedEvidence.ok) {
        throw new Error('Failed to read persisted evidence: ' + JSON.stringify(persistedEvidence.issues));
      }


      const scheduleGame = buildScheduleGame();
      const binding = buildValidPreparedBinding(persistedEvidence.value, evidenceReceipt, scheduleGame);
      const bindingReceipt = await persistSyntheticBinding(root, binding, () => orphanPersistedAt);

      const bindingArtifactPaths = resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths(
        root,
        bindingReceipt.bindingId,
      );
      await fs.unlink(bindingArtifactPaths.bindingPath);

      const clock = createConstantClock('2026-08-15T11:00:00.000Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('RECOVERED_BINDING_FROM_ORPHAN_H');
      expect(builderCallCount).toBe(0);
      if (result.kind !== 'RECOVERED_BINDING_FROM_ORPHAN_H') {
        throw new Error('Expected RECOVERED_BINDING_FROM_ORPHAN_H for binding assertion');
      }
      expect(result.evidenceArtifactId).toBe(evidenceReceipt.artifactId);
      expect(result.bindingId).toBe(bindingReceipt.bindingId);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('13. orphan recovery exactly at scheduled start → binding recovery rejected → builder 0', async () => {
    const root = await createTempRoot('mlb-capture-orphan-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const game = buildScheduleGame();
      const snapshot = buildValidSnapshotObject({
        game: {
          gameId: String(game.gamePk),
          scheduledStartAt: game.startTimeUtc.toISOString(),
          officialDate: game.officialDate,
        },
      });
      const rawVector = extractRawVector(snapshot);
      const compatibleResult = applyCandidate003ProspectiveFeatureCompatibility(rawVector);
      if (!compatibleResult.ok) {
        throw new Error('Compatibility failed');
      }
      const cutoffResult = computeScientificCutoffAt(snapshot.game.scheduledStartAt);
      if (!cutoffResult.ok) {
        throw new Error('Cutoff failed');
      }
      const prepared: MLBProspectivePregameEvidencePrepared = {
        contractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: activation.activationId,
        captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
        compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
        gameId: snapshot.game.gameId,
        snapshotId: snapshot.snapshotId,
        officialDate: snapshot.game.officialDate,
        scheduledStartAt: snapshot.game.scheduledStartAt,
        scientificCutoffAt: cutoffResult.scientificCutoffAt,
        actualDataCutoffAt: snapshot.dataCutoffAt,
        rawSnapshot: snapshot,
        rawFeatureVector: rawVector,
        candidate003CompatibleFeatureVector: compatibleResult.value,
        t360Validation: {
          status: 'ACCEPTED',
          actualDataCutoffAtLteScientificCutoff: true,
          sourceTimestampsProvenLteScientificCutoff: true,
        },
      };
      const orphanPersistedAt = '2026-08-15T10:00:00.001Z';
      const evidenceReceipt = await persistSyntheticEvidence(root, prepared, () => orphanPersistedAt);
      const persistedEvidence = await readProspectivePregameEvidence(root, evidenceReceipt.artifactId);
      if (!persistedEvidence.ok) {
        throw new Error('Failed to read persisted evidence: ' + JSON.stringify(persistedEvidence.issues));
      }


      const scheduleGame = buildScheduleGame();
      const binding = buildValidPreparedBinding(persistedEvidence.value, evidenceReceipt, scheduleGame);
      const bindingReceipt = await persistSyntheticBinding(root, binding, () => orphanPersistedAt);

      const bindingArtifactPaths = resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths(
        root,
        bindingReceipt.bindingId,
      );
      await fs.unlink(bindingArtifactPaths.bindingPath);

      const clock = createConstantClock('2026-08-15T12:00:00.000Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('BINDING_RECOVERY_REJECTED');
      if (result.kind !== 'BINDING_RECOVERY_REJECTED') {
        throw new Error(
          `expected BINDING_RECOVERY_REJECTED, received ${result.kind}`,
        );
      }
      expect(result.failureCode).toBe('PERSISTENCE_AFTER_SCHEDULED_START');
      expect(builderCallCount).toBe(0);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('14. orphan recovery after scheduled start → binding recovery rejected → builder 0', async () => {
    const root = await createTempRoot('mlb-capture-orphan-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const game = buildScheduleGame();
      const snapshot = buildValidSnapshotObject({
        game: {
          gameId: String(game.gamePk),
          scheduledStartAt: game.startTimeUtc.toISOString(),
          officialDate: game.officialDate,
        },
      });
      const rawVector = extractRawVector(snapshot);
      const compatibleResult = applyCandidate003ProspectiveFeatureCompatibility(rawVector);
      if (!compatibleResult.ok) {
        throw new Error('Compatibility failed');
      }
      const cutoffResult = computeScientificCutoffAt(snapshot.game.scheduledStartAt);
      if (!cutoffResult.ok) {
        throw new Error('Cutoff failed');
      }
      const prepared: MLBProspectivePregameEvidencePrepared = {
        contractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: activation.activationId,
        captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
        compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
        gameId: snapshot.game.gameId,
        snapshotId: snapshot.snapshotId,
        officialDate: snapshot.game.officialDate,
        scheduledStartAt: snapshot.game.scheduledStartAt,
        scientificCutoffAt: cutoffResult.scientificCutoffAt,
        actualDataCutoffAt: snapshot.dataCutoffAt,
        rawSnapshot: snapshot,
        rawFeatureVector: rawVector,
        candidate003CompatibleFeatureVector: compatibleResult.value,
        t360Validation: {
          status: 'ACCEPTED',
          actualDataCutoffAtLteScientificCutoff: true,
          sourceTimestampsProvenLteScientificCutoff: true,
        },
      };
      const orphanPersistedAt = '2026-08-15T06:00:00.001Z';
      const evidenceReceipt = await persistSyntheticEvidence(root, prepared, () => orphanPersistedAt);
      const persistedEvidence = await readProspectivePregameEvidence(root, evidenceReceipt.artifactId);
      if (!persistedEvidence.ok) {
        throw new Error('Failed to read persisted evidence: ' + JSON.stringify(persistedEvidence.issues));
      }


      const scheduleGame = buildScheduleGame();
      const binding = buildValidPreparedBinding(persistedEvidence.value, evidenceReceipt, scheduleGame);
      const bindingReceipt = await persistSyntheticBinding(root, binding, () => orphanPersistedAt);

      const bindingArtifactPaths = resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths(
        root,
        bindingReceipt.bindingId,
      );
      await fs.unlink(bindingArtifactPaths.bindingPath);

      const driftedGame = buildScheduleGame({
        startTimeUtc: new Date('2026-08-15T12:30:00Z'),
      });
      const clock = createConstantClock('2026-08-15T11:00:00.000Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame: driftedGame,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('SCHEDULE_DRIFT_INELIGIBLE');
      expect(builderCallCount).toBe(0);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('14a. orphan schedule drift → SCHEDULE_DRIFT_INELIGIBLE → builder 0', async () => {
    const root = await createTempRoot('mlb-capture-drift-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const orphanPrepared = buildPreparedEvidenceForIdentity(
        900001,
        'snapshot-drift',
        '2026-08-16',
        '2026-08-16T12:00:00Z',
        activation.activationId,
      );
      const orphanPersistedAt = '2026-08-16T05:30:00.000Z';
      const evidenceReceipt = await persistSyntheticEvidence(root, orphanPrepared, () => orphanPersistedAt);
      const persistedEvidence = await readProspectivePregameEvidence(root, evidenceReceipt.artifactId);
      if (!persistedEvidence.ok) {
        throw new Error('Failed to read persisted orphan evidence: ' + JSON.stringify(persistedEvidence.issues));
      }

      const driftedScheduleGame = buildScheduleGame({
        officialDate: '2026-08-16',
        startTimeUtc: new Date('2026-08-16T12:00:00Z'),
      });
      const binding = buildValidPreparedBinding(persistedEvidence.value, evidenceReceipt, driftedScheduleGame);
      const bindingReceipt = await persistSyntheticBinding(root, binding, () => orphanPersistedAt);

      const bindingArtifactPaths = resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths(
        root,
        bindingReceipt.bindingId,
      );
      await fs.unlink(bindingArtifactPaths.bindingPath);

      const currentScheduleGame = buildScheduleGame();
      const clock = createConstantClock('2026-08-15T05:59:59.999Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame: currentScheduleGame,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('SCHEDULE_DRIFT_INELIGIBLE');
      expect(builderCallCount).toBe(0);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Stage D: complete-pair / conflict / integrity tests                        */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-capture-orchestrator: complete-pair + integrity', () => {
  it('15. >1 active orphan for current String(gamePk) → ORPHAN_MULTIPLICITY_INELIGIBLE → builder 0', async () => {
    const root = await createTempRoot('mlb-capture-multi-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const game = buildScheduleGame();
      const snapshot = buildValidSnapshotObject({
        game: {
          gameId: String(game.gamePk),
          scheduledStartAt: game.startTimeUtc.toISOString(),
          officialDate: game.officialDate,
        },
      });
      const rawVector = extractRawVector(snapshot);
      const compatibleResult = applyCandidate003ProspectiveFeatureCompatibility(rawVector);
      if (!compatibleResult.ok) {
        throw new Error('Compatibility failed');
      }
      const cutoffResult = computeScientificCutoffAt(snapshot.game.scheduledStartAt);
      if (!cutoffResult.ok) {
        throw new Error('Cutoff failed');
      }
      const prepared: MLBProspectivePregameEvidencePrepared = {
        contractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: activation.activationId,
        captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
        compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
        gameId: snapshot.game.gameId,
        snapshotId: snapshot.snapshotId,
        officialDate: snapshot.game.officialDate,
        scheduledStartAt: snapshot.game.scheduledStartAt,
        scientificCutoffAt: cutoffResult.scientificCutoffAt,
        actualDataCutoffAt: snapshot.dataCutoffAt,
        rawSnapshot: snapshot,
        rawFeatureVector: rawVector,
        candidate003CompatibleFeatureVector: compatibleResult.value,
        t360Validation: {
          status: 'ACCEPTED',
          actualDataCutoffAtLteScientificCutoff: true,
          sourceTimestampsProvenLteScientificCutoff: true,
        },
      };
      const orphanPersistedAt = '2026-08-15T06:00:00.001Z';
      const evidenceReceiptA = await persistSyntheticEvidence(root, prepared, () => orphanPersistedAt);
      const evidenceReceiptB = await persistSyntheticEvidence(
        root,
        buildPreparedEvidenceForIdentity(game.gamePk, 'snapshot-2', game.officialDate, game.startTimeUtc.toISOString(), activation.activationId),
        () => orphanPersistedAt,
      );

      const scheduleGame = buildScheduleGame();
      const persistedEvidenceA = await readProspectivePregameEvidence(root, evidenceReceiptA.artifactId);
      if (!persistedEvidenceA.ok) {
        throw new Error('Failed to read persisted evidence A: ' + JSON.stringify(persistedEvidenceA.issues));
      }
      const bindingA = buildValidPreparedBinding(persistedEvidenceA.value, evidenceReceiptA, scheduleGame);
      const bindingReceiptA = await persistSyntheticBinding(root, bindingA, () => orphanPersistedAt);

      const persistedEvidenceB = await readProspectivePregameEvidence(root, evidenceReceiptB.artifactId);
      if (!persistedEvidenceB.ok) {
        throw new Error('Failed to read persisted evidence B: ' + JSON.stringify(persistedEvidenceB.issues));
      }
      const bindingB = buildValidPreparedBinding(persistedEvidenceB.value, evidenceReceiptB, scheduleGame);
      const bindingReceiptB = await persistSyntheticBinding(root, bindingB, () => orphanPersistedAt);

      const bindingPaths = resolveMLBProspectiveHoldoutGameIdentityBindingStorePaths(root);
      await fs.unlink(resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths(root, bindingReceiptA.bindingId).bindingPath);
      await fs.unlink(resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths(root, bindingReceiptB.bindingId).bindingPath);

      const clock = createConstantClock('2026-08-15T11:00:00.000Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('ORPHAN_MULTIPLICITY_INELIGIBLE');
      expect(builderCallCount).toBe(0);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('16. one complete pair + one additional current orphan → CAPTURE_LINEAGE_MULTIPLICITY_INELIGIBLE → builder 0', async () => {
    const root = await createTempRoot('mlb-capture-multi-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const game = buildScheduleGame();
      const snapshot = buildValidSnapshotObject({
        game: {
          gameId: String(game.gamePk),
          scheduledStartAt: game.startTimeUtc.toISOString(),
          officialDate: game.officialDate,
        },
      });
      const rawVector = extractRawVector(snapshot);
      const compatibleResult = applyCandidate003ProspectiveFeatureCompatibility(rawVector);
      if (!compatibleResult.ok) {
        throw new Error('Compatibility failed');
      }
      const cutoffResult = computeScientificCutoffAt(snapshot.game.scheduledStartAt);
      if (!cutoffResult.ok) {
        throw new Error('Cutoff failed');
      }
      const prepared: MLBProspectivePregameEvidencePrepared = {
        contractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: activation.activationId,
        captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
        compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
        gameId: snapshot.game.gameId,
        snapshotId: snapshot.snapshotId,
        officialDate: snapshot.game.officialDate,
        scheduledStartAt: snapshot.game.scheduledStartAt,
        scientificCutoffAt: cutoffResult.scientificCutoffAt,
        actualDataCutoffAt: snapshot.dataCutoffAt,
        rawSnapshot: snapshot,
        rawFeatureVector: rawVector,
        candidate003CompatibleFeatureVector: compatibleResult.value,
        t360Validation: {
          status: 'ACCEPTED',
          actualDataCutoffAtLteScientificCutoff: true,
          sourceTimestampsProvenLteScientificCutoff: true,
        },
      };
      const persistedAt = '2026-08-15T06:00:00.001Z';
      const evidenceReceipt = await persistSyntheticEvidence(root, prepared, () => persistedAt);
      const persistedEvidence = await readProspectivePregameEvidence(root, evidenceReceipt.artifactId);
      if (!persistedEvidence.ok) {
        throw new Error('Failed to read persisted evidence: ' + JSON.stringify(persistedEvidence.issues));
      }


      const scheduleGame = buildScheduleGame();
      const binding = buildValidPreparedBinding(persistedEvidence.value, evidenceReceipt, scheduleGame);
      const bindingReceipt = await persistSyntheticBinding(root, binding, () => persistedAt);

      const orphanPersistedAt = '2026-08-15T06:00:00.001Z';
      const orphanEvidenceReceipt = await persistSyntheticEvidence(
        root,
        buildPreparedEvidenceForIdentity(game.gamePk, 'snapshot-orphan', game.officialDate, game.startTimeUtc.toISOString(), activation.activationId),
        () => orphanPersistedAt,
      );
      const persistedOrphanEvidence = await readProspectivePregameEvidence(root, orphanEvidenceReceipt.artifactId);
      if (!persistedOrphanEvidence.ok) {
        throw new Error('Failed to read persisted orphan evidence: ' + JSON.stringify(persistedOrphanEvidence.issues));
      }
      const orphanBinding = buildValidPreparedBinding(persistedOrphanEvidence.value, orphanEvidenceReceipt, scheduleGame);
      const orphanBindingReceipt = await persistSyntheticBinding(root, orphanBinding, () => orphanPersistedAt);
      const bindingPaths = resolveMLBProspectiveHoldoutGameIdentityBindingStorePaths(root);
      await fs.unlink(resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths(root, orphanBindingReceipt.bindingId).bindingPath);

      const clock = createConstantClock('2026-08-15T11:00:00.000Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('CAPTURE_LINEAGE_MULTIPLICITY_INELIGIBLE');
      expect(builderCallCount).toBe(0);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('17. exactly one current complete pair, schedule identical → ALREADY_COMPLETE → builder 0 → filesystem unchanged', async () => {
    const root = await createTempRoot('mlb-capture-complete-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const game = buildScheduleGame();
      const snapshot = buildValidSnapshotObject({
        game: {
          gameId: String(game.gamePk),
          scheduledStartAt: game.startTimeUtc.toISOString(),
          officialDate: game.officialDate,
        },
      });
      const rawVector = extractRawVector(snapshot);
      const compatibleResult = applyCandidate003ProspectiveFeatureCompatibility(rawVector);
      if (!compatibleResult.ok) {
        throw new Error('Compatibility failed');
      }
      const cutoffResult = computeScientificCutoffAt(snapshot.game.scheduledStartAt);
      if (!cutoffResult.ok) {
        throw new Error('Cutoff failed');
      }
      const prepared: MLBProspectivePregameEvidencePrepared = {
        contractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: activation.activationId,
        captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
        compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
        gameId: snapshot.game.gameId,
        snapshotId: snapshot.snapshotId,
        officialDate: snapshot.game.officialDate,
        scheduledStartAt: snapshot.game.scheduledStartAt,
        scientificCutoffAt: cutoffResult.scientificCutoffAt,
        actualDataCutoffAt: snapshot.dataCutoffAt,
        rawSnapshot: snapshot,
        rawFeatureVector: rawVector,
        candidate003CompatibleFeatureVector: compatibleResult.value,
        t360Validation: {
          status: 'ACCEPTED',
          actualDataCutoffAtLteScientificCutoff: true,
          sourceTimestampsProvenLteScientificCutoff: true,
        },
      };
      const persistedAt = '2026-08-15T06:00:00.001Z';
      const evidenceReceipt = await persistSyntheticEvidence(root, prepared, () => persistedAt);
      const persistedEvidence = await readProspectivePregameEvidence(root, evidenceReceipt.artifactId);
      if (!persistedEvidence.ok) {
        throw new Error('Failed to read persisted evidence: ' + JSON.stringify(persistedEvidence.issues));
      }


      const scheduleGame = buildScheduleGame();
      const binding = buildValidPreparedBinding(persistedEvidence.value, evidenceReceipt, scheduleGame);
      await persistSyntheticBinding(root, binding, () => persistedAt);

      const beforeEvidencePaths = resolveMLBProspectivePregameEvidenceStorePaths(root);
      const beforeBindingPaths = resolveMLBProspectiveHoldoutGameIdentityBindingStorePaths(root);
      const beforeEvidenceCount = (await fs.readdir(beforeEvidencePaths.evidenceDirectory).catch(() => []))
        .filter((entry) => entry.endsWith('.json')).length;
      const beforeBindingCount = (await fs.readdir(beforeBindingPaths.bindingDirectory).catch(() => []))
        .filter((entry) => entry.endsWith('.json')).length;

      const clock = createConstantClock('2026-08-15T11:00:00.000Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('ALREADY_COMPLETE');
      expect(builderCallCount).toBe(0);

      const afterEvidencePaths = resolveMLBProspectivePregameEvidenceStorePaths(root);
      const afterBindingPaths = resolveMLBProspectiveHoldoutGameIdentityBindingStorePaths(root);
      const afterEvidenceCount = (await fs.readdir(afterEvidencePaths.evidenceDirectory).catch(() => []))
        .filter((entry) => entry.endsWith('.json')).length;
      const afterBindingCount = (await fs.readdir(afterBindingPaths.bindingDirectory).catch(() => []))
        .filter((entry) => entry.endsWith('.json')).length;
      expect(afterEvidenceCount).toBe(beforeEvidenceCount);
      expect(afterBindingCount).toBe(beforeBindingCount);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('18. exactly one current complete pair, current officialDate/start changed → SCHEDULE_DRIFT_INELIGIBLE → no recapture', async () => {
    const root = await createTempRoot('mlb-capture-complete-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const game = buildScheduleGame();
      const snapshot = buildValidSnapshotObject({
        game: {
          gameId: String(game.gamePk),
          scheduledStartAt: game.startTimeUtc.toISOString(),
          officialDate: game.officialDate,
        },
      });
      const rawVector = extractRawVector(snapshot);
      const compatibleResult = applyCandidate003ProspectiveFeatureCompatibility(rawVector);
      if (!compatibleResult.ok) {
        throw new Error('Compatibility failed');
      }
      const cutoffResult = computeScientificCutoffAt(snapshot.game.scheduledStartAt);
      if (!cutoffResult.ok) {
        throw new Error('Cutoff failed');
      }
      const prepared: MLBProspectivePregameEvidencePrepared = {
        contractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: activation.activationId,
        captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
        compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
        gameId: snapshot.game.gameId,
        snapshotId: snapshot.snapshotId,
        officialDate: snapshot.game.officialDate,
        scheduledStartAt: snapshot.game.scheduledStartAt,
        scientificCutoffAt: cutoffResult.scientificCutoffAt,
        actualDataCutoffAt: snapshot.dataCutoffAt,
        rawSnapshot: snapshot,
        rawFeatureVector: rawVector,
        candidate003CompatibleFeatureVector: compatibleResult.value,
        t360Validation: {
          status: 'ACCEPTED',
          actualDataCutoffAtLteScientificCutoff: true,
          sourceTimestampsProvenLteScientificCutoff: true,
        },
      };
      const persistedAt = '2026-08-15T06:00:00.001Z';
      const evidenceReceipt = await persistSyntheticEvidence(root, prepared, () => persistedAt);
      const persistedEvidence = await readProspectivePregameEvidence(root, evidenceReceipt.artifactId);
      if (!persistedEvidence.ok) {
        throw new Error('Failed to read persisted evidence: ' + JSON.stringify(persistedEvidence.issues));
      }


      const scheduleGame = buildScheduleGame();
      const binding = buildValidPreparedBinding(persistedEvidence.value, evidenceReceipt, scheduleGame);
      await persistSyntheticBinding(root, binding, () => persistedAt);

      const driftedGame = buildScheduleGame({
        startTimeUtc: new Date('2026-08-15T12:30:00Z'),
        officialDate: '2026-08-16',
      });
      const clock = createConstantClock('2026-08-15T11:00:00.000Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame: driftedGame,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('SCHEDULE_DRIFT_INELIGIBLE');
      expect(builderCallCount).toBe(0);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('19. J bound-pair multiplicity conflict → RESCHEDULE_CONFLICT_INELIGIBLE → builder 0', async () => {
    const root = await createTempRoot('mlb-capture-conflict-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const game = buildScheduleGame();
      const snapshot = buildValidSnapshotObject({
        game: {
          gameId: String(game.gamePk),
          scheduledStartAt: game.startTimeUtc.toISOString(),
          officialDate: game.officialDate,
        },
      });
      const rawVector = extractRawVector(snapshot);
      const compatibleResult = applyCandidate003ProspectiveFeatureCompatibility(rawVector);
      if (!compatibleResult.ok) {
        throw new Error('Compatibility failed');
      }
      const cutoffResult = computeScientificCutoffAt(snapshot.game.scheduledStartAt);
      if (!cutoffResult.ok) {
        throw new Error('Cutoff failed');
      }
      const prepared: MLBProspectivePregameEvidencePrepared = {
        contractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: activation.activationId,
        captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
        compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
        gameId: snapshot.game.gameId,
        snapshotId: snapshot.snapshotId,
        officialDate: snapshot.game.officialDate,
        scheduledStartAt: snapshot.game.scheduledStartAt,
        scientificCutoffAt: cutoffResult.scientificCutoffAt,
        actualDataCutoffAt: snapshot.dataCutoffAt,
        rawSnapshot: snapshot,
        rawFeatureVector: rawVector,
        candidate003CompatibleFeatureVector: compatibleResult.value,
        t360Validation: {
          status: 'ACCEPTED',
          actualDataCutoffAtLteScientificCutoff: true,
          sourceTimestampsProvenLteScientificCutoff: true,
        },
      };
      const persistedAt = '2026-08-15T06:00:00.001Z';
      const evidenceReceiptA = await persistSyntheticEvidence(root, prepared, () => persistedAt);
      const evidenceReceiptB = await persistSyntheticEvidence(
        root,
        buildPreparedEvidenceForIdentity(game.gamePk, 'snapshot-conflict', game.officialDate, game.startTimeUtc.toISOString(), activation.activationId),
        () => persistedAt,
      );

      const scheduleGame = buildScheduleGame();
      const persistedEvidenceA = await readProspectivePregameEvidence(root, evidenceReceiptA.artifactId);
      if (!persistedEvidenceA.ok) {
        throw new Error('Failed to read persisted evidence A: ' + JSON.stringify(persistedEvidenceA.issues));
      }
      const bindingA = buildValidPreparedBinding(persistedEvidenceA.value, evidenceReceiptA, scheduleGame);
      const bindingReceiptA = await persistSyntheticBinding(root, bindingA, () => persistedAt);

      const persistedEvidenceB = await readProspectivePregameEvidence(root, evidenceReceiptB.artifactId);
      if (!persistedEvidenceB.ok) {
        throw new Error('Failed to read persisted evidence B: ' + JSON.stringify(persistedEvidenceB.issues));
      }
      const bindingB = buildValidPreparedBinding(persistedEvidenceB.value, evidenceReceiptB, scheduleGame);
      const bindingReceiptB = await persistSyntheticBinding(root, bindingB, () => persistedAt);

      const driftedGame = buildScheduleGame({
        startTimeUtc: new Date('2026-08-15T12:30:00Z'),
      });
      const clock = createConstantClock('2026-08-15T11:00:00.000Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame: driftedGame,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('RESCHEDULE_CONFLICT_INELIGIBLE');
      expect(builderCallCount).toBe(0);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('20. J integrity failure such as binding→missing-H → INTEGRITY_FAILURE → builder 0 → no automatic repair', async () => {
    const root = await createTempRoot('mlb-capture-integrity-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const game = buildScheduleGame();
      const snapshot = buildValidSnapshotObject({
        game: {
          gameId: String(game.gamePk),
          scheduledStartAt: game.startTimeUtc.toISOString(),
          officialDate: game.officialDate,
        },
      });
      const rawVector = extractRawVector(snapshot);
      const compatibleResult = applyCandidate003ProspectiveFeatureCompatibility(rawVector);
      if (!compatibleResult.ok) {
        throw new Error('Compatibility failed');
      }
      const cutoffResult = computeScientificCutoffAt(snapshot.game.scheduledStartAt);
      if (!cutoffResult.ok) {
        throw new Error('Cutoff failed');
      }
      const prepared: MLBProspectivePregameEvidencePrepared = {
        contractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: activation.activationId,
        captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
        compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
        gameId: snapshot.game.gameId,
        snapshotId: snapshot.snapshotId,
        officialDate: snapshot.game.officialDate,
        scheduledStartAt: snapshot.game.scheduledStartAt,
        scientificCutoffAt: cutoffResult.scientificCutoffAt,
        actualDataCutoffAt: snapshot.dataCutoffAt,
        rawSnapshot: snapshot,
        rawFeatureVector: rawVector,
        candidate003CompatibleFeatureVector: compatibleResult.value,
        t360Validation: {
          status: 'ACCEPTED',
          actualDataCutoffAtLteScientificCutoff: true,
          sourceTimestampsProvenLteScientificCutoff: true,
        },
      };
      const persistedAt = '2026-08-15T06:00:00.001Z';
      const evidenceReceipt = await persistSyntheticEvidence(root, prepared, () => persistedAt);
      const persistedEvidence = await readProspectivePregameEvidence(root, evidenceReceipt.artifactId);
      if (!persistedEvidence.ok) {
        throw new Error('Failed to read persisted evidence: ' + JSON.stringify(persistedEvidence.issues));
      }


      const scheduleGame = buildScheduleGame();
      const binding = buildValidPreparedBinding(persistedEvidence.value, evidenceReceipt, scheduleGame);
      const bindingReceipt = await persistSyntheticBinding(root, binding, () => persistedAt);

      const evidencePaths = resolveMLBProspectivePregameEvidenceStorePaths(root);
      await fs.unlink(resolveMLBProspectivePregameEvidenceArtifactPaths(root, evidenceReceipt.artifactId).artifactPath);

      const clock = createConstantClock('2026-08-15T11:00:00.000Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('INTEGRITY_FAILURE');
      expect(builderCallCount).toBe(0);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Stage E: foreign/temp diagnostics + static authority tests                */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-capture-orchestrator: foreign/temp diagnostics', () => {
  it('21. valid foreign activation-scoped artifacts → do not contaminate active current-game state', async () => {
    const root = await createTempRoot('mlb-capture-foreign-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const game = buildScheduleGame();
      const foreignPrepared = buildPreparedEvidenceForIdentity(
        game.gamePk,
        'snapshot-foreign',
        game.officialDate,
        game.startTimeUtc.toISOString(),
        'activation-foreign',
      );
      const foreignEvidenceReceipt = await persistSyntheticEvidence(root, foreignPrepared, () => '2026-08-15T05:30:00Z');
      const persistedForeignEvidence = await readProspectivePregameEvidence(root, foreignEvidenceReceipt.artifactId);
      if (!persistedForeignEvidence.ok) {
        throw new Error('Failed to read persisted foreign evidence: ' + JSON.stringify(persistedForeignEvidence.issues));
      }
      const foreignBinding = buildValidPreparedBinding(persistedForeignEvidence.value, foreignEvidenceReceipt, game);
      await persistSyntheticBinding(root, foreignBinding, () => '2026-08-15T05:30:00Z');

      const clock = createConstantClock('2026-08-15T05:59:59.999Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame: game,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('CAPTURED_AND_BOUND');
      expect(builderCallCount).toBe(1);
      if (result.kind !== 'CAPTURED_AND_BOUND') {
        throw new Error('Expected CAPTURED_AND_BOUND for gameId assertion');
      }
      expect(result.gameId).toBe(String(game.gamePk));
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('22. recognized temp debris with J ok:true → does not block current capture → K1 does not delete it', async () => {
    const root = await createTempRoot('mlb-capture-temp-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const evidencePaths = resolveMLBProspectivePregameEvidenceStorePaths(root);
      await fs.mkdir(evidencePaths.evidenceDirectory, { recursive: true });
      const debrisPath = path.join(evidencePaths.evidenceDirectory, 'scratch.tmp-debris');
      await fs.writeFile(debrisPath, 'temp', 'utf-8');

      const discoveryBefore = await discoverMLBProspectiveHoldoutArtifacts(root, persistedActivation);
      expect(discoveryBefore.ok).toBe(true);
      if (!discoveryBefore.ok) {
        throw new Error('artifact discovery fixture failed: ' + JSON.stringify(discoveryBefore.issues));
      }
      expect(discoveryBefore.temporaryDebris).toContain(debrisPath);
      expect(discoveryBefore.unknownFiles).not.toContain(expect.stringContaining(debrisPath));

      const game = buildScheduleGame();
      const clock = createConstantClock('2026-08-15T05:59:59.999Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame: game,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('CAPTURED_AND_BOUND');
      expect(builderCallCount).toBe(1);

      const debrisExists = await fs.stat(debrisPath).then(() => true).catch(() => false);
      expect(debrisExists).toBe(true);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('22a. unknown non-JSON file with J ok:true → does not block current capture → K1 preserves byte-identical unknown file', async () => {
    const root = await createTempRoot('mlb-capture-temp-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const evidencePaths = resolveMLBProspectivePregameEvidenceStorePaths(root);
      await fs.mkdir(evidencePaths.evidenceDirectory, { recursive: true });
      const unknownPath = path.join(evidencePaths.evidenceDirectory, 'unknown.txt');
      const originalContent = 'not-json';
      await fs.writeFile(unknownPath, originalContent, 'utf-8');

      const discoveryBefore = await discoverMLBProspectiveHoldoutArtifacts(root, persistedActivation);
      expect(discoveryBefore.ok).toBe(true);
      if (!discoveryBefore.ok) {
        throw new Error('artifact discovery fixture failed: ' + JSON.stringify(discoveryBefore.issues));
      }
      expect(discoveryBefore.unknownFiles).toContain(unknownPath);
      expect(discoveryBefore.temporaryDebris).not.toContain(expect.stringContaining(unknownPath));

      const game = buildScheduleGame();
      const clock = createConstantClock('2026-08-15T05:59:59.999Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame: game,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('CAPTURED_AND_BOUND');
      expect(builderCallCount).toBe(1);

      const unknownExists = await fs.stat(unknownPath).then(() => true).catch(() => false);
      expect(unknownExists).toBe(true);
      const unknownContent = await fs.readFile(unknownPath, 'utf-8');
      expect(unknownContent).toBe(originalContent);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

describe('mlb-prospective-holdout-capture-orchestrator: static authority', () => {
  it('25. gameId authority: derives from scheduleGame.gamePk as String', async () => {
    const game = buildScheduleGame({ gamePk: 900002 });
    const clock = createConstantClock('2026-08-15T05:59:59.999Z');
    const builder = createSnapshotBuilder();
    resetBuilderCount();

    const result = await runProspectiveHoldoutCaptureOrchestrator({
      repositoryRoot: await createTempRoot('mlb-capture-authority-'),
      scheduleGame: game,
      clock,
      snapshotBuilder: builder,
    });

    expect(result.kind).toBe('ACTIVATION_UNAVAILABLE');
    expect(builderCallCount).toBe(0);
  });

  it('26. current schedule start identity: persists scheduleGame.startTimeUtc.toISOString()', async () => {
    const root = await createTempRoot('mlb-capture-start-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const scheduleGame = buildScheduleGame();
      const snapshot = buildValidSnapshotObject({
        game: {
          gameId: String(scheduleGame.gamePk),
          scheduledStartAt: scheduleGame.startTimeUtc.toISOString(),
          officialDate: scheduleGame.officialDate,
        },
      });
      const rawVector = extractRawVector(snapshot);
      const compatibleResult = applyCandidate003ProspectiveFeatureCompatibility(rawVector);
      if (!compatibleResult.ok) {
        throw new Error('Compatibility failed');
      }
      const cutoffResult = computeScientificCutoffAt(snapshot.game.scheduledStartAt);
      if (!cutoffResult.ok) {
        throw new Error('Cutoff failed');
      }
      const prepared: MLBProspectivePregameEvidencePrepared = {
        contractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: activation.activationId,
        captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
        compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
        gameId: snapshot.game.gameId,
        snapshotId: snapshot.snapshotId,
        officialDate: snapshot.game.officialDate,
        scheduledStartAt: snapshot.game.scheduledStartAt,
        scientificCutoffAt: cutoffResult.scientificCutoffAt,
        actualDataCutoffAt: snapshot.dataCutoffAt,
        rawSnapshot: snapshot,
        rawFeatureVector: rawVector,
        candidate003CompatibleFeatureVector: compatibleResult.value,
        t360Validation: {
          status: 'ACCEPTED',
          actualDataCutoffAtLteScientificCutoff: true,
          sourceTimestampsProvenLteScientificCutoff: true,
        },
      };
      const persistedAt = '2026-08-15T06:00:00.001Z';
      const evidenceReceipt = await persistSyntheticEvidence(root, prepared, () => persistedAt);
      const persistedEvidence = await readProspectivePregameEvidence(root, evidenceReceipt.artifactId);
      if (!persistedEvidence.ok) {
        throw new Error('Failed to read persisted evidence: ' + JSON.stringify(persistedEvidence.issues));
      }


      const binding = buildValidPreparedBinding(persistedEvidence.value, evidenceReceipt, scheduleGame);
      const bindingReceipt = await persistSyntheticBinding(root, binding, () => persistedAt);

      const bindingPaths = resolveMLBProspectiveHoldoutGameIdentityBindingStorePaths(root);
      const boundBinding = await readProspectiveHoldoutGameIdentityBinding(
        root,
        bindingReceipt.bindingId,
      );
      expect(boundBinding.ok).toBe(true);
      if (!boundBinding.ok) {
        throw new Error('bound binding fixture failed: ' + JSON.stringify(boundBinding.issues));
      }
      expect(boundBinding.value.scheduledStartAt).toBe(scheduleGame.startTimeUtc.toISOString());
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Stage F: concurrency races                                                */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-capture-orchestrator: concurrency races', () => {
  it('27. two concurrent clean-state workers both traverse fresh-capture path → one H publication wins / loser read-backs existing H → one complete lineage', async () => {
    const root = await createTempRoot('mlb-capture-race-a-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const game = buildScheduleGame();
      const clock = createConstantClock('2026-08-15T05:59:59.999Z');
      const builderA = createSnapshotBuilder();
      const builderB = createSnapshotBuilder();
      resetBuilderCount();

      const inputA = {
        repositoryRoot: root,
        scheduleGame: game,
        clock,
        snapshotBuilder: builderA,
      };
      const inputB = {
        repositoryRoot: root,
        scheduleGame: game,
        clock,
        snapshotBuilder: builderB,
      };

      const [resultA, resultB] = await Promise.all([
        runProspectiveHoldoutCaptureOrchestrator(inputA),
        runProspectiveHoldoutCaptureOrchestrator(inputB),
      ]);

      expect(resultA.kind).toBe('CAPTURED_AND_BOUND');
      expect(resultB.kind).toBe('CAPTURED_AND_BOUND');
      expect(builderCallCount).toBe(2);

      const evidencePaths = resolveMLBProspectivePregameEvidenceStorePaths(root);
      const bindingPaths = resolveMLBProspectiveHoldoutGameIdentityBindingStorePaths(root);
      const evidenceCount = (await fs.readdir(evidencePaths.evidenceDirectory).catch(() => []))
        .filter((entry) => entry.endsWith('.json')).length;
      const bindingCount = (await fs.readdir(bindingPaths.bindingDirectory).catch(() => []))
        .filter((entry) => entry.endsWith('.json')).length;
      expect(evidenceCount).toBe(1);
      expect(bindingCount).toBe(1);

      const discovery = await discoverMLBProspectiveHoldoutArtifacts(root, persistedActivation);
      expect(discovery.ok).toBe(true);
      if (!discovery.ok) {
        throw new Error('discovery failed: ' + JSON.stringify(discovery.issues));
      }
      expect(discovery.orphanEvidence).toHaveLength(0);
      expect(discovery.candidates).toHaveLength(1);
      expect(discovery.rescheduleConflicts).toHaveLength(0);
      expect(discovery.temporaryDebris).toHaveLength(0);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('28. two concurrent workers, pre-existing orphan H → benign race → 1 H → 1 binding → 0 orphan → J ok:true', async () => {
    const root = await createTempRoot('mlb-capture-race-b-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const game = buildScheduleGame();
      const snapshot = buildValidSnapshotObject({
        game: {
          gameId: String(game.gamePk),
          scheduledStartAt: game.startTimeUtc.toISOString(),
          officialDate: game.officialDate,
        },
      });
      const rawVector = extractRawVector(snapshot);
      const compatibleResult = applyCandidate003ProspectiveFeatureCompatibility(rawVector);
      if (!compatibleResult.ok) {
        throw new Error('Compatibility failed');
      }
      const cutoffResult = computeScientificCutoffAt(snapshot.game.scheduledStartAt);
      if (!cutoffResult.ok) {
        throw new Error('Cutoff failed');
      }
      const prepared: MLBProspectivePregameEvidencePrepared = {
        contractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: activation.activationId,
        captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
        compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
        gameId: snapshot.game.gameId,
        snapshotId: snapshot.snapshotId,
        officialDate: snapshot.game.officialDate,
        scheduledStartAt: snapshot.game.scheduledStartAt,
        scientificCutoffAt: cutoffResult.scientificCutoffAt,
        actualDataCutoffAt: snapshot.dataCutoffAt,
        rawSnapshot: snapshot,
        rawFeatureVector: rawVector,
        candidate003CompatibleFeatureVector: compatibleResult.value,
        t360Validation: {
          status: 'ACCEPTED' as const,
          actualDataCutoffAtLteScientificCutoff: true,
          sourceTimestampsProvenLteScientificCutoff: true,
        },
      };
      await persistSyntheticEvidence(root, prepared, () => '2026-08-15T05:30:00.000Z');

      const clock = createConstantClock('2026-08-15T05:59:59.999Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const input = {
        repositoryRoot: root,
        scheduleGame: game,
        clock,
        snapshotBuilder: builder,
      };

      const [resultA, resultB] = await Promise.all([
        runProspectiveHoldoutCaptureOrchestrator(input),
        runProspectiveHoldoutCaptureOrchestrator(input),
      ]);

      expect(resultA.kind).toBe('RECOVERED_BINDING_FROM_ORPHAN_H');
      expect(resultB.kind).toBe('RECOVERED_BINDING_FROM_ORPHAN_H');
      expect(builderCallCount).toBe(0);

      const evidencePaths = resolveMLBProspectivePregameEvidenceStorePaths(root);
      const bindingPaths = resolveMLBProspectiveHoldoutGameIdentityBindingStorePaths(root);
      const evidenceCount = (await fs.readdir(evidencePaths.evidenceDirectory).catch(() => []))
        .filter((entry) => entry.endsWith('.json')).length;
      const bindingCount = (await fs.readdir(bindingPaths.bindingDirectory).catch(() => []))
        .filter((entry) => entry.endsWith('.json')).length;
      expect(evidenceCount).toBe(1);
      expect(bindingCount).toBe(1);

      const discovery = await discoverMLBProspectiveHoldoutArtifacts(root, persistedActivation);
      expect(discovery.ok).toBe(true);
      if (!discovery.ok) {
        throw new Error('discovery failed: ' + JSON.stringify(discovery.issues));
      }
      expect(discovery.orphanEvidence).toHaveLength(0);
      expect(discovery.candidates).toHaveLength(1);
      expect(discovery.rescheduleConflicts).toHaveLength(0);
      expect(discovery.temporaryDebris).toHaveLength(0);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('30. controlled schedule-revision ordering / stale-complete-lineage safety: worker A captures S1, worker B sees S2 → A CAPTURED_AND_BOUND → B SCHEDULE_DRIFT_INELIGIBLE → 1 H → 1 binding → 0 orphan → J ok:true', async () => {
    const root = await createTempRoot('mlb-capture-race-d-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const scheduleS1 = buildScheduleGame({
        officialDate: '2026-08-15',
        startTimeUtc: new Date('2026-08-15T12:00:00Z'),
      });
      const scheduleS2 = buildScheduleGame({
        officialDate: '2026-08-16',
        startTimeUtc: new Date('2026-08-16T12:00:30Z'),
      });

      const clock = createConstantClock('2026-08-15T05:59:59.999Z');
      const builder = createSnapshotBuilder();
      resetBuilderCount();

      const inputA = {
        repositoryRoot: root,
        scheduleGame: scheduleS1,
        clock,
        snapshotBuilder: builder,
      };
      const inputB = {
        repositoryRoot: root,
        scheduleGame: scheduleS2,
        clock,
        snapshotBuilder: builder,
      };

      const resultA = await runProspectiveHoldoutCaptureOrchestrator(inputA);
      const resultB = await runProspectiveHoldoutCaptureOrchestrator(inputB);

      expect(resultA.kind).toBe('CAPTURED_AND_BOUND');
      expect(resultB.kind).toBe('SCHEDULE_DRIFT_INELIGIBLE');
      expect(builderCallCount).toBe(1);

      const evidencePaths = resolveMLBProspectivePregameEvidenceStorePaths(root);
      const bindingPaths = resolveMLBProspectiveHoldoutGameIdentityBindingStorePaths(root);
      const evidenceCount = (await fs.readdir(evidencePaths.evidenceDirectory).catch(() => []))
        .filter((entry) => entry.endsWith('.json')).length;
      const bindingCount = (await fs.readdir(bindingPaths.bindingDirectory).catch(() => []))
        .filter((entry) => entry.endsWith('.json')).length;
      expect(evidenceCount).toBe(1);
      expect(bindingCount).toBe(1);

      const discovery = await discoverMLBProspectiveHoldoutArtifacts(root, persistedActivation);
      expect(discovery.ok).toBe(true);
      if (!discovery.ok) {
        throw new Error('discovery failed: ' + JSON.stringify(discovery.issues));
      }
      expect(discovery.orphanEvidence).toHaveLength(0);
      expect(discovery.candidates).toHaveLength(1);
      expect(discovery.rescheduleConflicts).toHaveLength(0);
      expect(discovery.temporaryDebris).toHaveLength(0);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Stage G: bridge defect regression                                          */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-capture-orchestrator: bridge defect regression', () => {
  it('31. native provider shapes (string availability, null recentWorkload) → INTEGRITY_FAILURE → builder 1 → no H → no binding', async () => {
    resetBuilderCount();
    const root = await createTempRoot('mlb-capture-bridge-defect-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const game = buildScheduleGame();
      const clock = createConstantClock('2026-08-15T05:59:59.999Z');

      const invalidSnapshotOverrides = {
        sections: [
          {
            sectionId: 'section-away-batting',
            kind: 'TEAM_SEASON_CONTEXT',
            entity: { scope: 'AWAY_TEAM', entityId: 'away-1' },
            status: 'AVAILABLE',
            asOfAt: FROZEN_SOURCE_TS,
            sourceRefIds: ['src-official'],
            payload: {
              seasonStats: { winRate: 0.5, runsScoredPerGame: 4.2, runsAllowedPerGame: 3.8 },
            },
          },
          {
            sectionId: 'section-away-bullpen',
            kind: 'BULLPEN_CONTEXT',
            entity: { scope: 'AWAY_TEAM', entityId: 'away-1' },
            status: 'AVAILABLE',
            asOfAt: FROZEN_SOURCE_TS,
            sourceRefIds: ['src-official'],
            payload: {
              recentWorkload: null,
            },
          },
          {
            sectionId: 'section-away-starter',
            kind: 'STARTING_PITCHER_CONTEXT',
            entity: { scope: 'AWAY_STARTER', entityId: 'p-2' },
            status: 'AVAILABLE',
            asOfAt: FROZEN_SOURCE_TS,
            sourceRefIds: ['src-official'],
            payload: {
              availability: 'AVAILABLE',
            },
          },
          {
            sectionId: 'section-game-context',
            kind: 'GAME_CONTEXT',
            entity: { scope: 'GAME', entityId: null },
            status: 'AVAILABLE',
            asOfAt: FROZEN_SOURCE_TS,
            sourceRefIds: ['src-official'],
            payload: { doubleHeaderGameNumber: 1, scheduledInnings: 9 },
          },
          {
            sectionId: 'section-home-batting',
            kind: 'TEAM_SEASON_CONTEXT',
            entity: { scope: 'HOME_TEAM', entityId: 'home-1' },
            status: 'AVAILABLE',
            asOfAt: FROZEN_SOURCE_TS,
            sourceRefIds: ['src-official'],
            payload: {
              seasonStats: { winRate: 0.5, runsScoredPerGame: 4.2, runsAllowedPerGame: 3.8 },
            },
          },
          {
            sectionId: 'section-home-bullpen',
            kind: 'BULLPEN_CONTEXT',
            entity: { scope: 'HOME_TEAM', entityId: 'home-1' },
            status: 'AVAILABLE',
            asOfAt: FROZEN_SOURCE_TS,
            sourceRefIds: ['src-official'],
            payload: {
              recentWorkload: null,
            },
          },
          {
            sectionId: 'section-home-starter',
            kind: 'STARTING_PITCHER_CONTEXT',
            entity: { scope: 'HOME_STARTER', entityId: 'p-1' },
            status: 'AVAILABLE',
            asOfAt: FROZEN_SOURCE_TS,
            sourceRefIds: ['src-official'],
            payload: {
              availability: 'AVAILABLE',
            },
          },
        ],
        startingPitchers: {
          home: { state: 'PROBABLE', pitcherId: 'p-1', announcedAt: FROZEN_SOURCE_TS, sourceRefIds: ['src-official'] },
          away: { state: 'PROBABLE', pitcherId: 'p-2', announcedAt: FROZEN_SOURCE_TS, sourceRefIds: ['src-official'] },
        },
        dataCompleteness: 'COMPLETE',
        warnings: [buildWarning()],
      };

      const builder = (): MLBCanonicalPregameSnapshot => {
        builderCallCount++;
        const raw = buildValidSnapshot({
          ...invalidSnapshotOverrides,
          game: {
            gameId: String(game.gamePk),
            scheduledStartAt: game.startTimeUtc.toISOString(),
            officialDate: game.officialDate,
          },
        });
        const validation = validateMLBCanonicalPregameSnapshot(raw);
        if (!validation.ok) {
          throw new Error('Invalid snapshot fixture: ' + JSON.stringify(validation.issues));
        }
        return validation.value;
      };

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame: game,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('INTEGRITY_FAILURE');
      expect(builderCallCount).toBe(1);
      if (result.kind !== 'INTEGRITY_FAILURE') {
        throw new Error(`Expected INTEGRITY_FAILURE, received ${result.kind}`);
      }
      const issueCodes = (result.issues as string[]).map((issue) => issue.split(' ')[0]);
      expect(issueCodes).toContain('FEATURE_TYPE_MISMATCH:');
      expect(issueCodes).toContain('FEATURE_SOURCE_INVALID:');
      expect(issueCodes.filter((code) => code === 'FEATURE_TYPE_MISMATCH:').length).toBe(2);
      expect(issueCodes.filter((code) => code === 'FEATURE_SOURCE_INVALID:').length).toBe(4);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('32. bridge-adapted provider shapes → CAPTURED_AND_BOUND → builder 1 → 1 H → 1 binding', async () => {
    resetBuilderCount();
    const root = await createTempRoot('mlb-capture-bridge-positive-');
    try {
      const activation = buildValidActivation();
      const persistedActivation = await persistSyntheticActivation(root, activation, () => '2026-08-15T05:00:00Z');

      const game = buildScheduleGame({ gameType: 'R' });
      const clock = createConstantClock('2026-08-15T05:59:59.999Z');

      const researchSnapshot: MLBRealDataPregameSnapshotBridgeInput['researchSnapshot'] = {
        event: {
          id: 'event-1',
          externalId: String(game.gamePk),
          sport: 'mlb',
          league: 'MLB',
          leagueSlug: 'mlb',
          homeTeam: game.homeTeamName,
          awayTeam: game.awayTeamName,
          homeTeamSlug: 'home',
          awayTeamSlug: 'away',
          startTimeUtc: game.startTimeUtc,
          status: 'UPCOMING',
          homeScore: undefined,
          awayScore: undefined,
          createdAt: new Date('2026-08-15T04:00:00Z'),
          updatedAt: new Date('2026-08-15T04:00:00Z'),
        },
        probablePitchers: {
          home: {
            availability: 'AVAILABLE',
            personId: 1001,
            fullName: 'Home Pitcher',
            teamId: game.homeTeamId,
            status: 'CONFIRMED',
            fetchedAt: new Date('2026-08-15T05:00:00Z'),
            warnings: [],
          },
          away: {
            availability: 'AVAILABLE',
            personId: 1002,
            fullName: 'Away Pitcher',
            teamId: game.awayTeamId,
            status: 'CONFIRMED',
            fetchedAt: new Date('2026-08-15T05:00:00Z'),
            warnings: [],
          },
        },
        pitcherStats: { home: null, away: null },
        teamBatting: { home: null, away: null },
        bullpen: {
          home: {
            teamId: game.homeTeamId,
            teamName: game.homeTeamName,
            completeness: 100,
            warnings: [],
            seasonStats: {
              gamesPlayed: 1,
              gamesStarted: 0,
              inningsPitched: '0.0',
              era: '0.00',
              whip: '0.00',
              strikeOuts: 0,
              baseOnBalls: 0,
              homeRuns: 0,
              hits: 0,
              earnedRuns: 0,
              gamesPitched: 1,
              saves: 0,
              saveOpportunities: 0,
              holds: 0,
              blownSaves: 0,
              strikeoutsPer9Inn: '0.0',
              walksPer9Inn: '0.0',
              hitsPer9Inn: '0.0',
              homeRunsPer9: '0.0',
            },
            recentWorkload: null,
            confirmedRelieverAvailability: 'KNOWN',
            provenance: {
              source: 'mlb-stats-api:schedule',
              fetchedAt: new Date('2026-08-15T05:00:00Z'),
              sourceTimestamp: new Date('2026-08-15T05:00:00Z'),
              isLive: false,
              warnings: [],
            },
          },
          away: {
            teamId: game.awayTeamId,
            teamName: game.awayTeamName,
            completeness: 100,
            warnings: [],
            seasonStats: {
              gamesPlayed: 1,
              gamesStarted: 0,
              inningsPitched: '0.0',
              era: '0.00',
              whip: '0.00',
              strikeOuts: 0,
              baseOnBalls: 0,
              homeRuns: 0,
              hits: 0,
              earnedRuns: 0,
              gamesPitched: 1,
              saves: 0,
              saveOpportunities: 0,
              holds: 0,
              blownSaves: 0,
              strikeoutsPer9Inn: '0.0',
              walksPer9Inn: '0.0',
              hitsPer9Inn: '0.0',
              homeRunsPer9: '0.0',
            },
            recentWorkload: null,
            confirmedRelieverAvailability: 'KNOWN',
            provenance: {
              source: 'mlb-stats-api:schedule',
              fetchedAt: new Date('2026-08-15T05:00:00Z'),
              sourceTimestamp: new Date('2026-08-15T05:00:00Z'),
              isLive: false,
              warnings: [],
            },
          },
        },
        venue: null,
        weather: null,
        completeness: 100,
        warnings: [],
        provenance: [
          {
            source: 'mlb-stats-api:schedule',
            fetchedAt: new Date('2026-08-15T05:00:00Z'),
            sourceTimestamp: new Date('2026-08-15T05:00:00Z'),
            isLive: false,
            warnings: [],
          },
        ],
        generatedAt: new Date('2026-08-15T05:00:00Z'),
      };

      const builder = (game: MLBScheduleGame): MLBCanonicalPregameSnapshot => {
        builderCallCount++;
        const result = buildMLBRealDataPregameSnapshot({
          scheduleGame: game,
          researchSnapshot,
        });
        if (!result.ok) {
          throw new Error('Bridge failed: ' + JSON.stringify(result.issues));
        }
        return result.value;
      };

      const result = await runProspectiveHoldoutCaptureOrchestrator({
        repositoryRoot: root,
        scheduleGame: game,
        clock,
        snapshotBuilder: builder,
      });

      expect(result.kind).toBe('CAPTURED_AND_BOUND');
      expect(builderCallCount).toBe(1);

      const evidencePaths = resolveMLBProspectivePregameEvidenceStorePaths(root);
      const bindingPaths = resolveMLBProspectiveHoldoutGameIdentityBindingStorePaths(root);
      const evidenceCount = (await fs.readdir(evidencePaths.evidenceDirectory).catch(() => []))
        .filter((entry) => entry.endsWith('.json')).length;
      const bindingCount = (await fs.readdir(bindingPaths.bindingDirectory).catch(() => []))
        .filter((entry) => entry.endsWith('.json')).length;
      expect(evidenceCount).toBe(1);
      expect(bindingCount).toBe(1);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
