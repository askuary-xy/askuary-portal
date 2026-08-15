import { initBlackhole } from '../canvas/blackhole';
import { sitePath } from '../utils/site-path';
import { showToast } from '../ui/toast';

export interface ScrollJourneyOptions {
  homeUrl?: string;
  /** @deprecated */
  blogUrl?: string;
  warpEnabled?: boolean;
  warpHint?: string;
  siteName?: string;
  /**
   * embed：在本页打开传送门小游戏（默认）
   * navigate：跳转到 homeUrl（旧行为 / 无 JS 时回退）
   */
  warpMode?: 'embed' | 'navigate';
}

export interface ScrollJourneyController {
  destroy: () => void;
}

function resolveSiteUrl(path: string): string {
  if (!path) return sitePath('/home/');
  if (/^https?:\/\//i.test(path)) return path;
  return sitePath(path.startsWith('/') ? path : `/${path}`);
}

export function initScrollJourney(
  root: HTMLElement,
  options: ScrollJourneyOptions,
): ScrollJourneyController {
  if (root.dataset.footprintReady === '1') {
    return { destroy: () => {} };
  }
  root.dataset.footprintReady = '1';

  const warpEnabled = options.warpEnabled === true;
  const warpHint = options.warpHint || '博客模块开发中，敬请期待。';
  const warpTarget = resolveSiteUrl(options.homeUrl || options.blogUrl || '/home/');
  const warpMode = options.warpMode === 'navigate' ? 'navigate' : 'embed';
  const siteName = options.siteName || 'ASKUARY';

  let warping = false;
  const earthCanvas = document.getElementById('fpEarth');
  const starsCanvas = document.getElementById('fpStars');
  const holeScene = document.getElementById('fpBlackhole');
  const skyTexts = document.getElementById('fpSkyTexts');
  const moon = document.querySelector('.fp-moon');
  root.classList.toggle('fp-warp-disabled', !warpEnabled);

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  const onScroll = (): void => {
    if (warping) return;

    const vh = window.innerHeight || 1;
    const index = Math.round((window.scrollY || 0) / vh);
    const toHole = index >= 1;

    earthCanvas?.classList.toggle('fp-to-hole', toHole);
    earthCanvas?.classList.toggle('fp-earth-interactive', !toHole);

    skyTexts?.classList.toggle('fp-sky-hidden', toHole);
    starsCanvas?.classList.toggle('fp-to-hole', toHole);
    moon?.classList.toggle('fp-moon-hidden', index >= 1);
    root.classList.toggle('is-hole-screen', toHole);
  };

  /** 回到地球屏并解除滚动锁（bfcache / 从主页返回 / 关闭传送门残留类） */
  const forceEarthScreen = (): void => {
    warping = false;
    root.classList.remove('is-warping');
    holeScene?.classList.remove('is-warping');
    document.body.classList.remove('gate-overlay-open');
    document.documentElement.classList.remove('games-pixel-html', 'home-pixel-html');
    const html = document.documentElement;
    const prevBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    onScroll();
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      html.style.scrollBehavior = prevBehavior;
      onScroll();
    });
  };

  forceEarthScreen();

  const onPageShow = (): void => {
    // bfcache / 从 /home 返回时可能停在黑洞屏，或残留 overflow:hidden
    forceEarthScreen();
  };

  const blackhole = initBlackhole(holeScene, {
    onActivate: () => {
      if (warping) return;
      if (!warpEnabled) {
        showToast(warpHint);
        return;
      }
      warping = true;
      root.classList.add('is-warping');
      holeScene?.classList.add('is-warping');
      try {
        sessionStorage.setItem('askuary_from_warp', '1');
      } catch {
        /* private mode */
      }

      if (warpMode === 'navigate') {
        window.setTimeout(() => {
          window.location.assign(warpTarget);
        }, 920);
        return;
      }

      window.setTimeout(() => {
        void import('../pages/home/mount-gate-overlay')
          .then(({ openGateOverlay }) =>
            openGateOverlay({
              siteName,
              onClose: () => {
                warping = false;
                root.classList.remove('is-warping');
                holeScene?.classList.remove('is-warping');
                // 关闭传送门后回到地球屏，避免停在黑洞页且无法上滑
                forceEarthScreen();
              },
            }),
          )
          .catch(() => {
            // 嵌入失败则回退跳转
            window.location.assign(warpTarget);
          });
      }, 720);
    },
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pageshow', onPageShow);
  onScroll();

  earthCanvas?.classList.add('fp-earth-interactive');

  return {
    destroy: () => {
      blackhole.destroy();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pageshow', onPageShow);
      delete root.dataset.footprintReady;
    },
  };
}
