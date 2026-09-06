import { describe, it, expect } from 'vitest';
import type { MLBProspectiveHoldoutSchedulerCoreInput, MLBProspectiveHoldoutSchedulerDecision } from '@/prediction/mlb/mlb-prospective-holdout-scheduler-core';
import type { MLBScheduleGame } from '@/lib/research-data/types';
import { planProspectiveHoldoutValidationDispatch } from '@/prediction/mlb/mlb-prospective-holdout-scheduler-core';

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                  */
/* -------------------------------------------------------------------------- */

const BASE_ACTIVATION = {
  validationBoundaryOfficialDate: '2026-09-07',
  validationTargetCount: 67,
} as const;

function buildScheduleGame(overrides: Partial<MLBScheduleGame> = {}): MLBScheduleGame {
  const base: MLBScheduleGame = {
    gamePk: 100,
    gameType: 'REGULAR_SEASON',
    gameNumber: 1,
    officialDate: '2026-09-07',
    gameDate: '2026-09-07T01:00:00.000Z',
    startTimeUtc: new Date('2026-09-07T01:00:00.000Z'),
    status: 'UPCOMING',
    homeTeamId: 100,
    homeTeamName: 'Home Team',
    awayTeamId: 200,
    awayTeamName: 'Away Team',
    venueId: 1,
    venueName: 'Stadium',
    dayNight: 'night',
    scheduledInnings: 9,
    doubleHeader: 'N',
    seriesGameNumber: 1,
    gamesInSeries: 3,
    seriesDescription: 'Regular',
    leagueRecord: {
      home: { wins: 50, losses: 50, pct: '0.500' },
      away: { wins: 50, losses: 50, pct: '0.500' },
    },
    probablePitchers: { home: null, away: null },
  };
  return { ...base, ...overrides };
}

function buildInput(overrides: Partial<MLBProspectiveHoldoutSchedulerCoreInput> = {}): MLBProspectiveHoldoutSchedulerCoreInput {
  return {
    activation: BASE_ACTIVATION,
    validationCapturedCount: 0,
    testCapturedCount: 0,
    completedGamePks: [],
    scheduleCandidates: [],
    trustedNow: new Date('2026-09-06T12:00:00.000Z'),
    ...overrides,
  };
}

const BASE_GAME = buildScheduleGame();

