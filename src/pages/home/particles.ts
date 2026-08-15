/** 梦幻天空浮动光点 / 星星 */

type Particle = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  a: number;
  tw: number;
  kind: 'star' | 'dot';
};

export function mountHomeParticles(canvas: HTMLCanvasElement | null): () => void {
  if (!canvas) return () => undefined;
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => undefined;

  let raf = 0;
  let particles: Particle[] = [];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const resize = () => {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(56, Math.floor((window.innerWidth * window.innerHeight) / 18000));
    particles = Array.from({ length: count }, () => spawn());
  };

  const spawn = (): Particle => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: Math.random() * 1.6 + 0.4,
    vx: (Math.random() - 0.5) * 0.18,
    vy: -Math.random() * 0.22 - 0.05,
    a: Math.random() * 0.55 + 0.25,
    tw: Math.random() * Math.PI * 2,
    kind: Math.random() > 0.72 ? 'star' : 'dot',
  });

  const draw = (t: number) => {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const p of particles) {
      if (!reduce) {
        p.x += p.vx;
        p.y += p.vy;
        p.tw += 0.02;
        if (p.y < -8) p.y = window.innerHeight + 8;
        if (p.x < -8) p.x = window.innerWidth + 8;
        if (p.x > window.innerWidth + 8) p.x = -8;
      }
      const pulse = 0.55 + Math.sin(p.tw + t * 0.001) * 0.45;
      const alpha = p.a * pulse;
      if (p.kind === 'star') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.tw * 0.15);
        ctx.fillStyle = `rgba(255, 230, 245, ${alpha})`;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          ctx.lineTo(0, p.r * 2.2);
          ctx.lineTo(p.r * 0.45, p.r * 0.45);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.fillStyle = `rgba(190, 220, 255, ${alpha})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (!reduce) raf = requestAnimationFrame(draw);
  };

  const onVisibility = () => {
    cancelAnimationFrame(raf);
    if (!document.hidden && !reduce) raf = requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibility);
  if (reduce) draw(0);
  else if (!document.hidden) raf = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
