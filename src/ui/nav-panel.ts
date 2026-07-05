import type { NavStarHit } from '../canvas/nav-stars';
import { sitePath } from '../utils/site-path';
import { showToast } from './toast';

const ICONS: Record<string, string> = {
  blog: '✦',
  link: '◈',
  user: '◎',
  star: '✧',
  archive: '▤',
};

const panel = () => document.getElementById('navPanel');
const titleEl = () => document.getElementById('navPanelTitle');
const descEl = () => document.getElementById('navPanelDesc');
const iconEl = () => document.getElementById('navPanelIcon');
const linkEl = () => document.getElementById('navPanelLink') as HTMLAnchorElement | null;
const closeBtn = () => document.getElementById('navPanelClose');

export function initNavPanel(): void {
  closeBtn()?.addEventListener('click', hideNavPanel);
  panel()?.addEventListener('click', (e) => {
    if (e.target === panel()) hideNavPanel();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideNavPanel();
  });
}

export function showNavPanel(hit: NavStarHit): void {
  const { star } = hit;
  const root = panel();
  if (!root) return;

  const enabled = star.enabled !== false;
  const icon = ICONS[star.icon ?? ''] ?? '✦';

  if (iconEl()) iconEl()!.textContent = icon;
  if (titleEl()) titleEl()!.textContent = star.label;
  if (descEl()) {
    descEl()!.textContent = enabled ? star.desc || '' : star.disabledHint || '即将开放';
  }

  const link = linkEl();
  if (link) {
    if (!enabled) {
      link.hidden = true;
    } else if (star.url === '#explore') {
      link.hidden = false;
      link.href = '#';
      link.textContent = '知道了';
      link.onclick = (e) => {
        e.preventDefault();
        hideNavPanel();
        showToast('试试点击地球上的光点，或悬停文字流星');
      };
    } else {
      link.hidden = false;
      link.onclick = null;
      link.href = sitePath(star.url);
      link.textContent = star.url.startsWith('#') ? '查看' : '前往';
      link.removeAttribute('rel');
      if (star.url.startsWith('#')) {
        link.removeAttribute('target');
      } else if (star.url.startsWith('/') || star.url.startsWith('.')) {
        link.target = '_self';
      } else {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
    }
  }

  root.hidden = false;
  root.classList.add('is-open');
}

export function hideNavPanel(): void {
  const root = panel();
  if (!root) return;
  root.classList.remove('is-open');
  root.hidden = true;
  const link = linkEl();
  if (link) link.onclick = null;
}
