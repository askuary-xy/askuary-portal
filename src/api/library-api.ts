import type { LibraryIndex, LibraryItem } from '../types/config';

function normalizeBase(apiBase: string): string {
  return apiBase.replace(/\/$/, '');
}

export type LibraryApiPayload = {
  items?: LibraryItem[];
  managed?: boolean;
  kinds?: Record<string, string>;
  statuses?: Record<string, string>;
};

export async function fetchLibraryApi(
  apiBase: string,
): Promise<LibraryApiPayload | null> {
  if (!apiBase?.trim()) return null;
  try {
    const res = await fetch(`${normalizeBase(apiBase)}/api/library`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as LibraryApiPayload;
  } catch {
    return null;
  }
}

/**
 * 有后台数据时以 API 为准（managed）；否则保留静态 JSON。
 * 未接管时：同 id 用 API 覆盖，并追加仅存在于 API 的条目。
 */
export function mergeLibraryIndex(
  base: LibraryIndex,
  api?: LibraryApiPayload | null,
): LibraryIndex {
  if (!api?.items?.length) return base;

  if (api.managed) {
    return {
      ...base,
      items: api.items,
      kinds: api.kinds
        ? Object.fromEntries(
            Object.entries(api.kinds).map(([k, label]) => [k, { label }]),
          )
        : base.kinds,
      statuses: api.statuses
        ? Object.fromEntries(
            Object.entries(api.statuses).map(([k, label]) => [k, { label }]),
          )
        : base.statuses,
      generatedAt: new Date().toISOString(),
    };
  }

  const apiMap = new Map(api.items.map((i) => [i.id, i]));
  const merged = (base.items || []).map((item) => {
    const over = apiMap.get(item.id);
    if (!over) return item;
    return { ...item, ...over };
  });
  const seen = new Set(merged.map((i) => i.id));
  for (const item of api.items) {
    if (seen.has(item.id)) continue;
    merged.push(item);
  }
  return { ...base, items: merged };
}
