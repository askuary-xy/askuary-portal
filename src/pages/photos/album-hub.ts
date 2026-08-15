import '../../styles/home-hub.css';
import '../../styles/about.css';
import '../../styles/photos.css';
import '../../styles/photo-story.css';
import '../../styles/article-shell.css';
import '../../styles/comments.css';
import '../../styles/pixel-hub.css';
import '../../styles/facility-starport.css';
import { loadCommentsConfig, loadPhotosPage } from '../../config/loader';
import type { PhotoMetaItem, PhotoStory } from '../../types/config';
import { sitePath } from '../../utils/site-path';
import { commentPathFor, escapeHtml } from '../../utils/content';
import { mountPixelNav } from '../../ui/mount-pixel-nav';
import { mountHomeBackground } from '../../ui/mount-home-background';
import { mountLegalFooter } from '../../ui/mount-legal';
import { mountComments } from '../../ui/mount-comments';
import {
  mountAiCard,
  renderAiCard,
  renderCoverHero,
  renderReadShell,
} from '../../ui/article-shell';

import type { HubContext } from '../../ui/hub-types';

let pageCleanups: Array<() => void> = [];

function resolvePhotoId(): string {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('id')?.trim();
  if (fromQuery) {
    try {
      return decodeURIComponent(fromQuery);
    } catch {
      return fromQuery;
    }
  }
  const match = window.location.pathname.match(/\/photos\/album\/([^/]+)\/?$/);
  if (match?.[1] && match[1] !== 'index.html') {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return '';
}

function paragraphs(text: string): string {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');
}

function renderMeta(items: { label: string; value: string }[]): string {
  const rows = items.filter((item) => item.value.trim());
  if (!rows.length) return '';
  return (
    `<dl class="fp-photo-story-meta">` +
    rows
      .map(
        (item) =>
          `<div class="fp-photo-story-meta-item">` +
          `<dt>${escapeHtml(item.label)}</dt>` +
          `<dd>${escapeHtml(item.value)}</dd>` +
          `</div>`,
      )
      .join('') +
    `</dl>`
  );
}

function renderMusic(music?: PhotoStory['music']): string {
  const id = String(music?.neteaseId || '').trim();
  if (!id) return '';
  const cap = [music?.title, music?.artist].filter(Boolean).join(' · ');
  return (
    `<section class="fp-photo-story-music" aria-label="背景音乐">` +
    `<h2 class="fp-photo-story-block-title">音乐</h2>` +
    `<iframe ` +
    `src="https://music.163.com/outchain/player?type=2&id=${encodeURIComponent(id)}&auto=0&height=66" ` +
    `height="86" title="网易云音乐播放器" loading="lazy"></iframe>` +
    (cap ? `<p class="fp-photo-story-music-cap">${escapeHtml(cap)}</p>` : '') +
    `</section>`
  );
}

function storyHref(id: string): string {
  return sitePath(`/photos/album/?id=${encodeURIComponent(id)}`);
}

function renderNav(prev: PhotoMetaItem | null, next: PhotoMetaItem | null): string {
  if (!prev && !next) return '';
  return (
    `<nav class="fp-photo-story-nav" aria-label="同相册切换">` +
    (prev
      ? `<a class="fp-photo-story-nav-link is-prev" href="${escapeHtml(storyHref(prev.id))}">← ${escapeHtml(prev.title)}</a>`
      : `<span></span>`) +
    (next
      ? `<a class="fp-photo-story-nav-link is-next" href="${escapeHtml(storyHref(next.id))}">${escapeHtml(next.title)} →</a>`
      : `<span></span>`) +
    `</nav>`
  );
}

function resolveStory(photo: PhotoMetaItem): PhotoStory {
  const story = photo.story || {};
  const timeLabel =
    story.timeLabel ||
    (photo.date ? (photo.time ? `${photo.date} ${photo.time}` : photo.date) : '');
  return {
    intro: story.intro || photo.note || '',
    device: story.device || photo.device || '',
    timeLabel,
    locationLabel: story.locationLabel || photo.location || '',
    weather: story.weather || '',
    authorBio: story.authorBio || '',
    music: story.music || null,
  };
}

export async function mount(_ctx: HubContext): Promise<void> {
  const id = resolvePhotoId();
  const root = document.getElementById('photoStoryRoot');
  if (!root) return;

  if (!id) {
    window.location.replace(sitePath('/photos/'));
    return;
  }

  const [{ site, photowall }, comments] = await Promise.all([
    loadPhotosPage(),
    loadCommentsConfig(),
  ]);

  const photo = photowall.photos.find((item) => item.id === id || item.file === id);
  if (!photo) {
    throw new Error(`photo not found: ${id}`);
  }

  const albumPhotos = photowall.photos.filter((item) => item.album === photo.album);
  const index = albumPhotos.findIndex((item) => item.id === photo.id);
  const prev = index > 0 ? albumPhotos[index - 1] : null;
  const next = index >= 0 && index < albumPhotos.length - 1 ? albumPhotos[index + 1] : null;

  const story = resolveStory(photo);
  const authorBio = story.authorBio || site.authorBio || site.intro || '';
  const coverUrl = sitePath(photo.src || photo.thumb || '');

  document.title = `${photo.title} · 摄影 · ${site.name}`;
  document.body.classList.add('ask-read-page', 'pixel-hub', 'starport-facility', 'starport-replay');
  mountHomeBackground(site);
  mountPixelNav({
    brand: site.name || 'ASKUARY',
    title: photo.title || '摄影故事',
    backHref: '/photos/',
    backLabel: '← 摄影',
    widgets: { weather: site.weather, themeDefault: 'auto' },
  });

  const heroHtml = renderCoverHero({
    coverUrl,
    title: photo.title,
    titleId: 'storyTitle',
    kicker: photo.album ? `相册 · ${photo.album}` : '摄影故事',
    metas: [
      ...(story.timeLabel ? [{ label: '时间', value: story.timeLabel }] : []),
      ...(story.locationLabel ? [{ label: '地点', value: story.locationLabel }] : []),
      ...(story.device ? [{ label: '设备', value: story.device }] : []),
      ...(story.weather ? [{ label: '天气', value: story.weather }] : []),
    ],
    back: { href: sitePath('/photos/'), label: '← 返回摄影' },
  });

  const cardInner =
    renderAiCard({
      summary: story.intro || `「${photo.title}」—— 一张收进 ASKUARY 摄影墙的光。`,
      selfIntro: `我是 ASKUARY 的光影小助手。这张「${photo.title}」${story.locationLabel ? `拍自${story.locationLabel}` : '收进了摄影墙'}，点开故事慢慢看。`,
      brand: site.name,
      siteIntro: authorBio,
      relatedHref: sitePath('/photos/'),
      homeHref: sitePath('/home/'),
    }) +
    (story.intro
      ? `<section class="fp-photo-story-intro" aria-label="介绍">${paragraphs(story.intro)}</section>`
      : '') +
    renderMeta([
      { label: '时间', value: story.timeLabel || '' },
      { label: '地点', value: story.locationLabel || '' },
      { label: '设备', value: story.device || '' },
      { label: '天气', value: story.weather || '' },
    ]) +
    renderMusic(story.music) +
    `<section class="fp-photo-story-author" aria-label="作者简介">` +
    `<img src="${escapeHtml(sitePath(site.avatar || '/brand/avatar.png'))}" alt="${escapeHtml(site.avatarAlt || site.name)}" width="64" height="64" />` +
    `<div><h2>${escapeHtml(site.name)}</h2>` +
    (authorBio ? `<p>${escapeHtml(authorBio)}</p>` : '') +
    `</div></section>` +
    renderNav(prev, next);

  root.innerHTML =
    renderReadShell({
      heroHtml,
      cardInnerHtml: cardInner,
      commentsHtml: `<section class="fp-friend-comments home-comments" id="photoStoryComments" aria-label="评论区"></section>`,
      footerHtml: `<footer class="home-hub-footer"><div class="home-hub-footer-inner" id="pageLegal"></div></footer>`,
    });

  mountAiCard(root);
  mountComments(
    document.getElementById('photoStoryComments'),
    comments,
    site.apiBase,
    commentPathFor('photos', photo.id),
  );

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
}
