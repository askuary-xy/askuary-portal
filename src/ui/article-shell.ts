import '../styles/article-shell.css';
import { escapeHtml } from '../utils/html';
import { sitePath } from '../utils/site-path';

export type AskHeroMeta = { label: string; value: string };

export type AskCoverHeroOptions = {
  coverUrl: string;
  title: string;
  titleId?: string;
  kicker?: string;
  tags?: string[];
  metas?: AskHeroMeta[];
  back?: { href: string; label: string };
};

export type AskAiCardOptions = {
  summary: string;
  /** 结合本文的自我介绍 */
  selfIntro?: string;
  brand?: string;
  siteIntro?: string;
  relatedHref?: string;
  homeHref?: string;
};

const WAVE_SVG =
  `<svg class="ask-hero-wave-svg" viewBox="0 0 1440 64" preserveAspectRatio="none" aria-hidden="true">` +
  `<path fill="#ffffff" fill-opacity="0.96" d="M0,32 C240,64 480,0 720,24 C960,48 1200,64 1440,28 L1440,64 L0,64 Z"/>` +
  `</svg>`;

export function renderCoverHero(options: AskCoverHeroOptions): string {
  const cover = String(options.coverUrl || '').trim();
  const titleId = options.titleId || 'askHeroTitle';
  const tags = (options.tags || []).map((t) => String(t || '').trim()).filter(Boolean);
  const metas = (options.metas || []).filter((m) => String(m.value || '').trim());

  const media = cover
    ? `<div class="ask-hero-media"><img src="${escapeHtml(cover)}" alt="" decoding="async" fetchpriority="high" /></div>`
    : `<div class="ask-hero-media" aria-hidden="true"></div>`;

  const tagHtml = tags.length
    ? `<ul class="ask-hero-tags" aria-label="标签">` +
      tags.map((t) => `<li class="ask-hero-tag">#${escapeHtml(t)}</li>`).join('') +
      `</ul>`
    : '';

  const metaHtml = metas.length
    ? `<div class="ask-hero-meta">` +
      metas
        .map(
          (m) =>
            `<span class="ask-hero-meta-item">` +
            `<span class="ask-hero-meta-label">${escapeHtml(m.label)}</span>` +
            `<span>${escapeHtml(m.value)}</span>` +
            `</span>`,
        )
        .join('') +
      `</div>`
    : '';

  const back = options.back
    ? `<a class="page-back ask-hero-back" href="${escapeHtml(options.back.href)}">${escapeHtml(options.back.label)}</a>`
    : '';

  return (
    `<header class="ask-hero" aria-labelledby="${escapeHtml(titleId)}">` +
    media +
    `<div class="ask-hero-veil" aria-hidden="true"></div>` +
    `<div class="ask-hero-inner">` +
    back +
    (options.kicker ? `<p class="ask-hero-kicker">${escapeHtml(options.kicker)}</p>` : '') +
    tagHtml +
    `<h1 class="ask-hero-title" id="${escapeHtml(titleId)}">${escapeHtml(options.title)}</h1>` +
    metaHtml +
    `</div>` +
    `<div class="ask-hero-wave">${WAVE_SVG}</div>` +
    `</header>`
  );
}

function payloadScript(id: string, value: string): string {
  return `<script type="application/json" data-ask-ai-payload="${escapeHtml(id)}">${JSON.stringify(String(value || '').trim())}</script>`;
}

