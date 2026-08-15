import '../styles/site-widgets.css';
import { applyWeatherAtmosphere } from './mount-weather-atmosphere';
import { getSolarTerm, SOLAR_TERMS, type SolarTerm } from './solar-terms';
import {
  isLocalDaytime,
  resolveWeather,
  type WeatherVisual,
  type WeatherLocateFallback,
  type WeatherSnapshot,
} from './weather-service';
import { mountStarSearch } from './mount-star-search';
import { mountStardustCursor } from './mount-stardust-cursor';
import '../styles/visual-consistency.css';
import '../styles/cosmic-theme.css';

const THEME_KEY = 'askuary_theme';
const THEME_KEY_LEGACY = 'askuary_home_theme';
/** auto = 跟时间/日照；light/dark = 手动锁定 */
const THEME_MODE_KEY = 'askuary_theme_mode';

export type SiteTheme = 'light' | 'dark';
export type ThemeMode = 'auto' | 'manual';

export type WeatherConfig = WeatherLocateFallback & {
  enabled?: boolean;
};

export type SiteWidgetsOptions = {
  weather?: WeatherConfig;
  /** 无本地偏好时的回落；'auto' 表示跟时间 */
  themeDefault?: SiteTheme | 'auto';
  allowThemeSwitch?: boolean;
  /** 宇宙入口关闭全站搜索，只保留星图内部搜索。 */
  search?: boolean;
  /** false 时只初始化主题能力，不显示天气/主题组件。 */
  visible?: boolean;
};

let themeTick = 0;
let lastIsDay: boolean | null = null;
let lastWeather: WeatherSnapshot | null = null;
let widgetsMounted = false;
const WEATHER_MODE_KEY = 'askuary_weather_mode';
const WEATHER_VISUAL_KEY = 'askuary_weather_visual';
const SOLAR_TERM_KEY = 'askuary_solar_term';
const WEATHER_CHOICES: Array<{ id: WeatherVisual; label: string }> = [
  { id: 'clear', label: '晴' },
  { id: 'rain', label: '雨' },
  { id: 'drizzle', label: '细雨' },
  { id: 'snow', label: '雪' },
  { id: 'fog', label: '雾' },
  { id: 'thunderstorm', label: '雷雨' },
  { id: 'sakura', label: '樱花' },
  { id: 'leaves', label: '落叶' },
];

