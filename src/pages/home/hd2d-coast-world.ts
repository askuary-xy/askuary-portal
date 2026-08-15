/**
 * HD-2D 海岸试验场
 *
 * 这是独立于旧 tile 世界的全新渲染器。背景、山体、海面和沙滩各自绘制，
 * 碰撞线只服务于沙滩中央的行走带，后续建筑会通过锚点加入这里。
 */

import type { WorldApi, WorldDoor, WorldOptions } from './gate-world';

const WORLD_W = 4800;
const HERO_SIZE = 84;
const GRAVITY = 980;
const JUMP_V = 340;
const WALK = 180;
const RUN = 265;

type Sprite = {
  img: HTMLImageElement;
  frame: number;
  frames: number;
};

type CoastAssets = {
  cloud: HTMLCanvasElement;
  farMountains: HTMLCanvasElement;
  midMountains: HTMLCanvasElement;
  nearCliff: HTMLCanvasElement;
  sand: HTMLCanvasElement;
  hero: { idle: Sprite; walk: Sprite; run: Sprite; jump: Sprite };
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`asset failed: ${src}`));
    image.src = src;
  });
}

async function chromaSprite(src: string): Promise<HTMLCanvasElement> {
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < data.data.length; i += 4) {
    const r = data.data[i];
    const g = data.data[i + 1];
    const b = data.data[i + 2];
    if (r > 185 && b > 150 && g < 115) data.data[i + 3] = 0;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

function sheet(image: HTMLImageElement): Sprite {
  const frame = image.height;
  return { img: image, frame, frames: Math.max(1, Math.floor(image.width / frame)) };
}

async function loadCoastAssets(): Promise<CoastAssets> {
  const root = '/gate-world';
  const [cloud, farMountains, midMountains, nearCliff, sand, idle, walk, run, jump] = await Promise.all([
    chromaSprite(`${root}/hd2d/shore-rebuild/cloud-key.png?v=1`),
    chromaSprite(`${root}/hd2d/shore-rebuild/far-mountains-key.png?v=1`),
    chromaSprite(`${root}/hd2d/shore-rebuild/mid-mountains-key.png?v=1`),
    chromaSprite(`${root}/hd2d/shore-rebuild/near-cliff-key.png?v=1`),
    chromaSprite(`${root}/hd2d/shore-rebuild/sand-key.png?v=1`),
    loadImage(`${root}/hero/idle.png?v=1`),
    loadImage(`${root}/hero/walk.png?v=1`),
    loadImage(`${root}/hero/run.png?v=1`),
    loadImage(`${root}/hero/jump.png?v=1`),
  ]);
  return { cloud, farMountains, midMountains, nearCliff, sand, hero: { idle: sheet(idle), walk: sheet(walk), run: sheet(run), jump: sheet(jump) } };
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  index: number,
  x: number,
  y: number,
  size: number,
  flip: boolean,
) {
  const sourceX = (index % sprite.frames) * sprite.frame;
  ctx.save();
  if (flip) {
    ctx.translate(x + size, y);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite.img, sourceX, 0, sprite.frame, sprite.frame, 0, 0, size, size);
  } else {
    ctx.drawImage(sprite.img, sourceX, 0, sprite.frame, sprite.frame, x, y, size, size);
  }
  ctx.restore();
}

/** 人物在沙面中部的行走线，不再贴在海水与沙滩的交界线上。 */
function sandLine(worldX: number, viewportH: number) {
  return viewportH * .82 + Math.sin(worldX / 820) * 3 + Math.sin(worldX / 260) * 1.5;
}

