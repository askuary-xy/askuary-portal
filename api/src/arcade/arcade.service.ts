import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ArcadeGalleryStatus } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeMultiline, sanitizeText } from '../common/sanitize';
import {
  arcadeUploadRoot,
  hashClientKey,
  hashIp,
  hashRequestFingerprint,
  saveArcadeImage,
  safeMediaName,
} from './image-safe';
import type {
  ImportArcadeDto,
  SubmitArcadeRatingDto,
  SubmitArcadeScoreDto,
  UpdateArcadeGalleryStatusDto,
  UpdateArcadeScoreAdminDto,
  UpsertArcadeVisitorDto,
} from './dto';

const MAX_DELTA_MS = 2 * 3600_000; // 单次上报最长 +2h
const MAX_PLAY_MS = 500 * 3600_000;

@Injectable()
export class ArcadeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private salt(): string {
    return (
      this.config.get<string>('ARCADE_HASH_SALT') ||
      this.config.get<string>('ADMIN_TOKEN') ||
      'askuary-arcade'
    );
  }

  private clientHash(clientKey: string): string {
    return hashClientKey(clientKey, this.salt());
  }

  private ipHash(ip: string): string {
    return hashIp(ip, this.salt());
  }

  // ── Visitor nick (IP-scoped) ──

  async getVisitor(ip: string) {
    const row = await this.prisma.arcadeVisitor.findUnique({
      where: { ipHash: this.ipHash(ip) },
    });
    if (!row) return { known: false as const, nick: '' };
    return { known: true as const, nick: row.nick };
  }

  async upsertVisitor(ip: string, dto: UpsertArcadeVisitorDto) {
    const nick = sanitizeText(dto.nick, 24);
    if (!nick) throw new BadRequestException('请填写昵称');
    const ipHash = this.ipHash(ip);
    const row = await this.prisma.arcadeVisitor.upsert({
      where: { ipHash },
      create: { ipHash, nick },
      update: { nick },
    });
    return { known: true as const, nick: row.nick };
  }

  // ── Gallery ──

  listGallery(gameId: string | undefined, status: string | undefined, admin: boolean) {
    const where: {
      gameId?: string;
      status?: ArcadeGalleryStatus;
    } = {};
    if (gameId?.trim()) where.gameId = gameId.trim().slice(0, 64);
    if (admin && status && status !== 'all') {
      where.status = status as ArcadeGalleryStatus;
    } else if (!admin) {
      where.status = 'published';
    }
    return this.prisma.arcadeGalleryItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: admin ? 200 : 48,
    });
  }

  async createGallery(input: {
    gameId: string;
    nick: string;
    note: string;
    kind?: string;
    clientKey?: string;
    file?: Express.Multer.File;
    ip: string;
    ua: string;
  }) {
    const gameId = sanitizeText(input.gameId, 64);
    const nick = sanitizeText(input.nick, 24);
    const note = sanitizeMultiline(input.note, 280);
    const kind = sanitizeText(input.kind || 'run', 16) || 'run';
    if (!gameId || !nick || !note) {
      throw new BadRequestException('gameId / nick / note 不能为空');
    }
    if (!input.file?.buffer?.length) {
      throw new BadRequestException('请上传截图');
    }

    const saved = await saveArcadeImage(input.file);
    const clientHash = input.clientKey
      ? this.clientHash(input.clientKey)
      : hashRequestFingerprint(input.ip, input.ua, this.salt());

    return this.prisma.arcadeGalleryItem.create({
      data: {
        gameId,
        nick,
        note,
        kind,
        imageUrl: saved.imageUrl,
        status: 'pending',
        clientHash,
      },
    });
  }

  async updateGalleryStatus(id: string, dto: UpdateArcadeGalleryStatusDto) {
    const item = await this.prisma.arcadeGalleryItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('not found');
    return this.prisma.arcadeGalleryItem.update({
      where: { id },
      data: {
        status: dto.status,
        rejectReason: dto.rejectReason
          ? sanitizeText(dto.rejectReason, 200)
          : null,
        reviewedAt: new Date(),
      },
    });
  }

  async removeGallery(id: string) {
    const item = await this.prisma.arcadeGalleryItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('not found');
    const name = item.imageUrl.split('/').pop() || '';
    const safe = safeMediaName(name);
    if (safe) {
      try {
        await unlink(join(arcadeUploadRoot(), safe));
      } catch {
        /* ignore missing */
      }
    }
    await this.prisma.arcadeGalleryItem.delete({ where: { id } });
    return { ok: true };
  }

  // ── Ratings ──

  async ratingSummary(gameId: string, clientKey?: string) {
    const gid = sanitizeText(gameId, 64);
    if (!gid) throw new BadRequestException('gameId 无效');
    const rows = await this.prisma.arcadeRating.findMany({
      where: { gameId: gid },
      select: { score: true, clientHash: true },
    });
    const n = rows.length;
    const avg = n ? rows.reduce((a, r) => a + r.score, 0) / n : 0;
    let mine = 0;
    if (clientKey) {
      try {
        const h = this.clientHash(clientKey);
        mine = rows.find((r) => r.clientHash === h)?.score || 0;
      } catch {
        mine = 0;
      }
    }
    return { gameId: gid, avg: Math.round(avg * 10) / 10, count: n, mine };
  }

  async submitRating(dto: SubmitArcadeRatingDto) {
    const gameId = sanitizeText(dto.gameId, 64);
    const clientHash = this.clientHash(dto.clientKey);
    const score = Math.min(5, Math.max(1, Math.floor(dto.score)));
    const row = await this.prisma.arcadeRating.upsert({
      where: { gameId_clientHash: { gameId, clientHash } },
      create: { gameId, clientHash, score },
      update: { score },
    });
    return { gameId: row.gameId, score: row.score };
  }

  // ── Leaderboard ──

  listLeaderboard(gameId: string, limit = 20) {
    const gid = sanitizeText(gameId, 64);
    const take = Math.min(50, Math.max(1, Math.floor(limit) || 20));
    return this.prisma.arcadeScore.findMany({
      where: { gameId: gid, hidden: false, playMs: { gt: 0 } },
      orderBy: [{ playMs: 'desc' }, { badges: 'desc' }],
      take,
      select: {
        id: true,
        gameId: true,
        nick: true,
        playMs: true,
        sessions: true,
        badges: true,
        updatedAt: true,
      },
    });
  }

  listScoresAdmin(gameId?: string) {
    return this.prisma.arcadeScore.findMany({
      where: gameId?.trim() ? { gameId: gameId.trim() } : undefined,
      orderBy: { playMs: 'desc' },
      take: 200,
    });
  }

  async submitScore(dto: SubmitArcadeScoreDto) {
    const gameId = sanitizeText(dto.gameId, 64);
    const nick = sanitizeText(dto.nick || '训练家', 24) || '训练家';
    const clientHash = this.clientHash(dto.clientKey);
    let playMs = Math.min(MAX_PLAY_MS, Math.max(0, Math.floor(dto.playMs)));
    const sessions = Math.min(100_000, Math.max(0, Math.floor(dto.sessions)));
    const badges = Math.min(64, Math.max(0, Math.floor(dto.badges)));

    const existing = await this.prisma.arcadeScore.findUnique({
      where: { gameId_clientHash: { gameId, clientHash } },
    });

    if (existing) {
      // 只允许时间前进，且单次增量有上限（防刷榜）
      if (playMs < existing.playMs) playMs = existing.playMs;
      if (playMs - existing.playMs > MAX_DELTA_MS) {
        playMs = existing.playMs + MAX_DELTA_MS;
      }
      return this.prisma.arcadeScore.update({
        where: { id: existing.id },
        data: {
          nick,
          playMs,
          sessions: Math.max(existing.sessions, sessions),
          badges: Math.max(existing.badges, badges),
        },
      });
    }

    if (playMs > MAX_DELTA_MS) playMs = MAX_DELTA_MS;
    return this.prisma.arcadeScore.create({
      data: { gameId, nick, playMs, sessions, badges, clientHash },
    });
  }

  async updateScoreAdmin(id: string, dto: UpdateArcadeScoreAdminDto) {
    const item = await this.prisma.arcadeScore.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('not found');
    return this.prisma.arcadeScore.update({
      where: { id },
      data: {
        ...(typeof dto.hidden === 'boolean' ? { hidden: dto.hidden } : {}),
        ...(dto.nick ? { nick: sanitizeText(dto.nick, 24) } : {}),
      },
    });
  }

  async removeScore(id: string) {
    await this.prisma.arcadeScore.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('not found');
    });
    return { ok: true };
  }

  mediaAbsolutePath(filename: string): string | null {
    const safe = safeMediaName(filename);
    if (!safe) return null;
    return join(arcadeUploadRoot(), safe);
  }

  private gamesPagePath(): string {
    const fromEnv = this.config.get<string>('GAMES_PAGE_PATH')?.trim();
    if (fromEnv) return fromEnv;
    const candidates = [
      join(process.cwd(), '..', 'public', 'data', 'games-page.json'),
      join(process.cwd(), '..', 'data', 'games-page.json'),
      join(process.cwd(), 'public', 'data', 'games-page.json'),
      join(process.cwd(), 'data', 'games-page.json'),
    ];
    return candidates.find((p) => existsSync(p)) || candidates[0];
  }

  /** 从静态 games-page.json 导入画廊种子（一键导入） */
  async importFromPage(dto: ImportArcadeDto = {}) {
    type PageJson = {
      activeId?: string;
      games?: Array<{ id?: string }>;
      gallerySeed?: Array<{
        id?: string;
        nick?: string;
        note?: string;
        kind?: string;
        gameId?: string;
        imageUrl?: string;
      }>;
    };
    let page = dto.page as PageJson | undefined;
    if (!page) {
      const path = this.gamesPagePath();
      if (!existsSync(path)) {
        throw new BadRequestException(
          `未找到 games-page.json（尝试：${path}）。可在后台由页面提交 JSON。`,
        );
      }
      page = JSON.parse(readFileSync(path, 'utf8')) as PageJson;
    }

    const seeds = Array.isArray(page?.gallerySeed) ? page.gallerySeed : [];
    const defaultGameId = sanitizeText(
      page?.activeId || page?.games?.[0]?.id || 'pokemon-radical-red',
      64,
    );
    const overwrite = Boolean(dto.overwrite);
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const raw of seeds) {
      if (!raw || typeof raw !== 'object') continue;
      const seedId = sanitizeText(String(raw.id || ''), 64);
      const nick = sanitizeText(String(raw.nick || '站长'), 24);
      const note = sanitizeMultiline(String(raw.note || ''), 280);
      if (!nick || !note) continue;
      const gameId = sanitizeText(String(raw.gameId || defaultGameId), 64);
      const kind = sanitizeText(String(raw.kind || 'tip'), 16) || 'tip';
      const imageUrl = sanitizeText(String(raw.imageUrl || ''), 300);
      const clientHash = seedId ? `seed:${seedId}` : `seed:${gameId}:${nick}:${note.slice(0, 40)}`;

      // 按种子 hash 或同内容（nick+note）去重，避免重复导入出现双份
      const existing = await this.prisma.arcadeGalleryItem.findFirst({
        where: {
          OR: [
            { clientHash },
            { gameId, nick, note },
          ],
        },
      });
      if (existing) {
        if (!overwrite) {
          skipped += 1;
          continue;
        }
        await this.prisma.arcadeGalleryItem.update({
          where: { id: existing.id },
          data: {
            gameId,
            nick,
            note,
            kind,
            imageUrl: imageUrl || existing.imageUrl,
            status: 'published',
            reviewedAt: new Date(),
          },
        });
        updated += 1;
        continue;
      }

      await this.prisma.arcadeGalleryItem.create({
        data: {
          gameId,
          nick,
          note,
          kind,
          imageUrl,
          status: 'published',
          clientHash,
          reviewedAt: new Date(),
        },
      });
      created += 1;
    }

    const total = await this.prisma.arcadeGalleryItem.count();
    return { created, updated, skipped, total, seeds: seeds.length };
  }
}
