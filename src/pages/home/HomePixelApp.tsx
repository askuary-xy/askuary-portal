import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  PixelButton,
  PixelModal,
  PixelStack,
  PxlKitSurfaceProvider,
  PxlKitToastProvider,
  useToast,
} from '@pxlkit/ui-kit';
import { mountLegalFooter } from '../../ui/mount-legal';
import { getSolarTerm } from '../../ui/solar-terms';
import { createGateWorld, type WorldApi, type WorldDoor } from './gate-world';

type PadBtnProps = {
  label: string;
  sub?: string;
  className?: string;
  code: string;
  onKey: (code: string, down: boolean) => void;
};

function PadBtn({ label, sub, className = '', code, onKey }: PadBtnProps) {
  const active = useRef(false);

  const release = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    onKey(code, false);
  }, [code, onKey]);

  const press = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (active.current) return;
      active.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      onKey(code, true);
    },
    [code, onKey],
  );

  return (
    <button
      type="button"
      className={`hp-pad-btn ${className}`}
      aria-label={label}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="hp-pad-btn-label">{label}</span>
      {sub ? <span className="hp-pad-btn-sub">{sub}</span> : null}
    </button>
  );
}

function MobilePad({
  worldRef,
}: {
  worldRef: RefObject<WorldApi | null>;
}) {
  const onKey = useCallback(
    (code: string, down: boolean) => {
      worldRef.current?.setVirtualKey(code, down);
    },
    [worldRef],
  );

  useEffect(() => {
    const clear = () => worldRef.current?.clearVirtualKeys();
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('blur', clear);
      clear();
    };
  }, [worldRef]);

  return (
    <div className="hp-pad" aria-label="触屏控制器">
      <div className="hp-pad-cluster hp-pad-cluster--move">
        <PadBtn label="◀" sub="左" code="KeyA" onKey={onKey} className="hp-pad-btn--dir" />
        <PadBtn label="▶" sub="右" code="KeyD" onKey={onKey} className="hp-pad-btn--dir" />
      </div>
      <div className="hp-pad-cluster hp-pad-cluster--action">
        <PadBtn label="进" sub="门" code="KeyE" onKey={onKey} className="hp-pad-btn--door" />
        <PadBtn label="斩" sub="攻" code="KeyJ" onKey={onKey} className="hp-pad-btn--atk" />
        <PadBtn label="跳" sub="跃" code="Space" onKey={onKey} className="hp-pad-btn--jump" />
      </div>
    </div>
  );
}

class HomeErrorBoundary extends Component<{ children: ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { err: e instanceof Error ? e.message : String(e) };
  }
  render() {
    if (this.state.err) {
      return (
        <div className="border-[3px] border-black bg-black p-4 text-[var(--retro-red)] shadow-[4px_4px_0_#000]">
          像素主页崩溃：{this.state.err}
        </div>
      );
    }
    return this.props.children;
  }
}

