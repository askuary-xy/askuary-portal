import type { MeteorWord } from '../../types/config';
import { Starfield } from '../../canvas/starfield';

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

export function initBlogStarfield(meteorWords: MeteorWord[]): void {
  const canvas = document.getElementById('fpStars') as HTMLCanvasElement | null;
  if (!canvas) return;
  const starfield = new Starfield(canvas, () => {});
  starfield.setNavStars([]);
  starfield.setMeteorWords(meteorWords);
  starfield.start();
}

export function renderFooterLinks(
  container: HTMLElement | null,
  links: { label: string; url: string; icon?: string }[] | undefined,
  icons: Record<string, string>,
): void {
  if (!container || !links?.length) return;
  container.innerHTML = links
    .map((link) => {
      const icon = icons[link.icon ?? ''] ?? '';
      const external = /^https?:\/\//i.test(link.url);
      const rel = external ? ' rel="noopener noreferrer"' : '';
      const target = external ? ' target="_blank"' : '';
      return (
        `<a class="fp-about-link" href="${escapeHtml(link.url)}"${target}${rel}>` +
        (icon ? `<span class="fp-about-link-icon" aria-hidden="true">${icon}</span>` : '') +
        `<span>${escapeHtml(link.label)}</span></a>`
      );
    })
    .join('');
}

export function renderTags(tags: string[]): string {
  if (!tags.length) return '';
  return tags.map((tag) => `<li class="fp-blog-tag">${escapeHtml(tag)}</li>`).join('');
}
