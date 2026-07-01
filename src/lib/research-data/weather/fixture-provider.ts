import type { GameWeather, WeatherProvider } from '../types';
import { ResearchDataError, ResearchDataValidationError } from '../errors';
import { OPEN_METEO_HOURLY_FIXTURE } from '@/fixtures/research-data/weather/fixtures';

export class WeatherFixtureProvider implements WeatherProvider {
  async fetchGameWeather(
    _latitude: number,
    _longitude: number,
    firstPitchUtc: Date,
    _timezone: string,
  ): Promise<GameWeather> {
    const raw = OPEN_METEO_HOURLY_FIXTURE as {
      hourly: {
        time: string[];
        temperature_2m: number[];
        precipitation_probability: number[];
        precipitation: number[];
        windspeed_10m: number[];
        winddirection_10m: number[];
        relativehumidity_2m: (number | null)[];
      };
    };

    if (!raw?.hourly) {
      throw new ResearchDataValidationError({
        message: 'Weather fixture missing hourly data',
        source: 'weather-fixture',
      });
    }

    const hourly = raw.hourly;
    const targetHour = firstPitchUtc.getUTCHours();
    const targetDate = firstPitchUtc.toISOString().slice(0, 10);

    const candidateIndex = hourly.time.findIndex((t) => {
      const hourDate = new Date(t);
      return hourDate.toISOString().slice(0, 10) === targetDate && hourDate.getUTCHours() === targetHour;
    });

    const index =
      candidateIndex >= 0
        ? candidateIndex
        : hourly.time.findIndex((t) => new Date(t).toISOString().slice(0, 10) === targetDate);

    if (index < 0) {
      throw new ResearchDataError({
        message: 'Weather fixture returned no hourly data for the target date.',
        source: 'weather-fixture',
      });
    }

    const ensureNumber = (value: number | null | undefined, field: string): number => {
      if (value == null) {
        throw new ResearchDataValidationError({
          message: `Missing field ${field} in weather fixture`,
          source: 'weather-fixture',
        });
      }
      return Number(value);
    };

    return {
      temperatureC: ensureNumber(hourly.temperature_2m[index], 'temperature_2m'),
      precipitationProbability: ensureNumber(
        hourly.precipitation_probability[index],
        'precipitation_probability',
      ),
      precipitationMm: ensureNumber(hourly.precipitation[index], 'precipitation'),
      windSpeedKmh: ensureNumber(hourly.windspeed_10m[index], 'windspeed_10m'),
      windDirectionDeg: ensureNumber(hourly.winddirection_10m[index], 'winddirection_10m'),
      humidityPercent:
        hourly.relativehumidity_2m[index] == null ? null : Number(hourly.relativehumidity_2m[index]),
      matchedHourUtc: hourly.time[index],
      rawTimestamp: new Date().toISOString(),
      freshness: {
        source: 'weather-fixture:open-meteo',
        fetchedAt: new Date(),
        isLive: false,
        warnings: [],
      },
    };
  }
}
