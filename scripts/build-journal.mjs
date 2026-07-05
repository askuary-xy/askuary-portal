import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const journalSrcDir = path.join(root, 'content', 'journal');
const dataOutDir = path.join(root, 'public', 'data', 'journal');
const journalDir = path.join(root, 'journal');

marked.setOptions({ gfm: true, breaks: false });

function slugify(name) {
  return name.replace(/\.md$/i, '');
}

function postHtmlTemplate(slug) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0c1018" />
    <title>文章 · ASKUARY</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body class="home-page home-article-page" data-post-slug="${slug}">
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
  if (!fs.existsSync(journalDir)) return;
  for (const entry of fs.readdirSync(journalDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const target = path.join(journalDir, entry.name, 'index.html');
    if (fs.existsSync(target)) {
      fs.rmSync(path.join(journalDir, entry.name), { recursive: true, force: true });
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
    const date = String(data.date || '').trim();
    const summary = String(data.summary || '').trim();
    const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
    const html = marked.parse(content);

    const meta = { slug, title, date, summary, tags };
    index.push(meta);

    fs.writeFileSync(
      path.join(dataOutDir, `${slug}.json`),
      JSON.stringify({ ...meta, html }, null, 2),
      'utf8',
    );

    const slugDir = path.join(journalDir, slug);
    ensureDir(slugDir);
    fs.writeFileSync(path.join(slugDir, 'index.html'), postHtmlTemplate(slug), 'utf8');
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
