/**
 * 扫描 public/media/music/*.mp3 → data/music-playlist.json（并同步到 public/data/）
 *
 * 命名建议：
 *   Artist - Title.mp3
 *   Title.mp3
 *
 * 同目录可选：
 *   foo.lrc / foo.jpg|png|webp（与 mp3 同名）
 * 已有 playlist 里的 title/artist/cover/lrc 会按 url 保留。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const musicDir = path.join(root, 'public', 'media', 'music');
const dataFile = path.join(root, 'data', 'music-playlist.json');
const publicDataFile = path.join(root, 'public', 'data', 'music-playlist.json');

const AUDIO_EXT = new Set(['.mp3', '.m4a', '.ogg', '.wav', '.flac']);
const COVER_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

function readPrev() {
  try {
    if (!fs.existsSync(dataFile)) return { tracks: [] };
    const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    return {
      title: raw.title,
      artist: raw.artist,
      tracks: Array.isArray(raw.tracks) ? raw.tracks : [],
    };
  } catch {
    return { tracks: [] };
  }
}

function parseName(base) {
  const cleaned = base.replace(/[_]+/g, ' ').trim();
  const parts = cleaned.split(/\s+-\s+/);
  if (parts.length >= 2) {
    return {
      artist: parts[0].trim(),
      title: parts.slice(1).join(' - ').trim(),
    };
  }
  return { artist: 'ASKUARY', title: cleaned || '未命名' };
}

function findSidecar(dir, stem, exts) {
  for (const ext of exts) {
    const p = path.join(dir, stem + ext);
    if (fs.existsSync(p)) return `/media/music/${stem}${ext}`.replace(/\\/g, '/');
  }
  return '';
}

function main() {
  fs.mkdirSync(musicDir, { recursive: true });
  const prev = readPrev();
  const byUrl = new Map(
    (prev.tracks || [])
      .filter((t) => t && t.url)
      .map((t) => [String(t.url), t]),
  );

  const files = fs
    .readdirSync(musicDir)
    .filter((name) => AUDIO_EXT.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'zh'));

  const tracks = files.map((name, i) => {
    const ext = path.extname(name);
    const stem = path.basename(name, ext);
    const url = `/media/music/${name}`.replace(/\\/g, '/');
    const parsed = parseName(stem);
    const old = byUrl.get(url) || {};
    const cover =
      old.cover ||
      findSidecar(musicDir, stem, COVER_EXT) ||
      '';
    const lrc =
      old.lrc ||
      old.lrcUrl ||
      findSidecar(musicDir, stem, ['.lrc']) ||
      '';
    return {
      id: String(old.id || `local-${i + 1}-${stem}`).slice(0, 80),
      title: String(old.title || parsed.title),
      artist: String(old.artist || parsed.artist),
      url,
      ...(cover ? { cover } : {}),
      ...(lrc ? { lrc } : {}),
    };
  });

  const out = {
    title: prev.title || '次元电台',
    artist: prev.artist || 'ASKUARY',
    updatedAt: new Date().toISOString().slice(0, 10),
    tracks,
  };

  const json = `${JSON.stringify(out, null, 2)}\n`;
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.mkdirSync(path.dirname(publicDataFile), { recursive: true });
  fs.writeFileSync(dataFile, json, 'utf8');
  fs.writeFileSync(publicDataFile, json, 'utf8');

  console.log(
    tracks.length
      ? `music playlist: ${tracks.length} track(s) → data/music-playlist.json`
      : 'music playlist: 0 tracks（把 mp3 放进 public/media/music/ 后重跑）',
  );
}

main();
