import {
  acquireMLBInnerDevelopmentCampaignLock,
  releaseMLBInnerDevelopmentCampaignLock,
  writeMLBInnerDevelopmentCampaignLedger,
} from '@/prediction/mlb/mlb-inner-development-campaign-ledger-store';
import {
  inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld,
  type MLBInnerDevelopmentCampaignLifecycleState,
} from '@/prediction/mlb/mlb-inner-development-campaign-lifecycle';
import {
  transformMLBInnerDevelopmentAttemptToRunning,
  transformMLBInnerDevelopmentAttemptToTerminal,
  validateMLBInnerDevelopmentCampaignLedger,
  type MLBInnerDevelopmentAttemptExecutionProvenance,
  type MLBInnerDevelopmentCampaignLedgerIssue,
  type MLBInnerDevelopmentAttemptRecord,
} from '@/prediction/mlb/mlb-inner-development-campaign-ledger';
import type { MLBInnerDevelopmentCandidateExecutionResult } from '@/prediction/mlb/mlb-inner-development-candidate-execution';

export type MLBInnerDevelopmentAttemptClaimInput = Readonly<{
  repositoryRoot: string;
  candidateRecipeId: string;
  attemptNumber: number;
  executionProvenance: MLBInnerDevelopmentAttemptExecutionProvenance;
}>;

export type MLBInnerDevelopmentAttemptClaimIssue = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

export type MLBInnerDevelopmentAttemptClaimResult =
  | Readonly<{
      ok: true;
      state: 'RUNNING_CLAIMED';
      candidateRecipeId: string;
      attemptNumber: number;
    }>
  | Readonly<{
      ok: false;
      state:
        | 'FAIL_CLOSED_LOCK_ACQUISITION_FAILED'
        | 'FAIL_CLOSED_INVALID_LEDGER'
        | 'FAIL_CLOSED_CLAIM_INVARIANT_VIOLATION'
        | 'FAIL_CLOSED_LOCK_RELEASE_FAILED';
      issues: readonly MLBInnerDevelopmentAttemptClaimIssue[];
    }>;

export async function claimMLBInnerDevelopmentAttemptForExecution(
  input: {
    repositoryRoot: string;
    candidateRecipeId: string;
    attemptNumber: number;
    executionProvenance: MLBInnerDevelopmentAttemptExecutionProvenance;
  }): Promise<MLBInnerDevelopmentAttemptClaimResult> {
  const lockResult = await acquireMLBInnerDevelopmentCampaignLock(input.repositoryRoot);
  if (!lockResult.ok) {
    return {
      ok: false,
      state: 'FAIL_CLOSED_LOCK_ACQUISITION_FAILED',
      issues: [
        {
          code: 'FAIL_CLOSED_LOCK_ACQUISITION_FAILED',
          path: '$',
          message: lockResult.issues.map(issue => issue.message).join('; '),
        },
      ],
    };
  }

  const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(input.repositoryRoot);
  if (!inspection.ok) {
    const releaseResult = await releaseMLBInnerDevelopmentCampaignLock(input.repositoryRoot, lockResult.ownershipToken);
    const releaseIssues: MLBInnerDevelopmentAttemptClaimIssue[] = [];
    if (!releaseResult.ok) {
      releaseIssues.push({
        code: 'FAIL_CLOSED_LOCK_RELEASE_FAILED',
        path: '$',
        message: releaseResult.issues.map(issue => issue.message).join('; '),
      });
    }
    return {
      ok: false,
      state: normalizeLifecycleState(inspection.state),
      issues: [
        ...inspection.issues.map(issue => ({ code: issue.code, path: issue.path, message: issue.message })),
        ...releaseIssues,
      ],
    };
  }

  const ledger = inspection.ledger;
  const transitionResult = transformMLBInnerDevelopmentAttemptToRunning(
    ledger,
    input.candidateRecipeId,
    input.attemptNumber,
    input.executionProvenance,
  );

  if (!transitionResult.ok) {
    const releaseResult = await releaseMLBInnerDevelopmentCampaignLock(input.repositoryRoot, lockResult.ownershipToken);
    const releaseIssues: MLBInnerDevelopmentAttemptClaimIssue[] = [];
    if (!releaseResult.ok) {
      releaseIssues.push({
        code: 'FAIL_CLOSED_LOCK_RELEASE_FAILED',
        path: '$',
        message: releaseResult.issues.map(issue => issue.message).join('; '),
      });
    }
    return {
      ok: false,
      state: 'FAIL_CLOSED_CLAIM_INVARIANT_VIOLATION',
      issues: [
        ...transitionResult.issues.map(issue => ({ code: issue.code, path: issue.path, message: issue.message })),
        ...releaseIssues,
      ],
    };
  }

  const updatedLedger = transitionResult.value;

  const validationResult = validateMLBInnerDevelopmentCampaignLedger(updatedLedger);
  if (!validationResult.ok) {
    const releaseResult = await releaseMLBInnerDevelopmentCampaignLock(input.repositoryRoot, lockResult.ownershipToken);
    const releaseIssues: MLBInnerDevelopmentAttemptClaimIssue[] = [];
    if (!releaseResult.ok) {
      releaseIssues.push({
        code: 'FAIL_CLOSED_LOCK_RELEASE_FAILED',
        path: '$',
        message: releaseResult.issues.map(issue => issue.message).join('; '),
      });
    }
    return {
      ok: false,
      state: 'FAIL_CLOSED_INVALID_LEDGER',
      issues: [
        ...validationResult.issues.map(issue => ({ code: issue.code, path: issue.path, message: issue.message })),
        ...releaseIssues,
      ],
    };
  }

  const validatedLedger = validationResult.value;

  const writeResult = await writeMLBInnerDevelopmentCampaignLedger(input.repositoryRoot, validatedLedger);
  if (!writeResult.ok) {
    const releaseResult = await releaseMLBInnerDevelopmentCampaignLock(input.repositoryRoot, lockResult.ownershipToken);
    const releaseIssues: MLBInnerDevelopmentAttemptClaimIssue[] = [];
    if (!releaseResult.ok) {
      releaseIssues.push({
        code: 'FAIL_CLOSED_LOCK_RELEASE_FAILED',
        path: '$',
        message: releaseResult.issues.map(issue => issue.message).join('; '),
      });
    }
    return {
      ok: false,
      state: 'FAIL_CLOSED_INVALID_LEDGER',
      issues: [
        ...writeResult.issues.map(i => ({ code: i.code, path: i.path, message: i.message })),
        ...releaseIssues,
      ],
    };
  }

  const releaseResult = await releaseMLBInnerDevelopmentCampaignLock(input.repositoryRoot, lockResult.ownershipToken);
  if (!releaseResult.ok) {
    return {
      ok: false,
      state: 'FAIL_CLOSED_LOCK_RELEASE_FAILED',
      issues: [
        {
          code: 'FAIL_CLOSED_LOCK_RELEASE_FAILED',
          path: '$',
          message: releaseResult.issues.map(issue => issue.message).join('; '),
        },
      ],
    };
  }

  return {
    ok: true,
    state: 'RUNNING_CLAIMED',
    candidateRecipeId: input.candidateRecipeId,
    attemptNumber: input.attemptNumber,
  };
}

