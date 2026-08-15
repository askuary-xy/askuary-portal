import * as THREE from 'three';
import type { LibraryItem, LibraryKind, LibraryShape } from '../../types/config';

/** 顶栏分组：阅读 / 游玩 / 追番 / 影像 */
export type LibraryCategory = 'all' | 'read' | 'game' | 'anime' | 'screen';

export type SciFiBookData = {
  id: string;
  title: string;
  author: string;
  category: LibraryKind;
  categoryLabel: string;
  shape: LibraryShape;
  canOpen: boolean;
  icon: string;
  color: string;
  cover?: string;
  content: string;
  size: string;
  date: string;
  statusLabel: string;
  thoughts?: string;
  quotes?: string[];
  takeaways?: string[];
  link?: string;
  links?: Array<{ label: string; url: string }>;
  genre?: string;
  ratingLabel?: string;
  raw: LibraryItem;
};

type BookMode = 'float' | 'form' | 'focus' | 'opening';

type BookEntity = {
  data: SciFiBookData;
  group: THREE.Group;
  frontCover: THREE.Group;
  pageLeaves: THREE.Group[];
  pickables: THREE.Object3D[];
  canOpen: boolean;
  floatOrigin: THREE.Vector3;
  drift: THREE.Vector3;
  floatPhase: number;
  floatSpeed: number;
  spin: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetQuat: THREE.Quaternion;
  targetScale: number;
  openAmount: number;
  targetOpen: number;
  mode: BookMode;
  formSlot: THREE.Vector3 | null;
  disposables: Array<{ dispose: () => void }>;
};

type MeshBuilt = {
  group: THREE.Group;
  frontCover: THREE.Group;
  pageLeaves: THREE.Group[];
  pickables: THREE.Object3D[];
  disposables: Array<{ dispose: () => void }>;
};

/** Codrops AnimatedBooks 翻开角度（度） */
const OPEN_COVER_DEG = 145;
const OPEN_PAGE_DEGS = [30, 35, 118, 130, 140];

const CATEGORY_COLOR: Record<LibraryKind, string> = {
  book: '#4fc3f7',
  novel: '#b388ff',
  manga: '#ff80ab',
  game: '#ff8a65',
  anime: '#69f0ae',
  movie: '#80d8ff',
  drama: '#ce93d8',
  variety: '#ffd740',
};

const CATEGORY_ICON: Record<LibraryKind, string> = {
  book: '📘',
  novel: '📕',
  manga: '📗',
  game: '🎮',
  anime: '🎬',
  movie: '🎞',
  drama: '📺',
  variety: '🎙',
};

const KIND_LABEL: Record<LibraryKind, string> = {
  book: '图书',
  novel: '小说',
  manga: '漫画',
  game: '游戏',
  anime: '动漫',
  movie: '电影',
  drama: '电视剧',
  variety: '综艺',
};

const DEFAULT_SHAPE: Record<LibraryKind, LibraryShape> = {
  book: 'book',
  novel: 'book-slim',
  manga: 'book-tankobon',
  game: 'cartridge',
  anime: 'vhs',
  movie: 'disc-case',
  drama: 'disc-case-thick',
  variety: 'remote',
};

const TAB_KINDS: Record<Exclude<LibraryCategory, 'all'>, LibraryKind[]> = {
  read: ['book', 'novel', 'manga'],
  game: ['game'],
  anime: ['anime'],
  screen: ['movie', 'drama', 'variety'],
};

const TAB_LABEL: Record<LibraryCategory, string> = {
  all: '全部',
  read: '阅读',
  game: '游玩',
  anime: '追番',
  screen: '影像',
};

const BOOK_SHAPES = new Set<LibraryShape>(['book', 'book-slim', 'book-tankobon']);

const BOOK_DIMS: Record<'book' | 'book-slim' | 'book-tankobon', { w: number; h: number; d: number }> = {
  book: { w: 1.05, h: 1.48, d: 0.168 },
  'book-slim': { w: 1.0, h: 1.52, d: 0.11 },
  'book-tankobon': { w: 0.92, h: 1.28, d: 0.22 },
};

const IDLE_MS = 30_000;
const COVER_T = 0.024;
const PAGE_INSET = 0.055;

const ALL_SHAPES = new Set<LibraryShape>([
  'book',
  'book-slim',
  'book-tankobon',
  'cartridge',
  'vhs',
  'disc-case',
  'disc-case-thick',
  'remote',
]);

function resolveShape(item: LibraryItem): LibraryShape {
  if (item.shape && ALL_SHAPES.has(item.shape)) return item.shape;
  return DEFAULT_SHAPE[item.type] || 'book';
}

function matchesTab(kind: LibraryKind, cat: LibraryCategory): boolean {
  if (cat === 'all') return true;
  return TAB_KINDS[cat].includes(kind);
}

function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function mixColor(baseHex: string, id: string): string {
  const base = new THREE.Color(baseHex);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  hsl.h = (hsl.h + hashHue(id) / 3600) % 1;
  hsl.s = Math.min(1, hsl.s + 0.1);
  hsl.l = Math.min(0.68, Math.max(0.48, hsl.l + ((hashHue(id) % 16) - 8) / 100));
  return `#${base.setHSL(hsl.h, hsl.s, hsl.l).getHexString()}`;
}

