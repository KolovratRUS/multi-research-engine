import { describe, it, expect } from 'vitest';

/* -------------------------------------------------------------------------- */
/*  Imports — production V2 contract under test                               */
/* -------------------------------------------------------------------------- */
import {
  validateMLBShadowExecutionJobV2,
  MLB_SHADOW_EXECUTION_JOB_V2_CONTRACT_VERSION,
  type MLBShadowExecutionJobV2,
  type MLBShadowExecutionJobV2ValidationResult,
} from '@/prediction/mlb/mlb-shadow-execution-job-v2-contract';

/* V1 compatibility imports (proves V1 is untouched by this phase) */
import { MLB_SHADOW_EXECUTION_JOB_CONTRACT_VERSION, type MLBShadowExecutionJobV1 } from '@/prediction/mlb/mlb-shadow-execution-job-contract';

/* Authorized artifact + fingerprint constant */
import {
  getMLBShadowCandidate003AuthorizedModelArtifact,
  validateMLBShadowCandidate003AuthorizedModelArtifact,
  MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL_ARTIFACT_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-shadow-candidate-003-authorized-model-artifact';
import {
  MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256,
} from '@/prediction/mlb/mlb-shadow-model-fingerprint';

/* Real frozen manifest + fingerprint (the only accepted manifest identity) */
import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
  computeMLBFeatureManifestFingerprint,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';

/* Reusable existing validators (fixture-validation assertions only) */
import { validateMLBFeatureManifest } from '@/prediction/mlb/mlb-feature-vector-contract';
import {
  validateMLBCanonicalPregameSnapshot,
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';

/* -------------------------------------------------------------------------- */
/*  Frozen test timestamps                                                     */
/* -------------------------------------------------------------------------- */
const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';
const FROZEN_PREDICTION_GENERATED_AT = '2026-07-15T18:40:00Z';
const FROZEN_OFFICIAL_DATE = '2026-07-15';

/* -------------------------------------------------------------------------- */
/*  Fixture builders (adapted from the V1 test file; identical semantics)      */
/* -------------------------------------------------------------------------- */

/** Structurally valid manifest that is NOT the frozen real-pregame manifest. */
function buildValidManifest(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    contractVersion: 'mlb-feature-manifest-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    manifestId: 'manifest-1',
    features: [
      {
        featureId: 'p_1',
        sectionId: 'sec-1',
        payloadPath: ['home', 'p_1'],
        valueKind: 'NUMBER',
        missingPolicy: 'REJECT',
        defaultValue: null,
      },
      {
        featureId: 'p_2',
        sectionId: 'sec-1',
        payloadPath: ['away', 'p_2'],
        valueKind: 'NUMBER',
        missingPolicy: 'REJECT',
        defaultValue: null,
      },
    ],
    ...overrides,
  } as Record<string, unknown>;
}

/** Structurally valid canonical pregame snapshot (carries gameId, not gamePk). */
function buildValidSnapshot(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    contractVersion: MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    snapshotId: 'snapshot-1',
    capturedAt: FROZEN_CAPTURED_AT,
    dataCutoffAt: FROZEN_DATA_CUTOFF,
    game: {
      gameId: 'game-1',
      scheduledStartAt: FROZEN_SCHEDULED_START,
      officialDate: FROZEN_OFFICIAL_DATE,
      season: 2026,
      gameType: 'REGULAR_SEASON',
      status: 'SCHEDULED',
      homeTeamId: 'home-1',
      awayTeamId: 'away-1',
      venueId: 'venue-1',
      neutralSite: false,
      doubleheader: null,
      ...((overrides.game as Record<string, unknown> | undefined) ?? {}),
    },
    startingPitchers: {
      home: {
        state: 'PROBABLE',
        pitcherId: 'p-1',
        announcedAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
        ...((overrides.startingPitchers as Record<string, Record<string, unknown>> | undefined)?.home ?? {}),
      },
      away: {
        state: 'PROBABLE',
        pitcherId: 'p-2',
        announcedAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-away'],
        ...((overrides.startingPitchers as Record<string, Record<string, unknown>> | undefined)?.away ?? {}),
      },
    },
    sourceReferences: [
      {
        sourceRefId: 'src-away',
        sourceName: 'MLB Stats API',
        sourceCategory: 'OFFICIAL',
        roles: ['STARTING_PITCHER'],
        providerRecordId: null,
        fetchedAt: FROZEN_CAPTURED_AT,
        sourceUpdatedAt: FROZEN_DATA_CUTOFF,
      },
      {
        sourceRefId: 'src-official',
        sourceName: 'MLB Stats API',
        sourceCategory: 'OFFICIAL',
        roles: ['GAME_IDENTITY'],
        providerRecordId: null,
        fetchedAt: FROZEN_CAPTURED_AT,
        sourceUpdatedAt: FROZEN_DATA_CUTOFF,
      },
    ],
    sections: [
      {
        sectionId: 'sec-1',
        kind: 'GAME_CONTEXT',
        entity: { scope: 'GAME', entityId: null },
        status: 'AVAILABLE',
        asOfAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
        payload: { home: { p_1: 1 }, away: { p_2: 1 } },
        ...((overrides.sections as Record<string, unknown>[] | undefined)?.[0] ?? {}),
      },
    ],
    dataCompleteness: 'COMPLETE',
    warnings: [],
    ...overrides,
  } as Record<string, unknown>;
}

