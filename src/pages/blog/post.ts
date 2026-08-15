import '../../styles/universe.css';
import '../../styles/about.css';
import '../../styles/blog.css';
import '../../styles/comments.css';
import '../../styles/pixel-subpage.css';
import '../../styles/blog-starport.css';
import { Starfield } from '../../canvas/starfield';
import { loadBlogPostPage, loadCommentsConfig } from '../../config/loader';
import { mountLegalFooter } from '../../ui/mount-legal';
import { mountPixelNav } from '../../ui/mount-pixel-nav';
import { mountComments } from '../../ui/mount-comments';
import { mountArticlePlugins } from '../../ui/mount-article-plugins';
import { mountReadingJourney } from '../../ui/mount-reading-journey';
import { commentPathFor } from '../../utils/content';
import { formatDate, renderFooterLinks, renderTags } from './shared';

const LINK_ICONS: Record<string, string> = {
  github: '⌘',
  email: '✉',
  link: '🔗',
};

function resolveSlug(): string {
  const fromQuery = new URLSearchParams(window.location.search).get('slug')?.trim();
  if (fromQuery) {
    try {
      return decodeURIComponent(fromQuery);
    } catch {
      return fromQuery;
    }
  }
  const fromDataset = document.body.dataset.postSlug?.trim();
  if (fromDataset) return fromDataset;
  const match = window.location.pathname.match(/\/blog\/([^/]+)\/?$/);
  if (match?.[1] && match[1] !== 'view' && match[1] !== 'archive') return match[1];
  return '';
}

async function boot(): Promise<void> {
  document.documentElement.classList.add('pixel-subpage');
  document.body.classList.add('starport-blog', 'starport-blog-post');
  const slug = resolveSlug();
  if (!slug) throw new Error('missing post slug');

  const [{ post, site, meteorWords }, comments] = await Promise.all([
    loadBlogPostPage(slug),
    loadCommentsConfig(),
  ]);

  document.title = `${post.title} · ${site.name}`;
  mountPixelNav({
    brand: site.name || 'ASKUARY',
    title: post.title || '博客',
    backHref: '/blog/',
    backLabel: '← 博客',
    widgets: { weather: site.weather, themeDefault: 'auto' },
  });

  const metaDesc = post.summary || post.title;
  let descEl = document.querySelector('meta[name="description"]');
  if (!descEl) {
    descEl = document.createElement('meta');
    descEl.setAttribute('name', 'description');
    document.head.appendChild(descEl);
  }
  descEl.setAttribute('content', metaDesc);

  const dateEl = document.getElementById('postDate');
  const titleEl = document.getElementById('postTitle');
  const tagsEl = document.getElementById('postTags');
  const contentEl = document.getElementById('postContent');
  const linksEl = document.getElementById('postLinks');
  const commentsEl = document.getElementById('postComments');

  if (dateEl) {
    dateEl.setAttribute('datetime', post.date);
    dateEl.textContent = formatDate(post.date);
    dateEl.hidden = !post.date;
  }
  if (titleEl) titleEl.textContent = post.title;
  if (tagsEl) {
    if (post.tags?.length) {
      tagsEl.innerHTML = renderTags(post.tags);
      tagsEl.hidden = false;
    } else {
      tagsEl.hidden = true;
    }
  }
  // 详情不插封面；正文保留图片（首图可作列表封面，文章内也不删）
  if (contentEl) {
    contentEl.innerHTML = post.html || '';
    mountArticlePlugins(contentEl);
    mountReadingJourney(document);
  }

  renderFooterLinks(
    linksEl,
    [
      { label: '返回博客', url: '/blog/' },
      { label: '返回宇宙门户', url: '/' },
    ],
    LINK_ICONS,
  );

  mountComments(
    commentsEl,
    comments,
    site.apiBase,
    commentPathFor('blog', slug),
  );

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
    root.textContent = '文章加载失败，请检查 slug 或运行 npm run posts:build';
  }
});
