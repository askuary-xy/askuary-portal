import '../../styles/universe.css';
import '../../styles/about.css';
import '../../styles/friends.css';
import { Starfield } from '../../canvas/starfield';
import { loadFriendsPage } from '../../config/loader';
import { sitePath } from '../../utils/site-path';
import type { AboutLink } from '../../types/config';

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

function escapeAttr(text: string): string {
  return escapeHtml(text);
}

function renderFriendCard(friend: {
  title: string;
  text: string;
  avatar?: string;
  url: string;
  linkLabel?: string;
}): string {
  const label = friend.linkLabel?.trim() || '访问友站';
  const avatar = friend.avatar?.trim()
    ? `<img class="fp-friend-avatar" src="${escapeAttr(friend.avatar)}" alt="" width="56" height="56" loading="lazy" decoding="async">`
    : '<span class="fp-friend-orbit" aria-hidden="true"></span>';

  return (
    `<article class="fp-friend-card fp-spot-friend" role="listitem">` +
    `<a class="fp-friend-card-link" href="${escapeAttr(friend.url)}" target="_blank" rel="noopener noreferrer">` +
    avatar +
    `<div class="fp-friend-body">` +
    `<h2 class="fp-friend-name">${escapeHtml(friend.title)}</h2>` +
    (friend.text ? `<p class="fp-friend-desc">${escapeHtml(friend.text)}</p>` : '') +
    `<span class="fp-friend-visit">${escapeHtml(label)} ↗</span>` +
    `</div></a></article>`
  );
}

async function boot(): Promise<void> {
  const { page, site, friends, meteorWords } = await loadFriendsPage();

  document.title = `${page.title} · ${site.name}`;

  const titleEl = document.getElementById('friendsTitle');
  const leadEl = document.getElementById('friendsLead');
  const gridEl = document.getElementById('friendsGrid');
  const emptyEl = document.getElementById('friendsEmpty');
  const linksEl = document.getElementById('friendsLinks');

  if (titleEl) titleEl.textContent = page.title;
  if (leadEl) {
    leadEl.textContent = page.lead || '';
    leadEl.hidden = !page.lead;
  }

  if (gridEl) {
    if (friends.length) {
      gridEl.innerHTML = friends.map(renderFriendCard).join('');
    } else {
      gridEl.innerHTML = '';
    }
  }

  if (emptyEl) {
    const showEmpty = !friends.length;
    emptyEl.hidden = !showEmpty;
    emptyEl.textContent = page.empty || '暂无友联';
  }

  if (linksEl && page.links?.length) {
    linksEl.innerHTML = page.links
      .map((link: AboutLink) => {
        const icon = LINK_ICONS[link.icon ?? ''] ?? '';
        const href = sitePath(link.url);
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
}

boot().catch((err) => {
  console.error(err);
  const root = document.getElementById('bootError');
  if (root) {
    root.hidden = false;
    root.textContent = '页面加载失败，请检查 public/data/friends-page.json';
  }
});
