import '../../styles/home.css';
import '../../styles/home-rich.css';
import '../../styles/home-photo-pixel.css';
import '../../styles/pixel-hub.css';
import '../../styles/home-starport.css';
import '../../styles/home-taste.css';
import { loadHomePage, loadPhotosPage } from '../../config/loader';
import type {
  BlogPostMeta,
  HomeGalleryConfig,
  HomeMusicConfig,
  HomeNotice,
  PhotoAlbum,
  PhotoMapPoint,
  PhotoMetaItem,
  SocialLink,
} from '../../types/config';
import { mountLegalFooter } from '../../ui/mount-legal';
import {
  consumeWarpTransit,
  runHomeBootSplash,
} from '../../ui/mount-home-boot';
import { mountHomeMusic, renderMusicMountShell, renderLyricBar } from '../../ui/mount-home-music';
import { mountHomeMap, renderHomeMapShell } from '../../ui/mount-home-map';
import { mountPixelPet } from '../../ui/mount-pixel-pet';
import { hidePixelNav } from '../../ui/mount-pixel-nav';
import { mountQuoteBackground, DEFAULT_QUOTES } from '../../ui/mount-quote-bg';
import { mountSiteWidgets } from '../../ui/mount-site-widgets';
import { mountMiniRadio } from '../../ui/mount-mini-radio';
import { fetchPortalItems } from '../../api/portal-api';
import { mountHomeParticles } from './particles';
import { mountGateConsole, renderGateConsoleShell } from './mount-gate-console';
import {
  escapeHtml,
  formatDate,
  pinHomeHeader,
  renderHomeShell,
  renderNavLinks,
} from './shared';
import { sitePath } from '../../utils/site-path';
import { isShuoshuo, journalPostHref } from '../../utils/content';
import { socialIconHtml } from '../../ui/site-icons';

import type { HubContext } from '../../ui/hub-types';

let pageCleanups: Array<() => void> = [];

function glitch(text: string, cls = 'hr-glitch'): string {
  const t = escapeHtml(text);
  return `<span class="${cls}" data-text="${t}">${t}</span>`;
}

function renderSocialLinks(social: SocialLink[]): string {
  if (!social.length) return '';
  const items = social
    .map((s) => {
      const icon = socialIconHtml(s.icon || 'link', s.label);
      return (
        `<a class="hr-social-link" href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" ` +
        `aria-label="${escapeHtml(s.label)}" title="${escapeHtml(s.label)}">${icon}</a>`
      );
    })
    .join('');
  return `<nav class="hr-social" aria-label="社交链接">${items}</nav>`;
}

function renderProfile(options: {
  siteName: string;
  title: string;
  bio: string;
  photoCount: number;
  albumCount: number;
  noteCount: number;
  social?: SocialLink[];
}): string {
  const display = options.title || options.siteName;
  const socialHtml = renderSocialLinks(options.social || []);

  return (
    `<section class="hr-profile hr-reveal" aria-label="站点简介">` +
    `<div class="hr-profile-card hr-glass hr-hud">` +
    `<div class="hr-hud-corners" aria-hidden="true"></div>` +
    `<img class="hr-home-navigator" src="${escapeHtml(sitePath('/brand/navigator-v3.webp'))}" alt="" width="1024" height="1536" decoding="async" aria-hidden="true" />` +
    `<div class="hr-brand-mark">` +
    `<div class="hr-brand-left">` +
    `<p class="hr-brand-glitch-wrap">${glitch(display, 'hr-glitch hr-glitch--hero')}</p>` +
    `<p class="hr-status-line"><span class="hr-status-dot"></span>SYSTEM ONLINE</p>` +
    `</div>` +
    socialHtml +
    `</div>` +
    `<div class="hr-profile-copy">` +
    `<p class="hr-kicker">ASKUARY // LIGHTBOX</p>` +
    `<h1 class="hr-profile-name">${glitch(display, 'hr-glitch hr-glitch--title')}</h1>` +
    (options.bio ? `<p class="hr-profile-bio">${escapeHtml(options.bio)}</p>` : '') +
    `<ul class="hr-stats">` +
    `<li class="hr-stat"><span class="hr-stat-num">${options.photoCount}</span><span class="hr-stat-label">PHOTOS</span></li>` +
    `<li class="hr-stat"><span class="hr-stat-num">${options.albumCount}</span><span class="hr-stat-label">ALBUMS</span></li>` +
    `<li class="hr-stat"><span class="hr-stat-num">${options.noteCount}</span><span class="hr-stat-label">NOTES</span></li>` +
    `</ul>` +
    `</div></div>` +
    `</section>`
  );
}

