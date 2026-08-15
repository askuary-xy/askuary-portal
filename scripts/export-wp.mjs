/**
 * 从 WordPress REST API 导出文章为 Markdown
 *
 * - post        → content/journal/   （站点主页文章轨）
 * - shuoshuo    → content/journal/   （标签：碎念）
 * - fp_stellar  → content/posts/     （宇宙·博客）
 *
 * 用法: node scripts/export-wp.mjs [站点根 URL]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeSlug, htmlToMarkdown, safeFilename } from './lib/wp-html-to-md.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const liveBase = (process.argv[2] || 'https://www.askuary.cn').replace(/\/$/, '');
const apiBase = `${liveBase}/wp-json/wp/v2`;

const journalDir = path.join(root, 'content', 'journal');
const postsDir = path.join(root, 'content', 'posts');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function yamlQuote(value) {
  const s = String(value ?? '');
  if (/[:#\n"'&*]/.test(s) || s.startsWith(' ') || s.endsWith(' ')) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}

function buildFrontmatter(meta) {
  const lines = ['---'];
  lines.push(`title: ${yamlQuote(meta.title)}`);
  if (meta.date) lines.push(`date: ${meta.date.slice(0, 10)}`);
  if (meta.summary) lines.push(`summary: ${yamlQuote(meta.summary)}`);
  if (meta.aiSummary) lines.push(`aiSummary: ${yamlQuote(meta.aiSummary)}`);
  if (meta.tags?.length) {
    lines.push('tags:');
    for (const tag of meta.tags) lines.push(`  - ${yamlQuote(tag)}`);
  }
  if (meta.legacyUrl) lines.push(`legacyUrl: ${yamlQuote(meta.legacyUrl)}`);
  lines.push('---');
  return lines.join('\n');
}

async function fetchAll(endpoint, extra = '') {
  const items = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${apiBase}/${endpoint}?per_page=100&page=${page}${extra}`;
    const res = await fetch(url);
    if (!res.ok) break;
    totalPages = Number(res.headers.get('x-wp-totalpages') || 1);
    const batch = await res.json();
    if (!Array.isArray(batch) || !batch.length) break;
    items.push(...batch);
    page += 1;
  }

  return items;
}

async function fetchTagMap() {
  const tags = await fetchAll('tags');
  const map = new Map();
  for (const tag of tags) map.set(tag.id, tag.name);
  return map;
}

function extractSummary(excerptHtml) {
  const text = htmlToMarkdown(excerptHtml).replace(/\s+/g, ' ').trim();
  return text.slice(0, 160);
}

function writeMarkdown(targetDir, item, tagMap, extraTags = []) {
  const slug = safeFilename(item.slug);
  const title = item.title?.rendered ? htmlToMarkdown(item.title.rendered) : slug;
  const date = item.date || '';
  const summary = extractSummary(item.excerpt?.rendered || '');
  // 旧站 AI 摘要经 the_excerpt 过滤器注入；导出时同步写入 aiSummary
  const aiSummary = summary;
  const tagIds = item.tags || [];
  const tags = [...new Set([...extraTags, ...tagIds.map((id) => tagMap.get(id)).filter(Boolean)])];
  const body = htmlToMarkdown(item.content?.rendered || '');
  const legacyUrl = item.link || '';

  const frontmatter = buildFrontmatter({ title, date, summary, aiSummary, tags, legacyUrl });
  const filePath = path.join(targetDir, `${slug}.md`);

  fs.writeFileSync(filePath, `${frontmatter}\n\n${body}\n`, 'utf8');
  return { slug, title, filePath };
}

async function exportType(endpoint, targetDir, extraTags, label) {
  ensureDir(targetDir);
  const tagMap = await fetchTagMap();
  const items = await fetchAll(endpoint, '&status=publish');
  const written = [];

  for (const item of items) {
    written.push(writeMarkdown(targetDir, item, tagMap, extraTags));
  }

  console.log(`[export] ${label}: ${written.length} → ${path.relative(root, targetDir)}`);
  return written;
}

async function exportAbout() {
  const res = await fetch(`${apiBase}/pages?slug=${encodeURIComponent('关于')}&per_page=1`);
  const pages = await res.json();
  const page = pages[0];
  if (!page) {
    console.log('[export] about: skipped (page not found)');
    return;
  }

  const aboutPath = path.join(root, 'data', 'about.json');
  const about = JSON.parse(fs.readFileSync(aboutPath, 'utf8'));
  const body = htmlToMarkdown(page.content?.rendered || '').trim();

  about.lead = about.lead || '记录思考，探索次元';
  if (body) {
    about.sections = [
      {
        heading: '关于',
        body: body.includes('[') ? '详见下方链接与 GitHub 卡片。' : body,
      },
      ...(about.sections || []).filter((s) => s.heading !== '这个站点'),
    ];
  }

  fs.writeFileSync(aboutPath, JSON.stringify(about, null, 2) + '\n', 'utf8');
  console.log('[export] about.json updated');
}

async function main() {
  console.log(`[export] source: ${liveBase}`);

  await exportType('posts', journalDir, [], 'WP posts → journal');
  await exportType('shuoshuo', journalDir, ['碎念'], 'shuoshuo → journal');
  await exportType('fp_stellar', postsDir, ['宇宙博客'], 'fp_stellar → posts');
  await exportAbout();

  console.log('[export] done — run: npm run content:build');
}

main().catch((err) => {
  console.error('[export] failed:', err);
  process.exit(1);
});
