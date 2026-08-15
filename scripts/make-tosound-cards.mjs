import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'content', 'uploads', '2026', '07', 'tosound');
fs.mkdirSync(outDir, { recursive: true });

const cards = [
  { file: 'card-rain.png', title: '雨', by: 'by Mixkit', c1: '#7c5cff', c2: '#3dceb8' },
  { file: 'card-birds.png', title: '鸟鸣', by: 'by Mixkit', c1: '#2f9e44', c2: '#74c0fc' },
  { file: 'card-footsteps.png', title: '脚步', by: 'by Mixkit', c1: '#ae3ec9', c2: '#fd7e14' },
  { file: 'card-whoosh.png', title: 'Whoosh', by: 'by Mixkit', c1: '#339af0', c2: '#22b8cf' },
  { file: 'card-notification.png', title: '通知', by: 'by Mixkit', c1: '#f06595', c2: '#845ef7' },
];

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function makeSvg(c) {
  const titleSize = c.title.length > 4 ? 26 : c.title.length > 3 ? 30 : 36;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="360" height="360" viewBox="0 0 360 360" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${c.c1}"/>
      <stop offset="100%" stop-color="${c.c2}"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity="0.18"/>
    </filter>
  </defs>
  <rect width="360" height="360" rx="18" ry="18" fill="url(#g)"/>
  <circle cx="180" cy="175" r="118" fill="rgba(255,255,255,0.14)"/>
  <circle cx="180" cy="175" r="96" fill="rgba(255,255,255,0.08)"/>
  <circle cx="180" cy="175" r="34" fill="#fff" filter="url(#soft)"/>
  <polygon points="172,160 172,190 198,175" fill="#1f1f1f"/>
  <text x="22" y="42" font-size="${titleSize}" font-family="Segoe UI, Microsoft YaHei, PingFang SC, sans-serif" font-weight="700" fill="#fff">${escapeXml(c.title)}</text>
  <g transform="translate(318,18)" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="8" width="14" height="14" rx="2"/>
    <path d="M10 2h10v10"/>
    <path d="M20 2 L10 12"/>
  </g>
  <text x="22" y="318" font-size="15" font-family="Segoe UI, Arial, sans-serif" fill="rgba(255,255,255,0.95)">${escapeXml(c.by)}</text>
  <circle cx="292" cy="308" r="14" fill="rgba(255,255,255,0.92)"/>
  <text x="292" y="313" text-anchor="middle" font-size="11" font-family="Segoe UI, Arial, sans-serif" font-weight="700" fill="#333">0</text>
  <circle cx="326" cy="308" r="14" fill="rgba(255,255,255,0.92)"/>
  <text x="326" y="313" text-anchor="middle" font-size="9" font-family="Segoe UI, Arial, sans-serif" font-weight="700" fill="#333">CC</text>
</svg>`;
}

for (const c of cards) {
  const out = path.join(outDir, c.file);
  await sharp(Buffer.from(makeSvg(c))).png().toFile(out);
  console.log('wrote', c.file);
}

// Keep user's real tosound rain card as alternate reference
const userRain =
  'C:\\Users\\Administrator\\.cursor\\projects\\c-Users-Administrator-Projects-askuary-portal\\assets\\c__Users_Administrator_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_Screenshot_2026-07-25_165853-321153e4-5285-4f7e-897c-826194386387.png';
if (fs.existsSync(userRain)) {
  const dest = path.join(outDir, 'card-rain-tosound.png');
  await sharp(userRain).resize(360, 360, { fit: 'cover' }).png().toFile(dest);
  // Prefer the authentic card for rain
  fs.copyFileSync(dest, path.join(outDir, 'card-rain.png'));
  console.log('wrote card-rain.png from user tosound screenshot');
}
