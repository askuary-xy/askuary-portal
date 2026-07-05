import '../../styles/universe.css';
import '../../styles/about.css';
import '../../styles/blog.css';
import { loadBlogPostPage } from '../../config/loader';
import {
  formatDate,
  initBlogStarfield,
  renderFooterLinks,
  renderTags,
} from './shared';

const LINK_ICONS: Record<string, string> = {
  github: '⌘',
  email: '✉',
  link: '🔗',
};

function resolveSlug(): string {
  const fromDataset = document.body.dataset.postSlug?.trim();
  if (fromDataset) return fromDataset;
  const match = window.location.pathname.match(/\/blog\/([^/]+)\/?$/);
  return match?.[1] ?? '';
}

async function boot(): Promise<void> {
  const slug = resolveSlug();
  if (!slug) throw new Error('missing post slug');

  const { post, site, meteorWords } = await loadBlogPostPage(slug);

  document.title = `${post.title} · ${site.name}`;

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
  if (contentEl) contentEl.innerHTML = post.html;

  renderFooterLinks(
    linksEl,
    [
      { label: '返回博客', url: '/blog/' },
      { label: '返回宇宙门户', url: '/' },
    ],
    LINK_ICONS,
  );

  initBlogStarfield(meteorWords);
}

boot().catch((err) => {
  console.error(err);
  const root = document.getElementById('bootError');
  if (root) {
    root.hidden = false;
    root.textContent = '文章加载失败，请检查 slug 或运行 npm run posts:build';
  }
});
