import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';
import { formatFrontmatterDate } from './lib/format-date.mjs';
import { pickCoverFromContent } from './lib/cover.mjs';
import { preprocessMdPlugins } from './lib/md-plugins.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const journalSrcDir = path.join(root, 'content', 'journal');
const dataOutDir = path.join(root, 'public', 'data', 'journal');
const journalDir = path.join(root, 'journal');

marked.setOptions({ gfm: true, breaks: false });

function slugify(name) {
  return name.replace(/\.md$/i, '');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function absoluteUrl(value) {
  if (!value) return '';
  try {
    return new URL(String(value), 'https://www.askuary.cn').href;
  } catch {
    return '';
  }
}

function postHtmlTemplate(meta) {
  const { slug, title, summary, aiSummary, cover } = meta;
  const pageTitle = title.toUpperCase().includes('ASKUARY') ? title : `${title} · ASKUARY`;
  const description = summary || aiSummary || `${title} — ASKUARY`;
  const canonical = `https://www.askuary.cn/journal/${encodeURIComponent(slug)}/`;
  const image = absoluteUrl(cover);
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#f4f7fb" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="ASKUARY" />
    <meta property="og:title" content="${escapeHtml(pageTitle)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${canonical}" />
    ${image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : ''}
    <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <title>${escapeHtml(pageTitle)}</title>
    <link rel="canonical" href="${canonical}" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  </head>
  <body class="home-page home-anime home-article-page ask-read-page" data-post-slug="${slug}">
    <div id="homeShell"></div>
    <div id="bootError" hidden></div>
    <script type="module" src="/src/pages/journal/post.ts"></script>
  </body>
</html>
`;
}



function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanGeneratedJournalDirs() {
  const preserve = new Set(['view']);
  if (fs.existsSync(journalDir)) {
    for (const entry of fs.readdirSync(journalDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (preserve.has(entry.name)) continue;
      const target = path.join(journalDir, entry.name, 'index.html');
      if (fs.existsSync(target)) {
        fs.rmSync(path.join(journalDir, entry.name), { recursive: true, force: true });
      }
    }
  }
  if (fs.existsSync(dataOutDir)) {
    for (const file of fs.readdirSync(dataOutDir)) {
      if (file.endsWith('.json')) {
        fs.rmSync(path.join(dataOutDir, file), { force: true });
      }
    }
  }
}

function buildJournal() {
  ensureDir(journalSrcDir);
  ensureDir(dataOutDir);
  cleanGeneratedJournalDirs();

  const files = fs.readdirSync(journalSrcDir).filter((f) => f.endsWith('.md'));
  const index = [];

  for (const file of files) {
    const slug = slugify(file);
    const raw = fs.readFileSync(path.join(journalSrcDir, file), 'utf8');
    const { data, content } = matter(raw);

    const title = String(data.title || slug).trim();
    const date = formatFrontmatterDate(data.date);
    const summary = String(data.summary || '').trim();
    const aiSummary = String(data.aiSummary || '').trim();
    const aiSelfIntro = String(data.aiSelfIntro || '').trim();
    const aiOutline = String(data.aiOutline || '').trim();
    const showAiSummary = data.showAiSummary === false ? false : true;
    const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
    const prepared = preprocessMdPlugins(content, marked);
    let html = String(marked.parse(prepared));
    // 可用首图写入 cover（列表用）；正文保留图片。无图则 cover 留空，前台走随机 API
    const cover = pickCoverFromContent(content, html, data.cover);

    const meta = {
      slug,
      title,
      date,
      summary,
      ...(aiSummary ? { aiSummary } : {}),
      ...(aiSelfIntro ? { aiSelfIntro } : {}),
      ...(aiOutline ? { aiOutline } : {}),
      showAiSummary,
      tags,
      ...(cover ? { cover } : {}),
    };
    index.push(meta);

    fs.writeFileSync(
      path.join(dataOutDir, `${slug}.json`),
      JSON.stringify({ ...meta, markdown: content, html }, null, 2),
      'utf8',
    );

    const slugDir = path.join(journalDir, slug);
    ensureDir(slugDir);
    fs.writeFileSync(path.join(slugDir, 'index.html'), postHtmlTemplate(meta), 'utf8');
  }

  index.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  fs.writeFileSync(
    path.join(root, 'public', 'data', 'journal-index.json'),
    JSON.stringify(index, null, 2),
    'utf8',
  );

  console.log(`[journal] built ${index.length} post(s)`);
}

buildJournal();
