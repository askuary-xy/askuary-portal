/** 剥 HTML / 控制字符，评论与友联入库前消毒 */
export function stripHtml(input: string): string {
  return String(input || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

export function sanitizeText(input: string, maxLen?: number): string {
  let out = stripHtml(input)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (typeof maxLen === 'number' && maxLen > 0 && out.length > maxLen) {
    out = out.slice(0, maxLen);
  }
  return out;
}

export function sanitizeMultiline(input: string, maxLen?: number): string {
  let out = stripHtml(input)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (typeof maxLen === 'number' && maxLen > 0 && out.length > maxLen) {
    out = out.slice(0, maxLen);
  }
  return out;
}
