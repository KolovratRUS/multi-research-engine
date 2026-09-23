import path from 'node:path';

import {
  MLB_SHADOW_MONITORING_PROTECTED_PATHS,
} from './mlb-shadow-monitoring-firewall';

/* Re-export for consumers that only need the namespace module. */
export { MLB_SHADOW_MONITORING_PROTECTED_PATHS };

/* -------------------------------------------------------------------------- */
/*  Canonical namespace root + descendant directories                          */
/* -------------------------------------------------------------------------- */

/**
 * Root of all S1 shadow-monitoring runtime state.
 * This phase does NOT create this directory or any descendants.
 */
export const MLB_SHADOW_MONITORING_NAMESPACE_ROOT =
  'var/mlb-development/mlb-shadow-monitoring' as const;

/**
 * Non-sensitive operational metadata lives here.
 * No prediction values, outcomes, or performance metrics are stored here.
 */
export const MLB_SHADOW_MONITORING_OPERATIONAL_NAMESPACE =
  'var/mlb-development/mlb-shadow-monitoring/operational' as const;

/**
 * Sensitive prediction payloads are quarantined here (not for grading).
 */
export const MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE =
  'var/mlb-development/mlb-shadow-monitoring/quarantine/predictions' as const;

/**
 * Sensitive outcome payloads are quarantined here (not for grading).
 */
export const MLB_SHADOW_MONITORING_QUARANTINE_OUTCOMES_NAMESPACE =
  'var/mlb-development/mlb-shadow-monitoring/quarantine/outcomes' as const;

/**
 * Sensitive grading payloads are quarantined here (not for grading).
 */
export const MLB_SHADOW_MONITORING_QUARANTINE_GRADING_NAMESPACE =
  'var/mlb-development/mlb-shadow-monitoring/quarantine/grading' as const;

/* -------------------------------------------------------------------------- */
/*  Descendant namespace relative paths (relative to root)                     */
/* -------------------------------------------------------------------------- */

export const MLB_SHADOW_MONITORING_OPERATIONAL_RELATIVE =
  'operational' as const;

export const MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_RELATIVE =
  'quarantine/predictions' as const;

export const MLB_SHADOW_MONITORING_QUARANTINE_OUTCOMES_RELATIVE =
  'quarantine/outcomes' as const;

export const MLB_SHADOW_MONITORING_QUARANTINE_GRADING_RELATIVE =
  'quarantine/grading' as const;

/* -------------------------------------------------------------------------- */
/*  Path-resolution result type                                                */
/* -------------------------------------------------------------------------- */

export type MLBShadowMonitoringNamespacePath = Readonly<{
  repositoryRoot: string;
  shadowRoot: string;
  relativeToRoot: string;
  resolved: string;
}>;

/* -------------------------------------------------------------------------- */
/*  Internal path helpers                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Returns true when `resolvedPath` is lexically contained within
 * `directory` (i.e. `resolvedPath` is `directory` itself or a descendant).
 *
 * Uses path.resolve + path.relative — not naive string prefix checks —
 * to avoid false positives such as `/a/b` matching `/a/bc`.
 */
