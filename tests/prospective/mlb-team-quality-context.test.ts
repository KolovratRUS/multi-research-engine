import { describe, expect, it } from 'vitest';
import {
  TEAM_QUALITY_CONTEXT_MODULE_NAME,
  TEAM_QUALITY_CONTEXT_MODULE_VERSION,
  TEAM_QUALITY_CONTEXT_SCOPE,
  buildTeamQualityContext,
  type TeamQualityContext,
  type TeamQualityContextInputRecord,
  type TeamQualitySideContext,
} from '@/prospective/mlb/team-quality-context';

function buildInputRecord(
  overrides: Partial<TeamQualityContextInputRecord> & {
    gameId: string;
    officialDate: string;
    scheduledStartTime: string;
    awayTeam: string;
    homeTeam: string;
  },
): TeamQualityContextInputRecord {
  return {
    gameId: overrides.gameId,
    officialDate: overrides.officialDate,
    scheduledStartTime: overrides.scheduledStartTime,
    awayTeam: overrides.awayTeam,
    homeTeam: overrides.homeTeam,
  };
}

const target = {
  gameId: 'target-quality',
  officialDate: '2024-07-05',
  scheduledStartTime: '2024-07-05T19:15:00Z',
  awayTeam: 'QUALITY_AWAY_1',
  homeTeam: 'QUALITY_HOME_1',
};

