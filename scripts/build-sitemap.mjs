import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const siteUrl = 'https://www.askuary.cn';

const staticRoutes = [
  '/',
  '/home/',
  '/blog/',
  '/blog/archive/',
  '/archive/',
  '/articles/',
  '/photos/',
  '/library/',
  '/games/',
  '/shuoshuo/',
  '/about/',
  '/friends/',
];

function readJson(file, fallback = []) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function entry(route, lastmod) {
  const loc = new URL(route, siteUrl).href;
  return [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    ...(lastmod ? [`    <lastmod>${escapeXml(lastmod.slice(0, 10))}</lastmod>`] : []),
    '  </url>',
  ].join('\n');
}

const posts = readJson(path.join(publicDir, 'data', 'posts-index.json'));
const journal = readJson(path.join(publicDir, 'data', 'journal-index.json'));
const urls = [
  ...staticRoutes.map((route) => entry(route)),
  ...posts.map((post) => entry(`/blog/${encodeURIComponent(post.slug)}/`, post.date)),
  ...journal.map((post) => entry(`/journal/${encodeURIComponent(post.slug)}/`, post.date)),
];

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls,
  '</urlset>',
  '',
].join('\n');

fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), xml, 'utf8');
console.log(`[sitemap] built ${urls.length} URL(s)`);