/* -------------------------------------------------------------------------- */
/*  Progress invariants                                                       */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-scheduler-core progress invariants', () => {
  it('1. accepts startup 0/67', () => {
    const decision = planProspectiveHoldoutValidationDispatch(buildInput());
    expect(decision.kind).toBe('VALIDATION_TARGET_UNREACHABLE');
  });

  it('2. accepts current startup 1/67', () => {
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({ validationCapturedCount: 1 }));
    expect(decision.kind).toBe('VALIDATION_TARGET_UNREACHABLE');
  });

  it('3. 67/67 -> VALIDATION_TARGET_COMPLETE', () => {
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({ validationCapturedCount: 67 }));
    expect(decision.kind).toBe('VALIDATION_TARGET_COMPLETE');
  });

  it('4. > 67 -> HUMAN_REVIEW_REQUIRED', () => {
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({ validationCapturedCount: 68 }));
    expect(decision.kind).toBe('HUMAN_REVIEW_REQUIRED');
    if (decision.kind === 'HUMAN_REVIEW_REQUIRED') {
      expect(decision.reason).toContain('exceeds 67');
    }
  });

  it('5. testCapturedCount > 0 -> HUMAN_REVIEW_REQUIRED', () => {
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({ testCapturedCount: 1 }));
    expect(decision.kind).toBe('HUMAN_REVIEW_REQUIRED');
    if (decision.kind === 'HUMAN_REVIEW_REQUIRED') {
      expect(decision.reason).toContain('testCapturedCount');
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Timing boundary tests                                                     */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-scheduler-core timing boundaries', () => {
  const game = buildScheduleGame({
    gamePk: 200,
    officialDate: '2026-09-07',
    startTimeUtc: new Date('2026-09-07T01:00:00.000Z'),
  });

  it('7. WAIT one millisecond before T-375', () => {
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      trustedNow: new Date('2026-09-06T18:44:59.999Z'),
      scheduleCandidates: [game],
    }));
    expect(decision.kind).toBe('WAIT_UNTIL_TARGET');
    if (decision.kind === 'WAIT_UNTIL_TARGET') {
      expect(decision.waitUntil).toBe('2026-09-06T18:45:00.000Z');
    }
  });

  it('8. DISPATCH exact T-375', () => {
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      trustedNow: new Date('2026-09-06T18:45:00.000Z'),
      scheduleCandidates: [game],
    }));
    expect(decision.kind).toBe('DISPATCH_NOW');
    if (decision.kind === 'DISPATCH_NOW') {
      expect(decision.game.gamePk).toBe(200);
    }
  });

  it('9. DISPATCH between T-375 and T-360', () => {
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      trustedNow: new Date('2026-09-06T18:50:00.000Z'),
      scheduleCandidates: [game],
    }));
    expect(decision.kind).toBe('DISPATCH_NOW');
    if (decision.kind === 'DISPATCH_NOW') {
      expect(decision.game.gamePk).toBe(200);
    }
  });

  it('10. DISPATCH one millisecond before T-360', () => {
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      trustedNow: new Date('2026-09-06T18:59:59.999Z'),
      scheduleCandidates: [game],
    }));
    expect(decision.kind).toBe('DISPATCH_NOW');
    if (decision.kind === 'DISPATCH_NOW') {
      expect(decision.game.gamePk).toBe(200);
    }
  });

  it('11. MISSED exact T-360', () => {
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      trustedNow: new Date('2026-09-06T19:00:00.000Z'),
      scheduleCandidates: [game],
    }));
    expect(decision.kind).toBe('VALIDATION_TARGET_UNREACHABLE');
  });

  it('12. MISSED after T-360', () => {
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      trustedNow: new Date('2026-09-06T19:00:01.000Z'),
      scheduleCandidates: [game],
    }));
    expect(decision.kind).toBe('VALIDATION_TARGET_UNREACHABLE');
  });
});

