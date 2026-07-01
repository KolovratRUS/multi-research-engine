import type { GameWeather, WeatherProvider } from '../types';
import { OpenMeteoClient, resolveWeatherConfig } from './open-meteo-client';

export class WeatherProviderAdapter implements WeatherProvider {
  async fetchGameWeather(
    latitude: number,
    longitude: number,
    firstPitchUtc: Date,
    timezone: string,
  ): Promise<GameWeather> {
    const client = new OpenMeteoClient(resolveWeatherConfig().baseUrl);
    return client.fetchGameWeather(latitude, longitude, firstPitchUtc, timezone);
  }
}
