import '../../styles/home.css';
import '../../styles/photos-rich.css';
import '../../styles/pixel-hub.css';
import '../../styles/identity-starport.css';
import '../../styles/facility-devices.css';
import '../../styles/photos-taste.css';
import { loadPhotosPage } from '../../config/loader';
import type { PhotoAlbum, PhotoMetaItem } from '../../types/config';
import { sitePath } from '../../utils/site-path';
import { mountPixelNav } from '../../ui/mount-pixel-nav';
import { mountLegalFooter } from '../../ui/mount-legal';
import { escapeHtml } from '../blog/shared';
import { detectSeason, mountMemoryStars, type Season } from './memory-stars';

import type { HubContext } from '../../ui/hub-types';

let pageCleanups: Array<() => void> = [];

type PhotosView = 'albums' | 'timeline';

let photos: PhotoMetaItem[] = [];
let albums: PhotoAlbum[] = [];
let activeCategory = 'all';
let activeView: PhotosView = 'albums';
let activeAlbum = '';
let modalIndex = -1;
let modalQueue: number[] = [];
let season: Season = 'spring';

const SEASON_ICON: Record<number, string> = {
  1: '❄️',
  2: '❄️',
  3: '🌸',
  4: '🌸',
  5: '🌸',
  6: '☀️',
  7: '☀️',
  8: '☀️',
  9: '🍂',
  10: '🍂',
  11: '🍂',
  12: '❄️',
};

function seasonIconForDate(date: string): string {
  const m = Number((date || '').slice(5, 7));
  return SEASON_ICON[m] || '✨';
}

function matchesCategory(photo: PhotoMetaItem): boolean {
  return activeCategory === 'all' || photo.category === activeCategory;
}

function albumMatchesCategory(album: PhotoAlbum): boolean {
  if (activeCategory === 'all') return true;
  if (album.key === activeCategory || album.label === activeCategory) return true;
  return photos.some((p) => p.album === album.key && p.category === activeCategory);
}

/** 分类展示顺序 */
const CATEGORY_ORDER = ['日常', '街拍', '旅途', '风景'];

function sortedCategories(list: string[]): string[] {
  const set = new Set(list.filter(Boolean));
  const ordered = CATEGORY_ORDER.filter((c) => set.has(c));
  const rest = [...set].filter((c) => !CATEGORY_ORDER.includes(c)).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  return [...ordered, ...rest];
}

function photoStoryHref(id: string): string {
  return sitePath(`/photos/album/?id=${encodeURIComponent(id)}`);
}

function storyText(photo: PhotoMetaItem): string {
  return (photo.story?.intro || photo.note || '').trim();
}

function metaLine(photo: PhotoMetaItem): string {
  return [photo.date, photo.location, photo.category].filter(Boolean).join(' · ');
}

function dayKey(date: string): string {
  if (!date) return '未注明日期';
  return date.length >= 10 ? date.slice(0, 10) : date.slice(0, 7);
}

function openModal(index: number, queue?: number[]): void {
  const item = photos[index];
  const modal = document.getElementById('photoModal');
  const img = document.getElementById('photoModalImg') as HTMLImageElement | null;
  const title = document.getElementById('photoModalTitle');
  const info = document.getElementById('photoModalInfo');
  const story = document.getElementById('photoModalStory');
  const counter = document.getElementById('photoModalCounter');
  const link = document.getElementById('photoModalStoryLink') as HTMLAnchorElement | null;
  if (!item || !modal || !img) return;

  modalQueue = queue?.length ? queue : photos.map((_, i) => i);
  modalIndex = modalQueue.indexOf(index);
  if (modalIndex < 0) {
    modalQueue = [index];
    modalIndex = 0;
  }

  img.src = photoDisplayUrl(item);
  img.alt = item.title;
  if (title) title.textContent = item.title;
  if (info) info.textContent = metaLine(item) || '';
  if (story) {
    const text = storyText(item);
    story.textContent = text;
    story.hidden = !text;
  }
  if (counter) counter.textContent = `${modalIndex + 1} / ${modalQueue.length}`;
  if (link) {
    link.href = photoStoryHref(item.id);
    link.hidden = false;
  }

  if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }
  modal.hidden = false;
  document.body.classList.add('pr-modal-open');
  document.body.style.overflow = 'hidden';
}

function showModalOffset(delta: number): void {
  if (!modalQueue.length || modalIndex < 0) return;
  const next = (modalIndex + delta + modalQueue.length) % modalQueue.length;
  openModal(modalQueue[next], modalQueue);
}

function closeModal(): void {
  const modal = document.getElementById('photoModal');
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove('pr-modal-open');
  document.body.style.overflow = '';
  modalIndex = -1;
  modalQueue = [];
}

