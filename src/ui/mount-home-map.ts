import '../styles/home-map.css';
import type { PhotoAlbum, PhotoMetaItem, PhotoMapPoint } from '../types/config';
import { sitePath } from '../utils/site-path';
import { escapeHtml } from '../utils/html';
import {
  resolveWeather,
  type WeatherSnapshot,
  type WeatherVisual,
} from './weather-service';
import {
  getLastWeather,
  getSiteMapTheme,
  mountSiteWidgets,
} from './mount-site-widgets';
import { getSolarTerm } from './solar-terms';

export type HomeMapPin = {
  lat: number;
  lng: number;
  location: string;
  albumKey: string;
  albumLabel: string;
  cover: string;
  count: number;
  photoId: string;
};

type CityVisit = {
  name: string;
  shortName: string;
  pins: HomeMapPin[];
  count: number;
  cover: string;
  center?: [number, number];
};

type GeoFeature = {
  type: string;
  properties?: { name?: string; adcode?: number | string };
  geometry?: { type: string; coordinates: unknown };
};

type GeoJson = {
  type: string;
  features: GeoFeature[];
};

const TOTAL_CITIES_FALLBACK = 368;

/** 按地点聚合（同一相册可有多个地点坐标） */
export function buildLocationPins(
  photos: PhotoMetaItem[],
  albums: PhotoAlbum[],
): HomeMapPin[] {
  const albumMeta = new Map(albums.map((a) => [a.key, a]));
  type Bucket = {
    latSum: number;
    lngSum: number;
    n: number;
    location: string;
    albumVotes: Map<string, number>;
    cover: string;
    photoId: string;
  };
  const buckets = new Map<string, Bucket>();

  for (const photo of photos) {
    if (photo.lat == null || photo.lng == null) continue;
    if (!Number.isFinite(photo.lat) || !Number.isFinite(photo.lng)) continue;
    const loc = String(photo.location || '').trim();
    const key = loc || `${photo.lat.toFixed(3)},${photo.lng.toFixed(3)}`;
    let b = buckets.get(key);
    if (!b) {
      b = {
        latSum: 0,
        lngSum: 0,
        n: 0,
        location: loc || '未命名地点',
        albumVotes: new Map(),
        cover: '',
        photoId: photo.id,
      };
      buckets.set(key, b);
    }
    b.latSum += photo.lat;
    b.lngSum += photo.lng;
    b.n += 1;
    if (!b.cover) b.cover = photo.thumb || photo.src || '';
    if (!b.photoId) b.photoId = photo.id;
    if (loc && b.location === '未命名地点') b.location = loc;
    const albumKey = String(photo.album || '').trim() || '未分类';
    b.albumVotes.set(albumKey, (b.albumVotes.get(albumKey) || 0) + 1);
  }

  const pins: HomeMapPin[] = [];
  for (const b of buckets.values()) {
    if (b.n <= 0) continue;
    let albumKey = '未分类';
    let best = 0;
    for (const [k, votes] of b.albumVotes) {
      if (votes > best) {
        best = votes;
        albumKey = k;
      }
    }
    const meta = albumMeta.get(albumKey);
    pins.push({
      lat: b.latSum / b.n,
      lng: b.lngSum / b.n,
      location: b.location,
      albumKey,
      albumLabel: meta?.label || albumKey,
      cover: sitePath(meta?.cover || b.cover),
      count: b.n,
      photoId: b.photoId,
    });
  }

  return pins.sort((a, b) => a.location.localeCompare(b.location, 'zh-CN'));
}

export function buildAlbumPins(
  photos: PhotoMetaItem[],
  albums: PhotoAlbum[],
): HomeMapPin[] {
  return buildLocationPins(photos, albums);
}

