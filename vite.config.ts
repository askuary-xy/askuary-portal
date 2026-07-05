import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

function getSlugInputs(baseDir: string, prefix: string): Record<string, string> {
  const inputs: Record<string, string> = {};
  if (!fs.existsSync(baseDir)) return inputs;

  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const htmlPath = path.join(baseDir, entry.name, 'index.html');
    if (fs.existsSync(htmlPath)) {
      inputs[`${prefix}-${entry.name}`] = htmlPath;
    }
  }

  return inputs;
}

export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(root, 'index.html'),
        home: path.resolve(root, 'home/index.html'),
        about: path.resolve(root, 'about/index.html'),
        friends: path.resolve(root, 'friends/index.html'),
        blog: path.resolve(root, 'blog/index.html'),
        ...getSlugInputs(path.join(root, 'blog'), 'blog'),
        ...getSlugInputs(path.join(root, 'journal'), 'journal'),
      },
    },
  },
});
