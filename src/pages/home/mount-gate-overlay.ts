/**
 * 在宇宙主页上全屏嵌入「传送门」小游戏（点击黑洞后打开）
 */
import '../../styles/pixel-fonts.css';
import '../../styles/games-pxlkit.css';
import '../../styles/home-pixel.css';
import '../../styles/legal.css';
import '../../styles/gate-overlay.css';
import { mountPixelStage } from '../../ui/mount-pixel-stage';

export type GateOverlayHandle = {
  close: () => void;
};

export type GateOverlayOptions = {
  siteName: string;
  onClose?: () => void;
};

let active: GateOverlayHandle | null = null;

export async function openGateOverlay(options: GateOverlayOptions): Promise<GateOverlayHandle> {
  if (active) return active;

  const shell = document.createElement('div');
  shell.className = 'gate-overlay dark home-pixel-page';
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-modal', 'true');
  shell.setAttribute('aria-label', '传送门世界');
  shell.innerHTML = `
    <div class="gp-scanlines" aria-hidden="true"></div>
    <div class="gp-stage" id="gateGpStage" aria-hidden="true"></div>
    <div class="gate-overlay-bar">
      <span class="gate-overlay-title">传送门</span>
    </div>
    <div id="gateHomeRoot" class="gate-overlay-root"></div>
  `;
  document.body.appendChild(shell);
  document.body.classList.add('gate-overlay-open');
  document.documentElement.classList.add('games-pixel-html', 'home-pixel-html', 'dark');

  const disposeStage = mountPixelStage(shell.querySelector('#gateGpStage') as HTMLElement | null);
  const { mountHomePixelApp } = await import('./HomePixelApp');
  const root = shell.querySelector('#gateHomeRoot') as HTMLElement;
  let unmount: () => void = () => {};

  const handle: GateOverlayHandle = {
    close: () => {
      window.removeEventListener('keydown', onKey);
      unmount();
      disposeStage();
      shell.remove();
      document.body.classList.remove('gate-overlay-open');
      // 勿把主页/游戏页的 overflow:hidden 类留在宇宙页上，否则无法上滑离开黑洞屏
      document.documentElement.classList.remove('games-pixel-html', 'home-pixel-html');
      active = null;
      options.onClose?.();
    },
  };

  function onKey(e: KeyboardEvent) {
    if (e.code === 'Escape') {
      e.preventDefault();
      handle.close();
    }
  }

  unmount = mountHomePixelApp(root, {
    siteName: options.siteName,
    embedded: true,
    onExit: () => handle.close(),
  });

  window.addEventListener('keydown', onKey);

  active = handle;
  return handle;
}
