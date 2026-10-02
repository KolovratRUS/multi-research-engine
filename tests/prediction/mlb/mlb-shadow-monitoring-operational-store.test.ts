/* -------------------------------------------------------------------------- */
/*  L5E2T — operational store functional tests                                 */
/* -------------------------------------------------------------------------- */
/*  Tests the locked L5E2T operational-store contract:                        */
/*    - write-once PREDICTION-stage persistence only                          */
/*    - canonical 27-field serialization                                       */
/*    - SHA-256(shadowRecordId) filename (raw ID never reaches a path)        */
/*    - fs.link finalization, never rename/replace                            */
/*    - no RESULT / GRADING writer                                            */
/*    - no public reader                                                      */
/*    - no raw validator issues / issue.message / issue.path in results       */
/*    - symlink ancestor/operational-dir/final-path defense                    */
/*    - zero-FS-mutation on every pre-finalization failure                    */
/* -------------------------------------------------------------------------- */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

import {
  persistMLBShadowMonitoringPredictionOperationalRecord,
  MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION,
} from '../../../src/prediction/mlb/mlb-shadow-monitoring-operational-store';
import * as operationalStore from '../../../src/prediction/mlb/mlb-shadow-monitoring-operational-store';
import { validateMLBShadowMonitoringOperationalRecord } from '../../../src/prediction/mlb/mlb-shadow-monitoring-record-contract';

/* -------------------------------------------------------------------------- */
/*  Mock control (proven L5E2R pattern: partial fs/promises with hooks)       */
/* -------------------------------------------------------------------------- */

const { failReadFile, failUnlinkTemp } = vi.hoisted(() => ({
  failReadFile: { value: false },
  failUnlinkTemp: { value: false },
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs/promises')>();
  type LooseReal = {
    readFile(p: string, o?: unknown): Promise<string>;
    unlink(p: string): Promise<void>;
  };
  const loose = real as unknown as LooseReal;
  return {
    ...real,
    readFile: vi.fn(async (filePath: string, options?: unknown) => {
      if (failReadFile.value) {
        throw new Error('injected EREAD_FAILURE');
      }
      return loose.readFile(filePath, options);
    }),
    unlink: vi.fn(async (filePath: string) => {
      if (
        failUnlinkTemp.value &&
        typeof filePath === 'string' &&
        /\.tmp-/.test(filePath)
      ) {
        throw new Error('injected EUNLINK_FAILURE');
      }
      return loose.unlink(filePath);
    }),
  };
});

/* -------------------------------------------------------------------------- */
/*  Shared fixtures                                                            */
/* -------------------------------------------------------------------------- */

const VALID_RECORD_ID = 'shadow-rec-001';

const CANONICAL_FIELDS = [
  'contractVersion',
  'mode',
  'scientificUse',
  'isProspectiveHoldoutEvidence',
  'eligibleForFutureValidation',
  'eligibleForFutureTest',
  'shadowRecordId',
  'gamePk',
  'officialDate',
  'scheduledStartAt',
  'predictionGeneratedAt',
  'pipelineStatus',
  'failureCode',
  'latencyMs',
  'sourceCandidateRecipeId',
  'sourceCandidateFingerprint',
  'featureManifestId',
  'featureManifestFingerprint',
  'timingReferenceContractVersion',
  'timingReferenceCutoffAt',
  'predictionPayloadGenerated',
  'predictionPayloadSchemaValid',
  'resultFetchSucceeded',
  'resultJoinMatched',
  'resultPayloadSchemaValid',
  'gradingRecordProduced',
  'gradingSchemaValid',
] as readonly string[];

const DENYLIST_FRAGMENT = [
  'predictedwinner',
  'predictedside',
  'predictedteamid',
  'homewinprobability',
  'awaywinprobability',
  'decisionpolicy',
  'officialwinner',
  'winningteamid',
  'losingteamid',
  'winner',
  'loser',
  'finalscore',
  'homescore',
  'awayscore',
  'candidatecorrectness',
  'logloss',
  'loglosscontribution',
  'brier',
  'brierscore',
  'briercontribution',
  'accuracy',
  'calibration',
  'aggregate',
  'performance',
  'roi',
  'predictionpayloadhash',
  'resultpayloadhash',
] as readonly string[];

function buildValidPredictionRecord(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    contractVersion: 'mlb-shadow-monitoring-operational-record-v1',
    mode: 'S1_OPERATIONAL_BLIND',
    scientificUse: 'NONE',
    isProspectiveHoldoutEvidence: false,
    eligibleForFutureValidation: false,
    eligibleForFutureTest: false,
    shadowRecordId: VALID_RECORD_ID,
    gamePk: 718412,
    officialDate: '2026-09-30',
    scheduledStartAt: '2026-09-30T23:10:00Z',
    predictionGeneratedAt: '2026-09-30T22:50:00Z',
    pipelineStatus: 'PREDICTION_COMPLETE',
    failureCode: null,
    latencyMs: 150,
    sourceCandidateRecipeId: 'recipe-1',
    sourceCandidateFingerprint: 'sha256:aaaa',
    featureManifestId: 'fm-1',
    featureManifestFingerprint: 'sha256:bbbb',
    timingReferenceContractVersion: 'v1',
    timingReferenceCutoffAt: '2026-09-30T22:00:00Z',
    predictionPayloadGenerated: true,
    predictionPayloadSchemaValid: true,
    resultFetchSucceeded: null,
    resultJoinMatched: null,
    resultPayloadSchemaValid: null,
    gradingRecordProduced: null,
    gradingSchemaValid: null,
    ...overrides,
  };
}

