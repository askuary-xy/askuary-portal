import '../../styles/universe.css';
import '../../styles/about.css';
import '../../styles/friends.css';
import '../../styles/pixel-subpage.css';
import '../../styles/pixel-hub.css';
import '../../styles/content-baseline.css';
import '../../styles/identity-starport.css';
import { Starfield } from '../../canvas/starfield';
import { loadFriendsPage } from '../../config/loader';
import { mountLegalFooter } from '../../ui/mount-legal';
import { mountPixelNav } from '../../ui/mount-pixel-nav';
import { mountComments } from '../../ui/mount-comments';
import { sitePath } from '../../utils/site-path';
import {
  checkFriendExists,
  fetchPublishedFriends,
  submitFriendApplication,
} from '../../api/friends-api';
import type {
  AboutLink,
  Friend,
  FriendsExchangeConfig,
  SiteConfig,
} from '../../types/config';
import { escapeHtml } from '../../utils/html';
import { socialIconHtml } from '../../ui/site-icons';

import type { HubContext } from '../../ui/hub-types';

let pageCleanups: Array<() => void> = [];

function escapeAttr(text: string): string {
  return escapeHtml(text);
}

function absoluteUrl(pathOrUrl: string, siteUrl?: string): string {
  const raw = String(pathOrUrl || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = String(siteUrl || 'https://www.askuary.cn').replace(/\/$/, '');
  return `${base}${raw.startsWith('/') ? raw : `/${raw}`}`;
}

function buildExchangeText(ex: FriendsExchangeConfig, site: SiteConfig): string {
  const name = ex.siteName || site.name;
  const url = ex.siteUrl || site.siteUrl || 'https://www.askuary.cn/';
  const desc = ex.description || site.intro;
  const avatar = absoluteUrl(ex.avatar || site.avatar || '/brand/avatar.png', site.siteUrl);
  const logo = absoluteUrl(ex.logo || site.logo || '/brand/logo.png', site.siteUrl);
  const screenshot = absoluteUrl(ex.screenshot || '/brand/site-shot.png', site.siteUrl);
  const email = ex.email?.trim() || '';
  const lines = [
    `我的名称: ${name}`,
    `网站地址: ${url}`,
    `描述: ${desc}`,
    `头像: ${avatar}`,
    `Logo: ${logo}`,
    `截图: ${screenshot}`,
  ];
  if (email) lines.push(`邮箱: ${email}`);
  return lines.join('\n');
}

function fillApplyPlaceholders(ex: FriendsExchangeConfig, site: SiteConfig): void {
  const form = document.getElementById('friendsApplyForm') as HTMLFormElement | null;
  if (!form) return;

  const name = ex.siteName || site.name;
  const url = ex.siteUrl || site.siteUrl || 'https://www.askuary.cn/';
  const desc = ex.description || site.intro || '点击光点，拾取记忆';
  const avatar = absoluteUrl(ex.avatar || site.avatar || '/brand/avatar.png', site.siteUrl);
  const screenshot = absoluteUrl(ex.screenshot || '/brand/site-shot.png', site.siteUrl);
  const email = ex.email?.trim() || '2274801095@qq.com';

  const setPh = (field: string, value: string) => {
    const input = form.elements.namedItem(field) as HTMLInputElement | null;
    if (input) input.placeholder = `例如：${value}`;
  };

  setPh('name', name);
  setPh('url', url);
  setPh('avatar', avatar);
  setPh('desc', desc);
  setPh('screenshot', screenshot);
  setPh('email', email);
}

function buildApplyFromForm(form: HTMLFormElement): string {
  const data = new FormData(form);
  const get = (key: string) => String(data.get(key) || '').trim();
  return [
    '【友联申请】',
    `网站名称: ${get('name')}`,
    `网站链接: ${get('url')}`,
    `Logo / 头像: ${get('avatar') || '（未填）'}`,
    `网站简介: ${get('desc')}`,
    `网站截图: ${get('screenshot') || '（未填）'}`,
    `联系邮箱: ${get('email') || '（未填）'}`,
    '已添加贵站友联: 是',
  ].join('\n');
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

function showToast(toastEl: HTMLElement | null, message: string): void {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.hidden = false;
  window.setTimeout(() => {
    toastEl.hidden = true;
  }, 1800);
}

function friendHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** 名牌列表项（刻意避开「截图顶栏 + 叠头像」的安知鱼式卡片） */
function renderFriendCard(friend: Friend): string {
  const avatar = friend.avatar?.trim()
    ? `<img class="fp-friend-rail-avatar" src="${escapeAttr(friend.avatar)}" alt="" width="44" height="44" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : `<span class="fp-friend-rail-dot" aria-hidden="true"></span>`;

  return (
    `<article class="fp-friend-rail-item" role="listitem">` +
    `<a class="fp-friend-rail-link" href="${escapeAttr(friend.url)}" target="_blank" rel="noopener noreferrer">` +
    avatar +
    `<div class="fp-friend-rail-body">` +
    `<h3 class="fp-friend-rail-name">${escapeHtml(friend.title)}</h3>` +
    (friend.text ? `<p class="fp-friend-rail-desc">${escapeHtml(friend.text)}</p>` : '') +
    `<span class="fp-friend-rail-host">${escapeHtml(friendHost(friend.url))}</span>` +
    `</div>` +
    `<span class="fp-friend-rail-go" aria-hidden="true">↗</span>` +
    `</a></article>`
  );
}

function scrollToApply(): void {
  const el = document.getElementById('friendsApply');
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 72;
  window.scrollTo({ top, behavior: 'smooth' });
}

function mountRequirements(
  requirements: string[],
  form: HTMLFormElement | null,
  warnEl: HTMLElement | null,
  boxEl: HTMLElement | null,
  listEl: HTMLElement | null,
): void {
  if (!boxEl || !listEl) return;

  if (!requirements.length) {
    boxEl.hidden = true;
    listEl.innerHTML = '';
    if (form) form.hidden = false;
    if (warnEl) warnEl.hidden = true;
    return;
  }

  boxEl.hidden = false;
  listEl.innerHTML = requirements
    .map((item, i) => {
      const n = Math.min(i + 1, 7);
      const dots = Array.from(
        { length: n },
        (_, k) => `<i class="fp-dball-star" style="--i:${k}" aria-hidden="true"></i>`,
      ).join('');
      return (
        `<li class="fp-friend-req-item" data-req="${i}">` +
        `<span class="fp-friend-req-index">${i + 1}</span>` +
        `<span class="fp-friend-req-text">${escapeHtml(item)}</span>` +
        `<div class="fp-friend-slide" data-unlocked="false" data-stars="${n}">` +
        `<div class="fp-friend-slide-fill" aria-hidden="true"></div>` +
        `<button type="button" class="fp-friend-dball" data-count="${n}" aria-label="确认第 ${i + 1} 条">` +
        `<span class="fp-dball-shine" aria-hidden="true"></span>` +
        `<span class="fp-dball-stars" data-count="${n}">${dots}</span>` +
        `</button>` +
        `</div></li>`
      );
    })
    .join('');

  const sync = () => {
    const slides = [...listEl.querySelectorAll<HTMLElement>('.fp-friend-slide')];
    const all = slides.length > 0 && slides.every((s) => s.dataset.unlocked === 'true');
    if (form) form.hidden = !all;
    if (warnEl) warnEl.hidden = all;
  };

  const bindSlide = (slide: HTMLElement) => {
    const star = slide.querySelector<HTMLButtonElement>('.fp-friend-dball');
    const fill = slide.querySelector<HTMLElement>('.fp-friend-slide-fill');
    if (!star || !fill) return;

    let dragging = false;
    let startX = 0;
    let startLeft = 0;
    let maxX = 0;

    const measure = () => {
      const pad = 3;
      maxX = Math.max(0, slide.clientWidth - star.offsetWidth - pad * 2);
      return pad;
    };

    const setProgress = (x: number, animate = false) => {
      const pad = measure();
      const clamped = Math.max(0, Math.min(maxX, x));
      const pct = maxX > 0 ? clamped / maxX : 0;
      star.style.transition = animate ? 'left 0.28s ease' : 'none';
      fill.style.transition = animate ? 'width 0.28s ease' : 'none';
      star.style.left = `${pad + clamped}px`;
      fill.style.width = `${pad + clamped + star.offsetWidth / 2}px`;
      return pct;
    };

    const unlock = () => {
      if (slide.dataset.unlocked === 'true') return;
      slide.dataset.unlocked = 'true';
      slide.classList.add('is-unlocked');
      star.setAttribute('aria-disabled', 'true');
      setProgress(maxX, true);
      sync();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (slide.dataset.unlocked === 'true') return;
      event.preventDefault();
      dragging = true;
      startX = event.clientX;
      const pad = measure();
      startLeft = (parseFloat(star.style.left) || pad) - pad;
      star.setPointerCapture(event.pointerId);
      slide.classList.add('is-dragging');
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const pct = setProgress(startLeft + (event.clientX - startX));
      if (pct >= 0.92) {
        dragging = false;
        slide.classList.remove('is-dragging');
        unlock();
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      slide.classList.remove('is-dragging');
      const pad = measure();
      const left = (parseFloat(star.style.left) || pad) - pad;
      const pct = maxX > 0 ? left / maxX : 0;
      if (pct >= 0.92) unlock();
      else setProgress(0, true);
      try {
        star.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    };

    star.addEventListener('pointerdown', onPointerDown);
    star.addEventListener('pointermove', onPointerMove);
    star.addEventListener('pointerup', onPointerUp);
    star.addEventListener('pointercancel', onPointerUp);
    setProgress(0);
  };

  listEl.querySelectorAll<HTMLElement>('.fp-friend-slide').forEach(bindSlide);
  sync();
}

function mountExchange(
  ex: FriendsExchangeConfig,
  site: SiteConfig,
  friends: Friend[],
  apiBase?: string,
): void {
  const titleEl = document.getElementById('friendsExchangeTitle');
  const subEl = document.getElementById('friendsExchangeSub');
  const mineEl = document.getElementById('friendsMine');
  const avatarEl = document.getElementById('friendsExchangeAvatar') as HTMLImageElement | null;
  const metaEl = document.getElementById('friendsExchangeMeta');
  const hintEl = document.getElementById('friendsExchangeHint');
  const reqsEl = document.getElementById('friendsExchangeReqs');
  const reqsBox = document.getElementById('friendsReqsBox');
  const reqsWarn = document.getElementById('friendsReqsWarn');
  const copyBtn = document.getElementById('friendsCopyBtn');
  const randomBtn = document.getElementById('friendsRandomBtn');
  const applyToggle = document.getElementById('friendsApplyToggle');
  const applyForm = document.getElementById('friendsApplyForm') as HTMLFormElement | null;
  const toastEl = document.getElementById('friendsCopyToast');

  const name = ex.siteName || site.name;
  const url = ex.siteUrl || site.siteUrl || 'https://www.askuary.cn/';
  const desc = ex.description || site.intro;
  const avatar = sitePath(ex.avatar || site.avatar || '/brand/avatar.png');
  const avatarAbs = absoluteUrl(ex.avatar || site.avatar || '/brand/avatar.png', site.siteUrl);
  const email = ex.email?.trim() || '';

  if (titleEl) titleEl.textContent = ex.title;
  if (subEl) {
    subEl.textContent = ex.subtitle || '';
    subEl.hidden = !ex.subtitle;
  }
  if (mineEl) mineEl.hidden = false;
  if (avatarEl) {
    avatarEl.src = avatar;
    avatarEl.alt = site.avatarAlt || `${name} 头像`;
  }
  if (metaEl) {
    metaEl.innerHTML =
      `<div><dt>名称</dt><dd>${escapeHtml(name)}</dd></div>` +
      `<div><dt>地址</dt><dd><a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></dd></div>` +
      `<div><dt>描述</dt><dd>${escapeHtml(desc)}</dd></div>` +
      `<div><dt>头像</dt><dd><a href="${escapeAttr(avatarAbs)}" target="_blank" rel="noopener noreferrer">${escapeHtml(avatarAbs)}</a></dd></div>` +
      (email
        ? `<div><dt>邮箱</dt><dd><a href="mailto:${escapeAttr(email)}">${escapeHtml(email)}</a></dd></div>`
        : '');
  }
  if (hintEl) {
    hintEl.textContent = ex.applyHint || '';
    hintEl.hidden = !ex.applyHint;
  }

  fillApplyPlaceholders(ex, site);
  mountRequirements(ex.requirements || [], applyForm, reqsWarn, reqsBox, reqsEl);

  copyBtn?.addEventListener('click', async () => {
    await copyText(buildExchangeText(ex, site));
    showToast(toastEl, '已复制我的友联');
  });

  randomBtn?.addEventListener('click', () => {
    if (!friends.length) {
      showToast(toastEl, '暂无友站可访问');
      return;
    }
    const pick = friends[Math.floor(Math.random() * friends.length)];
    window.open(pick.url, '_blank', 'noopener,noreferrer');
  });

  applyToggle?.addEventListener('click', (event) => {
    event.preventDefault();
    scrollToApply();
  });

  applyForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(applyForm);
    const get = (key: string) => String(data.get(key) || '').trim();
    const url = get('url');
    let type: 'new' | 'update' = 'new';
    if (apiBase?.trim() && url) {
      try {
        const check = await checkFriendExists(apiBase.trim(), url);
        type = check.suggestType;
      } catch {
        type = 'new';
      }
    }
    const payload = {
      name: get('name'),
      url,
      avatar: get('avatar') || undefined,
      description: get('desc') || undefined,
      screenshot: get('screenshot') || undefined,
      email: get('email') || undefined,
      type,
    };

    const submitBtn = applyForm.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement | null;
    if (submitBtn) submitBtn.disabled = true;

    try {
      if (apiBase?.trim()) {
        await submitFriendApplication(apiBase.trim(), payload);
        applyForm.reset();
        showToast(
          toastEl,
          type === 'update' ? '修改申请已提交，等待审核' : '申请已提交，等待审核',
        );
      } else {
        const text = buildApplyFromForm(applyForm);
        await copyText(text);
        const mail =
          ex.email?.trim() ||
          (ex.applyUrl?.startsWith('mailto:') ? ex.applyUrl.slice(7) : '');
        if (mail) {
          const href =
            `mailto:${encodeURIComponent(mail.split('?')[0])}` +
            `?subject=${encodeURIComponent('【友联申请】')}` +
            `&body=${encodeURIComponent(text)}`;
          window.location.href = href;
        }
        showToast(toastEl, mail ? '已复制并打开邮件（未配置 apiBase）' : '已复制申请内容（未配置 apiBase）');
      }
    } catch (err) {
      showToast(toastEl, String((err as Error).message || err));
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

export async function mount(_ctx: HubContext): Promise<void> {
  document.documentElement.classList.add('pixel-subpage');
  document.body.classList.add('pixel-hub', 'starport-content', 'starport-identity', 'starport-allies');
  const { page, site, friends, meteorWords, comments } = await loadFriendsPage();
  const apiBase = site.apiBase?.trim() || page.apiBase?.trim() || '';

  document.title = `友联 · ${site.name}`;
  mountPixelNav({
    brand: site.name || 'ASKUARY',
    title: page.title || '友联',
    backHref: '/',
    backLabel: '← 宇宙',
    widgets: { weather: site.weather, themeDefault: 'auto' },
  });

  const titleEl = document.getElementById('friendsTitle');
  const leadEl = document.getElementById('friendsLead');
  const gridEl = document.getElementById('friendsGrid');
  const emptyEl = document.getElementById('friendsEmpty');
  const countEl = document.getElementById('friendsCount');
  const linksEl = document.getElementById('friendsLinks');

  if (titleEl) titleEl.textContent = page.title;
  if (leadEl) {
    leadEl.textContent = page.lead || '';
    leadEl.hidden = !page.lead;
  }

  // 静态 JSON + 已通过申请合并（按 url 去重，API 优先）
  let displayFriends = [...friends];
  if (apiBase) {
    try {
      const published = await fetchPublishedFriends(apiBase);
      const seen = new Set(published.map((f) => f.url.replace(/\/$/, '')));
      displayFriends = [
        ...published,
        ...friends.filter((f) => !seen.has(f.url.replace(/\/$/, ''))),
      ];
    } catch {
      // 保留静态列表
    }
  }


  if (page.exchange) {
    mountExchange(page.exchange, site, displayFriends, apiBase || undefined);
  }

  if (countEl) {
    countEl.textContent = displayFriends.length ? `${displayFriends.length}` : '';
    countEl.hidden = !displayFriends.length;
  }

  if (gridEl) {
    gridEl.innerHTML = displayFriends.length
      ? displayFriends.map(renderFriendCard).join('')
      : '';
  }

  if (emptyEl) {
    const showEmpty = !displayFriends.length;
    emptyEl.hidden = !showEmpty;
    emptyEl.textContent = page.empty || '暂无友联';
  }

  mountComments(
    document.getElementById('friendsComments'),
    comments,
    apiBase || undefined,
    '/friends/',
  );

  if (linksEl && page.links?.length) {
    linksEl.innerHTML = page.links
      .map((link: AboutLink) => {
        const icon = socialIconHtml(link.icon ?? 'link', link.label);
        const href = sitePath(link.url);
        const external = /^https?:\/\//i.test(link.url);
        const rel = external ? ' rel="noopener noreferrer"' : '';
        const target = external ? ' target="_blank"' : '';
        return (
          `<a class="fp-about-link" href="${escapeHtml(href)}"${target}${rel}>` +
          `<span class="fp-about-link-icon" aria-hidden="true">${icon}</span>` +
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
    pageCleanups.push(() => starfield.stop());
  }

  await mountLegalFooter(document.getElementById('pageLegal'), site.name);

  if (window.location.hash === '#friendsApply') {
    window.requestAnimationFrame(() => scrollToApply());
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
  document.documentElement.classList.remove('pixel-subpage');
  document.body.classList.remove(
    'pixel-hub',
    'starport-content',
    'starport-identity',
    'starport-allies',
  );
}
