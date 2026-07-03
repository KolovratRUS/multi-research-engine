import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';

import { capturePregamePitcherObservations } from '@/lib/backtesting/mlb/live-history/pregame-pitcher-observation-capture';
import { createMLBPregamePitcherObservationStore } from '@/lib/backtesting/mlb/live-history/pregame-pitcher-observation-store';
import { createPregamePitcherObservationWriter } from '@/lib/backtesting/mlb/live-history/pregame-pitcher-observation-writer';
import type { PregamePitcherObservationWriter } from '@/lib/backtesting/mlb/live-history/pregame-pitcher-observation-store';
import type { CanonicalHistoricalScheduleGame } from '@/lib/backtesting/mlb/live-history/types';

function canonicalGame(overrides: Partial<CanonicalHistoricalScheduleGame> = {}): CanonicalHistoricalScheduleGame {
  const scheduledStart = new Date('2024-06-01T16:20:00Z');
  return {
    gamePk: 7000,
    officialDate: '2024-06-01',
    status: 'FINAL',
    scheduledStart,
    cutoffTime: new Date('2024-06-01T16:00:00Z'),
    homeTeamId: 111,
    awayTeamId: 222,
    homeTeamName: 'Home',
    awayTeamName: 'Away',
    venueId: 1,
    venueName: 'Field',
    doubleheader: false,
    gameNumber: 1,
    scheduledInnings: 9,
    homeProbablePitcherId: 10,
    awayProbablePitcherId: 20,
    homeStarterSource: 'SCHEDULE_PROBABLE_BEFORE_CUTOFF',
    awayStarterSource: 'SCHEDULE_PROBABLE_BEFORE_CUTOFF',
    rescheduledFromGamePk: null,
    warnings: [],
    provenance: {
      endpoint: '/api/v1/schedule',
      fetchedAt: new Date('2024-06-01T12:00:00Z'),
      sourceTimestamp: new Date('2024-06-01T12:00:00Z'),
    },
    ...overrides,
  };
}

