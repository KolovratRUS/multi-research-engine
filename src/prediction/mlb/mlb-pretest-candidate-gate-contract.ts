import {
  MLB_PRETEST_GATE_POLICY_ID,
  type MLBPreTestValidationReferenceFacts,
  validateMLBPreTestValidationReferenceFacts,
} from './mlb-pretest-validation-reference-contract';
import {
  MLB_FIT_VALIDATION_RESULT_CONTRACT_VERSION,
  MLB_VALIDATION_EVALUATION_CONTRACT_VERSION,
  type MLBModelCoefficient,
  validateMLBModelFitValidationResult,
  type MLBModelFitValidationResult,
  type MLBModelValidationEvaluation,
} from './mlb-logistic-regression-fit-contract';
import {
  validateMLBModelEvaluationPlan,
  type MLBModelEvaluationPlan,
} from './mlb-model-training-plan-contract';

export { MLB_PRETEST_GATE_POLICY_ID };

export type MLBPreTestCandidateGateEligibility = 'ELIGIBLE_FOR_TEST' | 'REJECT_BEFORE_TEST';

export type MLBPreTestCandidateGateResult = Readonly<{
  eligibility: MLBPreTestCandidateGateEligibility;
  reasons: readonly string[];
}>;

export type MLBPreTestCandidateGateIssue = Readonly<{
  code:
    | 'INVALID_FIT_RESULT'
    | 'INVALID_EVALUATION_PLAN'
    | 'INVALID_REFERENCE_FACTS'
    | 'IDENTITY_MISMATCH'
    | 'ROW_COUNT_MISMATCH'
    | 'NOT_CONVERGED'
    | 'VALIDATION_LOG_LOSS_NOT_BETTER_THAN_REFERENCES'
    | 'VALIDATION_BRIER_NOT_BETTER_THAN_REFERENCES';
  path: string;
  message: string;
}>;

const REASON_ORDER: readonly string[] = [
  'INVALID_FIT_RESULT',
  'INVALID_EVALUATION_PLAN',
  'INVALID_REFERENCE_FACTS',
  'IDENTITY_MISMATCH',
  'ROW_COUNT_MISMATCH',
  'NOT_CONVERGED',
  'VALIDATION_LOG_LOSS_NOT_BETTER_THAN_REFERENCES',
  'VALIDATION_BRIER_NOT_BETTER_THAN_REFERENCES',
];

export function evaluateMLBPretestCandidateGate(
  fitValidationResult: unknown,
  evaluationPlan: unknown,
  validationReferenceFacts: unknown,
): MLBPreTestCandidateGateResult {
  const issues: MLBPreTestCandidateGateIssue[] = [];

  const fitResult = validateMLBModelFitValidationResult(fitValidationResult);
  if (!fitResult.ok) {
    pushIssue(issues, 'INVALID_FIT_RESULT', '$.fitValidationResult', 'fit result is invalid');
  }

  const planResult = validateMLBModelEvaluationPlan(evaluationPlan);
  if (!planResult.ok) {
    pushIssue(issues, 'INVALID_EVALUATION_PLAN', '$.evaluationPlan', 'evaluation plan is invalid');
  }

  const referenceResult = validateMLBPreTestValidationReferenceFacts(validationReferenceFacts);
  if (!referenceResult.ok) {
    pushIssue(issues, 'INVALID_REFERENCE_FACTS', '$.validationReferenceFacts', 'reference facts are invalid');
  }

  if (issues.length > 0) {
    return { eligibility: 'REJECT_BEFORE_TEST', reasons: stableReasons(issues) };
  }

  const fitResultOk = fitResult as { ok: true; value: MLBModelFitValidationResult };
  const planResultOk = planResult as { ok: true; value: MLBModelEvaluationPlan };
  const referenceResultOk = referenceResult as { ok: true; value: MLBPreTestValidationReferenceFacts };
  const fit = fitResultOk.value;
  const plan = planResultOk.value;
  const reference = referenceResultOk.value;

  const identityIssues = verifyIdentity(fit, plan, reference, issues);
  if (identityIssues.length > 0) {
    return { eligibility: 'REJECT_BEFORE_TEST', reasons: stableReasons(identityIssues) };
  }

  const rowIssues = verifyRowCounts(fit, plan, reference, issues);
  if (rowIssues.length > 0) {
    return { eligibility: 'REJECT_BEFORE_TEST', reasons: stableReasons(rowIssues) };
  }

  if (!fit.model.converged) {
    pushIssue(issues, 'NOT_CONVERGED', '$.model.converged', 'model did not converge');
  }

  const minLogLoss = Math.min(reference.p50.validationLogLoss, reference.trainPrior.validationLogLoss);
  const minBrier = Math.min(reference.p50.validationBrierScore, reference.trainPrior.validationBrierScore);

  if (fit.validation.metrics.logLoss >= minLogLoss) {
    pushIssue(issues, 'VALIDATION_LOG_LOSS_NOT_BETTER_THAN_REFERENCES', '$.validation.metrics.logLoss', 'log loss does not beat both references');
  }

  if (fit.validation.metrics.brierScore >= minBrier) {
    pushIssue(issues, 'VALIDATION_BRIER_NOT_BETTER_THAN_REFERENCES', '$.validation.metrics.brierScore', 'brier score does not beat both references');
  }

  if (issues.length > 0) {
    return { eligibility: 'REJECT_BEFORE_TEST', reasons: stableReasons(issues) };
  }

  return { eligibility: 'ELIGIBLE_FOR_TEST', reasons: [] };
}

