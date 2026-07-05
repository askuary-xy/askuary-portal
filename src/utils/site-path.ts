/** 站内路径 — 兼容 GitHub Pages 子路径（如 /askuary-portal/） */
export function sitePath(path = ''): string {
  if (!path || path.startsWith('#') || /^https?:\/\//i.test(path)) {
    return path;
  }

  const base = import.meta.env.BASE_URL;
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${normalized}`;
}
