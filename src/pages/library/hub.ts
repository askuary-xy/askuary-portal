import '../../styles/pixel-hub.css';
import '../../styles/library-scifi.css';
import '../../styles/legal.css';
import '../../styles/facility-starport.css';
import '../../styles/facility-devices.css';
import { loadLibraryPage } from '../../config/loader';
import { escapeHtml } from '../../utils/html';
import { mountLegalFooter } from '../../ui/mount-legal';
import { mountHomeBackground } from '../../ui/mount-home-background';
import { mountPixelNav } from '../../ui/mount-pixel-nav';
import { Starfield } from '../../canvas/starfield';
import {
  createLibraryScene,
  toSciFiBook,
  type LibraryCategory,
  type LibrarySceneApi,
  type SciFiBookData,
} from './library-scene';

import type { HubContext } from '../../ui/hub-types';

let pageCleanups: Array<() => void> = [];

const CAT_ORDER: Array<{ id: LibraryCategory; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'read', label: '阅读' },
  { id: 'game', label: '游玩' },
  { id: 'anime', label: '追番' },
  { id: 'screen', label: '影像' },
];

let sceneApi: LibrarySceneApi | null = null;
let starfield: Starfield | null = null;
let activeCat: LibraryCategory = 'all';
let navLock = false;
let streamTimer = 0;

function sciFiBlurb(text: string): string {
  const t = text.trim();
  if (!t) return '这本卡带还没写入可读内容。';
  if (/卡带|图鉴|档案|存档|像素/.test(t)) return t;
  return t;
}

function paragraphs(text: string): string {
  return sciFiBlurb(text)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function renderCats(): void {
  const el = document.getElementById('libCats');
  if (!el) return;
  el.innerHTML = CAT_ORDER.map((c) => {
    const active = c.id === activeCat ? ' is-active' : '';
    return (
      `<button type="button" class="lib-scifi-cat${active}" data-cat="${c.id}" ` +
      `${navLock ? 'disabled' : ''}>${escapeHtml(c.label)}</button>`
    );
  }).join('');
}

function setStatus(text: string, count: number): void {
  const t = document.getElementById('libStatusText');
  const c = document.getElementById('libStatusCount');
  if (t) t.textContent = text;
  if (c) c.textContent = `${count} ITEMS`;
}

function updateStream(): void {
  const el = document.getElementById('libModalStream');
  if (!el) return;
  const hex = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');
  const msgs = ['卡带读取中', '图鉴已同步', '存档校验 OK', '翻页完成', '像素对齐'];
  const msg = msgs[Math.floor(Math.random() * msgs.length)];
  el.textContent = `0x${hex} · ${msg}`;
}

function openDetail(book: SciFiBookData): void {
  const modal = document.getElementById('libModal');
  const body = document.getElementById('libModalBody');
  if (!modal || !body) return;

  const links = (
    book.links?.length
      ? book.links
      : book.link
        ? [{ label: '外链节点', url: book.link }]
        : []
  )
    .map(
      (l) =>
        `<a class="lib-scifi-detail-link" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label || '外链')} »</a>`,
    )
    .join('');

  body.innerHTML =
    `<div class="lib-scifi-detail-icon" aria-hidden="true">${book.icon}</div>` +
    `<p class="lib-scifi-detail-kicker">${escapeHtml(book.categoryLabel)} · ${escapeHtml(book.statusLabel)}</p>` +
    `<h2 class="lib-scifi-detail-title" id="libModalTitle">${escapeHtml(book.title)}</h2>` +
    `<p class="lib-scifi-detail-author">${escapeHtml(book.author)}</p>` +
    `<div class="lib-scifi-detail-grid">` +
    `<div class="lib-scifi-detail-stat"><span class="label">编号</span><span class="value">${escapeHtml(book.id)}</span></div>` +
    `<div class="lib-scifi-detail-stat"><span class="label">体积</span><span class="value">${escapeHtml(book.size)}</span></div>` +
    `<div class="lib-scifi-detail-stat"><span class="label">日期</span><span class="value">${escapeHtml(book.date)}</span></div>` +
    (book.genre
      ? `<div class="lib-scifi-detail-stat"><span class="label">标签</span><span class="value">${escapeHtml(book.genre)}</span></div>`
      : '') +
    (book.ratingLabel
      ? `<div class="lib-scifi-detail-stat"><span class="label">评级</span><span class="value">${escapeHtml(book.ratingLabel)}</span></div>`
      : '') +
    `</div>` +
    `<section class="lib-scifi-detail-section"><h3>简介</h3>${paragraphs(book.content)}</section>` +
    (book.thoughts
      ? `<section class="lib-scifi-detail-section"><h3>笔记</h3>${paragraphs(book.thoughts)}</section>`
      : '') +
    (book.quotes?.length
      ? `<section class="lib-scifi-detail-section"><h3>摘句</h3><ul>${book.quotes
          .map((q) => `<li>${escapeHtml(q)}</li>`)
          .join('')}</ul></section>`
      : '') +
    (book.takeaways?.length
      ? `<section class="lib-scifi-detail-section"><h3>收获</h3><ul>${book.takeaways
          .map((t) => `<li>${escapeHtml(t)}</li>`)
          .join('')}</ul></section>`
      : '') +
    (links ? `<div class="lib-scifi-detail-links">${links}</div>` : '');

  modal.hidden = false;
  updateStream();
  window.clearInterval(streamTimer);
  streamTimer = window.setInterval(updateStream, 1600);
  sceneApi?.noteActivity();
}

function closeDetail(): void {
  const modal = document.getElementById('libModal');
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  window.clearInterval(streamTimer);
  sceneApi?.releaseFocus();
  sceneApi?.noteActivity();
}

async function switchCategory(cat: LibraryCategory): Promise<void> {
  if (!sceneApi) return;
  if (navLock) return;
  // 允许重复点「全部」以重新召唤阵列
  if (cat === activeCat && cat !== 'all' && sceneApi.getCategory() === cat) return;
  navLock = true;
  activeCat = cat;
  renderCats();
  window.setTimeout(() => {
    navLock = false;
    renderCats();
  }, 260);
  setStatus('…', 0);
  await sceneApi.setCategory(cat);
}

function bindUi(): void {
  document.getElementById('libCats')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.lib-scifi-cat');
    if (!btn?.dataset.cat) return;
    void switchCategory(btn.dataset.cat as LibraryCategory);
  });

  document.getElementById('libModalClose')?.addEventListener('click', closeDetail);
  document.getElementById('libModalBackdrop')?.addEventListener('click', closeDetail);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('libModal');
      if (modal && !modal.hidden) closeDetail();
      else sceneApi?.releaseFocus();
    }
  });
}

