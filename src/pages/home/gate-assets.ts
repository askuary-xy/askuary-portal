/**
 * 传送门世界素材（public/gate-world/）
 * - 角色：F:/2d/character（含 Attack1/2）
 * - 山/云：FabinhoSC + MatiasVME（OpenGameArt，CC0）
 * - 树：从 MatiasVME 树带裁切，种在地表上
 */

const BASE = '/gate-world';
const VER = 'gw-9';

export type SheetAnim = {
  img: HTMLImageElement;
  frameW: number;
  frameH: number;
  frames: number;
};

export type GateAssets = {
  ready: boolean;
  terrain: HTMLImageElement;
  /** 海岸由独立的背景、中景、地面与前景层组成。 */
  coastSky: HTMLImageElement;
  coastMidground: HTMLImageElement;
  coastGround: HTMLCanvasElement;
  coastForeground: HTMLCanvasElement;
  mountains: HTMLImageElement[];
  cloudStrip: HTMLImageElement;
  trees: HTMLImageElement[];
  hero: {
    idle: SheetAnim;
    walk: SheetAnim;
    run: SheetAnim;
    jump: SheetAnim;
    attack1: SheetAnim;
    attack2: SheetAnim;
    attack1Fx: SheetAnim | null;
    attack2Fx: SheetAnim | null;
  };
  shadow: HTMLImageElement;
  /** 攻击尘土（可选） */
  dust: HTMLImageElement | null;
};

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`asset failed: ${src}`));
    img.src = `${src}?v=${VER}`;
  });
}

async function loadImgOpt(src: string): Promise<HTMLImageElement | null> {
  try {
    return await loadImg(src);
  } catch {
    return null;
  }
}

/** 将专为像素素材生成的洋红底转换为透明，不改变物件边缘颜色。 */
async function loadChromaLayer(src: string): Promise<HTMLCanvasElement> {
  const img = await loadImg(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const r = pixels.data[i];
    const g = pixels.data[i + 1];
    const b = pixels.data[i + 2];
    if (r > 185 && b > 150 && g < 115) pixels.data[i + 3] = 0;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

function anim(img: HTMLImageElement, frameH?: number): SheetAnim {
  const fh = frameH ?? img.height;
  const fw = fh;
  const frames = Math.max(1, Math.floor(img.width / fw));
  return { img, frameW: fw, frameH: fh, frames };
}

export const T = {
  size: 16,
  grassL: { sx: 6 * 16, sy: 0 },
  grassM: { sx: 7 * 16, sy: 0 },
  grassR: { sx: 8 * 16, sy: 0 },
  dirtL: { sx: 6 * 16, sy: 16 },
  dirtR: { sx: 8 * 16, sy: 16 },
  dirtFill: { sx: 7 * 16, sy: 16 },
} as const;

let cache: GateAssets | null = null;

export async function loadGateAssets(): Promise<GateAssets> {
  if (cache?.ready && cache.hero.attack1) return cache;

  const treeUrls = Array.from({ length: 8 }, (_, i) => `${BASE}/parallax/skyline/trees/t${i}.png`);
  const [
    terrain,
    coastSky,
    coastMidground,
    coastGround,
    coastForeground,
    cloudStrip,
    m1,
    m2,
    idle,
    walk,
    run,
    jump,
    attack1,
    attack2,
    attack1FxImg,
    attack2FxImg,
    shadow,
    dust,
    ...treeImgs
  ] = await Promise.all([
    loadImg(`${BASE}/terrain.png`),
    loadImg(`${BASE}/hd2d/coast/sky.png`),
    loadImg(`${BASE}/hd2d/coast/midground.png`),
    loadChromaLayer(`${BASE}/hd2d/coast/ground-seam-key.png`),
    loadChromaLayer(`${BASE}/hd2d/coast/foreground-key.png`),
    loadImg(`${BASE}/parallax/skyline/forest_background_clouds.png`),
    loadImgOpt(`${BASE}/parallax/skyline/backgroundmountain_01.png`),
    loadImgOpt(`${BASE}/parallax/skyline/backgroundmountain02.png`),
    loadImg(`${BASE}/hero/idle.png`),
    loadImg(`${BASE}/hero/walk.png`),
    loadImg(`${BASE}/hero/run.png`),
    loadImg(`${BASE}/hero/jump.png`),
    loadImg(`${BASE}/hero/attack1.png`),
    loadImg(`${BASE}/hero/attack2.png`),
    loadImgOpt(`${BASE}/hero/effect/attack1-effect.png`),
    loadImgOpt(`${BASE}/hero/effect/attack2-effect.png`),
    loadImg(`${BASE}/fx/shadow.png`),
    loadImgOpt(`${BASE}/fx/dust.png`),
    ...treeUrls.map((u) => loadImgOpt(u)),
  ]);

  const mountains = [m1, m2].filter((x): x is HTMLImageElement => !!x);
  const trees = treeImgs.filter((x): x is HTMLImageElement => !!x);
  if (!mountains.length) throw new Error('mountain layers missing');
  if (!trees.length) throw new Error('tree sprites missing');

  cache = {
    ready: true,
    terrain,
    coastSky,
    coastMidground,
    coastGround,
    coastForeground,
    mountains,
    cloudStrip,
    trees,
    hero: {
      idle: anim(idle),
      walk: anim(walk),
      run: anim(run),
      jump: anim(jump),
      attack1: anim(attack1),
      attack2: anim(attack2),
      attack1Fx: attack1FxImg ? anim(attack1FxImg) : null,
      attack2Fx: attack2FxImg ? anim(attack2FxImg) : null,
    },
    shadow,
    dust,
  };
  return cache;
}

export function blitTile(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  uv: { sx: number; sy: number },
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, uv.sx, uv.sy, T.size, T.size, dx, dy, dw, dh);
}

export function blitFrame(
  ctx: CanvasRenderingContext2D,
  sheet: SheetAnim,
  frame: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  flip = false,
) {
  const f = ((frame % sheet.frames) + sheet.frames) % sheet.frames;
  const sx = f * sheet.frameW;
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  if (flip) {
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(sheet.img, sx, 0, sheet.frameW, sheet.frameH, 0, 0, dw, dh);
  } else {
    ctx.drawImage(sheet.img, sx, 0, sheet.frameW, sheet.frameH, dx, dy, dw, dh);
  }
  ctx.restore();
}
