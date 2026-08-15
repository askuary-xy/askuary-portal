import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';

const MAX_BYTES = 2 * 1024 * 1024;

type ImageKind = 'jpeg' | 'png' | 'webp' | 'gif';

function detectImage(buf: Buffer): ImageKind | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'png';
  }
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return 'gif';
  }
  // RIFF....WEBP
  if (
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

const EXT: Record<ImageKind, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
};

export function arcadeUploadRoot(): string {
  return join(process.cwd(), 'data', 'arcade-uploads');
}

/** 校验魔数并写入 data/arcade-uploads，返回公开 URL 路径 */
export async function saveArcadeImage(file: {
  buffer: Buffer;
  size?: number;
  mimetype?: string;
}): Promise<{ imageUrl: string; filename: string }> {
  const buf = file.buffer;
  if (!buf?.length) throw new BadRequestException('缺少图片文件');
  if (buf.length > MAX_BYTES) {
    throw new BadRequestException('图片过大（上限 2MB）');
  }
  const kind = detectImage(buf);
  if (!kind) {
    throw new BadRequestException('仅支持 JPEG / PNG / WebP / GIF');
  }
  // MIME 仅作辅助，以魔数为准
  const mime = String(file.mimetype || '').toLowerCase();
  if (
    mime &&
    !mime.startsWith('image/') &&
    mime !== 'application/octet-stream'
  ) {
    throw new BadRequestException('文件类型无效');
  }

  const filename = `${Date.now().toString(36)}_${randomBytes(8).toString('hex')}.${EXT[kind]}`;
  const dir = arcadeUploadRoot();
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), buf, { flag: 'wx' });
  return {
    filename,
    imageUrl: `/api/arcade/media/${filename}`,
  };
}

export function hashClientKey(clientKey: string, salt: string): string {
  const key = String(clientKey || '')
    .trim()
    .slice(0, 128);
  if (key.length < 16) {
    throw new BadRequestException('clientKey 无效');
  }
  return createHash('sha256')
    .update(`${key}|${salt || 'askuary-arcade'}`)
    .digest('hex')
    .slice(0, 48);
}

export function hashRequestFingerprint(
  ip: string,
  ua: string,
  salt: string,
): string {
  return createHash('sha256')
    .update(`${ip}|${ua}|${salt || 'askuary-arcade'}`)
    .digest('hex')
    .slice(0, 48);
}

/** 仅按 IP 哈希（跨设备共享访客昵称） */
export function hashIp(ip: string, salt: string): string {
  const raw = String(ip || 'unknown').trim() || 'unknown';
  return createHash('sha256')
    .update(`ip|${raw}|${salt || 'askuary-arcade'}`)
    .digest('hex')
    .slice(0, 48);
}

/** 仅允许安全文件名 */
export function safeMediaName(name: string): string | null {
  const n = String(name || '').trim();
  if (!/^[a-zA-Z0-9._-]{8,80}$/.test(n)) return null;
  if (n.includes('..')) return null;
  return n;
}
