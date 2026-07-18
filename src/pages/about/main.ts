import '../../styles/universe.css';
import '../../styles/about.css';
import { Starfield } from '../../canvas/starfield';
import { loadAboutPage } from '../../config/loader';
import { mountLegalFooter } from '../../ui/mount-legal';
import { sitePath } from '../../utils/site-path';

const LINK_ICONS: Record<string, string> = {
  github: '⌘',
  email: '✉',
  link: '🔗',
};

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 纯文本段落：转义后把 URL 变成可点击链接 */
function renderBodyParagraph(text: string): string {
  const escaped = escapeHtml(text);
  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
  );
}

async function boot(): Promise<void> {
  const { about, site, meteorWords } = await loadAboutPage();

  document.title = `${about.title} · ${site.name}`;

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
        const anchor =
          section.heading.includes('隐私')
            ? ' id="privacy"'
            : section.heading.includes('致谢') || section.heading.includes('借鉴')
              ? ' id="credits"'
              : '';
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

    if (window.location.hash === '#privacy' || window.location.hash === '#credits') {
      document.querySelector(window.location.hash)?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  if (linksEl && about.links?.length) {
    linksEl.innerHTML = about.links
      .map((link) => {
        const icon = LINK_ICONS[link.icon ?? ''] ?? '';
        const absolute = /^(https?:|mailto:)/i.test(link.url);
        const href = absolute ? link.url : sitePath(link.url);
        const external = /^https?:\/\//i.test(link.url);
        const rel = external ? ' rel="noopener noreferrer"' : '';
        const target = external ? ' target="_blank"' : '';
        return (
          `<a class="fp-about-link" href="${escapeHtml(href)}"${target}${rel}>` +
          (icon ? `<span class="fp-about-link-icon" aria-hidden="true">${icon}</span>` : '') +
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
  }

  await mountLegalFooter(document.querySelector('.fp-about'), site.name);
}

boot().catch((err) => {
  console.error(err);
  const root = document.getElementById('bootError');
  if (root) {
    root.hidden = false;
    root.textContent = '页面加载失败，请检查 public/data/about.json';
  }
});
