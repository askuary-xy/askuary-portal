import '../../styles/home-hub.css';
import '../../styles/about.css';
import '../../styles/blog.css';
import '../../styles/archive-rich.css';
import '../../styles/pixel-hub.css';
import '../../styles/content-starport.css';
import { loadArchivePage } from '../../config/loader';
import { sitePath } from '../../utils/site-path';
import { mountPixelNav } from '../../ui/mount-pixel-nav';
import { mountLegalFooter } from '../../ui/mount-legal';
import { inferCoverKind, postCoverSrc } from '../../utils/post-cover';
import type { SiteConfig } from '../../types/config';
import { escapeHtml, formatDate, renderFooterLinks } from '../blog/shared';
import { detectSeason, mountMemoryStars } from '../photos/memory-stars';
import '../../styles/legal.css';
import '../../styles/site-widgets.css';
import '../../styles/pixel-pet.css';

import type { HubContext } from '../../ui/hub-types';

let pageCleanups: Array<() => void> = [];

const LINK_ICONS: Record<string, string> = {
  github: '⌘',
  email: '✉',
  link: '🔗',
};

const SOURCE_LABELS: Record<string, string> = {
  blog: '宇宙·博客',
  journal: '站点主页',
};

/** 筛选栏展示顺序（含「测试」；无数据时点击显示空态） */
const PREFERRED_TAGS = ['测试', '交互', '门户', '随笔', '碎念'];

const PAGE_SIZE = 9;
const PAGE_STEP = 6;

type ArchiveEntry = {
  slug: string;
  title: string;
  date: string;
  summary?: string;
  tags?: string[];
  cover?: string;
  source: string;
  path: string;
};

const state = {
  all: [] as ArchiveEntry[],
  filtered: [] as ArchiveEntry[],
  view: 'cards' as 'cards' | 'timeline',
  visibleCount: PAGE_SIZE,
  activeTag: '',
  site: null as SiteConfig | null,
};

function entryCover(entry: ArchiveEntry): string {
  if (!state.site) return '';
  const kind = inferCoverKind(
    { tags: entry.tags, kind: entry.source === 'blog' ? 'blog' : 'journal' },
    entry.source === 'blog' ? 'blog' : 'journal',
  );
  return postCoverSrc(
    { slug: entry.slug, cover: entry.cover, tags: entry.tags, kind },
    state.site,
    kind,
  );
}

function getActiveTag(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('tag')?.trim() || '';
}

