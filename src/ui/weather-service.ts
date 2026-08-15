import {
  getSolarTerm,
  isLeavesSeason,
  isSakuraSeason,
  type SolarTerm,
} from './solar-terms';

export type WeatherVisual =
  | 'clear'
  | 'sakura'
  | 'leaves'
  | 'rain'
  | 'drizzle'
  | 'snow'
  | 'fog'
  | 'thunderstorm';

export type WeatherSnapshot = {
  city: string;
  lat: number;
  lng: number;
  temp: number;
  code: number;
  label: string;
  phenomenon: WeatherVisual;
  phenomenonLabel: string;
  isDay: boolean;
  solarTerm: SolarTerm;
  source: 'geo' | 'ip' | 'fallback';
  fetchedAt: number;
};

export type WeatherLocateFallback = {
  city?: string;
  lat?: number;
  lng?: number;
};

const CACHE_KEY = 'askuary_weather_v1';
const CACHE_TTL_MS = 20 * 60 * 1000;

const WMO_LABEL: Record<number, string> = {
  0: '晴',
  1: '晴间多云',
  2: '多云',
  3: '阴',
  45: '雾',
  48: '雾凇',
  51: '毛毛雨',
  53: '毛毛雨',
  55: '毛毛雨',
  61: '小雨',
  63: '中雨',
  65: '大雨',
  71: '小雪',
  73: '中雪',
  75: '大雪',
  80: '阵雨',
  81: '阵雨',
  82: '暴雨',
  85: '阵雪',
  86: '阵雪',
  95: '雷雨',
  96: '雷雨冰雹',
  99: '雷雨冰雹',
};

function classifyPhenomenon(
  code: number,
  temp: number,
  date = new Date(),
): { id: WeatherVisual; label: string } {
  if (code === 45 || code === 48) return { id: 'fog', label: code === 48 ? '雾凇' : '雾' };
  if ([51, 53, 55].includes(code)) return { id: 'drizzle', label: '毛毛雨' };
  if ([61, 63, 65, 80, 81, 82].includes(code)) return { id: 'rain', label: WMO_LABEL[code] || '雨' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { id: 'snow', label: WMO_LABEL[code] || '雪' };
  if ([95, 96, 99].includes(code)) return { id: 'thunderstorm', label: '雷雨' };

  // 晴好：按二十四节气决定樱花 / 落叶
  if (code <= 3) {
    if (isSakuraSeason(date) && temp >= 5) return { id: 'sakura', label: '樱花' };
    if (isLeavesSeason(date)) return { id: 'leaves', label: '落叶' };
    return { id: 'clear', label: WMO_LABEL[code] || '晴好' };
  }

  return { id: 'clear', label: WMO_LABEL[code] || '天气' };
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

type Coords = { lat: number; lng: number; city: string; source: WeatherSnapshot['source'] };

async function locateByIp(): Promise<Coords | null> {
  const ipwho = (await fetchJson('https://ipwho.is/')) as {
    success?: boolean;
    latitude?: number;
    longitude?: number;
    city?: string;
  } | null;
  if (ipwho?.success && typeof ipwho.latitude === 'number' && typeof ipwho.longitude === 'number') {
    return {
      lat: ipwho.latitude,
      lng: ipwho.longitude,
      city: String(ipwho.city || '').trim() || '当前位置',
      source: 'ip',
    };
  }

  const ipapi = (await fetchJson('https://ipapi.co/json/')) as {
    error?: boolean;
    latitude?: number;
    longitude?: number;
    city?: string;
  } | null;
  if (
    ipapi &&
    !ipapi.error &&
    typeof ipapi.latitude === 'number' &&
    typeof ipapi.longitude === 'number'
  ) {
    return {
      lat: ipapi.latitude,
      lng: ipapi.longitude,
      city: String(ipapi.city || '').trim() || '当前位置',
      source: 'ip',
    };
  }

  return null;
}

function locateByGeo(timeoutMs = 7000): Promise<Coords | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(timer);
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          city: '当前位置',
          source: 'geo',
        });
      },
      () => {
        window.clearTimeout(timer);
        resolve(null);
      },
      { timeout: timeoutMs, maximumAge: 600000, enableHighAccuracy: false },
    );
  });
}