function storageGet(key: string): string {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

function storageSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

function selectedTerm(): SolarTerm {
  const name = storageGet(SOLAR_TERM_KEY);
  return SOLAR_TERMS.find((term) => term.name === name) || getSolarTerm();
}

function displayedWeather(snap: WeatherSnapshot): WeatherSnapshot {
  if (storageGet(WEATHER_MODE_KEY) !== 'manual') {
    return { ...snap, solarTerm: selectedTerm() };
  }
  const choice = WEATHER_CHOICES.find((item) => item.id === storageGet(WEATHER_VISUAL_KEY))
    || WEATHER_CHOICES[0];
  return {
    ...snap,
    phenomenon: choice.id,
    phenomenonLabel: choice.label,
    label: choice.label,
    solarTerm: selectedTerm(),
  };
}

function renderWeather(snap: WeatherSnapshot): void {
  const shown = displayedWeather(snap);
  document.documentElement.dataset.weather = shown.phenomenon;
  document.body.dataset.weather = shown.phenomenon;
  fillWeather({
    city: shown.city,
    temp: shown.temp,
    cond: shown.phenomenonLabel || shown.label,
    term: shown.solarTerm.name,
  });
  applyWeatherAtmosphere(shown.phenomenon);
  emitWeather(shown);
}

export function getLastWeather(): WeatherSnapshot | null {
  return lastWeather;
}

export function getSiteMapTheme(): 'day' | 'night' {
  const dark =
    document.documentElement.classList.contains('askuary-theme-dark') ||
    document.body.classList.contains('home-theme-dark') ||
    document.body.classList.contains('askuary-theme-dark');
  return dark ? 'night' : 'day';
}

function emitTheme(theme: SiteTheme): void {
  window.dispatchEvent(
    new CustomEvent('askuary:theme', {
      detail: { theme, mapTheme: theme === 'dark' ? 'night' : 'day' },
    }),
  );
}

function emitWeather(snap: WeatherSnapshot | null): void {
  window.dispatchEvent(new CustomEvent('askuary:weather', { detail: { snap } }));
}

export function readThemeMode(fallback: ThemeMode = 'auto'): ThemeMode {
  try {
    const m = localStorage.getItem(THEME_MODE_KEY);
    if (m === 'auto' || m === 'manual') return m;
    // 旧版只存了 light/dark → 视为手动
    const legacy = localStorage.getItem(THEME_KEY) || localStorage.getItem(THEME_KEY_LEGACY);
    if (legacy === 'light' || legacy === 'dark') return 'manual';
  } catch {
    /* ignore */
  }
  return fallback;
}

export function readTheme(fallback: SiteTheme = 'light'): SiteTheme {
  try {
    const v = localStorage.getItem(THEME_KEY) || localStorage.getItem(THEME_KEY_LEGACY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  return fallback;
}

function writeTheme(theme: SiteTheme, mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(THEME_KEY_LEGACY, theme);
    localStorage.setItem(THEME_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** 全站应用昼夜主题（html + body） */
export function applySiteTheme(theme: SiteTheme): void {
  const dark = theme === 'dark';
  document.documentElement.classList.toggle('askuary-theme-dark', dark);
  document.documentElement.classList.toggle('askuary-theme-light', !dark);
  document.body.classList.toggle('home-theme-dark', dark);
  document.body.classList.toggle('home-theme-light', !dark);
  document.body.classList.toggle('askuary-theme-dark', dark);
  document.body.classList.toggle('askuary-theme-light', !dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#060812' : '#edf5fb');
  emitTheme(theme);
}

function resolveAutoTheme(isDay?: boolean | null): SiteTheme {
  if (typeof isDay === 'boolean') return isDay ? 'light' : 'dark';
  return isLocalDaytime() ? 'light' : 'dark';
}

/** 恢复主题：默认自动跟时间，手动偏好优先 */
export function ensureSiteTheme(fallback: SiteTheme | 'auto' = 'auto'): SiteTheme {
  const modeFallback: ThemeMode = fallback === 'auto' ? 'auto' : 'manual';
  const mode = readThemeMode(modeFallback);
  let theme: SiteTheme;
  if (mode === 'auto') {
    theme = resolveAutoTheme(lastIsDay);
  } else {
    theme = readTheme(fallback === 'auto' ? 'light' : fallback);
  }
  applySiteTheme(theme);
  return theme;
}

function syncThemeBtn(): void {
  const dark = document.body.classList.contains('home-theme-dark');
  const mode = readThemeMode('auto');
  const ico = document.getElementById('siteThemeIco');
  const label = document.getElementById('siteThemeLabel');
  if (ico) ico.textContent = dark ? '☀' : '☾';
  if (label) {
    // 按钮文案表示「点一下会切到」的目标；自动模式加后缀
    const base = dark ? '白昼' : '夜间';
    label.textContent = mode === 'auto' ? `${base}·自动` : base;
  }
}

function fillWeather(parts: {
  city: string;
  temp: number;
  cond: string;
  term: string;
}): void {
  const box = document.getElementById('siteWeather');
  if (!box) return;
  box.hidden = false;
  const cityEl = document.getElementById('siteWeatherCity');
  const tempEl = document.getElementById('siteWeatherTemp');
  const condEl = document.getElementById('siteWeatherCond');
  const termEl = document.getElementById('siteWeatherTerm');
  if (cityEl) cityEl.textContent = parts.city;
  if (tempEl) {
    tempEl.textContent = Number.isFinite(parts.temp) ? `${parts.temp}°` : '';
  }
  if (condEl) condEl.textContent = parts.cond;
  if (termEl) {
    termEl.textContent = parts.term;
    termEl.hidden = !parts.term;
  }
}

/** 把天气小组件塞进宠物旁的 climate 槽（宠物后挂也能 adopt） */
export function adoptSiteWidgetsIntoPet(slot?: HTMLElement | null): void {
  const root = document.getElementById('siteWidgets');
  const host =
    slot ||
    (document.getElementById('pixelPetClimate') as HTMLElement | null) ||
    null;
  if (!root || !host) return;
  if (root.parentElement === host) return;
  host.appendChild(root);
}

function applyAutoThemeFromDay(isDay: boolean): void {
  lastIsDay = isDay;
  if (readThemeMode('auto') !== 'auto') {
    syncThemeBtn();
    return;
  }
  const next = resolveAutoTheme(isDay);
  applySiteTheme(next);
  syncThemeBtn();
}

function startThemeAutoRefresh(): void {
  if (themeTick) return;
  themeTick = window.setInterval(() => {
    if (readThemeMode('auto') !== 'auto') return;
    const next = resolveAutoTheme(lastIsDay);
    const dark = document.body.classList.contains('home-theme-dark');
    if ((next === 'dark') !== dark) {
      applySiteTheme(next);
      syncThemeBtn();
    }
  }, 60_000);
}

/** 天气条 + 定位天气 + 节气 + 自动昼夜 + 氛围特效（全站单例，挂在宠物旁） */
export function mountSiteWidgets(options: SiteWidgetsOptions = {}): void {
  if (options.search !== false) mountStarSearch();
  else document.getElementById('starSearchRoot')?.remove();
  mountStardustCursor();
  const allowTheme = options.allowThemeSwitch !== false;
  const themeDefault = options.themeDefault ?? 'auto';
  ensureSiteTheme(themeDefault);
  startThemeAutoRefresh();

  if (options.visible === false) {
    document.getElementById('siteWidgets')?.remove();
    document.querySelectorAll('.askuary-weather-canvas').forEach((el) => el.remove());
    return;
  }

  let root = document.getElementById('siteWidgets');
  if (!root) {
    root = document.createElement('div');
    root.id = 'siteWidgets';
    root.className = 'site-widgets';
    root.setAttribute('aria-label', '天气与昼夜');
    const termNow = getSolarTerm().name;
    root.innerHTML =
      `<button type="button" class="site-widget-term-pill" id="siteWeatherTerm" title="切换二十四节气；双击恢复当前节气">${termNow}</button>` +
      `<div class="pixel-pet-climate-row">` +
      `<button type="button" class="site-widget site-widget--weather" id="siteWeather" hidden title="切换天气；双击恢复自动天气">` +
      `<span class="site-widget-ico" aria-hidden="true">☁</span>` +
      `<span class="site-widget-city" id="siteWeatherCity"></span>` +
      `<span class="site-widget-temp" id="siteWeatherTemp"></span>` +
      `<span class="site-widget-cond" id="siteWeatherCond"></span>` +
      `</button>` +
      (allowTheme
        ? `<button type="button" class="site-widget site-widget--theme" id="siteThemeBtn" aria-label="切换主题（双击恢复自动）" title="单击切换昼夜，双击恢复按时间自动">` +
          `<span class="site-widget-ico" id="siteThemeIco" aria-hidden="true"></span>` +
          `<span id="siteThemeLabel"></span>` +
          `</button>`
        : '') +
      `</div>`;

    const petSlot = document.getElementById('pixelPetClimate');
    if (petSlot) petSlot.appendChild(root);
    else document.body.appendChild(root);

    let clickTimer = 0;
    document.getElementById('siteThemeBtn')?.addEventListener('click', () => {
      window.clearTimeout(clickTimer);
      clickTimer = window.setTimeout(() => {
        const next: SiteTheme = document.body.classList.contains('home-theme-dark')
          ? 'light'
          : 'dark';
        writeTheme(next, 'manual');
        applySiteTheme(next);
        syncThemeBtn();
      }, 220);
    });
    document.getElementById('siteThemeBtn')?.addEventListener('dblclick', (e) => {
      e.preventDefault();
      window.clearTimeout(clickTimer);
      writeTheme(resolveAutoTheme(lastIsDay), 'auto');
      applySiteTheme(resolveAutoTheme(lastIsDay));
      syncThemeBtn();
    });
    document.getElementById('siteWeather')?.addEventListener('click', () => {
      if (!lastWeather) return;
      const current = storageGet(WEATHER_VISUAL_KEY) || lastWeather.phenomenon;
      const index = WEATHER_CHOICES.findIndex((item) => item.id === current);
      const next = WEATHER_CHOICES[(index + 1 + WEATHER_CHOICES.length) % WEATHER_CHOICES.length];
      storageSet(WEATHER_MODE_KEY, 'manual');
      storageSet(WEATHER_VISUAL_KEY, next.id);
      renderWeather(lastWeather);
    });
    document.getElementById('siteWeatherCity')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      storageSet(WEATHER_MODE_KEY, 'auto');
      writeTheme(resolveAutoTheme(lastIsDay), 'auto');
      applySiteTheme(resolveAutoTheme(lastIsDay));
      syncThemeBtn();
      if (lastWeather) renderWeather(lastWeather);
    });
    document.getElementById('siteWeather')?.addEventListener('dblclick', (event) => {
      event.preventDefault();
      storageSet(WEATHER_MODE_KEY, 'auto');
      if (lastWeather) renderWeather(lastWeather);
    });
    document.getElementById('siteWeatherTerm')?.addEventListener('click', () => {
      const current = selectedTerm();
      const index = SOLAR_TERMS.findIndex((term) => term.name === current.name);
      const next = SOLAR_TERMS[(index + 1) % SOLAR_TERMS.length];
      storageSet(SOLAR_TERM_KEY, next.name);
      if (lastWeather) renderWeather(lastWeather);
      else fillWeather({ city: options.weather?.city || '定位中', temp: NaN, cond: '…', term: next.name });
    });
    document.getElementById('siteWeatherTerm')?.addEventListener('dblclick', (event) => {
      event.preventDefault();
      storageSet(SOLAR_TERM_KEY, '');
      if (lastWeather) renderWeather(lastWeather);
    });
  } else {
    adoptSiteWidgetsIntoPet();
  }

  syncThemeBtn();

  // 先按本地时间应用自动昼夜，天气返回后再用 is_day 校准
  if (readThemeMode(themeDefault === 'auto' ? 'auto' : 'manual') === 'auto') {
    applyAutoThemeFromDay(isLocalDaytime());
  }

  const weather = options.weather;
  if (weather?.enabled === false) {
    widgetsMounted = true;
    return;
  }

  // 已挂载过且有快照时，只刷新 DOM，避免重复请求
  if (widgetsMounted && lastWeather) {
    renderWeather(lastWeather);
    return;
  }

  // 节气先展示，不等天气
  const term = getSolarTerm();
  fillWeather({
    city: weather?.city || '定位中',
    temp: 0,
    cond: '…',
    term: term.name,
  });
  const tempEl = document.getElementById('siteWeatherTemp');
  if (tempEl) tempEl.textContent = '';

  widgetsMounted = true;

  void resolveWeather({
    city: weather?.city,
    lat: weather?.lat,
    lng: weather?.lng,
  }).then((snap) => {
    if (!snap) {
      fillWeather({
        city: weather?.city || '上海',
        temp: NaN,
        cond: '暂无天气',
        term: getSolarTerm().name,
      });
      const t = document.getElementById('siteWeatherTemp');
      if (t) t.textContent = '';
      lastWeather = null;
      emitWeather(null);
      return;
    }
    lastWeather = snap;
    renderWeather(snap);
    applyAutoThemeFromDay(snap.isDay);
  });
}

/** @deprecated 使用 applySiteTheme */
export const applyHomeTheme = applySiteTheme;
