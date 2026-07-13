export type MLBProspectiveSourceMode = 'local-dry-run' | 'manual-schedule' | 'authorized-ingestion';
export type MLBProspectiveRunStatus = 'planned' | 'snapshot-created' | 'locked' | 'outcomes-attached' | 'evaluated';
export type MLBProspectiveConstructionMode = 'TEAM_ONLY' | 'FULL';
export type MLBProspectiveOutcomeStatus = 'not-attached' | 'final' | 'postponed' | 'cancelled' | 'suspended';
export type MLBProspectiveValidationSeverity = 'info' | 'warning' | 'error';

export interface MLBProspectiveValidationMessage {
  readonly severity: MLBProspectiveValidationSeverity;
  readonly code: string;
  readonly message: string;
}

export interface MLBProspectiveWeeklyRunManifest {
  readonly runId: string;
  readonly sport: 'MLB';
  readonly weekStart: string;
  readonly weekEnd: string;
  readonly generatedAt: string;
  readonly sourceMode: MLBProspectiveSourceMode;
  readonly status: MLBProspectiveRunStatus;
  readonly warnings: readonly string[];
}

export interface MLBProspectiveGameSnapshot {
  readonly gameId: string;
  readonly officialDate: string;
  readonly scheduledStartTime: string;
  readonly awayTeam: string;
  readonly homeTeam: string;
  readonly snapshotTimestamp: string;
  readonly sourceProvenance: string;
  readonly finalScore?: never;
  readonly completedGameState?: never;
}

export interface MLBProspectiveScheduleSnapshot {
  readonly runId: string;
  readonly createdAt: string;
  readonly sourceMode: MLBProspectiveSourceMode;
  readonly games: readonly MLBProspectiveGameSnapshot[];
  readonly warnings: readonly string[];
}

export interface MLBPregameResearchSnapshot {
  readonly runId: string;
  readonly gameId: string;
  readonly createdAt: string;
  readonly constructionMode: MLBProspectiveConstructionMode;
  readonly evidenceIncluded: readonly string[];
  readonly evidenceExcluded: readonly string[];
  readonly researchStrengthScore: number;
  readonly confidence: number;
  readonly matchConfidence: number;
  readonly dataQuality: number;
  readonly volatility: number;
  readonly warnings: readonly string[];
  readonly modelProbability: null;
}

export interface MLBLockedWeeklyOutput {
  readonly runId: string;
  readonly lockedAt: string;
  readonly lockReason: string;
  readonly gamesIncluded: readonly string[];
  readonly gamesSkippedOrAbstained: readonly string[];
  readonly validationStatus: string;
  readonly warnings: readonly string[];
}

export interface MLBOutcomeAttachment {
  readonly runId: string;
  readonly gameId: string;
  readonly attachedAt: string;
  readonly outcomeStatus: MLBProspectiveOutcomeStatus;
  readonly completionProvenance: string;
  readonly finalScore?: { readonly awayScore: number; readonly homeScore: number } | undefined;
}

export interface MLBWeeklyEvaluationReport {
  readonly runId: string;
  readonly generatedAt: string;
  readonly gamesProcessed: number;
  readonly lockedOutputs: number;
  readonly outcomesAttached: number;
  readonly skipsOrAbstentions: number;
  readonly warningSummary: readonly string[];
  readonly calibrationStatus: string;
  readonly modelProbabilityStatus: string;
}

export function validateProspectiveScheduleSnapshot(input: unknown): MLBProspectiveValidationMessage[] {
  const messages: MLBProspectiveValidationMessage[] = [];

  if (typeof input !== 'object' || input === null) {
    messages.push({ severity: 'error', code: 'INVALID_OBJECT', message: 'schedule snapshot must be an object' });
    return messages;
  }

  const snapshot = input as Record<string, unknown>;

  if (typeof snapshot.runId !== 'string' || snapshot.runId.trim() === '') {
    messages.push({ severity: 'error', code: 'MISSING_RUN_ID', message: 'schedule snapshot requires runId' });
  }

  if (typeof snapshot.createdAt !== 'string' || snapshot.createdAt.trim() === '') {
    messages.push({ severity: 'error', code: 'MISSING_CREATED_AT', message: 'schedule snapshot requires createdAt' });
  }

  if (!['local-dry-run', 'manual-schedule', 'authorized-ingestion'].includes(snapshot.sourceMode as string)) {
    messages.push({ severity: 'error', code: 'INVALID_SOURCE_MODE', message: 'schedule snapshot requires valid sourceMode' });
  }

  const games = snapshot.games;
  if (!Array.isArray(games) || games.length === 0) {
    messages.push({ severity: 'error', code: 'MISSING_GAMES', message: 'schedule snapshot requires at least one game' });
    return messages;
  }

  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    if (typeof game !== 'object' || game === null) {
      messages.push({ severity: 'error', code: 'INVALID_GAME', message: `game[${i}] must be an object` });
      continue;
    }

    const record = game as Record<string, unknown>;
    if ('finalScore' in record) {
      messages.push({ severity: 'error', code: 'FORBIDDEN_FINAL_SCORE', message: `game[${i}] must not contain finalScore` });
    }
    if ('completedGameState' in record) {
      messages.push({ severity: 'error', code: 'FORBIDDEN_COMPLETED_GAME_STATE', message: `game[${i}] must not contain completedGameState` });
    }
    if (typeof record.sourceProvenance !== 'string' || record.sourceProvenance.trim() === '') {
      messages.push({ severity: 'error', code: 'MISSING_SOURCE_PROVENANCE', message: `game[${i}] requires sourceProvenance` });
    }
  }

  return messages;
}

