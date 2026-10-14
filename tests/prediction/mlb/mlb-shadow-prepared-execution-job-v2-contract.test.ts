/* -------------------------------------------------------------------------- */
/*  Functional tests for the V2 prepared-execution-job contract (P5F-A1-R1)    */
/* -------------------------------------------------------------------------- */
import { describe, it, expect } from 'vitest';

import {
  validateMLBShadowPreparedExecutionJobV2,
  MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_CONTRACT_VERSION,
  MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_FIELD_ORDER,
  type MLBShadowPreparedExecutionJobV2,
} from '@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-contract';

import {
  validateMLBShadowExecutionJobV2,
} from '@/prediction/mlb/mlb-shadow-execution-job-v2-contract';

import {
  getMLBShadowCandidate003AuthorizedModelArtifact,
  MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL_ARTIFACT_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-shadow-candidate-003-authorized-model-artifact';
import {
  MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256,
} from '@/prediction/mlb/mlb-shadow-model-fingerprint';

import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';

import {
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';

/* -------------------------------------------------------------------------- */
/*  Frozen test timestamps                                                    */
/* -------------------------------------------------------------------------- */
const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';
const FROZEN_PREDICTION_GENERATED_AT = '2026-07-15T18:40:00Z';
const FROZEN_OFFICIAL_DATE = '2026-07-15';

const FROZEN_MANIFEST_FINGERPRINT =
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT;

/* Validation-only repoRoot sentinel (mirrors the private constant in the
 * production contract; used ONLY to assert it never leaks.) */
const VALIDATION_ONLY_REPOROOT_SENTINEL =
  '/__mre_shadow_prepared_job_validation_only__';

/* -------------------------------------------------------------------------- */
/*  Fixture builders                                                          */
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

/** Structurally valid canonical pregame snapshot. */
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
    },
    startingPitchers: {
      home: {
        state: 'PROBABLE',
        pitcherId: 'p-1',
        announcedAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
      },
      away: {
        state: 'PROBABLE',
        pitcherId: 'p-2',
        announcedAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-away'],
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
      },
    ],
    dataCompleteness: 'COMPLETE',
    warnings: [],
    ...overrides,
  } as Record<string, unknown>;
}

/** Fully valid V2 job (includes repoRoot for reference). */
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

/**
 * Fully valid prepared job (13 fields, repoRoot omitted).
 * Optional fields are present as null when not supplied so the prepared
 * top-level gate (which requires EXACTLY the 13 fields as own data properties)
 * is satisfied.
 */
function buildValidPreparedJob(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const fullJob = buildValidV2Job(overrides);
  const { repoRoot: _repoRoot, ...prepared } = fullJob;
  void _repoRoot;
  const base = {
    shadowRecordId: prepared.shadowRecordId,
    gamePk: prepared.gamePk,
    predictionGeneratedAt: prepared.predictionGeneratedAt,
    authorizedModelArtifact: prepared.authorizedModelArtifact,
    featureManifest: prepared.featureManifest,
    snapshot: prepared.snapshot,
    officialDate: prepared.officialDate ?? null,
    scheduledStartAt: prepared.scheduledStartAt ?? null,
    latencyMs: prepared.latencyMs ?? null,
    featureManifestId: prepared.featureManifestId ?? null,
    featureManifestFingerprint: prepared.featureManifestFingerprint ?? null,
    timingReferenceContractVersion:
      prepared.timingReferenceContractVersion ?? null,
    timingReferenceCutoffAt: prepared.timingReferenceCutoffAt ?? null,
  };
  return { ...base, ...overrides };
}

