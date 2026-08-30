import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { vi, describe, expect, it, beforeEach, afterEach } from 'vitest';

import {
  runProspectiveHoldoutCapture,
  MLBProspectiveHoldoutCaptureDependencies,
} from '../../../scripts/mlb-prospective-holdout-capture';

import {
  runProspectiveHoldoutCaptureOrchestrator,
  type MLBProspectiveHoldoutCaptureOrchestratorResult,
} from '@/prediction/mlb/mlb-prospective-holdout-capture-orchestrator';

import { buildMLBRealDataPregameSnapshot } from '@/prediction/mlb/mlb-real-data-pregame-snapshot-bridge';

import {
  MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
  MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
  computeScientificCutoffAt,
} from '@/prediction/mlb/mlb-prospective-t360-capture-contract';

import {
  writeMLBProspectiveHoldoutActivation,
  readMLBProspectiveHoldoutActivation,
  resolveMLBProspectiveHoldoutActivationStorePaths,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-store';

import {
  persistProspectivePregameEvidence,
  readProspectivePregameEvidence,
  resolveMLBProspectivePregameEvidenceStorePaths,
  resolveMLBProspectivePregameEvidenceArtifactPaths,
} from '@/prediction/mlb/mlb-prospective-pregame-evidence-store';

import {
  persistProspectiveHoldoutGameIdentityBinding,
  readProspectiveHoldoutGameIdentityBinding,
  resolveMLBProspectiveHoldoutGameIdentityBindingStorePaths,
  resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths,
} from '@/prediction/mlb/mlb-prospective-holdout-game-identity-binding-store';

import {
  discoverMLBProspectiveHoldoutArtifacts,
} from '@/prediction/mlb/mlb-prospective-holdout-artifact-discovery';

import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
  MLB_PROSPECTIVE_HOLDOUT_SCI_CUTOFF_MINUTES,
} from '@/prediction/mlb/mlb-prospective-holdout-protocol-contract';

import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';

import {
  extractMLBLeakageSafeFeatureVector,
  validateMLBFeatureVector,
} from '@/prediction/mlb/mlb-feature-vector-contract';
import {
  applyCandidate003ProspectiveFeatureCompatibility,
} from '@/prediction/mlb/mlb-candidate-003-prospective-feature-compatibility';

import {
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
} from '@/prediction/mlb/mlb-inner-development-third-real-candidate-recipe';

import type {
  MLBScheduleGame,
  MLBScheduleResult,
  MLBGameResearchSnapshot,
  DataProvenance,
} from '@/lib/research-data/types';
import {
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-contract';
import type { MLBProspectiveHoldoutActivation, MLBProspectiveHoldoutActivationReceipt } from '@/prediction/mlb/mlb-prospective-holdout-activation-contract';
import {
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
} from '@/prediction/mlb/mlb-prospective-holdout-game-identity-binding-contract';
import {
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
} from '@/prediction/mlb/mlb-prospective-pregame-evidence-artifact-contract';
import type {
  MLBProspectivePregameEvidence,
  MLBProspectivePregameEvidencePrepared,
  MLBProspectivePregameEvidenceReceipt,
} from '@/prediction/mlb/mlb-prospective-pregame-evidence-artifact-contract';
import type { MLBProspectiveHoldoutGameIdentityBindingReceipt } from '@/prediction/mlb/mlb-prospective-holdout-game-identity-binding-contract';
import type { MLBCanonicalPregameSnapshot } from '@/prediction/mlb/mlb-pregame-snapshot-contract';

import type { MLBProspectiveHoldoutActivation as MLBProspectiveHoldoutActivationContract } from '@/prediction/mlb/mlb-prospective-holdout-activation-contract';
import type { MLBProspectivePregameEvidenceReceipt as MLBProspectivePregameEvidenceReceiptContract } from '@/prediction/mlb/mlb-prospective-pregame-evidence-artifact-contract';
import type { MLBProspectiveHoldoutGameIdentityBindingReceipt as MLBProspectiveHoldoutGameIdentityBindingReceiptContract } from '@/prediction/mlb/mlb-prospective-holdout-game-identity-binding-contract';
import type { MLBCanonicalPregameSnapshot as MLBCanonicalPregameSnapshotContract } from '@/prediction/mlb/mlb-pregame-snapshot-contract';

type CapturedAndBoundResult = Extract<
  MLBProspectiveHoldoutCaptureOrchestratorResult,
  { kind: 'CAPTURED_AND_BOUND' }
>;

type CaptureRejectedResult = Extract<
  MLBProspectiveHoldoutCaptureOrchestratorResult,
  { kind: 'CAPTURE_REJECTED' }
>;

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const FROZEN_SOURCE_TS = '2026-08-15T04:00:00.000Z';
const FROZEN_SCHEDULED_START = '2026-08-15T12:00:00.000Z';
const GAME_PK = 900001;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

async function createTempRoot(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function buildProposedActivation(activationId: string): MLBProspectiveHoldoutActivation {
  return {
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId,
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
    stableOrderPolicy: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY,
    validationSideDateRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE,
    testSideDateRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE,
    noSmallerN: true,
    resultIndependentSelection: true,
    testAuthorizationRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE,
    gameIdentityBindingContractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
    gameIdentityBindingStoreVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
  };
}

async function createActivation(root: string, activationId = `activation-${GAME_PK}`): Promise<MLBProspectiveHoldoutActivationReceipt> {
  const proposed = buildProposedActivation(activationId);
  const result = await writeMLBProspectiveHoldoutActivation(root, proposed, () => FROZEN_SOURCE_TS);
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => `${issue.code}: ${issue.message}`).join('; '));
  }
  return result.receipt;
}

function buildProvenance(fetchedAt: Date, sourceTimestamp?: Date): DataProvenance {
  return {
    source: 'mlb-stats-api:schedule',
    fetchedAt,
    sourceTimestamp: sourceTimestamp ?? new Date(fetchedAt),
    isLive: false,
    warnings: [],
  };
}

function buildScheduleGame(overrides: Partial<MLBScheduleGame> = {}): MLBScheduleGame {
  const base: MLBScheduleGame = {
    gamePk: GAME_PK,
    gameType: 'R',
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
    probablePitchers: { home: null, away: null },
  };
  return { ...base, ...overrides };
}

