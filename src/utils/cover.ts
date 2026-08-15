/** 文章/碎念封面：有效首图作列表封面，否则按主题走随机封面 API；详情正文保留图片 */

export type CoverKind = 'journal' | 'shuoshuo' | 'blog';

/** 是否可作为封面（排除空值、WP 旧站死链等；显式封面 API URL 可持久化） */
export function isUsableCoverSrc(src: string): boolean {
  const s = String(src || '').trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (lower === 'random' || lower === 'none' || lower === 'null') return false;
  if (s === '#' || lower === 'about:blank') return false;
  // 旧 WP 路径常失效；本站文章配图请用 /uploads/
  if (/\/wp-content\//i.test(s)) return false;
  return true;
}

export function extractCoverFromMarkdown(markdown: string): string {
  const md = String(markdown || '');
  const m = md.match(/!\[[^\]]*]\(\s*<?([^)\s>]+)>?\s*(?:["'][^"']*["'])?\s*\)/);
  return m?.[1]?.trim() || '';
}

export function extractCoverFromHtml(html: string): string {
  const m = String(html || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1]?.trim() || '';
}

/** 正文里的第一张「可用」图（Markdown 优先，其次 HTML） */
export function extractFirstContentImage(markdown?: string, html?: string): string {
  const fromMd = extractCoverFromMarkdown(markdown || '');
  if (isUsableCoverSrc(fromMd)) return fromMd;
  const fromHtml = extractCoverFromHtml(html || '');
  if (isUsableCoverSrc(fromHtml)) return fromHtml;
  return '';
}

/** 从正文 HTML 去掉全部图片（含仅含图的段落） */
export function stripImagesFromHtml(html: string): string {
  let out = String(html || '');
  out = out.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, '');
  out = out.replace(/<picture\b[^>]*>[\s\S]*?<\/picture>/gi, '');
  out = out.replace(/<img\b[^>]*>/gi, '');
  // 去掉因删图而空的 a / p
  out = out.replace(/<a\b[^>]*>\s*<\/a>/gi, '');
  out = out.replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '');
  return out.trim();
}

/** 从 Markdown 去掉全部图片语法 */
export function stripImagesFromMarkdown(markdown: string): string {
  return String(markdown || '')
    .replace(/!\[[^\]]*]\(\s*<?[^)\s>]+>?(?:\s+["'][^"']*["'])?\s*\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 把 {seed}/{slug}/{kind} 替换进封面 API 模板 */
export function resolveCoverApiUrl(
  template: string,
  seed: string,
  kind: CoverKind = 'journal',
): string {
  const safe = encodeURIComponent(
    String(seed || 'askuary').replace(/[^\w\u4e00-\u9fff-]+/g, '-') || 'askuary',
  );
  return String(template || '')
    .replaceAll('{seed}', safe)
    .replaceAll('{slug}', safe)
    .replaceAll('{kind}', encodeURIComponent(kind));
}

/**
 * 封面优先级：
 * - 显式静态封面（上传/外链，非随机 API）
 * - 否则走随机封面 API（按 slug；正文首图不作为列表封面）
 */
export function resolvePostCover(opts: {
  cover?: string | null;
  slug: string;
  markdown?: string;
  html?: string;
  coverImageApi?: string;
  coverKind?: CoverKind;
  useRandomCover?: boolean;
}): string {
  const explicit = String(opts.cover || '').trim();
  const lower = explicit.toLowerCase();
  const isApi =
    /\/api\/covers\//i.test(explicit) ||
    /t\.alcy\.cc/i.test(explicit) ||
    /tc\.alcy\.cc/i.test(explicit);

  // 自定义静态封面才固定；随机 API / random / 空 → 走模板
  if (
    explicit &&
    lower !== 'random' &&
    !isApi &&
    isUsableCoverSrc(explicit)
  ) {
    return explicit;
  }

  const api = String(opts.coverImageApi || '').trim();
  const allowRandom = opts.useRandomCover !== false;
  if (api && allowRandom) {
    return resolveCoverApiUrl(api, opts.slug, opts.coverKind || 'journal');
  }

  // 无 API 时才回落正文首图
  return extractFirstContentImage(opts.markdown, opts.html);
}
