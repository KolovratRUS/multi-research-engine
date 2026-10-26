/* -------------------------------------------------------------------------- */
/*  MRS-7 P5F-C7A-S2B1 — Temporary-root isolation tests                        */
/*  Tests root validation, CLI safety, and synthetic full-pipeline execution. */
/*  No job execution. No live API calls. No real game data.                    */
/* ------------------------------------------------------------------------- */

import { describe, it, expect, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { buildMLBRealDataPregameSnapshot } from '@/prediction/mlb/mlb-real-data-pregame-snapshot-bridge';
import { MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1, MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT } from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';
import { extractMLBLeakageSafeFeatureVector } from '@/prediction/mlb/mlb-feature-vector-contract';
import { getMLBShadowCandidate003AuthorizedModelArtifact } from '@/prediction/mlb/mlb-shadow-candidate-003-authorized-model-artifact';
import { readMLBShadowPreparedExecutionJobV2 } from '@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-reader';
import { validateMLBShadowQuarantinedPredictionPayload } from '@/prediction/mlb/mlb-shadow-monitoring-quarantine-contract';
import { validateMLBShadowMonitoringOperationalRecord } from '@/prediction/mlb/mlb-shadow-monitoring-record-contract';
import { MLB_SHADOW_MONITORING_NAMESPACE_ROOT, MLB_SHADOW_MONITORING_OPERATIONAL_NAMESPACE, MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE } from '@/prediction/mlb/mlb-shadow-monitoring-namespace';

import { fixtureMLBOperationalPredictionCollection } from '../../../scripts/mlb-operational-prediction-collect';

type FixtureInput = Parameters<typeof fixtureMLBOperationalPredictionCollection>[1];
type CollectionResult = Awaited<ReturnType<typeof fixtureMLBOperationalPredictionCollection>>;

const FIXTURE_PREFIX = 'mrs-mlb-c7a-fixture-';

const DEFAULT_TIMESTAMPS = {
  predictionGeneratedAt: '2024-01-01T00:00:00Z',
  timingReferenceContractVersion: 'v1',
  timingReferenceCutoffAt: '2024-01-01T00:00:00Z',
};

/* Deliberately malformed input (null). Root validation runs BEFORE input
   validation, so null is never inspected for rejected roots. For the
   valid-root case, null triggers INVALID_INPUT at Stage 1 — proving root
   validation passed without executing a job. */
const MALFORMED_INPUT = null as unknown as FixtureInput;

const trackedSymlinks: string[] = [];
const trackedDirs: string[] = [];

function trackDir(p: string): void {
  trackedDirs.push(p);
}
function trackSymlink(p: string): void {
  trackedSymlinks.push(p);
}

async function cleanupTracked(): Promise<void> {
  for (const s of trackedSymlinks) {
    try {
      await fs.rm(s, { force: true });
    } catch {
      /* ignore ENOENT */
    }
  }
  for (const d of trackedDirs) {
    try {
      await fs.rm(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  trackedSymlinks.length = 0;
  trackedDirs.length = 0;
}

async function readdirSafe(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

async function callWithRoot(
  repoRoot: string,
  fixtureExecutionPermission = true,
): Promise<CollectionResult> {
  return fixtureMLBOperationalPredictionCollection(
    repoRoot,
    MALFORMED_INPUT,
    'test-request-id',
    DEFAULT_TIMESTAMPS,
    () => 'test-shadow-id',
    fixtureExecutionPermission,
  );
}

/* ------------------------------------------------------------------ */
/*  CLI helper — spawns tsx against the collector script                */
/*  Preserves the actual child-process exit code.                      */
/* ------------------------------------------------------------------ */

interface CLIResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

function runCollectorCLI(extraEnv: Record<string, string> = {}): Promise<CLIResult> {
  return new Promise((resolve) => {
    const tsxPath = path.join(process.cwd(), 'node_modules/.bin/tsx');
    const scriptPath = path.join(
      process.cwd(),
      'scripts',
      'mlb-operational-prediction-collect.ts',
    );
    const child = spawn(tsxPath, [scriptPath], {
      env: { ...process.env, ...extraEnv },
      timeout: 30000,
      killSignal: 'SIGKILL',
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err: Error) => {
      resolve({ exitCode: -1, stdout, stderr: stderr + err.message });
    });
    child.on('close', (code: number | null) => {
      resolve({ exitCode: code ?? -1, stdout, stderr });
    });
  });
}

/* ==================================================================== */
/*  Section 4 — Required safety tests (A–J)                              */
/* ==================================================================== */

describe('MRS-7 P5F-C7A-S2B1: Temporary-root isolation', () => {
  afterEach(async () => {
    await cleanupTracked();
  });

  describe('root validation guard (A–J)', () => {
    it('A. Real project repoRoot with fixtureExecutionPermission=true returns INVALID_TEMP_ROOT', async () => {
      const projectRoot = process.cwd();
      const before = await readdirSafe(projectRoot);
      const result = await callWithRoot(projectRoot, true);
      const after = await readdirSafe(projectRoot);

      expect(result.kind).toBe('INVALID_TEMP_ROOT');
      if (result.kind === 'INVALID_TEMP_ROOT') {
        expect(result.stage).toBe('TEMP_ROOT_VALIDATION');
        expect(result.reason).toBeTruthy();
      }
      /* Require zero new files or directories in the project root. */
      expect(after).toEqual(before);
    });

    it('B. Relative repoRoot rejected', async () => {
      const result = await callWithRoot('relative/path/to/root', true);

      expect(result.kind).toBe('INVALID_TEMP_ROOT');
      if (result.kind === 'INVALID_TEMP_ROOT') {
        expect(result.reason).toContain('absolute');
      }
    });

    it('C. Nonexistent repoRoot rejected', async () => {
      const nonexistent = path.join(
        os.tmpdir(),
        FIXTURE_PREFIX + 'nonexistent-12345678',
      );

      const result = await callWithRoot(nonexistent, true);

      expect(result.kind).toBe('INVALID_TEMP_ROOT');
      if (result.kind === 'INVALID_TEMP_ROOT') {
        expect(result.reason).toContain('does not exist');
      }
    });

    it('D. Arbitrary non-temporary directory rejected without writes', async () => {
      const externalDir = path.join(
        os.homedir(),
        'mrs-mlb-test-external-' + Date.now(),
      );
      await fs.mkdir(externalDir, { recursive: true });
      trackDir(externalDir);

      const before = await readdirSafe(externalDir);
      const result = await callWithRoot(externalDir, true);
      const after = await readdirSafe(externalDir);

      expect(result.kind).toBe('INVALID_TEMP_ROOT');
      if (result.kind === 'INVALID_TEMP_ROOT') {
        expect(result.reason).toContain('temp directory');
      }
      /* No writes inside the rejected directory. */
      expect(after).toEqual(before);
      expect(after).toHaveLength(0);
    });

    it('E. Symlinked repoRoot rejected', async () => {
      const realDir = await fs.mkdtemp(path.join(os.tmpdir(), FIXTURE_PREFIX));
      trackDir(realDir);
      const symlinkPath = path.join(
        os.tmpdir(),
        FIXTURE_PREFIX + 'symlink-test',
      );
      await fs.symlink(realDir, symlinkPath);
      trackSymlink(symlinkPath);

      const result = await callWithRoot(symlinkPath, true);

      expect(result.kind).toBe('INVALID_TEMP_ROOT');
      if (result.kind === 'INVALID_TEMP_ROOT') {
        expect(result.reason).toContain('symbolic link');
      }
    });

    it('F. Canonical path escaping the temporary directory rejected', async () => {
      /* Create a real subdirectory under tmpdir, then nest the candidate
         inside it. The candidate's canonical parent is tmpdir/subdir,
         not tmpdir itself, so it fails the immediate-child check. */
      const subdir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'mrs-mlb-c7a-subdir-'),
      );
      trackDir(subdir);
      const nestedRoot = path.join(subdir, FIXTURE_PREFIX + 'escaped-nested');
      await fs.mkdir(nestedRoot);
      trackDir(nestedRoot);

      const before = await readdirSafe(nestedRoot);
      const result = await callWithRoot(nestedRoot, true);
      const after = await readdirSafe(nestedRoot);

      expect(result.kind).toBe('INVALID_TEMP_ROOT');
      if (result.kind === 'INVALID_TEMP_ROOT') {
        expect(result.reason).toContain('temp directory');
      }
      expect(after).toEqual(before);
    });

    it('G. Valid mkdtemp root with prefix accepted by TEMP_ROOT_VALIDATION and reaches INPUT stage without executing a job', async () => {
      const validRoot = await fs.mkdtemp(path.join(os.tmpdir(), FIXTURE_PREFIX));
      trackDir(validRoot);

      const before = await readdirSafe(validRoot);
      const result = await callWithRoot(validRoot, true);
      const after = await readdirSafe(validRoot);

      /* Root validation passed — must NOT be INVALID_TEMP_ROOT. */
      expect(result.kind).not.toBe('INVALID_TEMP_ROOT');
      /* Must NOT reach any preparation/execution stage. */
      expect(result.kind).not.toBe('C5_FAILURE');
      expect(result.kind).not.toBe('C6_FAILURE');
      expect(result.kind).not.toBe('HANDOFF_FAILURE');
      expect(result.kind).not.toBe('SUCCESS');
      /* Reached the next stage (input structural validation).
         MALFORMED_INPUT is null, so INVALID_INPUT fires — proving
         we got past root validation without executing a job. */
      expect(result.kind).toBe('INVALID_INPUT');
      if (result.kind === 'INVALID_INPUT') {
        expect(result.stage).toBe('INPUT');
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0].code).toBe('NOT_PLAIN_OBJECT');
      }
      /* No job was executed — directory remains empty. */
      expect(after).toEqual(before);
      expect(after).toHaveLength(0);
    });

    it('H. fixtureExecutionPermission=false returns UNAUTHORIZED and does not create files', async () => {
      const validRoot = await fs.mkdtemp(path.join(os.tmpdir(), FIXTURE_PREFIX));
      trackDir(validRoot);

      const before = await readdirSafe(validRoot);
      const result = await callWithRoot(validRoot, false);
      const after = await readdirSafe(validRoot);

      expect(result.kind).toBe('UNAUTHORIZED');
      if (result.kind === 'UNAUTHORIZED') {
        expect(result.reason).toBe('LIVE_COLLECTION_NOT_AUTHORIZED');
      }
      /* Permission check fires before root validation — no writes. */
      expect(after).toEqual(before);
      expect(after).toHaveLength(0);
    });

    it('I. RESEARCH_DATA_MODE=live does not bypass invalid-root checks', async () => {
      const originalMode = process.env.RESEARCH_DATA_MODE;
      process.env.RESEARCH_DATA_MODE = 'live';
      try {
        const projectRoot = process.cwd();
        const result = await callWithRoot(projectRoot, true);

        expect(result.kind).toBe('INVALID_TEMP_ROOT');
        if (result.kind === 'INVALID_TEMP_ROOT') {
          expect(result.stage).toBe('TEMP_ROOT_VALIDATION');
        }
      } finally {
        if (originalMode === undefined) {
          delete process.env.RESEARCH_DATA_MODE;
        } else {
          process.env.RESEARCH_DATA_MODE = originalMode;
        }
      }
    });

    it('J. Root with wrong basename prefix, even directly under os.tmpdir(), is rejected', async () => {
      const wrongPrefixDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'wrong-prefix-'),
      );
      trackDir(wrongPrefixDir);

      const result = await callWithRoot(wrongPrefixDir, true);

      expect(result.kind).toBe('INVALID_TEMP_ROOT');
      if (result.kind === 'INVALID_TEMP_ROOT') {
        expect(result.reason).toContain('basename');
      }
    });
  });

  /* ==================================================================== */
  /*  Section 5 — CLI and import tests                                      */
  /* ==================================================================== */

  describe('CLI and import safety', () => {
    it('1. Direct CLI invocation rejects operational collection', async () => {
      const result = await runCollectorCLI();

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('LIVE_COLLECTION_NOT_AUTHORIZED');
      expect(result.stderr).toContain('Direct CLI execution');
    });

    it('2. Direct CLI invocation with RESEARCH_DATA_MODE=live rejects', async () => {
      const result = await runCollectorCLI({ RESEARCH_DATA_MODE: 'live' });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('LIVE_COLLECTION_NOT_AUTHORIZED');
      expect(result.stderr).toContain('Direct CLI execution');
    });

    it('3. Module import alone does not invoke fixture collection', async () => {
      /* The collector module is imported at the top of this test file.
         If the import had triggered collection or the CLI guard, the
         vitest process would have exited. Reaching this assertion
         proves the import is safe. */
      expect(fixtureMLBOperationalPredictionCollection).toBeDefined();
      expect(typeof fixtureMLBOperationalPredictionCollection).toBe('function');
      /* No operational artifacts created by the import. */
      const entries = await readdirSafe(process.cwd());
      expect(entries).not.toContain('shadow-runtime');
      expect(entries).not.toContain('prepared-jobs');
    });

    it('4. The exported function is accessible', () => {
      expect(fixtureMLBOperationalPredictionCollection).toBeDefined();
      expect(typeof fixtureMLBOperationalPredictionCollection).toBe('function');
    });
  });
});

