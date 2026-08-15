import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // 反代后正确识别 IP（限流 / 审计）
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.getInstance().set('trust proxy', 1);

  app.use(
    helmet({
      // 后台页有大量内联脚本；静态站 CSP 交给 Nginx
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  const origins = (config.get<string>('CORS_ORIGINS') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const isProd = (config.get<string>('NODE_ENV') || '').toLowerCase() === 'production';
  // 生产必须显式配置；开发未配置时放行本机
  if (!origins.length && isProd) {
    // eslint-disable-next-line no-console
    console.warn(
      '[security] CORS_ORIGINS is empty in production — cross-origin requests will be rejected',
    );
  }

  app.enableCors({
    origin: origins.length
      ? origins
      : isProd
        ? false
        : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = Number(config.get('PORT') || 8787);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`askuary-api listening on :${port}`);
}

bootstrap();
