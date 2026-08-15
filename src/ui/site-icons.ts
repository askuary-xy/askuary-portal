import { Heart, QuestCompass, Scroll, SparkleStar, Star } from '@pxlkit/gamification';
import { Link, Sparkles } from '@pxlkit/feedback';
import { iconImgHtml } from '../lib/pxlkit-svg';

/** 导航恒星 / 面板用的 Pxlkit 像素图标 */
const NAV_ICONS = {
  blog: Scroll,
  link: Link,
  user: Sparkles,
  star: Star,
  archive: Scroll,
  camera: SparkleStar,
  explore: QuestCompass,
} as const;

/** 社交品牌线框图标 — 宇宙 / 主页共用 */
const SOCIAL_SVG: Record<string, string> = {
  steam:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.15 2.1a9.9 9.9 0 0 0-9.5 12.4L8.3 12a3.3 3.3 0 0 1 4.35-3.05l3.7-5.3A9.9 9.9 0 0 0 12.15 2.1Zm6.6 3.35-3.55 5.1a3.3 3.3 0 0 1-2.35 5.55 3.28 3.28 0 0 1-3.15-2.35L4.4 16.2a9.9 9.9 0 1 0 14.35-10.75ZM8.55 17.4l-2.05.8a7.55 7.55 0 0 0 3.35 1.05l.35-2.15a1.95 1.95 0 1 1-1.65.3Zm4.55-6.55a1.95 1.95 0 1 0 0 3.9 1.95 1.95 0 0 0 0-3.9Z"/></svg>',
  bilibili:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M6.2 4.2 9 7h6l2.8-2.8M5.5 7.5h13A1.5 1.5 0 0 1 20 9v8.2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.2V9a1.5 1.5 0 0 1 1.5-1.5Z"/><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M9.2 12.2v2.6M14.8 12.2v2.6"/></svg>',
  x:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5.2 4.5h3.4l3.1 4.35L15.5 4.5H19l-5.2 6.15L19.3 19.5h-3.4l-3.45-4.85L8.5 19.5H5l5.55-6.55L5.2 4.5Z"/></svg>',
  twitter:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5.2 4.5h3.4l3.1 4.35L15.5 4.5H19l-5.2 6.15L19.3 19.5h-3.4l-3.45-4.85L8.5 19.5H5l5.55-6.55L5.2 4.5Z"/></svg>',
  github:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.4c-5.3 0-9.6 4.3-9.6 9.6 0 4.24 2.75 7.84 6.56 9.1.48.09.66-.21.66-.46v-1.62c-2.67.58-3.23-1.29-3.23-1.29-.44-1.1-1.07-1.4-1.07-1.4-.87-.6.07-.59.07-.59.96.07 1.47.99 1.47.99.86 1.47 2.25 1.05 2.8.8.09-.62.34-1.05.61-1.29-2.13-.24-4.37-1.07-4.37-4.74 0-1.05.37-1.9 1-2.57-.1-.24-.43-1.23.09-2.56 0 0 .81-.26 2.66 1a9.2 9.2 0 0 1 4.84 0c1.85-1.26 2.66-1 2.66-1 .52 1.33.19 2.32.1 2.56.62.67 1 1.52 1 2.57 0 3.68-2.25 4.5-4.4 4.74.35.3.66.9.66 1.81v2.68c0 .25.18.55.67.46A9.61 9.61 0 0 0 21.6 12c0-5.3-4.3-9.6-9.6-9.6Z"/></svg>',
  instagram:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.6" y="3.6" width="16.8" height="16.8" rx="5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="17.1" cy="6.95" r="1.15" fill="currentColor"/></svg>',
  qq:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" d="M12 3.8c-3.1 0-5.2 2.4-5.2 5.5 0 1.7.5 3.4 1.1 4.6-.9 1-.9 2.1-.4 2.9.7 1.1 2.4.6 3.5.2.3.1.7.2 1 .2s.7-.1 1-.2c1.1.4 2.8.9 3.5-.2.5-.8.5-1.9-.4-2.9.6-1.2 1.1-2.9 1.1-4.6 0-3.1-2.1-5.5-5.2-5.5Z"/><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M9.4 10.2h.01M14.6 10.2h.01M9.2 13.1c.7.7 1.7 1.1 2.8 1.1s2.1-.4 2.8-1.1"/></svg>',
  email:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" d="m4.2 7.2 7.8 5.4 7.8-5.4"/></svg>',
  link:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M10 13.5a4 4 0 0 0 5.7.4l2.4-2.4a4 4 0 0 0-5.7-5.7l-1.4 1.4"/><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M14 10.5a4 4 0 0 0-5.7-.4l-2.4 2.4a4 4 0 0 0 5.7 5.7l1.4-1.4"/></svg>',
};

export function socialIconHtml(iconKey: string, _label = ''): string {
  const key = String(iconKey || 'link').toLowerCase();
  return SOCIAL_SVG[key] || SOCIAL_SVG.link;
}

export function navIconHtml(iconKey: string): string {
  const key = (iconKey || 'star') as keyof typeof NAV_ICONS;
  const icon = NAV_ICONS[key] || Star;
  return iconImgHtml(icon, { className: 'fp-nav-icon-pxl' });
}

export function scrollHintIconHtml(): string {
  // Arrow 在 pxlkit 里是弓箭造型，滚动提示改用指南针/星更贴宇宙
  return iconImgHtml(QuestCompass, { className: 'fp-scroll-icon-pxl', label: '向下滚动' });
}

export function atlasIconHtml(kind: 'spot' | 'friend' | 'search'): string {
  if (kind === 'friend') return iconImgHtml(Heart, { className: 'fp-atlas-ico' });
  if (kind === 'search') return iconImgHtml(SparkleStar, { className: 'fp-atlas-ico' });
  return iconImgHtml(Star, { className: 'fp-atlas-ico' });
}
