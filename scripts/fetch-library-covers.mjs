/**
 * 多源馆藏封面拉取 → public/library/covers/
 *
 * 源优先级（按类型）：
 * - 图书/小说：微信读书 → 豆瓣（标题校验）→ 豆瓣搜索
 * - 动漫/漫画：Bangumi → B站番剧搜索 → Anilist → yuc.wiki 新番表 → 豆瓣
 * - 综艺：豆瓣移动端 → 豆瓣搜索
 *
 * 用法：
 *   node scripts/fetch-library-covers.mjs
 *   node scripts/fetch-library-covers.mjs --force
 *   node scripts/fetch-library-covers.mjs --only=sheng-si-pi-lao
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = path.join(root, 'data', 'library.json');
const coverDir = path.join(root, 'public', 'library', 'covers');

const force = process.argv.includes('--force');
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const onlyId = onlyArg ? onlyArg.slice('--only='.length) : '';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const UA_MOBILE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[（(【\[][^）)】\]]*[）)】\]]/g, '') // 去掉括号副标
    .replace(/[【】\[\]（）()·・\s:：\-—_～~第季部篇]/g, '')
    .replace(/的|与|和|之/g, '');
}

function titleMatches(candidate, expected) {
  const a = normalizeText(candidate);
  const b = normalizeText(expected);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  // 公共前缀：至少 4 个有效字符重合
  const min = Math.min(a.length, b.length);
  if (min >= 4) {
    let common = 0;
    for (let i = 0; i < min; i++) {
      if (a[i] === b[i]) common += 1;
      else break;
    }
    if (common >= 4) return true;
  }
  // 短标题包含关系（去掉数字后再比）
  const a2 = a.replace(/\d+/g, '');
  const b2 = b.replace(/\d+/g, '');
  if (a2.length >= 3 && b2.length >= 3 && (a2.includes(b2) || b2.includes(a2))) return true;
  return false;
}

async function httpGet(url, headers = {}) {
  return fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/json,image/avif,image/webp,image/*,*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      ...headers,
    },
    signal: AbortSignal.timeout(18000),
    redirect: 'follow',
  });
}

function pickMeta(html, prop) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
    'i',
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
    'i',
  );
  return html.match(re)?.[1] || html.match(re2)?.[1] || '';
}

function pageTitle(html) {
  return (html.match(/<title[^>]*>([^<]+)/i)?.[1] || '')
    .replace(/\s*[|\-–].*$/, '')
    .replace(/\(豆瓣\)/g, '')
    .replace(/-\s*图书.*/g, '')
    .trim();
}