function isLexicallyContained(
  resolvedPath: string,
  directory: string,
): boolean {
  const rel = path.relative(directory, resolvedPath);
  if (rel === '') {
    return true;
  }
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

/* -------------------------------------------------------------------------- */
/*  Safe path resolvers                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Validates that `repositoryRoot` is an absolute, non-empty string.
 */
function validateRepositoryRoot(repositoryRoot: string): void {
  if (
    !repositoryRoot ||
    typeof repositoryRoot !== 'string' ||
    !path.isAbsolute(repositoryRoot)
  ) {
    throw new TypeError(
      'repositoryRoot must be an absolute non-empty string',
    );
  }
}

/**
 * Resolves `relativePath` (relative to the shadow-monitoring root) to an
 * absolute path, rejecting any input that would escape the shadow
 * namespace or resolve into a protected scientific directory.
 *
 * This function is PURE: it does not touch the filesystem. No mkdir,
 * writeFile, appendFile, open, rename, link, or fsync is invoked.
 */
export function resolveShadowMonitoringNamespacePath(
  repositoryRoot: string,
  relativePath: string,
): MLBShadowMonitoringNamespacePath {
  validateRepositoryRoot(repositoryRoot);

  if (!relativePath || typeof relativePath !== 'string') {
    throw new TypeError('relativePath must be a non-empty string');
  }

  // Reject null bytes before any path resolution. Null bytes in path strings
  // can be used to truncate or confuse downstream consumers and must never
  // reach path.resolve or filesystem primitives.
  if (relativePath.includes('\x00')) {
    throw new TypeError('relativePath must not contain null bytes');
  }

  const root = path.resolve(repositoryRoot);
  const shadowRoot = path.resolve(
    root,
    MLB_SHADOW_MONITORING_NAMESPACE_ROOT,
  );
  const resolved = path.resolve(shadowRoot, relativePath);

  // Containment: resolved path must be inside the shadow root.
  if (!isLexicallyContained(resolved, shadowRoot)) {
    throw new RangeError(
      `Path escapes shadow-monitoring namespace: ${relativePath}`,
    );
  }

  // Defense-in-depth: resolved path must never land inside a protected
  // scientific directory, even though containment already prevents escape
  // (protected dirs are siblings of the shadow root, not descendants).
  const relativeToRoot = path.relative(shadowRoot, resolved) || '.';
  for (const protectedPath of MLB_SHADOW_MONITORING_PROTECTED_PATHS) {
    const protectedResolved = path.resolve(root, protectedPath);
    if (isLexicallyContained(resolved, protectedResolved)) {
      throw new RangeError(
        `Path resolves into protected scientific directory: ${protectedPath}`,
      );
    }
  }

  return {
    repositoryRoot: root,
    shadowRoot,
    relativeToRoot,
    resolved,
  };
}

/**
 * Convenience: resolve the operational namespace directory.
 */
export function resolveShadowMonitoringOperationalPath(
  repositoryRoot: string,
): MLBShadowMonitoringNamespacePath {
  return resolveShadowMonitoringNamespacePath(
    repositoryRoot,
    MLB_SHADOW_MONITORING_OPERATIONAL_RELATIVE,
  );
}

/**
 * Convenience: resolve the prediction quarantine directory.
 */
export function resolveShadowMonitoringQuarantinePredictionsPath(
  repositoryRoot: string,
): MLBShadowMonitoringNamespacePath {
  return resolveShadowMonitoringNamespacePath(
    repositoryRoot,
    MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_RELATIVE,
  );
}

/**
 * Convenience: resolve the outcome quarantine directory.
 */
export function resolveShadowMonitoringQuarantineOutcomesPath(
  repositoryRoot: string,
): MLBShadowMonitoringNamespacePath {
  return resolveShadowMonitoringNamespacePath(
    repositoryRoot,
    MLB_SHADOW_MONITORING_QUARANTINE_OUTCOMES_RELATIVE,
  );
}

/**
 * Convenience: resolve the grading quarantine directory.
 */
export function resolveShadowMonitoringQuarantineGradingPath(
  repositoryRoot: string,
): MLBShadowMonitoringNamespacePath {
  return resolveShadowMonitoringNamespacePath(
    repositoryRoot,
    MLB_SHADOW_MONITORING_QUARANTINE_GRADING_RELATIVE,
  );
}

/**
 * Returns true when `resolvedPath` is lexically contained within the
 * shadow-monitoring namespace root.
 *
 * `resolvedPath` MUST already be resolved (absolute). Pass the output of
 * `resolveShadowMonitoringNamespacePath` or `path.resolve`.
 */
export function isWithinShadowMonitoringRoot(
  resolvedPath: string,
  repositoryRoot: string,
): boolean {
  validateRepositoryRoot(repositoryRoot);
  const root = path.resolve(repositoryRoot);
  const shadowRoot = path.resolve(
    root,
    MLB_SHADOW_MONITORING_NAMESPACE_ROOT,
  );
  return isLexicallyContained(resolvedPath, shadowRoot);
}

/**
 * Returns true when `resolvedPath` is lexically contained within any of
 * the protected scientific directories.
 *
 * `resolvedPath` MUST already be resolved (absolute).
 */
export function isWithinProtectedScientificPath(
  resolvedPath: string,
  repositoryRoot: string,
): boolean {
  validateRepositoryRoot(repositoryRoot);
  const root = path.resolve(repositoryRoot);
  for (const protectedPath of MLB_SHADOW_MONITORING_PROTECTED_PATHS) {
    const protectedResolved = path.resolve(root, protectedPath);
    if (isLexicallyContained(resolvedPath, protectedResolved)) {
      return true;
    }
  }
  return false;
}