function expectedCanonicalBytes(
  overrides: Record<string, unknown> = {},
): string {
  // buildCanonicalBytes emits keys in the fixed 27-field order; the builder
  // literal is authored in that same order, so JSON.stringify is canonical.
  return JSON.stringify(buildValidPredictionRecord(overrides));
}

function expectedFilename(shadowRecordId: string): string {
  return (
    createHash('sha256')
      .update(shadowRecordId, 'utf-8')
      .digest('hex') + '__prediction.json'
  );
}

function operationalDirFor(repoRoot: string): string {
  return path.join(
    repoRoot,
    'var',
    'mlb-development',
    'mlb-shadow-monitoring',
    'operational',
  );
}

/* -------------------------------------------------------------------------- */
/*  Per-test lifecycle                                                          */
/* -------------------------------------------------------------------------- */

const tempRoots: string[] = [];

beforeEach(() => {
  failReadFile.value = false;
  failUnlinkTemp.value = false;
});

afterEach(async () => {
  failReadFile.value = false;
  failUnlinkTemp.value = false;
  for (const root of tempRoots) {
    await fs.rm(root, { recursive: true, force: true }).catch(() => {
      /* best-effort */
    });
  }
  tempRoots.length = 0;
});

async function makeTempRoot(): Promise<string> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'l5e2t-operational-'),
  );
  tempRoots.push(root);
  return root;
}

/* -------------------------------------------------------------------------- */
/*  1. valid PREDICTION-stage record persists                                  */
/* -------------------------------------------------------------------------- */

describe('L5E2T operational store — valid persistence', () => {
  it('1. valid PREDICTION-stage record persists (first write PERSISTED)', async () => {
    const repoRoot = await makeTempRoot();
    const record = buildValidPredictionRecord();
    const result = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      record,
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe('PERSISTED');
    expect(result.artifactCreated).toBe(true);
    expect(result.verificationOk).toBe(true);
    expect(result.tempCleanupFailed).toBe(false);
    expect(result.storeVersion).toBe(
      MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION,
    );
    expect(result.shadowRecordId).toBe(VALID_RECORD_ID);
  });

  it('15. first write returns PERSISTED with stage PREDICTION', async () => {
    const repoRoot = await makeTempRoot();
    const result = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      buildValidPredictionRecord(),
    );
    expect(result.status).toBe('PERSISTED');
    expect(result.stage).toBe('PREDICTION');
  });
});

/* -------------------------------------------------------------------------- */
/*  2. canonical 27-field order deterministic                                  */
/* -------------------------------------------------------------------------- */

