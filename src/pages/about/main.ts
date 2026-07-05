import '../../styles/universe.css';
import '../../styles/about.css';
import { Starfield } from '../../canvas/starfield';
import { loadAboutPage } from '../../config/loader';

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
      .map(
        (section) =>
          `<section class="fp-about-section">` +
          `<h2 class="fp-about-section-title">${escapeHtml(section.heading)}</h2>` +
          `<div class="fp-about-section-body">${section.body
            .split('\n')
            .filter(Boolean)
            .map((p) => `<p>${escapeHtml(p)}</p>`)
            .join('')}</div>` +
          `</section>`,
      )
      .join('');
  }

  if (linksEl && about.links?.length) {
    linksEl.innerHTML = about.links
      .map((link) => {
        const icon = LINK_ICONS[link.icon ?? ''] ?? '';
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

  const canvas = document.getElementById('fpStars') as HTMLCanvasElement | null;
  if (canvas) {
    const starfield = new Starfield(canvas, () => {});
    starfield.setNavStars([]);
    starfield.setMeteorWords(meteorWords);
    starfield.start();
  }
}

boot().catch((err) => {
  console.error(err);
  const root = document.getElementById('bootError');
  if (root) {
    root.hidden = false;
    root.textContent = '页面加载失败，请检查 public/data/about.json';
  }
});
