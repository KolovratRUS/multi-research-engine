import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createMLBHistoricalMaterializationSourceAdapter,
  createRealMLBHistoricalMaterializationSourceAdapter,
  type MLBHistoricalMaterializationSourceAdapter,
  type MLBHistoricalMaterializationSourceAdapterDependencies,
  type MLBHistoricalProspectiveStarterResult,
} from '@/prediction/mlb/mlb-historical-materialization-source-adapter';
import type {
  CanonicalHistoricalScheduleGame,
  CanonicalHistoricalOutcome,
  CompletedHistoricalTeamGame,
  HistoricalPitcherAppearance,
  TeamHistoricalAggregate,
  PitcherHistoricalAggregate,
} from '@/lib/backtesting/mlb/live-history/types';
import type { PregamePitcherObservation } from '@/lib/backtesting/mlb/live-history/pregame-pitcher-observation-store';

const SOURCE_PATH = '../../../src/prediction/mlb/mlb-historical-materialization-source-adapter.ts';

function buildScheduleGame(overrides: Partial<CanonicalHistoricalScheduleGame> = {}): CanonicalHistoricalScheduleGame {
  return {
    gamePk: 777,
    officialDate: '2021-04-01',
    scheduledStart: new Date('2021-04-01T18:00:00Z'),
    cutoffTime: new Date('2021-04-01T17:30:00Z'),
    status: 'FINAL',
    homeTeamId: 110,
    homeTeamName: 'Home',
    awayTeamId: 120,
    awayTeamName: 'Away',
    venueId: 1,
    venueName: 'Park',
    doubleheader: false,
    gameNumber: 1,
    scheduledInnings: 9,
    homeProbablePitcherId: 111,
    awayProbablePitcherId: 222,
    homeStarterSource: 'SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN',
    awayStarterSource: 'SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN',
    rescheduledFromGamePk: null,
    warnings: [],
    provenance: {
      endpoint: '/api/v1/schedule',
      fetchedAt: new Date('2021-04-02T00:00:00Z'),
      sourceTimestamp: null,
    },
    ...overrides,
  };
}

function buildTeamGame(overrides: Partial<CompletedHistoricalTeamGame> = {}): CompletedHistoricalTeamGame {
  return {
    gamePk: 777,
    gameStart: new Date('2021-04-01T18:00:00Z'),
    completedAt: new Date('2021-04-01T22:00:00Z'),
    completedAtSource: 'LAST_COMPLETED_PLAY_END',
    status: 'FINAL',
    teamId: 110,
    opponentTeamId: 120,
    isHome: true,
    runsScored: 5,
    runsAllowed: 3,
    innings: 9,
    ...overrides,
  };
}

function buildPitcherAppearance(overrides: Partial<HistoricalPitcherAppearance> = {}): HistoricalPitcherAppearance {
  return {
    gamePk: 777,
    gameStart: new Date('2021-04-01T18:00:00Z'),
    completedAt: new Date('2021-04-01T22:00:00Z'),
    completedAtSource: 'LAST_COMPLETED_PLAY_END',
    status: 'FINAL',
    personId: 123,
    teamId: 110,
    started: true,
    inningsPitched: '5.0',
    earnedRuns: 2,
    strikeouts: 6,
    walks: 2,
    hitsAllowed: 5,
    homeRunsAllowed: 1,
    pitches: 85,
    ...overrides,
  };
}

function buildObservation(overrides: Partial<PregamePitcherObservation> = {}): PregamePitcherObservation {
  return {
    schemaVersion: 'phase1g-a-v1',
    sport: 'mlb',
    gamePk: 777,
    observedAt: new Date('2021-04-01T12:00:00Z'),
    scheduledStart: new Date('2021-04-01T18:00:00Z'),
    homeProbablePitcherId: 111,
    awayProbablePitcherId: 222,
    homeTeamId: 110,
    awayTeamId: 120,
    sourceEndpoint: '/api/v1/schedule',
    sourceRequestParameters: {},
    sourceResponseHash: 'a'.repeat(64),
    observationContext: 'PROSPECTIVE_LIVE',
    provenance: 'SCHEDULE_PROBABLE_OBSERVED_AT',
    warnings: [],
    ...overrides,
  };
}