function monthKey(date: string): string {
  const d = parseDate(date);
  if (!d) return 'unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function parseDate(date: string): Date | null {
  if (!date) return null;
  // 兼容 YYYY-MM-DD
  const iso = date.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const d = new Date(`${iso}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${y}年${Number(m)}月`;
}

function seasonIcon(month: number): string {
  if (month >= 3 && month <= 5) return '🌸';
  if (month >= 6 && month <= 8) return '☀️';
  if (month >= 9 && month <= 11) return '🍂';
  return '❄️';
}

function spanMonths(entries: ArchiveEntry[]): number {
  const keys = new Set(entries.map((e) => monthKey(e.date)).filter((k) => k !== 'unknown'));
  return Math.max(keys.size, entries.length ? 1 : 0);
}

function isFeatured(_entry: ArchiveEntry, index: number): boolean {
  // 仅首卡大图，避免多个 span 打乱三列瀑布流
  return index === 0;
}

function renderTagFilters(tags: string[], activeTag: string): string {
  const allActive = !activeTag;
  let html = `<a class="fp-archive-tag${allActive ? ' is-active' : ''}" href="${escapeHtml(sitePath('/archive/'))}">全部</a>`;
  for (const tag of tags) {
    const isActive = tag === activeTag;
    const href = sitePath(`/archive/?tag=${encodeURIComponent(tag)}`);
    html += `<a class="fp-archive-tag${isActive ? ' is-active' : ''}" href="${escapeHtml(href)}">${escapeHtml(tag)}</a>`;
  }
  return html;
}

function renderCard(entry: ArchiveEntry, featured: boolean): string {
  const href = sitePath(entry.path);
  const sourceLabel = SOURCE_LABELS[entry.source] || entry.source;
  const sourceCls = entry.source === 'blog' ? ' is-blog' : '';
  const cover = entryCover(entry);
  const tags = entry.tags?.length
    ? `<ul class="archive-card-tags">${entry.tags.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`
    : '';
  return (
    `<a class="archive-card${featured ? ' is-featured' : ''}" href="${escapeHtml(href)}" data-reveal>` +
    `<div class="archive-card-cover" aria-hidden="true">` +
    (cover
      ? `<img src="${escapeHtml(cover)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()" />`
      : '') +
    `<span class="archive-card-shine"></span>` +
    `</div>` +
    `<div class="archive-card-body">` +
    `<span class="archive-card-source${sourceCls}">${escapeHtml(sourceLabel)}</span>` +
    `<time class="archive-card-date" datetime="${escapeHtml(entry.date)}">${escapeHtml(formatDate(entry.date))}</time>` +
    `<h2 class="archive-card-title">${escapeHtml(entry.title)}</h2>` +
    (entry.summary ? `<p class="archive-card-summary">${escapeHtml(entry.summary)}</p>` : '') +
    tags +
    `</div></a>`
  );
}

function renderCards(entries: ArchiveEntry[]): string {
  if (!entries.length) return '';
  return (
    `<div class="archive-masonry archive-list-fade">` +
    entries.map((e, i) => renderCard(e, isFeatured(e, i))).join('') +
    `</div>`
  );
}

function groupByMonth(entries: ArchiveEntry[]): { key: string; items: ArchiveEntry[] }[] {
  const map = new Map<string, ArchiveEntry[]>();
  for (const e of entries) {
    const key = monthKey(e.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => ({ key, items }));
}

function renderTimeline(entries: ArchiveEntry[]): string {
  if (!entries.length) return '';
  const groups = groupByMonth(entries);
  return (
    `<div class="archive-timeline archive-list-fade">` +
    groups
      .map((g) => {
        const month = Number(g.key.split('-')[1] || 1);
        const id = `month-${g.key}`;
        return (
          `<section class="archive-tl-block" id="${escapeHtml(id)}">` +
          `<aside class="archive-tl-side">` +
          `<div class="archive-tl-season" aria-hidden="true">${seasonIcon(month)}</div>` +
          `<p class="archive-tl-label">${escapeHtml(monthLabel(g.key))}</p>` +
          `<p class="archive-tl-count">${g.items.length} 篇</p>` +
          `</aside>` +
          `<div class="archive-tl-list">` +
          g.items
            .map((e) => {
              const href = sitePath(e.path);
              const sourceLabel = SOURCE_LABELS[e.source] || e.source;
              const cover = entryCover(e);
              return (
                `<a class="archive-tl-card${cover ? '' : ' is-no-cover'}" href="${escapeHtml(href)}" data-reveal>` +
                (cover
                  ? `<div class="archive-tl-cover"><img src="${escapeHtml(cover)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('is-empty');this.remove()" /></div>`
                  : '') +
                `<div class="archive-tl-card-body">` +
                `<h3>${escapeHtml(e.title)}</h3>` +
                (e.summary ? `<p>${escapeHtml(e.summary)}</p>` : '') +
                `<div class="archive-tl-meta">` +
                `<time datetime="${escapeHtml(e.date)}">${escapeHtml(formatDate(e.date))}</time>` +
                `<span>· ${escapeHtml(sourceLabel)}</span>` +
                ((e.tags || []).length ? `<span>· ${escapeHtml((e.tags || []).join(' / '))}</span>` : '') +
                `</div></div></a>`
              );
            })
            .join('') +
          `</div></section>`
        );
      })
      .join('') +
    `</div>`
  );
}

function renderMonthChips(entries: ArchiveEntry[]): string {
  const groups = groupByMonth(entries);
  if (!groups.length) return '';
  return groups
    .map((g) => {
      const month = Number(g.key.split('-')[1] || 1);
      return (
        `<button type="button" class="archive-month-chip" data-month="${escapeHtml(g.key)}">` +
        `${seasonIcon(month)} ${escapeHtml(monthLabel(g.key))}` +
        `</button>`
      );
    })
    .join('');
}

function bindReveal(root: ParentNode): void {
  const nodes = [...root.querySelectorAll<HTMLElement>('[data-reveal]')];
  if (!nodes.length) return;

  const show = (n: HTMLElement) => n.classList.add('is-visible');

  // 首屏立刻显示，避免 opacity:0 造成「有数据却一片空白」
  const revealNow = () => {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    for (const n of nodes) {
      const rect = n.getBoundingClientRect();
      if (rect.top < vh + 80 && rect.bottom > -40) show(n);
    }
  };
  revealNow();
  requestAnimationFrame(revealNow);

  if (!('IntersectionObserver' in window)) {
    nodes.forEach(show);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const ent of entries) {
        if (ent.isIntersecting) {
          show(ent.target as HTMLElement);
          io.unobserve(ent.target);
        }
      }
    },
    { threshold: 0.01, rootMargin: '80px 0px 80px 0px' },
  );
  nodes.forEach((n) => io.observe(n));

  // 兜底：滚动观察失败时也不留隐形卡片
  window.setTimeout(() => nodes.forEach(show), 600);
}

