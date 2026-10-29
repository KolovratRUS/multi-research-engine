/* MRS-7 P5F-C7B-S2: offline-only one-game read-only provider probe tests. */
import { describe, it, expect, vi } from 'vitest';
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import type { DataProvenance, MLBScheduleGame, MLBScheduleResult, MLBGameResearchSnapshot } from '@/lib/research-data/types';
import {
  runMLBOperationalLiveReadonlyProbe,
  checkMLBReadOnlyProbeAuthorization,
  parseMLBReadOnlyProbeCli,
  type MLBReadOnlyProbeConfig,
} from '../../../scripts/mlb-operational-live-readonly-probe';

/* === Shared fixture constants === */


const GAME_PK = 900001;
const OFFICIAL_DATE = '2027-07-15';
const SCHEDULED_START_ISO = '2027-07-15T12:00:00.000Z';
const SCHEDULED_START = new Date(SCHEDULED_START_ISO);
const DATA_CUTOFF_ISO = '2027-07-15T09:30:00.000Z';
const FETCHED_AT = new Date(DATA_CUTOFF_ISO);
const SOURCE_TIMESTAMP = new Date('2027-07-15T09:00:00Z');
const DEFAULT_NOW = new Date('2027-07-15T10:00:00Z');

/* === Fixture builders === */

function makeScheduleGame(opts: {
  status?: MLBScheduleGame['status'];
  startTimeUtc?: Date;
  officialDate?: string;
  gameDate?: string;
  gamePk?: number;
  homeTeamName?: string;
  awayTeamName?: string;
}): MLBScheduleGame {
  return {
    gamePk: opts.gamePk ?? GAME_PK,
    gameType: 'R',
    gameNumber: 1,
    officialDate: opts.officialDate ?? OFFICIAL_DATE,
    gameDate: opts.gameDate ?? OFFICIAL_DATE,
    startTimeUtc: opts.startTimeUtc ?? SCHEDULED_START,
    status: opts.status ?? 'UPCOMING',
    homeTeamId: 101,
    homeTeamName: opts.homeTeamName ?? 'Synthetic Home',
    awayTeamId: 102,
    awayTeamName: opts.awayTeamName ?? 'Synthetic Away',
    venueId: 1001,
    venueName: 'Synthetic Park',
    dayNight: 'day',
    scheduledInnings: 9,
    doubleHeader: 'N',
    seriesGameNumber: 1,
    gamesInSeries: 3,
    seriesDescription: 'Synthetic Regular Season',
    leagueRecord: {
      home: { wins: 50, losses: 40, pct: '0.556' },
      away: { wins: 45, losses: 45, pct: '0.500' },
    },
    probablePitchers: { home: null, away: null },
  };
}

function makeResearchSnapshot(opts: {
  externalId?: string;
  homeTeam?: string;
  awayTeam?: string;
  startTimeUtc?: Date;
  eventStatus?: string;
  fetchedAt?: Date;
  sourceTimestamp?: Date;
  provenance?: DataProvenance[];
}): MLBGameResearchSnapshot {
  const fetchedAt = opts.fetchedAt ?? FETCHED_AT;
  const srcTs = opts.sourceTimestamp ?? SOURCE_TIMESTAMP;
  return {
    event: {
      id: 'synthetic-event-' + (opts.externalId ?? String(GAME_PK)),
      externalId: opts.externalId ?? String(GAME_PK),
      sport: 'mlb',
      league: 'MLB',
      leagueSlug: 'mlb',
      homeTeam: opts.homeTeam ?? 'Synthetic Home',
      awayTeam: opts.awayTeam ?? 'Synthetic Away',
      homeTeamSlug: 'synthetic-home',
      awayTeamSlug: 'synthetic-away',
      startTimeUtc: opts.startTimeUtc ?? SCHEDULED_START,
      status: opts.eventStatus ?? 'UPCOMING',
      createdAt: new Date('2027-07-15T08:00:00Z'),
      updatedAt: srcTs,
    },
    probablePitchers: { home: null, away: null },
    pitcherStats: { home: null, away: null },
    teamBatting: { home: null, away: null },
    bullpen: { home: null, away: null },
    venue: null,
    weather: null,
    completeness: 100,
    warnings: [],
    provenance: opts.provenance ?? [
      {
        source: 'mlb-stats-api:schedule',
        fetchedAt,
        sourceTimestamp: srcTs,
        isLive: false,
        warnings: [],
      },
    ],
    generatedAt: fetchedAt,
  };
}

function makeSchedule(
  games: MLBScheduleGame[] = [makeScheduleGame({})],
): MLBScheduleResult {
  return {
    games,
    provenance: {
      source: 'mlb-stats-api:schedule',
      fetchedAt: FETCHED_AT,
      sourceTimestamp: SOURCE_TIMESTAMP,
      isLive: false,
      warnings: [],
    },
  };
}


