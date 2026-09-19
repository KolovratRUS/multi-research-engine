#!/usr/bin/env tsx
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';

import type { MLBGameResearchSnapshot, MLBScheduleGame, MLBScheduleResult } from '@/lib/research-data/types';
import { MLBResearchDataAdapter } from '@/lib/research-data/mlb/provider';
import { ResearchDataError, ResearchDataTimeoutError } from '@/lib/research-data/errors';
import { formatMLBCalendarDate } from '@/lib/backtesting/mlb/live-history/historical-date';
import {
  planProspectiveHoldoutValidationDispatch,
  type MLBProspectiveHoldoutSchedulerCoreInput,
  type MLBProspectiveHoldoutSchedulerDecision,
  MLB_PROSPECTIVE_HOLDOUT_SCHEDULER_EVENT_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-prospective-holdout-scheduler-core';
import {
  runProspectiveHoldoutCaptureForScheduleGame,
  type MLBProspectiveHoldoutCaptureDependencies,
} from './mlb-prospective-holdout-capture';
import {
  inspectMLBProspectiveHoldoutActivationStore,
  type MLBProspectiveHoldoutActivationStoreInventoryResult,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-store';
import {
  discoverMLBProspectiveHoldoutArtifacts,
  type MLBProspectiveHoldoutCampaignContext,
} from '@/prediction/mlb/mlb-prospective-holdout-artifact-discovery';
import {
  buildMLBProspectiveHoldoutProgressReport,
} from '@/prediction/mlb/mlb-prospective-holdout-progress-report';
import {
  type MLBProspectiveHoldoutActivationPersisted,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-contract';
import {
  runProspectiveHoldoutCaptureOrchestrator,
  type MLBProspectiveHoldoutCaptureOrchestratorResult,
} from '@/prediction/mlb/mlb-prospective-holdout-capture-orchestrator';

/* -------------------------------------------------------------------------- */
/*  Frozen identifiers                                                         */
/* -------------------------------------------------------------------------- */

export const MLB_PROSPECTIVE_HOLDOUT_SCHEDULER_EVENT_CONTRACT_VERSION_FROZEN =
  MLB_PROSPECTIVE_HOLDOUT_SCHEDULER_EVENT_CONTRACT_VERSION;

/* -------------------------------------------------------------------------- */
/*  Timing constants                                                           */
/* -------------------------------------------------------------------------- */

const SCIENTIFIC_CUTOFF_OFFSET_MINUTES = 360;
const TARGET_DISPATCH_OFFSET_MINUTES = 375;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const RETRY_DELAY_MS = 2000;
const MAX_CAPTURE_ATTEMPTS = 2;

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveHoldoutSchedulerStateLoaderResult =
  | {
      readonly ok: true;
      readonly activation: MLBProspectiveHoldoutActivationPersisted;
      readonly validationCapturedCount: number;
      readonly testCapturedCount: number;
      readonly anomalyCount: number;
      readonly completedGamePks: readonly number[];
    }
  | { readonly ok: false; readonly reason: string };

export interface MLBProspectiveHoldoutSchedulerDependencies {
  readonly repositoryRoot?: string;
  readonly lockPath?: string;
  readonly now: () => Date;
  readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  readonly loadScientificState: (
    repositoryRoot: string,
    activationId?: string,
  ) => Promise<MLBProspectiveHoldoutSchedulerStateLoaderResult>;
  readonly fetchSchedule: (date: string) => Promise<MLBScheduleResult>;
  readonly provider: {
    readonly buildGameSnapshot: (
      game: MLBScheduleGame,
      options: { season: number; includeWeather: boolean },
    ) => Promise<MLBGameResearchSnapshot>;
  };
  readonly captureApplication: typeof runProspectiveHoldoutCaptureForScheduleGame;
  readonly hostname: () => string;
  readonly pid: () => number;
  readonly ownerTokenFactory: () => string;
  readonly registerSignalHandler: (
    signal: 'SIGINT' | 'SIGTERM',
    handler: () => void,
  ) => () => void;
  readonly createEvent: (event: MLBProspectiveHoldoutSchedulerEvent) => void;
  readonly acquireLock: (
    ownerToken: string,
    pid: number,
    hostname: string,
    startedAt: string,
  ) => Promise<{ readonly acquired: boolean; readonly reason?: string }>;
  readonly releaseLock: (
    ownerToken: string,
  ) => Promise<{ readonly released: boolean; readonly reason?: string }>;
  readonly readLock: () => Promise<{
    readonly locked: boolean;
    readonly ownerToken?: string;
    readonly pid?: number;
    readonly hostname?: string;
    readonly startedAt?: string;
  }>;
}

export type MLBProspectiveHoldoutSchedulerRunResult =
  | { readonly kind: 'STOPPED_CLEAN'; readonly exitCode: 0 }
  | { readonly kind: 'DRY_RUN_COMPLETE'; readonly exitCode: 0 }
  | { readonly kind: 'STOPPED_FAIL_CLOSED'; readonly exitCode: 2; readonly reason: string }
  | { readonly kind: 'SECOND_INSTANCE_BLOCKED'; readonly exitCode: 3 };

export type MLBProspectiveHoldoutSchedulerEvent = Readonly<{
  readonly contractVersion: typeof MLB_PROSPECTIVE_HOLDOUT_SCHEDULER_EVENT_CONTRACT_VERSION_FROZEN;
  readonly event: string;
  readonly observedAt: string;
  readonly [key: string]: unknown;
}>;

export interface SchedulerCLIIO {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
}

/* -------------------------------------------------------------------------- */
/*  Activation selection (scheduler-owned policy; store owns filesystem)        */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveHoldoutActivationSelection =
  | { readonly kind: 'SELECTED_LEGACY'; readonly activation: MLBProspectiveHoldoutActivationPersisted }
  | { readonly kind: 'SELECTED_BY_ID'; readonly activation: MLBProspectiveHoldoutActivationPersisted }
  | { readonly kind: 'AMBIGUOUS_SELECTION'; readonly reason: string }
  | { readonly kind: 'ACTIVATION_NOT_FOUND'; readonly reason: string }
  | { readonly kind: 'ACTIVATION_STORE_INVALID'; readonly reason: string };

export function selectMLBProspectiveHoldoutActivation(
  inventoryResult: MLBProspectiveHoldoutActivationStoreInventoryResult,
  activationId?: string,
): MLBProspectiveHoldoutActivationSelection {
  if (!inventoryResult.ok) {
    return {
      kind: 'ACTIVATION_STORE_INVALID',
      reason: `activation store inventory invalid: ${inventoryResult.issues.map((i) => i.message).join(', ')}`,
    };
  }

  const { legacy, byId } = inventoryResult.inventory;

  if (activationId !== undefined) {
    // Explicit selector: must match an existing record exactly.
    // Case 5: selector == legacy activationId => SELECTED_LEGACY
    if (legacy !== null && legacy.activationId === activationId) {
      return { kind: 'SELECTED_LEGACY', activation: legacy.activation };
    }
    // Case 6: selector matches a valid by-id activation => SELECTED_BY_ID
    const match = byId.find((e) => e.activationId === activationId);
    if (match !== undefined) {
      return { kind: 'SELECTED_BY_ID', activation: match.activation };
    }
    // Case 7 & F: requested activation missing => ACTIVATION_NOT_FOUND.
    // Never fall back to legacy for an explicitly requested missing successor ID.
    return {
      kind: 'ACTIVATION_NOT_FOUND',
      reason: `requested activationId '${activationId}' not found in activation store`,
    };
  }

  // No selector provided.
  // Case 1: exactly one valid campaign (legacy only) => SELECTED_LEGACY
  if (legacy !== null && byId.length === 0) {
    return { kind: 'SELECTED_LEGACY', activation: legacy.activation };
  }
  // Case 2 & 3: a by-id record present without explicit selector => fail closed
  if (legacy !== null || byId.length > 0) {
    return {
      kind: 'AMBIGUOUS_SELECTION',
      reason: 'explicit --activationId required when multiple or by-id activations are present',
    };
  }
  // Case 4: empty store without selector => fail closed
  return {
    kind: 'AMBIGUOUS_SELECTION',
    reason: 'no activation record found in store; explicit --activationId required',
  };
}

export function isSelectableActivation(
  selection: MLBProspectiveHoldoutActivationSelection,
): selection is
  | { readonly kind: 'SELECTED_LEGACY'; readonly activation: MLBProspectiveHoldoutActivationPersisted }
  | { readonly kind: 'SELECTED_BY_ID'; readonly activation: MLBProspectiveHoldoutActivationPersisted } {
  return selection.kind === 'SELECTED_LEGACY' || selection.kind === 'SELECTED_BY_ID';
}

/* -------------------------------------------------------------------------- */
/*  Lock owner metadata                                                        */
/* -------------------------------------------------------------------------- */

interface LockOwnerMetadata {
  readonly pid: number;
  readonly hostname: string;
  readonly startedAt: string;
  readonly ownerToken: string;
}

/* -------------------------------------------------------------------------- */
/*  PID liveness                                                              */
/* -------------------------------------------------------------------------- */

export type PidLiveness = 'ALIVE' | 'DEAD' | 'UNKNOWN';

export function classifyPidKillError(error: unknown): PidLiveness {
  if (error instanceof Error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ESRCH') return 'DEAD';
    if (err.code === 'EPERM') return 'ALIVE';
  }
  return 'UNKNOWN';
}

function checkPidLivenessDefault(pid: number): PidLiveness {
  try {
    process.kill(pid, 0);
    return 'ALIVE';
  } catch (error) {
    return classifyPidKillError(error);
  }
}

function isValidPid(pid: unknown): pid is number {
  return typeof pid === 'number' && Number.isSafeInteger(pid) && pid > 0;
}

/* -------------------------------------------------------------------------- */
/*  Stale-recovery claim                                                      */
/* -------------------------------------------------------------------------- */

interface RecoveryClaimMetadata {
  readonly pid: number;
  readonly hostname: string;
  readonly ownerTokenBeingRecovered: string;
  readonly recoveryToken: string;
  readonly startedAt: string;
}

export async function readRecoveryClaimMetadata(
  claimDir: string,
): Promise<RecoveryClaimMetadata | undefined> {
  try {
    const raw = await fs.readFile(path.join(claimDir, 'claim.json'), 'utf-8');
    const metadata = JSON.parse(raw) as RecoveryClaimMetadata;
    return metadata;
  } catch {
    return undefined;
  }
}

export async function acquireRecoveryClaim(
  claimDir: string,
  recoveryPid: number,
  recoveryHostname: string,
  ownerTokenBeingRecovered: string,
  recoveryToken: string,
  startedAt: string,
  checkPidLiveness: (pid: number) => PidLiveness = checkPidLivenessDefault,
): Promise<{ readonly acquired: boolean; readonly reason?: string }> {
  try {
    await fs.mkdir(claimDir, { recursive: false });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'EEXIST') {
      return { acquired: false, reason: 'RECOVERY_IN_PROGRESS_OR_MANUAL_REVIEW' };
    }
    return { acquired: false, reason: `recovery claim IO error: ${err.message}` };
  }

  await fs.writeFile(
    path.join(claimDir, 'claim.json'),
    JSON.stringify({
      pid: recoveryPid,
      hostname: recoveryHostname,
      ownerTokenBeingRecovered,
      recoveryToken,
      startedAt,
    }),
  );

  return { acquired: true };
}

export async function releaseRecoveryClaim(
  claimDir: string,
): Promise<{ readonly released: boolean; readonly reason?: string }> {
  try {
    await fs.rm(claimDir, { recursive: true, force: true });
    return { released: true };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    return { released: false, reason: `recovery claim release failed: ${err.message}` };
  }
}

/* -------------------------------------------------------------------------- */
/*  Capture result classification                                              */
/* -------------------------------------------------------------------------- */

type CaptureOutcome =
  | { readonly kind: 'SUCCESS'; readonly resultKind: string }
  | { readonly kind: 'SKIP_ALREADY_PRESENT' }
  | { readonly kind: 'PERMANENT_GAME_MISS'; readonly failureCode?: string }
  | { readonly kind: 'HUMAN_REVIEW_REQUIRED'; readonly reason: string };

const PERMANENT_GAME_MISS_CODES = new Set([
  'CAPTURE_STARTED_AFTER_SCIENTIFIC_CUTOFF',
  'ACTUAL_DATA_CUTOFF_AFTER_SCIENTIFIC_CUTOFF',
  'MODEL_SOURCE_TIMESTAMP_AFTER_SCIENTIFIC_CUTOFF',
  'MODEL_SOURCE_TIMESTAMP_UNPROVEN',
  'INVALID_CAPTURE_REQUEST',
]);

function classifyCaptureResult(
  result: MLBProspectiveHoldoutCaptureOrchestratorResult,
  gamePk: number,
): CaptureOutcome {
  if (
    result.kind === 'CAPTURED_AND_BOUND' ||
    result.kind === 'RECOVERED_BINDING_FROM_ORPHAN_H'
  ) {
    return { kind: 'SUCCESS', resultKind: result.kind };
  }

  if (result.kind === 'ALREADY_COMPLETE') {
    return { kind: 'SKIP_ALREADY_PRESENT' };
  }

  if (result.kind === 'INTEGRITY_FAILURE') {
    return {
      kind: 'HUMAN_REVIEW_REQUIRED',
      reason: `INTEGRITY_FAILURE: ${result.issues.join(', ')}`,
    };
  }

  if (result.kind === 'CAPTURE_REJECTED') {
    if (PERMANENT_GAME_MISS_CODES.has(result.failureCode)) {
      return {
        kind: 'PERMANENT_GAME_MISS',
        failureCode: result.failureCode,
      };
    }
    return {
      kind: 'HUMAN_REVIEW_REQUIRED',
      reason: `CAPTURE_REJECTED: ${result.failureCode}: ${result.message}`,
    };
  }

  if (result.kind === 'ACTIVATION_NOT_FROZEN_BEFORE_CUTOFF') {
    return {
      kind: 'HUMAN_REVIEW_REQUIRED',
      reason: `ACTIVATION_NOT_FROZEN_BEFORE_CUTOFF: persistedAt=${result.activationPersistedAt} scientificCutoffAt=${result.scientificCutoffAt}`,
    };
  }

  return {
    kind: 'HUMAN_REVIEW_REQUIRED',
    reason: result.kind,
  };
}

/* -------------------------------------------------------------------------- */
/*  Transient error detection                                                 */
/* -------------------------------------------------------------------------- */

function isTransientError(error: unknown): boolean {
  return error instanceof ResearchDataError && error.isRetryable;
}

/* -------------------------------------------------------------------------- */
/*  Date helpers                                                              */
/* -------------------------------------------------------------------------- */

function addUTCDays(dateStr: string, days: number): string {
  const base = new Date(`${dateStr}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/* -------------------------------------------------------------------------- */
/*  Scientific state loader (production default)                              */
/* -------------------------------------------------------------------------- */

async function loadScientificStateImpl(
  repositoryRoot: string,
  activationId?: string,
): Promise<MLBProspectiveHoldoutSchedulerStateLoaderResult> {
  const inventoryResult = await inspectMLBProspectiveHoldoutActivationStore(repositoryRoot);
  const selection = selectMLBProspectiveHoldoutActivation(inventoryResult, activationId);
  if (!isSelectableActivation(selection)) {
    return {
      ok: false,
      reason: `activation selection failed: ${selection.reason}`,
    };
  }
  const activation = selection.activation;

  // Build campaign-aware context from the validated activation inventory.
  // Discovery uses this to classify foreign artifacts as KNOWN_FOREIGN
  // (non-blocking) vs UNKNOWN_FOREIGN (fail-closed). The scheduler is the
  // sole authority for which activations are valid; discovery does NOT
  // re-read the activation directory.
  const campaignContext: MLBProspectiveHoldoutCampaignContext = {
    selectedActivationId: activation.activationId,
    selectedProtocolId: activation.protocolId,
    validatedActivations: inventoryResult.ok
      ? [
          ...(inventoryResult.inventory.legacy !== null
            ? [inventoryResult.inventory.legacy.activation]
            : []),
          ...inventoryResult.inventory.byId.map((e) => e.activation),
        ].map((a) => ({
          activationId: a.activationId,
          protocolId: a.protocolId,
          evidenceArtifactContractVersion: a.evidenceArtifactContractVersion,
          captureContractVersion: a.captureContractVersion,
          compatibilityLayerId: a.compatibilityLayerId,
          gameIdentityBindingContractVersion: a.gameIdentityBindingContractVersion,
          evidenceStoreVersion: a.evidenceStoreVersion,
        }))
      : [],
  };
  const discoveryResult = await discoverMLBProspectiveHoldoutArtifacts(
    repositoryRoot,
    activation,
    campaignContext,
  );
  if (!discoveryResult.ok) {
    return {
      ok: false,
      reason: `discovery failure: ${discoveryResult.issues.map(i => i.code).join(', ')}`,
    };
  }
  const report = buildMLBProspectiveHoldoutProgressReport({
    activation,
    discovery: discoveryResult,
  });
  if ('kind' in report) {
    return { ok: false, reason: `progress report error: ${report.kind}` };
  }
  const anomalyCount =
    report.anomalies.orphanEvidenceCount +
    report.anomalies.foreignEvidenceCount +
    report.anomalies.foreignBindingCount +
    report.anomalies.temporaryDebrisCount +
    report.anomalies.unknownFilesCount;
  return {
    ok: true,
    activation,
    validationCapturedCount: report.validationCapturedCount,
    testCapturedCount: report.testCapturedCount,
    anomalyCount,
    completedGamePks: Object.freeze(report.validationCapturedGamePks),
  };
}

/* -------------------------------------------------------------------------- */
/*  Schedule fetching                                                         */
/* -------------------------------------------------------------------------- */

async function fetchScheduleWindow(
  repositoryRoot: string,
  deps: MLBProspectiveHoldoutSchedulerDependencies,
  activation: MLBProspectiveHoldoutActivationPersisted,
): Promise<MLBScheduleGame[]> {
  const currentDate = formatMLBCalendarDate(deps.now());
  const boundaryDate = activation.validationBoundaryOfficialDate;

  const dates: string[] = [];
  let date = currentDate;
  while (date <= boundaryDate) {
    dates.push(date);
    date = addUTCDays(date, 1);
  }

  const results = await Promise.all(dates.map(d => deps.fetchSchedule(d)));
  return results.flatMap(r => r.games);
}

async function fetchAdjacentDates(
  repositoryRoot: string,
  deps: MLBProspectiveHoldoutSchedulerDependencies,
  officialDate: string,
  boundaryOfficialDate: string,
): Promise<MLBScheduleGame[]> {
  const candidates = [
    addUTCDays(officialDate, -1),
    officialDate,
    addUTCDays(officialDate, 1),
  ];

  const uniqueDates = [...new Set(candidates)].filter(d => d <= boundaryOfficialDate);

  const results = await Promise.all(uniqueDates.map(d => deps.fetchSchedule(d)));
  return results.flatMap(r => r.games);
}

/* -------------------------------------------------------------------------- */
/*  Startup checks                                                             */
/* -------------------------------------------------------------------------- */

interface StartupCheckResult {
  readonly ok: boolean;
  readonly targetComplete: boolean;
  readonly reason?: string;
}

type StartupCheckSuccess = { readonly ok: true; readonly targetComplete: boolean };
type StartupCheckFailure = { readonly ok: false; readonly targetComplete: boolean; readonly reason: string };

function checkStartup(
  state: MLBProspectiveHoldoutSchedulerStateLoaderResult,
): StartupCheckSuccess | StartupCheckFailure {
  if (!state.ok) {
    return { ok: false, targetComplete: false, reason: state.reason };
  }

  if (state.activation.testAuthorizationRule !== 'NO_TEST_AUTHORIZATION') {
    return {
      ok: false,
      targetComplete: false,
      reason: `unexpected testAuthorizationRule: ${state.activation.testAuthorizationRule}`,
    };
  }

  if (state.validationCapturedCount < 0 || state.validationCapturedCount > 67) {
    return {
      ok: false,
      targetComplete: false,
      reason: `validationCapturedCount out of range: ${state.validationCapturedCount}`,
    };
  }

  if (state.testCapturedCount !== 0) {
    return {
      ok: false,
      targetComplete: false,
      reason: `testCapturedCount is ${state.testCapturedCount}`,
    };
  }

  if (state.anomalyCount > 0) {
    return {
      ok: false,
      targetComplete: false,
      reason: `anomalyCount is ${state.anomalyCount}`,
    };
  }

  if (state.validationCapturedCount === 67) {
    return { ok: true, targetComplete: true };
  }

  return { ok: true, targetComplete: false };
}

function isValidState(
  state: MLBProspectiveHoldoutSchedulerStateLoaderResult,
): state is Extract<MLBProspectiveHoldoutSchedulerStateLoaderResult, { ok: true }> {
  return state.ok;
}

/* -------------------------------------------------------------------------- */
/*  Capture deps builder                                                       */
/* -------------------------------------------------------------------------- */

function buildCaptureDeps(
  repositoryRoot: string,
  deps: MLBProspectiveHoldoutSchedulerDependencies,
  activation: MLBProspectiveHoldoutActivationPersisted,
): MLBProspectiveHoldoutCaptureDependencies {
  return {
    repositoryRoot,
    provider: {
      fetchSchedule: deps.fetchSchedule,
      buildGameSnapshot: deps.provider.buildGameSnapshot,
    },
    orchestrator: runProspectiveHoldoutCaptureOrchestrator,
    activation,
    now: deps.now,
  };
}

/* -------------------------------------------------------------------------- */
/*  Event helper                                                               */
/* -------------------------------------------------------------------------- */

function emitEvent(
  createEvent: (event: MLBProspectiveHoldoutSchedulerEvent) => void,
  kind: string,
  payload: Record<string, unknown>,
  now: () => Date,
): void {
  createEvent({
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_SCHEDULER_EVENT_CONTRACT_VERSION_FROZEN,
    event: kind,
    observedAt: now().toISOString(),
    ...payload,
  } as MLBProspectiveHoldoutSchedulerEvent);
}

/* -------------------------------------------------------------------------- */
/*  Lock helpers                                                               */
/* -------------------------------------------------------------------------- */

export async function readLockMetadata(
  lockPath: string,
): Promise<{ readonly locked: boolean; readonly metadata?: LockOwnerMetadata }> {
  try {
    const raw = await fs.readFile(path.join(lockPath, 'owner.json'), 'utf-8');
    const metadata = JSON.parse(raw) as LockOwnerMetadata;
    return { locked: true, metadata };
  } catch {
    return { locked: false };
  }
}

export async function acquireLockImpl(
  lockPath: string,
  ownerToken: string,
  pid: number,
  hostname: string,
  startedAt: string,
  checkPidLiveness: (pid: number) => PidLiveness = checkPidLivenessDefault,
  recoveryTokenFactory: () => string = randomUUID,
  recoveryStartedAtFactory: () => string = () => new Date().toISOString(),
  hooks?: Readonly<{
    readonly afterStaleOwnerRead?: () => Promise<void> | void;
    readonly afterRecoveryClaimAcquired?: () => Promise<void> | void;
    readonly beforeStaleLockRemove?: () => Promise<void> | void;
    readonly afterNewActiveLockAcquired?: () => Promise<void> | void;
  }>,
): Promise<{ readonly acquired: boolean; readonly reason?: string }> {
  // Parent directory may be created recursively, but the lock directory itself
  // must be an exclusive atomic acquisition.
  await fs.mkdir(path.dirname(lockPath), { recursive: true });

  try {
    await fs.mkdir(lockPath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'EEXIST') {
      return { acquired: false, reason: `lock acquisition IO error: ${err.message}` };
    }

    // Lock already exists - classify ownership/staleness before touching metadata.
    const lockState = await readLockMetadata(lockPath);
    if (!lockState.locked || !lockState.metadata) {
      return { acquired: false, reason: 'HUMAN_REVIEW_REQUIRED: malformed lock metadata' };
    }

    const existing = lockState.metadata;

    if (!isValidPid(existing.pid)) {
      return { acquired: false, reason: 'MALFORMED_LOCK_METADATA: invalid pid' };
    }

    if (existing.hostname !== hostname) {
      return { acquired: false, reason: 'HUMAN_REVIEW_REQUIRED: foreign host lock' };
    }

    // Same host: probe existing PID liveness. ONLY conclusively DEAD permits stale recovery.
    const liveness = checkPidLiveness(existing.pid);
    if (liveness === 'ALIVE') {
      return { acquired: false, reason: 'SECOND_INSTANCE_BLOCKED' };
    }

    if (liveness === 'UNKNOWN') {
      return { acquired: false, reason: 'HUMAN_REVIEW_REQUIRED: unknown pid liveness' };
    }

    // DEAD: candidate stale lock recovery.
    // Re-read metadata to ensure no ownership change since the first read.
    const reread = await readLockMetadata(lockPath);
    if (
      !reread.locked ||
      !reread.metadata ||
      reread.metadata.ownerToken !== existing.ownerToken ||
      reread.metadata.hostname !== existing.hostname ||
      reread.metadata.pid !== existing.pid
    ) {
      return { acquired: false, reason: 'HUMAN_REVIEW_REQUIRED: owner token race' };
    }

    await hooks?.afterStaleOwnerRead?.();

    const runtimeDir = path.dirname(lockPath);
    const claimDir = path.join(
      runtimeDir,
      `stale-recovery-${createHash('sha256').update(existing.ownerToken).digest('hex')}.claim`,
    );

    const claimResult = await acquireRecoveryClaim(
      claimDir,
      pid,
      hostname,
      existing.ownerToken,
      recoveryTokenFactory(),
      recoveryStartedAtFactory(),
      checkPidLiveness,
    );

    if (!claimResult.acquired) {
      return claimResult;
    }

    try {
      await hooks?.afterRecoveryClaimAcquired?.();

      const postRead = await readLockMetadata(lockPath);
      if (
        !postRead.locked ||
        !postRead.metadata ||
        postRead.metadata.ownerToken !== existing.ownerToken ||
        postRead.metadata.hostname !== existing.hostname ||
        postRead.metadata.pid !== existing.pid
      ) {
        await releaseRecoveryClaim(claimDir);
        return { acquired: false, reason: 'HUMAN_REVIEW_REQUIRED: owner token race' };
      }

      await hooks?.beforeStaleLockRemove?.();
      await fs.rm(lockPath, { recursive: true, force: true });

      try {
        await fs.mkdir(lockPath);
      } catch (error2) {
        const err2 = error2 as NodeJS.ErrnoException;
        if (err2.code === 'EEXIST') {
          await releaseRecoveryClaim(claimDir);
          return { acquired: false, reason: 'SECOND_INSTANCE_BLOCKED' };
        }
        await releaseRecoveryClaim(claimDir);
        return { acquired: false, reason: `lock acquisition IO error: ${err2.message}` };
      }

      await fs.writeFile(
        path.join(lockPath, 'owner.json'),
        JSON.stringify({ pid, hostname, startedAt, ownerToken }),
      );

      await hooks?.afterNewActiveLockAcquired?.();

      return { acquired: true };
    } finally {
      await releaseRecoveryClaim(claimDir);
    }
  }

  // Write owner metadata only after exclusive lock acquisition succeeds.
  await fs.writeFile(
    path.join(lockPath, 'owner.json'),
    JSON.stringify({ pid, hostname, startedAt, ownerToken }),
  );

  return { acquired: true };
}

export async function releaseLockImpl(
  lockPath: string,
  ownerToken: string,
): Promise<{ readonly released: boolean; readonly reason?: string }> {
  try {
    const lockState = await readLockMetadata(lockPath);
    if (!lockState.locked || !lockState.metadata) {
      return { released: true };
    }
    if (lockState.metadata.ownerToken !== ownerToken) {
      return { released: false, reason: 'owner token mismatch on release' };
    }
    await fs.rm(lockPath, { recursive: true, force: true });
    return { released: true };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return { released: true };
    }
    return { released: false, reason: err.message };
  }
}

/* -------------------------------------------------------------------------- */
/*  Default repository root                                                   */
/* -------------------------------------------------------------------------- */

function deriveRepositoryRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

/* -------------------------------------------------------------------------- */
/*  Default dependency factory                                                */
/* -------------------------------------------------------------------------- */

function createDefaultDependencies(
  overrides: Partial<MLBProspectiveHoldoutSchedulerDependencies> = {},
): MLBProspectiveHoldoutSchedulerDependencies {
  const provider = new MLBResearchDataAdapter();
  const repositoryRoot = overrides.repositoryRoot ?? deriveRepositoryRoot();
  const lockPath =
    overrides.lockPath ??
    path.join(
      repositoryRoot,
      'var/mlb-development/mlb-prospective-holdout-scheduler-runtime/active.lock',
    );

  return {
    repositoryRoot,
    lockPath,
    now: () => new Date(),
    sleep: (ms: number, signal?: AbortSignal) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        if (signal) {
          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              reject(new Error('aborted'));
            },
            { once: true },
          );
        }
      }),
    loadScientificState: (root: string, activationId?: string) => loadScientificStateImpl(root, activationId),
    fetchSchedule: (date: string) => provider.fetchSchedule(date),
    provider: {
      buildGameSnapshot: (game, options) => provider.buildGameSnapshot(game, options),
    },
    captureApplication: runProspectiveHoldoutCaptureForScheduleGame,
    hostname: () => os.hostname(),
    pid: () => process.pid,
    ownerTokenFactory: () => crypto.randomUUID(),
    registerSignalHandler: (signal, handler) => {
      process.on(signal, handler);
      return () => process.off(signal, handler);
    },
    createEvent: (event) =>
      process.stdout.write(`${JSON.stringify(event)}\n`),
    acquireLock: (ownerToken, pid, hostname, startedAt) =>
      acquireLockImpl(lockPath, ownerToken, pid, hostname, startedAt),
    releaseLock: (ownerToken) => releaseLockImpl(lockPath, ownerToken),
    readLock: () => readLockMetadata(lockPath),
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/*  Main host runtime                                                         */
/* -------------------------------------------------------------------------- */

export async function runMLBProspectiveHoldoutScheduler(
  options: { readonly dryRun: boolean; readonly activationId?: string },
  deps: MLBProspectiveHoldoutSchedulerDependencies,
): Promise<MLBProspectiveHoldoutSchedulerRunResult> {
  const repositoryRoot = deps.repositoryRoot ?? deriveRepositoryRoot();
  const lockPath = deps.lockPath ?? path.join(repositoryRoot, 'var/mlb-development/mlb-prospective-holdout-scheduler-runtime/active.lock');
  const ownerToken = deps.ownerTokenFactory();
  const hostname = deps.hostname();
  const pid = deps.pid();
  const startedAt = new Date().toISOString();

  // Dry-run: single planning cycle only — executed before singleton lock
  // acquisition so dry-run never touches the runtime lock or capture state.
  // Dry-run registers zero scheduler signal handlers; the only observable
  // start event emitted on this path is SCHEDULER_STARTED, mirroring the
  // pre-repair contract, without acquiring the runtime lock.
  if (options.dryRun) {
    emitEvent(deps.createEvent, 'SCHEDULER_STARTED', { startedAt, ownerToken, pid, hostname }, deps.now);
    const state = await deps.loadScientificState(repositoryRoot, options.activationId);
    if (!isValidState(state)) {
      emitEvent(deps.createEvent, 'HUMAN_REVIEW_REQUIRED', { reason: state.reason ?? 'invalid startup state' }, deps.now);
      return { kind: 'STOPPED_FAIL_CLOSED', exitCode: 2, reason: state.reason ?? 'invalid startup state' };
    }

    const startup = checkStartup(state);
    if (!startup.ok) {
      emitEvent(deps.createEvent, 'HUMAN_REVIEW_REQUIRED', { reason: startup.reason ?? 'unknown startup failure' }, deps.now);
      return { kind: 'STOPPED_FAIL_CLOSED', exitCode: 2, reason: startup.reason ?? 'unknown startup failure' };
    }

    if (state.validationCapturedCount === 67) {
      emitEvent(deps.createEvent, 'VALIDATION_TARGET_COMPLETE', {}, deps.now);
      emitEvent(deps.createEvent, 'SCHEDULER_STOPPED', { reason: 'dry-run complete' }, deps.now);
      return { kind: 'DRY_RUN_COMPLETE', exitCode: 0 };
    }

    emitEvent(deps.createEvent, 'STATE_REFRESHED', {
      validationCapturedCount: state.validationCapturedCount,
      testCapturedCount: state.testCapturedCount,
      anomalyCount: state.anomalyCount,
    }, deps.now);

    const schedule = await fetchScheduleWindow(repositoryRoot, deps, state.activation);
    const plan = planProspectiveHoldoutValidationDispatch({
      activation: {
        validationBoundaryOfficialDate: state.activation.validationBoundaryOfficialDate,
        validationTargetCount: state.activation.validationTargetCount,
      },
      validationCapturedCount: state.validationCapturedCount,
      testCapturedCount: state.testCapturedCount,
      completedGamePks: state.completedGamePks,
      scheduleCandidates: schedule,
      trustedNow: deps.now(),
    });

    if (plan.kind === 'DISPATCH_NOW') {
      emitEvent(deps.createEvent, 'DRY_RUN_CAPTURE_PREVIEW', {
        gamePk: plan.game.gamePk,
        officialDate: plan.game.officialDate,
        startTimeUtc: plan.game.startTimeUtc.toISOString(),
      }, deps.now);
    } else if (plan.kind === 'WAIT_UNTIL_TARGET') {
      emitEvent(deps.createEvent, 'NEXT_CAPTURE_PLANNED', {
        waitUntil: plan.waitUntil,
        classification: 'WAIT_UNTIL_TARGET',
      }, deps.now);
    } else if (plan.kind === 'VALIDATION_TARGET_UNREACHABLE') {
      emitEvent(deps.createEvent, 'HUMAN_REVIEW_REQUIRED', { reason: 'dry-run plan: validation target unreachable under remaining schedule' }, deps.now);
      return { kind: 'STOPPED_FAIL_CLOSED', exitCode: 2, reason: 'dry-run plan: validation target unreachable under remaining schedule' };
    } else if (plan.kind === 'HUMAN_REVIEW_REQUIRED') {
      emitEvent(deps.createEvent, 'HUMAN_REVIEW_REQUIRED', { reason: `dry-run plan: ${plan.reason}` }, deps.now);
      return { kind: 'STOPPED_FAIL_CLOSED', exitCode: 2, reason: `dry-run plan: ${plan.reason}` };
    } else if (plan.kind === 'VALIDATION_TARGET_COMPLETE') {
      emitEvent(deps.createEvent, 'VALIDATION_TARGET_COMPLETE', {}, deps.now);
    }

    emitEvent(deps.createEvent, 'SCHEDULER_STOPPED', { reason: 'dry-run complete' }, deps.now);
    return { kind: 'DRY_RUN_COMPLETE', exitCode: 0 };
  }

  let shuttingDown = false;
  let captureActive = false;
  const abortController = new AbortController();

  const unregisterSigint = deps.registerSignalHandler('SIGINT', () => {
    shuttingDown = true;
    abortController.abort();
  });
  const unregisterSigterm = deps.registerSignalHandler('SIGTERM', () => {
    shuttingDown = true;
    abortController.abort();
  });

  const acquireResult = await deps.acquireLock(ownerToken, pid, hostname, startedAt);
  if (!acquireResult.acquired) {
    unregisterSigint();
    unregisterSigterm();
    if (acquireResult.reason === 'SECOND_INSTANCE_BLOCKED') {
      emitEvent(deps.createEvent, 'SECOND_INSTANCE_BLOCKED', { lockPath }, deps.now);
      return { kind: 'SECOND_INSTANCE_BLOCKED', exitCode: 3 };
    }
    emitEvent(deps.createEvent, 'HUMAN_REVIEW_REQUIRED', { reason: acquireResult.reason ?? 'lock acquisition failed' }, deps.now);
    return { kind: 'STOPPED_FAIL_CLOSED', exitCode: 2, reason: acquireResult.reason ?? 'lock acquisition failed' };
  }

  try {
    emitEvent(deps.createEvent, 'SCHEDULER_STARTED', { startedAt, ownerToken, pid, hostname }, deps.now);

    // Run-scoped duplicate dispatch guard: protects the lifetime of ONE
    // scheduler process against selecting a gamePk already dispatched this run.
    // It does NOT block the legitimate transient retry inside the same cycle.
    const dispatchedGamePks = new Set<number>();

    // Normal runtime loop
    while (true) {
      if (shuttingDown && !captureActive) {
        break;
      }

      const state = await deps.loadScientificState(repositoryRoot, options.activationId);
      if (!isValidState(state)) {
        emitEvent(deps.createEvent, 'HUMAN_REVIEW_REQUIRED', { reason: state.reason ?? 'invalid startup state' }, deps.now);
        return { kind: 'STOPPED_FAIL_CLOSED', exitCode: 2, reason: state.reason ?? 'invalid startup state' };
      }

      const startup = checkStartup(state);
      if (!startup.ok) {
        emitEvent(deps.createEvent, 'HUMAN_REVIEW_REQUIRED', { reason: startup.reason }, deps.now);
        return { kind: 'STOPPED_FAIL_CLOSED', exitCode: 2, reason: startup.reason };
      }

      if (state.validationCapturedCount === 67) {
        emitEvent(deps.createEvent, 'VALIDATION_TARGET_COMPLETE', {}, deps.now);
        emitEvent(deps.createEvent, 'SCHEDULER_STOPPED', { reason: 'target complete' }, deps.now);
        return { kind: 'STOPPED_CLEAN', exitCode: 0 };
      }

      emitEvent(deps.createEvent, 'STATE_REFRESHED', {
        validationCapturedCount: state.validationCapturedCount,
        testCapturedCount: state.testCapturedCount,
        anomalyCount: state.anomalyCount,
      }, deps.now);

      const schedule = await fetchScheduleWindow(repositoryRoot, deps, state.activation);

      const plan = planProspectiveHoldoutValidationDispatch({
        activation: {
          validationBoundaryOfficialDate: state.activation.validationBoundaryOfficialDate,
          validationTargetCount: state.activation.validationTargetCount,
        },
        validationCapturedCount: state.validationCapturedCount,
        testCapturedCount: state.testCapturedCount,
        completedGamePks: state.completedGamePks,
        scheduleCandidates: schedule,
        trustedNow: deps.now(),
      });

      if (shuttingDown && !captureActive) {
        break;
      }

      if (plan.kind === 'VALIDATION_TARGET_UNREACHABLE') {
        emitEvent(deps.createEvent, 'HUMAN_REVIEW_REQUIRED', { reason: 'validation target unreachable under remaining schedule' }, deps.now);
        return { kind: 'STOPPED_FAIL_CLOSED', exitCode: 2, reason: 'validation target unreachable under remaining schedule' };
      }

      if (plan.kind === 'HUMAN_REVIEW_REQUIRED') {
        emitEvent(deps.createEvent, 'HUMAN_REVIEW_REQUIRED', { reason: plan.reason }, deps.now);
        return { kind: 'STOPPED_FAIL_CLOSED', exitCode: 2, reason: plan.reason };
      }

      if (plan.kind === 'WAIT_UNTIL_TARGET') {
        const targetWaitMs = new Date(plan.waitUntil).getTime();
        const refreshMs = deps.now().getTime() + REFRESH_INTERVAL_MS;
        const waitUntilMs = Math.min(targetWaitMs, refreshMs);
        const waitMs = Math.max(0, waitUntilMs - deps.now().getTime());

        emitEvent(deps.createEvent, 'NEXT_CAPTURE_PLANNED', {
          waitUntil: new Date(waitUntilMs).toISOString(),
          classification: 'WAIT_UNTIL_TARGET',
        }, deps.now);

        try {
          await deps.sleep(waitMs, abortController.signal);
        } catch {
          // sleep aborted
        }

        if (shuttingDown && !captureActive) {
          break;
        }
        continue;
      }

      if (plan.kind === 'DISPATCH_NOW') {
        const game = plan.game;
        // Pre-dispatch fresh schedule refresh
        const freshGames = await fetchAdjacentDates(
          repositoryRoot,
          deps,
          game.officialDate,
          state.activation.validationBoundaryOfficialDate,
        );
        const matches = freshGames.filter(g => g.gamePk === game.gamePk);

        if (matches.length === 0) {
          emitEvent(deps.createEvent, 'CAPTURE_FAILED', {
            gamePk: game.gamePk,
            reason: 'SCHEDULE_DRIFT_GAMEPK_MISSING',
          }, deps.now);
          continue;
        }

        if (matches.length > 1) {
          emitEvent(deps.createEvent, 'HUMAN_REVIEW_REQUIRED', {
            reason: `duplicate gamePk ${game.gamePk} in fresh schedule`,
          }, deps.now);
          return { kind: 'STOPPED_FAIL_CLOSED', exitCode: 2, reason: `duplicate gamePk ${game.gamePk}` };
        }

        let freshGame = matches[0];

        // Test-side firewall
        if (freshGame.officialDate > state.activation.validationBoundaryOfficialDate) {
          emitEvent(deps.createEvent, 'TEST_SIDE_BLOCKED', {
            gamePk: freshGame.gamePk,
            officialDate: freshGame.officialDate,
          }, deps.now);
          continue;
        }

        // Timing reclassification after fresh lookup
        const nowMs = deps.now().getTime();
        const targetDispatchMs = freshGame.startTimeUtc.getTime() - TARGET_DISPATCH_OFFSET_MINUTES * 60 * 1000;
        const scientificCutoffMs = freshGame.startTimeUtc.getTime() - SCIENTIFIC_CUTOFF_OFFSET_MINUTES * 60 * 1000;

        if (nowMs >= scientificCutoffMs) {
          emitEvent(deps.createEvent, 'CAPTURE_MISSED_CUTOFF', { gamePk: freshGame.gamePk }, deps.now);
          continue;
        }

        if (nowMs < targetDispatchMs) {
          const waitUntilMs = targetDispatchMs;
          const waitMs = Math.max(0, waitUntilMs - nowMs);

          emitEvent(deps.createEvent, 'NEXT_CAPTURE_PLANNED', {
            waitUntil: new Date(waitUntilMs).toISOString(),
            classification: 'WAIT_UNTIL_TARGET',
          }, deps.now);

          try {
            await deps.sleep(waitMs, abortController.signal);
          } catch {
            // sleep aborted
          }

          if (shuttingDown && !captureActive) {
            break;
          }
          continue;
        }

        // Fresh classification using pure core
        const freshPlan = planProspectiveHoldoutValidationDispatch({
          activation: {
            validationBoundaryOfficialDate: state.activation.validationBoundaryOfficialDate,
            validationTargetCount: state.activation.validationTargetCount,
          },
          validationCapturedCount: state.validationCapturedCount,
          testCapturedCount: state.testCapturedCount,
          completedGamePks: state.completedGamePks,
          scheduleCandidates: [freshGame],
          trustedNow: deps.now(),
        });

        if (freshPlan.kind !== 'DISPATCH_NOW') {
          if (freshPlan.kind === 'HUMAN_REVIEW_REQUIRED') {
            emitEvent(deps.createEvent, 'HUMAN_REVIEW_REQUIRED', { reason: freshPlan.reason }, deps.now);
            return { kind: 'STOPPED_FAIL_CLOSED', exitCode: 2, reason: freshPlan.reason };
          }
          continue;
        }

        if (dispatchedGamePks.has(freshGame.gamePk)) {
          emitEvent(deps.createEvent, 'HUMAN_REVIEW_REQUIRED', {
            reason: `duplicate capture attempt for gamePk ${freshGame.gamePk}`,
          }, deps.now);
          return { kind: 'STOPPED_FAIL_CLOSED', exitCode: 2, reason: `duplicate capture attempt for gamePk ${freshGame.gamePk}` };
        }
        dispatchedGamePks.add(freshGame.gamePk);

        // Dispatch capture
        captureActive = true;
        emitEvent(deps.createEvent, 'CAPTURE_DISPATCHED', {
          gamePk: freshGame.gamePk,
          officialDate: freshGame.officialDate,
          startTimeUtc: freshGame.startTimeUtc.toISOString(),
        }, deps.now);

        let captureResult: MLBProspectiveHoldoutCaptureOrchestratorResult | undefined;
        let lastError: unknown | undefined;
        let attempts = 0;

        while (attempts < MAX_CAPTURE_ATTEMPTS) {
          attempts++;
          try {
            captureResult = await deps.captureApplication(
              freshGame,
              buildCaptureDeps(repositoryRoot, deps, state.activation),
            );
            lastError = undefined;
            break;
          } catch (error) {
            lastError = error;

            if (attempts >= MAX_CAPTURE_ATTEMPTS) {
              break;
            }

            const transient = isTransientError(error);
            if (!transient) {
              break;
            }

            // Retry preconditions
            const retryNowMs = deps.now().getTime();
            const retryCutoffMs = freshGame.startTimeUtc.getTime() - SCIENTIFIC_CUTOFF_OFFSET_MINUTES * 60 * 1000;
            if (retryNowMs >= retryCutoffMs) {
              break;
            }

            const retryState = await deps.loadScientificState(repositoryRoot, options.activationId);
            if (!isValidState(retryState)) {
              break;
            }

            const retrySchedule = await fetchAdjacentDates(
              repositoryRoot,
              deps,
              freshGame.officialDate,
              retryState.activation.validationBoundaryOfficialDate,
            );
            const retryMatches = retrySchedule.filter(g => g.gamePk === freshGame.gamePk);
            if (retryMatches.length !== 1) {
              break;
            }

            const retryGame = retryMatches[0];
            const retryPlan = planProspectiveHoldoutValidationDispatch({
              activation: {
                validationBoundaryOfficialDate: retryState.activation.validationBoundaryOfficialDate,
                validationTargetCount: retryState.activation.validationTargetCount,
              },
              validationCapturedCount: retryState.validationCapturedCount,
              testCapturedCount: retryState.testCapturedCount,
              completedGamePks: retryState.completedGamePks,
              scheduleCandidates: [retryGame],
              trustedNow: deps.now(),
            });

            if (retryPlan.kind !== 'DISPATCH_NOW') {
              break;
            }

            emitEvent(deps.createEvent, 'CAPTURE_RETRY_SCHEDULED', {
              gamePk: freshGame.gamePk,
              delayMs: RETRY_DELAY_MS,
              attempt: attempts,
            }, deps.now);

            try {
              await deps.sleep(RETRY_DELAY_MS, abortController.signal);
            } catch {
              break;
            }

            if (shuttingDown) {
              break;
            }

            freshGame = retryGame;
          }
        }

        captureActive = false;

        if (shuttingDown) {
          if (captureResult) {
            const outcome = classifyCaptureResult(captureResult, freshGame.gamePk);
            if (outcome.kind === 'SUCCESS') {
              emitEvent(deps.createEvent, 'CAPTURE_SUCCEEDED', {
                gamePk: freshGame.gamePk,
                kind: captureResult.kind,
              }, deps.now);
            } else if (outcome.kind === 'SKIP_ALREADY_PRESENT') {
              emitEvent(deps.createEvent, 'CAPTURE_SKIPPED_ALREADY_PRESENT', { gamePk: freshGame.gamePk }, deps.now);
            } else if (outcome.kind === 'PERMANENT_GAME_MISS') {
              emitEvent(deps.createEvent, 'CAPTURE_MISSED_CUTOFF', { gamePk: freshGame.gamePk }, deps.now);
            } else {
              emitEvent(deps.createEvent, 'HUMAN_REVIEW_REQUIRED', { reason: outcome.reason }, deps.now);
            }
          }
          break;
        }

        if (lastError) {
          emitEvent(deps.createEvent, 'CAPTURE_FAILED', {
            gamePk: freshGame.gamePk,
            reason: lastError instanceof Error ? lastError.message : 'unknown error',
          }, deps.now);
          continue;
        }

        if (!captureResult) {
          emitEvent(deps.createEvent, 'CAPTURE_FAILED', {
            gamePk: freshGame.gamePk,
            reason: 'no capture result',
          }, deps.now);
          continue;
        }

        const outcome = classifyCaptureResult(captureResult, freshGame.gamePk);

        if (outcome.kind === 'SUCCESS') {
          emitEvent(deps.createEvent, 'CAPTURE_SUCCEEDED', {
            gamePk: freshGame.gamePk,
            kind: captureResult.kind,
          }, deps.now);
          continue;
        }

        if (outcome.kind === 'SKIP_ALREADY_PRESENT') {
          emitEvent(deps.createEvent, 'CAPTURE_SKIPPED_ALREADY_PRESENT', { gamePk: freshGame.gamePk }, deps.now);
          continue;
        }

        if (outcome.kind === 'PERMANENT_GAME_MISS') {
          emitEvent(deps.createEvent, 'CAPTURE_MISSED_CUTOFF', { gamePk: freshGame.gamePk }, deps.now);
          continue;
        }

        emitEvent(deps.createEvent, 'HUMAN_REVIEW_REQUIRED', { reason: outcome.reason }, deps.now);
        return { kind: 'STOPPED_FAIL_CLOSED', exitCode: 2, reason: outcome.reason };
      }
    }

    emitEvent(deps.createEvent, 'SCHEDULER_STOPPED', {
      reason: shuttingDown ? 'signal received' : 'unknown',
    }, deps.now);
    return { kind: 'STOPPED_CLEAN', exitCode: 0 };
  } finally {
    unregisterSigint();
    unregisterSigterm();
    abortController.abort();
    const releaseResult = await deps.releaseLock(ownerToken);
    if (!releaseResult.released) {
      emitEvent(deps.createEvent, 'HUMAN_REVIEW_REQUIRED', {
        reason: `lock release failed: ${releaseResult.reason}`,
      }, deps.now);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  CLI argument parsing                                                     */
/* -------------------------------------------------------------------------- */

export function parseArguments(argv: string[]): { readonly dryRun: boolean; readonly activationId?: string } {
  let dryRun = false;
  let activationId: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('--activationId=')) {
      const value = arg.slice('--activationId='.length);
      if (value === '' || value !== value.trim()) {
        throw new Error('--activationId requires a non-empty trimmed value');
      }
      if (activationId !== undefined) {
        throw new Error('Multiple --activationId values are not allowed');
      }
      activationId = value;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unsupported flag: ${arg}`);
    }
  }
  return { dryRun, activationId };
}

