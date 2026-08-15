/**
 * 按内容重分类：街拍里的高原/湖山/旅途挪到正确目录，并刷新 photos.json 路径键。
 * node scripts/reclassify-photowall.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(root, 'content', 'photowall');
const jsonPath = path.join(base, 'photos.json');

/** @type {Array<{from:string,to:string,category:string,location?:string}>} */
const moves = [
  // → 香格里拉
  { from: '街拍/旷野五彩经幡塔.jpg', to: '风景/2026.7.13香格里拉/旷野五彩经幡塔.jpg', category: '风景', location: '香格里拉' },
  { from: '街拍/云雾山下白塔.jpg', to: '风景/2026.7.13香格里拉/云雾山下白塔.jpg', category: '风景', location: '香格里拉' },
  { from: '街拍/路边经幡牦牛.jpg', to: '风景/2026.7.13香格里拉/路边经幡牦牛.jpg', category: '风景', location: '香格里拉' },
  { from: '街拍/香格里拉地标.jpg', to: '风景/2026.7.13香格里拉/香格里拉地标.jpg', category: '风景', location: '香格里拉' },
  { from: '街拍/高山草甸卧牛.jpg', to: '风景/2026.7.13香格里拉/高山草甸卧牛.jpg', category: '风景', location: '香格里拉' },
  { from: '街拍/草甸群山尖峰.jpg', to: '风景/2026.7.13香格里拉/草甸群山尖峰.jpg', category: '风景', location: '香格里拉' },

  // → 普达措 / 风景
  { from: '街拍/湖光山色云舒.jpg', to: '风景/2026.7.12普达措/湖光山色云舒.jpg', category: '风景', location: '普达措' },
  { from: '街拍/山谷彩虹映翠峦.jpg', to: '风景/2026.7.12普达措/山谷彩虹映翠峦.jpg', category: '风景', location: '普达措' },
  { from: '街拍/碧潭游鱼.jpg', to: '风景/碧潭游鱼.jpg', category: '风景', location: '池塘' },
  { from: '街拍/湖畔暮色远山.jpg', to: '风景/湖畔暮色远山.jpg', category: '风景', location: '湖畔' },
  { from: '街拍/山间城廓远眺.jpg', to: '风景/山间城廓远眺.jpg', category: '风景', location: '远眺' },
  { from: '街拍/湖畔木径远山.jpg', to: '风景/湖畔木径远山.jpg', category: '风景', location: '公园' },

  // → 丽江
  { from: '街拍/草原哪吒雕塑.jpg', to: '风景/2026.7.11丽江/草原哪吒雕塑.jpg', category: '风景', location: '丽江' },

  // → 旅途（新建顶层分类）
  { from: '街拍/阴云草原列车.jpg', to: '旅途/阴云草原列车.jpg', category: '旅途', location: '旷野' },
  { from: '街拍/暮色机场停机坪.jpg', to: '旅途/暮色机场停机坪.jpg', category: '旅途', location: '机场' },
  { from: '街拍/机窗外彩虹云海.jpg', to: '旅途/机窗外彩虹云海.jpg', category: '旅途', location: '航途' },
  { from: '街拍/机窗外云海山巅.jpg', to: '旅途/机窗外云海山巅.jpg', category: '旅途', location: '航途' },
  { from: '街拍/桥下仰望云影.jpg', to: '旅途/桥下仰望云影.jpg', category: '旅途', location: '路途' },
  { from: '街拍/云绕苍翠山峦.jpg', to: '旅途/云绕苍翠山峦.jpg', category: '旅途', location: '旅途' },
  { from: '街拍/山间桥影伴彩虹.jpg', to: '旅途/山间桥影伴彩虹.jpg', category: '旅途', location: '山区' },
  { from: '街拍/石栏外山川远眺.jpg', to: '旅途/石栏外山川远眺.jpg', category: '旅途', location: '旅途' },

  // 齐云山归入行程文件夹
  { from: '风景/齐云山晨曦层峦.JPG', to: '风景/2024.10.4齐云山/齐云山晨曦层峦.JPG', category: '风景', location: '齐云山' },
  { from: '风景/齐云山云海山峦.JPG', to: '风景/2024.10.4齐云山/齐云山云海山峦.JPG', category: '风景', location: '齐云山' },

  // 街拍里更像日常的
  { from: '街拍/心形花架月季.jpg', to: '日常/心形花架月季.jpg', category: '日常', location: '花园' },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function main() {
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const next = { ...raw };
  // 清掉旧条目键，稍后按新路径写回（保留 _ 开头）
  const metaEntries = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('_')) continue;
    metaEntries[k] = v;
  }
  for (const k of Object.keys(metaEntries)) delete next[k];

  let moved = 0;
  const pathMap = new Map(); // old rel -> new rel

  for (const m of moves) {
    const from = path.join(base, m.from);
    const to = path.join(base, m.to);
    pathMap.set(m.from.replace(/\\/g, '/'), m.to.replace(/\\/g, '/'));
    if (fs.existsSync(to) && !fs.existsSync(from)) {
      // already moved
      continue;
    }
    if (!fs.existsSync(from)) {
      console.warn('[skip missing]', m.from);
      continue;
    }
    ensureDir(path.dirname(to));
    if (fs.existsSync(to)) {
      console.warn('[skip exists]', m.to);
      continue;
    }
    fs.renameSync(from, to);
    moved += 1;
  }

  // 重写 meta：旧键映射到新键，并补 category
  for (const [oldKey, value] of Object.entries(metaEntries)) {
    const mapped = pathMap.get(oldKey) || oldKey;
    const move = moves.find((x) => x.to.replace(/\\/g, '/') === mapped);
    const entry = { ...(value && typeof value === 'object' ? value : {}) };
    if (move) {
      entry.category = move.category;
      if (move.location) entry.location = move.location;
      if (entry.story && typeof entry.story === 'object') {
        entry.story = {
          ...entry.story,
          locationLabel: move.location || entry.story.locationLabel || '',
        };
      }
    }
    // 未搬迁的：按目录推断 category
    if (!entry.category) {
      if (mapped.startsWith('日常/')) entry.category = '日常';
      else if (mapped.startsWith('街拍/')) entry.category = '街拍';
      else if (mapped.startsWith('旅途/')) entry.category = '旅途';
      else if (mapped.startsWith('风景/')) entry.category = '风景';
    }
    next[mapped] = entry;
  }

  // 补相册描述
  next._albums = {
    ...(next._albums || {}),
    旅途: {
      title: '旅途',
      description: '机场、车窗、机翼外的云与路过',
      theme: 'urban',
      story: {
        intro: '出发和抵达之间，总有一些不必下车的风景：云海、铁轨、桥下的天光。',
        device: 'Nikon / 手机',
        locationLabel: '旅途',
        weather: '多云时晴',
      },
    },
    '2024.10.4齐云山': {
      title: '齐云山',
      description: '秋风里的层峦与云海',
      theme: 'ocean',
      story: {
        intro: '走到齐云山时，风里已经带着一点秋意。山脊线很干净，远处云层一层层铺开。',
        device: 'Nikon',
        locationLabel: '齐云山',
        weather: '晴，微风',
        music: {
          neteaseId: '29764542',
          title: '打上花火',
          artist: 'DAOKO / 米津玄師',
        },
      },
    },
  };

  fs.writeFileSync(jsonPath, JSON.stringify(next, null, 2), 'utf8');
  console.log(`[reclassify] moved ${moved} file(s), photos.json updated`);
}

main();