describe('L5E2T operational store — canonical serialization', () => {
  it('2. persisted JSON has deterministic 27-field key order', async () => {
    const repoRoot = await makeTempRoot();
    const record = buildValidPredictionRecord();
    const result = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      record,
    );
    expect(result.ok).toBe(true);

    const dir = operationalDirFor(repoRoot);
    const entries = await fs.readdir(dir);
    expect(entries).toHaveLength(1);

    const bytes = await fs.readFile(path.join(dir, entries[0]!), 'utf-8');
    const parsed = JSON.parse(bytes) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(CANONICAL_FIELDS);
    expect(CANONICAL_FIELDS).toHaveLength(27);
  });

  it('3. persisted JSON re-validates through the operational contract', async () => {
    const repoRoot = await makeTempRoot();
    const record = buildValidPredictionRecord();
    await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      record,
    );

    const dir = operationalDirFor(repoRoot);
    const [name] = await fs.readdir(dir);
    const bytes = await fs.readFile(path.join(dir, name!), 'utf-8');
    const parsed = JSON.parse(bytes);

    const revalidate = validateMLBShadowMonitoringOperationalRecord(parsed);
    expect(revalidate.ok).toBe(true);
  });

  it('canonical bytes match expected literal', async () => {
    const repoRoot = await makeTempRoot();
    const record = buildValidPredictionRecord();
    const result = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      record,
    );
    expect(result.ok).toBe(true);

    const dir = operationalDirFor(repoRoot);
    const [name] = await fs.readdir(dir);
    const bytes = await fs.readFile(path.join(dir, name!), 'utf-8');
    expect(bytes).toBe(expectedCanonicalBytes());
  });
});

/* -------------------------------------------------------------------------- */
/*  4. prohibited sensitive field rejected before FS mutation                  */
/*  5. unknown field rejected before FS mutation                              */
/* -------------------------------------------------------------------------- */