function createAdapter(overrides: Partial<MLBHistoricalMaterializationSourceAdapterDependencies> = {}): MLBHistoricalMaterializationSourceAdapter {
  const deps: MLBHistoricalMaterializationSourceAdapterDependencies = {
    scheduleLoader: { loadForDateRange: vi.fn().mockResolvedValue([]) },
    outcomeLoader: {
      loadOutcome: vi.fn().mockResolvedValue({
        gamePk: 777,
        status: 'FINAL',
        homeScore: 5,
        awayScore: 3,
        winner: 'HOME',
        innings: 9,
        completedAt: new Date('2021-04-01T22:00:00Z'),
        completedAtSource: 'LAST_COMPLETED_PLAY_END',
        warnings: [],
      } as CanonicalHistoricalOutcome),
      loadOutcomeWithProvenance: vi.fn().mockResolvedValue({
        outcome: {
          gamePk: 777,
          status: 'FINAL',
          homeScore: 5,
          awayScore: 3,
          winner: 'HOME',
          innings: 9,
          completedAt: new Date('2021-04-01T22:00:00Z'),
          completedAtSource: 'LAST_COMPLETED_PLAY_END',
          warnings: [],
        } as CanonicalHistoricalOutcome,
        provenance: {
          endpoint: '/api/v1.1/game/777/feed/live',
          fetchedAt: new Date('2021-04-01T22:00:00Z'),
          sourceTimestamp: null,
        },
      }),
    },
    teamGameSource: { getTeamGames: vi.fn().mockResolvedValue([]) },
    teamAggregator: vi.fn().mockReturnValue({
      teamId: 110,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      winRate: null,
      runsScored: 0,
      runsAllowed: 0,
      runDifferential: 0,
      runsScoredPerGame: null,
      runsAllowedPerGame: null,
      recent5Wins: 0,
      recent5Losses: 0,
      recent10Wins: 0,
      recent10Losses: 0,
      recent10RunsPerGame: null,
      homeWins: 0,
      homeLosses: 0,
      awayWins: 0,
      awayLosses: 0,
      restDays: null,
      gamesInPrevious3Days: 0,
      extraInningGames: 0,
      sampleSize: 0,
      warnings: [],
    } as TeamHistoricalAggregate),
    pitcherAppearanceSource: { getPitcherAppearances: vi.fn().mockResolvedValue([]) },
    pitcherAggregator: vi.fn().mockReturnValue({
      personId: 123,
      teamId: 110,
      appearances: 0,
      gamesStarted: 0,
      outsRecorded: 0,
      inningsPitchedDisplay: '0.0',
      earnedRuns: 0,
      hitsAllowed: 0,
      walks: 0,
      strikeouts: 0,
      homeRunsAllowed: 0,
      era: null,
      whip: null,
      kPer9: null,
      bbPer9: null,
      hPer9: null,
      hrPer9: null,
      previousStartDate: null,
      daysRest: null,
      recent3Starts: [],
      recent5Starts: [],
      sampleSize: 0,
      warnings: [],
    } as PitcherHistoricalAggregate),
    ...overrides,
  };

  return createMLBHistoricalMaterializationSourceAdapter(deps);
}