export function toSciFiBook(item: LibraryItem): SciFiBookData {
  const bytes =
    (item.summary?.length || 0) * 12 +
    (item.thoughts?.length || 0) * 16 +
    (item.quotes?.join('').length || 0) * 8 +
    1024;
  const sizeKb = Math.max(1.2, bytes / 1024).toFixed(1);
  const shape = resolveShape(item);
  return {
    id: item.id,
    title: item.title,
    author: item.author,
    category: item.type,
    categoryLabel: item.typeLabel || KIND_LABEL[item.type] || item.type,
    shape,
    canOpen: BOOK_SHAPES.has(shape),
    icon: CATEGORY_ICON[item.type] || '◆',
    color: mixColor(CATEGORY_COLOR[item.type] || '#3de7ff', item.id),
    cover: item.cover || undefined,
    content: item.summary || item.thoughts || '这条档案还没有简介。',
    size: `${sizeKb} KB`,
    date: item.updated || item.year || '—',
    statusLabel: item.statusLabel || item.status,
    thoughts: item.thoughts,
    quotes: item.quotes,
    takeaways: item.takeaways,
    link: item.link,
    links: item.links,
    genre: item.genre,
    ratingLabel: item.ratingStars?.label,
    raw: item,
  };
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const chars = [...text];
  const lines: string[] = [];
  let line = '';
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** 圆形星点贴图：避免 Points 默认方块看起来像白框 */
function createStarSpriteTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.42, 'rgba(210,230,255,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** B-V 色温近似（参考 100,000 Stars / Stellarium） */
function colorFromBV(bv: number, out = new THREE.Color()): THREE.Color {
  const t = THREE.MathUtils.clamp(bv, -0.4, 2.0);
  if (t < 0) return out.setRGB(0.72, 0.8, 1);
  if (t < 0.5) return out.setRGB(0.85 + t * 0.2, 0.88 + t * 0.1, 1);
  if (t < 1.0) return out.setRGB(1, 0.95 - (t - 0.5) * 0.15, 0.82 - (t - 0.5) * 0.35);
  return out.setRGB(1, 0.72 - (t - 1) * 0.2, 0.45 - (t - 1) * 0.15);
}

function magToBrightness(mag: number): number {
  // 视星等：越小越亮；地球夜空大致 -1.5 … 6.5
  return Math.pow(2.512, -mag);
}

function createCoverTexture(book: SciFiBookData): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d')!;
  const color = new THREE.Color(book.color);
  const dark = color.clone().multiplyScalar(0.22);
  const mid = color.clone().multiplyScalar(0.55);

  const grad = ctx.createLinearGradient(0, 0, 0, 1080);
  grad.addColorStop(0, `#${mid.getHexString()}`);
  grad.addColorStop(0.4, `#${dark.getHexString()}`);
  grad.addColorStop(1, '#06070f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 768, 1080);

  // 无描边框 / 网格，远看不会成白框

  ctx.fillStyle = 'rgba(4, 8, 18, 0.55)';
  ctx.fillRect(64, 200, 640, 400);

  ctx.fillStyle = `#${color.getHexString()}`;
  ctx.font = '64px "Zpix", "Press Start 2P", monospace';
  ctx.fillText(book.icon, 92, 170);

  ctx.fillStyle = `rgba(${Math.floor(color.r * 200)}, ${Math.floor(color.g * 230)}, ${Math.floor(color.b * 255)}, 0.95)`;
  ctx.font = '22px "Press Start 2P", "Zpix", monospace';
  ctx.fillText(book.categoryLabel.toUpperCase().slice(0, 12), 92, 250);

  ctx.fillStyle = '#dce8f8';
  ctx.font = '44px "Zpix", "Press Start 2P", monospace';
  const titleLines = wrapText(ctx, book.title, 560);
  titleLines.slice(0, 4).forEach((line, i) => {
    ctx.fillText(line, 92, 330 + i * 58);
  });

  ctx.fillStyle = 'rgba(170, 200, 230, 0.9)';
  ctx.font = '28px "Zpix", "Press Start 2P", monospace';
  ctx.fillText(book.author.slice(0, 26), 92, 330 + Math.min(titleLines.length, 4) * 58 + 34);

  ctx.fillStyle = 'rgba(100, 180, 210, 0.7)';
  ctx.font = '16px "Press Start 2P", monospace';
  ctx.fillText(`ID  ${book.id.slice(0, 16).toUpperCase()}`, 92, 980);
  ctx.fillText(`SIZE  ${book.size}`, 92, 1015);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.anisotropy = 1;
  return tex;
}

/** 封面图铺满画布；略裁白边，避免封套「漂」出书板 */
function createPhotoCoverTexture(book: SciFiBookData, img: HTMLImageElement): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0a0c14';
  ctx.fillRect(0, 0, 768, 1080);

  // cover 裁切：略放大，吃掉常见白边
  const crop = 0.04;
  const sw = img.naturalWidth * (1 - crop * 2);
  const sh = img.naturalHeight * (1 - crop * 2);
  const sx = img.naturalWidth * crop;
  const sy = img.naturalHeight * crop;
  const scale = Math.max(768 / sw, 1080 / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(img, sx, sy, sw, sh, (768 - dw) / 2, (1080 - dh) / 2, dw, dh);

  const shine = ctx.createLinearGradient(0, 0, 768, 1080);
  shine.addColorStop(0, 'rgba(255,255,255,0.22)');
  shine.addColorStop(0.4, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, 768, 1080);

  const foot = ctx.createLinearGradient(0, 860, 0, 1080);
  foot.addColorStop(0, 'rgba(0,0,0,0)');
  foot.addColorStop(0.5, 'rgba(0,0,0,0.4)');
  foot.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.fillStyle = foot;
  ctx.fillRect(0, 860, 768, 220);

  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.font = '36px "Zpix", "Press Start 2P", monospace';
  const lines = wrapText(ctx, book.title, 680);
  lines.slice(0, 2).forEach((line, i) => ctx.fillText(line, 36, 960 + i * 42));
  ctx.fillStyle = 'rgba(220,230,245,0.82)';
  ctx.font = '24px "Zpix", "Press Start 2P", monospace';
  ctx.fillText(book.author.slice(0, 28), 36, 1048);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.anisotropy = 1;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`cover load failed: ${url}`));
    img.src = url;
  });
}

function hydrateCoverMap(
  book: SciFiBookData,
  coverMat: THREE.MeshStandardMaterial,
  disposables: Array<{ dispose: () => void }>,
): void {
  if (!book.cover) return;
  void loadHtmlImage(book.cover)
    .then((img) => {
      const tex = createPhotoCoverTexture(book, img);
      const prev = coverMat.map;
      coverMat.map = tex;
      coverMat.needsUpdate = true;
      disposables.push(tex);
      if (prev && prev !== tex) prev.dispose();
    })
    .catch(() => {
      /* 保留程序封面 */
    });
}

