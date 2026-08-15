import fs from 'node:fs';
import path from 'node:path';

export type AuditEvent = {
  at: string;
  action: string;
  ok: boolean;
  ip?: string;
  detail?: string;
};

function auditPath(): string {
  const fromEnv = process.env.AUDIT_LOG_PATH?.trim();
  if (fromEnv) return fromEnv;
  // 与 SQLite 同目录：api/data/audit.log
  return path.resolve(process.cwd(), 'data', 'audit.log');
}

export function readAudit(limit = 20): AuditEvent[] {
  try {
    const file = auditPath();
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).slice(-Math.max(1, Math.min(limit, 100)))
      .reverse().map((line) => JSON.parse(line) as AuditEvent);
  } catch {
    return [];
  }
}

export function writeAudit(event: Omit<AuditEvent, 'at'> & { at?: string }): void {
  try {
    const file = auditPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const row: AuditEvent = {
      at: event.at || new Date().toISOString(),
      action: event.action,
      ok: event.ok,
      ...(event.ip ? { ip: event.ip } : {}),
      ...(event.detail ? { detail: String(event.detail).slice(0, 500) } : {}),
    };
    fs.appendFileSync(file, `${JSON.stringify(row)}\n`, 'utf8');
  } catch {
    // 审计失败不阻断主流程
  }
}

export function clientIp(req: {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(',')[0]?.trim();
  return forwardedIp || req.ip || req.socket?.remoteAddress || 'unknown';
}