describe('L5E2T operational store — pre-finalization validation gates', () => {
  it('4. prohibited sensitive field rejected before FS mutation', async () => {
    const repoRoot = await makeTempRoot();
    const record = {
      ...buildValidPredictionRecord({ resultFetchSucceeded: null }),
      predictedWinner: 'X', // denylisted (predictedwinner)
    };
    const result = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      record,
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe('VALIDATION_FAILED');
    expect(result.artifactCreated).toBe(false);

    const dir = operationalDirFor(repoRoot);
    await expect(fs.lstat(dir)).rejects.toThrow();
  });

  it('5. unknown field rejected before FS mutation', async () => {
    const repoRoot = await makeTempRoot();
    const record = {
      ...buildValidPredictionRecord(),
      bogusField: 1,
    };
    const result = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      record,
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe('VALIDATION_FAILED');
    expect(result.artifactCreated).toBe(false);

    const dir = operationalDirFor(repoRoot);
    await expect(fs.lstat(dir)).rejects.toThrow();
  });

  it('shadowRecordId required: SHADOW_RECORD_ID_NULL', async () => {
    const repoRoot = await makeTempRoot();
    const record = buildValidPredictionRecord({ shadowRecordId: null });
    const result = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      record,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('SHADOW_RECORD_ID_NULL');
    expect(result.artifactCreated).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  6. public result exposes no raw validator issues                           */
/*  7. public result exposes no arbitrary issue message/path                  */
/* -------------------------------------------------------------------------- */

describe('L5E2T operational store — result surface sanitization', () => {
  it('6. public result exposes no raw validator issues', async () => {
    const repoRoot = await makeTempRoot();

    const okResult = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      buildValidPredictionRecord(),
    );
    const failResult = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      buildValidPredictionRecord({ resultFetchSucceeded: true }),
    );

    const forbid = ['issues', 'issue', 'rawValidation'];
    for (const key of Object.keys(okResult)) {
      expect(forbid).not.toContain(key);
    }
    // failResult is a discriminated union; cast only to inspect keys.
    const failKeys = Object.keys(failResult as object);
    for (const key of failKeys) {
      expect(forbid).not.toContain(key);
    }
  });

  it('7. public result exposes no arbitrary issue message/path', async () => {
    const repoRoot = await makeTempRoot();
    const result = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      buildValidPredictionRecord({ resultFetchSucceeded: true }),
    );
    const keys = Object.keys(result as object);
    expect(keys).not.toContain('message');
    expect(keys).not.toContain('path');
    expect(keys).not.toContain('relativePath');
  });
});

/* -------------------------------------------------------------------------- */
/*  8. RESULT-stage state rejected with INVALID_STAGE_STATE                    */
/*  9. GRADING-stage state rejected with INVALID_STAGE_STATE                  */
/*  10. invalid stage-state causes zero FS mutation                           */
/* -------------------------------------------------------------------------- */

describe('L5E2T operational store — stage gate', () => {
  it('8. RESULT-stage state rejected with INVALID_STAGE_STATE', async () => {
    const repoRoot = await makeTempRoot();
    const record = buildValidPredictionRecord({
      resultFetchSucceeded: true,
    });
    const result = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      record,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('INVALID_STAGE_STATE');
  });

  it('9. GRADING-stage state rejected with INVALID_STAGE_STATE', async () => {
    const repoRoot = await makeTempRoot();
    const record = buildValidPredictionRecord({
      gradingRecordProduced: true,
    });
    const result = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      record,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('INVALID_STAGE_STATE');
  });

  it('10. invalid stage-state causes zero FS mutation', async () => {
    const repoRoot = await makeTempRoot();
    const record = buildValidPredictionRecord({
      resultPayloadSchemaValid: true,
    });
    await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      record,
    );
    const dir = operationalDirFor(repoRoot);
    await expect(fs.lstat(dir)).rejects.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/*  11. filename = SHA256(shadowRecordId) + __prediction.json                  */
/*  12. raw shadowRecordId cannot path-traverse                               */
/* -------------------------------------------------------------------------- */

describe('L5E2T operational store — artifact naming', () => {
  it('11. filename = SHA256(shadowRecordId) + __prediction.json', async () => {
    const repoRoot = await makeTempRoot();
    const record = buildValidPredictionRecord({
      shadowRecordId: 'naming-check-id',
    });
    const result = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      record,
    );
    expect(result.ok).toBe(true);

    const dir = operationalDirFor(repoRoot);
    const entries = await fs.readdir(dir);
    expect(entries).toEqual([expectedFilename('naming-check-id')]);
  });

  it('12. raw shadowRecordId cannot path-traverse', async () => {
    const repoRoot = await makeTempRoot();
    const traversalId = '../../../evil/path';
    const record = buildValidPredictionRecord({
      shadowRecordId: traversalId,
    });
    const result = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      record,
    );
    expect(result.ok).toBe(true);

    const dir = operationalDirFor(repoRoot);
    const entries = await fs.readdir(dir);
    expect(entries).toHaveLength(1);
    const [name] = entries;
    expect(name).not.toContain('/');
    expect(name).not.toContain('..');
    expect(name).toBe(expectedFilename(traversalId));

    // Nothing escaped outside operational dir.
    await expect(
      fs.lstat(path.join(repoRoot, 'evil')),
    ).rejects.toThrow();
    await expect(
      fs.lstat(path.join(repoRoot, 'path')),
    ).rejects.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/*  13. persisted file contains no denylisted prediction fields                */
/*  14. persisted file contains no quarantine path                            */
/* -------------------------------------------------------------------------- */

describe('L5E2T operational store — artifact content hygiene', () => {
  it('13. persisted file contains no denylisted prediction fields', async () => {
    const repoRoot = await makeTempRoot();
    await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      buildValidPredictionRecord(),
    );
    const dir = operationalDirFor(repoRoot);
    const [name] = await fs.readdir(dir);
    const bytes = await fs.readFile(path.join(dir, name!), 'utf-8').toString();
    for (const bad of DENYLIST_FRAGMENT) {
      expect(bytes.toLowerCase()).not.toContain(bad);
    }
  });

  it('14. persisted file contains no quarantine path', async () => {
    const repoRoot = await makeTempRoot();
    await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      buildValidPredictionRecord(),
    );
    const dir = operationalDirFor(repoRoot);
    expect(dir).not.toContain('quarantine');
    const [name] = await fs.readdir(dir);
    const bytes = await fs.readFile(path.join(dir, name!), 'utf-8').toString();
    expect(bytes.toLowerCase()).not.toContain('quarantine');
  });
});

/* -------------------------------------------------------------------------- */
/*  16. identical duplicate -> IDEMPOTENT_IDENTICAL_SUCCESS                    */
/*  17. identical duplicate has artifactCreated=false                          */
/*  18. different duplicate -> ALREADY_EXISTS                                  */
/*  19. different duplicate preserves original bytes                           */
/* -------------------------------------------------------------------------- */

describe('L5E2T operational store — write-once duplicate policy', () => {
  it('16. identical duplicate returns IDEMPOTENT_IDENTICAL_SUCCESS', async () => {
    const repoRoot = await makeTempRoot();
    const record = buildValidPredictionRecord();
    const first = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      record,
    );
    const second = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      record,
    );
    expect(first.status).toBe('PERSISTED');
    expect(second.ok).toBe(true);
    expect(second.status).toBe('IDEMPOTENT_IDENTICAL_SUCCESS');
  });

  it('17. identical duplicate has artifactCreated=false', async () => {
    const repoRoot = await makeTempRoot();
    const record = buildValidPredictionRecord();
    await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      record,
    );
    const second = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      record,
    );
    expect(second.artifactCreated).toBe(false);
  });

  it('18. different duplicate returns ALREADY_EXISTS', async () => {
    const repoRoot = await makeTempRoot();
    const firstRecord = buildValidPredictionRecord();
    const secondRecord = buildValidPredictionRecord({ gamePk: 999000 });
    const first = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      firstRecord,
    );
    const second = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      secondRecord,
    );
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.status).toBe('ALREADY_EXISTS');
    expect(second.artifactCreated).toBe(false);
  });

  it('19. different duplicate preserves original bytes', async () => {
    const repoRoot = await makeTempRoot();
    const firstRecord = buildValidPredictionRecord();
    const first = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      firstRecord,
    );
    expect(first.ok).toBe(true);

    const dir = operationalDirFor(repoRoot);
    const [name] = await fs.readdir(dir);
    const originalBytes = await fs.readFile(
      path.join(dir, name!),
      'utf-8',
    );

    await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      buildValidPredictionRecord({ gamePk: 999000 }),
    );

    const afterBytes = await fs.readFile(path.join(dir, name!), 'utf-8');
    expect(afterBytes).toBe(originalBytes);
    // Still exactly one artifact.
    expect(await fs.readdir(dir)).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */
/*  20. concurrent identical writers yield one final artifact                 */
/* -------------------------------------------------------------------------- */

describe('L5E2T operational store — concurrency', () => {
  it('20. concurrent identical writers yield one final artifact and safe statuses', async () => {
    const repoRoot = await makeTempRoot();
    const record = buildValidPredictionRecord();
    const [a, b] = await Promise.all([
      persistMLBShadowMonitoringPredictionOperationalRecord(repoRoot, record),
      persistMLBShadowMonitoringPredictionOperationalRecord(repoRoot, record),
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(['PERSISTED', 'IDEMPOTENT_IDENTICAL_SUCCESS']).toContain(a.status);
    expect(['PERSISTED', 'IDEMPOTENT_IDENTICAL_SUCCESS']).toContain(b.status);

    const dir = operationalDirFor(repoRoot);
    const entries = await fs.readdir(dir);
    expect(entries).toHaveLength(1);
    const [name] = entries;
    const bytes = await fs.readFile(path.join(dir, name!), 'utf-8');
    expect(bytes).toBe(expectedCanonicalBytes());
  });
});

/* -------------------------------------------------------------------------- */
/*  21. ancestor symlink rejected                                              */
/*  22. operational-directory symlink rejected                                  */
/*  23. final-path symlink rejected                                            */
/*  24. final-path directory collision rejected                                 */
/* -------------------------------------------------------------------------- */

describe('L5E2T operational store — symlink / collision defense', () => {
  it('21. ancestor symlink rejected', async () => {
    const repoRoot = await makeTempRoot();
    const target = await makeTempRoot();
    // repoRoot/var -> symlink to a target dir (ancestor is a symlink).
    await fs.symlink(target, path.join(repoRoot, 'var'), 'dir');
    const result = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      buildValidPredictionRecord(),
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('SYMLINK_DETECTED');
    expect(result.artifactCreated).toBe(false);
  });

  it('22. operational-directory symlink rejected', async () => {
    const repoRoot = await makeTempRoot();
    const target = await makeTempRoot();
    const base = path.join(repoRoot, 'var', 'mlb-development', 'mlb-shadow-monitoring');
    await fs.mkdir(base, { recursive: true });
    // operational -> symlink
    await fs.symlink(target, path.join(base, 'operational'), 'dir');
    const result = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      buildValidPredictionRecord(),
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('SYMLINK_DETECTED');
    expect(result.artifactCreated).toBe(false);
  });

  it('23. final-path symlink rejected', async () => {
    const repoRoot = await makeTempRoot();
    const target = await makeTempRoot();
    const dir = operationalDirFor(repoRoot);
    await fs.mkdir(dir, { recursive: true });
    const finalName = expectedFilename(VALID_RECORD_ID);
    await fs.symlink(target, path.join(dir, finalName), 'file');
    const result = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      buildValidPredictionRecord(),
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('SYMLINK_DETECTED');
    expect(result.artifactCreated).toBe(false);
  });

  it('24. final-path directory collision rejected', async () => {
    const repoRoot = await makeTempRoot();
    const dir = operationalDirFor(repoRoot);
    await fs.mkdir(dir, { recursive: true });
    const finalName = expectedFilename(VALID_RECORD_ID);
    await fs.mkdir(path.join(dir, finalName));
    const result = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      buildValidPredictionRecord(),
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('NON_DIRECTORY_TARGET');
    expect(result.artifactCreated).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  25. successful write uses restrictive file mode                            */
/*  26. successful temp cleanup leaves no temp artifact                       */
/* -------------------------------------------------------------------------- */

describe('L5E2T operational store — file mode and temp hygiene', () => {
  it('25. successful write uses restrictive file mode where supported', async () => {
    const repoRoot = await makeTempRoot();
    await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      buildValidPredictionRecord(),
    );
    const dir = operationalDirFor(repoRoot);
    const [name] = await fs.readdir(dir);
    const stat = await fs.stat(path.join(dir, name!));
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('26. successful temp cleanup leaves no temp artifact', async () => {
    const repoRoot = await makeTempRoot();
    await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      buildValidPredictionRecord(),
    );
    const dir = operationalDirFor(repoRoot);
    const entries = await fs.readdir(dir);
    expect(entries).toHaveLength(1);
    const [name] = entries;
    expect(name).not.toMatch(/\.tmp-/);
  });
});

/* -------------------------------------------------------------------------- */
/*  27. post-link read-back failure -> VERIFICATION_FAILED                      */
/*  28. post-link verification failure reports artifactCreated=true           */
/*  29. verification-failed final artifact remains present                      */
/*  30. verification-failed final artifact is not overwritten/deleted         */
/* -------------------------------------------------------------------------- */

describe('L5E2T operational store — post-finalization verification', () => {
  it('27. post-link read-back failure returns VERIFICATION_FAILED', async () => {
    const repoRoot = await makeTempRoot();
    failReadFile.value = true;
    const result = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      buildValidPredictionRecord(),
    );
    failReadFile.value = false;

    expect(result.ok).toBe(false);
    expect(result.status).toBe('VERIFICATION_FAILED');
    expect(result.artifactCreated).toBe(true);
  });

  it('28. post-link verification failure reports artifactCreated=true', async () => {
    const repoRoot = await makeTempRoot();
    failReadFile.value = true;
    const result = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      buildValidPredictionRecord(),
    );
    failReadFile.value = false;

    expect(result.status).toBe('VERIFICATION_FAILED');
    expect(result.artifactCreated).toBe(true);
    expect(result.verificationOk).toBe(false);
  });

  it('29. verification-failed final artifact remains present', async () => {
    const repoRoot = await makeTempRoot();
    failReadFile.value = true;
    const result = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      buildValidPredictionRecord(),
    );
    failReadFile.value = false;
    expect(result.status).toBe('VERIFICATION_FAILED');

    const dir = operationalDirFor(repoRoot);
    const [name] = await fs.readdir(dir);
    expect(name).toBe(expectedFilename(VALID_RECORD_ID));
  });

  it('30. verification-failed final artifact is not overwritten/deleted', async () => {
    const repoRoot = await makeTempRoot();
    failReadFile.value = true;
    const first = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      buildValidPredictionRecord(),
    );
    failReadFile.value = false;
    expect(first.status).toBe('VERIFICATION_FAILED');

    const dir = operationalDirFor(repoRoot);
    const [name] = await fs.readdir(dir);
    const persistedBytes = await fs.readFile(path.join(dir, name!), 'utf-8');

    // Second identical write (readFile now real): final file exists & identical
    const second = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      buildValidPredictionRecord(),
    );
    expect(second.ok).toBe(true);
    expect(second.status).toBe('IDEMPOTENT_IDENTICAL_SUCCESS');

    const afterBytes = await fs.readFile(path.join(dir, name!), 'utf-8');
    expect(afterBytes).toBe(persistedBytes);
  });
});

/* -------------------------------------------------------------------------- */
/*  31. cleanup failure maps to PERSISTED_WITH_CLEANUP_WARNING (verify ok)     */
/* -------------------------------------------------------------------------- */

describe('L5E2T operational store — cleanup warning path', () => {
  it('31. cleanup failure maps to PERSISTED_WITH_CLEANUP_WARNING when verification succeeds', async () => {
    const repoRoot = await makeTempRoot();
    failUnlinkTemp.value = true;
    const result = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      buildValidPredictionRecord(),
    );
    failUnlinkTemp.value = false;

    expect(result.ok).toBe(true);
    expect(result.status).toBe('PERSISTED_WITH_CLEANUP_WARNING');
    expect(result.artifactCreated).toBe(true);
    expect(result.verificationOk).toBe(true);
    expect(result.tempCleanupFailed).toBe(true);

    // The temp artifact could not be removed, so it lingers alongside final.
    const dir = operationalDirFor(repoRoot);
    const entries = await fs.readdir(dir);
    const tempEntries = entries.filter((e) => /\.tmp-/.test(e));
    expect(tempEntries.length).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  32. caller cannot select stage                                              */
/*  33. RESULT writer does not exist                                            */
/*  34. GRADING writer does not exist                                           */
/*  35. no public reader exists                                                 */
/* -------------------------------------------------------------------------- */

describe('L5E2T operational store — API surface', () => {
  // Widen module access so we can assert the *absence* of forbidden writers/readers.
  const exposed = operationalStore as unknown as Record<string, unknown>;

  it('32. caller cannot select stage (persist arity has no stage arg, result always PREDICTION)', async () => {
    expect(
      persistMLBShadowMonitoringPredictionOperationalRecord.length,
    ).toBe(2);

    const repoRoot = await makeTempRoot();
    const result = await persistMLBShadowMonitoringPredictionOperationalRecord(
      repoRoot,
      buildValidPredictionRecord(),
    );
    expect(result.ok).toBe(true);
    expect(result.stage).toBe('PREDICTION');
  });

  it('33. RESULT writer does not exist', () => {
    expect(
      typeof exposed.persistMLBShadowMonitoringResultOperationalRecord,
    ).toBe('undefined');
  });

  it('34. GRADING writer does not exist', () => {
    expect(
      typeof exposed.persistMLBShadowMonitoringGradingOperationalRecord,
    ).toBe('undefined');
  });

  it('35. no public reader exists (no read/get/load/fetch* export)', () => {
    const readerish = Object.keys(exposed).filter((k) =>
      /^(read|get|load|fetch|readback|readBack)/i.test(k),
    );
    expect(readerish).toEqual([]);
    expect(
      typeof exposed.readMLBShadowMonitoringPredictionOperationalRecord,
    ).toBe('undefined');
    expect(
      typeof exposed.getMLBShadowMonitoringPredictionOperationalRecord,
    ).toBe('undefined');
  });
});