function renderDeck(options: {
  notices: HomeNotice[];
  music?: HomeMusicConfig;
  gallery?: HomeGalleryConfig;
  waveHtml: string;
}): string {
  const notices =
    options.notices.length > 0
      ? options.notices
      : [
          {
            tag: 'NOTICE',
            title: '欢迎抵达 ASKUARY',
            date: new Date().toISOString().slice(0, 10),
          },
        ];

  const noticeItems = notices
    .slice(0, 12)
    .map((n) => {
      const inner =
        `<span class="hr-notice-tag">${escapeHtml(n.tag || 'NOTICE')}</span>` +
        `<strong class="hr-notice-title">${escapeHtml(n.title)}</strong>` +
        (n.body ? `<p class="hr-notice-body">${escapeHtml(n.body)}</p>` : '') +
        (n.date
          ? `<time class="hr-notice-date" datetime="${escapeHtml(n.date)}">${escapeHtml(n.date)}</time>`
          : '');
      if (n.url) {
        return `<a class="hr-notice-item" href="${escapeHtml(sitePath(n.url))}">${inner}</a>`;
      }
      return `<div class="hr-notice-item">${inner}</div>`;
    })
    .join('');

  const galleryTitle = options.gallery?.title || '站点掠影';
  const galleryUrl = sitePath(options.gallery?.url || '/photos/');
  const galleryCap = options.gallery?.caption || '';

  return (
    `<section class="hr-deck hr-reveal" aria-label="指挥台模块">` +
    `<div class="hr-deck-col hr-deck-col--notice">` +
    options.waveHtml +
    `<article class="hr-panel hr-glass hr-hud hr-panel--notice">` +
    `<div class="hr-hud-corners" aria-hidden="true"></div>` +
    `<header class="hr-panel-head"><span class="hr-panel-code">01</span><h2>公告栏</h2></header>` +
    `<div class="hr-notice-carousel" id="hrNoticeCarousel" data-count="${notices.length}">` +
    `<div class="hr-notice-track">${noticeItems}</div>` +
    `</div></article></div>` +
    `<article class="hr-panel hr-glass hr-hud hr-panel--music">` +
    `<div class="hr-hud-corners" aria-hidden="true"></div>` +
    `<header class="hr-panel-head"><span class="hr-panel-code">02</span><h2>次元电台</h2></header>` +
    renderMusicMountShell() +
    `</article>` +
    `<a class="hr-panel hr-glass hr-hud hr-panel--gallery" id="hrGalleryLink" href="${escapeHtml(galleryUrl)}">` +
    `<div class="hr-hud-corners" aria-hidden="true"></div>` +
    `<header class="hr-panel-head"><span class="hr-panel-code">03</span><h2>${escapeHtml(galleryTitle)}</h2></header>` +
    `<div class="hr-gallery-shot">` +
    `<img class="hr-gallery-layer is-active" id="hrGalleryA" alt="" decoding="async" />` +
    `<img class="hr-gallery-layer" id="hrGalleryB" alt="" decoding="async" />` +
    `<div class="hr-gallery-fx" id="hrGalleryFx" aria-hidden="true"></div>` +
    `<span class="hr-gallery-cap${galleryCap ? ' is-show' : ''}" id="hrGalleryCap">${escapeHtml(galleryCap)}</span>` +
    `</div></a>` +
    `</section>`
  );
}

const DEFAULT_WAVE_LINES = [
  '欢迎来到 ASKUARY 次元纪闻斋',
  '今晚的星星也在偷看你的进度条',
  '像素伙伴在角落等你互动',
  '黑洞另一侧，主页泡好了茶',
  '迷路没关系，传送阵还亮着',
  '次元波动平稳，适合随便逛逛',
  '慢一点也没关系，宇宙不催人',
  '友联卫星轨道正常，信号友好',
];

