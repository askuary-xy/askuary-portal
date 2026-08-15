import {
  ApplicationStatus,
  ApplicationType,
} from '@prisma/client';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sanitizeText } from '../common/sanitize';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFriendApplicationDto,
  UpdateFriendApplicationDto,
} from './dto';

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = '';
    let path = u.pathname.replace(/\/+$/, '');
    if (!path) path = '';
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`.replace(
      /\/$/,
      '',
    );
  } catch {
    return raw.trim().replace(/\/+$/, '');
  }
}

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  list(status?: string, name?: string) {
    const where: {
      status?: ApplicationStatus;
      name?: { contains: string };
    } = {};

    if (
      status &&
      ['pending', 'approved', 'rejected'].includes(status) &&
      status !== 'all'
    ) {
      where.status = status as ApplicationStatus;
    }
    if (name?.trim()) {
      where.name = { contains: name.trim() };
    }

    return this.prisma.friendApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  getById(id: string) {
    return this.prisma.friendApplication.findUnique({ where: { id } });
  }

  /** 公开已通过友链 */
  listPublished() {
    return this.prisma.friendApplication.findMany({
      where: { status: ApplicationStatus.approved },
      orderBy: { reviewedAt: 'desc' },
    });
  }

  async checkExists(url: string) {
    const normalized = normalizeUrl(url);
    if (!normalized) {
      throw new BadRequestException('url required');
    }
    const all = await this.prisma.friendApplication.findMany({
      where: {
        status: { in: [ApplicationStatus.pending, ApplicationStatus.approved] },
      },
      select: {
        id: true,
        name: true,
        url: true,
        status: true,
        type: true,
      },
    });
    const hit = all.find((item) => normalizeUrl(item.url) === normalized);
    return {
      exists: Boolean(hit),
      application: hit
        ? {
            id: hit.id,
            name: hit.name,
            url: hit.url,
            status: hit.status,
            type: hit.type,
          }
        : null,
      suggestType: hit ? 'update' : 'new',
    };
  }

  async create(dto: CreateFriendApplicationDto) {
    const url = normalizeUrl(dto.url);
    const check = await this.checkExists(url);
    const type = (dto.type ||
      (check.exists ? 'update' : 'new')) as ApplicationType;
    const status =
      dto.status === 'approved'
        ? ApplicationStatus.approved
        : ApplicationStatus.pending;

    return this.prisma.friendApplication.create({
      data: {
        name: sanitizeText(dto.name, 80),
        url,
        avatar: dto.avatar?.trim() || null,
        description: dto.description
          ? sanitizeText(dto.description, 200)
          : null,
        screenshot: dto.screenshot?.trim() || null,
        email: dto.email?.trim() || null,
        type,
        status,
        reviewedAt: status === ApplicationStatus.approved ? new Date() : null,
      },
    });
  }

  async update(id: string, dto: UpdateFriendApplicationDto) {
    const existing = await this.prisma.friendApplication.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Application not found');

    const data: {
      status?: ApplicationStatus;
      rejectReason?: string | null;
      reviewedAt?: Date;
      name?: string;
      url?: string;
      avatar?: string | null;
      description?: string | null;
      screenshot?: string | null;
      email?: string | null;
    } = {};

    if (dto.name != null) data.name = sanitizeText(dto.name, 80);
    if (dto.url != null) data.url = normalizeUrl(dto.url);
    if (dto.avatar !== undefined) data.avatar = dto.avatar?.trim() || null;
    if (dto.description !== undefined) {
      data.description = dto.description
        ? sanitizeText(dto.description, 200)
        : null;
    }
    if (dto.screenshot !== undefined) {
      data.screenshot = dto.screenshot?.trim() || null;
    }
    if (dto.email !== undefined) data.email = dto.email?.trim() || null;

    if (dto.status) {
      data.status = dto.status as ApplicationStatus;
      data.rejectReason =
        dto.status === 'rejected'
          ? dto.rejectReason
            ? sanitizeText(dto.rejectReason, 200)
            : null
          : null;
      data.reviewedAt = new Date();
    }

    return this.prisma.friendApplication.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.friendApplication.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Application not found');
    await this.prisma.friendApplication.delete({ where: { id } });
    return { ok: true };
  }
}
