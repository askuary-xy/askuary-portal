import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';

export const COVER_KINDS = ['journal', 'shuoshuo', 'blog'] as const;
export type CoverKind = (typeof COVER_KINDS)[number];

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif']);

const KIND_LABEL: Record<CoverKind, string> = {
  journal: '手帐',
  shuoshuo: '碎念',
  blog: '博客',
};

const KIND_COLORS: Record<CoverKind, [string, string]> = {
  journal: ['#1a3a5c', '#6eb6ff'],
  shuoshuo: ['#3a1f2e', '#e08a9b'],
  blog: ['#1a2a3a', '#7dd3c0'],
};

@Injectable()
export class CoversService implements OnModuleInit {
  private readonly logger = new Logger(CoversService.name);
  private ensured = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const root = this.ensureLibraries();
    this.logger.log(
      `封面图库: ${root} → ` +
        COVER_KINDS.map((k) => `${k}:${this.listFiles(k).length}`).join(', '),
    );
  }

  private rootDir(): string {
    const configured = this.config.get<string>('COVERS_DIR')?.trim();
    if (configured) {
      try {
        mkdirSync(configured, { recursive: true });
      } catch {
        /* ignore */
      }
      if (existsSync(configured)) return configured;
    }

    const candidates = [
      join(__dirname, '..', '..', 'covers'), // /app/dist → /app/covers
      join(__dirname, '..', '..', '..', 'covers'),
      join(process.cwd(), 'covers'),
      join(process.cwd(), 'api', 'covers'),
    ];
    for (const dir of candidates) {
      if (existsSync(dir)) return dir;
    }
    const fallback = candidates[0];
    try {
      mkdirSync(fallback, { recursive: true });
    } catch {
      /* ignore */
    }
    return fallback;
  }

  /** 确保三库目录存在；若完全空则写入默认 SVG，避免线上 404 空白封面 */
  ensureLibraries(): string {
    if (this.ensured) return this.rootDir();
    const root = this.rootDir();
    for (const kind of COVER_KINDS) {
      const dir = join(root, kind);
      try {
        mkdirSync(dir, { recursive: true });
      } catch {
        /* ignore */
      }
      if (!this.listFilesIn(dir).length) {
        this.writeDefaultSvgs(kind, dir);
      }
    }
    this.ensured = true;
    return root;
  }

  private listFilesIn(dir: string): string[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((name) => {
        if (name.startsWith('.')) return false;
        if (name.toLowerCase() === 'readme.md') return false;
        return IMAGE_EXT.has(extname(name).toLowerCase());
      })
      .sort();
  }

  private writeDefaultSvgs(kind: CoverKind, dir: string): void {
    const [c1, c2] = KIND_COLORS[kind];
    const label = KIND_LABEL[kind];
    for (let i = 1; i <= 3; i++) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="g${i}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="960" height="540" fill="url(#g${i})"/>
  <circle cx="${700 + i * 30}" cy="${100 + i * 20}" r="${70 + i * 10}" fill="rgba(255,255,255,0.08)"/>
  <circle cx="${100 + i * 20}" cy="${400 - i * 15}" r="${120 + i * 8}" fill="rgba(255,255,255,0.06)"/>
  <text x="48" y="470" fill="rgba(255,255,255,0.88)" font-family="Segoe UI,sans-serif" font-size="42" font-weight="600">ASKUARY · ${label}</text>
</svg>
`;
      try {
        writeFileSync(join(dir, `cover-${i}.svg`), svg, 'utf8');
      } catch {
        /* ignore */
      }
    }
  }

  kindDir(kind: string): string {
    const safe = this.normalizeKind(kind);
    return join(this.rootDir(), safe);
  }

  normalizeKind(kind?: string): CoverKind {
    const k = String(kind || 'journal').toLowerCase().trim();
    if ((COVER_KINDS as readonly string[]).includes(k)) return k as CoverKind;
    if (k === 'article' || k === 'post') return 'journal';
    if (k === 'ss' || k === '说说' || k === '碎念') return 'shuoshuo';
    return 'journal';
  }

  listFiles(kind: string): string[] {
    if (!this.ensured) this.ensureLibraries();
    const files = this.listFilesIn(this.kindDir(kind));
    // 有 JPG/PNG 等实图时优先用实图，忽略默认 SVG 占位
    const photos = files.filter((name) => extname(name).toLowerCase() !== '.svg');
    return photos.length ? photos : files;
  }

  private hashSeed(seed: string): number {
    const s = String(seed || 'askuary');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  pickFile(
    kind: string,
    seed?: string,
    random = false,
  ): { kind: CoverKind; file: string; absPath: string } {
    const safeKind = this.normalizeKind(kind);
    let files = this.listFiles(safeKind);
    if (!files.length) {
      this.ensureLibraries();
      files = this.listFiles(safeKind);
    }
    if (!files.length) {
      throw new NotFoundException(`封面图库为空：covers/${safeKind}/ ，请放入图片后重试`);
    }
    const index = random
      ? Math.floor(Math.random() * files.length)
      : this.hashSeed(seed || 'askuary') % files.length;
    const file = files[index];
    return {
      kind: safeKind,
      file,
      absPath: join(this.kindDir(safeKind), file),
    };
  }

  mimeFor(file: string): string {
    switch (extname(file).toLowerCase()) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';
      case '.gif':
        return 'image/gif';
      case '.svg':
        return 'image/svg+xml';
      case '.avif':
        return 'image/avif';
      default:
        return 'application/octet-stream';
    }
  }

  inventory() {
    const root = this.ensureLibraries();
    return {
      root,
      items: COVER_KINDS.map((kind) => ({
        kind,
        count: this.listFiles(kind).length,
        files: this.listFiles(kind),
      })),
    };
  }
}
