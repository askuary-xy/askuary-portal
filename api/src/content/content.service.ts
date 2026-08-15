import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentKind, ContentStatus, Prisma } from '@prisma/client';
import { marked } from 'marked';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContentDto, ImportContentDto, UpdateContentDto } from './dto';
import { generateAiBundle, hasAiConfig } from './ai-summary';
import { preprocessMdPlugins } from './lib/md-plugins';

marked.setOptions({ gfm: true, breaks: false });

const SHUOSHUO_TAGS = new Set(['碎念', '说说', 'shuoshuo']);

function parseTags(tagsJson: string): string[] {
  try {
    const raw = JSON.parse(tagsJson || '[]');
    return Array.isArray(raw) ? raw.map(String) : [];
  } catch {
    return [];
  }
}

function hasShuoshuoTag(tags: string[]): boolean {
  return tags.some((t) => {
    const tag = String(t || '').trim().toLowerCase();
    return tag === '碎念' || tag === '说说' || tag === 'shuoshuo' || SHUOSHUO_TAGS.has(tag);
  });
}

function normalizeTags(tags: string[] | undefined, mode?: string): string[] {
  const list = (tags || []).map((t) => String(t).trim()).filter(Boolean);
  if (mode === 'shuoshuo' && !hasShuoshuoTag(list)) {
    list.unshift('碎念');
  }
  if (mode === 'article') {
    return list.filter((t) => {
      const lower = t.toLowerCase();
      return lower !== '碎念' && lower !== '说说' && lower !== 'shuoshuo';
    });
  }
  return [...new Set(list)];
}

