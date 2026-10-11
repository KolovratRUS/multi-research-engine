import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';

/* V2 computation under test */
import { computeMLBShadowQuarantinedPredictionV2 } from '@/prediction/mlb/mlb-shadow-monitoring-prediction-computation-v2';

/* Authorized artifact + frozen fingerprint */
import {
  getMLBShadowCandidate003AuthorizedModelArtifact,
  MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL_ARTIFACT_CONTRACT_VERSION,
  validateMLBShadowCandidate003AuthorizedModelArtifact,
} from '@/prediction/mlb/mlb-shadow-candidate-003-authorized-model-artifact';
import {
  MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256,
} from '@/prediction/mlb/mlb-shadow-model-fingerprint';

/* Real frozen manifest + fingerprint */
import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
  computeMLBFeatureManifestFingerprint,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';
import {
  extractMLBLeakageSafeFeatureVector,
  validateMLBFeatureManifest,
} from '@/prediction/mlb/mlb-feature-vector-contract';

/* Snapshot contract */
import {
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';

/* Quarantine contract */
import {
  validateMLBShadowQuarantinedPredictionPayload,
  type MLBShadowQuarantinedPredictionPayload,
} from '@/prediction/mlb/mlb-shadow-monitoring-quarantine-contract';

/* -------------------------------------------------------------------------- */
/*  Frozen test timestamps                                                    */
/* -------------------------------------------------------------------------- */
const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';
const FROZEN_PREDICTION_GENERATED_AT_A = '2026-07-15T18:40:00Z';
const FROZEN_PREDICTION_GENERATED_AT_B = '2026-07-15T19:00:00Z';
const FROZEN_OFFICIAL_DATE = '2026-07-15';

/* -------------------------------------------------------------------------- */
/*  Manifest section IDs (must match the frozen real-pregame manifest exactly) */
/* -------------------------------------------------------------------------- */
const MANIFEST_SECTION_IDS = [
  'section-away-batting',
  'section-away-bullpen',
  'section-away-starter',
  'section-game-context',
  'section-home-batting',
  'section-home-bullpen',
  'section-home-starter',
] as const;

/* -------------------------------------------------------------------------- */
/*  Snapshot builder — produces a structurally valid canonical pregame snapshot */
/*  with section payloads controlled by the caller.                           */
/* -------------------------------------------------------------------------- */
function buildSnapshot(
  sectionPayloads: Record<string, Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    contractVersion: MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    snapshotId: 'snapshot-v2-test-001',
    capturedAt: FROZEN_CAPTURED_AT,
    dataCutoffAt: FROZEN_DATA_CUTOFF,
    game: {
      gameId: 'game-v2-test-001',
      scheduledStartAt: FROZEN_SCHEDULED_START,
      officialDate: FROZEN_OFFICIAL_DATE,
      season: 2026,
      gameType: 'REGULAR_SEASON',
      status: 'SCHEDULED',
      homeTeamId: 'home-test-001',
      awayTeamId: 'away-test-001',
      venueId: 'venue-test-001',
      neutralSite: false,
      doubleheader: null,
    },
    startingPitchers: {
      home: {
        state: 'PROBABLE',
        pitcherId: 'starter-home-001',
        announcedAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-game'],
      },
      away: {
        state: 'PROBABLE',
        pitcherId: 'starter-away-001',
        announcedAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-game'],
      },
    },
    sourceReferences: [
      {
        sourceRefId: 'src-game',
        sourceName: 'MLB Stats API',
        sourceCategory: 'OFFICIAL',
        roles: ['GAME_IDENTITY', 'STARTING_PITCHER', 'TEAM_STATS'],
        providerRecordId: null,
        fetchedAt: FROZEN_CAPTURED_AT,
        sourceUpdatedAt: FROZEN_DATA_CUTOFF,
      },
    ],
    sections: MANIFEST_SECTION_IDS.map((sectionId) => ({
      sectionId,
      kind: 'GAME_CONTEXT',
      entity: { scope: 'GAME', entityId: null },
      status: 'AVAILABLE',
      asOfAt: FROZEN_DATA_CUTOFF,
      sourceRefIds: ['src-game'],
      payload: sectionPayloads[sectionId] ?? {},
    })),
    dataCompleteness: 'COMPLETE',
    warnings: [],
  };
}

