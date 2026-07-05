import '../../styles/home.css';
import { loadHomePage, loadJournalPostPage } from '../../config/loader';
import {
  escapeHtml,
  formatDate,
  renderFooterLinks,
  renderHomeShell,
  renderNavLinks,
  renderTags,
} from '../home/shared';

function resolveSlug(): string {
  const fromDataset = document.body.dataset.postSlug?.trim();
  if (fromDataset) return fromDataset;
  const match = window.location.pathname.match(/\/journal\/([^/]+)\/?$/);
  return match?.[1] ?? '';
}

async function boot(): Promise<void> {
  const slug = resolveSlug();
  if (!slug) throw new Error('missing journal slug');

  const [{ post, site }, homeData] = await Promise.all([
    loadJournalPostPage(slug),
    loadHomePage().catch(() => null),
  ]);

  const shell = document.getElementById('homeShell');
  if (!shell) return;

  document.title = `${post.title} · ${site.name}`;

  let descEl = document.querySelector('meta[name="description"]');
  if (!descEl) {
    descEl = document.createElement('meta');
    descEl.setAttribute('name', 'description');
    document.head.appendChild(descEl);
  }
  descEl.setAttribute('content', post.summary || post.title);

  const articleHtml =
    `<article class="home-article">` +
    `<a class="home-back" href="/home/">← 返回主页</a>` +
    `<header class="home-article-header">` +
    (post.date
      ? `<time class="home-post-date" datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date))}</time>`
      : '') +
    `<h1 class="home-article-title">${escapeHtml(post.title)}</h1>` +
    (post.tags?.length
      ? `<ul class="home-tags home-tags--inline" aria-label="标签">${renderTags(post.tags)}</ul>`
      : '') +
    `</header>` +
    `<div class="home-prose">${post.html}</div>` +
    `</article>`;

  const nav = homeData?.page.nav?.length
    ? homeData.page.nav
    : [
        { label: '主页', url: '/home/' },
        { label: '宇宙门户', url: '/' },
        { label: '宇宙博客', url: '/blog/' },
      ];

  const footerLinks = renderFooterLinks(
    homeData?.page.links ?? [
      { label: '返回主页', url: '/home/' },
      { label: '返回宇宙门户', url: '/' },
    ],
  );
  const year = new Date().getFullYear();

  shell.innerHTML = renderHomeShell({
    siteName: site.name,
    navHtml: renderNavLinks(nav, `/journal/${slug}/`),
    mainHtml: articleHtml,
    footerHtml:
      (footerLinks ? `<nav class="home-footer-links" aria-label="页脚链接">${footerLinks}</nav>` : '') +
      `<p class="home-footer-copy">© ${year} · ${escapeHtml(site.name)}</p>`,
  });
}

boot().catch((err) => {
  console.error(err);
  const root = document.getElementById('bootError');
  if (root) {
    root.hidden = false;
    root.textContent = '文章加载失败，请运行 npm run content:build';
  }
});
