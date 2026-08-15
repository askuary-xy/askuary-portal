import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { createReadStream, existsSync } from 'node:fs';
import { memoryStorage } from 'multer';
import { AdminGuard } from '../common/admin.guard';
import { verifyAdminCredential } from '../common/admin-auth';
import { RateLimit } from '../common/rate-limit.guard';
import { clientIp } from '../common/audit';
import { ArcadeService } from './arcade.service';
import {
  ImportArcadeDto,
  SubmitArcadeRatingDto,
  SubmitArcadeScoreDto,
  UpdateArcadeGalleryStatusDto,
  UpdateArcadeScoreAdminDto,
  UpsertArcadeVisitorDto,
} from './dto';

function mapGallery(item: {
  id: string;
  gameId: string;
  nick: string;
  note: string;
  kind: string;
  imageUrl: string;
  status: string;
  rejectReason: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}) {
  return {
    id: item.id,
    gameId: item.gameId,
    nick: item.nick,
    note: item.note,
    kind: item.kind,
    imageUrl: item.imageUrl,
    status: item.status,
    rejectReason: item.rejectReason ?? undefined,
    createdAt: item.createdAt.toISOString(),
    reviewedAt: item.reviewedAt?.toISOString(),
  };
}

function mapScore(item: {
  id: string;
  gameId: string;
  nick: string;
  playMs: number;
  sessions: number;
  badges: number;
  hidden?: boolean;
  updatedAt: Date;
}) {
  return {
    id: item.id,
    gameId: item.gameId,
    nick: item.nick,
    playMs: item.playMs,
    sessions: item.sessions,
    badges: item.badges,
    hidden: item.hidden,
    updatedAt: item.updatedAt.toISOString(),
  };
}

@Controller('api/arcade')
export class ArcadeController {
  constructor(
    private readonly arcade: ArcadeService,
    private readonly config: ConfigService,
  ) {}

  private isAdmin(authHeader?: string): boolean {
    return verifyAdminCredential(this.config, authHeader);
  }

  /** 公开媒体（路径穿越已在 safeMediaName 拦截） */
  @Get('media/:name')
  media(@Param('name') name: string, @Res() res: Response) {
    const abs = this.arcade.mediaAbsolutePath(name);
    if (!abs || !existsSync(abs)) throw new NotFoundException('not found');
    const lower = name.toLowerCase();
    const type = lower.endsWith('.png')
      ? 'image/png'
      : lower.endsWith('.webp')
        ? 'image/webp'
        : lower.endsWith('.gif')
          ? 'image/gif'
          : 'image/jpeg';
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    createReadStream(abs).pipe(res);
  }

  /** 从静态 games-page.json 导入画廊种子 */
  @Post('import')
  @UseGuards(AdminGuard)
  importPage(@Body() dto: ImportArcadeDto) {
    return this.arcade.importFromPage(dto || {});
  }

  /** 同 IP 跨设备共享昵称：已登记则不再弹提示 */
  @Get('visitor')
  getVisitor(@Req() req: Request) {
    return this.arcade.getVisitor(clientIp(req));
  }

  @Post('visitor')
  @RateLimit(10, 60_000)
  upsertVisitor(@Body() dto: UpsertArcadeVisitorDto, @Req() req: Request) {
    return this.arcade.upsertVisitor(clientIp(req), dto);
  }

  @Get('gallery')
  gallery(
    @Query('gameId') gameId?: string,
    @Query('status') status?: string,
    @Headers('authorization') authorization?: string,
  ) {
    const admin = this.isAdmin(authorization);
    return this.arcade.listGallery(gameId, status, admin).then((items) => ({
      items: items.map(mapGallery),
    }));
  }

  @Post('gallery')
  @RateLimit(3, 10 * 60_000)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    }),
  )
  createGallery(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body()
    body: {
      gameId?: string;
      nick?: string;
      note?: string;
      kind?: string;
      clientKey?: string;
    },
    @Req() req: Request,
  ) {
    return this.arcade
      .createGallery({
        gameId: body.gameId || '',
        nick: body.nick || '',
        note: body.note || '',
        kind: body.kind,
        clientKey: body.clientKey,
        file,
        ip: clientIp(req),
        ua: String(req.headers['user-agent'] || ''),
      })
      .then((item) => ({
        ...mapGallery(item),
        message: '已提交，审核通过后显示在画廊',
      }));
  }

  @Patch('gallery/:id/status')
  @UseGuards(AdminGuard)
  updateGallery(
    @Param('id') id: string,
    @Body() dto: UpdateArcadeGalleryStatusDto,
  ) {
    return this.arcade.updateGalleryStatus(id, dto).then(mapGallery);
  }

  @Delete('gallery/:id')
  @UseGuards(AdminGuard)
  removeGallery(@Param('id') id: string) {
    return this.arcade.removeGallery(id);
  }

  @Get('ratings')
  ratings(
    @Query('gameId') gameId = '',
    @Query('clientKey') clientKey?: string,
  ) {
    return this.arcade.ratingSummary(gameId, clientKey);
  }

  @Post('ratings')
  @RateLimit(20, 60_000)
  submitRating(@Body() dto: SubmitArcadeRatingDto) {
    return this.arcade.submitRating(dto);
  }

  @Get('leaderboard')
  leaderboard(
    @Query('gameId') gameId = '',
    @Query('limit') limit?: string,
  ) {
    return this.arcade
      .listLeaderboard(gameId, Number(limit) || 20)
      .then((items) => ({ items: items.map(mapScore) }));
  }

  @Post('scores')
  @RateLimit(30, 60_000)
  submitScore(@Body() dto: SubmitArcadeScoreDto) {
    return this.arcade.submitScore(dto).then((item) => ({
      id: item.id,
      playMs: item.playMs,
      sessions: item.sessions,
      badges: item.badges,
      nick: item.nick,
    }));
  }

  @Get('scores')
  @UseGuards(AdminGuard)
  scoresAdmin(@Query('gameId') gameId?: string) {
    return this.arcade.listScoresAdmin(gameId).then((items) => ({
      items: items.map(mapScore),
    }));
  }

  @Patch('scores/:id')
  @UseGuards(AdminGuard)
  updateScore(@Param('id') id: string, @Body() dto: UpdateArcadeScoreAdminDto) {
    return this.arcade.updateScoreAdmin(id, dto).then(mapScore);
  }

  @Delete('scores/:id')
  @UseGuards(AdminGuard)
  removeScore(@Param('id') id: string) {
    return this.arcade.removeScore(id);
  }
}
