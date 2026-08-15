import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsString, MinLength } from 'class-validator';
import type { Request } from 'express';
import { AdminGuard } from '../common/admin.guard';
import { clientIp, writeAudit } from '../common/audit';
import { readAudit } from '../common/audit';
import { RateLimit } from '../common/rate-limit.guard';
import { issueAdminSession, safeEqualText } from '../common/session';
import { PrismaService } from '../prisma/prisma.service';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

class AdminLoginDto {
  @IsString()
  @MinLength(1)
  password!: string;
}

@Controller('api/admin')
export class AdminController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** 探测会话票是否仍有效（后台自动登录用） */
  @Get('session')
  @UseGuards(AdminGuard)
  session() {
    return { ok: true };
  }

  @Get('dashboard')
  @UseGuards(AdminGuard)
  async dashboard() {
    const [
      content, drafts, comments, pendingComments, friends, pendingFriends,
      photos, library, portal,
    ] = await Promise.all([
      this.prisma.contentPost.count(),
      this.prisma.contentPost.count({ where:{ status:'draft' } }),
      this.prisma.comment.count(),
      this.prisma.comment.count({ where:{ status:'pending' } }),
      this.prisma.friendApplication.count(),
      this.prisma.friendApplication.count({ where:{ status:'pending' } }),
      this.prisma.photoAsset.count({ where:{ hidden:false } }),
      this.prisma.libraryItem.count(),
      this.prisma.portalConfig.count(),
    ]);
    const media = await this.directorySummary(join(process.cwd(),'data','media-uploads'));
    return {
      generatedAt: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      counts: { content, drafts, comments, pendingComments, friends, pendingFriends, photos, library, portal },
      media,
      audit: readAudit(12),
    };
  }

  @Post('login')
  @RateLimit(5, 15 * 60_000)
  async login(@Body() dto: AdminLoginDto, @Req() req: Request) {
    const ip = clientIp(req);
    const expected = this.config.get<string>('ADMIN_TOKEN') || '';
    const ok = Boolean(expected) && safeEqualText(dto.password, expected);

    if (!ok) {
      writeAudit({ action: 'admin.login', ok: false, ip });
      // 轻微延迟，抬高爆破成本
      await new Promise((r) => setTimeout(r, 350 + Math.floor(Math.random() * 250)));
      throw new UnauthorizedException('密码错误');
    }

    const hours = Number(this.config.get('ADMIN_SESSION_HOURS') || 12);
    const session = issueAdminSession(expected, Number.isFinite(hours) ? hours : 12);
    writeAudit({ action: 'admin.login', ok: true, ip });
    return {
      ok: true,
      token: session.token,
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  private async directorySummary(path: string) {
    try {
      const names = await readdir(path);
      const stats = await Promise.all(names.map((name)=>stat(join(path,name))));
      return { files:stats.filter(item=>item.isFile()).length, bytes:stats.reduce((sum,item)=>sum+(item.isFile()?item.size:0),0) };
    } catch {
      return { files:0, bytes:0 };
    }
  }
}
