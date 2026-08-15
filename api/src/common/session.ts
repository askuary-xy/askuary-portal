import { createHmac, timingSafeEqual } from 'node:crypto';

const SESSION_PREFIX = 'ask';

function b64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromB64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64');
}

/** 恒定时间字符串比较（先哈希再比对，避免长度泄漏） */
export function safeEqualText(a: string, b: string): boolean {
  const ha = createHmac('sha256', 'askuary-safe-cmp').update(String(a || '')).digest();
  const hb = createHmac('sha256', 'askuary-safe-cmp').update(String(b || '')).digest();
  return timingSafeEqual(ha, hb);
}

export function issueAdminSession(
  adminToken: string,
  hours = 12,
): { token: string; expiresAt: number } {
  const exp = Date.now() + Math.max(1, hours) * 3600_000;
  const payload = b64url(JSON.stringify({ v: 1, exp }));
  const sig = b64url(createHmac('sha256', adminToken).update(payload).digest());
  return { token: `${SESSION_PREFIX}.${payload}.${sig}`, expiresAt: exp };
}

export function verifyAdminSession(token: string, adminToken: string): boolean {
  if (!token || !adminToken) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== SESSION_PREFIX) return false;
  const payload = parts[1];
  const sig = parts[2];
  const expected = b64url(createHmac('sha256', adminToken).update(payload).digest());
  if (!safeEqualText(sig, expected)) return false;
  try {
    const data = JSON.parse(fromB64url(payload).toString('utf8')) as { exp?: number };
    return typeof data.exp === 'number' && data.exp > Date.now();
  } catch {
    return false;
  }
}

export function isSessionToken(token: string): boolean {
  return String(token || '').startsWith(`${SESSION_PREFIX}.`);
}