function buildWaveItems(custom?: string[]): string[] {
  const lines = (custom || [])
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  const pool = lines.length >= 6 ? lines : [...lines, ...DEFAULT_WAVE_LINES];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of pool) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.slice(0, 28);
}

function renderWave(page: { waveLines?: string[]; waveTitle?: string }): string {
  const items = buildWaveItems(page.waveLines);
  const doubled = [...items, ...items]
    .map((t) => `<span class="hr-bubble">${escapeHtml(t)}</span>`)
    .join('');
  return (
    `<div class="hr-wave-slim hr-glass" aria-label="${escapeHtml(page.waveTitle || '次元波动')}">` +
    `<span class="hr-wave-slim-label">${escapeHtml(page.waveTitle || 'SIGNAL')}</span>` +
    `<div class="hr-wave"><div class="hr-wave-track">${doubled}</div></div>` +
    `</div>`
  );
}

type HomePhotoCard = {
  id: string;
  title: string;
  album: string;
  src: string;
};

const PHOTO_FRAMES = [
  { id: 'mosaic', label: '拼贴' },
] as const;

type PhotoFrameId = (typeof PHOTO_FRAMES)[number]['id'];

function renderPhotoShare(photos: HomePhotoCard[]): string {
  if (!photos.length) return '';

  const cards = photos
    .map((p, i) => {
      const span = i % 7 === 0 ? 'hr-photo-card--wide' : i % 5 === 0 ? 'hr-photo-card--tall' : '';
      const storyHref = sitePath(`/photos/album/?id=${encodeURIComponent(p.id)}`);
      return (
        `<button type="button" class="hr-photo-card ${span}" data-frame="mosaic" data-id="${escapeHtml(p.id)}" data-src="${escapeHtml(p.src)}" data-title="${escapeHtml(p.title)}" data-album="${escapeHtml(p.album)}" data-href="${escapeHtml(storyHref)}" style="--i:${i}">` +
        `<span class="hr-photo-frame" aria-hidden="true"></span>` +
        `<span class="hr-photo-media"><img src="${escapeHtml(p.src)}" alt="${escapeHtml(p.title)}" loading="lazy" decoding="async" /></span>` +
        `<span class="hr-photo-meta">` +
        `<strong>${escapeHtml(p.title)}</strong>` +
        (p.album ? `<em>${escapeHtml(p.album)}</em>` : '') +
        `</span></button>`
      );
    })
    .join('');

  return (
    `<section class="hr-section hr-photo-share hr-reveal" aria-label="摄影">` +
    `<div class="hr-photo-grid">${cards}</div>` +
    `<div class="hr-photo-preview" id="hrPhotoPreview" hidden>` +
    `<button type="button" class="hr-photo-preview-backdrop" data-preview-close aria-label="关闭预览"></button>` +
    `<div class="hr-photo-preview-dialog" role="dialog" aria-modal="true" aria-label="相册预览">` +
    `<div class="hr-photo-preview-stage" id="hrPreviewStage" data-frame="mosaic">` +
    `<span class="hr-photo-frame" aria-hidden="true"></span>` +
    `<span class="hr-photo-media"><img id="hrPreviewImg" alt="" /></span>` +
    `</div>` +
    `<div class="hr-photo-preview-meta">` +
    `<strong id="hrPreviewTitle"></strong>` +
    `<em id="hrPreviewAlbum"></em>` +
    `</div>` +
    `<div class="hr-photo-preview-actions">` +
    `<a class="hr-photo-preview-story" id="hrPreviewStory" href="#">进入故事</a>` +
    `<button type="button" class="hr-photo-preview-close" data-preview-close>关闭</button>` +
    `</div></div></div></section>`
  );
}

function bindNoticeCarousel(root: ParentNode): void {
  const box = root.querySelector<HTMLElement>('#hrNoticeCarousel');
  const track = box?.querySelector<HTMLElement>('.hr-notice-track');
  if (!box || !track) return;
  const items = Array.from(track.children) as HTMLElement[];
  if (items.length <= 1) {
    items[0]?.classList.add('is-active');
    return;
  }

  let index = 0;
  const show = (next: number) => {
    items[index]?.classList.remove('is-active', 'is-exit');
    const prev = index;
    index = ((next % items.length) + items.length) % items.length;
    items[prev]?.classList.add('is-exit');
    items[index]?.classList.add('is-active');
    window.setTimeout(() => items[prev]?.classList.remove('is-exit'), 480);
  };

  items.forEach((el, i) => el.classList.toggle('is-active', i === 0));
  const timer = window.setInterval(() => show(index + 1), 4200);
  pageCleanups.push(() => window.clearInterval(timer));
}

