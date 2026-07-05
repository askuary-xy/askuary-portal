import { initBlackhole } from '../canvas/blackhole';
import { sitePath } from '../utils/site-path';
import { showToast } from '../ui/toast';

export interface ScrollJourneyOptions {
  homeUrl?: string;
  /** @deprecated */
  blogUrl?: string;
  warpEnabled?: boolean;
  warpHint?: string;
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

  let warping = false;
  const earthCanvas = document.getElementById('fpEarth');
  const starsCanvas = document.getElementById('fpStars');
  const holeScene = document.getElementById('fpBlackhole');
  const skyTexts = document.getElementById('fpSkyTexts');
  const moon = document.querySelector('.fp-moon');
  const holeLabel = holeScene?.querySelector('.fp-black-hole-label');

  if (holeLabel) {
    holeLabel.textContent = warpEnabled ? '点击穿越' : '即将开放';
  }
  root.classList.toggle('fp-warp-disabled', !warpEnabled);

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);

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

  const blackhole = initBlackhole(holeScene, {
    onActivate: () => {
      if (warping) return;
      if (!warpEnabled) {
        showToast(warpHint);
        return;
      }
      warping = true;
      window.location.assign(warpTarget);
    },
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  earthCanvas?.classList.add('fp-earth-interactive');

  return {
    destroy: () => {
      blackhole.destroy();
      window.removeEventListener('scroll', onScroll);
      delete root.dataset.footprintReady;
    },
  };
}
