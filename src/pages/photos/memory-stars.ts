/** 摄影页星空：缓慢飘动 + 鼠标视差 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

type Star = {
  x: number;
  y: number;
  z: number;
  r: number;
  a: number;
  tw: number;
  kind: 'star' | 'petal' | 'leaf' | 'snow' | 'spark';
};

export function detectSeason(date = new Date()): Season {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}

export function mountMemoryStars(
  canvas: HTMLCanvasElement | null,
  season: Season,
): () => void {
  if (!canvas) return () => undefined;
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => undefined;

  let raf = 0;
  let stars: Star[] = [];
  let mx = 0.5;
  let my = 0.5;
  let tx = 0.5;
  let ty = 0.5;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const kindForSeason = (): Star['kind'] => {
    const roll = Math.random();
    if (season === 'spring') return roll > 0.55 ? 'petal' : 'star';
    if (season === 'summer') return roll > 0.65 ? 'spark' : 'star';
    if (season === 'autumn') return roll > 0.55 ? 'leaf' : 'star';
    return roll > 0.5 ? 'snow' : 'star';
  };

  const spawn = (): Star => ({
    x: Math.random(),
    y: Math.random(),
    z: Math.random() * 0.8 + 0.2,
    r: Math.random() * 1.8 + 0.4,
    a: Math.random() * 0.55 + 0.25,
    tw: Math.random() * Math.PI * 2,
    kind: kindForSeason(),
  });

  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(70, Math.floor((window.innerWidth * window.innerHeight) / 16000));
    stars = Array.from({ length: n }, spawn);
  };

  const onMove = (e: MouseEvent) => {
    tx = e.clientX / window.innerWidth;
    ty = e.clientY / window.innerHeight;
  };

  const drawDeco = (s: Star, px: number, py: number, alpha: number) => {
    ctx.save();
    ctx.translate(px, py);
    ctx.globalAlpha = alpha;
    if (s.kind === 'petal') {
      ctx.fillStyle = 'rgba(255, 180, 210, 0.9)';
      ctx.beginPath();
      ctx.ellipse(0, 0, s.r * 1.6, s.r * 0.7, s.tw, 0, Math.PI * 2);
      ctx.fill();
    } else if (s.kind === 'leaf') {
      ctx.fillStyle = 'rgba(255, 150, 100, 0.85)';
      ctx.beginPath();
      ctx.moveTo(0, -s.r * 1.4);
      ctx.quadraticCurveTo(s.r * 1.2, 0, 0, s.r * 1.4);
      ctx.quadraticCurveTo(-s.r * 1.2, 0, 0, -s.r * 1.4);
      ctx.fill();
    } else if (s.kind === 'snow') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.beginPath();
      ctx.arc(0, 0, s.r * 1.1, 0, Math.PI * 2);
      ctx.fill();
    } else if (s.kind === 'spark') {
      ctx.fillStyle = 'rgba(255, 230, 160, 0.9)';
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.lineTo(0, s.r * 2);
        ctx.lineTo(s.r * 0.4, s.r * 0.4);
      }
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(220, 235, 255, 0.95)';
      ctx.beginPath();
      ctx.arc(0, 0, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const tick = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    mx += (tx - mx) * 0.06;
    my += (ty - my) * 0.06;
    ctx.clearRect(0, 0, w, h);

    const ox = (mx - 0.5) * 40;
    const oy = (my - 0.5) * 28;

    for (const s of stars) {
      if (!reduce) {
        s.y += 0.00035 * s.z;
        s.x += Math.sin(s.tw) * 0.00015 * s.z;
        s.tw += 0.015 + s.z * 0.01;
        if (s.y > 1.05) s.y = -0.05;
        if (s.x < -0.05) s.x = 1.05;
        if (s.x > 1.05) s.x = -0.05;
      }
      const px = s.x * w + ox * s.z;
      const py = s.y * h + oy * s.z;
      const pulse = 0.55 + Math.sin(s.tw) * 0.45;
      drawDeco(s, px, py, s.a * pulse);
    }
    raf = requestAnimationFrame(tick);
  };

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onMove, { passive: true });
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onMove);
  };
}
