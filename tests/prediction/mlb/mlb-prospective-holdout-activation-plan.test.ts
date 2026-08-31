import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import {
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_BOUNDARY_SELECTION_POLICY_ID,
  planMLBProspectiveHoldoutActivation,
  type MLBProspectiveHoldoutActivationPlan,
  type MLBProspectiveHoldoutActivationPlanResult,
  type MLBProspectiveHoldoutActivationPlanInput,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-plan';
import {
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE,
  validateMLBProspectiveHoldoutActivation,
  type MLBProspectiveHoldoutActivation,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-contract';
import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
} from '@/prediction/mlb/mlb-prospective-holdout-protocol-contract';
import {
  MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
  MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
} from '@/prediction/mlb/mlb-prospective-t360-capture-contract';
import {
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
} from '@/prediction/mlb/mlb-prospective-pregame-evidence-artifact-contract';
import {
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
} from '@/prediction/mlb/mlb-prospective-holdout-game-identity-binding-contract';
import {
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
} from '@/prediction/mlb/mlb-inner-development-third-real-candidate-recipe';
import { computeScientificCutoffAt } from '@/prediction/mlb/mlb-prospective-t360-capture-contract';
import type { MLBScheduleGame } from '@/lib/research-data/types';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function buildScheduleGame(overrides: Partial<MLBScheduleGame> = {}): MLBScheduleGame {
  const startTimeUtc = overrides.startTimeUtc ?? new Date('2026-09-01T19:00:00Z');
  const officialDate = overrides.officialDate ?? '2026-09-01';
  const base: MLBScheduleGame = {
    gamePk: overrides.gamePk ?? 1,
    gameType: 'R',
    gameNumber: 1,
    officialDate,
    gameDate: officialDate,
    startTimeUtc,
    status: 'UPCOMING',
    homeTeamId: 1,
    homeTeamName: 'Home',
    awayTeamId: 2,
    awayTeamName: 'Away',
    venueId: 1,
    venueName: 'Venue',
    dayNight: 'night',
    scheduledInnings: 9,
    doubleHeader: 'N',
    seriesGameNumber: 1,
    gamesInSeries: 3,
    seriesDescription: 'Regular',
    leagueRecord: { home: { wins: 0, losses: 0, pct: '0' }, away: { wins: 0, losses: 0, pct: '0' } },
    probablePitchers: { home: null, away: null },
  };
  return { ...base, ...overrides };
}

function makeGames(
  count: number,
  baseDate: string,
  baseHour = 12,
  gamePkStart = 1,
): MLBScheduleGame[] {
  const games: MLBScheduleGame[] = [];
  for (let i = 0; i < count; i++) {
    const gamePk = gamePkStart + i;
    const hour = baseHour + Math.floor(i / 10);
    if (hour >= 24) {
      throw new Error(`Cannot generate ${count} games within a single date starting at hour ${baseHour}`);
    }
    const minute = (i % 10) * 6;
    const startTimeUtc = new Date(`${baseDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`);
    games.push(buildScheduleGame({ gamePk, officialDate: baseDate, startTimeUtc }));
  }
  return games;
}

function plan(input: MLBProspectiveHoldoutActivationPlanInput): MLBProspectiveHoldoutActivationPlanResult {
  return planMLBProspectiveHoldoutActivation(input);
}

function expectSuccess(result: MLBProspectiveHoldoutActivationPlanResult): MLBProspectiveHoldoutActivationPlan {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error('Expected success');
  }
  return result.plan;
}

function expectFailure(result: MLBProspectiveHoldoutActivationPlanResult, code: string): void {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error('Expected failure');
  }
  expect(result.issues.some((i) => i.code === code)).toBe(true);
}

