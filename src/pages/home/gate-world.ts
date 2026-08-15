/**
 * 自定义横版传送门世界
 * 树林视差（ansimuz CC0）+ F:/2d 角色 + 真实 24 小时日月
 */

import { blitFrame, loadGateAssets } from './gate-assets';

export type WorldDoor = {
  id: string;
  name: string;
  blurb: string;
  href: string;
  tileX: number;
  color: string;
};

export const TILE = 32;
export let WORLD_W = 240;
export let WORLD_H = 18;

const DOOR_DEFS: Omit<WorldDoor, 'tileX'>[] = [
  { id: 'arcade', name: '街机', blurb: '霓虹卡带与摇杆', href: '../games/', color: '#39ff14' },
  { id: 'universe', name: '宇宙', blurb: '环球足迹与恒星', href: '../', color: '#7ec8ff' },
  { id: 'photos', name: '相册', blurb: '相框与旅途之光', href: '../photos/', color: '#ffb4d9' },
  { id: 'library', name: '书库', blurb: '书脊成林', href: '../library/', color: '#3de7ff' },
  { id: 'shuoshuo', name: '碎念', blurb: '片刻与风', href: '../shuoshuo/', color: '#c9b6ff' },
  { id: 'articles', name: '文章', blurb: '卷轴文字', href: '../articles/', color: '#f0d9a8' },
];

export let WORLD_DOORS: WorldDoor[] = DOOR_DEFS.map((d, i) => ({
  ...d,
  tileX: 18 + i * 24,
}));

/** 0 空 · 1 地层 · 2 地表 · 4 浮台 */
type Tile = 0 | 1 | 2 | 4;

type SceneZone = {
  id: 'shore' | 'city' | 'islands';
  name: string;
  from: number;
  to: number;
};

/* 连续世界的第一层骨架。建筑与 NPC 将在这些分区上继续生长。 */
const SCENE_ZONES: SceneZone[] = [
  { id: 'shore', name: '潮汐海岸', from: 0, to: 76 },
  { id: 'city', name: '青空街区', from: 76, to: 166 },
  { id: 'islands', name: '浮云群岛', from: 166, to: 240 },
];

function sceneAt(tileX: number): SceneZone {
  return SCENE_ZONES.find((zone) => tileX >= zone.from && tileX < zone.to) ?? SCENE_ZONES[0];
}

export type WorldApi = {
  setCameraX: (x: number) => void;
  getCameraX: () => number;
  getMaxCameraX: () => number;
  hitDoor: (clientX: number, clientY: number) => WorldDoor | null;
  getNearDoor: () => WorldDoor | null;
  /** 虚拟按键（手机 HUD / 外设），code 同 KeyboardEvent.code */
  setVirtualKey: (code: string, down: boolean) => void;
  clearVirtualKeys: () => void;
  /** 全站主题传入的昼夜覆盖；null 时使用现实时间 */
  setLightMode: (mode: 'day' | 'night' | null) => void;
  setWeatherVisual: (visual: string) => void;
  dispose: () => void;
};

export type WorldOptions = {
  canvas: HTMLCanvasElement;
  onHint?: (text: string) => void;
  onInteractDoor?: (door: WorldDoor) => void;
  /** 返回 false 时忽略键盘（嵌入主页时仅悬停/聚焦才操作） */
  inputActive?: () => boolean;
};

const MOVE_SPEED = 150;
const RUN_SPEED = 230;
const JUMP_V = 340;
const DOUBLE_JUMP_V = 300;
const GRAVITY = 980;
const CHAR_DRAW = 78;
const GROUND_DEPTH = 3;
const GROUND_Y = 12;
const ATTACK_FPS = 28;
const ATTACK_COOLDOWN = 0.12;

type AttackFx = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  kind: 'spark' | 'dust';
};

