import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMLBResearchDataProvider, createWeatherProvider } from '@/lib/research-data/mode';
import { MLBResearchDataAdapter } from '@/lib/research-data/mlb/provider';
import { MLBFixtureProvider } from '@/lib/research-data/mlb/fixture-provider';
import { WeatherProviderAdapter } from '@/lib/research-data/weather/provider';
import { WeatherFixtureProvider } from '@/lib/research-data/weather/fixture-provider';

describe('research-data mode factory', () => {
  const originalMode = process.env.RESEARCH_DATA_MODE;

  beforeEach(() => {
    delete process.env.RESEARCH_DATA_MODE;
  });

  afterEach(() => {
    if (originalMode) {
      process.env.RESEARCH_DATA_MODE = originalMode;
    } else {
      delete process.env.RESEARCH_DATA_MODE;
    }
  });

  it('defaults MLB to fixture mode', () => {
    const provider = createMLBResearchDataProvider();
    expect(provider).toBeInstanceOf(MLBFixtureProvider);
  });

  it('returns live MLB provider when RESEARCH_DATA_MODE=live', () => {
    process.env.RESEARCH_DATA_MODE = 'live';
    const provider = createMLBResearchDataProvider();
    expect(provider).toBeInstanceOf(MLBResearchDataAdapter);
  });

  it('defaults weather to fixture mode', () => {
    const provider = createWeatherProvider();
    expect(provider).toBeInstanceOf(WeatherFixtureProvider);
  });

  it('returns live weather provider when RESEARCH_DATA_MODE=live', () => {
    process.env.RESEARCH_DATA_MODE = 'live';
    const provider = createWeatherProvider();
    expect(provider).toBeInstanceOf(WeatherProviderAdapter);
  });

  it('throws for invalid RESEARCH_DATA_MODE on MLB provider', () => {
    process.env.RESEARCH_DATA_MODE = 'invalid';
    expect(() => createMLBResearchDataProvider()).toThrow(
      'Invalid RESEARCH_DATA_MODE: "invalid". Use "fixture" or "live".',
    );
  });

  it('throws for invalid RESEARCH_DATA_MODE on weather provider', () => {
    process.env.RESEARCH_DATA_MODE = 'invalid';
    expect(() => createWeatherProvider()).toThrow(
      'Invalid RESEARCH_DATA_MODE: "invalid". Use "fixture" or "live".',
    );
  });
});