function updateStats(): void {
  const el = document.getElementById('archiveStats');
  if (!el) return;
  const n = state.filtered.length;
  const months = spanMonths(state.filtered);
  el.textContent = `📝 共 ${n} 篇文章 · 跨越 ${months} 个月`;
}

function updateLoadMore(): void {
  const btn = document.getElementById('archiveLoadMore') as HTMLButtonElement | null;
  if (!btn) return;
  if (state.view !== 'cards') {
    btn.hidden = true;
    return;
  }
  btn.hidden = state.visibleCount >= state.filtered.length;
}

function paintViews(): void {
  const cardView = document.getElementById('archiveCardView');
  const tlView = document.getElementById('archiveTimelineView');
  const emptyEl = document.getElementById('archiveEmpty');
  const slice = state.filtered.slice(0, state.visibleCount);

  if (cardView) {
    cardView.innerHTML = renderCards(slice);
    bindReveal(cardView);
  }
  if (tlView) {
    // 时间轴展示当前筛选的全部（按月分组更清晰）
    tlView.innerHTML = renderTimeline(state.filtered);
    bindReveal(tlView);
  }

  const showEmpty = !state.filtered.length;
  if (emptyEl) {
    emptyEl.hidden = !showEmpty;
  }
  updateLoadMore();
}

function setView(view: 'cards' | 'timeline'): void {
  if (state.view === view) return;
  const cardView = document.getElementById('archiveCardView');
  const tlView = document.getElementById('archiveTimelineView');
  const leaving = state.view === 'cards' ? cardView : tlView;
  const entering = view === 'cards' ? cardView : tlView;

  document.querySelectorAll('.archive-view-btn').forEach((btn) => {
    btn.classList.toggle('is-active', (btn as HTMLElement).dataset.view === view);
  });

  state.view = view;
  if (leaving) {
    leaving.classList.add('is-leaving');
  }
  window.setTimeout(() => {
    if (leaving) {
      leaving.hidden = true;
      leaving.classList.remove('is-active', 'is-leaving');
    }
    if (entering) {
      entering.hidden = false;
      entering.classList.add('is-active', 'is-entering');
      window.setTimeout(() => entering.classList.remove('is-entering'), 420);
    }
    updateLoadMore();
  }, 220);
}