describe('TeamQualityContext builder', () => {
  it('exposes module metadata with TEAM_ONLY scope', () => {
    const context = buildTeamQualityContext(target, []);

    expect(context.moduleVersion).toBe(TEAM_QUALITY_CONTEXT_MODULE_VERSION);
    expect(context.moduleName).toBe(TEAM_QUALITY_CONTEXT_MODULE_NAME);
    expect(context.scope).toBe(TEAM_QUALITY_CONTEXT_SCOPE);
    expect(context.awayTeamQualityContext.teamName).toBe('QUALITY_AWAY_1');
    expect(context.homeTeamQualityContext.teamName).toBe('QUALITY_HOME_1');
  });

  it('returns deterministic insufficient context when no local records exist', () => {
    const context = buildTeamQualityContext(target, []);

    for (const side of [context.awayTeamQualityContext, context.homeTeamQualityContext]) {
      expect(side.status).toBe('insufficient');
      expect(side.reason).toBe('insufficient-local-evidence');
      expect(side.localEvidenceGameCount).toBe(0);
      expect(side.opponentEvidenceGameCount).toBe(0);
      expect(side.recentOpponentEvidenceGameCount).toBe(0);
      expect(side.historicalSampleSizeLabel).toBe('none');
      expect(side.opponentSampleSizeLabel).toBe('none');
      expect(side.qualityContextCompletenessLabel).toBe('insufficient');
      expect(side.volatilityContextLabel).toBe('unavailable');
      expect(side.scheduleAdjustedContextLabel).toBe('unavailable');
      expect(side.dataQuality).toBe('insufficient');
      expect(side.confidence).toBe('low');
      expect(side.researchStrengthScore).toBe('low');
      expect(side.qualityContextWarnings).toEqual([
        'TEAM_QUALITY_CONTEXT_NO_LOCAL_EVIDENCE',
        'TEAM_QUALITY_CONTEXT_SCHEDULE_CONTEXT_UNAVAILABLE',
      ]);
    }
  });

  it('labels thin local samples with thin labels and low confidence', () => {
    const records = [
      buildInputRecord({
        gameId: 'thin-1',
        officialDate: '2024-07-01',
        scheduledStartTime: '2024-07-01T18:30:00Z',
        awayTeam: 'QUALITY_AWAY_1',
        homeTeam: 'QUALITY_OPP_A',
      }),
      buildInputRecord({
        gameId: 'thin-2',
        officialDate: '2024-07-03',
        scheduledStartTime: '2024-07-03T18:30:00Z',
        awayTeam: 'QUALITY_AWAY_1',
        homeTeam: 'QUALITY_OPP_B',
      }),
      buildInputRecord({
        gameId: 'thin-3',
        officialDate: '2024-07-01',
        scheduledStartTime: '2024-07-01T18:30:00Z',
        awayTeam: 'QUALITY_HOME_1',
        homeTeam: 'QUALITY_OPP_C',
      }),
    ];

    const context = buildTeamQualityContext(target, records);

    expect(context.awayTeamQualityContext.localEvidenceGameCount).toBe(2);
    expect(context.awayTeamQualityContext.opponentEvidenceGameCount).toBe(2);
    expect(context.awayTeamQualityContext.recentOpponentEvidenceGameCount).toBe(2);
    expect(context.awayTeamQualityContext.historicalSampleSizeLabel).toBe('thin');
    expect(context.awayTeamQualityContext.opponentSampleSizeLabel).toBe('thin');
    expect(context.awayTeamQualityContext.qualityContextCompletenessLabel).toBe('partial');
    expect(context.awayTeamQualityContext.volatilityContextLabel).toBe('high');
    expect(context.awayTeamQualityContext.dataQuality).toBe('partial');
    expect(context.awayTeamQualityContext.confidence).toBe('low');
    expect(context.awayTeamQualityContext.researchStrengthScore).toBe('low');
    expect(context.awayTeamQualityContext.qualityContextWarnings).toContain(
      'TEAM_QUALITY_CONTEXT_RECENT_SAMPLE_THIN',
    );
    expect(context.awayTeamQualityContext.qualityContextWarnings).toContain(
      'TEAM_QUALITY_CONTEXT_SCHEDULE_CONTEXT_UNAVAILABLE',
    );

    expect(context.homeTeamQualityContext.localEvidenceGameCount).toBe(1);
    expect(context.homeTeamQualityContext.opponentEvidenceGameCount).toBe(1);
    expect(context.homeTeamQualityContext.recentOpponentEvidenceGameCount).toBe(1);
    expect(context.homeTeamQualityContext.historicalSampleSizeLabel).toBe('thin');
    expect(context.homeTeamQualityContext.qualityContextCompletenessLabel).toBe('partial');
    expect(context.homeTeamQualityContext.volatilityContextLabel).toBe('high');
    expect(context.homeTeamQualityContext.dataQuality).toBe('partial');
    expect(context.homeTeamQualityContext.confidence).toBe('low');
    expect(context.homeTeamQualityContext.researchStrengthScore).toBe('low');
  });

  it('labels moderate local samples with moderate labels and medium confidence', () => {
    const records = [
      buildInputRecord({
        gameId: 'mod-away-1',
        officialDate: '2024-07-01',
        scheduledStartTime: '2024-07-01T18:30:00Z',
        awayTeam: 'QUALITY_AWAY_1',
        homeTeam: 'QUALITY_OPP_A',
      }),
      buildInputRecord({
        gameId: 'mod-away-2',
        officialDate: '2024-07-03',
        scheduledStartTime: '2024-07-03T18:30:00Z',
        awayTeam: 'QUALITY_AWAY_1',
        homeTeam: 'QUALITY_OPP_B',
      }),
      buildInputRecord({
        gameId: 'mod-away-3',
        officialDate: '2024-07-05',
        scheduledStartTime: '2024-07-05T18:30:00Z',
        awayTeam: 'QUALITY_AWAY_1',
        homeTeam: 'QUALITY_OPP_C',
      }),
      buildInputRecord({
        gameId: 'mod-away-4',
        officialDate: '2024-07-07',
        scheduledStartTime: '2024-07-07T18:30:00Z',
        awayTeam: 'QUALITY_AWAY_1',
        homeTeam: 'QUALITY_OPP_A',
      }),
      buildInputRecord({
        gameId: 'mod-home-1',
        officialDate: '2024-07-01',
        scheduledStartTime: '2024-07-01T18:30:00Z',
        awayTeam: 'QUALITY_HOME_1',
        homeTeam: 'QUALITY_OPP_A',
      }),
      buildInputRecord({
        gameId: 'mod-home-2',
        officialDate: '2024-07-03',
        scheduledStartTime: '2024-07-03T18:30:00Z',
        awayTeam: 'QUALITY_HOME_1',
        homeTeam: 'QUALITY_OPP_B',
      }),
      buildInputRecord({
        gameId: 'mod-home-3',
        officialDate: '2024-07-05',
        scheduledStartTime: '2024-07-05T18:30:00Z',
        awayTeam: 'QUALITY_HOME_1',
        homeTeam: 'QUALITY_OPP_C',
      }),
    ];

    const context = buildTeamQualityContext(target, records);

    expect(context.awayTeamQualityContext.localEvidenceGameCount).toBe(4);
    expect(context.awayTeamQualityContext.opponentEvidenceGameCount).toBe(3);
    expect(context.awayTeamQualityContext.historicalSampleSizeLabel).toBe('moderate');
    expect(context.awayTeamQualityContext.qualityContextCompletenessLabel).toBe('partial');
    expect(context.awayTeamQualityContext.volatilityContextLabel).toBe('moderate');
    expect(context.awayTeamQualityContext.dataQuality).toBe('partial');
    expect(context.awayTeamQualityContext.confidence).toBe('medium');
    expect(context.awayTeamQualityContext.researchStrengthScore).toBe('medium');

    expect(context.homeTeamQualityContext.localEvidenceGameCount).toBe(3);
    expect(context.homeTeamQualityContext.opponentEvidenceGameCount).toBe(3);
    expect(context.homeTeamQualityContext.historicalSampleSizeLabel).toBe('moderate');
    expect(context.homeTeamQualityContext.qualityContextCompletenessLabel).toBe('partial');
    expect(context.homeTeamQualityContext.volatilityContextLabel).toBe('moderate');
    expect(context.homeTeamQualityContext.dataQuality).toBe('partial');
    expect(context.homeTeamQualityContext.confidence).toBe('medium');
    expect(context.homeTeamQualityContext.researchStrengthScore).toBe('medium');
  });

  it('labels broad local samples with broad labels and high confidence', () => {
    const awayRecords: TeamQualityContextInputRecord[] = [];
    const homeRecords: TeamQualityContextInputRecord[] = [];
    const opponents = ['QUALITY_OPP_A', 'QUALITY_OPP_B', 'QUALITY_OPP_C'];
    for (let index = 0; index < 6; index++) {
      awayRecords.push(
        buildInputRecord({
          gameId: `broad-away-${index + 1}`,
          officialDate: `2024-07-0${index + 1}`,
          scheduledStartTime: `2024-07-0${index + 1}T18:30:00Z`,
          awayTeam: 'QUALITY_AWAY_1',
          homeTeam: opponents[index % opponents.length],
        }),
      );
      homeRecords.push(
        buildInputRecord({
          gameId: `broad-home-${index + 1}`,
          officialDate: `2024-07-0${index + 1}`,
          scheduledStartTime: `2024-07-0${index + 1}T18:30:00Z`,
          awayTeam: opponents[index % opponents.length],
          homeTeam: 'QUALITY_HOME_1',
        }),
      );
    }

    const context = buildTeamQualityContext(target, [...awayRecords, ...homeRecords]);

    expect(context.awayTeamQualityContext.localEvidenceGameCount).toBe(6);
    expect(context.awayTeamQualityContext.opponentEvidenceGameCount).toBe(3);
    expect(context.awayTeamQualityContext.recentOpponentEvidenceGameCount).toBe(3);
    expect(context.awayTeamQualityContext.historicalSampleSizeLabel).toBe('broad');
    expect(context.awayTeamQualityContext.opponentSampleSizeLabel).toBe('moderate');
    expect(context.awayTeamQualityContext.qualityContextCompletenessLabel).toBe('complete');
    expect(context.awayTeamQualityContext.volatilityContextLabel).toBe('low');
    expect(context.awayTeamQualityContext.dataQuality).toBe('usable');
    expect(context.awayTeamQualityContext.confidence).toBe('high');
    expect(context.awayTeamQualityContext.researchStrengthScore).toBe('high');

    expect(context.homeTeamQualityContext.localEvidenceGameCount).toBe(6);
    expect(context.homeTeamQualityContext.opponentEvidenceGameCount).toBe(3);
    expect(context.homeTeamQualityContext.historicalSampleSizeLabel).toBe('broad');
    expect(context.homeTeamQualityContext.qualityContextCompletenessLabel).toBe('complete');
    expect(context.homeTeamQualityContext.dataQuality).toBe('usable');
    expect(context.homeTeamQualityContext.confidence).toBe('high');
    expect(context.homeTeamQualityContext.researchStrengthScore).toBe('high');
  });

  it('counts opponent evidence and emits missing-opponent warnings when appropriate', () => {
    const records = [
      buildInputRecord({
        gameId: 'same-opp-1',
        officialDate: '2024-07-01',
        scheduledStartTime: '2024-07-01T18:30:00Z',
        awayTeam: 'QUALITY_AWAY_1',
        homeTeam: 'QUALITY_OPP_A',
      }),
      buildInputRecord({
        gameId: 'same-opp-2',
        officialDate: '2024-07-03',
        scheduledStartTime: '2024-07-03T18:30:00Z',
        awayTeam: 'QUALITY_AWAY_1',
        homeTeam: 'QUALITY_OPP_A',
      }),
    ];

    const context = buildTeamQualityContext(target, records);

    expect(context.awayTeamQualityContext.opponentEvidenceGameCount).toBe(1);
    expect(context.awayTeamQualityContext.recentOpponentEvidenceGameCount).toBe(1);
    expect(context.awayTeamQualityContext.qualityContextWarnings).toContain(
      'TEAM_QUALITY_CONTEXT_INSUFFICIENT_OPPONENT_EVIDENCE',
    );
  });

  it('marks scheduleAdjustedContextLabel unavailable without optional schedule context', () => {
    const records = [
      buildInputRecord({
        gameId: 'sched-1',
        officialDate: '2024-07-01',
        scheduledStartTime: '2024-07-01T18:30:00Z',
        awayTeam: 'QUALITY_AWAY_1',
        homeTeam: 'QUALITY_OPP_A',
      }),
    ];

    const context = buildTeamQualityContext(target, records);

    expect(context.awayTeamQualityContext.scheduleAdjustedContextLabel).toBe('unavailable');
    expect(context.awayTeamQualityContext.qualityContextWarnings).toContain(
      'TEAM_QUALITY_CONTEXT_SCHEDULE_CONTEXT_UNAVAILABLE',
    );
  });

  it('dedupes and sorts qualityContextWarnings deterministically', () => {
    const records = [
      buildInputRecord({
        gameId: 'dup-warn',
        officialDate: '2024-07-01',
        scheduledStartTime: '2024-07-01T18:30:00Z',
        awayTeam: 'QUALITY_AWAY_1',
        homeTeam: 'QUALITY_OPP_A',
      }),
    ];

    const context = buildTeamQualityContext(target, records);

    const awayWarnings = context.awayTeamQualityContext.qualityContextWarnings;
    expect(awayWarnings).toEqual([...new Set(awayWarnings)].sort());
    expect(awayWarnings).toEqual(awayWarnings.slice().sort());
  });

  it('ignores invalid-timestamp records and emits an invalid-timestamp warning', () => {
    const records = [
      buildInputRecord({
        gameId: 'invalid-ts',
        officialDate: '2024-07-01',
        scheduledStartTime: 'not-a-timestamp',
        awayTeam: 'QUALITY_AWAY_1',
        homeTeam: 'QUALITY_OPP_A',
      }),
      buildInputRecord({
        gameId: 'valid-ts',
        officialDate: '2024-07-03',
        scheduledStartTime: '2024-07-03T18:30:00Z',
        awayTeam: 'QUALITY_AWAY_1',
        homeTeam: 'QUALITY_OPP_A',
      }),
    ];

    const context = buildTeamQualityContext(target, records);

    expect(context.awayTeamQualityContext.localEvidenceGameCount).toBe(1);
    expect(context.awayTeamQualityContext.qualityContextWarnings).toContain(
      'TEAM_QUALITY_CONTEXT_INVALID_TIMESTAMP',
    );
  });

  it('does not serialize forbidden fields in quality context output', () => {
    const context = buildTeamQualityContext(target, []);

    const json = JSON.stringify(context);
    for (const field of [
      'modelProbability',
      'predictedWinner',
      'pick',
      'winChance',
      'powerRating',
      'teamRank',
      'standingsPosition',
      'finalScore',
      'outcome',
      'completedGameState',
      'finalStatus',
      'actualStartingPitchers',
      'pitcher',
      'odds',
      'sportsbook',
      'market',
      'price',
    ]) {
      expect(json).not.toContain(`"${field}"`);
    }
  });

  it('produces deterministic output across repeated calls', () => {
    const records = [
      buildInputRecord({
        gameId: 'det-1',
        officialDate: '2024-07-01',
        scheduledStartTime: '2024-07-01T18:30:00Z',
        awayTeam: 'QUALITY_AWAY_1',
        homeTeam: 'QUALITY_OPP_A',
      }),
      buildInputRecord({
        gameId: 'det-2',
        officialDate: '2024-07-03',
        scheduledStartTime: '2024-07-03T18:30:00Z',
        awayTeam: 'QUALITY_HOME_1',
        homeTeam: 'QUALITY_OPP_B',
      }),
    ];

    const first = buildTeamQualityContext(target, records);
    const second = buildTeamQualityContext(target, records);

    expect(first).toEqual(second);
  });
});
