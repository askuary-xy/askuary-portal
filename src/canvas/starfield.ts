import type { MeteorWord, NavStar } from '../types/config';
import {
  drawNavStars,
  hitTestNavStars,
  layoutNavStars,
  type NavStarHit,
  type NavStarRender,
} from './nav-stars';

interface BgStar {
  x: number;
  y: number;
  r: number;
  base: number;
  tw: number;
  /** 0 远 / 1 中 / 2 近 */
  layer: 0 | 1 | 2;
  /** rgb 通道 */
  cr: number;
  cg: number;
  cb: number;
  driftX: number;
  driftY: number;
}

interface DustMote {
  x: number;
  y: number;
  r: number;
  a: number;
  vx: number;
  vy: number;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseVx: number;
  baseVy: number;
  len: number;
  width: number;
  alpha: number;
  fade: number;
  kind: 'word' | 'streak';
  text: string;
  author: string;
  textScale: number;
  speedMul: number;
  hover: number;
  textReveal: number;
  hitPad: number;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function distPointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function lerp(current: number, target: number, rate: number): number {
  return current + (target - current) * rate;
}

export type StarfieldOptions = {
  /** 低分辨率最近邻放大，像素宇宙观感 */
  pixelMode?: boolean;
  /** 像素模式下的缩小倍率（越大颗粒越粗） */
  pixelScale?: number;
  /** DOM 恒星标签层（CSS 像素字，避免 canvas 低分撕字） */
  labelHost?: HTMLElement | null;
  /** DOM 流星文案层 */
  meteorHost?: HTMLElement | null;
};

export class Starfield {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private labelHost: HTMLElement | null = null;
  private meteorHost: HTMLElement | null = null;
  private stars: BgStar[] = [];
  private dust: DustMote[] = [];
  private meteors: Meteor[] = [];
  private navStars: NavStarRender[] = [];
  private navConfig: NavStar[] = [];
  private meteorWords: MeteorWord[] = [];
  private raf = 0;
  private running = false;
  private scrollY = 0;
  private onHoleScreen = false;
  private nextMeteorAt = 0;
  private meteorsEnabled = !prefersReducedMotion();
  private mouseX = -9999;
  private mouseY = -9999;
  private parallaxX = 0;
  private parallaxY = 0;
  private targetParallaxX = 0;
  private targetParallaxY = 0;
  private wordMeteorHover = false;
  private maxMeteors = 7;
  private hoveredNav: NavStarHit | null = null;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private nebulaSpin = 0;
  private pixelMode = false;
  private pixelScale = 3;
  private onNavClick: (hit: NavStarHit) => void;
  private onMouseMoveBound: (e: MouseEvent) => void;
  private onMouseLeaveBound: () => void;
  private onClickBound: (e: MouseEvent) => void;
  private onTouchEndBound: (e: TouchEvent) => void;
  private onScrollBound: () => void;
  private onVisibilityBound: () => void;
  private resizeTimer = 0;
  /** 触摸已激活导航恒星时，抑制随后的兼容 click，避免重复打开 */
  private navTouchHandledAt = 0;

  constructor(
    canvas: HTMLCanvasElement,
    onNavClick: (hit: NavStarHit) => void,
    options: StarfieldOptions = {},
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D 不可用');
    this.ctx = ctx;
    this.pixelMode = options.pixelMode === true;
    this.pixelScale = Math.max(2, Math.min(5, options.pixelScale ?? 3));
    this.labelHost = options.labelHost ?? null;
    this.meteorHost = options.meteorHost ?? null;
    this.onNavClick = onNavClick;
    this.onMouseMoveBound = (e) => this.onMouseMove(e);
    this.onMouseLeaveBound = () => this.onMouseLeave();
    this.onClickBound = (e) => this.onNavStarClick(e);
    this.onTouchEndBound = (e) => this.onNavStarTouchEnd(e);
    this.onScrollBound = () => {
      this.scrollY = window.scrollY || window.pageYOffset || 0;
      const vh = window.innerHeight || 1;
      this.onHoleScreen = Math.round(this.scrollY / vh) >= 1;
    };
    this.onVisibilityBound = () => {
      cancelAnimationFrame(this.raf);
      if (this.running && !document.hidden) {
        this.loop(performance.now());
      }
    };
    this.bindEvents();
    this.initSize();
  }

