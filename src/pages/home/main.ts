import '../../styles/home.css';
import { loadHomePage } from '../../config/loader';
import { sitePath } from '../../utils/site-path';
import type { BlogPostMeta, HomeShowcase } from '../../types/config';
import {
  escapeHtml,
  formatDate,
  renderFooterLinks,
  renderHomeShell,
  renderNavLinks,
  renderShowcaseIcon,
  renderTags,
} from './shared';

function renderSection(heading: string, body: string): string {
  const paragraphs = body
    .split('\n')
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('');
  return (
    `<section class="home-section">` +
    `<h2 class="home-section-title">${escapeHtml(heading)}</h2>` +
    `<div class="home-section-body">${paragraphs}</div>` +
    `</section>`
  );
}

function renderShowcase(item: HomeShowcase): string {
  return (
    `<a class="home-showcase-card" href="${escapeHtml(sitePath(item.url))}">` +
    renderShowcaseIcon(item.icon) +
    `<h3 class="home-showcase-title">${escapeHtml(item.title)}</h3>` +
    (item.desc ? `<p class="home-showcase-desc">${escapeHtml(item.desc)}</p>` : '') +
    `</a>`
  );
}

function renderPostCard(post: BlogPostMeta): string {
  return (
    `<article class="home-post-card">` +
    `<a class="home-post-link" href="${escapeHtml(sitePath(`/journal/${post.slug}/`))}">` +
    `<time class="home-post-date" datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date))}</time>` +
    `<h3 class="home-post-title">${escapeHtml(post.title)}</h3>` +
    (post.summary ? `<p class="home-post-summary">${escapeHtml(post.summary)}</p>` : '') +
    (post.tags?.length
      ? `<ul class="home-tags" aria-label="标签">${renderTags(post.tags)}</ul>`
      : '') +
    `<span class="home-post-read">阅读全文 →</span>` +
    `</a></article>`
  );
}

async function boot(): Promise<void> {
  const { page, site, posts } = await loadHomePage();
  const shell = document.getElementById('homeShell');
  if (!shell) return;

  document.title = `${page.title} · ${site.name}`;

  const limit = page.postsLimit ?? 12;
  const visiblePosts = posts.slice(0, limit);

  const heroHtml =
    `<section class="home-hero">` +
    `<p class="home-hero-kicker">站点主页</p>` +
    `<h1 class="home-hero-title">${escapeHtml(page.title || site.name)}</h1>` +
    (page.tagline ? `<p class="home-hero-tagline">${escapeHtml(page.tagline)}</p>` : '') +
    (page.heroIntro ? `<p class="home-hero-intro">${escapeHtml(page.heroIntro)}</p>` : '') +
    `<a class="home-hero-portal" href="${escapeHtml(sitePath('/'))}">← 返回宇宙门户</a>` +
    `</section>`;

  const showcasesHtml = page.showcases?.length
    ? `<section class="home-showcases" aria-label="快捷入口">` +
      `<div class="home-showcase-grid">${page.showcases.map(renderShowcase).join('')}</div>` +
      `</section>`
    : '';

  const sectionsHtml = page.sections?.length
    ? `<div class="home-sections">${page.sections.map((s) => renderSection(s.heading, s.body)).join('')}</div>`
    : '';

  const postsHtml =
    `<section class="home-posts" aria-labelledby="homePostsTitle">` +
    `<h2 class="home-posts-title" id="homePostsTitle">${escapeHtml(page.postsTitle || '最新文章')}</h2>` +
    (visiblePosts.length
      ? `<div class="home-post-grid">${visiblePosts.map(renderPostCard).join('')}</div>`
      : `<p class="home-posts-empty">${escapeHtml(page.empty || '暂无文章')}</p>`) +
    `</section>`;

  const nav = page.nav?.length ? page.nav : [{ label: '宇宙门户', url: '/' }];
  const footerLinks = renderFooterLinks(page.links);
  const year = new Date().getFullYear();

  shell.innerHTML = renderHomeShell({
    siteName: site.name,
    navHtml: renderNavLinks(nav, '/home/'),
    mainHtml: heroHtml + showcasesHtml + sectionsHtml + postsHtml,
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
    root.textContent = '主页加载失败，请检查 public/data/home.json 并运行 npm run content:build';
  }
});
