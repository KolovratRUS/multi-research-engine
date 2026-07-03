import { describe, it, expect } from 'vitest';
import type { PregamePitcherObservationStore, AppendObservationResult, PregamePitcherObservationWriter } from '@/lib/backtesting/mlb/live-history/pregame-pitcher-observation-store';
import { buildObservationResponseHash } from '@/lib/backtesting/mlb/live-history/pregame-pitcher-observation-store';
import { createPregamePitcherObservationWriter } from '@/lib/backtesting/mlb/live-history/pregame-pitcher-observation-writer';

function createMockStore(overrides: {
  appendResults?: AppendObservationResult[];
} = {}): PregamePitcherObservationStore & { appendCalls: Array<{ observation: unknown }> } {
  const appendCalls: Array<{ observation: unknown }> = [];
  const results: AppendObservationResult[] = overrides.appendResults ?? [];

  const store: PregamePitcherObservationStore = {
    async append(observation) {
      appendCalls.push({ observation });
      const next = results.shift();
      return next ?? {
        observationsConsidered: 1,
        observationsWritten: 0,
        exactDuplicatesSkipped: 0,
        retrospectiveWritesBlocked: 0,
        corruptRecords: 0,
        eligibleSelectionHits: 0,
        eligibleSelectionMisses: 0,
        warnings: [],
      };
    },
    async listForGame() {
      return [];
    },
    async findLatestEligible() {
      return null;
    },
  };

  return Object.assign(store, { appendCalls });
}

function makeGame(overrides: {
  gamePk?: number;
  scheduledStart?: Date;
  homeTeamId?: number;
  awayTeamId?: number;
  homeProbablePitcherId?: number | null;
  awayProbablePitcherId?: number | null;
  warnings?: readonly string[];
} = {}) {
  return {
    gamePk: overrides.gamePk ?? 1001,
    scheduledStart: overrides.scheduledStart ?? new Date('2024-06-01T18:30:00Z'),
    homeTeamId: overrides.homeTeamId ?? 1,
    awayTeamId: overrides.awayTeamId ?? 2,
    homeProbablePitcherId: overrides.homeProbablePitcherId ?? 5001,
    awayProbablePitcherId: overrides.awayProbablePitcherId ?? 5002,
    warnings: overrides.warnings ?? [],
  };
}