/** Deep-clone the frozen artifact so tests can tamper safely (test-only). */
function cloneArtifact(): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(getMLBShadowCandidate003AuthorizedModelArtifact()),
  );
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                      */
/* -------------------------------------------------------------------------- */
describe('mlb-shadow-prepared-execution-job-v2-contract', () => {
  it('1. exact valid 13-field prepared input succeeds', () => {
    const job = buildValidPreparedJob({
      officialDate: FROZEN_OFFICIAL_DATE,
      scheduledStartAt: FROZEN_SCHEDULED_START,
      latencyMs: 1234,
      featureManifestId:
        MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
      featureManifestFingerprint: FROZEN_MANIFEST_FINGERPRINT,
      timingReferenceContractVersion:
        'mlb-offline-pregame-inference-contract-v1',
      timingReferenceCutoffAt: FROZEN_DATA_CUTOFF,
    });
    const result = validateMLBShadowPreparedExecutionJobV2(job);
    expect(result.ok).toBe(true);
  });

  it('2. returned value has exactly 13 keys', () => {
    const result = validateMLBShadowPreparedExecutionJobV2(
      buildValidPreparedJob(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value).length).toBe(13);
    }
  });

  it('3. returned value contains no repoRoot', () => {
    const result = validateMLBShadowPreparedExecutionJobV2(
      buildValidPreparedJob(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value)).not.toContain('repoRoot');
      expect(result.value).not.toHaveProperty('repoRoot');
    }
  });

  it('4. returned key order matches MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_FIELD_ORDER', () => {
    const result = validateMLBShadowPreparedExecutionJobV2(
      buildValidPreparedJob(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value)).toEqual(
        MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_FIELD_ORDER,
      );
    }
  });

  it('5. full authorizedModelArtifact survives validation', () => {
    const frozen = getMLBShadowCandidate003AuthorizedModelArtifact();
    const result = validateMLBShadowPreparedExecutionJobV2(
      buildValidPreparedJob(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.authorizedModelArtifact).toEqual(frozen);
      expect(
        result.value.authorizedModelArtifact.attestation
          .modelCanonicalFingerprint,
      ).toBe(MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256);
      expect(
        result.value.authorizedModelArtifact.contractVersion,
      ).toBe(
        MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL_ARTIFACT_CONTRACT_VERSION,
      );
    }
  });

  it('6. featureManifest survives validation', () => {
    const result = validateMLBShadowPreparedExecutionJobV2(
      buildValidPreparedJob(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.featureManifest).toEqual(
        MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
      );
    }
  });

  it('7. snapshot survives validation', () => {
    const snap = buildValidSnapshot();
    const result = validateMLBShadowPreparedExecutionJobV2(
      buildValidPreparedJob(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.snapshot).toEqual(snap);
    }
  });

  it('8. all timing fields survive validation', () => {
    const result = validateMLBShadowPreparedExecutionJobV2(
      buildValidPreparedJob({
        officialDate: FROZEN_OFFICIAL_DATE,
        scheduledStartAt: FROZEN_SCHEDULED_START,
        latencyMs: 5678,
        featureManifestId:
          MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
        featureManifestFingerprint: FROZEN_MANIFEST_FINGERPRINT,
        timingReferenceContractVersion:
          'mlb-offline-pregame-inference-contract-v1',
        timingReferenceCutoffAt: FROZEN_DATA_CUTOFF,
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.officialDate).toBe(FROZEN_OFFICIAL_DATE);
      expect(result.value.scheduledStartAt).toBe(FROZEN_SCHEDULED_START);
      expect(result.value.latencyMs).toBe(5678);
      expect(result.value.featureManifestId).toBe(
        MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
      );
      expect(result.value.featureManifestFingerprint).toBe(
        FROZEN_MANIFEST_FINGERPRINT,
      );
      expect(result.value.timingReferenceContractVersion).toBe(
        'mlb-offline-pregame-inference-contract-v1',
      );
      expect(result.value.timingReferenceCutoffAt).toBe(FROZEN_DATA_CUTOFF);
    }
  });

  it('9. input is not mutated', () => {
    const input = buildValidPreparedJob();
    const before = JSON.stringify(input);
    validateMLBShadowPreparedExecutionJobV2(input);
    const after = JSON.stringify(input);
    expect(before).toBe(after);
  });

  it('10. top-level returned object is immutable / frozen', () => {
    const result = validateMLBShadowPreparedExecutionJobV2(
      buildValidPreparedJob(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.isFrozen(result.value)).toBe(true);
      const original = result.value.shadowRecordId;
      try {
        (
          result.value as { shadowRecordId: string }
        ).shadowRecordId = 'mutated';
      } catch {
        // strict-mode throw expected for frozen objects
      }
      expect(result.value.shadowRecordId).toBe(original);
    }
  });

  it('11. missing each required field fails', () => {
    for (const field of MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_FIELD_ORDER) {
      const job = buildValidPreparedJob();
      delete job[field];
      const result = validateMLBShadowPreparedExecutionJobV2(job);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.some(
            (i) =>
              i.path === `$.${field}` &&
              i.code === 'PREPARED_JOB_INVALID',
          ),
        ).toBe(true);
      }
    }
  });

  it('12. caller-supplied repoRoot fails', () => {
    const result = validateMLBShadowPreparedExecutionJobV2(
      buildValidPreparedJob({ repoRoot: '/evil/path' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.issues.some(
          (i) =>
            i.path === '$.repoRoot' &&
            i.code === 'PREPARED_JOB_INVALID',
        ),
      ).toBe(true);
    }
  });

  it('13. arbitrary unknown string key fails', () => {
    const result = validateMLBShadowPreparedExecutionJobV2(
      buildValidPreparedJob({ unknownField: 'bad' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.issues.some(
          (i) =>
            i.path === '$.unknownField' &&
            i.code === 'PREPARED_JOB_INVALID',
        ),
      ).toBe(true);
    }
  });

  it('14. symbol key fails', () => {
    const job = buildValidPreparedJob();
    const sym = Symbol('unknown');
    Object.defineProperty(job, sym, {
      value: 'symbol-value',
      enumerable: true,
      configurable: true,
      writable: true,
    });
    const result = validateMLBShadowPreparedExecutionJobV2(job);
    expect(result.ok).toBe(false);
  });

  it('15. accessor/getter property fails WITHOUT invoking the getter', () => {
    let getterInvoked = false;
    const job = buildValidPreparedJob();
    Object.defineProperty(job, 'shadowRecordId', {
      enumerable: true,
      configurable: true,
      get() {
        getterInvoked = true;
        return 'getter-value';
      },
    });
    const result = validateMLBShadowPreparedExecutionJobV2(job);
    expect(result.ok).toBe(false);
    expect(getterInvoked).toBe(false);
  });

  it('16. inherited-only required property fails', () => {
    const valid = buildValidPreparedJob();
    const { shadowRecordId: _srId, ...rest } = valid;
    void _srId;
    const proto = { shadowRecordId: 'inherited' };
    const job = Object.assign(Object.create(proto), rest);
    const result = validateMLBShadowPreparedExecutionJobV2(job);
    expect(result.ok).toBe(false);
  });

  it('17. primitive fails', () => {
    expect(validateMLBShadowPreparedExecutionJobV2('string').ok).toBe(
      false,
    );
    expect(validateMLBShadowPreparedExecutionJobV2(42).ok).toBe(false);
    expect(validateMLBShadowPreparedExecutionJobV2(true).ok).toBe(false);
    if (!validateMLBShadowPreparedExecutionJobV2('string').ok) {
      // verify the issue code
      const r = validateMLBShadowPreparedExecutionJobV2('string');
      if (!r.ok) {
        expect(r.issues[0].code).toBe('NOT_PREPARED_OBJECT');
      }
    }
  });

  it('18. null fails', () => {
    const result = validateMLBShadowPreparedExecutionJobV2(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].code).toBe('NOT_PREPARED_OBJECT');
    }
  });

  it('19. array fails', () => {
    const result = validateMLBShadowPreparedExecutionJobV2([1, 2, 3]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].code).toBe('NOT_PREPARED_OBJECT');
    }
  });

  it('20. wrong gamePk semantics fail through V2 validation', () => {
    const invalidGamePks: unknown[] = [
      'not-a-number',
      0,
      -1,
      1.5,
      NaN,
      Infinity,
    ];
    for (const gp of invalidGamePks) {
      const result = validateMLBShadowPreparedExecutionJobV2(
        buildValidPreparedJob({ gamePk: gp }),
      );
      expect(result.ok).toBe(false);
    }
  });

  it('21. malformed predictionGeneratedAt fails', () => {
    expect(
      validateMLBShadowPreparedExecutionJobV2(
        buildValidPreparedJob({ predictionGeneratedAt: 'not-a-timestamp' }),
      ).ok,
    ).toBe(false);
    expect(
      validateMLBShadowPreparedExecutionJobV2(
        buildValidPreparedJob({
          predictionGeneratedAt: '2026-13-40T99:99:99Z',
        }),
      ).ok,
    ).toBe(false);
    expect(
      validateMLBShadowPreparedExecutionJobV2(
        buildValidPreparedJob({ predictionGeneratedAt: 12345 }),
      ).ok,
    ).toBe(false);
  });

  it('22. malformed optional timing field fails', () => {
    expect(
      validateMLBShadowPreparedExecutionJobV2(
        buildValidPreparedJob({ timingReferenceCutoffAt: 'bad' }),
      ).ok,
    ).toBe(false);
    expect(
      validateMLBShadowPreparedExecutionJobV2(
        buildValidPreparedJob({
          timingReferenceCutoffAt: 12345,
        }),
      ).ok,
    ).toBe(false);
    expect(
      validateMLBShadowPreparedExecutionJobV2(
        buildValidPreparedJob({
          timingReferenceContractVersion: 7,
        }),
      ).ok,
    ).toBe(false);
  });

  it('23. tampered authorized Candidate-003 artifact fails', () => {
    const tampered = cloneArtifact();
    tampered.odds = 1.9;
    const result = validateMLBShadowPreparedExecutionJobV2(
      buildValidPreparedJob({ authorizedModelArtifact: tampered }),
    );
    expect(result.ok).toBe(false);
  });

  it('24. tampered manifest identity/fingerprint fails', () => {
    const result = validateMLBShadowPreparedExecutionJobV2(
      buildValidPreparedJob({ featureManifest: buildValidManifest() }),
    );
    expect(result.ok).toBe(false);
  });

  it('25. snapshot/manifest cross-field mismatch fails', () => {
    const result = validateMLBShadowPreparedExecutionJobV2(
      buildValidPreparedJob({ featureManifestId: 'wrong-manifest-id' }),
    );
    expect(result.ok).toBe(false);
  });

  it('26. validator failure result contains no sensitive values', () => {
    const tampered = cloneArtifact();
    tampered.odds = 1.9;
    const result = validateMLBShadowPreparedExecutionJobV2(
      buildValidPreparedJob({ authorizedModelArtifact: tampered }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const blob = JSON.stringify(result);
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
        'intercept',
      ]) {
        expect(blob).not.toContain(forbidden);
      }
      for (const issue of result.issues) {
        expect(Object.keys(issue).sort()).toEqual([
          'code',
          'message',
          'path',
        ]);
      }
    }
  });

  it('27. validation-only repoRoot sentinel never appears in returned value', () => {
    const result = validateMLBShadowPreparedExecutionJobV2(
      buildValidPreparedJob(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value)).not.toContain('repoRoot');
      expect(JSON.stringify(result.value)).not.toContain(
        VALIDATION_ONLY_REPOROOT_SENTINEL,
      );
    }
  });

  it('27. validation-only repoRoot sentinel never appears in failure result (gate path)', () => {
    const result = validateMLBShadowPreparedExecutionJobV2(
      buildValidPreparedJob({ unknownField: 'bad' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(JSON.stringify(result)).not.toContain(
        VALIDATION_ONLY_REPOROOT_SENTINEL,
      );
    }
  });

  it('27. validation-only repoRoot sentinel never appears in failure result (V2 path)', () => {
    const tampered = cloneArtifact();
    tampered.odds = 1.9;
    const result = validateMLBShadowPreparedExecutionJobV2(
      buildValidPreparedJob({ authorizedModelArtifact: tampered }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(JSON.stringify(result)).not.toContain(
        VALIDATION_ONLY_REPOROOT_SENTINEL,
      );
    }
  });

  it('28. no model fitting/reconstruction occurs', () => {
    const frozen = getMLBShadowCandidate003AuthorizedModelArtifact();
    const result = validateMLBShadowPreparedExecutionJobV2(
      buildValidPreparedJob(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.authorizedModelArtifact).toEqual(frozen);
      expect(
        result.value.authorizedModelArtifact.attestation
          .modelCanonicalFingerprint,
      ).toBe(MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256);
    }
  });
});
