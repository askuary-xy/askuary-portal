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
import { RateLimit } from '../common/rate-limit.guard';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentStatusDto } from './dto';

function mapComment(item: {
  id: string;
  path: string;
  author: string;
  content: string;
  website: string | null;
  status: string;
  createdAt: Date;
}) {
  return {
    id: item.id,
    path: item.path,
    author: item.author,
    content: item.content,
    website: item.website ?? undefined,
    status: item.status,
    date: item.createdAt.toISOString().slice(0, 10),
  };
}

@Controller('api/comments')
export class CommentsController {
  constructor(
    private readonly comments: CommentsService,
    private readonly config: ConfigService,
  ) {}

  private isAdmin(authHeader?: string): boolean {
    return verifyAdminCredential(this.config, authHeader);
  }

  @Get()
  list(
    @Query('path') path = '/friends/',
    @Query('status') status?: string,
    @Headers('authorization') authorization?: string,
  ) {
    const admin = this.isAdmin(authorization);
    return this.comments.list(path, status, admin).then((items) => ({
      items: items.map(mapComment),
    }));
  }

  @Post()
  @RateLimit(5, 60_000)
  create(@Body() dto: CreateCommentDto) {
    return this.comments.create(dto).then((item) => ({
      ...mapComment(item),
      message: '留言已提交，通过审核后显示',
    }));
  }

  @Patch(':id/status')
  @UseGuards(AdminGuard)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateCommentStatusDto) {
    return this.comments.updateStatus(id, dto).then(mapComment);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id') id: string) {
    return this.comments.remove(id);
  }
}
