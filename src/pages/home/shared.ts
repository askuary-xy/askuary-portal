import { sitePath } from '../../utils/site-path';

export function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatDate(date: string): string {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function renderTags(tags: string[]): string {
  if (!tags.length) return '';
  return tags
    .map((tag) => `<li class="home-tag">${escapeHtml(tag)}</li>`)
    .join('');
}

const NAV_ICONS: Record<string, string> = {
  portal: '✦',
  blog: '☄',
  about: '◎',
  friends: '⬡',
  github: '⌘',
  email: '✉',
  link: '🔗',
};

export function renderNavLinks(
  links: { label: string; url: string; icon?: string }[] | undefined,
  _currentPath?: string,
): string {
  if (!links?.length) return '';
  const current = window.location.pathname;
  return links
    .map((link) => {
      const href = sitePath(link.url);
      const active =
        current === href ||
        (link.url !== '/' && current.startsWith(href.replace(/\/$/, '')));
      const cls = active ? 'home-nav-link is-active' : 'home-nav-link';
      return `<a class="${cls}" href="${escapeHtml(href)}">${escapeHtml(link.label)}</a>`;
    })
    .join('');
}

export function renderFooterLinks(
  links: { label: string; url: string; icon?: string }[] | undefined,
): string {
  if (!links?.length) return '';
  return links
    .map((link) => {
      const icon = NAV_ICONS[link.icon ?? ''] ?? '';
      const href = sitePath(link.url);
      const external = /^https?:\/\//i.test(link.url);
      const rel = external ? ' rel="noopener noreferrer"' : '';
      const target = external ? ' target="_blank"' : '';
      return (
        `<a class="home-footer-link" href="${escapeHtml(href)}"${target}${rel}>` +
        (icon ? `<span class="home-footer-icon" aria-hidden="true">${icon}</span>` : '') +
        `<span>${escapeHtml(link.label)}</span></a>`
      );
    })
    .join('');
}

export function renderShowcaseIcon(icon?: string): string {
  const glyph = NAV_ICONS[icon ?? ''] ?? '·';
  return `<span class="home-showcase-icon" aria-hidden="true">${glyph}</span>`;
}

export function renderHomeShell(options: {
  siteName: string;
  navHtml: string;
  mainHtml: string;
  footerHtml: string;
}): string {
  return (
    `<a class="home-skip" href="#homeMain">跳到正文</a>` +
    `<header class="home-header">` +
    `<div class="home-header-inner">` +
    `<a class="home-brand" href="${escapeHtml(sitePath('/home/'))}">${escapeHtml(options.siteName)}</a>` +
    `<nav class="home-nav" aria-label="站点导航">${options.navHtml}</nav>` +
    `</div></header>` +
    `<main class="home-main" id="homeMain">${options.mainHtml}</main>` +
    `<footer class="home-footer"><div class="home-footer-inner">${options.footerHtml}</div></footer>`
  );
}
