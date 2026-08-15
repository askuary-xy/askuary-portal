import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../common/admin.guard';
import {
  SyncPhotosDto,
  CreatePhotoAlbumDto,
  UpdatePhotoAlbumDto,
  UpdatePhotoAssetDto,
} from './dto';
import { PhotosService } from './photos.service';

@Controller('api/photos')
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Get()
  list() {
    return this.photos.list();
  }

  /** photoId 可能含 `/`，用 query 传递 */
  @Get('item')
  getOne(@Query('id') id: string) {
    return this.photos.getOne(id || '');
  }

  @Post('sync')
  @UseGuards(AdminGuard)
  sync(@Body() dto: SyncPhotosDto) {
    return this.photos.sync(dto || {});
  }

  @Post('albums')
  @UseGuards(AdminGuard)
  createAlbum(@Body() dto: CreatePhotoAlbumDto) {
    return this.photos.createAlbum(dto);
  }

  @Patch('albums/:key')
  @UseGuards(AdminGuard)
  updateAlbum(@Param('key') key: string, @Body() dto: UpdatePhotoAlbumDto) {
    return this.photos.updateAlbum(key, dto);
  }

  @Patch('item')
  @UseGuards(AdminGuard)
  updatePhoto(@Query('id') id: string, @Body() dto: UpdatePhotoAssetDto) {
    return this.photos.updatePhoto(id || '', dto);
  }

  @Delete('item')
  @UseGuards(AdminGuard)
  remove(@Query('id') id: string) {
    return this.photos.removePhoto(id || '');
  }
}