function bindPhotoPreview(root: ParentNode): void {
  const overlay = root.querySelector<HTMLElement>('#hrPhotoPreview');
  const stage = root.querySelector<HTMLElement>('#hrPreviewStage');
  const img = root.querySelector<HTMLImageElement>('#hrPreviewImg');
  const titleEl = root.querySelector<HTMLElement>('#hrPreviewTitle');
  const albumEl = root.querySelector<HTMLElement>('#hrPreviewAlbum');
  const storyLink = root.querySelector<HTMLAnchorElement>('#hrPreviewStory');
  if (!overlay || !stage || !img || !titleEl || !albumEl || !storyLink) return;

  let activeCard: HTMLElement | null = null;

  const setFrame = (id: PhotoFrameId) => {
    stage.dataset.frame = id;
    if (activeCard) activeCard.dataset.frame = id;
    overlay.querySelectorAll<HTMLButtonElement>('.hr-frame-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.frame === id);
    });
  };

  const close = () => {
    overlay.hidden = true;
    document.body.classList.remove('hr-preview-open');
    activeCard = null;
  };

  const open = (card: HTMLElement) => {
    activeCard = card;
    const frame = (card.dataset.frame || 'mosaic') as PhotoFrameId;
    img.src = card.dataset.src || '';
    img.alt = card.dataset.title || '';
    titleEl.textContent = card.dataset.title || '';
    albumEl.textContent = card.dataset.album || '';
    storyLink.href = card.dataset.href || '#';
    setFrame(PHOTO_FRAMES.some((f) => f.id === frame) ? frame : 'mosaic');
    overlay.hidden = false;
    document.body.classList.add('hr-preview-open');
  };

  root.querySelectorAll<HTMLElement>('.hr-photo-card').forEach((card) => {
    card.addEventListener('click', () => open(card));
  });

  overlay.querySelectorAll('[data-preview-close]').forEach((el) => {
    el.addEventListener('click', () => close());
  });

  overlay.querySelectorAll<HTMLButtonElement>('.hr-frame-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.frame as PhotoFrameId | undefined;
      if (!id || !PHOTO_FRAMES.some((f) => f.id === id)) return;
      setFrame(id);
    });
  });

  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape' && !overlay.hidden) close();
  };
  document.addEventListener('keydown', onKey);
  pageCleanups.push(() => {
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('hr-preview-open');
  });
}

function bindReveal(root: ParentNode): void {
  const nodes = root.querySelectorAll('.hr-reveal');
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
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
  );
  nodes.forEach((n) => io.observe(n));
}

function bindHomeSearch(allPosts: BlogPostMeta[]): void {
  const input = document.getElementById('homeSearchInput') as HTMLInputElement | null;
  const panel = document.getElementById('homeSearchPanel');
  if (!input || !panel) return;

  const render = (q: string) => {
    const query = q.trim().toLowerCase();
    if (!query) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    const hits = allPosts
      .filter((p) => {
        const hay = `${p.title} ${(p.tags || []).join(' ')}`.toLowerCase();
        return hay.includes(query);
      })
      .slice(0, 8);
    if (!hits.length) {
      panel.hidden = false;
      panel.innerHTML = `<p class="home-search-empty">未找到匹配条目</p>`;
      return;
    }
    panel.hidden = false;
    panel.innerHTML = hits
      .map(
        (p) =>
          `<a class="home-search-hit" href="${escapeHtml(sitePath(journalPostHref(p)))}">` +
          `<strong>${escapeHtml(p.title)}</strong>` +
          `<span>${escapeHtml(formatDate(p.date))}</span>` +
          `</a>`,
      )
      .join('');
  };

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('focus', () => {
    if (input.value.trim()) render(input.value);
  });
  document.addEventListener('click', (ev) => {
    const t = ev.target as Node | null;
    const wrap = document.getElementById('homeSearch');
    if (wrap && t && !wrap.contains(t)) {
      panel.hidden = true;
    }
  });
}

