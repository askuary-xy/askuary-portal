import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import {
  SyncPhotosDto,
  UpdatePhotoAlbumDto,
  UpdatePhotoAssetDto,
} from './dto';

type Story = Record<string, unknown> | null;

function parseStory(raw: string | null | undefined): Story {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object') return null;
    return v as Record<string, unknown>;
  } catch {
    return null;
  }
}

function encodeStory(story: unknown): string {
  if (story == null) return '{}';
  return JSON.stringify(story);
}

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private indexPath(): string {
    const fromEnv = this.config.get<string>('PHOTOWALL_INDEX_PATH');
    if (fromEnv) return fromEnv;
    // 默认：仓库 public/data（开发）或与 api 同级的站点 dist/public
    const candidates = [
      join(process.cwd(), '..', 'public', 'data', 'photowall-index.json'),
      join(process.cwd(), 'public', 'data', 'photowall-index.json'),
      join(process.cwd(), '..', 'dist', 'data', 'photowall-index.json'),
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
    return candidates[0];
  }

  private mapAlbum(item: {
    key: string;
    label: string;
    description: string;
    theme: string;
    cover: string;
    date: string;
    storyJson: string;
    _count?: { photos: number };
  }) {
    return {
      key: item.key,
      label: item.label,
      description: item.description || undefined,
      theme: item.theme || 'ocean',
      cover: item.cover,
      date: item.date || undefined,
      count: item._count?.photos ?? 0,
      latestDate: item.date || undefined,
      story: parseStory(item.storyJson),
    };
  }

  private mapPhoto(item: {
    photoId: string;
    albumKey: string;
    file: string;
    title: string;
    date: string;
    time: string;
    location: string;
    category: string;
    note: string;
    device: string;
    lat: number | null;
    lng: number | null;
    src: string;
    thumb: string;
    sortTs: number;
    storyJson: string;
    hidden?: boolean;
  }) {
    return {
      id: item.photoId,
      file: item.file,
      src: item.src,
      thumb: item.thumb,
      album: item.albumKey,
      date: item.date,
      time: item.time || undefined,
      location: item.location,
      category: item.category,
      note: item.note,
      title: item.title,
      device: item.device || undefined,
      lat: item.lat ?? undefined,
      lng: item.lng ?? undefined,
      sortTs: item.sortTs,
      story: parseStory(item.storyJson),
      hidden: Boolean(item.hidden),
    };
  }

  async list() {
    const [albums, photos] = await Promise.all([
      this.prisma.photoAlbum.findMany({
        orderBy: [{ date: 'desc' }, { key: 'asc' }],
        include: { _count: { select: { photos: true } } },
      }),
      this.prisma.photoAsset.findMany({
        orderBy: [{ sortTs: 'desc' }, { photoId: 'asc' }],
      }),
    ]);
    const visible = photos.filter((p) => !p.hidden);
    const suppressedIds = photos.filter((p) => p.hidden).map((p) => p.photoId);
    return {
      albums: albums.map((a) => this.mapAlbum(a)),
      photos: visible.map((p) => this.mapPhoto(p)),
      suppressedIds,
    };
  }

  async getOne(photoId: string) {
    const decoded = decodeURIComponent(photoId || '').trim();
    if (!decoded) throw new BadRequestException('缺少 id');
    const item = await this.prisma.photoAsset.findUnique({
      where: { photoId: decoded },
    });
    if (!item) throw new NotFoundException('照片不存在');
    if (item.hidden) throw new NotFoundException('照片不存在');
    return this.mapPhoto(item);
  }

  async sync(dto: SyncPhotosDto) {
    let index = dto.index as
      | {
          albums?: Array<Record<string, unknown>>;
          photos?: Array<Record<string, unknown>>;
        }
      | undefined;

    if (!index) {
      const path = this.indexPath();
      if (!existsSync(path)) {
        throw new NotFoundException(
          `未找到 photowall-index.json（尝试：${path}）。请先在本机 npm run build 并部署 dist/，或在后台同步时由页面提交索引。API 容器读不到 content/photowall。`,
        );
      }
      index = JSON.parse(readFileSync(path, 'utf8')) as typeof index;
    }

    const albums = Array.isArray(index?.albums) ? index!.albums! : [];
    const photos = Array.isArray(index?.photos) ? index!.photos! : [];

    if (!albums.length && !photos.length) {
      throw new BadRequestException(
        '索引里没有相册/照片。请确认已 npm run build，且 dist/data/photowall-index.json 有内容。',
      );
    }

    let albumUpserts = 0;
    let photoUpserts = 0;

    for (const raw of albums) {
      const key = String(raw.key || '').trim();
      if (!key) continue;
      const story = raw.story ?? {};
      const existing = await this.prisma.photoAlbum.findUnique({ where: { key } });
      if (!existing) {
        await this.prisma.photoAlbum.create({
          data: {
            key,
            label: String(raw.label || key),
            description: String(raw.description || ''),
            theme: String(raw.theme || 'ocean'),
            cover: String(raw.cover || ''),
            date: String(raw.latestDate || raw.date || ''),
            storyJson: encodeStory(story),
          },
        });
      } else {
        await this.prisma.photoAlbum.update({
          where: { key },
          data: {
            label: existing.label || String(raw.label || key),
            description: existing.description || String(raw.description || ''),
            theme: existing.theme || String(raw.theme || 'ocean'),
            // 路径可能因重命名变化，始终用索引封面
            cover: String(raw.cover || existing.cover || ''),
            date: existing.date || String(raw.latestDate || raw.date || ''),
            storyJson:
              existing.storyJson && existing.storyJson !== '{}'
                ? existing.storyJson
                : encodeStory(story),
          },
        });
      }
      albumUpserts += 1;
    }

    // 确保相册先存在（照片可能引用未列在 albums 的 key）
    const albumKeys = new Set(albums.map((a) => String(a.key || '').trim()).filter(Boolean));
    for (const raw of photos) {
      const albumKey = String(raw.album || '未分类').trim() || '未分类';
      if (!albumKeys.has(albumKey)) {
        await this.prisma.photoAlbum.upsert({
          where: { key: albumKey },
          create: {
            key: albumKey,
            label: albumKey,
            description: '',
            theme: 'ocean',
            cover: String(raw.thumb || ''),
            date: String(raw.date || ''),
            storyJson: '{}',
          },
          update: {},
        });
        albumKeys.add(albumKey);
      }
    }

    for (const raw of photos) {
      const photoId = String(raw.id || '').trim();
      if (!photoId) continue;
      const albumKey = String(raw.album || '未分类').trim() || '未分类';
      const story = raw.story ?? null;
      const existing = await this.prisma.photoAsset.findUnique({
        where: { photoId },
      });

      const base = {
        albumKey,
        file: String(raw.file || ''),
        src: String(raw.src || ''),
        thumb: String(raw.thumb || ''),
        sortTs: Number(raw.sortTs) || 0,
      };

      if (!existing) {
        await this.prisma.photoAsset.create({
          data: {
            photoId,
            ...base,
            title: String(raw.title || ''),
            date: String(raw.date || ''),
            time: String(raw.time || ''),
            location: String(raw.location || ''),
            category: String(raw.category || ''),
            note: String(raw.note || ''),
            device: String(raw.device || ''),
            lat: typeof raw.lat === 'number' ? raw.lat : null,
            lng: typeof raw.lng === 'number' ? raw.lng : null,
            storyJson: encodeStory(story),
            hidden: false,
          },
        });
      } else {
        // 保留人工编辑的元数据 / 相册归属；已删除(hidden)的不同步复活
        await this.prisma.photoAsset.update({
          where: { photoId },
          data: {
            file: base.file,
            src: base.src,
            thumb: base.thumb,
            sortTs: base.sortTs,
            albumKey: existing.albumKey || base.albumKey,
            title: existing.title || String(raw.title || ''),
            date: existing.date || String(raw.date || ''),
            time: existing.time || String(raw.time || ''),
            location: existing.location || String(raw.location || ''),
            category: existing.category || String(raw.category || ''),
            note: existing.note || String(raw.note || ''),
            device: existing.device || String(raw.device || ''),
            lat: existing.lat ?? (typeof raw.lat === 'number' ? raw.lat : null),
            lng: existing.lng ?? (typeof raw.lng === 'number' ? raw.lng : null),
            storyJson:
              existing.storyJson && existing.storyJson !== '{}'
                ? existing.storyJson
                : encodeStory(story),
            hidden: existing.hidden,
          },
        });
      }
      photoUpserts += 1;
    }

    let prunedPhotos = 0;
    let prunedAlbums = 0;
    const shouldPrune = dto.prune !== false;
    if (shouldPrune) {
      const keepPhotoIds = [
        ...new Set(
          photos
            .map((raw) => String(raw.id || '').trim())
            .filter(Boolean),
        ),
      ];
      const keepAlbumKeys = [
        ...new Set(
          [
            ...albums.map((raw) => String(raw.key || '').trim()),
            ...photos.map((raw) => String(raw.album || '未分类').trim() || '未分类'),
          ].filter(Boolean),
        ),
      ];

      if (keepPhotoIds.length) {
        const delPhotos = await this.prisma.photoAsset.deleteMany({
          where: { photoId: { notIn: keepPhotoIds } },
        });
        prunedPhotos = delPhotos.count;
      } else {
        const delPhotos = await this.prisma.photoAsset.deleteMany({});
        prunedPhotos = delPhotos.count;
      }

      if (keepAlbumKeys.length) {
        const delAlbums = await this.prisma.photoAlbum.deleteMany({
          where: { key: { notIn: keepAlbumKeys } },
        });
        prunedAlbums = delAlbums.count;
      }
    }

    return {
      ok: true,
      albums: albumUpserts,
      photos: photoUpserts,
      prunedPhotos,
      prunedAlbums,
      indexPath: this.indexPath(),
    };
  }

  async createAlbum(dto: {
    key: string;
    label?: string;
    description?: string;
    date?: string;
  }) {
    const key = String(dto.key || '').trim();
    if (!key) throw new BadRequestException('相册 key 不能为空');
    const existing = await this.prisma.photoAlbum.findUnique({ where: { key } });
    if (existing) throw new BadRequestException('相册已存在');
    const created = await this.prisma.photoAlbum.create({
      data: {
        key,
        label: String(dto.label || key).trim() || key,
        description: String(dto.description || ''),
        theme: 'ocean',
        cover: '',
        date: String(dto.date || ''),
        storyJson: '{}',
      },
      include: { _count: { select: { photos: true } } },
    });
    return this.mapAlbum(created);
  }

  async updateAlbum(key: string, dto: UpdatePhotoAlbumDto) {
    const decoded = decodeURIComponent(key);
    const existing = await this.prisma.photoAlbum.findUnique({
      where: { key: decoded },
    });
    if (!existing) throw new NotFoundException('相册不存在');

    const data: Record<string, unknown> = {};
    if (dto.label != null) data.label = dto.label;
    if (dto.description != null) data.description = dto.description;
    if (dto.theme != null) data.theme = dto.theme;
    if (dto.cover != null) data.cover = dto.cover;
    if (dto.date != null) data.date = dto.date;
    if (dto.story !== undefined) data.storyJson = encodeStory(dto.story);

    const updated = await this.prisma.photoAlbum.update({
      where: { key: decoded },
      data,
      include: { _count: { select: { photos: true } } },
    });
    return this.mapAlbum(updated);
  }

  async updatePhoto(photoId: string, dto: UpdatePhotoAssetDto) {
    const decoded = decodeURIComponent(photoId);
    const existing = await this.prisma.photoAsset.findUnique({
      where: { photoId: decoded },
    });
    if (!existing) throw new NotFoundException('照片不存在');

    if (dto.albumKey && dto.albumKey !== existing.albumKey) {
      await this.prisma.photoAlbum.upsert({
        where: { key: dto.albumKey },
        create: {
          key: dto.albumKey,
          label: dto.albumKey,
          description: '',
          theme: 'ocean',
          cover: existing.thumb,
          date: dto.date || existing.date,
          storyJson: '{}',
        },
        update: {},
      });
    }

    const data: Record<string, unknown> = {};
    if (dto.title != null) data.title = dto.title;
    if (dto.date != null) data.date = dto.date;
    if (dto.time != null) data.time = dto.time;
    if (dto.location != null) data.location = dto.location;
    if (dto.category != null) data.category = dto.category;
    if (dto.note != null) data.note = dto.note;
    if (dto.device != null) data.device = dto.device;
    if (dto.lat !== undefined) data.lat = dto.lat;
    if (dto.lng !== undefined) data.lng = dto.lng;
    if (dto.albumKey != null) data.albumKey = dto.albumKey;
    if (dto.story !== undefined) data.storyJson = encodeStory(dto.story);

    const updated = await this.prisma.photoAsset.update({
      where: { photoId: decoded },
      data,
    });
    return this.mapPhoto(updated);
  }

  async removePhoto(photoId: string) {
    const decoded = decodeURIComponent(photoId);
    const existing = await this.prisma.photoAsset.findUnique({
      where: { photoId: decoded },
    });
    if (!existing) throw new NotFoundException('照片不存在');
    // 软删：前台隐藏；静态索引导入不会复活
    await this.prisma.photoAsset.update({
      where: { photoId: decoded },
      data: { hidden: true },
    });
    return { ok: true, photoId: decoded };
  }
}
