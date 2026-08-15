/**
 * 扫描 content/photowall → 只生成缩略图（不上线原图）+ public/data/photowall-index.json
 * 原图仅保留在本机 content/；部署只上传 dist/photowall 与索引。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import exifr from 'exifr';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'content', 'photowall');
const outDir = path.join(root, 'public', 'photowall');
const indexPath = path.join(root, 'public', 'data', 'photowall-index.json');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
/** 上线只用缩略图（边长上限），原图不进 dist */
const THUMB_MAX = 960;
const QUALITY = 82;
/** 水印版本：改文案/样式后 +1，会强制重压已有缩略图 */
const WATERMARK_REV = 2;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function walkImages(dir, base = dir, list = []) {
  if (!fs.existsSync(dir)) return list;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    if (entry.name === 'photos.json') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkImages(full, base, list);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;
    const relative = path.relative(base, full).split(path.sep).join('/');
    list.push({ full, relative, file: entry.name });
  }
  return list;
}

function cleanTitle(base) {
  return String(base || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDate(y, m, d) {
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * 行程文件夹：`2026.7.2齐云山` / `2026.7.11云南` / `2026-7-13香格里拉` / `20260713丽江`
 * @returns {{ key: string, date: string, title: string } | null}
 */
function parseTripFolder(name) {
  const raw = String(name || '').trim();
  if (!raw) return null;

  const patterns = [
    /^(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})[\s_\-·—–.]*(.+)$/,
    /^(\d{4})-(\d{1,2})-(\d{1,2})[\s_\-·—–.]*(.+)$/,
    /^(\d{4})(\d{2})(\d{2})[\s_\-·—–.]*(.+)$/,
  ];

  for (const re of patterns) {
    const m = raw.match(re);
    if (!m) continue;
    const date = normalizeDate(m[1], m[2], m[3]);
    const title = String(m[4] || '')
      .replace(/^[\s_\-.·—–]+/, '')
      .replace(/[\s_\-.·—–]+$/, '')
      .trim();
    if (!date || !title) continue;
    return { key: raw, date, title };
  }
  return null;
}

/**
 * 从相对路径解析相册：
 * 1) 最深行程文件夹（日期+地名）优先
 * 2) `分类/地点/…` → 相册=分类/地点，地点名作 location
 * 3) 否则一级目录（旧分类如「日常」）
 * @returns {{ albumKey: string, trip: ReturnType<typeof parseTripFolder>, category: string, locationHint: string, albumLabel: string }}
 */
function resolveAlbumFromPath(relative) {
  const dir = path.posix.dirname(relative);
  if (!dir || dir === '.') {
    return { albumKey: '未分类', trip: null, category: '', locationHint: '', albumLabel: '未分类' };
  }
  const segments = dir.split('/').filter(Boolean);
  let trip = null;
  let tripIndex = -1;
  for (let i = segments.length - 1; i >= 0; i--) {
    const parsed = parseTripFolder(segments[i]);
    if (parsed) {
      trip = parsed;
      tripIndex = i;
      break;
    }
  }
  if (trip) {
    const category =
      tripIndex > 0 && segments[0] !== trip.key ? segments[0] : trip.title;
    return {
      albumKey: trip.key,
      trip,
      category,
      locationHint: trip.title,
      albumLabel: trip.title,
    };
  }

  // 分类/地点[/子目录]：日常/上海/xxx.jpg → 相册「日常/上海」
  if (segments.length >= 2) {
    const category = segments[0];
    const place = segments[1];
    const skipPlace = new Set(['raw', 'orig', 'original', 'jpg', 'jpeg', 'png', 'thumbs', 'thumb']);
    if (place && !skipPlace.has(place.toLowerCase())) {
      const albumKey = `${category}/${place}`;
      return {
        albumKey,
        trip: null,
        category,
        locationHint: place,
        albumLabel: place,
      };
    }
  }

  const top = segments[0];
  return {
    albumKey: top,
    trip: null,
    category: top,
    locationHint: '',
    albumLabel: top,
  };
}

function parsePhotoName(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  const spaced = base.replace(/ /g, '_');
  const parts = spaced.split('_').filter(Boolean);
  const data = {
    date: '',
    location: '',
    category: '',
    note: '',
    title: cleanTitle(base),
  };

  if (parts[0] && /^\d{4}-\d{1,2}-\d{1,2}$/.test(parts[0])) {
    const [y, m, d] = parts[0].split('-');
    data.date = normalizeDate(y, m, d);
    parts.shift();
  } else if (
    parts.length >= 3 &&
    /^\d{4}$/.test(parts[0]) &&
    /^\d{1,2}$/.test(parts[1]) &&
    /^\d{1,2}$/.test(parts[2])
  ) {
    data.date = normalizeDate(parts[0], parts[1], parts[2]);
    parts.splice(0, 3);
  }

  if (parts.length) data.location = parts.shift();
  if (parts.length) data.category = parts.shift();
  if (parts.length) data.note = cleanTitle(parts.join('_'));
  return data;
}

function parseFilenameDate(filename) {
  const base = filename.replace(/\.[^.]+$/i, '');
  let m = base.match(
    /(?:IMG[_-]?|DSC[N]?[_-]?|PXL[_-]?|MVIMG[_-]?|P)?(\d{4})(\d{2})(\d{2})(?:[_-]?(\d{2})(\d{2})(\d{2}))?/i,
  );
  if (m) {
    const date = normalizeDate(m[1], m[2], m[3]);
    if (date) {
      const time =
        m[4] != null
          ? `${m[4].padStart(2, '0')}:${m[5].padStart(2, '0')}:${m[6].padStart(2, '0')}`
          : '';
      return { date, time };
    }
  }
  m = base.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ _](\d{1,2})(\d{2})(\d{2}))?/);
  if (m) {
    const date = normalizeDate(m[1], m[2], m[3]);
    if (date) {
      const time =
        m[4] != null
          ? `${String(m[4]).padStart(2, '0')}:${m[5]}:${m[6]}`
          : '';
      return { date, time };
    }
  }
  return { date: '', time: '' };
}

