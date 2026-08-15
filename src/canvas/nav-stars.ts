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
  const mobile = width < 720;
  const golden = Math.PI * (3 - Math.sqrt(5));
  return stars.map((star, i) => {
    let x = star.x ?? 0.15 + (0.7 * ((i * golden) % (2 * Math.PI))) / (2 * Math.PI);
    let y = star.y ?? 0.15 + (0.7 * (((i * golden) * 0.618) % (2 * Math.PI))) / (2 * Math.PI);

    // 手机端略往四角让，躲开中央小球体，留出中间与社交区
    if (mobile) {
      x = x < 0.5 ? Math.min(x, 0.17) : Math.max(x, 0.83);
      y = y < 0.5 ? Math.min(y, 0.13) : Math.max(y, 0.8);
    }

    const margin = mobile ? 28 : 48;
    return {
      ...star,
      px: margin + x * Math.max(0, width - margin * 2),
      py: margin + y * Math.max(0, height - margin * 2),
      phase: Math.random() * Math.PI * 2,
      // 略大于背景星即可，避免抢戏
      radius: mobile ? 3.2 + (star.label.length % 2) * 0.4 : 3.8 + (star.label.length % 3) * 0.35,
    };
  });
}

export function drawNavStars(
  ctx: CanvasRenderingContext2D,
  stars: NavStarRender[],
  time: number,
  hovered: NavStarHit | null,
  options: { showLabels?: boolean; pixelMode?: boolean; labelsOnOverlay?: boolean } = {},
): void {
  const showLabels = options.showLabels === true;
  const pixelMode = options.pixelMode === true;
  const labelsOnOverlay = options.labelsOnOverlay === true;
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    // 缓闪：振幅小、频率低，避免又大又刺眼
    const pulse = 0.9 + 0.1 * Math.sin(time * 0.0011 + s.phase);
    const isHover = hovered?.index === i;
    const isDisabled = s.enabled === false;
    const coreAlpha = isDisabled ? 0.38 : 0.55 + pulse * 0.12;

    if (pixelMode) {
      // 恒星明显大于背景星；亮度缓闪，少刺眼十字
      const size = Math.max(4, Math.round((s.radius / 1.2) * (isHover ? 1.35 : 1.15)));
      const x = Math.round(s.px - size / 2);
      const y = Math.round(s.py - size / 2);
      const softPulse = 0.88 + pulse * 0.08;
      ctx.globalAlpha = coreAlpha * softPulse;
      ctx.fillStyle = isHover ? '#ffd28a' : isDisabled ? '#8a93a8' : '#d8e8ff';
      ctx.fillRect(x - 1, y, size + 2, size);
      ctx.fillRect(x, y - 1, size, size + 2);
      ctx.fillStyle = isHover ? '#fff8e0' : '#ffffff';
      ctx.fillRect(x, y, size, size);
      ctx.globalAlpha = 1;

      if (!labelsOnOverlay && (isHover || showLabels)) {
        const lx = Math.round(s.px);
        const ly = Math.round(s.py - size - 5);
        ctx.font = '8px "Zpix", "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.strokeText(s.label, lx, ly);
        ctx.fillStyle = isHover ? '#fff8e0' : '#f2f7ff';
        ctx.fillText(s.label, lx, ly);
        ctx.textBaseline = 'alphabetic';
      }
      continue;
    }

    const r = s.radius * (isHover ? 1.55 : 1.1) * pulse;
    const glowR = r * 3.2;
    const glow = ctx.createRadialGradient(s.px, s.py, 0, s.px, s.py, glowR);
    glow.addColorStop(
      0,
      isHover
        ? 'rgba(255,220,140,0.55)'
        : isDisabled
          ? 'rgba(140,150,170,0.28)'
          : 'rgba(180,210,255,0.38)',
    );
    glow.addColorStop(0.45, 'rgba(120,180,255,0.12)');
    glow.addColorStop(1, 'rgba(80,120,200,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.px, s.py, glowR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isHover ? '#fff8e8' : isDisabled ? 'rgba(200,210,230,0.7)' : 'rgba(235,245,255,0.92)';
    ctx.globalAlpha = coreAlpha;
    ctx.beginPath();
    ctx.arc(s.px, s.py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (isHover) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(s.px - r * 1.8, s.py);
      ctx.lineTo(s.px + r * 1.8, s.py);
      ctx.moveTo(s.px, s.py - r * 1.8);
      ctx.lineTo(s.px, s.py + r * 1.8);
      ctx.stroke();
    }

    if (isHover || showLabels) {
      ctx.font = `${showLabels && !isHover ? 11 : 12}px system-ui, sans-serif`;
      ctx.fillStyle = isHover ? 'rgba(255,255,255,0.9)' : 'rgba(230,240,255,0.78)';
      ctx.textAlign = 'center';
      ctx.fillText(s.label, s.px, s.py - r - (showLabels ? 8 : 10));
    }
  }
}

export function hitTestNavStars(
  stars: NavStarRender[],
  x: number,
  y: number,
  hitScale = 5.5,
  options: { includeLabel?: boolean } = {},
): NavStarHit | null {
  let best: NavStarHit | null = null;
  let bestDist = Infinity;
  const includeLabel = options.includeLabel === true;
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    const hitR = s.radius * hitScale;
    const dStar = Math.hypot(x - s.px, y - s.py);
    let d = dStar;
    if (includeLabel) {
      const labelY = s.py - s.radius - 18;
      d = Math.min(d, Math.hypot(x - s.px, y - labelY));
    }
    if (d <= hitR && d < bestDist) {
      bestDist = d;
      best = { star: s, index: i };
    }
  }
  return best;
}
