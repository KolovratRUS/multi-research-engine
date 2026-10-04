/* -------------------------------------------------------------------------- */
/*  Single-job shadow execution adapter (L5E2V-C1 -> L5E2U boundary)            */
/* -------------------------------------------------------------------------- */
/**
 * Thin execution boundary: accepts an unknown candidate execution job,
 * validates it once with the sealed L5E2V contract, and delegates to the
 * existing L5E2U persistence orchestrator exactly once on success.
 *
 * The adapter performs NO generation, mutation, persistence, capture,
 * scheduling, network, or model-loading work. It is purely a validation
 * gate and a single delegation call.
 *
 * SCIENTIFIC / BLINDNESS LOCK:
 *   S1_SCIENTIFIC_ROLE            = NONE
 *   SCIENTIFIC_USE                = NONE
 *   IS_PROSPECTIVE_HOLDOUT_EVIDENCE = false
 *   ELIGIBLE_FOR_FUTURE_VALIDATION  = false
 *   ELIGIBLE_FOR_FUTURE_TEST        = false
 *
 * No sportsbook information may enter or influence the adapter.
 */

import {
  validateMLBShadowExecutionJob,
} from '@/prediction/mlb/mlb-shadow-execution-job-contract';
import {
  orchestrateMLBShadowMonitoringPredictionPersistence,
  type MLBShadowMonitoringPredictionPersistenceIntegrationResult,
} from '@/prediction/mlb/mlb-shadow-monitoring-persistence-orchestrator';

/* -------------------------------------------------------------------------- */
/*  Adapter version                                                            */
/* -------------------------------------------------------------------------- */
export const MLB_SHADOW_EXECUTION_ADAPTER_VERSION =
  'mlb-shadow-execution-adapter-v1' as const;

/* -------------------------------------------------------------------------- */
/*  Fixed safe invalid-job result                                              */
/* -------------------------------------------------------------------------- */
/**
 * Returned when validation of the candidate execution job fails.
 * Exposes NO validation issues, field values, prediction values, model
 * values, probabilities, snapshot contents, paths, raw messages, stack
 * traces, or underlying objects.
 */
export type MLBShadowExecutionAdapterInvalidResult = Readonly<{
  ok: false;
  adapterVersion: typeof MLB_SHADOW_EXECUTION_ADAPTER_VERSION;
  status: 'EXECUTION_JOB_INVALID';
}>;

/* -------------------------------------------------------------------------- */
/*  Adapter result (L5E2U result OR fixed invalid result)                      */
/* -------------------------------------------------------------------------- */
/**
 * On valid jobs the adapter returns the EXACT L5E2U result, unwrapped and
 * unchanged. On invalid jobs it returns a fixed safe rejection.
 */
export type MLBShadowExecutionAdapterResult =
  | MLBShadowMonitoringPredictionPersistenceIntegrationResult
  | MLBShadowExecutionAdapterInvalidResult;

/* -------------------------------------------------------------------------- */
/*  Execution adapter — validate once, delegate once                           */
/* -------------------------------------------------------------------------- */
/**
 * Accepts an unknown candidate execution job, validates it with the sealed
 * L5E2V contract (validateMLBShadowExecutionJob), and delegates to the
 * existing L5E2U orchestrator (orchestrateMLBShadowMonitoringPredictionPersistence)
 * exactly once if and only if validation succeeds.
 *
 * @param input - Unknown candidate execution job (caller need not pre-cast).
 * @returns The exact L5E2U result for valid jobs, or a fixed safe rejection
 *          for invalid jobs.
 */
export async function executeMLBShadowExecutionJob(
  input: unknown,
): Promise<MLBShadowExecutionAdapterResult> {
  const validation = validateMLBShadowExecutionJob(input);

  if (!validation.ok) {
    return {
      ok: false,
      adapterVersion: MLB_SHADOW_EXECUTION_ADAPTER_VERSION,
      status: 'EXECUTION_JOB_INVALID',
    };
  }

  return orchestrateMLBShadowMonitoringPredictionPersistence(validation.value);
}