function buildResearchSnapshot(
  scheduleGame: MLBScheduleGame,
  provenance: DataProvenance[] = [buildProvenance(new Date(FROZEN_SOURCE_TS))],
  overrides: Partial<MLBGameResearchSnapshot> = {},
): MLBGameResearchSnapshot {
  const base: MLBGameResearchSnapshot = {
    event: {
      id: String(scheduleGame.gamePk),
      externalId: String(scheduleGame.gamePk),
      sport: 'MLB',
      league: 'MLB',
      leagueSlug: 'mlb',
      homeTeam: scheduleGame.homeTeamName,
      awayTeam: scheduleGame.awayTeamName,
      startTimeUtc: scheduleGame.startTimeUtc,
      status: 'UPCOMING',
      createdAt: new Date(FROZEN_SOURCE_TS),
      updatedAt: new Date(FROZEN_SOURCE_TS),
    },
    probablePitchers: { home: null, away: null },
    pitcherStats: { home: null, away: null },
    teamBatting: { home: null, away: null },
    bullpen: { home: null, away: null },
    venue: null,
    weather: null,
    completeness: 100,
    warnings: [],
    provenance,
    generatedAt: new Date(FROZEN_SOURCE_TS),
  };
  return { ...base, ...overrides };
}

async function runHost(
  root: string,
  scheduleGame: MLBScheduleGame,
  researchSnapshot: MLBGameResearchSnapshot,
  now: Date,
  scheduleDates: readonly string[] = [now.toISOString().slice(0, 10)],
): Promise<MLBProspectiveHoldoutCaptureOrchestratorResult> {
  const deps: MLBProspectiveHoldoutCaptureDependencies = {
    repositoryRoot: root,
    provider: {
      fetchSchedule: vi.fn(async (date: string): Promise<MLBScheduleResult> => {
        const hasGame = scheduleDates.includes(date);
        return {
          games: hasGame ? [scheduleGame] : [],
          provenance: buildProvenance(now),
        } satisfies MLBScheduleResult;
      }),
      buildGameSnapshot: vi.fn(async (_game: MLBScheduleGame, _options: { season: number; includeWeather: boolean }): Promise<MLBGameResearchSnapshot> => researchSnapshot),
    },
    orchestrator: runProspectiveHoldoutCaptureOrchestrator,
    now: () => now,
  };
  return runProspectiveHoldoutCapture(scheduleGame.gamePk, deps);
}

async function persistValidEvidence(
  root: string,
  activation: MLBProspectiveHoldoutActivation,
  scheduleGame: MLBScheduleGame,
  snapshot: MLBCanonicalPregameSnapshot,
  now: Date,
  persistedAt?: Date,
): Promise<MLBProspectivePregameEvidenceReceipt> {
  const rawFeatureVectorResult = extractMLBLeakageSafeFeatureVector(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1, snapshot);
  if (!rawFeatureVectorResult.ok) {
    throw new Error(rawFeatureVectorResult.issues.map((issue) => `${issue.code}: ${issue.message}`).join('; '));
  }
  const projectedVectorResult = applyCandidate003ProspectiveFeatureCompatibility(rawFeatureVectorResult.value);
  if (!projectedVectorResult.ok) {
    throw new Error(projectedVectorResult.issues.map((issue) => `${issue.code}: ${issue.message}`).join('; '));
  }
  const prepared: MLBProspectivePregameEvidencePrepared = {
    contractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: activation.activationId,
    captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
    compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
    gameId: String(scheduleGame.gamePk),
    snapshotId: snapshot.snapshotId,
    officialDate: scheduleGame.officialDate,
    scheduledStartAt: scheduleGame.startTimeUtc.toISOString(),
    scientificCutoffAt: scientificCutoffAt(scheduleGame.startTimeUtc.toISOString()),
    actualDataCutoffAt: snapshot.dataCutoffAt,
    rawSnapshot: snapshot,
    rawFeatureVector: rawFeatureVectorResult.value,
    candidate003CompatibleFeatureVector: projectedVectorResult.value,
    t360Validation: {
      status: 'ACCEPTED' as const,
      actualDataCutoffAtLteScientificCutoff: true,
      sourceTimestampsProvenLteScientificCutoff: true,
    },
  };
  const persistenceResult = await persistProspectivePregameEvidence(root, prepared, () => persistedAt?.toISOString() ?? now.toISOString());
  if (!persistenceResult.ok) {
    throw new Error(persistenceResult.issues.map((issue) => `${issue.code}: ${issue.message}`).join('; '));
  }
  return persistenceResult.receipt;
}

async function persistValidBinding(
  root: string,
  activation: MLBProspectiveHoldoutActivation,
  scheduleGame: MLBScheduleGame,
  evidence: MLBProspectivePregameEvidence,
  evidenceReceipt: MLBProspectivePregameEvidenceReceipt,
  now: Date,
  persistedAt?: Date,
): Promise<MLBProspectiveHoldoutGameIdentityBindingReceipt> {
  const prepared = {
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
    protocolId: activation.protocolId,
    activationId: activation.activationId,
    authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1' as const,
    scheduleGame: {
      gamePk: scheduleGame.gamePk,
      officialDate: scheduleGame.officialDate,
      startTimeUtc: scheduleGame.startTimeUtc,
    },
    evidence,
    evidenceReceipt,
  };
  const bindingResult = await persistProspectiveHoldoutGameIdentityBinding(root, prepared, () => persistedAt?.toISOString() ?? now.toISOString());
  if (!bindingResult.ok) {
    throw new Error(bindingResult.issues.map((issue) => `${issue.code}: ${issue.message}`).join('; '));
  }
  return bindingResult.receipt;
}

async function writeCorruptEvidence(root: string): Promise<void> {
  const fakeHash = 'a'.repeat(64);
  const evidenceDir = resolveMLBProspectivePregameEvidenceStorePaths(root).evidenceDirectory;
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.writeFile(path.join(evidenceDir, `${fakeHash}.json`), '{invalid json');
}

async function writeCorruptBinding(root: string): Promise<void> {
  const fakeHash = 'b'.repeat(64);
  const bindingDir = resolveMLBProspectiveHoldoutGameIdentityBindingStorePaths(root).bindingDirectory;
  await fs.mkdir(bindingDir, { recursive: true });
  await fs.writeFile(path.join(bindingDir, `${fakeHash}.json`), '{invalid json');
}