function createPageTexture(book: SciFiBookData, variant: 'blank' | 'content' | 'quote' = 'content'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 720;
  const ctx = canvas.getContext('2d')!;
  const paper = ctx.createLinearGradient(0, 0, 512, 0);
  paper.addColorStop(0, '#e1ddd8');
  paper.addColorStop(1, '#fffbf6');
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, 512, 720);
  ctx.fillStyle = 'rgba(80,70,60,0.12)';
  for (let y = 64; y < 680; y += 26) ctx.fillRect(40, y, 430, 1);

  ctx.fillStyle = '#3a3340';
  if (variant === 'blank') {
    /* 空白页 */
  } else if (variant === 'quote' && book.quotes?.[0]) {
    ctx.font = '24px "Zpix", "Press Start 2P", monospace';
    wrapText(ctx, `\u201c${book.quotes[0]}\u201d`, 400)
      .slice(0, 10)
      .forEach((line, i) => ctx.fillText(line, 48, 120 + i * 34));
    ctx.font = '20px "Zpix", "Press Start 2P", monospace';
    ctx.fillStyle = '#6a6570';
    ctx.fillText(`— ${book.author.slice(0, 20)}`, 48, 520);
  } else {
    ctx.font = '28px "Zpix", "Press Start 2P", monospace';
    ctx.fillText(book.title.slice(0, 18), 48, 56);
    ctx.font = '20px "Zpix", "Press Start 2P", monospace';
    ctx.fillStyle = '#4a4450';
    const body = book.thoughts || book.content;
    wrapText(ctx, body.slice(0, 160), 400)
      .slice(0, 12)
      .forEach((line, i) => ctx.fillText(line, 48, 110 + i * 32));
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

/** 赤经赤纬 → 天球坐标（地球视角：相机在球心向外看） */
function raDecToVec(raHours: number, decDeg: number, radius: number, out: THREE.Vector3): THREE.Vector3 {
  const ra = (raHours / 24) * Math.PI * 2;
  const dec = (decDeg * Math.PI) / 180;
  const cosDec = Math.cos(dec);
  // 天文惯例：RA 增加向东，这里映射到 -X 方向以匹配常见天球可视化
  out.set(
    -radius * cosDec * Math.sin(ra),
    radius * Math.sin(dec),
    -radius * cosDec * Math.cos(ra),
  );
  return out;
}

/**
 * 经典星座棍图（近似真实相对位置，单位：赤经小时 / 赤纬度）
 * 连线索引参考 Stellarium 风格
 */
const CONSTELLATIONS: Array<{
  name: string;
  stars: Array<[number, number, number, number]>; // ra, dec, mag, bv
  edges: Array<[number, number]>;
}> = [
  {
    name: 'Ursa Major',
    // 北斗七星：Dubhe Alkaid 勺形
    stars: [
      [11.062, 61.75, 1.79, 1.07], // Dubhe
      [11.031, 56.38, 2.37, 0.19], // Merak
      [11.897, 53.69, 2.44, 0.06], // Phecda
      [12.257, 57.03, 3.31, 0.16], // Megrez
      [12.9, 55.96, 1.77, -0.02], // Alioth
      [13.398, 54.92, 2.23, -0.19], // Mizar
      [13.792, 49.31, 1.86, -0.1], // Alkaid
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [3, 4],
      [4, 5],
      [5, 6],
    ],
  },
  {
    name: 'Orion',
    stars: [
      [5.919, 7.41, 0.42, 1.5], // Betelgeuse
      [5.418, 6.35, 1.64, -0.22], // Bellatrix
      [5.585, 9.93, 3.39, -0.18], // Meissa
      [5.533, -0.3, 2.23, -0.22], // Mintaka
      [5.603, -1.2, 1.69, -0.18], // Alnilam
      [5.679, -1.94, 1.74, -0.2], // Alnitak
      [5.242, -8.2, 0.13, -0.03], // Rigel
      [5.796, -9.67, 2.06, -0.18], // Saiph
    ],
    edges: [
      [0, 1],
      [0, 2],
      [1, 2],
      [0, 3],
      [1, 3],
      [3, 4],
      [4, 5],
      [5, 7],
      [6, 7],
      [5, 6],
      [3, 6],
    ],
  },
  {
    name: 'Cassiopeia',
    stars: [
      [0.675, 56.54, 2.24, 0.16], // Schedar
      [0.153, 59.15, 2.27, -0.05], // Caph
      [0.945, 60.72, 2.47, 0.13], // Gamma Cas
      [1.43, 60.24, 2.68, -0.15], // Ruchbah
      [1.907, 63.67, 3.38, 0.17], // Segin
    ],
    edges: [
      [1, 0],
      [0, 2],
      [2, 3],
      [3, 4],
    ],
  },
  {
    name: 'Cygnus',
    stars: [
      [20.69, 45.28, 1.25, 0.09], // Deneb
      [19.512, 27.96, 2.23, 0.99], // Albireo
      [20.371, 40.26, 2.48, -0.01], // Sadr
      [19.749, 45.13, 2.86, -0.09], // Delta Cyg
      [21.215, 30.23, 2.48, -0.09], // Epsilon Cyg
    ],
    edges: [
      [0, 2],
      [2, 1],
      [3, 2],
      [2, 4],
    ],
  },
  {
    name: 'Scorpius',
    stars: [
      [16.49, -26.43, 0.96, 1.83], // Antares
      [16.836, -34.29, 1.63, -0.22], // Shaula
      [17.56, -37.1, 1.87, -0.22], // Lesath
      [16.005, -22.62, 2.29, 1.14], // Dschubba
      [16.353, -25.59, 2.29, -0.18], // Pi Sco
      [15.98, -26.11, 2.89, -0.05], // Rho Sco
      [17.708, -39.03, 2.69, -0.18], // Kappa Sco
      [16.863, -38.05, 2.7, -0.11], // Iota Sco / approx chain
    ],
    edges: [
      [5, 3],
      [3, 4],
      [4, 0],
      [0, 1],
      [1, 2],
      [2, 6],
      [1, 7],
    ],
  },
  {
    name: 'Crux',
    stars: [
      [12.443, -63.1, 1.33, -0.24], // Acrux
      [12.795, -59.69, 1.25, 0.16], // Mimosa
      [12.519, -57.11, 1.59, -0.24], // Gacrux
      [12.252, -58.75, 2.79, -0.24], // Delta Cru
    ],
    edges: [
      [0, 2],
      [1, 3],
    ],
  },
  {
    name: 'Leo',
    stars: [
      [10.139, 11.97, 1.35, 0.09], // Regulus
      [11.818, 14.57, 2.14, 0.15], // Denebola
      [10.333, 19.84, 2.01, 1.15], // Algieba
      [9.685, 23.77, 2.56, 0.05], // Adhafera
      [9.764, 26.0, 3.44, 0.05], // Rasalas
      [11.235, 20.52, 2.56, 0.09], // Zosma
    ],
    edges: [
      [4, 3],
      [3, 2],
      [2, 0],
      [0, 5],
      [5, 1],
      [2, 5],
    ],
  },
];

function addGalaxyPointCloud(
  group: THREE.Group,
  disposables: Array<{ dispose: () => void }>,
  sprite: THREE.Texture,
  opts: {
    center: THREE.Vector3;
    count: number;
    radius: number;
    thickness: number;
    arms?: number;
    tint: THREE.Color;
    spiral?: boolean;
  },
): void {
  const { center, count, radius, thickness, tint, spiral = true, arms = 2 } = opts;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const tmp = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const fwd = center.clone().normalize();
  right.crossVectors(fwd, Math.abs(fwd.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
  up.crossVectors(right, fwd).normalize();

  const coreTint = new THREE.Color().setHSL(0.1, 0.45, 0.85);
  const armTint = tint.clone().lerp(new THREE.Color(0xa8c8ff), 0.45);
  const nebulaTint = new THREE.Color(0xff8aa8);

  for (let i = 0; i < count; i++) {
    let u: number;
    let v: number;
    let w: number;
    let onArm = false;
    const roll = Math.random();

    if (spiral && roll > 0.18) {
      // 旋臂：窄而斑驳，臂间留空
      onArm = true;
      const arm = Math.floor(Math.random() * arms);
      const t = Math.pow(Math.random(), 0.72); // 外缘略疏
      const a = arm * ((Math.PI * 2) / arms) + t * 3.6;
      const r = (0.22 + t * 0.78) * radius;
      // 臂宽随半径略增，但整体偏窄
      const armW = radius * (0.028 + t * 0.04) * (0.35 + Math.random());
      const n = (Math.random() - 0.5) * 2;
      u = Math.cos(a) * r + Math.cos(a + Math.PI / 2) * n * armW;
      v = Math.sin(a) * r * 0.7 + Math.sin(a + Math.PI / 2) * n * armW * 0.7;
      w = (Math.random() - 0.5) * thickness * (0.35 + (1 - t) * 0.45);
    } else if (roll > 0.06) {
      // 核心球状晕：密但半径小
      const a = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.85) * radius * 0.22;
      u = Math.cos(a) * r;
      v = Math.sin(a) * r * 0.72;
      w = (Math.random() - 0.5) * thickness * 0.55;
    } else {
      // 极稀疏晕盘（臂间点缀）
      const a = Math.random() * Math.PI * 2;
      const r = (0.25 + Math.random() * 0.75) * radius;
      u = Math.cos(a) * r;
      v = Math.sin(a) * r * 0.65;
      w = (Math.random() - 0.5) * thickness * 0.25;
    }

    tmp.copy(center).addScaledVector(right, u).addScaledVector(up, v).addScaledVector(fwd, w);
    pos[i * 3] = tmp.x;
    pos[i * 3 + 1] = tmp.y;
    pos[i * 3 + 2] = tmp.z;

    const dist2 = u * u + v * v;
    const core = Math.exp(-dist2 / (radius * radius * 0.045));
    let c = onArm ? armTint : tint;
    if (core > 0.35) c = coreTint;
    else if (onArm && Math.random() < 0.04) c = nebulaTint; // 臂上零星 HII

    const bright = (0.2 + Math.random() * 0.45 + core * 0.7) * (0.55 + Math.random() * 0.45);
    col[i * 3] = Math.min(1, c.r * bright);
    col[i * 3 + 1] = Math.min(1, c.g * bright);
    col[i * 3 + 2] = Math.min(1, c.b * bright);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    map: sprite,
    size: 1.7,
    vertexColors: true,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
  });
  group.add(new THREE.Points(geo, mat));
  disposables.push(geo, mat);
}

function buildEarthSky(scene: THREE.Scene): {
  group: THREE.Group;
  disposables: Array<{ dispose: () => void }>;
  twinkle: Array<{ mat: THREE.PointsMaterial; phase: number; speed: number; base: number; amp: number }>;
} {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const twinkle: Array<{ mat: THREE.PointsMaterial; phase: number; speed: number; base: number; amp: number }> = [];
  scene.add(group);

  const sprite = createStarSpriteTexture();
  disposables.push(sprite);
  const SKY_R = 180;
  const tmp = new THREE.Vector3();
  const cTmp = new THREE.Color();

  // —— 稀疏 3D 天球星：与底层 2D Starfield 叠层做视差，不要再铺满 ——
  const FIELD = 2200;
  const fPos = new Float32Array(FIELD * 3);
  const fCol = new Float32Array(FIELD * 3);
  const fSize = new Float32Array(FIELD);

  for (let i = 0; i < FIELD; i++) {
    let ra: number;
    let dec: number;
    if (i < FIELD * 0.34) {
      const along = Math.random() * 24;
      const band = (Math.random() - 0.5) * 22 + Math.sin(along * 0.55) * 10;
      ra = along;
      dec = band;
    } else {
      ra = Math.random() * 24;
      dec = (Math.acos(2 * Math.random() - 1) * 180) / Math.PI - 90;
    }
    const u = Math.random();
    const mag =
      u < 0.004 ? -0.8 + Math.random() * 1.4 : u < 0.05 ? 0.8 + Math.random() * 1.8 : 2.2 + Math.pow(Math.random(), 0.65) * 3.6;
    const bv =
      Math.random() < 0.14 ? -0.2 + Math.random() * 0.28 : Math.random() < 0.55 ? 0.3 + Math.random() * 0.5 : 0.7 + Math.random() * 0.9;

    raDecToVec(ra, dec, SKY_R + (Math.random() - 0.5) * 4, tmp);
    fPos[i * 3] = tmp.x;
    fPos[i * 3 + 1] = tmp.y;
    fPos[i * 3 + 2] = tmp.z;
    colorFromBV(bv, cTmp);
    // 抬亮：多数星至少可见，亮星明显
    const b = Math.min(2.2, magToBrightness(mag) * 0.85 + 0.42);
    fCol[i * 3] = Math.min(1, cTmp.r * b);
    fCol[i * 3 + 1] = Math.min(1, cTmp.g * b);
    fCol[i * 3 + 2] = Math.min(1, cTmp.b * b);
    fSize[i] = THREE.MathUtils.clamp(0.7 + b * 2.4, 0.7, 4.5);
  }

  const dimIdx: number[] = [];
  const midIdx: number[] = [];
  const brightIdx: number[] = [];
  for (let i = 0; i < FIELD; i++) {
    if (fSize[i] > 2.6) brightIdx.push(i);
    else if (fSize[i] > 1.5) midIdx.push(i);
    else dimIdx.push(i);
  }

  const makeLayer = (indices: number[], size: number, opacity: number, doTwinkle = false) => {
    const n = indices.length;
    if (n === 0) return;
    const p = new Float32Array(n * 3);
    const c = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      const i = indices[k];
      p[k * 3] = fPos[i * 3];
      p[k * 3 + 1] = fPos[i * 3 + 1];
      p[k * 3 + 2] = fPos[i * 3 + 2];
      c[k * 3] = fCol[i * 3];
      c[k * 3 + 1] = fCol[i * 3 + 1];
      c[k * 3 + 2] = fCol[i * 3 + 2];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const mat = new THREE.PointsMaterial({
      map: sprite,
      size,
      vertexColors: true,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: false,
    });
    group.add(new THREE.Points(geo, mat));
    disposables.push(geo, mat);
    if (doTwinkle) {
      twinkle.push({ mat, phase: Math.random() * Math.PI * 2, speed: 1.2 + Math.random() * 1.8, base: opacity, amp: 0.18 });
    }
  };

  // 像素尺寸略小，让底层宇宙页星空唱主角
  makeLayer(dimIdx, 2.2, 0.55, true);
  makeLayer(midIdx, 3.4, 0.7, true);
  makeLayer(brightIdx, 5.5, 0.85, true);
  makeLayer(
    brightIdx.filter((_, i) => i % 3 === 0),
    12,
    0.14,
    true,
  );

  // —— 星系：无数星点汇聚成盘/旋臂 ——
  const galaxySeeds: Array<{ ra: number; dec: number; spiral: boolean; warm: boolean; scale: number }> = [
    { ra: 0.73, dec: 41.3, spiral: true, warm: false, scale: 1.35 },
    { ra: 13.7, dec: 28.7, spiral: false, warm: false, scale: 0.7 },
    { ra: 12.3, dec: 12.7, spiral: true, warm: false, scale: 0.55 },
    { ra: 5.6, dec: -69.0, spiral: true, warm: true, scale: 0.9 },
    { ra: 18.2, dec: -23, spiral: false, warm: true, scale: 0.5 },
    { ra: 2.4, dec: -5, spiral: true, warm: false, scale: 0.65 },
    { ra: 10.7, dec: 56, spiral: true, warm: false, scale: 0.48 },
    { ra: 22.1, dec: 42, spiral: false, warm: false, scale: 0.42 },
    { ra: 7.5, dec: 20, spiral: true, warm: true, scale: 0.58 },
    { ra: 15.2, dec: -10, spiral: true, warm: false, scale: 0.72 },
    { ra: 3.8, dec: -35, spiral: false, warm: false, scale: 0.5 },
    { ra: 20.5, dec: -15, spiral: true, warm: true, scale: 0.6 },
  ];

  for (const g of galaxySeeds) {
    raDecToVec(g.ra, g.dec, SKY_R * 0.98, tmp);
    const tint = g.warm
      ? new THREE.Color().setHSL(0.08, 0.35, 0.72)
      : new THREE.Color().setHSL(0.58, 0.22, 0.78);
    addGalaxyPointCloud(group, disposables, sprite, {
      center: tmp.clone(),
      count: Math.floor(1100 * g.scale),
      radius: 11 * g.scale,
      thickness: 1.1 * g.scale,
      arms: 2 + Math.floor(Math.random() * 2),
      tint,
      spiral: g.spiral,
    });
  }

  // —— 星系团 ——
  for (let c = 0; c < 8; c++) {
    const ra = Math.random() * 24;
    const dec = (Math.random() - 0.5) * 140;
    raDecToVec(ra, dec, SKY_R * 1.02, tmp);
    const tint = new THREE.Color().setHSL(0.55 + Math.random() * 0.12, 0.2, 0.7);
    const n = 280 + Math.floor(Math.random() * 220);
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const spread = 4 + Math.random() * 6;
      pos[i * 3] = tmp.x + (Math.random() - 0.5) * spread;
      pos[i * 3 + 1] = tmp.y + (Math.random() - 0.5) * spread * 0.7;
      pos[i * 3 + 2] = tmp.z + (Math.random() - 0.5) * spread;
      const bright = 0.35 + Math.random() * 0.65;
      col[i * 3] = tint.r * bright;
      col[i * 3 + 1] = tint.g * bright;
      col[i * 3 + 2] = tint.b * bright;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      map: sprite,
      size: 2.4,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: false,
    });
    group.add(new THREE.Points(geo, mat));
    disposables.push(geo, mat);
  }

  // —— 星座亮星：不连线，只闪烁 ——
  const constPos: number[] = [];
  const constCol: number[] = [];

  for (const cst of CONSTELLATIONS) {
    for (const [ra, dec, mag, bv] of cst.stars) {
      raDecToVec(ra, dec, SKY_R * 0.995, tmp);
      constPos.push(tmp.x, tmp.y, tmp.z);
      colorFromBV(bv, cTmp);
      const b = Math.min(2.4, magToBrightness(mag) * 1.1 + 0.55);
      constCol.push(Math.min(1, cTmp.r * b), Math.min(1, cTmp.g * b), Math.min(1, cTmp.b * b));
    }
  }

  const cGeo = new THREE.BufferGeometry();
  cGeo.setAttribute('position', new THREE.Float32BufferAttribute(constPos, 3));
  cGeo.setAttribute('color', new THREE.Float32BufferAttribute(constCol, 3));
  const cMat = new THREE.PointsMaterial({
    map: sprite,
    size: 9,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
  });
  group.add(new THREE.Points(cGeo, cMat));
  disposables.push(cGeo, cMat);
  twinkle.push({ mat: cMat, phase: 0.4, speed: 2.6, base: 0.82, amp: 0.18 });

  const cHalo = new THREE.PointsMaterial({
    map: sprite,
    size: 22,
    vertexColors: true,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
  });
  group.add(new THREE.Points(cGeo, cHalo));
  disposables.push(cHalo);
  twinkle.push({ mat: cHalo, phase: 1.1, speed: 2.2, base: 0.18, amp: 0.14 });

  return { group, disposables, twinkle };
}

