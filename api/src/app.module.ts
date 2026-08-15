import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { AdminController } from './admin/admin.controller';
import { CommentsModule } from './comments/comments.module';
import { ContentModule } from './content/content.module';
import { CoversModule } from './covers/covers.module';
import { FriendsModule } from './friends/friends.module';
import { PhotosModule } from './photos/photos.module';
import { LibraryModule } from './library/library.module';
import { PortalModule } from './portal/portal.module';
import { ArcadeModule } from './arcade/arcade.module';
import { MediaModule } from './media/media.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuditInterceptor } from './common/audit.interceptor';
import { RateLimitGuard } from './common/rate-limit.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/admin',
    }),
    PrismaModule,
    FriendsModule,
    CommentsModule,
    ContentModule,
    CoversModule,
    PhotosModule,
    LibraryModule,
    PortalModule,
    ArcadeModule,
    MediaModule,
  ],
  controllers: [HealthController, AdminController],
  providers: [
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
