import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

/**
 * Prisma SQLite 的相对 file: 路径是相对 schema.prisma 所在目录解析的，
 * 不是 process.cwd()。必须统一成绝对路径，否则 Docker 里会写到
 * /app/prisma/data（镜像层），rebuild 后后台数据全部丢失。
 */
function resolveSqliteUrl(raw: string): string {
  const trimmed = String(raw || 'file:../data/askuary.db').trim();
  const withoutScheme = trimmed.startsWith('file:')
    ? trimmed.slice('file:'.length)
    : trimmed;
  const filePath = withoutScheme.replace(/^"(.*)"$/, '$1');
  const abs = isAbsolute(filePath)
    ? filePath
    : resolve(process.cwd(), 'prisma', filePath);
  return `file:${abs}`;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const url = resolveSqliteUrl(
      process.env.DATABASE_URL || 'file:../data/askuary.db',
    );
    const filePath = url.slice('file:'.length);
    mkdirSync(dirname(filePath), { recursive: true });
    process.env.DATABASE_URL = url;
    super({
      datasources: {
        db: { url },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