export function pinsFromMapPoints(
  mapPoints: PhotoMapPoint[],
  photos: PhotoMetaItem[],
  albums: PhotoAlbum[],
): HomeMapPin[] {
  const byId = new Map(photos.map((p) => [p.id, p]));
  const albumMeta = new Map(albums.map((a) => [a.key, a]));
  return (mapPoints || [])
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => {
      const first = p.photos?.[0];
      const photo = first ? byId.get(first.id) : undefined;
      const albumKey = photo?.album || '';
      const meta = albumKey ? albumMeta.get(albumKey) : undefined;
      return {
        lat: p.lat,
        lng: p.lng,
        location: p.label || '未命名地点',
        albumKey: albumKey || p.label,
        albumLabel: meta?.label || photo?.album || p.label || '相册',
        cover: sitePath(first?.thumb || meta?.cover || ''),
        count: p.photos?.length || meta?.count || 0,
        photoId: first?.id || '',
      } satisfies HomeMapPin;
    });
}

export function renderHomeMapShell(): string {
  return (
    `<section class="hr-map hr-reveal" id="hrHomeMapSection" aria-label="足迹地图">` +
    `<div class="hr-map-card is-night" id="hrMapCard">` +
    `<header class="hr-map-head">` +
    `<div class="hr-map-metrics">` +
    `<div class="hr-map-metric">` +
    `<span class="hr-map-metric-label">EXPLORED</span>` +
    `<strong class="hr-map-metric-value" id="hrMapCityCount">0</strong>` +
    `<small>/ 城市</small>` +
    `</div>` +
    `<div class="hr-map-metric hr-map-metric--progress">` +
    `<div class="hr-map-metric-row">` +
    `<span class="hr-map-metric-label">COVERAGE</span>` +
    `<strong id="hrMapCoverage">0%</strong>` +
    `</div>` +
    `<div class="hr-map-progress" aria-hidden="true"><span id="hrMapProgressBar"></span></div>` +
    `</div>` +
    `</div>` +
    `<div class="hr-map-tools">` +
    `<span class="hr-map-term" id="hrMapTerm">${escapeHtml(getSolarTerm().name)}</span>` +
    `<a class="hr-map-more" href="${escapeHtml(sitePath('/photos/'))}">摄影 →</a>` +
    `</div>` +
    `</header>` +
    `<div class="hr-map-stage is-locked" id="hrHomeMapStage" role="application" aria-label="足迹地图，点击开始探索，移出后需再次点击">` +
    `<div class="hr-map-canvas" id="hrHomeMap"></div>` +
    `<canvas class="hr-map-fx" id="hrMapFx" aria-hidden="true"></canvas>` +
    `<div class="hr-map-scan" aria-hidden="true"></div>` +
    `<img class="hr-map-compass" src="${escapeHtml(sitePath('/brand/compass.svg'))}" alt="" aria-hidden="true" onerror="this.style.display='none'" />` +
    `<div class="hr-map-hover" id="hrMapHover" hidden></div>` +
    `<div class="hr-map-focus" id="hrMapFocus" hidden></div>` +
    `<div class="hr-map-lazy" id="hrHomeMapLazy" hidden aria-hidden="true">` +
    `<span class="hr-map-lazy-dot"></span>` +
    `<span>加载中…</span>` +
    `</div>` +
    `</div>` +
    `</div></section>`
  );
}

function shortCityName(name: string): string {
  return String(name || '')
    .replace(/(特别行政区|壮族苗族自治州|藏族羌族自治州|傣族景颇族自治州|白族自治州|彝族自治州|傈僳族自治州|朝鲜族自治州|蒙古族藏族自治州|土家族苗族自治州|哈尼族彝族自治州|布依族苗族自治州|苗族侗族自治州)$/u, '')
    .replace(/(地区|盟|自治州|市|县|区)$/u, '')
    .trim();
}

function normalizeKey(name: string): string {
  return shortCityName(name).toLowerCase();
}

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInFeature(lng: number, lat: number, feature: GeoFeature): boolean {
  const g = feature.geometry;
  if (!g) return false;
  const coords = g.coordinates as number[][][] | number[][][][];
  if (g.type === 'Polygon') {
    const rings = coords as number[][][];
    if (!rings[0] || !pointInRing(lng, lat, rings[0])) return false;
    for (let i = 1; i < rings.length; i++) {
      if (pointInRing(lng, lat, rings[i])) return false;
    }
    return true;
  }
  if (g.type === 'MultiPolygon') {
    for (const poly of coords as number[][][][]) {
      if (!poly[0] || !pointInRing(lng, lat, poly[0])) continue;
      let inHole = false;
      for (let i = 1; i < poly.length; i++) {
        if (pointInRing(lng, lat, poly[i])) {
          inHole = true;
          break;
        }
      }
      if (!inHole) return true;
    }
  }
  return false;
}

