import { Controller, Delete, Get, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { AdminGuard } from '../common/admin.guard';
import { MediaService } from './media.service';

@Controller('api/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  @UseGuards(AdminGuard)
  async list() {
    return { items: await this.media.list() };
  }

  @Post()
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  }))
  upload(@UploadedFile() file?: Express.Multer.File) {
    return this.media.save(file);
  }

  @Get('file/:name')
  file(@Param('name') name: string, @Res() res: Response) {
    const file = this.media.resolve(name);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    file.stream.pipe(res);
  }

  @Delete(':name')
  @UseGuards(AdminGuard)
  remove(@Param('name') name: string) {
    return this.media.remove(name);
  }
}
