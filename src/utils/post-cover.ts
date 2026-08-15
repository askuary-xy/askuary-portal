import { sitePath } from './site-path';
import { resolveCoverApiUrl, resolvePostCover, type CoverKind } from './cover';
import { isShuoshuo } from './content';
import type { BlogPostMeta, SiteConfig } from '../types/config';

export type { CoverKind };

/** 本站旧封面图库（无外链配置时回退） */
const DEFAULT_COVER_API = '/api/covers/{kind}/img?seed={seed}';

/** 文章/碎念默认走栗次元萌图横图 */
const DEFAULT_ALCY_COVER = 'https://t.alcy.cc/moe/?t={seed}';

export function inferCoverKind(
  post: Pick<BlogPostMeta, 'tags'> & { kind?: string },
  fallback: CoverKind = 'journal',
): CoverKind {
  if (post.kind === 'blog') return 'blog';
  if (isShuoshuo(post)) return 'shuoshuo';
  return fallback;
}

/** 规范化封面 API 模板；支持本站 covers 与外链（如 t.alcy.cc） */
function normalizeCoverApiTemplate(template: string, apiBase?: string): string {
  let api = String(template || '').trim() || DEFAULT_ALCY_COVER;

  // 本站旧模板升级
  if (/\/api\/covers\//i.test(api)) {
    api = api.replace(
      /\/api\/covers\/\{kind\}\?seed=\{seed\}/i,
      '/api/covers/{kind}/img?seed={seed}',
    );
    if (!/\/api\/covers\/\{kind\}\/img\?seed=\{seed\}/i.test(api)) {
      api = DEFAULT_COVER_API;
    }
    if (api.startsWith('/')) {
      const base = String(apiBase || '').replace(/\/$/, '');
      api = base ? `${base}${api}` : api;
    }
    return api;
  }

  // 外链模板：保证可用 seed 区分缓存（同 slug 更稳）
  if (/t\.alcy\.cc/i.test(api) && !/\{seed\}|\{slug\}/i.test(api)) {
    api = api.replace(/\/?$/, '/') + (api.includes('?') ? '&' : '?') + 't={seed}';
  }

  return api;
}

/** 旧本站封面 URL → /img，并带版本参数 */
function migrateCoverApiUrl(url: string): string {
  let s = String(url || '').trim();
  if (!/\/api\/covers\//i.test(s)) return s;

  s = s.replace(
    /(\/api\/covers\/[^/?]+)(\?[^#]*)?(?:#.*)?$/i,
    (_, base: string, query = '') => {
      if (/\/img$/i.test(base)) return `${base}${query || ''}`;
      return `${base}/img${query || ''}`;
    },
  );

  try {
    const u = new URL(s, 'https://www.askuary.cn');
    if (!u.searchParams.has('cv')) u.searchParams.set('cv', '3');
    return u.toString();
  } catch {
    return s.includes('cv=') ? s : `${s}${s.includes('?') ? '&' : '?'}cv=3`;
  }
}

export function postCoverSrc(
  post: Pick<BlogPostMeta, 'slug' | 'cover' | 'tags'> & {
    html?: string;
    markdown?: string;
    kind?: string;
  },
  site: Pick<SiteConfig, 'coverImageApi' | 'coverRandom' | 'apiBase'>,
  kind?: CoverKind,
): string {
  const coverKind = kind || inferCoverKind(post);
  const api = normalizeCoverApiTemplate(site.coverImageApi || '', site.apiBase);
  const stored = String(post.cover || '').trim();

  // 文章 / 碎念：默认随机 API；仅自定义静态图例外
  let raw = resolvePostCover({
    cover: stored,
    slug: post.slug,
    coverImageApi: api,
    coverKind,
    useRandomCover: site.coverRandom !== false,
  });

  if (!raw && site.coverRandom !== false) {
    raw = resolveCoverApiUrl(api, post.slug, coverKind);
  }

  if (!raw) return '';
  const normalized = migrateCoverApiUrl(raw);
  if (/^https?:\/\//i.test(normalized) || normalized.startsWith('data:')) return normalized;
  return sitePath(normalized);
}

/** 主页背景：风景横图 API */
export function homeBackgroundSrc(
  site: Pick<SiteConfig, 'homeBackgroundApi'>,
): string {
  const api = String(site.homeBackgroundApi || '').trim() || 'https://t.alcy.cc/fj/';
  return api.endsWith('/') || api.includes('?') ? api : `${api}/`;
}