function jumpToMonth(key: string): void {
  if (state.view !== 'timeline') setView('timeline');
  window.setTimeout(() => {
    const el = document.getElementById(`month-${key}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 280);
}

function randomJump(): void {
  const btn = document.getElementById('archiveRandomBtn');
  const pool = state.filtered.length ? state.filtered : state.all;
  if (!pool.length) return;
  btn?.classList.add('is-rolling');
  window.setTimeout(() => {
    btn?.classList.remove('is-rolling');
    const pick = pool[Math.floor(Math.random() * pool.length)];
    void import('../../ui/soft-nav').then((m) => m.softNavigate(sitePath(pick.path)));
  }, 600);
}

/** 柔和漂浮光点（叠在星空上） */
function mountSoftOrbs(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  // 星空已占用 canvas；改为在 atmosphere 上叠加 CSS 光点层
  const host = document.querySelector('.fp-atmosphere');
  if (!host || host.querySelector('.archive-soft-orbs')) return;
  const layer = document.createElement('div');
  layer.className = 'archive-soft-orbs';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = Array.from({ length: 8 }, (_, i) => {
    const size = 40 + (i % 4) * 28;
    const left = 8 + ((i * 13) % 84);
    const top = 10 + ((i * 19) % 70);
    const delay = (i * 1.4) % 8;
    return `<span style="width:${size}px;height:${size}px;left:${left}%;top:${top}%;animation-delay:-${delay}s"></span>`;
  }).join('');
  host.appendChild(layer);

  if (!document.getElementById('archiveSoftOrbStyle')) {
    const style = document.createElement('style');
    style.id = 'archiveSoftOrbStyle';
    style.textContent =
      `.archive-soft-orbs{position:absolute;inset:0;overflow:hidden;pointer-events:none}` +
      `.archive-soft-orbs span{position:absolute;border-radius:50%;` +
      `background:radial-gradient(circle,rgba(255,255,255,.55),rgba(255,183,197,.15) 45%,transparent 70%);` +
      `filter:blur(2px);animation:archiveOrb 14s ease-in-out infinite;opacity:.55}` +
      `@keyframes archiveOrb{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-24px) scale(1.08)}}`;
    document.head.appendChild(style);
  }
}

export async function mount(_ctx: HubContext): Promise<void> {
  document.body.classList.add('pixel-hub');
  const { page, site, archive } = await loadArchivePage();
  state.site = site;
  state.activeTag = getActiveTag();
  state.all = archive.entries || [];
  state.filtered = state.activeTag
    ? state.all.filter((e) => e.tags?.includes(state.activeTag))
    : state.all.slice();
  state.visibleCount = PAGE_SIZE;

  document.title = `${page.title} · ${site.name}`;
  mountPixelNav({
    brand: site.name || 'ASKUARY',
    title: page.title || '归档',
    backHref: '/home/',
    widgets: { weather: site.weather, themeDefault: 'auto' },
  });

  const titleEl = document.getElementById('archiveTitle');
  const leadEl = document.getElementById('archiveLead');
  const tagsEl = document.getElementById('archiveTags');
  const monthsEl = document.getElementById('archiveMonths');
  const emptyEl = document.getElementById('archiveEmpty');
  const linksEl = document.getElementById('archiveLinks');

  if (titleEl) titleEl.textContent = page.title || '归档';
  if (leadEl) {
    const lead = state.activeTag ? `标签：${state.activeTag}` : '';
    leadEl.textContent = lead;
    leadEl.hidden = !lead;
  }
  if (emptyEl) {
    emptyEl.textContent = state.activeTag
      ? page.emptyTag || '该标签下暂无文章。'
      : page.empty || '暂无文章';
  }

  // 标签：优先展示预设顺序，再补上数据中的其它标签
  const tagSet = new Set([...(archive.tags || []), ...PREFERRED_TAGS]);
  const ordered = [
    ...PREFERRED_TAGS.filter((t) => tagSet.has(t)),
    ...(archive.tags || []).filter((t) => !PREFERRED_TAGS.includes(t)),
  ];
  if (tagsEl) {
    tagsEl.hidden = false;
    tagsEl.innerHTML = renderTagFilters(ordered, state.activeTag);
  }

  if (monthsEl) {
    const chips = renderMonthChips(state.filtered.length ? state.filtered : state.all);
    monthsEl.hidden = !chips;
    monthsEl.innerHTML = chips;
  }

  updateStats();
  paintViews();

  document.getElementById('viewCardsBtn')?.addEventListener('click', () => setView('cards'));
  document.getElementById('viewTimelineBtn')?.addEventListener('click', () => setView('timeline'));
  document.getElementById('archiveRandomBtn')?.addEventListener('click', () => randomJump());
  document.getElementById('archiveLoadMore')?.addEventListener('click', () => {
    state.visibleCount += PAGE_STEP;
    paintViews();
  });

  monthsEl?.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement | null;
    const btn = t?.closest?.('[data-month]') as HTMLElement | null;
    if (!btn?.dataset.month) return;
    jumpToMonth(btn.dataset.month);
  });

  const canvas = document.getElementById('fpStars') as HTMLCanvasElement | null;
  pageCleanups.push(mountMemoryStars(canvas, detectSeason()));
  mountSoftOrbs(canvas);

  renderFooterLinks(linksEl, page.links, LINK_ICONS);
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
