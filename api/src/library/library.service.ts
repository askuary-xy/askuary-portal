import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LibraryKind, LibraryStatus, Prisma } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateLibraryItemDto,
  ImportLibraryDto,
  UpdateLibraryItemDto,
} from './dto';

const KIND_LABEL: Record<LibraryKind, string> = {
  book: '图书',
  novel: '小说',
  manga: '漫画',
  game: '游戏',
  anime: '动漫',
  movie: '电影',
  drama: '电视剧',
  variety: '综艺',
};

const STATUS_LABEL: Record<LibraryStatus, string> = {
  reading: '进行中',
  finished: '已完成',
  planned: '想看',
  dropped: '弃坑',
};

function parseStringList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.map((x) => String(x || '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function encodeStringList(list: unknown): string {
  if (!Array.isArray(list)) return '[]';
  return JSON.stringify(
    list.map((x) => String(x || '').trim()).filter(Boolean),
  );
}

function slugify(title: string): string {
  return (
    String(title || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u4e00-\u9fff-]+/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || `item-${Date.now()}`
  );
}

function ratingStars(rating: number) {
  const score = Number(rating) || 0;
  if (score <= 0) return { score: 0, stars: 0, max: 5, label: '' };
  const stars = Math.min(5, Math.max(0, Math.round((score / 2) * 2) / 2));
  return { score, stars, max: 5, label: `${score} / 10` };
}

function progressMeta(item: {
  progress: string;
  progressCurrent: number;
  progressTotal: number;
}) {
  let current = Number(item.progressCurrent) || 0;
  let total = Number(item.progressTotal) || 0;
  const text = String(item.progress || '');
  if (current <= 0 || total <= 0) {
    const slash = text.match(/(\d+)\s*[/／]\s*(\d+)/u);
    if (slash) {
      current = Number(slash[1]);
      total = Number(slash[2]);
    }
  }
  if (total > 0 && current > total) current = total;
  const percent =
    total > 0 && current > 0
      ? Math.min(100, Math.round((current / total) * 100))
      : 0;
  let label = text;
  if (total > 0 && current > 0) label = `${current} / ${total}`;
  return { current, total, percent, label };
}

function parseKind(raw: unknown): LibraryKind {
  const v = String(raw || 'book');
  if (v in KIND_LABEL) return v as LibraryKind;
  return LibraryKind.book;
}

function parseStatus(raw: unknown): LibraryStatus {
  const v = String(raw || 'planned');
  if (v in STATUS_LABEL) return v as LibraryStatus;
  return LibraryStatus.planned;
}

type Row = {
  id: string;
  slug: string;
  title: string;
  author: string;
  type: LibraryKind;
  status: LibraryStatus;
  cover: string;
  progress: string;
  progressCurrent: number;
  progressTotal: number;
  rating: number;
  year: string;
  platform: string;
  link: string;
  genre: string;
  summary: string;
  thoughts: string;
  quotesJson: string;
  takeawaysJson: string;
  updatedLabel: string;
  updatedAt: Date;
};

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private indexPath(): string {
    const fromEnv = this.config.get<string>('LIBRARY_INDEX_PATH');
    if (fromEnv) return fromEnv;
    const candidates = [
      join(process.cwd(), '..', 'public', 'data', 'library.json'),
      join(process.cwd(), 'public', 'data', 'library.json'),
      join(process.cwd(), '..', 'dist', 'data', 'library.json'),
      join(process.cwd(), '..', 'data', 'library.json'),
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
    return candidates[0];
  }

  private mapItem(row: Row) {
    const progress = progressMeta(row);
    const rating = Number(row.rating) || 0;
    return {
      dbId: row.id,
      id: row.slug,
      title: row.title,
      author: row.author || '未知',
      type: row.type,
      typeLabel: KIND_LABEL[row.type] || row.type,
      cover: row.cover || undefined,
      status: row.status,
      statusLabel: STATUS_LABEL[row.status] || row.status,
      progress: progress.label || undefined,
      progressCurrent: progress.current || undefined,
      progressTotal: progress.total || undefined,
      progressPercent: progress.percent || undefined,
      rating,
      ratingStars: ratingStars(rating),
      year: row.year || undefined,
      platform: row.platform || undefined,
      link: row.link || undefined,
      genre: row.genre || undefined,
      summary: row.summary || undefined,
      thoughts: row.thoughts || undefined,
      quotes: parseStringList(row.quotesJson),
      takeaways: parseStringList(row.takeawaysJson),
      updated: row.updatedLabel || row.updatedAt.toISOString().slice(0, 10),
    };
  }

  async list(type?: string, status?: string) {
    const where: Prisma.LibraryItemWhereInput = {};
    if (type && type !== 'all' && type in KIND_LABEL) {
      where.type = type as LibraryKind;
    }
    if (status && status !== 'all' && status in STATUS_LABEL) {
      where.status = status as LibraryStatus;
    }
    const rows = await this.prisma.libraryItem.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { title: 'asc' }],
    });
    const items = rows.map((r) => this.mapItem(r));
    return {
      items,
      managed: items.length > 0,
      kinds: KIND_LABEL,
      statuses: STATUS_LABEL,
    };
  }

  async getBySlug(slug: string) {
    const row = await this.prisma.libraryItem.findUnique({ where: { slug } });
    if (!row) throw new NotFoundException('馆藏条目不存在');
    return this.mapItem(row);
  }

  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    let slug = slugify(base);
    let n = 0;
    while (true) {
      const candidate = n === 0 ? slug : `${slug}-${n}`;
      const existing = await this.prisma.libraryItem.findUnique({
        where: { slug: candidate },
      });
      if (!existing || existing.id === excludeId) return candidate;
      n += 1;
      if (n > 50) throw new ConflictException('无法生成唯一 slug');
    }
  }

  async create(dto: CreateLibraryItemDto) {
    const title = String(dto.title || '').trim();
    if (!title) throw new BadRequestException('标题不能为空');
    const slug = await this.uniqueSlug(dto.slug || title);
    const type = parseKind(dto.type);
    const status = parseStatus(dto.status);
    const row = await this.prisma.libraryItem.create({
      data: {
        slug,
        title,
        author: String(dto.author || '').trim(),
        type,
        status,
        cover: String(dto.cover || '').trim(),
        progress: String(dto.progress || '').trim(),
        progressCurrent: Number(dto.progressCurrent) || 0,
        progressTotal: Number(dto.progressTotal) || 0,
        rating: Number(dto.rating) || 0,
        year: String(dto.year || '').trim(),
        platform: String(dto.platform || '').trim(),
        link: String(dto.link || '').trim(),
        genre: String(dto.genre || '').trim(),
        summary: String(dto.summary || '').trim(),
        thoughts: String(dto.thoughts || '').trim(),
        quotesJson: encodeStringList(dto.quotes),
        takeawaysJson: encodeStringList(dto.takeaways),
        updatedLabel:
          String(dto.updated || '').trim() ||
          new Date().toISOString().slice(0, 10),
      },
    });
    return this.mapItem(row);
  }

  async update(slug: string, dto: UpdateLibraryItemDto) {
    const existing = await this.prisma.libraryItem.findUnique({
      where: { slug },
    });
    if (!existing) throw new NotFoundException('馆藏条目不存在');

    let nextSlug = existing.slug;
    if (dto.slug != null && String(dto.slug).trim() && String(dto.slug).trim() !== existing.slug) {
      nextSlug = await this.uniqueSlug(String(dto.slug).trim(), existing.id);
    }

    const data: Prisma.LibraryItemUpdateInput = {};
    if (dto.title != null) data.title = String(dto.title).trim();
    if (dto.author != null) data.author = String(dto.author).trim();
    if (dto.type != null) data.type = parseKind(dto.type);
    if (dto.status != null) data.status = parseStatus(dto.status);
    if (dto.cover != null) data.cover = String(dto.cover).trim();
    if (dto.progress != null) data.progress = String(dto.progress).trim();
    if (dto.progressCurrent != null) data.progressCurrent = Number(dto.progressCurrent) || 0;
    if (dto.progressTotal != null) data.progressTotal = Number(dto.progressTotal) || 0;
    if (dto.rating != null) data.rating = Number(dto.rating) || 0;
    if (dto.year != null) data.year = String(dto.year).trim();
    if (dto.platform != null) data.platform = String(dto.platform).trim();
    if (dto.link != null) data.link = String(dto.link).trim();
    if (dto.genre != null) data.genre = String(dto.genre).trim();
    if (dto.summary != null) data.summary = String(dto.summary).trim();
    if (dto.thoughts != null) data.thoughts = String(dto.thoughts).trim();
    if (dto.quotes != null) data.quotesJson = encodeStringList(dto.quotes);
    if (dto.takeaways != null) data.takeawaysJson = encodeStringList(dto.takeaways);
    if (dto.updated != null) data.updatedLabel = String(dto.updated).trim();
    if (nextSlug !== existing.slug) data.slug = nextSlug;

    const row = await this.prisma.libraryItem.update({
      where: { id: existing.id },
      data,
    });
    return this.mapItem(row);
  }

  async remove(slug: string) {
    const existing = await this.prisma.libraryItem.findUnique({
      where: { slug },
    });
    if (!existing) throw new NotFoundException('馆藏条目不存在');
    await this.prisma.libraryItem.delete({ where: { id: existing.id } });
    return { ok: true, slug };
  }

  async importFromIndex(dto: ImportLibraryDto) {
    let index = dto.index;
    if (!index) {
      const path = this.indexPath();
      if (!existsSync(path)) {
        throw new BadRequestException(
          `未找到 library.json（尝试：${path}）。请在后台同步时由页面提交索引，或先部署静态 data/library.json。`,
        );
      }
      index = JSON.parse(readFileSync(path, 'utf8'));
    }

    const list = Array.isArray(index)
      ? index
      : Array.isArray((index as { items?: unknown[] })?.items)
        ? (index as { items: unknown[] }).items
        : [];

    let upserted = 0;
    let skipped = 0;
    const seen = new Set<string>();
    const overwrite = Boolean(dto.overwrite);

    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Record<string, unknown>;
      const title = String(item.title || '').trim();
      if (!title) continue;
      const slug = slugify(String(item.id || item.slug || title));
      seen.add(slug);

      const payload = {
        title,
        author: String(item.author || '').trim(),
        type: parseKind(item.type),
        status: parseStatus(item.status),
        cover: String(item.cover || '').trim(),
        progress: String(item.progress || '').trim(),
        progressCurrent: Number(item.progressCurrent) || 0,
        progressTotal: Number(item.progressTotal) || 0,
        rating: Number(item.rating) || 0,
        year: String(item.year || '').trim(),
        platform: String(item.platform || '').trim(),
        link: String(item.link || '').trim(),
        genre: String(item.genre || '').trim(),
        summary: String(item.summary || '').trim(),
        thoughts: String(item.thoughts || '').trim(),
        quotesJson: encodeStringList(item.quotes),
        takeawaysJson: encodeStringList(item.takeaways),
        updatedLabel: String(item.updated || '').trim(),
      };

      const existing = await this.prisma.libraryItem.findUnique({
        where: { slug },
      });
      if (existing) {
        if (!overwrite) {
          skipped += 1;
          continue;
        }
        // 覆盖时：空字段不抹掉后台已填的想法/摘句
        await this.prisma.libraryItem.update({
          where: { id: existing.id },
          data: {
            title: payload.title,
            author: payload.author || existing.author,
            type: payload.type,
            status: payload.status,
            cover: payload.cover || existing.cover,
            progress: payload.progress || existing.progress,
            progressCurrent: payload.progressCurrent || existing.progressCurrent,
            progressTotal: payload.progressTotal || existing.progressTotal,
            rating: payload.rating || existing.rating,
            year: payload.year || existing.year,
            platform: payload.platform || existing.platform,
            link: payload.link || existing.link,
            genre: payload.genre || existing.genre,
            summary: payload.summary || existing.summary,
            thoughts: payload.thoughts || existing.thoughts,
            quotesJson:
              parseStringList(payload.quotesJson).length > 0
                ? payload.quotesJson
                : existing.quotesJson,
            takeawaysJson:
              parseStringList(payload.takeawaysJson).length > 0
                ? payload.takeawaysJson
                : existing.takeawaysJson,
            updatedLabel: payload.updatedLabel || existing.updatedLabel,
          },
        });
      } else {
        await this.prisma.libraryItem.create({
          data: { slug, ...payload },
        });
      }
      upserted += 1;
    }

    let pruned = 0;
    if (dto.prune) {
      const all = await this.prisma.libraryItem.findMany({
        select: { id: true, slug: true },
      });
      for (const row of all) {
        if (seen.has(row.slug)) continue;
        await this.prisma.libraryItem.delete({ where: { id: row.id } });
        pruned += 1;
      }
    }

    const count = await this.prisma.libraryItem.count();
    return { upserted, skipped, pruned, total: count };
  }
}
