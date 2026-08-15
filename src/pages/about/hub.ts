import '../../styles/universe.css';
import '../../styles/about.css';
import '../../styles/pixel-subpage.css';
import '../../styles/pixel-hub.css';
import '../../styles/content-baseline.css';
import '../../styles/identity-starport.css';
import { Starfield } from '../../canvas/starfield';
import { loadAboutPage } from '../../config/loader';
import { mountLegalFooter } from '../../ui/mount-legal';
import { mountPixelNav } from '../../ui/mount-pixel-nav';
import { escapeHtml } from '../../utils/html';
import { sitePath } from '../../utils/site-path';
import { socialIconHtml } from '../../ui/site-icons';

import type { HubContext } from '../../ui/hub-types';

let pageCleanups: Array<() => void> = [];

/** 纯文本段落：转义后把 URL / 邮箱变成可点击链接 */
function renderBodyParagraph(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
    )
    .replace(
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      '<a href="mailto:$1">$1</a>',
    );
}

export async function mount(_ctx: HubContext): Promise<void> {
  document.documentElement.classList.add('pixel-subpage');
  document.body.classList.add('pixel-hub', 'starport-content', 'starport-identity', 'starport-profile');
  const { about, site, meteorWords } = await loadAboutPage();

  document.title = `${about.title} · ${site.name}`;
  mountPixelNav({
    brand: site.name || 'ASKUARY',
    title: about.title || '关于',
    backHref: '/',
    backLabel: '← 宇宙',
    widgets: { weather: site.weather, themeDefault: 'auto' },
  });

  const titleEl = document.getElementById('aboutTitle');
  const leadEl = document.getElementById('aboutLead');
  const sectionsEl = document.getElementById('aboutSections');
  const linksEl = document.getElementById('aboutLinks');

  if (titleEl) titleEl.textContent = about.title;
  if (leadEl) {
    leadEl.textContent = about.lead || site.intro;
    leadEl.hidden = !(about.lead || site.intro);
  }

  if (sectionsEl && about.sections?.length) {
    sectionsEl.innerHTML = about.sections
      .map((section) => {
        const anchor = section.heading.includes('隐私') ? ' id="privacy"' : '';
        return (
          `<section class="fp-about-section"${anchor}>` +
          `<h2 class="fp-about-section-title">${escapeHtml(section.heading)}</h2>` +
          `<div class="fp-about-section-body">${section.body
            .split('\n')
            .filter(Boolean)
            .map((p) => `<p>${renderBodyParagraph(p)}</p>`)
            .join('')}</div>` +
          `</section>`
        );
      })
      .join('');

    if (window.location.hash === '#privacy') {
      document.querySelector(window.location.hash)?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  if (linksEl && about.links?.length) {
    linksEl.innerHTML = about.links
      .map((link) => {
        const icon = socialIconHtml(link.icon ?? 'link', link.label);
        const absolute = /^(https?:|mailto:)/i.test(link.url);
        const href = absolute ? link.url : sitePath(link.url);
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

  const canvas = document.getElementById('fpStars') as HTMLCanvasElement | null;
  if (canvas) {
    const starfield = new Starfield(canvas, () => {});
    starfield.setNavStars([]);
    starfield.setMeteorWords(meteorWords);
    starfield.start();
    pageCleanups.push(() => starfield.stop());
  }

  await mountLegalFooter(document.getElementById('pageLegal'), site.name);
}


export function unmount(): void {
  pageCleanups.splice(0).forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
  document.documentElement.classList.remove('pixel-subpage');
  document.body.classList.remove(
    'pixel-hub',
    'starport-content',
    'starport-identity',
    'starport-profile',
  );
}
