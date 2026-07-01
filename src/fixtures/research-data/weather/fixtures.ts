export const OPEN_METEO_HOURLY_FIXTURE = {
  latitude: 42.34,
  longitude: -83.05,
  generationtime_ms: 2.5,
  utc_offset_seconds: 0,
  timezone: 'UTC',
  timezone_abbreviation: 'UTC',
  elevation: 180.0,
  hourly_units: {
    time: 'UTC',
    temperature_2m: '°C',
    relativehumidity_2m: '%',
  },
  hourly: {
    time: ['2026-06-26T18:00:00Z', '2026-06-26T22:00:00Z'],
    temperature_2m: [22.0, 20.0],
    precipitation_probability: [10, 30],
    precipitation: [0.0, 0.3],
    windspeed_10m: [15.0, 16.0],
    winddirection_10m: [190, 200],
    relativehumidity_2m: [65, 63],
  },
};
