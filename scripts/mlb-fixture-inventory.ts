import { buildMLBFixtures, getMLBFixtureDateRange } from '@/fixtures/backtesting/mlb/fixture-games';

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

const inventory = {
  startDate,
  endDate,
  totalGames: fixture.games.length,
  gamesByMonth,
  uniqueDateCount: uniqueDates.length,
  juneGameCount: dates.filter((date) => date.startsWith('2024-06')).length,
  julyGameCount: julyDates.length,
  julyDates,
};

process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
