/**
 * 从 F:\2d 安装传送门世界素材 → public/gate-world/
 * 主要使用 Pixel Adventure（Pixel Frog，免费）+ character 角色。
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_ZIP = 'F:/2d/Pixel Adventure 1.zip';
const OUT = path.join(ROOT, 'public', 'gate-world');
const TMP = path.join(ROOT, 'tools', '_pa_extract');

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function walkLog(dir, prefix = '') {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const q = `${prefix}/${e.name}`;
    if (e.isDirectory()) walkLog(path.join(dir, e.name), q);
    else console.log(q, fs.statSync(path.join(dir, e.name)).size);
  }
}

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

console.log('解压', SRC_ZIP);
execFileSync('tar', ['-xf', SRC_ZIP, '-C', TMP]);
const base = path.join(TMP, '912sucai');

for (const c of ['Blue', 'Green', 'Purple', 'Brown', 'Gray', 'Pink', 'Yellow']) {
  const src = path.join(base, 'Background', `${c}.png`);
  if (fs.existsSync(src)) copy(src, path.join(OUT, 'bg', `${c.toLowerCase()}.png`));
}

copy(path.join(base, 'Terrain', 'Terrain (16x16).png'), path.join(OUT, 'terrain.png'));

const md = path.join(base, 'Main Characters', 'Mask Dude');
for (const f of fs.readdirSync(md)) {
  const nice = f.replace(/ \(\d+x\d+\)/g, '').replace(/ /g, '-').toLowerCase();
  copy(path.join(md, f), path.join(OUT, 'char', nice.endsWith('.png') ? nice : `${nice}.png`));
}

const items = [
  ['Items/Boxes/Box1/Idle.png', 'props/box.png'],
  ['Items/Boxes/Box2/Idle.png', 'props/box2.png'],
  ['Items/Boxes/Box3/Idle.png', 'props/box3.png'],
  ['Items/Checkpoints/Checkpoint/Checkpoint (Flag Idle)(64x64).png', 'props/flag.png'],
  ['Items/Checkpoints/Checkpoint/Checkpoint (No Flag).png', 'props/sign-post.png'],
  ['Items/Checkpoints/Start/Start (Idle).png', 'props/start.png'],
  ['Items/Checkpoints/End/End (Idle).png', 'props/end.png'],
  ['Items/Fruits/Apple.png', 'props/apple.png'],
  ['Items/Fruits/Cherries.png', 'props/cherries.png'],
  ['Items/Fruits/Kiwi.png', 'props/kiwi.png'],
  ['Items/Fruits/Orange.png', 'props/orange.png'],
  ['Menu/Buttons/Play.png', 'ui/play.png'],
  ['Menu/Buttons/Settings.png', 'ui/settings.png'],
  ['Menu/Buttons/Close.png', 'ui/close.png'],
  ['Other/Shadow.png', 'fx/shadow.png'],
  ['Other/Dust Particle.png', 'fx/dust.png'],
];
for (const [a, b] of items) {
  const src = path.join(base, a);
  if (fs.existsSync(src)) copy(src, path.join(OUT, b));
  else console.warn('missing', a);
}

const heroDir = 'F:/2d/character/Character';
for (const f of ['Idle.png', 'Walk.png', 'Run.png', 'Jump.png', 'Attack1.png', 'Attack2.png']) {
  const src = path.join(heroDir, f);
  if (fs.existsSync(src)) copy(src, path.join(OUT, 'hero', f.toLowerCase()));
}
for (const f of ['Attack1-effect.png', 'Attack2-effect.png']) {
  const src = path.join(heroDir, 'effect', f);
  if (fs.existsSync(src)) copy(src, path.join(OUT, 'hero', 'effect', f.toLowerCase()));
}

// OpenGameArt CC0：矮树线 + 云层（透明天空，无硬分界）
const paraDir = path.join(OUT, 'parallax');
const skylineDir = path.join(paraDir, 'skyline');
const cloudsDir = path.join(skylineDir, 'clouds');
fs.mkdirSync(cloudsDir, { recursive: true });
const paraTmp = path.join(ROOT, 'tools', '_parallax');
fs.rmSync(paraTmp, { recursive: true, force: true });
fs.mkdirSync(paraTmp, { recursive: true });

const forestZip = path.join(paraTmp, 'forest2.zip');
const forestRes = await fetch(
  'https://opengameart.org/sites/default/files/parallax_background_forest.zip',
);
if (!forestRes.ok) throw new Error('skyline forest download failed');
fs.writeFileSync(forestZip, Buffer.from(await forestRes.arrayBuffer()));
execFileSync('tar', ['-xf', forestZip, '-C', paraTmp]);
const layersDir = path.join(paraTmp, 'parallax_background_forest');
for (const name of ['forest_background_trees.png', 'forest_background_clouds.png', 'forest_background_sun.png']) {
  const src = path.join(layersDir, name);
  if (fs.existsSync(src)) copy(src, path.join(skylineDir, name));
}

const cloudsZip = path.join(paraTmp, 'clouds2.zip');
const cloudsRes = await fetch(
  'https://opengameart.org/sites/default/files/background_clouds_and_mountains_parallax.zip',
);
if (cloudsRes.ok) {
  fs.writeFileSync(cloudsZip, Buffer.from(await cloudsRes.arrayBuffer()));
  execFileSync('tar', ['-xf', cloudsZip, '-C', paraTmp]);
  const clayers = path.join(
    paraTmp,
    'Background_Clouds_And_Mountains_Parallax_',
    'Layers',
  );
  if (fs.existsSync(clayers)) {
    for (const name of fs.readdirSync(clayers)) {
      if (!/^Cloud/i.test(name)) continue;
      copy(path.join(clayers, name), path.join(cloudsDir, name.toLowerCase()));
    }
  }
}
fs.rmSync(paraTmp, { recursive: true, force: true });

fs.writeFileSync(
  path.join(OUT, 'README.md'),
  [
    '# Gate World assets',
    '',
    '- Terrain：Pixel Adventure（Pixel Frog，CC0）',
    '- parallax/skyline/*：MatiasVME 矮树/云（OpenGameArt，CC0）',
    '- parallax/skyline/clouds/*：FabinhoSC 云朵（OpenGameArt，CC0）',
    '- hero/*：F:/2d/character（含 Attack1/2 与 effect）',
    '',
    '重新安装：`node scripts/install-gate-world-assets.mjs`',
    '',
  ].join('\n'),
);

console.log('写出', OUT);
walkLog(OUT);
fs.rmSync(TMP, { recursive: true, force: true });
console.log('完成');