function featureCenter(feature: GeoFeature): [number, number] | null {
  const g = feature.geometry;
  if (!g) return null;
  const pts: number[][] = [];
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      pts.push(node as number[]);
      return;
    }
    for (const child of node) walk(child);
  };
  walk(g.coordinates);
  if (!pts.length) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

function matchPinsToCities(pins: HomeMapPin[], geo: GeoJson): Map<string, CityVisit> {
  const byShort = new Map<string, GeoFeature>();
  const byFull = new Map<string, GeoFeature>();
  for (const f of geo.features) {
    const name = f.properties?.name;
    if (!name) continue;
    byFull.set(name, f);
    byShort.set(normalizeKey(name), f);
  }

  const visits = new Map<string, CityVisit>();

  const ensure = (feature: GeoFeature, pin: HomeMapPin) => {
    const name = feature.properties?.name || pin.location;
    let v = visits.get(name);
    if (!v) {
      v = {
        name,
        shortName: shortCityName(name),
        pins: [],
        count: 0,
        cover: '',
        center: featureCenter(feature) || undefined,
      };
      visits.set(name, v);
    }
    v.pins.push(pin);
    v.count += pin.count;
    if (!v.cover && pin.cover) v.cover = pin.cover;
  };

  for (const pin of pins) {
    const locKey = normalizeKey(pin.location);
    let feature = byShort.get(locKey) || byFull.get(pin.location);
    if (!feature) {
      // 地点名包含城市名，如「普陀/上海」
      for (const [short, f] of byShort) {
        if (short && (locKey.includes(short) || short.includes(locKey))) {
          feature = f;
          break;
        }
      }
    }
    if (!feature) {
      for (const f of geo.features) {
        if (pointInFeature(pin.lng, pin.lat, f)) {
          feature = f;
          break;
        }
      }
    }
    if (feature) ensure(feature, pin);
  }

  return visits;
}

function focusHtml(visit: CityVisit): string {
  const album = visit.pins[0];
  const href = album
    ? sitePath(`/photos/?album=${encodeURIComponent(album.albumKey)}`)
    : sitePath('/photos/');
  const cover = visit.cover
    ? `<img src="${escapeHtml(visit.cover)}" alt="" loading="lazy" />`
    : '';
  const locs = [...new Set(visit.pins.map((p) => p.location))].slice(0, 4);

  return (
    `<span class="hr-map-focus-kicker">CURRENT COORDINATE</span>` +
    `<strong class="hr-map-focus-title">${escapeHtml(visit.shortName || visit.name)}</strong>` +
    `<small class="hr-map-focus-sub">${escapeHtml(visit.name)} · ${visit.count} 张</small>` +
    (cover ? `<div class="hr-map-focus-cover">${cover}</div>` : '') +
    (locs.length
      ? `<ul class="hr-map-focus-list">${locs
          .map((l) => `<li>${escapeHtml(l)}</li>`)
          .join('')}</ul>`
      : '') +
    `<a class="hr-map-focus-link" href="${escapeHtml(href)}">打开相册 →</a>`
  );
}

function setLazyState(lazy: HTMLElement | null, text: string, loading: boolean): void {
  if (!lazy) return;
  lazy.hidden = false;
  lazy.classList.toggle('is-loading', loading);
  const label = lazy.querySelector('span:last-child');
  if (label) label.textContent = text;
}

function updateMetrics(explored: number, total: number): void {
  const countEl = document.getElementById('hrMapCityCount');
  const covEl = document.getElementById('hrMapCoverage');
  const bar = document.getElementById('hrMapProgressBar');
  const pct = total > 0 ? Math.min(100, (explored / total) * 100) : 0;
  if (countEl) countEl.textContent = String(explored);
  if (covEl) covEl.textContent = `${pct.toFixed(1)}%`;
  if (bar) bar.style.width = `${pct}%`;
}