const GEO_CACHE_KEY = 'askuary_geocode_v1';
const GEO_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function geoCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function readGeoCache(lat: number, lng: number): string | null {
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, { name: string; at: number }>;
    const hit = map[geoCacheKey(lat, lng)];
    if (!hit?.name || Date.now() - hit.at > GEO_CACHE_TTL_MS) return null;
    return hit.name;
  } catch {
    return null;
  }
}

function writeGeoCache(lat: number, lng: number, name: string): void {
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, { name: string; at: number }>;
    map[geoCacheKey(lat, lng)] = { name, at: Date.now() };
    const keys = Object.keys(map);
    if (keys.length > 80) {
      for (const k of keys.slice(0, keys.length - 80)) delete map[k];
    }
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

async function reverseCity(lat: number, lng: number): Promise<string | null> {
  const cached = readGeoCache(lat, lng);
  if (cached) return cached;

  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    language: 'zh',
    count: '1',
  });
  const data = (await fetchJson(`https://geocoding-api.open-meteo.com/v1/reverse?${q}`)) as {
    results?: Array<{ name?: string; admin1?: string }>;
  } | null;
  const first = data?.results?.[0];
  if (!first?.name) return null;
  writeGeoCache(lat, lng, first.name);
  return first.name;
}

async function fetchOpenMeteo(
  lat: number,
  lng: number,
): Promise<{ temp: number; code: number; isDay: boolean } | null> {
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current:
      'temperature_2m,weather_code,is_day,relative_humidity_2m,precipitation,cloud_cover,wind_speed_10m',
    timezone: 'auto',
  });
  const data = (await fetchJson(`https://api.open-meteo.com/v1/forecast?${q}`)) as {
    current?: {
      temperature_2m?: number;
      weather_code?: number;
      is_day?: number;
    };
  } | null;
  const cur = data?.current;
  if (!cur || typeof cur.temperature_2m !== 'number') return null;
  return {
    temp: Math.round(cur.temperature_2m),
    code: Number(cur.weather_code ?? 0),
    isDay: Number(cur.is_day ?? 1) === 1,
  };
}

function readCache(): WeatherSnapshot | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as WeatherSnapshot;
    if (!data?.fetchedAt || Date.now() - data.fetchedAt > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(snap: WeatherSnapshot): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(snap));
  } catch {
    /* ignore */
  }
}

async function resolveCoords(fallback: WeatherLocateFallback): Promise<Coords> {
  const geo = await locateByGeo();
  if (geo) {
    if (geo.city === '当前位置') {
      const name = await reverseCity(geo.lat, geo.lng);
      if (name) geo.city = name;
    }
    return geo;
  }
  const ip = await locateByIp();
  if (ip) return ip;
  return {
    lat: typeof fallback.lat === 'number' ? fallback.lat : 31.23,
    lng: typeof fallback.lng === 'number' ? fallback.lng : 121.47,
    city: fallback.city || '上海',
    source: 'fallback',
  };
}

/** 定位（浏览器 → IP → 配置回落）+ Open-Meteo，并按节气判定樱花/落叶 */
export async function resolveWeather(
  fallback: WeatherLocateFallback = {},
  opts: { force?: boolean } = {},
): Promise<WeatherSnapshot | null> {
  if (!opts.force) {
    const cached = readCache();
    if (cached) return cached;
  }

  const coords = await resolveCoords(fallback);
  const wx = await fetchOpenMeteo(coords.lat, coords.lng);
  if (!wx) return null;

  const term = getSolarTerm();
  const phen = classifyPhenomenon(wx.code, wx.temp);
  const snap: WeatherSnapshot = {
    city: coords.city,
    lat: coords.lat,
    lng: coords.lng,
    temp: wx.temp,
    code: wx.code,
    label: WMO_LABEL[wx.code] || phen.label,
    phenomenon: phen.id,
    phenomenonLabel: phen.label,
    isDay: wx.isDay,
    solarTerm: term,
    source: coords.source,
    fetchedAt: Date.now(),
  };
  writeCache(snap);
  return snap;
}

/** 本地钟点粗判昼夜（天气未到时用） */
export function isLocalDaytime(date = new Date()): boolean {
  const h = date.getHours();
  return h >= 6 && h < 19;
}
