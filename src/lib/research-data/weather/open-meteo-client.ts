import { z } from 'zod';
import type { GameWeather, WeatherProvider } from '../types';
import { ResearchDataError, ResearchDataTimeoutError, ResearchDataUnavailableError, ResearchDataValidationError } from '../errors';

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

function readWeatherBaseUrl(): string {
  const raw = process.env.OPEN_METEO_BASE_URL?.trim();
  if (!raw) return OPEN_METEO_BASE;
  try {
    new URL(raw);
    return raw;
  } catch {
    throw new ResearchDataValidationError({
      message: `Invalid OPEN_METEO_BASE_URL: ${raw}`,
      source: 'open-meteo',
    });
  }
}

export function resolveWeatherConfig(): { baseUrl: string } {
  return { baseUrl: readWeatherBaseUrl() };
}

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 500;

const HourlyResponseSchema = z.object({
  time: z.array(z.string()),
  temperature_2m: z.array(z.number()),
  precipitation_probability: z.array(z.number()),
  precipitation: z.array(z.number()),
  windspeed_10m: z.array(z.number()),
  winddirection_10m: z.array(z.number()),
  relativehumidity_2m: z.array(z.number().nullable()),
});

const OpenMeteoResponseSchema = z.object({
  hourly: HourlyResponseSchema,
});

type HourlyResponse = z.infer<typeof HourlyResponseSchema>;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function provenance(): GameWeather['freshness'] {
  return {
    source: 'open-meteo:forecast',
    fetchedAt: new Date(),
    isLive: true,
    warnings: [],
  };
}

function isTransientNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (error instanceof Error && error.message.includes('fetch failed')) return true;
  return false;
}

export class OpenMeteoClient implements WeatherProvider {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? readWeatherBaseUrl();
  }

  async fetchGameWeather(
    latitude: number,
    longitude: number,
    firstPitchUtc: Date,
    _timezone: string,
  ): Promise<GameWeather> {
    const date = firstPitchUtc.toISOString().slice(0, 10);
    const url = new URL(this.baseUrl);
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('hourly', 'temperature_2m,precipitation_probability,precipitation,windspeed_10m,winddirection_10m,relativehumidity_2m');
    url.searchParams.set('start_date', date);
    url.searchParams.set('end_date', date);
    url.searchParams.set('timezone', 'UTC');

    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      try {
        const response = await fetch(url.toString(), {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(
            `Open-Meteo responded ${response.status}: ${response.statusText}`,
          );
        }

        const text = await response.text();
        const parsed = OpenMeteoResponseSchema.parse(JSON.parse(text));
        return this.buildWeather(parsed.hourly, firstPitchUtc);
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error;

        if (error instanceof z.ZodError) throw error;
        if (error instanceof Error && 'name' in error && (error as NodeJS.ErrnoException).name === 'AbortError') {
          throw new ResearchDataTimeoutError({
            message: 'Open-Meteo request timed out',
            source: 'open-meteo',
          });
        }

        if (attempt < MAX_RETRIES - 1 && isTransientNetworkError(error)) {
          const backoff = BASE_DELAY_MS * 2 ** attempt;
          await delay(backoff);
          continue;
        }

        throw new ResearchDataUnavailableError({
          message: `Open-Meteo weather fetch failed: ${error instanceof Error ? error.message : 'unknown error'}`,
          source: 'open-meteo',
        });
      }
    }

    throw new ResearchDataUnavailableError({
      message: `Open-Meteo request failed after ${MAX_RETRIES} attempts`,
      source: 'open-meteo',
    });
  }

  private buildWeather(hourly: HourlyResponse, firstPitchUtc: Date): GameWeather {
    const targetHour = firstPitchUtc.getUTCHours();
    const targetDate = firstPitchUtc.toISOString().slice(0, 10);

    const candidateIndex = hourly.time.findIndex((t) => {
      const hourDate = new Date(t);
      return hourDate.toISOString().slice(0, 10) === targetDate && hourDate.getUTCHours() === targetHour;
    });

    const index =
      candidateIndex >= 0 ? candidateIndex : hourly.time.findIndex((t) => new Date(t).toISOString().slice(0, 10) === targetDate);

    if (index < 0) {
      throw new Error('Open-Meteo returned no hourly data for the target date.');
    }

    const missingFieldWarning = (field: string) =>
      `Open-Meteo missing field: ${field} at ${hourly.time[index]}`;

    const ensureNumber = (value: number | null | undefined, field: string): number => {
      if (value == null) {
        throw new Error(missingFieldWarning(field));
      }
      return Number(value);
    };

    const ensureOptionalNumber = (value: number | null | undefined, field: string): number | null => {
      if (value == null) return null;
      return Number(value);
    };

    return {
      temperatureC: ensureNumber(hourly.temperature_2m[index], 'temperature_2m'),
      precipitationProbability: ensureNumber(hourly.precipitation_probability[index], 'precipitation_probability'),
      precipitationMm: ensureNumber(hourly.precipitation[index], 'precipitation'),
      windSpeedKmh: ensureNumber(hourly.windspeed_10m[index], 'windspeed_10m'),
      windDirectionDeg: ensureNumber(hourly.winddirection_10m[index], 'winddirection_10m'),
      humidityPercent: ensureOptionalNumber(hourly.relativehumidity_2m[index], 'relativehumidity_2m'),
      matchedHourUtc: hourly.time[index],
      rawTimestamp: new Date().toISOString(),
      freshness: provenance(),
    };
  }
}
