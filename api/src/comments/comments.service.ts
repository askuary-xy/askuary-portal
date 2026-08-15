import { CommentStatus } from '@prisma/client';
import { Injectable, NotFoundException } from '@nestjs/common';
import { sanitizeMultiline, sanitizeText } from '../common/sanitize';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto, UpdateCommentStatusDto } from './dto';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(path: string, status?: string, admin = false) {
    const normalized = path?.trim();
    const where: { path?: string; status?: CommentStatus } = {};

    // admin 传 path=* 或空字符串时可看全部路径
    if (!(admin && (normalized === '*' || normalized === '' || normalized === 'all'))) {
      where.path = normalized || '/friends/';
    }

    if (admin) {
      if (status && ['pending', 'published'].includes(status)) {
        where.status = status as CommentStatus;
      }
    } else {
      where.status = CommentStatus.published;
    }

    return this.prisma.comment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  create(dto: CreateCommentDto) {
    return this.prisma.comment.create({
      data: {
        path: sanitizeText(dto.path, 200),
        author: sanitizeText(dto.author, 32),
        email: dto.email?.trim() || null,
        website: dto.website?.trim() || null,
        content: sanitizeMultiline(dto.content, 500),
        status: CommentStatus.pending,
      },
    });
  }

  async updateStatus(id: string, dto: UpdateCommentStatusDto) {
    const existing = await this.prisma.comment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Comment not found');
    return this.prisma.comment.update({
      where: { id },
      data: { status: dto.status as CommentStatus },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.comment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Comment not found');
    await this.prisma.comment.delete({ where: { id } });
    return { ok: true };
  }
}
