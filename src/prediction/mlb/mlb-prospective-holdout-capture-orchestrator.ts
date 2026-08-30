import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
  MLB_PROSPECTIVE_HOLDOUT_SCI_CUTOFF_MINUTES,
} from './mlb-prospective-holdout-protocol-contract';
import {
  MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
  MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
  computeScientificCutoffAt,
  runProspectiveT360Capture,
  type MLBProspectiveT360CaptureRequest,
  type MLBProspectiveT360CaptureResult,
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
  type MLBFeatureVector,
} from './mlb-feature-vector-contract';
import {
  applyCandidate003ProspectiveFeatureCompatibility,
} from './mlb-candidate-003-prospective-feature-compatibility';
import {
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
  type MLBProspectivePregameEvidencePrepared,
  type MLBProspectivePregameEvidence,
  type MLBProspectivePregameEvidenceReceipt,
  computeArtifactId,
  validateMLBProspectivePregameEvidencePrepared,
} from './mlb-prospective-pregame-evidence-artifact-contract';
import {
  persistProspectivePregameEvidence,
  readProspectivePregameEvidence,
} from './mlb-prospective-pregame-evidence-store';
import {
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
  type MLBProspectiveHoldoutGameIdentityBindingPrepared,
  type MLBProspectiveHoldoutGameIdentityBinding,
  type MLBProspectiveHoldoutGameIdentityBindingReceipt,
  computeBindingId,
  validateMLBProspectiveHoldoutGameIdentityBindingPrepared,
} from './mlb-prospective-holdout-game-identity-binding-contract';
import {
  persistProspectiveHoldoutGameIdentityBinding,
  readProspectiveHoldoutGameIdentityBinding,
} from './mlb-prospective-holdout-game-identity-binding-store';
import {
  readMLBProspectiveHoldoutActivation,
} from './mlb-prospective-holdout-activation-store';
import {
  MLBProspectiveHoldoutActivationPersisted,
} from './mlb-prospective-holdout-activation-contract';
import {
  discoverMLBProspectiveHoldoutArtifacts,
  type MLBProspectiveHoldoutArtifactDiscoveryResult,
  type MLBProspectiveHoldoutArtifactEvidenceRecord,
  type MLBProspectiveHoldoutArtifactRescheduleConflict,
} from './mlb-prospective-holdout-artifact-discovery';
import type { MLBScheduleGame } from '@/lib/research-data/types';

/* -------------------------------------------------------------------------- */
/*  Clock                                                                     */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveHoldoutCaptureClock = Readonly<{
  readonly now: () => Date;
}>;

/* -------------------------------------------------------------------------- */
/*  Snapshot builder                                                          */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveHoldoutCaptureSnapshotBuilder = (
  game: MLBScheduleGame,
) => MLBCanonicalPregameSnapshot;

/* -------------------------------------------------------------------------- */
/*  Result types                                                              */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveHoldoutCaptureOrchestratorSuccess =
  | Readonly<{
      kind: 'CAPTURED_AND_BOUND';
      activationId: string;
      protocolId: string;
      gamePk: number;
      gameId: string;
      evidenceArtifactId: string;
      bindingId: string;
      scientificCutoffAt: string;
      actualDataCutoffAt: string;
      persistedAt: string;
    }>
  | Readonly<{
      kind: 'RECOVERED_BINDING_FROM_ORPHAN_H';
      activationId: string;
      protocolId: string;
      gamePk: number;
      gameId: string;
      evidenceArtifactId: string;
      bindingId: string;
      scientificCutoffAt: string;
      persistedAt: string;
    }>
  | Readonly<{
      kind: 'ALREADY_COMPLETE';
      activationId: string;
      protocolId: string;
      gamePk: number;
      gameId: string;
      evidenceArtifactId: string;
      bindingId: string;
    }>;