function loadManifest(dir) {
  const file = path.join(dir, 'photos.json');
  if (!fs.existsSync(file)) {
    return { entries: {}, locations: {}, albums: {}, watermark: null };
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const entries = {};
  const locations = raw._locations && typeof raw._locations === 'object' ? raw._locations : {};
  const albums = raw._albums && typeof raw._albums === 'object' ? raw._albums : {};
  const watermark = raw._watermark && typeof raw._watermark === 'object' ? raw._watermark : null;
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith('_')) continue;
    if (value && typeof value === 'object') entries[key] = value;
  }
  return { entries, locations, albums, watermark };
}

function normalizeStory(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const music =
    raw.music && raw.music.neteaseId
      ? {
          neteaseId: String(raw.music.neteaseId),
          title: String(raw.music.title || ''),
          artist: String(raw.music.artist || ''),
        }
      : null;
  const story = {
    intro: String(raw.intro || ''),
    device: String(raw.device || ''),
    timeLabel: String(raw.timeLabel || ''),
    locationLabel: String(raw.locationLabel || ''),
    weather: String(raw.weather || ''),
    authorBio: String(raw.authorBio || ''),
    music,
  };
  const hasContent =
    story.intro ||
    story.device ||
    story.timeLabel ||
    story.locationLabel ||
    story.weather ||
    story.authorBio ||
    story.music;
  return hasContent ? story : null;
}

function mergeStory(base, override) {
  const a = normalizeStory(base);
  const b = normalizeStory(override);
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  return {
    intro: b.intro || a.intro,
    device: b.device || a.device,
    timeLabel: b.timeLabel || a.timeLabel,
    locationLabel: b.locationLabel || a.locationLabel,
    weather: b.weather || a.weather,
    authorBio: b.authorBio || a.authorBio,
    music: b.music || a.music,
  };
}

function toTimestamp(date, time = '') {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 0;
  const t = time && /^\d{2}:\d{2}:\d{2}$/.test(time) ? time : '00:00:00';
  const ms = Date.parse(`${date}T${t}`);
  return Number.isNaN(ms) ? 0 : ms;
}

function periodKey(date) {
  if (!date || !/^\d{4}-\d{2}/.test(date)) return '未注明日期';
  return date.slice(0, 7);
}