/**
 * A fully valid V2 shadow execution job. Uses the FROZEN candidate-003
 * authorized artifact, the frozen real-pregame manifest, and a valid snapshot.
 */
function buildValidV2Job(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    repoRoot: '/Users/samkassirov/multi-research-engine',
    shadowRecordId: 'shadow-001',
    gamePk: 990000001,
    predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
    authorizedModelArtifact: getMLBShadowCandidate003AuthorizedModelArtifact(),
    featureManifest: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    snapshot: buildValidSnapshot(),
    ...overrides,
  };
}

/** Deep-clone the frozen artifact so tests can tamper safely (test-only). */
function cloneArtifact(): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(getMLBShadowCandidate003AuthorizedModelArtifact()),
  );
}

const FROZEN_MANIFEST_FINGERPRINT =
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT;

const V2_AUTHORIZED_JOB_KEYS: readonly string[] = [
  'repoRoot',
  'shadowRecordId',
  'gamePk',
  'predictionGeneratedAt',
  'authorizedModelArtifact',
  'featureManifest',
  'snapshot',
  'officialDate',
  'scheduledStartAt',
  'latencyMs',
  'featureManifestId',
  'featureManifestFingerprint',
  'timingReferenceContractVersion',
  'timingReferenceCutoffAt',
];

