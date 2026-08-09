import type {
  MLBCanonicalPregameSnapshot,
  MLBPregameSnapshotValidationIssue,
  MLBPregameSourceReference,
  MLBPregameStartingPitcherSnapshot,
  MLBPregameSnapshotSection,
  MLBPregameSnapshotWarning,
} from './mlb-pregame-snapshot-contract';
import { validateMLBCanonicalPregameSnapshot } from './mlb-pregame-snapshot-contract';
import type {
  CanonicalHistoricalScheduleGame,
  TeamHistoricalAggregate,
  PitcherHistoricalAggregate,
} from '@/lib/backtesting/mlb/live-history/types';

function toIsoString(value: Date): string {
  return value.toISOString();
}

function encodeComponent(value: string): string {
  return `${value.length}:${value}`;
}

function mapGameType(raw: string): 'REGULAR_SEASON' | 'POSTSEASON' | 'SPRING_TRAINING' | 'ALL_STAR' | 'OTHER' {
  switch (raw) {
    case 'R':
      return 'REGULAR_SEASON';
    case 'S':
      return 'SPRING_TRAINING';
    case 'A':
      return 'ALL_STAR';
    case 'P':
    case 'F':
    case 'D':
    case 'L':
    case 'W':
      return 'POSTSEASON';
    case 'I':
      return 'OTHER';
    default:
      throw new Error(`Unsupported rawGameType: ${raw}`);
  }
}

function resolvePregameStatus(
  rawStatus: string,
): 'SCHEDULED' | 'PRE_GAME' | 'POSTPONED' | 'CANCELLED' | 'UNKNOWN' {
  switch (rawStatus) {
    case 'UPCOMING':
      return 'SCHEDULED';
    case 'POSTPONED':
      return 'POSTPONED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'LIVE':
    case 'FINAL':
    default:
      return 'UNKNOWN';
  }
}

