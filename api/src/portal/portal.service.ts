import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const PORTAL_KEYS = [
  'spots',
  'meteor-words',
  'nav-stars',
  'bg-quotes',
  'site-widgets',
  'notices',
] as const;
export type PortalKey = (typeof PORTAL_KEYS)[number];

function isPortalKey(key: string): key is PortalKey {
  return (PORTAL_KEYS as readonly string[]).includes(key);
}

@Injectable()
export class PortalService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.portalConfig.findMany({
      orderBy: { key: 'asc' },
    });
    const byKey = Object.fromEntries(
      rows.map((r) => [r.key, this.parseJson(r.json)]),
    );
    return {
      keys: [...PORTAL_KEYS],
      updatedAt: Object.fromEntries(
        rows.map((r) => [r.key, r.updatedAt.toISOString()]),
      ),
      spots: byKey['spots'] ?? null,
      'meteor-words': byKey['meteor-words'] ?? null,
      'nav-stars': byKey['nav-stars'] ?? null,
      'bg-quotes': byKey['bg-quotes'] ?? null,
      'site-widgets': byKey['site-widgets'] ?? null,
      notices: byKey['notices'] ?? null,
    };
  }

  async get(key: string) {
    if (!isPortalKey(key)) {
      throw new NotFoundException(`Unknown portal key: ${key}`);
    }
    const row = await this.prisma.portalConfig.findUnique({ where: { key } });
    if (!row) {
      return { key, items: null, updatedAt: null };
    }
    return {
      key,
      items: this.parseJson(row.json),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async put(key: string, items: unknown[]) {
    if (!isPortalKey(key)) {
      throw new NotFoundException(`Unknown portal key: ${key}`);
    }
    if (!Array.isArray(items)) {
      throw new BadRequestException('items must be an array');
    }
    this.validateItems(key, items);
    const json = JSON.stringify(items);
    const row = await this.prisma.portalConfig.upsert({
      where: { key },
      create: { key, json },
      update: { json },
    });
    return {
      key,
      items: this.parseJson(row.json),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async remove(key: string) {
    if (!isPortalKey(key)) {
      throw new NotFoundException(`Unknown portal key: ${key}`);
    }
    await this.prisma.portalConfig.deleteMany({ where: { key } });
    return { ok: true, key };
  }

  private parseJson(raw: string): unknown[] {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }

  private validateItems(key: PortalKey, items: unknown[]) {
    if (key === 'spots') {
      for (const [i, item] of items.entries()) {
        if (!item || typeof item !== 'object') {
          throw new BadRequestException(`spots[${i}] invalid`);
        }
        const o = item as Record<string, unknown>;
        if (typeof o.lat !== 'number' || typeof o.lng !== 'number') {
          throw new BadRequestException(`spots[${i}] needs lat/lng numbers`);
        }
        if (typeof o.title !== 'string' || typeof o.text !== 'string') {
          throw new BadRequestException(`spots[${i}] needs title/text`);
        }
        if (typeof o.style !== 'string') {
          throw new BadRequestException(`spots[${i}] needs style`);
        }
      }
      return;
    }
    if (key === 'meteor-words') {
      for (const [i, item] of items.entries()) {
        if (!item || typeof item !== 'object') {
          throw new BadRequestException(`meteor-words[${i}] invalid`);
        }
        const o = item as Record<string, unknown>;
        if (typeof o.text !== 'string' || !o.text.trim()) {
          throw new BadRequestException(`meteor-words[${i}] needs text`);
        }
      }
      return;
    }
    if (key === 'nav-stars') {
      for (const [i, item] of items.entries()) {
        if (!item || typeof item !== 'object') {
          throw new BadRequestException(`nav-stars[${i}] invalid`);
        }
        const o = item as Record<string, unknown>;
        if (typeof o.id !== 'string' || !o.id.trim()) {
          throw new BadRequestException(`nav-stars[${i}] needs id`);
        }
        if (typeof o.label !== 'string' || !o.label.trim()) {
          throw new BadRequestException(`nav-stars[${i}] needs label`);
        }
        if (typeof o.url !== 'string') {
          throw new BadRequestException(`nav-stars[${i}] needs url`);
        }
      }
      return;
    }
    if (key === 'bg-quotes') {
      for (const [i, item] of items.entries()) {
        if (typeof item === 'string') {
          if (!item.trim()) {
            throw new BadRequestException(`bg-quotes[${i}] empty`);
          }
          continue;
        }
        if (!item || typeof item !== 'object') {
          throw new BadRequestException(`bg-quotes[${i}] invalid`);
        }
        const o = item as Record<string, unknown>;
        if (typeof o.text !== 'string' || !o.text.trim()) {
          throw new BadRequestException(`bg-quotes[${i}] needs text`);
        }
      }
      return;
    }
    if (key === 'site-widgets') {
      if (items.length !== 1 || !items[0] || typeof items[0] !== 'object') {
        throw new BadRequestException(
          'site-widgets needs a single config object in items[0]',
        );
      }
      return;
    }
    if (key === 'notices') {
      for (const [i, item] of items.entries()) {
        if (!item || typeof item !== 'object') {
          throw new BadRequestException(`notices[${i}] invalid`);
        }
        const o = item as Record<string, unknown>;
        if (typeof o.title !== 'string' || !o.title.trim()) {
          throw new BadRequestException(`notices[${i}] needs title`);
        }
        if (o.body != null && typeof o.body !== 'string') {
          throw new BadRequestException(`notices[${i}] body must be string`);
        }
        if (o.tag != null && typeof o.tag !== 'string') {
          throw new BadRequestException(`notices[${i}] tag must be string`);
        }
        if (o.date != null && typeof o.date !== 'string') {
          throw new BadRequestException(`notices[${i}] date must be string`);
        }
        if (o.url != null && typeof o.url !== 'string') {
          throw new BadRequestException(`notices[${i}] url must be string`);
        }
      }
    }
  }
}
