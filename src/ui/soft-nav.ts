import '../styles/soft-nav.css';
import type { HubContext, HubModule } from './hub-types';
import { mountCosmicShell, unmountCosmicShell } from './mount-cosmic-shell';

const PERSIST_IDS = ['askuarySiteRadio', 'miniRadio', 'siteWidgets', 'pixelPet', 'starSearch', 'stardustCursor'] as const;

type RouteDef = {
  id: string;
  test: (path: string) => boolean;
  load: () => Promise<HubModule>;
};

const ROUTES: RouteDef[] = [
  {
    id: 'photos-album',
    test: (p) => p === '/photos/album' || p.startsWith('/photos/album/'),
    load: () => import('../pages/photos/album-hub'),
  },
  {
    id: 'photos',
    test: (p) => p === '/photos' || p.startsWith('/photos/'),
    load: () => import('../pages/photos/hub'),
  },
  {
    id: 'journal-view',
    test: (p) => p === '/journal/view' || p.startsWith('/journal/view/'),
    load: () => import('../pages/journal/hub'),
  },
  {
    id: 'journal-post',
    test: (p) => /^\/journal\/[^/]+$/.test(p) && p !== '/journal/view',
    load: () => import('../pages/journal/hub'),
  },
  {
    id: 'home',
    test: (p) => p === '/home' || p.startsWith('/home/'),
    load: () => import('../pages/home/hub'),
  },
  {
    id: 'shuoshuo',
    test: (p) => p === '/shuoshuo' || p.startsWith('/shuoshuo/'),
    load: () => import('../pages/shuoshuo/hub'),
  },
  {
    id: 'articles',
    test: (p) => p === '/articles' || p.startsWith('/articles/'),
    load: () => import('../pages/articles/hub'),
  },
  {
    id: 'archive',
    test: (p) => p === '/archive' || p.startsWith('/archive/'),
    load: () => import('../pages/archive/hub'),
  },
  {
    id: 'library',
    test: (p) => p === '/library' || p.startsWith('/library/'),
    load: () => import('../pages/library/hub'),
  },
  {
    id: 'games',
    test: (p) => p === '/games' || p.startsWith('/games/'),
    load: () => import('../pages/games/hub'),
  },
  {
    id: 'friends',
    test: (p) => p === '/friends' || p.startsWith('/friends/'),
    load: () => import('../pages/friends/hub'),
  },
  {
    id: 'about',
    test: (p) => p === '/about' || p.startsWith('/about/'),
    load: () => import('../pages/about/hub'),
  },
];

let installed = false;
let navigating = false;
let current: HubModule | null = null;
let prefetchCache = new Map<string, Promise<string>>();

/** 去掉 BASE_URL 后的站内路径，无尾斜杠（根为 `/`） */
export function hubPathname(url: URL | string = location.href): string {
  const u = typeof url === 'string' ? new URL(url, location.origin) : url;
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  let path = u.pathname;
  if (base && base !== '/' && path.startsWith(base)) {
    path = path.slice(base.length) || '/';
  }
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/index\.html$/i, '/');
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return path || '/';
}

export function matchHubRoute(path: string): RouteDef | null {
  return ROUTES.find((r) => r.test(path)) || null;
}

export function isHubPath(path: string): boolean {
  return Boolean(matchHubRoute(path));
}

function toSiteHref(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}

function detachPersist(): HTMLElement[] {
  const kept: HTMLElement[] = [];
  const pet = document.getElementById('pixelPet');
  const widgets = document.getElementById('siteWidgets');
  const widgetsInPet = Boolean(pet && widgets && pet.contains(widgets));

  for (const id of PERSIST_IDS) {
    if (id === 'siteWidgets' && widgetsInPet) continue;
    const el = document.getElementById(id);
    if (el) {
      el.remove();
      kept.push(el);
    }
  }
  return kept;
}

function restorePersist(nodes: HTMLElement[]): void {
  for (const el of nodes) {
    if (!document.getElementById(el.id)) {
      document.body.appendChild(el);
    }
  }
  // 天气小组件挂回宠物槽
  const pet = document.getElementById('pixelPet');
  const slot = pet?.querySelector('#pixelPetClimate') as HTMLElement | null;
  if (slot) {
    const widgets = document.getElementById('siteWidgets');
    if (widgets && widgets.parentElement !== slot) slot.appendChild(widgets);
  }
}

async function fetchHtml(href: string): Promise<string> {
  const cached = prefetchCache.get(href);
  if (cached) return cached;
  const job = fetch(href, {
    credentials: 'same-origin',
    headers: { Accept: 'text/html' },
  }).then(async (res) => {
    if (!res.ok) throw new Error(`soft-nav fetch ${res.status}`);
    return res.text();
  });
  prefetchCache.set(href, job);
  try {
    return await job;
  } catch (err) {
    prefetchCache.delete(href);
    throw err;
  }
}