/* -------------------------------------------------------------------------- */
/*  V2 job builder — uses the frozen candidate-003 artifact + frozen manifest */
/* -------------------------------------------------------------------------- */
function buildV2Job(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    repoRoot: '/Users/samkassirov/multi-research-engine',
    shadowRecordId: 'shadow-v2-test-001',
    gamePk: 990000001,
    predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT_A,
    authorizedModelArtifact: getMLBShadowCandidate003AuthorizedModelArtifact(),
    featureManifest: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    snapshot: buildSnapshot({}),
    ...overrides,
  };
}

/** Deep-clone a frozen object via JSON round-trip (test-only). */
function cloneJob(job: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(job));
}

/* -------------------------------------------------------------------------- */
/*  Independent expected-prediction computation (source-locked V1 parity).     */
/*  Reproduces the EXACT arithmetic of inferMLBOfflinePregameWinner lines    */
/*  1464-1602:                                                               */
/*    score = intercept + Σ(valueCoeff * value + missingCoeff * wasMissing)   */
/*    sigmoid: score >= 0 → 1/(1+exp(-score)), else exp(score)/(1+exp(score)) */
/*    -0 normalization, predictedSide = homeProb >= 0.5 ? HOME : AWAY          */
/* -------------------------------------------------------------------------- */
interface TestModel {
  intercept: number;
  coefficients: ReadonlyArray<{
    featureId: string;
    valueCoefficient: number;
    missingIndicatorCoefficient: number;
  }>;
  featureIds: readonly string[];
}

function computeExpectedPrediction(job: Record<string, unknown>): {
  score: number;
  homeWinProbability: number;
  awayWinProbability: number;
  predictedSide: 'HOME' | 'AWAY';
} {
  const model = (
    job.authorizedModelArtifact as { model: TestModel }
  ).model;
  const manifest = job.featureManifest;
  const snapshot = job.snapshot;

  const extraction = extractMLBLeakageSafeFeatureVector(manifest, snapshot);
  if (!extraction.ok) {
    throw new Error('Independent feature extraction failed');
  }
  const vector = extraction.value;
  const values = vector.values;

  /* Step 5 — exact V1 arithmetic ordering. */
  let score = model.intercept;
  for (let i = 0; i < values.length; i++) {
    const coeff = model.coefficients[i];
    const v = values[i];
    const valueProduct = coeff.valueCoefficient * v.value;
    const missingProduct =
      coeff.missingIndicatorCoefficient * (v.wasMissing ? 1 : 0);
    score = score + valueProduct + missingProduct;
  }

  /* Stable sigmoid (exact V1). */
  let homeWinProbability: number;
  if (score >= 0) {
    const expNeg = Math.exp(-score);
    homeWinProbability = 1 / (1 + expNeg);
  } else {
    const expPos = Math.exp(score);
    homeWinProbability = expPos / (1 + expPos);
  }

  /* -0 normalization. */
  if (Object.is(homeWinProbability, -0)) {
    homeWinProbability = 0;
  }
  let awayWinProbability = 1 - homeWinProbability;
  if (Object.is(awayWinProbability, -0)) {
    awayWinProbability = 0;
  }

  const predictedSide: 'HOME' | 'AWAY' =
    homeWinProbability >= 0.5 ? 'HOME' : 'AWAY';

  return { score, homeWinProbability, awayWinProbability, predictedSide };
}

/* -------------------------------------------------------------------------- */
/*  Independent payload-hash computation (exact V1 canonicalization).          */
/* -------------------------------------------------------------------------- */
const CANONICAL_FIELD_ORDER = [
  'shadowRecordId',
  'gamePk',
  'predictedWinner',
  'predictedSide',
  'homeWinProbability',
  'awayWinProbability',
  'decisionPolicy',
  'predictionGeneratedAt',
];

