/**
 * 同步 data/ → public/data/
 * 对 amapKey / amapSecurityJsCode：源为空时保留 public/dist 已有值，并可用 .env 注入，
 * 避免重新构建把线上/本地已填的高德密钥清空。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'data');
const outDir = path.join(root, 'public', 'data');
const distSite = path.join(root, 'dist', 'data', 'site.json');

const SECRET_FIELDS = ['amapKey', 'amapSecurityJsCode'];

function loadDotEnv() {
  for (const name of ['.env.local', '.env']) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] == null || process.env[key] === '') {
        process.env[key] = val;
      }
    }
  }
}

function readJson(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function pickSecret(...candidates) {
  for (const c of candidates) {
    const v = String(c ?? '').trim();
    if (v) return v;
  }
  return '';
}

function mergeSiteSecrets(site) {
  const prevPublic = readJson(path.join(outDir, 'site.json')) || {};
  const prevDist = readJson(distSite) || {};

  const envKey = process.env.VITE_AMAP_KEY || process.env.AMAP_KEY;
  const envCode =
    process.env.VITE_AMAP_SECURITY_JS_CODE || process.env.AMAP_SECURITY_JS_CODE;

  const next = { ...site };
  next.amapKey = pickSecret(
    envKey,
    site.amapKey,
    prevPublic.amapKey,
    prevDist.amapKey,
  );
  next.amapSecurityJsCode = pickSecret(
    envCode,
    site.amapSecurityJsCode,
    prevPublic.amapSecurityJsCode,
    prevDist.amapSecurityJsCode,
  );
  return next;
}

function copyTree(from, to) {
  if (!fs.existsSync(from)) return 0;
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      n += copyTree(src, dest);
      continue;
    }
    if (entry.name === 'site.json') {
      const site = readJson(src) || {};
      const merged = mergeSiteSecrets(site);
      fs.writeFileSync(dest, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
      n += 1;
      const kept = SECRET_FIELDS.filter((k) => merged[k] && !String(site[k] || '').trim());
      if (kept.length) {
        console.log(`[sync:data] site.json 保留已有密钥字段: ${kept.join(', ')}`);
      }
      continue;
    }
    fs.copyFileSync(src, dest);
    n += 1;
  }
  return n;
}

loadDotEnv();
fs.mkdirSync(outDir, { recursive: true });
const files = copyTree(srcDir, outDir);
console.log(`[sync:data] copied ${files} file(s) → public/data`);
