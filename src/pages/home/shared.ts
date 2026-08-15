import { sitePath } from '../../utils/site-path';
import { mountSiteWidgets } from '../../ui/mount-site-widgets';
import { mountMiniRadio } from '../../ui/mount-mini-radio';
import { mountPixelPet } from '../../ui/mount-pixel-pet';
export { escapeHtml, formatDate } from '../../utils/html';
import { escapeHtml } from '../../utils/html';

export function renderTags(tags: string[]): string {
  if (!tags.length) return '';
  return tags
    .map((tag) => `<li class="home-tag">${escapeHtml(tag)}</li>`)
    .join('');
}

const NAV_ICONS: Record<string, string> = {
  portal: '✦',
  blog: '☄',
  archive: '▤',
  about: '◎',
  friends: '⬡',
  camera: '📷',
  github: '⌘',
  email: '✉',
  link: '🔗',
};

/** 导航动态 SVG（Thyuu 感） */
const NAV_SVG_BY_LABEL: Record<string, string> = {
  主页:
    '<svg class="home-nav-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  碎念:
    '<svg class="home-nav-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H11l-4 3.5V15H7.5A2.5 2.5 0 0 1 5 12.5v-6Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  摄影:
    '<svg class="home-nav-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="7" width="17" height="12.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="13.2" r="3.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.5 7 10 4.8h4L15.5 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  归档:
    '<svg class="home-nav-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 8h15v10.5a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V8Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 5.5h17v2.5h-17z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10 12.5h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  宇宙:
    '<svg class="home-nav-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.2" fill="currentColor"/><ellipse cx="12" cy="12" rx="9" ry="3.6" fill="none" stroke="currentColor" stroke-width="1.5" transform="rotate(-24 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" fill="none" stroke="currentColor" stroke-width="1.5" transform="rotate(48 12 12)"/></svg>',
  馆藏:
    '<svg class="home-nav-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.5h9.2A2.3 2.3 0 0 1 18 6.8v12.2l-3.2-1.6-3.3 1.6-3.3-1.6-3.2 1.6V6.8A2.3 2.3 0 0 1 6.5 4.5Z" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round"/></svg>',
  街机:
    '<svg class="home-nav-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3.5" width="16" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.65"/><path d="M8 18.5h8M10 15.5v3M14 15.5v3M9 8h2v2H9zm4 0h2v2h-2z" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round"/></svg>',
  友联:
    '<svg class="home-nav-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 8.5a3 3 0 1 1-3 5.2M14.5 8.5a3 3 0 1 0 3 5.2M8.2 14.8l7.6-5.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  关于:
    '<svg class="home-nav-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 10.5v5M12 7.8v.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
};

function navSvgFor(label: string, url: string): string {
  if (NAV_SVG_BY_LABEL[label]) return NAV_SVG_BY_LABEL[label];
  const path = normalizePath(url);
  if (path.endsWith('/home') || path.includes('/home')) return NAV_SVG_BY_LABEL['主页'];
  if (path.includes('shuoshuo')) return NAV_SVG_BY_LABEL['碎念'];
  if (path.includes('photo')) return NAV_SVG_BY_LABEL['摄影'];
  if (path.includes('library')) return NAV_SVG_BY_LABEL['馆藏'] || NAV_SVG_BY_LABEL['归档'];
  if (path.includes('game')) return NAV_SVG_BY_LABEL['街机'];
  if (path.includes('archive')) return NAV_SVG_BY_LABEL['归档'];
  if (label.includes('宇宙') || url === '/') return NAV_SVG_BY_LABEL['宇宙'];
  return (
    '<svg class="home-nav-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>'
  );
}

/** 与导航栏同款 SVG，供传送门 chip 等复用 */
export function renderNavIconSvg(label: string, url = ''): string {
  return navSvgFor(label, url).replace(/home-nav-ico/g, 'home-nav-ico hr-chip-svg');
}

function normalizePath(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  return trimmed || '/';
}

export function renderNavLinks(
  links: { label: string; url: string; icon?: string }[] | undefined,
  _currentPath?: string,
): string {
  if (!links?.length) return '';
  const current = normalizePath(window.location.pathname);
  return links
    .map((link) => {
      const href = sitePath(link.url);
      const target = normalizePath(href);
      const active =
        current === target ||
        (link.url !== '/' && target !== '/' && current.startsWith(`${target}/`));
      const cls = active ? 'home-nav-link is-active' : 'home-nav-link';
      return (
        `<a class="${cls}" href="${escapeHtml(href)}">` +
        navSvgFor(link.label, link.url) +
        `<span class="home-nav-label">${escapeHtml(link.label)}</span>` +
        `</a>`
      );
    })
    .join('');
}

