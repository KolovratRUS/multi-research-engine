import {
  MLB_INNER_DEVELOPMENT_CYCLE_ID,
  MLBInnerCandidateRecipe,
  computeMLBInnerCandidateRecipeFingerprint,
  recordInnerCandidateRecipeExecution,
} from '@/prediction/mlb/mlb-train-only-inner-development-evaluator';
import {
  MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN,
  MLBFoldDefinition,
} from '@/prediction/mlb/mlb-train-only-inner-fold-plan';
import {
  MLBInnerDevelopmentCampaignLedger,
  validateMLBInnerDevelopmentCampaignLedger,
  MLBInnerDevelopmentRegisteredRecipeRecord,
  MLBInnerDevelopmentAttemptRecord,
} from '@/prediction/mlb/mlb-inner-development-campaign-ledger';
import {
  resolveMLBInnerDevelopmentCampaignLedgerStorePaths,
  writeMLBInnerDevelopmentCampaignLedger,
  acquireMLBInnerDevelopmentCampaignLock,
  releaseMLBInnerDevelopmentCampaignLock,
} from '@/prediction/mlb/mlb-inner-development-campaign-ledger-store';
import {
  MLBInnerDevelopmentCampaignLifecycleState,
  inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld,
} from '@/prediction/mlb/mlb-inner-development-campaign-lifecycle';

export type MLBInnerDevelopmentCampaignRegistrationFailureState =
  | MLBInnerDevelopmentCampaignLifecycleState
  | 'FAIL_CLOSED_INVALID_REGISTRATION_INPUT'
  | 'IDENTITY_ALIAS_CONFLICT'
  | 'IDENTITY_MUTATION_CONFLICT'
  | 'COMPLEXITY_RANK_MISMATCH'
  | 'BUDGET_EXHAUSTED'
  | 'FAIL_CLOSED_LOCK_ACQUISITION_FAILED'
  | 'FAIL_CLOSED_LOCK_RELEASE_FAILED'
  | 'FAIL_CLOSED_REGISTRATION_INVARIANT_VIOLATION'
  | 'WRITE_FAILED';

function classifyBudgetIssue(
  issue: { code: string; path: string; message: string },
): MLBInnerDevelopmentCampaignRegistrationFailureState {
  switch (issue.code) {
    case 'IDENTITY_ALIAS_CONFLICT':
      return 'IDENTITY_ALIAS_CONFLICT';
    case 'IDENTITY_MUTATION_CONFLICT':
      return 'IDENTITY_MUTATION_CONFLICT';
    case 'COMPLEXITY_RANK_MISMATCH':
      return 'COMPLEXITY_RANK_MISMATCH';
    case 'BUDGET_EXHAUSTED':
      return 'BUDGET_EXHAUSTED';
    default:
      return 'FAIL_CLOSED_REGISTRATION_INVARIANT_VIOLATION';
  }
}

function classifyValidationIssue(
  issue: { code: string; path: string; message: string },
): MLBInnerDevelopmentCampaignRegistrationFailureState {
  switch (issue.code) {
    case 'RECIPE_COUNT_MISMATCH':
    case 'ATTEMPT_COUNT_MISMATCH':
      return 'FAIL_CLOSED_REGISTRATION_INVARIANT_VIOLATION';
    default:
      return 'FAIL_CLOSED_INVALID_LEDGER';
  }
}

function classifyWriteIssue(
  issue: { code: string; path: string; message: string },
): MLBInnerDevelopmentCampaignRegistrationFailureState {
  switch (issue.code) {
    case 'LOCK_ACQUISITION_FAILED':
      return 'FAIL_CLOSED_LOCK_ACQUISITION_FAILED';
    case 'WRITE_FAILED':
      return 'WRITE_FAILED';
    default:
      return 'FAIL_CLOSED_INVALID_LEDGER';
  }
}
const FAIL_CLOSED_INVALID_REGISTRATION_INPUT = 'FAIL_CLOSED_INVALID_REGISTRATION_INPUT' as const;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

