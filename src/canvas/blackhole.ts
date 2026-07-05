export interface BlackholeOptions {
  onActivate?: () => void;
}

export interface BlackholeController {
  destroy: () => void;
}

/** CSS 黑洞交互（视觉见 blackhole.css，参考 CodePen ZZydGx） */
export function initBlackhole(scene: HTMLElement | null, options: BlackholeOptions = {}): BlackholeController {
  if (!scene) return { destroy: () => {} };

  const onActivate = options.onActivate;
  const target = scene.querySelector<HTMLElement>('.fp-black-hole') ?? scene;
  const root = document.getElementById('footprintIntro');
  let active = false;

  const syncVisibility = (): void => {
    const vh = window.innerHeight || 1;
    const onHole = Math.round((window.scrollY || 0) / vh) >= 1;
    scene.classList.toggle('is-visible', onHole);
    scene.setAttribute('aria-hidden', onHole ? 'false' : 'true');
    if (!onHole) target.classList.remove('is-hover');
  };

  const activate = (): void => {
    if (active || !onActivate) return;
    active = true;
    onActivate();
  };

  const onClick = (event: Event): void => {
    if (!scene.classList.contains('is-visible')) return;
    event.preventDefault();
    activate();
  };

  const onKey = (event: KeyboardEvent): void => {
    if (!scene.classList.contains('is-visible')) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate();
    }
  };

  const onEnter = (): void => {
    if (scene.classList.contains('is-visible')) target.classList.add('is-hover');
  };

  const onLeave = (): void => {
    target.classList.remove('is-hover');
  };

  target.addEventListener('click', onClick);
  target.addEventListener('keydown', onKey);
  target.addEventListener('mouseenter', onEnter);
  target.addEventListener('mouseleave', onLeave);
  window.addEventListener('scroll', syncVisibility, { passive: true });
  window.addEventListener('resize', syncVisibility);
  root?.addEventListener('transitionend', syncVisibility);

  syncVisibility();

  return {
    destroy: () => {
      target.removeEventListener('click', onClick);
      target.removeEventListener('keydown', onKey);
      target.removeEventListener('mouseenter', onEnter);
      target.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('scroll', syncVisibility);
      window.removeEventListener('resize', syncVisibility);
      scene.classList.remove('is-visible');
    },
  };
}
