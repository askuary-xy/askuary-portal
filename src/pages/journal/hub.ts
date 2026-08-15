import '../../styles/home.css';
import '../../styles/comments.css';
import '../../styles/article-rich.css';
import '../../styles/article-shell.css';
import '../../styles/pixel-hub.css';
import '../../styles/content-starport.css';
import { loadCommentsConfig, loadHomePage, loadJournalPostPage } from '../../config/loader';
import { mountLegalFooter } from '../../ui/mount-legal';
import { mountComments } from '../../ui/mount-comments';
import { mountArticlePlugins } from '../../ui/mount-article-plugins';
import { mountReadingJourney } from '../../ui/mount-reading-journey';
import { mountPixelNav } from '../../ui/mount-pixel-nav';
import {
  mountAiCard,
  renderAiCard,
  renderCoverHero,
  renderReadShell,
} from '../../ui/article-shell';
import { sitePath } from '../../utils/site-path';
import { commentPathFor, resolveJournalBack } from '../../utils/content';
import { postCoverSrc } from '../../utils/post-cover';
import {
  escapeHtml,
  formatDate,
  renderHomeShell,
} from '../home/shared';
import type { JournalPost } from '../../types/config';
import type { HubContext } from '../../ui/hub-types';

let pageCleanups: Array<() => void> = [];

function resolveSlug(url: URL = new URL(location.href)): string {
  const fromQuery = url.searchParams.get('slug')?.trim();
  if (fromQuery) {
    try {
      return decodeURIComponent(fromQuery);
    } catch {
      return fromQuery;
    }
  }
  const fromDataset = document.body.dataset.postSlug?.trim();
  if (fromDataset) return fromDataset;
  const path = url.pathname.replace(/\/index\.html$/i, '/');
  const match = path.match(/\/journal\/([^/]+)\/?$/);
  if (match?.[1] && match[1] !== 'view') {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return '';
}

function estimateReading(html: string): { chars: number; minutes: number } {
  const text = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, '');
  const chars = text.length;
  const minutes = Math.max(1, Math.round(chars / 400));
  return { chars, minutes };
}

function relatedHrefFor(post: JournalPost): string {
  const tag = post.tags?.[0];
  if (tag) {
    return sitePath(`/archive/?tag=${encodeURIComponent(tag)}`);
  }
  return sitePath('/archive/');
}

