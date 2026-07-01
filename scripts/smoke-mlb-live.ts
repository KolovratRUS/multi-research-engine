import { MLBResearchDataAdapter } from '@/lib/research-data/mlb/provider';
import { WeatherProviderAdapter } from '@/lib/research-data/weather/provider';
import { ResearchDataValidationError } from '@/lib/research-data/errors';

function parseArgs() {
  const dateArg = process.argv.find((arg) => arg.startsWith('--date='));
  return dateArg ? dateArg.slice('--date='.length) : '2026-06-26';
}

async function main() {
  if ((process.env.RESEARCH_DATA_MODE ?? '').trim() !== 'live') {
    console.error('Error: set RESEARCH_DATA_MODE=live before running the smoke test.');
    process.exit(1);
  }

  const date = parseArgs();
  console.log(`Requested date: ${date}`);

  const adapter = new MLBResearchDataAdapter();
  const weatherProvider = new WeatherProviderAdapter();

  let schedule;
  try {
    schedule = await adapter.fetchSchedule(date);
  } catch (err) {
    if (err instanceof Error) {
      console.error(`Schedule fetch failed: ${err.message}`);
    } else {
      console.error('Schedule fetch failed: unknown error');
    }
    process.exit(1);
  }

  console.log(`Games found: ${schedule.games.length}`);
  const games = schedule.games.slice(0, 2);
  console.log(`Games processed: ${games.length}`);

  for (const game of games) {
    const teams = `${game.awayTeamName} @ ${game.homeTeamName}`;
    console.log(`Teams: ${teams}`);

    const pitchers = await adapter.fetchProbablePitchers(
      game.gamePk,
      {
        home: game.probablePitchers.home,
        away: game.probablePitchers.away,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
      },
    );
    const homePitcher =
      pitchers.home && pitchers.home.availability === 'AVAILABLE'
        ? `home=${pitchers.home.fullName}`
        : 'home=unavailable';
    const awayPitcher =
      pitchers.away && pitchers.away.availability === 'AVAILABLE'
        ? `away=${pitchers.away.fullName}`
        : 'away=unavailable';
    console.log(`Probable pitchers: ${homePitcher}, ${awayPitcher}`);
    if (pitchers.provenance.warnings.length > 0) {
      for (const warning of pitchers.provenance.warnings) {
        console.log(`Pitcher warning: ${warning}`);
      }
    }

    const snapshot = await adapter.buildGameSnapshot(game, {
      season: 2026,
      includeWeather: true,
      weatherProvider,
    });

    console.log(`Venue: ${snapshot.venue?.name ?? 'unknown'}`);

    const pitcherSeasonAvailable =
      (snapshot.pitcherStats.home?.seasonStats !== null && snapshot.pitcherStats.home?.seasonStats !== undefined) ||
      (snapshot.pitcherStats.away?.seasonStats !== null && snapshot.pitcherStats.away?.seasonStats !== undefined);

    console.log(`Pitcher season data: ${pitcherSeasonAvailable ? 'yes' : 'no'}`);

    const teamBattingAvailable =
      snapshot.teamBatting.home?.seasonStats !== null ||
      snapshot.teamBatting.away?.seasonStats !== null;
    console.log(`Team batting data: ${teamBattingAvailable ? 'yes' : 'no'}`);

    const weatherWarning = snapshot.warnings.find((w) => w.includes('Weather unavailable'));
    console.log(`Weather: ${snapshot.weather ? 'yes' : `no (${weatherWarning ?? 'warning'})`}`);

    console.log(`Completeness: ${snapshot.completeness.toFixed(2)}`);
    console.log(`Warning count: ${snapshot.warnings.length}`);
    console.log('---');
  }
}

main().catch((err) => {
  if (err instanceof ResearchDataValidationError) {
    console.error(`Configuration error: ${err.message}`);
  } else {
    console.error(`Smoke test failed: ${err instanceof Error ? err.message : 'unknown error'}`);
  }
  process.exit(1);
});