function makeProbe(overrides: Partial<MLBReadOnlyProbeConfig> = {}): MLBReadOnlyProbeConfig {
  return { date: OFFICIAL_DATE, gamePk: GAME_PK, allowLiveReadonly: true,
    environmentAcknowledgement: 'YES', ...overrides };
}

function makeProvider(opts: {
  games?: MLBScheduleGame[];
  schedule?: MLBScheduleResult;
  snapshot?: MLBGameResearchSnapshot;
  scheduleFailure?: boolean;
  snapshotFailure?: boolean;
} = {}) {
  const fetchSchedule = vi.fn(async (_date: string) => {
    if (opts.scheduleFailure) throw new Error('private http failure');
    return opts.schedule ?? makeSchedule(opts.games);
  });
  const buildGameSnapshot = vi.fn(async (_game: MLBScheduleGame, _options: {season: number;includeWeather: boolean}) => {
    if (opts.snapshotFailure) throw new Error('private research failure');
    return opts.snapshot ?? makeResearchSnapshot({});
  });
  return { fetchSchedule, buildGameSnapshot };
}

function checkCli(args: string[], ack?: string) {
  return parseMLBReadOnlyProbeCli(args, ack);
}

function spawnCli(args: string[], envOverride: Record<string, string> = {}) {
  return new Promise<{exitCode: number; stdout: string; stderr: string}>((resolve) => {
    const tsx = path.join(process.cwd(), 'node_modules/.bin/tsx');
    const script = path.join(process.cwd(), 'scripts/mlb-operational-live-readonly-probe.ts');
    const env = { ...process.env, MRS_LIVE_READONLY_PROBE_ACK: '', ...envOverride };
    const child = spawn(tsx, [script, ...args], { env, timeout: 20000, killSignal: 'SIGKILL' });
    let stdout = ''; let stderr = '';
    child.stdout?.on('data', (c) => { stdout += c.toString(); });
    child.stderr?.on('data', (c) => { stderr += c.toString(); });
    child.on('error', (err) => { resolve({ exitCode: -1, stdout, stderr: stderr + err.message }); });
    child.on('close', (code) => { resolve({ exitCode: code ?? -1, stdout, stderr }); });
  });
}

