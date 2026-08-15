import '../styles/home-boot.css';
import { escapeHtml } from '../pages/home/shared';

const WARP_KEY = 'askuary_from_warp';

const WARP_STATUS = [
  'INSERT CARTRIDGE…',
  'READ MEMORY CARD…',
  'LOAD WORLD MAP…',
  'SPAWN PLAYER…',
] as const;

export function consumeWarpTransit(): boolean {
  try {
    if (sessionStorage.getItem(WARP_KEY) === '1') {
      sessionStorage.removeItem(WARP_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function buildProgressSegments(): string {
  return Array.from({ length: 8 }, () => '<span class="home-boot-bar-seg"></span>').join('');
}

/** 仅宇宙页穿越时：简洁像素启动屏 */
export async function runHomeBootSplash(options: {
  siteName: string;
  avatarUrl?: string;
  avatarAlt?: string;
  fromWarp: boolean;
}): Promise<void> {
  if (!options.fromWarp) return;

  const existing = document.getElementById('homeBoot');
  if (existing) existing.remove();

  const name = options.siteName || 'ASKUARY';
  const safe = escapeHtml(name);

  const el = document.createElement('div');
  el.id = 'homeBoot';
  el.className = 'home-boot home-boot--warp';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    `<div class="home-boot-scanlines" aria-hidden="true"></div>` +
    `<div class="home-boot-panel">` +
    `<p class="home-boot-kicker">ASKUARY · PORTAL</p>` +
    `<h1 class="home-boot-title">${safe}</h1>` +
    `<p class="home-boot-status" id="homeBootStatus">${WARP_STATUS[0]}</p>` +
    `<div class="home-boot-bar" aria-hidden="true">${buildProgressSegments()}</div>` +
    `<p class="home-boot-blink">▶ PRESS START</p>` +
    `</div>`;

  document.body.appendChild(el);
  document.body.classList.add('home-booting', 'home-boot-pixel');

  let i = 0;
  const statusTimer = window.setInterval(() => {
    i = (i + 1) % WARP_STATUS.length;
    const statusEl = el.querySelector('#homeBootStatus');
    if (statusEl) statusEl.textContent = WARP_STATUS[i];
  }, 360);

  await wait(1500);

  window.clearInterval(statusTimer);
  const statusEl = el.querySelector('#homeBootStatus');
  if (statusEl) statusEl.textContent = 'READY PLAYER ONE';

  el.classList.add('is-done');
  document.body.classList.remove('home-booting', 'home-boot-pixel');
  await wait(380);
  el.remove();
}
