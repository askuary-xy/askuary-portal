import type { MeteorWord } from '../types/config';
import {
  drawNavStars,
  hitTestNavStars,
  layoutNavStars,
  type NavStarHit,
  type NavStarRender,
} from './nav-stars';
import type { NavStar } from '../types/config';

interface BackgroundStar {
  x: number;
  y: number;
  z: number;
  r: number;
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

export class Starfield {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stars: BackgroundStar[] = [];
  private navStars: NavStarRender[] = [];
  private navConfig: NavStar[] = [];
  private meteorWords: MeteorWord[] = [];
  private raf = 0;
  private running = false;
  private mouseX = -9999;
  private mouseY = -9999;
  private hoveredNav: NavStarHit | null = null;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private onNavClick: (hit: NavStarHit) => void;

  constructor(canvas: HTMLCanvasElement, onNavClick: (hit: NavStarHit) => void) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D 不可用');
    this.ctx = ctx;
    this.onNavClick = onNavClick;
    this.bindEvents();
    this.resize();
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
    this.seedStars();
    this.loop(0);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private bindEvents(): void {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
      this.hoveredNav = hitTestNavStars(this.navStars, this.mouseX, this.mouseY);
      this.canvas.style.cursor = this.hoveredNav ? 'pointer' : 'default';
    });
    this.canvas.addEventListener('mouseleave', () => {
      this.mouseX = -9999;
      this.mouseY = -9999;
      this.hoveredNav = null;
      this.canvas.style.cursor = 'default';
    });
    this.canvas.addEventListener('click', () => {
      if (this.hoveredNav) this.onNavClick(this.hoveredNav);
    });
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.navStars = layoutNavStars(this.navConfig, this.w, this.h);
    this.seedStars();
  }

  private seedStars(): void {
    const count = Math.floor((this.w * this.h) / 4500);
    this.stars = Array.from({ length: count }, () => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      z: Math.random(),
      r: Math.random() * 1.2 + 0.3,
    }));
  }

  private loop = (time: number): void => {
    if (!this.running) return;
    this.draw(time);
    this.raf = requestAnimationFrame(this.loop);
  };

  private draw(time: number): void {
    const { ctx, w, h } = this;
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, w, h);

    for (const s of this.stars) {
      const tw = 0.5 + 0.5 * Math.sin(time * 0.001 + s.z * 20);
      ctx.fillStyle = `rgba(220,230,255,${0.15 + s.z * 0.55 * tw})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    drawNavStars(ctx, this.navStars, time, this.hoveredNav);

    if (this.meteorWords.length && Math.random() < 0.002) {
      this.drawMeteor(time);
    }
  }

  private drawMeteor(_time: number): void {
    const word = this.meteorWords[Math.floor(Math.random() * this.meteorWords.length)];
    if (!word) return;
    const x1 = Math.random() * this.w * 0.6;
    const y1 = -20;
    const x2 = x1 + this.w * 0.35;
    const y2 = this.h * 0.4;
    const { ctx } = this;
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(200,220,255,0.9)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const near = distPointToSegment(this.mouseX, this.mouseY, x1, y1, x2, y2) < 24;
    if (near) {
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(word.text, x2 + 8, y2);
    }
  }
}