function extractDoubanCover(html) {
  const og = pickMeta(html, 'og:image');
  if (og && /doubanio\.com/i.test(og)) {
    return og
      .replace(/^http:/, 'https:')
      .replace(/qnmob\d+\.doubanio\.com/, 'img9.doubanio.com')
      .replace(/\?.*$/, '')
      .replace(/\/view\/photo\/large\//, '/view/photo/s_ratio_poster/')
      .replace(/\/view\/subject\/m\//, '/view/subject/l/');
  }
  const m = html.match(
    /https?:\/\/img\d+\.doubanio\.com\/view\/subject\/[lm]\/public\/s\d+\.(?:jpg|webp|png)/i,
  );
  return m ? m[0].replace(/^http:/, 'https:') : '';
}

function toMobileDouban(url) {
  const book = url.match(/book\.douban\.com\/subject\/(\d+)/i);
  if (book) return `https://m.douban.com/book/subject/${book[1]}/`;
  const movie = url.match(/movie\.douban\.com\/subject\/(\d+)/i);
  if (movie) return `https://m.douban.com/movie/subject/${movie[1]}/`;
  const any = url.match(/douban\.com\/subject\/(\d+)/i);
  if (any) return `https://m.douban.com/subject/${any[1]}/`;
  return '';
}

async function fetchDoubanSubjectCover(link, expectedTitle) {
  const candidates = [toMobileDouban(link), link].filter(Boolean);
  for (const url of candidates) {
    try {
      const res = await httpGet(url, {
        Referer: 'https://www.douban.com/',
        'User-Agent': /m\.douban/.test(url) ? UA_MOBILE : UA,
      });
      if (!res.ok) continue;
      const html = await res.text();
      if (html.length < 3500 && !/m\.douban/.test(url)) continue;
      const title = pageTitle(html) || pickMeta(html, 'og:title');
      if (expectedTitle && !titleMatches(title, expectedTitle)) {
        console.log(`    douban title mismatch:「${title}」≠「${expectedTitle}」`);
        continue;
      }
      const cover = extractDoubanCover(html);
      if (cover) return { url: cover, source: 'douban', title };
    } catch {
      /* next */
    }
  }
  return null;
}

async function fetchDoubanSearchCover(title, author, kind) {
  const q = [title, author].filter(Boolean).join(' ');
  const url = `https://m.douban.com/search/?query=${encodeURIComponent(q)}`;
  try {
    const res = await httpGet(url, { 'User-Agent': UA_MOBILE, Referer: 'https://m.douban.com/' });
    if (!res.ok) return null;
    const html = await res.text();
    // 结果块：subject id + 标题
    const blocks = [
      ...html.matchAll(
        /href="(?:https?:\/\/(?:www|m)\.douban\.com)?\/(?:book\/|movie\/)?subject\/(\d+)\/?"[^>]*>[\s\S]{0,240}?<span[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)/gi,
      ),
    ];
    const fallbackIds = [...html.matchAll(/\/(?:book\/|movie\/)?subject\/(\d+)/g)].map((m) => m[1]);
    const ids = [];
    for (const m of blocks) {
      if (titleMatches(m[2], title)) ids.push(m[1]);
    }
    if (!ids.length) {
      // 若页面标题列表里有同名，按出现顺序取
      const titles = [...html.matchAll(/class="[^"]*title[^"]*"[^>]*>([^<]+)/gi)].map((m) =>
        m[1].trim(),
      );
      for (let i = 0; i < Math.min(titles.length, fallbackIds.length); i++) {
        if (titleMatches(titles[i], title)) ids.push(fallbackIds[i]);
      }
    }
    const pick = ids[0] || (titleMatches(pageTitle(html), title) ? fallbackIds[0] : '');
    // 更稳：遍历前几个 id，校验详情页标题
    const tryIds = [...new Set(ids.length ? ids : fallbackIds)].slice(0, 5);
    const isBook = kind === 'book' || kind === 'novel';
    for (const id of tryIds) {
      const link = isBook
        ? `https://book.douban.com/subject/${id}/`
        : `https://movie.douban.com/subject/${id}/`;
      const hit = await fetchDoubanSubjectCover(link, title);
      if (hit) return { ...hit, source: 'douban-search', link };
    }
    if (pick) {
      const link = isBook
        ? `https://book.douban.com/subject/${pick}/`
        : `https://movie.douban.com/subject/${pick}/`;
      return fetchDoubanSubjectCover(link, title);
    }
  } catch (e) {
    console.log(`    douban search fail: ${e.message}`);
  }
  return null;
}

/** 微信读书搜索 — 对中文书很准 */
async function fetchWereadCover(title, author) {
  const url =
    `https://weread.qq.com/web/search/global?keyword=${encodeURIComponent(title)}` +
    `&maxIdx=0&count=8&fragmentSize=0`;
  try {
    const res = await httpGet(url, {
      Referer: 'https://weread.qq.com/',
      Accept: 'application/json',
    });
    if (!res.ok) return null;
    const data = await res.json();
    const books = data?.books || [];
    let best = null;
    for (const row of books) {
      const info = row.bookInfo || row;
      if (!info?.cover || !info?.title) continue;
      if (!titleMatches(info.title, title)) continue;
      if (author && info.author && !normalizeText(info.author).includes(normalizeText(author).slice(0, 2))) {
        // 作者弱校验：放宽，但优先匹配
        if (!best) best = info;
        continue;
      }
      best = info;
      break;
    }
    if (!best) {
      best = books.map((r) => r.bookInfo || r).find((i) => i?.cover && titleMatches(i.title, title));
    }
    if (!best?.cover) return null;
    // 尽量换大图
    const cover = String(best.cover)
      .replace(/^http:/, 'https:')
      .replace(/\/s_yuewen_/, '/t7_yuewen_')
      .replace(/\/s_/, '/t7_');
    return { url: cover, source: 'weread', title: best.title, bookId: best.bookId };
  } catch (e) {
    console.log(`    weread fail: ${e.message}`);
    return null;
  }
}

async function fetchBangumiCover(subjectId) {
  for (const url of [
    `https://api.bgm.tv/v0/subjects/${subjectId}`,
    `https://api.bgm.tv/subject/${subjectId}`,
  ]) {
    try {
      const res = await httpGet(url, { Accept: 'application/json', Referer: 'https://bgm.tv/' });
      if (!res.ok) continue;
      const data = await res.json();
      const cover =
        data?.images?.large || data?.images?.common || data?.images?.medium || data?.image || '';
      if (cover) return { url: String(cover).replace(/^http:/, 'https:'), source: 'bangumi' };
    } catch {
      /* next */
    }
  }
  return null;
}

async function fetchBilibiliCover(title) {
  const url =
    `https://api.bilibili.com/x/web-interface/wbi/search/type?search_type=media_bangumi&keyword=` +
    encodeURIComponent(title);
  try {
    const res = await httpGet(url, {
      Referer: 'https://search.bilibili.com',
      Origin: 'https://search.bilibili.com',
    });
    if (!res.ok) return null;
    const data = await res.json();
    const list = data?.data?.result || [];
    for (const item of list) {
      const t = String(item.title || '').replace(/<[^>]+>/g, '');
      if (!titleMatches(t, title) && !titleMatches(item.org_title, title)) continue;
      if (item.cover) {
        return {
          url: String(item.cover).replace(/^http:/, 'https:'),
          source: 'bilibili',
          title: t,
        };
      }
    }
    if (list[0]?.cover && titleMatches(String(list[0].title || '').replace(/<[^>]+>/g, ''), title)) {
      return {
        url: String(list[0].cover).replace(/^http:/, 'https:'),
        source: 'bilibili',
      };
    }
  } catch (e) {
    console.log(`    bilibili fail: ${e.message}`);
  }
  return null;
}

async function fetchAnilistCover(title) {
  const query = `
    query ($search: String) {
      Media(search: $search, type: ANIME) {
        title { romaji native english }
        coverImage { large extraLarge }
      }
    }
  `;
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { search: title } }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const media = data?.data?.Media;
    const cover = media?.coverImage?.extraLarge || media?.coverImage?.large;
    if (!cover) return null;
    const names = [media.title?.native, media.title?.romaji, media.title?.english].filter(Boolean);
    if (names.length && !names.some((n) => titleMatches(n, title))) {
      // Anilist 英文搜索对中文名常不准，仍接受若 search 就是英文别名
    }
    return { url: cover, source: 'anilist', title: names[0] };
  } catch {
    return null;
  }
}