async function countJsonFiles(dir: string): Promise<number> {
  let count = 0;
  try {
    const entries = await fs.readdir(dir);
    for (const entry of entries) {
      if (entry.endsWith('.json')) count++;
    }
  } catch {
    // dir may not exist
  }
  return count;
}

async function countEvidenceFiles(root: string): Promise<number> {
  return countJsonFiles(resolveMLBProspectivePregameEvidenceStorePaths(root).evidenceDirectory);
}

async function countBindingFiles(root: string): Promise<number> {
  return countJsonFiles(resolveMLBProspectiveHoldoutGameIdentityBindingStorePaths(root).bindingDirectory);
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function scientificCutoffAt(startTimeUtc: string): string {
  const result = computeScientificCutoffAt(startTimeUtc);
  if (!result.ok) {
    throw new Error(result.failureCode);
  }
  return result.scientificCutoffAt;
}

/* -------------------------------------------------------------------------- */
/*  Scenario runners                                                          */
/* -------------------------------------------------------------------------- */

async function assertCleanCapture(root: string, now: Date): Promise<void> {
  const activationReceipt = await createActivation(root);
  const scheduleGame = buildScheduleGame();
  const result = await runHost(root, scheduleGame, buildResearchSnapshot(scheduleGame), now);
  expect(result.kind).toBe('CAPTURED_AND_BOUND');
  expect(await countEvidenceFiles(root)).toBe(1);
  expect(await countBindingFiles(root)).toBe(1);
  if (result.kind === 'CAPTURED_AND_BOUND') {
    const evidenceRead = await readProspectivePregameEvidence(root, result.evidenceArtifactId);
    if (!evidenceRead.ok) {
      throw new Error('evidence read failed');
    }
    expect(evidenceRead.value.activationId).toBe(activationReceipt.activationId);
    const bindingRead = await readProspectiveHoldoutGameIdentityBinding(root, result.bindingId);
    if (!bindingRead.ok) {
      throw new Error('binding read failed');
    }
    expect(bindingRead.value.evidenceArtifactId).toBe(result.evidenceArtifactId);
  }
}

async function assertExactT360(root: string, now: Date): Promise<CapturedAndBoundResult> {
  await createActivation(root);
  const scheduleGame = buildScheduleGame();
  const result = await runHost(root, scheduleGame, buildResearchSnapshot(scheduleGame), now);
  if (result.kind !== 'CAPTURED_AND_BOUND') {
    throw new Error(`expected CAPTURED_AND_BOUND, got ${result.kind}`);
  }
  expect(await countEvidenceFiles(root)).toBe(1);
  expect(await countBindingFiles(root)).toBe(1);
  return result;
}

async function assertAfterT360(root: string, now: Date): Promise<CaptureRejectedResult> {
  await createActivation(root);
  const scheduleGame = buildScheduleGame();
  const result = await runHost(root, scheduleGame, buildResearchSnapshot(scheduleGame), now);
  if (result.kind !== 'CAPTURE_REJECTED') {
    throw new Error(`expected CAPTURE_REJECTED, got ${result.kind}`);
  }
  expect(result.failureCode).toBe('CAPTURE_STARTED_AFTER_SCIENTIFIC_CUTOFF');
  expect(await countEvidenceFiles(root)).toBe(0);
  expect(await countBindingFiles(root)).toBe(0);
  return result;
}

async function assertExactDataCutoff(root: string, now: Date): Promise<CapturedAndBoundResult> {
  await createActivation(root);
  const scheduleGame = buildScheduleGame();
  const researchSnapshot = buildResearchSnapshot(scheduleGame, [
    buildProvenance(new Date('2026-08-15T06:00:00.000Z')),
  ]);
  const result = await runHost(root, scheduleGame, researchSnapshot, now);
  if (result.kind !== 'CAPTURED_AND_BOUND') {
    throw new Error(`expected CAPTURED_AND_BOUND, got ${result.kind}`);
  }
  expect(result.actualDataCutoffAt).toBe(result.scientificCutoffAt);
  expect(await countEvidenceFiles(root)).toBe(1);
  expect(await countBindingFiles(root)).toBe(1);
  return result;
}

async function assertAfterDataCutoff(root: string, now: Date): Promise<CaptureRejectedResult> {
  await createActivation(root);
  const scheduleGame = buildScheduleGame();
  const researchSnapshot = buildResearchSnapshot(scheduleGame, [
    buildProvenance(new Date('2026-08-15T06:00:00.001Z')),
  ]);
  const result = await runHost(root, scheduleGame, researchSnapshot, now);
  if (result.kind !== 'CAPTURE_REJECTED') {
    throw new Error(`expected CAPTURE_REJECTED, got ${result.kind}`);
  }
  expect(result.failureCode).toBe('ACTUAL_DATA_CUTOFF_AFTER_SCIENTIFIC_CUTOFF');
  expect(await countEvidenceFiles(root)).toBe(0);
  expect(await countBindingFiles(root)).toBe(0);
  return result;
}

async function assertExactSourceTimestamp(root: string, now: Date): Promise<CapturedAndBoundResult> {
  await createActivation(root);
  const scheduleGame = buildScheduleGame();
  const researchSnapshot = buildResearchSnapshot(scheduleGame, [
    buildProvenance(new Date('2026-08-15T04:00:00.000Z'), new Date('2026-08-15T06:00:00.000Z')),
  ]);
  const result = await runHost(root, scheduleGame, researchSnapshot, now);
  if (result.kind !== 'CAPTURED_AND_BOUND') {
    throw new Error(`expected CAPTURED_AND_BOUND, got ${result.kind}`);
  }
  return result;
}

async function assertAfterSourceTimestamp(root: string, now: Date): Promise<CaptureRejectedResult> {
  await createActivation(root);
  const scheduleGame = buildScheduleGame();
  const researchSnapshot = buildResearchSnapshot(scheduleGame, [
    buildProvenance(new Date('2026-08-15T04:00:00.000Z'), new Date('2026-08-15T06:00:00.001Z')),
  ]);
  const result = await runHost(root, scheduleGame, researchSnapshot, now);
  if (result.kind !== 'CAPTURE_REJECTED') {
    throw new Error(`expected CAPTURE_REJECTED, got ${result.kind}`);
  }
  expect(result.failureCode).toBe('MODEL_SOURCE_TIMESTAMP_AFTER_SCIENTIFIC_CUTOFF');
  expect(await countEvidenceFiles(root)).toBe(0);
  expect(await countBindingFiles(root)).toBe(0);
  return result;
}

async function assertActivationAbsent(root: string, now: Date): Promise<void> {
  const scheduleGame = buildScheduleGame();
  const result = await runHost(root, scheduleGame, buildResearchSnapshot(scheduleGame), now);
  expect(result.kind).toBe('ACTIVATION_UNAVAILABLE');
  expect(await countEvidenceFiles(root)).toBe(0);
  expect(await countBindingFiles(root)).toBe(0);
}

async function assertIdempotentRerun(root: string, now: Date): Promise<void> {
  const activationReceipt = await createActivation(root);
  const scheduleGame = buildScheduleGame();
  const researchSnapshot = buildResearchSnapshot(scheduleGame);
  const first = await runHost(root, scheduleGame, researchSnapshot, now);
  expect(first.kind).toBe('CAPTURED_AND_BOUND');
  if (first.kind !== 'CAPTURED_AND_BOUND') {
    throw new Error(`expected CAPTURED_AND_BOUND, got ${first.kind}`);
  }
  const firstBound = first;
  expect(await countEvidenceFiles(root)).toBe(1);
  expect(await countBindingFiles(root)).toBe(1);
  const second = await runHost(root, scheduleGame, researchSnapshot, now);
  expect(second.kind).toBe('ALREADY_COMPLETE');
  if (second.kind === 'ALREADY_COMPLETE') {
    expect(second.evidenceArtifactId).toBe(firstBound.evidenceArtifactId);
    expect(second.bindingId).toBe(firstBound.bindingId);
  }
  expect(await countEvidenceFiles(root)).toBe(1);
  expect(await countBindingFiles(root)).toBe(1);
}

async function assertOrphanRecovery(root: string, now: Date): Promise<void> {
  const activationReceipt = await createActivation(root);
  const scheduleGame = buildScheduleGame();
  const bridgeResult = await buildMLBRealDataPregameSnapshot({
    scheduleGame,
    researchSnapshot: buildResearchSnapshot(scheduleGame),
  });
  expect(bridgeResult.ok).toBe(true);
  if (!bridgeResult.ok) {
    throw new Error('bridge failed');
  }
  const snapshot = bridgeResult.value;
  const orphanReceipt = await persistValidEvidence(root, buildProposedActivation(activationReceipt.activationId), scheduleGame, snapshot, now);
  expect(await countEvidenceFiles(root)).toBe(1);
  expect(await countBindingFiles(root)).toBe(0);
  const result = await runHost(root, scheduleGame, buildResearchSnapshot(scheduleGame), now);
  expect(result.kind).toBe('RECOVERED_BINDING_FROM_ORPHAN_H');
  if (result.kind === 'RECOVERED_BINDING_FROM_ORPHAN_H') {
    expect(result.evidenceArtifactId).toBe(orphanReceipt.artifactId);
    const bindingRead = await readProspectiveHoldoutGameIdentityBinding(root, result.bindingId);
    if (!bindingRead.ok) {
      throw new Error('binding read failed');
    }
    expect(bindingRead.value.evidenceArtifactId).toBe(orphanReceipt.artifactId);
  }
  expect(await countEvidenceFiles(root)).toBe(1);
  expect(await countBindingFiles(root)).toBe(1);
}

async function assertOrphanScheduleDrift(root: string, now: Date): Promise<void> {
  const activationReceipt = await createActivation(root);
  const oldScheduleGame = buildScheduleGame({
    officialDate: '2026-08-14',
    startTimeUtc: new Date('2026-08-14T12:00:00.000Z'),
  });
  const oldBridgeResult = await buildMLBRealDataPregameSnapshot({
    scheduleGame: oldScheduleGame,
    researchSnapshot: buildResearchSnapshot(oldScheduleGame, [buildProvenance(new Date('2026-08-14T05:59:59.000Z'))]),
  });
  expect(oldBridgeResult.ok).toBe(true);
  if (!oldBridgeResult.ok) {
    throw new Error('old bridge failed');
  }
  const oldSnapshot = oldBridgeResult.value;
  const oldPersistedAt = new Date('2026-08-14T11:59:59.000Z');
  await persistValidEvidence(root, buildProposedActivation(activationReceipt.activationId), oldScheduleGame, oldSnapshot, now, oldPersistedAt);
  expect(await countEvidenceFiles(root)).toBe(1);
  expect(await countBindingFiles(root)).toBe(0);
  const currentScheduleGame = buildScheduleGame();
  const result = await runHost(root, currentScheduleGame, buildResearchSnapshot(currentScheduleGame), now);
  expect(result.kind).toBe('SCHEDULE_DRIFT_INELIGIBLE');
  expect(await countEvidenceFiles(root)).toBe(1);
  expect(await countBindingFiles(root)).toBe(0);
}

async function assertCompletePairScheduleDrift(root: string, now: Date): Promise<void> {
  const activationReceipt = await createActivation(root);
  const oldScheduleGame = buildScheduleGame({
    officialDate: '2026-08-14',
    startTimeUtc: new Date('2026-08-14T12:00:00.000Z'),
  });
  const oldBridgeResult = await buildMLBRealDataPregameSnapshot({
    scheduleGame: oldScheduleGame,
    researchSnapshot: buildResearchSnapshot(oldScheduleGame, [buildProvenance(new Date('2026-08-14T05:59:59.000Z'))]),
  });
  expect(oldBridgeResult.ok).toBe(true);
  if (!oldBridgeResult.ok) {
    throw new Error('old bridge failed');
  }
  const oldSnapshot = oldBridgeResult.value;
  const oldReceipt = await persistValidEvidence(root, buildProposedActivation(activationReceipt.activationId), oldScheduleGame, oldSnapshot, now, new Date('2026-08-14T11:59:59.000Z'));
  const oldEvidenceResult = await readProspectivePregameEvidence(root, oldReceipt.artifactId);
  if (!oldEvidenceResult.ok) {
    throw new Error('old evidence read failed');
  }
  const oldEvidence = oldEvidenceResult.value;
  await persistValidBinding(root, buildProposedActivation(activationReceipt.activationId), oldScheduleGame, oldEvidence, oldReceipt, now, new Date('2026-08-14T11:59:59.000Z'));
  expect(await countEvidenceFiles(root)).toBe(1);
  expect(await countBindingFiles(root)).toBe(1);
  const currentScheduleGame = buildScheduleGame();
  const result = await runHost(root, currentScheduleGame, buildResearchSnapshot(currentScheduleGame), now);
  expect(result.kind).toBe('SCHEDULE_DRIFT_INELIGIBLE');
  expect(await countEvidenceFiles(root)).toBe(1);
  expect(await countBindingFiles(root)).toBe(1);
}

async function assertJCorruptHBlock(root: string, now: Date): Promise<void> {
  await createActivation(root);
  await writeCorruptEvidence(root);
  const scheduleGame = buildScheduleGame();
  const result = await runHost(root, scheduleGame, buildResearchSnapshot(scheduleGame), now);
  expect(result.kind).toBe('INTEGRITY_FAILURE');
  if (result.kind !== 'INTEGRITY_FAILURE') {
    throw new Error(`expected INTEGRITY_FAILURE, got ${result.kind}`);
  }
  expect(result.issues.some((issue: string) => issue.includes('EVIDENCE_JSON_INVALID'))).toBe(true);
  expect(await countEvidenceFiles(root)).toBe(1);
  expect(await countBindingFiles(root)).toBe(0);
}

async function assertKCorruptBindingBlock(root: string, now: Date): Promise<void> {
  await createActivation(root);
  const scheduleGame = buildScheduleGame();
  const bridgeResult = await buildMLBRealDataPregameSnapshot({
    scheduleGame,
    researchSnapshot: buildResearchSnapshot(scheduleGame),
  });
  expect(bridgeResult.ok).toBe(true);
  if (!bridgeResult.ok) {
    throw new Error('bridge failed');
  }
  const snapshot = bridgeResult.value;
  const evidenceReceipt = await persistValidEvidence(root, buildProposedActivation(`activation-${GAME_PK}`), scheduleGame, snapshot, now);
  await writeCorruptBinding(root);
  expect(await countEvidenceFiles(root)).toBe(1);
  expect(await countBindingFiles(root)).toBe(1);
  const result = await runHost(root, scheduleGame, buildResearchSnapshot(scheduleGame), now);
  expect(result.kind).toBe('INTEGRITY_FAILURE');
  if (result.kind !== 'INTEGRITY_FAILURE') {
    throw new Error(`expected INTEGRITY_FAILURE, got ${result.kind}`);
  }
  expect(result.issues.some((issue: string) => issue.includes('BINDING_JSON_INVALID'))).toBe(true);
}

async function assertMultipleOrphans(root: string, now: Date): Promise<void> {
  await createActivation(root);
  const scheduleGame = buildScheduleGame();
  const bridgeResult = await buildMLBRealDataPregameSnapshot({
    scheduleGame,
    researchSnapshot: buildResearchSnapshot(scheduleGame),
  });
  expect(bridgeResult.ok).toBe(true);
  if (!bridgeResult.ok) {
    throw new Error('bridge failed');
  }
  const snapshot = bridgeResult.value;
  const researchSnapshot2 = buildResearchSnapshot(scheduleGame, [buildProvenance(new Date('2026-08-15T04:00:01.000Z'))]);
  const bridge2 = await buildMLBRealDataPregameSnapshot({
    scheduleGame,
    researchSnapshot: researchSnapshot2,
  });
  expect(bridge2.ok).toBe(true);
  if (!bridge2.ok) {
    throw new Error('bridge2 failed');
  }
  const snapshot2 = bridge2.value;
  const researchSnapshot3 = buildResearchSnapshot(scheduleGame, [buildProvenance(new Date('2026-08-15T04:00:02.000Z'))]);
  const bridge3 = await buildMLBRealDataPregameSnapshot({
    scheduleGame,
    researchSnapshot: researchSnapshot3,
  });
  expect(bridge3.ok).toBe(true);
  if (!bridge3.ok) {
    throw new Error('bridge3 failed');
  }
  const snapshot3 = bridge3.value;
  await persistValidEvidence(root, buildProposedActivation(`activation-${GAME_PK}`), scheduleGame, snapshot2, now);
  await persistValidEvidence(root, buildProposedActivation(`activation-${GAME_PK}`), scheduleGame, snapshot3, now);
  expect(await countEvidenceFiles(root)).toBe(2);
  expect(await countBindingFiles(root)).toBe(0);
  const result = await runHost(root, scheduleGame, researchSnapshot2, now);
  expect(result.kind).toBe('ORPHAN_MULTIPLICITY_INELIGIBLE');
}

async function assertMultipleCompletePairs(root: string, now: Date): Promise<void> {
  await createActivation(root);
  const scheduleGame = buildScheduleGame();
  const bridgeResult = await buildMLBRealDataPregameSnapshot({
    scheduleGame,
    researchSnapshot: buildResearchSnapshot(scheduleGame),
  });
  expect(bridgeResult.ok).toBe(true);
  if (!bridgeResult.ok) {
    throw new Error('bridge failed');
  }
  const snapshot = bridgeResult.value;
  const receipt1 = await persistValidEvidence(root, buildProposedActivation(`activation-${GAME_PK}`), scheduleGame, snapshot, now);
  const evidence1Result = await readProspectivePregameEvidence(root, receipt1.artifactId);
  if (!evidence1Result.ok) {
    throw new Error('evidence1 read failed');
  }
  const evidence1 = evidence1Result.value;
  await persistValidBinding(root, buildProposedActivation(`activation-${GAME_PK}`), scheduleGame, evidence1, receipt1, now);
  const researchSnapshot2 = buildResearchSnapshot(scheduleGame, [buildProvenance(new Date('2026-08-15T04:00:01.000Z'))]);
  const bridge2 = await buildMLBRealDataPregameSnapshot({
    scheduleGame,
    researchSnapshot: researchSnapshot2,
  });
  expect(bridge2.ok).toBe(true);
  if (!bridge2.ok) {
    throw new Error('bridge2 failed');
  }
  const snapshot2 = bridge2.value;
  const receipt2 = await persistValidEvidence(root, buildProposedActivation(`activation-${GAME_PK}`), scheduleGame, snapshot2, now);
  const evidence2Result = await readProspectivePregameEvidence(root, receipt2.artifactId);
  if (!evidence2Result.ok) {
    throw new Error('evidence2 read failed');
  }
  const evidence2 = evidence2Result.value;
  await persistValidBinding(root, buildProposedActivation(`activation-${GAME_PK}`), scheduleGame, evidence2, receipt2, now);
  expect(await countEvidenceFiles(root)).toBe(2);
  expect(await countBindingFiles(root)).toBe(2);
  const result = await runHost(root, scheduleGame, researchSnapshot2, now);
  expect(result.kind).toBe('RESCHEDULE_CONFLICT_INELIGIBLE');
}

async function assertCompletePairPlusOrphan(root: string, now: Date): Promise<void> {
  await createActivation(root);
  const scheduleGame = buildScheduleGame();
  const bridgeResult = await buildMLBRealDataPregameSnapshot({
    scheduleGame,
    researchSnapshot: buildResearchSnapshot(scheduleGame),
  });
  expect(bridgeResult.ok).toBe(true);
  if (!bridgeResult.ok) {
    throw new Error('bridge failed');
  }
  const snapshot = bridgeResult.value;
  const receipt1 = await persistValidEvidence(root, buildProposedActivation(`activation-${GAME_PK}`), scheduleGame, snapshot, now);
  const evidence1Result = await readProspectivePregameEvidence(root, receipt1.artifactId);
  if (!evidence1Result.ok) {
    throw new Error('evidence1 read failed');
  }
  const evidence1 = evidence1Result.value;
  await persistValidBinding(root, buildProposedActivation(`activation-${GAME_PK}`), scheduleGame, evidence1, receipt1, now);
  const researchSnapshot2 = buildResearchSnapshot(scheduleGame, [buildProvenance(new Date('2026-08-15T04:00:01.000Z'))]);
  const bridge2 = await buildMLBRealDataPregameSnapshot({
    scheduleGame,
    researchSnapshot: researchSnapshot2,
  });
  expect(bridge2.ok).toBe(true);
  if (!bridge2.ok) {
    throw new Error('bridge2 failed');
  }
  const snapshot2 = bridge2.value;
  await persistValidEvidence(root, buildProposedActivation(`activation-${GAME_PK}`), scheduleGame, snapshot2, now);
  expect(await countEvidenceFiles(root)).toBe(2);
  expect(await countBindingFiles(root)).toBe(1);
  const result = await runHost(root, scheduleGame, researchSnapshot2, now);
  expect(result.kind).toBe('CAPTURE_LINEAGE_MULTIPLICITY_INELIGIBLE');
}

async function assertForeignActivationIsolation(root: string, now: Date): Promise<void> {
  const activationReceipt = await createActivation(root);
  const scheduleGame = buildScheduleGame();
  const bridgeResult = await buildMLBRealDataPregameSnapshot({
    scheduleGame,
    researchSnapshot: buildResearchSnapshot(scheduleGame),
  });
  expect(bridgeResult.ok).toBe(true);
  if (!bridgeResult.ok) {
    throw new Error('bridge failed');
  }
  const snapshot = bridgeResult.value;
  const foreignActivation = buildProposedActivation('foreign-activation');
  const foreignEvidenceReceipt = await persistValidEvidence(root, foreignActivation, scheduleGame, snapshot, now);
  const foreignEvidenceResult = await readProspectivePregameEvidence(root, foreignEvidenceReceipt.artifactId);
  if (!foreignEvidenceResult.ok) {
    throw new Error('foreign evidence read failed');
  }
  const foreignEvidence = foreignEvidenceResult.value;
  await persistValidBinding(root, foreignActivation, scheduleGame, foreignEvidence, foreignEvidenceReceipt, now);
  expect(await countEvidenceFiles(root)).toBe(1);
  expect(await countBindingFiles(root)).toBe(1);
  const result = await runHost(root, scheduleGame, buildResearchSnapshot(scheduleGame), now);
  expect(result.kind).toBe('CAPTURED_AND_BOUND');
  if (result.kind === 'CAPTURED_AND_BOUND') {
    expect(result.evidenceArtifactId).not.toBe(foreignEvidenceReceipt.artifactId);
  }
  expect(await countEvidenceFiles(root)).toBe(2);
  expect(await countBindingFiles(root)).toBe(2);
  const activationResult = await readMLBProspectiveHoldoutActivation(root);
  expect(activationResult.ok).toBe(true);
  if (activationResult.ok) {
    const discovery = await discoverMLBProspectiveHoldoutArtifacts(root, activationResult.value);
    expect(discovery.ok).toBe(true);
    if (discovery.ok) {
      expect(discovery.foreignArtifactSummary.foreignEvidenceCount).toBe(1);
      expect(discovery.foreignArtifactSummary.foreignBindingCount).toBe(1);
    }
  }
}

async function assertUtcRollover(root: string, now: Date): Promise<void> {
  const activationReceipt = await createActivation(root);
  const scheduleGame = buildScheduleGame();
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayDate = yesterday.toISOString().slice(0, 10);
  const result = await runHost(root, scheduleGame, buildResearchSnapshot(scheduleGame), now, [yesterdayDate]);
  expect(result.kind).toBe('CAPTURE_REJECTED');
  if (result.kind === 'CAPTURE_REJECTED') {
    expect(result.failureCode).toBe('CAPTURE_STARTED_AFTER_SCIENTIFIC_CUTOFF');
  }
  expect(await countEvidenceFiles(root)).toBe(0);
  expect(await countBindingFiles(root)).toBe(0);
}

async function assertUnrelatedScheduleGames(root: string, now: Date): Promise<void> {
  const activationReceipt = await createActivation(root);
  const targetSchedule = buildScheduleGame();
  const unrelated1 = buildScheduleGame({ gamePk: GAME_PK + 1, gameNumber: 1 });
  const unrelated2 = buildScheduleGame({ gamePk: GAME_PK + 2, gameNumber: 1 });
  const targetResearch = buildResearchSnapshot(targetSchedule);
  const unrelatedResearch = buildResearchSnapshot(unrelated1);
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yDate = yesterday.toISOString().slice(0, 10);
  const deps: MLBProspectiveHoldoutCaptureDependencies = {
    repositoryRoot: root,
    provider: {
      fetchSchedule: vi.fn().mockImplementation(async (date: string) => {
        if (date === today) {
          return { games: [unrelated1, unrelated2], provenance: buildProvenance(now) } satisfies MLBScheduleResult;
        }
        if (date === yDate) {
          return { games: [targetSchedule], provenance: buildProvenance(now) } satisfies MLBScheduleResult;
        }
        return { games: [], provenance: buildProvenance(now) } satisfies MLBScheduleResult;
      }),
      buildGameSnapshot: vi.fn().mockImplementation(async (game: MLBScheduleGame) => {
        if (game.gamePk === targetSchedule.gamePk) return targetResearch;
        return unrelatedResearch;
      }),
    },
    orchestrator: runProspectiveHoldoutCaptureOrchestrator,
    now: () => now,
  };
  const result = await runProspectiveHoldoutCapture(GAME_PK, deps);
  expect(result.kind).toBe('CAPTURED_AND_BOUND');
  expect(await countEvidenceFiles(root)).toBe(1);
  expect(await countBindingFiles(root)).toBe(1);
}

async function assertDuplicateScheduleFailClosed(root: string, now: Date): Promise<void> {
  const scheduleGame = buildScheduleGame();
  const deps: MLBProspectiveHoldoutCaptureDependencies = {
    repositoryRoot: root,
    provider: {
      fetchSchedule: vi.fn().mockImplementation(async () => {
        return { games: [scheduleGame], provenance: buildProvenance(now) } satisfies MLBScheduleResult;
      }),
      buildGameSnapshot: vi.fn().mockResolvedValue(buildResearchSnapshot(scheduleGame)),
    },
    orchestrator: runProspectiveHoldoutCaptureOrchestrator,
    now: () => now,
  };
  await expect(runProspectiveHoldoutCapture(GAME_PK, deps)).rejects.toThrow(`Schedule game ${GAME_PK} is not unique`);
  expect(await countEvidenceFiles(root)).toBe(0);
  expect(await countBindingFiles(root)).toBe(0);
}

async function assertProviderFailureFailClosed(root: string, now: Date): Promise<void> {
  const deps: MLBProspectiveHoldoutCaptureDependencies = {
    repositoryRoot: root,
    provider: {
      fetchSchedule: vi.fn().mockRejectedValue(new Error('provider down')),
      buildGameSnapshot: vi.fn().mockResolvedValue(buildResearchSnapshot(buildScheduleGame())),
    },
    orchestrator: runProspectiveHoldoutCaptureOrchestrator,
    now: () => now,
  };
  await expect(runProspectiveHoldoutCapture(GAME_PK, deps)).rejects.toThrow('provider down');
  expect(await countEvidenceFiles(root)).toBe(0);
  expect(await countBindingFiles(root)).toBe(0);
}

async function assertSnapshotFailureFailClosed(root: string, now: Date): Promise<void> {
  await createActivation(root);
  const scheduleGame = buildScheduleGame();
  const today = now.toISOString().slice(0, 10);
  const deps: MLBProspectiveHoldoutCaptureDependencies = {
    repositoryRoot: root,
    provider: {
      fetchSchedule: vi.fn().mockImplementation(async (date: string) => {
        if (date === today) {
          return { games: [scheduleGame], provenance: buildProvenance(now) } satisfies MLBScheduleResult;
        }
        return { games: [], provenance: buildProvenance(now) } satisfies MLBScheduleResult;
      }),
      buildGameSnapshot: vi.fn().mockRejectedValue(new Error('snapshot down')),
    },
    orchestrator: runProspectiveHoldoutCaptureOrchestrator,
    now: () => now,
  };
  await expect(runProspectiveHoldoutCapture(GAME_PK, deps)).rejects.toThrow('snapshot down');
  expect(await countEvidenceFiles(root)).toBe(0);
  expect(await countBindingFiles(root)).toBe(0);
}

/* -------------------------------------------------------------------------- */
/*  Matrix                                                                    */
/* -------------------------------------------------------------------------- */

describe('production integration matrix', () => {
  let root: string;

  beforeEach(async () => {
    root = await createTempRoot('mlb-i3gk3-');
  });

  afterEach(async () => {
    try {
      await fs.rm(root, { recursive: true, force: true });
    } catch {
      // ignore cleanup failure
    }
  });

  it('A clean capture', async () => {
    const now = new Date('2026-08-15T05:00:00.000Z');
    await assertCleanCapture(root, now);
  });

  it('B before T360', async () => {
    const now = new Date('2026-08-15T05:59:59.999Z');
    const result = await assertExactT360(root, now);
    expect(now.getTime()).toBeLessThan(new Date(result.scientificCutoffAt).getTime());
  });

  it('B exact T360', async () => {
    const now = new Date('2026-08-15T06:00:00.000Z');
    const result = await assertExactT360(root, now);
    expect(now.getTime()).toBe(new Date(result.scientificCutoffAt).getTime());
  });

  it('B after T360', async () => {
    const now = new Date('2026-08-15T06:00:00.001Z');
    const result = await assertAfterT360(root, now);
    expect(result.failureCode).toBe('CAPTURE_STARTED_AFTER_SCIENTIFIC_CUTOFF');
    expect(now.getTime() - new Date('2026-08-15T06:00:00.000Z').getTime()).toBe(1);
  });

  it('C actual data cutoff exact', async () => {
    const now = new Date('2026-08-15T06:00:00.000Z');
    const result = await assertExactDataCutoff(root, now);
    expect(result.actualDataCutoffAt).toBe(result.scientificCutoffAt);
    expect(now.getTime()).toBeLessThanOrEqual(new Date(result.scientificCutoffAt).getTime());
  });

  it('C actual data cutoff after', async () => {
    const now = new Date('2026-08-15T05:00:00.000Z');
    const result = await assertAfterDataCutoff(root, now);
    expect(result.failureCode).toBe('ACTUAL_DATA_CUTOFF_AFTER_SCIENTIFIC_CUTOFF');
  });

  it('D source timestamp exact', async () => {
    const now = new Date('2026-08-15T05:00:00.000Z');
    const result = await assertExactSourceTimestamp(root, now);
  });

  it('D source timestamp after', async () => {
    const now = new Date('2026-08-15T05:00:00.000Z');
    const result = await assertAfterSourceTimestamp(root, now);
    expect(result.failureCode).toBe('MODEL_SOURCE_TIMESTAMP_AFTER_SCIENTIFIC_CUTOFF');
  });

  it('E activation absent', async () => {
    const now = new Date('2026-08-15T05:00:00.000Z');
    await assertActivationAbsent(root, now);
  });

  it('F idempotent rerun', async () => {
    const now = new Date('2026-08-15T05:00:00.000Z');
    await assertIdempotentRerun(root, now);
  });

  it('G orphan recovery', async () => {
    const now = new Date('2026-08-15T05:00:00.000Z');
    await assertOrphanRecovery(root, now);
  });

  it('H orphan schedule drift', async () => {
    const now = new Date('2026-08-15T05:00:00.000Z');
    await assertOrphanScheduleDrift(root, now);
  });

  it('I complete pair schedule drift', async () => {
    const now = new Date('2026-08-15T05:00:00.000Z');
    await assertCompletePairScheduleDrift(root, now);
  });

  it('J corrupt H block', async () => {
    const now = new Date('2026-08-15T05:00:00.000Z');
    await assertJCorruptHBlock(root, now);
  });

  it('K corrupt binding block', async () => {
    const now = new Date('2026-08-15T05:00:00.000Z');
    await assertKCorruptBindingBlock(root, now);
  });

  it('L multiple orphans fail closed', async () => {
    const now = new Date('2026-08-15T05:00:00.000Z');
    await assertMultipleOrphans(root, now);
  });

  it('L multiple complete pairs fail closed', async () => {
    const now = new Date('2026-08-15T05:00:00.000Z');
    await assertMultipleCompletePairs(root, now);
  });

  it('L complete pair plus extra orphan fail closed', async () => {
    const now = new Date('2026-08-15T05:00:00.000Z');
    await assertCompletePairPlusOrphan(root, now);
  });

  it('M foreign activation isolation', async () => {
    const now = new Date('2026-08-15T05:00:00.000Z');
    await assertForeignActivationIsolation(root, now);
  });

  it('N UTC rollover reaches K1', async () => {
    const now = new Date('2026-08-16T00:01:00.000Z');
    await assertUtcRollover(root, now);
  });

  it('O unrelated schedule games single-game guarantee', async () => {
    const now = new Date('2026-08-15T05:00:00.000Z');
    await assertUnrelatedScheduleGames(root, now);
  });

  it('P duplicate schedule fail closed', async () => {
    const now = new Date('2026-08-15T05:00:00.000Z');
    await assertDuplicateScheduleFailClosed(root, now);
  });

  it('Q provider schedule failure fail closed', async () => {
    const now = new Date('2026-08-15T05:00:00.000Z');
    await assertProviderFailureFailClosed(root, now);
  });

  it('Q provider snapshot failure fail closed', async () => {
    const now = new Date('2026-08-15T05:00:00.000Z');
    await assertSnapshotFailureFailClosed(root, now);
  });

  it('T no public clock override', async () => {
    const k2Source = await fs.readFile(path.resolve(process.cwd(), 'scripts/mlb-prospective-holdout-capture.ts'), 'utf-8');
    expect(k2Source).not.toMatch(/process\.env\./);
    expect(k2Source).not.toMatch(/override/i);
    expect(k2Source).not.toMatch(/--force-refresh/);
    expect(k2Source).not.toMatch(/--clock/);
    expect(k2Source).not.toMatch(/--scientific-cutoff/);
    expect(k2Source).not.toMatch(/--persisted-at/);
  });

  it('U odds/result/model firewall', async () => {
    const k2Source = await fs.readFile(path.resolve(process.cwd(), 'scripts/mlb-prospective-holdout-capture.ts'), 'utf-8');
    const k1Source = await fs.readFile(path.resolve(process.cwd(), 'src/prediction/mlb/mlb-prospective-holdout-capture-orchestrator.ts'), 'utf-8');
    const bridgeSource = await fs.readFile(path.resolve(process.cwd(), 'src/prediction/mlb/mlb-real-data-pregame-snapshot-bridge.ts'), 'utf-8');
    const combined = `${k2Source}\n${k1Source}\n${bridgeSource}`;
    expect(combined).not.toMatch(/sportsbook|moneyline|bettingOdds|oddsInput|marketPrice|impliedProbability|pointSpread|runModelInference|modelPrediction|predictedWinner|winnerLabel|finalScore|postGameResult|homeFinalScore|awayFinalScore/i);
  });

  it('V deterministic repetition', async () => {
    const scenarios = [
      'clean',
      'exact_t360',
      'after_t360',
      'idempotent',
      'orphan_recovery',
      'schedule_drift',
      'j_block',
    ] as const;
    for (let r = 0; r < 10; r++) {
      for (const scenario of scenarios) {
        const scenarioRoot = await createTempRoot('mlb-i3gk3-repeat-');
        try {
          const now = new Date('2026-08-15T05:00:00.000Z');
          switch (scenario) {
            case 'clean':
              await assertCleanCapture(scenarioRoot, now);
              break;
            case 'exact_t360':
              await assertExactT360(scenarioRoot, new Date('2026-08-15T06:00:00.000Z'));
              break;
            case 'after_t360':
              await assertAfterT360(scenarioRoot, new Date('2026-08-15T06:00:00.001Z'));
              break;
            case 'idempotent':
              await assertIdempotentRerun(scenarioRoot, now);
              break;
            case 'orphan_recovery':
              await assertOrphanRecovery(scenarioRoot, now);
              break;
            case 'schedule_drift':
              await assertOrphanScheduleDrift(scenarioRoot, now);
              break;
            case 'j_block':
              await assertJCorruptHBlock(scenarioRoot, now);
              break;
          }
        } finally {
          await fs.rm(scenarioRoot, { recursive: true, force: true }).catch(() => {});
        }
      }
    }
  }, 60000);
});
