import { describe, it, expect } from 'vitest';
import {
  validateProspectiveScheduleSnapshot,
  validatePregameResearchSnapshot,
  validateLockedWeeklyOutput,
  validateOutcomeAttachment,
} from '@/prospective/mlb/weekly-test-schemas';

describe('Phase 4B MLB prospective weekly dry-run: schemas', () => {
  describe('validateProspectiveScheduleSnapshot', () => {
    it('passes for a valid local dry-run schedule snapshot', () => {
      const snapshot = {
        runId: 'run-1',
        createdAt: '2024-07-01T00:00:00Z',
        sourceMode: 'local-dry-run',
        games: [
          {
            gameId: 'game-1',
            officialDate: '2024-07-01',
            scheduledStartTime: '2024-07-01T18:00:00Z',
            awayTeam: 'Away',
            homeTeam: 'Home',
            snapshotTimestamp: '2024-07-01T00:00:00Z',
            sourceProvenance: 'test-provider',
          },
        ],
        warnings: [],
      };

      expect(validateProspectiveScheduleSnapshot(snapshot)).toEqual([]);
    });

    it('returns errors for finalScore in a game', () => {
      const snapshot = {
        runId: 'run-1',
        createdAt: '2024-07-01T00:00:00Z',
        sourceMode: 'local-dry-run',
        games: [
          {
            gameId: 'game-1',
            officialDate: '2024-07-01',
            scheduledStartTime: '2024-07-01T18:00:00Z',
            awayTeam: 'Away',
            homeTeam: 'Home',
            snapshotTimestamp: '2024-07-01T00:00:00Z',
            sourceProvenance: 'test-provider',
            finalScore: { homeScore: 3, awayScore: 2 },
          } as unknown as object,
        ],
        warnings: [],
      };

      const messages = validateProspectiveScheduleSnapshot(snapshot);
      expect(messages.some((m) => m.code === 'FORBIDDEN_FINAL_SCORE')).toBe(true);
    });

    it('returns errors for completedGameState in a game', () => {
      const snapshot = {
        runId: 'run-1',
        createdAt: '2024-07-01T00:00:00Z',
        sourceMode: 'local-dry-run',
        games: [
          {
            gameId: 'game-1',
            officialDate: '2024-07-01',
            scheduledStartTime: '2024-07-01T18:00:00Z',
            awayTeam: 'Away',
            homeTeam: 'Home',
            snapshotTimestamp: '2024-07-01T00:00:00Z',
            sourceProvenance: 'test-provider',
            completedGameState: {},
          } as unknown as object,
        ],
        warnings: [],
      };

      const messages = validateProspectiveScheduleSnapshot(snapshot);
      expect(messages.some((m) => m.code === 'FORBIDDEN_COMPLETED_GAME_STATE')).toBe(true);
    });

    it('returns errors when sourceProvenance is missing', () => {
      const snapshot = {
        runId: 'run-1',
        createdAt: '2024-07-01T00:00:00Z',
        sourceMode: 'local-dry-run',
        games: [
          {
            gameId: 'game-1',
            officialDate: '2024-07-01',
            scheduledStartTime: '2024-07-01T18:00:00Z',
            awayTeam: 'Away',
            homeTeam: 'Home',
            snapshotTimestamp: '2024-07-01T00:00:00Z',
          },
        ],
        warnings: [],
      };

      const messages = validateProspectiveScheduleSnapshot(snapshot);
      expect(messages.some((m) => m.code === 'MISSING_SOURCE_PROVENANCE')).toBe(true);
    });
  });

  describe('validatePregameResearchSnapshot', () => {
    it('passes for a valid pregame research snapshot with modelProbability null', () => {
      const snapshot = {
        runId: 'run-1',
        gameId: 'game-1',
        createdAt: '2024-07-01T00:00:00Z',
        constructionMode: 'TEAM_ONLY',
        evidenceIncluded: ['home-park'],
        evidenceExcluded: ['bullpen'],
        researchStrengthScore: 20,
        confidence: 0.5,
        matchConfidence: 0.4,
        dataQuality: 70,
        volatility: 0.3,
        warnings: [],
        modelProbability: null,
      };

      expect(validatePregameResearchSnapshot(snapshot)).toEqual([]);
    });

    it('returns error when modelProbability is not null', () => {
      const snapshot = {
        runId: 'run-1',
        gameId: 'game-1',
        createdAt: '2024-07-01T00:00:00Z',
        constructionMode: 'FULL',
        evidenceIncluded: [],
        evidenceExcluded: [],
        researchStrengthScore: 0,
        confidence: 0,
        matchConfidence: 0,
        dataQuality: 0,
        volatility: 0,
        warnings: [],
        modelProbability: 0.5,
      };

      const messages = validatePregameResearchSnapshot(snapshot);
      expect(messages.some((m) => m.code === 'INVALID_MODEL_PROBABILITY')).toBe(true);
    });
  });

  describe('validateLockedWeeklyOutput', () => {
    it('passes for a valid locked weekly output', () => {
      const output = {
        runId: 'run-1',
        lockedAt: '2024-07-01T00:00:00Z',
        lockReason: 'first-pitch',
        gamesIncluded: ['game-1'],
        gamesSkippedOrAbstained: [],
        validationStatus: 'pass',
        warnings: [],
      };

      expect(validateLockedWeeklyOutput(output)).toEqual([]);
    });

    it('returns errors when lockedAt or lockReason is missing', () => {
      const output = {
        runId: 'run-1',
        lockReason: 'first-pitch',
        gamesIncluded: [],
        gamesSkippedOrAbstained: [],
        validationStatus: 'pass',
        warnings: [],
      };

      const messages = validateLockedWeeklyOutput(output);
      expect(messages.some((m) => m.code === 'MISSING_LOCKED_AT')).toBe(true);
    });
  });

  describe('validateOutcomeAttachment', () => {
    it('passes for final outcome with finalScore', () => {
      const attachment = {
        runId: 'run-1',
        gameId: 'game-1',
        attachedAt: '2024-07-02T00:00:00Z',
        outcomeStatus: 'final',
        completionProvenance: 'last-play-end',
        finalScore: { awayScore: 2, homeScore: 4 },
      };

      expect(validateOutcomeAttachment(attachment)).toEqual([]);
    });

    it('returns error for non-final outcome with finalScore', () => {
      const attachment = {
        runId: 'run-1',
        gameId: 'game-1',
        attachedAt: '2024-07-02T00:00:00Z',
        outcomeStatus: 'postponed',
        completionProvenance: 'manual',
        finalScore: { awayScore: 2, homeScore: 4 },
      };

      const messages = validateOutcomeAttachment(attachment);
      expect(messages.some((m) => m.code === 'FINAL_SCORE_NOT_FINAL_STATUS')).toBe(true);
    });
  });
});
