import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_DIRECTORY,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
  type MLBProspectivePregameEvidence,
  type MLBProspectivePregameEvidencePrepared,
  type MLBProspectivePregameEvidenceReceipt,
  computeArtifactId,
  validateMLBProspectivePregameEvidence,
} from './mlb-prospective-pregame-evidence-artifact-contract';
import {
  deriveArtifactRelativePath,
  readProspectivePregameEvidence,
} from './mlb-prospective-pregame-evidence-store';
import {
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_DIRECTORY,
  type MLBProspectiveHoldoutGameIdentityBinding,
  type MLBProspectiveHoldoutGameIdentityBindingReceipt,
  type MLBProspectiveHoldoutGameIdentityBindingPrepared,
  computeBindingId,
  validateMLBProspectiveHoldoutGameIdentityBinding,
} from './mlb-prospective-holdout-game-identity-binding-contract';
import {
  deriveBindingRelativePath,
  readProspectiveHoldoutGameIdentityBinding,
} from './mlb-prospective-holdout-game-identity-binding-store';
import {
  validateMLBProspectiveHoldoutActivationPersisted,
  type MLBProspectiveHoldoutActivationPersisted,
} from './mlb-prospective-holdout-activation-contract';
import {
  type MLBProspectiveHoldoutCohortRegistrationCandidate,
} from './mlb-prospective-holdout-cohort-registration';

/* -------------------------------------------------------------------------- */
/*  Diagnostics                                                               */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveHoldoutArtifactDiscoveryIssue = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

export type MLBProspectiveHoldoutArtifactEvidenceRecord = Readonly<{
  evidence: MLBProspectivePregameEvidence;
  receipt: MLBProspectivePregameEvidenceReceipt;
}>;

export type MLBProspectiveHoldoutArtifactBindingRecord = Readonly<{
  binding: MLBProspectiveHoldoutGameIdentityBinding;
  receipt: MLBProspectiveHoldoutGameIdentityBindingReceipt;
}>;

export type MLBProspectiveHoldoutArtifactRescheduleConflict = Readonly<{
  activationId: string;
  protocolId: string;
  gamePk: number;
  bindingIds: readonly string[];
  evidenceArtifactIds: readonly string[];
  scheduledStartAts: readonly string[];
  officialDates: readonly string[];
}>;

export type MLBProspectiveHoldoutArtifactDiscoveryCandidate =
  MLBProspectiveHoldoutCohortRegistrationCandidate;

export type MLBProspectiveHoldoutArtifactDiscoverySuccess = Readonly<{
  ok: true;
  candidates: readonly MLBProspectiveHoldoutArtifactDiscoveryCandidate[];
  orphanEvidence: readonly MLBProspectiveHoldoutArtifactEvidenceRecord[];
  rescheduleConflicts: readonly MLBProspectiveHoldoutArtifactRescheduleConflict[];
  temporaryDebris: readonly string[];
  unknownFiles: readonly string[];
  foreignArtifactSummary: Readonly<{
    foreignEvidenceCount: number;
    foreignBindingCount: number;
  }>;
}>;

export type MLBProspectiveHoldoutArtifactDiscoveryFailure = Readonly<{
  ok: false;
  issues: readonly MLBProspectiveHoldoutArtifactDiscoveryIssue[];
}>;

export type MLBProspectiveHoldoutArtifactDiscoveryResult =
  | MLBProspectiveHoldoutArtifactDiscoverySuccess
  | MLBProspectiveHoldoutArtifactDiscoveryFailure;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const CANONICAL_FILENAME_PATTERN = /^[a-f0-9]{64}\.json$/;
const TEMP_FILENAME_SUFFIX = '.tmp-';

function isCanonicalFilename(name: string): boolean {
  return CANONICAL_FILENAME_PATTERN.test(name);
}

function isTempFilename(name: string): boolean {
  return name.includes(TEMP_FILENAME_SUFFIX);
}