/** yuc.wiki 新番表：扫近几个季度页 */
async function fetchYucCover(title) {
  const now = new Date();
  const seasons = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i * 3, 1);
    const m = d.getMonth() + 1;
    const seasonMonth = m <= 3 ? 1 : m <= 6 ? 4 : m <= 9 ? 7 : 10;
    seasons.push(`${d.getFullYear()}${String(seasonMonth).padStart(2, '0')}`);
  }
  seasons.push(''); // 首页

  for (const ym of [...new Set(seasons)]) {
    const url = ym ? `https://yuc.wiki/${ym}/` : 'https://yuc.wiki/';
    try {
      const res = await httpGet(url, { Referer: 'https://yuc.wiki/' });
      if (!res.ok) continue;
      const html = await res.text();
      // title_cn_r / title_cn_a 附近找封面
      const re =
        /<(?:div|td|span)[^>]*class="[^"]*title_cn[^"]*"[^>]*>([^<]+)<[\s\S]{0,1200}?data-src="(https?:\/\/[^"]+)"/gi;
      let m;
      while ((m = re.exec(html))) {
        if (titleMatches(m[1], title)) {
          return { url: m[2], source: 'yuc.wiki', title: m[1].trim() };
        }
      }
      // 宽松：整页找标题文本后的 data-src
      const idx = html.indexOf(title);
      if (idx > 0) {
        const slice = html.slice(Math.max(0, idx - 800), idx + 800);
        const img = slice.match(/data-src="(https?:\/\/[^"]+\.(?:jpg|png|webp)[^"]*)"/i);
        if (img) return { url: img[1], source: 'yuc.wiki' };
      }
    } catch {
      /* next season */
    }
  }
  return null;
}