function queueForCurrentView(): number[] {
  if (activeView === 'albums' && activeAlbum) {
    return photos
      .map((photo, index) => ({ photo, index }))
      .filter(({ photo }) => photo.album === activeAlbum)
      .map(({ index }) => index);
  }
  return photos
    .map((photo, index) => ({ photo, index }))
    .filter(({ photo }) => matchesCategory(photo))
    .map(({ index }) => index);
}

function albumSize(index: number): 'lg' | 'sm' {
  return index % 3 === 0 ? 'lg' : 'sm';
}

function photoDisplayUrl(photo: PhotoMetaItem): string {
  // 上线只部署缩略图：优先 thumb
  return sitePath(photo.thumb || photo.src || '');
}

function renderPolaroid(photo: PhotoMetaItem, index: number): string {
  const caption = photo.title || '未命名';
  return (
    `<button type="button" class="pr-polaroid" data-index="${index}" aria-label="查看 ${escapeHtml(caption)}">` +
    `<div class="pr-polaroid-photo">` +
    `<img src="${escapeHtml(photoDisplayUrl(photo))}" alt="" loading="lazy" decoding="async" draggable="false" />` +
    `</div>` +
    `<p class="pr-polaroid-caption">${escapeHtml(caption)}</p>` +
    (photo.date ? `<p class="pr-polaroid-date">${escapeHtml(photo.date)}</p>` : '') +
    `</button>`
  );
}

function renderAlbumCards(): string {
  const visible = albums.filter((album) => albumMatchesCategory(album));
  if (!visible.length) {
    return `<p class="pr-empty-inline">该分类下暂无相册。</p>`;
  }

  return (
    `<div class="pr-albums" id="photosAlbumsGrid">` +
    visible
      .map((album, i) => {
        const size = albumSize(i);
        const bubble =
          album.description ||
          photos.find((p) => p.album === album.key && storyText(p))?.story?.intro ||
          '按下快门，留下这一刻。';
        return (
          `<button type="button" class="pr-album pr-album--${size} pr-reveal" data-album="${escapeHtml(album.key)}">` +
          `<div class="pr-album-cover">` +
          (album.cover
            ? `<img src="${escapeHtml(sitePath(album.cover))}" alt="" loading="lazy" decoding="async" draggable="false" />`
            : '') +
          `<span class="pr-album-shine" aria-hidden="true"></span>` +
          `</div>` +
          `<div class="pr-album-body">` +
          `<h3 class="pr-album-title">${escapeHtml(album.label)}</h3>` +
          `<p class="pr-album-count">${album.count} 枚碎片</p>` +
          `<p class="pr-album-bubble">${escapeHtml(bubble.slice(0, 72))}${bubble.length > 72 ? '…' : ''}</p>` +
          `</div></button>`
        );
      })
      .join('') +
    `</div>`
  );
}

function renderAlbumDetails(): string {
  return albums
    .map((album) => {
      const items = photos
        .map((photo, index) => ({ photo, index }))
        .filter(({ photo }) => photo.album === album.key);
      return (
        `<section class="pr-album-detail" data-album="${escapeHtml(album.key)}" hidden>` +
        `<div class="pr-album-detail-head">` +
        `<button type="button" class="page-back pr-album-back" data-album-back>← 返回相册</button>` +
        `<h2>${escapeHtml(album.label)}</h2>` +
        `<p>${items.length} 枚记忆碎片${album.description ? ` · ${escapeHtml(album.description)}` : ''}</p>` +
        `</div>` +
        `<div class="pr-polaroid-grid">` +
        items.map(({ photo, index }) => renderPolaroid(photo, index)).join('') +
        `</div></section>`
      );
    })
    .join('');
}

function groupByDay(
  list: { photo: PhotoMetaItem; index: number }[],
): { key: string; items: { photo: PhotoMetaItem; index: number }[] }[] {
  const map = new Map<string, { photo: PhotoMetaItem; index: number }[]>();
  for (const entry of list) {
    const key = dayKey(entry.photo.date);
    const bucket = map.get(key);
    if (bucket) bucket.push(entry);
    else map.set(key, [entry]);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0], 'zh-CN'))
    .map(([key, items]) => ({ key, items }));
}