export type MLBProspectiveHoldoutCaptureOrchestratorFailure =
  | Readonly<{
      kind: 'ACTIVATION_UNAVAILABLE';
      issues: readonly string[];
    }>
  | Readonly<{
      kind: 'ACTIVATION_NOT_FROZEN_BEFORE_CUTOFF';
      activationPersistedAt: string;
      scientificCutoffAt: string;
    }>
  | Readonly<{
      kind: 'CAPTURE_REJECTED';
      failureCode: string;
      message: string;
    }>
  | Readonly<{
      kind: 'SCHEDULE_DRIFT_INELIGIBLE';
      currentGameId: string;
      currentOfficialDate: string;
      currentScheduledStartAt: string;
    }>
  | Readonly<{
      kind: 'RESCHEDULE_CONFLICT_INELIGIBLE';
      activationId: string;
      protocolId: string;
      gamePk: number;
    }>
  | Readonly<{
      kind: 'ORPHAN_MULTIPLICITY_INELIGIBLE';
      gameId: string;
      orphanCount: number;
    }>
  | Readonly<{
      kind: 'CAPTURE_LINEAGE_MULTIPLICITY_INELIGIBLE';
      gamePk: number;
    }>
  | Readonly<{
      kind: 'BINDING_RECOVERY_REJECTED';
      failureCode: string;
      message: string;
    }>
  | Readonly<{
      kind: 'INTEGRITY_FAILURE';
      issues: readonly string[];
    }>;

export type MLBProspectiveHoldoutCaptureOrchestratorResult =
  | MLBProspectiveHoldoutCaptureOrchestratorSuccess
  | MLBProspectiveHoldoutCaptureOrchestratorFailure;

export type MLBProspectiveHoldoutCaptureOrchestratorInput = Readonly<{
  repositoryRoot: string;
  scheduleGame: MLBScheduleGame;
  clock: MLBProspectiveHoldoutCaptureClock;
  snapshotBuilder: MLBProspectiveHoldoutCaptureSnapshotBuilder;
}>;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function sortIssues(
  issues: string[],
): readonly string[] {
  return issues
    .slice()
    .sort()
    .filter(
      (item, index, array) =>
        index === 0 || item !== array[index - 1],
    );
}

function mapIssue(issue: { code: string; message: string }): string {
  return `${issue.code}: ${issue.message}`;
}

function isRescheduleConflictForGame(
  conflict: MLBProspectiveHoldoutArtifactRescheduleConflict,
  activationId: string,
  protocolId: string,
  gamePk: number,
): boolean {
  return (
    conflict.activationId === activationId &&
    conflict.protocolId === protocolId &&
    conflict.gamePk === gamePk
  );
}

function isCompletePairForGame(
  record: Readonly<{ binding: MLBProspectiveHoldoutGameIdentityBinding }>,
  gamePk: number,
): boolean {
  return record.binding.gamePk === gamePk;
}

function isActiveOrphanForGame(
  record: MLBProspectiveHoldoutArtifactEvidenceRecord,
  gameId: string,
): boolean {
  return record.evidence.gameId === gameId;
}

/* -------------------------------------------------------------------------- */
/*  Core orchestrator                                                         */
/* -------------------------------------------------------------------------- */