function HomeInner({
  siteName,
  embedded,
  onExit,
}: {
  siteName: string;
  embedded?: boolean;
  onExit?: () => void;
}) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const legalRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<WorldApi | null>(null);
  const [active, setActive] = useState<WorldDoor | null>(null);
  const [termName, setTermName] = useState(() => getSolarTerm().name);
  const [showPad, setShowPad] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(
      '(pointer: coarse), (hover: none), (max-width: 960px)',
    );
    const sync = () => setShowPad(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!legalRef.current) return;
    void mountLegalFooter(legalRef.current, siteName);
  }, [siteName]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let api: WorldApi | null = null;

    void (async () => {
      api = await createGateWorld({
        canvas,
        onInteractDoor: (door) => setActive(door),
      });
      if (cancelled) {
        api.dispose();
        return;
      }
      worldRef.current = api;
      setTermName(getSolarTerm().name);
    })();

    return () => {
      cancelled = true;
      api?.dispose();
      worldRef.current = null;
    };
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    let dragging = false;
    let moved = false;
    let lastX = 0;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const api = worldRef.current;
      if (!api) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      api.setCameraX(api.getCameraX() + delta * 1.1);
    };

    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.hp-hud')) return;
      dragging = true;
      moved = false;
      lastX = e.clientX;
      wrap.classList.add('is-dragging');
      wrap.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const api = worldRef.current;
      if (!api) return;
      const dx = e.clientX - lastX;
      if (Math.abs(dx) > 3) moved = true;
      lastX = e.clientX;
      api.setCameraX(api.getCameraX() - dx);
    };

    const end = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      wrap.classList.remove('is-dragging');
      try {
        wrap.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    const onClick = (e: MouseEvent) => {
      if (moved) return;
      if ((e.target as HTMLElement).closest('.hp-hud')) return;
      const api = worldRef.current;
      if (!api) return;
      const door = api.hitDoor(e.clientX, e.clientY);
      if (door) setActive(door);
    };

    wrap.addEventListener('wheel', onWheel, { passive: false });
    wrap.addEventListener('pointerdown', onDown);
    wrap.addEventListener('pointermove', onMove);
    wrap.addEventListener('pointerup', end);
    wrap.addEventListener('pointercancel', end);
    wrap.addEventListener('click', onClick);
    return () => {
      wrap.removeEventListener('wheel', onWheel);
      wrap.removeEventListener('pointerdown', onDown);
      wrap.removeEventListener('pointermove', onMove);
      wrap.removeEventListener('pointerup', end);
      wrap.removeEventListener('pointercancel', end);
      wrap.removeEventListener('click', onClick);
    };
  }, []);

  function goDoor(door: WorldDoor) {
    toast.success(`传送中 · ${door.name}`);
    window.setTimeout(() => {
      window.location.href = door.href;
    }, 220);
  }

  return (
    <>
      <div className="hp-world-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} className="hp-world-canvas" aria-label="像素世界" />
      </div>

      <div className="hp-hud">
        <div className="hp-logo-bar">
          <div className="hp-logo-cluster">
            <a
              className="hp-logo"
              href={embedded ? undefined : '../'}
              onClick={embedded ? (e) => e.preventDefault() : undefined}
            >
              <img src="/brand/logo.png" alt={siteName} width={40} height={40} />
              <span>{siteName}</span>
            </a>
            <div className="hp-term" title={`二十四节气 · 当前 ${termName}`}>
              <span className="hp-term-label">节气</span>
              <strong>{termName}</strong>
            </div>
          </div>
          {embedded && onExit ? (
            <PixelButton size="sm" tone="neutral" onClick={onExit}>
              返回宇宙
            </PixelButton>
          ) : null}
        </div>

        {showPad ? <MobilePad worldRef={worldRef} /> : null}

        <div className="hp-legal" ref={legalRef} />
      </div>

      <PixelModal
        open={!!active}
        onClose={() => setActive(null)}
        title={active?.name || '黑洞'}
        size="md"
        closeLabel="关闭"
      >
        {active ? (
          <PixelStack gap={3}>
            <p className="text-sm opacity-80">{active.blurb}</p>
            <div className="flex flex-wrap gap-2">
              <PixelButton tone="green" onClick={() => goDoor(active)}>
                进入
              </PixelButton>
              <PixelButton tone="neutral" onClick={() => setActive(null)}>
                留下
              </PixelButton>
            </div>
          </PixelStack>
        ) : null}
      </PixelModal>
    </>
  );
}

export type HomePixelAppProps = {
  siteName: string;
  embedded?: boolean;
  onExit?: () => void;
};

export function HomePixelApp(props: HomePixelAppProps) {
  return (
    <HomeErrorBoundary>
      <PxlKitSurfaceProvider surface="pixel">
        <PxlKitToastProvider position="bottom-center" surface="pixel">
          <div className="dark relative min-h-screen w-full min-w-0 max-w-full overflow-hidden text-[var(--retro-fg,#e8ecff)]">
            <HomeInner {...props} />
          </div>
        </PxlKitToastProvider>
      </PxlKitSurfaceProvider>
    </HomeErrorBoundary>
  );
}

export function mountHomePixelApp(el: HTMLElement, props: HomePixelAppProps): () => void {
  const root = createRoot(el);
  root.render(<HomePixelApp {...props} />);
  return () => root.unmount();
}