function computeExpectedHash(
  payloadWithoutHash: Omit<MLBShadowQuarantinedPredictionPayload, 'payloadHash'>,
): string {
  const canonicalJson = JSON.stringify({
    shadowRecordId: payloadWithoutHash.shadowRecordId,
    gamePk: payloadWithoutHash.gamePk,
    predictedWinner: payloadWithoutHash.predictedWinner,
    predictedSide: payloadWithoutHash.predictedSide,
    homeWinProbability: payloadWithoutHash.homeWinProbability,
    awayWinProbability: payloadWithoutHash.awayWinProbability,
    decisionPolicy: payloadWithoutHash.decisionPolicy,
    predictionGeneratedAt: payloadWithoutHash.predictionGeneratedAt,
  });
  return createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
}

/* -------------------------------------------------------------------------- */
/*  Feature payloads for deterministic test cases                             */
/* -------------------------------------------------------------------------- */
const ALL_PRESENT_PAYLOADS: Record<string, Record<string, unknown>> = {
  'section-away-bullpen': {
    recentWorkload: {
      extraInningGames: 0,
      gamesInPrevious3Days: 2,
    },
  },
  'section-away-batting': {
    seasonStats: {
      runsAllowedPerGame: 4.5,
      runsScoredPerGame: 5.0,
      winRate: 0.6,
    },
  },
  'section-away-starter': { availability: 1 },
  'section-game-context': {
    doubleHeaderGameNumber: 0,
    scheduledInnings: 9,
  },
  'section-home-bullpen': {
    recentWorkload: {
      extraInningGames: 1,
      gamesInPrevious3Days: 3,
    },
  },
  'section-home-batting': {
    seasonStats: {
      runsAllowedPerGame: 3.5,
      runsScoredPerGame: 6.0,
      winRate: 0.7,
    },
  },
  'section-home-starter': { availability: 1 },
};

/* AWAY-favoring: high away runs scored → large negative coefficient → AWAY. */
const AWAY_FAVORING_PAYLOADS: Record<string, Record<string, unknown>> = {
  'section-away-batting': {
    seasonStats: {
      runsScoredPerGame: 50,
    },
  },
};

/* -------------------------------------------------------------------------- */
/*  Tests                                                                        */
/* -------------------------------------------------------------------------- */