/* ==================================================================== */
/*  P5F-C7A-S2B2 — Synthetic full-pipeline integration, isolated to /tmp   */
/*  Unlike the preceding safety tests, this test executes the real C5/C4/ */
/*  C3/C6/V2 pipeline once. It is NOT prospective evidence.               */
/* ==================================================================== */

describe('MRS-7 P5F-C7A-S2B2: real synthetic pregame collection', () => {
  it('bridges, prepares, scores Candidate-003, and persists both quarantined and operational records under a temporary root', async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), FIXTURE_PREFIX));
    const actualRuntimePath = path.join(process.cwd(), MLB_SHADOW_MONITORING_NAMESPACE_ROOT);
    const actualRuntimeBefore = await fs.stat(actualRuntimePath).then(
      (s) => ({ exists: true, isDirectory: s.isDirectory() }),
      (e: NodeJS.ErrnoException) => {
        if (e.code !== 'ENOENT') throw e;
        return { exists: false, isDirectory: false };
      },
    );

    expect(actualRuntimeBefore.exists).toBe(false);

    const gamePk = 900001;
    const preparationRequestId = 'c7a-fixture-preparation-900001';
    const shadowRecordId = 'c7a-fixture-shadow-900001';
    const scheduledStartAt = '2027-07-15T12:00:00Z';
    const predictionGeneratedAt = '2027-07-15T10:00:00Z';
    const dataCutoffAt = '2027-07-15T09:30:00Z';
    const officialDate = '2027-07-15';
    const startTimeUtc = new Date(scheduledStartAt);
    const fetchedAt = new Date(dataCutoffAt);
    const sourceTimestamp = new Date('2027-07-15T09:00:00Z');

    // No provider/network call: these are invented teams, IDs and pre-start statistics.
    // No final score, outcome, betting market, or historical holdout information.
    const fixtureInput: FixtureInput = {
      scheduleGame: {
        gamePk,
        gameType: 'R',
        gameNumber: 1,
        officialDate,
        gameDate: officialDate,
        startTimeUtc,
        status: 'UPCOMING',
        homeTeamId: 101,
        homeTeamName: 'Synthetic Home',
        awayTeamId: 102,
        awayTeamName: 'Synthetic Away',
        venueId: 1001,
        venueName: 'Synthetic Park',
        dayNight: 'day',
        scheduledInnings: 9,
        doubleHeader: 'N',
        seriesGameNumber: 1,
        gamesInSeries: 3,
        seriesDescription: 'Synthetic Regular Season',
        leagueRecord: {
          home: { wins: 50, losses: 40, pct: '0.556' },
          away: { wins: 45, losses: 45, pct: '0.500' },
        },
        probablePitchers: { home: null, away: null },
      },
      researchSnapshot: {
        event: {
          id: 'synthetic-event-900001',
          externalId: String(gamePk),
          sport: 'mlb',
          league: 'MLB',
          leagueSlug: 'mlb',
          homeTeam: 'Synthetic Home',
          awayTeam: 'Synthetic Away',
          homeTeamSlug: 'synthetic-home',
          awayTeamSlug: 'synthetic-away',
          startTimeUtc,
          status: 'UPCOMING',
          createdAt: new Date('2027-07-15T08:00:00Z'),
          updatedAt: sourceTimestamp,
        },
        probablePitchers: { home: null, away: null },
        pitcherStats: { home: null, away: null },
        teamBatting: { home: null, away: null },
        bullpen: { home: null, away: null },
        venue: null,
        weather: null,
        completeness: 100,
        warnings: [],
        provenance: [{
          source: 'mlb-stats-api:schedule', // Synthetic response using the known bridge source key.
          fetchedAt,
          sourceTimestamp,
          isLive: false,
          warnings: [],
        }],
        generatedAt: fetchedAt,
      },
    };

    const digest = (value: string): string =>
      createHash('sha256').update(value, 'utf8').digest('hex');
    const namespace = path.join(repoRoot, MLB_SHADOW_MONITORING_NAMESPACE_ROOT);
    const identityPath = path.join(namespace, 'operational/preparation-identities', `${digest(preparationRequestId)}.json`);
    const preparedPath = path.join(namespace, 'quarantine/prepared-jobs', `${digest(shadowRecordId)}.json`);
    const predictionPath = path.join(repoRoot, MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE, `${digest(shadowRecordId)}.json`);
    const operationalPath = path.join(repoRoot, MLB_SHADOW_MONITORING_OPERATIONAL_NAMESPACE, `${digest(shadowRecordId)}__prediction.json`);

    try {
      // Verify the upstream fixture really yields the frozen canonical pregame
      // snapshot and original manifest, without bypassing the collector bridge.
      const bridge = buildMLBRealDataPregameSnapshot(fixtureInput);
      expect(bridge.ok).toBe(true);
      if (!bridge.ok) throw new Error(`Synthetic snapshot rejected: ${JSON.stringify(bridge.issues)}`);
      expect(bridge.value.game.gameId).toBe(String(gamePk));
      expect(bridge.value.game.status).toBe('SCHEDULED');
      expect(bridge.value.dataCutoffAt).toBe(new Date(dataCutoffAt).toISOString());
      expect(bridge.value.game.scheduledStartAt).toBe(new Date(scheduledStartAt).toISOString());

      const featureVector = extractMLBLeakageSafeFeatureVector(
        MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
        bridge.value,
      );
      expect(featureVector.ok).toBe(true);
      if (!featureVector.ok) throw new Error(`Feature extraction rejected: ${JSON.stringify(featureVector.issues)}`);
      expect(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features).toHaveLength(14);
      expect(featureVector.value.values).toHaveLength(14);
      expect(featureVector.value.values.map((v) => v.featureId)).toEqual(
        MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.map((f) => f.featureId),
      );

      let generatedCount = 0;
      const result = await fixtureMLBOperationalPredictionCollection(
        repoRoot,
        fixtureInput,
        preparationRequestId,
        {
          predictionGeneratedAt,
          timingReferenceContractVersion: 'mlb-offline-pregame-inference-contract-v1',
          timingReferenceCutoffAt: dataCutoffAt,
        },
        () => {
          generatedCount += 1;
          return shadowRecordId;
        },
        true,
      );

      expect(result.kind).toBe('SUCCESS');
      if (result.kind !== 'SUCCESS') {
        throw new Error(`Collector did not succeed: ${JSON.stringify(result)}`);
      }
      expect(generatedCount).toBe(1);
      expect(result.shadowRecordId).toBe(shadowRecordId);
      expect(result.canonicalSnapshot).toEqual(bridge.value);
      expect(result.orchestrationResult.status).toBe('SUCCESS');
      if (result.orchestrationResult.status !== 'SUCCESS') {
        throw new Error('C5 did not reach its success branch');
      }
      expect(result.orchestrationResult.registryResult.ok).toBe(true);
      expect(result.orchestrationResult.preparationResult.kind).toBe('STORE_RESULT');
      if (result.orchestrationResult.preparationResult.kind !== 'STORE_RESULT') {
        throw new Error('C3 did not return a store result');
      }
      expect(result.orchestrationResult.preparationResult.result.ok).toBe(true);
      expect(result.eligibilityResult.kind).toBe('ELIGIBLE');
      expect(result.handoffResult.kind).toBe('ADAPTER_RESULT');
      expect(result.persistenceResult.ok).toBe(true);
      expect(result.persistenceResult.status).toBe('OPERATIONAL_PERSISTED');
      if (!('operationalArtifactCreated' in result.persistenceResult)) {
        throw new Error('V2 adapter returned an invalid-job result');
      }
      expect(result.persistenceResult.operationalArtifactCreated).toBe(true);
      expect(result.persistenceResult.operationalVerificationOk).toBe(true);

      // Four genuine immutable artifacts, all under the isolated fixture root.
      for (const file of [identityPath, preparedPath, predictionPath, operationalPath]) {
        expect((await fs.stat(file)).isFile()).toBe(true);
      }
      const identity = JSON.parse(await fs.readFile(identityPath, 'utf8')) as {
        preparationRequestId: string; gamePk: number; shadowRecordId: string;
      };
      expect(identity.preparationRequestId).toBe(preparationRequestId);
      expect(identity.gamePk).toBe(gamePk);
      expect(identity.shadowRecordId).toBe(shadowRecordId);

      // Reader verifies original C3 canonical bytes / model authority; it
      // does not dispatch the prepared job again.
      const prepared = await readMLBShadowPreparedExecutionJobV2(repoRoot, shadowRecordId);
      expect(prepared.ok).toBe(true);
      if (!prepared.ok) throw new Error(`C3 prepared artifact reader: ${prepared.status}`);
      expect(prepared.value.gamePk).toBe(gamePk);
      expect(prepared.value.shadowRecordId).toBe(shadowRecordId);
      expect(prepared.value.predictionGeneratedAt).toBe(predictionGeneratedAt);
      expect(prepared.value.snapshot).toEqual(bridge.value);
      expect(prepared.value.featureManifestId).toBe(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId);
      expect(prepared.value.featureManifestFingerprint).toBe(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT);
      expect(prepared.value.featureManifest.features).toHaveLength(14);
      expect(prepared.value.authorizedModelArtifact.attestation.modelCanonicalFingerprint).toBe(
        getMLBShadowCandidate003AuthorizedModelArtifact().attestation.modelCanonicalFingerprint,
      );
      expect(prepared.value.authorizedModelArtifact.model.modelId).toBe(
        getMLBShadowCandidate003AuthorizedModelArtifact().model.modelId,
      );

      // The sensitive model prediction is quarantined, NOT in operational JSON.
      const predictionRaw: unknown = JSON.parse(await fs.readFile(predictionPath, 'utf8'));
      const predictionValidation = validateMLBShadowQuarantinedPredictionPayload(predictionRaw);
      expect(predictionValidation.ok).toBe(true);
      if (!predictionValidation.ok) throw new Error(`Quarantine contract: ${JSON.stringify(predictionValidation.issues)}`);
      const prediction = predictionValidation.value;
      expect(prediction.shadowRecordId).toBe(shadowRecordId);
      expect(prediction.gamePk).toBe(gamePk);
      expect(prediction.predictionGeneratedAt).toBe(predictionGeneratedAt);
      expect(['HOME', 'AWAY']).toContain(prediction.predictedWinner);
      expect(prediction.predictedSide).toBe(prediction.predictedWinner);
      expect(Number.isFinite(prediction.homeWinProbability)).toBe(true);
      expect(Number.isFinite(prediction.awayWinProbability)).toBe(true);
      expect(prediction.homeWinProbability).toBeGreaterThanOrEqual(0);
      expect(prediction.homeWinProbability).toBeLessThanOrEqual(1);
      expect(prediction.awayWinProbability).toBeGreaterThanOrEqual(0);
      expect(prediction.awayWinProbability).toBeLessThanOrEqual(1);
      expect(prediction.homeWinProbability + prediction.awayWinProbability).toBeCloseTo(1, 12);
      expect(prediction.predictedWinner).toBe(prediction.homeWinProbability >= 0.5 ? 'HOME' : 'AWAY');
      const expectedHash = digest(JSON.stringify({
        shadowRecordId: prediction.shadowRecordId,
        gamePk: prediction.gamePk,
        predictedWinner: prediction.predictedWinner,
        predictedSide: prediction.predictedSide,
        homeWinProbability: prediction.homeWinProbability,
        awayWinProbability: prediction.awayWinProbability,
        decisionPolicy: prediction.decisionPolicy,
        predictionGeneratedAt: prediction.predictionGeneratedAt,
      }));
      expect(prediction.payloadHash).toBe(expectedHash);

      // Operational metadata is deliberately prediction-blind.
      const operationalRaw: unknown = JSON.parse(await fs.readFile(operationalPath, 'utf8'));
      const operationalValidation = validateMLBShadowMonitoringOperationalRecord(operationalRaw);
      expect(operationalValidation.ok).toBe(true);
      if (!operationalValidation.ok) throw new Error(`Operational contract: ${JSON.stringify(operationalValidation.issues)}`);
      const operational = operationalValidation.value;
      expect(operational.shadowRecordId).toBe(shadowRecordId);
      expect(operational.gamePk).toBe(gamePk);
      expect(operational.predictionGeneratedAt).toBe(predictionGeneratedAt);
      expect(operational.scientificUse).toBe('NONE');
      expect(operational.isProspectiveHoldoutEvidence).toBe(false);
      expect(operational.eligibleForFutureValidation).toBe(false);
      expect(operational.eligibleForFutureTest).toBe(false);
      expect(operational.featureManifestId).toBe(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId);
      expect(operational.featureManifestFingerprint).toBe(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT);
      expect(operational.predictionPayloadGenerated).toBe(true);
      expect(operational.predictionPayloadSchemaValid).toBe(true);
      expect(Object.keys(operationalRaw as Record<string, unknown>)).not.toContain('predictedWinner');
      expect(Object.keys(operationalRaw as Record<string, unknown>)).not.toContain('homeWinProbability');
      expect(Object.keys(operationalRaw as Record<string, unknown>)).not.toContain('awayWinProbability');

      // No file activity under the actual project's scientific/runtime root.
      const actualRuntimeAfter = await fs.stat(actualRuntimePath).then(
        (s) => ({ exists: true, isDirectory: s.isDirectory() }),
        (e: NodeJS.ErrnoException) => {
          if (e.code !== 'ENOENT') throw e;
          return { exists: false, isDirectory: false };
        },
      );
      expect(actualRuntimeAfter).toEqual(actualRuntimeBefore);
    } finally {
      await fs.rm(repoRoot, { recursive: true, force: true });
    }
  });
});