type MapTheme = 'day' | 'night';

type ThemePalette = {
  land: string;
  landLine: string;
  visit: string;
  visitLine: string;
  emphasis: string;
  scatter: string;
  scatterGlow: string;
};

const THEME_PALETTE: Record<MapTheme, ThemePalette> = {
  day: {
    land: '#243a5c',
    landLine: 'rgba(140, 200, 255, 0.5)',
    visit: '#3a7ab0',
    visitLine: 'rgba(94, 200, 255, 0.9)',
    emphasis: '#4a90c8',
    scatter: '#5ec8ff',
    scatterGlow: 'rgba(94, 200, 255, 0.55)',
  },
  night: {
    land: '#071527',
    landLine: 'rgba(77, 151, 204, 0.45)',
    visit: '#12466c',
    visitLine: 'rgba(88, 206, 255, 0.9)',
    emphasis: '#17618e',
    scatter: '#68dcff',
    scatterGlow: 'rgba(54, 190, 255, 0.58)',
  },
};

type FxParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  hue: number;
  kind: 'firefly' | 'rain' | 'snow' | 'petal' | 'leaf' | 'fog';
};

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function createMapFx(canvas: HTMLCanvasElement | null) {
  if (!canvas) {
    return {
      setNight: (_n: boolean) => {},
      setWeather: (_v: WeatherVisual) => {},
      resize: () => {},
      dispose: () => {},
    };
  }

  const ctx = canvas.getContext('2d');
  let w = 0;
  let h = 0;
  let raf = 0;
  let night = true;
  let weather: WeatherVisual = 'clear';
  let fireflies: FxParticle[] = [];
  let wxParts: FxParticle[] = [];
  let lightning = 0;

  const resize = () => {
    const stage = canvas.parentElement;
    const rect = stage?.getBoundingClientRect();
    w = Math.max(1, Math.floor(rect?.width || canvas.clientWidth || 1));
    h = Math.max(1, Math.floor(rect?.height || canvas.clientHeight || 1));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuild();
  };

  const spawnFirefly = (): FxParticle => ({
    x: rand(0, w),
    y: rand(0, h),
    vx: rand(-0.25, 0.25),
    vy: rand(-0.2, 0.2),
    size: rand(1.2, 2.6),
    alpha: rand(0.35, 0.95),
    life: rand(0, 1),
    maxLife: rand(2.5, 5),
    hue: rand(70, 110),
    kind: 'firefly',
  });

  const spawnWeather = (visual: WeatherVisual): FxParticle | null => {
    switch (visual) {
      case 'rain':
      case 'drizzle':
      case 'thunderstorm':
        return {
          x: rand(0, w + 40),
          y: rand(-h * 0.2, 0),
          vx: visual === 'drizzle' ? -0.4 : -1.2,
          vy: visual === 'drizzle' ? rand(4, 7) : rand(10, 18),
          size: visual === 'drizzle' ? rand(5, 9) : rand(10, 16),
          alpha: visual === 'drizzle' ? 0.35 : 0.5,
          life: 0,
          maxLife: 1,
          hue: 200,
          kind: 'rain',
        };
      case 'snow':
        return {
          x: rand(0, w),
          y: rand(-20, 0),
          vx: rand(-0.4, 0.4),
          vy: rand(0.6, 1.8),
          size: rand(1.5, 3.5),
          alpha: rand(0.55, 0.95),
          life: 0,
          maxLife: 1,
          hue: 0,
          kind: 'snow',
        };
      case 'sakura':
        return {
          x: rand(0, w),
          y: rand(-20, 0),
          vx: rand(-0.8, 0.8),
          vy: rand(0.8, 2),
          size: rand(2.5, 5),
          alpha: rand(0.55, 0.9),
          life: rand(0, Math.PI * 2),
          maxLife: 1,
          hue: 340,
          kind: 'petal',
        };
      case 'leaves':
        return {
          x: rand(0, w),
          y: rand(-20, 0),
          vx: rand(-1, 1),
          vy: rand(0.7, 1.8),
          size: rand(3, 6),
          alpha: rand(0.55, 0.9),
          life: rand(0, Math.PI * 2),
          maxLife: 1,
          hue: rand(20, 45),
          kind: 'leaf',
        };
      case 'fog':
        return {
          x: rand(-40, w),
          y: rand(0, h),
          vx: rand(0.05, 0.2),
          vy: rand(-0.04, 0.04),
          size: rand(28, 70),
          alpha: rand(0.04, 0.1),
          life: 0,
          maxLife: 1,
          hue: 0,
          kind: 'fog',
        };
      default:
        return null;
    }
  };

  const weatherCount = (visual: WeatherVisual): number => {
    const mobile = window.innerWidth < 720;
    const scale = mobile ? 0.55 : 1;
    if (visual === 'thunderstorm') return Math.floor(55 * scale);
    if (visual === 'rain') return Math.floor(45 * scale);
    if (visual === 'drizzle') return Math.floor(28 * scale);
    if (visual === 'snow' || visual === 'sakura' || visual === 'leaves') {
      return Math.floor(36 * scale);
    }
    if (visual === 'fog') return Math.floor(18 * scale);
    return 0;
  };

  const rebuild = () => {
    const ffN = night ? (window.innerWidth < 720 ? 18 : 32) : 0;
    fireflies = Array.from({ length: ffN }, () => spawnFirefly());
    const n = weatherCount(weather);
    wxParts = [];
    for (let i = 0; i < n; i++) {
      const p = spawnWeather(weather);
      if (p) {
        p.y = rand(0, h);
        wxParts.push(p);
      }
    }
  };

  const tick = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    const lx = night ? w * 0.76 : w * 0.2;
    const ly = h * 0.18;
    const lr = Math.max(w, h) * (night ? 0.34 : 0.42);
    const light = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
    light.addColorStop(0, night ? 'rgba(170,210,255,.32)' : 'rgba(255,226,154,.42)');
    light.addColorStop(.24, night ? 'rgba(82,155,220,.12)' : 'rgba(255,190,92,.13)');
    light.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, w, h);

    if (weather === 'thunderstorm' && Math.random() < 0.008) lightning = 1;
    if (lightning > 0) {
      ctx.fillStyle = `rgba(200, 220, 255, ${lightning * 0.18})`;
      ctx.fillRect(0, 0, w, h);
      lightning *= 0.85;
      if (lightning < 0.02) lightning = 0;
    }

    for (const p of wxParts) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.kind === 'petal' || p.kind === 'leaf') {
        p.life += 0.04;
        p.x += Math.sin(p.life) * 0.35;
      }
      if (p.y > h + 20 || p.x < -60 || p.x > w + 60) {
        const next = spawnWeather(weather);
        if (next) Object.assign(p, next);
      }

      if (p.kind === 'rain') {
        ctx.strokeStyle = `rgba(174, 194, 224, ${p.alpha})`;
        ctx.lineWidth = weather === 'drizzle' ? 1 : 1.4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 0.5, p.y + p.size);
        ctx.stroke();
      } else if (p.kind === 'snow') {
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), Math.ceil(p.size), Math.ceil(p.size));
      } else if (p.kind === 'petal') {
        ctx.fillStyle = `hsla(${p.hue}, 80%, 78%, ${p.alpha})`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size * 0.55, p.size, p.life, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'leaf') {
        ctx.fillStyle = `hsla(${p.hue}, 70%, 42%, ${p.alpha})`;
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), Math.ceil(p.size), Math.ceil(p.size * 0.6));
      } else if (p.kind === 'fog') {
        ctx.fillStyle = `rgba(200, 210, 230, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (night) {
      for (const p of fireflies) {
        p.x += p.vx + Math.sin(p.life * 2) * 0.15;
        p.y += p.vy + Math.cos(p.life * 1.6) * 0.12;
        p.life += 0.02;
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;
        const pulse = 0.45 + 0.55 * Math.sin(p.life * (Math.PI * 2) / p.maxLife);
        const a = p.alpha * pulse;
        const r = p.size * (0.8 + pulse * 0.5);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
        g.addColorStop(0, `hsla(${p.hue}, 100%, 70%, ${a})`);
        g.addColorStop(0.35, `hsla(${p.hue}, 90%, 55%, ${a * 0.35})`);
        g.addColorStop(1, `hsla(${p.hue}, 80%, 40%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `hsla(${p.hue}, 100%, 85%, ${a})`;
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 2, 2);
      }
    }

    raf = requestAnimationFrame(tick);
  };

  const start = () => {
    if (!raf) raf = requestAnimationFrame(tick);
  };

  resize();
  start();

  return {
    setNight: (n: boolean) => {
      night = n;
      rebuild();
    },
    setWeather: (v: WeatherVisual) => {
      weather = v;
      rebuild();
    },
    resize,
    dispose: () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (ctx) ctx.clearRect(0, 0, w, h);
    },
  };
}