async function readExif(full) {
  try {
    const data = await exifr.parse(full, {
      pick: [
        'DateTimeOriginal',
        'CreateDate',
        'ModifyDate',
        'latitude',
        'longitude',
        'Make',
        'Model',
      ],
    });
    if (!data) return { date: '', time: '', lat: null, lng: null, device: '' };
    let date = '';
    let time = '';
    const dt = data.DateTimeOriginal || data.CreateDate || data.ModifyDate;
    if (dt instanceof Date && !Number.isNaN(dt.getTime())) {
      date = dt.toISOString().slice(0, 10);
      time = dt.toISOString().slice(11, 19);
    }
    const make = String(data.Make || '').trim();
    const model = String(data.Model || '').trim();
    let device = '';
    if (make && model) {
      device = model.toLowerCase().includes(make.toLowerCase()) ? model : `${make} ${model}`;
    } else {
      device = model || make;
    }
    return {
      date,
      time,
      lat: typeof data.latitude === 'number' ? data.latitude : null,
      lng: typeof data.longitude === 'number' ? data.longitude : null,
      device,
    };
  } catch {
    return { date: '', time: '', lat: null, lng: null, device: '' };
  }
}

function loadWatermarkConfig(manifest) {
  const wm = manifest?.watermark && typeof manifest.watermark === 'object' ? manifest.watermark : {};
  const enabled = wm.enabled !== false;
  return {
    enabled,
    text: String(wm.text || 'askuary').trim() || 'askuary',
    opacity: Math.min(0.9, Math.max(0.1, Number(wm.opacity) || 0.42)),
    rev: WATERMARK_REV,
  };
}

function watermarkSvg(width, height, text, opacity) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const fontSize = Math.max(13, Math.min(36, Math.round(Math.min(w, h) * 0.04)));
  const pad = Math.max(12, Math.round(fontSize * 0.85));
  const safe = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  // 右下角半透明品牌字 + 轻阴影，不抢主体
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">` +
      `<style>.wm{font-family:"Segoe UI",Helvetica,Arial,sans-serif;font-size:${fontSize}px;` +
      `font-weight:600;letter-spacing:0.08em;}` +
      `</style>` +
      `<text class="wm" x="${w - pad}" y="${h - pad}" text-anchor="end" ` +
      `fill="rgba(0,0,0,${(opacity * 0.5).toFixed(3)})">${safe}</text>` +
      `<text class="wm" x="${w - pad - 1}" y="${h - pad - 1}" text-anchor="end" ` +
      `fill="rgba(255,255,255,${opacity.toFixed(3)})">${safe}</text>` +
      `</svg>`,
  );
}

async function writeResized(input, output, maxEdge, watermark) {
  ensureDir(path.dirname(output));
  let pipeline = sharp(input)
    .rotate()
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    });

  if (watermark?.enabled && watermark.text) {
    const meta = await pipeline.toBuffer({ resolveWithObject: true });
    const { width, height } = meta.info;
    const svg = watermarkSvg(width, height, watermark.text, watermark.opacity);
    pipeline = sharp(meta.data).composite([
      { input: svg, top: 0, left: 0 },
    ]);
  }

  await pipeline.jpeg({ quality: QUALITY, mozjpeg: true }).toFile(output);
}

function publicUrl(...parts) {
  return `/photowall/${parts.map((p) => encodeURIComponent(p).replace(/%2F/gi, '/')).join('/')}`.replace(
    /%2F/g,
    '/',
  );
}

/** safer: join path segments encoded individually */
function assetUrl(relNoExt, suffix) {
  const segs = `${relNoExt}${suffix}`.split('/').map((s) => encodeURIComponent(s));
  return `/photowall/${segs.join('/')}`;
}

