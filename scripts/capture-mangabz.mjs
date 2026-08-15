import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outDir = path.resolve('content/uploads/2026/07/mangabz');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1.5,
  locale: 'zh-CN',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});

async function shot(name, url) {
  console.log('goto', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  for (const sel of ['.close', '.btn-close', 'text=关闭', 'text=我知道了', 'text=同意']) {
    const el = page.locator(sel).first();
    if ((await el.count()) > 0) await el.click({ timeout: 800 }).catch(() => {});
  }
  await page.screenshot({ path: path.join(outDir, name), fullPage: false });
  console.log('saved', name, 'url=', page.url(), 'title=', await page.title());
}

await shot('home.png', 'https://www.mangabz.com/');

// ranking / list candidates
const listUrls = [
  'https://www.mangabz.com/manga-list/',
  'https://www.mangabz.com/rank/',
  'https://www.mangabz.com/manga-list-0-0-0-hits/',
];
for (const u of listUrls) {
  try {
    await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);
    if ((await page.title()).includes('404')) continue;
    await page.screenshot({ path: path.join(outDir, 'list.png'), fullPage: false });
    console.log('list ok', page.url());
    break;
  } catch (e) {
    console.log('list fail', u, e.message);
  }
}

// click first manga cover link
const coverLink = page.locator('a').filter({ has: page.locator('img') }).nth(2);
if ((await coverLink.count()) > 0) {
  const href = await coverLink.getAttribute('href');
  if (href) {
    const url = href.startsWith('http') ? href : new URL(href, 'https://www.mangabz.com/').toString();
    await shot('detail.png', url);

    const chap = page.locator('a').filter({ hasText: /第\s*[1一]|开始阅读|第1话|第01话/ }).first();
    if ((await chap.count()) > 0) {
      const ch = await chap.getAttribute('href');
      if (ch) {
        const cu = ch.startsWith('http') ? ch : new URL(ch, 'https://www.mangabz.com/').toString();
        await shot('reader.png', cu);
      }
    }
  }
}

await browser.close();
console.log('files', fs.readdirSync(outDir));
