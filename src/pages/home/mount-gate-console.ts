import '../../styles/pixel-fonts.css';
import '../../styles/gate-console.css';
import { type WorldApi, type WorldDoor } from './gate-world';
import { createHd2dCoastWorld } from './hd2d-coast-world';
import { getLastWeather, getSiteMapTheme, readThemeMode } from '../../ui/mount-site-widgets';
import { getSolarTerm } from '../../ui/solar-terms';

export function renderGateConsoleShell(): string {
  return (
    `<section class="gate-console hr-reveal is-locked" id="gateConsole" aria-label="PIXEL GATE">` +
    `<header class="gate-console-top">` +
    `<div class="gate-console-title">` +
    `<strong>PIXEL GATE</strong>` +
    `<span class="gate-console-term" id="gateConsoleTerm">${getSolarTerm().name}</span>` +
    `</div>` +
    `<div class="gate-console-actions">` +
    `<button type="button" class="gate-console-btn gate-console-btn--mini" data-gc="mini">缩小</button>` +
    `<button type="button" class="gate-console-btn gate-console-btn--fs" data-gc="fs">全屏</button>` +
    `</div>` +
    `</header>` +
    `<div class="gate-console-screen" id="gateConsoleScreen" tabindex="0" role="application" aria-label="游戏画面，点击开始，移出后需再次点击">` +
    `<canvas class="gate-console-canvas" id="gateConsoleCanvas" aria-label="像素世界"></canvas>` +
    `<div class="gate-console-pad" aria-label="触屏控制器">` +
    `<div class="gate-console-pad-cluster">` +
    padBtn('KeyA', '◀', '左') +
    padBtn('KeyD', '▶', '右') +
    `</div>` +
    `<div class="gate-console-pad-cluster">` +
    padBtn('KeyE', '进', '门', 'door') +
    padBtn('KeyJ', '斩', '攻', 'atk') +
    padBtn('Space', '跳', '跃', 'jump') +
    `</div>` +
    `</div>` +
    `</div>` +
    `<button type="button" class="gate-console-restore" data-gc="restore">` +
    `<span>▶ PIXEL GATE</span>` +
    `<em>EXPAND</em>` +
    `</button>` +
    `</section>`
  );
}

function padBtn(code: string, label: string, sub: string, tone = ''): string {
  const cls = tone ? ` gate-console-pad-btn--${tone}` : '';
  return (
    `<button type="button" class="gate-console-pad-btn${cls}" data-code="${code}" aria-label="${sub}">` +
    `<strong>${label}</strong><span>${sub}</span>` +
    `</button>`
  );
}

function goDoor(door: WorldDoor) {
  window.setTimeout(() => {
    // 动态导入避免 soft-nav ↔ home hub 循环依赖
    void import('../../ui/soft-nav').then((m) => m.softNavigate(door.href));
  }, 160);
}

