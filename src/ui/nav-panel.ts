import type { NavStarHit } from '../canvas/nav-stars';

const panel = () => document.getElementById('navPanel');
const titleEl = () => document.getElementById('navPanelTitle');
const descEl = () => document.getElementById('navPanelDesc');
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
  if (titleEl()) titleEl()!.textContent = star.label;
  if (descEl()) descEl()!.textContent = star.desc || '';
  if (linkEl()) {
    linkEl()!.href = star.url;
    linkEl()!.textContent = star.url.startsWith('#') ? '查看' : '前往';
    const link = linkEl();
    if (!link) return;
    if (star.url.startsWith('#')) {
      link.removeAttribute('target');
      link.removeAttribute('rel');
    } else {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
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
}