/* -------------------------------------------------------------------------- */
/*  Candidate filtering                                                       */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-scheduler-core candidate filtering', () => {
  it('13. test-side game blocked', () => {
    const testGame = buildScheduleGame({ officialDate: '2026-09-08' });
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      scheduleCandidates: [testGame],
    }));
    expect(decision.kind).toBe('VALIDATION_TARGET_UNREACHABLE');
  });

  it('14. regular-season requirement', () => {
    const playoffGame = buildScheduleGame({ gameType: 'POSTSEASON' });
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      scheduleCandidates: [playoffGame],
    }));
    expect(decision.kind).toBe('VALIDATION_TARGET_UNREACHABLE');
  });

  it('15. non-upcoming/prospectively-ineligible schedule state excluded', () => {
    const finalGame = buildScheduleGame({ status: 'FINAL' });
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      scheduleCandidates: [finalGame],
    }));
    expect(decision.kind).toBe('VALIDATION_TARGET_UNREACHABLE');
  });

  it('16. already-complete game skipped', () => {
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      completedGamePks: [100],
      scheduleCandidates: [BASE_GAME],
    }));
    expect(decision.kind).toBe('VALIDATION_TARGET_UNREACHABLE');
  });

  it('23. test-side games cannot satisfy validation target', () => {
    const validationGame = buildScheduleGame({
      gamePk: 300,
      officialDate: '2026-09-07',
      startTimeUtc: new Date('2026-09-07T03:00:00.000Z'),
    });
    const testGame = buildScheduleGame({
      gamePk: 301,
      officialDate: '2026-09-08',
      startTimeUtc: new Date('2026-09-08T01:00:00.000Z'),
    });
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      trustedNow: new Date('2026-09-06T20:45:00.000Z'),
      validationCapturedCount: 66,
      scheduleCandidates: [testGame, validationGame],
    }));
    expect(decision.kind).toBe('DISPATCH_NOW');
    if (decision.kind === 'DISPATCH_NOW') {
      expect(decision.game.gamePk).toBe(300);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Stable order and tie-breaking                                              */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-scheduler-core stable order', () => {
  it('17. stable order by scheduledStartAt', () => {
    const game1 = buildScheduleGame({ gamePk: 100, startTimeUtc: new Date('2026-09-07T01:00:00.000Z') });
    const game2 = buildScheduleGame({ gamePk: 200, startTimeUtc: new Date('2026-09-07T03:00:00.000Z') });
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      trustedNow: new Date('2026-09-06T12:00:00.000Z'),
      scheduleCandidates: [game2, game1],
    }));
    expect(decision.kind).toBe('WAIT_UNTIL_TARGET');
    if (decision.kind === 'WAIT_UNTIL_TARGET') {
      expect(decision.waitUntil).toBe('2026-09-06T18:45:00.000Z');
    }
  });

  it('18. numeric gamePk tie-break', () => {
    const game1 = buildScheduleGame({ gamePk: 100, startTimeUtc: new Date('2026-09-07T01:00:00.000Z') });
    const game2 = buildScheduleGame({ gamePk: 200, startTimeUtc: new Date('2026-09-07T01:00:00.000Z') });
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      trustedNow: new Date('2026-09-06T18:45:00.000Z'),
      scheduleCandidates: [game2, game1],
    }));
    expect(decision.kind).toBe('DISPATCH_NOW');
    if (decision.kind === 'DISPATCH_NOW') {
      expect(decision.game.gamePk).toBe(100);
    }
  });

  it('19. input permutation independence', () => {
    const games = [
      buildScheduleGame({ gamePk: 100, startTimeUtc: new Date('2026-09-07T02:00:00.000Z') }),
      buildScheduleGame({ gamePk: 200, startTimeUtc: new Date('2026-09-07T01:00:00.000Z') }),
      buildScheduleGame({ gamePk: 300, startTimeUtc: new Date('2026-09-07T03:00:00.000Z') }),
    ];
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      trustedNow: new Date('2026-09-06T18:45:00.000Z'),
      scheduleCandidates: games,
    }));
    expect(decision.kind).toBe('DISPATCH_NOW');
    if (decision.kind === 'DISPATCH_NOW') {
      expect(decision.game.gamePk).toBe(200);
    }

    const shuffled = [games[2], games[0], games[1]];
    const decision2 = planProspectiveHoldoutValidationDispatch(buildInput({
      trustedNow: new Date('2026-09-06T18:45:00.000Z'),
      scheduleCandidates: shuffled,
    }));
    expect(decision2.kind).toBe('DISPATCH_NOW');
    if (decision2.kind === 'DISPATCH_NOW') {
      expect(decision2.game.gamePk).toBe(200);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Replacement / reserve-pool behavior                                       */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-scheduler-core replacement policy', () => {
  it('20. missed earlier game -> later validation reserve selected', () => {
    const gameA = buildScheduleGame({
      gamePk: 400,
      officialDate: '2026-09-07',
      startTimeUtc: new Date('2026-09-07T01:00:00.000Z'),
    });
    const gameB = buildScheduleGame({
      gamePk: 401,
      officialDate: '2026-09-07',
      startTimeUtc: new Date('2026-09-07T03:00:00.000Z'),
    });
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      trustedNow: new Date('2026-09-06T18:59:59.999Z'),
      validationCapturedCount: 1,
      completedGamePks: [999],
      scheduleCandidates: [gameA, gameB],
    }));
    expect(decision.kind).toBe('DISPATCH_NOW');
    if (decision.kind === 'DISPATCH_NOW') {
      expect(decision.game.gamePk).toBe(400);
    }
  });

  it('32. replacement policy: missed earlier game -> later reserve selected when exact T-360', () => {
    const gameA = buildScheduleGame({
      gamePk: 500,
      officialDate: '2026-09-07',
      startTimeUtc: new Date('2026-09-07T01:00:00.000Z'),
    });
    const gameB = buildScheduleGame({
      gamePk: 501,
      officialDate: '2026-09-07',
      startTimeUtc: new Date('2026-09-07T03:00:00.000Z'),
    });
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      trustedNow: new Date('2026-09-06T19:00:00.000Z'),
      validationCapturedCount: 1,
      completedGamePks: [999],
      scheduleCandidates: [gameA, gameB],
    }));
    expect(decision.kind).toBe('WAIT_UNTIL_TARGET');
    if (decision.kind === 'WAIT_UNTIL_TARGET') {
      expect(decision.waitUntil).toBe('2026-09-06T20:45:00.000Z');
    }
  });

  it('21. multiple missed games -> later reserve selected', () => {
    const gameA = buildScheduleGame({
      gamePk: 600,
      startTimeUtc: new Date('2026-09-07T01:00:00.000Z'),
    });
    const gameB = buildScheduleGame({
      gamePk: 601,
      startTimeUtc: new Date('2026-09-07T02:00:00.000Z'),
    });
    const gameC = buildScheduleGame({
      gamePk: 602,
      startTimeUtc: new Date('2026-09-07T03:00:00.000Z'),
    });
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      trustedNow: new Date('2026-09-06T19:00:00.000Z'),
      validationCapturedCount: 1,
      completedGamePks: [999],
      scheduleCandidates: [gameA, gameB, gameC],
    }));
    expect(decision.kind).toBe('WAIT_UNTIL_TARGET');
    if (decision.kind === 'WAIT_UNTIL_TARGET') {
      expect(decision.waitUntil).toBe('2026-09-06T19:45:00.000Z');
    }
  });

  it('22. no remaining candidate + count<67 -> VALIDATION_TARGET_UNREACHABLE', () => {
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      validationCapturedCount: 1,
      scheduleCandidates: [BASE_GAME],
      trustedNow: new Date('2026-09-06T19:00:00.000Z'),
    }));
    expect(decision.kind).toBe('VALIDATION_TARGET_UNREACHABLE');
  });
});