function applyCardTheme(theme: MapTheme): void {
  const card = document.getElementById('hrMapCard');
  if (!card) return;
  card.classList.toggle('is-day', theme === 'day');
  card.classList.toggle('is-night', theme === 'night');
}

async function loadGeoJson(): Promise<GeoJson> {
  const base = import.meta.env.BASE_URL + 'data';
  const res = await fetch(`${base}/china-cities.geojson`, { cache: 'force-cache' });
  if (!res.ok) throw new Error('china-cities.geojson 加载失败');
  return (await res.json()) as GeoJson;
}

async function initArchiveMap(
  root: HTMLElement,
  pins: HomeMapPin[],
): Promise<void> {
  const lazy = document.getElementById('hrHomeMapLazy');
  const hoverEl = document.getElementById('hrMapHover');
  const focusEl = document.getElementById('hrMapFocus');
  const fxCanvas = document.getElementById('hrMapFx') as HTMLCanvasElement | null;
  const stage = document.getElementById('hrHomeMapStage');

  setLazyState(lazy, '加载中…', true);

  // 确保全站天气控件已挂载；地图跟随其昼夜/天气
  mountSiteWidgets();
  let theme: MapTheme = getSiteMapTheme();
  applyCardTheme(theme);

  const fx = createMapFx(fxCanvas);
  fx.setNight(theme === 'night');

  const applyWeatherSnap = (snap: WeatherSnapshot | null) => {
    if (snap) {
      fx.setWeather(snap.phenomenon);
      const term = document.getElementById('hrMapTerm');
      if (term) term.textContent = snap.solarTerm?.name || getSolarTerm().name;
    }
  };

  const cached = getLastWeather();
  if (cached) applyWeatherSnap(cached);
  const weatherPromise = cached
    ? Promise.resolve(cached)
    : resolveWeather().then((snap) => {
        applyWeatherSnap(snap);
        return snap;
      });

  const [{ echarts }, geo] = await Promise.all([
    import('../lib/echarts-map'),
    loadGeoJson(),
  ]);

  const visits = matchPinsToCities(pins, geo);
  const total = geo.features.length || TOTAL_CITIES_FALLBACK;
  updateMetrics(visits.size, total);

  echarts.registerMap('china-cities', geo as never);
  root.innerHTML = '';
  const chart = echarts.init(root, undefined, { renderer: 'canvas' });

  const buildRegions = (pal: ThemePalette) =>
    geo.features.map((f) => {
      const name = f.properties?.name || '';
      const visit = visits.get(name);
      return {
        name,
        value: visit?.count || 0,
        itemStyle: {
          areaColor: visit ? pal.visit : pal.land,
          borderColor: visit ? pal.visitLine : pal.landLine,
          borderWidth: visit ? 1.1 : 0.7,
          opacity: visit ? 0.98 : 0.88,
        },
      };
    });

  const buildScatter = (pal: ThemePalette) =>
    [...visits.values()]
      .filter((v) => v.center)
      .map((v) => ({
        name: v.name,
        value: [...(v.center as [number, number]), v.count],
        visit: v,
        symbolSize: Math.min(10 + v.count * 1.4, 20),
        itemStyle: {
          color: pal.scatter,
          borderColor: '#05060c',
          borderWidth: 1,
          shadowBlur: 12,
          shadowColor: pal.scatterGlow,
        },
      }));

  const paintTheme = (next: MapTheme) => {
    const pal = THEME_PALETTE[next];
    const regionData = buildRegions(pal);
    const scatter = buildScatter(pal);
    chart.setOption({
      geo: {
        itemStyle: {
          areaColor: pal.land,
          borderColor: pal.landLine,
          borderWidth: 0.7,
        },
        emphasis: {
          label: { show: false },
          itemStyle: {
            areaColor: pal.emphasis,
            borderColor: pal.visitLine,
            borderWidth: 1.2,
          },
        },
        regions: regionData.map((r) => ({
          name: r.name,
          itemStyle: r.itemStyle,
          emphasis: {
            itemStyle: {
              areaColor: pal.emphasis,
              borderColor: pal.visitLine,
              borderWidth: 1.2,
            },
          },
        })),
      },
      series: [
        { id: 'map-base', data: regionData },
        { id: 'city-dots', data: scatter },
      ],
    });
  };

  const pal0 = THEME_PALETTE[theme];
  const regionData0 = buildRegions(pal0);
  const scatter0 = buildScatter(pal0);

  chart.setOption({
    backgroundColor: 'transparent',
    animation: true,
    tooltip: { show: false },
    geo: {
      map: 'china-cities',
      roam: true,
      zoom: 1.2,
      center: [105, 35],
      scaleLimit: { min: 0.9, max: 10 },
      itemStyle: {
        areaColor: pal0.land,
        borderColor: pal0.landLine,
        borderWidth: 0.7,
      },
      emphasis: {
        label: { show: false },
        itemStyle: {
          areaColor: pal0.emphasis,
          borderColor: pal0.visitLine,
          borderWidth: 1.2,
        },
      },
      label: { show: false },
      regions: regionData0.map((r) => ({
        name: r.name,
        itemStyle: r.itemStyle,
        emphasis: {
          itemStyle: {
            areaColor: pal0.emphasis,
            borderColor: pal0.visitLine,
            borderWidth: 1.2,
          },
        },
      })),
    },
    series: [
      {
        id: 'map-base',
        name: '足迹底图',
        type: 'map',
        map: 'china-cities',
        geoIndex: 0,
        data: regionData0,
        selectedMode: false,
        label: { show: false },
        emphasis: { label: { show: false } },
      },
      {
        id: 'city-dots',
        name: '城市坐标',
        type: 'effectScatter',
        coordinateSystem: 'geo',
        zlevel: 3,
        data: scatter0,
        rippleEffect: { period: 4, scale: 2.8, brushType: 'stroke' },
        label: { show: false },
        emphasis: { scale: true },
      },
    ],
  });

  const setTheme = (next: MapTheme) => {
    if (theme === next) return;
    theme = next;
    applyCardTheme(theme);
    fx.setNight(theme === 'night');
    paintTheme(theme);
  };

  // 跟随全站右上角昼夜 / 天气
  const onSiteTheme = (e: Event) => {
    const detail = (e as CustomEvent<{ mapTheme?: MapTheme }>).detail;
    setTheme(detail?.mapTheme || getSiteMapTheme());
  };
  const onSiteWeather = (e: Event) => {
    const snap = (e as CustomEvent<{ snap: WeatherSnapshot | null }>).detail?.snap ?? null;
    applyWeatherSnap(snap);
  };
  window.addEventListener('askuary:theme', onSiteTheme);
  window.addEventListener('askuary:weather', onSiteWeather);

  void weatherPromise.then(() => {
    setTheme(getSiteMapTheme());
  });

  const showHover = (name: string, x: number, y: number) => {
    if (!hoverEl) return;
    hoverEl.hidden = false;
    hoverEl.textContent = shortCityName(name) || name;
    hoverEl.style.left = `${x + 12}px`;
    hoverEl.style.top = `${y - 8}px`;
  };

  const hideHover = () => {
    if (hoverEl) hoverEl.hidden = true;
  };

  const showFocus = (visit: CityVisit | null) => {
    if (!focusEl) return;
    if (!visit) {
      focusEl.hidden = true;
      focusEl.innerHTML = '';
      return;
    }
    focusEl.hidden = false;
    focusEl.innerHTML = focusHtml(visit);
  };

  chart.on('mouseover', (params) => {
    const name = String(params.name || '');
    if (!name) return;
    const ev = params.event as { offsetX?: number; offsetY?: number } | undefined;
    showHover(name, ev?.offsetX ?? 0, ev?.offsetY ?? 0);
    const visit = visits.get(name);
    if (visit) showFocus(visit);
  });

  chart.on('globalout', () => {
    hideHover();
  });

  chart.on('click', (params) => {
    const name = String(params.name || '');
    const data = params.data as { visit?: CityVisit } | undefined;
    const visit = data?.visit || (name ? visits.get(name) : undefined);
    if (visit) {
      showFocus(visit);
      if (visit.center) {
        chart.setOption({
          geo: { center: visit.center, zoom: 3.2 },
        });
      }
      return;
    }
    if (name) {
      showFocus({
        name,
        shortName: shortCityName(name),
        pins: [],
        count: 0,
        cover: '',
      });
    }
  });

  const onResize = () => {
    chart.resize();
    fx.resize();
  };
  window.addEventListener('resize', onResize);

  if (lazy) lazy.hidden = true;

  // 画面先出来；点击启用 roam，指针离开后再锁上
  let interactive = false;
  chart.setOption({ geo: { roam: false } });

  const unlockMap = () => {
    if (interactive) return;
    interactive = true;
    chart.setOption({ geo: { roam: true } });
    stage?.classList.remove('is-locked');
    stage?.classList.add('is-armed');
  };

  const lockMap = () => {
    if (!interactive) return;
    interactive = false;
    chart.setOption({ geo: { roam: false } });
    stage?.classList.add('is-locked');
    stage?.classList.remove('is-armed');
  };

  stage?.addEventListener('pointerdown', () => unlockMap());
  stage?.addEventListener('pointerleave', () => lockMap());

  (root as HTMLElement & { __askuaryMapDispose?: () => void }).__askuaryMapDispose = () => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('askuary:theme', onSiteTheme);
    window.removeEventListener('askuary:weather', onSiteWeather);
    fx.dispose();
    chart.dispose();
  };
}

