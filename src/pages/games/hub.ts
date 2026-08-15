import '../../styles/pixel-fonts.css';
import '../../styles/games-pxlkit.css';
import '../../styles/comments.css';
import '../../styles/legal.css';
import '../../styles/page-chrome.css';
import '../../styles/facility-starport.css';
import { loadGamesPage } from '../../config/loader';
import { escapeHtml } from '../../utils/html';
import { mountPixelStage } from '../../ui/mount-pixel-stage';
import { mountPixelNav } from '../../ui/mount-pixel-nav';
import { mountHomeBackground } from '../../ui/mount-home-background';

import type { HubContext } from '../../ui/hub-types';

let pageCleanups: Array<() => void> = [];

export async function mount(_ctx: HubContext): Promise<void> {
  document.documentElement.classList.add('games-pixel-html', 'pixel-cosmos', 'dark');
  document.body.classList.add('dark', 'games-pixel-page', 'starport-facility', 'starport-training');

  const root = document.getElementById('gamesRoot');
  const err = document.getElementById('bootError');
  if (!root) return;

  let propHandler: (() => void) | null = null;
  const disposeStage = mountPixelStage(document.getElementById('gpStage'), {
    onPropClick: () => propHandler?.(),
  });

  try {
    const [{ mountArcadeApp }, { page, site, comments }] = await Promise.all([
      import('./ArcadeApp'),
      loadGamesPage(),
    ]);
    mountHomeBackground(site);
    document.title = `${page.title || '像素街机'} · ${site.name || 'ASKUARY'}`;
    mountPixelNav({
      brand: site.name || 'ASKUARY',
      title: page.title || '像素街机',
      backHref: '/home/',
      widgets: { weather: site.weather, themeDefault: 'auto' },
    });

    root.innerHTML = '';
    const unmountArcade = mountArcadeApp(root, {
      page,
      site,
      comments,
      onPropClick: (handler) => {
        propHandler = handler;
      },
    });

    pageCleanups.push(() => {
      disposeStage();
      unmountArcade();
      document.documentElement.classList.remove('games-pixel-html', 'pixel-cosmos', 'dark');
      document.body.classList.remove('dark', 'games-pixel-page');
    });
  } catch (e) {
    disposeStage();
    const msg = e instanceof Error ? e.message : String(e);
    root.innerHTML = `<p class="p-4 border-[3px] border-black bg-black text-[var(--retro-red)] shadow-[4px_4px_0_#000]">街机启动失败：${escapeHtml(msg)}</p>`;
    if (err) {
      err.hidden = false;
      err.textContent = msg;
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