function isHex64(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function sortIssues(
  issues: MLBProspectiveHoldoutArtifactDiscoveryIssue[],
): readonly MLBProspectiveHoldoutArtifactDiscoveryIssue[] {
  return issues
    .slice()
    .sort((a, b) => (a.path < b.path ? -1 : a.path === b.path ? 0 : 1)
      || (a.code < b.code ? -1 : a.code === b.code ? 0 : 1))
    .filter((item, index, array) =>
      index === 0 || item.path !== array[index - 1].path || item.code !== array[index - 1].code,
    );
}

function pushIssue(
  issues: MLBProspectiveHoldoutArtifactDiscoveryIssue[],
  code: string,
  path: string,
  message: string,
): void {
  const exists = issues.some((item) => item.path === path && item.code === code);
  if (!exists) {
    issues.push({ code, path, message });
  }
}

/* -------------------------------------------------------------------------- */
/*  Directory enumeration                                                     */
/* -------------------------------------------------------------------------- */

async function listStoreDirectory(
  dir: string,
): Promise<{
  regularFiles: string[];
  temporaryDebris: string[];
  unknownFiles: string[];
  subdirectories: string[];
  symlinks: string[];
}> {
  const regularFiles: string[] = [];
  const temporaryDebris: string[] = [];
  const unknownFiles: string[] = [];
  const subdirectories: string[] = [];
  const symlinks: string[] = [];

  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return { regularFiles, temporaryDebris, unknownFiles, subdirectories, symlinks };
    }
    throw error;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    let stats: import('node:fs').Stats;
    try {
      stats = await fs.lstat(fullPath);
    } catch {
      continue;
    }

    if (stats.isSymbolicLink()) {
      symlinks.push(fullPath);
    } else if (stats.isDirectory()) {
      subdirectories.push(fullPath);
    } else if (stats.isFile()) {
      if (isTempFilename(entry)) {
        temporaryDebris.push(fullPath);
      } else if (isCanonicalFilename(entry)) {
        regularFiles.push(fullPath);
      } else if (entry.endsWith('.json')) {
        unknownFiles.push(fullPath);
      } else {
        unknownFiles.push(fullPath);
      }
    } else {
      unknownFiles.push(fullPath);
    }
  }

  return { regularFiles, temporaryDebris, unknownFiles, subdirectories, symlinks };
}

/* -------------------------------------------------------------------------- */
/*  Evidence discovery pipeline                                               */
/* -------------------------------------------------------------------------- */