describe('capturePregamePitcherObservations', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-capture-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempRoot, { recursive: true, force: true });
    } catch {
      // already removed on test failures via fs.mkdtemp cleanup
    }
  });

  function buildCapturePair(now: () => Date = () => new Date('2024-06-01T16:20:00Z')): {
    readonly store: ReturnType<typeof createMLBPregamePitcherObservationStore>;
    readonly writer: PregamePitcherObservationWriter;
  } {
    const store = createMLBPregamePitcherObservationStore(tempRoot, now);
    const writer = createPregamePitcherObservationWriter({ store, now });
    return { store, writer };
  }

  it('records one observation for one game', async () => {
    const { writer } = buildCapturePair();
    const games = [canonicalGame()];
    const result = await capturePregamePitcherObservations({
      writer,
      games,
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { sportId: 1 },
    });

    expect(result.observationsConsidered).toBe(1);
    expect(result.observationsWritten).toBe(1);
    expect(result.exactDuplicatesSkipped).toBe(0);
    expect(result.retrospectiveWritesBlocked).toBe(0);
    expect(result.corruptRecords).toBe(0);
    expect(result.warnings).toEqual([]);

    const files = await fs.readdir(
      path.join(tempRoot, 'pregame-pitcher-observations', 'mlb', '7000'),
    );
    expect(files).toHaveLength(1);
  });

  it('records one observation per game for multiple games', async () => {
    const { writer } = buildCapturePair();
    const games = [canonicalGame({ gamePk: 7000 }), canonicalGame({ gamePk: 7001 })];
    const result = await capturePregamePitcherObservations({
      writer,
      games,
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { sportId: 1 },
    });

    expect(result.observationsConsidered).toBe(2);
    expect(result.observationsWritten).toBe(2);
    expect(result.exactDuplicatesSkipped).toBe(0);
    expect(result.corruptRecords).toBe(0);

    const p7000 = await fs.readdir(
      path.join(tempRoot, 'pregame-pitcher-observations', 'mlb', '7000'),
    );
    const p7001 = await fs.readdir(
      path.join(tempRoot, 'pregame-pitcher-observations', 'mlb', '7001'),
    );
    expect(p7000).toHaveLength(1);
    expect(p7001).toHaveLength(1);
  });

  it('retains null probable pitcher ids', async () => {
    const { writer } = buildCapturePair();
    const games = [canonicalGame({ homeProbablePitcherId: null, awayProbablePitcherId: null })];
    const result = await capturePregamePitcherObservations({
      writer,
      games,
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { sportId: 1 },
    });

    expect(result.observationsConsidered).toBe(1);
    expect(result.observationsWritten).toBe(1);
    expect(result.corruptRecords).toBe(0);

    const store = buildCapturePair().store;
    const records = await store.listForGame(7000);
    expect(records).toHaveLength(1);
    expect(records[0].homeProbablePitcherId).toBeNull();
    expect(records[0].awayProbablePitcherId).toBeNull();
  });

  it('uses a shared observedAt for a batch', async () => {
    const fixedNow = new Date('2024-06-01T16:20:00Z');
    const { writer, store } = buildCapturePair(() => fixedNow);
    const games = [canonicalGame({ gamePk: 7000 }), canonicalGame({ gamePk: 7001 })];
    await capturePregamePitcherObservations({
      writer,
      games,
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { sportId: 1 },
    });

    const record7000 = await store.listForGame(7000);
    const record7001 = await store.listForGame(7001);
    expect(record7000).toHaveLength(1);
    expect(record7001).toHaveLength(1);
    expect(record7000[0].observedAt.getTime()).toBe(fixedNow.getTime());
    expect(record7001[0].observedAt.getTime()).toBe(fixedNow.getTime());
  });

  it('skips exact duplicates on identical capture', async () => {
    const fixedNow = new Date('2024-06-01T16:20:00Z');
    const { writer } = buildCapturePair(() => fixedNow);
    const games = [canonicalGame({ gamePk: 7000 })];

    const first = await capturePregamePitcherObservations({
      writer,
      games,
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { sportId: 1 },
    });

    const second = await capturePregamePitcherObservations({
      writer,
      games,
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { sportId: 1 },
    });

    expect(first.observationsWritten).toBe(1);
    expect(first.exactDuplicatesSkipped).toBe(0);
    expect(first.observationsConsidered).toBe(1);

    expect(second.observationsWritten).toBe(0);
    expect(second.exactDuplicatesSkipped).toBe(1);
    expect(second.observationsConsidered).toBe(1);
    expect(second.corruptRecords).toBe(0);
  });

  it('returns zeroed result for empty games', async () => {
    const { writer } = buildCapturePair();
    const result = await capturePregamePitcherObservations({
      writer,
      games: [],
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { sportId: 1 },
    });

    expect(result).toEqual({
      enabled: true,
      observationsConsidered: 0,
      observationsWritten: 0,
      exactDuplicatesSkipped: 0,
      retrospectiveWritesBlocked: 0,
      corruptRecords: 0,
      warnings: [],
    });
  });

  it('records the source endpoint and request parameters', async () => {
    const { writer } = buildCapturePair();
    const games = [canonicalGame()];
    await capturePregamePitcherObservations({
      writer,
      games,
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { sportId: 1, hydrate: 'probablePitcher,venue' },
    });

    const store = buildCapturePair().store;
    const records = await store.listForGame(7000);
    expect(records).toHaveLength(1);
    expect(records[0].sourceEndpoint).toBe('/api/v1/schedule');
    expect(records[0].sourceRequestParameters).toEqual({ sportId: 1, hydrate: 'probablePitcher,venue' });
  });

  it('records for games with warnings retained', async () => {
    const { writer } = buildCapturePair();
    const games = [canonicalGame({ warnings: ['missing pitcher name'] })];
    const result = await capturePregamePitcherObservations({
      writer,
      games,
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { sportId: 1 },
    });

    expect(result.warnings).toEqual(['missing pitcher name']);

    const store = buildCapturePair().store;
    const records = await store.listForGame(7000);
    expect(records).toHaveLength(1);
    expect(records[0].warnings).toEqual(['missing pitcher name']);
  });

  it('sets context to PROSPECTIVE_LIVE', async () => {
    const { writer } = buildCapturePair();
    const games = [canonicalGame()];
    await capturePregamePitcherObservations({
      writer,
      games,
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { sportId: 1 },
    });

    const store = buildCapturePair().store;
    const records = await store.listForGame(7000);
    expect(records).toHaveLength(1);
    expect(records[0].observationContext).toBe('PROSPECTIVE_LIVE');
  });

  it('reports corrupt records for malformed writer inputs', async () => {
    const { writer } = buildCapturePair();
    const games = [canonicalGame({ gamePk: NaN })];
    const result = await capturePregamePitcherObservations({
      writer,
      games,
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { sportId: 1 },
    });

    expect(result.observationsConsidered).toBe(1);
    expect(result.corruptRecords).toBe(1);
    expect(result.observationsWritten).toBe(0);
    expect(result.exactDuplicatesSkipped).toBe(0);
  });
});
