import '../../styles/universe.css';
import '../../styles/about.css';
import '../../styles/blog.css';
import '../../styles/pixel-subpage.css';
import '../../styles/blog-starport.css';
import { Starfield } from '../../canvas/starfield';
import { loadBlogListPage } from '../../config/loader';
import { sitePath } from '../../utils/site-path';
import { blogPostHref } from '../../utils/content';
import { mountLegalFooter } from '../../ui/mount-legal';
import { mountPixelNav } from '../../ui/mount-pixel-nav';
import { escapeHtml, formatDate, renderFooterLinks } from './shared';

async function boot(): Promise<void> {
  document.documentElement.classList.add('pixel-subpage');
  document.body.classList.add('starport-blog');
  const { page, site, posts, meteorWords } = await loadBlogListPage();

  document.title = `${page.title} · ${site.name}`;
  mountPixelNav({
    brand: site.name || 'ASKUARY',
    title: page.title || '博客',
    backHref: '/',
    backLabel: '← 宇宙',
    widgets: { weather: site.weather, themeDefault: 'auto' },
  });

  const titleEl = document.getElementById('blogTitle');
  const leadEl = document.getElementById('blogLead');
  const listEl = document.getElementById('blogList');
  const emptyEl = document.getElementById('blogEmpty');
  const linksEl = document.getElementById('blogLinks');

  if (titleEl) titleEl.textContent = page.title;
  if (leadEl) {
    leadEl.textContent = page.lead || site.intro;
    leadEl.hidden = !(page.lead || site.intro);
  }

  if (listEl) {
    if (posts.length) {
      listEl.innerHTML = posts
        .map(
          (post) =>
            `<li class="fp-blog-item" role="listitem">` +
            `<div class="fp-blog-item-inner">` +
            `<a class="fp-blog-item-link" href="${escapeHtml(sitePath(blogPostHref(post)))}">` +
            `<time class="fp-blog-date" datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date))}</time>` +
            `<h2 class="fp-blog-item-title">${escapeHtml(post.title)}</h2>` +
            (post.summary ? `<p class="fp-blog-item-summary">${escapeHtml(post.summary)}</p>` : '') +
            `</a>` +
            (post.tags?.length
              ? `<div class="fp-blog-item-foot">` +
                `<ul class="fp-blog-tags" aria-label="标签">${post.tags
                  .map((tag) => `<li class="fp-blog-tag">${escapeHtml(tag)}</li>`)
                  .join('')}</ul>` +
                `</div>`
              : '') +
            `</div></li>`,
        )
        .join('');
    } else {
      listEl.innerHTML = '';
    }
  }

  if (emptyEl) {
    const showEmpty = !posts.length;
    emptyEl.hidden = !showEmpty;
    emptyEl.textContent = page.empty || '暂无文章';
  }

  renderFooterLinks(linksEl, page.links);

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
    root.textContent = '博客加载失败，请先运行 npm run posts:build';
  }
});