/* -------------------------------------------------------------------------- */
/*  CLI entrypoint                                                            */
/* -------------------------------------------------------------------------- */

export async function runMLBProspectiveHoldoutSchedulerCLI(
  argv: readonly string[],
  io?: SchedulerCLIIO,
  deps?: MLBProspectiveHoldoutSchedulerDependencies,
): Promise<number> {
  const stdout = io?.stdout ?? ((message: string) => process.stdout.write(`${message}\n`));
  const stderr = io?.stderr ?? ((message: string) => process.stderr.write(`${message}\n`));

  let options: { readonly dryRun: boolean; readonly activationId?: string };
  try {
    options = parseArguments(argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid arguments';
    stderr(`Error: ${message}`);
    return 1;
  }

  try {
    const resolvedDeps = deps ?? createDefaultDependencies();
    const result = await runMLBProspectiveHoldoutScheduler(options, resolvedDeps);

    if (result.kind === 'STOPPED_CLEAN' || result.kind === 'DRY_RUN_COMPLETE') {
      return 0;
    }
    if (result.kind === 'SECOND_INSTANCE_BLOCKED') {
      return 3;
    }
    return 2;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected failure';
    stderr(`Error: ${message}`);
    return 1;
  }
}

/* -------------------------------------------------------------------------- */
/*  Direct execution guard                                                    */
/* -------------------------------------------------------------------------- */

function isDirectExecution(): boolean {
  const entryPoint = process.argv[1];
  if (!entryPoint) {
    return false;
  }
  try {
    const thisFile = realpathSync(fileURLToPath(import.meta.url));
    const resolvedEntry = realpathSync(entryPoint);
    return thisFile === resolvedEntry;
  } catch {
    return false;
  }
}

if (isDirectExecution()) {
  (async () => {
    process.exitCode = await runMLBProspectiveHoldoutSchedulerCLI(process.argv);
  })();
}
