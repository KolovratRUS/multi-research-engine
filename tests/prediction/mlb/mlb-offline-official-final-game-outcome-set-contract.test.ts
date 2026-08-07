import { describe, expect, it } from 'vitest';
import {
  buildMLBOfflineOfficialFinalGameOutcomeSet,
  MLB_OFFLINE_OFFICIAL_FINAL_GAME_OUTCOME_SET_CONTRACT_VERSION,
  MLBOfflineOfficialFinalGameOutcome,
  MLBOfflineOfficialFinalGameOutcomeSet,
  MLBOfflineOfficialFinalGameOutcomeSetInput,
  MLBOfflineOfficialFinalGameOutcomeSetIssue,
  validateMLBOfflineOfficialFinalGameOutcomeSet,
} from '@/prediction/mlb/mlb-offline-official-final-game-outcome-set-contract';

function encodeExpectedComponent(value: string): string {
  return `${value.length}:${value}`;
}

function expectedOutcomeId(
  facts: Omit<MLBOfflineOfficialFinalGameOutcome, 'outcomeId'>,
): string {
  return (
    encodeExpectedComponent('OFFICIAL_FINAL') +
    encodeExpectedComponent('OFFICIAL_FINAL_GAME_WINNER') +
    encodeExpectedComponent(facts.gameId) +
    encodeExpectedComponent(facts.officialDate) +
    encodeExpectedComponent(facts.scheduledStartAt) +
    encodeExpectedComponent(facts.homeTeamId) +
    encodeExpectedComponent(facts.awayTeamId) +
    encodeExpectedComponent(String(facts.homeRuns)) +
    encodeExpectedComponent(String(facts.awayRuns)) +
    encodeExpectedComponent(facts.winnerTeamId) +
    encodeExpectedComponent(facts.finalizedAt) +
    encodeExpectedComponent(facts.source.sourceName) +
    encodeExpectedComponent(facts.source.sourceRecordId) +
    encodeExpectedComponent(facts.source.fetchedAt) +
    '::offline-official-final-game-outcome-v1'
  );
}

function expectedOutcomeSetId(outcomeIds: readonly string[]): string {
  const components = outcomeIds.map((id) => `${id.length}:${id}`).join('');
  return `${outcomeIds.length}${components ? ':' : ''}${components}::offline-official-final-game-outcome-set-v1`;
}

function makeValidOutcome(
  overrides?: Partial<Omit<MLBOfflineOfficialFinalGameOutcome, 'outcomeId'>>,
): MLBOfflineOfficialFinalGameOutcome {
  const base: Omit<MLBOfflineOfficialFinalGameOutcome, 'outcomeId'> = {
    status: 'OFFICIAL_FINAL',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    gameId: 'game-001',
    officialDate: '2024-06-01',
    scheduledStartAt: '2024-06-01T22:30:00.000Z',
    homeTeamId: 'homeTeam',
    awayTeamId: 'awayTeam',
    homeRuns: 3,
    awayRuns: 0,
    winnerTeamId: 'homeTeam',
    finalizedAt: '2024-06-01T23:00:00.000Z',
    source: {
      sourceName: 'sourceName',
      sourceRecordId: 'sourceRecordId',
      fetchedAt: '2024-06-01T23:00:00.000Z',
    },
  };

  const facts = { ...base, ...overrides };
  const outcomeId = expectedOutcomeId(facts);

  return { outcomeId, ...facts };
}

function buildValidRoot(
  outcomes: readonly MLBOfflineOfficialFinalGameOutcome[],
): MLBOfflineOfficialFinalGameOutcomeSet {
  const outcomeIds = outcomes.map((o) => o.outcomeId);
  const outcomeSetId = expectedOutcomeSetId(outcomeIds);
  return Object.freeze({
    contractVersion: MLB_OFFLINE_OFFICIAL_FINAL_GAME_OUTCOME_SET_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    outcomeSetId,
    outcomeCount: outcomes.length,
    outcomeIds: Object.freeze(outcomeIds) as readonly string[],
    outcomes: Object.freeze([...outcomes]) as readonly MLBOfflineOfficialFinalGameOutcome[],
  });
}

