import '../../styles/home.css';
import '../../styles/home-rich.css';
import '../../styles/articles.css';
import '../../styles/pixel-hub.css';
import '../../styles/content-starport.css';
import '../../styles/facility-devices.css';
import { loadHomePage } from '../../config/loader';
import { sitePath } from '../../utils/site-path';
import { isShuoshuo, journalPostHref } from '../../utils/content';
import { inferCoverKind, postCoverSrc } from '../../utils/post-cover';
import type { BlogPostMeta, SiteConfig } from '../../types/config';
import { mountLegalFooter } from '../../ui/mount-legal';
import { mountHomeBackground } from '../../ui/mount-home-background';
import { mountPixelNav } from '../../ui/mount-pixel-nav';
import {
  escapeHtml,
  formatDate,
  renderHomeShell,
} from '../home/shared';

import type { HubContext } from '../../ui/hub-types';

let pageCleanups: Array<() => void> = [];

/** 大卡 / 中卡 / 小卡：悬停封面收、摘要展开 */
const SIZE_PATTERN: Array<'lg' | 'md' | 'sm'> = [
  'lg',
  'md',
  'sm',
  'md',
  'sm',
  'lg',
  'sm',
  'md',
  'sm',
];

function rememberFromArticles(): void {
  try {
    sessionStorage.setItem('askuary:from', 'articles');
  } catch {
    /* ignore */
  }
}

function renderExpandCard(
  post: BlogPostMeta,
  coverSrc: string,
  size: 'lg' | 'md' | 'sm',
): string {
  const href = sitePath(journalPostHref(post, { from: 'articles' }));
  const tags = (post.tags || [])
    .filter((t) => {
      const tag = String(t || '').trim().toLowerCase();
      return tag && !['碎念', '说说', 'shuoshuo', 'ss'].includes(tag);
    })
    .slice(0, 4);
  const summary = (post.summary || '').trim();
  const cover = coverSrc
    ? `<img src="${escapeHtml(coverSrc)}" alt="" loading="lazy" decoding="async" />`
    : `<span class="hr-post-cover-fallback" aria-hidden="true"></span>`;

  return (
    `<a class="hr-post hr-post--${size} hr-glass" href="${escapeHtml(href)}">` +
    `<div class="hr-post-cover">${cover}<span class="hr-post-shine" aria-hidden="true"></span></div>` +
    `<div class="hr-post-body">` +
    `<time class="hr-post-date" datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date))}</time>` +
    `<h2 class="hr-post-title">${escapeHtml(post.title)}</h2>` +
    (tags.length
      ? `<ul class="hr-post-tags" aria-label="标签">${tags
          .map((t) => `<li class="hr-post-tag">${escapeHtml(t)}</li>`)
          .join('')}</ul>`
      : '') +
    (summary
      ? `<div class="hr-post-expand"><div class="hr-post-expand-inner">` +
        `<div class="hr-post-ai"><span class="hr-post-ai-label">SUMMARY</span>` +
        `<p class="hr-post-ai-body">${escapeHtml(summary)}</p></div>` +
        `</div></div>`
      : '') +
    `</div></a>`
  );
}

function renderArticlesGrid(posts: BlogPostMeta[], site: SiteConfig): string {
  if (!posts.length) {
    return `<p class="home-posts-empty">暂时还没有文章。</p>`;
  }
  return (
    `<div class="hr-posts ar-posts">${posts
      .map((p, i) => {
        const size = SIZE_PATTERN[i % SIZE_PATTERN.length];
        const kind = inferCoverKind(p, 'journal');
        return renderExpandCard(p, postCoverSrc(p, site, kind), size);
      })
      .join('')}</div>`
  );
}

export async function mount(_ctx: HubContext): Promise<void> {
  document.body.classList.add('ar-page', 'home-rich', 'pixel-hub', 'starport-content', 'starport-articles');

  const { page, site, posts } = await loadHomePage();
  mountHomeBackground(site);
  const shell = document.getElementById('homeShell');
  if (!shell) return;

  document.title = `文章 · ${site.name}`;

  const articles = posts
    .filter((p) => !isShuoshuo(p))
    .slice()
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const heroHtml =
    `<section class="home-hero home-glass-card ar-hero">` +
    `<h1 class="home-hero-title">文章</h1>` +
    `</section>`;

  const listHtml =
    `<section class="ar-list" aria-labelledby="articlesTitle">` +
    `<div class="ar-list-head">` +
    `<h2 id="articlesTitle">全部文章</h2>` +
    `<span class="ar-list-count">${articles.length}</span>` +
    `</div>` +
    renderArticlesGrid(articles, site) +
    `</section>`;

  shell.innerHTML = renderHomeShell({
    siteName: site.name,
    navHtml: '',
    mainHtml: heroHtml + listHtml,
    backgroundUrl: '',
    footerHtml: `<div id="pageLegal"></div>`,
    withHeader: false,
  });

  mountPixelNav({
    brand: site.name || 'ASKUARY',
    title: '文章',
    backHref: '/home/',
    widgets: { weather: site.weather, themeDefault: page.themeDefault || 'auto' },
    petLines: page.petLines || page.waveLines,
  });

  shell.querySelectorAll<HTMLAnchorElement>('.hr-post').forEach((a) => {
    a.addEventListener('click', () => rememberFromArticles());
  });
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
  document.body.classList.remove('starport-content', 'starport-articles');
}