function randomOnShell(radiusMin: number, radiusMax: number, out: THREE.Vector3): THREE.Vector3 {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = radiusMin + Math.random() * (radiusMax - radiusMin);
  out.set(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta) * 0.75,
    r * Math.cos(phi),
  );
  return out;
}

function buildBookMesh(book: SciFiBookData, shape: 'book' | 'book-slim' | 'book-tankobon'): MeshBuilt {
  const { w: BOOK_W, h: BOOK_H, d: BOOK_D } = BOOK_DIMS[shape];
  const disposables: Array<{ dispose: () => void }> = [];
  const color = new THREE.Color(book.color);
  const coverTex = createCoverTexture(book);
  const pageBlank = createPageTexture(book, 'blank');
  const pageContent = createPageTexture(book, 'content');
  const pageQuote = createPageTexture(book, 'quote');
  disposables.push(coverTex, pageBlank, pageContent, pageQuote);

  const group = new THREE.Group();
  const pickables: THREE.Object3D[] = [];
  const pageLeaves: THREE.Group[] = [];

  const boardMat = new THREE.MeshStandardMaterial({
    color: color.clone().multiplyScalar(0.32),
    roughness: 0.62,
    metalness: 0.14,
  });
  const spineMat = new THREE.MeshStandardMaterial({
    color: color.clone().multiplyScalar(0.42),
    roughness: 0.52,
    metalness: 0.2,
  });
  const coverMat = new THREE.MeshStandardMaterial({
    map: coverTex,
    roughness: 0.4,
    metalness: 0.1,
  });
  const innerMat = new THREE.MeshStandardMaterial({
    color: '#f3eee4',
    roughness: 0.9,
    metalness: 0.02,
  });
  const paperEdge = new THREE.MeshStandardMaterial({
    color: '#cfc7ba',
    roughness: 0.92,
    metalness: 0.02,
  });
  const closedPaper = new THREE.MeshStandardMaterial({
    color: '#8a8276',
    roughness: 0.92,
    metalness: 0.02,
  });
  disposables.push(boardMat, spineMat, coverMat, innerMat, paperEdge, closedPaper);

  const halfD = BOOK_D / 2;
  const pageW = BOOK_W - PAGE_INSET;
  const pageH = BOOK_H - 0.08;
  const hingeX = -BOOK_W / 2;

  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(COVER_T * 1.15, BOOK_H - 0.01, BOOK_D + COVER_T * 0.35),
    spineMat,
  );
  spine.position.set(hingeX + COVER_T * 0.45, 0, 0);
  group.add(spine);
  pickables.push(spine);

  const block = new THREE.Mesh(new THREE.BoxGeometry(pageW, pageH, BOOK_D * 0.92), [
    paperEdge,
    paperEdge,
    paperEdge,
    paperEdge,
    closedPaper,
    paperEdge,
  ]);
  block.position.set(hingeX + PAGE_INSET * 0.35 + pageW / 2, 0, 0);
  group.add(block);
  pickables.push(block);

  const backBoard = new THREE.Mesh(new THREE.BoxGeometry(BOOK_W, BOOK_H, COVER_T), [
    boardMat,
    boardMat,
    boardMat,
    boardMat,
    innerMat,
    boardMat,
  ]);
  backBoard.position.set(0, 0, -halfD - COVER_T / 2);
  group.add(backBoard);
  pickables.push(backBoard);

  const leafVariants: Array<'blank' | 'content' | 'quote'> = ['blank', 'content', 'quote', 'blank', 'blank'];
  const leafMaps = [pageBlank, pageContent, pageQuote, pageBlank, pageBlank];
  const leafW = pageW - 0.02;
  const leafH = pageH - 0.02;
  for (let i = 0; i < OPEN_PAGE_DEGS.length; i++) {
    const leaf = new THREE.Group();
    leaf.position.set(hingeX + 0.028, 0, halfD - 0.018 - i * 0.007);
    const pageMat = new THREE.MeshStandardMaterial({
      map: leafMaps[i],
      roughness: 0.86,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    disposables.push(pageMat);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(leafW, leafH, 0.01),
      [paperEdge, paperEdge, paperEdge, paperEdge, pageMat, innerMat],
    );
    mesh.position.x = leafW / 2;
    mesh.userData.pageVariant = leafVariants[i];
    leaf.add(mesh);
    leaf.visible = false;
    leaf.userData.isLeaf = true;
    group.add(leaf);
    pageLeaves.push(leaf);
    pickables.push(mesh);
  }

  const frontCover = new THREE.Group();
  frontCover.position.set(hingeX, 0, halfD + COVER_T / 2);

  const frontBoard = new THREE.Mesh(new THREE.BoxGeometry(BOOK_W, BOOK_H, COVER_T), [
    boardMat,
    boardMat,
    boardMat,
    boardMat,
    boardMat,
    innerMat,
  ]);
  frontBoard.position.x = BOOK_W / 2;
  frontCover.add(frontBoard);
  pickables.push(frontBoard);

  const coverArt = new THREE.Mesh(new THREE.PlaneGeometry(BOOK_W * 0.965, BOOK_H * 0.965), coverMat);
  coverArt.position.set(BOOK_W / 2, 0, COVER_T / 2 + 0.0012);
  frontCover.add(coverArt);
  pickables.push(coverArt);

  group.add(frontCover);
  hydrateCoverMap(book, coverMat, disposables);

  return { group, frontCover, pageLeaves, pickables, disposables };
}