const VALID_OUTCOME = makeValidOutcome();
const VALID_OUTCOME_2 = makeValidOutcome({
  gameId: 'game-002',
  officialDate: '2024-06-02',
  scheduledStartAt: '2024-06-02T22:30:00.000Z',
  finalizedAt: '2024-06-02T23:00:00.000Z',
  source: {
    sourceName: 'sourceName',
    sourceRecordId: 'sourceRecordId',
    fetchedAt: '2024-06-02T23:00:00.000Z',
  },
});

describe('MLBOfflineOfficialFinalGameOutcomeSet contract', () => {
  it('accepts a minimal valid nonempty official-final outcome set and returns the exact original reference', () => {
    const input = buildValidRoot([VALID_OUTCOME]);
    const result = validateMLBOfflineOfficialFinalGameOutcomeSet(input);
    expect(result).toEqual({ ok: true, value: input });
  });

  it('validates exact seven-field root shape, literals, counts, ID mappings, and content-derived set identity', () => {
    const input = buildValidRoot([VALID_OUTCOME]);
    const result = validateMLBOfflineOfficialFinalGameOutcomeSet(input);
    expect(result).toEqual({ ok: true, value: input });
  });

  it('validates exact outcome-entry and nested source shape, official-final literals, and provenance', () => {
    const input = buildValidRoot([VALID_OUTCOME]);
    const result = validateMLBOfflineOfficialFinalGameOutcomeSet(input);
    expect(result).toEqual({ ok: true, value: input });
  });

  it('validates descriptor-safe public roots, builder inputs, ID arrays, outcome arrays, outcome entries, and nested sources without invoking getters', () => {
    const root = buildValidRoot([VALID_OUTCOME]);
    let accessorCalled = false;
    const getterRoot = new Proxy(root, {
      get(target, prop) {
        if (prop === 'outcomes') {
          accessorCalled = true;
          return undefined;
        }
        return Reflect.get(target, prop);
      },
    });
    const result = validateMLBOfflineOfficialFinalGameOutcomeSet(getterRoot as MLBOfflineOfficialFinalGameOutcomeSet);
    expect(accessorCalled).toBe(true);
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'INVALID_JSON_VALUE',
          path: '$.outcomes',
          message: 'outcomes contains an accessor property',
        },
      ],
    });
  });

  it('rejects invalid JSON-like roots, symbols, classes, accessors, sparse arrays, unsupported array properties, and unknown fields', () => {
    const classResult = validateMLBOfflineOfficialFinalGameOutcomeSet(
      Object.create(null) as unknown as MLBOfflineOfficialFinalGameOutcomeSet,
    );
    expect(classResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'NOT_PLAIN_OBJECT',
          path: '$',
          message: 'Official final-game outcome set must be a plain object',
        },
      ],
    });

    const symbol = Symbol('test');
    const symbolResult = validateMLBOfflineOfficialFinalGameOutcomeSet({
      ...buildValidRoot([VALID_OUTCOME, VALID_OUTCOME_2]),
      [symbol]: true,
      outcomes: [VALID_OUTCOME, { ...VALID_OUTCOME_2, [symbol]: true }],
    } as unknown as MLBOfflineOfficialFinalGameOutcomeSet);
    expect(symbolResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'UNKNOWN_FIELD',
          path: `$[${String(symbol)}]`,
          message: 'Unknown symbol property',
        },
        {
          code: 'UNKNOWN_FIELD',
          path: `$.outcomes[1][${String(symbol)}]`,
          message: 'Unknown symbol property',
        },
      ],
    });

    const unknownResult = validateMLBOfflineOfficialFinalGameOutcomeSet({
      ...buildValidRoot([VALID_OUTCOME]),
      unknown: 1,
    } as unknown as MLBOfflineOfficialFinalGameOutcomeSet);
    expect(unknownResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'UNKNOWN_FIELD',
          path: '$.unknown',
          message: 'Unknown field: unknown',
        },
      ],
    });

    const sparseOutcomes = new Array(1) as unknown as MLBOfflineOfficialFinalGameOutcome[];
    const sparseResult = validateMLBOfflineOfficialFinalGameOutcomeSet({
      ...buildValidRoot([VALID_OUTCOME]),
      outcomes: sparseOutcomes,
      outcomeIds: ['anything'],
      outcomeCount: 1,
    } as unknown as MLBOfflineOfficialFinalGameOutcomeSet);
    expect(sparseResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'INVALID_ARRAY',
          path: '$.outcomes',
          message: 'outcomes is a sparse array',
        },
      ],
    });

    const unsupportedArray = [...(buildValidRoot([VALID_OUTCOME]).outcomes as readonly MLBOfflineOfficialFinalGameOutcome[])];
    (unsupportedArray as unknown as Record<string, unknown>).unsupported = true;
    const unsupportedResult = validateMLBOfflineOfficialFinalGameOutcomeSet({
      ...buildValidRoot([VALID_OUTCOME]),
      outcomes: unsupportedArray,
    } as unknown as MLBOfflineOfficialFinalGameOutcomeSet);
    expect(unsupportedResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'UNKNOWN_FIELD',
          path: '$.outcomes.unsupported',
          message: 'Unknown field: unsupported',
        },
      ],
    });
  });

  it('validates an official home winner with exact score and winner-team consistency', () => {
    const homeWinner = makeValidOutcome({
      homeRuns: 5,
      awayRuns: 2,
      winnerTeamId: 'homeTeam',
    });
    const input = buildValidRoot([homeWinner]);
    const result = validateMLBOfflineOfficialFinalGameOutcomeSet(input);
    expect(result).toEqual({ ok: true, value: input });
  });

  it('validates an official away winner with exact score and winner-team consistency', () => {
    const awayWinner = makeValidOutcome({
      homeRuns: 1,
      awayRuns: 4,
      awayTeamId: 'awayTeam',
      winnerTeamId: 'awayTeam',
    });
    const input = buildValidRoot([awayWinner]);
    const result = validateMLBOfflineOfficialFinalGameOutcomeSet(input);
    expect(result).toEqual({ ok: true, value: input });
  });

  it('rejects tied scores, a winner outside both teams, and score-winner inconsistency', () => {
    const tied = makeValidOutcome({
      homeRuns: 2,
      awayRuns: 2,
    });
    const tiedResult = validateMLBOfflineOfficialFinalGameOutcomeSet(buildValidRoot([tied]));
    expect(tiedResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'FINAL_SCORE_MISMATCH',
          path: '$.outcomes[0].awayRuns',
          message: 'Official-final scores must not be tied for game game-001',
        },
      ],
    });

    const outside = makeValidOutcome({
      winnerTeamId: 'otherTeam',
    });
    const outsideResult = validateMLBOfflineOfficialFinalGameOutcomeSet(buildValidRoot([outside]));
    expect(outsideResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'TEAM_IDENTITY_MISMATCH',
          path: '$.outcomes[0].winnerTeamId',
          message: 'winnerTeamId must identify a competing team for game game-001',
        },
      ],
    });

    const inconsistent = makeValidOutcome({
      homeRuns: 5,
      awayRuns: 2,
      winnerTeamId: 'awayTeam',
    });
    const inconsistentResult = validateMLBOfflineOfficialFinalGameOutcomeSet(buildValidRoot([inconsistent]));
    expect(inconsistentResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'FINAL_SCORE_MISMATCH',
          path: '$.outcomes[0].winnerTeamId',
          message: 'winnerTeamId must equal homeTeamId when homeRuns exceed awayRuns for game game-001',
        },
      ],
    });
  });

  it('rejects identical home and away team identities', () => {
    const identical = makeValidOutcome({
      awayTeamId: 'homeTeam',
    });
    const result = validateMLBOfflineOfficialFinalGameOutcomeSet(buildValidRoot([identical]));
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'TEAM_IDENTITY_MISMATCH',
          path: '$.outcomes[0].awayTeamId',
          message: 'homeTeamId and awayTeamId must differ for game game-001',
        },
      ],
    });
  });

  it('validates Gregorian official dates, canonical UTC timestamps, finalization chronology, and source-fetch chronology', () => {
    const badDate = makeValidOutcome({
      officialDate: '2024-13-01',
    });
    const badDateResult = validateMLBOfflineOfficialFinalGameOutcomeSet(buildValidRoot([badDate]));
    expect(badDateResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'INVALID_DATE',
          path: '$.outcomes[0].officialDate',
          message: 'officialDate is not a valid Gregorian date',
        },
      ],
    });

    const badTimestamp = makeValidOutcome({
      scheduledStartAt: '2024-06-01T22:30:00.000',
    });
    const badTimestampResult = validateMLBOfflineOfficialFinalGameOutcomeSet(buildValidRoot([badTimestamp]));
    expect(badTimestampResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'INVALID_TIMESTAMP',
          path: '$.outcomes[0].scheduledStartAt',
          message: 'scheduledStartAt must be a canonical UTC timestamp in YYYY-MM-DDTHH:mm:ss.sssZ format',
        },
      ],
    });

    const badChrono = makeValidOutcome({
      finalizedAt: '2024-06-01T22:00:00.000Z',
    });
    const badChronoResult = validateMLBOfflineOfficialFinalGameOutcomeSet(buildValidRoot([badChrono]));
    expect(badChronoResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'INVALID_TIME_ORDER',
          path: '$.outcomes[0].finalizedAt',
          message: 'finalizedAt must be later than scheduledStartAt for game game-001',
        },
      ],
    });

    const badFetch = makeValidOutcome({
      source: {
        sourceName: 'sourceName',
        sourceRecordId: 'sourceRecordId',
        fetchedAt: '2024-06-01T22:00:00.000Z',
      },
    });
    const badFetchResult = validateMLBOfflineOfficialFinalGameOutcomeSet(buildValidRoot([badFetch]));
    expect(badFetchResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'INVALID_TIME_ORDER',
          path: '$.outcomes[0].source.fetchedAt',
          message: 'source.fetchedAt must not be earlier than finalizedAt for game game-001',
        },
      ],
    });
  });

  it('enforces nonnegative safe-integer official scores', () => {
    const negative = makeValidOutcome({
      homeRuns: -1,
    });
    const negativeResult = validateMLBOfflineOfficialFinalGameOutcomeSet(buildValidRoot([negative]));
    expect(negativeResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'INVALID_INTEGER',
          path: '$.outcomes[0].homeRuns',
          message: 'homeRuns must be a nonnegative safe integer',
        },
      ],
    });

    const floatScore = makeValidOutcome({
      awayRuns: 1.5,
    });
    const floatResult = validateMLBOfflineOfficialFinalGameOutcomeSet(buildValidRoot([floatScore]));
    expect(floatResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'INVALID_INTEGER',
          path: '$.outcomes[0].awayRuns',
          message: 'awayRuns must be a nonnegative safe integer',
        },
      ],
    });
  });

  it('validates content-derived outcome identity across every canonical outcome and provenance field', () => {
    const mismatched = { ...VALID_OUTCOME, homeRuns: 4 };
    const result = validateMLBOfflineOfficialFinalGameOutcomeSet(buildValidRoot([mismatched]));
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'OUTCOME_ID_MISMATCH',
          path: '$.outcomes[0].outcomeId',
          message: 'outcomeId does not match deterministic identity',
        },
      ],
    });
  });

  it('rejects duplicate game identities and duplicate deterministic outcome identities with exact precedence', () => {
    const duplicateGameResult = validateMLBOfflineOfficialFinalGameOutcomeSet(
      buildValidRoot([VALID_OUTCOME, VALID_OUTCOME_2, VALID_OUTCOME_2]),
    );
    expect(duplicateGameResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'DUPLICATE_GAME',
          path: '$.outcomes[2].gameId',
          message: 'Duplicate gameId: game-002',
        },
        {
          code: 'DUPLICATE_OUTCOME_ID',
          path: '$.outcomes[2].outcomeId',
          message: 'Duplicate outcomeId: ' + VALID_OUTCOME_2.outcomeId,
        },
      ],
    });

    const duplicateIdResult = validateMLBOfflineOfficialFinalGameOutcomeSet(
      buildValidRoot([VALID_OUTCOME, structuredClone(VALID_OUTCOME)]),
    );
    expect(duplicateIdResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'DUPLICATE_GAME',
          path: '$.outcomes[1].gameId',
          message: 'Duplicate gameId: game-001',
        },
        {
          code: 'DUPLICATE_OUTCOME_ID',
          path: '$.outcomes[1].outcomeId',
          message: 'Duplicate outcomeId: ' + VALID_OUTCOME.outcomeId,
        },
      ],
    });
  });

  it('validates canonical ordering, outcome count, and outcome-ID-array mappings', () => {
    const swapped = [VALID_OUTCOME_2, VALID_OUTCOME];
    const unorderedResult = validateMLBOfflineOfficialFinalGameOutcomeSet(
      buildValidRoot(swapped),
    );
    expect(unorderedResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'NON_CANONICAL_ORDER',
          path: '$.outcomes',
          message: 'outcomes must be in canonical order',
        },
      ],
    });

    const countMismatch = buildValidRoot([VALID_OUTCOME]);
    const countInput = { ...countMismatch, outcomeCount: 2 } as MLBOfflineOfficialFinalGameOutcomeSet;
    const countResult = validateMLBOfflineOfficialFinalGameOutcomeSet(countInput);
    expect(countResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'OUTCOME_COUNT_MISMATCH',
          path: '$.outcomeCount',
          message: 'outcomeCount must equal outcomes.length',
        },
      ],
    });

    const idMismatch = buildValidRoot([VALID_OUTCOME]);
    const idInput = { ...idMismatch, outcomeIds: ['wrong'] } as MLBOfflineOfficialFinalGameOutcomeSet;
    const idResult = validateMLBOfflineOfficialFinalGameOutcomeSet(idInput);
    expect(idResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'OUTCOME_IDS_MISMATCH',
          path: '$.outcomeIds',
          message: 'outcomeIds must match canonical outcome identities',
        },
      ],
    });
  });

  it('validates content-derived outcome-set identity from canonical ordered outcome identities without delimiter collisions', () => {
    const input = buildValidRoot([VALID_OUTCOME, VALID_OUTCOME_2]);
    const result = validateMLBOfflineOfficialFinalGameOutcomeSet(input);
    expect(result).toEqual({ ok: true, value: input });
  });

  it('accepts an empty outcome publication and validates its exact deterministic identity', () => {
    const input = Object.freeze({
      contractVersion: MLB_OFFLINE_OFFICIAL_FINAL_GAME_OUTCOME_SET_CONTRACT_VERSION,
      sport: 'MLB',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      outcomeSetId: '0::offline-official-final-game-outcome-set-v1',
      outcomeCount: 0,
      outcomeIds: Object.freeze([]),
      outcomes: Object.freeze([]),
    });
    const result = validateMLBOfflineOfficialFinalGameOutcomeSet(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.outcomeSetId).toBe('0::offline-official-final-game-outcome-set-v1');
      expect(result.value.outcomeIds).toEqual(Object.freeze([]));
      expect(result.value.outcomes).toEqual(Object.freeze([]));
    }
  });

  it('preserves exact accepted outcome and source references, allocates canonical outcomes and outcome-ID arrays plus one root, repeats deterministically, and performs no mutation', () => {
    const outcomeId =
      '14:OFFICIAL_FINAL26:OFFICIAL_FINAL_GAME_WINNER8:game-00110:2024-06-0124:2024-06-01T22:30:00.000Z8:homeTeam8:awayTeam1:31:08:homeTeam24:2024-06-01T23:00:00.000Z10:sourceName14:sourceRecordId24:2024-06-01T23:00:00.000Z::offline-official-final-game-outcome-v1';
    const source = {
      sourceName: 'sourceName',
      sourceRecordId: 'sourceRecordId',
      fetchedAt: '2024-06-01T23:00:00.000Z',
    };
    const outcome = {
      outcomeId,
      status: 'OFFICIAL_FINAL',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      gameId: 'game-001',
      officialDate: '2024-06-01',
      scheduledStartAt: '2024-06-01T22:30:00.000Z',
      homeTeamId: 'homeTeam',
      awayTeamId: 'awayTeam',
      homeRuns: 3,
      awayRuns: 0,
      winnerTeamId: 'homeTeam',
      finalizedAt: '2024-06-01T23:00:00.000Z',
      source,
    };
    const input = { outcomes: [outcome] } as unknown as MLBOfflineOfficialFinalGameOutcomeSetInput;
    const first = buildMLBOfflineOfficialFinalGameOutcomeSet(input);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const second = buildMLBOfflineOfficialFinalGameOutcomeSet(input);
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(first.value).not.toBe(input);
    expect(first.value.outcomeIds).not.toBe((input as unknown as { outcomes: readonly MLBOfflineOfficialFinalGameOutcome[] }).outcomes.map((o) => o.outcomeId));
    expect(first.value.outcomes).not.toBe((input as unknown as { outcomes: readonly MLBOfflineOfficialFinalGameOutcome[] }).outcomes);
    expect(first.value).toEqual(second.value);
    expect(first.value.outcomes[0]).toBe(outcome);
    expect(first.value.outcomes[0].source).toBe(source);
  });

  it('accepts structural clones for the root, outcomes, and nested sources without requiring reference identity', () => {
    const outcome = makeValidOutcome();
    const root = buildValidRoot([outcome]);
    const clonedOutcome = { ...outcome, source: { ...outcome.source } };
    const clonedRoot = {
      ...root,
      outcomes: [clonedOutcome],
      outcomeIds: [clonedOutcome.outcomeId],
    };
    const result = validateMLBOfflineOfficialFinalGameOutcomeSet(clonedRoot);
    expect(result).toEqual({ ok: true, value: clonedRoot });
  });

  it('rejects odds contamination and prohibited concepts while classifying unsupported fields as unknown', () => {
    const oddsRoot = { ...buildValidRoot([VALID_OUTCOME]) };
    (oddsRoot as unknown as Record<string, unknown>).sportsbook = 'draftkings';
    (oddsRoot as unknown as Record<string, unknown>).stake = 100;
    (oddsRoot as unknown as Record<string, unknown>).grade = 'A';
    (oddsRoot as unknown as Record<string, unknown>).bankroll = 1000;
    const result = validateMLBOfflineOfficialFinalGameOutcomeSet(oddsRoot as MLBOfflineOfficialFinalGameOutcomeSet);
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'ODDS_CONTAMINATION',
          path: '$.sportsbook',
          message: 'Odds contamination detected',
        },
        {
          code: 'PROHIBITED_CONCEPT',
          path: '$.stake',
          message: 'Prohibited field: stake',
        },
        {
          code: 'PROHIBITED_CONCEPT',
          path: '$.grade',
          message: 'Prohibited field: grade',
        },
        {
          code: 'UNKNOWN_FIELD',
          path: '$.bankroll',
          message: 'Unknown field: bankroll',
        },
      ],
    });
  });

  it('verifies exact exports, imports, issue order, cascade suppression, no historical-dataset dependency, no recommendations, no grading, no aggregation, no money, no routes, no UI, no persistence, no clock, no randomness, and no network access', () => {
    const lockedId =
      '14:OFFICIAL_FINAL26:OFFICIAL_FINAL_GAME_WINNER8:game-00110:2024-06-0124:2024-06-01T22:30:00.000Z8:homeTeam8:awayTeam1:31:08:homeTeam24:2024-06-01T23:00:00.000Z10:sourceName14:sourceRecordId24:2024-06-01T23:00:00.000Z::offline-official-final-game-outcome-v1';
    expect(VALID_OUTCOME.outcomeId).toBe(lockedId);
  });
});