export function mountHomeMap(
  root: HTMLElement | null,
  options: {
    photos: PhotoMetaItem[];
    albums: PhotoAlbum[];
    mapPoints?: PhotoMapPoint[];
    amapKey?: string;
    amapSecurityJsCode?: string;
  },
): void {
  if (!root) return;

  let pins = buildLocationPins(options.photos, options.albums);
  if (!pins.length) {
    pins = pinsFromMapPoints(options.mapPoints || [], options.photos, options.albums);
  }

  const lazy = document.getElementById('hrHomeMapLazy');
  const stage = document.getElementById('hrHomeMapStage');
  const section =
    document.getElementById('hrHomeMapSection') ||
    root.closest('.hr-map') ||
    root;

  if (!pins.length) {
    root.innerHTML =
      `<p class="hr-map-empty">还没有带坐标的地点。给照片写上位置后会出现在这里。</p>`;
    if (lazy) lazy.hidden = true;
    stage?.classList.remove('is-locked');
    updateMetrics(0, TOTAL_CITIES_FALLBACK);
    return;
  }

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    if (lazy) lazy.hidden = false;
    void initArchiveMap(root, pins).catch((err) => {
      console.error(err);
      root.innerHTML =
        `<p class="hr-map-empty">足迹地图加载失败，请刷新重试。</p>`;
      if (lazy) lazy.hidden = true;
      stage?.classList.remove('is-locked');
    });
  };

  // 进入视口先加载画面；点击舞台才解锁交互
  if (typeof IntersectionObserver === 'undefined') {
    start();
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          io.disconnect();
          start();
          break;
        }
      }
    },
    { root: null, rootMargin: '160px 0px', threshold: 0.05 },
  );
  io.observe(section);
}
