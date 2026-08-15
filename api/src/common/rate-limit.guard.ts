import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { clientIp } from './audit';

export type RateLimitOptions = { limit: number; windowMs: number };

export const RATE_LIMIT_KEY = 'askuary_rate_limit';

/** 路由级限流：@RateLimit(5, 15 * 60_000) */
export const RateLimit = (limit: number, windowMs: number) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowMs } satisfies RateLimitOptions);

type Bucket = { count: number; resetAt: number };

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const opts = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    // 未标注 @RateLimit 的路由不限流（全局 Guard 安全）
    if (!opts) return true;

    const req = context.switchToHttp().getRequest<{
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
      socket?: { remoteAddress?: string };
      method?: string;
      url?: string;
      route?: { path?: string };
    }>();

    const ip = clientIp(req);
    const routeKey = `${req.method || 'GET'}:${req.route?.path || req.url || ''}`;
    const key = `${ip}|${routeKey}|${opts.limit}|${opts.windowMs}`;
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      return true;
    }

    bucket.count += 1;
    if (bucket.count > opts.limit) {
      throw new HttpException(
        'Too many requests, try later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
