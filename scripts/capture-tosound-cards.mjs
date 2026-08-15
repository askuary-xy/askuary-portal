/**
 * Pick better-matching toSound cards + download matching preview audio.
 * Prefer clear SFX titles; skip music loops / mismatched animals / vague names.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'content', 'uploads', '2026', '07', 'tosound');
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  {
    key: 'rain',
    queries: ['雨声 ambient', '下雨雨声', 'rain ambience', '雨声'],
    card: 'card-rain.png',
    audio: 'rain.mp3',
    label: '雨声',
    good: [/雨声/, /下雨/, /rain/i, /drizzle/i, /storm/i, /雷雨/, /暴雨/],
    bad: [/bpm/i, /loop/i, /piano/i, /hip\s*hop/i, /dubstep/i, /synth/i, /鼓/, /贝斯/, /吉他/],
  },
  {
    key: 'birds',
    queries: ['鸟叫 清晨', 'forest birds', '鸟鸣 自然', 'sparrow', '鸟叫'],
    card: 'card-birds.png',
    audio: 'birds.mp3',
    label: '鸟鸣',
    good: [/鸟鸣/, /鸟叫/, /bird/i, /sparrow/i, /chirp/i, /晨/, /林/, /forest/i, /雀/],
    bad: [/鹦鹉/, /parrot/i, /虎皮/, /bpm/i, /loop/i, /猫/, /狗/, /鸡/, /鸭/],
  },
  {
    key: 'footsteps',
    queries: ['脚步声 走路', 'footsteps walking', '走路 脚步', 'footstep'],
    card: 'card-footsteps.png',
    audio: 'footsteps.mp3',
    label: '脚步',
    good: [/脚步/, /走路/, /footstep/i, /walking/i, /steps/i, /鞋/],
    bad: [/bpm/i, /loop/i, /鼓/, /bass/i, /跑酷音乐/, /piano/i],
  },
  {
    key: 'whoosh',
    queries: ['whoosh transition', '嗖 转场', 'swish whoosh', 'whoosh'],
    card: 'card-whoosh.png',
    audio: 'whoosh.mp3',
    label: 'Whoosh',
    good: [/whoosh/i, /swish/i, /嗖/, /甩/, /转场/, /风声/, /swoosh/i],
    bad: [/bpm/i, /loop/i, /piano/i, /鼓循环/, /bass/i],
  },
  {
    key: 'notification',
    queries: ['消息提示音', 'notification ui', '提示音 叮', 'ui click notification'],
    card: 'card-notification.png',
    audio: 'notification.mp3',
    label: '通知',
    good: [/通知/, /提示/, /消息/, /notif/i, /ding/i, /叮/, /铃声/, /alert/i, /ui/i, /message/i],
    bad: [/bpm/i, /loop/i, /报警(?!音)/, /eas/i, /灾难/, /广播/, /游戏音乐/],
  },
];

function scoreTitle(title, t) {
  const s = String(title || '');
  let score = 0;
  for (const re of t.good) if (re.test(s)) score += 3;
  for (const re of t.bad) if (re.test(s)) score -= 5;
  // prefer shorter descriptive SFX titles
  if (s.length > 0 && s.length < 40) score += 1;
  if (/by\s+/i.test(s)) score += 0.5;
  return score;
}

async function listCards(page) {
  return page.evaluate(() => {
    return [...document.querySelectorAll('.soundcard')].map((card, index) => {
      const cover = card.querySelector('.cover.gradient');
      const title = (cover?.innerText || '').replace(/\s+/g, ' ').trim();
      const links = [...card.querySelectorAll('a[href]')].map((a) => a.href);
      const preview =
        links.find((h) => /preview\.tosound\.com|down\.ear0\.com|\.mp3|\.ogg|\.wav/i.test(h)) || null;
      const source = (card.innerText.match(/来源[:：]\s*(\S+)/) || [])[1] || '';
      const text = (card.innerText || '').replace(/\s+/g, ' ').slice(0, 240);
      return { index, title, preview, source, text, hasCover: !!cover };
    });
  });
}

async function shotCard(page, index, outPath) {
  await page.addStyleTag({
    content: `
      .soundcard .top,
      .soundcard .cover.gradient,
      .soundcard .cover .player {
        height: 314px !important;
        min-height: 314px !important;
      }
    `,
  });
  const cover = page.locator('.soundcard').nth(index).locator('.cover.gradient');
  await cover.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  const box = await cover.boundingBox();
  if (!box) throw new Error('no box');
  const raw = outPath.replace(/\.png$/i, '.raw.png');
  await page.screenshot({
    path: raw,
    clip: {
      x: Math.max(0, box.x),
      y: Math.max(0, box.y),
      width: Math.ceil(box.width),
      height: Math.ceil(box.height),
    },
  });
  await sharp(raw).resize(360, 360, { fit: 'cover' }).png().toFile(outPath);
  fs.unlinkSync(raw);
}

async function downloadPreview(page, previewUrl, audioPath) {
  const res = await page.request.get(previewUrl);
  if (!res.ok()) throw new Error(`http ${res.status()}`);
  const buf = Buffer.from(await res.body());
  if (buf.length < 2000) throw new Error(`too small ${buf.length}`);
  fs.writeFileSync(audioPath, buf);
  return buf.length;
}

async function grabBest(page, t) {
  let best = null;

  for (const query of t.queries) {
    const url = `https://tosound.com/search/word-${encodeURIComponent(query)}`;
    console.log(`\n[${t.key}] search: ${query}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('.soundcard .cover.gradient', { timeout: 30000 }).catch(() => null);
    await page.waitForTimeout(1000);

    const cards = await listCards(page);
    if (!cards.length) {
      console.log('  no cards');
      continue;
    }

    const ranked = cards
      .map((c) => ({ ...c, score: scoreTitle(c.title + ' ' + c.text, t), query }))
      .filter((c) => c.preview && c.hasCover)
      .sort((a, b) => b.score - a.score);

    console.log(
      '  top:',
      ranked
        .slice(0, 5)
        .map((c) => `${c.score}|${c.title.slice(0, 36)}`)
        .join(' || '),
    );

    const candidate = ranked.find((c) => c.score >= 3) || ranked[0];
    if (!candidate) continue;
    if (!best || candidate.score > best.score) {
      best = candidate;
      // keep page on this query for screenshot
      best._query = query;
      if (candidate.score >= 6) break; // good enough
    }
  }

  if (!best || best.score < 2) {
    throw new Error(`no suitable card for ${t.key} (best=${best?.score} ${best?.title})`);
  }

  // reload winning query page to ensure index stable
  const winUrl = `https://tosound.com/search/word-${encodeURIComponent(best._query || t.queries[0])}`;
  await page.goto(winUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.soundcard .cover.gradient', { timeout: 30000 });
  await page.waitForTimeout(900);
  const cards = await listCards(page);
  const match =
    cards.find((c) => c.title === best.title && c.preview === best.preview) ||
    cards.find((c) => c.title === best.title) ||
    cards[best.index];
  if (!match?.preview) throw new Error('lost match on reload');

  const cardPath = path.join(outDir, t.card);
  const audioPath = path.join(outDir, t.audio);
  await shotCard(page, match.index, cardPath);
  const bytes = await downloadPreview(page, match.preview, audioPath);

  console.log(`✔ ${t.key}: score=${best.score} | ${match.title} | ${bytes} bytes`);
  return {
    key: t.key,
    label: t.label,
    query: best._query,
    title: match.title,
    source: match.source,
    previewUrl: match.preview,
    score: best.score,
    bytes,
    card: t.card,
    audio: t.audio,
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 2,
  locale: 'zh-CN',
});

const results = [];
try {
  for (const t of targets) {
    try {
      results.push(await grabBest(page, t));
    } catch (e) {
      console.error(`✖ ${t.key}:`, e.message);
      results.push({ key: t.key, error: e.message });
    }
  }
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(results, null, 2), 'utf8');
console.log('\nmanifest written');