  setNavStars(stars: NavStar[]): void {
    this.navConfig = stars;
    this.navStars = layoutNavStars(stars, this.w, this.h);
    this.syncDomLabels(true);
  }

  setMeteorWords(words: MeteorWord[]): void {
    this.meteorWords = words;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.nextMeteorAt = performance.now() + this.randomMeteorDelay();
    window.addEventListener('mousemove', this.onMouseMoveBound, { passive: true });
    window.addEventListener('mouseleave', this.onMouseLeaveBound);
    document.addEventListener('click', this.onClickBound, true);
    // 须在地球 canvas 的 touchend 之前捕获，否则 preventDefault 会吞掉恒星点击
    document.addEventListener('touchend', this.onTouchEndBound, { capture: true, passive: false });
    document.addEventListener('visibilitychange', this.onVisibilityBound);
    window.addEventListener('scroll', this.onScrollBound, { passive: true });
    if (!document.hidden) this.loop(performance.now());
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    document.body.classList.remove('fp-meteor-word-hover');
    if (this.labelHost) this.labelHost.innerHTML = '';
    if (this.meteorHost) this.meteorHost.innerHTML = '';
    window.removeEventListener('mousemove', this.onMouseMoveBound);
    window.removeEventListener('mouseleave', this.onMouseLeaveBound);
    document.removeEventListener('click', this.onClickBound, true);
    document.removeEventListener('touchend', this.onTouchEndBound, true);
    document.removeEventListener('visibilitychange', this.onVisibilityBound);
    window.removeEventListener('scroll', this.onScrollBound);
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => this.initSize(), 100);
    });
  }

  /** 将视口坐标换算到 canvas 逻辑像素（与绘制坐标一致） */
  private toCanvasPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const rw = rect.width || 1;
    const rh = rect.height || 1;
    return {
      x: (clientX - rect.left) * (this.w / rw),
      y: (clientY - rect.top) * (this.h / rh),
    };
  }

  private hitNavAtClient(clientX: number, clientY: number): NavStarHit | null {
    if (this.onHoleScreen) return null;
    const p = this.toCanvasPoint(clientX, clientY);
    const mobile = this.w < 720;
    // 手机命中半径贴合光晕即可；过大易误触、也挡光点取消
    return hitTestNavStars(this.navStars, p.x, p.y, mobile ? 5.2 : 5.5, {
      includeLabel: false,
    });
  }

  /** 地球 canvas 在上层，需在捕获阶段命中导航恒星 */
  private onNavStarClick(event: MouseEvent): void {
    if (performance.now() - this.navTouchHandledAt < 450) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const hit = this.hitNavAtClient(event.clientX, event.clientY);
    if (!hit) return;

    event.preventDefault();
    event.stopPropagation();
    this.onNavClick(hit);
  }

  private onNavStarTouchEnd(event: TouchEvent): void {
    if (this.onHoleScreen) return;
    const touch = event.changedTouches?.[0];
    if (!touch) return;

    const hit = this.hitNavAtClient(touch.clientX, touch.clientY);
    if (!hit) return;

    this.navTouchHandledAt = performance.now();
    event.preventDefault();
    event.stopPropagation();
    this.onNavClick(hit);
  }

  private initSize(): void {
    const cssW = window.innerWidth || document.documentElement.clientWidth || 1;
    const cssH = window.innerHeight || document.documentElement.clientHeight || 1;

    if (this.pixelMode) {
      // 低分辨率缓冲 + CSS 拉伸，得到芯片机像素宇宙
      this.dpr = 1;
      this.w = Math.max(1, Math.floor(cssW / this.pixelScale));
      this.h = Math.max(1, Math.floor(cssH / this.pixelScale));
      this.canvas.width = this.w;
      this.canvas.height = this.h;
      this.canvas.style.width = `${cssW}px`;
      this.canvas.style.height = `${cssH}px`;
      this.canvas.style.imageRendering = 'pixelated';
      (this.canvas.style as CSSStyleDeclaration & { msInterpolationMode?: string }).msInterpolationMode =
        'nearest-neighbor';
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.imageSmoothingEnabled = false;
      this.maxMeteors = this.w < 280 ? 3 : 5;
    } else {
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      // 始终用视口尺寸，避免首屏 getBoundingClientRect 为 0 时把恒星画爆
      this.w = cssW;
      this.h = cssH;
      this.canvas.width = Math.floor(this.w * this.dpr);
      this.canvas.height = Math.floor(this.h * this.dpr);
      this.canvas.style.width = `${this.w}px`;
      this.canvas.style.height = `${this.h}px`;
      this.canvas.style.imageRendering = 'auto';
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.maxMeteors = this.w < 768 ? 4 : 7;
    }

    this.meteors = [];
    this.nextMeteorAt = performance.now() + this.randomMeteorDelay();
    this.navStars = layoutNavStars(this.navConfig, this.w, this.h);
    this.seedStars();
    this.syncDomLabels(true);
  }

  private starTint(): { cr: number; cg: number; cb: number } {
    const roll = Math.random();
    if (roll < 0.18) return { cr: 170, cg: 205, cb: 255 }; // 冷蓝
    if (roll < 0.32) return { cr: 255, cg: 230, cb: 190 }; // 暖黄
    if (roll < 0.4) return { cr: 255, cg: 210, cb: 210 }; // 微红
    return { cr: 220, cg: 232, cb: 255 }; // 白蓝
  }

  private seedStars(): void {
    const mobile = this.pixelMode ? this.w < 280 : this.w < 768;
    const far = this.pixelMode ? (mobile ? 70 : 110) : mobile ? 160 : 260;
    const mid = this.pixelMode ? (mobile ? 48 : 72) : mobile ? 120 : 200;
    const near = this.pixelMode ? (mobile ? 28 : 42) : mobile ? 70 : 120;
    const stars: BgStar[] = [];

    const push = (layer: 0 | 1 | 2, n: number, rMin: number, rMax: number, baseMin: number, baseMax: number) => {
      for (let i = 0; i < n; i++) {
        const tint = this.starTint();
        stars.push({
          x: Math.random() * this.w,
          y: Math.random() * this.h,
          r: rMin + Math.random() * (rMax - rMin),
          base: baseMin + Math.random() * (baseMax - baseMin),
          tw: Math.random() * Math.PI * 2,
          layer,
          cr: tint.cr,
          cg: tint.cg,
          cb: tint.cb,
          driftX: (Math.random() - 0.5) * (0.01 + layer * 0.012),
          driftY: (Math.random() - 0.5) * (0.008 + layer * 0.01),
        });
      }
    };

    if (this.pixelMode) {
      push(0, far, 1, 1, 0.2, 0.55);
      push(1, mid, 1, 2, 0.35, 0.75);
      push(2, near, 2, 3, 0.5, 0.95);
    } else {
      push(0, far, 0.12, 0.55, 0.08, 0.32);
      push(1, mid, 0.25, 0.95, 0.14, 0.48);
      push(2, near, 0.45, 1.45, 0.22, 0.62);
    }
    this.stars = stars;

    const dustN = this.pixelMode ? (mobile ? 18 : 28) : mobile ? 36 : 64;
    this.dust = Array.from({ length: dustN }, () => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      r: this.pixelMode ? 1 : 0.4 + Math.random() * 1.4,
      a: 0.03 + Math.random() * 0.07,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.08,
    }));
  }

  private randomMeteorDelay(): number {
    return 700 + Math.random() * 2400;
  }

  private normalizeWordEntry(entry: MeteorWord | string | null | undefined): MeteorWord | null {
    if (!entry) return null;
    if (typeof entry === 'string') {
      const trimmed = entry.trim();
      return trimmed ? { text: trimmed, author: '' } : null;
    }
    const text = String(entry.text || '').trim();
    if (!text) return null;
    return { text, author: String(entry.author || '').trim() };
  }

  private pickMeteorWord(): MeteorWord | null {
    if (!this.meteorWords.length) return null;
    const raw = this.meteorWords[Math.floor(Math.random() * this.meteorWords.length)];
    return this.normalizeWordEntry(raw);
  }

  private spawnMeteor(forceWord?: boolean): void {
    if (!this.meteorsEnabled || this.meteors.length >= this.maxMeteors) return;

    let wordEntry: MeteorWord | null = null;
    let isWord = false;
    if (this.meteorWords.length) {
      isWord = forceWord === true || Math.random() < 0.34;
      if (isWord) {
        wordEntry = this.pickMeteorWord();
        if (!wordEntry) isWord = false;
      }
    }

    const angle = Math.PI * 0.22 + (Math.random() - 0.5) * 0.18;
    const streakSpeed = (this.w < 768 ? 9 : 11) + Math.random() * 10;
    const speed = isWord ? streakSpeed * (0.14 + Math.random() * 0.08) : streakSpeed;

    let x: number;
    let y: number;
    if (Math.random() > 0.35) {
      x = Math.random() * (this.w + this.w * 0.35);
      y = -30 - Math.random() * this.h * 0.25;
    } else {
      x = -40 - Math.random() * this.w * 0.2;
      y = Math.random() * this.h * 0.55;
    }

    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const textLen = isWord && wordEntry ? wordEntry.text.length : 0;
    const authorLen = isWord && wordEntry?.author ? wordEntry.author.length : 0;
    const charScore = textLen + authorLen * 0.5;
    const textScale = isWord ? 1 + Math.min(0.42, charScore * 0.016) : 1;
    const lenBoost = isWord ? Math.min(90, charScore * 2.4) : 0;
    const widthBoost = isWord ? Math.min(1.5, charScore * 0.028) : 0;
    const baseHit = this.w < 768 ? 48 : 58;

    this.meteors.push({
      x,
      y,
      vx,
      vy,
      baseVx: vx,
      baseVy: vy,
      len: ((isWord ? 120 : 70) + Math.random() * (this.w < 768 ? 110 : 160)) + lenBoost,
      width: isWord ? (1 + Math.random() * 0.7 + widthBoost) * textScale : 0.8 + Math.random() * 1.4,
      alpha: 0.6 + Math.random() * 0.35,
      fade: isWord ? 0.0028 + Math.random() * 0.0025 : 0.011 + Math.random() * 0.007,
      kind: isWord ? 'word' : 'streak',
      text: wordEntry?.text ?? '',
      author: wordEntry?.author ?? '',
      textScale,
      speedMul: 1,
      hover: 0,
      textReveal: 0,
      hitPad: isWord ? baseHit * textScale : 18,
    });
  }

  private meteorHead(m: Meteor) {
    const mag = Math.hypot(m.vx, m.vy) || 1;
    return {
      nx: m.vx / mag,
      ny: m.vy / mag,
      headX: m.x + (m.vx / mag) * 6,
      headY: m.y + (m.vy / mag) * 6,
    };
  }

  private isMeteorHovered(m: Meteor): boolean {
    const head = this.meteorHead(m);
    const tailX = m.x - head.nx * m.len;
    const tailY = m.y - head.ny * m.len;
    const dist = distPointToSegment(this.mouseX, this.mouseY, tailX, tailY, head.headX, head.headY);
    const pad = m.hitPad + (m.kind === 'word' ? m.len * 0.14 : 0);
    return dist <= pad;
  }

  private updateMeteors(now: number): void {
    if (!this.meteorsEnabled) return;

    if (now >= this.nextMeteorAt) {
      this.spawnMeteor();
      if (Math.random() < 0.28 && this.meteors.length < this.maxMeteors) {
        this.spawnMeteor(this.meteorWords.length > 0 && Math.random() < 0.5);
      }
      this.nextMeteorAt = now + this.randomMeteorDelay();
    }

    this.wordMeteorHover = false;
    const next: Meteor[] = [];

    for (const m of this.meteors) {
      const hovered = this.isMeteorHovered(m);

      if (m.kind === 'word') {
        if (hovered) {
          this.wordMeteorHover = true;
          m.hover = Math.min(1, m.hover + 0.14);
          m.textReveal = Math.min(1, m.textReveal + 0.18);
          m.speedMul = lerp(m.speedMul, 0.06, 0.11);
        } else {
          m.hover = Math.max(0, m.hover - 0.05);
          m.textReveal = Math.max(0, m.textReveal - 0.07);
          m.speedMul = lerp(m.speedMul, 1, 0.04);
        }
      } else if (hovered) {
        m.hover = Math.min(1, m.hover + 0.12);
        m.speedMul = lerp(m.speedMul, 0.2, 0.1);
      } else {
        m.hover = Math.max(0, m.hover - 0.06);
        m.speedMul = lerp(m.speedMul, 1, 0.06);
      }

      m.vx = m.baseVx * m.speedMul;
      m.vy = m.baseVy * m.speedMul;
      m.x += m.vx;
      m.y += m.vy;

      let fadeRate = m.fade;
      if (m.kind === 'word' && m.textReveal > 0.05) fadeRate *= 0.22;
      m.alpha -= fadeRate * (0.55 + m.hover * 0.25);

      if (
        m.alpha > 0.02 &&
        m.x > -m.len * 2 &&
        m.x < this.w + m.len * 2 &&
        m.y > -m.len * 2 &&
        m.y < this.h + m.len * 2
      ) {
        next.push(m);
      }
    }

    this.meteors = next;
    document.body.classList.toggle('fp-meteor-word-hover', this.wordMeteorHover);
  }

  private drawMeteorStreak(ctx: CanvasRenderingContext2D, m: Meteor, head: ReturnType<Starfield['meteorHead']>, a: number): void {
    const tailX = m.x - head.nx * m.len;
    const tailY = m.y - head.ny * m.len;
    const glow = 1 + m.hover * 0.45;
    const streakAlpha = m.kind === 'word' && m.textReveal < 0.05 ? a * 0.82 : a;

    if (this.pixelMode) {
      const steps = Math.max(3, Math.floor(m.len / 2));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = Math.round(tailX + (head.headX - tailX) * t);
        const y = Math.round(tailY + (head.headY - tailY) * t);
        const size = i > steps - 2 ? 2 : 1;
        ctx.fillStyle = `rgba(210, 230, 255, ${streakAlpha * (0.25 + t * 0.75) * glow})`;
        ctx.fillRect(x, y, size, size);
      }
      ctx.fillStyle = `rgba(255, 255, 255, ${streakAlpha * glow})`;
      ctx.fillRect(Math.round(head.headX), Math.round(head.headY), 2, 2);
      return;
    }

    const grad = ctx.createLinearGradient(tailX, tailY, head.headX, head.headY);
    grad.addColorStop(0, 'rgba(140, 170, 230, 0)');
    grad.addColorStop(0.55, `rgba(190, 215, 255, ${streakAlpha * 0.24 * glow})`);
    grad.addColorStop(0.88, `rgba(230, 242, 255, ${streakAlpha * 0.78 * glow})`);
    grad.addColorStop(1, `rgba(255, 255, 255, ${streakAlpha * glow})`);

    ctx.lineCap = 'round';
    ctx.strokeStyle = grad;
    ctx.lineWidth = m.width * (1 + m.hover * 0.2);
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(head.headX, head.headY);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 255, 255, ${streakAlpha * 0.95 * glow})`;
    ctx.arc(head.headX, head.headY, m.width * (1.1 + m.hover * 0.25), 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = `rgba(180, 210, 255, ${streakAlpha * (0.3 + m.hover * 0.18)})`;
    ctx.arc(head.headX, head.headY, m.width * (3 + m.hover * 1.5), 0, Math.PI * 2);
    ctx.fill();
  }

  private wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    let current = '';
    for (const ch of text) {
      const test = current + ch;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = ch;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines.slice(0, 4);
  }

  private drawMeteorText(ctx: CanvasRenderingContext2D, m: Meteor, head: ReturnType<Starfield['meteorHead']>, a: number): void {
    if (m.kind !== 'word' || !m.text || m.textReveal <= 0.02) return;

    const reveal = m.textReveal;
    const eased = reveal * reveal * (3 - 2 * reveal);
    const scale = m.textScale || 1;
    const fontSize =
      ((this.w < 768 ? 14 : 16) + Math.min(6, (m.text.length + (m.author ? m.author.length * 0.5 : 0)) * 0.11)) * scale;
    const authorSize = (this.w < 768 ? 11 : 12) * scale;
    const textAlpha = a * eased;
    const maxWidth = (this.w < 768 ? 240 : 300) * scale;
    const lineHeight = fontSize * 1.45;
    const yOffset = -12 - eased * 6;

    ctx.save();
    ctx.translate(head.headX, head.headY + yOffset);
    ctx.scale(0.88 + eased * 0.12, 0.88 + eased * 0.12);
    ctx.font = `600 ${fontSize}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = `rgba(160, 210, 255, ${textAlpha * 0.85})`;
    ctx.shadowBlur = 14 + eased * 10;

    const lines = this.wrapCanvasText(ctx, m.text, maxWidth);
    const blockHeight = lines.length * lineHeight + (m.author ? authorSize * 1.6 : 0);
    const startY = -blockHeight / 2;

    lines.forEach((line, i) => {
      ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
      ctx.fillText(line, 0, startY + i * lineHeight);
    });

    if (m.author) {
      ctx.shadowBlur = 8;
      ctx.font = `500 ${authorSize}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
      ctx.fillStyle = `rgba(200, 225, 255, ${textAlpha * 0.82})`;
      ctx.fillText(`— ${m.author}`, 0, startY + lines.length * lineHeight + 4);
    }

    ctx.restore();
  }

  private drawMeteor(ctx: CanvasRenderingContext2D, m: Meteor, skipText = false): void {
    const head = this.meteorHead(m);
    const a = Math.max(0, m.alpha);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.drawMeteorStreak(ctx, m, head, a);
    if (!skipText) this.drawMeteorText(ctx, m, head, a);
    ctx.restore();
  }

  private syncDomLabels(force = false): void {
    const host = this.labelHost;
    if (!host || !this.pixelMode) return;
    if (this.onHoleScreen) {
      host.replaceChildren();
      return;
    }
    const scale = this.pixelScale;
    const needed = this.navStars.length;
    if (force || host.childElementCount !== needed) {
      host.replaceChildren();
      for (let i = 0; i < needed; i++) {
        const el = document.createElement('span');
        el.className = 'fp-nav-label';
        host.appendChild(el);
      }
    }
    const kids = host.children;
    for (let i = 0; i < needed; i++) {
      const s = this.navStars[i];
      const el = kids[i] as HTMLElement;
      if (el.textContent !== s.label) el.textContent = s.label;
      const isHover = this.hoveredNav?.index === i;
      el.classList.toggle('is-hover', isHover);
      el.classList.toggle('is-disabled', s.enabled === false);
      el.style.transform = `translate(${Math.round(s.px * scale)}px, ${Math.round(s.py * scale)}px) translate(-50%, -130%)`;
    }
  }

  private syncDomMeteors(): void {
    const host = this.meteorHost;
    if (!host || !this.pixelMode) return;
    if (this.onHoleScreen) {
      host.replaceChildren();
      return;
    }
    const scale = this.pixelScale;
    const words = this.meteors.filter((m) => m.kind === 'word' && m.text && m.textReveal > 0.02 && m.alpha > 0.05);
    if (host.childElementCount !== words.length) {
      host.replaceChildren();
      for (let i = 0; i < words.length; i++) {
        const el = document.createElement('div');
        el.className = 'fp-meteor-word';
        el.innerHTML = `<span class="fp-meteor-word-text"></span><span class="fp-meteor-word-author"></span>`;
        host.appendChild(el);
      }
    }
    const kids = host.children;
    for (let i = 0; i < words.length; i++) {
      const m = words[i];
      const head = this.meteorHead(m);
      const el = kids[i] as HTMLElement;
      const textEl = el.querySelector('.fp-meteor-word-text') as HTMLElement | null;
      const authorEl = el.querySelector('.fp-meteor-word-author') as HTMLElement | null;
      if (textEl && textEl.textContent !== m.text) textEl.textContent = m.text;
      if (authorEl) {
        const author = m.author ? `— ${m.author}` : '';
        if (authorEl.textContent !== author) authorEl.textContent = author;
        authorEl.hidden = !m.author;
      }
      const reveal = m.textReveal;
      const eased = reveal * reveal * (3 - 2 * reveal);
      el.style.opacity = String(Math.max(0, Math.min(1, m.alpha * eased)));
      el.style.transform = `translate(${Math.round(head.headX * scale)}px, ${Math.round(head.headY * scale)}px) translate(-50%, -120%)`;
    }
  }

  private onMouseMove(event: MouseEvent): void {
    const p = this.toCanvasPoint(event.clientX, event.clientY);
    this.mouseX = p.x;
    this.mouseY = p.y;
    this.targetParallaxX = ((p.x / Math.max(1, this.w)) - 0.5) * 2;
    this.targetParallaxY = ((p.y / Math.max(1, this.h)) - 0.5) * 2;
    const compact = this.pixelMode ? this.w < 280 : this.w < 720;
    this.hoveredNav = hitTestNavStars(
      this.navStars,
      this.mouseX,
      this.mouseY,
      this.pixelMode ? (compact ? 4.2 : 3.6) : compact ? 9.5 : 5.5,
      { includeLabel: this.pixelMode || compact },
    );
    const onHole = this.onHoleScreen;
    if (!onHole && this.hoveredNav && !this.wordMeteorHover) {
      this.canvas.style.cursor = 'pointer';
    } else if (!this.wordMeteorHover) {
      this.canvas.style.cursor = 'default';
    }
  }

  private onMouseLeave(): void {
    this.mouseX = -9999;
    this.mouseY = -9999;
    this.targetParallaxX = 0;
    this.targetParallaxY = 0;
    this.hoveredNav = null;
    if (!this.wordMeteorHover) this.canvas.style.cursor = 'default';
  }

  private drawNebulae(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.nebulaSpin += this.pixelMode ? 0.0009 : 0.00035;
    const spin = this.nebulaSpin;
    const px = this.parallaxX * (this.pixelMode ? 6 : 18);
    const py = this.parallaxY * (this.pixelMode ? 4 : 12);

    if (this.pixelMode) {
      // 像素模式不要星云色带/色块，避免被看成横光条
      return;
    }

    const blobs: Array<{ x: number; y: number; r: number; c0: string; c1: string }> = [
      {
        x: w * 0.28 + Math.cos(spin) * 20 + px * 0.35,
        y: h * 0.32 + Math.sin(spin * 0.8) * 16 + py * 0.35,
        r: w * 0.42,
        c0: 'rgba(60, 90, 170, 0.14)',
        c1: 'rgba(3, 4, 8, 0)',
      },
      {
        x: w * 0.72 + Math.sin(spin * 0.7) * 24 - px * 0.25,
        y: h * 0.55 + Math.cos(spin * 0.9) * 18 - py * 0.25,
        r: w * 0.38,
        c0: 'rgba(90, 50, 140, 0.1)',
        c1: 'rgba(3, 4, 8, 0)',
      },
      {
        x: w * 0.52 + Math.cos(spin * 1.1) * 12 + px * 0.15,
        y: h * 0.18 + Math.sin(spin) * 10 + py * 0.15,
        r: w * 0.3,
        c0: 'rgba(40, 120, 150, 0.08)',
        c1: 'rgba(3, 4, 8, 0)',
      },
    ];

    for (const b of blobs) {
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, b.c0);
      g.addColorStop(1, b.c1);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // 淡银河带
    ctx.save();
    ctx.translate(w * 0.5 + px * 0.2, h * 0.48 + py * 0.2);
    ctx.rotate(-0.45 + Math.sin(spin) * 0.03);
    const band = ctx.createLinearGradient(0, -h * 0.08, 0, h * 0.08);
    band.addColorStop(0, 'rgba(140, 170, 255, 0)');
    band.addColorStop(0.5, 'rgba(160, 190, 255, 0.045)');
    band.addColorStop(1, 'rgba(140, 170, 255, 0)');
    ctx.fillStyle = band;
    ctx.fillRect(-w * 0.7, -h * 0.1, w * 1.4, h * 0.2);
    ctx.restore();
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    this.draw(now);
    this.raf = requestAnimationFrame(this.loop);
  };

  private draw(now: number): void {
    const { ctx, w, h } = this;
    this.parallaxX = lerp(this.parallaxX, this.targetParallaxX, 0.045);
    this.parallaxY = lerp(this.parallaxY, this.targetParallaxY, 0.045);

    const scrollFactor = [0.018, 0.04, 0.07];
    const mouseFactor = [6, 14, 28];

    ctx.fillStyle = '#030408';
    ctx.fillRect(0, 0, w, h);
    this.drawNebulae(ctx, w, h);

    // 宇宙尘埃
    for (const d of this.dust) {
      d.x += d.vx + this.parallaxX * 0.15;
      d.y += d.vy + this.parallaxY * 0.1;
      if (d.x < -4) d.x = w + 4;
      if (d.x > w + 4) d.x = -4;
      if (d.y < -4) d.y = h + 4;
      if (d.y > h + 4) d.y = -4;
      ctx.fillStyle = `rgba(190, 210, 255, ${d.a})`;
      if (this.pixelMode) {
        ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 1);
      } else {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const s of this.stars) {
      const layer = s.layer;
      let offY = -(this.scrollY * scrollFactor[layer] * (this.pixelMode ? 0.35 : 1));
      offY = ((offY % h) + h) % h;
      s.x += s.driftX;
      s.y += s.driftY;
      if (s.x < 0) s.x += w;
      if (s.x > w) s.x -= w;
      if (s.y < 0) s.y += h;
      if (s.y > h) s.y -= h;

      const px = s.x + this.parallaxX * mouseFactor[layer] * (this.pixelMode ? 0.35 : 1);
      let py = s.y + offY + this.parallaxY * mouseFactor[layer] * (this.pixelMode ? 0.25 : 0.65);
      if (py >= h) py -= h;
      if (py < 0) py += h;

      // 像素模式：慢而轻的闪烁，避免满屏刺眼
      s.tw += this.pixelMode ? 0.012 + layer * 0.004 : 0.007 + s.r * 0.012 + layer * 0.002;
      const twinkle = Math.sin(s.tw) * (this.pixelMode ? 0.16 + layer * 0.06 : 0.12 + layer * 0.07);
      const alpha = Math.max(0.04, Math.min(0.92, s.base + twinkle));

      ctx.fillStyle = `rgba(${s.cr}, ${s.cg}, ${s.cb}, ${alpha})`;
      if (this.pixelMode) {
        const size = Math.max(1, Math.round(s.r));
        const x = Math.round(px);
        const y = Math.round(py);
        ctx.fillRect(x, y, size, size);
        // 近层偶发淡十字，阈值更高、更稀
        if (twinkle > 0.12 && layer === 2 && Math.sin(s.tw * 0.37) > 0.7) {
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.45})`;
          ctx.fillRect(x - 1, y + Math.floor(size / 2), size + 2, 1);
          ctx.fillRect(x + Math.floor(size / 2), y - 1, 1, size + 2);
        } else if (layer === 2 && size >= 2) {
          ctx.fillStyle = `rgba(${s.cr}, ${s.cg}, ${s.cb}, ${alpha * 0.28})`;
          ctx.fillRect(x - 1, y, 1, size);
          ctx.fillRect(x + size, y, 1, size);
          ctx.fillRect(x, y - 1, size, 1);
          ctx.fillRect(x, y + size, size, 1);
        }
      } else {
        ctx.beginPath();
        ctx.arc(px, py, s.r, 0, Math.PI * 2);
        ctx.fill();

        // 近层亮星加微光晕
        if (layer === 2 && s.r > 0.9) {
          ctx.beginPath();
          ctx.fillStyle = `rgba(${s.cr}, ${s.cg}, ${s.cb}, ${alpha * 0.18})`;
          ctx.arc(px, py, s.r * 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    this.updateMeteors(now);
    const useDomText = this.pixelMode && (!!this.labelHost || !!this.meteorHost);
    for (const m of this.meteors) this.drawMeteor(ctx, m, useDomText);

    drawNavStars(ctx, this.navStars, now, this.onHoleScreen ? null : this.hoveredNav, {
      showLabels: !useDomText && (this.pixelMode || this.w < 720) && !this.onHoleScreen,
      pixelMode: this.pixelMode,
      labelsOnOverlay: useDomText,
    });

    this.syncDomLabels();
    this.syncDomMeteors();
  }
}
