import { describe, expect, it } from 'vitest';
import {
  validateMLBCanonicalPregameSnapshot,
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';

const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';

function buildSourceReference(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sourceRefId: 'src-official',
    sourceName: 'MLB Stats API',
    sourceCategory: 'OFFICIAL',
    roles: ['GAME_IDENTITY'],
    providerRecordId: null,
    fetchedAt: FROZEN_CAPTURED_AT,
    sourceUpdatedAt: FROZEN_DATA_CUTOFF,
    ...overrides,
  } as Record<string, unknown>;
}

function buildStartingPitcher(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    state: 'PROBABLE' as const,
    pitcherId: 'p-1',
    announcedAt: FROZEN_DATA_CUTOFF,
    sourceRefIds: ['src-official'],
    ...overrides,
  } as Record<string, unknown>;
}

function buildSection(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sectionId: 'sec-1',
    kind: 'GAME_CONTEXT' as const,
    entity: {
      scope: 'GAME' as const,
      entityId: null,
    },
    status: 'AVAILABLE' as const,
    asOfAt: FROZEN_DATA_CUTOFF,
    sourceRefIds: ['src-official'],
    payload: {},
    ...overrides,
  } as Record<string, unknown>;
}

function buildWarning(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code: 'PATCHY_WIND',
    path: '$.venue.wind',
    message: 'Wind speed varies across reported sources.',
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contractVersion: MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
    sport: 'MLB' as const,
    target: 'OFFICIAL_FINAL_GAME_WINNER' as const,
    snapshotId: 'snapshot-1',
    capturedAt: FROZEN_CAPTURED_AT,
    dataCutoffAt: FROZEN_DATA_CUTOFF,
    game: {
      gameId: 'game-1',
      scheduledStartAt: FROZEN_SCHEDULED_START,
      officialDate: '2026-07-15',
      season: 2026,
      gameType: 'REGULAR_SEASON' as const,
      status: 'SCHEDULED' as const,
      homeTeamId: 'home-1',
      awayTeamId: 'away-1',
      venueId: 'venue-1',
      neutralSite: false,
      doubleheader: null,
    },
    startingPitchers: {
      home: buildStartingPitcher(),
      away: buildStartingPitcher({ pitcherId: 'p-2', sourceRefIds: ['src-away'] }),
    },
    sourceReferences: [
      buildSourceReference({ sourceRefId: 'src-away', roles: ['STARTING_PITCHER'] }),
      buildSourceReference(),
    ],
    sections: [buildSection()],
    dataCompleteness: 'COMPLETE' as const,
    warnings: [buildWarning()],
    ...overrides,
  } as Record<string, unknown>;
}

function buildGame(overrides: Record<string, unknown> = {}): unknown {
  return {
    gameId: 'game-1',
    scheduledStartAt: FROZEN_SCHEDULED_START,
    officialDate: '2026-07-15',
    season: 2026,
    gameType: 'REGULAR_SEASON' as const,
    status: 'SCHEDULED' as const,
    homeTeamId: 'home-1',
    awayTeamId: 'away-1',
    venueId: 'venue-1',
    neutralSite: false,
    doubleheader: null,
    ...overrides,
  };
}

