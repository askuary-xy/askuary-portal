import '../../styles/universe.css';
import '../../styles/about.css';
import '../../styles/blog.css';
import '../../styles/pixel-subpage.css';
import { Starfield } from '../../canvas/starfield';
import { loadBlogArchivePage } from '../../config/loader';
import { sitePath } from '../../utils/site-path';
import { mountLegalFooter } from '../../ui/mount-legal';
import { mountPixelNav } from '../../ui/mount-pixel-nav';
import { escapeHtml, formatDate, renderFooterLinks } from './shared';

const LINK_ICONS: Record<string, string> = {
  github: '⌘',
  email: '✉',
  link: '🔗',
};

const BASE = '/blog/archive/';

function getActiveTag(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('tag')?.trim() || '';
}

function renderTagFilters(tags: string[], activeTag: string): string {
  const allActive = !activeTag;
  let html =
    `<a class="fp-archive-tag${allActive ? ' is-active' : ''}" href="${escapeHtml(sitePath(BASE))}">全部</a>`;

  for (const tag of tags) {
    const isActive = tag === activeTag;
    const href = sitePath(`${BASE}?tag=${encodeURIComponent(tag)}`);
    html += `<a class="fp-archive-tag${isActive ? ' is-active' : ''}" href="${escapeHtml(href)}">${escapeHtml(tag)}</a>`;
  }

  return html;
}

function renderArchiveItem(entry: {
  slug: string;
  title: string;
  date: string;
  summary?: string;
  tags?: string[];
  path: string;
}): string {
  const href = sitePath(entry.path);

  const tagsHtml = entry.tags?.length
    ? `<ul class="fp-blog-tags" aria-label="标签">${entry.tags
        .map((tag) => {
          const tagHref = sitePath(`${BASE}?tag=${encodeURIComponent(tag)}`);
          return `<li><a class="fp-blog-tag fp-blog-tag--link" href="${escapeHtml(tagHref)}">${escapeHtml(tag)}</a></li>`;
        })
        .join('')}</ul>`
    : '';

  return (
    `<li class="fp-blog-item fp-archive-item" role="listitem">` +
    `<div class="fp-blog-item-inner">` +
    `<a class="fp-blog-item-link" href="${escapeHtml(href)}">` +
    `<time class="fp-blog-date" datetime="${escapeHtml(entry.date)}">${escapeHtml(formatDate(entry.date))}</time>` +
    `<h2 class="fp-blog-item-title">${escapeHtml(entry.title)}</h2>` +
    (entry.summary ? `<p class="fp-blog-item-summary">${escapeHtml(entry.summary)}</p>` : '') +
    `</a>` +
    (tagsHtml ? `<div class="fp-blog-item-foot">${tagsHtml}</div>` : '') +
    `</div></li>`
  );
}

async function boot(): Promise<void> {
  document.documentElement.classList.add('pixel-subpage');
  const { page, site, archive, meteorWords } = await loadBlogArchivePage();
  const activeTag = getActiveTag();

  document.title = `${page.title} · ${site.name}`;
  mountPixelNav({
    brand: site.name || 'ASKUARY',
    title: page.title || '归档',
    backHref: '/blog/',
    backLabel: '← 博客',
    widgets: { weather: site.weather, themeDefault: 'auto' },
  });

  const titleEl = document.getElementById('archiveTitle');
  const leadEl = document.getElementById('archiveLead');
  const tagsEl = document.getElementById('archiveTags');
  const listEl = document.getElementById('archiveList');
  const emptyEl = document.getElementById('archiveEmpty');
  const linksEl = document.getElementById('archiveLinks');

  if (titleEl) titleEl.textContent = page.title;
  if (leadEl) {
    const lead = activeTag ? `标签：${activeTag}` : page.lead || '';
    leadEl.textContent = lead;
    leadEl.hidden = !lead;
  }

  const filtered = activeTag
    ? archive.entries.filter((entry) => entry.tags?.includes(activeTag))
    : archive.entries;

  if (tagsEl) {
    if (archive.tags.length) {
      tagsEl.hidden = false;
      tagsEl.innerHTML = renderTagFilters(archive.tags, activeTag);
    } else {
      tagsEl.hidden = true;
    }
  }

  if (listEl) {
    listEl.innerHTML = filtered.length ? filtered.map(renderArchiveItem).join('') : '';
  }

  if (emptyEl) {
    const showEmpty = !filtered.length;
    emptyEl.hidden = !showEmpty;
    emptyEl.textContent = activeTag
      ? page.emptyTag || '该标签下暂无博客文章。'
      : page.empty || '暂无博客文章';
  }

  renderFooterLinks(linksEl, page.links, LINK_ICONS);

  const canvas = document.getElementById('fpStars') as HTMLCanvasElement | null;
  if (canvas) {
    const starfield = new Starfield(canvas, () => {});
    starfield.setNavStars([]);
    starfield.setMeteorWords(meteorWords);
    starfield.start();
  }

  await mountLegalFooter(document.getElementById('pageLegal'), site.name);
}

boot().catch((err) => {
  console.error(err);
  const root = document.getElementById('bootError');
  if (root) {
    root.hidden = false;
    root.textContent = '博客归档加载失败，请先运行 npm run posts:build';
  }
});