export function renderAiCard(options: AskAiCardOptions): string {
  const summary = String(options.summary || '').trim();
  if (!summary) return '';

  const brand = String(options.brand || 'ASKUARY').trim() || 'ASKUARY';
  const homeHref = options.homeHref || sitePath('/home/');
  const relatedHref = options.relatedHref || sitePath('/archive/');
  const selfIntro = String(options.selfIntro || '').trim();
  const siteIntro = String(options.siteIntro || '').trim();

  return (
    `<aside class="ask-ai-card" data-ask-ai aria-label="AI 摘要">` +
    `<div class="ask-ai-head">` +
    `<span class="ask-ai-badge" aria-hidden="true">✦</span>` +
    `<div>` +
    `<h2 class="ask-ai-title">AI 摘要</h2>` +
    `<p class="ask-ai-sub">${escapeHtml(brand)} Signal · 随文生成</p>` +
    `</div></div>` +
    `<p class="ask-ai-body" data-ask-ai-body>${escapeHtml(summary)}</p>` +
    `<div class="ask-ai-panel" data-ask-ai-panel hidden></div>` +
    `<div class="ask-ai-actions">` +
    `<button type="button" class="ask-ai-btn" data-ask-ai-action="intro">介绍自己</button>` +
    `<button type="button" class="ask-ai-btn" data-ask-ai-action="brief">本文简介</button>` +
    `<a class="ask-ai-btn" data-ask-ai-action="related" href="${escapeHtml(relatedHref)}">相关推荐</a>` +
    `<a class="ask-ai-btn" data-ask-ai-action="home" href="${escapeHtml(homeHref)}">回主页</a>` +
    `</div>` +
    payloadScript('summary', summary) +
    payloadScript('selfIntro', selfIntro) +
    payloadScript('siteIntro', siteIntro) +
    `</aside>`
  );
}

function readPayload(card: HTMLElement, id: string): string {
  const node = card.querySelector(`[data-ask-ai-payload="${id}"]`);
  if (!node?.textContent) return '';
  try {
    return String(JSON.parse(node.textContent) || '').trim();
  } catch {
    return '';
  }
}

function setActiveAction(card: HTMLElement, action: string | null): void {
  card.querySelectorAll<HTMLElement>('[data-ask-ai-action]').forEach((el) => {
    if (el.tagName === 'A') return;
    el.classList.toggle('is-active', Boolean(action) && el.dataset.askAiAction === action);
  });
}

function showPanel(card: HTMLElement, panel: HTMLElement, mode: string, html: string): void {
  const showing = !panel.hidden && panel.dataset.mode === mode;
  if (showing) {
    panel.hidden = true;
    panel.dataset.mode = '';
    panel.innerHTML = '';
    setActiveAction(card, null);
    return;
  }
  panel.hidden = false;
  panel.dataset.mode = mode;
  panel.innerHTML = html;
  setActiveAction(card, mode);
}

export function mountAiCard(root: ParentNode | null): void {
  if (!root) return;
  root.querySelectorAll<HTMLElement>('[data-ask-ai]').forEach((card) => {
    const panel = card.querySelector<HTMLElement>('[data-ask-ai-panel]');
    if (!panel) return;

    const summary = readPayload(card, 'summary');
    const selfIntro = readPayload(card, 'selfIntro');
    const siteIntro = readPayload(card, 'siteIntro');

    card.querySelector<HTMLButtonElement>('[data-ask-ai-action="intro"]')?.addEventListener('click', () => {
      const text =
        selfIntro ||
        siteIntro ||
        '我是 ASKUARY 的阅读小助手。每篇文章都会生成不一样的自我介绍，先慢慢读正文吧。';
      showPanel(card, panel, 'intro', `<p class="ask-ai-panel-title">介绍自己</p><p>${escapeHtml(text)}</p>`);
    });

    card.querySelector<HTMLButtonElement>('[data-ask-ai-action="brief"]')?.addEventListener('click', () => {
      const text = summary || '还没有简介。发布文章时会自动拉取一次 AI 摘要。';
      showPanel(
        card,
        panel,
        'brief',
        `<p class="ask-ai-panel-title">本文简介</p><p>${escapeHtml(text)}</p>`,
      );
      card.classList.add('is-expanded');
    });
  });
}

export function renderReadShell(options: {
  heroHtml: string;
  cardInnerHtml: string;
  commentsHtml?: string;
  footerHtml?: string;
  mainClass?: string;
}): string {
  return (
    `<div class="ask-read-shell ${escapeHtml(options.mainClass || '')}">` +
    options.heroHtml +
    `<div class="ask-read-main">` +
    `<div class="ask-read-card">${options.cardInnerHtml}</div>` +
    (options.commentsHtml
      ? `<div class="ask-read-comments">${options.commentsHtml}</div>`
      : '') +
    (options.footerHtml || '') +
    `</div></div>`
  );
}