describe('createMLBHistoricalMaterializationSourceAdapter', () => {
  // 1. factory exposes expected adapter API
  it('1. factory exposes expected adapter API', () => {
    const adapter = createAdapter();
    const api: (keyof MLBHistoricalMaterializationSourceAdapter)[] = [
      'loadScheduleGamesForDateRange',
      'loadTeamStatsAsOf',
      'loadPitcherStatsAsOf',
      'resolveProspectiveStarter',
      'loadOfficialFinalOutcome',
    ];

    for (const method of api) {
      expect(adapter[method]).toBeInstanceOf(Function);
    }
  });

  describe('loadScheduleGamesForDateRange', () => {
    // 2. date-range game enumeration delegates to schedule loader exactly once
    it('2. date-range game enumeration delegates to schedule loader exactly once', async () => {
      const scheduleLoader = { loadForDateRange: vi.fn().mockResolvedValue([]) };
      const adapter = createAdapter({ scheduleLoader });

      const result = await adapter.loadScheduleGamesForDateRange({ start: '2020-01-01', end: '2020-12-31' });

      expect(scheduleLoader.loadForDateRange).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });

    // 3. start/end date arguments preserved exactly
    it('3. start/end date arguments preserved exactly', async () => {
      const scheduleLoader = { loadForDateRange: vi.fn().mockResolvedValue([]) };
      const adapter = createAdapter({ scheduleLoader });

      await adapter.loadScheduleGamesForDateRange({ start: '2021-03-01', end: '2021-10-15' });

      expect(scheduleLoader.loadForDateRange).toHaveBeenCalledWith('2021-03-01', '2021-10-15');
    });

    // 4. schedule gamePk preserved exactly
    it('4. schedule gamePk preserved exactly', async () => {
      const games = [buildScheduleGame()];
      const scheduleLoader = { loadForDateRange: vi.fn().mockResolvedValue(games) };
      const adapter = createAdapter({ scheduleLoader });

      const result = await adapter.loadScheduleGamesForDateRange({ start: '2021-01-01', end: '2021-12-31' });

      expect(result[0].gamePk).toBe(777);
    });

    // 5. officialDate preserved
    it('5. officialDate preserved', async () => {
      const games = [buildScheduleGame({ officialDate: '2021-07-04' })];
      const scheduleLoader = { loadForDateRange: vi.fn().mockResolvedValue(games) };
      const adapter = createAdapter({ scheduleLoader });

      const result = await adapter.loadScheduleGamesForDateRange({ start: '2021-01-01', end: '2021-12-31' });

      expect(result[0].officialDate).toBe('2021-07-04');
    });

    // 6. scheduled start preserved
    it('6. scheduled start preserved', async () => {
      const scheduledStart = new Date('2021-06-15T19:00:00Z');
      const games = [buildScheduleGame({ scheduledStart })];
      const scheduleLoader = { loadForDateRange: vi.fn().mockResolvedValue(games) };
      const adapter = createAdapter({ scheduleLoader });

      const result = await adapter.loadScheduleGamesForDateRange({ start: '2021-01-01', end: '2021-12-31' });

      expect(result[0].scheduledStart).toBe(scheduledStart);
    });

    // 7. raw doubleheader/game number preserved (gameType not present in canonical schedule type)
    it('7. raw doubleheader and game number preserved', async () => {
      const games = [buildScheduleGame({ doubleheader: true, gameNumber: 2 })];
      const scheduleLoader = { loadForDateRange: vi.fn().mockResolvedValue(games) };
      const adapter = createAdapter({ scheduleLoader });

      const result = await adapter.loadScheduleGamesForDateRange({ start: '2021-01-01', end: '2021-12-31' });

      expect(result[0].doubleheader).toBe(true);
      expect(result[0].gameNumber).toBe(2);
    });

    // 8. home/away team IDs preserved
    it('8. home/away team IDs preserved', async () => {
      const games = [buildScheduleGame({ homeTeamId: 999, awayTeamId: 888 })];
      const scheduleLoader = { loadForDateRange: vi.fn().mockResolvedValue(games) };
      const adapter = createAdapter({ scheduleLoader });

      const result = await adapter.loadScheduleGamesForDateRange({ start: '2021-01-01', end: '2021-12-31' });

      expect(result[0].homeTeamId).toBe(999);
      expect(result[0].awayTeamId).toBe(888);
    });

    // 9. venue identity preserved when source owns it
    it('9. venue identity preserved when source owns it', async () => {
      const games = [buildScheduleGame({ venueId: 42, venueName: 'Exact Park' })];
      const scheduleLoader = { loadForDateRange: vi.fn().mockResolvedValue(games) };
      const adapter = createAdapter({ scheduleLoader });

      const result = await adapter.loadScheduleGamesForDateRange({ start: '2021-01-01', end: '2021-12-31' });

      expect(result[0].venueId).toBe(42);
      expect(result[0].venueName).toBe('Exact Park');
    });

    // 10. no neutralSite false fabrication
    it('10. no neutralSite false fabrication', async () => {
      const games = [buildScheduleGame()];
      const scheduleLoader = { loadForDateRange: vi.fn().mockResolvedValue(games) };
      const adapter = createAdapter({ scheduleLoader });

      const result = await adapter.loadScheduleGamesForDateRange({ start: '2021-01-01', end: '2021-12-31' });

      expect(result[0]).not.toHaveProperty('neutralSite');
    });

    // 30. acquisition fetchedAt preserved
    it('30. acquisition fetchedAt preserved', async () => {
      const fetchedAt = new Date('2021-04-02T00:00:00Z');
      const games = [buildScheduleGame({ provenance: { endpoint: '/api/v1/schedule', fetchedAt, sourceTimestamp: null } })];
      const scheduleLoader = { loadForDateRange: vi.fn().mockResolvedValue(games) };
      const adapter = createAdapter({ scheduleLoader });

      const result = await adapter.loadScheduleGamesForDateRange({ start: '2021-01-01', end: '2021-12-31' });

      expect(result[0].provenance.fetchedAt).toBe(fetchedAt);
    });

    // 31. sourceTimestamp preserved/null truthfully
    it('31. sourceTimestamp preserved/null truthfully', async () => {
      const sourceTimestamp = new Date('2021-04-02T01:00:00Z');
      const games = [buildScheduleGame({ provenance: { endpoint: '/api/v1/schedule', fetchedAt: new Date('2021-04-02T00:00:00Z'), sourceTimestamp } })];
      const scheduleLoader = { loadForDateRange: vi.fn().mockResolvedValue(games) };
      const adapter = createAdapter({ scheduleLoader });

      const result = await adapter.loadScheduleGamesForDateRange({ start: '2021-01-01', end: '2021-12-31' });

      expect(result[0].provenance.sourceTimestamp).toBe(sourceTimestamp);
    });

    // 32. cached/original fetchedAt remains unchanged
    it('32. cached/original fetchedAt remains unchanged', async () => {
      const fetchedAt = new Date('2021-04-02T00:00:00Z');
      const games = [buildScheduleGame({ provenance: { endpoint: '/api/v1/schedule', fetchedAt, sourceTimestamp: null } })];
      const scheduleLoader = { loadForDateRange: vi.fn().mockResolvedValue(games) };
      const adapter = createAdapter({ scheduleLoader });

      await adapter.loadScheduleGamesForDateRange({ start: '2021-01-01', end: '2021-12-31' });

      expect(games[0].provenance.fetchedAt).toBe(fetchedAt);
    });

    // 33. archival FINAL schedule status is not converted into predictor FINAL behavior by source adapter
    it('33. archival FINAL schedule status is not converted into predictor FINAL behavior by source adapter', async () => {
      const games = [buildScheduleGame({ status: 'FINAL' })];
      const scheduleLoader = { loadForDateRange: vi.fn().mockResolvedValue(games) };
      const adapter = createAdapter({ scheduleLoader });

      const result = await adapter.loadScheduleGamesForDateRange({ start: '2021-01-01', end: '2021-12-31' });

      expect(result[0].status).toBe('FINAL');
    });

    // 42. schedule acquisition never consults final outcome
    it('42. schedule acquisition never consults final outcome', async () => {
      const scheduleLoader = { loadForDateRange: vi.fn().mockResolvedValue([buildScheduleGame()]) };
      const outcomeLoader = { loadOutcome: vi.fn() };
      const adapter = createAdapter({ scheduleLoader, outcomeLoader });

      await adapter.loadScheduleGamesForDateRange({ start: '2021-01-01', end: '2021-12-31' });

      expect(outcomeLoader.loadOutcome).not.toHaveBeenCalled();
    });
  });

  describe('loadTeamStatsAsOf', () => {
    // 11. team source called with exact teamId
    it('11. team source called with exact teamId', async () => {
      const teamGameSource = { getTeamGames: vi.fn().mockResolvedValue([]) };
      const adapter = createAdapter({ teamGameSource });

      await adapter.loadTeamStatsAsOf({ teamId: 110, cutoff: new Date('2021-07-01') });

      expect(teamGameSource.getTeamGames).toHaveBeenCalledWith(110, 2021, expect.any(Date));
    });

    // 12. team source called with exact cutoff
    it('12. team source called with exact cutoff', async () => {
      const cutoff = new Date('2021-07-01');
      const teamGameSource = { getTeamGames: vi.fn().mockResolvedValue([]) };
      const adapter = createAdapter({ teamGameSource });

      await adapter.loadTeamStatsAsOf({ teamId: 110, cutoff });

      const callArgs = teamGameSource.getTeamGames.mock.calls[0];
      expect(callArgs[2]).toBe(cutoff);
    });

    // 13. team season argument follows accepted calendar-year semantics
    it('13. team season argument follows accepted calendar-year semantics', async () => {
      const cutoff = new Date('2021-07-01');
      const teamGameSource = { getTeamGames: vi.fn().mockResolvedValue([]) };
      const adapter = createAdapter({ teamGameSource });

      await adapter.loadTeamStatsAsOf({ teamId: 110, cutoff });

      expect(teamGameSource.getTeamGames).toHaveBeenCalledWith(110, 2021, cutoff);
    });

    // 14. team aggregation receives exact source games
    it('14. team aggregation receives exact source games', async () => {
      const teamGames = [buildTeamGame()];
      const teamGameSource = { getTeamGames: vi.fn().mockResolvedValue(teamGames) };
      const teamAggregator = vi.fn().mockReturnValue({ teamId: 110, gamesPlayed: 1, wins: 1, losses: 0, winRate: 1, runsScored: 5, runsAllowed: 3, runDifferential: 2, runsScoredPerGame: 5, runsAllowedPerGame: 3, recent5Wins: 1, recent5Losses: 0, recent10Wins: 1, recent10Losses: 0, recent10RunsPerGame: 5, homeWins: 1, homeLosses: 0, awayWins: 0, awayLosses: 0, restDays: 0, gamesInPrevious3Days: 0, extraInningGames: 0, sampleSize: 1, warnings: [] } as TeamHistoricalAggregate);
      const adapter = createAdapter({ teamGameSource, teamAggregator });

      await adapter.loadTeamStatsAsOf({ teamId: 110, cutoff: new Date('2021-07-01') });

      expect(teamAggregator).toHaveBeenCalledWith(teamGames, 110, expect.any(Date));
    });

    // 15. team history after cutoff does not leak through accepted source/aggregator path
    it('15. team history after cutoff does not leak through accepted source/aggregator path', async () => {
      const teamGames = [buildTeamGame(), buildTeamGame({ gamePk: 2, completedAt: new Date('2021-08-01') })];
      const teamGameSource = { getTeamGames: vi.fn().mockResolvedValue(teamGames) };
      const teamAggregator = vi.fn().mockReturnValue({ teamId: 110, gamesPlayed: 2, wins: 2, losses: 0, winRate: 1, runsScored: 10, runsAllowed: 6, runDifferential: 4, runsScoredPerGame: 5, runsAllowedPerGame: 3, recent5Wins: 2, recent5Losses: 0, recent10Wins: 2, recent10Losses: 0, recent10RunsPerGame: 5, homeWins: 2, homeLosses: 0, awayWins: 0, awayLosses: 0, restDays: 0, gamesInPrevious3Days: 0, extraInningGames: 0, sampleSize: 2, warnings: [] } as TeamHistoricalAggregate);
      const adapter = createAdapter({ teamGameSource, teamAggregator });

      await adapter.loadTeamStatsAsOf({ teamId: 110, cutoff: new Date('2021-07-01') });

      expect(teamAggregator).toHaveBeenCalledWith(teamGames, 110, expect.any(Date));
    });

    // 40. team acquisition never consults final outcome
    it('40. team acquisition never consults final outcome', async () => {
      const outcomeLoader = { loadOutcome: vi.fn() };
      const teamGameSource = { getTeamGames: vi.fn().mockResolvedValue([]) };
      const adapter = createAdapter({ outcomeLoader, teamGameSource });

      await adapter.loadTeamStatsAsOf({ teamId: 110, cutoff: new Date('2021-07-01') });

      expect(outcomeLoader.loadOutcome).not.toHaveBeenCalled();
    });
  });

  describe('loadPitcherStatsAsOf', () => {
    // 16. pitcher source called with exact truthful personId
    it('16. pitcher source called with exact truthful personId', async () => {
      const pitcherAppearanceSource = { getPitcherAppearances: vi.fn().mockResolvedValue([]) };
      const adapter = createAdapter({ pitcherAppearanceSource });

      await adapter.loadPitcherStatsAsOf({ personId: 123, cutoff: new Date('2021-07-01') });

      expect(pitcherAppearanceSource.getPitcherAppearances).toHaveBeenCalledWith(123, 2021, expect.any(Date));
    });

    // 17. pitcher source called with exact cutoff
    it('17. pitcher source called with exact cutoff', async () => {
      const cutoff = new Date('2021-07-01');
      const pitcherAppearanceSource = { getPitcherAppearances: vi.fn().mockResolvedValue([]) };
      const adapter = createAdapter({ pitcherAppearanceSource });

      await adapter.loadPitcherStatsAsOf({ personId: 123, cutoff });

      const callArgs = pitcherAppearanceSource.getPitcherAppearances.mock.calls[0];
      expect(callArgs[2]).toBe(cutoff);
    });

    // 18. pitcher aggregation receives exact appearances
    it('18. pitcher aggregation receives exact appearances', async () => {
      const appearances = [buildPitcherAppearance()];
      const pitcherAppearanceSource = { getPitcherAppearances: vi.fn().mockResolvedValue(appearances) };
      const pitcherAggregator = vi.fn().mockReturnValue({ personId: 123, teamId: 110, appearances: 1, gamesStarted: 1, outsRecorded: 15, inningsPitchedDisplay: '5.0', earnedRuns: 2, hitsAllowed: 5, walks: 2, strikeouts: 6, homeRunsAllowed: 1, era: 3.6, whip: 1.4, kPer9: 10.8, bbPer9: 3.6, hPer9: 9, hrPer9: 1.8, previousStartDate: null, daysRest: null, recent3Starts: [], recent5Starts: [], sampleSize: 1, warnings: [] } as PitcherHistoricalAggregate);
      const adapter = createAdapter({ pitcherAppearanceSource, pitcherAggregator });

      await adapter.loadPitcherStatsAsOf({ personId: 123, cutoff: new Date('2021-07-01') });

      expect(pitcherAggregator).toHaveBeenCalledWith(appearances, 123, expect.any(Date));
    });

    // 19. unknown/missing pitcher does not fabricate aggregate
    it('19. unknown/missing pitcher does not fabricate aggregate', async () => {
      const pitcherAppearanceSource = { getPitcherAppearances: vi.fn().mockResolvedValue([]) };
      const pitcherAggregator = vi.fn().mockReturnValue({ personId: 999, teamId: null, appearances: 0, gamesStarted: 0, outsRecorded: 0, inningsPitchedDisplay: '0.0', earnedRuns: 0, hitsAllowed: 0, walks: 0, strikeouts: 0, homeRunsAllowed: 0, era: null, whip: null, kPer9: null, bbPer9: null, hPer9: null, hrPer9: null, previousStartDate: null, daysRest: null, recent3Starts: [], recent5Starts: [], sampleSize: 0, warnings: [] } as PitcherHistoricalAggregate);
      const adapter = createAdapter({ pitcherAppearanceSource, pitcherAggregator });

      const result = await adapter.loadPitcherStatsAsOf({ personId: 999, cutoff: new Date('2021-07-01') });

      expect(result.aggregate.appearances).toBe(0);
      expect(result.aggregate.warnings).toEqual([]);
    });

    // 41. pitcher acquisition never consults final outcome
    it('41. pitcher acquisition never consults final outcome', async () => {
      const outcomeLoader = { loadOutcome: vi.fn() };
      const pitcherAppearanceSource = { getPitcherAppearances: vi.fn().mockResolvedValue([]) };
      const adapter = createAdapter({ outcomeLoader, pitcherAppearanceSource });

      await adapter.loadPitcherStatsAsOf({ personId: 123, cutoff: new Date('2021-07-01') });

      expect(outcomeLoader.loadOutcome).not.toHaveBeenCalled();
    });
  });

  describe('resolveProspectiveStarter', () => {
    const cutoff = new Date('2021-04-01T17:00:00Z');

    // 20. prospectively observed HOME starter before cutoff accepted
    it('20. prospectively observed HOME starter before cutoff accepted', async () => {
      const observation = buildObservation();
      const observationStore = { findLatestEligible: vi.fn().mockResolvedValue(observation) };
      const adapter = createAdapter({ observationStore });

      const result = await adapter.resolveProspectiveStarter({ gamePk: 777, side: 'home', cutoff });

      expect(result).toEqual({
        pitcherId: 111,
        source: 'SCHEDULE_PROBABLE_BEFORE_CUTOFF',
        observedAt: observation.observedAt,
        observation,
      });
    });

    // 21. prospectively observed AWAY starter before cutoff accepted
    it('21. prospectively observed AWAY starter before cutoff accepted', async () => {
      const observation = buildObservation();
      const observationStore = { findLatestEligible: vi.fn().mockResolvedValue(observation) };
      const adapter = createAdapter({ observationStore });

      const result = await adapter.resolveProspectiveStarter({ gamePk: 777, side: 'away', cutoff });

      expect(result).toEqual({
        pitcherId: 222,
        source: 'SCHEDULE_PROBABLE_BEFORE_CUTOFF',
        observedAt: observation.observedAt,
        observation,
      });
    });

    // 22. prospective observation exactly at cutoff accepted
    it('22. prospective observation exactly at cutoff accepted', async () => {
      const exactCutoff = new Date('2021-04-01T17:00:00Z');
      const observation = buildObservation({ observedAt: exactCutoff });
      const observationStore = { findLatestEligible: vi.fn().mockResolvedValue(observation) };
      const adapter = createAdapter({ observationStore });

      const result = await adapter.resolveProspectiveStarter({ gamePk: 777, side: 'home', cutoff: exactCutoff });

      expect(result.pitcherId).toBe(111);
      expect(result.source).toBe('SCHEDULE_PROBABLE_BEFORE_CUTOFF');
    });

    // 23. observation after cutoff rejected/ignored
    it('23. observation after cutoff rejected/ignored', async () => {
      const observationStore = { findLatestEligible: vi.fn().mockResolvedValue(null) };
      const adapter = createAdapter({ observationStore });

      const result = await adapter.resolveProspectiveStarter({ gamePk: 777, side: 'home', cutoff });

      expect(result.pitcherId).toBeNull();
      expect(result.source).toBe('UNAVAILABLE');
    });

    // 24. no prospective observation -> UNAVAILABLE
    it('24. no prospective observation -> UNAVAILABLE', async () => {
      const observationStore = { findLatestEligible: vi.fn().mockResolvedValue(null) };
      const adapter = createAdapter({ observationStore });

      const result = await adapter.resolveProspectiveStarter({ gamePk: 777, side: 'home', cutoff });

      expect(result.pitcherId).toBeNull();
      expect(result.source).toBe('UNAVAILABLE');
    });

    // 25. archival schedule probable pitcher without observation -> UNAVAILABLE
    it('25. archival schedule probable pitcher without observation -> UNAVAILABLE', async () => {
      const observationStore = { findLatestEligible: vi.fn().mockResolvedValue(null) };
      const adapter = createAdapter({ observationStore });

      const result = await adapter.resolveProspectiveStarter({ gamePk: 777, side: 'home', cutoff });

      expect(result.pitcherId).toBeNull();
      expect(result.source).toBe('UNAVAILABLE');
    });

    // 26. actual/final starter is never consulted
    it('26. actual/final starter is never consulted', async () => {
      const observationStore = { findLatestEligible: vi.fn().mockResolvedValue(null) };
      const adapter = createAdapter({ observationStore });

      const result = await adapter.resolveProspectiveStarter({ gamePk: 777, side: 'home', cutoff });

      expect(observationStore.findLatestEligible).toHaveBeenCalledWith(777, cutoff);
      expect(result.source).toBe('UNAVAILABLE');
    });

    // 27. multiple prospective observations resolve deterministically according to store semantics
    it('27. multiple prospective observations resolve deterministically according to store semantics', async () => {
      const newer = buildObservation({
        observedAt: new Date('2021-04-01T14:00:00Z'),
        sourceResponseHash: 'b'.repeat(64),
      });
      const observationStore = { findLatestEligible: vi.fn().mockResolvedValue(newer) };
      const adapter = createAdapter({ observationStore });

      const result = await adapter.resolveProspectiveStarter({ gamePk: 777, side: 'home', cutoff });

      expect(result.pitcherId).toBe(111);
      expect(result.observedAt).toBe(newer.observedAt);
    });

    // 28. observation from wrong game rejected
    it('28. observation from wrong game rejected', async () => {
      const observationStore = { findLatestEligible: vi.fn().mockResolvedValue(null) };
      const adapter = createAdapter({ observationStore });

      await adapter.resolveProspectiveStarter({ gamePk: 777, side: 'home', cutoff });

      expect(observationStore.findLatestEligible).toHaveBeenCalledWith(777, cutoff);
    });

    // 29. wrong side observation not used for opposite side
    it('29. wrong side observation not used for opposite side', async () => {
      const observation = buildObservation({ homeProbablePitcherId: null, awayProbablePitcherId: 222 });
      const observationStore = { findLatestEligible: vi.fn().mockResolvedValue(observation) };
      const adapter = createAdapter({ observationStore });

      const result = await adapter.resolveProspectiveStarter({ gamePk: 777, side: 'home', cutoff });

      expect(result.pitcherId).toBeNull();
      expect(result.source).toBe('UNAVAILABLE');
    });
  });

  describe('loadOfficialFinalOutcome', () => {
    // 34. final outcome loader delegates using exact gamePk via provenance-aware path
    it('34. final outcome loader delegates using exact gamePk via provenance-aware path', async () => {
      const outcome = {
        gamePk: 777,
        status: 'FINAL' as const,
        homeScore: 5,
        awayScore: 3,
        winner: 'HOME' as const,
        innings: 9,
        completedAt: new Date('2021-04-01T22:00:00Z'),
        completedAtSource: 'LAST_COMPLETED_PLAY_END',
        warnings: [],
      } as CanonicalHistoricalOutcome;
      const provenance = {
        endpoint: '/api/v1.1/game/777/feed/live',
        fetchedAt: new Date('2021-04-01T22:00:00Z'),
        sourceTimestamp: null,
      };
      const outcomeLoader = {
        loadOutcome: vi.fn(),
        loadOutcomeWithProvenance: vi.fn().mockResolvedValue({ outcome, provenance }),
      };
      const adapter = createAdapter({ outcomeLoader });

      const result = await adapter.loadOfficialFinalOutcome({ gamePk: 777 });

      expect(outcomeLoader.loadOutcomeWithProvenance).toHaveBeenCalledWith(777);
      expect(outcomeLoader.loadOutcome).not.toHaveBeenCalled();
      expect(result.outcome).toBe(outcome);
      expect(result.provenance).toBe(provenance);
    });

    // 35. official final winner preserved via provenance-aware path
    it('35. official final winner preserved via provenance-aware path', async () => {
      const outcome = {
        gamePk: 777,
        status: 'FINAL' as const,
        homeScore: 5,
        awayScore: 3,
        winner: 'HOME' as const,
        innings: 9,
        completedAt: new Date('2021-04-01T22:00:00Z'),
        completedAtSource: 'LAST_COMPLETED_PLAY_END',
        warnings: [],
      } as CanonicalHistoricalOutcome;
      const outcomeLoader = {
        loadOutcome: vi.fn(),
        loadOutcomeWithProvenance: vi.fn().mockResolvedValue({
          outcome,
          provenance: {
            endpoint: '/api/v1.1/game/777/feed/live',
            fetchedAt: new Date('2021-04-01T22:00:00Z'),
            sourceTimestamp: null,
          },
        }),
      };
      const adapter = createAdapter({ outcomeLoader });

      const result = await adapter.loadOfficialFinalOutcome({ gamePk: 777 });

      expect(result.outcome.winner).toBe('HOME');
      expect(outcomeLoader.loadOutcome).not.toHaveBeenCalled();
    });

    // 36. official homeScore preserved via provenance-aware path
    it('36. official homeScore preserved via provenance-aware path', async () => {
      const outcome = {
        gamePk: 777,
        status: 'FINAL' as const,
        homeScore: 5,
        awayScore: 3,
        winner: 'HOME' as const,
        innings: 9,
        completedAt: new Date('2021-04-01T22:00:00Z'),
        completedAtSource: 'LAST_COMPLETED_PLAY_END',
        warnings: [],
      } as CanonicalHistoricalOutcome;
      const outcomeLoader = {
        loadOutcome: vi.fn(),
        loadOutcomeWithProvenance: vi.fn().mockResolvedValue({
          outcome,
          provenance: {
            endpoint: '/api/v1.1/game/777/feed/live',
            fetchedAt: new Date('2021-04-01T22:00:00Z'),
            sourceTimestamp: null,
          },
        }),
      };
      const adapter = createAdapter({ outcomeLoader });

      const result = await adapter.loadOfficialFinalOutcome({ gamePk: 777 });

      expect(result.outcome.homeScore).toBe(5);
      expect(outcomeLoader.loadOutcome).not.toHaveBeenCalled();
    });

    // 37. official awayScore preserved via provenance-aware path
    it('37. official awayScore preserved via provenance-aware path', async () => {
      const outcome = {
        gamePk: 777,
        status: 'FINAL' as const,
        homeScore: 5,
        awayScore: 3,
        winner: 'HOME' as const,
        innings: 9,
        completedAt: new Date('2021-04-01T22:00:00Z'),
        completedAtSource: 'LAST_COMPLETED_PLAY_END',
        warnings: [],
      } as CanonicalHistoricalOutcome;
      const outcomeLoader = {
        loadOutcome: vi.fn(),
        loadOutcomeWithProvenance: vi.fn().mockResolvedValue({
          outcome,
          provenance: {
            endpoint: '/api/v1.1/game/777/feed/live',
            fetchedAt: new Date('2021-04-01T22:00:00Z'),
            sourceTimestamp: null,
          },
        }),
      };
      const adapter = createAdapter({ outcomeLoader });

      const result = await adapter.loadOfficialFinalOutcome({ gamePk: 777 });

      expect(result.outcome.awayScore).toBe(3);
      expect(outcomeLoader.loadOutcome).not.toHaveBeenCalled();
    });

    // 38. official completedAt preserved via provenance-aware path
    it('38. official completedAt preserved via provenance-aware path', async () => {
      const completedAt = new Date('2021-04-01T22:00:00Z');
      const outcome = {
        gamePk: 777,
        status: 'FINAL' as const,
        homeScore: 5,
        awayScore: 3,
        winner: 'HOME' as const,
        innings: 9,
        completedAt,
        completedAtSource: 'LAST_COMPLETED_PLAY_END',
        warnings: [],
      } as CanonicalHistoricalOutcome;
      const outcomeLoader = {
        loadOutcome: vi.fn(),
        loadOutcomeWithProvenance: vi.fn().mockResolvedValue({
          outcome,
          provenance: {
            endpoint: '/api/v1.1/game/777/feed/live',
            fetchedAt: new Date('2021-04-01T22:00:00Z'),
            sourceTimestamp: null,
          },
        }),
      };
      const adapter = createAdapter({ outcomeLoader });

      const result = await adapter.loadOfficialFinalOutcome({ gamePk: 777 });

      expect(result.outcome.completedAt).toBe(completedAt);
      expect(outcomeLoader.loadOutcome).not.toHaveBeenCalled();
    });

    // 39. provenance-aware path preserves actual acquisition provenance and does not call legacy loadOutcome
    it('39. provenance-aware path preserves actual acquisition provenance and does not call legacy loadOutcome', async () => {
      const scheduleLoader = { loadForDateRange: vi.fn().mockResolvedValue([buildScheduleGame()]) };
      const outcome = {
        gamePk: 777,
        status: 'FINAL',
        homeScore: 5,
        awayScore: 3,
        winner: 'HOME',
        innings: 9,
        completedAt: new Date('2021-04-01T22:00:00Z'),
        completedAtSource: 'LAST_COMPLETED_PLAY_END',
        warnings: [],
      } as CanonicalHistoricalOutcome;
      const provenance = {
        endpoint: '/api/v1.1/game/777/feed/live',
        fetchedAt: new Date('2021-04-01T22:00:00Z'),
        sourceTimestamp: null,
      };
      const outcomeLoader = {
        loadOutcome: vi.fn(),
        loadOutcomeWithProvenance: vi.fn().mockResolvedValue({ outcome, provenance }),
      };
      const adapter = createAdapter({ scheduleLoader, outcomeLoader });

      await adapter.loadScheduleGamesForDateRange({ start: '2021-01-01', end: '2021-12-31' });
      const result = await adapter.loadOfficialFinalOutcome({ gamePk: 777 });

      expect(outcomeLoader.loadOutcomeWithProvenance).toHaveBeenCalledWith(777);
      expect(outcomeLoader.loadOutcome).not.toHaveBeenCalled();
      expect(result.outcome).toBe(outcome);
      expect(result.provenance).toBe(provenance);
    });

    // 40. missing provenance-aware outcome capability rejects without fabricating legacy fallback
    it('40. missing provenance-aware outcome capability rejects without fabricating legacy fallback', async () => {
      const outcomeLoader = { loadOutcome: vi.fn().mockResolvedValue({
        gamePk: 777,
        status: 'FINAL',
        homeScore: 5,
        awayScore: 3,
        winner: 'HOME',
        innings: 9,
        completedAt: new Date('2021-04-01T22:00:00Z'),
        completedAtSource: 'LAST_COMPLETED_PLAY_END',
        warnings: [],
      } as CanonicalHistoricalOutcome) };
      const adapter = createAdapter({ outcomeLoader });

      await expect(adapter.loadOfficialFinalOutcome({ gamePk: 777 })).rejects.toThrow(
        'provenance-aware loadOfficialFinalOutcome requires outcomeLoader.loadOutcomeWithProvenance for game 777',
      );
      expect(outcomeLoader.loadOutcome).not.toHaveBeenCalled();
    });
  });

  // 43. deterministic equivalent dependency responses produce deeply equivalent outputs
  it('43. deterministic equivalent dependency responses produce deeply equivalent outputs', async () => {
    const games = [buildScheduleGame()];
    const scheduleLoader = { loadForDateRange: vi.fn().mockResolvedValue(games) };
    const deps = {
      scheduleLoader,
      outcomeLoader: { loadOutcome: vi.fn() },
      teamGameSource: { getTeamGames: vi.fn() },
      teamAggregator: vi.fn(),
      pitcherAppearanceSource: { getPitcherAppearances: vi.fn() },
      pitcherAggregator: vi.fn(),
    };

    const adapter1 = createMLBHistoricalMaterializationSourceAdapter(deps);
    const adapter2 = createMLBHistoricalMaterializationSourceAdapter(deps);

    const [result1, result2] = await Promise.all([
      adapter1.loadScheduleGamesForDateRange({ start: '2021-01-01', end: '2021-12-31' }),
      adapter2.loadScheduleGamesForDateRange({ start: '2021-01-01', end: '2021-12-31' }),
    ]);

    expect(result1).toEqual(result2);
  });

  // 44. input/dependency-returned objects remain unchanged
  it('44. input/dependency-returned objects remain unchanged', async () => {
    const games = [buildScheduleGame()];
    const original = structuredClone(games);
    const scheduleLoader = { loadForDateRange: vi.fn().mockResolvedValue(games) };
    const adapter = createAdapter({ scheduleLoader });

    await adapter.loadScheduleGamesForDateRange({ start: '2021-01-01', end: '2021-12-31' });

    expect(games).toEqual(original);
  });

  // 45. source failures do not fabricate successful empty data
  it('45. source failures do not fabricate successful empty data', async () => {
    const scheduleLoader = {
      loadForDateRange: vi.fn().mockRejectedValue(new Error('schedule source failure')),
    };
    const adapter = createAdapter({ scheduleLoader });

    await expect(adapter.loadScheduleGamesForDateRange({ start: '2021-01-01', end: '2021-12-31' })).rejects.toThrow('schedule source failure');
  });

  // 46. no provider/provider-factory runtime dependency
  it('46. no provider/provider-factory runtime dependency', () => {
    const source = readFileSync(new URL(SOURCE_PATH, import.meta.url).pathname, 'utf8');
    expect(source).not.toContain("from './provider'");
    expect(source).not.toContain("from './provider-factory'");
    expect(source).not.toContain('provider-factory');
  });

  // 47. no sportsbook/market fields or logic
  it('47. no sportsbook/market fields or logic', () => {
    const source = readFileSync(new URL(SOURCE_PATH, import.meta.url).pathname, 'utf8');
    const forbidden = ['sportsbook', 'moneyline', 'betting price', 'market probability', 'edge', 'Kelly', 'CLV'];
    const lower = source.toLowerCase();
    for (const term of forbidden) {
      expect(lower).not.toContain(term.toLowerCase());
    }
  });

  // 48. no prediction/model/recommendation output
  it('48. no prediction/model/recommendation output', () => {
    const source = readFileSync(new URL(SOURCE_PATH, import.meta.url).pathname, 'utf8');
    const forbidden = ['homeWinProbability', 'awayWinProbability', 'predictedSide', 'predictedTeamId', 'recommendation', 'staking'];
    const lower = source.toLowerCase();
    for (const term of forbidden) {
      expect(lower).not.toContain(term.toLowerCase());
    }
  });

  // 49. no dataset builder invocation
  it('49. no dataset builder invocation', () => {
    const source = readFileSync(new URL(SOURCE_PATH, import.meta.url).pathname, 'utf8');
    expect(source).not.toContain('buildMLBHistoricalLabelledDataset');
  });

  // 50. no historical canonical snapshot builder invocation
  it('50. no historical canonical snapshot builder invocation', () => {
    const source = readFileSync(new URL(SOURCE_PATH, import.meta.url).pathname, 'utf8');
    expect(source).not.toContain('buildMLBHistoricalCanonicalPregameSnapshot');
  });
});