export type MLBInnerDevelopmentAttemptFinalizeInput = Readonly<{
  repositoryRoot: string;
  candidateRecipeId: string;
  attemptNumber: number;
  executionResult: MLBInnerDevelopmentCandidateExecutionResult;
}>;

export type MLBInnerDevelopmentAttemptFinalizeIssue = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

export type MLBInnerDevelopmentAttemptFinalizeResult =
  | Readonly<{
      ok: true;
      state: 'COMPLETED_INNER_ELIGIBLE' | 'COMPLETED_INNER_REJECTED' | 'FAILED';
      candidateRecipeId: string;
      attemptNumber: number;
    }>
  | Readonly<{
      ok: false;
      state:
        | 'FAIL_CLOSED_LOCK_ACQUISITION_FAILED'
        | 'FAIL_CLOSED_INVALID_LEDGER'
        | 'FAIL_CLOSED_FINALIZE_INVARIANT_VIOLATION'
        | 'FAIL_CLOSED_LOCK_RELEASE_FAILED';
      issues: readonly MLBInnerDevelopmentAttemptFinalizeIssue[];
    }>;

export async function finalizeMLBInnerDevelopmentAttemptTerminal(
  input: {
    repositoryRoot: string;
    candidateRecipeId: string;
    attemptNumber: number;
    executionResult: MLBInnerDevelopmentCandidateExecutionResult;
  },
): Promise<MLBInnerDevelopmentAttemptFinalizeResult> {
  const lockResult = await acquireMLBInnerDevelopmentCampaignLock(input.repositoryRoot);
  if (!lockResult.ok) {
    return {
      ok: false,
      state: 'FAIL_CLOSED_LOCK_ACQUISITION_FAILED',
      issues: [
        {
          code: 'FAIL_CLOSED_LOCK_ACQUISITION_FAILED',
          path: '$',
          message: lockResult.issues.map(issue => issue.message).join('; '),
        },
      ],
    };
  }

  const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(input.repositoryRoot);
  if (!inspection.ok) {
    const releaseResult = await releaseMLBInnerDevelopmentCampaignLock(input.repositoryRoot, lockResult.ownershipToken);
    const releaseIssues: MLBInnerDevelopmentAttemptFinalizeIssue[] = [];
    if (!releaseResult.ok) {
      releaseIssues.push({
        code: 'FAIL_CLOSED_LOCK_RELEASE_FAILED',
        path: '$',
        message: releaseResult.issues.map(issue => issue.message).join('; '),
      });
    }
    return {
      ok: false,
      state: normalizeLifecycleState(inspection.state),
      issues: [
        ...inspection.issues.map(issue => ({ code: issue.code, path: issue.path, message: issue.message })),
        ...releaseIssues,
      ],
    };
  }

  const ledger = inspection.ledger;
  const transitionResult = transformMLBInnerDevelopmentAttemptToTerminal(
    ledger,
    input.candidateRecipeId,
    input.attemptNumber,
    input.executionResult,
  );

  if (!transitionResult.ok) {
    const releaseResult = await releaseMLBInnerDevelopmentCampaignLock(input.repositoryRoot, lockResult.ownershipToken);
    const releaseIssues: MLBInnerDevelopmentAttemptFinalizeIssue[] = [];
    if (!releaseResult.ok) {
      releaseIssues.push({
        code: 'FAIL_CLOSED_LOCK_RELEASE_FAILED',
        path: '$',
        message: releaseResult.issues.map(issue => issue.message).join('; '),
      });
    }
    return {
      ok: false,
      state: 'FAIL_CLOSED_FINALIZE_INVARIANT_VIOLATION',
      issues: [
        ...transitionResult.issues.map(issue => ({ code: issue.code, path: issue.path, message: issue.message })),
        ...releaseIssues,
      ],
    };
  }

  const updatedLedger = transitionResult.value;

  const validationResult = validateMLBInnerDevelopmentCampaignLedger(updatedLedger);
  if (!validationResult.ok) {
    const releaseResult = await releaseMLBInnerDevelopmentCampaignLock(input.repositoryRoot, lockResult.ownershipToken);
    const releaseIssues: MLBInnerDevelopmentAttemptFinalizeIssue[] = [];
    if (!releaseResult.ok) {
      releaseIssues.push({
        code: 'FAIL_CLOSED_LOCK_RELEASE_FAILED',
        path: '$',
        message: releaseResult.issues.map(issue => issue.message).join('; '),
      });
    }
    return {
      ok: false,
      state: 'FAIL_CLOSED_INVALID_LEDGER',
      issues: [
        ...validationResult.issues.map(issue => ({ code: issue.code, path: issue.path, message: issue.message })),
        ...releaseIssues,
      ],
    };
  }

  const validatedLedger = validationResult.value;

  const writeResult = await writeMLBInnerDevelopmentCampaignLedger(input.repositoryRoot, validatedLedger);
  if (!writeResult.ok) {
    const releaseResult = await releaseMLBInnerDevelopmentCampaignLock(input.repositoryRoot, lockResult.ownershipToken);
    const releaseIssues: MLBInnerDevelopmentAttemptFinalizeIssue[] = [];
    if (!releaseResult.ok) {
      releaseIssues.push({
        code: 'FAIL_CLOSED_LOCK_RELEASE_FAILED',
        path: '$',
        message: releaseResult.issues.map(issue => issue.message).join('; '),
      });
    }
    return {
      ok: false,
      state: 'FAIL_CLOSED_INVALID_LEDGER',
      issues: [
        ...writeResult.issues.map(i => ({ code: i.code, path: i.path, message: i.message })),
        ...releaseIssues,
      ],
    };
  }

  const releaseResult = await releaseMLBInnerDevelopmentCampaignLock(input.repositoryRoot, lockResult.ownershipToken);
  if (!releaseResult.ok) {
    return {
      ok: false,
      state: 'FAIL_CLOSED_LOCK_RELEASE_FAILED',
      issues: [
        {
          code: 'FAIL_CLOSED_LOCK_RELEASE_FAILED',
          path: '$',
          message: releaseResult.issues.map(issue => issue.message).join('; '),
        },
      ],
    };
  }

  const terminalAttempt = validatedLedger.attempts.find(
    attempt => attempt.candidateRecipeId === input.candidateRecipeId && attempt.attemptNumber === input.attemptNumber,
  );

  let terminalStatus: 'COMPLETED_INNER_ELIGIBLE' | 'COMPLETED_INNER_REJECTED' | 'FAILED' = 'FAILED';
  if (terminalAttempt && 'terminalExecution' in terminalAttempt) {
    if (terminalAttempt.status === 'COMPLETED_INNER_ELIGIBLE') {
      terminalStatus = 'COMPLETED_INNER_ELIGIBLE';
    } else if (terminalAttempt.status === 'COMPLETED_INNER_REJECTED') {
      terminalStatus = 'COMPLETED_INNER_REJECTED';
    } else {
      terminalStatus = 'FAILED';
    }
  }

  return {
    ok: true,
    state: terminalStatus,
    candidateRecipeId: input.candidateRecipeId,
    attemptNumber: input.attemptNumber,
  };
}

function normalizeLifecycleState(
  state: MLBInnerDevelopmentCampaignLifecycleState,
): 'FAIL_CLOSED_LOCK_ACQUISITION_FAILED' | 'FAIL_CLOSED_INVALID_LEDGER' | 'FAIL_CLOSED_LOCK_RELEASE_FAILED' {
  switch (state) {
    case 'FAIL_CLOSED_LOCK_ACQUISITION_FAILED':
      return 'FAIL_CLOSED_LOCK_ACQUISITION_FAILED';
    case 'FAIL_CLOSED_INVALID_LEDGER':
      return 'FAIL_CLOSED_INVALID_LEDGER';
    case 'FAIL_CLOSED_LOCK_RELEASE_FAILED':
      return 'FAIL_CLOSED_LOCK_RELEASE_FAILED';
    default:
      return 'FAIL_CLOSED_INVALID_LEDGER';
  }
}