function validateCanonicalTimestamp(value: unknown, path: string): { ok: true } | { ok: false; issue: MLBInnerDevelopmentCampaignRegistrationIssue } {
  if (typeof value !== 'string') {
    return {
      ok: false,
      issue: {
        code: 'INVALID_INPUT',
        path,
        message: 'timestamp must be ISO-8601 UTC',
      },
    };
  }

  if (!TIMESTAMP_PATTERN.test(value)) {
    return {
      ok: false,
      issue: {
        code: 'INVALID_INPUT',
        path,
        message: 'timestamp must be ISO-8601 UTC',
      },
    };
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{3})?Z$/);
  if (!match) {
    return {
      ok: false,
      issue: {
        code: 'INVALID_INPUT',
        path,
        message: 'timestamp must be ISO-8601 UTC',
      },
    };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  if (month < 1 || month > 12) {
    return {
      ok: false,
      issue: {
        code: 'INVALID_INPUT',
        path,
        message: 'timestamp month must be between 01 and 12',
      },
    };
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return {
      ok: false,
      issue: {
        code: 'INVALID_INPUT',
        path,
        message: 'timestamp day must be valid for the month',
      },
    };
  }

  if (hour < 0 || hour > 23) {
    return {
      ok: false,
      issue: {
        code: 'INVALID_INPUT',
        path,
        message: 'timestamp hour must be between 00 and 23',
      },
    };
  }

  if (minute < 0 || minute > 59) {
    return {
      ok: false,
      issue: {
        code: 'INVALID_INPUT',
        path,
        message: 'timestamp minute must be between 00 and 59',
      },
    };
  }

  if (second < 0 || second > 59) {
    return {
      ok: false,
      issue: {
        code: 'INVALID_INPUT',
        path,
        message: 'timestamp second must be between 00 and 59',
      },
    };
  }

  return { ok: true };
}

export type MLBInnerDevelopmentCampaignRegistrationInput = Readonly<{
  candidateRecipe: MLBInnerCandidateRecipe;
  registrationTimestamp: string;
  attemptTimestamp: string;
}>;

export type MLBInnerDevelopmentCampaignRegistrationSuccess = Readonly<{
  candidateRecipeId: string;
  recipeFingerprint: string;
  registrationSequence: number;
  attemptNumber: number;
  distinctRecipeCount: number;
  evaluationCount: number;
}>;

export type MLBInnerDevelopmentCampaignRegistrationIssue = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

export type MLBInnerDevelopmentCampaignRegistrationResult =
  | Readonly<{ ok: true; value: MLBInnerDevelopmentCampaignRegistrationSuccess }>
  | Readonly<{
      ok: false;
      state: MLBInnerDevelopmentCampaignRegistrationFailureState;
      issues: readonly MLBInnerDevelopmentCampaignRegistrationIssue[];
    }>;

function validateInput(
  input: MLBInnerDevelopmentCampaignRegistrationInput,
): { ok: true } | { ok: false; state: typeof FAIL_CLOSED_INVALID_REGISTRATION_INPUT; issues: MLBInnerDevelopmentCampaignRegistrationIssue[] } {
  const issues: MLBInnerDevelopmentCampaignRegistrationIssue[] = [];

  const registrationTimestampCheck = validateCanonicalTimestamp(input.registrationTimestamp, '$.registrationTimestamp');
  if (!registrationTimestampCheck.ok) {
    issues.push(registrationTimestampCheck.issue);
  }

  const attemptTimestampCheck = validateCanonicalTimestamp(input.attemptTimestamp, '$.attemptTimestamp');
  if (!attemptTimestampCheck.ok) {
    issues.push(attemptTimestampCheck.issue);
  }

  const fingerprintResult = computeMLBInnerCandidateRecipeFingerprint(input.candidateRecipe);
  if (!fingerprintResult.ok) {
    for (const issue of fingerprintResult.issues) {
      issues.push({
        code: 'INVALID_INPUT',
        path: issue.path,
        message: issue.message,
      });
    }
  }

  if (issues.length > 0) {
    return { ok: false, state: FAIL_CLOSED_INVALID_REGISTRATION_INPUT, issues };
  }

  return { ok: true };
}