function solidMat(hex: string | THREE.Color, roughness = 0.55, metalness = 0.18): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: hex, roughness, metalness });
}

function buildCartridgeMesh(book: SciFiBookData): MeshBuilt {
  const disposables: Array<{ dispose: () => void }> = [];
  const color = new THREE.Color(book.color);
  const coverTex = createCoverTexture(book);
  disposables.push(coverTex);

  const group = new THREE.Group();
  const pickables: THREE.Object3D[] = [];
  const frontCover = new THREE.Group();
  group.add(frontCover);

  const W = 0.98;
  const H = 1.12;
  const D = 0.22;

  const bodyMat = solidMat(color.clone().multiplyScalar(0.38), 0.48, 0.22);
  const trimMat = solidMat(color.clone().multiplyScalar(0.62), 0.4, 0.28);
  const darkMat = solidMat('#1a1d28', 0.7, 0.1);
  const coverMat = new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.45, metalness: 0.08 });
  disposables.push(bodyMat, trimMat, darkMat, coverMat);

  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), bodyMat);
  group.add(body);
  pickables.push(body);

  // 顶部卡舌缺口
  const lip = new THREE.Mesh(new THREE.BoxGeometry(W * 0.72, 0.1, D * 0.55), darkMat);
  lip.position.set(0, H / 2 - 0.02, D * 0.08);
  group.add(lip);
  pickables.push(lip);

  // 侧面色带
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, H * 0.92, D + 0.01), trimMat);
  stripe.position.set(-W / 2 + 0.04, 0, 0);
  group.add(stripe);
  pickables.push(stripe);

  // 标签贴纸（封面）
  const label = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.78, H * 0.62), coverMat);
  label.position.set(0.04, -0.04, D / 2 + 0.002);
  group.add(label);
  pickables.push(label);

  hydrateCoverMap(book, coverMat, disposables);
  return { group, frontCover, pageLeaves: [], pickables, disposables };
}

