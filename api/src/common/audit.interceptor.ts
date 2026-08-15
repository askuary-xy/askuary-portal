import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { clientIp, writeAudit } from './audit';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method?: string;
      url?: string;
      originalUrl?: string;
      route?: { path?: string };
      headers?: Record<string, string | string[] | undefined>;
      ip?: string;
      socket?: { remoteAddress?: string };
    }>();

    const method = String(req.method || 'GET').toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const url = String(req.originalUrl || req.url || '');
    if (url.includes('/api/admin/login')) {
      return next.handle();
    }

    const auth = req.headers?.authorization;
    const hasBearer =
      typeof auth === 'string'
        ? auth.startsWith('Bearer ')
        : Array.isArray(auth) && String(auth[0] || '').startsWith('Bearer ');
    if (!hasBearer) {
      return next.handle();
    }

    const ip = clientIp(req);
    const action = `${method} ${req.route?.path || url}`;

    return next.handle().pipe(
      tap({
        next: () => writeAudit({ action, ok: true, ip }),
        error: (err: { message?: string }) =>
          writeAudit({
            action,
            ok: false,
            ip,
            detail: err?.message || 'error',
          }),
      }),
    );
  }
}