async function bindPhotoGallery(sourcePhotos?: PhotoMetaItem[]): Promise<void> {
  const layerA = document.getElementById('hrGalleryA') as HTMLImageElement | null;
  const layerB = document.getElementById('hrGalleryB') as HTMLImageElement | null;
  const cap = document.getElementById('hrGalleryCap');
  if (!layerA || !layerB) return;

  try {
    const list =
      sourcePhotos ||
      (await loadPhotosPage()).photowall.photos ||
      [];
    const photos = list
      .map((p) => ({
        src: sitePath(p.thumb || p.src || ''),
        title: p.title || p.id,
        id: p.id,
      }))
      .filter((p) => p.src);
    if (!photos.length) {
      layerA.src = sitePath('/brand/site-shot.png');
      layerA.classList.add('is-active');
      if (cap) cap.textContent = '';
      return;
    }

    let i = 0;
    let showingA = true;

    const preload = (src: string) =>
      new Promise<void>((resolve) => {
        const im = new Image();
        im.onload = () => resolve();
        im.onerror = () => resolve();
        im.src = src;
      });

    const fx = document.getElementById('hrGalleryFx');

    const show = async (idx: number) => {
      const p = photos[((idx % photos.length) + photos.length) % photos.length];
      await preload(p.src);
      const next = showingA ? layerB : layerA;
      const prev = showingA ? layerA : layerB;
      next.src = p.src;
      next.alt = p.title;
      next.classList.add('is-active', 'is-enter');
      prev.classList.remove('is-active');
      prev.classList.add('is-exit');
      if (fx) {
        fx.classList.remove('is-flash');
        void fx.offsetWidth;
        fx.classList.add('is-flash');
      }
      window.setTimeout(() => {
        prev.classList.remove('is-exit');
        next.classList.remove('is-enter');
        fx?.classList.remove('is-flash');
      }, 780);
      showingA = !showingA;
      if (cap) {
        cap.classList.remove('is-show');
        window.setTimeout(() => {
          cap.textContent = p.title;
          cap.classList.add('is-show');
        }, 160);
      }
      const link = document.getElementById('hrGalleryLink') as HTMLAnchorElement | null;
      if (link) {
        link.href = sitePath(`/photos/album/?id=${encodeURIComponent(p.id)}`);
      }
    };

    await show(0);
    const timer = window.setInterval(() => {
      i += 1;
      void show(i);
    }, 4800);
    pageCleanups.push(() => window.clearInterval(timer));
  } catch {
    layerA.src = sitePath('/brand/site-shot.png');
    layerA.classList.add('is-active');
  }
}

