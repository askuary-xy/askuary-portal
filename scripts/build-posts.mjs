import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsSrcDir = path.join(root, 'content', 'posts');
const dataOutDir = path.join(root, 'public', 'data', 'posts');
const blogDir = path.join(root, 'blog');

marked.setOptions({ gfm: true, breaks: false });

function slugify(name) {
  return name.replace(/\.md$/i, '');
}

function postHtmlTemplate(slug) {
  return `<!doctype html>
<html lang="zh-CN" class="footprint-subpage-html">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#05060a" />
    <title>文章 · ASKUARY</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body class="fp-about-page fp-blog-page" data-post-slug="${slug}">
    <div class="fp-atmosphere" aria-hidden="true"></div>
    <canvas id="fpStars" class="fp-stars-canvas" aria-hidden="true"></canvas>

    <main class="fp-about fp-blog fp-blog-post" aria-labelledby="postTitle">
      <a class="fp-about-back" href="../../blog/">← 返回博客</a>
      <article class="fp-blog-article">
        <header class="fp-blog-post-header">
          <time class="fp-blog-date" id="postDate"></time>
          <h1 class="fp-blog-post-title" id="postTitle"></h1>
          <ul class="fp-blog-tags" id="postTags" hidden></ul>
        </header>
        <div class="fp-blog-prose" id="postContent"></div>
      </article>
      <nav class="fp-about-links" id="postLinks" aria-label="相关链接"></nav>
    </main>

    <div id="bootError" hidden></div>
    <script type="module" src="/src/pages/blog/post.ts"></script>
  </body>
</html>
`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanGeneratedBlogDirs() {
  if (!fs.existsSync(blogDir)) return;
  for (const entry of fs.readdirSync(blogDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const target = path.join(blogDir, entry.name, 'index.html');
    if (fs.existsSync(target)) {
      fs.rmSync(path.join(blogDir, entry.name), { recursive: true, force: true });
    }
  }
}

function buildPosts() {
  ensureDir(postsSrcDir);
  ensureDir(dataOutDir);
  cleanGeneratedBlogDirs();

  const files = fs.readdirSync(postsSrcDir).filter((f) => f.endsWith('.md'));
  const index = [];

  for (const file of files) {
    const slug = slugify(file);
    const raw = fs.readFileSync(path.join(postsSrcDir, file), 'utf8');
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

    const slugDir = path.join(blogDir, slug);
    ensureDir(slugDir);
    fs.writeFileSync(path.join(slugDir, 'index.html'), postHtmlTemplate(slug), 'utf8');
  }

  index.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  fs.writeFileSync(
    path.join(root, 'public', 'data', 'posts-index.json'),
    JSON.stringify(index, null, 2),
    'utf8',
  );

  console.log(`[posts] built ${index.length} post(s)`);
}

buildPosts();
