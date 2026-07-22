import type {
  MLBProspectiveWeeklyRunManifest,
  MLBProspectiveGameSnapshot,
  MLBProspectiveScheduleSnapshot,
  MLBProspectiveSourceMode,
  MLBProspectiveRunStatus,
  MLBPregameResearchSnapshot,
  MLBLockedWeeklyOutput,
  MLBOutcomeAttachment,
  MLBProspectiveOutcomeStatus,
  MLBWeeklyEvaluationReport,
} from './weekly-test-schemas';

const RUN_ID = 'mlb-local-dry-run-2024-07-sample';
const SOURCE_MODE: MLBProspectiveSourceMode = 'local-dry-run';
const WEEK_START = '2024-07-01';
const WEEK_END = '2024-07-07';
const SCHEDULE_SOURCE_PROVENANCE = 'local-deterministic-dry-run';
const CONSTRUCTION_MODE: 'TEAM_ONLY' = 'TEAM_ONLY';

interface LocalGame {
  readonly gameId: string;
  readonly officialDate: string;
  readonly scheduledStartTime: string;
  readonly awayTeam: string;
  readonly homeTeam: string;
  readonly snapshotTimestamp: string;
}

const LOCAL_GAMES: readonly LocalGame[] = [
  {
    gameId: 'local-dry-run-game-1',
    officialDate: '2024-07-01',
    scheduledStartTime: '2024-07-01T18:00:00Z',
    awayTeam: 'LOCAL_AWAY_1',
    homeTeam: 'LOCAL_HOME_1',
    snapshotTimestamp: '2024-07-01T00:00:00Z',
  },
  {
    gameId: 'local-dry-run-game-2',
    officialDate: '2024-07-03',
    scheduledStartTime: '2024-07-03T17:10:00Z',
    awayTeam: 'LOCAL_AWAY_2',
    homeTeam: 'LOCAL_HOME_2',
    snapshotTimestamp: '2024-07-03T00:00:00Z',
  },
  {
    gameId: 'local-dry-run-game-3',
    officialDate: '2024-07-05',
    scheduledStartTime: '2024-07-05T19:15:00Z',
    awayTeam: 'LOCAL_AWAY_1',
    homeTeam: 'LOCAL_HOME_2',
    snapshotTimestamp: '2024-07-05T00:00:00Z',
  },
] as const;

function makeGameSnapshot(
  game: LocalGame,
): MLBProspectiveGameSnapshot {
  return {
    gameId: game.gameId,
    officialDate: game.officialDate,
    scheduledStartTime: game.scheduledStartTime,
    awayTeam: game.awayTeam,
    homeTeam: game.homeTeam,
    snapshotTimestamp: game.snapshotTimestamp,
    sourceProvenance: SCHEDULE_SOURCE_PROVENANCE,
  };
}

export function buildMLBLocalDryRunManifest(): MLBProspectiveWeeklyRunManifest {
  return {
    runId: RUN_ID,
    sport: 'MLB',
    weekStart: WEEK_START,
    weekEnd: WEEK_END,
    generatedAt: '2024-06-30T12:00:00Z',
    sourceMode: SOURCE_MODE,
    status: 'planned' as MLBProspectiveRunStatus,
    warnings: [],
  };
}

export function buildMLBLocalDryRunScheduleSnapshot(): MLBProspectiveScheduleSnapshot {
  return {
    runId: RUN_ID,
    createdAt: '2024-06-30T12:00:01Z',
    sourceMode: SOURCE_MODE,
    games: LOCAL_GAMES.map(makeGameSnapshot),
    warnings: [],
  };
}

export function buildMLBLocalDryRunPregameResearchSnapshots(): readonly MLBPregameResearchSnapshot[] {
  const warnings = ['Local dry-run sample: no real MLB schedule or actual starters used.'];

  return LOCAL_GAMES.map((game) => ({
    runId: RUN_ID,
    gameId: game.gameId,
    createdAt: '2024-06-30T12:00:02Z',
    constructionMode: CONSTRUCTION_MODE,
    evidenceIncluded: ['homePark', 'offense'],
    evidenceExcluded: ['startingPitcher', 'recentStarts', 'bullpen', 'weather'],
    researchStrengthScore: 25,
    confidence: 0.45,
    matchConfidence: 0.35,
    dataQuality: 60,
    volatility: 0.6,
    warnings,
    modelProbability: null,
  }));
}

export function buildMLBLocalDryRunLockedWeeklyOutput(): MLBLockedWeeklyOutput {
  const included = LOCAL_GAMES.map((game) => game.gameId);
  const skippedOrAbstained: readonly string[] = [];

  return {
    runId: RUN_ID,
    lockedAt: '2024-07-01T00:30:00Z',
    lockReason: 'before-first-scheduled-start',
    gamesIncluded: included,
    gamesSkippedOrAbstained: skippedOrAbstained,
    validationStatus: 'pass',
    warnings: ['Locked against pre-game local dry-run schedule snapshot.'],
  };
}

const LOCAL_FINAL_SCORES: Readonly<
  Record<string, readonly [number, number]>
> = {
  'local-dry-run-game-1': [3, 2] as const,
  'local-dry-run-game-2': [1, 4] as const,
  'local-dry-run-game-3': [5, 5] as const,
};

export function buildMLBLocalDryRunOutcomeAttachments(): readonly MLBOutcomeAttachment[] {
  const attachedAt = '2024-07-07T23:59:00Z';
  const completionProvenance = 'last-play-end';

  return LOCAL_GAMES.map((game) => {
    const [awayScore, homeScore] = LOCAL_FINAL_SCORES[game.gameId] ?? [0, 0];
    const status: MLBProspectiveOutcomeStatus = 'final';

    return {
      runId: RUN_ID,
      gameId: game.gameId,
      attachedAt,
      outcomeStatus: status,
      completionProvenance: `${completionProvenance}:${game.gameId}`,
      finalScore: { homeScore, awayScore },
    };
  });
}

export function buildMLBLocalDryRunEvaluationReport(): MLBWeeklyEvaluationReport {
  const outcomesAttached = buildMLBLocalDryRunOutcomeAttachments();
  const finalOutcomes = outcomesAttached.filter((attachment) => {
    const score = attachment.finalScore;
    return score !== undefined && score !== null;
  });

  return {
    runId: RUN_ID,
    generatedAt: '2024-07-07T23:59:59Z',
    gamesProcessed: LOCAL_GAMES.length,
    lockedOutputs: 1,
    outcomesAttached: finalOutcomes.length,
    skipsOrAbstentions: 0,
    warningSummary: [
      'Local dry-run sample: no real MLB schedule or actual starters used.',
      'Local dry-run sample: modelProbability remains null/absent/not available until calibrated.',
    ],
    calibrationStatus: 'not-calibrated',
    modelProbabilityStatus: 'null',
  } satisfies MLBWeeklyEvaluationReport;
}