/** 下滑收起、上滑出现，减少阅读时的屏幕占用。 */
export function bindHomeHeaderScroll(header?: HTMLElement | null): void {
  const el = header || document.querySelector<HTMLElement>('.home-header');
  if (!el || el.dataset.scrollBound === '1') return;
  el.dataset.scrollBound = '1';
  el.classList.remove('is-hidden');

  let ticking = false;
  let lastY = window.scrollY || 0;
  const update = () => {
    ticking = false;
    const y = window.scrollY || 0;
    el.classList.toggle('is-scrolled', y > 12);
    if (y > lastY + 8 && y > 120) el.classList.add('is-hidden');
    else if (y < lastY - 6 || y < 40) el.classList.remove('is-hidden');
    lastY = y;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

/**
 * 把导航栏钉到 body 最顶部，保证主页 / 碎念 / 摄影等换页后位置一致。
 * 同时挂载全站天气 / 昼夜切换，使主题偏好在各页生效。
 */
export function syncHomeNavOffset(header?: HTMLElement | null): number {
  const el =
    header ||
    document.querySelector<HTMLElement>('.home-header');
  if (!el) return 0;
  const h = Math.max(48, Math.ceil(el.getBoundingClientRect().height));
  document.documentElement.style.setProperty('--home-nav-offset', `${h}px`);
  document.documentElement.style.scrollPaddingTop = `${h + 10}px`;
  return h;
}

export function pinHomeHeader(
  header?: HTMLElement | null,
  options?: { mountChrome?: boolean },
): HTMLElement | null {
  const el =
    header ||
    document.querySelector<HTMLElement>('.home-header');
  if (!el) return null;
  // 背景层可在前，顶栏始终 fixed
  if (el.parentElement !== document.body) {
    document.body.insertBefore(el, document.body.firstChild);
  } else {
    const bg = document.querySelector('.home-bg');
    if (bg && bg.parentElement === document.body) {
      document.body.insertBefore(el, bg.nextSibling);
    } else if (el !== document.body.firstElementChild) {
      document.body.insertBefore(el, document.body.firstChild);
    }
  }
  el.style.position = 'fixed';
  el.style.top = '0';
  el.style.left = '0';
  el.style.right = '0';
  el.style.zIndex = '50';
  document.body.classList.add('has-fixed-home-nav');
  syncHomeNavOffset(el);
  bindHomeHeaderScroll(el);
  requestAnimationFrame(() => syncHomeNavOffset(el));
  window.setTimeout(() => syncHomeNavOffset(el), 120);
  if (el.dataset.navOffsetBound !== '1') {
    el.dataset.navOffsetBound = '1';
    window.addEventListener('resize', () => syncHomeNavOffset(el), { passive: true });
  }
  if (options?.mountChrome !== false) {
    mountPixelPet();
    mountSiteWidgets();
    void mountMiniRadio();
  }
  return el;
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
  /** 顶栏显示名称；不影响站点名称 */
  brandLabel?: string;
  navHtml: string;
  mainHtml: string;
  footerHtml: string;
  /** 全页背景图 URL（如栗次元风景 API） */
  backgroundUrl?: string;
  /** 顶栏品牌图（默认不用图，用特效字） */
  brandLogoUrl?: string;
  withLogoImage?: boolean;
  /** 是否渲染站内搜索框 */
  withSearch?: boolean;
  /** false 时不渲染 home-header（子页改用 mountPixelNav） */
  withHeader?: boolean;
}): string {
  const bg = String(options.backgroundUrl || '').trim();
  const bgHtml = bg
    ? `<div class="home-bg" aria-hidden="true">` +
      `<img class="home-bg-img" src="${escapeHtml(bg)}" alt="" decoding="async" referrerpolicy="no-referrer" />` +
      `<div class="home-bg-veil"></div>` +
      `<div class="home-bg-glow"></div>` +
      `</div>`
    : '';

  const logo = String(options.brandLogoUrl || '').trim();
  const brandLabel = String(options.brandLabel || options.siteName).trim();
  // 优先特效字品牌；仅显式传 brandLogoUrl 且 withLogoImage 时才用图
  const brandHtml = options.withLogoImage && logo
    ? `<a class="home-brand home-brand--logo" href="${escapeHtml(sitePath('/home/'))}">` +
      `<img class="home-brand-logo" src="${escapeHtml(logo)}" alt="${escapeHtml(options.siteName)}" height="28" decoding="async" />` +
      `</a>`
    : `<a class="home-brand home-brand--glitch" href="${escapeHtml(sitePath('/home/'))}">` +
      `<span class="hr-glitch hr-glitch--nav" data-text="${escapeHtml(brandLabel)}">${escapeHtml(brandLabel)}</span>` +
      `</a>`;

  const searchHtml = options.withSearch
    ? `<div class="home-search" id="homeSearch">` +
      `<label class="home-search-field">` +
      `<span class="visually-hidden">搜索</span>` +
      `<svg class="home-search-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M16.2 16.2 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>` +
      `<input id="homeSearchInput" type="search" placeholder="搜索文章 / 碎念…" autocomplete="off" />` +
      `</label>` +
      `<div class="home-search-panel" id="homeSearchPanel" hidden></div>` +
      `</div>`
    : '';

  const headerHtml =
    options.withHeader === false
      ? ''
      : `<header class="home-header">` +
        `<div class="home-header-inner">` +
        brandHtml +
        `<nav class="home-nav" aria-label="站点导航">${options.navHtml}</nav>` +
        searchHtml +
        `</div></header>`;

  return (
    bgHtml +
    `<a class="home-skip" href="#homeMain">跳到正文</a>` +
    headerHtml +
    `<main class="home-main" id="homeMain">${options.mainHtml}</main>` +
    `<footer class="home-hub-footer home-footer"><div class="home-hub-footer-inner home-footer-inner">${options.footerHtml}</div></footer>`
  );
}