describe('createPregamePitcherObservationWriter', () => {
  it('writes every prospective game', async () => {
    const store = createMockStore({
      appendResults: [
        { observationsConsidered: 1, observationsWritten: 1, exactDuplicatesSkipped: 0, retrospectiveWritesBlocked: 0, corruptRecords: 0, eligibleSelectionHits: 0, eligibleSelectionMisses: 0, warnings: [] },
        { observationsConsidered: 1, observationsWritten: 1, exactDuplicatesSkipped: 0, retrospectiveWritesBlocked: 0, corruptRecords: 0, eligibleSelectionHits: 0, eligibleSelectionMisses: 0, warnings: [] },
      ],
    });
    const writer = createPregamePitcherObservationWriter({ store, now: () => new Date('2024-06-01T12:00:00Z') });
    const result = await writer.recordProspectivePitcherObservations({
      games: [makeGame(), makeGame({ gamePk: 2002 })],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { sportId: 1 },
    });
    expect(store.appendCalls).toHaveLength(2);
    expect(result.observationsWritten).toBe(2);
  });

  it('blocks retrospective context writes', async () => {
    const store = createMockStore();
    const writer = createPregamePitcherObservationWriter({ store, now: () => new Date('2024-06-01T12:00:00Z') });
    const result = await writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'RETROSPECTIVE_BACKTEST',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { sportId: 1 },
    });
    expect(store.appendCalls).toHaveLength(0);
    expect(result.retrospectiveWritesBlocked).toBe(1);
    expect(result.observationsWritten).toBe(0);
  });

  it('blocks retrospective writes even with multiple games', async () => {
    const store = createMockStore();
    const writer = createPregamePitcherObservationWriter({ store, now: () => new Date('2024-06-01T12:00:00Z') });
    const result = await writer.recordProspectivePitcherObservations({
      games: [makeGame(), makeGame({ gamePk: 2002 })],
      context: 'RETROSPECTIVE_BACKTEST',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { sportId: 1 },
    });
    expect(result.retrospectiveWritesBlocked).toBe(2);
  });

  it('uses injected clock exactly once per batch', async () => {
    const nowCalls: Date[] = [];
    const store = createMockStore({
      appendResults: [
        { observationsConsidered: 1, observationsWritten: 1, exactDuplicatesSkipped: 0, retrospectiveWritesBlocked: 0, corruptRecords: 0, eligibleSelectionHits: 0, eligibleSelectionMisses: 0, warnings: [] },
      ],
    });
    const writer = createPregamePitcherObservationWriter({
      store,
      now: () => {
        nowCalls.push(new Date());
        return nowCalls[nowCalls.length - 1];
      },
    });
    await writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { sportId: 1 },
    });
    expect(nowCalls).toHaveLength(1);
  });

  it('skips clock for retrospective batch', async () => {
    const nowCalls: Date[] = [];
    const store = createMockStore();
    const writer = createPregamePitcherObservationWriter({
      store,
      now: () => {
        nowCalls.push(new Date());
        return nowCalls[nowCalls.length - 1];
      },
    });
    await writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'RETROSPECTIVE_BACKTEST',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { sportId: 1 },
    });
    expect(nowCalls).toHaveLength(0);
  });

  it('uses same observedAt for all batch records', async () => {
    const store = createMockStore({
      appendResults: [
        { observationsConsidered: 1, observationsWritten: 1, exactDuplicatesSkipped: 0, retrospectiveWritesBlocked: 0, corruptRecords: 0, eligibleSelectionHits: 0, eligibleSelectionMisses: 0, warnings: [] },
        { observationsConsidered: 1, observationsWritten: 1, exactDuplicatesSkipped: 0, retrospectiveWritesBlocked: 0, corruptRecords: 0, eligibleSelectionHits: 0, eligibleSelectionMisses: 0, warnings: [] },
      ],
    });
    const fixedNow = new Date('2024-06-01T12:00:00Z');
    const writer = createPregamePitcherObservationWriter({ store, now: () => fixedNow });
    await writer.recordProspectivePitcherObservations({
      games: [makeGame(), makeGame({ gamePk: 2002 })],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { sportId: 1 },
    });
    const observedAts = store.appendCalls.map((call) => (call.observation as { observedAt: Date }).observedAt.getTime());
    expect(observedAts).toHaveLength(2);
    expect(observedAts[0]).toBe(observedAts[1]);
  });

  it('preserves null pitcher IDs', async () => {
    const store = createMockStore({
      appendResults: [
        { observationsConsidered: 1, observationsWritten: 1, exactDuplicatesSkipped: 0, retrospectiveWritesBlocked: 0, corruptRecords: 0, eligibleSelectionHits: 0, eligibleSelectionMisses: 0, warnings: [] },
      ],
    });
    const writer = createPregamePitcherObservationWriter({ store, now: () => new Date('2024-06-01T12:00:00Z') });
    await writer.recordProspectivePitcherObservations({
      games: [makeGame({ homeProbablePitcherId: null, awayProbablePitcherId: null, warnings: ['missing_home_probable_pitcher'] })],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { sportId: 1 },
    });
    expect(store.appendCalls).toHaveLength(1);
  });

  it('sanitizes sensitive request parameters', async () => {
    const store = createMockStore({
      appendResults: [
        { observationsConsidered: 1, observationsWritten: 1, exactDuplicatesSkipped: 0, retrospectiveWritesBlocked: 0, corruptRecords: 0, eligibleSelectionHits: 0, eligibleSelectionMisses: 0, warnings: [] },
      ],
    });
    const writer = createPregamePitcherObservationWriter({ store, now: () => new Date('2024-06-01T12:00:00Z') });
    await writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { sportId: 1, token: 'secret' },
    });
    const appended = store.appendCalls[0]?.observation as { sourceRequestParameters: Record<string, unknown> } | undefined;
    expect(appended?.sourceRequestParameters['token']).toBeUndefined();
    expect(appended?.sourceRequestParameters['sportId']).toBe(1);
  });

  it('uses SCHEDULE_PROBABLE_OBSERVED_AT provenance', async () => {
    const store = createMockStore({
      appendResults: [
        { observationsConsidered: 1, observationsWritten: 1, exactDuplicatesSkipped: 0, retrospectiveWritesBlocked: 0, corruptRecords: 0, eligibleSelectionHits: 0, eligibleSelectionMisses: 0, warnings: [] },
      ],
    });
    const writer = createPregamePitcherObservationWriter({ store, now: () => new Date('2024-06-01T12:00:00Z') });
    await writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: {},
    });
    const appended = store.appendCalls[0]?.observation as { provenance: string } | undefined;
    expect(appended?.provenance).toBe('SCHEDULE_PROBABLE_OBSERVED_AT');
  });

  it('uses injected clock for observedAt', async () => {
    const store = createMockStore({
      appendResults: [
        { observationsConsidered: 1, observationsWritten: 1, exactDuplicatesSkipped: 0, retrospectiveWritesBlocked: 0, corruptRecords: 0, eligibleSelectionHits: 0, eligibleSelectionMisses: 0, warnings: [] },
      ],
    });
    const fixedNow = new Date('2024-06-01T08:00:00Z');
    const writer = createPregamePitcherObservationWriter({ store, now: () => fixedNow });
    await writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: {},
    });
    const appended = store.appendCalls[0]?.observation as { observedAt: Date } | undefined;
    expect(appended?.observedAt.getTime()).toBe(fixedNow.getTime());
  });

  it('rejects invalid clock result for a prospective batch', async () => {
    const store = createMockStore();
    const writer = createPregamePitcherObservationWriter({
      store,
      now: () => new Date(NaN),
    });
    const result = await writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { sportId: 1 },
    });
    expect(result.corruptRecords).toBe(1);
    expect(store.appendCalls).toHaveLength(0);
  });

  it('does not mutate game inputs', async () => {
    const store = createMockStore({
      appendResults: [
        { observationsConsidered: 1, observationsWritten: 1, exactDuplicatesSkipped: 0, retrospectiveWritesBlocked: 0, corruptRecords: 0, eligibleSelectionHits: 0, eligibleSelectionMisses: 0, warnings: [] },
      ],
    });
    const input = makeGame({ warnings: ['batch-input'] });
    const warningsBefore = [...input.warnings];
    const writer = createPregamePitcherObservationWriter({ store, now: () => new Date('2024-06-01T12:00:00Z') });
    await writer.recordProspectivePitcherObservations({
      games: [input],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: {},
    });
    expect(input.warnings).toEqual(warningsBefore);
  });

  it('rejects unsupported request parameter types', async () => {
    const store = createMockStore();
    const writer = createPregamePitcherObservationWriter({ store, now: () => new Date('2024-06-01T12:00:00Z') });
    await expect(writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { date: new Date() },
    })).rejects.toThrow();
    await expect(writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { map: new Map() },
    })).rejects.toThrow();
    await expect(writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { set: new Set() },
    })).rejects.toThrow();
    await expect(writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { fn: () => {} },
    })).rejects.toThrow();
    await expect(writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { undef: undefined },
    })).rejects.toThrow();
  });

  it('rejects non-plain top-level sourceRequestParameters', async () => {
    const store = createMockStore();
    const writer = createPregamePitcherObservationWriter({ store, now: () => new Date('2024-06-01T12:00:00Z') });
    await expect(writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: [],
    })).rejects.toThrow();
    await expect(writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: new Date(),
    })).rejects.toThrow();
    await expect(writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: new Map(),
    })).rejects.toThrow();
    await expect(writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: new Set(),
    })).rejects.toThrow();
    class CustomParams {}
    await expect(writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: new CustomParams(),
    })).rejects.toThrow();
  });

  it('accepts array-valued request parameters', async () => {
    const store = createMockStore({
      appendResults: [
        { observationsConsidered: 1, observationsWritten: 1, exactDuplicatesSkipped: 0, retrospectiveWritesBlocked: 0, corruptRecords: 0, eligibleSelectionHits: 0, eligibleSelectionMisses: 0, warnings: [] },
      ],
    });
    const writer = createPregamePitcherObservationWriter({ store, now: () => new Date('2024-06-01T12:00:00Z') });
    await writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { fields: ['a', 'b'] },
    });
    expect(store.appendCalls).toHaveLength(1);
    const appended = store.appendCalls[0]?.observation as { sourceRequestParameters: Record<string, unknown> } | undefined;
    expect(appended?.sourceRequestParameters['fields']).toEqual(['a', 'b']);
  });

  it('accepts nested arrays in request parameters', async () => {
    const store = createMockStore({
      appendResults: [
        { observationsConsidered: 1, observationsWritten: 1, exactDuplicatesSkipped: 0, retrospectiveWritesBlocked: 0, corruptRecords: 0, eligibleSelectionHits: 0, eligibleSelectionMisses: 0, warnings: [] },
      ],
    });
    const writer = createPregamePitcherObservationWriter({ store, now: () => new Date('2024-06-01T12:00:00Z') });
    await writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { filters: { teams: [1, 2], modes: ['home', 'away'] } },
    });
    expect(store.appendCalls).toHaveLength(1);
    const appended = store.appendCalls[0]?.observation as { sourceRequestParameters: Record<string, unknown> } | undefined;
    expect(appended?.sourceRequestParameters['filters']).toEqual({ teams: [1, 2], modes: ['home', 'away'] });
  });

  it('preserves array order divergence in hash', async () => {
    const base = {
      gamePk: 1001,
      scheduledStart: new Date('2024-06-01T18:30:00Z'),
      homeTeamId: 1,
      awayTeamId: 2,
      homeProbablePitcherId: 5001,
      awayProbablePitcherId: 5002,
      sourceEndpoint: '/api/v1/schedule',
      observationContext: 'PROSPECTIVE_LIVE' as const,
      provenance: 'SCHEDULE_PROBABLE_OBSERVED_AT' as const,
    };
    const first = buildObservationResponseHash({ ...base, sourceRequestParameters: { fields: ['a', 'b'] } });
    const second = buildObservationResponseHash({ ...base, sourceRequestParameters: { fields: ['b', 'a'] } });
    expect(first).not.toBe(second);
  });

  it('rejects arrays containing unsupported values', async () => {
    const store = createMockStore();
    const writer = createPregamePitcherObservationWriter({ store, now: () => new Date('2024-06-01T12:00:00Z') });
    await expect(writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { fields: [undefined] },
    })).rejects.toThrow();
    await expect(writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { fields: [new Date()] },
    })).rejects.toThrow();
    await expect(writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { fields: [NaN] },
    })).rejects.toThrow();
  });

  it('rejects cyclic request parameters', async () => {
    const store = createMockStore();
    const writer = createPregamePitcherObservationWriter({ store, now: () => new Date('2024-06-01T12:00:00Z') });
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    await expect(writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: cyclic,
    })).rejects.toThrow();
  });

  it('does not mutate input request parameters', async () => {
    const store = createMockStore({
      appendResults: [
        { observationsConsidered: 1, observationsWritten: 1, exactDuplicatesSkipped: 0, retrospectiveWritesBlocked: 0, corruptRecords: 0, eligibleSelectionHits: 0, eligibleSelectionMisses: 0, warnings: [] },
      ],
    });
    const writer = createPregamePitcherObservationWriter({ store, now: () => new Date('2024-06-01T12:00:00Z') });
    const params = { fields: ['a', 'b'] };
    const original = [...(params.fields as string[])];
    await writer.recordProspectivePitcherObservations({
      games: [makeGame()],
      context: 'PROSPECTIVE_LIVE',
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: params,
    });
    expect((params.fields as string[])).toEqual(original);
  });
});
