#!/usr/bin/env tsx
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  readMLBProspectiveHoldoutActivation,
  type MLBProspectiveHoldoutActivationStoreReadIssue,
  type MLBProspectiveHoldoutActivationStoreReadResult,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-store';
import {
  discoverMLBProspectiveHoldoutArtifacts,
  type MLBProspectiveHoldoutArtifactDiscoverySuccess,
  type MLBProspectiveHoldoutArtifactDiscoveryFailure,
} from '@/prediction/mlb/mlb-prospective-holdout-artifact-discovery';
import {
  buildMLBProspectiveHoldoutProgressReport,
  type MLBProspectiveHoldoutProgressReport,
  type MLBProspectiveHoldoutProgressReportError,
} from '@/prediction/mlb/mlb-prospective-holdout-progress-report';

type MLBProspectiveHoldoutArtifactDiscoveryResult =
  | MLBProspectiveHoldoutArtifactDiscoverySuccess
  | MLBProspectiveHoldoutArtifactDiscoveryFailure;

/* -------------------------------------------------------------------------- */
/*  Host-local error domain                                                   */
/* -------------------------------------------------------------------------- */

type HostErrorKind =
  | 'INVALID_ARGUMENTS'
  | 'ACTIVATION_UNAVAILABLE'
  | 'ACTIVATION_READ_FAILURE'
  | 'ACTIVATION_STATE_INVALID'
  | 'DISCOVERY_FAILURE'
  | 'PROGRESS_INTEGRITY_CONFLICT'
  | 'CAPTURE_COUNT_EXCEEDS_TARGET';

interface HostErrorIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

interface HostError {
  readonly kind: HostErrorKind;
  readonly issues: readonly HostErrorIssue[];
}

type HostResult =
  | { readonly ok: true; readonly report: MLBProspectiveHoldoutProgressReport }
  | { readonly ok: false; readonly error: HostError };

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function sortHostIssues(
  issues: readonly HostErrorIssue[],
): readonly HostErrorIssue[] {
  return Object.freeze(
    issues
      .slice()
      .sort((a, b) => (a.path < b.path ? -1 : a.path === b.path ? 0 : 1)
        || (a.code < b.code ? -1 : a.code === b.code ? 0 : 1))
      .filter((item, index, array) =>
        index === 0 || item.path !== array[index - 1].path || item.code !== array[index - 1].code,
      ),
  );
}

function pushHostIssue(
  issues: HostErrorIssue[],
  code: string,
  path: string,
  message: string,
): void {
  const exists = issues.some((item) => item.path === path && item.code === code);
  if (!exists) {
    issues.push({ code, path, message });
  }
}

function mapActivationReadError(
  issue: MLBProspectiveHoldoutActivationStoreReadIssue,
): HostErrorIssue {
  const mappedCode =
    issue.code === 'ACTIVATION_MISSING'
      ? 'ACTIVATION_UNAVAILABLE'
      : issue.code === 'ACTIVATION_IO_ERROR'
        ? 'ACTIVATION_READ_FAILURE'
        : 'ACTIVATION_STATE_INVALID';

  return {
    code: mappedCode,
    path: issue.path,
    message: issue.message,
  };
}

function deriveRepositoryRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

/* -------------------------------------------------------------------------- */
/*  Core host logic                                                           */
/* -------------------------------------------------------------------------- */