function verifyIdentity(
  fit: MLBModelFitValidationResult,
  plan: MLBModelEvaluationPlan,
  reference: MLBPreTestValidationReferenceFacts,
  issues: MLBPreTestCandidateGateIssue[],
): MLBPreTestCandidateGateIssue[] {
  if (fit.model.planId !== plan.planId) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.model.planId', 'model planId does not match evaluation plan');
  }
  if (fit.model.matrixId !== plan.matrixId) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.model.matrixId', 'model matrixId does not match evaluation plan');
  }
  if (fit.model.configId !== plan.configId) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.model.configId', 'model configId does not match evaluation plan');
  }
  if (fit.model.manifestId !== plan.manifestId) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.model.manifestId', 'model manifestId does not match evaluation plan');
  }
  if (fit.model.datasetId !== plan.datasetId) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.model.datasetId', 'model datasetId does not match evaluation plan');
  }
  if (fit.model.algorithm !== plan.algorithm) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.model.algorithm', 'model algorithm does not match evaluation plan');
  }
  if (!deepEqual(fit.model.featureIds, plan.featureIds)) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.model.featureIds', 'model featureIds do not match evaluation plan');
  }

  if (reference.evaluationPlanId !== plan.planId) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.reference.evaluationPlanId', 'reference evaluationPlanId does not match evaluation plan');
  }
  if (reference.matrixId !== plan.matrixId) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.reference.matrixId', 'reference matrixId does not match evaluation plan');
  }
  if (reference.datasetId !== plan.datasetId) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.reference.datasetId', 'reference datasetId does not match evaluation plan');
  }

  return issues;
}

function verifyRowCounts(
  fit: MLBModelFitValidationResult,
  plan: MLBModelEvaluationPlan,
  reference: MLBPreTestValidationReferenceFacts,
  issues: MLBPreTestCandidateGateIssue[],
): MLBPreTestCandidateGateIssue[] {
  if (fit.validation.rowCount !== plan.splitCounts.validation) {
    pushIssue(issues, 'ROW_COUNT_MISMATCH', '$.validation.rowCount', 'validation row count does not match evaluation plan');
  }
  if (reference.validationRowCount !== plan.splitCounts.validation) {
    pushIssue(issues, 'ROW_COUNT_MISMATCH', '$.reference.validationRowCount', 'reference validationRowCount does not match evaluation plan');
  }
  if (reference.trainRowCount !== plan.splitCounts.train) {
    pushIssue(issues, 'ROW_COUNT_MISMATCH', '$.reference.trainRowCount', 'reference trainRowCount does not match evaluation plan');
  }
  return issues;
}

function stableReasons(issues: MLBPreTestCandidateGateIssue[]): readonly string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const code of REASON_ORDER) {
    if (issues.some((issue) => issue.code === code) && !seen.has(code)) {
      seen.add(code);
      ordered.push(code);
    }
  }
  return ordered;
}

function deepEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function pushIssue(
  issues: MLBPreTestCandidateGateIssue[],
  code: MLBPreTestCandidateGateIssue['code'],
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}