function buildVhsMesh(book: SciFiBookData): MeshBuilt {
  const disposables: Array<{ dispose: () => void }> = [];
  const color = new THREE.Color(book.color);
  const coverTex = createCoverTexture(book);
  disposables.push(coverTex);

  const group = new THREE.Group();
  const pickables: THREE.Object3D[] = [];
  const frontCover = new THREE.Group();
  group.add(frontCover);

  const W = 1.55;
  const H = 0.95;
  const D = 0.24;

  const shellMat = solidMat(color.clone().multiplyScalar(0.28), 0.55, 0.12);
  const accentMat = solidMat(color.clone().multiplyScalar(0.55), 0.42, 0.2);
  const windowMat = solidMat('#0b1020', 0.25, 0.55);
  const coverMat = new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.48, metalness: 0.06 });
  disposables.push(shellMat, accentMat, windowMat, coverMat);

  const shell = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), shellMat);
  group.add(shell);
  pickables.push(shell);

  // 观察窗
  const winL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.02), windowMat);
  winL.position.set(-0.38, 0.08, D / 2 + 0.001);
  const winR = winL.clone();
  winR.position.x = 0.12;
  group.add(winL, winR);
  pickables.push(winL, winR);

  // 侧脊条
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.08, H + 0.01, D + 0.01), accentMat);
  spine.position.set(-W / 2 + 0.04, 0, 0);
  group.add(spine);
  pickables.push(spine);

  // 正面海报区
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.52, H * 0.78), coverMat);
  face.position.set(0.28, 0, D / 2 + 0.003);
  group.add(face);
  pickables.push(face);

  hydrateCoverMap(book, coverMat, disposables);
  return { group, frontCover, pageLeaves: [], pickables, disposables };
}

function buildDiscCaseMesh(book: SciFiBookData, thick: boolean): MeshBuilt {
  const disposables: Array<{ dispose: () => void }> = [];
  const color = new THREE.Color(book.color);
  const coverTex = createCoverTexture(book);
  disposables.push(coverTex);

  const group = new THREE.Group();
  const pickables: THREE.Object3D[] = [];
  const frontCover = new THREE.Group();
  group.add(frontCover);

  const W = 1.05;
  const H = 1.48;
  const D = thick ? 0.2 : 0.08;

  const caseMat = solidMat(color.clone().multiplyScalar(0.22), 0.35, 0.35);
  const spineMat = solidMat(color.clone().multiplyScalar(0.48), 0.4, 0.25);
  const coverMat = new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.38, metalness: 0.08 });
  disposables.push(caseMat, spineMat, coverMat);

  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), caseMat);
  group.add(body);
  pickables.push(body);

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.05, H + 0.01, D + 0.01), spineMat);
  spine.position.set(-W / 2 + 0.02, 0, 0);
  group.add(spine);
  pickables.push(spine);

  const art = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.92, H * 0.92), coverMat);
  art.position.set(0.02, 0, D / 2 + 0.002);
  group.add(art);
  pickables.push(art);

  if (thick) {
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 0.03, 0.01), spineMat);
    ridge.position.set(0, H / 2 - 0.08, D / 2 + 0.004);
    group.add(ridge);
    pickables.push(ridge);
  }

  hydrateCoverMap(book, coverMat, disposables);
  return { group, frontCover, pageLeaves: [], pickables, disposables };
}

function buildRemoteMesh(book: SciFiBookData): MeshBuilt {
  const disposables: Array<{ dispose: () => void }> = [];
  const color = new THREE.Color(book.color);
  const coverTex = createCoverTexture(book);
  disposables.push(coverTex);

  const group = new THREE.Group();
  const pickables: THREE.Object3D[] = [];
  const frontCover = new THREE.Group();
  group.add(frontCover);

  const W = 0.58;
  const H = 1.28;
  const D = 0.14;

  const bodyMat = solidMat(color.clone().multiplyScalar(0.3), 0.55, 0.18);
  const keyMat = solidMat(color.clone().multiplyScalar(0.7), 0.45, 0.15);
  const darkMat = solidMat('#12141c', 0.6, 0.2);
  const coverMat = new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.42, metalness: 0.05 });
  disposables.push(bodyMat, keyMat, darkMat, coverMat);

  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), bodyMat);
  group.add(body);
  pickables.push(body);

  // 迷你屏 = 封面
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.72, 0.28), coverMat);
  screen.position.set(0, H * 0.28, D / 2 + 0.002);
  group.add(screen);
  pickables.push(screen);

  const bezel = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.34, 0.02), darkMat);
  bezel.position.set(0, H * 0.28, D / 2 + 0.001);
  group.add(bezel);
  pickables.push(bezel);
  // 屏在 bezel 前
  screen.position.z = D / 2 + 0.012;

  // 按键格
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      const key = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.03), keyMat);
      key.position.set((c - 1) * 0.16, -0.05 - r * 0.16, D / 2 + 0.01);
      group.add(key);
      pickables.push(key);
    }
  }

  hydrateCoverMap(book, coverMat, disposables);
  return { group, frontCover, pageLeaves: [], pickables, disposables };
}

function buildItemMesh(book: SciFiBookData): MeshBuilt {
  switch (book.shape) {
    case 'book-slim':
    case 'book-tankobon':
    case 'book':
      return buildBookMesh(book, book.shape);
    case 'cartridge':
      return buildCartridgeMesh(book);
    case 'vhs':
      return buildVhsMesh(book);
    case 'disc-case':
      return buildDiscCaseMesh(book, false);
    case 'disc-case-thick':
      return buildDiscCaseMesh(book, true);
    case 'remote':
      return buildRemoteMesh(book);
    default:
      return buildBookMesh(book, 'book');
  }
}