function renderTimeline(): string {
  const indexed = photos.map((photo, index) => ({ photo, index }));
  const groups = groupByDay(indexed)
    .map(({ key, items }) => {
      const filtered = items.filter(({ photo }) => matchesCategory(photo));
      if (!filtered.length) return '';
      return (
        `<article class="pr-tl-row pr-reveal">` +
        `<div class="pr-tl-meta">` +
        `<p class="pr-tl-date">${escapeHtml(key)}</p>` +
        `<span class="pr-tl-season" aria-hidden="true">${seasonIconForDate(key)}</span>` +
        `<span class="pr-tl-count">${filtered.length} 枚碎片</span>` +
        `</div>` +
        `<div class="pr-tl-thumbs">` +
        filtered.map(({ photo, index }) => renderPolaroid(photo, index)).join('') +
        `</div></article>`
      );
    })
    .filter(Boolean)
    .join('');
  return `<div class="pr-timeline">${groups}</div>`;
}

function renderTabs(): string {
  return (
    [
      { id: 'albums' as const, label: '相册' },
      { id: 'timeline' as const, label: '时间轴' },
    ]
      .map(
        ({ id, label }) =>
          `<button type="button" class="pr-tab${activeView === id ? ' is-active' : ''}" data-view="${id}" aria-selected="${activeView === id}">${label}</button>`,
      )
      .join('')
  );
}

function renderFilters(categories: string[]): string {
  const parts = [
    `<button type="button" class="pr-filter${activeCategory === 'all' ? ' is-active' : ''}" data-category="all">全部</button>`,
  ];
  for (const cat of categories) {
    parts.push(
      `<button type="button" class="pr-filter pr-filter--${escapeHtml(cat)}${activeCategory === cat ? ' is-active' : ''}" data-category="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`,
    );
  }
  const visible = photos.filter(matchesCategory).length;
  parts.push(`<span class="pr-filter-count">${visible} 枚碎片</span>`);
  return parts.join('');
}

function renderPanels(): string {
  return (
    `<div class="pr-view${activeAlbum ? ' is-album-open' : ''}" data-view-panel="albums" ${activeView === 'albums' ? '' : 'hidden'}>` +
    renderAlbumCards() +
    renderAlbumDetails() +
    `</div>` +
    `<div class="pr-view" data-view-panel="timeline" ${activeView === 'timeline' ? '' : 'hidden'}>` +
    renderTimeline() +
    `</div>`
  );
}

function syncAlbumDetail(): void {
  document.querySelector('[data-view-panel="albums"]')?.classList.toggle('is-album-open', Boolean(activeAlbum));
  document.querySelectorAll('.pr-album-detail').forEach((panel) => {
    const el = panel as HTMLElement;
    el.hidden = el.dataset.album !== activeAlbum;
  });
  // 详情面板刚从 hidden 打开时，补一次显现（否则拍立得会一直 opacity:0）
  if (activeAlbum) {
    const panel = document.querySelector(
      `.pr-album-detail[data-album="${CSS.escape(activeAlbum)}"]`,
    );
    panel?.querySelectorAll('.pr-polaroid').forEach((n) => n.classList.add('is-in'));
  }
}

function bindReveal(root: ParentNode = document): void {
  const nodes = [...root.querySelectorAll('.pr-reveal, .pr-polaroid')].filter(
    (n) => !(n as HTMLElement).closest('[hidden]'),
  );
  if (!nodes.length) return;
  if (!('IntersectionObserver' in window)) {
    nodes.forEach((n) => n.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.05, rootMargin: '40px 0px 40px 0px' },
  );
  nodes.forEach((n) => {
    // 已在视口内的立刻显示，避免首屏空白
    const rect = (n as HTMLElement).getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      n.classList.add('is-in');
      return;
    }
    io.observe(n);
  });
}

function paintHero(): void {
  const img = document.getElementById('photosHeroImg') as HTMLImageElement | null;
  const stats = document.getElementById('photosStats');
  const featured =
    photos.find((p) => p.category === '风景' && /齐云山|普达措|丽江|香格里拉|虎跳峡/.test(p.location || p.title || '')) ||
    photos.find((p) => p.category === '风景') ||
    photos[0] ||
    null;
  if (img && featured) {
    img.src = photoDisplayUrl(featured);
    img.alt = featured.title || '精选摄影';
  }
  if (stats) {
    stats.textContent = photos.length
      ? `${albums.length} 个相册 · ${photos.length} 枚记忆碎片`
      : '';
  }
}

function paint(): void {
  const tabsEl = document.getElementById('photosTabs');
  const filtersEl = document.getElementById('photosFilters');
  const panelsEl = document.getElementById('photosPanels');
  const emptyEl = document.getElementById('photosEmpty');

  paintHero();

  if (tabsEl) tabsEl.innerHTML = photos.length ? renderTabs() : '';
  if (filtersEl) {
    const cats = sortedCategories([
      ...new Set(photos.map((p) => p.category).filter(Boolean) as string[]),
    ]);
    filtersEl.innerHTML = cats.length ? renderFilters(cats) : '';
  }
  if (panelsEl) panelsEl.innerHTML = photos.length ? renderPanels() : '';
  if (emptyEl) emptyEl.hidden = photos.length > 0;
  syncAlbumDetail();
  bindReveal(panelsEl || document);
}

