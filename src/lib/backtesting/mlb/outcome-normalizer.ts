import type { HistoricalMLBGame, MLBGameOutcome } from '../types';

export interface NormalizedMLBOutcome {
  gamePk: number;
  eventDate: string;
  homeScore: number | null;
  awayScore: number | null;
  winner: 'HOME' | 'AWAY' | 'TIE' | null;
  innings: number | null;
  status: 'FINAL' | 'CANCELLED' | 'POSTPONED' | 'SUSPENDED' | 'UNKNOWN';
  voided: boolean;
}

export function normalizeHistoricalMLBOutcome(
  game: HistoricalMLBGame,
  outcome: MLBGameOutcome,
): NormalizedMLBOutcome {
  const eventDate = game.officialDate;
  if (game.status === 'FINAL' && !['CANCELLED', 'POSTPONED', 'SUSPENDED'].includes(outcome.status)) {
    return {
      gamePk: game.gamePk,
      eventDate,
      homeScore: outcome.homeScore,
      awayScore: outcome.awayScore,
      winner: outcome.winner ?? deriveWinner(outcome),
      innings: outcome.innings,
      status: 'FINAL',
      voided: false,
    };
  }
  const voided = ['CANCELLED', 'POSTPONED', 'SUSPENDED'].includes(outcome.status);
  return {
    gamePk: game.gamePk,
    eventDate,
    homeScore: null,
    awayScore: null,
    winner: null,
    innings: null,
    status: (outcome.status === 'CANCELLED' ? 'CANCELLED' : outcome.status === 'POSTPONED' ? 'POSTPONED' : outcome.status === 'SUSPENDED' ? 'SUSPENDED' : 'UNKNOWN') as NormalizedMLBOutcome['status'],
    voided,
  };
}

function deriveWinner(outcome: MLBGameOutcome): 'HOME' | 'AWAY' | 'TIE' | null {
  if (outcome.homeScore == null || outcome.awayScore == null) return null;
  if (outcome.homeScore > outcome.awayScore) return 'HOME';
  if (outcome.awayScore > outcome.homeScore) return 'AWAY';
  return 'TIE';
}

export function outcomeToWinner(outcome: MLBGameOutcome): 'HOME' | 'AWAY' | 'TIE' | null {
  if (outcome.winner) return outcome.winner;
  return deriveWinner(outcome);
}

export function isVoided(outcome: MLBGameOutcome): boolean {
  return ['CANCELLED', 'POSTPONED', 'SUSPENDED'].includes(outcome.status);
}
