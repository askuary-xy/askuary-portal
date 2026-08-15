import '../styles/mini-radio.css';
import { loadHomePage } from '../config/loader';
import { sitePath } from '../utils/site-path';
import {
  formatRadioTime,
  getSiteRadio,
  isHomeMusicPage,
} from './site-radio';

const COLLAPSE_KEY = 'askuary.miniRadio.collapsed';

let mountingMiniRadio: Promise<void> | null = null;

function pruneDuplicateRadios(): HTMLElement | null {
  const nodes = [...document.querySelectorAll<HTMLElement>('.mini-radio')];
  if (!nodes.length) return null;
  const keep = nodes.find((n) => n.id === 'miniRadio') || nodes[0];
  if (!keep.id) keep.id = 'miniRadio';
  nodes.forEach((n) => {
    if (n !== keep) n.remove();
  });
  return keep;
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean): void {
  try {
    localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function applyCollapsed(el: HTMLElement, collapsed: boolean): void {
  el.classList.toggle('is-collapsed', collapsed);
  el.setAttribute('data-collapsed', collapsed ? '1' : '0');
  const toggle = el.querySelector<HTMLButtonElement>('#miniRadioDock');
  if (toggle) {
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggle.setAttribute('aria-label', collapsed ? '展开电台' : '收起电台到侧边');
    toggle.title = collapsed ? '展开电台' : '收起';
    toggle.textContent = collapsed ? '♫' : '‹';
  }
}

/** 非主页电台坞：左下角迷你悬浮续播，可收进左侧 */
export async function mountMiniRadio(): Promise<void> {
  if (isHomeMusicPage()) {
    // 隐藏坞、保留 DOM 与底层 audio，软导航回来可直接展开
    document.querySelectorAll<HTMLElement>('.mini-radio').forEach((n) => {
      n.hidden = true;
      n.setAttribute('aria-hidden', 'true');
    });
    mountingMiniRadio = null;
    return;
  }

  const kept = pruneDuplicateRadios();
  if (kept) {
    kept.hidden = false;
    kept.removeAttribute('aria-hidden');
  }
  if (kept && !kept.classList.contains('is-loading') && kept.querySelector('#miniRadioPlay')) {
    return;
  }
  if (mountingMiniRadio) return mountingMiniRadio;

  let root = document.getElementById('miniRadio') as HTMLElement | null;
  if (!root) {
    root = document.createElement('div');
    root.id = 'miniRadio';
    root.className = 'mini-radio is-loading';
    root.setAttribute('aria-hidden', 'true');
    document.body.appendChild(root);
  } else {
    root.classList.add('is-loading');
  }
  pruneDuplicateRadios();

  mountingMiniRadio = (async () => {
    let musicCfg;
    try {
      const data = await loadHomePage();
      musicCfg = data.page.music;
    } catch {
      musicCfg = undefined;
    }

    const radio = getSiteRadio();
    await radio.ensure(musicCfg);

    const el = pruneDuplicateRadios() || root;
    if (!el) return;
    el.classList.remove('is-loading');
    el.removeAttribute('aria-hidden');
    el.innerHTML =
      `<button type="button" class="mini-radio-dock" id="miniRadioDock" aria-expanded="true" aria-label="收起电台到侧边" title="收起">‹</button>` +
      `<button type="button" class="mini-radio-disc" id="miniRadioDisc" aria-label="播放/暂停">` +
      `<img id="miniRadioCover" src="" alt="" decoding="async" />` +
      `<span class="mini-radio-hole" aria-hidden="true"></span>` +
      `</button>` +
      `<div class="mini-radio-meta">` +
      `<p class="mini-radio-title" id="miniRadioTitle"></p>` +
      `<p class="mini-radio-artist" id="miniRadioArtist"></p>` +
      `<p class="mini-radio-time" id="miniRadioTime">0:00</p>` +
      `</div>` +
      `<div class="mini-radio-actions">` +
      `<button type="button" class="mini-radio-btn" id="miniRadioPlay" aria-label="播放">▶</button>` +
      `<button type="button" class="mini-radio-btn" id="miniRadioNext" aria-label="下一首">⏭</button>` +
      `<a class="mini-radio-btn mini-radio-home" href="${sitePath('/home/')}" title="回主页电台">⌂</a>` +
      `</div>`;

    const cover = el.querySelector<HTMLImageElement>('#miniRadioCover')!;
    const titleEl = el.querySelector('#miniRadioTitle')!;
    const artistEl = el.querySelector('#miniRadioArtist')!;
    const timeEl = el.querySelector('#miniRadioTime')!;
    const playBtn = el.querySelector<HTMLButtonElement>('#miniRadioPlay')!;
    const disc = el.querySelector<HTMLElement>('#miniRadioDisc')!;
    const dock = el.querySelector<HTMLButtonElement>('#miniRadioDock')!;

    applyCollapsed(el, readCollapsed());

    dock.addEventListener('click', (e) => {
      e.stopPropagation();
      const next = !el.classList.contains('is-collapsed');
      applyCollapsed(el, next);
      writeCollapsed(next);
    });

    // 收起态点唱盘：展开；展开态点唱盘：播放/暂停
    disc.addEventListener('click', () => {
      if (el.classList.contains('is-collapsed')) {
        applyCollapsed(el, false);
        writeCollapsed(false);
        return;
      }
      radio.toggle();
    });
    playBtn.addEventListener('click', () => radio.toggle());
    el.querySelector('#miniRadioNext')?.addEventListener('click', () => {
      void radio.next(true);
    });

    const sync = () => {
      const t = radio.track;
      if (!t) return;
      cover.src = t.cover || '';
      cover.alt = t.title;
      titleEl.textContent = t.title;
      artistEl.textContent = t.artist;
      timeEl.textContent = formatRadioTime(radio.audio.currentTime || 0);
      const playing = radio.playing;
      playBtn.textContent = playing ? '❚❚' : '▶';
      disc.classList.toggle('is-playing', playing);
      el.classList.toggle('is-playing', playing);
    };

    radio.subscribe(sync);
    sync();
  })().finally(() => {
    mountingMiniRadio = null;
    pruneDuplicateRadios();
  });

  return mountingMiniRadio;
}