/** 英文侧像歌词/句子，而不是 toSound、Freesound 这类品牌词 */
function isLikelyLyricEnglish(en: string): boolean {
  const t = en.trim();
  if (t.length < 8) return false;
  if (!/[A-Za-z]{2,}/.test(t)) return false;
  // 无空格的短词/驼峰品牌名（toSound、Looperman）不当歌词
  if (!/\s/.test(t)) return false;
  // 纯 URL / 域名
  if (/^https?:\/\//i.test(t) || /\.[a-z]{2,}(\/|$)/i.test(t)) return false;
  return true;
}

/** 尝试把「英文+中文」歌词行拆成双栏 */
function splitBilingualLine(text: string): { en: string; zh: string } | null {
  const raw = text.trim();
  if (!raw || raw.length < 8) return null;
  const m = raw.match(/^([\x20-\x7E].*?[.!?,;:'"”)\]…]?)\s*([\u4e00-\u9fff][\u4e00-\u9fff\s，。！？、；：""''…—·]*)$/);
  if (!m) return null;
  const en = m[1].trim();
  const zh = m[2].trim();
  if (!isLikelyLyricEnglish(en) || zh.length < 2) return null;
  return { en, zh };
}

function extractBilingualPairs(text: string): { en: string; zh: string }[] {
  const raw = text.replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  const pairs: { en: string; zh: string }[] = [];
  const re =
    /([A-Za-z][\x20-\x7E]*?[.!?,;:'"”)\]…]?)\s*([\u4e00-\u9fff][^A-Za-z]{1,80}?)(?=\s*[A-Za-z]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const en = m[1].trim();
    const zh = m[2].trim().replace(/[，。！？、；：\s]+$/u, '');
    if (isLikelyLyricEnglish(en) && zh.length >= 2) pairs.push({ en, zh });
  }
  return pairs;
}

function canEnhanceAsLyric(node: HTMLElement): boolean {
  // 含媒体/链接/表格时绝不能拆成歌词栏，否则会丢掉图片或拆坏正文
  return !node.querySelector('img, audio, video, picture, table, pre, code, a, iframe, object, embed');
}

function isPluginBlock(el: HTMLElement): boolean {
  return (
    el.classList.contains('ask-note') ||
    el.classList.contains('ask-fold') ||
    el.classList.contains('ask-tabs') ||
    el.tagName === 'DETAILS'
  );
}

function enhanceProseHtml(html: string): string {
  const wrap = document.createElement('div');
  wrap.innerHTML = html || '';

  const blocks = [...wrap.childNodes];
  const out: string[] = [];

  for (const node of blocks) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || '').trim();
      if (t) out.push(`<div class="home-prose-block" data-reveal><p>${escapeHtml(t)}</p></div>`);
      continue;
    }
    if (!(node instanceof HTMLElement)) continue;

    if (node.tagName === 'HR') {
      out.push(`<div class="home-prose-sep" aria-hidden="true">🌸 · ✦ · 🌙</div>`);
      continue;
    }

    if (isPluginBlock(node)) {
      out.push(`<div class="home-prose-block" data-reveal>${node.outerHTML}</div>`);
      continue;
    }

    if (node.tagName === 'P' && canEnhanceAsLyric(node)) {
      const text = node.textContent || '';
      let pairs = extractBilingualPairs(text);
      if (pairs.length < 2) {
        const lines = (node.innerHTML || '')
          .split(/<br\s*\/?>/i)
          .map((s) => s.replace(/<[^>]+>/g, '').trim())
          .filter(Boolean);
        const fromLines = lines
          .map(splitBilingualLine)
          .filter(Boolean) as { en: string; zh: string }[];
        if (fromLines.length > pairs.length) pairs = fromLines;
      }
      const asLyric =
        pairs.length >= 2 || (pairs.length === 1 && text.length < 120 && !!splitBilingualLine(text));
      if (asLyric) {
        out.push(
          `<div class="home-prose-block home-prose-block--lyric" data-reveal>` +
            pairs
              .map(
                (pair) =>
                  `<div class="home-lyric-pair">` +
                  `<div class="home-lyric-en">${escapeHtml(pair.en)}</div>` +
                  `<div class="home-lyric-zh">${escapeHtml(pair.zh)}</div>` +
                  `</div>`,
              )
              .join('') +
            `</div>`,
        );
        continue;
      }
    }

    out.push(`<div class="home-prose-block" data-reveal>${node.outerHTML}</div>`);
  }

  return out.join('') || `<div class="home-prose-block" data-reveal><p></p></div>`;
}

function bindReveal(root: ParentNode): void {
  const nodes = root.querySelectorAll<HTMLElement>('[data-reveal]');
  if (!nodes.length) return;
  if (!('IntersectionObserver' in window)) {
    nodes.forEach((n) => n.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const ent of entries) {
        if (ent.isIntersecting) {
          (ent.target as HTMLElement).classList.add('is-visible');
          io.unobserve(ent.target);
        }
      }
    },
    { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
  );
  nodes.forEach((n) => io.observe(n));
}

function mountArticleParticles(canvas: HTMLCanvasElement | null, romantic: boolean): () => void {
  if (!canvas) return () => undefined;
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => undefined;

  type P = { x: number; y: number; r: number; a: number; vx: number; vy: number; tw: number; kind: number };
  let particles: P[] = [];
  let raf = 0;

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const n = Math.min(56, Math.floor((canvas.width * canvas.height) / 20000));
    particles = Array.from({ length: n }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.8 + 0.4,
      a: Math.random() * 0.35 + 0.12,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22 - 0.04,
      tw: Math.random() * Math.PI * 2,
      kind: romantic ? Math.floor(Math.random() * 3) : 0,
    }));
  };

  const drawHeart = (x: number, y: number, s: number, alpha: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s / 10, s / 10);
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.bezierCurveTo(-8, -4, -8, -12, 0, -8);
    ctx.bezierCurveTo(8, -12, 8, -4, 0, 3);
    ctx.fillStyle = `rgba(255, 120, 170, ${alpha})`;
    ctx.fill();
    ctx.restore();
  };

  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.tw += 0.02;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      const alpha = p.a * (0.65 + 0.35 * Math.sin(p.tw));
      if (p.kind === 1) {
        drawHeart(p.x, p.y, p.r * 7, alpha);
      } else if (p.kind === 2) {
        ctx.fillStyle = `rgba(167, 139, 250, ${alpha})`;
        ctx.font = `${10 + p.r * 4}px serif`;
        ctx.fillText('♪', p.x, p.y);
      } else {
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    raf = requestAnimationFrame(tick);
  };

  resize();
  tick();
  window.addEventListener('resize', resize);
  const onVis = () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else raf = requestAnimationFrame(tick);
  };
  document.addEventListener('visibilitychange', onVis);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVis);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
}

