/**
 * 从旧站馆藏 CSV 导入 → data/library.json
 *
 * CSV 列（与 Sakurairo-child 批量导入一致）:
 * title,type,author,status,progress_current,progress_total,progress,
 * rating,year,platform,link,genre,summary,thoughts,quotes,takeaways,fetch_cover
 *
 * 用法:
 *   node scripts/import-library-csv.mjs path/to/library.csv
 *   node scripts/import-library-csv.mjs path/to/library.csv --merge
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(root, 'data', 'library.json');

const VALID_TYPES = new Set(['book', 'novel', 'manga', 'anime', 'variety']);
const VALID_STATUS = new Set(['reading', 'finished', 'planned', 'dropped']);

function slugify(title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

/** 简易 CSV 解析（支持引号字段） */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      if (ch === '\r') i++;
      continue;
    }
    if (ch === '\r') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim()));
}

function rowToItem(headers, values) {
  const map = {};
  headers.forEach((h, i) => {
    map[String(h).trim().toLowerCase()] = (values[i] ?? '').trim();
  });

  const title = map.title || '';
  if (!title) return null;

  let type = (map.type || 'book').toLowerCase();
  if (!VALID_TYPES.has(type)) type = 'book';
  let status = (map.status || 'reading').toLowerCase();
  if (!VALID_STATUS.has(status)) status = 'reading';

  return {
    id: slugify(title),
    title,
    author: map.author || '未知',
    type,
    status,
    cover: map.cover || '',
    progress: map.progress || '',
    progressCurrent: Number(map.progress_current) || 0,
    progressTotal: Number(map.progress_total) || 0,
    rating: Number(map.rating) || 0,
    year: map.year || '',
    platform: map.platform || '',
    link: map.link || '',
    genre: (map.genre || '').replace(/\|/g, ' · '),
    summary: map.summary || '',
    thoughts: map.thoughts || '',
    quotes: (map.quotes || '')
      .split(/[|;]/)
      .map((s) => s.trim())
      .filter(Boolean),
    takeaways: (map.takeaways || '')
      .split(/[|;]/)
      .map((s) => s.trim())
      .filter(Boolean),
    updated: new Date().toISOString().slice(0, 10),
  };
}

function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--merge');
  const merge = process.argv.includes('--merge');
  const csvPath = args[0];

  if (!csvPath) {
    console.error('用法: node scripts/import-library-csv.mjs <csv> [--merge]');
    process.exit(1);
  }

  const abs = path.resolve(csvPath);
  if (!fs.existsSync(abs)) {
    console.error(`[import] 文件不存在: ${abs}`);
    process.exit(1);
  }

  const text = fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, '');
  const rows = parseCsv(text);
  if (rows.length < 2) {
    console.error('[import] CSV 为空或缺少表头');
    process.exit(1);
  }

  const headers = rows[0];
  const imported = [];
  for (let i = 1; i < rows.length; i++) {
    const item = rowToItem(headers, rows[i]);
    if (item) imported.push(item);
  }

  let existing = [];
  if (merge && fs.existsSync(outPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      existing = Array.isArray(raw) ? raw : raw.items || [];
    } catch {
      existing = [];
    }
  }

  const byKey = new Map();
  for (const it of existing) {
    const key = (it.link || it.id || it.title || '').toLowerCase();
    if (key) byKey.set(key, it);
  }
  for (const it of imported) {
    const key = (it.link || it.id || it.title || '').toLowerCase();
    byKey.set(key, { ...(byKey.get(key) || {}), ...it });
  }

  const items = [...byKey.values()];
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ items }, null, 2) + '\n', 'utf8');
  console.log(`[import] ${imported.length} from CSV → ${items.length} total in data/library.json`);
  console.log('[import] 下一步: node scripts/build-library.mjs');
}

main();