export async function runProspectiveHoldoutCaptureOrchestrator(
  input: MLBProspectiveHoldoutCaptureOrchestratorInput,
): Promise<MLBProspectiveHoldoutCaptureOrchestratorResult> {
  const { repositoryRoot, scheduleGame, clock, snapshotBuilder } = input;

  // 1. Derive current schedule identity
  const currentGameId = String(scheduleGame.gamePk);
  const currentOfficialDate = scheduleGame.officialDate;
  const currentScheduledStartAt = scheduleGame.startTimeUtc.toISOString();

  // 2. Read activation from store
  const activationResult = await readMLBProspectiveHoldoutActivation(repositoryRoot);
  if (!activationResult.ok) {
    return {
      kind: 'ACTIVATION_UNAVAILABLE',
      issues: activationResult.issues.map(mapIssue),
    };
  }
  const activation = activationResult.value;

  // 3. Compute scientific cutoff
  const cutoffResult = computeScientificCutoffAt(currentScheduledStartAt);
  if (!cutoffResult.ok) {
    return {
      kind: 'INTEGRITY_FAILURE',
      issues: [mapIssue({ code: 'CUTOFF_COMPUTATION_FAILED', message: cutoffResult.message })],
    };
  }
  const scientificCutoffAt = cutoffResult.scientificCutoffAt;

  // 4. Activation must be strictly before scientific cutoff
  if (activation.persistedAt >= scientificCutoffAt) {
    return {
      kind: 'ACTIVATION_NOT_FROZEN_BEFORE_CUTOFF',
      activationPersistedAt: activation.persistedAt,
      scientificCutoffAt,
    };
  }

  // 5. Run J discovery before any mutation
  const discoveryResult = await discoverMLBProspectiveHoldoutArtifacts(
    repositoryRoot,
    activation,
  );
  if (!discoveryResult.ok) {
    return {
      kind: 'INTEGRITY_FAILURE',
      issues: discoveryResult.issues.map(mapIssue),
    };
  }

  // 6. Check reschedule conflicts for current game
  const currentConflict = discoveryResult.rescheduleConflicts.find((conflict) =>
    isRescheduleConflictForGame(conflict, activation.activationId, activation.protocolId, scheduleGame.gamePk),
  );
  if (currentConflict) {
    return {
      kind: 'RESCHEDULE_CONFLICT_INELIGIBLE',
      activationId: activation.activationId,
      protocolId: activation.protocolId,
      gamePk: scheduleGame.gamePk,
    };
  }

  // 7. Classify existing state for current game
  const completePairs = discoveryResult.candidates.filter((record) =>
    isCompletePairForGame(record, scheduleGame.gamePk),
  );
  const activeOrphans = discoveryResult.orphanEvidence.filter((record) =>
    isActiveOrphanForGame(record, currentGameId),
  );

  // 8. Complete pair plus extra orphan = fail closed
  if (completePairs.length === 1 && activeOrphans.length > 0) {
    return {
      kind: 'CAPTURE_LINEAGE_MULTIPLICITY_INELIGIBLE',
      gamePk: scheduleGame.gamePk,
    };
  }

  // 9. Complete pair handling
  if (completePairs.length === 1) {
    const existing = completePairs[0];
    const binding = existing.binding;
    if (
      binding.gamePk === scheduleGame.gamePk &&
      binding.gameId === currentGameId &&
      binding.officialDate === currentOfficialDate &&
      binding.scheduledStartAt === currentScheduledStartAt
    ) {
      return {
        kind: 'ALREADY_COMPLETE',
        activationId: activation.activationId,
        protocolId: activation.protocolId,
        gamePk: scheduleGame.gamePk,
        gameId: currentGameId,
        evidenceArtifactId: binding.evidenceArtifactId,
        bindingId: computeBindingId({
          protocolId: binding.protocolId,
          activationId: binding.activationId,
          gamePk: binding.gamePk,
          evidenceArtifactId: binding.evidenceArtifactId,
          evidenceSha256: binding.evidenceSha256,
        }),
      };
    }

    return {
      kind: 'SCHEDULE_DRIFT_INELIGIBLE',
      currentGameId,
      currentOfficialDate,
      currentScheduledStartAt,
    };
  }

  // 10. Multiple active orphans = fail closed
  if (activeOrphans.length > 1) {
    return {
      kind: 'ORPHAN_MULTIPLICITY_INELIGIBLE',
      gameId: currentGameId,
      orphanCount: activeOrphans.length,
    };
  }

  // 11. Single active orphan handling
  if (activeOrphans.length === 1) {
    const orphan = activeOrphans[0];
    const evidence = orphan.evidence;

    if (
      evidence.gameId !== currentGameId ||
      evidence.officialDate !== currentOfficialDate ||
      evidence.scheduledStartAt !== currentScheduledStartAt
    ) {
      return {
        kind: 'SCHEDULE_DRIFT_INELIGIBLE',
        currentGameId,
        currentOfficialDate,
        currentScheduledStartAt,
      };
    }

    // Binding recovery allowed only before scheduled start
    const scheduledStartMs = Date.parse(currentScheduledStartAt);
    const workerMs = clock.now().getTime();
    if (!Number.isFinite(scheduledStartMs) || !Number.isFinite(workerMs)) {
      return {
        kind: 'BINDING_RECOVERY_REJECTED',
        failureCode: 'INVALID_TIMESTAMP',
        message: 'Clock or scheduled start returned an invalid timestamp',
      };
    }
    if (workerMs >= scheduledStartMs) {
      return {
        kind: 'BINDING_RECOVERY_REJECTED',
        failureCode: 'PERSISTENCE_AFTER_SCHEDULED_START',
        message: `Current clock ${clock.now().toISOString()} is at or after scheduled start ${currentScheduledStartAt}`,
      };
    }

    const expectedBindingId = computeBindingId({
      protocolId: evidence.protocolId,
      activationId: evidence.activationId,
      gamePk: scheduleGame.gamePk,
      evidenceArtifactId: orphan.receipt.artifactId,
      evidenceSha256: orphan.receipt.sha256,
    });

    // Prepare binding from persisted orphan evidence
    const preparedBinding: MLBProspectiveHoldoutGameIdentityBindingPrepared = {
      contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
      protocolId: activation.protocolId,
      activationId: activation.activationId,
      authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
      scheduleGame: {
        gamePk: scheduleGame.gamePk,
        officialDate: scheduleGame.officialDate,
        startTimeUtc: scheduleGame.startTimeUtc,
      },
      evidence,
      evidenceReceipt: orphan.receipt,
    };

    const preparedValidation = validateMLBProspectiveHoldoutGameIdentityBindingPrepared(preparedBinding);
    if (!preparedValidation.ok) {
      return {
        kind: 'INTEGRITY_FAILURE',
        issues: preparedValidation.issues.map(mapIssue),
      };
    }

    let finalBindingReceipt: MLBProspectiveHoldoutGameIdentityBindingReceipt;
    const bindingResult = await persistProspectiveHoldoutGameIdentityBinding(
      repositoryRoot,
      preparedBinding,
      () => clock.now().toISOString(),
    );
    if (bindingResult.ok) {
      finalBindingReceipt = bindingResult.receipt;
    } else {
      const issues = bindingResult.issues;
      const alreadyExists = issues.some(
        (issue) => issue.code === 'BINDING_ALREADY_EXISTS',
      );
      if (alreadyExists) {
        const readBack = await readProspectiveHoldoutGameIdentityBinding(repositoryRoot, expectedBindingId);
        if (!readBack.ok) {
          return {
            kind: 'INTEGRITY_FAILURE',
            issues: readBack.issues.map(mapIssue),
          };
        }
        const persisted = readBack.value;
        const readBackId = computeBindingId({
          protocolId: persisted.protocolId,
          activationId: persisted.activationId,
          gamePk: persisted.gamePk,
          evidenceArtifactId: persisted.evidenceArtifactId,
          evidenceSha256: persisted.evidenceSha256,
        });
        if (
          readBackId !== expectedBindingId ||
          persisted.gamePk !== scheduleGame.gamePk ||
          persisted.gameId !== currentGameId ||
          persisted.officialDate !== currentOfficialDate ||
          persisted.scheduledStartAt !== currentScheduledStartAt ||
          persisted.evidenceArtifactId !== orphan.receipt.artifactId ||
          persisted.evidenceSha256 !== orphan.receipt.sha256
        ) {
          return {
            kind: 'INTEGRITY_FAILURE',
            issues: ['BINDING_READBACK_IDENTITY_MISMATCH'],
          };
        }
        finalBindingReceipt = readBack.receipt;
      } else {
        return {
          kind: 'BINDING_RECOVERY_REJECTED',
          failureCode: issues[0]?.code ?? 'UNKNOWN_BINDING_FAILURE',
          message: issues[0]?.message ?? 'Unknown binding persistence failure',
        };
      }
    }

    // Post-write J reconstruction
    const postDiscovery = await discoverMLBProspectiveHoldoutArtifacts(
      repositoryRoot,
      activation,
    );
    if (!postDiscovery.ok) {
      return {
        kind: 'INTEGRITY_FAILURE',
        issues: postDiscovery.issues.map(mapIssue),
      };
    }

    const postConflict = postDiscovery.rescheduleConflicts.find((conflict) =>
      isRescheduleConflictForGame(conflict, activation.activationId, activation.protocolId, scheduleGame.gamePk),
    );
    if (postConflict) {
      return {
        kind: 'INTEGRITY_FAILURE',
        issues: ['POST_WRITE_RESCHEDULE_CONFLICT_DETECTED'],
      };
    }

    const postCompletePairs = postDiscovery.candidates.filter((record) =>
      isCompletePairForGame(record, scheduleGame.gamePk),
    );
    const postOrphans = postDiscovery.orphanEvidence.filter((record) =>
      isActiveOrphanForGame(record, currentGameId),
    );

    const expectedPair = postCompletePairs.find(
      (record) =>
        record.binding.evidenceArtifactId === orphan.receipt.artifactId &&
        computeBindingId({
          protocolId: record.binding.protocolId,
          activationId: record.binding.activationId,
          gamePk: record.binding.gamePk,
          evidenceArtifactId: record.binding.evidenceArtifactId,
          evidenceSha256: record.binding.evidenceSha256,
        }) === finalBindingReceipt.bindingId,
    );

    if (!expectedPair || postOrphans.length > 0) {
      return {
        kind: 'INTEGRITY_FAILURE',
        issues: ['POST_WRITE_J_RECONSTRUCTION_FAILED'],
      };
    }

    return {
      kind: 'RECOVERED_BINDING_FROM_ORPHAN_H',
      activationId: activation.activationId,
      protocolId: activation.protocolId,
      gamePk: scheduleGame.gamePk,
      gameId: currentGameId,
      evidenceArtifactId: orphan.receipt.artifactId,
      bindingId: finalBindingReceipt.bindingId,
      scientificCutoffAt,
      persistedAt: finalBindingReceipt.persistedAt,
    };
  }

  // 12. Fresh capture path
  // G must wrap snapshot acquisition
  const t360Request: MLBProspectiveT360CaptureRequest = {
    gameId: currentGameId,
    scheduledStartAt: currentScheduledStartAt,
  };

  const t360Result = runProspectiveT360Capture(
    t360Request,
    () => snapshotBuilder(scheduleGame),
    () => clock.now().toISOString(),
  );

  if (!t360Result.ok) {
    return {
      kind: 'CAPTURE_REJECTED',
      failureCode: t360Result.failureCode,
      message: t360Result.message,
    };
  }

  // 13. Extract feature vectors
  const rawFeatureVectorResult = extractMLBLeakageSafeFeatureVector(
    MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    t360Result.snapshot,
  );
  if (!rawFeatureVectorResult.ok) {
    return {
      kind: 'INTEGRITY_FAILURE',
      issues: rawFeatureVectorResult.issues.map(mapIssue),
    };
  }

  const projectedVectorResult = applyCandidate003ProspectiveFeatureCompatibility(
    rawFeatureVectorResult.value,
  );
  if (!projectedVectorResult.ok) {
    return {
      kind: 'INTEGRITY_FAILURE',
      issues: projectedVectorResult.issues.map(mapIssue),
    };
  }

  // 14. Prepare evidence
  const preparedEvidence: MLBProspectivePregameEvidencePrepared = {
    contractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: activation.activationId,
    captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
    compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
    gameId: currentGameId,
    snapshotId: t360Result.snapshot.snapshotId,
    officialDate: currentOfficialDate,
    scheduledStartAt: currentScheduledStartAt,
    scientificCutoffAt: t360Result.scientificCutoffAt,
    actualDataCutoffAt: t360Result.actualDataCutoffAt,
    rawSnapshot: t360Result.snapshot,
    rawFeatureVector: rawFeatureVectorResult.value,
    candidate003CompatibleFeatureVector: projectedVectorResult.value,
    t360Validation: t360Result.t360Validation,
  };

  const evidenceValidation = validateMLBProspectivePregameEvidencePrepared(preparedEvidence);
  if (!evidenceValidation.ok) {
    return {
      kind: 'INTEGRITY_FAILURE',
      issues: evidenceValidation.issues.map(mapIssue),
    };
  }

  // 15. Persist evidence with read-back
  let evidenceReceipt: MLBProspectivePregameEvidenceReceipt;
  const evidencePersistenceResult = await persistProspectivePregameEvidence(
    repositoryRoot,
    preparedEvidence,
    () => clock.now().toISOString(),
  );
  if (evidencePersistenceResult.ok) {
    evidenceReceipt = evidencePersistenceResult.receipt;
  } else {
    const issues = evidencePersistenceResult.issues;
    const alreadyExists = issues.some(
      (issue) => issue.code === 'ARTIFACT_ALREADY_EXISTS',
    );
    if (alreadyExists) {
      const expectedArtifactId = computeArtifactId(preparedEvidence);
      const readBack = await readProspectivePregameEvidence(repositoryRoot, expectedArtifactId);
      if (!readBack.ok) {
        return {
          kind: 'INTEGRITY_FAILURE',
          issues: readBack.issues.map(mapIssue),
        };
      }
      if (readBack.receipt.artifactId !== expectedArtifactId) {
        return {
          kind: 'INTEGRITY_FAILURE',
          issues: ['EVIDENCE_READBACK_ARTIFACT_ID_MISMATCH'],
        };
      }
      evidenceReceipt = readBack.receipt;
    } else {
      return {
        kind: 'CAPTURE_REJECTED',
        failureCode: issues[0]?.code ?? 'UNKNOWN_EVIDENCE_FAILURE',
        message: issues[0]?.message ?? 'Unknown evidence persistence failure',
      };
    }
  }

  const persistedEvidence = await readProspectivePregameEvidence(
    repositoryRoot,
    evidenceReceipt.artifactId,
  );
  if (!persistedEvidence.ok) {
    return {
      kind: 'INTEGRITY_FAILURE',
      issues: persistedEvidence.issues.map(mapIssue),
    };
  }

  // 16. Prepare binding
  const preparedBinding: MLBProspectiveHoldoutGameIdentityBindingPrepared = {
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
    protocolId: activation.protocolId,
    activationId: activation.activationId,
    authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
    scheduleGame: {
      gamePk: scheduleGame.gamePk,
      officialDate: scheduleGame.officialDate,
      startTimeUtc: scheduleGame.startTimeUtc,
    },
    evidence: persistedEvidence.value,
    evidenceReceipt: persistedEvidence.receipt,
  };

  const bindingValidation = validateMLBProspectiveHoldoutGameIdentityBindingPrepared(preparedBinding);
  if (!bindingValidation.ok) {
    return {
      kind: 'INTEGRITY_FAILURE',
      issues: bindingValidation.issues.map(mapIssue),
    };
  }

  // 17. Persist binding with read-back
  const expectedBindingId = computeBindingId({
    protocolId: preparedBinding.protocolId,
    activationId: preparedBinding.activationId,
    gamePk: scheduleGame.gamePk,
    evidenceArtifactId: persistedEvidence.receipt.artifactId,
    evidenceSha256: persistedEvidence.receipt.sha256,
  });

  let finalBindingReceipt: MLBProspectiveHoldoutGameIdentityBindingReceipt;
  const bindingPersistenceResult = await persistProspectiveHoldoutGameIdentityBinding(
    repositoryRoot,
    preparedBinding,
    () => clock.now().toISOString(),
  );
  if (bindingPersistenceResult.ok) {
    finalBindingReceipt = bindingPersistenceResult.receipt;
  } else {
    const issues = bindingPersistenceResult.issues;
    const alreadyExists = issues.some(
      (issue) => issue.code === 'BINDING_ALREADY_EXISTS',
    );
    if (alreadyExists) {
      const readBack = await readProspectiveHoldoutGameIdentityBinding(repositoryRoot, expectedBindingId);
      if (!readBack.ok) {
        return {
          kind: 'INTEGRITY_FAILURE',
          issues: readBack.issues.map(mapIssue),
        };
      }
      const persisted = readBack.value;
      const readBackId = computeBindingId({
        protocolId: persisted.protocolId,
        activationId: persisted.activationId,
        gamePk: persisted.gamePk,
        evidenceArtifactId: persisted.evidenceArtifactId,
        evidenceSha256: persisted.evidenceSha256,
      });
      if (
        readBackId !== expectedBindingId ||
        persisted.gamePk !== scheduleGame.gamePk ||
        persisted.gameId !== currentGameId ||
        persisted.officialDate !== currentOfficialDate ||
        persisted.scheduledStartAt !== currentScheduledStartAt ||
        persisted.evidenceArtifactId !== persistedEvidence.receipt.artifactId ||
        persisted.evidenceSha256 !== persistedEvidence.receipt.sha256
      ) {
        return {
          kind: 'INTEGRITY_FAILURE',
          issues: ['BINDING_READBACK_IDENTITY_MISMATCH'],
        };
      }
      finalBindingReceipt = readBack.receipt;
    } else {
      return {
        kind: 'CAPTURE_REJECTED',
        failureCode: issues[0]?.code ?? 'UNKNOWN_BINDING_FAILURE',
        message: issues[0]?.message ?? 'Unknown binding persistence failure',
      };
    }
  }

  // 18. Post-write J reconstruction
  const postDiscovery = await discoverMLBProspectiveHoldoutArtifacts(
    repositoryRoot,
    activation,
  );
  if (!postDiscovery.ok) {
    return {
      kind: 'INTEGRITY_FAILURE',
      issues: postDiscovery.issues.map(mapIssue),
    };
  }

  const postConflict = postDiscovery.rescheduleConflicts.find((conflict) =>
    isRescheduleConflictForGame(conflict, activation.activationId, activation.protocolId, scheduleGame.gamePk),
  );
  if (postConflict) {
    return {
      kind: 'INTEGRITY_FAILURE',
      issues: ['POST_WRITE_RESCHEDULE_CONFLICT_DETECTED'],
    };
  }

  const postCompletePairs = postDiscovery.candidates.filter((record) =>
    isCompletePairForGame(record, scheduleGame.gamePk),
  );
  const postOrphans = postDiscovery.orphanEvidence.filter((record) =>
    isActiveOrphanForGame(record, currentGameId),
  );

  const expectedPair = postCompletePairs.find(
    (record) =>
      record.binding.evidenceArtifactId === persistedEvidence.receipt.artifactId &&
      computeBindingId({
        protocolId: record.binding.protocolId,
        activationId: record.binding.activationId,
        gamePk: record.binding.gamePk,
        evidenceArtifactId: record.binding.evidenceArtifactId,
        evidenceSha256: record.binding.evidenceSha256,
      }) === finalBindingReceipt.bindingId,
  );

  if (!expectedPair || postOrphans.length > 0) {
    return {
      kind: 'INTEGRITY_FAILURE',
      issues: ['POST_WRITE_J_RECONSTRUCTION_FAILED'],
    };
  }

  return {
    kind: 'CAPTURED_AND_BOUND',
    activationId: activation.activationId,
    protocolId: activation.protocolId,
    gamePk: scheduleGame.gamePk,
    gameId: currentGameId,
    evidenceArtifactId: persistedEvidence.receipt.artifactId,
    bindingId: finalBindingReceipt.bindingId,
    scientificCutoffAt: t360Result.scientificCutoffAt,
    actualDataCutoffAt: t360Result.actualDataCutoffAt,
    persistedAt: finalBindingReceipt.persistedAt,
  };
}
