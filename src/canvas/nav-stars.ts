import type { NavStar } from '../types/config';

export interface NavStarRender extends NavStar {
  /** 实际像素坐标 */
  px: number;
  py: number;
  /** 脉冲相位 */
  phase: number;
  /** 基础半径 */
  radius: number;
}

export interface NavStarHit {
  star: NavStarRender;
  index: number;
}

/** 将配置转为可渲染的导航恒星，未指定 x/y 则按黄金角分布 */
export function layoutNavStars(
  stars: NavStar[],
  width: number,
  height: number,
): NavStarRender[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return stars.map((star, i) => {
    const x = star.x ?? 0.15 + (0.7 * ((i * golden) % (2 * Math.PI))) / (2 * Math.PI);
    const y = star.y ?? 0.15 + (0.7 * (((i * golden) * 0.618) % (2 * Math.PI))) / (2 * Math.PI);
    const margin = 48;
    return {
      ...star,
      px: margin + x * Math.max(0, width - margin * 2),
      py: margin + y * Math.max(0, height - margin * 2),
      phase: Math.random() * Math.PI * 2,
      radius: 5 + (star.label.length % 3),
    };
  });
}

export function drawNavStars(
  ctx: CanvasRenderingContext2D,
  stars: NavStarRender[],
  time: number,
  hovered: NavStarHit | null,
): void {
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    const pulse = 0.6 + 0.4 * Math.sin(time * 0.002 + s.phase);
    const isHover = hovered?.index === i;
    const isDisabled = s.enabled === false;
    const coreAlpha = isDisabled ? 0.45 : 1;
    const r = s.radius * (isHover ? 2.2 : 1.4) * pulse;
    const glow = ctx.createRadialGradient(s.px, s.py, 0, s.px, s.py, r * 6);
    glow.addColorStop(0, isHover ? 'rgba(255,220,140,0.95)' : isDisabled ? 'rgba(140,150,170,0.55)' : 'rgba(180,210,255,0.85)');
    glow.addColorStop(0.35, 'rgba(120,180,255,0.35)');
    glow.addColorStop(1, 'rgba(80,120,200,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.px, s.py, r * 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isHover ? '#fff8e8' : isDisabled ? 'rgba(200,210,230,0.7)' : '#ffffff';
    ctx.globalAlpha = coreAlpha;
    ctx.beginPath();
    ctx.arc(s.px, s.py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (isHover) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(s.px - r * 2.2, s.py);
      ctx.lineTo(s.px + r * 2.2, s.py);
      ctx.moveTo(s.px, s.py - r * 2.2);
      ctx.lineTo(s.px, s.py + r * 2.2);
      ctx.stroke();
    }

    if (isHover) {
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textAlign = 'center';
      ctx.fillText(s.label, s.px, s.py - r - 10);
    }
  }
}

export function hitTestNavStars(
  stars: NavStarRender[],
  x: number,
  y: number,
): NavStarHit | null {
  let best: NavStarHit | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    const d = Math.hypot(x - s.px, y - s.py);
    const hitR = s.radius * 5.5;
    if (d <= hitR && d < bestDist) {
      bestDist = d;
      best = { star: s, index: i };
    }
  }
  return best;
}