describe('MRS-7 P5F-C7B-S2 — synthetic single-game provider probe', () => {
  it('1. READY uses genuine S1 bridge and 14-feature extractor', async () => {
    const p = makeProvider();
    const result = await runMLBOperationalLiveReadonlyProbe(makeProbe(), p, () => DEFAULT_NOW);
    expect(result.status).toBe('READY');
    expect(result.featureCount).toBe(14);
    expect(result.date).toBe(OFFICIAL_DATE);
    expect(result.gamePk).toBe(GAME_PK);
    expect(result.timing?.isCurrentBeforeStart).toBe(true);
    expect(result.scheduleStatus).toBe('UPCOMING');
    expect(p.fetchSchedule).toHaveBeenCalledTimes(1);
    expect(p.fetchSchedule).toHaveBeenCalledWith(OFFICIAL_DATE);
    expect(p.buildGameSnapshot).toHaveBeenCalledTimes(1);
  });
  it('2. Other scheduled games never trigger research snapshot', async () => {
    const p = makeProvider({games: [makeScheduleGame({gamePk: 111}),makeScheduleGame({}),makeScheduleGame({gamePk: 222})]});
    const result = await runMLBOperationalLiveReadonlyProbe(makeProbe(), p, () => DEFAULT_NOW);
    expect(result.status).toBe('READY');
    expect(p.buildGameSnapshot).toHaveBeenCalledTimes(1);
    expect(p.buildGameSnapshot.mock.calls[0][0].gamePk).toBe(GAME_PK);
    expect(p.buildGameSnapshot.mock.calls[0][1].includeWeather).toBe(false);
  });
  it('3. Empty schedule is NOT_FOUND', async () => {
    const p = makeProvider({games: []});
    expect((await runMLBOperationalLiveReadonlyProbe(makeProbe(), p, () => DEFAULT_NOW)).status).toBe('NOT_FOUND');
    expect(p.buildGameSnapshot).not.toHaveBeenCalled();
  });
  it('4. Missing target gamePk is NOT_FOUND', async () => {
    const p = makeProvider({games: [makeScheduleGame({gamePk: 234})]});
    expect((await runMLBOperationalLiveReadonlyProbe(makeProbe(), p, () => DEFAULT_NOW)).status).toBe('NOT_FOUND');
    expect(p.buildGameSnapshot).not.toHaveBeenCalled();
  });
  it('5. Duplicate gamePk fails closed', async () => {
    const p = makeProvider({games: [makeScheduleGame({}),makeScheduleGame({})]});
    const r = await runMLBOperationalLiveReadonlyProbe(makeProbe(), p, () => DEFAULT_NOW);
    expect(r.status).toBe('NOT_READY'); expect(r.reasons).toContain('AMBIGUOUS_GAME_PK');
    expect(p.buildGameSnapshot).not.toHaveBeenCalled();
  });
  it('6. Mismatched officialDate fails closed before adapter', async () => {
    const p = makeProvider({games: [makeScheduleGame({officialDate:'2027-07-16'})]});
    const r = await runMLBOperationalLiveReadonlyProbe(makeProbe(), p, () => DEFAULT_NOW);
    expect(r.status).toBe('NOT_READY'); expect(r.reasons).toContain('OFFICIAL_DATE_MISMATCH');
    expect(p.buildGameSnapshot).not.toHaveBeenCalled();
  });
  for (const status of ['LIVE','FINAL','POSTPONED','CANCELLED'] as const) {
    it(`7–10. ${status} rejected without snapshot acquisition`, async () => {
      const p = makeProvider({games: [makeScheduleGame({status})]});
      const r = await runMLBOperationalLiveReadonlyProbe(makeProbe(), p, () => DEFAULT_NOW);
      expect(r.status).toBe('NOT_READY'); expect(p.buildGameSnapshot).not.toHaveBeenCalled();
    });
  }
  it('11. Already-started scheduled game never fetches research', async () => {
    const p = makeProvider();
    const r = await runMLBOperationalLiveReadonlyProbe(makeProbe(), p, () => new Date('2027-07-15T13:00:00Z'));
    expect(r.status).toBe('NOT_READY'); expect(p.buildGameSnapshot).not.toHaveBeenCalled();
  });
  it('12. Starts during asynchronous acquisition is rejected by S1', async () => {
    const p = makeProvider(); let calls = 0;
    const now = () => ++calls === 1 ? DEFAULT_NOW : new Date('2027-07-15T12:00:00Z');
    const r = await runMLBOperationalLiveReadonlyProbe(makeProbe(), p, now);
    expect(r.status).toBe('NOT_READY'); expect(p.buildGameSnapshot).toHaveBeenCalledTimes(1);
  });
  it('13. Future-dated provider provenance remains rejected by S1', async () => {
    const p = makeProvider({snapshot: makeResearchSnapshot({fetchedAt: new Date('2027-07-15T11:00:00Z')})});
    const r = await runMLBOperationalLiveReadonlyProbe(makeProbe(), p, () => DEFAULT_NOW);
    expect(r.status).toBe('NOT_READY');
    expect(r.reasons?.join(' ')).toContain('later than current preflight time');
  });
  it('14. Missing snapshot is S1 NOT_READY, not synthetic READY', async () => {
    const p = makeProvider({snapshotFailure: true});
    const r = await runMLBOperationalLiveReadonlyProbe(makeProbe(), p, () => DEFAULT_NOW);
    expect(r.status).toBe('NOT_READY');
    expect(r.featureCount).toBeUndefined();
  });
  it('15. Invalid research status remains rejected by S1', async () => {
    const p = makeProvider({snapshot: makeResearchSnapshot({eventStatus:'LIVE'})});
    const r = await runMLBOperationalLiveReadonlyProbe(makeProbe(), p, () => DEFAULT_NOW);
    expect(r.status).toBe('NOT_READY');
  });
  it('16. Existing frozen missing-data policy is exercised, not overridden', async () => {
    const p = makeProvider();
    const r = await runMLBOperationalLiveReadonlyProbe(makeProbe(), p, () => DEFAULT_NOW);
    expect(r.status).toBe('READY'); expect(r.featureCount).toBe(14);
  });
  it('17. Schedule provider failure is sanitized to a generic outcome', async () => {
    const p = makeProvider({scheduleFailure:true});
    const r = await runMLBOperationalLiveReadonlyProbe(makeProbe(), p, () => DEFAULT_NOW);
    expect(r.status).toBe('PROVIDER_ERROR'); expect(r.reasons).toEqual(['READ_ONLY_PROVIDER_FAILURE']);
    expect(p.buildGameSnapshot).not.toHaveBeenCalled();
  });
  it('18. Completely invalid provider schedule returns provider error', async () => {
    const p = makeProvider({schedule: {games: null, provenance: makeSchedule().provenance} as unknown as MLBScheduleResult});
    const r = await runMLBOperationalLiveReadonlyProbe(makeProbe(), p, () => DEFAULT_NOW);
    expect(r.status).toBe('PROVIDER_ERROR'); expect(p.buildGameSnapshot).not.toHaveBeenCalled();
  });
  it('19. Missing explicit flag prevents schedule access', async () => {
    const p = makeProvider();
    const r = await runMLBOperationalLiveReadonlyProbe(makeProbe({allowLiveReadonly:false}), p, () => DEFAULT_NOW);
    expect(r.status).toBe('DENIED'); expect(p.fetchSchedule).not.toHaveBeenCalled();
  });
  it('20. Missing acknowledgement prevents schedule access', async () => {
    const p = makeProvider();
    const r = await runMLBOperationalLiveReadonlyProbe(makeProbe({environmentAcknowledgement:undefined}), p, () => DEFAULT_NOW);
    expect(r.status).toBe('DENIED'); expect(p.fetchSchedule).not.toHaveBeenCalled();
  });
  it('21. Invalid date rejected before provider', async () => {
    const p = makeProvider();
    const r = await runMLBOperationalLiveReadonlyProbe(makeProbe({date:'today'}), p, () => DEFAULT_NOW);
    expect(r.status).toBe('DENIED'); expect(p.fetchSchedule).not.toHaveBeenCalled();
  });
  it('22. Nonexistent calendar date rejected', () => {
    expect(checkMLBReadOnlyProbeAuthorization(makeProbe({date:'2027-02-30'}))).toContain('INVALID_DATE');
  });
  it('23. Negative, fractional and unsafe gamePk rejected', () => {
    for (const gamePk of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1,NaN]) {
      expect(checkMLBReadOnlyProbeAuthorization(makeProbe({gamePk}))).toContain('INVALID_GAME_PK');
    }
  });
  it('24. All CLI gates required for a parsed authorized request', () => {
    const r = checkCli(['--date',OFFICIAL_DATE,'--game-pk', String(GAME_PK),'--allow-live-readonly'],'YES');
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.config.gamePk).toBe(GAME_PK); expect(r.config.date).toBe(OFFICIAL_DATE); }
  });
  it('25. Environment-only CLI authorization is denied', () => {
    expect(checkCli(['--date',OFFICIAL_DATE,'--game-pk',String(GAME_PK)], 'YES').ok).toBe(false);
  });
  it('26. Flag-only CLI authorization is denied', () => {
    expect(checkCli(['--date',OFFICIAL_DATE,'--game-pk',String(GAME_PK),'--allow-live-readonly'],undefined).ok).toBe(false);
  });
  it('27. Invalid, ambiguous and unknown CLI arguments fail closed', () => {
    for (const args of [
      ['--game-pk','0','--date',OFFICIAL_DATE,'--allow-live-readonly'],
      ['--date',OFFICIAL_DATE,'--game-pk','1.5','--allow-live-readonly'],
      ['--date',OFFICIAL_DATE,'--date',OFFICIAL_DATE,'--game-pk','1','--allow-live-readonly'],
      ['--date',OFFICIAL_DATE,'--game-pk','1','--allow-live-readonly','--unknown'],
    ]) expect(checkCli(args,'YES').ok).toBe(false);
  });
  it('28. Mode=live does not authorize request without both gates', () => {
    expect(checkCli(['--date',OFFICIAL_DATE,'--game-pk',String(GAME_PK)],undefined).ok).toBe(false);
  });
  it('29. Help is a safe, explicitly non-live mode', async () => {
    const r = await spawnCli(['--help']);
    expect(r.exitCode).toBe(0); expect(r.stdout).toContain('Usage:');
  });
  it('30. Direct CLI without both auth gates fails before network', async () => {
    const r = await spawnCli(['--date',OFFICIAL_DATE,'--game-pk',String(GAME_PK)]);
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr).toContain('LIVE_READONLY_PROBE_NOT_AUTHORIZED');
  });
  it('31. Direct CLI with env-only auth remains rejected', async () => {
    const r = await spawnCli(['--date',OFFICIAL_DATE,'--game-pk',String(GAME_PK)], {MRS_LIVE_READONLY_PROBE_ACK:'YES'});
    expect(r.exitCode).not.toBe(0);
  });
  it('32. Direct CLI with flag-only auth remains rejected', async () => {
    const r = await spawnCli(['--date',OFFICIAL_DATE,'--game-pk',String(GAME_PK),'--allow-live-readonly']);
    expect(r.exitCode).not.toBe(0);
  });
  it('33. Injected offline probe never touches the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network forbidden'));
    try {
      const p = makeProvider();
      const r = await runMLBOperationalLiveReadonlyProbe(makeProbe(), p, () => DEFAULT_NOW);
      expect(r.status).toBe('READY');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