async function build() {
  ensureDir(path.join(root, 'public', 'data'));
  ensureDir(outDir);

  if (!fs.existsSync(sourceDir)) {
    fs.writeFileSync(
      indexPath,
      JSON.stringify({ albums: [], photos: [], categories: [], mapPoints: [] }, null, 2),
    );
    console.log('[photowall] no content/photowall — wrote empty index');
    return;
  }

  const manifest = loadManifest(sourceDir);
  const watermark = loadWatermarkConfig(manifest);
  const wmStampPath = path.join(outDir, '.wm-rev');
  let forceWatermark = false;
  if (watermark.enabled) {
    const prev = fs.existsSync(wmStampPath) ? fs.readFileSync(wmStampPath, 'utf8').trim() : '';
    const stamp = `${watermark.rev}:${watermark.text}:${watermark.opacity}`;
    forceWatermark = prev !== stamp;
  }
  const files = walkImages(sourceDir);
  const photos = [];
  const categories = new Set();
  let wrote = 0;
  let skipped = 0;

  for (const item of files) {
    const meta = parsePhotoName(item.file);
    const albumInfo = resolveAlbumFromPath(item.relative);
    if (albumInfo.category) meta.category = albumInfo.category;

    const override =
      manifest.entries[item.relative] ||
      manifest.entries[item.file] ||
      null;

    const exif = await readExif(item.full);
    const fromName = parseFilenameDate(item.file);

    if (override?.date) {
      meta.date = override.date;
      meta.time = '';
    } else if (exif.date) {
      meta.date = exif.date;
      meta.time = exif.time || '';
    } else if (fromName.date) {
      meta.date = fromName.date;
      meta.time = fromName.time || '';
    } else if (meta.date) {
      meta.time = meta.time || '';
    } else if (albumInfo.trip?.date) {
      meta.date = albumInfo.trip.date;
      meta.time = '';
    } else {
      const st = fs.statSync(item.full);
      meta.date = new Date(st.mtimeMs).toISOString().slice(0, 10);
      meta.time = '';
    }

    if (override) {
      for (const key of ['location', 'category', 'note', 'title', 'device']) {
        if (override[key]) meta[key] = String(override[key]);
      }
    }

    if (!meta.device && exif.device) meta.device = exif.device;

    // 相机文件名误解析出的「地点」丢掉
    if (meta.location && /^(DSC|IMG|PXL|MVIMG|P|PIC)\d*$/i.test(meta.location)) {
      meta.location = '';
    }
    if (
      meta.category &&
      /^(DSC|IMG|PXL|MVIMG|P|PIC)\d*$/i.test(meta.category) &&
      albumInfo.category
    ) {
      meta.category = albumInfo.category;
    }

    // 行程文件夹标题作地点兜底
    if (!meta.location && albumInfo.trip?.title) {
      meta.location = albumInfo.trip.title;
    }
    // 分类/地点 子文件夹作地点兜底
    if (!meta.location && albumInfo.locationHint) {
      meta.location = albumInfo.locationHint;
    }

    let lat = override?.lat ?? exif.lat;
    let lng = override?.lng ?? exif.lng;
    if ((lat == null || lng == null) && meta.location && manifest.locations[meta.location]) {
      lat = manifest.locations[meta.location].lat;
      lng = manifest.locations[meta.location].lng;
    }

    if (!meta.title) {
      meta.title =
        meta.note ||
        meta.location ||
        albumInfo.trip?.title ||
        meta.category ||
        meta.date ||
        item.file;
    }

    if (meta.category) categories.add(meta.category);
    if (albumInfo.trip?.title) categories.add(albumInfo.trip.title);

    const albumKey = albumInfo.albumKey || '未分类';
    const albumReg = manifest.albums[albumKey] || {};
    const story = mergeStory(albumReg.story, override?.story);
    if (story) {
      if (!story.device && meta.device) story.device = meta.device;
      if (!story.timeLabel && meta.date) {
        story.timeLabel = meta.time ? `${meta.date} ${meta.time}` : meta.date;
      }
      if (!story.locationLabel && meta.location) story.locationLabel = meta.location;
    }

    const id = item.relative.replace(/\.[^.]+$/, '').replace(/[^\w\u4e00-\u9fff/-]+/g, '-');
    const relNoExt = item.relative.replace(/\.[^.]+$/i, '');
    const thumbRel = `${relNoExt}.thumb.jpg`;
    const thumbOut = path.join(outDir, thumbRel);
    // 旧版展示图不再生成；若残留则删掉，避免误传大图
    const legacyDisplay = path.join(outDir, `${relNoExt}.jpg`);
    if (fs.existsSync(legacyDisplay)) {
      try {
        fs.unlinkSync(legacyDisplay);
      } catch {
        /* ignore */
      }
    }

    const srcStat = fs.statSync(item.full);
    const needsThumb =
      forceWatermark ||
      !fs.existsSync(thumbOut) ||
      fs.statSync(thumbOut).mtimeMs < srcStat.mtimeMs;

    if (needsThumb) {
      await writeResized(item.full, thumbOut, THUMB_MAX, watermark);
      wrote += 1;
    } else {
      skipped += 1;
    }

    const thumbUrl = assetUrl(relNoExt, '.thumb.jpg');

    photos.push({
      id,
      file: item.relative,
      src: thumbUrl,
      thumb: thumbUrl,
      album: albumKey,
      date: meta.date || '',
      time: meta.time || '',
      location: meta.location || '',
      category: meta.category || '',
      note: meta.note || '',
      title: meta.title || item.file,
      device: meta.device || story?.device || '',
      lat: lat ?? null,
      lng: lng ?? null,
      story: story || null,
      sortTs: toTimestamp(meta.date, meta.time) || srcStat.mtimeMs,
    });
  }

  photos.sort((a, b) => b.sortTs - a.sortTs || b.file.localeCompare(a.file, 'zh-CN'));

  const albumMap = new Map();
  for (const photo of photos) {
    const key = photo.album || '未分类';
    if (!albumMap.has(key)) {
      const reg = manifest.albums[key] || {};
      const trip = parseTripFolder(key.includes('/') ? key.split('/').pop() : key) ||
        parseTripFolder(key);
      // 日常/上海 → 标签优先用地点名
      const placeFromKey = key.includes('/') ? key.split('/').filter(Boolean).pop() : '';
      albumMap.set(key, {
        key,
        label: reg.title || trip?.title || placeFromKey || key,
        description: reg.description || '',
        theme: reg.theme || 'ocean',
        cover: photo.thumb,
        count: 0,
        // 行程相册以文件夹日期为准；旧分类相册取照片最新日期
        latestDate: trip?.date || photo.date || '',
        _tripDate: trip?.date || '',
      });
    }
    const album = albumMap.get(key);
    album.count += 1;
    if (!album.cover) album.cover = photo.thumb;
    if (!album._tripDate && photo.date && (!album.latestDate || photo.date > album.latestDate)) {
      album.latestDate = photo.date;
    }
  }
  for (const album of albumMap.values()) {
    delete album._tripDate;
  }

  const albums = [...albumMap.values()].sort((a, b) =>
    (b.latestDate || '').localeCompare(a.latestDate || ''),
  );

  /** cluster map points by location name (same album can have many places) */
  const mapBuckets = new Map();
  photos.forEach((photo, index) => {
    if (photo.lat == null || photo.lng == null) return;
    const loc = String(photo.location || '').trim();
    const key = loc || `${photo.lat.toFixed(3)},${photo.lng.toFixed(3)}`;
    if (!mapBuckets.has(key)) {
      mapBuckets.set(key, {
        lat: photo.lat,
        lng: photo.lng,
        label: loc || '未命名地点',
        photos: [],
      });
    }
    const bucket = mapBuckets.get(key);
    const n = bucket.photos.length;
    bucket.lat = (bucket.lat * n + photo.lat) / (n + 1);
    bucket.lng = (bucket.lng * n + photo.lng) / (n + 1);
    if (loc && bucket.label === '未命名地点') bucket.label = loc;
    bucket.photos.push({ index, id: photo.id, title: photo.title, thumb: photo.thumb });
  });
  const mapPoints = [...mapBuckets.values()];

  const index = {
    albums,
    photos,
    categories: [...categories].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    mapPoints,
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  if (watermark.enabled) {
    ensureDir(outDir);
    fs.writeFileSync(
      wmStampPath,
      `${watermark.rev}:${watermark.text}:${watermark.opacity}`,
      'utf8',
    );
  }

  // 若已有 dist，直接同步摄影产物，避免为加几张图跑整站 vite build
  const distPhotowall = path.join(root, 'dist', 'photowall');
  const distIndex = path.join(root, 'dist', 'data', 'photowall-index.json');
  if (fs.existsSync(path.join(root, 'dist'))) {
    fs.cpSync(outDir, distPhotowall, { recursive: true });
    fs.mkdirSync(path.dirname(distIndex), { recursive: true });
    fs.copyFileSync(indexPath, distIndex);
    console.log('[photowall] synced → dist/photowall + dist/data/photowall-index.json');
  }

  console.log(
    `[photowall] ${photos.length} photo(s), ${albums.length} album(s), ${mapPoints.length} map point(s)` +
      ` · wrote ${wrote} file(s), skipped ${skipped} (unchanged)` +
      (watermark.enabled ? ` · watermark "${watermark.text}"` : ' · watermark off'),
  );
}

build().catch((err) => {
  console.error('[photowall] failed', err);
  process.exit(1);
});