/** 合并/查重用：把 ·《》 等差异收成同一键 */
function normalizeSlugKey(slug: string): string {
  return String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/[·・]/g, '-')
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function slugify(input: string): string {
  const base = normalizeSlugKey(input).slice(0, 80);
  return base || `post-${Date.now().toString(36)}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/** 把各种日期字符串压成 YYYY-MM-DD；禁止对无年份串 new Date()（会落到 2001） */
function normalizeDate(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return today();
  // 历史误解析：无年份短串 → 2001；纠正为当前年
  const bad2001 = s.match(/^2001-(\d{2}-\d{2})$/);
  if (bad2001) return `${new Date().getFullYear()}-${bad2001[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);

  const named = s.match(
    /^(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+)?([A-Za-z]{3,9})\s+(\d{1,2})(?:[\s,]+(\d{4}))?/i,
  );
  if (named) {
    const month = MONTHS[named[1].toLowerCase().slice(0, 3)];
    const day = Number(named[2]);
    if (month && day >= 1 && day <= 31) {
      const yearInStr = s.match(/\b(19|20)\d{2}\b/);
      const year = named[3]
        ? Number(named[3])
        : yearInStr
          ? Number(yearInStr[0])
          : new Date().getFullYear();
      const m = String(month).padStart(2, '0');
      const d = String(day).padStart(2, '0');
      return `${year}-${m}-${d}`;
    }
  }

  // 仅当已有四位年份时才用 Date
  if (/\b(19|20)\d{2}\b/.test(s)) {
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  return s.slice(0, 32);
}

function renderHtml(markdown: string): string {
  const prepared = preprocessMdPlugins(markdown || '', marked);
  return String(marked.parse(prepared));
}

function isCoverApiUrl(src: string): boolean {
  const s = String(src || '');
  return /\/api\/covers\//i.test(s) || /t\.alcy\.cc/i.test(s) || /tc\.alcy\.cc/i.test(s);
}

function isUsableCoverSrc(src: string): boolean {
  const s = String(src || '').trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (lower === 'random' || lower === 'none' || lower === 'null') return false;
  if (s === '#' || lower === 'about:blank') return false;
  // 旧 WP 路径常失效；本站文章配图用 /uploads/
  if (/\/wp-content\//i.test(s)) return false;
  return true;
}

/** 规范化随机封面：默认栗次元萌图；按 slug 稳定取图 */
function randomCoverPath(_kind: ContentKind | string, slug: string, unique = false): string {
  const base = encodeURIComponent(String(slug || 'askuary').trim() || 'askuary');
  const seed = unique ? `${base}-${Date.now().toString(36)}` : base;
  return `https://t.alcy.cc/moe/?t=${seed}`;
}

/**
 * 封面：显式静态 URL → 随机封面 API（正文首图不进封面，图片仍留在正文）
 */
function prepareBodyAndCover(
  markdown: string,
  coverInput: string,
  opts: { kind: ContentKind; slug: string; mode?: string; htmlInput?: string },
) {
  const rawHtml = String(opts.htmlInput || '').trim() || renderHtml(markdown);
  const coverKind =
    opts.mode === 'shuoshuo'
      ? 'shuoshuo'
      : opts.kind === ContentKind.blog
        ? 'blog'
        : 'journal';
  const input = String(coverInput || '').trim();
  const lower = input.toLowerCase();

  // 仅自定义静态封面保留；空 / random / 随机 API → 统一按 slug 默认随机
  if (input && lower !== 'random' && !isCoverApiUrl(input) && isUsableCoverSrc(input)) {
    return { html: rawHtml, cover: input };
  }
  return { html: rawHtml, cover: randomCoverPath(coverKind, opts.slug) };
}

export type ContentPublic = {
  id: string;
  kind: ContentKind;
  slug: string;
  title: string;
  summary: string;
  aiSummary?: string;
  aiSelfIntro?: string;
  aiOutline?: string;
  cover: string;
  html: string;
  markdown?: string;
  tags: string[];
  status: ContentStatus;
  date: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  origin: 'api';
};

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  /** 后台预览 / 发布共用的 Markdown → HTML（含短代码） */
  renderMarkdown(markdown: string): string {
    return renderHtml(markdown || '');
  }

  toPublic(
    row: {
      id: string;
      kind: ContentKind;
      slug: string;
      title: string;
      summary: string;
      aiSummary?: string;
      aiSelfIntro?: string;
      aiOutline?: string;
      cover: string;
      html: string;
      markdown: string;
      tagsJson: string;
      status: ContentStatus;
      date: string;
      publishedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    includeMarkdown = false,
  ): ContentPublic {
    return {
      id: row.id,
      kind: row.kind,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      ...(row.aiSummary ? { aiSummary: row.aiSummary } : {}),
      ...(row.aiSelfIntro ? { aiSelfIntro: row.aiSelfIntro } : {}),
      ...(row.aiOutline ? { aiOutline: row.aiOutline } : {}),
      cover: row.cover || '',
      html: row.html,
      ...(includeMarkdown ? { markdown: row.markdown } : {}),
      tags: parseTags(row.tagsJson),
      status: row.status,
      date: row.date,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      origin: 'api',
    };
  }

  /** 发布时若缺 AI 字段则拉取一次（失败不阻断发布） */
  private async fillAiFields(input: {
    title: string;
    markdown: string;
    summary?: string;
    aiSummary?: string;
    aiSelfIntro?: string;
    aiOutline?: string;
    force?: boolean;
  }): Promise<{
    summary: string;
    aiSummary: string;
    aiSelfIntro: string;
    aiOutline: string;
  }> {
    const summary = String(input.summary || '').trim();
    let aiSummary = String(input.aiSummary || '').trim();
    let aiSelfIntro = String(input.aiSelfIntro || '').trim();
    let aiOutline = String(input.aiOutline || '').trim();

    const need =
      input.force || !aiSummary || !aiSelfIntro || !aiOutline;
    if (!need || !hasAiConfig()) {
      return {
        summary: summary || aiSummary,
        aiSummary: aiSummary || summary,
        aiSelfIntro,
        aiOutline,
      };
    }

    try {
      const bundle = await generateAiBundle(input.title, input.markdown);
      if (input.force) {
        return {
          summary: summary || bundle.summary,
          aiSummary: bundle.summary,
          aiSelfIntro: bundle.selfIntro,
          aiOutline: bundle.outline,
        };
      }
      aiSummary = aiSummary || bundle.summary;
      aiSelfIntro = aiSelfIntro || bundle.selfIntro;
      aiOutline = aiOutline || bundle.outline;
      return {
        summary: summary || bundle.summary,
        aiSummary,
        aiSelfIntro,
        aiOutline,
      };
    } catch (err) {
      console.warn('[content-ai]', (err as Error)?.message || err);
      return {
        summary: summary || aiSummary,
        aiSummary: aiSummary || summary,
        aiSelfIntro,
        aiOutline,
      };
    }
  }

  async list(kind?: string, status?: string, admin = false) {
    const where: Prisma.ContentPostWhereInput = {};
    if (kind === 'journal' || kind === 'blog') {
      where.kind = kind;
    }
    if (admin) {
      if (status === 'draft' || status === 'published') {
        where.status = status;
      }
    } else {
      where.status = ContentStatus.published;
    }

    const rows = await this.prisma.contentPost.findMany({
      where,
      orderBy: [{ date: 'desc' }, { updatedAt: 'desc' }],
    });
    return rows.map((row) => this.toPublic(row, admin));
  }

  /**
   * 前台需隐藏的 slug：草稿（压住同名静态稿）+ 删除墓碑
   * managed=true 表示该 kind 已由后台接管，前台应忽略静态稿
   */
  async listSuppressed(kind?: string): Promise<{
    items: Array<{ kind: ContentKind; slug: string; reason: 'draft' | 'deleted' }>;
    managed: boolean;
  }> {
    const kindFilter =
      kind === 'journal' || kind === 'blog' ? (kind as ContentKind) : undefined;

    const [drafts, tombs, postCount] = await Promise.all([
      this.prisma.contentPost.findMany({
        where: {
          status: ContentStatus.draft,
          ...(kindFilter ? { kind: kindFilter } : {}),
        },
        select: { kind: true, slug: true },
      }),
      this.prisma.contentSuppress.findMany({
        where: kindFilter ? { kind: kindFilter } : {},
        select: { kind: true, slug: true },
      }),
      this.prisma.contentPost.count({
        where: kindFilter ? { kind: kindFilter } : {},
      }),
    ]);

    const items: Array<{ kind: ContentKind; slug: string; reason: 'draft' | 'deleted' }> =
      [];
    for (const row of drafts) {
      items.push({ kind: row.kind, slug: row.slug, reason: 'draft' });
    }
    for (const row of tombs) {
      items.push({ kind: row.kind, slug: row.slug, reason: 'deleted' });
    }
    return {
      items,
      managed: postCount > 0 || tombs.length > 0,
    };
  }

  private async clearSuppress(kind: ContentKind, slug: string) {
    const slugNorm = normalizeSlugKey(slug);
    if (!slugNorm) return;
    await this.prisma.contentSuppress.deleteMany({
      where: { kind, slugNorm },
    });
  }

  private async writeSuppress(kind: ContentKind, slug: string) {
    const slugNorm = normalizeSlugKey(slug);
    if (!slugNorm) return;
    await this.prisma.contentSuppress.upsert({
      where: { kind_slugNorm: { kind, slugNorm } },
      create: { kind, slugNorm, slug },
      update: { slug },
    });
  }

  async getByKindSlug(kind: string, slug: string, admin = false) {
    if (kind !== 'journal' && kind !== 'blog') {
      throw new BadRequestException('invalid kind');
    }
    const row = await this.prisma.contentPost.findUnique({
      where: { kind_slug: { kind, slug } },
    });
    if (!row) throw new NotFoundException('content not found');
    if (!admin && row.status !== ContentStatus.published) {
      throw new NotFoundException('content not found');
    }
    return this.toPublic(row, admin);
  }

  async create(dto: CreateContentDto) {
    const mode = dto.mode || (dto.kind === 'blog' ? 'blog' : 'article');
    const kind: ContentKind =
      mode === 'blog' || dto.kind === 'blog' ? ContentKind.blog : ContentKind.journal;
    const tags = normalizeTags(dto.tags, mode === 'blog' ? undefined : mode);
    if (mode === 'shuoshuo' && !hasShuoshuoTag(tags)) {
      throw new BadRequestException('碎念必须包含「碎念」标签');
    }

    let slug = slugify(dto.slug || dto.title);
    slug = await this.ensureUniqueSlug(kind, slug);

    const status =
      dto.status === ContentStatus.published
        ? ContentStatus.published
        : ContentStatus.draft;
    const date = normalizeDate(dto.date || '');
    const markdown = dto.markdown.trim();
    if (!markdown) throw new BadRequestException('正文不能为空');
    const prepared = prepareBodyAndCover(markdown, (dto.cover || '').trim(), {
      kind,
      slug,
      mode,
    });

    const ai =
      status === ContentStatus.published
        ? await this.fillAiFields({
            title: dto.title.trim(),
            markdown,
            summary: (dto.summary || '').trim(),
          })
        : {
            summary: (dto.summary || '').trim(),
            aiSummary: '',
            aiSelfIntro: '',
            aiOutline: '',
          };

    try {
      const row = await this.prisma.contentPost.create({
        data: {
          kind,
          slug,
          title: dto.title.trim(),
          summary: ai.summary,
          aiSummary: ai.aiSummary,
          aiSelfIntro: ai.aiSelfIntro,
          aiOutline: ai.aiOutline,
          cover: prepared.cover,
          markdown,
          html: prepared.html,
          tagsJson: JSON.stringify(tags),
          status,
          date,
          publishedAt: status === ContentStatus.published ? new Date() : null,
          manualEdit: true,
        },
      });
      // 重新发布/新建同 slug → 清掉删除墓碑
      if (status === ContentStatus.published) {
        await this.clearSuppress(kind, slug);
      }
      return this.toPublic(row, true);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('slug 已存在');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateContentDto) {
    const existing = await this.prisma.contentPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('content not found');

    const mode =
      dto.mode ||
      (existing.kind === ContentKind.blog
        ? 'blog'
        : hasShuoshuoTag(parseTags(existing.tagsJson))
          ? 'shuoshuo'
          : 'article');

    const data: Prisma.ContentPostUpdateInput = {};

    // 任意后台保存都视为人工编辑，后续导入不再覆盖
    data.manualEdit = true;

    if (dto.title != null) data.title = dto.title.trim();
    if (dto.summary != null) data.summary = dto.summary.trim();
    if (dto.date != null && dto.date.trim()) data.date = normalizeDate(dto.date);

    if (dto.tags != null || dto.mode != null) {
      const tags = normalizeTags(
        dto.tags ?? parseTags(existing.tagsJson),
        mode === 'blog' ? undefined : mode,
      );
      if (mode === 'shuoshuo' && !hasShuoshuoTag(tags)) {
        throw new BadRequestException('碎念必须包含「碎念」标签');
      }
      data.tagsJson = JSON.stringify(tags);
    }

    let nextSlug = existing.slug;
    if (dto.slug != null && dto.slug.trim()) {
      const candidate = slugify(dto.slug);
      if (candidate !== existing.slug) {
        nextSlug = await this.ensureUniqueSlug(existing.kind, candidate, id);
        data.slug = nextSlug;
      }
    }

    if (dto.markdown != null) {
      const markdown = dto.markdown.trim();
      if (!markdown) throw new BadRequestException('正文不能为空');
      const prepared = prepareBodyAndCover(
        markdown,
        dto.cover != null ? dto.cover.trim() : existing.cover,
        { kind: existing.kind, slug: nextSlug, mode },
      );
      data.markdown = markdown;
      data.html = prepared.html;
      data.cover = prepared.cover;
    } else if (dto.cover != null) {
      const input = dto.cover.trim();
      if (!input || input.toLowerCase() === 'random' || isCoverApiUrl(input)) {
        data.cover = randomCoverPath(
          mode === 'shuoshuo' ? 'shuoshuo' : existing.kind,
          nextSlug,
        );
      } else {
        data.cover = input;
      }
    }

    if (dto.status === ContentStatus.published || dto.status === ContentStatus.draft) {
      data.status = dto.status;
      if (dto.status === ContentStatus.published && !existing.publishedAt) {
        data.publishedAt = new Date();
      }
      if (dto.status === ContentStatus.draft) {
        data.publishedAt = null;
      }
    }

    const nextStatus =
      dto.status === ContentStatus.published || dto.status === ContentStatus.draft
        ? dto.status
        : existing.status;
    const nextMarkdown =
      dto.markdown != null ? dto.markdown.trim() : existing.markdown;
    const nextTitle = dto.title != null ? dto.title.trim() : existing.title;
    const becomingPublished =
      nextStatus === ContentStatus.published &&
      (existing.status !== ContentStatus.published ||
        dto.markdown != null ||
        !existing.aiSummary ||
        !existing.aiSelfIntro ||
        !existing.aiOutline);

    if (becomingPublished) {
      const ai = await this.fillAiFields({
        title: nextTitle,
        markdown: nextMarkdown,
        summary:
          dto.summary != null ? dto.summary.trim() : existing.summary,
        aiSummary: existing.aiSummary,
        aiSelfIntro: existing.aiSelfIntro,
        aiOutline: existing.aiOutline,
        force: Boolean(dto.markdown != null && existing.status === ContentStatus.published),
      });
      data.summary = ai.summary;
      data.aiSummary = ai.aiSummary;
      data.aiSelfIntro = ai.aiSelfIntro;
      data.aiOutline = ai.aiOutline;
    }

    const row = await this.prisma.contentPost.update({ where: { id }, data });
    // 重新发布 → 清墓碑；改草稿则由 listSuppressed 压住静态稿
    if (row.status === ContentStatus.published) {
      await this.clearSuppress(row.kind, row.slug);
    }
    return this.toPublic(row, true);
  }

  async remove(id: string) {
    const existing = await this.prisma.contentPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('content not found');
    // 先写墓碑再硬删，压住同 slug 静态稿
    await this.writeSuppress(existing.kind, existing.slug);
    await this.prisma.contentPost.delete({ where: { id } });
    return { ok: true };
  }

  /** 批量导入静态站文章（旧站迁移 / public/data） */
  async importBatch(dto: ImportContentDto) {
    const overwrite = Boolean(dto.overwrite);
    const items = Array.isArray(dto.items) ? dto.items : [];
    if (!items.length) throw new BadRequestException('没有可导入的内容');

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    // 预加载各 kind，按规范化 slug 查重（避免 · / 《》 造成双份）
    const byKindNorm = new Map<string, Map<string, { id: string; slug: string; publishedAt: Date | null }>>();
    for (const kind of [ContentKind.journal, ContentKind.blog]) {
      const rows = await this.prisma.contentPost.findMany({
        where: { kind },
        select: { id: true, slug: true, publishedAt: true },
      });
      const m = new Map<string, { id: string; slug: string; publishedAt: Date | null }>();
      for (const row of rows) {
        const key = normalizeSlugKey(row.slug);
        if (key) m.set(key, row);
      }
      byKindNorm.set(kind, m);
    }

    for (const raw of items) {
      try {
        const kind: ContentKind =
          raw.kind === 'blog' ? ContentKind.blog : ContentKind.journal;
        const mode =
          raw.mode ||
          (kind === ContentKind.blog
            ? 'blog'
            : hasShuoshuoTag(raw.tags || [])
              ? 'shuoshuo'
              : 'article');
        const tags = normalizeTags(raw.tags, mode === 'blog' ? undefined : mode);
        // 保留静态站原始 slug，避免 slugify 吃掉 · 后与前台路径不一致
        const slug = String(raw.slug || '').trim() || slugify(raw.title);
        const markdown = String(raw.markdown || raw.html || raw.summary || raw.title || '').trim();
        if (!markdown) {
          skipped += 1;
          errors.push(`${slug}: 无正文`);
          continue;
        }
        const prepared = prepareBodyAndCover(markdown, (raw.cover || '').trim(), {
          kind,
          slug,
          mode,
          htmlInput: String(raw.html || '').trim() || undefined,
        });
        const date = normalizeDate(raw.date || '');
        const title = raw.title.trim();
        const summary = (raw.summary || '').trim();

        const normKey = normalizeSlugKey(slug);
        const kindMap = byKindNorm.get(kind) || new Map();
        let existing = await this.prisma.contentPost.findUnique({
          where: { kind_slug: { kind, slug } },
        });
        if (!existing && normKey) {
          const hit = kindMap.get(normKey);
          if (hit) {
            existing = await this.prisma.contentPost.findUnique({ where: { id: hit.id } });
          }
        }

        if (existing) {
          // 已存在：默认跳过；强制覆盖时仍不改「后台编辑过」的稿
          if (!overwrite || existing.manualEdit) {
            skipped += 1;
            continue;
          }
          const nextSlug =
            existing.slug === slug
              ? slug
              : await this.ensureUniqueSlug(kind, slug, existing.id);
          await this.prisma.contentPost.update({
            where: { id: existing.id },
            data: {
              slug: nextSlug,
              title,
              summary,
              cover: prepared.cover,
              markdown,
              html: prepared.html,
              tagsJson: JSON.stringify(tags),
              date,
              status: ContentStatus.published,
              publishedAt: existing.publishedAt || new Date(),
              manualEdit: false,
            },
          });
          await this.clearSuppress(kind, nextSlug);
          kindMap.set(normKey, {
            id: existing.id,
            slug: nextSlug,
            publishedAt: existing.publishedAt,
          });
          updated += 1;
        } else {
          const uniqueSlug = await this.ensureUniqueSlug(kind, slug);
          const row = await this.prisma.contentPost.create({
            data: {
              kind,
              slug: uniqueSlug,
              title,
              summary,
              cover: prepared.cover,
              markdown,
              html: prepared.html,
              tagsJson: JSON.stringify(tags),
              status: ContentStatus.published,
              date,
              publishedAt: new Date(),
              manualEdit: false,
            },
          });
          await this.clearSuppress(kind, uniqueSlug);
          kindMap.set(normalizeSlugKey(uniqueSlug), {
            id: row.id,
            slug: uniqueSlug,
            publishedAt: row.publishedAt,
          });
          created += 1;
        }
      } catch (err) {
        skipped += 1;
        errors.push(
          `${raw.slug || raw.title}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { created, updated, skipped, errors: errors.slice(0, 20), total: items.length };
  }

  private async ensureUniqueSlug(
    kind: ContentKind,
    slug: string,
    excludeId?: string,
  ): Promise<string> {
    let candidate = slug;
    let i = 2;
    while (true) {
      const found = await this.prisma.contentPost.findUnique({
        where: { kind_slug: { kind, slug: candidate } },
      });
      if (!found || found.id === excludeId) return candidate;
      candidate = `${slug}-${i}`;
      i += 1;
      if (i > 50) return `${slug}-${Date.now().toString(36)}`;
    }
  }
}
