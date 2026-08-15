import type { ApiContentItem } from '../api/content-api';
import type { ArchiveEntry, ArchiveIndex, BlogPostMeta } from '../types/config';
import { blogPostHref, journalPostHref } from './content';

/** 与导入 slugify 对齐，用于合并去重（·《》等差异视为同一篇） */
export function normalizeSlugKey(slug: string): string {
  return String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/[·・]/g, '-')
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function mergePostIndex(
  staticPosts: BlogPostMeta[],
  apiPosts: ApiContentItem[],
  suppressedKeys: Set<string> = new Set(),
): BlogPostMeta[] {
  const map = new Map<string, BlogPostMeta>();

  for (const post of staticPosts || []) {
    const key = normalizeSlugKey(post.slug);
    if (!key) continue;
    map.set(key, { ...post, origin: post.origin || 'static' });
  }

  for (const post of apiPosts || []) {
    const key = normalizeSlugKey(post.slug);
    if (!key) continue;
    const prev = map.get(key);
    map.set(key, {
      slug: post.slug,
      title: post.title,
      date: post.date,
      summary: post.summary,
      tags: post.tags || [],
      // API 未带封面/摘要时保留静态 index
      cover: post.cover || prev?.cover || '',
      aiSummary: post.aiSummary || prev?.aiSummary,
      aiSelfIntro: post.aiSelfIntro || prev?.aiSelfIntro,
      aiOutline: post.aiOutline || prev?.aiOutline,
      showAiSummary: prev?.showAiSummary,
      origin: 'api',
    });
  }

  // 草稿 / 删除墓碑：剔掉同 slug 静态稿，避免「后台改了前台还在」
  for (const key of suppressedKeys) {
    map.delete(key);
  }

  return [...map.values()].sort((a, b) =>
    String(b.date || '').localeCompare(String(a.date || '')),
  );
}

export function mergeArchiveIndex(
  staticArchive: ArchiveIndex,
  journalApi: ApiContentItem[],
  blogApi: ApiContentItem[],
  suppressed?: { journal?: Set<string>; blog?: Set<string> },
): ArchiveIndex {
  const map = new Map<string, ArchiveEntry>();

  for (const entry of staticArchive.entries || []) {
    const key = `${entry.source}:${normalizeSlugKey(entry.slug)}`;
    map.set(key, {
      ...entry,
      origin: entry.origin || 'static',
    });
  }

  for (const post of journalApi) {
    const key = `journal:${normalizeSlugKey(post.slug)}`;
    const prev = map.get(key);
    map.set(key, {
      slug: post.slug,
      title: post.title,
      date: post.date,
      summary: post.summary,
      tags: post.tags || [],
      cover: post.cover || prev?.cover || '',
      source: 'journal',
      path: journalPostHref({ slug: post.slug, origin: 'api' }),
      origin: 'api',
    });
  }

  for (const post of blogApi) {
    const key = `blog:${normalizeSlugKey(post.slug)}`;
    const prev = map.get(key);
    map.set(key, {
      slug: post.slug,
      title: post.title,
      date: post.date,
      summary: post.summary,
      tags: post.tags || [],
      cover: post.cover || prev?.cover || '',
      source: 'blog',
      path: blogPostHref({ slug: post.slug, origin: 'api' }),
      origin: 'api',
    });
  }

  for (const key of suppressed?.journal || []) {
    map.delete(`journal:${key}`);
  }
  for (const key of suppressed?.blog || []) {
    map.delete(`blog:${key}`);
  }

  const entries = [...map.values()].sort((a, b) =>
    String(b.date || '').localeCompare(String(a.date || '')),
  );
  const tagSet = new Set<string>();
  for (const entry of entries) {
    for (const tag of entry.tags || []) tagSet.add(tag);
  }

  return {
    entries,
    tags: [...tagSet].sort((a, b) => a.localeCompare(b, 'zh-CN')),
  };
}