export function validatePregameResearchSnapshot(input: unknown): MLBProspectiveValidationMessage[] {
  const messages: MLBProspectiveValidationMessage[] = [];

  if (typeof input !== 'object' || input === null) {
    messages.push({ severity: 'error', code: 'INVALID_OBJECT', message: 'pregame research snapshot must be an object' });
    return messages;
  }

  const snapshot = input as Record<string, unknown>;

  if (typeof snapshot.runId !== 'string' || snapshot.runId.trim() === '') {
    messages.push({ severity: 'error', code: 'MISSING_RUN_ID', message: 'pregame research snapshot requires runId' });
  }

  if (typeof snapshot.gameId !== 'string' || snapshot.gameId.trim() === '') {
    messages.push({ severity: 'error', code: 'MISSING_GAME_ID', message: 'pregame research snapshot requires gameId' });
  }

  if (typeof snapshot.createdAt !== 'string' || snapshot.createdAt.trim() === '') {
    messages.push({ severity: 'error', code: 'MISSING_CREATED_AT', message: 'pregame research snapshot requires createdAt' });
  }

  if (!['TEAM_ONLY', 'FULL'].includes(snapshot.constructionMode as string)) {
    messages.push({ severity: 'error', code: 'INVALID_CONSTRUCTION_MODE', message: 'pregame research snapshot requires constructionMode TEAM_ONLY or FULL' });
  }

  if (snapshot.modelProbability !== null) {
    messages.push({ severity: 'error', code: 'INVALID_MODEL_PROBABILITY', message: 'pregame research snapshot modelProbability must be null' });
  }

  return messages;
}

export function validateLockedWeeklyOutput(input: unknown): MLBProspectiveValidationMessage[] {
  const messages: MLBProspectiveValidationMessage[] = [];

  if (typeof input !== 'object' || input === null) {
    messages.push({ severity: 'error', code: 'INVALID_OBJECT', message: 'locked weekly output must be an object' });
    return messages;
  }

  const output = input as Record<string, unknown>;

  if (typeof output.runId !== 'string' || output.runId.trim() === '') {
    messages.push({ severity: 'error', code: 'MISSING_RUN_ID', message: 'locked weekly output requires runId' });
  }

  if (typeof output.lockedAt !== 'string' || output.lockedAt.trim() === '') {
    messages.push({ severity: 'error', code: 'MISSING_LOCKED_AT', message: 'locked weekly output requires lockedAt' });
  }

  if (typeof output.lockReason !== 'string' || output.lockReason.trim() === '') {
    messages.push({ severity: 'error', code: 'MISSING_LOCK_REASON', message: 'locked weekly output requires lockReason' });
  }

  if (typeof output.validationStatus !== 'string' || output.validationStatus.trim() === '') {
    messages.push({ severity: 'error', code: 'MISSING_VALIDATION_STATUS', message: 'locked weekly output requires validationStatus' });
  }

  return messages;
}

export function validateOutcomeAttachment(input: unknown): MLBProspectiveValidationMessage[] {
  const messages: MLBProspectiveValidationMessage[] = [];

  if (typeof input !== 'object' || input === null) {
    messages.push({ severity: 'error', code: 'INVALID_OBJECT', message: 'outcome attachment must be an object' });
    return messages;
  }

  const attachment = input as Record<string, unknown>;

  if (typeof attachment.runId !== 'string' || attachment.runId.trim() === '') {
    messages.push({ severity: 'error', code: 'MISSING_RUN_ID', message: 'outcome attachment requires runId' });
  }

  if (typeof attachment.gameId !== 'string' || attachment.gameId.trim() === '') {
    messages.push({ severity: 'error', code: 'MISSING_GAME_ID', message: 'outcome attachment requires gameId' });
  }

  if (typeof attachment.attachedAt !== 'string' || attachment.attachedAt.trim() === '') {
    messages.push({ severity: 'error', code: 'MISSING_ATTACHED_AT', message: 'outcome attachment requires attachedAt' });
  }

  if (!['not-attached', 'final', 'postponed', 'cancelled', 'suspended'].includes(attachment.outcomeStatus as string)) {
    messages.push({ severity: 'error', code: 'INVALID_OUTCOME_STATUS', message: 'outcome attachment requires valid outcomeStatus' });
  }

  if (typeof attachment.completionProvenance !== 'string' || attachment.completionProvenance.trim() === '') {
    messages.push({ severity: 'error', code: 'MISSING_COMPLETION_PROVENANCE', message: 'outcome attachment requires completionProvenance' });
  }

  const outcomeStatus = attachment.outcomeStatus as MLBProspectiveOutcomeStatus | undefined;
  const hasFinalScore = 'finalScore' in attachment && attachment.finalScore !== undefined && attachment.finalScore !== null;
  if (outcomeStatus !== 'final' && hasFinalScore) {
    messages.push({ severity: 'error', code: 'FINAL_SCORE_NOT_FINAL_STATUS', message: 'finalScore is only valid when outcomeStatus is final' });
  }

  if (outcomeStatus === 'final' && !hasFinalScore) {
    messages.push({ severity: 'warning', code: 'FINAL_STATUS_MISSING_FINAL_SCORE', message: 'final outcomeStatus recommends finalScore' });
  }

  return messages;
}
