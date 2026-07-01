export interface DateWindow {
  start: Date;
  end: Date;
}

export interface ChronologicalSplit {
  train: DateWindow;
  validation: DateWindow;
  holdout: DateWindow;
}

export interface BacktestWindowConfig {
  dateFrom: string;
  dateTo: string;
  validationFraction?: number;
  holdoutFraction?: number;
}

export function parseDateInput(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }
  return date;
}

export function createDateWindow(from: string, to: string): DateWindow {
  const start = parseDateInput(from);
  const end = parseDateInput(to);
  if (start > end) {
    throw new Error(`Date window start ${from} is after end ${to}`);
  }
  return { start, end };
}

export function createChronologicalSplit(config: BacktestWindowConfig): ChronologicalSplit {
  const window = createDateWindow(config.dateFrom, config.dateTo);
  const totalMs = window.end.getTime() - window.start.getTime();
  const validationFraction = config.validationFraction ?? 0.2;
  const holdoutFraction = config.holdoutFraction ?? 0.1;

  if (validationFraction + holdoutFraction >= 1) {
    throw new Error('Validation and holdout fractions must sum to less than 1');
  }

  const validationMs = totalMs * validationFraction;
  const holdoutMs = totalMs * holdoutFraction;

  const trainEnd = new Date(window.start.getTime() + totalMs - validationMs - holdoutMs);
  const validationEnd = new Date(trainEnd.getTime() + validationMs);

  return {
    train: { start: window.start, end: trainEnd },
    validation: { start: trainEnd, end: validationEnd },
    holdout: { start: validationEnd, end: window.end },
  };
}

export function assertNoOverlap(split: ChronologicalSplit): void {
  if (split.train.end > split.validation.start) {
    throw new Error('Train window overlaps validation window');
  }
  if (split.validation.end > split.holdout.start) {
    throw new Error('Validation window overlaps holdout window');
  }
  if (split.train.start >= split.validation.end) {
    throw new Error('Train window is not before validation window');
  }
  if (split.validation.start >= split.holdout.end) {
    throw new Error('Validation window is not before holdout window');
  }
}

export function assertNoDuplicateGames(games: { gamePk: number }[]): void {
  const seen = new Set<number>();
  for (const game of games) {
    if (seen.has(game.gamePk)) {
      throw new Error(`Duplicate gamePk detected: ${game.gamePk}`);
    }
    seen.add(game.gamePk);
  }
}

export function assignDateToSplit(date: Date, split: ChronologicalSplit): 'TRAIN' | 'VALIDATION' | 'HOLDOUT' | null {
  if (date >= split.train.start && date < split.train.end) return 'TRAIN';
  if (date >= split.validation.start && date < split.validation.end) return 'VALIDATION';
  if (date >= split.holdout.start && date <= split.holdout.end) return 'HOLDOUT';
  return null;
}

export function sortGamesByDate(
  games: { gamePk: number; gameDate: string | Date }[],
): { gamePk: number; gameDate: string }[] {
  return games
    .slice()
    .sort((a, b) => {
      const aDate = typeof a.gameDate === 'string' ? new Date(a.gameDate).getTime() : a.gameDate.getTime();
      const bDate = typeof b.gameDate === 'string' ? new Date(b.gameDate).getTime() : b.gameDate.getTime();
      return aDate - bDate;
    })
    .map((g) => ({
      gamePk: g.gamePk,
      gameDate: typeof g.gameDate === 'string' ? g.gameDate : g.gameDate.toISOString(),
    }));
}
