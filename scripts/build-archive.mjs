import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'public', 'data');

function readJson(file) {
  const target = path.join(dataDir, file);
  if (!fs.existsSync(target)) return [];
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function collectTags(entries) {
  const tagSet = new Set();
  for (const entry of entries) {
    for (const tag of entry.tags || []) {
      tagSet.add(String(tag));
    }
  }
  return [...tagSet].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function writeArchive(fileName, entries, label) {
  const tags = collectTags(entries);
  fs.writeFileSync(
    path.join(dataDir, fileName),
    JSON.stringify({ entries, tags }, null, 2),
    'utf8',
  );
  console.log(`[${label}] built ${entries.length} entry(ies), ${tags.length} tag(s)`);
}

function buildArchive() {
  const posts = readJson('posts-index.json').map((item) => ({
    ...item,
    source: 'blog',
    path: `/blog/${item.slug}/`,
  }));

  const journal = readJson('journal-index.json').map((item) => ({
    ...item,
    source: 'journal',
    path: `/journal/${item.slug}/`,
  }));

  const allEntries = [...posts, ...journal].sort((a, b) =>
    String(b.date || '').localeCompare(String(a.date || '')),
  );

  const blogEntries = [...posts].sort((a, b) =>
    String(b.date || '').localeCompare(String(a.date || '')),
  );

  writeArchive('archive-index.json', allEntries, 'archive');
  writeArchive('blog-archive-index.json', blogEntries, 'blog-archive');
}

buildArchive();