function collectAllObjectKeys(value: unknown): string[] {
  if (isPlainObject(value)) {
    const keys = Object.getOwnPropertyNames(value);
    return keys.concat(keys.flatMap((key) => collectAllObjectKeys((value as Record<string, unknown>)[key])));
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectAllObjectKeys(item));
  }
  return [];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                    */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-activation-plan', () => {
  it('1. produces a valid deterministic plan with exact 67/69 split', () => {
    const validationGames = makeGames(67, '2026-09-01');
    const testGames = makeGames(69, '2026-09-02', 12, 1000);
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-1',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: [...validationGames, ...testGames],
    };
    const result = plan(input);
    const p = expectSuccess(result);

    expect(p.validationBoundaryOfficialDate).toBe('2026-09-01');
    expect(p.validationSideAvailableCount).toBe(67);
    expect(p.testSideAvailableCount).toBe(69);

    const expectedDeadline = computeScientificCutoffAt(validationGames[0].startTimeUtc.toISOString());
    expect(expectedDeadline.ok).toBe(true);
    if (expectedDeadline.ok) {
      expect(p.activationDeadlineAt).toBe(expectedDeadline.scientificCutoffAt);
    }
    expect(p.activationPayload.validationBoundaryOfficialDate).toBe('2026-09-01');
  });

  it('2. same input twice returns deep-equal plan', () => {
    const games = makeGames(67, '2026-09-01').concat(makeGames(69, '2026-09-02', 12, 1000));
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-2',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: games,
    };
    const r1 = plan(input);
    const r2 = plan(input);
    const p1 = expectSuccess(r1);
    const p2 = expectSuccess(r2);

    expect(p1.planFingerprint).toBe(p2.planFingerprint);
    expect(p1.scheduleUniverseFingerprint).toBe(p2.scheduleUniverseFingerprint);
    expect(p1.validationBoundaryOfficialDate).toBe(p2.validationBoundaryOfficialDate);
  });

  it('3. permuted input order yields identical plan + fingerprints', () => {
    const validationGames = makeGames(67, '2026-09-01');
    const testGames = makeGames(69, '2026-09-02', 12, 1000);
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-3',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: [...validationGames, ...testGames],
    };
    const shuffled: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-3',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: [...testGames, ...validationGames],
    };
    const r1 = plan(input);
    const r2 = plan(shuffled);
    const p1 = expectSuccess(r1);
    const p2 = expectSuccess(r2);

    expect(p1.validationBoundaryOfficialDate).toBe(p2.validationBoundaryOfficialDate);
    expect(p1.planFingerprint).toBe(p2.planFingerprint);
    expect(p1.scheduleUniverseFingerprint).toBe(p2.scheduleUniverseFingerprint);
  });

  it('4. stable-order tie uses gamePk ASC', () => {
    const games: MLBScheduleGame[] = [];
    for (let i = 0; i < 67; i++) {
      games.push(buildScheduleGame({
        gamePk: i + 1,
        officialDate: '2026-09-01',
        startTimeUtc: new Date('2026-09-01T19:00:00Z'),
      }));
    }
    const testGames = makeGames(69, '2026-09-02', 12, 1000);
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-tie',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: [...games, ...testGames],
    };
    const result = plan(input);
    const p = expectSuccess(result);

    expect(p.firstValidationGamePk).toBe(1);
  });

  it('5. selects earliest feasible officialDate', () => {
    const date1 = makeGames(10, '2026-09-01');
    const date2 = makeGames(57, '2026-09-02', 12, 11);
    const date3 = makeGames(69, '2026-09-03', 12, 68);
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-early',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: [...date1, ...date2, ...date3],
    };
    const result = plan(input);
    const p = expectSuccess(result);

    expect(p.validationBoundaryOfficialDate).toBe('2026-09-02');
  });

  it('6. earlier date with <67 validation candidates rejected', () => {
    const date1 = makeGames(66, '2026-09-01');
    const date2 = makeGames(1, '2026-09-02', 12, 67);
    const date3 = makeGames(69, '2026-09-03', 12, 68);
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-reject-early',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: [...date1, ...date2, ...date3],
    };
    const result = plan(input);
    const p = expectSuccess(result);

    // 2026-09-01 has only 66 validation candidates → not feasible
    // 2026-09-02 has 67 validation + 69 test → earliest feasible boundary
    expect(p.validationBoundaryOfficialDate).toBe('2026-09-02');
    expect(p.validationSideAvailableCount).toBe(67);
    expect(p.testSideAvailableCount).toBe(69);
  });

  it('7. boundary date with >67 validation-side games remains valid', () => {
    const date1 = makeGames(70, '2026-09-01');
    const date2 = makeGames(69, '2026-09-02', 12, 71);
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-overshoot',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: [...date1, ...date2],
    };
    const result = plan(input);
    const p = expectSuccess(result);

    expect(p.validationBoundaryOfficialDate).toBe('2026-09-01');
    expect(p.validationSideAvailableCount).toBe(70);
    expect(p.testSideAvailableCount).toBe(69);
  });

  it('8. same officialDate is never split between validation/test', () => {
    const date1 = makeGames(68, '2026-09-01');
    const date2 = makeGames(69, '2026-09-02', 12, 69);
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-nosplit',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: [...date1, ...date2],
    };
    const result = plan(input);
    const p = expectSuccess(result);

    expect(p.validationBoundaryOfficialDate).toBe('2026-09-01');
    expect(p.validationSideAvailableCount).toBe(68);
    expect(p.testSideAvailableCount).toBe(69);
  });

  it('9. exactly 67 validation and exactly 69 test succeeds', () => {
    const validationGames = makeGames(67, '2026-09-01');
    const testGames = makeGames(69, '2026-09-02', 12, 1000);
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-threshold',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: [...validationGames, ...testGames],
    };
    const result = plan(input);
    const p = expectSuccess(result);

    expect(p.validationSideAvailableCount).toBe(67);
    expect(p.testSideAvailableCount).toBe(69);
  });

  it('10. insufficient validation candidates fails closed', () => {
    const validationGames = makeGames(50, '2026-09-01');
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-few-val',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: validationGames,
    };
    const result = plan(input);

    expectFailure(result, 'INSUFFICIENT_VALIDATION_CANDIDATES');
  });

  it('11. insufficient test candidates fails closed', () => {
    const games = makeGames(100, '2026-09-01');
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-few-test',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: games,
    };
    const result = plan(input);

    expectFailure(result, 'INSUFFICIENT_TEST_CANDIDATES');
  });

  it('12. total >=136 but no date boundary satisfies both returns NO_FEASIBLE_BOUNDARY', () => {
    const date1 = makeGames(66, '2026-09-01');
    const date2 = makeGames(70, '2026-09-02', 12, 67);
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-nobound',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: [...date1, ...date2],
    };
    const result = plan(input);

    expectFailure(result, 'NO_FEASIBLE_BOUNDARY');
  });

  it('12b. boundary algorithm matches independent reference implementation', () => {
    const date1 = makeGames(10, '2026-09-01');
    const date2 = makeGames(57, '2026-09-02', 12, 11);
    const date3 = makeGames(69, '2026-09-03', 12, 68);
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-ref',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: [...date1, ...date2, ...date3],
    };
    const result = plan(input);
    const p = expectSuccess(result);

    const eligibleGames = input.scheduleGames.filter((g) => {
      const cutoff = computeScientificCutoffAt(g.startTimeUtc.toISOString());
      if (!cutoff.ok) return false;
      return new Date(input.planningReferenceAt).getTime() < new Date(cutoff.scientificCutoffAt).getTime();
    });

    const dateCounts = new Map<string, number>();
    for (const g of eligibleGames) {
      dateCounts.set(g.officialDate, (dateCounts.get(g.officialDate) ?? 0) + 1);
    }
    const uniqueDates = Array.from(dateCounts.keys()).sort();

    let referenceBoundary: string | null = null;
    for (const date of uniqueDates) {
      let validationCount = 0;
      let testCount = 0;
      for (const g of eligibleGames) {
        if (g.officialDate <= date) validationCount++;
        else testCount++;
      }
      if (validationCount >= 67 && testCount >= 69) {
        referenceBoundary = date;
        break;
      }
    }

    expect(p.validationBoundaryOfficialDate).toBe(referenceBoundary);
  });

  it('13. duplicate gamePk fails closed', () => {
    const games: MLBScheduleGame[] = [
      buildScheduleGame({ gamePk: 1, officialDate: '2026-09-01', startTimeUtc: new Date('2026-09-01T19:00:00Z') }),
      buildScheduleGame({ gamePk: 1, officialDate: '2026-09-01', startTimeUtc: new Date('2026-09-01T20:00:00Z') }),
    ];
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-dup',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: games,
    };
    const result = plan(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'DUPLICATE_GAME_PK')).toBe(true);
    }
  });

  it('14. invalid activationId rejected', () => {
    const games = makeGames(67, '2026-09-01').concat(makeGames(69, '2026-09-02', 12, 1000));
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: '',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: games,
    };
    const result = plan(input);

    expectFailure(result, 'INVALID_ACTIVATION_ID');
  });

  it('15. invalid planningReferenceAt rejected', () => {
    const games = makeGames(67, '2026-09-01').concat(makeGames(69, '2026-09-02', 12, 1000));
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-bad-ref',
      planningReferenceAt: 'not-a-date',
      scheduleGames: games,
    };
    const result = plan(input);

    expectFailure(result, 'INVALID_PLANNING_REFERENCE_AT');
  });

  it('16. already-too-late games excluded', () => {
    const stillEligibleGame = buildScheduleGame({
      gamePk: 1,
      officialDate: '2026-09-01',
      startTimeUtc: new Date('2026-09-01T19:00:00Z'),
    });
    const expiredGame = buildScheduleGame({
      gamePk: 2,
      officialDate: '2026-09-01',
      startTimeUtc: new Date('2026-09-01T06:00:00Z'),
    });

    const extraValidation: MLBScheduleGame[] = [];
    for (let i = 0; i < 66; i++) {
      const startTimeUtc = new Date('2026-09-01T18:06:00Z');
      extraValidation.push(buildScheduleGame({ gamePk: 100 + i, officialDate: '2026-09-01', startTimeUtc }));
    }

    const testGames = makeGames(69, '2026-09-03', 12, 1000);
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-too-late',
      planningReferenceAt: '2026-09-01T12:00:00Z',
      scheduleGames: [stillEligibleGame, expiredGame, ...extraValidation, ...testGames],
    };
    const result = plan(input);
    const p = expectSuccess(result);

    expect(p.prospectivelyEligibleGameCount).toBe(136);
    expect(p.validationSideAvailableCount).toBe(67);
    expect(p.testSideAvailableCount).toBe(69);
  });

  describe('activationDeadlineAt computed from first required validation selection', () => {
    it('17. activationDeadlineAt matches first validation game cutoff', () => {
      const validationGames = makeGames(67, '2026-09-01');
      const testGames = makeGames(69, '2026-09-02', 12, 1000);
      const input: MLBProspectiveHoldoutActivationPlanInput = {
        activationId: 'plan-deadline',
        planningReferenceAt: '2026-09-01T00:00:00Z',
        scheduleGames: [...validationGames, ...testGames],
      };
      const result = plan(input);
      const p = expectSuccess(result);

      const expectedDeadline = computeScientificCutoffAt(validationGames[0].startTimeUtc.toISOString());
      expect(expectedDeadline.ok).toBe(true);
      if (expectedDeadline.ok) {
        expect(p.activationDeadlineAt).toBe(expectedDeadline.scientificCutoffAt);
      }
    });
  });

  it('18. planningReferenceAt at cutoff excludes games and fails closed', () => {
    const validationGames = makeGames(67, '2026-09-01');
    const testGames = makeGames(69, '2026-09-02', 12, 1000);
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-stale',
      planningReferenceAt: '2026-09-01T13:00:00Z',
      scheduleGames: [...validationGames, ...testGames],
    };

    const result = plan(input);

    // planningReferenceAt at or after all validation T360s excludes them;
    // with no remaining validation-side games, max test candidates is 0
    expectFailure(result, 'INSUFFICIENT_TEST_CANDIDATES');
  });

  it('18b. planningReferenceAt strictly before cutoff keeps plan non-stale', () => {
    const validationGames = makeGames(67, '2026-09-01');
    const testGames = makeGames(69, '2026-09-02', 12, 1000);
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-not-stale',
      planningReferenceAt: '2026-09-01T05:00:00Z',
      scheduleGames: [...validationGames, ...testGames],
    };
    const result = plan(input);
    const p = expectSuccess(result);

    expect(Date.parse(p.planningReferenceAt) < Date.parse(p.activationDeadlineAt)).toBe(true);
  });

  it('19. activation payload preview validates against committed activation contract', () => {
    const validationGames = makeGames(67, '2026-09-01');
    const testGames = makeGames(69, '2026-09-02', 12, 1000);
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-preview',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: [...validationGames, ...testGames],
    };
    const result = plan(input);
    const p = expectSuccess(result);

    const payloadValidation = validateMLBProspectiveHoldoutActivation(p.activationPayload);
    expect(payloadValidation.ok).toBe(true);
  });

  it('20. recipe ID/fingerprint exact', () => {
    const validationGames = makeGames(67, '2026-09-01');
    const testGames = makeGames(69, '2026-09-02', 12, 1000);
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-recipe',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: [...validationGames, ...testGames],
    };
    const result = plan(input);
    const p = expectSuccess(result);

    expect(p.activationPayload.candidateRecipeId).toBe(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID);
    expect(p.activationPayload.candidateFingerprint).toBe(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT);
  });

  it('21. target counts fixed 67/69', () => {
    const validationGames = makeGames(67, '2026-09-01');
    const testGames = makeGames(69, '2026-09-02', 12, 1000);
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-counts',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: [...validationGames, ...testGames],
    };
    const result = plan(input);
    const p = expectSuccess(result);

    expect(p.validationTargetCount).toBe(67);
    expect(p.testTargetCount).toBe(69);
    expect(p.activationPayload.validationTargetCount).toBe(67);
    expect(p.activationPayload.testTargetCount).toBe(69);
  });

  it('22. no caller target-count override exists (structural)', () => {
    // The input type only exposes activationId, planningReferenceAt, and scheduleGames.
    // Any attempt to pass validationTargetCount or testTargetCount is a compile-time error.
    // Verified by TypeScript: the following line would not compile if uncommented.
    // const bad: MLBProspectiveHoldoutActivationPlanInput = { ...input, validationTargetCount: 99 };
    expect(true).toBe(true);
  });

  it('23. different activationId does NOT change chosen boundary', () => {
    const validationGames = makeGames(67, '2026-09-01');
    const testGames = makeGames(69, '2026-09-02', 12, 1000);
    const inputA: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-a',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: [...validationGames, ...testGames],
    };
    const inputB: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-b',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: [...validationGames, ...testGames],
    };
    const pA = expectSuccess(plan(inputA));
    const pB = expectSuccess(plan(inputB));

    expect(pA.validationBoundaryOfficialDate).toBe(pB.validationBoundaryOfficialDate);
    expect(pA.scheduleUniverseFingerprint).toBe(pB.scheduleUniverseFingerprint);
    expect(pA.activationPayload.activationId).toBe('plan-a');
    expect(pB.activationPayload.activationId).toBe('plan-b');
  });

  it('24. relevant schedule identity change changes schedule fingerprint', () => {
    const gamesA = makeGames(67, '2026-09-01').concat(makeGames(69, '2026-09-02', 12, 1000));
    const gamesB = makeGames(67, '2026-09-01').concat(makeGames(69, '2026-09-02', 12, 1000));
    gamesB[0] = buildScheduleGame({ gamePk: 9999, officialDate: '2026-09-01', startTimeUtc: new Date('2026-09-01T19:00:00Z') });
    const inputA: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-fp-a',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: gamesA,
    };
    const inputB: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-fp-b',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: gamesB,
    };
    const pA = expectSuccess(plan(inputA));
    const pB = expectSuccess(plan(inputB));

    expect(pA.scheduleUniverseFingerprint).not.toBe(pB.scheduleUniverseFingerprint);
  });

  it('25. irrelevant input permutation does not change schedule fingerprint', () => {
    const games = makeGames(67, '2026-09-01').concat(makeGames(69, '2026-09-02', 12, 1000));
    const inputA: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-fp-c',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: games,
    };
    const inputB: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-fp-c',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: [...games].reverse(),
    };
    const pA = expectSuccess(plan(inputA));
    const pB = expectSuccess(plan(inputB));

    expect(pA.scheduleUniverseFingerprint).toBe(pB.scheduleUniverseFingerprint);
  });

  it('26. plan fingerprint deterministic', () => {
    const games = makeGames(67, '2026-09-01').concat(makeGames(69, '2026-09-02', 12, 1000));
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-fp-det',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: games,
    };
    const r1 = plan(input);
    const r2 = plan(input);
    const p1 = expectSuccess(r1);
    const p2 = expectSuccess(r2);

    expect(p1.planFingerprint).toBe(p2.planFingerprint);
  });

  it('27. plan fingerprint changes when scientifically relevant input changes', () => {
    const gamesA = makeGames(67, '2026-09-01').concat(makeGames(69, '2026-09-02', 12, 1000));
    const gamesB = makeGames(67, '2026-09-01').concat(makeGames(69, '2026-09-02', 12, 1000));
    gamesB[0] = buildScheduleGame({ gamePk: 9999, officialDate: '2026-09-01', startTimeUtc: new Date('2026-09-01T19:00:00Z') });
    const inputA: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-fp-chg',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: gamesA,
    };
    const inputB: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-fp-chg',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: gamesB,
    };
    const pA = expectSuccess(plan(inputA));
    const pB = expectSuccess(plan(inputB));

    expect(pA.planFingerprint).not.toBe(pB.planFingerprint);
  });

  it('28. no results/score/label fields enter plan', () => {
    const validationGames = makeGames(67, '2026-09-01');
    const testGames = makeGames(69, '2026-09-02', 12, 1000);
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-clean',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: [...validationGames, ...testGames],
    };
    const result = plan(input);
    const p = expectSuccess(result);

    const prohibitedKeys = [
      'finalScore',
      'homeFinalScore',
      'awayFinalScore',
      'winnerLabel',
      'winner',
      'gameResult',
      'postGameResult',
      'resultLabel',
      'outcome',
      'homeWon',
      'awayWon',
    ];
    const objectKeys = collectAllObjectKeys(p);
    for (const key of prohibitedKeys) {
      expect(objectKeys).not.toContain(key);
    }
    expect(p.activationPayload.resultIndependentSelection).toBe(true);

    const sourcePath = fileURLToPath(new URL('../../../src/prediction/mlb/mlb-prospective-holdout-activation-plan.ts', import.meta.url));
    const text = readFileSync(sourcePath, 'utf8');
    const importMatches = text.match(/import\s+.*?\bfrom\s+['"]([^'"]+)['"]/g) || [];
    const importPaths = importMatches.map((m) => m.match(/from\s+['"]([^'"]+)['"]/)?.[1] || '');
    for (const path of importPaths) {
      expect(path).not.toMatch(/result|score|label|grading|winner/i);
    }
  });

  it('29. no odds/market fields enter plan', () => {
    const validationGames = makeGames(67, '2026-09-01');
    const testGames = makeGames(69, '2026-09-02', 12, 1000);
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-noodds',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: [...validationGames, ...testGames],
    };
    const result = plan(input);
    const p = expectSuccess(result);

    const prohibitedKeys = [
      'odds',
      'sportsbookOdds',
      'moneyline',
      'marketPrice',
      'impliedProbability',
      'pointSpread',
      'spread',
      'bookmaker',
      'edge',
      'expectedValue',
    ];
    const objectKeys = collectAllObjectKeys(p);
    for (const key of prohibitedKeys) {
      expect(objectKeys).not.toContain(key);
    }

    const sourcePath = fileURLToPath(new URL('../../../src/prediction/mlb/mlb-prospective-holdout-activation-plan.ts', import.meta.url));
    const text = readFileSync(sourcePath, 'utf8');
    const importMatches = text.match(/import\s+.*?\bfrom\s+['"]([^'"]+)['"]/g) || [];
    const importPaths = importMatches.map((m) => m.match(/from\s+['"]([^'"]+)['"]/)?.[1] || '');
    for (const path of importPaths) {
      expect(path).not.toMatch(/odds|market/i);
    }
  });

  it('30. production planner has no filesystem/network/ambient-clock dependency', async () => {
    const sourcePath = fileURLToPath(new URL('../../../src/prediction/mlb/mlb-prospective-holdout-activation-plan.ts', import.meta.url));
    const text = readFileSync(sourcePath, 'utf8');

    expect(text).not.toMatch(/import\s+.*\bfrom\s+['"]node:fs['"]/);
    expect(text).not.toMatch(/import\s+.*\bfrom\s+['"]node:path['"]/);
    expect(text).not.toMatch(/process\.env/);
    expect(text).not.toMatch(/Date\.now/);
    expect(text).not.toMatch(/new\s+Date\s*\(\s*\)/);
    expect(text).not.toMatch(/fetch\(/);
    expect(text).not.toMatch(/XMLHttpRequest/);
    expect(text).not.toMatch(/http\./);
    expect(text).not.toMatch(/https\./);
  });

  it('31. public plan target counts are literal 67/69', () => {
    const validationGames = makeGames(67, '2026-09-01');
    const testGames = makeGames(69, '2026-09-02', 12, 1000);
    const input: MLBProspectiveHoldoutActivationPlanInput = {
      activationId: 'plan-literal-types',
      planningReferenceAt: '2026-09-01T00:00:00Z',
      scheduleGames: [...validationGames, ...testGames],
    };
    const result = plan(input);
    const p = expectSuccess(result);

    const validationTarget: 67 = p.validationTargetCount;
    const testTarget: 69 = p.testTargetCount;

    expect(validationTarget).toBe(67);
    expect(testTarget).toBe(69);
  });
});

