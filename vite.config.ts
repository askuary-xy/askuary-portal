import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

function getSlugInputs(baseDir: string, prefix: string): Record<string, string> {
  const inputs: Record<string, string> = {};
  if (!fs.existsSync(baseDir)) return inputs;
  const skip = new Set(['archive', 'view']);

  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (skip.has(entry.name)) continue;
    const htmlPath = path.join(baseDir, entry.name, 'index.html');
    if (fs.existsSync(htmlPath)) {
      inputs[`${prefix}-${entry.name}`] = htmlPath;
    }
  }

  return inputs;
}

export default defineConfig({
  base: '/',
  plugins: [tailwindcss()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: {
        main: path.resolve(root, 'index.html'),
        home: path.resolve(root, 'home/index.html'),
        homeDaily: path.resolve(root, 'home/daily/index.html'),
        about: path.resolve(root, 'about/index.html'),
        friends: path.resolve(root, 'friends/index.html'),
        blog: path.resolve(root, 'blog/index.html'),
        'blog-archive': path.resolve(root, 'blog/archive/index.html'),
        archive: path.resolve(root, 'archive/index.html'),
        photos: path.resolve(root, 'photos/index.html'),
        photosAlbum: path.resolve(root, 'photos/album/index.html'),
        library: path.resolve(root, 'library/index.html'),
        games: path.resolve(root, 'games/index.html'),
        shuoshuo: path.resolve(root, 'shuoshuo/index.html'),
        articles: path.resolve(root, 'articles/index.html'),
        journalView: path.resolve(root, 'journal/view/index.html'),
        blogView: path.resolve(root, 'blog/view/index.html'),
        admin: path.resolve(root, 'admin/index.html'),
        ...getSlugInputs(path.join(root, 'blog'), 'blog'),
        ...getSlugInputs(path.join(root, 'journal'), 'journal'),
      },
    },
  },
});
