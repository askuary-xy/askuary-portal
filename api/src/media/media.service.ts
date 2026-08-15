import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = {
  jpeg: { ext: 'jpg', mime: 'image/jpeg' },
  png: { ext: 'png', mime: 'image/png' },
  webp: { ext: 'webp', mime: 'image/webp' },
  gif: { ext: 'gif', mime: 'image/gif' },
} as const;
type Kind = keyof typeof TYPES;

function detect(buf: Buffer): Kind | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.toString('ascii', 0, 4) === 'GIF8') return 'gif';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

function safeName(value: string): string | null {
  const name = basename(String(value || ''));
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{7,100}$/.test(name) && !name.includes('..') ? name : null;
}

@Injectable()
export class MediaService {
  readonly root = join(process.cwd(), 'data', 'media-uploads');
  readonly trash = join(process.cwd(), 'data', 'media-trash');

  async list() {
    await mkdir(this.root, { recursive: true });
    const names = await readdir(this.root);
    const items = await Promise.all(names.filter((name) => safeName(name)).map(async (name) => {
      const info = await stat(join(this.root, name));
      return {
        name, url: `/api/media/file/${name}`, size: info.size,
        createdAt: info.birthtime.toISOString(), updatedAt: info.mtime.toISOString(),
      };
    }));
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async save(file?: Express.Multer.File) {
    const buf = file?.buffer;
    if (!buf?.length) throw new BadRequestException('请选择图片');
    if (buf.length > MAX_BYTES) throw new BadRequestException('图片不能超过 8MB');
    const kind = detect(buf);
    if (!kind) throw new BadRequestException('仅支持 JPEG、PNG、WebP 或 GIF');
    const original = String(file?.originalname || 'image').replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 34) || 'image';
    const name = `${Date.now().toString(36)}-${original}-${randomBytes(5).toString('hex')}.${TYPES[kind].ext}`;
    await mkdir(this.root, { recursive: true });
    await writeFile(join(this.root, name), buf, { flag: 'wx' });
    return { name, url: `/api/media/file/${name}`, size: buf.length };
  }

  resolve(name: string) {
    const safe = safeName(name);
    if (!safe) throw new NotFoundException('not found');
    const path = join(this.root, safe);
    if (!existsSync(path)) throw new NotFoundException('not found');
    const ext = safe.split('.').pop()?.toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
    return { path, mime, stream: createReadStream(path) };
  }

  async remove(name: string) {
    const safe = safeName(name);
    if (!safe || !existsSync(join(this.root, safe))) throw new NotFoundException('not found');
    await mkdir(this.trash, { recursive: true });
    await rename(join(this.root, safe), join(this.trash, `${Date.now()}-${safe}`));
    return { ok: true, recoverable: true };
  }
}
