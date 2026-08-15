import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'public', 'data');
const publicDir = path.join(root, 'public');

function readJson(file, fallback = null) {
  const target = path.join(dataDir, file);
  if (!fs.existsSync(target)) return fallback;
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toRfc822(dateStr) {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return new Date().toUTCString();
  return parsed.toUTCString();
}

function buildRss() {
  const sitePath = path.join(root, 'data', 'site.json');
  const siteFromData = fs.existsSync(sitePath)
    ? JSON.parse(fs.readFileSync(sitePath, 'utf8'))
    : readJson('site.json', {});

  const siteName = siteFromData.name || 'ASKUARY';
  const siteIntro = siteFromData.intro || '记录思考，探索次元';
  const siteUrl = (siteFromData.siteUrl || 'https://askuary-xy.github.io/askuary-portal/').replace(
    /\/?$/,
    '/',
  );

  const posts = readJson('posts-index.json', []).map((item) => ({
    ...item,
    path: `/blog/${item.slug}/`,
    source: 'blog',
  }));

  const journal = readJson('journal-index.json', []).map((item) => ({
    ...item,
    path: `/journal/${item.slug}/`,
    source: 'journal',
  }));

  const items = [...posts, ...journal]
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, 30);

  const channelItems = items
    .map((item) => {
      const link = `${siteUrl}${item.path.replace(/^\//, '')}`;
      const description = escapeXml(item.summary || item.title || '');
      const title = escapeXml(item.title || item.slug);
      const pubDate = toRfc822(item.date);
      const guid = link;
      const category =
        item.tags?.map((tag) => `<category>${escapeXml(tag)}</category>`).join('') || '';

      return (
        `<item>` +
        `<title>${title}</title>` +
        `<link>${escapeXml(link)}</link>` +
        `<guid isPermaLink="true">${escapeXml(guid)}</guid>` +
        `<pubDate>${pubDate}</pubDate>` +
        `<description>${description}</description>` +
        category +
        `</item>`
      );
    })
    .join('\n    ');

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `  <channel>\n` +
    `    <title>${escapeXml(siteName)}</title>\n` +
    `    <link>${escapeXml(siteUrl)}</link>\n` +
    `    <description>${escapeXml(siteIntro)}</description>\n` +
    `    <language>zh-CN</language>\n` +
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n` +
    `    <atom:link href="${escapeXml(`${siteUrl}rss.xml`)}" rel="self" type="application/rss+xml" />\n` +
    `    ${channelItems}\n` +
    `  </channel>\n` +
    `</rss>\n`;

  fs.writeFileSync(path.join(publicDir, 'rss.xml'), xml, 'utf8');
  console.log(`[rss] built feed with ${items.length} item(s)`);
}

buildRss();