describe('mlb-pregame-snapshot-contract', () => {
  it('accepts a minimal valid canonical pregame snapshot and preserves the original reference', () => {
    const snapshot = buildValidSnapshot();

    const result = validateMLBCanonicalPregameSnapshot(snapshot);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(snapshot);
    }
  });

  it('validates exact contract literals and rejects unknown root fields', () => {
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({ sport: 'NFL' })).ok).toBe(false);
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({ target: 'REGULATION_ONLY' })).ok).toBe(false);

    const unknownRoot = buildValidSnapshot({ mysteryField: true });
    const result = validateMLBCanonicalPregameSnapshot(unknownRoot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'UNKNOWN_FIELD', path: '$.mysteryField' })]),
      );
    }
  });

  it('validates game identity', () => {
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      game: buildGame({ homeTeamId: 'home-1', awayTeamId: 'home-1' }),
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      game: buildGame({ gameId: '' }),
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      game: buildGame({ homeAdvantage: true }),
    })).ok).toBe(false);
  });

  it('accepts true/false/null neutralSite and rejects missing and non-boolean values', () => {
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      game: buildGame({ neutralSite: true }),
    })).ok).toBe(true);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      game: buildGame({ neutralSite: false }),
    })).ok).toBe(true);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      game: buildGame({ neutralSite: null }),
    })).ok).toBe(true);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      game: buildGame({ neutralSite: 'yes' }),
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      game: buildGame({ neutralSite: 1 }),
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      game: buildGame({ neutralSite: {} }),
    })).ok).toBe(false);

    const missingNeutralSite = buildValidSnapshot({
      game: buildGame({ neutralSite: undefined }),
    }) as Record<string, unknown>;

    const gameValue = missingNeutralSite.game;
    if (
      gameValue !== undefined &&
      gameValue !== null &&
      typeof gameValue === 'object'
    ) {
      const gameRecord = gameValue as Record<string, unknown>;
      delete gameRecord.neutralSite;
    }

    expect(validateMLBCanonicalPregameSnapshot(missingNeutralSite).ok).toBe(false);
  });

  it('validates doubleheader identity', () => {
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      game: buildGame({
        doubleheader: { doubleheaderId: 'dh-1', gameNumber: 1 },
      }),
    })).ok).toBe(true);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      game: buildGame({
        doubleheader: { doubleheaderId: 'dh-1', gameNumber: 3 },
      }),
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      game: buildGame({
        doubleheader: { doubleheaderId: '', gameNumber: 1 },
      }),
    })).ok).toBe(false);
  });

  it('rejects in-progress/final status and target-game outcome fields', () => {
    const accepted = ['SCHEDULED', 'PRE_GAME', 'POSTPONED', 'CANCELLED', 'UNKNOWN'];
    for (const status of accepted) {
      expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
        game: buildGame({ status }),
      })).ok).toBe(true);
    }

    const rejected = ['WARMUP', 'PREPARE_LINEUP', 'FINAL_LINEUP', 'IN_PROGRESS', 'FINAL'];
    for (const status of rejected) {
      expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
        game: buildGame({ status }),
      })).ok).toBe(false);
    }

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      game: buildGame({ winner: 'home-1' }),
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      finalScore: { home: 3, away: 2 },
    })).ok).toBe(false);
  });

  it('validates timestamp structure and numeric ordering but not lexical ordering', () => {
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      game: buildGame({ scheduledStartAt: ' 2026-07-15T10:00:00Z' }),
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      game: buildGame({ scheduledStartAt: '2026-07-15T10:00:00Z ' }),
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      game: buildGame({ scheduledStartAt: '2026-07-15' }),
    })).ok).toBe(false);

    const validMixedOffsets = buildValidSnapshot({
      snapshotId: 'snapshot-mixed',
      capturedAt: '2026-07-15T22:00:00+02:00',
      dataCutoffAt: '2026-07-15T20:00:00+02:00',
      dataCompleteness: 'COMPLETE',
      game: buildGame({
        gameId: 'game-mixed',
        scheduledStartAt: '2026-07-15T18:00:00-04:00',
        homeTeamId: 'home-mixed',
        awayTeamId: 'away-mixed',
        venueId: 'venue-mixed',
      }),
      startingPitchers: {
        home: buildStartingPitcher({ pitcherId: 'p-mixed', sourceRefIds: ['src-mixed'] }),
        away: buildStartingPitcher({ pitcherId: 'p-mixed-away', sourceRefIds: ['src-mixed'] }),
      },
      sourceReferences: [buildSourceReference({ sourceRefId: 'src-mixed', fetchedAt: '2026-07-15T22:00:00+02:00', sourceUpdatedAt: '2026-07-15T20:00:00+02:00' })],
      sections: [buildSection({ sourceRefIds: ['src-mixed'], asOfAt: '2026-07-15T20:00:00+02:00' })],
      warnings: [],
    });

    expect(validateMLBCanonicalPregameSnapshot(validMixedOffsets)).toEqual(
      expect.objectContaining({ ok: true }),
    );

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      snapshot: {
        snapshotId: 'snapshot-bad',
        capturedAt: '2026-07-15T09:00:00Z',
        dataCutoffAt: '2026-07-15T10:00:00-05:00',
        sourceUpdatedAt: null,
        dataCompleteness: 'COMPLETE',
      },
      game: buildGame({ scheduledStartAt: '2026-07-15T12:00:00+05:00' }),
    })).ok).toBe(false);
  });

  it('validates source references', () => {
    const valid = buildValidSnapshot({
      sourceReferences: [
        buildSourceReference({ sourceRefId: 'a', roles: ['GAME_IDENTITY', 'TEAM_PLAYER_IDENTITY'] }),
        buildSourceReference({ sourceRefId: 'b', roles: ['STARTING_PITCHER'] }),
      ],
      startingPitchers: {
        home: buildStartingPitcher({ sourceRefIds: ['a'] }),
        away: buildStartingPitcher({ sourceRefIds: ['b'] }),
      },
      sections: [buildSection({ sourceRefIds: ['a'] })],
    });

    expect(validateMLBCanonicalPregameSnapshot(valid).ok).toBe(true);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: [
        buildSourceReference({ sourceRefId: 'same' }),
        buildSourceReference({ sourceRefId: 'same' }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: [
        buildSourceReference({ roles: [] }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: [
        buildSourceReference({ providerRecordId: 123 }),
      ],
    })).ok).toBe(false);

    // strict sourceRefId
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: [
        buildSourceReference({ sourceRefId: '' }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: [
        buildSourceReference({ sourceRefId: ' source-1' }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: [
        buildSourceReference({ sourceRefId: 'source-1 ' }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: [
        buildSourceReference({ sourceRefId: 'source\u0000-1' }),
      ],
    })).ok).toBe(false);

    // strict sourceName
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: [
        buildSourceReference({ sourceName: '' }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: [
        buildSourceReference({ sourceName: ' MLB Stats API' }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: [
        buildSourceReference({ sourceName: 'MLB Stats API ' }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: [
        buildSourceReference({ sourceName: '\u0000' }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: [
        buildSourceReference({ sourceName: ' ' }),
      ],
    })).ok).toBe(false);

    // strict providerRecordId
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: [
        buildSourceReference({ providerRecordId: '' }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: [
        buildSourceReference({ providerRecordId: ' prov-1' }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: [
        buildSourceReference({ providerRecordId: 'prov-1 ' }),
      ],
    })).ok).toBe(false);

    // non-string roles
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: [
        buildSourceReference({ roles: [1] }),
      ],
    })).ok).toBe(false);

    // descriptor-safe sourceReferences array
    let srcGetterExecuted = false;
    const srcAccessorArr: unknown[] = [];
    Object.defineProperty(srcAccessorArr, '0', {
      enumerable: true,
      configurable: true,
      get() {
        srcGetterExecuted = true;
        return { sourceRefId: 'x', sourceName: 'y', sourceCategory: 'OFFICIAL', roles: ['GAME_IDENTITY'] };
      },
    });
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: srcAccessorArr,
    })).ok).toBe(false);
    expect(srcGetterExecuted).toBe(false);

    // setter-only sourceReferences array
    let srcSetterExecuted = false;
    const srcSetterArr: unknown[] = [];
    Object.defineProperty(srcSetterArr, '0', {
      enumerable: true,
      configurable: true,
      set(_next: unknown) {
        srcSetterExecuted = true;
      },
    });
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: srcSetterArr,
    })).ok).toBe(false);
    expect(srcSetterExecuted).toBe(false);

    // descriptor-safe roles array
    let rolesGetterExecuted = false;
    const rolesAccessorArr: unknown[] = [];
    Object.defineProperty(rolesAccessorArr, '0', {
      enumerable: true,
      configurable: true,
      get() {
        rolesGetterExecuted = true;
        return 'GAME_IDENTITY';
      },
    });
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: [buildSourceReference({ roles: rolesAccessorArr })],
    })).ok).toBe(false);
    expect(rolesGetterExecuted).toBe(false);

    // setter-only roles array
    let rolesSetterExecuted = false;
    const rolesSetterArr: unknown[] = [];
    Object.defineProperty(rolesSetterArr, '0', {
      enumerable: true,
      configurable: true,
      set(_next: unknown) {
        rolesSetterExecuted = true;
      },
    });
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: [buildSourceReference({ roles: rolesSetterArr })],
    })).ok).toBe(false);
    expect(rolesSetterExecuted).toBe(false);

    // symbol property on sourceReferences array
    const srcSymbol = Symbol('src');
    const srcSymbolArr: unknown[] = [];
    Object.defineProperty(srcSymbolArr, srcSymbol, {
      enumerable: false,
      value: 'hidden',
    });
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: srcSymbolArr,
    })).ok).toBe(false);

    // extra string property on sourceReferences array
    const srcExtraArr: unknown[] = [];
    Object.defineProperty(srcExtraArr, 'extra', {
      enumerable: true,
      value: 'x',
    });
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: srcExtraArr,
    })).ok).toBe(false);
  });

  it('validates source timestamp rules', () => {
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: [
        buildSourceReference({ fetchedAt: '2026-07-15T11:00:00Z' }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: [
        buildSourceReference({ sourceUpdatedAt: '2026-07-15T11:00:00Z' }),
      ],
    })).ok).toBe(false);
  });

  it('validates starting-pitcher states', () => {
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      startingPitchers: {
        home: buildStartingPitcher({ state: 'CONFIRMED' }),
        away: buildStartingPitcher({ state: 'UNAVAILABLE', pitcherId: null, announcedAt: null }),
      },
    })).ok).toBe(true);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      startingPitchers: {
        home: buildStartingPitcher({ state: 'CONFIRMED', pitcherId: null }),
        away: buildStartingPitcher({ state: 'CONFIRMED', announcedAt: null }),
      },
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      startingPitchers: {
        home: buildStartingPitcher({ state: 'UNCONFIRMED', pitcherId: 'p-1' }),
        away: buildStartingPitcher({ state: 'UNCONFIRMED' }),
      },
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      startingPitchers: {
        home: buildStartingPitcher({ state: 'UNAVAILABLE', pitcherId: 'p-1' }),
        away: buildStartingPitcher({ state: 'UNAVAILABLE', announcedAt: FROZEN_DATA_CUTOFF }),
      },
    })).ok).toBe(false);

    // UNCONFIRMED without pitcherId
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      startingPitchers: {
        home: { state: 'UNCONFIRMED' as const, announcedAt: null, sourceRefIds: [] },
        away: buildStartingPitcher(),
      },
    })).ok).toBe(false);

    // UNCONFIRMED without announcedAt
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      startingPitchers: {
        home: { state: 'UNCONFIRMED' as const, pitcherId: null, sourceRefIds: [] },
        away: buildStartingPitcher(),
      },
    })).ok).toBe(false);

    // UNAVAILABLE without pitcherId
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      startingPitchers: {
        home: { state: 'UNAVAILABLE' as const, announcedAt: null, sourceRefIds: [] },
        away: buildStartingPitcher(),
      },
    })).ok).toBe(false);

    // UNAVAILABLE without announcedAt
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      startingPitchers: {
        home: { state: 'UNAVAILABLE' as const, pitcherId: null, sourceRefIds: [] },
        away: buildStartingPitcher(),
      },
    })).ok).toBe(false);

    // descriptor-safe starter sourceRefIds array
    let srcRefsGetterExecuted = false;
    const srcRefsAccessorArr: unknown[] = [];
    Object.defineProperty(srcRefsAccessorArr, '0', {
      enumerable: true,
      configurable: true,
      get() {
        srcRefsGetterExecuted = true;
        return 'src-official';
      },
    });
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      startingPitchers: {
        home: buildStartingPitcher({ sourceRefIds: srcRefsAccessorArr }),
        away: buildStartingPitcher(),
      },
    })).ok).toBe(false);
    expect(srcRefsGetterExecuted).toBe(false);

    // setter-only starter sourceRefIds array
    let srcRefsSetterExecuted = false;
    const srcRefsSetterArr: unknown[] = [];
    Object.defineProperty(srcRefsSetterArr, '0', {
      enumerable: true,
      configurable: true,
      set(_next: unknown) {
        srcRefsSetterExecuted = true;
      },
    });
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      startingPitchers: {
        home: buildStartingPitcher({ sourceRefIds: srcRefsSetterArr }),
        away: buildStartingPitcher(),
      },
    })).ok).toBe(false);
    expect(srcRefsSetterExecuted).toBe(false);
  });

  it('allows incomplete starter data and partial completeness', () => {
    const snapshot = buildValidSnapshot({
      startingPitchers: {
        home: { state: 'UNAVAILABLE' as const, pitcherId: null, announcedAt: null, sourceRefIds: [] },
        away: { state: 'UNAVAILABLE' as const, pitcherId: null, announcedAt: null, sourceRefIds: [] },
      },
      dataCompleteness: 'PARTIAL' as const,
    });

    expect(validateMLBCanonicalPregameSnapshot(snapshot)).toEqual(
      expect.objectContaining({ ok: true }),
    );

    const insufficient = buildValidSnapshot({ dataCompleteness: 'INSUFFICIENT' as const });
    expect(validateMLBCanonicalPregameSnapshot(insufficient)).toEqual(
      expect.objectContaining({ ok: true }),
    );
  });

  it('validates section entity consistency', () => {
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [
        buildSection({ entity: { scope: 'HOME_TEAM', entityId: 'other' } }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [
        buildSection({ entity: { scope: 'VENUE', entityId: 'other' } }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [
        buildSection({ entity: { scope: 'HOME_STARTER', entityId: 'other' } }),
      ],
    })).ok).toBe(false);

    // missing non-GAME entityId
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [
        buildSection({ entity: { scope: 'HOME_TEAM' } }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [
        buildSection({ entity: { scope: 'VENUE' } }),
      ],
    })).ok).toBe(false);

    // malformed prerequisites without throws
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      game: null,
      sections: [buildSection({ entity: { scope: 'HOME_TEAM', entityId: 'home-1' } })],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      game: [],
      sections: [buildSection({ entity: { scope: 'HOME_TEAM', entityId: 'home-1' } })],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      startingPitchers: null,
      sections: [buildSection({ entity: { scope: 'HOME_STARTER', entityId: 'p-1' } })],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      game: null,
      startingPitchers: null,
      sections: [buildSection({ entity: { scope: 'VENUE', entityId: 'venue-1' } })],
    })).ok).toBe(false);
  });

  it('rejects duplicate section IDs, unresolved sources, and unsorted arrays', () => {
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [
        buildSection({ sectionId: 'same' }),
        buildSection({ sectionId: 'same' }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [
        buildSection({ sourceRefIds: ['unknown'] }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sourceReferences: [
        buildSourceReference({ sourceRefId: 'z', roles: ['TEAM_STATS'] }),
        buildSourceReference({ sourceRefId: 'a', roles: ['GAME_IDENTITY'] }),
      ],
      sections: [
        buildSection({ sectionId: 'b', sourceRefIds: ['z', 'a'] }),
        buildSection({ sectionId: 'a', sourceRefIds: ['z'] }),
      ],
    })).ok).toBe(false);

    // strict sectionId
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [
        buildSection({ sectionId: '' }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [
        buildSection({ sectionId: ' sec-1' }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [
        buildSection({ sectionId: 'sec-1 ' }),
      ],
    })).ok).toBe(false);

    // missing section fields
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [
        buildSection({ kind: undefined }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [
        buildSection({ entity: undefined }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [
        buildSection({ status: undefined }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [
        buildSection({ asOfAt: undefined }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [
        buildSection({ sourceRefIds: undefined }),
      ],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [
        buildSection({ payload: undefined }),
      ],
    })).ok).toBe(false);

    // descriptor-safe sections array
    let secGetterExecuted = false;
    const secAccessorArr: unknown[] = [];
    Object.defineProperty(secAccessorArr, '0', {
      enumerable: true,
      configurable: true,
      get() {
        secGetterExecuted = true;
        return buildSection();
      },
    });
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: secAccessorArr,
    })).ok).toBe(false);
    expect(secGetterExecuted).toBe(false);

    // setter-only sections array
    let secSetterExecuted = false;
    const secSetterArr: unknown[] = [];
    Object.defineProperty(secSetterArr, '0', {
      enumerable: true,
      configurable: true,
      set(_next: unknown) {
        secSetterExecuted = true;
      },
    });
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: secSetterArr,
    })).ok).toBe(false);
    expect(secSetterExecuted).toBe(false);

    // descriptor-safe section sourceRefIds array
    let secSrcGetterExecuted = false;
    const secSrcAccessorArr: unknown[] = [];
    Object.defineProperty(secSrcAccessorArr, '0', {
      enumerable: true,
      configurable: true,
      get() {
        secSrcGetterExecuted = true;
        return 'src-official';
      },
    });
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [buildSection({ sourceRefIds: secSrcAccessorArr })],
    })).ok).toBe(false);
    expect(secSrcGetterExecuted).toBe(false);

    // setter-only section sourceRefIds array
    let secSrcSetterExecuted = false;
    const secSrcSetterArr: unknown[] = [];
    Object.defineProperty(secSrcSetterArr, '0', {
      enumerable: true,
      configurable: true,
      set(_next: unknown) {
        secSrcSetterExecuted = true;
      },
    });
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [buildSection({ sourceRefIds: secSrcSetterArr })],
    })).ok).toBe(false);
    expect(secSrcSetterExecuted).toBe(false);

    // symbol property on sections array
    const secSymbol = Symbol('sec');
    const secSymbolArr: unknown[] = [];
    Object.defineProperty(secSymbolArr, secSymbol, {
      enumerable: false,
      value: 'hidden',
    });
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: secSymbolArr,
    })).ok).toBe(false);

    // extra string property on sections array
    const secExtraArr: unknown[] = [];
    Object.defineProperty(secExtraArr, 'extra', {
      enumerable: true,
      value: 'x',
    });
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: secExtraArr,
    })).ok).toBe(false);
  });

  it('accepts safe JSON-like payloads and rejects non-plain JSON values and accessors', () => {
    const safePayload = {
      array: [1, 'str', null, { deeper: true }],
      number: 42,
      flag: true,
      emptyObject: {},
    };

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [buildSection({ payload: safePayload })],
    })).ok).toBe(true);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [buildSection({ payload: NaN })],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [buildSection({ payload: Infinity })],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [buildSection({ payload: BigInt(1) })],
    })).ok).toBe(false);

    const symbolKey = Symbol('payload-symbol');
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [buildSection({ payload: { [symbolKey]: 'hidden' } })],
    })).ok).toBe(false);

    let getterExecuted = false;
    const accessorPayload: Record<string, unknown> = {};
    Object.defineProperty(accessorPayload, 'safeField', {
      enumerable: true,
      get() {
        getterExecuted = true;
        return 'safe';
      },
    });
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [buildSection({ payload: accessorPayload })],
    })).ok).toBe(false);
    expect(getterExecuted).toBe(false);

    const map = new Map([['key', 'value']]);
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [buildSection({ payload: map })],
    })).ok).toBe(false);

    const set = new Set([1, 2]);
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [buildSection({ payload: set })],
    })).ok).toBe(false);

    class PayloadClass {}
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [buildSection({ payload: new PayloadClass() })],
    })).ok).toBe(false);

    const datePayload = new Date();
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [buildSection({ payload: datePayload })],
    })).ok).toBe(false);

    const cyclic: Record<string, unknown> = { nested: 'safe' };
    cyclic.self = cyclic;
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [buildSection({ payload: cyclic })],
    })).ok).toBe(false);

    const arr: unknown[] = [];
    const numericAccessorArr: unknown[] = [];
    let numericGetterExecuted = false;
    Object.defineProperty(numericAccessorArr, '0', {
      enumerable: true,
      configurable: true,
      get() {
        numericGetterExecuted = true;
        return { sportsbook: 'legacy' };
      },
    });
    const arrResult = validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [buildSection({ payload: arr })],
    }));
    expect(arrResult.ok).toBe(true);
    expect(numericGetterExecuted).toBe(false);

    let numericAccessorExecuted = false;
    const numericAccessorArr2: unknown[] = [];
    Object.defineProperty(numericAccessorArr2, '0', {
      enumerable: true,
      get() {
        numericAccessorExecuted = true;
        return { sportsbook: 'legacy' };
      },
    });
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [buildSection({ payload: numericAccessorArr2 })],
    })).ok).toBe(false);
    expect(numericAccessorExecuted).toBe(false);
  });

  it('rejects odds contamination deterministically', () => {
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [buildSection({ payload: { sportsbook: 'legacy' } })],
    })).ok).toBe(false);

    const nested = buildValidSnapshot({
      sections: [buildSection({ payload: { home: { marketImpliedProbability: 0.55 } } })],
    });
    const result = validateMLBCanonicalPregameSnapshot(nested);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'ODDS_CONTAMINATION' })]),
      );
    }
  });

  it('rejects provider-specific payload fields and accepts sport-data identifiers', () => {
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [buildSection({ payload: { rawResponse: 'x', requestEndpoint: '/schedule', apiKey: 'secret' } })],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [buildSection({ payload: { sourceGameId: 'g-1', sourceTeamId: 't-1' } })],
    })).ok).toBe(true);
  });

  it('rejects prediction-output concepts from payloads', () => {
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      sections: [buildSection({ payload: { modelProbability: 0.7, predictedWinner: 'HOME', stake: 100 } })],
    })).ok).toBe(false);
  });

  it('validates warning shape, order, and deterministic issue ordering without duplicates', () => {
    const warnings = [
      { code: 'A', path: '$.b', message: 'a msg' },
      { code: 'B', path: '$.a', message: 'b msg' },
    ];

    const result = validateMLBCanonicalPregameSnapshot(buildValidSnapshot({ warnings }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        expect.objectContaining({ code: 'NON_CANONICAL_ORDER', path: '$.warnings' }),
      ]);
    }

    // strict warning strings
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      warnings: [{ code: '', path: '$.a', message: 'msg' }],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      warnings: [{ code: ' A', path: '$.a', message: 'msg' }],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      warnings: [{ code: 'A ', path: '$.a', message: 'msg' }],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      warnings: [{ code: 'A', path: '', message: 'msg' }],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      warnings: [{ code: 'A', path: ' $.path', message: 'msg' }],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      warnings: [{ code: 'A', path: '$.path ', message: 'msg' }],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      warnings: [{ code: 'A', path: '$.a', message: '' }],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      warnings: [{ code: 'A', path: '$.a', message: ' msg' }],
    })).ok).toBe(false);

    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      warnings: [{ code: 'A', path: '$.a', message: 'msg ' }],
    })).ok).toBe(false);

    // malformed warnings are isolated from canonical ordering
    const malformedCases: { warnings: { code?: string; path?: string; message?: string }[]; expectedPath: string }[] = [
      { warnings: [{ code: '', path: '$.a', message: 'msg' }], expectedPath: '$.warnings[0].code' },
      { warnings: [{ code: ' A', path: '$.a', message: 'msg' }], expectedPath: '$.warnings[0].code' },
      { warnings: [{ code: 'A\u0000', path: '$.a', message: 'msg' }], expectedPath: '$.warnings[0].code' },
      { warnings: [{ code: 'A', path: 'no_dollar', message: 'msg' }], expectedPath: '$.warnings[0].path' },
      { warnings: [{ code: 'A', path: ' $.a', message: 'msg' }], expectedPath: '$.warnings[0].path' },
      { warnings: [{ code: 'A', path: '$.a\u0000', message: 'msg' }], expectedPath: '$.warnings[0].path' },
      { warnings: [{ code: 'A', path: '$.a', message: '' }], expectedPath: '$.warnings[0].message' },
      { warnings: [{ code: 'A', path: '$.a', message: ' msg' }], expectedPath: '$.warnings[0].message' },
      { warnings: [{ code: 'A', path: '$.a', message: 'msg\u0000' }], expectedPath: '$.warnings[0].message' },
    ];

    for (const malformedCase of malformedCases) {
      const result = validateMLBCanonicalPregameSnapshot(buildValidSnapshot({ warnings: malformedCase.warnings }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toContainEqual(
          expect.objectContaining({
            code: 'INVALID_STRING',
            path: malformedCase.expectedPath,
          }),
        );
        expect(result.issues).not.toContainEqual(
          expect.objectContaining({
            code: 'NON_CANONICAL_ORDER',
            path: '$.warnings',
          }),
        );
      }
    }

    // descriptor-safe warnings array
    let warnGetterExecuted = false;
    const warnAccessorArr: unknown[] = [];
    Object.defineProperty(warnAccessorArr, '0', {
      enumerable: true,
      configurable: true,
      get() {
        warnGetterExecuted = true;
        return { code: 'A', path: '$.a', message: 'msg' };
      },
    });
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      warnings: warnAccessorArr,
    })).ok).toBe(false);
    expect(warnGetterExecuted).toBe(false);

    // setter-only warnings array
    let warnSetterExecuted = false;
    const warnSetterArr: unknown[] = [];
    Object.defineProperty(warnSetterArr, '0', {
      enumerable: true,
      configurable: true,
      set(_next: unknown) {
        warnSetterExecuted = true;
      },
    });
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      warnings: warnSetterArr,
    })).ok).toBe(false);
    expect(warnSetterExecuted).toBe(false);

    // symbol property on warnings array
    const warnSymbol = Symbol('warn');
    const warnSymbolArr: unknown[] = [];
    Object.defineProperty(warnSymbolArr, warnSymbol, {
      enumerable: false,
      value: 'hidden',
    });
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({
      warnings: warnSymbolArr,
    })).ok).toBe(false);

    // ordering by path then code then message
    // same path, same code, ascending message -> valid
    const msgAscWarnings = [
      { code: 'A', path: '$.a', message: 'alpha' },
      { code: 'A', path: '$.a', message: 'beta' },
    ];
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({ warnings: msgAscWarnings })).ok).toBe(true);

    // same path, same code, descending message -> invalid
    const msgDescWarnings = [
      { code: 'A', path: '$.a', message: 'beta' },
      { code: 'A', path: '$.a', message: 'alpha' },
    ];
    const msgDescResult = validateMLBCanonicalPregameSnapshot(buildValidSnapshot({ warnings: msgDescWarnings }));
    expect(msgDescResult.ok).toBe(false);
    if (!msgDescResult.ok) {
      expect(msgDescResult.issues).toEqual([
        expect.objectContaining({ code: 'NON_CANONICAL_ORDER', path: '$.warnings' }),
      ]);
    }

    // path is compared first, code second
    const pathCodeWarnings = [
      { code: 'B', path: '$.b', message: 'msg' },
      { code: 'A', path: '$.a', message: 'msg' },
    ];
    expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot({ warnings: pathCodeWarnings })).ok).toBe(false);

    // duplicate path/code with different messages is valid
    const dupWarnings = [
      { code: 'A', path: '$.a', message: 'first' },
      { code: 'A', path: '$.a', message: 'second' },
      { code: 'B', path: '$.a', message: 'a' },
    ];
    const dupResult = validateMLBCanonicalPregameSnapshot(buildValidSnapshot({ warnings: dupWarnings }));
    expect(dupResult.ok).toBe(true);

    // final issue deduplication and ordering
    const complexSnapshot = buildValidSnapshot({
      game: { ...(buildGame() as Record<string, unknown>), gameId: 'game-1', season: 2026 },
      sourceReferences: [
        buildSourceReference({ sourceRefId: 'z' }),
        buildSourceReference({ sourceRefId: 'a' }),
      ],
      sections: [
        buildSection({ sectionId: 'b' }),
        buildSection({ sectionId: 'a' }),
      ],
      warnings: [
        { code: 'B', path: '$.a', message: 'b' },
        { code: 'A', path: '$.a', message: 'a' },
      ],
    });
    const complexResult = validateMLBCanonicalPregameSnapshot(complexSnapshot);
    expect(complexResult.ok).toBe(false);
    if (complexResult.ok) {
      throw new Error('expected complex snapshot to fail');
    }
    const keys = complexResult.issues.map(
      ({ path, code }) => `${path}\u0000${code}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
    const paths = complexResult.issues.map((issue) => issue.path);
    expect(paths).toEqual([...paths].sort((a, b) => (a < b ? -1 : a === b ? 0 : 1)));
  });

  it('verifies the static architecture boundary of mlb-pregame-snapshot-contract.ts', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const sourcePath = path.join(process.cwd(), 'src/prediction/mlb/mlb-pregame-snapshot-contract.ts');
    const source = fs.readFileSync(sourcePath, 'utf8');

    const imports = Array.from(source.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g))
      .map((match) => match[1]);

    expect(imports).toEqual(['../firewall/odds-contamination-guard']);

    const forbiddenPatterns = [
      /mlb-prediction-contract/,
      /prospective/,
      /backtesting/,
      /research-data/,
      /server/,
      /app\b/,
      /@prisma\/client/,
      /readFileSync/,
      /writeFileSync/,
      /fetch\(/,
      /process\.env/,
      /Math\.random/,
      /Date\.now/,
      /randomUUID/,
    ];

    for (const pattern of forbiddenPatterns) {
      expect(source).not.toMatch(pattern);
    }

    const publicPatterns = [
      /export class/,
      /export interface OddsContamination/,
      /export function isProhibitedOddsKey/,
      /export function assertNoOddsContamination/,
    ];

    let phase8BPublicExposure = false;
    for (const pattern of publicPatterns) {
      if (pattern.test(source)) {
        phase8BPublicExposure = true;
        break;
      }
    }
    expect(phase8BPublicExposure).toBe(false);

    // exact game-status union
    const statusMatch = source.match(/export type MLBPregameGameStatus\s*=\s*([\s\S]*?);/);
    expect(statusMatch).not.toBeNull();
    if (statusMatch) {
      const values = statusMatch[1].match(/'([^']+)'/g);
      expect(values).toEqual(["'SCHEDULED'", "'PRE_GAME'", "'POSTPONED'", "'CANCELLED'", "'UNKNOWN'"]);
    }
  });
});
