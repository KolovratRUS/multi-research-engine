import type { MLBResearchDataProvider } from './types';
import type { WeatherProvider } from './types';
import { MLBResearchDataAdapter } from './mlb/provider';
import { WeatherProviderAdapter } from './weather/provider';
import { MLBFixtureProvider } from './mlb/fixture-provider';
import { WeatherFixtureProvider } from './weather/fixture-provider';
import { ResearchDataValidationError } from './errors';

export function createMLBResearchDataProvider(): MLBResearchDataProvider {
  const mode = (process.env.RESEARCH_DATA_MODE ?? 'fixture').trim();
  if (mode === 'live') return new MLBResearchDataAdapter();
  if (mode === 'fixture') return new MLBFixtureProvider();
  throw new ResearchDataValidationError({
    message: `Invalid RESEARCH_DATA_MODE: "${mode}". Use "fixture" or "live".`,
    source: 'research-data-mode',
  });
}

export function createWeatherProvider(): WeatherProvider {
  const mode = (process.env.RESEARCH_DATA_MODE ?? 'fixture').trim();
  if (mode === 'live') return new WeatherProviderAdapter();
  if (mode === 'fixture') return new WeatherFixtureProvider();
  throw new ResearchDataValidationError({
    message: `Invalid RESEARCH_DATA_MODE: "${mode}". Use "fixture" or "live".`,
    source: 'research-data-mode',
  });
}