async function discoverEvidenceDirectory(
  repositoryRoot: string,
  evidenceDir: string,
  activation: MLBProspectiveHoldoutActivationPersisted,
): Promise<{
  evidenceMap: Map<string, MLBProspectiveHoldoutArtifactEvidenceRecord>;
  temporaryDebris: string[];
  unknownFiles: string[];
  issues: MLBProspectiveHoldoutArtifactDiscoveryIssue[];
  foreignEvidenceCount: number;
}> {
  const evidenceMap = new Map<string, MLBProspectiveHoldoutArtifactEvidenceRecord>();
  const temporaryDebris: string[] = [];
  const unknownFiles: string[] = [];
  const issues: MLBProspectiveHoldoutArtifactDiscoveryIssue[] = [];
  let foreignEvidenceCount = 0;

  let enumeration;
  try {
    enumeration = await listStoreDirectory(evidenceDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown IO error';
    pushIssue(issues, 'EVIDENCE_DIRECTORY_IO_ERROR', evidenceDir, message);
    return { evidenceMap, temporaryDebris, unknownFiles, issues, foreignEvidenceCount };
  }

  if (enumeration.symlinks.length > 0) {
    for (const symlink of enumeration.symlinks) {
      pushIssue(issues, 'EVIDENCE_SYMLINK_DETECTED', symlink, 'Symlink detected inside evidence store directory');
    }
  }

  if (enumeration.subdirectories.length > 0) {
    for (const subdir of enumeration.subdirectories) {
      pushIssue(issues, 'EVIDENCE_SUBDIRECTORY_DETECTED', subdir, 'Unexpected subdirectory inside evidence store directory');
    }
  }

  temporaryDebris.push(...enumeration.temporaryDebris.sort());

  for (const unknownFile of enumeration.unknownFiles.sort()) {
    unknownFiles.push(unknownFile);
  }

  if (issues.length > 0) {
    return { evidenceMap, temporaryDebris, unknownFiles, issues, foreignEvidenceCount };
  }

  for (const artifactPath of enumeration.regularFiles.sort()) {
    const basename = path.basename(artifactPath);
    const relativePath = path.relative(
      path.resolve(evidenceDir),
      artifactPath,
    );

    let rawBuffer: Buffer;
    try {
      rawBuffer = await fs.readFile(artifactPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown IO error';
      pushIssue(issues, 'EVIDENCE_READ_FAILED', artifactPath, message);
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBuffer.toString('utf-8'));
    } catch {
      pushIssue(issues, 'EVIDENCE_JSON_INVALID', artifactPath, 'Evidence artifact contains invalid JSON');
      continue;
    }

    const validation = validateMLBProspectivePregameEvidence(parsed);
    if (!validation.ok) {
      const mappedIssues: MLBProspectiveHoldoutArtifactDiscoveryIssue[] = validation.issues.map(
        (issue): MLBProspectiveHoldoutArtifactDiscoveryIssue => ({
          code: 'EVIDENCE_CONTRACT_INVALID',
          path: artifactPath,
          message: issue.message,
        }),
      );
      issues.push(...mappedIssues);
      continue;
    }

    const evidence = validation.value;

    let artifactId: string;
    try {
      artifactId = computeArtifactId(evidence);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown artifact ID computation error';
      pushIssue(issues, 'EVIDENCE_ARTIFACT_ID_COMPUTATION_FAILED', artifactPath, message);
      continue;
    }

    const expectedRelativePath = deriveArtifactRelativePath(artifactId);
    if (relativePath !== expectedRelativePath) {
      pushIssue(
        issues,
        'EVIDENCE_PATH_MISMATCH',
        artifactPath,
        `Expected relative path ${expectedRelativePath} but found ${relativePath}`,
      );
      continue;
    }

    const readResult = await readProspectivePregameEvidence(repositoryRoot, artifactId);
    if (!readResult.ok) {
      for (const issue of readResult.issues) {
        issues.push({
          code: 'EVIDENCE_READ_API_FAILED',
          path: artifactPath,
          message: issue.message,
        });
      }
      continue;
    }

    if (
      evidence.activationId !== activation.activationId ||
      evidence.protocolId !== activation.protocolId
    ) {
      // Foreign activation artifact: still validated, but excluded from active candidates
      foreignEvidenceCount += 1;
      continue;
    }

    evidenceMap.set(artifactId, {
      evidence: readResult.value,
      receipt: readResult.receipt,
    });
  }

  return { evidenceMap, temporaryDebris, unknownFiles, issues, foreignEvidenceCount };
}

/* -------------------------------------------------------------------------- */
/*  Binding discovery pipeline                                                */
/* -------------------------------------------------------------------------- */

async function discoverBindingDirectory(
  repositoryRoot: string,
  bindingDir: string,
  activation: MLBProspectiveHoldoutActivationPersisted,
  evidenceMap: Map<string, MLBProspectiveHoldoutArtifactEvidenceRecord>,
): Promise<{
  bindingMap: Map<string, MLBProspectiveHoldoutArtifactBindingRecord>;
  temporaryDebris: string[];
  unknownFiles: string[];
  issues: MLBProspectiveHoldoutArtifactDiscoveryIssue[];
  foreignBindingCount: number;
}> {
  const bindingMap = new Map<string, MLBProspectiveHoldoutArtifactBindingRecord>();
  const temporaryDebris: string[] = [];
  const unknownFiles: string[] = [];
  const issues: MLBProspectiveHoldoutArtifactDiscoveryIssue[] = [];
  let foreignBindingCount = 0;

  let enumeration;
  try {
    enumeration = await listStoreDirectory(bindingDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown IO error';
    pushIssue(issues, 'BINDING_DIRECTORY_IO_ERROR', bindingDir, message);
    return { bindingMap, temporaryDebris, unknownFiles, issues, foreignBindingCount };
  }

  if (enumeration.symlinks.length > 0) {
    for (const symlink of enumeration.symlinks) {
      pushIssue(issues, 'BINDING_SYMLINK_DETECTED', symlink, 'Symlink detected inside binding store directory');
    }
  }

  if (enumeration.subdirectories.length > 0) {
    for (const subdir of enumeration.subdirectories) {
      pushIssue(issues, 'BINDING_SUBDIRECTORY_DETECTED', subdir, 'Unexpected subdirectory inside binding store directory');
    }
  }

  temporaryDebris.push(...enumeration.temporaryDebris.sort());

  for (const unknownFile of enumeration.unknownFiles.sort()) {
    unknownFiles.push(unknownFile);
  }

  if (issues.length > 0) {
    return { bindingMap, temporaryDebris, unknownFiles, issues, foreignBindingCount };
  }

  for (const artifactPath of enumeration.regularFiles.sort()) {
    const relativePath = path.relative(
      path.resolve(bindingDir),
      artifactPath,
    );

    let rawBuffer: Buffer;
    try {
      rawBuffer = await fs.readFile(artifactPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown IO error';
      pushIssue(issues, 'BINDING_READ_FAILED', artifactPath, message);
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBuffer.toString('utf-8'));
    } catch {
      pushIssue(issues, 'BINDING_JSON_INVALID', artifactPath, 'Binding artifact contains invalid JSON');
      continue;
    }

    const validation = validateMLBProspectiveHoldoutGameIdentityBinding(parsed);
    if (!validation.ok) {
      const mappedIssues: MLBProspectiveHoldoutArtifactDiscoveryIssue[] = validation.issues.map(
        (issue): MLBProspectiveHoldoutArtifactDiscoveryIssue => ({
          code: 'BINDING_CONTRACT_INVALID',
          path: artifactPath,
          message: issue.message,
        }),
      );
      issues.push(...mappedIssues);
      continue;
    }

    const binding = validation.value;

    let bindingId: string;
    try {
      bindingId = computeBindingId({
        protocolId: binding.protocolId,
        activationId: binding.activationId,
        gamePk: binding.gamePk,
        evidenceArtifactId: binding.evidenceArtifactId,
        evidenceSha256: binding.evidenceSha256,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown binding ID computation error';
      pushIssue(issues, 'BINDING_ID_COMPUTATION_FAILED', artifactPath, message);
      continue;
    }

    const expectedRelativePath = deriveBindingRelativePath(bindingId);
    if (relativePath !== expectedRelativePath) {
      pushIssue(
        issues,
        'BINDING_PATH_MISMATCH',
        artifactPath,
        `Expected relative path ${expectedRelativePath} but found ${relativePath}`,
      );
      continue;
    }

    const readResult = await readProspectiveHoldoutGameIdentityBinding(repositoryRoot, bindingId);
    if (!readResult.ok) {
      for (const issue of readResult.issues) {
        issues.push({
          code: 'BINDING_READ_API_FAILED',
          path: artifactPath,
          message: issue.message,
        });
      }
      continue;
    }

    if (
      binding.activationId !== activation.activationId ||
      binding.protocolId !== activation.protocolId
    ) {
      // Foreign activation binding: validated but excluded from active candidates
      foreignBindingCount += 1;
      continue;
    }

    bindingMap.set(bindingId, {
      binding: readResult.value,
      receipt: readResult.receipt,
    });
  }

  return { bindingMap, temporaryDebris, unknownFiles, issues, foreignBindingCount };
}

/* -------------------------------------------------------------------------- */
/*  Cross-link and conflict detection                                         */
/* -------------------------------------------------------------------------- */

function buildRescheduleConflicts(
  activation: MLBProspectiveHoldoutActivationPersisted,
  bindingMap: Map<string, MLBProspectiveHoldoutArtifactBindingRecord>,
  evidenceMap: Map<string, MLBProspectiveHoldoutArtifactEvidenceRecord>,
): MLBProspectiveHoldoutArtifactRescheduleConflict[] {
  const gamePkGroups = new Map<number, MLBProspectiveHoldoutArtifactBindingRecord[]>();

  for (const record of bindingMap.values()) {
    const gamePk = record.binding.gamePk;
    const group = gamePkGroups.get(gamePk);
    if (group) {
      group.push(record);
    } else {
      gamePkGroups.set(gamePk, [record]);
    }
  }

  const conflicts: MLBProspectiveHoldoutArtifactRescheduleConflict[] = [];

  for (const [gamePk, bindings] of gamePkGroups) {
    if (bindings.length <= 1) {
      continue;
    }

    const sorted = bindings.slice().sort((a, b) =>
      a.receipt.bindingId < b.receipt.bindingId ? -1 : a.receipt.bindingId === b.receipt.bindingId ? 0 : 1,
    );

    conflicts.push({
      activationId: activation.activationId,
      protocolId: activation.protocolId,
      gamePk,
      bindingIds: sorted.map((r) => r.receipt.bindingId),
      evidenceArtifactIds: sorted.map((r) => r.binding.evidenceArtifactId),
      scheduledStartAts: sorted.map((r) => r.binding.scheduledStartAt),
      officialDates: sorted.map((r) => r.binding.officialDate),
    });
  }

  return conflicts;
}

/* -------------------------------------------------------------------------- */
/*  Public discovery API                                                     */
/* -------------------------------------------------------------------------- */

export async function discoverMLBProspectiveHoldoutArtifacts(
  repositoryRoot: string,
  activation: unknown,
): Promise<MLBProspectiveHoldoutArtifactDiscoveryResult> {
  const issues: MLBProspectiveHoldoutArtifactDiscoveryIssue[] = [];

  if (typeof repositoryRoot !== 'string' || repositoryRoot !== repositoryRoot.trim() || repositoryRoot.length === 0) {
    return { ok: false, issues: sortIssues([...issues, {
      code: 'INVALID_REPOSITORY_ROOT',
      path: '$.repositoryRoot',
      message: 'repositoryRoot must be a non-empty trimmed string',
    }]) };
  }

  const activationValidation = validateMLBProspectiveHoldoutActivationPersisted(activation);
  if (!activationValidation.ok) {
    const mappedIssues: MLBProspectiveHoldoutArtifactDiscoveryIssue[] = activationValidation.issues.map(
      (issue): MLBProspectiveHoldoutArtifactDiscoveryIssue => ({
        code: 'ACTIVATION_VALIDATION_FAILED',
        path: '$.activation',
        message: issue.message,
      }),
    );
    return { ok: false, issues: sortIssues([...issues, ...mappedIssues]) };
  }

  const validActivation = activationValidation.value;

  const root = path.resolve(repositoryRoot);
  const evidenceDir = path.join(root, MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_DIRECTORY);
  const bindingDir = path.join(root, MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_DIRECTORY);

  const evidenceResult = await discoverEvidenceDirectory(root, evidenceDir, validActivation);
  if (evidenceResult.issues.length > 0) {
    return { ok: false, issues: sortIssues([...issues, ...evidenceResult.issues]) };
  }

  const bindingResult = await discoverBindingDirectory(root, bindingDir, validActivation, evidenceResult.evidenceMap);
  if (bindingResult.issues.length > 0) {
    return { ok: false, issues: sortIssues([...issues, ...bindingResult.issues]) };
  }

  const allTemporaryDebris = [
    ...evidenceResult.temporaryDebris,
    ...bindingResult.temporaryDebris,
  ].sort();

  const allUnknownFiles = [
    ...evidenceResult.unknownFiles,
    ...bindingResult.unknownFiles,
  ].sort();

  // Cross-link validation
  for (const [bindingId, bindingRecord] of bindingResult.bindingMap) {
    const evidenceRecord = evidenceResult.evidenceMap.get(bindingRecord.binding.evidenceArtifactId);
    if (!evidenceRecord) {
      pushIssue(
        issues,
        'BINDING_REFERENCES_MISSING_EVIDENCE',
        bindingId,
        `Binding ${bindingId} references missing evidence artifact ${bindingRecord.binding.evidenceArtifactId}`,
      );
      continue;
    }

    if (bindingRecord.binding.evidenceSha256 !== evidenceRecord.receipt.sha256) {
      pushIssue(
        issues,
        'BINDING_EVIDENCE_SHA_MISMATCH',
        bindingId,
        `Binding ${bindingId} evidenceSha256 does not match evidence receipt sha256`,
      );
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) };
  }

  // Build conflicts
  const rescheduleConflicts = buildRescheduleConflicts(validActivation, bindingResult.bindingMap, evidenceResult.evidenceMap);

  // Build candidates (exclude conflicted gamePks)
  const conflictedGamePks = new Set<number>();
  for (const conflict of rescheduleConflicts) {
    conflictedGamePks.add(conflict.gamePk);
  }

  const candidates: MLBProspectiveHoldoutArtifactDiscoveryCandidate[] = [];

  for (const [bindingId, bindingRecord] of bindingResult.bindingMap) {
    if (conflictedGamePks.has(bindingRecord.binding.gamePk)) {
      continue;
    }

    const evidenceRecord = evidenceResult.evidenceMap.get(bindingRecord.binding.evidenceArtifactId);
    if (!evidenceRecord) {
      // Already caught above, but guard
      continue;
    }

    candidates.push({
      evidence: evidenceRecord.evidence,
      binding: bindingRecord.binding,
    });
  }

  // Stable order: scheduledStartAt ASC, then numeric gamePk ASC
  candidates.sort((a, b) => {
    const startDiff = a.binding.scheduledStartAt < b.binding.scheduledStartAt ? -1
      : a.binding.scheduledStartAt === b.binding.scheduledStartAt ? 0 : 1;
    if (startDiff !== 0) return startDiff;
    return a.binding.gamePk - b.binding.gamePk;
  });

  // Foreign counts returned by discovery functions
  const foreignEvidenceCount = evidenceResult.foreignEvidenceCount;
  const foreignBindingCount = bindingResult.foreignBindingCount;

  // Orphans: valid H evidence with no binding in active activation
  const boundEvidenceIds = new Set<string>();
  for (const bindingRecord of bindingResult.bindingMap.values()) {
    boundEvidenceIds.add(bindingRecord.binding.evidenceArtifactId);
  }

  const orphanEvidence: MLBProspectiveHoldoutArtifactEvidenceRecord[] = [];
  for (const [artifactId, evidenceRecord] of evidenceResult.evidenceMap) {
    if (!boundEvidenceIds.has(artifactId)) {
      orphanEvidence.push(evidenceRecord);
    }
  }

  orphanEvidence.sort((a, b) =>
    a.evidence.gameId < b.evidence.gameId ? -1
      : a.evidence.gameId === b.evidence.gameId ? 0 : 1
      || a.receipt.artifactId < b.receipt.artifactId ? -1
      : a.receipt.artifactId === b.receipt.artifactId ? 0 : 1,
  );

  return {
    ok: true,
    candidates: Object.freeze(candidates),
    orphanEvidence: Object.freeze(orphanEvidence),
    rescheduleConflicts: Object.freeze(rescheduleConflicts),
    temporaryDebris: Object.freeze(allTemporaryDebris),
    unknownFiles: Object.freeze(allUnknownFiles),
    foreignArtifactSummary: Object.freeze({
      foreignEvidenceCount,
      foreignBindingCount,
    }),
  };
}
