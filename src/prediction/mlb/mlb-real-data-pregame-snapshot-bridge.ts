import type {
  DataProvenance,
  MLBGameResearchSnapshot,
  MLBScheduleGame,
  PitcherAssignment,
} from '@/lib/research-data/types';
import type {
  MLBCanonicalPregameSnapshot,
  MLBPregameSnapshotValidationIssue,
  MLBPregameSourceCategory,
  MLBPregameSourceReference,
  MLBPregameSourceRole,
  MLBPregameStartingPitcherSnapshot,
  MLBPregameSnapshotSection,
  MLBPregameSnapshotWarning,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';
import {
  validateMLBCanonicalPregameSnapshot,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';
import {
  assertNoOddsContamination,
  isProhibitedOddsBoundaryKey,
} from '@/prediction/firewall/odds-contamination-guard';

export type MLBRealDataPregameSnapshotBridgeInput = Readonly<{
  scheduleGame: MLBScheduleGame;
  researchSnapshot: MLBGameResearchSnapshot;
}>;

export type MLBRealDataPregameSnapshotBridgeIssue =
  MLBPregameSnapshotValidationIssue;

export type MLBRealDataPregameSnapshotBridgeResult =
  | Readonly<{
      ok: true;
      value: MLBCanonicalPregameSnapshot;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBRealDataPregameSnapshotBridgeIssue[];
    }>;

function addUniqueIssue(
  issues: MLBRealDataPregameSnapshotBridgeIssue[],
  next: MLBRealDataPregameSnapshotBridgeIssue,
): void {
  const exists = issues.some(
    (item) => item.path === next.path && item.code === next.code,
  );
  if (!exists) {
    issues.push(next);
  }
}

function pushIssue(
  code: MLBRealDataPregameSnapshotBridgeIssue['code'],
  path: string,
  message: string,
  issues: MLBRealDataPregameSnapshotBridgeIssue[],
): void {
  addUniqueIssue(issues, { code, path, message });
}

function toIsoString(value: Date): string {
  return value.toISOString();
}

function encodeComponent(value: string): string {
  return `${value.length}:${value}`;
}

function mapGameType(raw: string):
  | 'REGULAR_SEASON'
  | 'POSTSEASON'
  | 'SPRING_TRAINING'
  | 'ALL_STAR'
  | 'OTHER' {
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
      throw new Error(`UNSUPPORTED_GAME_TYPE:${raw}`);
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

function resolveSourceCategory(
  source: string,
): MLBPregameSourceCategory {
  if (source.startsWith('mlb-stats-api')) {
    return 'OFFICIAL';
  }
  if (source.includes('weather')) {
    return 'WEATHER';
  }
  return 'SUPPLEMENTAL';
}

function resolveSourceRoles(source: string): MLBPregameSourceRole[] {
  if (source === 'mlb-stats-api:schedule') {
    return [
      'GAME_IDENTITY',
      'SCHEDULE_CONTEXT',
      'TEAM_PLAYER_IDENTITY',
    ];
  }
  if (source === 'mlb-stats-api:venue') {
    return ['VENUE_PARK'];
  }
  if (source === 'mlb-stats-api:probablePitchers') {
    return ['STARTING_PITCHER'];
  }
  if (source.includes('pitcher')) {
    return ['PITCHER_STATS'];
  }
  if (source.includes('teamBatting')) {
    return ['TEAM_STATS'];
  }
  if (source.includes('bullpen')) {
    return ['BULLPEN'];
  }
  if (source.includes('weather')) {
    return ['WEATHER'];
  }
  return ['SCHEDULE_CONTEXT'];
}

function mapStartingPitcher(
  pitcher: PitcherAssignment | null,
  authorizedSourceRefIds: readonly string[],
): MLBPregameStartingPitcherSnapshot {
  if (pitcher === null) {
    return {
      state: 'UNAVAILABLE',
      pitcherId: null,
      announcedAt: null,
      sourceRefIds: [],
    };
  }

  if (pitcher.availability === 'UNAVAILABLE') {
    return {
      state: 'UNAVAILABLE',
      pitcherId: null,
      announcedAt: null,
      sourceRefIds: [],
    };
  }

  let state: MLBPregameStartingPitcherSnapshot['state'];
  switch (pitcher.status) {
    case 'CONFIRMED':
      state = 'CONFIRMED';
      break;
    case 'PROBABLE':
      state = 'PROBABLE';
      break;
    case 'CHANGED':
      state = 'UNCONFIRMED';
      break;
    default:
      state = 'UNCONFIRMED';
      break;
  }

  return {
    state,
    pitcherId: String(pitcher.personId),
    announcedAt: toIsoString(pitcher.fetchedAt),
    sourceRefIds: authorizedSourceRefIds,
  };
}

function sanitizeValue(value: unknown, depth = 0): Record<string, unknown> | unknown[] | unknown {
  if (depth > 6) {
    return null;
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === 'object' && isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (val !== undefined) {
        result[key] = sanitizeValue(val, depth + 1);
      }
    }
    return result;
  }
  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function buildSourceReference(
  provenance: DataProvenance,
): MLBPregameSourceReference {
  return {
    sourceRefId: provenance.source,
    sourceName: provenance.source,
    sourceCategory: resolveSourceCategory(provenance.source),
    roles: resolveSourceRoles(provenance.source),
    providerRecordId: null,
    fetchedAt: toIsoString(provenance.fetchedAt),
    sourceUpdatedAt: provenance.sourceTimestamp?.toISOString() ?? null,
  };
}

function getPitcherEntityId(
  pitcher: PitcherAssignment | null,
): string | null {
  if (pitcher === null || pitcher.availability !== 'AVAILABLE') {
    return null;
  }
  return String(pitcher.personId);
}

function deriveSections(
  input: MLBRealDataPregameSnapshotBridgeInput,
  dataCutoffAt: string,
  authorizedSourceRefIds: readonly string[],
): MLBPregameSnapshotSection[] {
  const { scheduleGame, researchSnapshot } = input;
  const gameId = String(scheduleGame.gamePk);
  const homeTeamId = String(scheduleGame.homeTeamId);
  const awayTeamId = String(scheduleGame.awayTeamId);
  const venueId = String(scheduleGame.venueId);

  const sections: MLBPregameSnapshotSection[] = [];

  sections.push({
    sectionId: 'section-game-context',
    kind: 'GAME_CONTEXT',
    entity: { scope: 'GAME', entityId: null },
    status: 'AVAILABLE',
    asOfAt: dataCutoffAt,
    sourceRefIds: authorizedSourceRefIds,
    payload: sanitizeValue({
      officialDate: scheduleGame.officialDate,
      scheduledStartAt: scheduleGame.startTimeUtc.toISOString(),
      status: researchSnapshot.event.status,
      homeTeamName: scheduleGame.homeTeamName,
      awayTeamName: scheduleGame.awayTeamName,
      dayNight: scheduleGame.dayNight,
      scheduledInnings: scheduleGame.scheduledInnings,
      seriesDescription: scheduleGame.seriesDescription,
      doubleHeader: scheduleGame.doubleHeader,
      doubleHeaderGameNumber:
        String(scheduleGame.doubleHeader).trim() === 'Y' ||
        String(scheduleGame.doubleHeader).trim() === 'S'
          ? ((scheduleGame.gameNumber === 1 || scheduleGame.gameNumber === 2)
              ? (scheduleGame.gameNumber as 1 | 2)
              : undefined)
          : undefined,
    }) as Record<string, unknown>,
  });

  const homePitcher = researchSnapshot.probablePitchers.home;
  sections.push({
    sectionId: 'section-home-starter',
    kind: 'STARTING_PITCHER_CONTEXT',
    entity: {
      scope: 'HOME_STARTER',
      entityId: getPitcherEntityId(homePitcher),
    },
    status: homePitcher ? 'AVAILABLE' : 'UNAVAILABLE',
    asOfAt: dataCutoffAt,
    sourceRefIds: authorizedSourceRefIds,
    payload: sanitizeValue(
      homePitcher && homePitcher.availability === 'AVAILABLE'
        ? {
            personId: homePitcher.personId,
            fullName: homePitcher.fullName,
            teamId: homePitcher.teamId,
            status: homePitcher.status,
            fetchedAt: homePitcher.fetchedAt.toISOString(),
            warnings: homePitcher.warnings,
          }
        : {},
    ) as Record<string, unknown>,
  });

  const awayPitcher = researchSnapshot.probablePitchers.away;
  sections.push({
    sectionId: 'section-away-starter',
    kind: 'STARTING_PITCHER_CONTEXT',
    entity: {
      scope: 'AWAY_STARTER',
      entityId: getPitcherEntityId(awayPitcher),
    },
    status: awayPitcher ? 'AVAILABLE' : 'UNAVAILABLE',
    asOfAt: dataCutoffAt,
    sourceRefIds: authorizedSourceRefIds,
    payload: sanitizeValue(
      awayPitcher && awayPitcher.availability === 'AVAILABLE'
        ? {
            personId: awayPitcher.personId,
            fullName: awayPitcher.fullName,
            teamId: awayPitcher.teamId,
            status: awayPitcher.status,
            fetchedAt: awayPitcher.fetchedAt.toISOString(),
            warnings: awayPitcher.warnings,
          }
        : {},
    ) as Record<string, unknown>,
  });

  const homeBatting = researchSnapshot.teamBatting.home;
  sections.push({
    sectionId: 'section-home-batting',
    kind: 'TEAM_SEASON_CONTEXT',
    entity: { scope: 'HOME_TEAM', entityId: homeTeamId },
    status: homeBatting ? 'AVAILABLE' : 'UNAVAILABLE',
    asOfAt: dataCutoffAt,
    sourceRefIds: authorizedSourceRefIds,
    payload: sanitizeValue(
      homeBatting
        ? {
            teamId: homeBatting.teamId,
            teamName: homeBatting.teamName,
            completeness: homeBatting.completeness,
            warnings: homeBatting.warnings,
            seasonStats: homeBatting.seasonStats,
            homeAwaySplit: homeBatting.homeAwaySplit,
            recentFormWindow: homeBatting.recentFormWindow,
          }
        : {},
    ) as Record<string, unknown>,
  });

  const awayBatting = researchSnapshot.teamBatting.away;
  sections.push({
    sectionId: 'section-away-batting',
    kind: 'TEAM_SEASON_CONTEXT',
    entity: { scope: 'AWAY_TEAM', entityId: awayTeamId },
    status: awayBatting ? 'AVAILABLE' : 'UNAVAILABLE',
    asOfAt: dataCutoffAt,
    sourceRefIds: authorizedSourceRefIds,
    payload: sanitizeValue(
      awayBatting
        ? {
            teamId: awayBatting.teamId,
            teamName: awayBatting.teamName,
            completeness: awayBatting.completeness,
            warnings: awayBatting.warnings,
            seasonStats: awayBatting.seasonStats,
            homeAwaySplit: awayBatting.homeAwaySplit,
            recentFormWindow: awayBatting.recentFormWindow,
          }
        : {},
    ) as Record<string, unknown>,
  });

  const homeBullpen = researchSnapshot.bullpen.home;
  sections.push({
    sectionId: 'section-home-bullpen',
    kind: 'BULLPEN_CONTEXT',
    entity: { scope: 'HOME_TEAM', entityId: homeTeamId },
    status: homeBullpen ? 'AVAILABLE' : 'UNAVAILABLE',
    asOfAt: dataCutoffAt,
    sourceRefIds: authorizedSourceRefIds,
    payload: sanitizeValue(
      homeBullpen
        ? {
            teamId: homeBullpen.teamId,
            teamName: homeBullpen.teamName,
            completeness: homeBullpen.completeness,
            warnings: homeBullpen.warnings,
            seasonStats: homeBullpen.seasonStats,
            ...(homeBullpen.recentWorkload !== null
              ? { recentWorkload: homeBullpen.recentWorkload }
              : {}),
            confirmedRelieverAvailability: homeBullpen.confirmedRelieverAvailability,
          }
        : {},
    ) as Record<string, unknown>,
  });

  const awayBullpen = researchSnapshot.bullpen.away;
  sections.push({
    sectionId: 'section-away-bullpen',
    kind: 'BULLPEN_CONTEXT',
    entity: { scope: 'AWAY_TEAM', entityId: awayTeamId },
    status: awayBullpen ? 'AVAILABLE' : 'UNAVAILABLE',
    asOfAt: dataCutoffAt,
    sourceRefIds: authorizedSourceRefIds,
    payload: sanitizeValue(
      awayBullpen
        ? {
            teamId: awayBullpen.teamId,
            teamName: awayBullpen.teamName,
            completeness: awayBullpen.completeness,
            warnings: awayBullpen.warnings,
            seasonStats: awayBullpen.seasonStats,
            ...(awayBullpen.recentWorkload !== null
              ? { recentWorkload: awayBullpen.recentWorkload }
              : {}),
            confirmedRelieverAvailability: awayBullpen.confirmedRelieverAvailability,
          }
        : {},
    ) as Record<string, unknown>,
  });

  if (researchSnapshot.venue !== null) {
    sections.push({
      sectionId: 'section-venue',
      kind: 'VENUE_PARK_CONTEXT',
      entity: { scope: 'VENUE', entityId: venueId },
      status: 'AVAILABLE',
      asOfAt: dataCutoffAt,
      sourceRefIds: authorizedSourceRefIds,
      payload: sanitizeValue({
        id: researchSnapshot.venue.id,
        name: researchSnapshot.venue.name,
        latitude: researchSnapshot.venue.latitude,
        longitude: researchSnapshot.venue.longitude,
        timezone: researchSnapshot.venue.timezone,
        roofType: researchSnapshot.venue.roofType,
        warnings: researchSnapshot.venue.warnings,
      }) as Record<string, unknown>,
    });
  } else {
    sections.push({
      sectionId: 'section-venue',
      kind: 'VENUE_PARK_CONTEXT',
      entity: { scope: 'VENUE', entityId: venueId },
      status: 'UNAVAILABLE',
      asOfAt: dataCutoffAt,
      sourceRefIds: authorizedSourceRefIds,
      payload: {},
    });
  }

  if (researchSnapshot.weather !== null) {
    sections.push({
      sectionId: 'section-weather',
      kind: 'WEATHER_CONTEXT',
      entity: { scope: 'GAME', entityId: null },
      status: 'AVAILABLE',
      asOfAt: dataCutoffAt,
      sourceRefIds: authorizedSourceRefIds,
      payload: sanitizeValue({
        temperatureC: researchSnapshot.weather.temperatureC,
        precipitationProbability: researchSnapshot.weather.precipitationProbability,
        precipitationMm: researchSnapshot.weather.precipitationMm,
        windSpeedKmh: researchSnapshot.weather.windSpeedKmh,
        windDirectionDeg: researchSnapshot.weather.windDirectionDeg,
        humidityPercent: researchSnapshot.weather.humidityPercent,
        matchedHourUtc: researchSnapshot.weather.matchedHourUtc,
        rawTimestamp: researchSnapshot.weather.rawTimestamp,
      }) as Record<string, unknown>,
    });
  } else {
    sections.push({
      sectionId: 'section-weather',
      kind: 'WEATHER_CONTEXT',
      entity: { scope: 'GAME', entityId: null },
      status: 'UNAVAILABLE',
      asOfAt: dataCutoffAt,
      sourceRefIds: authorizedSourceRefIds,
      payload: {},
    });
  }

  return sections;
}

function buildCanonicalSnapshot(
  input: MLBRealDataPregameSnapshotBridgeInput,
  authorizedSourceRefIds: readonly string[],
): MLBCanonicalPregameSnapshot {
  const { scheduleGame, researchSnapshot } = input;
  const provenance = researchSnapshot.provenance;
  const fetchedAts = provenance.map((p) => p.fetchedAt.getTime());
  const dataCutoffAtMs = Math.max(...fetchedAts);
  const dataCutoffAt = new Date(dataCutoffAtMs).toISOString();
  const capturedAt = dataCutoffAt;
  const scheduledStartAt = scheduleGame.startTimeUtc.toISOString();

  const canonicalStatus = resolvePregameStatus(researchSnapshot.event.status);
  const gameId = String(scheduleGame.gamePk);
  const snapshotId = `${gameId}::${dataCutoffAtMs}::pregame-snapshot-v1`;

  const completeness = researchSnapshot.completeness;
  let dataCompleteness: MLBCanonicalPregameSnapshot['dataCompleteness'];
  if (completeness >= 100) {
    dataCompleteness = 'COMPLETE';
  } else if (completeness > 0) {
    dataCompleteness = 'PARTIAL';
  } else {
    dataCompleteness = 'INSUFFICIENT';
  }

  const sourceReferences: MLBPregameSourceReference[] = provenance
    .map((p) => buildSourceReference(p))
    .sort((a, b) =>
      a.sourceRefId < b.sourceRefId ? -1 : a.sourceRefId > b.sourceRefId ? 1 : 0,
    );

  const startingPitchers = {
    home: mapStartingPitcher(
      researchSnapshot.probablePitchers.home,
      authorizedSourceRefIds,
    ),
    away: mapStartingPitcher(
      researchSnapshot.probablePitchers.away,
      authorizedSourceRefIds,
    ),
  };

  const sections = deriveSections(input, dataCutoffAt, authorizedSourceRefIds);

  const warnings: MLBPregameSnapshotWarning[] = (researchSnapshot.warnings ?? [])
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

  const sortedSections = sections
    .map((section) => ({
      ...section,
      sourceRefIds: [...section.sourceRefIds].sort(),
    }))
    .sort((a, b) =>
      a.sectionId < b.sectionId ? -1 : a.sectionId > b.sectionId ? 1 : 0,
    );

  let doubleheader: null | { doubleheaderId: string; gameNumber: 1 | 2 } = null;
  const rawDoubleHeader = String(scheduleGame.doubleHeader).trim();
  if (rawDoubleHeader === 'Y' || rawDoubleHeader === 'S') {
    const rawGameNumber = scheduleGame.gameNumber;
    if (rawGameNumber !== 1 && rawGameNumber !== 2) {
      throw new Error('UNSUPPORTED_DOUBLEHEADER_GAME_NUMBER');
    }
    const homeTeamId = String(scheduleGame.homeTeamId);
    const awayTeamId = String(scheduleGame.awayTeamId);
    const doubleheaderId =
      encodeComponent(scheduleGame.officialDate) +
      encodeComponent(homeTeamId) +
      encodeComponent(awayTeamId);
    doubleheader = {
      doubleheaderId,
      gameNumber: rawGameNumber as 1 | 2,
    };
  } else if (rawDoubleHeader !== 'N') {
    throw new Error(`UNSUPPORTED_DOUBLEHEADER:${rawDoubleHeader}`);
  }

  const season = Number(scheduleGame.gameDate.slice(0, 4));
  const gameType = mapGameType(scheduleGame.gameType);

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
      officialDate: scheduleGame.officialDate,
      season,
      gameType,
      status: canonicalStatus,
      homeTeamId: String(scheduleGame.homeTeamId),
      awayTeamId: String(scheduleGame.awayTeamId),
      venueId: String(scheduleGame.venueId),
      neutralSite: null,
      doubleheader,
    },
    startingPitchers,
    sourceReferences,
    sections: sortedSections,
    dataCompleteness,
    warnings,
  };

  return candidate as unknown as MLBCanonicalPregameSnapshot;
}

export function buildMLBRealDataPregameSnapshot(
  input: MLBRealDataPregameSnapshotBridgeInput,
): MLBRealDataPregameSnapshotBridgeResult {
  const issues: MLBRealDataPregameSnapshotBridgeIssue[] = [];

  const scheduleGame = input.scheduleGame;
  const researchSnapshot = input.researchSnapshot;

  if (!isPlainObject(scheduleGame)) {
    pushIssue('NOT_PLAIN_OBJECT', '$.scheduleGame', 'scheduleGame must be a plain object', issues);
    return { ok: false, issues };
  }

  if (!isPlainObject(researchSnapshot)) {
    pushIssue('NOT_PLAIN_OBJECT', '$.researchSnapshot', 'researchSnapshot must be a plain object', issues);
    return { ok: false, issues };
  }

  if (!isPlainObject(researchSnapshot.event)) {
    pushIssue('NOT_PLAIN_OBJECT', '$.researchSnapshot.event', 'event must be a plain object', issues);
    return { ok: false, issues };
  }

  if (!Array.isArray(researchSnapshot.provenance) || researchSnapshot.provenance.length === 0) {
    pushIssue('MISSING_FIELD', '$.researchSnapshot.provenance', 'provenance is required and must be non-empty', issues);
    return { ok: false, issues };
  }

  for (let i = 0; i < researchSnapshot.provenance.length; i++) {
    const prov = researchSnapshot.provenance[i];
    if (!isPlainObject(prov)) {
      pushIssue('NOT_PLAIN_OBJECT', `$.researchSnapshot.provenance[${i}]`, 'Each provenance entry must be a plain object', issues);
      return { ok: false, issues };
    }
  }

  const gameId = String(scheduleGame.gamePk);
  if (researchSnapshot.event.externalId !== gameId) {
    pushIssue('INVALID_STRING', '$.researchSnapshot.event.externalId', `externalId must match scheduleGame.gamePk (${gameId})`, issues);
  }

  if (scheduleGame.homeTeamName !== researchSnapshot.event.homeTeam) {
    pushIssue('INVALID_STRING', '$.researchSnapshot.event.homeTeam', 'homeTeam must match scheduleGame.homeTeamName', issues);
  }

  if (scheduleGame.awayTeamName !== researchSnapshot.event.awayTeam) {
    pushIssue('INVALID_STRING', '$.researchSnapshot.event.awayTeam', 'awayTeam must match scheduleGame.awayTeamName', issues);
  }

  const scheduleStartMs = scheduleGame.startTimeUtc.getTime();
  const researchStartMs = researchSnapshot.event.startTimeUtc.getTime();
  if (scheduleStartMs !== researchStartMs) {
    pushIssue('INVALID_TIMESTAMP_ORDER', '$.researchSnapshot.event.startTimeUtc', 'startTimeUtc must match scheduleGame.startTimeUtc', issues);
  }

  let gameTypeOk = true;
  try {
    mapGameType(scheduleGame.gameType);
  } catch {
    gameTypeOk = false;
  }
  if (!gameTypeOk) {
    pushIssue('INVALID_LITERAL', '$.scheduleGame.gameType', `Unsupported gameType: ${scheduleGame.gameType}`, issues);
  }

  const rawDoubleHeader = String(scheduleGame.doubleHeader).trim();
  if (rawDoubleHeader !== 'N' && rawDoubleHeader !== 'Y' && rawDoubleHeader !== 'S') {
    pushIssue('INVALID_LITERAL', '$.scheduleGame.doubleHeader', `Unsupported doubleHeader indicator: ${rawDoubleHeader}`, issues);
  }

  const rawStatus = researchSnapshot.event.status;
  if (
    rawStatus === 'LIVE' ||
    rawStatus === 'FINAL' ||
    rawStatus === 'POSTPONED' ||
    rawStatus === 'CANCELLED'
  ) {
    pushIssue('INVALID_LITERAL', '$.researchSnapshot.event.status', `status must be a pregame status, got ${rawStatus}`, issues);
  }

  const fetchedAts = researchSnapshot.provenance.map((p) => p.fetchedAt.getTime());
  const dataCutoffAtMs = Math.max(...fetchedAts);
  if (dataCutoffAtMs >= scheduleStartMs) {
    pushIssue('INVALID_TIMESTAMP_ORDER', '$.researchSnapshot.provenance', 'dataCutoffAt must be earlier than scheduledStartAt', issues);
  }

  const authorizedSourceRefIds = researchSnapshot.provenance.map((p) => p.source);

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  try {
    const candidate = buildCanonicalSnapshot(input, authorizedSourceRefIds);
    const validation = validateMLBCanonicalPregameSnapshot(candidate);
    if (!validation.ok) {
      return { ok: false, issues: validation.issues };
    }
    return { ok: true, value: validation.value };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.startsWith('UNSUPPORTED_') ? 'INVALID_LITERAL' : 'INVALID_TIMESTAMP_ORDER';
    pushIssue(code, '$.bridge', message, issues);
    return { ok: false, issues };
  }
}