function mulberry32(a: number) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 本地真实时刻 0–24（含分钟小数） */
function clockHours(d = new Date()): number {
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

/** 24h 光源参数：用环境光 + 主光源位置模拟昼夜 */
type DayLight = {
  ambient: number; // 0–1 场景亮度
  lightR: number;
  lightG: number;
  lightB: number;
  glow: number; // 主光晕强度
  stars: number;
};

function lightByHour(hour: number): DayLight {
  if (hour >= 5 && hour < 7) {
    const k = (hour - 5) / 2;
    return {
      ambient: 0.35 + k * 0.55,
      lightR: 255,
      lightG: Math.round(140 + 60 * k),
      lightB: Math.round(80 + 40 * k),
      glow: 0.55 + k * 0.25,
      stars: 1 - k,
    };
  }
  if (hour >= 7 && hour < 17) {
    return {
      ambient: 1,
      lightR: 255,
      lightG: 236,
      lightB: 180,
      glow: 0.55,
      stars: 0,
    };
  }
  if (hour >= 17 && hour < 20) {
    const k = (hour - 17) / 3;
    return {
      ambient: 1 - k * 0.65,
      lightR: 255,
      lightG: Math.round(160 - 40 * k),
      lightB: Math.round(90 - 30 * k),
      glow: 0.7,
      stars: k,
    };
  }
  // 夜：月光偏冷
  return {
    ambient: 0.22,
    lightR: 160,
    lightG: 180,
    lightB: 220,
    glow: 0.35,
    stars: 1,
  };
}

/** 主光源屏幕坐标（太阳白天 / 月亮夜晚） */
function lightScreenPos(hour: number, w: number, h: number): { x: number; y: number; isMoon: boolean } {
  const day = hour >= 5 && hour < 20;
  if (day) {
    const ang = ((hour - 6) / 12) * Math.PI;
    return {
      x: w * 0.5 + Math.cos(Math.PI - ang) * w * 0.4,
      y: h * 0.62 - Math.sin(ang) * h * 0.48,
      isMoon: false,
    };
  }
  const ang = ((hour - 18) / 12) * Math.PI;
  return {
    x: w * 0.5 + Math.cos(Math.PI - ang) * w * 0.38,
    y: h * 0.62 - Math.sin(ang) * h * 0.45,
    isMoon: true,
  };
}

function buildWorld(seed = 2026) {
  const rand = mulberry32(seed);
  WORLD_W = 240;
  WORLD_H = 18;
  const tiles: Tile[][] = Array.from({ length: WORLD_H }, () => Array<Tile>(WORLD_W).fill(0));
  const heights: number[] = [];

  let h = GROUND_Y + 1;
  for (let x = 0; x < WORLD_W; x++) {
    const zone = sceneAt(x);
    const base = zone.id === 'shore' ? GROUND_Y + 1 : zone.id === 'city' ? GROUND_Y : GROUND_Y - 1;
    if (zone.id === 'shore') {
      // 海岸是后续房屋、栈桥和互动锚点的基准平面，保持稳定不做随机台阶。
      h = base;
    } else {
      if (x === 76 || x === 166) h = base;
      if (rand() > 0.84) h += rand() > 0.5 ? 1 : -1;
      h = Math.max(base - 1, Math.min(base + 1, h));
    }
    heights[x] = h;
  }

  for (let x = 0; x < WORLD_W; x++) {
    const surface = heights[x];
    for (let d = 0; d < GROUND_DEPTH; d++) {
      const y = surface + d;
      if (y >= WORLD_H) break;
      tiles[y][x] = d === 0 ? 2 : 1;
    }
  }

  // 三段区域的跃迁点：礁石、城市天桥、云岛碎片。
  for (const [px, py, pw] of [
    [42, 10, 4],
    [64, 9, 3],
    [100, 8, 5],
    [146, 7, 4],
    [184, 8, 5],
    [214, 7, 6],
  ]) {
    for (let x = px; x < px + pw && x < WORLD_W; x++) tiles[py][x] = 4;
  }

  const doorTiles = [27, 102, 122, 143, 157, 211];
  WORLD_DOORS = DOOR_DEFS.map((d, i) => ({
    ...d,
    tileX: doorTiles[i] ?? 20 + i * 24,
  }));

  for (const door of WORLD_DOORS) {
    const base = heights[door.tileX] ?? GROUND_Y;
    for (let x = door.tileX - 3; x <= door.tileX + 3; x++) {
      if (x < 0 || x >= WORLD_W) continue;
      heights[x] = base;
      for (let y = 0; y < WORLD_H; y++) tiles[y][x] = 0;
      for (let d = 0; d < GROUND_DEPTH; d++) {
        const y = base + d;
        if (y < WORLD_H) tiles[y][x] = d === 0 ? 2 : 1;
      }
    }
  }

  // 仅街区保留少量树，海岸与云岛由专属景深层呈现。
  type GroundTree = { x: number; kind: number; scale: number };
  const trees: GroundTree[] = [];
  for (let x = 4; x < WORLD_W - 4; x++) {
    if (sceneAt(x).id !== 'city' || WORLD_DOORS.some((d) => Math.abs(d.tileX - x) < 5)) continue;
    if (rand() > 0.78) {
      trees.push({
        x,
        kind: Math.floor(rand() * 8),
        scale: 0.85 + rand() * 0.45,
      });
      x += 2 + Math.floor(rand() * 3);
    }
  }

  return { tiles, heights, trees };
}

export async function createGateWorld(options: WorldOptions): Promise<WorldApi> {
  const { canvas, onInteractDoor, inputActive } = options;
  const ctx = canvas.getContext('2d')!;
  const assets = await loadGateAssets();
  const world = buildWorld(2026);
  options.onHint?.('从海岸向右探索 · 跳跃 · 靠近入口进入');

  let w = 0;
  let h = 0;
  let camX = 0;
  let followPlayer = true;
  // 海岸入口从稳定的沙地起步，不把玩家生成在尚未建成的交互地标上。
  let playerX = TILE * 12;
  let playerY = 0;
  let playerVy = 0;
  let grounded = false;
  let jumpsLeft = 2;
  let facing: 1 | -1 = 1;
  let animT = 0;
  let jumpHeld = false;
  let attackHeld = false;
  let attackT = 0;
  let attackDur = 0.36;
  let attackCd = 0;
  let attackFacing: 1 | -1 = 1;
  let attackVariant = 0;
  const attackFx: AttackFx[] = [];
  let disposed = false;
  let raf = 0;
  let lastT = 0;
  let lightMode: 'day' | 'night' | null = null;
  let weatherVisual = 'clear';
  const keys = new Set<string>();

  function pressed(...codes: string[]) {
    return codes.some((c) => keys.has(c));
  }

  function spawnAttackFx() {
    attackFacing = facing;
    const baseX = playerX + facing * 18;
    const baseY = playerY - CHAR_DRAW * 0.45;
    for (let i = 0; i < 10; i++) {
      const ang = (facing > 0 ? -0.55 : Math.PI - 0.55) + (Math.random() - 0.5) * 0.9;
      const spd = 80 + Math.random() * 140;
      attackFx.push({
        x: baseX + (Math.random() - 0.5) * 8,
        y: baseY + (Math.random() - 0.5) * 16,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 40,
        life: 0.18 + Math.random() * 0.22,
        max: 0.28 + Math.random() * 0.2,
        size: 2 + Math.random() * 3.5,
        kind: Math.random() > 0.45 ? 'spark' : 'dust',
      });
    }
  }

  function tryAttack() {
    if (attackT > 0 || attackCd > 0) return;
    attackVariant = attackVariant === 0 ? 1 : 0;
    const sheet = attackVariant === 0 ? assets.hero.attack1 : assets.hero.attack2;
    attackDur = Math.max(0.28, sheet.frames / ATTACK_FPS);
    attackT = attackDur;
    attackCd = ATTACK_COOLDOWN;
    followPlayer = true;
    spawnAttackFx();
    // 轻推一步，增加打击感
    const nextX = Math.max(
      TILE * 2,
      Math.min((WORLD_W - 3) * TILE, playerX + facing * 10),
    );
    playerX = nextX;
  }

  // 夜空星星（固定种子）
  const stars = Array.from({ length: 48 }, (_, i) => {
    const r = mulberry32(9000 + i);
    return { x: r(), y: r() * 0.55, s: 1 + Math.floor(r() * 2) };
  });

  function maxCam() {
    return Math.max(0, WORLD_W * TILE - w);
  }

  function surfaceAt(wx: number) {
    const tx = Math.max(0, Math.min(WORLD_W - 1, Math.floor(wx / TILE)));
    return world.heights[tx] * TILE;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function clearKeys() {
    keys.clear();
  }

  function drawTiledBottom(
    img: HTMLImageElement,
    speed: number,
    bottomY: number,
    drawH: number,
    alpha = 1,
    drift = 0,
  ) {
    if (!img.naturalWidth) return;
    const scale = drawH / img.height;
    const tw = img.width * scale;
    const scroll = ((-camX * speed + drift) % tw) + tw;
    const y = bottomY - drawH;
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    for (let x = -scroll; x < w + tw; x += tw) {
      ctx.drawImage(img, x, y, tw, drawH);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * 不再用一张背景图硬切场景。每个分区共享天空光源，却拥有独立的远景节奏，
   * 让海岸、公路和空岛在镜头移动时自然接起来。
   */
  function drawZoneBackdrops(t: number, horizon: number) {
    const cam = Math.floor(camX);
    const start = Math.max(0, Math.floor(cam / TILE) - 2);
    const end = Math.min(WORLD_W, Math.ceil((cam + w) / TILE) + 2);

    for (const zone of SCENE_ZONES) {
      if (zone.to < start || zone.from > end) continue;
      const x = zone.from * TILE - cam;
      const width = (zone.to - zone.from) * TILE;

      if (zone.id === 'shore') {
        // 四层中的前两层：天空慢速，海岸与灯塔中速。
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, 0, width, h);
        ctx.clip();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(assets.coastSky, x - cam * .025, 0, width + cam * .025, h * .72);
        ctx.drawImage(
          assets.coastMidground,
          0,
          Math.floor(assets.coastMidground.height * .58),
          assets.coastMidground.width,
          Math.floor(assets.coastMidground.height * .42),
          x - cam * .09,
          h * .52,
          width + cam * .09,
          h * .48,
        );
        ctx.restore();

        // 横向亮纹是可动水面，不覆盖远景光斑。
        ctx.fillStyle = 'rgba(231, 249, 255, .46)';
        for (let i = 0; i < 13; i++) {
          const yy = horizon + 3 + ((i * 19 + t * 15) % Math.max(22, h * .14));
          const xx = x + ((i * 97 - cam * .12) % Math.max(1, width));
          ctx.fillRect(xx, yy, 18 + (i % 4) * 11, 1);
        }
      } else if (zone.id === 'city') {
        // 仅先搭城市轮廓和高架节奏，详细建筑会在下一轮按页面功能落点制作。
        ctx.fillStyle = 'rgba(35, 67, 98, .66)';
        const first = Math.max(zone.from, start);
        const last = Math.min(zone.to, end);
        for (let tx = first; tx < last; tx += 7) {
          const n = Math.floor((tx - zone.from) / 7);
          const bh = 34 + (n % 3) * 18;
          const bx = tx * TILE - cam;
          ctx.fillRect(bx, horizon - bh, 5 * TILE, bh);
          ctx.fillStyle = 'rgba(161, 211, 224, .38)';
          for (let wy = horizon - bh + 10; wy < horizon - 8; wy += 12) {
            ctx.fillRect(bx + 9, wy, 4, 3);
            ctx.fillRect(bx + 29, wy, 4, 3);
            ctx.fillRect(bx + 49, wy, 4, 3);
          }
          ctx.fillStyle = 'rgba(35, 67, 98, .66)';
        }
        ctx.fillStyle = 'rgba(81, 119, 144, .84)';
        ctx.fillRect(x, horizon - 4, width, 4);
      } else {
        // 云层将城市抬升为浮空地貌的过渡，而非突然换成另一张天空图。
        ctx.fillStyle = 'rgba(224, 244, 241, .63)';
        for (let i = 0; i < 12; i++) {
          const cx = x + ((i * 113 - cam * .08) % Math.max(1, width));
          const cy = horizon - 12 - (i % 3) * 13;
          ctx.fillRect(cx, cy, 42, 7);
          ctx.fillRect(cx + 8, cy - 5, 23, 7);
        }
        ctx.fillStyle = 'rgba(84, 115, 133, .5)';
        for (let i = 0; i < 5; i++) {
          const ix = x + 22 + i * 138 - cam * .04;
          ctx.fillRect(ix, horizon - 74 - (i % 2) * 11, 54, 8);
          ctx.fillRect(ix + 8, horizon - 66 - (i % 2) * 11, 37, 8);
        }
      }
    }
  }

  function drawParallax(t: number) {
    const hour = lightMode === 'day' ? 12 : lightMode === 'night' ? 23 : clockHours();
    const L = lightByHour(hour);
    const light = lightScreenPos(hour, w, h);

    // 天空
    const skyBright = L.ambient;
    const top = `rgb(${Math.round(40 + 50 * skyBright)},${Math.round(70 + 100 * skyBright)},${Math.round(110 + 130 * skyBright)})`;
    const mid = `rgb(${Math.round(80 + 90 * skyBright)},${Math.round(130 + 90 * skyBright)},${Math.round(170 + 70 * skyBright)})`;
    const bot = `rgb(${Math.round(140 + 80 * skyBright)},${Math.round(190 + 50 * skyBright)},${Math.round(210 + 40 * skyBright)})`;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top);
    g.addColorStop(0.55, mid);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const glowR = Math.max(w, h) * (0.55 + L.glow * 0.25);
    const radial = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, glowR);
    radial.addColorStop(0, `rgba(${L.lightR},${L.lightG},${L.lightB},${0.42 * L.glow})`);
    radial.addColorStop(0.4, `rgba(${L.lightR},${L.lightG},${L.lightB},${0.14 * L.glow})`);
    radial.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, w, h);

    // 上层乳白云（只取有像素的天空区）
    {
      const img = assets.cloudStrip;
      const srcY = Math.floor(img.height * 0.04);
      const srcH = Math.floor(img.height * 0.4);
      const th = h * 0.36;
      const scale = th / srcH;
      const tw = img.width * scale;
      const scroll = ((-camX * 0.04 + t * 7) % tw) + tw;
      ctx.globalAlpha = 0.9;
      ctx.imageSmoothingEnabled = false;
      for (let x = -scroll; x < w + tw; x += tw) {
        ctx.drawImage(img, 0, srcY, img.width, srcH, x, h * 0.05, tw, th);
      }
      ctx.globalAlpha = 1;
    }

    // 远山：底边贴地平线（与可走地面同高），后面一层更远
    const horizon = h * 0.72;
    const far = assets.mountains[0];
    const near = assets.mountains[1] ?? assets.mountains[0];
    drawTiledBottom(far, 0.12, horizon - 4, h * 0.3, 0.92);
    drawTiledBottom(near, 0.2, horizon + 6, h * 0.24, 1);
    drawZoneBackdrops(t, horizon);

    if (L.stars > 0.05) {
      ctx.fillStyle = '#fff';
      for (const s of stars) {
        ctx.globalAlpha = L.stars * (0.3 + 0.7 * Math.abs(Math.sin(t + s.x * 12)));
        ctx.fillRect(s.x * w, s.y * h * 0.45, s.s, s.s);
      }
      ctx.globalAlpha = 1;
    }

    if (light.y < h * 0.7) {
      const core = Math.min(light.isMoon ? 18 : 26, h * 0.04);
      const coreGrad = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, core * 2.2);
      if (light.isMoon) {
        coreGrad.addColorStop(0, 'rgba(230,240,255,0.95)');
        coreGrad.addColorStop(0.45, 'rgba(180,200,230,0.35)');
        coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
      } else {
        coreGrad.addColorStop(0, `rgba(${L.lightR},${L.lightG},${L.lightB},0.95)`);
        coreGrad.addColorStop(0.4, `rgba(${L.lightR},${L.lightG},${Math.min(255, L.lightB + 20)},0.35)`);
        coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
      }
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(light.x, light.y, core * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    const dim = 1 - L.ambient;
    if (dim > 0.02) {
      ctx.fillStyle = `rgba(8,12,28,${dim * 0.72})`;
      ctx.fillRect(0, 0, w, h);
      const fill = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, glowR * 0.9);
      fill.addColorStop(0, `rgba(${L.lightR},${L.lightG},${L.lightB},${0.22 * L.glow})`);
      fill.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, w, h);
    }

    // HD-2D 的主光只影响氛围，不给像素角色加糊化滤镜。
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const shaft = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, Math.max(w, h) * .54);
    shaft.addColorStop(0, light.isMoon ? 'rgba(179, 210, 255, .16)' : 'rgba(255, 244, 197, .19)');
    shaft.addColorStop(.54, light.isMoon ? 'rgba(114, 156, 214, .05)' : 'rgba(255, 226, 152, .045)');
    shaft.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shaft;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function drawHd2dForeground(t: number) {
    const edge = ctx.createLinearGradient(0, 0, w, 0);
    edge.addColorStop(0, 'rgba(3, 12, 20, .2)');
    edge.addColorStop(.16, 'rgba(3, 12, 20, 0)');
    edge.addColorStop(.84, 'rgba(3, 12, 20, 0)');
    edge.addColorStop(1, 'rgba(3, 12, 20, .2)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, w, h);

    // 非循环的细尘粒，为阳光、夜雾和雨景提供统一的空气层。
    ctx.fillStyle = 'rgba(226, 246, 244, .22)';
    for (let i = 0; i < 15; i++) {
      const px = (i * 97 + t * (5 + (i % 3))) % Math.max(1, w);
      const py = h * .22 + ((i * 37 + t * 3) % Math.max(1, h * .48));
      ctx.fillRect(Math.round(px), Math.round(py), i % 5 === 0 ? 2 : 1, 1);
    }
  }

  /** 树长在草地上：脚底对齐地表 */
  function drawGroundTrees() {
    const cam = Math.floor(camX);
    ctx.imageSmoothingEnabled = false;
    for (const tr of world.trees) {
      const img = assets.trees[tr.kind % assets.trees.length];
      if (!img) continue;
      const sy = world.heights[Math.min(WORLD_W - 1, Math.max(0, tr.x))];
      const ground = sy * TILE;
      const th = TILE * 2.4 * tr.scale;
      const tw = th * (img.width / img.height);
      const px = tr.x * TILE - cam + TILE / 2 - tw / 2;
      const py = ground - th + 4;
      if (px < -tw || px > w + tw) continue;
      ctx.drawImage(img, px, py, tw, th);
    }
  }

  /** 海岸可走地面层。它和物理碰撞共用同一个基准线。 */
  function drawShoreGround() {
    const cam = Math.floor(camX);
    const start = Math.max(0, Math.floor(cam / TILE) - 3);
    const end = Math.min(76, Math.ceil((cam + w) / TILE) + 3);

    const sourceY = 260;
    const sourceH = 420;
    const pieceH = 202;
    const pieceW = 820;
    const firstPiece = Math.floor((start * TILE) / pieceW) * pieceW;
    for (let wx = firstPiece; wx < end * TILE + pieceW; wx += pieceW) {
      const centerTile = Math.max(0, Math.min(75, Math.floor((wx + pieceW / 2) / TILE)));
      const ground = world.heights[centerTile] * TILE;
      ctx.drawImage(
        assets.coastGround,
        0,
        sourceY,
        assets.coastGround.width,
        sourceH,
        wx - cam,
        // 源图地表线位于裁切区域约 12px 处，对齐 physics ground。
        ground - 12,
        pieceW,
        pieceH,
      );
    }

    // 海岸道路收束到城市入口。先只建立路线，商店和站台将在城市轮次加入。
    const roadStart = 66;
    if (end >= roadStart) {
      for (let tx = Math.max(start, roadStart); tx < end; tx++) {
        const ground = world.heights[tx] * TILE;
        const px = tx * TILE - cam;
        ctx.fillStyle = '#a9a08a';
        ctx.fillRect(px, ground - 5, TILE, 5);
        ctx.fillStyle = tx % 2 === 0 ? '#e4d7ad' : '#c9bd94';
        ctx.fillRect(px + 4, ground - 4, 11, 2);
      }
    }
  }

  /** 海岸前景层必须在角色之后绘制，才能形成正确遮挡关系。 */
  function drawShoreForeground(t: number) {
    const cam = Math.floor(camX);
    const start = Math.max(0, Math.floor(cam / TILE) - 2);
    const end = Math.min(76, Math.ceil((cam + w) / TILE) + 2);
    const placements = [2, 43];
    for (const tx of placements) {
      if (tx < start - 16 || tx > end + 3) continue;
      const ground = world.heights[Math.min(75, tx + 7)] * TILE;
      const sway = Math.round(Math.sin(t * 1.1 + tx) * 1);
      ctx.drawImage(
        assets.coastForeground,
        0,
        320,
        assets.coastForeground.width,
        620,
        tx * TILE - cam + sway,
        ground - 160,
        500,
        182,
      );
    }
  }

  function drawTiles() {
    const cam = Math.floor(camX);
    const startX = Math.max(0, Math.floor(cam / TILE) - 1);
    const endX = Math.min(WORLD_W, Math.ceil((cam + w) / TILE) + 1);
    for (let y = 0; y < WORLD_H; y++) {
      for (let x = startX; x < endX; x++) {
        const t = world.tiles[y][x];
        if (!t) continue;
        const zone = sceneAt(x);
        if (zone.id === 'shore') continue;
        const px = x * TILE - cam;
        const isTop = t === 2 || t === 4;
        const palette = zone.id === 'city'
          ? { fill: '#35485b', top: '#91bdc9', line: '#d8f2ed' }
          : { fill: '#536b76', top: '#d6e8d6', line: '#f4fff4' };
        ctx.fillStyle = palette.fill;
        ctx.fillRect(px, y * TILE, TILE, TILE);
        if (isTop) {
          ctx.fillStyle = palette.top;
          ctx.fillRect(px, y * TILE, TILE, 7);
          ctx.fillStyle = palette.line;
          ctx.fillRect(px, y * TILE, TILE, 2);
        }
        // 像素纹理保持低密度，避免地面变成噪点。
        if (!isTop && (x + y * 3) % 3 === 0) {
          ctx.fillStyle = 'rgba(20, 36, 52, .22)';
          ctx.fillRect(px + 5 + ((x + y) % 3) * 6, y * TILE + 13, 5, 2);
        }
      }
    }
  }

  function drawGateHole(door: WorldDoor, surfaceY: number, t: number) {
    const cam = Math.floor(camX);
    const cx = door.tileX * TILE - cam + TILE / 2;
    const cy = surfaceY * TILE - TILE * 2.2;
    const pulse = 0.92 + Math.sin(t * 2.4 + door.tileX * 0.12) * 0.08;
    const R = TILE * 1.45 * pulse;
    const near = Math.abs(playerX - door.tileX * TILE) < TILE * 2.4;
    const spin = t * (near ? 2.8 : 1.5);

    ctx.save();
    ctx.translate(cx, cy);

    const glow = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 2);
    glow.addColorStop(0, `${door.color}55`);
    glow.addColorStop(0.5, `${door.color}22`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, R * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.scale(1.35, 0.42);
    ctx.rotate(spin * 0.35);
    const disk = ctx.createRadialGradient(0, 0, R * 0.3, 0, 0, R * 1.2);
    disk.addColorStop(0, 'rgba(255,255,255,0.1)');
    disk.addColorStop(0.4, `${door.color}aa`);
    disk.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = disk;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = door.color;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a0 = spin + i * ((Math.PI * 2) / 3);
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(0, 0, R * (0.95 + i * 0.1), a0, a0 + 1.05);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const hole = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.7);
    hole.addColorStop(0, '#000');
    hole.addColorStop(0.7, '#050510');
    hole.addColorStop(1, `${door.color}44`);
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(cx - 28, cy - R - 20, 56, 13);
    ctx.fillStyle = door.color;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(door.name, cx, cy - R - 10);
    ctx.textAlign = 'start';
  }

  function nearDoor(): WorldDoor | null {
    for (const door of WORLD_DOORS) {
      if (sceneAt(door.tileX).id === 'shore') continue;
      if (Math.abs(playerX - door.tileX * TILE) < TILE * 2.2) return door;
    }
    return null;
  }

  function tryJump() {
    if (jumpsLeft <= 0) return;
    const first = jumpsLeft === 2 && grounded;
    playerVy = first ? -JUMP_V : -DOUBLE_JUMP_V;
    jumpsLeft -= 1;
    grounded = false;
    followPlayer = true;
  }

  function updatePlayer(dt: number) {
    if (disposed || dt <= 0) return;
    const left = pressed('ArrowLeft', 'KeyA');
    const right = pressed('ArrowRight', 'KeyD');
    const jumpDown = pressed('ArrowUp', 'KeyW', 'Space');
    const run = pressed('ShiftLeft', 'ShiftRight');
    const attackDown = pressed('KeyJ', 'KeyK', 'KeyX');

    if (attackT > 0) attackT = Math.max(0, attackT - dt);
    if (attackCd > 0) attackCd = Math.max(0, attackCd - dt);

    if (attackDown && !attackHeld) tryAttack();
    attackHeld = attackDown;

    let dir = 0;
    if (left) dir -= 1;
    if (right) dir += 1;

    // 攻击前半段锁面向，后半段可移动
    const attackLock = attackT > attackDur * 0.4;
    if (dir !== 0 && !attackLock) {
      facing = dir > 0 ? 1 : -1;
      followPlayer = true;
      const speed = (run ? RUN_SPEED : MOVE_SPEED) * dir * dt;
      const nextX = Math.max(TILE * 2, Math.min((WORLD_W - 3) * TILE, playerX + speed));
      const g0 = surfaceAt(playerX);
      const g1 = surfaceAt(nextX);
      if (!grounded || g1 >= g0 - TILE) playerX = nextX;
      animT += dt * (run ? 14 : 10);
    } else {
      animT += dt * (attackT > 0 ? 16 : 3);
    }

    if (jumpDown && !jumpHeld && !attackLock) tryJump();
    jumpHeld = jumpDown;

    playerVy += GRAVITY * dt;
    playerY += playerVy * dt;
    const ground = surfaceAt(playerX);
    if (playerVy >= 0 && playerY >= ground) {
      playerY = ground;
      playerVy = 0;
      grounded = true;
      jumpsLeft = 2;
    } else if (playerY < ground - 2) {
      grounded = false;
    }
    if (grounded) playerY = surfaceAt(playerX);

    for (let i = attackFx.length - 1; i >= 0; i--) {
      const p = attackFx[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      if (p.life <= 0) attackFx.splice(i, 1);
    }

    if (followPlayer && w > 0) {
      const target = playerX - w * 0.42;
      camX += (Math.max(0, Math.min(maxCam(), target)) - camX) * Math.min(1, dt * 8);
    }
  }

  function drawAttackParticles() {
    for (const p of attackFx) {
      const a = Math.max(0, p.life / p.max);
      const sx = Math.round(p.x - camX);
      const sy = Math.round(p.y);
      if (p.kind === 'dust' && assets.dust) {
        const fw = Math.max(8, Math.floor(assets.dust.width / 6) || 16);
        const fh = assets.dust.height || fw;
        const frame = Math.min(5, Math.floor((1 - a) * 6));
        ctx.globalAlpha = 0.3 + a * 0.5;
        ctx.drawImage(assets.dust, frame * fw, 0, fw, fh, sx - 8, sy - 8, 16, 16);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle =
          p.kind === 'spark'
            ? `rgba(255, 236, 160, ${0.2 + a * 0.8})`
            : `rgba(200, 220, 255, ${0.15 + a * 0.55})`;
        const s = Math.max(1, Math.round(p.size * (0.6 + a)));
        ctx.fillRect(sx, sy, s, s);
      }
    }
  }

  function drawPlayer() {
    const dx = playerX - camX;
    const dy = playerY;
    const moving = pressed('ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD');
    const run = pressed('ShiftLeft', 'ShiftRight') && moving;
    const attacking = attackT > 0;
    const progress = attacking && attackDur > 0 ? 1 - attackT / attackDur : 0;

    let sheet = assets.hero.idle;
    let frame = Math.floor(animT) % sheet.frames;
    if (attacking) {
      sheet = attackVariant === 0 ? assets.hero.attack1 : assets.hero.attack2;
      frame = Math.min(sheet.frames - 1, Math.floor(progress * sheet.frames));
    } else if (!grounded) {
      sheet = assets.hero.jump;
      frame = Math.floor(animT) % sheet.frames;
    } else if (run) {
      sheet = assets.hero.run;
      frame = Math.floor(animT) % sheet.frames;
    } else if (moving) {
      sheet = assets.hero.walk;
      frame = Math.floor(animT) % sheet.frames;
    }

    const dw = CHAR_DRAW;
    const dh = CHAR_DRAW;
    // 脚底略嵌入地表，看起来踩实；不画脚底椭圆阴影
    const footY = dy + 3;
    const lunge = attacking ? attackFacing * progress * 5 : 0;
    const drawX = Math.round(dx - dw / 2 + lunge);
    const drawY = Math.round(footY - dh);
    blitFrame(ctx, sheet, frame, drawX, drawY, dw, dh, facing < 0);

    // 角色自带攻击特效层
    if (attacking) {
      const fxSheet =
        attackVariant === 0 ? assets.hero.attack1Fx : assets.hero.attack2Fx;
      if (fxSheet) {
        const fxFrame = Math.min(
          fxSheet.frames - 1,
          Math.floor(progress * fxSheet.frames),
        );
        const fxX = Math.round(dx - dw / 2 + attackFacing * (dw * 0.35) + lunge);
        blitFrame(ctx, fxSheet, fxFrame, fxX, drawY, dw, dh, facing < 0);
      }
    }

    drawAttackParticles();

    const door = nearDoor();
    if (door) {
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillRect(Math.round(dx - 42), Math.round(footY - dh - 22), 84, 16);
      ctx.fillStyle = door.color;
      ctx.font = '12px "Zpix", "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`进入 · ${door.name}`, Math.round(dx), Math.round(footY - dh - 10));
      ctx.textAlign = 'start';
    }
  }

  function frame(now: number) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const t = now * 0.001;
    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016;
    lastT = now;
    updatePlayer(dt);

    ctx.imageSmoothingEnabled = false;
    drawParallax(t);

    const groundPx = GROUND_Y * TILE;
    const offsetY = Math.floor(h * 0.72 - groundPx);
    ctx.save();
    ctx.translate(0, offsetY);
    drawTiles();
    drawGroundTrees();
    drawShoreGround();
    for (const door of WORLD_DOORS) {
      if (sceneAt(door.tileX).id === 'shore') continue;
      const hy = world.heights[Math.min(WORLD_W - 1, Math.max(0, door.tileX))];
      drawGateHole(door, hy, t);
    }
    drawPlayer();
    drawShoreForeground(t);
    ctx.restore();
    drawHd2dForeground(t);

    if (weatherVisual === 'rain' || weatherVisual === 'drizzle' || weatherVisual === 'thunderstorm') {
      const count = weatherVisual === 'drizzle' ? 34 : 66;
      ctx.save();
      ctx.strokeStyle = weatherVisual === 'drizzle'
        ? 'rgba(185,215,238,.42)'
        : 'rgba(174,210,242,.62)';
      ctx.lineWidth = weatherVisual === 'drizzle' ? 1 : 1.5;
      for (let i = 0; i < count; i++) {
        const seed = i * 97.31;
        const x = ((seed * 13 + now * .34) % (w + 80)) - 40;
        const y = ((seed * 7 + now * .58) % (h + 60)) - 30;
        const len = weatherVisual === 'drizzle' ? 7 : 15;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - len * .28, y + len);
        ctx.stroke();
      }
      if (weatherVisual === 'thunderstorm' && Math.sin(now * .0017) > .997) {
        ctx.fillStyle = 'rgba(210,232,255,.16)';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();
    }
  }

  function hitDoor(clientX: number, clientY: number): WorldDoor | null {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const groundPx = GROUND_Y * TILE;
    const offsetY = Math.floor(h * 0.72 - groundPx);
    const cam = Math.floor(camX);
    for (const door of WORLD_DOORS) {
      if (sceneAt(door.tileX).id === 'shore') continue;
      const hy = world.heights[Math.min(WORLD_W - 1, door.tileX)];
      const cx = door.tileX * TILE - cam + TILE / 2;
      const cy = hy * TILE + offsetY - TILE * 2.2;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= (TILE * 2.1) ** 2) return door;
    }
    return null;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (disposed) return;
    if (inputActive && !inputActive()) return;
    if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName))
      return;
    if (e.repeat) return;
    keys.add(e.code);
    if (
      e.code === 'ArrowLeft' ||
      e.code === 'ArrowRight' ||
      e.code === 'ArrowUp' ||
      e.code === 'Space' ||
      e.code === 'KeyA' ||
      e.code === 'KeyD' ||
      e.code === 'KeyW' ||
      e.code === 'KeyJ' ||
      e.code === 'KeyK' ||
      e.code === 'KeyX'
    ) {
      e.preventDefault();
    }
    if (e.code === 'KeyE' || e.code === 'Enter') {
      const door = nearDoor();
      if (door) {
        e.preventDefault();
        onInteractDoor?.(door);
      }
    }
  }
  function onKeyUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }

  function setVirtualKey(code: string, down: boolean) {
    if (disposed) return;
    if (down) keys.add(code);
    else keys.delete(code);
    if (code === 'KeyE' && down) {
      const door = nearDoor();
      if (door) onInteractDoor?.(door);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clearKeys);
  playerY = surfaceAt(playerX);
  camX = Math.max(0, playerX - w * 0.42);
  raf = requestAnimationFrame(frame);

  return {
    setCameraX: (x: number) => {
      followPlayer = false;
      camX = Math.max(0, Math.min(maxCam(), x));
    },
    getCameraX: () => camX,
    getMaxCameraX: () => maxCam(),
    hitDoor,
    getNearDoor: nearDoor,
    setVirtualKey,
    clearVirtualKeys: clearKeys,
    setLightMode: (mode) => {
      lightMode = mode;
    },
    setWeatherVisual: (next) => {
      weatherVisual = next || 'clear';
    },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearKeys);
      clearKeys();
    },
  };
}
