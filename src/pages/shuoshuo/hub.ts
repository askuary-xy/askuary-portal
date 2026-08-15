import '../../styles/home.css';
import '../../styles/shuoshuo.css';
import '../../styles/pixel-hub.css';
import '../../styles/content-starport.css';
import { fetchContentPost } from '../../api/content-api';
import { loadHomePage } from '../../config/loader';
import { sitePath } from '../../utils/site-path';
import { isShuoshuo, journalPostHref } from '../../utils/content';
import { stripImagesFromHtml } from '../../utils/cover';
import { postCoverSrc } from '../../utils/post-cover';
import type { BlogPostMeta, JournalPost } from '../../types/config';
import { mountLegalFooter } from '../../ui/mount-legal';
import { escapeHtml, renderHomeShell } from '../home/shared';
import { mountPixelNav } from '../../ui/mount-pixel-nav';
import type { HubContext } from '../../ui/hub-types';

let pageCleanups: Array<() => void> = [];

const TAGS = ['日常', '吐槽', '恋爱', '心情', '随笔', '夜话'] as const;
const ATTACH = ['clip', 'pin', 'tape', 'none'] as const;
const PAPER = ['plain', 'lined', 'grid', 'memo'] as const;

const BOARD_W = 2400;
const BOARD_H = 1800;
const NOTE_W = 196;
const NOTE_H = 148;

type Mode = 'scatter' | 'recent';
type NotePos = { x: number; y: number; rot: number; z: number };

async function loadShuoshuoDetails(
  metas: BlogPostMeta[],
  apiBase?: string,
): Promise<JournalPost[]> {
  const base = import.meta.env.BASE_URL + 'data';
  return Promise.all(
    metas.map(async (meta) => {
      try {
        if (meta.origin === 'api' && apiBase) {
          const fromApi = await fetchContentPost(apiBase, 'journal', meta.slug);
          if (fromApi) return { ...fromApi, origin: 'api' as const };
        }
        const res = await fetch(`${base}/journal/${encodeURIComponent(meta.slug)}.json`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          return {
            ...meta,
            html: meta.summary ? `<p>${escapeHtml(meta.summary)}</p>` : '',
          };
        }
        return (await res.json()) as JournalPost;
      } catch {
        return { ...meta, html: meta.summary ? `<p>${escapeHtml(meta.summary)}</p>` : '' };
      }
    }),
  );
}

