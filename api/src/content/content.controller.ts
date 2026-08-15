import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminGuard } from '../common/admin.guard';
import { verifyAdminCredential } from '../common/admin-auth';
import { ContentService } from './content.service';
import {
  CreateContentDto,
  ImportContentDto,
  PreviewMarkdownDto,
  UpdateContentDto,
} from './dto';

@Controller('api/content')
export class ContentController {
  constructor(
    private readonly content: ContentService,
    private readonly config: ConfigService,
  ) {}

  private isAdmin(authHeader?: string): boolean {
    return verifyAdminCredential(this.config, authHeader);
  }

  @Get()
  list(
    @Query('kind') kind?: string,
    @Query('status') status?: string,
    @Headers('authorization') authorization?: string,
  ) {
    const admin = this.isAdmin(authorization);
    return this.content.list(kind, status, admin).then((items) => ({ items }));
  }

  /** 草稿 + 删除墓碑 slug，前台用来剔除静态稿（须在 :kind/:slug 之前） */
  @Get('suppressed')
  listSuppressed(@Query('kind') kind?: string) {
    return this.content.listSuppressed(kind);
  }

  /** 后台预览：短代码 + Markdown 与发布一致 */
  @Post('preview')
  @UseGuards(AdminGuard)
  preview(@Body() dto: PreviewMarkdownDto) {
    return { html: this.content.renderMarkdown(dto.markdown || '') };
  }

  @Get(':kind/:slug')
  getOne(
    @Param('kind') kind: string,
    @Param('slug') slug: string,
    @Headers('authorization') authorization?: string,
  ) {
    const admin = this.isAdmin(authorization);
    return this.content.getByKindSlug(kind, slug, admin);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateContentDto) {
    return this.content.create(dto);
  }

  /** 一键导入静态文章 / 碎念 / 宇宙博客 */
  @Post('import')
  @UseGuards(AdminGuard)
  importBatch(@Body() dto: ImportContentDto) {
    return this.content.importBatch(dto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateContentDto) {
    return this.content.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id') id: string) {
    return this.content.remove(id);
  }
}
