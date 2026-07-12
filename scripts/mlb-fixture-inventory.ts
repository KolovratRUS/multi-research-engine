import { buildMLBFixtures, getMLBFixtureDateRange } from '@/fixtures/backtesting/mlb/fixture-games';

export interface MLBInventoryDateSummary {
  readonly date: string;
  readonly gameCount: number;
}

export interface MLBInventoryMonthSummary {
  readonly month: string;
  readonly gameCount: number;
  readonly uniqueDateCount: number;
  readonly dates: readonly string[];
}

export interface MLBLocalSliceSummary {
  readonly label: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly gameCount: number;
  readonly dates: readonly string[];
}

export interface MLBFixtureInventory {
  readonly startDate: string;
  readonly endDate: string;
  readonly totalGames: number;
  readonly gamesByMonth: Readonly<Record<string, number>>;
  readonly uniqueDateCount: number;
  readonly juneGameCount: number;
  readonly julyGameCount: number;
  readonly julyDates: readonly string[];
  readonly monthSummaries: readonly MLBInventoryMonthSummary[];
  readonly dateSummaries: readonly MLBInventoryDateSummary[];
  readonly localSliceSummaries: readonly MLBLocalSliceSummary[];
}

const LOCAL_JULY_SLICES = [
  { label: 'july-slice01', startDate: '2024-07-01', endDate: '2024-07-07' as const },
  { label: 'july-slice02', startDate: '2024-07-08', endDate: '2024-07-14' as const },
  { label: 'july-slice03', startDate: '2024-07-15', endDate: '2024-07-21' as const },
] as const;

export function buildMLBFixtureInventory(): MLBFixtureInventory {
  const fixture = buildMLBFixtures();
  const { startDate, endDate } = getMLBFixtureDateRange(fixture);

  const dates = fixture.games.map((game) => game.officialDate);
  const gamesByMonth = dates.reduce<Record<string, number>>((acc, date) => {
    const month = date.slice(0, 7);
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});

  const uniqueDates = [...new Set(dates)].sort();
  const julyDates = uniqueDates.filter((date) => date.startsWith('2024-07'));

  const datesByCount = dates.reduce<Record<string, number>>((acc, date) => {
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});

  const monthMap = new Map<string, string[]>();
  for (const date of uniqueDates) {
    const month = date.slice(0, 7);
    if (!monthMap.has(month)) {
      monthMap.set(month, []);
    }
    monthMap.get(month)!.push(date);
  }
  const monthSummaries = Array.from(monthMap.entries())
    .map<MLBInventoryMonthSummary>(([month, ds]) => {
      const sortedDates = ds.sort();
      const gameCount = sortedDates.reduce((sum, d) => sum + (datesByCount[d] ?? 0), 0);
      return { month, gameCount, uniqueDateCount: sortedDates.length, dates: sortedDates };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  const dateSummaries = uniqueDates.map<MLBInventoryDateSummary>((date) => ({
    date,
    gameCount: datesByCount[date] ?? 0,
  }));

  const localSliceSummaries = LOCAL_JULY_SLICES.map<MLBLocalSliceSummary>(({ label, startDate: sliceStart, endDate: sliceEnd }) => {
    const sliceDates = uniqueDates.filter((d) => d >= sliceStart && d <= sliceEnd).sort();
    const gameCount = sliceDates.reduce((sum, d) => sum + (datesByCount[d] ?? 0), 0);
    return { label, startDate: sliceStart, endDate: sliceEnd, gameCount, dates: sliceDates };
  });

  const inventory: MLBFixtureInventory = {
    startDate,
    endDate,
    totalGames: fixture.games.length,
    gamesByMonth,
    uniqueDateCount: uniqueDates.length,
    juneGameCount: dates.filter((date) => date.startsWith('2024-06')).length,
    julyGameCount: julyDates.length,
    julyDates,
    monthSummaries,
    dateSummaries,
    localSliceSummaries,
  };

  return inventory;
}

const inventory = buildMLBFixtureInventory();
process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