function applyShell(html: string): void {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  unmountCosmicShell();
  const persist = detachPersist();

  document.title = doc.title || document.title;
  document.documentElement.className = doc.documentElement.className;
  document.body.className = doc.body.className;

  const nextKids = [...doc.body.children].filter((el) => el.tagName !== 'SCRIPT');
  document.body.replaceChildren(...nextKids.map((n) => document.importNode(n, true)));
  restorePersist(persist);
}

async function runViewTransition(update: () => Promise<void>): Promise<void> {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void> };
  };
  if (typeof doc.startViewTransition === 'function') {
    const vt = doc.startViewTransition(() => update());
    try {
      await vt.finished;
    } catch {
      /* aborted */
    }
    return;
  }
  document.body.classList.add('soft-nav-fade-out');
  await new Promise((r) => window.setTimeout(r, 90));
  await update();
  document.body.classList.remove('soft-nav-fade-out');
  document.body.classList.add('soft-nav-fade-in');
  window.setTimeout(() => document.body.classList.remove('soft-nav-fade-in'), 220);
}

/** 程序化软导航（闸门传送等）；非枢纽路径会整页跳转 */
export async function softNavigate(href: string): Promise<void> {
  const url = new URL(href, location.href);
  if (url.origin !== location.origin || !isHubPath(hubPathname(url))) {
    location.assign(`${url.pathname}${url.search}${url.hash}`);
    return;
  }
  await navigateTo(url, 'push');
}

async function navigateTo(url: URL, mode: 'push' | 'replace' | 'pop'): Promise<void> {
  const path = hubPathname(url);
  const route = matchHubRoute(path);
  if (!route) {
    location.assign(toSiteHref(url));
    return;
  }

  if (navigating) return;
  navigating = true;
  document.documentElement.classList.add('soft-nav-pending');

  try {
    const href = toSiteHref(url);
    const [html, mod] = await Promise.all([fetchHtml(href), route.load()]);

    await runViewTransition(async () => {
      try {
        current?.unmount();
      } catch (err) {
        console.warn('[soft-nav] unmount', err);
      }
      current = null;
      applyShell(html);
      if (mode === 'push') history.pushState({ softNav: true }, '', href);
      else if (mode === 'replace') history.replaceState({ softNav: true }, '', href);
      const ctx: HubContext = { soft: true, url };
      await mod.mount(ctx);
      mountCosmicShell();
      current = mod;
      window.scrollTo(0, 0);
    });
  } catch (err) {
    console.error('[soft-nav]', err);
    location.assign(toSiteHref(url));
  } finally {
    navigating = false;
    document.documentElement.classList.remove('soft-nav-pending');
  }
}

function shouldIntercept(a: HTMLAnchorElement, event: MouseEvent): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (a.target && a.target !== '_self') return false;
  if (a.hasAttribute('download')) return false;
  if (a.dataset.noSoftNav === '1') return false;

  const href = a.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(a.href, location.href);
  } catch {
    return false;
  }
  if (url.origin !== location.origin) return false;

  const path = hubPathname(url);
  if (!isHubPath(path)) return false;

  // 同页 hash
  if (
    path === hubPathname(location.href) &&
    url.search === location.search &&
    url.hash &&
    url.hash !== location.hash
  ) {
    return false;
  }

  return true;
}

function onClick(event: MouseEvent): void {
  const t = event.target as Element | null;
  const a = t?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a || !shouldIntercept(a, event)) return;
  event.preventDefault();
  const url = new URL(a.href, location.href);
  void navigateTo(url, 'push');
}

function onPrefetch(event: Event): void {
  const t = event.target as Element | null;
  const a = t?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a) return;
  try {
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (!isHubPath(hubPathname(url))) return;
    const href = toSiteHref(url);
    if (!prefetchCache.has(href)) {
      prefetchCache.set(
        href,
        fetch(href, { credentials: 'same-origin', headers: { Accept: 'text/html' } }).then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.text();
        }),
      );
    }
    const route = matchHubRoute(hubPathname(url));
    void route?.load();
  } catch {
    /* ignore */
  }
}

function onPopState(): void {
  void navigateTo(new URL(location.href), 'pop');
}

/** 各枢纽入口调用：安装拦截器，并登记当前页模块（可选） */
export function installSoftNav(active?: HubModule): void {
  if (active) current = active;
  if (installed) return;
  installed = true;
  document.addEventListener('click', onClick);
  document.addEventListener('mouseover', onPrefetch, { passive: true });
  document.addEventListener('touchstart', onPrefetch, { passive: true });
  window.addEventListener('popstate', onPopState);
  history.replaceState({ softNav: true }, '', toSiteHref(new URL(location.href)));
}

/** 冷启动：install + mount 当前页 */
export function bootHubPage(mod: HubModule): void {
  installSoftNav(mod);
  const ctx: HubContext = { soft: false, url: new URL(location.href) };
  void mod
    .mount(ctx)
    .then(() => mountCosmicShell())
    .catch((err) => {
      console.error(err);
      const root = document.getElementById('bootError');
      if (root) {
        root.hidden = false;
        root.textContent = '页面加载失败，请刷新重试';
      }
    });
}

export function getCurrentHub(): HubModule | null {
  return current;
}
