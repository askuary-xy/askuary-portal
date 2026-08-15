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
import { RateLimit } from '../common/rate-limit.guard';
import {
  CreateFriendApplicationDto,
  UpdateFriendApplicationDto,
} from './dto';
import { FriendsService } from './friends.service';

function mapApp(item: {
  id: string;
  name: string;
  url: string;
  avatar: string | null;
  description: string | null;
  screenshot: string | null;
  email: string | null;
  type: string;
  status: string;
  rejectReason?: string | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt?: Date;
}) {
  return {
    id: item.id,
    name: item.name,
    url: item.url,
    avatar: item.avatar ?? undefined,
    description: item.description ?? undefined,
    screenshot: item.screenshot ?? undefined,
    email: item.email ?? undefined,
    type: item.type,
    status: item.status,
    rejectReason: item.rejectReason ?? undefined,
    reviewedAt: item.reviewedAt
      ? item.reviewedAt.toISOString().slice(0, 10)
      : undefined,
    createdAt: item.createdAt.toISOString().slice(0, 10),
    updatedAt: item.updatedAt
      ? item.updatedAt.toISOString().slice(0, 10)
      : undefined,
  };
}

@Controller('api')
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  /** 公开：已通过友链（供前台列表） */
  @Get('friends')
  published() {
    return this.friends.listPublished().then((items) => ({
      friends: items.map((item) => ({
        title: item.name,
        text: item.description || '',
        url: item.url,
        avatar: item.avatar ?? undefined,
        screenshot: item.screenshot ?? undefined,
        linkLabel: '访问友站',
      })),
    }));
  }

  @Get('friend-applications')
  list(
    @Query('status') status?: string,
    @Query('name') name?: string,
  ) {
    return this.friends.list(status, name).then((items) => ({
      applications: items.map(mapApp),
    }));
  }

  @Get('friend-applications/check-exists')
  checkExists(@Query('url') url = '') {
    return this.friends.checkExists(url);
  }

  @Get('friend-applications/:id')
  @UseGuards(AdminGuard)
  async getOne(@Param('id') id: string) {
    const item = await this.friends.getById(id);
    if (!item) return { message: 'not found' };
    return mapApp(item);
  }

  @Post('friend-applications')
  @RateLimit(3, 60_000)
  create(@Body() dto: CreateFriendApplicationDto) {
    return this.friends.create({ ...dto, status: 'pending' }).then((item) => ({
      id: item.id,
      name: item.name,
      status: item.status,
      type: item.type,
      createdAt: item.createdAt.toISOString(),
    }));
  }

  /** 管理端直接新增友联（可直接通过） */
  @Post('friend-applications/admin')
  @UseGuards(AdminGuard)
  createAdmin(@Body() dto: CreateFriendApplicationDto) {
    return this.friends
      .create({ ...dto, status: dto.status || 'approved' })
      .then(mapApp);
  }

  @Patch('friend-applications/:id')
  @UseGuards(AdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateFriendApplicationDto) {
    return this.friends.update(id, dto).then(mapApp);
  }

  @Delete('friend-applications/:id')
  @UseGuards(AdminGuard)
  remove(@Param('id') id: string) {
    return this.friends.remove(id);
  }
}
