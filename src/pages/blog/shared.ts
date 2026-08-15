import { sitePath } from '../../utils/site-path';
export { escapeHtml, formatDate } from '../../utils/html';
import { escapeHtml } from '../../utils/html';
import { socialIconHtml } from '../../ui/site-icons';

export function renderFooterLinks(
  container: HTMLElement | null,
  links: { label: string; url: string; icon?: string }[] | undefined,
  _icons?: Record<string, string>,
): void {
  if (!container || !links?.length) return;
  container.innerHTML = links
    .map((link) => {
      const icon = socialIconHtml(link.icon ?? 'link', link.label);
      const href = sitePath(link.url);
      const external = /^https?:\/\//i.test(link.url);
      const rel = external ? ' rel="noopener noreferrer"' : '';
      const target = external ? ' target="_blank"' : '';
      return (
        `<a class="fp-about-link" href="${escapeHtml(href)}"${target}${rel}>` +
        `<span class="fp-about-link-icon" aria-hidden="true">${icon}</span>` +
        `<span>${escapeHtml(link.label)}</span></a>`
      );
    })
    .join('');
}

export function renderTags(tags: string[]): string {
  if (!tags.length) return '';
  return tags.map((tag) => `<li class="fp-blog-tag">${escapeHtml(tag)}</li>`).join('');
}