function mountReadingProgress(): () => void {
  let bar = document.querySelector('.home-read-progress') as HTMLElement | null;
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'home-read-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.prepend(bar);
  }
  const onScroll = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const p = max > 0 ? (window.scrollY / max) * 100 : 0;
    bar!.style.width = `${Math.min(100, Math.max(0, p))}%`;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  return () => {
    window.removeEventListener('scroll', onScroll);
    bar?.remove();
  };
}

function bindArticleKeys(backHref: string): () => void {
  const onKey = (ev: KeyboardEvent) => {
    const tag = (ev.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (ev.target as HTMLElement)?.isContentEditable) return;
    if (ev.key === 'ArrowLeft') {
      void import('../../ui/soft-nav').then((m) => m.softNavigate(backHref));
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (ev.key === 'r' || ev.key === 'R') {
      ev.preventDefault();
      void (async () => {
        try {
          const res = await fetch(sitePath('/data/archive-index.json'), { cache: 'no-store' });
          if (!res.ok) throw new Error('no archive');
          const data = await res.json();
          const entries = (data.entries || []) as { path: string }[];
          if (!entries.length) {
            void import('../../ui/soft-nav').then((m) => m.softNavigate(sitePath('/archive/')));
            return;
          }
          const pick = entries[Math.floor(Math.random() * entries.length)];
          void import('../../ui/soft-nav').then((m) => m.softNavigate(sitePath(pick.path)));
        } catch {
          void import('../../ui/soft-nav').then((m) => m.softNavigate(sitePath('/archive/')));
        }
      })();
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}

export async function mount(ctx: HubContext): Promise<void> {
  const slug = resolveSlug(ctx.url);
  if (!slug) throw new Error('missing journal slug');

  document.body.dataset.postSlug = slug;
  const [{ post, site }, homeData, comments] = await Promise.all([
    loadJournalPostPage(slug),
    loadHomePage().catch(() => null),
    loadCommentsConfig(),
  ]);

  const shell = document.getElementById('homeShell');
  if (!shell) return;

  document.body.classList.add('ask-read-page', 'pixel-hub', 'starport-content', 'starport-journal');
  document.title = `${post.title} · ${site.name}`;

  let descEl = document.querySelector('meta[name="description"]');
  if (!descEl) {
    descEl = document.createElement('meta');
    descEl.setAttribute('name', 'description');
    document.head.appendChild(descEl);
  }
  descEl.setAttribute('content', post.summary || post.title);

  if (!document.querySelector('link[href*="fonts.googleapis.com"]')) {
    const l1 = document.createElement('link');
    l1.rel = 'preconnect';
    l1.href = 'https://fonts.googleapis.com';
    document.head.appendChild(l1);
    const l2 = document.createElement('link');
    l2.rel = 'preconnect';
    l2.href = 'https://fonts.gstatic.com';
    l2.crossOrigin = 'anonymous';
    document.head.appendChild(l2);
  }

  const back = resolveJournalBack(post);
  const reading = estimateReading(post.html || post.summary || '');
  const romantic =
    /对照|歌词|歌|love|heart|浪漫|music|just like this|beauty/i.test(
      `${post.title} ${(post.tags || []).join(' ')} ${post.summary || ''}`,
    );

  const coverUrl = postCoverSrc(post, site, 'journal');
  const proseInner = enhanceProseHtml(post.html || '');
  const aiText =
    post.showAiSummary === false ? '' : (post.aiSummary || post.summary || '').trim();

  const heroHtml = renderCoverHero({
    coverUrl,
    title: post.title,
    tags: post.tags || [],
    metas: [
      ...(post.date ? [{ label: '发布', value: formatDate(post.date) }] : []),
      { label: '阅读', value: `约 ${reading.minutes} 分钟` },
      { label: '字数', value: `${reading.chars}` },
    ],
    back: { href: sitePath(back.href), label: back.label },
  });

  const cardInner =
    renderAiCard({
      summary: aiText,
      selfIntro: post.aiSelfIntro || '',
      brand: site.name,
      siteIntro: site.intro || site.authorBio || homeData?.site.intro || '',
      relatedHref: relatedHrefFor(post),
      homeHref: sitePath('/home/'),
    }) +
    `<div class="home-prose-shell"><div class="home-prose">${proseInner}</div></div>`;

  const articleHtml = renderReadShell({
    heroHtml,
    cardInnerHtml: cardInner,
    commentsHtml: `<section class="fp-friend-comments home-comments" id="postComments" aria-label="评论区"></section>`,
  });

  shell.innerHTML = renderHomeShell({
    siteName: site.name,
    navHtml: '',
    mainHtml: articleHtml,
    backgroundUrl: '',
    footerHtml: `<div id="pageLegal"></div>`,
    withHeader: false,
  });

  mountPixelNav({
    brand: site.name || 'ASKUARY',
    title: post.title || '故事',
    backHref: back.href,
    backLabel: back.label.replace(/^←\s*/, '← '),
    widgets: {
      weather: site.weather || homeData?.site.weather,
      themeDefault: homeData?.page.themeDefault || 'auto',
    },
    petLines: homeData?.page.petLines || homeData?.page.waveLines,
  });

  if (!document.querySelector('.home-article-deco')) {
    const deco = document.createElement('div');
    deco.className = 'home-article-deco';
    deco.setAttribute('aria-hidden', 'true');
    deco.innerHTML = '<span>✦</span><span>☁</span><span>♪</span><span>✧</span><span>🌸</span>';
    document.body.appendChild(deco);
  }
  let canvas = document.querySelector('.home-particle-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'home-particle-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
  }
  pageCleanups.push(mountArticleParticles(canvas, romantic));
  pageCleanups.push(mountReadingProgress());
  bindReveal(shell);
  pageCleanups.push(bindArticleKeys(sitePath(back.href)));
  mountArticlePlugins(shell);
  mountAiCard(shell);
  mountReadingJourney(shell);

  const apiBase = site.apiBase || homeData?.site.apiBase;
  mountComments(
    document.getElementById('postComments'),
    comments,
    apiBase,
    commentPathFor('journal', slug),
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
  document.querySelector('.home-article-deco')?.remove();
  document.querySelector('.home-particle-canvas')?.remove();
  document.querySelector('.home-read-progress')?.remove();
  document.body.classList.remove('ask-read-page', 'starport-content', 'starport-journal');
  delete document.body.dataset.postSlug;
}
