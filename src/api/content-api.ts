import type { BlogPost, BlogPostMeta, JournalPost } from '../types/config';
import { normalizeSlugKey } from '../utils/content-merge';

function normalizeBase(apiBase: string): string {
  return apiBase.replace(/\/$/, '');
}

export type ApiContentItem = BlogPostMeta & {
  html: string;
  markdown?: string;
  kind: 'journal' | 'blog';
  status?: string;
  origin: 'api';
};

export type SuppressedContentItem = {
  kind: 'journal' | 'blog';
  slug: string;
  reason: 'draft' | 'deleted';
};

export type ContentVisibility = {
  /** 规范化 slug → 需从静态稿剔除 */
  suppressedKeys: Set<string>;
  /** 后台已接管该 kind：列表/详情不再回退静态 JSON */
  managed: boolean;
};

export async function fetchPublishedContent(
  apiBase: string,
  kind?: 'journal' | 'blog',
): Promise<ApiContentItem[]> {
  if (!apiBase?.trim()) return [];
  const q = new URLSearchParams({ status: 'published' });
  if (kind) q.set('kind', kind);
  try {
    const res = await fetch(`${normalizeBase(apiBase)}/api/content?${q}`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: ApiContentItem[] };
    return (data.items || []).map((item) => ({
      ...item,
      origin: 'api' as const,
      tags: item.tags || [],
    }));
  } catch {
    return [];
  }
}

/** 草稿 + 已删墓碑；managed 表示后台已接管，应忽略静态稿 */
export async function fetchContentVisibility(
  apiBase: string,
  kind?: 'journal' | 'blog',
): Promise<ContentVisibility> {
  if (!apiBase?.trim()) {
    return { suppressedKeys: new Set(), managed: false };
  }
  const q = new URLSearchParams();
  if (kind) q.set('kind', kind);
  try {
    const res = await fetch(
      `${normalizeBase(apiBase)}/api/content/suppressed?${q}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return { suppressedKeys: new Set(), managed: false };
    const data = (await res.json()) as {
      items?: SuppressedContentItem[];
      managed?: boolean;
    };
    const keys = new Set<string>();
    for (const item of data.items || []) {
      if (kind && item.kind !== kind) continue;
      const key = normalizeSlugKey(item.slug);
      if (key) keys.add(key);
    }
    return {
      suppressedKeys: keys,
      managed: Boolean(data.managed),
    };
  } catch {
    return { suppressedKeys: new Set(), managed: false };
  }
}

/** @deprecated 用 fetchContentVisibility */
export async function fetchSuppressedSlugKeys(
  apiBase: string,
  kind?: 'journal' | 'blog',
): Promise<Set<string>> {
  const v = await fetchContentVisibility(apiBase, kind);
  return v.suppressedKeys;
}

export async function fetchContentPost(
  apiBase: string,
  kind: 'journal' | 'blog',
  slug: string,
): Promise<(JournalPost | BlogPost) | null> {
  if (!apiBase?.trim() || !slug) return null;
  try {
    const res = await fetch(
      `${normalizeBase(apiBase)}/api/content/${encodeURIComponent(kind)}/${encodeURIComponent(slug)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const item = (await res.json()) as ApiContentItem;
    return {
      slug: item.slug,
      title: item.title,
      date: item.date,
      summary: item.summary,
      tags: item.tags || [],
      html: item.html,
      cover: item.cover || '',
      origin: 'api',
    };
  } catch {
    return null;
  }
}
