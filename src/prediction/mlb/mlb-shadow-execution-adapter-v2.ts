/* -------------------------------------------------------------------------- */
/*  MLB shadow execution adapter (V2 / P5E-C3)                                */
/* -------------------------------------------------------------------------- */

import {
  validateMLBShadowExecutionJobV2,
} from '@/prediction/mlb/mlb-shadow-execution-job-v2-contract';
import {
  orchestrateMLBShadowMonitoringPredictionPersistenceV2,
  type MLBShadowMonitoringPredictionPersistenceIntegrationV2Result,
} from '@/prediction/mlb/mlb-shadow-monitoring-persistence-orchestrator-v2';

/* -------------------------------------------------------------------------- */
/*  V2 adapter version (fixed literal — never reuse V1 version)               */
/* -------------------------------------------------------------------------- */

export const MLB_SHADOW_EXECUTION_ADAPTER_V2_VERSION =
  'mlb-shadow-execution-adapter-v2' as const;

/* -------------------------------------------------------------------------- */
/*  Fixed safe invalid result (mirrors V1 structure, V2 version literal)     */
/* -------------------------------------------------------------------------- */

export type MLBShadowExecutionAdapterV2InvalidResult = Readonly<{
  ok: false;
  adapterVersion: typeof MLB_SHADOW_EXECUTION_ADAPTER_V2_VERSION;
  status: 'EXECUTION_JOB_INVALID';
}>;

/* -------------------------------------------------------------------------- */
/*  Public adapter result (union of safe persistence result or fixed invalid) */
/* -------------------------------------------------------------------------- */

export type MLBShadowExecutionAdapterV2Result =
  | MLBShadowMonitoringPredictionPersistenceIntegrationV2Result
  | MLBShadowExecutionAdapterV2InvalidResult;

/* -------------------------------------------------------------------------- */
/*  Public validation boundary — additive V2 seam                             */
/*                                                                             */
/*  Mirrors the EXACT responsibility boundary of the V1 execution adapter:     */
/*    - validates UNKNOWN input through validateMLBShadowExecutionJobV2        */
/*    - returns a fixed safe invalid result if validation fails                */
/*    - delegates the validated value OPAQUELY to the V2 persistence           */
/*      orchestrator on success — no field inspection, no result rewriting    */
/*    - does NOT persist directly, does NOT inspect prediction/model/release   */
/*      fields, has no clock, has no randomness, has no network, no filesystem */
/* -------------------------------------------------------------------------- */

export async function executeMLBShadowExecutionJobV2(
  input: unknown,
): Promise<MLBShadowExecutionAdapterV2Result> {
  const validation = validateMLBShadowExecutionJobV2(input);

  if (!validation.ok) {
    return {
      ok: false,
      adapterVersion: MLB_SHADOW_EXECUTION_ADAPTER_V2_VERSION,
      status: 'EXECUTION_JOB_INVALID',
    };
  }

  return orchestrateMLBShadowMonitoringPredictionPersistenceV2(
    validation.value
  );
}