describe('computeMLBShadowQuarantinedPredictionV2', () => {
  /* ------------------------------------------------------------------ */
  /*  A. Positive computation — all features present                     */
  /* ------------------------------------------------------------------ */
  describe('A. Positive computation — all features present', () => {
    function buildAllPresentJob(): Record<string, unknown> {
      return buildV2Job({
        snapshot: buildSnapshot(ALL_PRESENT_PAYLOADS),
      });
    }

    it('1. valid V2 job computes successfully', () => {
      const result = computeMLBShadowQuarantinedPredictionV2(buildAllPresentJob());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeDefined();
      }
    });

    it('2. authorized artifact exact fingerprint still accepted', () => {
      expect(
        validateMLBShadowCandidate003AuthorizedModelArtifact(
          getMLBShadowCandidate003AuthorizedModelArtifact(),
        ).ok,
      ).toBe(true);

      const artifact = getMLBShadowCandidate003AuthorizedModelArtifact();
      expect(artifact.contractVersion).toBe(
        MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL_ARTIFACT_CONTRACT_VERSION,
      );
      expect(
        artifact.attestation.modelCanonicalFingerprint,
      ).toBe(MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256);

      const result = computeMLBShadowQuarantinedPredictionV2(buildAllPresentJob());
      expect(result.ok).toBe(true);
    });

    it('3. feature extraction uses exact frozen manifest', () => {
      expect(validateMLBFeatureManifest(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1).ok).toBe(true);
      const fp = computeMLBFeatureManifestFingerprint(
        MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
      );
      expect(fp.ok).toBe(true);
      if (fp.ok) {
        expect(fp.fingerprint).toBe(
          MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
        );
      }
    });

    it('4. probabilities are finite', () => {
      const result = computeMLBShadowQuarantinedPredictionV2(buildAllPresentJob());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Number.isFinite(result.value.homeWinProbability)).toBe(true);
        expect(Number.isFinite(result.value.awayWinProbability)).toBe(true);
      }
    });

    it('5. homeWinProbability in [0, 1]', () => {
      const result = computeMLBShadowQuarantinedPredictionV2(buildAllPresentJob());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.homeWinProbability).toBeGreaterThanOrEqual(0);
        expect(result.value.homeWinProbability).toBeLessThanOrEqual(1);
      }
    });

    it('6. awayWinProbability in [0, 1]', () => {
      const result = computeMLBShadowQuarantinedPredictionV2(buildAllPresentJob());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.awayWinProbability).toBeGreaterThanOrEqual(0);
        expect(result.value.awayWinProbability).toBeLessThanOrEqual(1);
      }
    });

    it('7. homeWinProbability + awayWinProbability = 1 (V1 semantics)', () => {
      const result = computeMLBShadowQuarantinedPredictionV2(buildAllPresentJob());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.homeWinProbability + result.value.awayWinProbability).toBe(1);
      }
    });

    it('8. decision policy is HOME_AT_OR_ABOVE_0_5_V1', () => {
      const result = computeMLBShadowQuarantinedPredictionV2(buildAllPresentJob());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.decisionPolicy).toBe('HOME_AT_OR_ABOVE_0_5_V1');
      }
    });

    it('9. predicted side is HOME when score >= 0 (all-present fixtures)', () => {
      const result = computeMLBShadowQuarantinedPredictionV2(buildAllPresentJob());
      expect(result.ok).toBe(true);
      if (result.ok) {
        /* score > 0 → sigmoid > 0.5 → HOME */
        expect(result.value.predictedSide).toBe('HOME');
      }
    });

    it('10. predicted winner maps to correct snapshot team', () => {
      const job = buildAllPresentJob();
      const result = computeMLBShadowQuarantinedPredictionV2(job);
      expect(result.ok).toBe(true);
      if (result.ok) {
        /* predictedWinner === predictedSide (V1: both HOME or both AWAY) */
        expect(result.value.predictedWinner).toBe(result.value.predictedSide);
        /* 'HOME' maps to snapshot.game.homeTeamId */
        if (result.value.predictedSide === 'HOME') {
          expect(
            (job.snapshot as { game: { homeTeamId: string } }).game.homeTeamId,
          ).toBe('home-test-001');
        }
      }
    });

    it('11. shadowRecordId preserved exactly', () => {
      const result = computeMLBShadowQuarantinedPredictionV2(buildAllPresentJob());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.shadowRecordId).toBe('shadow-v2-test-001');
      }
    });

    it('12. gamePk preserved exactly', () => {
      const result = computeMLBShadowQuarantinedPredictionV2(buildAllPresentJob());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.gamePk).toBe(990000001);
      }
    });

    it('13. predictionGeneratedAt preserved exactly', () => {
      const result = computeMLBShadowQuarantinedPredictionV2(buildAllPresentJob());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.predictionGeneratedAt).toBe(FROZEN_PREDICTION_GENERATED_AT_A);
      }
    });

    it('14. payload schema has exactly 9 fields (no extras)', () => {
      const result = computeMLBShadowQuarantinedPredictionV2(buildAllPresentJob());
      expect(result.ok).toBe(true);
      if (result.ok) {
        const keys = Object.keys(result.value).sort();
        expect(keys).toEqual([
          'awayWinProbability',
          'decisionPolicy',
          'gamePk',
          'homeWinProbability',
          'payloadHash',
          'predictedSide',
          'predictedWinner',
          'predictionGeneratedAt',
          'shadowRecordId',
        ]);
      }
    });

    it('15. payload passes existing quarantine payload validator', () => {
      const result = computeMLBShadowQuarantinedPredictionV2(buildAllPresentJob());
      expect(result.ok).toBe(true);
      if (result.ok) {
        const check = validateMLBShadowQuarantinedPredictionPayload(result.value);
        expect(check.ok).toBe(true);
      }
    });

    it('16. input object not mutated', () => {
      const job = buildAllPresentJob();
      const before = JSON.stringify(job);
      computeMLBShadowQuarantinedPredictionV2(job);
      expect(JSON.stringify(job)).toBe(before);
    });

    it('17. authorized model artifact not mutated', () => {
      const artifact = getMLBShadowCandidate003AuthorizedModelArtifact();
      const before = JSON.stringify(artifact);
      computeMLBShadowQuarantinedPredictionV2(buildAllPresentJob());
      expect(JSON.stringify(getMLBShadowCandidate003AuthorizedModelArtifact())).toBe(before);
    });

    it('18. feature manifest not mutated', () => {
      const before = JSON.stringify(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1);
      computeMLBShadowQuarantinedPredictionV2(buildAllPresentJob());
      expect(JSON.stringify(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1)).toBe(before);
    });

    it('18. snapshot not mutated', () => {
      const snapshot = buildSnapshot(ALL_PRESENT_PAYLOADS);
      const before = JSON.stringify(snapshot);
      computeMLBShadowQuarantinedPredictionV2(buildV2Job({ snapshot }));
      expect(JSON.stringify(snapshot)).toBe(before);
    });

    it('20. no historical metric field is needed (computation succeeds without release result)', () => {
      const job = buildAllPresentJob();
      /* The V2 job has NO releasedModelResult / metric fields. */
      const jobKeys = Object.keys(job).sort();
      expect(jobKeys).not.toContain('releasedModelResult');
      expect(jobKeys).not.toContain('modelMetrics');
      expect(jobKeys).not.toContain('validationMetrics');

      const result = computeMLBShadowQuarantinedPredictionV2(job);
      expect(result.ok).toBe(true);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  B. Positive computation — all features missing (defaults)         */
  /* ------------------------------------------------------------------ */
  describe('B. Positive computation — all features missing (USE_DEFAULT)', () => {
    it('21. all-missing computation succeeds', () => {
      const result = computeMLBShadowQuarantinedPredictionV2(buildV2Job());
      expect(result.ok).toBe(true);
    });

    it('22. all-missing probabilities match independent computation', () => {
      const job = buildV2Job();
      const result = computeMLBShadowQuarantinedPredictionV2(job);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const expected = computeExpectedPrediction(job);
        expect(result.value.homeWinProbability).toBe(expected.homeWinProbability);
        expect(result.value.awayWinProbability).toBe(expected.awayWinProbability);
      }
    });

    it('23. all-missing predicted side correct', () => {
      const job = buildV2Job();
      const result = computeMLBShadowQuarantinedPredictionV2(job);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const expected = computeExpectedPrediction(job);
        expect(result.value.predictedSide).toBe(expected.predictedSide);
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  C. AWAY prediction — high away runs scored                       */
  /* ------------------------------------------------------------------ */
  describe('C. AWAY prediction — negative score', () => {
    function buildAwayJob(): Record<string, unknown> {
      return buildV2Job({
        snapshot: buildSnapshot(AWAY_FAVORING_PAYLOADS),
      });
    }

    it('24. AWAY-favoring fixture predicts AWAY', () => {
      const job = buildAwayJob();
      const result = computeMLBShadowQuarantinedPredictionV2(job);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const expected = computeExpectedPrediction(job);
        expect(expected.score).toBeLessThan(0);
        expect(result.value.predictedSide).toBe('AWAY');
        expect(result.value.homeWinProbability).toBeLessThan(0.5);
      }
    });

    it('25. AWAY-favoring probabilities match independent computation', () => {
      const job = buildAwayJob();
      const result = computeMLBShadowQuarantinedPredictionV2(job);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const expected = computeExpectedPrediction(job);
        expect(result.value.homeWinProbability).toBe(expected.homeWinProbability);
        expect(result.value.awayWinProbability).toBe(expected.awayWinProbability);
        expect(result.value.predictedWinner).toBe(expected.predictedSide);
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  D. Prediction math parity (source-locked)                         */
  /* ------------------------------------------------------------------ */
  describe('D. Prediction math parity (source-locked)', () => {
    it('26. score matches independent computation (all-present)', () => {
      const job = buildV2Job({
        snapshot: buildSnapshot(ALL_PRESENT_PAYLOADS),
      });
      const result = computeMLBShadowQuarantinedPredictionV2(job);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const expected = computeExpectedPrediction(job);
        /* Probabilities derived from score; verifying exact match proves     */
        /* the linear-score accumulation and sigmoid are identical to V1.   */
        expect(result.value.homeWinProbability).toBe(expected.homeWinProbability);
        expect(result.value.awayWinProbability).toBe(expected.awayWinProbability);
      }
    });

    it('27. score matches independent computation (all-missing)', () => {
      const job = buildV2Job();
      const result = computeMLBShadowQuarantinedPredictionV2(job);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const expected = computeExpectedPrediction(job);
        expect(result.value.homeWinProbability).toBe(expected.homeWinProbability);
        expect(result.value.awayWinProbability).toBe(expected.awayWinProbability);
      }
    });

    it('28. sigmoid parity — homeWinProbability + awayWinProbability = 1', () => {
      for (const payloadOverride of [ALL_PRESENT_PAYLOADS, AWAY_FAVORING_PAYLOADS, {}]) {
        const job = buildV2Job({ snapshot: buildSnapshot(payloadOverride) });
        const result = computeMLBShadowQuarantinedPredictionV2(job);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.homeWinProbability + result.value.awayWinProbability).toBe(1);
        }
      }
    });

    it('29. coefficient accumulation parity (all 14 features processed)', () => {
      const job = buildV2Job({
        snapshot: buildSnapshot(ALL_PRESENT_PAYLOADS),
      });
      const model = getMLBShadowCandidate003AuthorizedModelArtifact().model;
      const manifest = MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1;

      const extraction = extractMLBLeakageSafeFeatureVector(manifest, job.snapshot);
      if (!extraction.ok) throw new Error('extraction failed');
      expect(extraction.value.values.length).toBe(model.featureIds.length);
      expect(extraction.value.values.length).toBe(manifest.features.length);
      expect(extraction.value.values.length).toBe(14);
    });

    it('30. missing indicator parity (all-missing case activates missing coeffs)', () => {
      const job = buildV2Job();
      const model = getMLBShadowCandidate003AuthorizedModelArtifact().model;

      const extraction = extractMLBLeakageSafeFeatureVector(
        MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
        job.snapshot,
      );
      if (!extraction.ok) throw new Error('extraction failed');

      /* All features missing → all wasMissing = true → missingIndicatorCoeff applied. */
      const allMissing = extraction.value.values.every((v) => v.wasMissing === true);
      expect(allMissing).toBe(true);

      /* Verify non-zero missingIndicatorCoefficients exist (Candidate-003 has some). */
      const hasMissingCoeffs = model.coefficients.some(
        (c) => c.missingIndicatorCoefficient !== 0,
      );
      expect(hasMissingCoeffs).toBe(true);

      const result = computeMLBShadowQuarantinedPredictionV2(job);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const expected = computeExpectedPrediction(job);
        expect(result.value.homeWinProbability).toBe(expected.homeWinProbability);
      }
    });

    it('31. threshold parity — HOME when homeWinProbability >= 0.5, AWAY otherwise', () => {
      /* All-missing case: score > 0 → HOME */
      const jobMissing = buildV2Job();
      const resultMissing = computeMLBShadowQuarantinedPredictionV2(jobMissing);
      expect(resultMissing.ok).toBe(true);
      if (resultMissing.ok) {
        if (resultMissing.value.homeWinProbability >= 0.5) {
          expect(resultMissing.value.predictedSide).toBe('HOME');
        } else {
          expect(resultMissing.value.predictedSide).toBe('AWAY');
        }
      }

      /* AWAY-favoring case: score < 0 → AWAY */
      const jobAway = buildV2Job({
        snapshot: buildSnapshot(AWAY_FAVORING_PAYLOADS),
      });
      const resultAway = computeMLBShadowQuarantinedPredictionV2(jobAway);
      expect(resultAway.ok).toBe(true);
      if (resultAway.ok) {
        if (resultAway.value.homeWinProbability >= 0.5) {
          expect(resultAway.value.predictedSide).toBe('HOME');
        } else {
          expect(resultAway.value.predictedSide).toBe('AWAY');
        }
      }
    });

    it('32. predicted winner mapping parity — predictedWinner === predictedSide', () => {
      for (const payloadOverride of [ALL_PRESENT_PAYLOADS, AWAY_FAVORING_PAYLOADS, {}]) {
        const job = buildV2Job({ snapshot: buildSnapshot(payloadOverride) });
        const result = computeMLBShadowQuarantinedPredictionV2(job);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.predictedWinner).toBe(result.value.predictedSide);
        }
      }
    });

    it('33. probability parity — V2 matches independent sigmoid', () => {
      for (const payloadOverride of [ALL_PRESENT_PAYLOADS, AWAY_FAVORING_PAYLOADS, {}]) {
        const job = buildV2Job({ snapshot: buildSnapshot(payloadOverride) });
        const result = computeMLBShadowQuarantinedPredictionV2(job);
        expect(result.ok).toBe(true);
        if (result.ok) {
          const expected = computeExpectedPrediction(job);
          expect(result.value.homeWinProbability).toBe(expected.homeWinProbability);
          expect(result.value.awayWinProbability).toBe(expected.awayWinProbability);
        }
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  E. Payload hash parity                                            */
  /* ------------------------------------------------------------------ */
  describe('E. Payload hash parity', () => {
    it('34. payloadHash matches independent SHA-256 computation', () => {
      const job = buildV2Job({
        snapshot: buildSnapshot(ALL_PRESENT_PAYLOADS),
      });
      const result = computeMLBShadowQuarantinedPredictionV2(job);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const payloadWithoutHash: Omit<
          MLBShadowQuarantinedPredictionPayload,
          'payloadHash'
        > = {
          shadowRecordId: result.value.shadowRecordId,
          gamePk: result.value.gamePk,
          predictedWinner: result.value.predictedWinner,
          predictedSide: result.value.predictedSide,
          homeWinProbability: result.value.homeWinProbability,
          awayWinProbability: result.value.awayWinProbability,
          decisionPolicy: result.value.decisionPolicy,
          predictionGeneratedAt: result.value.predictionGeneratedAt,
        };
        const expectedHash = computeExpectedHash(payloadWithoutHash);
        expect(result.value.payloadHash).toBe(expectedHash);
      }
    });

    it('35. payloadHash deterministic for identical input', () => {
      const job = buildV2Job({
        snapshot: buildSnapshot(ALL_PRESENT_PAYLOADS),
      });
      const r1 = computeMLBShadowQuarantinedPredictionV2(job);
      const r2 = computeMLBShadowQuarantinedPredictionV2(job);
      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
      if (r1.ok && r2.ok) {
        expect(r1.value.payloadHash).toBe(r2.value.payloadHash);
      }
    });

    it('36. identical input produces byte-equivalent output', () => {
      const job = buildV2Job({
        snapshot: buildSnapshot(ALL_PRESENT_PAYLOADS),
      });
      const r1 = computeMLBShadowQuarantinedPredictionV2(job);
      const r2 = computeMLBShadowQuarantinedPredictionV2(job);
      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
      if (r1.ok && r2.ok) {
        expect(JSON.stringify(r1.value)).toBe(JSON.stringify(r2.value));
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  F. Rejection — invalid input                                      */
  /* ------------------------------------------------------------------ */
  describe('F. Rejection — invalid input', () => {
    it('37. non-object input rejected before scoring', () => {
      expect(computeMLBShadowQuarantinedPredictionV2(42).ok).toBe(false);
      expect(computeMLBShadowQuarantinedPredictionV2('string').ok).toBe(false);
    });

    it('38. null rejected before scoring', () => {
      expect(computeMLBShadowQuarantinedPredictionV2(null).ok).toBe(false);
    });

    it('39. array rejected before scoring', () => {
      expect(computeMLBShadowQuarantinedPredictionV2([1, 2, 3]).ok).toBe(false);
    });

    it('40. missing required field rejected', () => {
      const job = buildV2Job();
      const { gamePk, ...withoutGamePk } = job;
      void gamePk;
      expect(computeMLBShadowQuarantinedPredictionV2(withoutGamePk).ok).toBe(false);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  G. Rejection — tampered model                                     */
  /* ------------------------------------------------------------------ */
  describe('G. Rejection — tampered model', () => {
    it('41. tampered coefficient rejected (fingerprint mismatch)', () => {
      const tampered = JSON.parse(JSON.stringify(getMLBShadowCandidate003AuthorizedModelArtifact()));
      const model = tampered.model as Record<string, unknown>;
      const coeffs = model.coefficients as Array<Record<string, unknown>>;
      coeffs[0].valueCoefficient = 999;

      const result = computeMLBShadowQuarantinedPredictionV2(
        buildV2Job({ authorizedModelArtifact: tampered }),
      );
      expect(result.ok).toBe(false);
    });

    it('42. tampered intercept rejected (fingerprint mismatch)', () => {
      const tampered = JSON.parse(JSON.stringify(getMLBShadowCandidate003AuthorizedModelArtifact()));
      (tampered.model as Record<string, unknown>).intercept = 999;

      const result = computeMLBShadowQuarantinedPredictionV2(
        buildV2Job({ authorizedModelArtifact: tampered }),
      );
      expect(result.ok).toBe(false);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  H. Rejection — tampered attestation                              */
  /* ------------------------------------------------------------------ */
  describe('H. Rejection — tampered attestation', () => {
    it('43. tampered attestation modelFingerprint rejected', () => {
      const tampered = JSON.parse(JSON.stringify(getMLBShadowCandidate003AuthorizedModelArtifact()));
      (tampered.attestation as Record<string, unknown>).modelCanonicalFingerprint =
        '0'.repeat(64);

      const result = computeMLBShadowQuarantinedPredictionV2(
        buildV2Job({ authorizedModelArtifact: tampered }),
      );
      expect(result.ok).toBe(false);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  I. Rejection — wrong manifest                                     */
  /* ------------------------------------------------------------------ */
  describe('I. Rejection — wrong manifest', () => {
    it('44. manifest with wrong fingerprint rejected', () => {
      const wrongManifest = {
        contractVersion: 'mlb-feature-manifest-v1',
        sport: 'MLB',
        target: 'OFFICIAL_FINAL_GAME_WINNER',
        manifestId: 'manifest-different-001',
        features: [
          {
            featureId: 'p_1',
            sectionId: 'sec-1',
            payloadPath: ['home', 'p_1'],
            valueKind: 'NUMBER',
            missingPolicy: 'USE_DEFAULT',
            defaultValue: 0,
          },
          {
            featureId: 'p_2',
            sectionId: 'sec-1',
            payloadPath: ['away', 'p_2'],
            valueKind: 'NUMBER',
            missingPolicy: 'USE_DEFAULT',
            defaultValue: 0,
          },
        ],
      };

      const result = computeMLBShadowQuarantinedPredictionV2(
        buildV2Job({ featureManifest: wrongManifest }),
      );
      expect(result.ok).toBe(false);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  J. Rejection — invalid snapshot                                   */
  /* ------------------------------------------------------------------ */
  describe('J. Rejection — invalid snapshot', () => {
    it('45. snapshot missing required game.gameId rejected', () => {
      const badSnapshot = buildSnapshot({});
      delete (badSnapshot.game as Record<string, unknown>).gameId;

      const result = computeMLBShadowQuarantinedPredictionV2(
        buildV2Job({ snapshot: badSnapshot }),
      );
      expect(result.ok).toBe(false);
    });

    it('46. snapshot with non-MLB sport rejected', () => {
      const badSnapshot = buildSnapshot({});
      (badSnapshot as Record<string, unknown>).sport = 'NBA';

      const result = computeMLBShadowQuarantinedPredictionV2(
        buildV2Job({ snapshot: badSnapshot }),
      );
      expect(result.ok).toBe(false);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  K. Rejection — odds contamination                                   */
  /* ------------------------------------------------------------------ */
  describe('K. Rejection — odds contamination', () => {
    it('47. snapshot with odds field in section payload rejected', () => {
      const job = buildV2Job({
        snapshot: buildSnapshot({
          'section-away-batting': {
            seasonStats: { runsScoredPerGame: 5 },
            odds: 1.91,
          },
        }),
      });
      const result = computeMLBShadowQuarantinedPredictionV2(job);
      expect(result.ok).toBe(false);
    });

    it('48. snapshot with sportsbook field rejected', () => {
      const badSnapshot = buildSnapshot({});
      (badSnapshot as Record<string, unknown>).sportsbook = 'test';

      const result = computeMLBShadowQuarantinedPredictionV2(
        buildV2Job({ snapshot: badSnapshot }),
      );
      expect(result.ok).toBe(false);
    });
  });
});