function buildRegisteredRecipeRecord(
  recipe: MLBInnerCandidateRecipe,
  registrationSequence: number,
  registrationTimestamp: string,
  recipeFingerprint: string,
): MLBInnerDevelopmentRegisteredRecipeRecord {
  return {
    candidateRecipeId: recipe.candidateRecipeId,
    registrationSequence,
    registrationTimestamp,
    recipeFingerprint,
    complexityRank: recipe.complexityRank,
    preprocessingPolicyId: recipe.preprocessingPolicyId,
    featurePolicyId: recipe.featurePolicyId,
    modelFamilyId: recipe.modelFamilyId,
    regularizationConfig: recipe.regularizationConfig,
    optimizerConfig: recipe.optimizerConfig,
    otherModelAffectingChoices: recipe.otherModelAffectingChoices,
  };
}

function buildAttemptRecord(
  recipe: MLBInnerCandidateRecipe,
  attemptNumber: number,
  registrationTimestamp: string,
  attemptTimestamp: string,
  recipeFingerprint: string,
): MLBInnerDevelopmentAttemptRecord {
  return {
    attemptNumber,
    candidateRecipeId: recipe.candidateRecipeId,
    recipeFingerprint,
    complexityRank: recipe.complexityRank,
    developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
    status: 'REGISTERED',
    attemptTimestamp,
    foldIds: MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN.folds.map((fold: MLBFoldDefinition) => fold.foldId),
  };
}

function computeNextAttemptNumber(
  existingAttempts: readonly MLBInnerDevelopmentAttemptRecord[],
  candidateRecipeId: string,
): number {
  let maxAttempt = 0;
  for (const attempt of existingAttempts) {
    if (attempt.candidateRecipeId === candidateRecipeId && attempt.attemptNumber > maxAttempt) {
      maxAttempt = attempt.attemptNumber;
    }
  }
  return maxAttempt + 1;
}