function switchView(next: PhotosView): void {
  if (next === activeView) return;
  const current = document.querySelector(
    `[data-view-panel="${activeView}"]`,
  ) as HTMLElement | null;
  const target = document.querySelector(`[data-view-panel="${next}"]`) as HTMLElement | null;
  activeView = next;
  activeAlbum = '';

  if (current && target && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    current.classList.add('is-leaving');
    window.setTimeout(() => {
      paint();
    }, 220);
  } else {
    paint();
  }
}

function bindEvents(): void {
  document.getElementById('photosTabs')?.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest('[data-view]') as HTMLButtonElement | null;
    if (!btn) return;
    switchView(btn.dataset.view as PhotosView);
  });

  document.getElementById('photosFilters')?.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest('[data-category]') as HTMLButtonElement | null;
    if (!btn) return;
    activeCategory = btn.dataset.category || 'all';
    paint();
  });

  document.getElementById('photosPanels')?.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-album-back]')) {
      activeAlbum = '';
      syncAlbumDetail();
      return;
    }
    const albumBtn = target.closest('.pr-album[data-album]') as HTMLButtonElement | null;
    if (albumBtn?.dataset.album) {
      activeAlbum = albumBtn.dataset.album;
      syncAlbumDetail();
      bindReveal(document.querySelector('.pr-album-detail:not([hidden])') || document);
      return;
    }
    const polaroid = target.closest('.pr-polaroid[data-index]') as HTMLButtonElement | null;
    if (polaroid?.dataset.index != null) {
      openModal(Number(polaroid.dataset.index), queueForCurrentView());
    }
  });

  document.getElementById('photoModalClose')?.addEventListener('click', closeModal);
  document.getElementById('photoModalPrev')?.addEventListener('click', () => showModalOffset(-1));
  document.getElementById('photoModalNext')?.addEventListener('click', () => showModalOffset(1));
  document.getElementById('photoModal')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    const modal = document.getElementById('photoModal');
    if (!modal || modal.hidden) return;
    if (event.key === 'Escape') closeModal();
    if (event.key === 'ArrowLeft') showModalOffset(-1);
    if (event.key === 'ArrowRight') showModalOffset(1);
  });
}

export async function mount(_ctx: HubContext): Promise<void> {
  season = detectSeason();
  document.body.dataset.season = season;
  document.body.classList.add('pixel-hub', 'starport-identity', 'starport-memories');

  const { page, site, photowall } = await loadPhotosPage();
  photos = photowall.photos || [];
  albums = photowall.albums || [];

  document.title = `${page.title} · ${site.name}`;
  mountPixelNav({
    brand: site.name || 'ASKUARY',
    title: page.title || '摄影',
    backHref: '/home/',
    widgets: { weather: site.weather, themeDefault: 'auto' },
  });

  const titleEl = document.getElementById('photosTitle');
  const emptyEl = document.getElementById('photosEmpty');
  const noteEl = document.getElementById('photosNote');
  const kickerEl = document.getElementById('photosHeroKicker');
  const viewTitleEl = document.getElementById('prViewTitle');
  const viewLeadEl = document.querySelector('#prViewTitle + .pr-section-sub');
  const noteTitleEl = document.getElementById('prNoteTitle');
  if (titleEl) titleEl.textContent = page.title || '摄影';
  if (kickerEl && page.heroKicker) kickerEl.textContent = page.heroKicker;
  if (viewTitleEl && page.viewTitle) viewTitleEl.textContent = page.viewTitle;
  if (viewLeadEl && page.viewLead) viewLeadEl.textContent = page.viewLead;
  if (noteTitleEl && page.noteTitle) noteTitleEl.textContent = page.noteTitle;
  if (emptyEl) emptyEl.textContent = page.empty || '还没有照片。';
  if (noteEl && page.lead) noteEl.textContent = page.lead;

  const canvas = document.getElementById('fpStars') as HTMLCanvasElement | null;
  pageCleanups.push(mountMemoryStars(canvas, season));

  bindEvents();
  paint();

  const albumFromQuery = new URLSearchParams(window.location.search).get('album')?.trim();
  if (albumFromQuery && albums.some((a) => a.key === albumFromQuery)) {
    activeView = 'albums';
    activeAlbum = albumFromQuery;
    paint();
    window.requestAnimationFrame(() => {
      document
        .querySelector(`.pr-album-detail[data-album="${CSS.escape(activeAlbum)}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  bindReveal(document);
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