function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function plainText(htmlOrText: string): string {
  return String(htmlOrText || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function whisperLine(post: JournalPost): string {
  const fromSummary = (post.summary || '').trim();
  const text = fromSummary || plainText(post.html || '') || post.title || '……';
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
}

function pickTag(post: JournalPost): { label: string; tone: number } {
  const skip = new Set(['碎念', '说说', 'shuoshuo', 'ss']);
  const custom = (post.tags || []).find((t) => !skip.has(String(t).toLowerCase()) && !skip.has(t));
  const tone = hashSlug(post.slug) % TAGS.length;
  if (custom) return { label: custom, tone: hashSlug(custom) % 6 };
  return { label: TAGS[tone], tone };
}

function formatDate(raw: string | undefined): string {
  const s = String(raw || '').trim();
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function rememberFromShuoshuo(): void {
  try {
    sessionStorage.setItem('askuary:from', 'shuoshuo');
  } catch {
    /* ignore */
  }
}

function layoutScatter(n: number, seed: number): NotePos[] {
  const rnd = mulberry32(seed || 1);
  const cx = BOARD_W / 2;
  const cy = BOARD_H / 2;
  const spreadX = Math.min(520, 180 + n * 28);
  const spreadY = Math.min(360, 140 + n * 22);
  const positions: NotePos[] = [];
  for (let i = 0; i < n; i++) {
    let x = 0;
    let y = 0;
    let tries = 0;
    do {
      const ang = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd());
      x = cx - NOTE_W / 2 + Math.cos(ang) * spreadX * r * (0.55 + rnd() * 0.7);
      y = cy - NOTE_H / 2 + Math.sin(ang) * spreadY * r * (0.55 + rnd() * 0.7);
      x = Math.max(40, Math.min(BOARD_W - NOTE_W - 40, x));
      y = Math.max(40, Math.min(BOARD_H - NOTE_H - 40, y));
      tries += 1;
    } while (tries < 22 && positions.some((p) => Math.hypot(p.x - x, p.y - y) < 88));
    positions.push({
      x,
      y,
      rot: Math.round((rnd() * 16 - 8) * 10) / 10,
      z: n - i,
    });
  }
  return positions;
}

function layoutRecent(n: number): NotePos[] {
  const cols = Math.max(3, Math.ceil(Math.sqrt(n * 1.35)));
  const gapX = 220;
  const gapY = 180;
  const startX = (BOARD_W - cols * gapX) / 2;
  const startY = 220;
  const positions: NotePos[] = [];
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const jitter = ((i * 37) % 17) - 8;
    positions.push({
      x: startX + col * gapX + jitter,
      y: startY + row * gapY + (((i * 13) % 11) - 5),
      rot: ((i * 7) % 11) - 5,
      z: n - i,
    });
  }
  return positions;
}

function renderNote(post: JournalPost, coverSrc: string, index: number): string {
  const href = sitePath(journalPostHref(post, { from: 'shuoshuo' }));
  const tag = pickTag(post);
  const whisper = whisperLine(post);
  const h = hashSlug(post.slug);
  const attach = ATTACH[h % ATTACH.length];
  const paper = PAPER[(h >> 3) % PAPER.length];
  const initial = (post.title || '碎').trim().slice(0, 1);
  const avatar = coverSrc
    ? `<img src="${escapeHtml(coverSrc)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
    : escapeHtml(initial);
  const body =
    stripImagesFromHtml(post.html || '').trim() ||
    (post.summary
      ? `<p>${escapeHtml(post.summary)}</p>`
      : `<p>${escapeHtml(post.title || '……')}</p>`);

  return (
    `<article class="ss-note-wrap tone-${tag.tone} paper-${paper} attachment-${attach}" ` +
    `tabindex="0" role="link" data-href="${escapeHtml(href)}" data-slug="${escapeHtml(post.slug)}" data-index="${index}">` +
    `<span class="ss-note-attach" aria-hidden="true"></span>` +
    `<div class="ss-note-inner">` +
    `<div class="ss-note ss-note-front">` +
    `<div class="ss-note-head">` +
    `<span class="ss-note-avatar">${avatar}</span>` +
    `<span class="ss-note-meta">` +
    `<strong class="ss-note-name">${escapeHtml(post.title || '无题')}</strong>` +
    `<span class="ss-note-tag">${escapeHtml(tag.label)}</span>` +
    `</span></div>` +
    `<p class="ss-note-body">${escapeHtml(whisper)}</p>` +
    `<div class="ss-note-foot">` +
    `<time>${escapeHtml(formatDate(post.date))}</time>` +
    `</div></div>` +
    `<div class="ss-note ss-note-back">` +
    `<h3 class="ss-note-back-title">${escapeHtml(post.title || '无题')}</h3>` +
    `<div class="ss-note-more">${body}</div>` +
    `<div class="ss-note-foot">` +
    `<time>${escapeHtml(formatDate(post.date))}</time>` +
    `</div></div>` +
    `</div></article>`
  );
}

function bindBoard(viewport: HTMLElement, board: HTMLElement, items: JournalPost[]): () => void {
  let mode: Mode = 'scatter';
  let seed = Date.now() % 1_000_000;
  let panX = 0;
  let panY = 0;
  let scale = 1;
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const countEl = document.getElementById('ssCount');
  const btnRandom = document.getElementById('ssRandom');
  const btnRecent = document.getElementById('ssRecent');
  const notes = [...board.querySelectorAll<HTMLElement>('.ss-note-wrap')];

  if (countEl) countEl.textContent = `总数 ${items.length}`;

  const applyTransform = () => {
    board.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  };

  const placeNotes = (positions: NotePos[]) => {
    notes.forEach((note, i) => {
      const p = positions[i];
      if (!p) return;
      note.style.left = `${p.x}px`;
      note.style.top = `${p.y}px`;
      note.style.transform = `rotate(${p.rot}deg)`;
      note.style.zIndex = String(p.z);
      note.classList.remove('is-flipped');
    });
  };

  const centerBoard = () => {
    const rect = viewport.getBoundingClientRect();
    panX = rect.width / 2 - (BOARD_W * scale) / 2;
    panY = rect.height / 2 - (BOARD_H * scale) / 2;
    applyTransform();
  };

  const refresh = () => {
    const positions = mode === 'recent' ? layoutRecent(notes.length) : layoutScatter(notes.length, seed);
    placeNotes(positions);
    centerBoard();
    btnRandom?.classList.toggle('is-active', mode === 'scatter');
    btnRecent?.classList.toggle('is-active', mode === 'recent');
  };

  btnRandom?.addEventListener('click', () => {
    mode = 'scatter';
    seed = Date.now() % 1_000_000;
    refresh();
  });
  btnRecent?.addEventListener('click', () => {
    mode = 'recent';
    refresh();
  });

  // 画布平移 / 缩放
  let panning = false;
  let panMoved = false;
  let panStartX = 0;
  let panStartY = 0;
  let originX = 0;
  let originY = 0;

  viewport.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('.ss-note-wrap')) return;
    panning = true;
    panMoved = false;
    panStartX = e.clientX;
    panStartY = e.clientY;
    originX = panX;
    originY = panY;
    viewport.classList.add('is-panning');
    viewport.setPointerCapture(e.pointerId);
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!panning) return;
    const dx = e.clientX - panStartX;
    const dy = e.clientY - panStartY;
    if (Math.hypot(dx, dy) > 4) panMoved = true;
    panX = originX + dx;
    panY = originY + dy;
    applyTransform();
  });

  const endPan = (e: PointerEvent) => {
    if (!panning) return;
    panning = false;
    viewport.classList.remove('is-panning');
    try {
      viewport.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  viewport.addEventListener('pointerup', endPan);
  viewport.addEventListener('pointercancel', endPan);

  viewport.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const next = Math.min(1.6, Math.max(0.55, scale + (e.deltaY > 0 ? -0.08 : 0.08)));
      if (next === scale) return;
      const rect = viewport.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const worldX = (mx - panX) / scale;
      const worldY = (my - panY) / scale;
      scale = next;
      panX = mx - worldX * scale;
      panY = my - worldY * scale;
      applyTransform();
    },
    { passive: false },
  );

  // 便签：拖动重排 + 翻转 / 打开
  notes.forEach((note) => {
    let drag = false;
    let moved = false;
    let dx = 0;
    let dy = 0;
    let ox = 0;
    let oy = 0;
    let baseRot = 0;

    const go = () => {
      const href = note.dataset.href;
      if (!href) return;
      rememberFromShuoshuo();
      void import('../../ui/soft-nav').then((m) => m.softNavigate(href));
    };

    note.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      drag = true;
      moved = false;
      dx = e.clientX;
      dy = e.clientY;
      ox = parseFloat(note.style.left || '0');
      oy = parseFloat(note.style.top || '0');
      baseRot = parseFloat((note.style.transform.match(/rotate\((-?[\d.]+)deg\)/) || [])[1] || '0');
      note.classList.add('is-dragging');
      note.style.zIndex = '999';
      note.setPointerCapture(e.pointerId);
    });

    note.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const mx = e.clientX - dx;
      const my = e.clientY - dy;
      if (Math.hypot(mx, my) > 5) moved = true;
      note.style.left = `${ox + mx / scale}px`;
      note.style.top = `${oy + my / scale}px`;
      note.style.transform = `rotate(${baseRot}deg)`;
    });

    const endDrag = (e: PointerEvent) => {
      if (!drag) return;
      drag = false;
      note.classList.remove('is-dragging');
      try {
        note.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (moved || panMoved) return;

      // 桌面：悬停已翻面 → 点击打开；触屏：点一次翻转，再点打开
      if (!canHover) {
        if (note.classList.contains('is-flipped')) {
          go();
          return;
        }
        note.classList.toggle('is-flipped');
        return;
      }
      go();
    };

    note.addEventListener('pointerup', endDrag);
    note.addEventListener('pointercancel', endDrag);

    note.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        go();
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (canHover) go();
        else note.classList.toggle('is-flipped');
      }
    });
  });

  refresh();
  window.addEventListener('resize', centerBoard);
  return () => window.removeEventListener('resize', centerBoard);
}

export async function mount(_ctx: HubContext): Promise<void> {
  document.body.classList.add('ss-page', 'pixel-hub', 'home-page', 'starport-content', 'starport-signals');

  const { page, site, posts } = await loadHomePage();
  const shell = document.getElementById('homeShell');
  if (!shell) return;

  document.title = `碎念 · ${site.name}`;

  const metas = posts.filter(isShuoshuo);
  const items = await loadShuoshuoDetails(metas, site.apiBase);

  const notesHtml = items.length
    ? items.map((p, i) => renderNote(p, postCoverSrc(p, site, 'shuoshuo'), i)).join('')
    : '';

  const mainHtml =
    `<section class="ss-stage" aria-label="碎念">` +
    `<header class="ss-bar">` +
    `<h1 class="ss-bar-title">碎念</h1>` +
    `<div class="ss-bar-tools">` +
    `<span class="ss-chip" id="ssCount">总数 0</span>` +
    `<button type="button" class="ss-btn is-active" id="ssRandom">随机</button>` +
    `<button type="button" class="ss-btn" id="ssRecent">最近</button>` +
    `</div>` +
    `</header>` +
    `<div class="ss-viewport" id="ssViewport">` +
    `<div class="ss-board" id="ssBoard">` +
    `<div class="ss-board-grid" aria-hidden="true"></div>` +
    notesHtml +
    `</div>` +
    (items.length ? '' : `<p class="ss-empty">还没有碎念。</p>`) +
    `</div></section>`;

  shell.innerHTML = renderHomeShell({
    siteName: site.name,
    navHtml: '',
    mainHtml,
    backgroundUrl: '',
    footerHtml: `<div id="pageLegal"></div>`,
    withHeader: false,
  });

  mountPixelNav({
    brand: site.name || 'ASKUARY',
    title: '碎念',
    backHref: '/home/',
    widgets: { weather: site.weather, themeDefault: page.themeDefault || 'auto' },
    petLines: page.petLines || page.waveLines,
  });

  const viewport = document.getElementById('ssViewport');
  const board = document.getElementById('ssBoard');
  if (viewport && board && items.length) {
    pageCleanups.push(bindBoard(viewport, board, items));
  }

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
  document.body.classList.remove('ss-page');
  document.body.classList.remove('starport-content', 'starport-signals');
}
