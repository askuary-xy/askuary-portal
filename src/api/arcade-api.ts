export type ArcadeGalleryItem = {
  id: string;
  gameId: string;
  nick: string;
  note: string;
  kind: string;
  imageUrl: string;
  status?: string;
  createdAt?: string;
};

export type ArcadeLeaderboardRow = {
  id: string;
  gameId: string;
  nick: string;
  playMs: number;
  sessions: number;
  badges: number;
  updatedAt?: string;
};

export type ArcadeRatingSummary = {
  gameId: string;
  avg: number;
  count: number;
  mine: number;
};

function normalizeBase(apiBase: string): string {
  return apiBase.replace(/\/$/, '');
}

function mediaUrl(apiBase: string, imageUrl: string): string {
  if (!imageUrl) return '';
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `${normalizeBase(apiBase)}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
}

const CLIENT_KEY = 'askuary_arcade_client_key_v1';

export function getArcadeClientKey(): string {
  try {
    let key = localStorage.getItem(CLIENT_KEY) || '';
    if (key.length >= 24) return key;
    key =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    key = key.slice(0, 64);
    localStorage.setItem(CLIENT_KEY, key);
    return key;
  } catch {
    return `fallback${Date.now()}${Math.random().toString(36).slice(2)}`.slice(0, 64);
  }
}

export async function fetchArcadeGallery(
  apiBase: string,
  gameId: string,
): Promise<ArcadeGalleryItem[]> {
  const res = await fetch(
    `${normalizeBase(apiBase)}/api/arcade/gallery?gameId=${encodeURIComponent(gameId)}`,
    { cache: 'no-store' },
  );
  if (!res.ok) throw new Error(`画廊加载失败 (${res.status})`);
  const data = (await res.json()) as { items?: ArcadeGalleryItem[] };
  return (data.items || []).map((it) => ({
    ...it,
    imageUrl: mediaUrl(apiBase, it.imageUrl),
  }));
}

export async function uploadArcadeGallery(
  apiBase: string,
  payload: {
    gameId: string;
    nick: string;
    note: string;
    kind?: string;
    file: File;
  },
): Promise<ArcadeGalleryItem> {
  const fd = new FormData();
  fd.set('gameId', payload.gameId);
  fd.set('nick', payload.nick);
  fd.set('note', payload.note);
  fd.set('kind', payload.kind || 'run');
  fd.set('clientKey', getArcadeClientKey());
  fd.set('file', payload.file);

  const res = await fetch(`${normalizeBase(apiBase)}/api/arcade/gallery`, {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) {
    let msg = `上传失败 (${res.status})`;
    try {
      const data = await res.json();
      msg = String(data.message || msg);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const item = (await res.json()) as ArcadeGalleryItem;
  return { ...item, imageUrl: mediaUrl(apiBase, item.imageUrl) };
}

export async function fetchArcadeRatings(
  apiBase: string,
  gameId: string,
): Promise<ArcadeRatingSummary> {
  const key = getArcadeClientKey();
  const res = await fetch(
    `${normalizeBase(apiBase)}/api/arcade/ratings?gameId=${encodeURIComponent(gameId)}&clientKey=${encodeURIComponent(key)}`,
    { cache: 'no-store' },
  );
  if (!res.ok) throw new Error(`评分加载失败 (${res.status})`);
  return res.json();
}

export async function submitArcadeRating(
  apiBase: string,
  gameId: string,
  score: number,
): Promise<void> {
  const res = await fetch(`${normalizeBase(apiBase)}/api/arcade/ratings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gameId,
      score,
      clientKey: getArcadeClientKey(),
    }),
  });
  if (!res.ok) {
    let msg = `评分失败 (${res.status})`;
    try {
      const data = await res.json();
      msg = String(data.message || msg);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
}

export async function fetchArcadeLeaderboard(
  apiBase: string,
  gameId: string,
  limit = 15,
): Promise<ArcadeLeaderboardRow[]> {
  const res = await fetch(
    `${normalizeBase(apiBase)}/api/arcade/leaderboard?gameId=${encodeURIComponent(gameId)}&limit=${limit}`,
    { cache: 'no-store' },
  );
  if (!res.ok) throw new Error(`排行榜加载失败 (${res.status})`);
  const data = (await res.json()) as { items?: ArcadeLeaderboardRow[] };
  return data.items || [];
}

export async function syncArcadeScore(
  apiBase: string,
  payload: {
    gameId: string;
    nick?: string;
    playMs: number;
    sessions: number;
    badges: number;
  },
): Promise<void> {
  const res = await fetch(`${normalizeBase(apiBase)}/api/arcade/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      clientKey: getArcadeClientKey(),
    }),
  });
  if (!res.ok) {
    // 同步失败不打断游玩
    return;
  }
}

export type ArcadeVisitor = {
  known: boolean;
  nick: string;
};

/** 同 IP 已登记的排行榜昵称（跨设备） */
export async function fetchArcadeVisitor(apiBase: string): Promise<ArcadeVisitor> {
  const res = await fetch(`${normalizeBase(apiBase)}/api/arcade/visitor`, {
    cache: 'no-store',
  });
  if (!res.ok) return { known: false, nick: '' };
  const data = (await res.json()) as ArcadeVisitor;
  return {
    known: Boolean(data.known),
    nick: String(data.nick || '').trim(),
  };
}

export async function saveArcadeVisitor(
  apiBase: string,
  nick: string,
): Promise<ArcadeVisitor> {
  const res = await fetch(`${normalizeBase(apiBase)}/api/arcade/visitor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nick: nick.trim().slice(0, 24) }),
  });
  if (!res.ok) {
    let msg = `保存昵称失败 (${res.status})`;
    try {
      const data = await res.json();
      msg = String(data.message || msg);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const data = (await res.json()) as ArcadeVisitor;
  return {
    known: Boolean(data.known),
    nick: String(data.nick || nick).trim(),
  };
}
