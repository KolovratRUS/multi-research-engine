/* -------------------------------------------------------------------------- */
/*  Foundation-level scientific firewall policy                               */
/* -------------------------------------------------------------------------- */

/**
 * The four source files that constitute the S1 shadow-monitoring
 * foundation layer for this phase. The firewall test audits each of
 * these for import isolation and runtime side-effect safety.
 *
 * These paths are relative to src/prediction/mlb/.
 */
export const MLB_SHADOW_MONITORING_FOUNDATION_SOURCES = [
  'mlb-shadow-monitoring-record-contract.ts',
  'mlb-shadow-monitoring-quarantine-contract.ts',
  'mlb-shadow-monitoring-namespace.ts',
  'mlb-shadow-monitoring-firewall.ts',
] as const;

/**
 * Full relative paths (from repository root) for the foundation sources,
 * used by the firewall test when reading files for static audit.
 */
export const MLB_SHADOW_MONITORING_FOUNDATION_SOURCE_PATHS = [
  'src/prediction/mlb/mlb-shadow-monitoring-record-contract.ts',
  'src/prediction/mlb/mlb-shadow-monitoring-quarantine-contract.ts',
  'src/prediction/mlb/mlb-shadow-monitoring-namespace.ts',
  'src/prediction/mlb/mlb-shadow-monitoring-firewall.ts',
] as const;

/* -------------------------------------------------------------------------- */
/*  Protected scientific paths                                                */
/* -------------------------------------------------------------------------- */

/**
 * Canonical relative paths (from repository root) that the shadow
 * namespace resolver must NEVER resolve into. These directories belong
 * to the prospective holdout / inner-development scientific state and
 * are siblings of — not descendants of — the shadow root.
 *
 * Defense-in-depth: even though lexical containment within the shadow
 * root already prevents escape, this list is checked explicitly so that
 * a future change to the root path or resolver cannot silently allow
 * traversal into these directories.
 */
export const MLB_SHADOW_MONITORING_PROTECTED_PATHS = [
  'var/mlb-development/mlb-prospective-holdout-activations',
  'var/mlb-development/mlb-prospective-pregame-evidence',
  'var/mlb-development/mlb-prospective-holdout-game-identity-bindings',
  'var/mlb-development/mlb-prospective-holdout-scheduler-runtime',
  'var/mlb-development/mlb-inner-development-campaign-ledger',
  'data/mlb/inner-development',
] as const;

/* -------------------------------------------------------------------------- */
/*  Forbidden import specifiers                                              */
/* -------------------------------------------------------------------------- */

/**
 * Foundation modules MUST NOT import any of these specifiers. They are
 * scientific-state writers / capture orchestrators that must remain
 * isolated from the S1 operational-blind shadow layer.
 *
 * Matching is substring-based on the import module specifier. The
 * namespace module may safely import `./mlb-shadow-monitoring-firewall`
 * because that name is not in this list.
 */
export const MLB_SHADOW_MONITORING_FORBIDDEN_IMPORTS = [
  'mlb-prospective-holdout-capture-orchestrator',
  'scripts/mlb-prospective-holdout-capture',
  'mlb-prospective-holdout-activation-store',
  'mlb-prospective-pregame-evidence-store',
  'mlb-prospective-holdout-game-identity-binding-store',
  'mlb-prospective-holdout-scheduler',
] as const;

/* -------------------------------------------------------------------------- */
/*  Runtime side-effect primitives to audit                                   */
/* -------------------------------------------------------------------------- */

/**
 * Regex patterns that must not appear as call sites in any foundation
 * source file. Used by the firewall test's static side-effect audit.
 *
 * These patterns match method calls (with optional whitespace before the
 * opening paren) rather than bare substrings, to avoid false positives
 * in comments or string literals.
 */
export const MLB_SHADOW_MONITORING_FORBIDDEN_SIDE_EFFECT_PATTERNS = [
  /writeFileSync?\s*\(/,
  /appendFileSync?\s*\(/,
  /mkdirSync?\s*\(/,
  /rmSync?\s*\(/,
  /\brename\s*\(/,
  /\blink\s*\(/,
  /\bsymlink\s*\(/,
  /\bunlink\s*\(/,
  /\bfetch\s*\(/,
  /\baxios\b/,
  /\bMLBStatsAPIClient\b/,
  /\brunProspectiveHoldoutCapture\b/,
  /\brunMLBProspectiveHoldoutScheduler\b/,
] as const;

/**
 * Module specifiers whose import into any foundation source constitutes
 * a runtime side-effect risk (filesystem or crypto primitives).
 */
export const MLB_SHADOW_MONITORING_FORBIDDEN_IO_MODULES = [
  'node:fs',
  'node:fs/promises',
  'node:crypto',
] as const;

/* -------------------------------------------------------------------------- */
/*  Scientific-use claim                                                      */
/* -------------------------------------------------------------------------- */

/**
 * L5E2P establishes:
 *  - data-contract separation
 *  - namespace separation
 *  - import firewall
 *  - validator separation
 *
 * It does NOT yet establish OS-level ACLs or cryptographic secrecy.
 * True human-access enforcement requires filesystem permissions or a
 * separate process boundary; see L5E2R/S/T for that layer.
 */
export const MLB_SHADOW_MONITORING_HUMAN_ACCESS_ENFORCEMENT =
  'CONTRACTUAL_FOUNDATION_ONLY' as const;
