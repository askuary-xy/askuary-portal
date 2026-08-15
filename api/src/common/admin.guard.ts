import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isSessionToken, safeEqualText, verifyAdminSession } from './session';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
    }>();
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : '';
    const expected = this.config.get<string>('ADMIN_TOKEN') || '';
    if (!expected || !token) {
      throw new UnauthorizedException('Invalid admin token');
    }

    if (isSessionToken(token)) {
      if (!verifyAdminSession(token, expected)) {
        throw new UnauthorizedException('Session expired or invalid');
      }
      return true;
    }

    // 默认允许主密钥 Bearer（脚本/紧急）；设 ALLOW_RAW_ADMIN_TOKEN=0 可关闭
    const allowRaw = (this.config.get<string>('ALLOW_RAW_ADMIN_TOKEN') || '1') !== '0';
    if (allowRaw && safeEqualText(token, expected)) {
      return true;
    }

    throw new UnauthorizedException('Invalid admin token');
  }
}
