import type { EarthSpot, MeteorWord, NavStar } from '../types/config';

function normalizeBase(apiBase: string): string {
  return apiBase.replace(/\/$/, '');
}

export type PortalOverlay = {
  spots: EarthSpot[] | null;
  meteorWords: MeteorWord[] | null;
  navStars: NavStar[] | null;
};

export async function fetchPortalItems<T>(
  apiBase: string | undefined,
  key: string,
): Promise<T[] | null> {
  if (!apiBase?.trim()) return null;
  try {
    const res = await fetch(
      `${normalizeBase(apiBase)}/api/portal/${encodeURIComponent(key)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: T[] | null };
    return Array.isArray(data.items) ? data.items : null;
  } catch {
    return null;
  }
}

/** 有 DB 覆盖时返回数组；无覆盖返回 null（前台继续用静态 JSON） */
export async function fetchPortalOverlay(
  apiBase?: string,
): Promise<PortalOverlay> {
  if (!apiBase?.trim()) {
    return { spots: null, meteorWords: null, navStars: null };
  }
  const [spots, meteorWords, navStars] = await Promise.all([
    fetchPortalItems<EarthSpot>(apiBase, 'spots'),
    fetchPortalItems<MeteorWord>(apiBase, 'meteor-words'),
    fetchPortalItems<NavStar>(apiBase, 'nav-stars'),
  ]);
  return { spots, meteorWords, navStars };
}
