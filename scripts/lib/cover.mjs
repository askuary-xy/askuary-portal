/** 构建用：与 src/utils/cover.ts 保持一致的可用封面判定 */

export function isUsableCoverSrc(src) {
  const s = String(src || '').trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (lower === 'random' || lower === 'none' || lower === 'null') return false;
  if (s === '#' || lower === 'about:blank') return false;
  if (/\/api\/covers\//i.test(s)) return false;
  // 旧 WP 杂项路径无效；本站配图用 /uploads/（构建自 content/uploads）
  if (/\/wp-content\//i.test(s)) return false;
  return true;
}

export function stripImagesFromHtml(html) {
  let out = String(html || '');
  out = out.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, '');
  out = out.replace(/<picture\b[^>]*>[\s\S]*?<\/picture>/gi, '');
  out = out.replace(/<img\b[^>]*>/gi, '');
  out = out.replace(/<a\b[^>]*>\s*<\/a>/gi, '');
  out = out.replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '');
  return out.trim();
}

export function pickCoverFromContent(markdown, html, explicit) {
  const md = String(markdown || '');
  const mdImg = md.match(/!\[[^\]]*]\(\s*<?([^)\s>]+)>?\s*(?:["'][^"']*["'])?\s*\)/);
  const fromMd = mdImg?.[1]?.trim() || '';
  if (isUsableCoverSrc(fromMd)) return fromMd;
  const htmlImg = String(html || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  const fromHtml = htmlImg?.[1]?.trim() || '';
  if (isUsableCoverSrc(fromHtml)) return fromHtml;
  const ex = String(explicit || '').trim();
  if (isUsableCoverSrc(ex)) return ex;
  return '';
}