export async function registerMLBInnerDevelopmentCampaignCandidate(
  repositoryRoot: string,
  input: MLBInnerDevelopmentCampaignRegistrationInput,
): Promise<MLBInnerDevelopmentCampaignRegistrationResult> {
  const preLockValidation = validateInput(input);
  if (!preLockValidation.ok) {
    return {
      ok: false,
      state: preLockValidation.state,
      issues: preLockValidation.issues,
    };
  }

  const fingerprintResult = computeMLBInnerCandidateRecipeFingerprint(input.candidateRecipe);
  if (!fingerprintResult.ok) {
    return {
      ok: false,
      state: FAIL_CLOSED_INVALID_REGISTRATION_INPUT,
      issues: fingerprintResult.issues.map(i => ({
        code: i.code,
        path: i.path,
        message: i.message,
      })) as MLBInnerDevelopmentCampaignRegistrationIssue[],
    };
  }
  const canonicalFingerprint = (fingerprintResult as { ok: true; fingerprint: string }).fingerprint;

  const lockResult = await acquireMLBInnerDevelopmentCampaignLock(repositoryRoot);
  if (!lockResult.ok) {
    return {
      ok: false,
      state: 'FAIL_CLOSED_LOCK_ACQUISITION_FAILED',
      issues: [
        {
          code: 'LOCK_ACQUISITION_FAILED',
          path: '$',
          message: lockResult.issues.map(i => i.message).join('; '),
        },
      ],
    };
  }

  const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(repositoryRoot);
  let result: MLBInnerDevelopmentCampaignRegistrationResult = {
    ok: false,
    state: 'FAIL_CLOSED_INVALID_LEDGER',
    issues: [
      {
        code: 'FAIL_CLOSED_INVALID_LEDGER',
        path: '$',
        message: 'Uninitialized',
      },
    ],
  };
  let lockReleased = false;

  try {
    const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(repositoryRoot);

    if (!inspection.ok) {
      result = {
        ok: false,
        state: inspection.state,
        issues: inspection.issues as MLBInnerDevelopmentCampaignRegistrationIssue[],
      };
      return result;
    }

    const ledger = inspection.ledger;
    const budgetResult = recordInnerCandidateRecipeExecution(ledger.budget, input.candidateRecipe);

    if (!budgetResult.ok) {
      result = {
        ok: false,
        state: classifyBudgetIssue(budgetResult.issues[0]),
        issues: budgetResult.issues.map(i => ({
          code: i.code,
          path: i.path,
          message: i.message,
        })) as MLBInnerDevelopmentCampaignRegistrationIssue[],
      };
      return result;
    }

    const newBudget = budgetResult.value;
    const existingIdIndex = ledger.budget.seenRecipeIds.indexOf(input.candidateRecipe.candidateRecipeId);
    const isNewDistinct = existingIdIndex === -1;

    const nextRegistrationSequence = isNewDistinct
      ? ledger.registeredRecipes.length + 1
      : ledger.registeredRecipes[existingIdIndex].registrationSequence;
    const registeredRecipe = buildRegisteredRecipeRecord(
      input.candidateRecipe,
      nextRegistrationSequence,
      input.registrationTimestamp,
      canonicalFingerprint,
    );

    const nextAttemptNumber = computeNextAttemptNumber(ledger.attempts, input.candidateRecipe.candidateRecipeId);
    const attemptRecord = buildAttemptRecord(
      input.candidateRecipe,
      nextAttemptNumber,
      input.registrationTimestamp,
      input.attemptTimestamp,
      canonicalFingerprint,
    );

    const updatedLedger: MLBInnerDevelopmentCampaignLedger = {
      ledgerContractVersion: ledger.ledgerContractVersion,
      developmentCycleId: ledger.developmentCycleId,
      createdAt: ledger.createdAt,
      updatedAt: input.registrationTimestamp,
      budget: newBudget,
      registeredRecipes: isNewDistinct ? [...ledger.registeredRecipes, registeredRecipe] : ledger.registeredRecipes,
      attempts: [...ledger.attempts, attemptRecord],
    };

    const validation = validateMLBInnerDevelopmentCampaignLedger(updatedLedger);
    if (!validation.ok) {
      result = {
        ok: false,
        state: 'FAIL_CLOSED_INVALID_LEDGER',
        issues: validation.issues.map(i => ({
          code: i.code,
          path: i.path,
          message: i.message,
        })) as MLBInnerDevelopmentCampaignRegistrationIssue[],
      };
      return result;
    }

    const writeResult = await writeMLBInnerDevelopmentCampaignLedger(repositoryRoot, validation.value);
    if (!writeResult.ok) {
      result = {
        ok: false,
        state: 'FAIL_CLOSED_INVALID_LEDGER',
        issues: writeResult.issues.map(i => ({
          code: 'WRITE_FAILED',
          path: i.path,
          message: i.message,
        })),
      };
      return result;
    }

    result = {
      ok: true,
      value: {
        candidateRecipeId: input.candidateRecipe.candidateRecipeId,
        recipeFingerprint: canonicalFingerprint,
        registrationSequence: nextRegistrationSequence,
        attemptNumber: nextAttemptNumber,
        distinctRecipeCount: newBudget.seenRecipeIds.length,
        evaluationCount: newBudget.evaluationCount,
      },
    };
    return result;
  } finally {
    if (!lockReleased) {
      const releaseResult = await releaseMLBInnerDevelopmentCampaignLock(repositoryRoot, lockResult.ownershipToken);
      if (!releaseResult.ok) {
        const lockIssue: MLBInnerDevelopmentCampaignRegistrationIssue = {
          code: 'LOCK_RELEASE_FAILED',
          path: paths.lockPath,
          message: releaseResult.issues.map(i => i.message).join('; '),
        };
        if (result.ok) {
          result = {
            ok: false,
            state: 'FAIL_CLOSED_LOCK_RELEASE_FAILED',
            issues: [lockIssue],
          };
        } else {
          result = {
            ok: false,
            state: result.state,
            issues: [...result.issues, lockIssue],
          };
        }
      }
      lockReleased = true;
    }
  }
}
