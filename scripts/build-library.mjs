/**
 * 规范化馆藏数据 → public/data/library.json
 * 源：data/library.json（可由 import-library-csv.mjs 生成）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = path.join(root, 'data', 'library.json');
const pagePath = path.join(root, 'data', 'library-page.json');
const outDir = path.join(root, 'public', 'data');

const KINDS = {
  book: { label: '图书', emoji: '📚' },
  novel: { label: '小说', emoji: '📖' },
  manga: { label: '漫画', emoji: '📕' },
  game: { label: '游戏', emoji: '🎮' },
  anime: { label: '动漫', emoji: '🎬' },
  movie: { label: '电影', emoji: '🎞' },
  drama: { label: '电视剧', emoji: '📺' },
  variety: { label: '综艺', emoji: '🎙' },
};

const SHAPES = new Set([
  'book',
  'book-slim',
  'book-tankobon',
  'cartridge',
  'vhs',
  'disc-case',
  'disc-case-thick',
  'remote',
]);

const STATUSES = {
  reading: { label: '进行中' },
  finished: { label: '已完成' },
  planned: { label: '想看' },
  dropped: { label: '弃坑' },
};

function slugify(title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || `item-${Date.now()}`;
}

function parseProgress(item) {
  let current = Number(item.progressCurrent) || 0;
  let total = Number(item.progressTotal) || 0;
  const text = String(item.progress || '');

  if (current <= 0 || total <= 0) {
    const slash = text.match(/(\d+)\s*[/／]\s*(\d+)/u);
    if (slash) {
      current = Number(slash[1]);
      total = Number(slash[2]);
    } else {
      const ep = text.match(/(?:第)?(\d+)(?:集|话|卷|章)/u);
      if (ep) current = Number(ep[1]);
    }
  }

  if (total > 0 && current > total) current = total;
  const percent = total > 0 && current > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  let label = text;
  if (total > 0 && current > 0) label = `${current} / ${total}`;

  return { current, total, percent, label };
}

function ratingStars(rating) {
  const score = Number(rating) || 0;
  if (score <= 0) return { score: 0, stars: 0, max: 5, label: '' };
  const stars = Math.min(5, Math.max(0, Math.round((score / 2) * 2) / 2));
  return { score, stars, max: 5, label: `${score} / 10` };
}

function buildLinks(item) {
  const links = Array.isArray(item.links) ? [...item.links] : [];
  const type = item.type || 'book';
  const title = item.title || '';
  const has = (label) => links.some((l) => l.label === label);

  if (item.link && !links.some((l) => l.url === item.link)) {
    if (/douban\.com/i.test(item.link)) links.unshift({ label: '豆瓣', url: item.link });
    else if (/bgm\.tv|bangumi/i.test(item.link)) links.unshift({ label: 'Bangumi', url: item.link });
    else links.unshift({ label: '详情页', url: item.link });
  }

  if (['anime', 'manga', 'variety', 'drama'].includes(type) && !has('B站搜索')) {
    links.push({
      label: 'B站搜索',
      url: `https://search.bilibili.com/all?keyword=${encodeURIComponent(title)}`,
    });
  }
  if (['book', 'novel', 'manga'].includes(type) && !item.link && !has('豆瓣搜索')) {
    links.push({
      label: '豆瓣搜索',
      url: `https://search.douban.com/book/subject_search?search_text=${encodeURIComponent(title)}`,
    });
  }
  if (['movie', 'drama', 'variety'].includes(type) && !item.link && !has('豆瓣搜索')) {
    links.push({
      label: '豆瓣搜索',
      url: `https://search.douban.com/movie/subject_search?search_text=${encodeURIComponent(title)}`,
    });
  }
  if (type === 'game' && !item.link && !has('Steam搜索')) {
    links.push({
      label: 'Steam搜索',
      url: `https://store.steampowered.com/search/?term=${encodeURIComponent(title)}`,
    });
  }

  return links.filter((l) => l?.url);
}

function normalizeItem(raw, index) {
  const type = KINDS[raw.type] ? raw.type : 'book';
  const status = STATUSES[raw.status] ? raw.status : 'reading';
  const progress = parseProgress(raw);
  const rating = Number(raw.rating) || 0;
  const genre = String(raw.genre || '')
    .replace(/\|/g, ' · ')
    .replace(/\s*·\s*/g, ' · ')
    .trim();

  const shape = SHAPES.has(raw.shape) ? raw.shape : undefined;

  return {
    id: String(raw.id || slugify(raw.title) || `item-${index + 1}`),
    title: String(raw.title || '').trim(),
    author: String(raw.author || '未知').trim() || '未知',
    type,
    typeLabel: KINDS[type].label,
    ...(shape ? { shape } : {}),
    cover: String(raw.cover || '').trim(),
    status,
    statusLabel: STATUSES[status].label,
    progress: progress.label,
    progressCurrent: progress.current,
    progressTotal: progress.total,
    progressPercent: progress.percent,
    rating,
    ratingStars: ratingStars(rating),
    year: String(raw.year || '').trim(),
    platform: String(raw.platform || '').trim(),
    link: String(raw.link || '').trim(),
    links: buildLinks({ ...raw, type, title: raw.title }),
    genre,
    summary: String(raw.summary || '').trim(),
    thoughts: String(raw.thoughts || '').trim(),
    quotes: Array.isArray(raw.quotes)
      ? raw.quotes.map((q) => String(q || '').trim()).filter(Boolean)
      : String(raw.quotes || '')
          .split(/\n+/)
          .map((q) => q.trim())
          .filter(Boolean),
    takeaways: Array.isArray(raw.takeaways)
      ? raw.takeaways.map((q) => String(q || '').trim()).filter(Boolean)
      : String(raw.takeaways || '')
          .split(/\n+/)
          .map((q) => q.trim())
          .filter(Boolean),
    updated: String(raw.updated || '').trim(),
  };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  if (fs.existsSync(pagePath)) {
    fs.copyFileSync(pagePath, path.join(outDir, 'library-page.json'));
  }

  if (!fs.existsSync(srcPath)) {
    const empty = { items: [], kinds: KINDS, statuses: STATUSES };
    fs.writeFileSync(path.join(outDir, 'library.json'), JSON.stringify(empty, null, 2) + '\n');
    console.log('[library] no data/library.json — wrote empty index');
    return;
  }

  const raw = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.items || [];
  const items = list
    .filter((it) => it && String(it.title || '').trim())
    .map((it, i) => normalizeItem(it, i));

  const out = {
    items,
    kinds: KINDS,
    statuses: STATUSES,
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(outDir, 'library.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`[library] ${items.length} items → public/data/library.json`);
}

main();
