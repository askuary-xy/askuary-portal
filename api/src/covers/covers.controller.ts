import { Controller, Get, NotFoundException, Param, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { CoversService } from './covers.service';

@Controller('api/covers')
export class CoversController {
  constructor(private readonly covers: CoversService) {}

  /** 查看各分类图库概况（含实际读取的图库根目录） */
  @Get()
  list() {
    return this.covers.inventory();
  }

  /** 每次真正随机一张 */
  @Get(':kind/random')
  random(
    @Param('kind') kind: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.streamCover(res, kind, undefined, true, 'no-store');
  }

  /**
   * 按 seed 稳定挑一张（新路径，避开旧 404 被 max-age=86400 缓存）
   * 推荐：/api/covers/{kind}/img?seed=
   */
  @Get(':kind/img')
  bySeedImg(
    @Param('kind') kind: string,
    @Query('seed') seed: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.streamCover(res, kind, seed, false, 'public, max-age=3600, must-revalidate');
  }

  /** 兼容旧路径；成功才缓存，失败强制 no-store */
  @Get(':kind')
  bySeed(
    @Param('kind') kind: string,
    @Query('seed') seed: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.streamCover(res, kind, seed, false, 'public, max-age=3600, must-revalidate');
  }

  private streamCover(
    res: Response,
    kind: string,
    seed: string | undefined,
    random: boolean,
    cacheControl: string,
  ) {
    try {
      const picked = this.covers.pickFile(kind, seed, random);
      res.setHeader('Content-Type', this.covers.mimeFor(picked.file));
      res.setHeader('X-Cover-File', encodeURIComponent(picked.file));
      res.setHeader('X-Cover-Kind', picked.kind);
      res.setHeader('Cache-Control', cacheControl);
      return new StreamableFile(createReadStream(picked.absPath));
    } catch (err) {
      // 绝不能给 404 打上长缓存，否则换图后浏览器/CDN 会卡一整天空白
      res.setHeader('Cache-Control', 'no-store');
      if (err instanceof NotFoundException) throw err;
      throw new NotFoundException(String((err as Error)?.message || err));
    }
  }
}