export async function runMLBProspectiveHoldoutProgress(
  argv: readonly string[],
  deps: {
    readonly readActivation: (
      repositoryRoot: string,
    ) => Promise<MLBProspectiveHoldoutActivationStoreReadResult>;
    readonly discoverArtifacts: (
      repositoryRoot: string,
      activation: unknown,
    ) => Promise<MLBProspectiveHoldoutArtifactDiscoveryResult>;
    readonly repositoryRoot?: string;
  } = {
    readActivation: (repositoryRoot) => readMLBProspectiveHoldoutActivation(repositoryRoot),
    discoverArtifacts: (repositoryRoot, activation) =>
      discoverMLBProspectiveHoldoutArtifacts(repositoryRoot, activation),
  },
): Promise<HostResult> {
  const issues: HostErrorIssue[] = [];

  // 1. Zero-argument enforcement
  if (argv.length !== 0) {
    return {
      ok: false,
      error: {
        kind: 'INVALID_ARGUMENTS',
        issues: sortHostIssues([
          {
            code: 'INVALID_ARGUMENTS',
            path: '$',
            message: 'This command accepts zero positional arguments',
          },
        ]),
      },
    };
  }

  // 2. Production repository root — no public override
  const repositoryRoot = deps.repositoryRoot ?? deriveRepositoryRoot();

  // 3. Activation read — exactly once
  const activationReadResult = await deps.readActivation(repositoryRoot);

  if (!activationReadResult.ok) {
    const mappedIssues = activationReadResult.issues.map(mapActivationReadError);
    const kind =
      mappedIssues.some((i) => i.code === 'ACTIVATION_STATE_INVALID') ?
        'ACTIVATION_STATE_INVALID' :
        mappedIssues.some((i) => i.code === 'ACTIVATION_READ_FAILURE') ?
          'ACTIVATION_READ_FAILURE' :
          'ACTIVATION_UNAVAILABLE';

    return {
      ok: false,
      error: {
        kind,
        issues: sortHostIssues(mappedIssues),
      },
    };
  }

  const validatedActivation = activationReadResult.value;

  // 4. Discovery — exactly once, only after valid activation
  const discoveryResult = await deps.discoverArtifacts(repositoryRoot, validatedActivation);

  if (!discoveryResult.ok) {
    return {
      ok: false,
      error: {
        kind: 'DISCOVERY_FAILURE',
        issues: sortHostIssues(
          discoveryResult.issues.map((issue) => ({
            code: issue.code,
            path: issue.path,
            message: issue.message,
          })),
        ),
      },
    };
  }

  const discoverySuccess = discoveryResult;

  // 5. Pure progress report construction
  const report = buildMLBProspectiveHoldoutProgressReport({
    activation: validatedActivation,
    discovery: discoverySuccess,
  });

  if ('kind' in report) {
    const error = report;
    const mappedIssues: HostErrorIssue[] = [];

    for (const issue of error.issues) {
      if (issue.code === 'CAPTURE_COUNT_EXCEEDS_TARGET') {
        pushHostIssue(mappedIssues, 'CAPTURE_COUNT_EXCEEDS_TARGET', issue.path, issue.message);
      } else if (issue.code === 'RESCHEDULE_CONFLICT') {
        pushHostIssue(mappedIssues, 'PROGRESS_INTEGRITY_CONFLICT', issue.path, issue.message);
      } else {
        pushHostIssue(mappedIssues, issue.code, issue.path, issue.message);
      }
    }

    return {
      ok: false,
      error: {
        kind: error.kind,
        issues: sortHostIssues(mappedIssues),
      },
    };
  }

  return { ok: true, report };
}

/* -------------------------------------------------------------------------- */
/*  CLI argument parsing                                                       */
/* -------------------------------------------------------------------------- */

interface ProgressCLIIO {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
}

function parseArguments(argv: string[]): void {
  if (argv.length !== 0) {
    throw new Error('This command accepts zero positional arguments');
  }
}

export async function runMLBProspectiveHoldoutProgressCLI(
  argv: readonly string[],
  io?: ProgressCLIIO,
  deps?: Parameters<typeof runMLBProspectiveHoldoutProgress>[1],
): Promise<number> {
  const stdout = io?.stdout ?? ((message: string) => process.stdout.write(`${message}\n`));
  const stderr = io?.stderr ?? ((message: string) => process.stderr.write(`${message}\n`));

  try {
    parseArguments(argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid arguments';
    stderr(JSON.stringify({ kind: 'INVALID_ARGUMENTS', issues: [{ code: 'INVALID_ARGUMENTS', path: '$', message }] }));
    return 1;
  }

  try {
    const result = await runMLBProspectiveHoldoutProgress(argv.slice(2), deps);

    if (result.ok) {
      stdout(JSON.stringify(result.report));
      return 0;
    }

    const error = result.error;
    stderr(JSON.stringify(error));
    return 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected failure';
    stderr(JSON.stringify({ kind: 'INTERNAL_ERROR', issues: [{ code: 'UNEXPECTED_ERROR', path: '$', message }] }));
    return 1;
  }
}

/* -------------------------------------------------------------------------- */
/*  Direct execution guard                                                    */
/* -------------------------------------------------------------------------- */

import { realpathSync } from 'node:fs';

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
    process.exitCode = await runMLBProspectiveHoldoutProgressCLI(process.argv);
  })();
}