export async function createHd2dCoastWorld(options: WorldOptions): Promise<WorldApi> {
  const canvas = options.canvas;
  const ctx = canvas.getContext('2d')!;
  const assets = await loadCoastAssets();
  options.onHint?.('海岸试验场 · 移动与跳跃');

  let width = 1;
  let height = 1;
  let camX = 0;
  let playerX = 540;
  let playerY = 0;
  let velocityY = 0;
  let grounded = true;
  let facing = 1;
  let animation = 0;
  let lastTime = 0;
  let jumpHeld = false;
  let disposed = false;
  let raf = 0;
  let lightMode: 'day' | 'night' | null = null;
  let weather = 'clear';
  const keys = new Set<string>();

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawSky(time: number) {
    const night = lightMode === 'night';
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, night ? '#0c1c36' : '#3275c8');
    sky.addColorStop(.66, night ? '#294767' : '#86c7e9');
    sky.addColorStop(1, night ? '#476783' : '#c1e5eb');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const cloudY = [height * .08, height * .19, height * .12];
    const cloudX = [width * .08, width * .49, width * .78];
    ctx.globalAlpha = night ? .22 : .88;
    for (let i = 0; i < cloudX.length; i++) {
      const drift = ((camX * .025 + time * (2 + i)) % (width + 260)) - 130;
      const x = ((cloudX[i] - drift) % (width + 320)) - 160;
      const cloudW = 220 + i * 38;
      ctx.drawImage(assets.cloud, x, cloudY[i], cloudW, cloudW * .55);
    }
    ctx.globalAlpha = 1;
  }

  function drawLandscape(time: number) {
    const horizon = height * .68;

    // 三张独立山景按远、中、近叠放，不再以一整块礁岛充当背景。
    ctx.globalAlpha = lightMode === 'night' ? .36 : .56;
    ctx.drawImage(assets.farMountains, -camX * .06 - width * .14, height * .48, width * .86, height * .19);
    ctx.globalAlpha = lightMode === 'night' ? .28 : .42;
    ctx.drawImage(assets.farMountains, width * .48 - camX * .1, height * .53, width * .72, height * .15);
    ctx.globalAlpha = lightMode === 'night' ? .5 : .74;
    ctx.drawImage(assets.midMountains, width * .08 - camX * .17, height * .46, width * .64, height * .25);
    ctx.globalAlpha = lightMode === 'night' ? .32 : .55;
    ctx.drawImage(assets.nearCliff, width * .7 - camX * .25, height * .57, width * .22, height * .13);
    ctx.globalAlpha = 1;

    const sea = ctx.createLinearGradient(0, horizon, 0, height);
    sea.addColorStop(0, lightMode === 'night' ? '#28516f' : '#4aa9c7');
    sea.addColorStop(1, lightMode === 'night' ? '#12344e' : '#167c9d');
    ctx.fillStyle = sea;
    ctx.fillRect(0, horizon, width, height - horizon);
    ctx.fillStyle = lightMode === 'night' ? 'rgba(199,229,245,.16)' : 'rgba(243,252,244,.42)';
    for (let i = 0; i < 18; i++) {
      const y = horizon + 9 + i * 10;
      const x = ((i * 139 - camX * .15 + time * 9) % (width + 120)) - 60;
      ctx.fillRect(x, y, 34 + (i % 4) * 15, 1);
    }
  }

  function drawSand() {
    const shoreLine = height * .73 + Math.sin((camX + width * .5) / 820) * 2;
    const sourceY = 80;
    const sourceH = assets.sand.height - 160;
    const pieceH = height * .27;
    const pieceW = pieceH * (assets.sand.width / sourceH);
    const first = Math.floor(camX / pieceW) * pieceW;
    for (let wx = first; wx < camX + width + pieceW; wx += pieceW) {
      ctx.drawImage(assets.sand, 0, sourceY, assets.sand.width, sourceH, wx - camX, shoreLine - 9, pieceW, pieceH);
    }
  }

  function drawPlayer() {
    const ground = sandLine(playerX, height);
    const screenX = playerX - camX;
    const moving = keys.has('ArrowLeft') || keys.has('ArrowRight') || keys.has('KeyA') || keys.has('KeyD');
    const running = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && moving;
    const sprite = !grounded ? assets.hero.jump : running ? assets.hero.run : moving ? assets.hero.walk : assets.hero.idle;
    const frame = Math.floor(animation) % sprite.frames;
    const footY = ground + playerY;
    drawFrame(ctx, sprite, frame, Math.round(screenX - HERO_SIZE / 2), Math.round(footY - HERO_SIZE), HERO_SIZE, facing < 0);
  }

  function drawLight() {
    if (lightMode !== 'night') return;
    const glow = ctx.createRadialGradient(width * .68, height * .18, 0, width * .68, height * .18, width * .62);
    glow.addColorStop(0, 'rgba(178,212,244,.13)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(5,13,30,.27)';
    ctx.fillRect(0, 0, width, height);
  }

  function drawWeather(time: number) {
    if (!['rain', 'drizzle', 'thunderstorm'].includes(weather)) return;
    ctx.strokeStyle = weather === 'drizzle' ? 'rgba(215,237,247,.35)' : 'rgba(205,232,247,.58)';
    ctx.lineWidth = 1;
    const count = weather === 'drizzle' ? 28 : 56;
    for (let i = 0; i < count; i++) {
      const x = (i * 61 + time * 290) % (width + 50) - 25;
      const y = (i * 91 + time * 430) % (height + 60) - 30;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y + 14);
      ctx.stroke();
    }
  }

  function update(delta: number) {
    let direction = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) direction -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) direction += 1;
    if (direction) {
      facing = direction;
      const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight')) ? RUN : WALK;
      playerX = Math.max(80, Math.min(WORLD_W - 80, playerX + direction * speed * delta));
      animation += delta * (speed === RUN ? 13 : 9);
    } else {
      animation += delta * 2;
    }

    const wantsJump = keys.has('ArrowUp') || keys.has('KeyW') || keys.has('Space');
    if (wantsJump && !jumpHeld && grounded) {
      velocityY = -JUMP_V;
      grounded = false;
    }
    jumpHeld = wantsJump;
    if (!grounded) {
      velocityY += GRAVITY * delta;
      playerY += velocityY * delta;
      if (playerY >= 0) {
        playerY = 0;
        velocityY = 0;
        grounded = true;
      }
    }
    const target = Math.max(0, Math.min(WORLD_W - width, playerX - width * .43));
    camX += (target - camX) * Math.min(1, delta * 6);
  }

  function frame(now: number) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const time = now * .001;
    const delta = lastTime ? Math.min(.05, (now - lastTime) / 1000) : .016;
    lastTime = now;
    update(delta);
    ctx.imageSmoothingEnabled = false;
    drawSky(time);
    drawLandscape(time);
    drawSand();
    drawPlayer();
    drawLight();
    drawWeather(time);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (options.inputActive && !options.inputActive()) return;
    if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(event.target.tagName)) return;
    keys.add(event.code);
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD', 'KeyW'].includes(event.code)) event.preventDefault();
  }

  function onKeyUp(event: KeyboardEvent) {
    keys.delete(event.code);
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  raf = requestAnimationFrame(frame);

  return {
    setCameraX: (next) => { camX = Math.max(0, Math.min(WORLD_W - width, next)); },
    getCameraX: () => camX,
    getMaxCameraX: () => Math.max(0, WORLD_W - width),
    hitDoor: () => null as WorldDoor | null,
    getNearDoor: () => null,
    setVirtualKey: (code, down) => { if (down) keys.add(code); else keys.delete(code); },
    clearVirtualKeys: () => keys.clear(),
    setLightMode: (mode) => { lightMode = mode; },
    setWeatherVisual: (next) => { weather = next || 'clear'; },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      keys.clear();
    },
  };
}
