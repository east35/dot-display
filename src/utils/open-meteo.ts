export interface DailyForecast {
  date: string; // YYYY-MM-DD
  code: number;
  tempMax: number; // °F
  tempMin: number; // °F
}

export interface WeatherData {
  current: { temp: number; code: number };
  daily: DailyForecast[];
  fetchedAt: number;
}

interface OpenMeteoResponse {
  current: { temperature_2m: number; weather_code: number };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}

const REFRESH_MS = 30 * 60 * 1000;

export class OpenMeteoClient {
  private lat: number;
  private lon: number;
  private cache: WeatherData | null = null;
  private inflight: Promise<WeatherData> | null = null;

  constructor(lat: number, lon: number) {
    this.lat = lat;
    this.lon = lon;
  }

  async getWeather(): Promise<WeatherData> {
    if (this.cache && Date.now() - this.cache.fetchedAt < REFRESH_MS) {
      return this.cache;
    }
    if (this.inflight) return this.inflight;
    this.inflight = this.fetch().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async fetch(): Promise<WeatherData> {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(this.lat));
    url.searchParams.set("longitude", String(this.lon));
    url.searchParams.set("current", "temperature_2m,weather_code");
    url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min");
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("forecast_days", "3");
    url.searchParams.set("timezone", "auto");

    const res = await fetch(url);
    if (!res.ok) throw new Error(`open-meteo: ${res.status} ${res.statusText}`);
    const json = (await res.json()) as OpenMeteoResponse;

    const daily: DailyForecast[] = json.daily.time.map((date, i) => ({
      date,
      code: json.daily.weather_code[i]!,
      tempMax: json.daily.temperature_2m_max[i]!,
      tempMin: json.daily.temperature_2m_min[i]!,
    }));

    const data: WeatherData = {
      current: { temp: json.current.temperature_2m, code: json.current.weather_code },
      daily,
      fetchedAt: Date.now(),
    };
    this.cache = data;
    return data;
  }
}

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export function dayAbbr(isoDate: string): string {
  // Parse as local midnight so getDay() matches the local calendar day.
  const d = new Date(`${isoDate}T00:00:00`);
  return DAY_NAMES[d.getDay()]!;
}