function pushUniqueIssue(
  issues: MLBPregameSnapshotValidationIssue[],
  next: MLBPregameSnapshotValidationIssue,
): void {
  const exists = issues.some(
    (item) => item.path === next.path && item.code === next.code,
  );
  if (!exists) {
    issues.push(next);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

export type MLBHistoricalCanonicalSnapshotProvenance = Readonly<{
  readonly sourceRefId: string;
  readonly sourceName: string;
  readonly sourceCategory: MLBPregameSourceReference['sourceCategory'];
  readonly roles: readonly MLBPregameSourceReference['roles'][number][];
  readonly fetchedAt: Date;
  readonly sourceUpdatedAt: Date | null;
}>;

export type MLBHistoricalCanonicalSnapshotProbablePitcher = Readonly<{
  readonly personId: number | null;
  readonly observedAt: Date;
  readonly sourceRefId: string;
}>;

export type MLBHistoricalCanonicalSnapshotAdapterInput = Readonly<{
  readonly scheduleGame: CanonicalHistoricalScheduleGame;
  readonly rawGameType: string;
  readonly cutoff: Date;
  readonly teamAggregates: Readonly<{
    readonly homeBatting: TeamHistoricalAggregate | null;
    readonly awayBatting: TeamHistoricalAggregate | null;
    readonly homeBullpen: TeamHistoricalAggregate | null;
    readonly awayBullpen: TeamHistoricalAggregate | null;
  }>;
  readonly pitcherAggregates: Readonly<{
    readonly home: PitcherHistoricalAggregate | null;
    readonly away: PitcherHistoricalAggregate | null;
  }>;
  readonly venue: {
    readonly id: number;
    readonly name: string;
    readonly latitude: number | null;
    readonly longitude: number | null;
  } | null;
  readonly probablePitchers: Readonly<{
    readonly home: MLBHistoricalCanonicalSnapshotProbablePitcher | null;
    readonly away: MLBHistoricalCanonicalSnapshotProbablePitcher | null;
  }>;
  readonly provenance: ReadonlyArray<MLBHistoricalCanonicalSnapshotProvenance>;
}>;

export type MLBHistoricalCanonicalSnapshotAdapterResult =
  | Readonly<{
      ok: true;
      value: MLBCanonicalPregameSnapshot;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBPregameSnapshotValidationIssue[];
    }>;

function mapPitcher(
  side: 'home' | 'away',
  scheduleGame: CanonicalHistoricalScheduleGame,
  pitcherAggregate: PitcherHistoricalAggregate | null,
  probablePitcher: MLBHistoricalCanonicalSnapshotProbablePitcher | null,
  cutoffMs: number,
): MLBPregameStartingPitcherSnapshot {
  const starterSource =
    side === 'home'
      ? scheduleGame.homeStarterSource
      : scheduleGame.awayStarterSource;

  if (starterSource === 'UNAVAILABLE') {
    return {
      state: 'UNAVAILABLE',
      pitcherId: null,
      announcedAt: null,
      sourceRefIds: [],
    };
  }

  const probableId =
    side === 'home'
      ? scheduleGame.homeProbablePitcherId
      : scheduleGame.awayProbablePitcherId;

  if (probableId === null || probablePitcher === null) {
    return {
      state: 'UNAVAILABLE',
      pitcherId: null,
      announcedAt: null,
      sourceRefIds: [],
    };
  }

  const observedAtMs = probablePitcher.observedAt.getTime();
  if (observedAtMs > cutoffMs) {
    return {
      state: 'UNAVAILABLE',
      pitcherId: null,
      announcedAt: null,
      sourceRefIds: [],
    };
  }

  if (starterSource === 'SCHEDULE_PROBABLE_BEFORE_CUTOFF') {
    return {
      state: 'PROBABLE',
      pitcherId: String(probableId),
      announcedAt: toIsoString(probablePitcher.observedAt),
      sourceRefIds: [probablePitcher.sourceRefId],
    };
  }

  if (starterSource === 'SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN') {
    return {
      state: 'UNAVAILABLE',
      pitcherId: null,
      announcedAt: null,
      sourceRefIds: [],
    };
  }

  return {
    state: 'UNAVAILABLE',
    pitcherId: null,
    announcedAt: null,
    sourceRefIds: [],
  };
}

function buildTeamSection(
  side: 'home' | 'away',
  kind: 'TEAM_SEASON_CONTEXT' | 'BULLPEN_CONTEXT',
  aggregate: TeamHistoricalAggregate | null,
  teamId: string,
  dataCutoffAt: string,
  authorizedSourceRefIds: readonly string[],
): MLBPregameSnapshotSection {
  const sectionId =
    side === 'home'
      ? kind === 'TEAM_SEASON_CONTEXT'
        ? 'section-home-batting'
        : 'section-home-bullpen'
      : kind === 'TEAM_SEASON_CONTEXT'
        ? 'section-away-batting'
        : 'section-away-bullpen';

  const scope =
    side === 'home' && kind === 'TEAM_SEASON_CONTEXT'
      ? 'HOME_TEAM'
      : side === 'away' && kind === 'TEAM_SEASON_CONTEXT'
        ? 'AWAY_TEAM'
        : side === 'home'
          ? 'HOME_TEAM'
          : 'AWAY_TEAM';

  if (aggregate === null) {
    return {
      sectionId,
      kind,
      entity: { scope, entityId: teamId },
      status: 'UNAVAILABLE',
      asOfAt: dataCutoffAt,
      sourceRefIds: authorizedSourceRefIds,
      payload: {},
    };
  }

  const payload: Record<string, unknown> = {
    teamId: aggregate.teamId,
    teamName: '',
    completeness: 'PARTIAL',
    warnings: aggregate.warnings,
    seasonStats: {
      gamesPlayed: aggregate.gamesPlayed,
      wins: aggregate.wins,
      losses: aggregate.losses,
      winRate: aggregate.winRate,
      runsScored: aggregate.runsScored,
      runsAllowed: aggregate.runsAllowed,
      runDifferential: aggregate.runDifferential,
      runsScoredPerGame: aggregate.runsScoredPerGame,
      runsAllowedPerGame: aggregate.runsAllowedPerGame,
    },
  };

  if (kind === 'BULLPEN_CONTEXT') {
    payload.recentWorkload = {
      gamesInPrevious3Days: aggregate.gamesInPrevious3Days,
      extraInningGames: aggregate.extraInningGames,
    };
    payload.confirmedRelieverAvailability = null;
  }

  return {
    sectionId,
    kind,
    entity: { scope, entityId: teamId },
    status: 'AVAILABLE',
    asOfAt: dataCutoffAt,
    sourceRefIds: authorizedSourceRefIds,
    payload,
  };
}

export function buildMLBHistoricalCanonicalPregameSnapshot(
  input: MLBHistoricalCanonicalSnapshotAdapterInput,
): MLBHistoricalCanonicalSnapshotAdapterResult {
  const issues: MLBPregameSnapshotValidationIssue[] = [];

  const scheduleGame = input.scheduleGame;
  const cutoff = input.cutoff;

  if (!isPlainObject(scheduleGame)) {
    pushUniqueIssue(issues, {
      code: 'NOT_PLAIN_OBJECT',
      path: '$.scheduleGame',
      message: 'scheduleGame must be a plain object',
    });
    return { ok: false, issues };
  }

  if (!(cutoff instanceof Date) || Number.isNaN(cutoff.getTime())) {
    pushUniqueIssue(issues, {
      code: 'INVALID_TIMESTAMP_ORDER',
      path: '$.cutoff',
      message: 'cutoff must be a valid Date',
    });
    return { ok: false, issues };
  }

  if (!Array.isArray(input.provenance) || input.provenance.length === 0) {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.provenance',
      message: 'provenance is required and must be non-empty',
    });
    return { ok: false, issues };
  }

  for (let i = 0; i < input.provenance.length; i++) {
    const prov = input.provenance[i];
    if (!isPlainObject(prov)) {
      pushUniqueIssue(issues, {
        code: 'NOT_PLAIN_OBJECT',
        path: `$.provenance[${i}]`,
        message: 'Each provenance entry must be a plain object',
      });
      return { ok: false, issues };
    }
  }

  const cutoffMs = cutoff.getTime();
  const dataCutoffAt = toIsoString(cutoff);
  const capturedAt = dataCutoffAt;
  const gameId = String(scheduleGame.gamePk);
  const officialDate = scheduleGame.officialDate;
  const scheduledStartAt = toIsoString(scheduleGame.scheduledStart);
  const season = scheduleGame.scheduledStart.getUTCFullYear();
  let gameType: 'REGULAR_SEASON' | 'POSTSEASON' | 'SPRING_TRAINING' | 'ALL_STAR' | 'OTHER';
  try {
    gameType = mapGameType(input.rawGameType);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : `Unsupported rawGameType: ${input.rawGameType}`;
    pushUniqueIssue(issues, {
      code: 'INVALID_LITERAL',
      path: '$.rawGameType',
      message,
    });
    return { ok: false, issues };
  }
  const status = resolvePregameStatus(scheduleGame.status);
  const homeTeamId = String(scheduleGame.homeTeamId);
  const awayTeamId = String(scheduleGame.awayTeamId);
  const venueId = scheduleGame.venueId !== null ? String(scheduleGame.venueId) : null;
  const neutralSite: boolean | null = null;

  let doubleheader: { doubleheaderId: string; gameNumber: 1 | 2 } | null = null;
  if (scheduleGame.doubleheader === true) {
    const rawGameNumber = scheduleGame.gameNumber;
    if (rawGameNumber !== 1 && rawGameNumber !== 2) {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.scheduleGame.gameNumber',
        message: 'Unsupported doubleheader gameNumber',
      });
      return { ok: false, issues };
    }
    const doubleheaderId =
      encodeComponent(officialDate) +
      encodeComponent(homeTeamId) +
      encodeComponent(awayTeamId);
    doubleheader = {
      doubleheaderId,
      gameNumber: rawGameNumber as 1 | 2,
    };
  }

  if (cutoffMs >= scheduleGame.scheduledStart.getTime()) {
    pushUniqueIssue(issues, {
      code: 'INVALID_TIMESTAMP_ORDER',
      path: '$.cutoff',
      message: 'cutoff must be before scheduledStartAt',
    });
    return { ok: false, issues };
  }

  const snapshotId = `${gameId}::${cutoffMs}::pregame-snapshot-v1`;

  const sourceRefIds = new Set<string>();
  const sourceReferences: MLBPregameSourceReference[] = [];
  for (let i = 0; i < input.provenance.length; i++) {
    const prov = input.provenance[i];
    const fetchedAt = toIsoString(prov.fetchedAt);
    let sourceUpdatedAt: string | null = null;
    if (prov.sourceUpdatedAt !== null) {
      const sourceUpdatedAtMs = prov.sourceUpdatedAt.getTime();
      if (sourceUpdatedAtMs > cutoffMs) {
        pushUniqueIssue(issues, {
          code: 'INVALID_TIMESTAMP_ORDER',
          path: `$.provenance[${i}].sourceUpdatedAt`,
          message: `sourceUpdatedAt must be <= cutoff for game ${gameId}`,
        });
      } else {
        sourceUpdatedAt = toIsoString(prov.sourceUpdatedAt);
      }
    }

    const sourceRefId = prov.sourceRefId;
    if (sourceRefIds.has(sourceRefId)) {
      pushUniqueIssue(issues, {
        code: 'DUPLICATE_ID',
        path: `$.provenance[${i}].sourceRefId`,
        message: `Duplicate sourceRefId: ${sourceRefId}`,
      });
    } else {
      sourceRefIds.add(sourceRefId);
      sourceReferences.push({
        sourceRefId,
        sourceName: prov.sourceName,
        sourceCategory: prov.sourceCategory,
        roles: [...prov.roles].sort(),
        providerRecordId: null,
        fetchedAt,
        sourceUpdatedAt,
      });
    }
  }

  sourceReferences.sort((a, b) =>
    a.sourceRefId < b.sourceRefId ? -1 : a.sourceRefId > b.sourceRefId ? 1 : 0,
  );

  const authorizedSourceRefIds = sourceReferences.map((ref) => ref.sourceRefId);

  const homePitcher = mapPitcher(
    'home',
    scheduleGame,
    input.pitcherAggregates.home,
    input.probablePitchers.home,
    cutoffMs,
  );
  const awayPitcher = mapPitcher(
    'away',
    scheduleGame,
    input.pitcherAggregates.away,
    input.probablePitchers.away,
    cutoffMs,
  );

  const startingPitchers = {
    home: homePitcher,
    away: awayPitcher,
  };

  const sections: MLBPregameSnapshotSection[] = [];

  sections.push({
    sectionId: 'section-game-context',
    kind: 'GAME_CONTEXT',
    entity: { scope: 'GAME', entityId: null },
    status: 'AVAILABLE',
    asOfAt: dataCutoffAt,
    sourceRefIds: authorizedSourceRefIds,
    payload: {
      officialDate,
      scheduledStartAt,
      status,
      homeTeamName: scheduleGame.homeTeamName,
      awayTeamName: scheduleGame.awayTeamName,
      dayNight: null,
      scheduledInnings: scheduleGame.scheduledInnings,
      seriesDescription: null,
      doubleHeader: scheduleGame.doubleheader,
    } as Record<string, unknown>,
  });

  sections.push({
    sectionId: 'section-home-starter',
    kind: 'STARTING_PITCHER_CONTEXT',
    entity: {
      scope: 'HOME_STARTER',
      entityId: homePitcher.pitcherId ?? String(scheduleGame.homeProbablePitcherId),
    },
    status: homePitcher.state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE',
    asOfAt: dataCutoffAt,
    sourceRefIds: authorizedSourceRefIds,
    payload:
      homePitcher.state === 'UNAVAILABLE'
        ? {}
        : {
            personId: scheduleGame.homeProbablePitcherId,
            fullName: null,
            teamId: scheduleGame.homeTeamId,
            availability: homePitcher.state,
            status: homePitcher.state,
            fetchedAt: homePitcher.announcedAt,
            warnings: [],
          },
  });

  sections.push({
    sectionId: 'section-away-starter',
    kind: 'STARTING_PITCHER_CONTEXT',
    entity: {
      scope: 'AWAY_STARTER',
      entityId: awayPitcher.pitcherId ?? String(scheduleGame.awayProbablePitcherId),
    },
    status: awayPitcher.state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE',
    asOfAt: dataCutoffAt,
    sourceRefIds: authorizedSourceRefIds,
    payload:
      awayPitcher.state === 'UNAVAILABLE'
        ? {}
        : {
            personId: scheduleGame.awayProbablePitcherId,
            fullName: null,
            teamId: scheduleGame.awayTeamId,
            availability: awayPitcher.state,
            status: awayPitcher.state,
            fetchedAt: awayPitcher.announcedAt,
            warnings: [],
          },
  });

  sections.push(
    buildTeamSection(
      'home',
      'TEAM_SEASON_CONTEXT',
      input.teamAggregates.homeBatting,
      homeTeamId,
      dataCutoffAt,
      authorizedSourceRefIds,
    ),
  );
  sections.push(
    buildTeamSection(
      'away',
      'TEAM_SEASON_CONTEXT',
      input.teamAggregates.awayBatting,
      awayTeamId,
      dataCutoffAt,
      authorizedSourceRefIds,
    ),
  );
  sections.push(
    buildTeamSection(
      'home',
      'BULLPEN_CONTEXT',
      input.teamAggregates.homeBullpen,
      homeTeamId,
      dataCutoffAt,
      authorizedSourceRefIds,
    ),
  );
  sections.push(
    buildTeamSection(
      'away',
      'BULLPEN_CONTEXT',
      input.teamAggregates.awayBullpen,
      awayTeamId,
      dataCutoffAt,
      authorizedSourceRefIds,
    ),
  );

  if (input.venue !== null) {
    sections.push({
      sectionId: 'section-venue',
      kind: 'VENUE_PARK_CONTEXT',
      entity: { scope: 'VENUE', entityId: venueId ?? '' },
      status: 'AVAILABLE',
      asOfAt: dataCutoffAt,
      sourceRefIds: authorizedSourceRefIds,
      payload: {
        id: input.venue.id,
        name: input.venue.name,
        latitude: input.venue.latitude,
        longitude: input.venue.longitude,
        timezone: null,
        roofType: null,
        warnings: [],
      } as Record<string, unknown>,
    });
  }

  sections.push({
    sectionId: 'section-weather',
    kind: 'WEATHER_CONTEXT',
    entity: { scope: 'GAME', entityId: null },
    status: 'UNAVAILABLE',
    asOfAt: dataCutoffAt,
    sourceRefIds: authorizedSourceRefIds,
    payload: {},
  });

  const sortedSections = sections
    .map((section) => ({
      ...section,
      sourceRefIds: [...section.sourceRefIds].sort(),
    }))
    .sort((a, b) =>
      a.sectionId < b.sectionId ? -1 : a.sectionId > b.sectionId ? 1 : 0,
    );

  const warnings: MLBPregameSnapshotWarning[] = (scheduleGame.warnings ?? [])
    .map((message) => ({
      code: 'BRIDGE_WARNING',
      path: '$.warnings',
      message,
    }))
    .sort((a, b) => {
      const pathDiff = a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
      if (pathDiff !== 0) return pathDiff;
      const codeDiff = a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
      if (codeDiff !== 0) return codeDiff;
      return a.message < b.message ? -1 : a.message > b.message ? 1 : 0;
    });

  const availableSections = sortedSections.filter(
    (section) => section.kind !== 'WEATHER_CONTEXT' && section.status === 'AVAILABLE',
  );
  const dataCompleteness: MLBCanonicalPregameSnapshot['dataCompleteness'] =
    availableSections.length === sortedSections.length - 1
      ? 'COMPLETE'
      : availableSections.length > 0
        ? 'PARTIAL'
        : 'INSUFFICIENT';

  const candidate = {
    contractVersion: 'mlb-canonical-pregame-snapshot-v1',
    sport: 'MLB' as const,
    target: 'OFFICIAL_FINAL_GAME_WINNER' as const,
    snapshotId,
    capturedAt,
    dataCutoffAt,
    game: {
      gameId,
      scheduledStartAt,
      officialDate,
      season,
      gameType,
      status,
      homeTeamId,
      awayTeamId,
      venueId,
      neutralSite,
      doubleheader,
    },
    startingPitchers,
    sourceReferences,
    sections: sortedSections,
    dataCompleteness,
    warnings,
  };

  const validation = validateMLBCanonicalPregameSnapshot(candidate);
  if (!validation.ok) {
    return { ok: false, issues: validation.issues };
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, value: validation.value };
}
