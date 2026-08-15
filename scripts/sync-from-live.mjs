/**
 * 从 askuary.cn 拉取门户配置，写入 data/*.json
 *
 * 用法: node scripts/sync-from-live.mjs [站点根 URL]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data');
const liveBase = (process.argv[2] || 'https://www.askuary.cn').replace(/\/$/, '');

function parseInlineJson(html, varName) {
  const re = new RegExp(`var ${varName} = (\\{[\\s\\S]*?\\});`);
  const match = html.match(re);
  if (!match) throw new Error(`未找到 ${varName}`);
  return JSON.parse(match[1]);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
}

function writeJson(file, data) {
  fs.writeFileSync(path.join(dataDir, file), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function mapSpot(spot) {
  let url = spot.url || '';
  // 旧站旅记等外链：保留绝对 URL，站内路径待对应模块上线后再改
  if (url && url.startsWith('/')) {
    url = '';
  }
  return {
    lat: spot.lat,
    lng: spot.lng,
    title: spot.title || '',
    text: spot.text || '',
    style: spot.style || 'star',
    url,
    linkLabel: spot.link_label || spot.linkLabel || (url ? '查看链接' : ''),
  };
}

function mapFriend(friend) {
  return {
    title: friend.title || '',
    text: friend.text || '',
    avatar: friend.avatar || '',
    url: friend.url || '',
    linkLabel: friend.link_label || friend.linkLabel || '',
  };
}

function mapNavStar(star) {
  const pathMap = {
    blog: '/blog/',
    friends: '/friends/',
    about: '/about/',
    explore: '#explore',
  };
  let url = pathMap[star.id] || star.url || '/';
  if (star.id === 'explore') url = '#explore';
  return {
    id: star.id,
    label: star.label,
    desc: star.desc,
    url,
    icon: star.icon,
    enabled: star.enabled !== false,
    x: star.x,
    y: star.y,
  };
}

async function sync() {
  console.log(`[sync] fetching ${liveBase}/`);
  const html = await (await fetch(`${liveBase}/`)).text();

  const earth = parseInlineJson(html, 'sakurairoChildEarth');
  const stars = parseInlineJson(html, 'sakurairoChildStars');
  const footprint = parseInlineJson(html, 'sakurairoChildFootprint');

  const site = readJson('site.json');
  const fpTitle = html.match(/class="fp-title"[^>]*>([^<]+)/)?.[1]?.trim();
  const fpIntro = html.match(/class="fp-desc"[^>]*>([^<]+)/)?.[1]?.trim();
  const avatarMatch = html.match(/class="fp-avatar"[\s\S]*?<img[^>]+src="([^"]+)"/);
  const avatarAlt = html.match(/class="fp-avatar"[\s\S]*?<img[^>]+alt="([^"]*)"/)?.[1];

  site.name = fpTitle || site.name || 'ASKUARY';
  site.intro = fpIntro || site.intro;
  if (!site.taglines?.length) {
    site.taglines = [site.intro, '点击光点，拾取记忆', '悬停流星，阅读短句'];
  }

  if (avatarMatch?.[1]) {
    site.avatar = avatarMatch[1];
    site.showAvatar = true;
    site.avatarAlt = avatarAlt || site.name;
  }

  // 旧站穿越到 /blog/；新站穿越到 /home/
  site.homeUrl = '/home/';
  site.warpEnabled = true;
  site.warpHint = '穿越至站点主页';

  writeJson('site.json', site);
  writeJson(
    'spots.json',
    (earth.spots || []).map(mapSpot),
  );
  writeJson(
    'friends.json',
    (earth.friends || []).filter((f) => f.title?.trim()),
  );
  writeJson('meteor-words.json', stars.words || []);
  writeJson('nav-stars.json', (stars.navStars || []).map(mapNavStar));

  console.log('[sync] wrote site.json, spots.json, friends.json, meteor-words.json, nav-stars.json');
  console.log(`[sync] spots: ${earth.spots?.length || 0}, friends: ${earth.friends?.length || 0}`);
  console.log(`[sync] old warp target was ${footprint.homeUrl || footprint.blogUrl}`);
}

sync().catch((err) => {
  console.error('[sync] failed:', err);
  process.exit(1);
});
