import { ConfigService } from '@nestjs/config';
import { isSessionToken, safeEqualText, verifyAdminSession } from './session';

export function extractBearer(authHeader?: string): string {
  const header = authHeader || '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
}

export function verifyAdminCredential(
  config: ConfigService,
  authHeader?: string,
): boolean {
  const token = extractBearer(authHeader);
  const expected = config.get<string>('ADMIN_TOKEN') || '';
  if (!expected || !token) return false;

  if (isSessionToken(token)) {
    return verifyAdminSession(token, expected);
  }

  const allowRaw = (config.get<string>('ALLOW_RAW_ADMIN_TOKEN') || '1') !== '0';
  return allowRaw && safeEqualText(token, expected);
}
