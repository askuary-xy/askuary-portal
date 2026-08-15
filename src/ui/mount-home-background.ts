import '../styles/home-bg.css';
import { homeBackgroundSrc } from '../utils/post-cover';
import type { SiteConfig } from '../types/config';

function escapeAttr(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/** 浅色枢纽页风景背景（宇宙主题页不要调用） */
export function mountHomeBackground(site: Pick<SiteConfig, 'homeBackgroundApi'>): void {
  if (document.querySelector('.home-bg')) return;
  const url = homeBackgroundSrc(site);
  if (!url) return;

  const el = document.createElement('div');
  el.className = 'home-bg';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    `<img class="home-bg-img" src="${escapeAttr(url)}" alt="" decoding="async" referrerpolicy="no-referrer" />` +
    `<div class="home-bg-veil"></div>` +
    `<div class="home-bg-glow"></div>`;
  document.body.insertBefore(el, document.body.firstChild);
}
