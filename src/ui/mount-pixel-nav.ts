import '../styles/pixel-nav.css';
import { sitePath } from '../utils/site-path';
import { escapeHtml } from '../utils/html';
import { mountSiteWidgets, type SiteWidgetsOptions } from './mount-site-widgets';
import { mountPixelPet } from './mount-pixel-pet';
import { mountMiniRadio } from './mount-mini-radio';

export type PixelNavLink = {
  label: string;
  href: string;
  active?: boolean;
};

export type PixelNavOptions = {
  /** 左侧 logo 文案 */
  brand?: string;
  brandHref?: string;
  /** logo 旁返回 */
  backHref?: string;
  backLabel?: string;
  /** 中间标题 */
  title?: string;
  /** 中间链接/按钮（如分类） */
  links?: PixelNavLink[];
  /** 自定义中间 HTML（优先于 title/links） */
  midHtml?: string;
  /** 是否挂天气/宠物/电台 */
  mountChrome?: boolean;
  widgets?: SiteWidgetsOptions;
  petLines?: string[];
};

function renderMid(options: PixelNavOptions): string {
  if (options.midHtml) return options.midHtml;
  if (options.links?.length) {
    return options.links
      .map((l) => {
        const cls = l.active ? 'px-nav-link is-active' : 'px-nav-link';
        return `<a class="${cls}" href="${escapeHtml(sitePath(l.href))}">${escapeHtml(l.label)}</a>`;
      })
      .join('');
  }
  if (options.title) {
    return '';
  }
  return '';
}

function ensureChrome(options: PixelNavOptions): void {
  if (options.mountChrome === false) return;
  mountSiteWidgets(options.widgets || {});
  mountPixelPet({ lines: options.petLines });
  void mountMiniRadio();
}

function bindAutoHide(header: HTMLElement): void {
  if (header.dataset.autoHideBound === '1') return;
  header.dataset.autoHideBound = '1';
  let lastY = window.scrollY || 0;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = window.scrollY || 0;
      const down = y > lastY + 8;
      const up = y < lastY - 6;
      if (down && y > 120) header.classList.add('is-hidden');
      else if (up || y < 40) header.classList.remove('is-hidden');
      lastY = y;
    });
  }, { passive: true });
}

/** 非主页统一书库式像素顶栏：logo + 返回在左；已存在则只更新内容 */
export function mountPixelNav(options: PixelNavOptions = {}): HTMLElement {
  document.querySelectorAll('.home-header').forEach((el) => el.remove());

  const brand =
    options.title ||
    options.links?.find((link) => link.active)?.label ||
    options.brand ||
    'ASKUARY';
  const brandHref = sitePath(options.brandHref || '/home/');
  const backHref = sitePath(options.backHref || '/home/');
  const backLabel = options.backLabel || '← HOME';
  const mid = renderMid(options);

  let header = document.getElementById('pxNav') as HTMLElement | null;
  if (header) {
    const logoText = header.querySelector('.px-nav-logo-text');
    if (logoText) logoText.textContent = brand;
    const logo = header.querySelector<HTMLAnchorElement>('.px-nav-logo');
    if (logo) logo.href = brandHref;
    const back = header.querySelector<HTMLAnchorElement>('.px-nav-back');
    if (back) {
      back.href = backHref;
      back.textContent = backLabel;
    }
    const midEl = header.querySelector('.px-nav-mid');
    if (midEl) midEl.innerHTML = mid;
  } else {
    document.querySelectorAll('.px-nav').forEach((el) => el.remove());
    header = document.createElement('header');
    header.className = 'px-nav';
    header.id = 'pxNav';
    header.innerHTML =
      `<div class="px-nav-left">` +
      `<a class="px-nav-logo" href="${escapeHtml(brandHref)}" aria-label="站点主页">` +
      `<span class="px-nav-logo-mark" aria-hidden="true"></span>` +
      `<span class="px-nav-logo-text">${escapeHtml(brand)}</span>` +
      `</a>` +
      `<a class="px-nav-back" href="${escapeHtml(backHref)}">${escapeHtml(backLabel)}</a>` +
      `</div>` +
      `<div class="px-nav-mid">${mid}</div>`;
    document.body.insertBefore(header, document.body.firstChild);
  }

  document.body.classList.add('has-pixel-nav');
  document.body.classList.remove('has-fixed-home-nav');
  document.documentElement.style.setProperty('--home-nav-offset', '4.2rem');
  bindAutoHide(header);
  ensureChrome(options);
  return header;
}

/** 软导航进主页时收起独立顶栏（主页自有 header） */
export function hidePixelNav(): void {
  const nav = document.getElementById('pxNav');
  if (nav) nav.hidden = true;
  document.body.classList.remove('has-pixel-nav');
}

export function showPixelNav(): void {
  const nav = document.getElementById('pxNav');
  if (nav) nav.hidden = false;
}
