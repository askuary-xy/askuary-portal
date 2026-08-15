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
  CreateLibraryItemDto,
  ImportLibraryDto,
  UpdateLibraryItemDto,
} from './dto';
import { LibraryService } from './library.service';

@Controller('api/library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  list(@Query('type') type?: string, @Query('status') status?: string) {
    return this.library.list(type, status);
  }

  /** 从静态 library.json 导入（须在 :slug 之前） */
  @Post('import')
  @UseGuards(AdminGuard)
  importBatch(@Body() dto: ImportLibraryDto) {
    return this.library.importFromIndex(dto || {});
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateLibraryItemDto) {
    return this.library.create(dto);
  }

  @Get(':slug')
  getOne(@Param('slug') slug: string) {
    return this.library.getBySlug(slug);
  }

  @Patch(':slug')
  @UseGuards(AdminGuard)
  update(@Param('slug') slug: string, @Body() dto: UpdateLibraryItemDto) {
    return this.library.update(slug, dto);
  }

  @Delete(':slug')
  @UseGuards(AdminGuard)
  remove(@Param('slug') slug: string) {
    return this.library.remove(slug);
  }
}