export async function mount(_ctx: HubContext): Promise<void> {
  const boot = document.getElementById('bootError');
  document.documentElement.classList.add('lib-scifi-html', 'dark');
  document.body.classList.add('lib-scifi-page', 'dark');
  document.body.classList.add('starport-facility', 'starport-library');

  try {
    const data = await loadLibraryPage();
    const page = data.page;
    const site = data.site;
    mountHomeBackground(site);
    document.title = `${page.title || '像素馆藏'} · ${site.name || 'ASKUARY'}`;
    document.body.classList.add('pixel-hub', 'starport-content');
    mountPixelNav({
      title: page.title || '馆藏',
      midHtml: `<nav class="lib-scifi-cats" id="libCats" aria-label="馆藏分类"></nav>`,
      widgets: { weather: site.weather, themeDefault: 'auto' },
    });

    const books = (data.library.items || []).map(toSciFiBook);
    const canvas = document.getElementById('libScene') as HTMLCanvasElement | null;
    const starsCanvas = document.getElementById('libStars') as HTMLCanvasElement | null;
    if (!canvas) throw new Error('缺少场景画布');

    renderCats();
    bindUi();
    await mountLegalFooter(document.getElementById('libLegal'), site.name);

    // 与宇宙页同源：分层闪烁星空 + 星云 + 流星
    if (starsCanvas) {
      starfield = new Starfield(starsCanvas, () => {});
      starfield.setNavStars([]);
      starfield.setMeteorWords(data.meteorWords || []);
      starfield.start();
    }

    if (!books.length) {
      setStatus(page.empty || '图鉴里还没有卡带', 0);
      return;
    }

    sceneApi = createLibraryScene({
      canvas,
      books,
      onOpenDetail: openDetail,
      onStatus: (text, count, cat) => {
        activeCat = cat;
        setStatus(text, count);
        renderCats();
      },
    });

    setStatus('PIXEL ARCHIVE', books.length);

    pageCleanups.push(() => {
      sceneApi?.dispose();
      sceneApi = null;
      starfield?.stop();
      starfield = null;
      window.clearInterval(streamTimer);
      document.documentElement.classList.remove('lib-scifi-html', 'dark');
      document.body.classList.remove('lib-scifi-page', 'dark', 'pixel-hub', 'starport-content');
    });
  } catch (err) {
    console.error(err);
    if (boot) {
      boot.hidden = false;
      boot.textContent = err instanceof Error ? err.message : String(err);
    }
  }
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
