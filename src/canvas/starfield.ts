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

export class Starfield {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stars: BgStar[] = [];
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
  private wordMeteorHover = false;
  private maxMeteors = 7;
  private hoveredNav: NavStarHit | null = null;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private onNavClick: (hit: NavStarHit) => void;
  private onMouseMoveBound: (e: MouseEvent) => void;
  private onMouseLeaveBound: () => void;
  private onClickBound: (e: MouseEvent) => void;
  private onScrollBound: () => void;
  private resizeTimer = 0;

  constructor(canvas: HTMLCanvasElement, onNavClick: (hit: NavStarHit) => void) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D 不可用');
    this.ctx = ctx;
    this.onNavClick = onNavClick;
    this.onMouseMoveBound = (e) => this.onMouseMove(e);
    this.onMouseLeaveBound = () => this.onMouseLeave();
    this.onClickBound = (e) => this.onNavStarClick(e);
    this.onScrollBound = () => {
      this.scrollY = window.scrollY || window.pageYOffset || 0;
      const vh = window.innerHeight || 1;
      this.onHoleScreen = Math.round(this.scrollY / vh) >= 1;
    };
    this.bindEvents();
    this.initSize();
  }

  setNavStars(stars: NavStar[]): void {
    this.navConfig = stars;
    this.navStars = layoutNavStars(stars, this.w, this.h);
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
    window.addEventListener('scroll', this.onScrollBound, { passive: true });
    this.loop(performance.now());
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    document.body.classList.remove('fp-meteor-word-hover');
    window.removeEventListener('mousemove', this.onMouseMoveBound);
    window.removeEventListener('mouseleave', this.onMouseLeaveBound);
    document.removeEventListener('click', this.onClickBound, true);
    window.removeEventListener('scroll', this.onScrollBound);
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => this.initSize(), 100);
    });
  }

  /** 地球 canvas 在上层，需在捕获阶段命中导航恒星 */
  private onNavStarClick(event: MouseEvent): void {
    if (this.onHoleScreen) return;

    const hit = hitTestNavStars(this.navStars, event.clientX, event.clientY);
    if (!hit) return;

    event.preventDefault();
    event.stopPropagation();
    this.onNavClick(hit);
  }

  private initSize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.maxMeteors = this.w < 768 ? 4 : 7;
    this.meteors = [];
    this.nextMeteorAt = performance.now() + this.randomMeteorDelay();
    this.navStars = layoutNavStars(this.navConfig, this.w, this.h);
    this.seedStars();
  }

  private seedStars(): void {
    const count = this.w < 768 ? 280 : 480;
    this.stars = Array.from({ length: count }, () => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      r: Math.random() * 0.9 + 0.15,
      base: 0.12 + Math.random() * 0.45,
      tw: Math.random() * Math.PI * 2,
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
    const fontSize = ((this.w < 768 ? 14 : 16) + Math.min(6, (m.text.length + (m.author ? m.author.length * 0.5 : 0)) * 0.11)) * scale;
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

  private drawMeteor(ctx: CanvasRenderingContext2D, m: Meteor): void {
    const head = this.meteorHead(m);
    const a = Math.max(0, m.alpha);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.drawMeteorStreak(ctx, m, head, a);
    this.drawMeteorText(ctx, m, head, a);
    ctx.restore();
  }

  private onMouseMove(event: MouseEvent): void {
    this.mouseX = event.clientX;
    this.mouseY = event.clientY;
    this.hoveredNav = hitTestNavStars(this.navStars, this.mouseX, this.mouseY);
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
    this.hoveredNav = null;
    if (!this.wordMeteorHover) this.canvas.style.cursor = 'default';
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    this.draw(now);
    this.raf = requestAnimationFrame(this.loop);
  };

  private draw(now: number): void {
    const { ctx, w, h } = this;
    let offY = -(this.scrollY * 0.04);
    offY = ((offY % h) + h) % h;

    ctx.fillStyle = '#030408';
    ctx.fillRect(0, 0, w, h);

    const nebula = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.35, w * 0.55);
    nebula.addColorStop(0, 'rgba(40, 70, 130, 0.12)');
    nebula.addColorStop(1, 'rgba(3, 4, 8, 0)');
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, w, h);

    for (const s of this.stars) {
      let py = s.y + offY;
      if (py >= h) py -= h;
      s.tw += 0.008 + s.r * 0.01;
      const alpha = s.base + Math.sin(s.tw) * 0.08;
      ctx.beginPath();
      ctx.fillStyle = `rgba(210, 225, 255, ${alpha})`;
      ctx.arc(s.x, py, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    this.updateMeteors(now);
    for (const m of this.meteors) this.drawMeteor(ctx, m);

    drawNavStars(ctx, this.navStars, now, this.onHoleScreen ? null : this.hoveredNav);
  }
}