export async function mount(_ctx: HubContext): Promise<void> {
  hidePixelNav();
  document.getElementById('pxNav')?.remove();
  document.body.classList.remove('pixel-hub');
  document.body.classList.add('home-page', 'home-rich', 'home-anime', 'starport-home');
  const fromWarp = !_ctx.soft && consumeWarpTransit();

  const { page, site, posts } = await loadHomePage();
  const shell = document.getElementById('homeShell');
  if (!shell) return;

  if (!_ctx.soft) {
    await runHomeBootSplash({
      siteName: site.name,
      avatarUrl: '',
      avatarAlt: site.name,
      fromWarp,
    });
  }

  document.title = `${page.title} · ${site.name}`;

  const shuoshuo = posts.filter((p) => isShuoshuo(p));
  let photoCards: HomePhotoCard[] = [];
  let photoCount = 0;
  let albumCount = 0;
  let photowallPhotos: PhotoMetaItem[] = [];
  let photowallAlbums: PhotoAlbum[] = [];
  let photowallMapPoints: PhotoMapPoint[] = [];
  try {
    const { photowall } = await loadPhotosPage();
    const all = photowall.photos || [];
    photowallPhotos = all;
    photowallAlbums = photowall.albums || [];
    photowallMapPoints = photowall.mapPoints || [];
    photoCount = all.length;
    const albums = new Set<string>();
    photoCards = all
      .slice()
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 18)
      .map((p) => {
        if (p.album) albums.add(p.album);
        return {
          id: p.id,
          title: p.title || p.id,
          album: p.album || '',
          src: sitePath(p.thumb || p.src || ''),
        };
      })
      .filter((p) => p.src);
    albumCount = (photowall.albums || []).length || albums.size;
  } catch {
    photoCards = [];
  }

  const nav = page.nav?.length ? page.nav : [{ label: '主页', url: '/home/' }];
  const bio =
    page.bio ||
    page.tagline ||
    site.authorBio ||
    site.intro ||
    '';

  const noticesFallback: HomeNotice[] =
    page.notices?.length
      ? page.notices
      : (page.sections || []).map((s) => ({
          tag: 'INFO',
          title: s.heading,
          body: s.body,
        }));

  const noticesFromApi = await fetchPortalItems<HomeNotice>(site.apiBase, 'notices');
  const notices =
    noticesFromApi && noticesFromApi.length ? noticesFromApi : noticesFallback;

  const mainHtml =
    renderProfile({
      siteName: site.name,
      title: page.title || site.name,
      bio,
      photoCount,
      albumCount,
      noteCount: shuoshuo.length,
      social: site.social || [],
    }) +
    renderDeck({
      notices,
      music: page.music,
      gallery: page.gallery,
      waveHtml: renderWave(page),
    }) +
    renderLyricBar() +
    renderGateConsoleShell() +
    renderHomeMapShell() +
    renderPhotoShare(photoCards);

  shell.innerHTML = renderHomeShell({
    siteName: site.name,
    brandLabel: site.name,
    withSearch: true,
    navHtml: renderNavLinks(nav, '/home/'),
    mainHtml,
    footerHtml: `<div id="pageLegal"></div>`,
  });

  let canvas = document.getElementById('homeParticles') as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'homeParticles';
    canvas.className = 'home-particles';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
  }
  pageCleanups.push(mountHomeParticles(canvas));
  bindReveal(shell);
  pinHomeHeader(shell.querySelector('.home-header'));
  bindHomeSearch(posts);
  bindNoticeCarousel(shell);
  bindPhotoPreview(shell);
  mountHomeMap(document.getElementById('hrHomeMap'), {
    photos: photowallPhotos,
    albums: photowallAlbums,
    mapPoints: photowallMapPoints,
    amapKey: site.amapKey,
    amapSecurityJsCode: site.amapSecurityJsCode,
  });
  mountPixelPet({ lines: page.petLines || page.waveLines });
  void mountHomeMusic(document.getElementById('hrMusicRoot'), page.music).then(() => {
    void mountMiniRadio();
  });
  void mountGateConsole(document.getElementById('gateConsole')).then((dispose) => {
    if (dispose) pageCleanups.push(dispose);
  });
  void bindPhotoGallery(photowallPhotos);

  const [quoteOverlay, widgetOverlay] = await Promise.all([
    fetchPortalItems<{ text?: string } | string>(site.apiBase, 'bg-quotes'),
    fetchPortalItems<Record<string, unknown>>(site.apiBase, 'site-widgets'),
  ]);
  const quotesFromApi = (quoteOverlay || [])
    .map((q) => (typeof q === 'string' ? q : String(q?.text || '').trim()))
    .filter(Boolean);
  const quotes = quotesFromApi.length
    ? quotesFromApi
    : page.bgQuotes?.length
      ? page.bgQuotes
      : DEFAULT_QUOTES;
  mountQuoteBackground(quotes);

  const widgetCfg = (widgetOverlay && widgetOverlay[0]) || page.widgets || {};
  const weather = (widgetCfg as { weather?: Record<string, unknown> }).weather ||
    page.weather ||
    site.weather ||
    {};
  mountSiteWidgets({
    weather: {
      enabled: weather.enabled !== false,
      city: String(weather.city || '上海'),
      lat: typeof weather.lat === 'number' ? weather.lat : 31.23,
      lng: typeof weather.lng === 'number' ? weather.lng : 121.47,
    },
    themeDefault:
      (widgetCfg as { themeDefault?: 'light' | 'dark' | 'auto' }).themeDefault ||
      page.themeDefault ||
      'auto',
    allowThemeSwitch:
      (widgetCfg as { allowThemeSwitch?: boolean }).allowThemeSwitch !== false,
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
  document.getElementById('homeParticles')?.remove();
  document.getElementById('quoteBg')?.remove();
  document.body.classList.remove('home-rich', 'home-anime', 'starport-home', 'hr-preview-open');
}
