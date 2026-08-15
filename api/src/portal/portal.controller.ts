import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../common/admin.guard';
import { PutPortalConfigDto } from './dto';
import { PortalService } from './portal.service';

@Controller('api/portal')
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Get()
  list() {
    return this.portal.list();
  }

  @Get(':key')
  get(@Param('key') key: string) {
    return this.portal.get(key);
  }

  @Put(':key')
  @UseGuards(AdminGuard)
  put(@Param('key') key: string, @Body() dto: PutPortalConfigDto) {
    return this.portal.put(key, dto.items);
  }

  @Delete(':key')
  @UseGuards(AdminGuard)
  remove(@Param('key') key: string) {
    return this.portal.remove(key);
  }
}