export async function mountGateConsole(root: HTMLElement | null): Promise<() => void> {
  if (!root) return () => {};

  const canvas = root.querySelector<HTMLCanvasElement>('#gateConsoleCanvas');
  const screen = root.querySelector<HTMLElement>('#gateConsoleScreen');
  if (!canvas || !screen) return () => {};

  const touchMq = window.matchMedia('(pointer: coarse), (hover: none), (max-width: 900px)');
  const syncTouch = () => root.classList.toggle('is-touch', touchMq.matches);
  syncTouch();
  touchMq.addEventListener('change', syncTouch);

  let api: WorldApi | null = null;
  let disposed = false;
  let mini = false;
  let fs = false;
  let armed = false;

  const isLive = () => armed && !mini && !disposed;
  // 激活后即可键鼠操作，不必全屏；离开区域会解除激活
  const inputActive = () => isLive();

  api = await createHd2dCoastWorld({
    canvas,
    inputActive,
    onInteractDoor: (door) => goDoor(door),
  });
  if (disposed) {
    api.dispose();
    api = null;
    return () => {};
  }

  const syncLight = () => {
    api?.setLightMode(readThemeMode() === 'manual' ? getSiteMapTheme() : null);
    root.classList.toggle('is-night', getSiteMapTheme() === 'night');
    root.classList.toggle('is-day', getSiteMapTheme() === 'day');
  };
  const syncWeather = (snap = getLastWeather()) => {
    const term = root.querySelector<HTMLElement>('#gateConsoleTerm');
    if (term) term.textContent = snap?.solarTerm?.name || getSolarTerm().name;
    api?.setWeatherVisual(snap?.phenomenon || 'clear');
    syncLight();
  };
  const onTheme = () => syncLight();
  const onWeather = (event: Event) => {
    const snap = (event as CustomEvent<{ snap?: ReturnType<typeof getLastWeather> }>).detail?.snap;
    syncWeather(snap ?? getLastWeather());
  };
  syncWeather();
  window.addEventListener('askuary:theme', onTheme);
  window.addEventListener('askuary:weather', onWeather);

  const armWorld = () => {
    if (armed || disposed || mini) return;
    armed = true;
    root.classList.remove('is-locked');
    root.classList.add('is-armed');
    screen.focus({ preventScroll: true });
  };

  const disarmWorld = () => {
    if (!armed || fs || disposed) return;
    armed = false;
    root.classList.add('is-locked');
    root.classList.remove('is-armed');
    api?.clearVirtualKeys();
  };

  const setMini = (next: boolean) => {
    if (next && fs) void setFullscreen(false);
    mini = next;
    root.classList.toggle('is-mini', mini);
    const btn = root.querySelector<HTMLButtonElement>('[data-gc="mini"]');
    if (btn) btn.textContent = mini ? '展开' : '缩小';
    if (mini) {
      disarmWorld();
      api?.clearVirtualKeys();
    }
    window.dispatchEvent(new Event('resize'));
  };

  const setFullscreen = async (next: boolean) => {
    fs = next;
    root.classList.toggle('is-fullscreen', fs);
    document.body.classList.toggle('gate-console-fs-lock', fs);
    const btn = root.querySelector<HTMLButtonElement>('[data-gc="fs"]');
    if (btn) btn.textContent = fs ? '退出全屏' : '全屏';

    try {
      if (fs) {
        if (!document.fullscreenElement && root.requestFullscreen) {
          await root.requestFullscreen().catch(() => {});
        }
      } else if (document.fullscreenElement === root) {
        await document.exitFullscreen().catch(() => {});
      }
    } catch {
      /* ignore */
    }

    window.dispatchEvent(new Event('resize'));
    if (fs) {
      armWorld();
      screen.focus({ preventScroll: true });
    }
  };

  const onFsChange = () => {
    const native = document.fullscreenElement === root;
    if (!native && fs) {
      fs = false;
      root.classList.remove('is-fullscreen');
      document.body.classList.remove('gate-console-fs-lock');
      const btn = root.querySelector<HTMLButtonElement>('[data-gc="fs"]');
      if (btn) btn.textContent = '全屏';
      disarmWorld();
      window.dispatchEvent(new Event('resize'));
    }
  };

  root.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-gc]');
    if (!t) return;
    const act = t.dataset.gc;
    if (act === 'mini') void setMini(!mini);
    if (act === 'restore') {
      void setMini(false);
    }
    if (act === 'fs') {
      void setFullscreen(!fs);
    }
  });

  // 点击画面启停（不是单独按钮）
  screen.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('.gate-console-pad')) return;
    if ((e.target as HTMLElement).closest('[data-gc]')) return;
    if (!armed) armWorld();
  });

  root.addEventListener('pointerleave', () => {
    if (!fs) disarmWorld();
  });

  // 触屏虚拟键
  const onPadPointer = (e: PointerEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-code]');
    if (!btn || !api) return;
    if (!armed) armWorld();
    e.preventDefault();
    e.stopPropagation();
    const code = btn.dataset.code || '';
    if (!code) return;
    if (e.type === 'pointerdown') {
      btn.setPointerCapture(e.pointerId);
      api.setVirtualKey(code, true);
    } else {
      api.setVirtualKey(code, false);
    }
  };
  root.querySelectorAll<HTMLButtonElement>('[data-code]').forEach((btn) => {
    btn.addEventListener('pointerdown', onPadPointer);
    btn.addEventListener('pointerup', onPadPointer);
    btn.addEventListener('pointercancel', onPadPointer);
    btn.addEventListener('pointerleave', onPadPointer);
    btn.addEventListener('contextmenu', (ev) => ev.preventDefault());
  });

  let dragging = false;
  let moved = false;
  let lastX = 0;
  const onDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('.gate-console-pad')) return;
    if (!armed) return;
    dragging = true;
    moved = false;
    lastX = e.clientX;
    screen.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging || !api) return;
    const dx = e.clientX - lastX;
    if (Math.abs(dx) > 2) moved = true;
    lastX = e.clientX;
    api.setCameraX(api.getCameraX() - dx);
  };
  const onUp = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    try {
      screen.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  const onClick = (e: MouseEvent) => {
    if (!armed || moved || !api) return;
    if ((e.target as HTMLElement).closest('.gate-console-pad')) return;
    const door = api.hitDoor(e.clientX, e.clientY);
    if (door) goDoor(door);
  };

  screen.addEventListener('pointerdown', onDown);
  screen.addEventListener('pointermove', onMove);
  screen.addEventListener('pointerup', onUp);
  screen.addEventListener('pointercancel', onUp);
  screen.addEventListener('click', onClick);
  document.addEventListener('fullscreenchange', onFsChange);

  try {
    if (sessionStorage.getItem('askuary_from_warp') === '1') {
      sessionStorage.removeItem('askuary_from_warp');
      window.setTimeout(() => {
        armWorld();
        void setFullscreen(true);
      }, 280);
    }
  } catch {
    /* private mode */
  }

  // 仅本地视觉检查用：/home/?gatePreview=1 会直接展开画面，不影响正常访客入口。
  if (new URLSearchParams(window.location.search).get('gatePreview') === '1') {
    root.classList.add('is-local-preview');
    document.body.classList.add('gate-console-fs-lock');
    document.querySelector<HTMLElement>('.home-header')?.style.setProperty('display', 'none', 'important');
    document.querySelectorAll<HTMLElement>('.site-widgets, .pixel-pet, .mini-radio, .askuary-weather-canvas')
      .forEach((el) => el.style.setProperty('display', 'none', 'important'));
    window.setTimeout(() => { void setFullscreen(true); }, 0);
  }

  return () => {
    disposed = true;
    touchMq.removeEventListener('change', syncTouch);
    window.removeEventListener('askuary:theme', onTheme);
    window.removeEventListener('askuary:weather', onWeather);
    document.removeEventListener('fullscreenchange', onFsChange);
    document.body.classList.remove('gate-console-fs-lock');
    if (document.fullscreenElement === root) {
      void document.exitFullscreen().catch(() => {});
    }
    api?.dispose();
    api = null;
  };
}
