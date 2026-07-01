import { describe, it, expect } from 'vitest';
import { WeatherFixtureProvider } from '@/lib/research-data/weather/fixture-provider';

describe('WeatherFixtureProvider', () => {
  const provider = new WeatherFixtureProvider();

  it('returns deterministic weather for matching hour', async () => {
    const date = new Date('2026-06-26T22:00:00.000Z');
    const result = await provider.fetchGameWeather(0, 0, date, 'UTC');
    expect(result.temperatureC).toBe(20.0);
    expect(result.precipitationProbability).toBe(30);
    expect(result.precipitationMm).toBe(0.3);
    expect(result.windSpeedKmh).toBe(16.0);
    expect(result.windDirectionDeg).toBe(200);
    expect(result.humidityPercent).toBe(63);
    expect(result.matchedHourUtc).toBe('2026-06-26T22:00:00Z');
    expect(result.freshness.isLive).toBe(false);
    expect(result.freshness.source).toBe('weather-fixture:open-meteo');
  });

  it('falls back to same-date first hour when exact hour missing', async () => {
    const date = new Date('2026-06-26T01:00:00.000Z');
    const result = await provider.fetchGameWeather(0, 0, date, 'UTC');
    expect(result.temperatureC).toBe(22.0);
    expect(result.precipitationProbability).toBe(10);
    expect(result.matchedHourUtc).toBe('2026-06-26T18:00:00Z');
  });
});
