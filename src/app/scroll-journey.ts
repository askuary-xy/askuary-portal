import { initBlackhole } from '../canvas/blackhole';

export interface ScrollJourneyOptions {
  homeUrl: string;
  blogUrl: string;
}

export interface ScrollJourneyController {
  destroy: () => void;
}

function normalizePath(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url, window.location.origin);
    return (parsed.origin + parsed.pathname).replace(/\/$/, '');
  } catch {
    return url.replace(/\/$/, '');
  }
}

function getWarpUrl(homeUrl: string, blogUrl: string): string {
  const current = normalizePath(window.location.href);
  const target = normalizePath(homeUrl);
  if (target && current && target === current) {
    return blogUrl || homeUrl || '/';
  }
  return homeUrl || '/';
}

export function initScrollJourney(
  root: HTMLElement,
  options: ScrollJourneyOptions,
): ScrollJourneyController {
  if (root.dataset.footprintReady === '1') {
    return { destroy: () => {} };
  }
  root.dataset.footprintReady = '1';

  let warping = false;
  const earthCanvas = document.getElementById('fpEarth');
  const starsCanvas = document.getElementById('fpStars');
  const holeScene = document.getElementById('fpBlackhole');
  const skyTexts = document.getElementById('fpSkyTexts');
  const moon = document.querySelector('.fp-moon');

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

    if (skyTexts) {
      skyTexts.classList.toggle('fp-sky-hidden', toHole);
    }
    starsCanvas?.classList.toggle('fp-to-hole', toHole);
    moon?.classList.toggle('fp-moon-hidden', index >= 1);
    root.classList.toggle('is-hole-screen', toHole);
  };

  const blackhole = initBlackhole(holeScene, {
    onActivate: () => {
      if (warping) return;
      warping = true;
      const url = getWarpUrl(options.homeUrl, options.blogUrl);
      window.location.replace(url);
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