export type LibrarySceneApi = {
  setCategory: (cat: LibraryCategory) => Promise<void>;
  releaseFocus: () => void;
  noteActivity: () => void;
  dispose: () => void;
  getCategory: () => LibraryCategory;
  isAnimating: () => boolean;
};

export type LibrarySceneOptions = {
  canvas: HTMLCanvasElement;
  books: SciFiBookData[];
  onOpenDetail: (book: SciFiBookData) => void;
  onStatus?: (text: string, count: number, category: LibraryCategory) => void;
};

export function createLibraryScene(options: LibrarySceneOptions): LibrarySceneApi {
  const { canvas, books, onOpenDetail, onStatus } = options;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 500);
  camera.position.set(0, 1.2, 14);

  scene.add(new THREE.AmbientLight(0xb8c4d8, 0.55));
  const key = new THREE.PointLight(0xfff5e8, 42, 48, 2);
  key.position.set(7, 9, 11);
  const fill = new THREE.PointLight(0xa8c8ff, 22, 42, 2);
  fill.position.set(-9, -3, 5);
  const rim = new THREE.DirectionalLight(0xffffff, 0.35);
  rim.position.set(-3, 5, 8);
  scene.add(key, fill, rim);

  // 地球视角天球：视星等 / 色温 / 银河带 / 星点星系 / 真实星座棍图
  const deepSky = buildEarthSky(scene);

  const entities: BookEntity[] = [];
  const meshToEntity = new Map<THREE.Object3D, BookEntity>();
  const camQuat = new THREE.Quaternion();
  const focusOffset = new THREE.Vector3();
  const tmpV = new THREE.Vector3();

  for (const data of books) {
    const built = buildItemMesh(data);
    scene.add(built.group);
    const floatOrigin = randomOnShell(4.5, 9.5, new THREE.Vector3());
    built.group.position.copy(floatOrigin);
    built.group.scale.setScalar(1);

    const entity: BookEntity = {
      data,
      group: built.group,
      frontCover: built.frontCover,
      pageLeaves: built.pageLeaves,
      pickables: built.pickables,
      canOpen: data.canOpen,
      floatOrigin: floatOrigin.clone(),
      drift: new THREE.Vector3(
        (Math.random() - 0.5) * 0.35,
        (Math.random() - 0.5) * 0.28,
        (Math.random() - 0.5) * 0.35,
      ),
      floatPhase: Math.random() * Math.PI * 2,
      floatSpeed: 0.2 + Math.random() * 0.5,
      spin: new THREE.Vector3(
        (Math.random() - 0.5) * 0.35,
        0.25 + Math.random() * 0.45,
        (Math.random() - 0.5) * 0.2,
      ),
      targetPos: floatOrigin.clone(),
      targetQuat: built.group.quaternion.clone(),
      targetScale: 1,
      openAmount: 0,
      targetOpen: 0,
      mode: 'float',
      formSlot: null,
      disposables: built.disposables,
    };
    entities.push(entity);
    for (const m of built.pickables) meshToEntity.set(m, entity);
  }

  let category: LibraryCategory = 'all';
  let animating = false;
  let animToken = 0;
  let disposed = false;
  let focused: BookEntity | null = null;
  let lastActivity = performance.now();
  let layoutMode: 'float' | 'form' = 'float';

  let pointerDown = false;
  let dragged = false;
  let lastX = 0;
  let lastY = 0;
  let rotY = 0.18;
  let rotX = 0.08;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const clock = new THREE.Clock();

  function noteActivity() {
    lastActivity = performance.now();
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  resize();

  function formationLayout(selected: BookEntity[]): THREE.Vector3[] {
    const n = selected.length;
    const cols = Math.min(5, Math.max(1, n));
    const rows = Math.ceil(n / cols);
    const gapX = 1.45;
    const gapY = 1.85;
    const positions: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const rowCount = Math.min(cols, n - row * cols);
      const x = (col - (rowCount - 1) / 2) * gapX;
      const y = ((rows - 1) / 2 - row) * gapY + 0.15;
      positions.push(new THREE.Vector3(x, y, 2.4));
    }
    return positions;
  }

  function reportStatus(extra?: string) {
    const count =
      category === 'all'
        ? entities.length
        : entities.filter((e) => matchesTab(e.data.category, category)).length;
    const label = TAB_LABEL[category] || category;
    const base =
      layoutMode === 'form' ? `阵列模式 · ${label}` : `漂浮模式 · ${label === '全部' ? '全馆' : label}`;
    onStatus?.(extra || base, count, category);
  }

  function closeBook(e: BookEntity) {
    e.targetOpen = 0;
    for (const leaf of e.pageLeaves) leaf.visible = false;
  }

  function releaseFocus() {
    if (!focused) return;
    const e = focused;
    closeBook(e);
    e.targetScale = 1;
    if (layoutMode === 'form' && e.formSlot) {
      e.mode = 'form';
      e.targetPos.copy(e.formSlot);
    } else {
      e.mode = 'float';
      randomOnShell(4.5, 9.5, e.floatOrigin);
      e.targetPos.copy(e.floatOrigin);
    }
    focused = null;
    noteActivity();
    reportStatus();
  }

  function releaseAllToFloat(message = 'PIXEL ARCHIVE') {
    animToken += 1;
    layoutMode = 'float';
    focused = null;
    for (const e of entities) {
      closeBook(e);
      e.mode = 'float';
      e.formSlot = null;
      e.targetScale = 1;
      e.targetOpen = 0;
      randomOnShell(4.5, 9.5, e.floatOrigin);
      e.drift.set(
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.4,
      );
      e.targetPos.copy(e.floatOrigin);
      e.floatPhase = Math.random() * Math.PI * 2;
    }
    animating = false;
    reportStatus(message);
  }

  async function setCategory(next: LibraryCategory): Promise<void> {
    if (disposed) return;
    noteActivity();
    category = next;
    focused = null;
    const token = ++animToken;
    animating = true;
    layoutMode = 'form';

    const selected = entities.filter((e) => matchesTab(e.data.category, next));
    const others = entities.filter((e) => !selected.includes(e));
    const layout = formationLayout(selected);
    camera.getWorldQuaternion(camQuat);

    selected.forEach((e, i) => {
      closeBook(e);
      e.mode = 'form';
      e.targetScale = 1;
      e.formSlot = (layout[i] || tmpV.set(0, 0, 2.4)).clone();
      e.targetPos.copy(e.formSlot);
      e.targetQuat.copy(camQuat);
    });

    others.forEach((e) => {
      closeBook(e);
      e.mode = 'float';
      e.formSlot = null;
      e.targetScale = 1;
      randomOnShell(11, 16, e.floatOrigin);
      e.targetPos.copy(e.floatOrigin);
      e.floatPhase = Math.random() * Math.PI * 2;
    });

    reportStatus(`正在列阵 · ${TAB_LABEL[next]}`);

    const start = performance.now();
    await new Promise<void>((resolve) => {
      const check = () => {
        if (disposed || token !== animToken) {
          resolve();
          return;
        }
        if (performance.now() - start > 1300) {
          animating = false;
          resolve();
          return;
        }
        requestAnimationFrame(check);
      };
      check();
    });
    if (token === animToken) {
      animating = false;
      reportStatus();
    }
  }

  function focusBook(e: BookEntity) {
    noteActivity();
    if (focused && focused !== e) {
      const prev = focused;
      closeBook(prev);
      prev.targetScale = 1;
      if (layoutMode === 'form' && prev.formSlot) {
        prev.mode = 'form';
        prev.targetPos.copy(prev.formSlot);
      } else {
        prev.mode = 'float';
        randomOnShell(4.5, 9.5, prev.floatOrigin);
        prev.targetPos.copy(prev.floatOrigin);
      }
    }
    focused = e;
    e.mode = 'focus';
    e.targetOpen = 0;
    e.targetScale = 1.5;
    reportStatus(`聚焦 · ${e.data.title}`);
  }

  function openFocusedBook(e: BookEntity) {
    noteActivity();
    if (!e.canOpen) {
      e.mode = 'focus';
      onOpenDetail(e.data);
      reportStatus(`展开详情 · ${e.data.title}`);
      return;
    }
    e.mode = 'opening';
    e.targetOpen = 1;
    for (const leaf of e.pageLeaves) leaf.visible = true;
    animating = true;
    window.setTimeout(() => {
      if (disposed || focused !== e) return;
      animating = false;
      onOpenDetail(e.data);
      reportStatus(`展开详情 · ${e.data.title}`);
    }, 900);
  }

  function pick(clientX: number, clientY: number): BookEntity | null {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const meshes = entities.flatMap((e) => e.pickables);
    const hits = raycaster.intersectObjects(meshes, false);
    if (!hits.length) return null;
    return meshToEntity.get(hits[0].object) || null;
  }

  function onPointerDown(e: PointerEvent) {
    pointerDown = true;
    dragged = false;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.classList.add('is-dragging');
    canvas.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!pointerDown) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    if (Math.hypot(dx, dy) > 5) dragged = true;
    lastX = e.clientX;
    lastY = e.clientY;
    rotY += dx * 0.0045;
    rotX += dy * 0.0035;
    rotX = Math.max(-0.55, Math.min(0.65, rotX));
    if (dragged) noteActivity();
  }

  function onPointerUp(e: PointerEvent) {
    pointerDown = false;
    canvas.classList.remove('is-dragging');
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (dragged) return;
    if (animating && focused?.mode === 'opening') return;

    const hit = pick(e.clientX, e.clientY);
    if (!hit) {
      if (focused) releaseFocus();
      else noteActivity();
      return;
    }

    if (focused === hit) {
      if (!hit.canOpen) {
        onOpenDetail(hit.data);
      } else if (hit.openAmount > 0.5) {
        onOpenDetail(hit.data);
      } else {
        openFocusedBook(hit);
      }
      return;
    }

    focusBook(hit);
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('resize', resize);

  function tick() {
    if (disposed) return;
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, clock.getDelta() || 0.016);
    const t = clock.elapsedTime;

    if (performance.now() - lastActivity > IDLE_MS && (layoutMode === 'form' || focused)) {
      releaseAllToFloat();
      noteActivity();
    }

    // 天球缓慢自转 + 星光闪烁
    deepSky.group.rotation.y = t * 0.0035;
    deepSky.group.rotation.x = Math.sin(t * 0.05) * 0.02;
    for (const tw of deepSky.twinkle) {
      tw.mat.opacity = tw.base + tw.amp * (0.5 + 0.5 * Math.sin(t * tw.speed + tw.phase));
    }

    const radius = 14;
    camera.position.x = Math.sin(rotY) * radius * Math.cos(rotX);
    camera.position.y = 1.15 + Math.sin(rotX) * 5.5;
    camera.position.z = Math.cos(rotY) * radius * Math.cos(rotX);
    camera.lookAt(0, 0.25, 0);
    camera.getWorldQuaternion(camQuat);

    const lerpPos = animating ? 1 - Math.pow(0.0008, dt) : 1 - Math.pow(0.018, dt);
    const lerpRot = 1 - Math.pow(0.03, dt);

    for (const e of entities) {
      if (e.mode === 'float') {
        // 随机漂移轨迹：原点缓慢迁移
        e.floatOrigin.x += e.drift.x * dt;
        e.floatOrigin.y += e.drift.y * dt;
        e.floatOrigin.z += e.drift.z * dt;
        if (e.floatOrigin.length() > 12 || e.floatOrigin.length() < 3.5) {
          e.drift.multiplyScalar(-1);
          e.drift.x += (Math.random() - 0.5) * 0.1;
          e.drift.y += (Math.random() - 0.5) * 0.08;
          e.drift.z += (Math.random() - 0.5) * 0.1;
        }
        const bob = Math.sin(t * e.floatSpeed + e.floatPhase) * 0.45;
        const sway = Math.cos(t * e.floatSpeed * 0.65 + e.floatPhase) * 0.4;
        e.targetPos.set(
          e.floatOrigin.x + sway,
          e.floatOrigin.y + bob,
          e.floatOrigin.z + Math.sin(t * 0.28 + e.floatPhase) * 0.35,
        );
        e.group.rotation.x += e.spin.x * dt;
        e.group.rotation.y += e.spin.y * dt;
        e.group.rotation.z += e.spin.z * dt;
      } else if (e.mode === 'form') {
        if (e.formSlot) e.targetPos.copy(e.formSlot);
        e.targetQuat.copy(camQuat);
        e.group.quaternion.slerp(e.targetQuat, lerpRot);
      } else if (e.mode === 'focus' || e.mode === 'opening') {
        // 书系略侧视看翻页；卡带/碟盒正对相机
        const side = e.canOpen ? 0.38 + e.openAmount * 0.12 : 0.08;
        focusOffset.set(e.canOpen ? 0.15 : 0, 0.05, e.canOpen ? -3.55 : -3.2);
        focusOffset.applyQuaternion(camQuat);
        e.targetPos.copy(camera.position).add(focusOffset);
        const showcase = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(-0.06, side, e.canOpen ? 0.02 : 0),
        );
        e.targetQuat.copy(camQuat).multiply(showcase);
        e.group.quaternion.slerp(e.targetQuat, lerpRot);
      }

      e.group.position.lerp(e.targetPos, lerpPos);
      const s = e.group.scale.x;
      const ns = s + (e.targetScale - s) * (1 - Math.pow(0.04, dt));
      e.group.scale.setScalar(ns);

      // Codrops：封面 -145°，内页扇开 30°…140°
      const openEase = 1 - Math.pow(0.04, dt);
      e.openAmount += (e.targetOpen - e.openAmount) * openEase;
      e.frontCover.rotation.y = -e.openAmount * THREE.MathUtils.degToRad(OPEN_COVER_DEG);
      e.pageLeaves.forEach((leaf, i) => {
        leaf.rotation.y = -e.openAmount * THREE.MathUtils.degToRad(OPEN_PAGE_DEGS[i] ?? 40);
      });
    }

    renderer.render(scene, camera);
  }
  tick();

  reportStatus('PIXEL ARCHIVE');

  return {
    setCategory,
    releaseFocus,
    noteActivity,
    getCategory: () => category,
    isAnimating: () => animating,
    dispose: () => {
      disposed = true;
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('resize', resize);
      for (const e of entities) {
        for (const d of e.disposables) d.dispose();
        e.group.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
        });
      }
      for (const d of deepSky.disposables) d.dispose();
      renderer.dispose();
    },
  };
}
