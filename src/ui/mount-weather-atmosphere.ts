import '../styles/weather-atmosphere.css';
import type { WeatherVisual } from './weather-service';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  alpha: number;
  color: string;
  kind: 'dot' | 'line' | 'fogblob' | 'none';
};

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function density(visual: WeatherVisual, mobile: boolean): number {
  let n = 48;
  if (visual === 'thunderstorm') n = 64;
  if (visual === 'drizzle' || visual === 'fog') n = 32;
  if (visual === 'clear') n = 0;
  if (mobile) n = Math.max(0, Math.floor(n * 0.55));
  return n;
}

function createParticle(visual: WeatherVisual, w: number, h: number): Particle {
  const p: Particle = {
    x: rand(0, w),
    y: rand(-h, 0),
    vx: 0,
    vy: 0,
    size: 1,
    rot: rand(0, Math.PI * 2),
    vr: 0,
    alpha: 1,
    color: '#fff',
    kind: 'dot',
  };

  switch (visual) {
    case 'sakura':
      p.size = rand(4, 10);
      p.vx = rand(-1.2, 1.2);
      p.vy = rand(1.2, 2.8);
      p.vr = rand(-0.04, 0.04);
      p.color = pick(['#e8c4cc', '#f0d4d8', '#dcb8c0', '#f2e0d8']);
      break;
    case 'leaves':
      p.size = rand(5, 11);
      p.vx = rand(-1.5, 1.5);
      p.vy = rand(1, 2.5);
      p.vr = rand(-0.06, 0.06);
      p.color = pick(['#c05621', '#d69e2e', '#9c4221', '#b7791f', '#e53e3e']);
      break;
    case 'snow':
      p.size = rand(1.5, 4.5);
      p.vx = rand(-0.5, 0.5);
      p.vy = rand(0.8, 2.2);
      p.color = 'rgba(255,255,255,0.9)';
      break;
    case 'drizzle':
      p.size = rand(4, 8);
      p.vx = rand(-0.3, -0.8);
      p.vy = rand(4, 8);
      p.color = 'rgba(174,194,224,0.35)';
      p.kind = 'line';
      break;
    case 'rain':
    case 'thunderstorm':
      p.size = rand(10, 18);
      p.vx = rand(-1, -2.5);
      p.vy = rand(12, 22);
      p.color = 'rgba(174,194,224,0.55)';
      p.kind = 'line';
      break;
    case 'fog':
      p.size = rand(30, 90);
      p.x = rand(-50, w);
      p.y = rand(0, h);
      p.vx = rand(0.05, 0.25);
      p.vy = rand(-0.05, 0.05);
      p.alpha = rand(0.04, 0.12);
      p.color = 'rgba(255,255,255,0.6)';
      p.kind = 'fogblob';
      break;
    default:
      p.kind = 'none';
  }
  return p;
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let raf = 0;
let visual: WeatherVisual = 'clear';
let width = 0;
let height = 0;
let fogAlpha = 0;
let lightningFlash = 0;
let lightningTimer = 0;
let paused = false;

function mobile(): boolean {
  return window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches;
}

function resize(): void {
  if (!canvas) return;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
}

function stopLoop(): void {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (lightningTimer) window.clearInterval(lightningTimer);
  lightningTimer = 0;
  lightningFlash = 0;
}

function drawParticle(p: Particle): void {
  if (!ctx) return;
  if (p.kind === 'line') {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = visual === 'drizzle' ? 0.8 : 1.2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + p.vx * 0.6, p.y + p.size);
    ctx.stroke();
    return;
  }
  if (p.kind === 'fogblob') {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  if (visual === 'sakura' || visual === 'leaves') {
    ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
  } else {
    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}

function tick(): void {
  if (!ctx || paused) return;
  ctx.clearRect(0, 0, width, height);

  if (fogAlpha > 0) {
    ctx.fillStyle = `rgba(230, 235, 245, ${fogAlpha})`;
    ctx.fillRect(0, 0, width, height);
  }

  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    if (p.y > height + 40 || p.x < -40 || p.x > width + 40) {
      Object.assign(p, createParticle(visual, width, height));
      p.y = rand(-40, 0);
    }
    drawParticle(p);
  }

  if (lightningFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${lightningFlash})`;
    ctx.fillRect(0, 0, width, height);
    lightningFlash *= 0.85;
    if (lightningFlash < 0.02) lightningFlash = 0;
  }

  raf = requestAnimationFrame(tick);
}

function ensureCanvas(): void {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.id = 'askuaryWeatherCanvas';
  canvas.className = 'askuary-weather-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVis);
  resize();
}

function onResize(): void {
  resize();
  if (visual !== 'clear') initParticles();
}

function onVis(): void {
  paused = document.hidden;
  if (paused) stopLoop();
  else if (visual !== 'clear') startLoop();
}

function initParticles(): void {
  particles = [];
  fogAlpha = visual === 'fog' ? 0.18 : 0;
  const n = density(visual, mobile());
  for (let i = 0; i < n; i++) {
    const p = createParticle(visual, width, height);
    if (p.kind !== 'none') {
      p.y = rand(0, height);
      particles.push(p);
    }
  }
}

function startLoop(): void {
  if (raf) return;
  if (visual === 'thunderstorm') {
    lightningTimer = window.setInterval(() => {
      if (Math.random() > 0.55) lightningFlash = rand(0.25, 0.55);
    }, 3200);
  }
  raf = requestAnimationFrame(tick);
}

function removeCanvas(): void {
  stopLoop();
  particles = [];
  fogAlpha = 0;
  window.removeEventListener('resize', onResize);
  document.removeEventListener('visibilitychange', onVis);
  canvas?.remove();
  canvas = null;
  ctx = null;
}

/** 应用天气氛围特效（晴好时按节气樱花/落叶） */
export function applyWeatherAtmosphere(next: WeatherVisual): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    removeCanvas();
    return;
  }
  visual = next;
  if (next === 'clear') {
    removeCanvas();
    return;
  }
  ensureCanvas();
  stopLoop();
  initParticles();
  startLoop();
}

export function clearWeatherAtmosphere(): void {
  removeCanvas();
  visual = 'clear';
}