/** 起点移动搜索（弱依赖，失败忽略） */
async function fetchQidianCover(title) {
  const url = `https://m.qidian.com/search?kw=${encodeURIComponent(title)}`;
  try {
    const res = await httpGet(url, {
      'User-Agent': UA_MOBILE,
      Referer: 'https://m.qidian.com/',
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (!titleMatches(html.slice(0, 2000), title) && !html.includes(title)) {
      // 仍尝试抽封面
    }
    const cover =
      html.match(/https?:\/\/bookcover\.yuewen\.com\/[^"'\\\s>]+\.(?:jpg|jpeg|png|webp)/i)?.[0] ||
      html.match(/https?:\/\/[^"'\\\s>]*qidian[^"'\\\s>]*\/[^"'\\\s>]+\.(?:jpg|jpeg|png|webp)/i)?.[0];
    if (cover) return { url: cover.replace(/^http:/, 'https:'), source: 'qidian' };
  } catch {
    /* ignore */
  }
  return null;
}

/** 番茄小说（弱依赖） */
async function fetchFanqieCover(title) {
  const url = `https://fanqienovel.com/search/${encodeURIComponent(title)}`;
  try {
    const res = await httpGet(url, { Referer: 'https://fanqienovel.com/' });
    if (!res.ok) return null;
    const html = await res.text();
    const cover =
      html.match(/https?:\/\/[^"'\\\s>]*byteimg\.com[^"'\\\s>]+\.(?:jpg|jpeg|png|webp)[^"'\\\s>]*/i)?.[0] ||
      html.match(/https?:\/\/p\d+-novel\.byteimg\.com\/[^"'\\\s>]+/i)?.[0];
    if (cover && html.includes(title.slice(0, 2))) {
      return { url: cover.replace(/^http:/, 'https:'), source: 'fanqie' };
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function resolveCover(item) {
  const link = String(item.link || '');
  const title = item.title;
  const author = item.author || '';
  const type = item.type || 'book';

  // 1) 显式平台链接
  const bgm = link.match(/(?:bgm\.tv|bangumi\.tv)\/subject\/(\d+)/i);
  if (bgm) {
    const hit = await fetchBangumiCover(bgm[1]);
    if (hit) return hit;
  }

  if (/douban\.com\/subject\/\d+/i.test(link)) {
    const hit = await fetchDoubanSubjectCover(link, title);
    if (hit) return hit;
    console.log('    linked douban rejected (wrong title or empty), fallback search');
  }

  if (/weread\.qq\.com/i.test(link)) {
    const hit = await fetchWereadCover(title, author);
    if (hit) return hit;
  }

  // 2) 按类型瀑布
  if (type === 'book' || type === 'novel') {
    for (const fn of [
      () => fetchWereadCover(title, author),
      () => fetchDoubanSearchCover(title, author, type),
      () => fetchQidianCover(title),
      () => fetchFanqieCover(title),
    ]) {
      const hit = await fn();
      if (hit?.url) return hit;
    }
  }

  if (type === 'anime' || type === 'manga') {
    for (const fn of [
      () => fetchBilibiliCover(title),
      () => fetchAnilistCover(title),
      () => fetchYucCover(title),
      () => fetchDoubanSearchCover(title, author, 'anime'),
    ]) {
      const hit = await fn();
      if (hit?.url) return hit;
    }
  }

  if (type === 'game') {
    for (const fn of [
      () => fetchBilibiliCover(title),
      () => fetchDoubanSearchCover(title, author, 'game'),
    ]) {
      const hit = await fn();
      if (hit?.url) return hit;
    }
  }

  if (type === 'movie' || type === 'drama' || type === 'variety') {
    for (const fn of [
      () => fetchDoubanSearchCover(title, author, type === 'variety' ? 'variety' : 'movie'),
      () => fetchBilibiliCover(title),
    ]) {
      const hit = await fn();
      if (hit?.url) return hit;
    }
  }

  // 3) 通用兜底
  return (
    (await fetchWereadCover(title, author)) ||
    (await fetchDoubanSearchCover(title, author, type)) ||
    (await fetchBilibiliCover(title)) ||
    null
  );
}

function extFromUrl(url, contentType) {
  if (/webp/i.test(contentType || '') || /\.webp(\?|$)/i.test(url)) return '.webp';
  if (/png/i.test(contentType || '') || /\.png(\?|$)/i.test(url)) return '.png';
  return '.jpg';
}

async function downloadCover(url, destBase, source = '') {
  const referer =
    /weread|yuewen/i.test(url)
      ? 'https://weread.qq.com/'
      : /douban/i.test(url)
        ? 'https://www.douban.com/'
        : /hdslb|bilibili/i.test(url)
          ? 'https://www.bilibili.com/'
          : /anilist/i.test(url)
            ? 'https://anilist.co/'
            : /bgm|bangumi|lain\.bgm/i.test(url)
              ? 'https://bgm.tv/'
              : source === 'yuc.wiki'
                ? 'https://yuc.wiki/'
                : undefined;

  const res = await httpGet(url, referer ? { Referer: referer } : {});
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1200) throw new Error('file too small');
  const ext = extFromUrl(url, res.headers.get('content-type') || '');
  const dest = destBase + ext;
  fs.writeFileSync(dest, buf);
  return dest;
}

async function main() {
  fs.mkdirSync(coverDir, { recursive: true });
  const raw = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
  const items = Array.isArray(raw) ? raw : raw.items || [];
  let updated = 0;

  for (const item of items) {
    if (!item?.id || !item?.title) continue;
    if (onlyId && item.id !== onlyId) continue;

    const localPath =
      item.cover && String(item.cover).startsWith('/library/covers/')
        ? path.join(root, 'public', String(item.cover).replace(/^\//, ''))
        : '';
    const hasLocal = localPath && fs.existsSync(localPath);

    if (hasLocal && !force) {
      console.log(`skip ${item.id} (local cover, use --force to refresh)`);
      continue;
    }

    console.log(`fetch ${item.id} 「${item.title}」…`);
    const resolved = await resolveCover(item);
    if (!resolved?.url) {
      console.log('  no cover found');
      continue;
    }

    console.log(`  source=${resolved.source} ${resolved.url.slice(0, 100)}`);

    try {
      for (const ext of ['.jpg', '.png', '.webp']) {
        const old = path.join(coverDir, item.id + ext);
        if (fs.existsSync(old)) fs.unlinkSync(old);
      }
      const dest = await downloadCover(resolved.url, path.join(coverDir, item.id), resolved.source);
      item.cover = `/library/covers/${path.basename(dest)}`;
      if (resolved.link && /douban\.com\/subject\/\d+/i.test(resolved.link)) {
        // 搜索纠正了错误豆瓣链接
        if (!item.link || item.link !== resolved.link) {
          const oldLink = item.link;
          item.link = resolved.link;
          console.log(`  fixed link: ${oldLink || '(empty)'} → ${resolved.link}`);
        }
      }
      // 豆瓣详情链接标题错了时，用搜索结果覆盖
      updated += 1;
      console.log(`  → ${item.cover}`);
    } catch (e) {
      item.cover = resolved.url;
      updated += 1;
      console.log(`  remote fallback: ${e.message}`);
    }
  }

  // 对「已有错误豆瓣链接」：若强制刷新时搜索修正了 link，写回
  const out = Array.isArray(raw) ? items : { ...raw, items };
  fs.writeFileSync(srcPath, JSON.stringify(out, null, 2) + '\n');
  console.log(`[library-covers] updated ${updated} item(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