/* -------------------------------------------------------------------------- */
/*  Failure / closed-world cases                                               */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-scheduler-core fail-closed', () => {
  it('24. duplicate gamePk fails closed', () => {
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      scheduleCandidates: [
        buildScheduleGame({ gamePk: 100 }),
        buildScheduleGame({ gamePk: 100 }),
      ],
    }));
    expect(decision.kind).toBe('HUMAN_REVIEW_REQUIRED');
    if (decision.kind === 'HUMAN_REVIEW_REQUIRED') {
      expect(decision.reason).toContain('duplicate gamePk');
    }
  });

  it('25. malformed schedule time fails closed', () => {
    const game = buildScheduleGame({
      startTimeUtc: new Date('invalid'),
    });
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      scheduleCandidates: [game],
    }));
    expect(decision.kind).toBe('HUMAN_REVIEW_REQUIRED');
    if (decision.kind === 'HUMAN_REVIEW_REQUIRED') {
      expect(decision.reason).toContain('invalid startTimeUtc');
    }
  });

  it('26. malformed officialDate fails closed if runtime input permits it', () => {
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      scheduleCandidates: [buildScheduleGame({ officialDate: '' })],
    }));
    expect(decision.kind).toBe('HUMAN_REVIEW_REQUIRED');
    if (decision.kind === 'HUMAN_REVIEW_REQUIRED') {
      expect(decision.reason).toContain('empty officialDate');
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  UTC-midnight / date-edge cases                                             */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-scheduler-core UTC date edges', () => {
  it('27. tomorrow-UTC schedule game planning works at previous UTC date', () => {
    const game = buildScheduleGame({
      gamePk: 700,
      officialDate: '2026-09-07',
      startTimeUtc: new Date('2026-09-07T01:00:00.000Z'),
    });
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      trustedNow: new Date('2026-09-06T18:45:00.000Z'),
      validationCapturedCount: 66,
      completedGamePks: [],
      scheduleCandidates: [game],
    }));
    expect(decision.kind).toBe('DISPATCH_NOW');
    if (decision.kind === 'DISPATCH_NOW') {
      expect(decision.game.gamePk).toBe(700);
    }
  });

  it('28. exact T-375 midnight example returns DISPATCH_NOW', () => {
    const game = buildScheduleGame({
      gamePk: 800,
      officialDate: '2026-09-07',
      startTimeUtc: new Date('2026-09-07T00:00:00.000Z'),
    });
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      trustedNow: new Date('2026-09-06T17:45:00.000Z'),
      validationCapturedCount: 66,
      completedGamePks: [],
      scheduleCandidates: [game],
    }));
    expect(decision.kind).toBe('DISPATCH_NOW');
    if (decision.kind === 'DISPATCH_NOW') {
      expect(decision.game.gamePk).toBe(800);
    }
  });

  it('31. UTC midnight pure-core test', () => {
    const decision = planProspectiveHoldoutValidationDispatch(buildInput({
      trustedNow: new Date('2026-09-06T18:45:00.000Z'),
      validationCapturedCount: 66,
      completedGamePks: [],
      scheduleCandidates: [BASE_GAME],
    }));
    expect(decision.kind).toBe('DISPATCH_NOW');
    if (decision.kind === 'DISPATCH_NOW') {
      expect(decision.game.gamePk).toBe(100);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Static purity / immutability                                               */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-scheduler-core static architecture', () => {
  it('29. does not mutate frozen input arrays/objects', () => {
    const input = buildInput({
      validationCapturedCount: 1,
      scheduleCandidates: [BASE_GAME],
      trustedNow: new Date('2026-09-06T18:45:00.000Z'),
    });
    const capturedCandidates = input.scheduleCandidates;
    const capturedCompleted = input.completedGamePks;
    planProspectiveHoldoutValidationDispatch(input);
    expect(input.scheduleCandidates).toBe(capturedCandidates);
    expect(input.completedGamePks).toBe(capturedCompleted);
    expect(capturedCandidates.length).toBe(1);
    expect(capturedCompleted.length).toBe(0);
  });

  it('30. repeated identical input produces identical decision', () => {
    const input = buildInput({
      validationCapturedCount: 1,
      scheduleCandidates: [BASE_GAME],
      trustedNow: new Date('2026-09-06T18:45:00.000Z'),
    });
    const first = planProspectiveHoldoutValidationDispatch(input);
    const second = planProspectiveHoldoutValidationDispatch(input);
    expect(first).toEqual(second);
  });

  it('contains no prohibited runtime or domain references', async () => {
    const fs = await import('node:fs');
    const scriptPath = new URL('../../../src/prediction/mlb/mlb-prospective-holdout-scheduler-core.ts', import.meta.url).pathname;
    const scriptContent = await fs.promises.readFile(scriptPath, 'utf-8');
    const forbidden = [
      'Date.now',
      'Math.random',
      'setTimeout',
      'setInterval',
      'child_process',
      'fs.',
      'fetch(',
      'sportsbook',
      'moneyline',
      'spread',
      'implied probability',
      'final score',
      'winner label',
      'postgame outcome',
      'model prediction',
    ];
    for (const term of forbidden) {
      expect(scriptContent).not.toContain(term);
    }
  });

  it('contains no unsafe casts or debug statements', async () => {
    const fs = await import('node:fs');
    const scriptPath = new URL('../../../src/prediction/mlb/mlb-prospective-holdout-scheduler-core.ts', import.meta.url).pathname;
    const scriptContent = await fs.promises.readFile(scriptPath, 'utf-8');
    expect(scriptContent).not.toContain('as any');
    expect(scriptContent).not.toContain('as unknown as');
    expect(scriptContent).not.toContain('as never');
    expect(scriptContent).not.toContain(': any');
    expect(scriptContent).not.toContain('<any>');
    expect(scriptContent).not.toContain('ts-ignore');
    expect(scriptContent).not.toContain('ts-expect-error');
    expect(scriptContent).not.toContain('debugger');
    expect(scriptContent).not.toContain('console.log');
    expect(scriptContent).not.toContain('TODO');
    expect(scriptContent).not.toContain('FIXME');
  });
});
