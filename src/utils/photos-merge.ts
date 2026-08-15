import type {
  PhotoAlbum,
  PhotoMetaItem,
  PhotoStory,
  PhotowallIndex,
} from '../types/config';

type ApiPhotosPayload = {
  albums?: PhotoAlbum[];
  photos?: PhotoMetaItem[];
  /** 后台软删的 photoId，前台应从静态索引剔除 */
  suppressedIds?: string[];
};

function mergeStory(base: PhotoStory | null | undefined, over: PhotoStory | null | undefined): PhotoStory | null {
  if (!base && !over) return null;
  const a = base || {};
  const b = over || {};
  const music =
    b.music === null
      ? null
      : b.music
        ? { ...(a.music || {}), ...b.music }
        : a.music || null;
  return {
    intro: b.intro ?? a.intro,
    device: b.device ?? a.device,
    timeLabel: b.timeLabel ?? a.timeLabel,
    locationLabel: b.locationLabel ?? a.locationLabel,
    weather: b.weather ?? a.weather,
    authorBio: b.authorBio ?? a.authorBio,
    music: music || null,
  };
}

/**
 * 静态索引为文件清单真相；API 只覆盖同 id 的文案/元数据。
 * suppressedIds：后台删除的照片从前台剔除。
 */
export function mergePhotowallIndex(
  base: PhotowallIndex,
  api?: ApiPhotosPayload | null,
): PhotowallIndex {
  if (!api) return rebuildMapPoints(base);

  const suppressed = new Set((api.suppressedIds || []).map(String));
  const apiPhotos = new Map((api.photos || []).map((p) => [p.id, p]));
  const apiAlbums = new Map((api.albums || []).map((a) => [a.key, a]));

  const photos = (base.photos || [])
    .filter((p) => !suppressed.has(p.id))
    .map((p) => {
    const o = apiPhotos.get(p.id);
    if (!o) return p;
    return {
      ...p,
      title: o.title || p.title,
      date: o.date || p.date,
      time: o.time || p.time,
      location: o.location || p.location,
      category: o.category || p.category,
      note: o.note || p.note,
      device: o.device || p.device,
      album: o.album || p.album,
      lat: o.lat !== undefined ? o.lat : p.lat,
      lng: o.lng !== undefined ? o.lng : p.lng,
      // 路径以静态构建为准（改名后 DB 旧路径会 404 变灰）
      src: p.src || o.src,
      thumb: p.thumb || o.thumb,
      file: p.file || o.file,
      story: mergeStory(p.story, o.story),
      sortTs: o.sortTs || p.sortTs,
    };
  });

  const albums = (base.albums || []).map((a) => {
    const o = apiAlbums.get(a.key);
    if (!o) return a;
    return {
      ...a,
      label: o.label || a.label,
      description: o.description || a.description,
      theme: o.theme || a.theme,
      cover: a.cover || o.cover,
      date: o.date || a.date,
      latestDate: o.latestDate || o.date || a.latestDate,
      count: typeof a.count === 'number' && a.count > 0 ? a.count : o.count || 0,
      story: mergeStory(a.story, o.story),
    };
  });

  // API 新建的相册（静态索引还没有）也并入
  for (const [key, a] of apiAlbums) {
    if (!albums.some((x) => x.key === key)) {
      albums.push({
        key: a.key,
        label: a.label || a.key,
        description: a.description,
        theme: a.theme || 'ocean',
        cover: a.cover || '',
        count: a.count || 0,
        latestDate: a.latestDate || a.date,
        date: a.date,
        story: a.story || null,
      });
    }
  }

  photos.sort((a, b) => b.sortTs - a.sortTs || b.file.localeCompare(a.file, 'zh-CN'));
  albums.sort((a, b) => (b.latestDate || '').localeCompare(a.latestDate || ''));

  return rebuildMapPoints({
    ...base,
    photos,
    albums,
  });
}

/** 按坐标/地点重算地图点（后台改 lat/lng 后前台立刻生效） */
function rebuildMapPoints(index: PhotowallIndex): PhotowallIndex {
  const mapBuckets = new Map<
    string,
    {
      lat: number;
      lng: number;
      label: string;
      photos: { index: number; id: string; title: string; thumb: string }[];
    }
  >();

  (index.photos || []).forEach((photo, i) => {
    if (photo.lat == null || photo.lng == null) return;
    if (!Number.isFinite(photo.lat) || !Number.isFinite(photo.lng)) return;
    const loc = String(photo.location || '').trim();
    const key = loc
      ? `loc:${loc}`
      : `${photo.lat.toFixed(3)},${photo.lng.toFixed(3)}`;
    if (!mapBuckets.has(key)) {
      mapBuckets.set(key, {
        lat: photo.lat,
        lng: photo.lng,
        label: loc || '未命名地点',
        photos: [],
      });
    }
    const bucket = mapBuckets.get(key)!;
    // 同地点多坐标时取平均
    const n = bucket.photos.length;
    bucket.lat = (bucket.lat * n + photo.lat) / (n + 1);
    bucket.lng = (bucket.lng * n + photo.lng) / (n + 1);
    if (loc && bucket.label === '未命名地点') bucket.label = loc;
    bucket.photos.push({
      index: i,
      id: photo.id,
      title: photo.title,
      thumb: photo.thumb,
    });
  });

  return {
    ...index,
    mapPoints: [...mapBuckets.values()],
  };
}