/* -------------------------------------------------------------------------- */
/*  Tests                                                                       */
/* -------------------------------------------------------------------------- */
describe('mlb-shadow-execution-job-v2-contract', () => {
  describe('A. Positive cases', () => {
    it('1. valid complete V2 job passes (all optional fields present)', () => {
      const job = buildValidV2Job({
        officialDate: FROZEN_OFFICIAL_DATE,
        scheduledStartAt: FROZEN_SCHEDULED_START,
        latencyMs: 1234,
        featureManifestId: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
        featureManifestFingerprint: FROZEN_MANIFEST_FINGERPRINT,
        timingReferenceContractVersion: 'mlb-offline-pregame-inference-contract-v1',
        timingReferenceCutoffAt: FROZEN_DATA_CUTOFF,
      });

      const result = validateMLBShadowExecutionJobV2(job);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.featureManifestId).toBe(
          MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
        );
        expect(result.value.featureManifestFingerprint).toBe(
          FROZEN_MANIFEST_FINGERPRINT,
        );
        expect(result.value.latencyMs).toBe(1234);
      }
    });

    it('2. valid V2 job with all optional fields omitted passes', () => {
      const result = validateMLBShadowExecutionJobV2(buildValidV2Job());
      expect(result.ok).toBe(true);
    });
  });

  describe('B. Non-object / structural rejection', () => {
    it('3. non-object input fails', () => {
      const result = validateMLBShadowExecutionJobV2(42);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.some((i) => i.code === 'NOT_PLAIN_OBJECT'),
        ).toBe(true);
      }
    });

    it('4. null fails', () => {
      const result = validateMLBShadowExecutionJobV2(null);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.some((i) => i.code === 'NOT_PLAIN_OBJECT'),
        ).toBe(true);
      }
    });

    it('5. array fails', () => {
      const result = validateMLBShadowExecutionJobV2([1, 2, 3]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.some((i) => i.code === 'NOT_PLAIN_OBJECT'),
        ).toBe(true);
      }
    });
  });

  describe('C. Required scalar fields', () => {
    it('6. missing repoRoot fails', () => {
      const { repoRoot, ...without } = buildValidV2Job();
      void repoRoot;
      const result = validateMLBShadowExecutionJobV2(without);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.find((i) => i.path === '$.repoRoot')?.code,
        ).toBe('MISSING_FIELD');
      }
    });

    it('7. invalid/empty repoRoot fails', () => {
      expect(
        validateMLBShadowExecutionJobV2(buildValidV2Job({ repoRoot: '' })).ok,
      ).toBe(false);
      expect(
        validateMLBShadowExecutionJobV2(buildValidV2Job({ repoRoot: '   ' })).ok,
      ).toBe(false);
      expect(
        validateMLBShadowExecutionJobV2(buildValidV2Job({ repoRoot: 123 })).ok,
      ).toBe(false);
      expect(
        validateMLBShadowExecutionJobV2(
          buildValidV2Job({ repoRoot: '/tmp/\u0000bad' }),
        ).ok,
      ).toBe(false);
    });

    it('8. missing shadowRecordId fails', () => {
      const { shadowRecordId, ...without } = buildValidV2Job();
      void shadowRecordId;
      const result = validateMLBShadowExecutionJobV2(without);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.find((i) => i.path === '$.shadowRecordId')?.code,
        ).toBe('MISSING_FIELD');
      }
    });

    it('9. empty shadowRecordId fails', () => {
      expect(
        validateMLBShadowExecutionJobV2(
          buildValidV2Job({ shadowRecordId: '' }),
        ).ok,
      ).toBe(false);
      expect(
        validateMLBShadowExecutionJobV2(
          buildValidV2Job({ shadowRecordId: '   ' }),
        ).ok,
      ).toBe(false);
      expect(
        validateMLBShadowExecutionJobV2(buildValidV2Job({ shadowRecordId: 9 })).ok,
      ).toBe(false);
    });

    it('10. invalid gamePk fails', () => {
      expect(
        validateMLBShadowExecutionJobV2(
          buildValidV2Job({ gamePk: '990000001' }),
        ).ok,
      ).toBe(false);
      expect(
        validateMLBShadowExecutionJobV2(buildValidV2Job({ gamePk: 0 })).ok,
      ).toBe(false);
      expect(
        validateMLBShadowExecutionJobV2(buildValidV2Job({ gamePk: -1 })).ok,
      ).toBe(false);
      expect(
        validateMLBShadowExecutionJobV2(buildValidV2Job({ gamePk: 1.5 })).ok,
      ).toBe(false);
      expect(
        validateMLBShadowExecutionJobV2(buildValidV2Job({ gamePk: NaN })).ok,
      ).toBe(false);
      expect(
        validateMLBShadowExecutionJobV2(buildValidV2Job({ gamePk: Infinity })).ok,
      ).toBe(false);
    });

    it('11. invalid predictionGeneratedAt fails', () => {
      expect(
        validateMLBShadowExecutionJobV2(
          buildValidV2Job({ predictionGeneratedAt: 'not-a-timestamp' }),
        ).ok,
      ).toBe(false);
      expect(
        validateMLBShadowExecutionJobV2(
          buildValidV2Job({ predictionGeneratedAt: '2026-13-40T99:99:99Z' }),
        ).ok,
      ).toBe(false);
      expect(
        validateMLBShadowExecutionJobV2(
          buildValidV2Job({ predictionGeneratedAt: 12345 }),
        ).ok,
      ).toBe(false);
      // exactly the supplied value (not normalized / not generated)
      expect(
        validateMLBShadowExecutionJobV2(
          buildValidV2Job({ predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT }),
        ).ok,
      ).toBe(true);
    });
  });

  describe('D. Authorized model artifact validation (transitive gates)', () => {
    it('12. valid authorizedModelArtifact required (structural ok + authoritative model)', () => {
      expect(
        validateMLBShadowCandidate003AuthorizedModelArtifact(
          getMLBShadowCandidate003AuthorizedModelArtifact(),
        ).ok,
      ).toBe(true);
      const result = validateMLBShadowExecutionJobV2(buildValidV2Job());
      expect(result.ok).toBe(true);
    });

    it('13. structurally invalid authorizedModelArtifact fails', () => {
      const result = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ authorizedModelArtifact: { notAnArtifact: true } }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.find((i) => i.path === '$.authorizedModelArtifact')
            ?.code,
        ).toBe('AUTHORIZED_ARTIFACT_INVALID');
      }
    });

    it('14. tampered model inside authorizedModelArtifact fails transitively', () => {
      const tampered = cloneArtifact();
      const model = tampered.model as Record<string, unknown>;
      const coeffs = model.coefficients as Array<
        Record<string, unknown>
      >;
      coeffs[0].valueCoefficient = 999;

      const result = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ authorizedModelArtifact: tampered }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.find((i) => i.path === '$.authorizedModelArtifact')
            ?.code,
        ).toBe('AUTHORIZED_ARTIFACT_INVALID');
      }
    });

    it('15. tampered attestation inside authorizedModelArtifact fails transitively', () => {
      const tampered = cloneArtifact();
      const attestation = tampered.attestation as Record<string, unknown>;
      attestation.trainArtifactSha256 = '0'.repeat(64);

      const result = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ authorizedModelArtifact: tampered }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.find((i) => i.path === '$.authorizedModelArtifact')
            ?.code,
        ).toBe('AUTHORIZED_ARTIFACT_INVALID');
      }
    });

    it('50. authorized model artifact fingerprint matches the exact Candidate-003 identity', () => {
      const result = validateMLBShadowExecutionJobV2(buildValidV2Job());
      expect(result.ok).toBe(true);
      if (result.ok) {
        const frozen = getMLBShadowCandidate003AuthorizedModelArtifact();
        expect(result.value.authorizedModelArtifact).toEqual(frozen);
        expect(result.value.authorizedModelArtifact.attestation.modelCanonicalFingerprint).toBe(
          MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256,
        );
        expect(
          result.value.authorizedModelArtifact.contractVersion,
        ).toBe(MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL_ARTIFACT_CONTRACT_VERSION);
      }
    });
  });

  describe('E. Feature manifest validation', () => {
    it('16. valid featureManifest required', () => {
      expect(
        validateMLBFeatureManifest(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1).ok,
      ).toBe(true);
      const result = validateMLBShadowExecutionJobV2(buildValidV2Job());
      expect(result.ok).toBe(true);
    });

    it('17. invalid featureManifest fails', () => {
      const result = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ featureManifest: { notAManifest: true } }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.find((i) => i.path === '$.featureManifest')?.code,
        ).toBe('MANIFEST_INVALID');
      }
    });

    it('18. wrong frozen manifest identity/fingerprint fails', () => {
      const result = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ featureManifest: buildValidManifest() }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.find((i) => i.path === '$.featureManifest')?.code,
        ).toBe('MANIFEST_FINGERPRINT_MISMATCH');
      }
    });

    it('18b. frozen manifest fingerprint equals the accepted constant', () => {
      const fp = computeMLBFeatureManifestFingerprint(
        MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
      );
      expect(fp.ok).toBe(true);
      if (fp.ok) {
        expect(fp.fingerprint).toBe(FROZEN_MANIFEST_FINGERPRINT);
      }
    });

    it('18c. manifest ID crosscheck enforced (featureManifestId mismatch rejected)', () => {
      // Correct manifestId is accepted (proves crosscheck does not over-reject).
      const okResult = validateMLBShadowExecutionJobV2(
        buildValidV2Job({
          featureManifestId:
            MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
        }),
      );
      expect(okResult.ok).toBe(true);

      // Mismatched manifestId is rejected by the cross-field identity check.
      const result = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ featureManifestId: 'wrong-manifest-id' }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.find((i) => i.path === '$.featureManifestId')?.code,
        ).toBe('SOURCE_IDENTITY_MISMATCH');
      }
    });

    it('18d. manifest fingerprint crosscheck enforced (featureManifestFingerprint mismatch rejected)', () => {
      const result = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ featureManifestFingerprint: '0'.repeat(64) }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.find((i) => i.path === '$.featureManifestFingerprint')
            ?.code,
        ).toBe('MANIFEST_FINGERPRINT_MISMATCH');
      }
    });
  });

  describe('F. Snapshot validation', () => {
    it('19. valid canonical snapshot required', () => {
      expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot()).ok).toBe(
        true,
      );
      const result = validateMLBShadowExecutionJobV2(buildValidV2Job());
      expect(result.ok).toBe(true);
    });

    it('20. invalid snapshot fails', () => {
      const result = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ snapshot: { notASnapshot: true } }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.find((i) => i.path === '$.snapshot')?.code,
        ).toBe('SNAPSHOT_INVALID');
      }
    });
  });

  describe('G. Snapshot/game identity (source truth -> NO check)', () => {
    it('21. canonical snapshot exposes no authoritative gamePk (no identity gate)', () => {
      const snap = buildValidSnapshot();
      expect(snap.game).toHaveProperty('gameId');
      expect(snap.game).not.toHaveProperty('gamePk');
      const result = validateMLBShadowExecutionJobV2(buildValidV2Job());
      expect(result.ok).toBe(true);
    });
  });

  describe('H. Optional metadata / latency', () => {
    it('22. negative latencyMs fails', () => {
      const result = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ latencyMs: -1 }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.find((i) => i.path === '$.latencyMs')?.code,
        ).toBe('INVALID_INTEGER');
      }
    });

    it('23. non-finite latencyMs fails', () => {
      expect(
        validateMLBShadowExecutionJobV2(buildValidV2Job({ latencyMs: NaN })).ok,
      ).toBe(false);
      expect(
        validateMLBShadowExecutionJobV2(buildValidV2Job({ latencyMs: Infinity })).ok,
      ).toBe(false);
      expect(
        validateMLBShadowExecutionJobV2(
          buildValidV2Job({ latencyMs: -Infinity }),
        ).ok,
      ).toBe(false);
    });

    it('24. invalid optional timestamp/date fields fail', () => {
      expect(
        validateMLBShadowExecutionJobV2(
          buildValidV2Job({ officialDate: 'not-a-date' }),
        ).ok,
      ).toBe(false);
      expect(
        validateMLBShadowExecutionJobV2(
          buildValidV2Job({ officialDate: '2026-13-40' }),
        ).ok,
      ).toBe(false);
      expect(
        validateMLBShadowExecutionJobV2(
          buildValidV2Job({ scheduledStartAt: 'not-a-timestamp' }),
        ).ok,
      ).toBe(false);
      expect(
        validateMLBShadowExecutionJobV2(
          buildValidV2Job({ timingReferenceCutoffAt: 'bad' }),
        ).ok,
      ).toBe(false);
    });

    it('25. invalid optional manifest metadata fails under existing semantics', () => {
      expect(
        validateMLBShadowExecutionJobV2(
          buildValidV2Job({ featureManifestId: 123 }),
        ).ok,
      ).toBe(false);
      expect(
        validateMLBShadowExecutionJobV2(
          buildValidV2Job({ featureManifestFingerprint: 'not-a-hash' }),
        ).ok,
      ).toBe(false);
      expect(
        validateMLBShadowExecutionJobV2(
          buildValidV2Job({ timingReferenceContractVersion: 7 }),
        ).ok,
      ).toBe(false);
    });
  });

  describe('I. Top-level unknown / sportsbook fields', () => {
    it('26. unknown top-level field fails', () => {
      const result = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ unexpected: true }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.find((i) => i.path === '$.unexpected')?.code,
        ).toBe('UNKNOWN_FIELD');
      }
    });

    it('27. unknown `releasedModelResult` field fails (V2 exclusion — not required)', () => {
      const result = validateMLBShadowExecutionJobV2(
        buildValidV2Job({
          releasedModelResult: { notARelease: true },
        }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.find((i) => i.path === '$.releasedModelResult')?.code,
        ).toBe('UNKNOWN_FIELD');
      }
    });

    it('28. unknown `odds` field fails', () => {
      const result = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ odds: 1.9 }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.find((i) => i.path === '$.odds')?.code,
        ).toBe('UNKNOWN_FIELD');
      }
    });

    it('29. unknown `sportsbook` field fails', () => {
      const result = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ sportsbook: 'draftkings' }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.find((i) => i.path === '$.sportsbook')?.code,
        ).toBe('UNKNOWN_FIELD');
      }
    });

    it('30. other prohibited operational concepts rejected at top level', () => {
      for (const key of [
        'result', 'outcome', 'correct', 'correctness', 'grading',
        'performance', 'predictedWinner', 'homeWinProbability', 'payloadHash',
        'decisionPolicy',
      ]) {
        const result = validateMLBShadowExecutionJobV2(
          buildValidV2Job({ [key]: 'x' }),
        );
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(
            result.issues.some(
              (i) => i.path === `$.${key}` && i.code === 'UNKNOWN_FIELD',
            ),
          ).toBe(true);
        }
      }
    });
  });

  describe('J. Nested odds do not bypass the firewall', () => {
    it('31. odds key inside authorizedModelArtifact is rejected', () => {
      const tampered = cloneArtifact();
      tampered.odds = 1.9;
      const result = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ authorizedModelArtifact: tampered }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.some((i) => i.path === '$.authorizedModelArtifact'),
        ).toBe(true);
      }
    });

    it('32. odds key inside featureManifest is rejected by downstream firewall', () => {
      const contaminated: Record<string, unknown> = {
        ...buildValidManifest(),
        odds: 1.9,
      };
      const result = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ featureManifest: contaminated }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.some((i) => i.code === 'ODDS_CONTAMINATION'),
        ).toBe(true);
      }
    });

    it('33. odds key inside snapshot is rejected by downstream firewall', () => {
      const contaminated: Record<string, unknown> = {
        ...buildValidSnapshot(),
        odds: 1.9,
      };
      const result = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ snapshot: contaminated }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.some((i) => i.code === 'ODDS_CONTAMINATION'),
        ).toBe(true);
      }
    });
  });

  describe('K. Immutability and no generation', () => {
    it('34. validator does not mutate input', () => {
      const input = buildValidV2Job();
      const before = JSON.stringify(input);
      validateMLBShadowExecutionJobV2(input);
      const after = JSON.stringify(input);
      expect(before).toBe(after);
    });

    it('35. returned validated value contains only authorized V2 job keys', () => {
      const result = validateMLBShadowExecutionJobV2(buildValidV2Job());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Object.keys(result.value).sort()).toEqual(
          [...V2_AUTHORIZED_JOB_KEYS].sort(),
        );
      }
    });

    it('36. no runtime-generated value is introduced', () => {
      const result = validateMLBShadowExecutionJobV2(buildValidV2Job());
      expect(result.ok).toBe(true);
      if (result.ok) {
        // predictionGeneratedAt is the exact supplied frozen value, not a
        // generated current timestamp.
        expect(result.value.predictionGeneratedAt).toBe(
          FROZEN_PREDICTION_GENERATED_AT,
        );
        const nowMs = Date.now();
        const suppliedMs = Date.parse(result.value.predictionGeneratedAt);
        expect(Math.abs(nowMs - suppliedMs)).toBeGreaterThan(86_400_000);
      }
    });

    it('37. supplied predictionGeneratedAt is preserved exactly', () => {
      const ts = '2026-08-01T07:05:03Z';
      const result = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ predictionGeneratedAt: ts }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.predictionGeneratedAt).toBe(ts);
      }
    });

    it('38. supplied scheduledStartAt is preserved exactly', () => {
      const ts = '2026-08-01T14:00:00Z';
      const result = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ scheduledStartAt: ts }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.scheduledStartAt).toBe(ts);
      }
    });

    it('39. supplied latencyMs is preserved exactly', () => {
      const result = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ latencyMs: 5678 }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.latencyMs).toBe(5678);
      }
    });

    it('40. supplied shadowRecordId is preserved exactly', () => {
      const id = 'shadow-retry-42';
      const result = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ shadowRecordId: id }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.shadowRecordId).toBe(id);
      }
    });

    it('41. omitted optional fields remain null (canonical semantics)', () => {
      const result = validateMLBShadowExecutionJobV2(buildValidV2Job());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.officialDate).toBeNull();
        expect(result.value.scheduledStartAt).toBeNull();
        expect(result.value.latencyMs).toBeNull();
        expect(result.value.featureManifestId).toBeNull();
        expect(result.value.featureManifestFingerprint).toBeNull();
        expect(result.value.timingReferenceContractVersion).toBeNull();
        expect(result.value.timingReferenceCutoffAt).toBeNull();
      }
    });

    it('42. job object is frozen (Object.isFrozen)', () => {
      const result = validateMLBShadowExecutionJobV2(buildValidV2Job());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Object.isFrozen(result.value)).toBe(true);
        // Mutation attempt must not alter the frozen job.
        const originalRepoRoot = result.value.repoRoot;
        try {
          (result.value as { repoRoot: string }).repoRoot = 'mutated';
        } catch {
          // Strict mode throws — expected for frozen objects.
        }
        expect(result.value.repoRoot).toBe(originalRepoRoot);
      }
    });

    it('43. fixed issue objects contain no sensitive values', () => {
      const tampered = cloneArtifact();
      tampered.odds = 1.9;
      const result = validateMLBShadowExecutionJobV2(
        buildValidV2Job({
          authorizedModelArtifact: tampered,
          featureManifest: buildValidManifest(),
        }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        for (const issue of result.issues) {
          expect(Object.keys(issue).sort()).toEqual([
            'code',
            'message',
            'path',
          ]);
          const blob = JSON.stringify(issue);
          for (const forbidden of [
            'homeWinProbability',
            'awayWinProbability',
            'predictedWinner',
            'predictedSide',
            'coefficients',
            'valueCoefficient',
            'missingIndicatorCoefficient',
            'probability',
            'brierScore',
          ]) {
            expect(blob).not.toContain(forbidden);
          }
        }
      }
    });
  });

  describe('L. Retry stability (contract preserves differences; no normalization)', () => {
    it('44. same valid job validated twice yields identical content', () => {
      const a = validateMLBShadowExecutionJobV2(buildValidV2Job());
      const b = validateMLBShadowExecutionJobV2(buildValidV2Job());
      expect(a.ok && b.ok).toBe(true);
      if (a.ok && b.ok) {
        expect(a.value).toEqual(b.value);
      }
    });

    it('45. varying repoRoot yields a distinct job (distinct execution attempt)', () => {
      const a = validateMLBShadowExecutionJobV2(buildValidV2Job());
      const b = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ repoRoot: '/other/repo/root' }),
      );
      expect(a.ok && b.ok).toBe(true);
      if (a.ok && b.ok) {
        expect(a.value.repoRoot).not.toBe(b.value.repoRoot);
        expect(a.value).not.toEqual(b.value);
      }
    });

    it('46. varying shadowRecordId yields a distinct job (distinct execution attempt)', () => {
      const a = validateMLBShadowExecutionJobV2(buildValidV2Job());
      const b = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ shadowRecordId: 'shadow-retry-99' }),
      );
      expect(a.ok && b.ok).toBe(true);
      if (a.ok && b.ok) {
        expect(a.value.shadowRecordId).not.toBe(b.value.shadowRecordId);
        expect(a.value).not.toEqual(b.value);
      }
    });

    it('47. varying predictionGeneratedAt yields a distinct job (distinct record)', () => {
      const a = validateMLBShadowExecutionJobV2(buildValidV2Job());
      const b = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ predictionGeneratedAt: '2026-08-01T00:00:00Z' }),
      );
      expect(a.ok && b.ok).toBe(true);
      if (a.ok && b.ok) {
        expect(a.value.predictionGeneratedAt).not.toBe(
          b.value.predictionGeneratedAt,
        );
        expect(a.value).not.toEqual(b.value);
      }
    });

    it('48. varying latencyMs yields a distinct job (distinct metric state)', () => {
      const a = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ latencyMs: 100 }),
      );
      const b = validateMLBShadowExecutionJobV2(
        buildValidV2Job({ latencyMs: 200 }),
      );
      expect(a.ok && b.ok).toBe(true);
      if (a.ok && b.ok) {
        expect(a.value.latencyMs).not.toBe(b.value.latencyMs);
        expect(a.value).not.toEqual(b.value);
      }
    });
  });

  describe('M. Contract version + result shape', () => {
    it('49. V2 version constant is the exact frozen string', () => {
      expect(MLB_SHADOW_EXECUTION_JOB_V2_CONTRACT_VERSION).toBe(
        'mlb-shadow-execution-job-v2',
      );
    });

    it('50. result is a discriminated union on ok', () => {
      const ok = validateMLBShadowExecutionJobV2(buildValidV2Job());
      expect(ok.ok).toBe(true);
      if (ok.ok) {
        const job: MLBShadowExecutionJobV2 = ok.value;
        void job;
        const _result: MLBShadowExecutionJobV2ValidationResult = ok;
        void _result;
      }
    });
  });

  describe('N. V1 compatibility (V1 remains unchanged by this phase)', () => {
    it('51. V1 version constant unchanged', () => {
      expect(MLB_SHADOW_EXECUTION_JOB_CONTRACT_VERSION).toBe(
        'mlb-shadow-execution-job-v1',
      );
    });

    it('52. V1 job type still carries the historical release-result field (compile-time)', () => {
      // Compile-time proof that V1 still has its original field set.
      type V1Keys = keyof MLBShadowExecutionJobV1;
      const _hasReleaseResult: Extract<V1Keys, 'releasedModelResult'> =
        'releasedModelResult';
      void _hasReleaseResult;
    });

    it('53. V1 and V2 are distinct versions (no aliasing)', () => {
      expect(MLB_SHADOW_EXECUTION_JOB_V2_CONTRACT_VERSION).not.toBe(
        MLB_SHADOW_EXECUTION_JOB_CONTRACT_VERSION,
      );
      expect(MLB_SHADOW_EXECUTION_JOB_V2_CONTRACT_VERSION).toBe(
        'mlb-shadow-execution-job-v2',
      );
      expect(MLB_SHADOW_EXECUTION_JOB_CONTRACT_VERSION).toBe(
        'mlb-shadow-execution-job-v1',
      );
    });
  });
});
