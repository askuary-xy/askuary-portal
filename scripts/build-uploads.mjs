/**
 * 同步文章配图：content/uploads → public/uploads
 * 与摄影墙 content/photowall 分离，部署时可单独覆盖。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'content', 'uploads');
const outDir = path.join(root, 'public', 'uploads');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyTree(from, to) {
  if (!fs.existsSync(from)) return { files: 0 };
  ensureDir(to);
  let files = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'README.md') continue;
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      files += copyTree(src, dest).files;
      continue;
    }
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    files += 1;
  }
  return { files };
}

function main() {
  ensureDir(sourceDir);
  if (!fs.existsSync(outDir)) ensureDir(outDir);

  // 全量同步：先清空目标中由本脚本维护的树，再复制
  // 保留 outDir 本身，避免误删其它挂载
  if (fs.existsSync(outDir)) {
    for (const entry of fs.readdirSync(outDir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      fs.rmSync(path.join(outDir, entry.name), { recursive: true, force: true });
    }
  }

  const { files } = copyTree(sourceDir, outDir);
  console.log(`[uploads] synced ${files} file(s) → public/uploads`);
}

main();
