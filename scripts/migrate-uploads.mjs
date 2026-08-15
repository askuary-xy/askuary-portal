/**
 * 将文章中的 WordPress / 旧站图片链接改为 /uploads/，
 * 并从备份目录复制到 content/uploads（与摄影墙 content/photowall 分离）。
 *
 * 用法：
 *   node scripts/migrate-uploads.mjs
 *   node scripts/migrate-uploads.mjs "D:\backup\wp-content\uploads"
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = path.join(root, 'content');
const contentUploads = path.join(root, 'content', 'uploads');

const URL_PATTERNS = [
  /https?:\/\/(?:www\.)?askuary\.cn\/wp-content\/uploads\//gi,
  /https?:\/\/118\.89\.196\.45\/wp-content\/uploads\//gi,
  /\/wp-content\/uploads\//gi,
];

function walkMdFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'photowall' || entry.name === 'uploads') continue;
      walkMdFiles(full, out);
    } else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function rewriteMarkdown(file) {
  let text = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const pattern of URL_PATTERNS) {
    const next = text.replace(pattern, '/uploads/');
    if (next !== text) {
      text = next;
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(file, text, 'utf8');
  return changed;
}

function collectUploadPathsFromContent() {
  const paths = new Set();
  const re = /\/uploads\/[^\s)"']+/g;
  for (const file of walkMdFiles(contentDir)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(re)) {
      paths.add(match[0].replace(/^\/uploads\//, '').replace(/[),.;]+$/, ''));
    }
  }
  return [...paths];
}

function copyUploadsFromSource(sourceRoot) {
  if (!sourceRoot || !fs.existsSync(sourceRoot)) {
    console.warn('[uploads] 未提供有效备份目录，仅改写 Markdown 链接');
    return { copied: 0, missing: [] };
  }

  const needed = collectUploadPathsFromContent();
  let copied = 0;
  const missing = [];

  for (const rel of needed) {
    const from = path.join(sourceRoot, rel);
    const to = path.join(contentUploads, rel);
    if (!fs.existsSync(from)) {
      missing.push(rel);
      continue;
    }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    copied += 1;
  }

  return { copied, missing };
}

function main() {
  const source = process.argv[2] ? path.resolve(process.argv[2]) : null;
  fs.mkdirSync(contentUploads, { recursive: true });

  const mdFiles = walkMdFiles(contentDir);
  let rewritten = 0;

  for (const file of mdFiles) {
    if (rewriteMarkdown(file)) rewritten += 1;
  }

  const { copied, missing } = copyUploadsFromSource(source);

  console.log(`[uploads] 改写 Markdown: ${rewritten} 个文件`);
  console.log(`[uploads] 复制到 content/uploads: ${copied} 个`);
  if (missing.length) {
    console.warn(`[uploads] 缺失 ${missing.length} 个文件（需从服务器备份补全）:`);
    for (const rel of missing.slice(0, 12)) console.warn(`  - ${rel}`);
    if (missing.length > 12) console.warn(`  ... 另有 ${missing.length - 12} 个`);
  }
  console.log('[uploads] 完成后请运行: npm run content:build && npm run build');
  console.log('[uploads] 文章图目录: content/uploads → public/uploads（与 photowall 分开上传）');
}

main();
