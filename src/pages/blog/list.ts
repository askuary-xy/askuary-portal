import '../../styles/universe.css';
import '../../styles/about.css';
import '../../styles/blog.css';
import { loadBlogListPage } from '../../config/loader';
import { escapeHtml, formatDate, initBlogStarfield, renderFooterLinks } from './shared';

const LINK_ICONS: Record<string, string> = {
  github: '⌘',
  email: '✉',
  link: '🔗',
};

async function boot(): Promise<void> {
  const { page, site, posts, meteorWords } = await loadBlogListPage();

  document.title = `${page.title} · ${site.name}`;

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
            `<a class="fp-blog-item-link" href="/blog/${escapeHtml(post.slug)}/">` +
            `<time class="fp-blog-date" datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date))}</time>` +
            `<h2 class="fp-blog-item-title">${escapeHtml(post.title)}</h2>` +
            (post.summary ? `<p class="fp-blog-item-summary">${escapeHtml(post.summary)}</p>` : '') +
            (post.tags?.length
              ? `<ul class="fp-blog-tags fp-blog-tags--inline" aria-label="标签">${post.tags
                  .map((tag) => `<li class="fp-blog-tag">${escapeHtml(tag)}</li>`)
                  .join('')}</ul>`
              : '') +
            `<span class="fp-blog-read">阅读 →</span>` +
            `</a></li>`,
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

  renderFooterLinks(linksEl, page.links, LINK_ICONS);
  initBlogStarfield(meteorWords);
}

boot().catch((err) => {
  console.error(err);
  const root = document.getElementById('bootError');
  if (root) {
    root.hidden = false;
    root.textContent = '博客加载失败，请先运行 npm run posts:build';
  }
});
