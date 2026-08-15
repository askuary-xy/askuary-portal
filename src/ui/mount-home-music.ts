import type { HomeMusicConfig } from '../types/config';
import { escapeHtml } from '../pages/home/shared';
import {
  formatRadioTime,
  getSiteRadio,
  type MusicTrack,
} from './site-radio';

type LyricLine = { t: number; text: string };

async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

/** 解析 LRC（含中英混排行） */
export function parseLrc(raw: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const re = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
  for (const row of raw.split(/\r?\n/)) {
    const text = row.replace(re, '').trim();
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    const times: number[] = [];
    while ((m = re.exec(row))) {
      const mm = Number(m[1]);
      const ss = Number(m[2]);
      const frac = m[3] ? Number(m[3].padEnd(3, '0').slice(0, 3)) / 1000 : 0;
      times.push(mm * 60 + ss + frac);
    }
    if (!times.length || !text) continue;
    for (const t of times) lines.push({ t, text });
  }
  lines.sort((a, b) => a.t - b.t);
  return lines;
}

function activeLyricIndex(lines: LyricLine[], time: number): number {
  if (!lines.length) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= time + 0.05) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

function setLyric(text: string, active = false): void {
  const el = document.getElementById('hrLyricText');
  const bar = document.getElementById('hrLyricBar');
  if (!el || !bar) return;
  const next = text.trim() || '♪ 次元电台 · 歌词同步中';
  if (el.textContent !== next) {
    el.classList.remove('is-swap');
    void el.offsetWidth;
    el.textContent = next;
    el.classList.add('is-swap');
  }
  bar.classList.toggle('is-active', active);
}

/** XingHui 风格黑胶电台：接入全站电台，离页后续播 */
export async function mountHomeMusic(
  root: HTMLElement | null,
  music?: HomeMusicConfig,
): Promise<void> {
  if (!root) return;
  root.innerHTML = `<p class="hr-music-loading">电台连接中…</p>`;

  const radio = getSiteRadio();
  const ok = await radio.ensure(music);
  if (!ok || !radio.tracks.length) {
    root.innerHTML = `<p class="hr-music-loading">歌单暂时不可用</p>`;
    setLyric('♪ 暂无曲目');
    return;
  }

  // 主页用坞内控件，隐藏迷你条（保留 DOM，软导航离页后可复用）
  document.querySelectorAll<HTMLElement>('.mini-radio').forEach((n) => {
    n.hidden = true;
    n.setAttribute('aria-hidden', 'true');
  });

  let seeking = false;
  let lyrics: LyricLine[] = [];
  let lyricIndex = -1;
  const lyricCache = new Map<string, LyricLine[]>();

  root.innerHTML =
    `<div class="hr-vinyl">` +
    `<div class="hr-vinyl-stage">` +
    `<div class="hr-vinyl-disc" id="hrVinylDisc">` +
    `<img id="hrVinylCover" src="" alt="" decoding="async" />` +
    `<span class="hr-vinyl-hole" aria-hidden="true"></span>` +
    `</div>` +
    `<span class="hr-vinyl-badge">Cloud Music</span>` +
    `</div>` +
    `<div class="hr-vinyl-meta">` +
    `<p class="hr-vinyl-title" id="hrVinylTitle"></p>` +
    `<p class="hr-vinyl-artist" id="hrVinylArtist"></p>` +
    `<p class="hr-vinyl-count" id="hrVinylCount">${radio.tracks.length} tracks</p>` +
    `</div>` +
    `<div class="hr-vinyl-progress">` +
    `<input id="hrVinylSeek" type="range" min="0" max="1000" value="0" aria-label="进度" />` +
    `<div class="hr-vinyl-times"><span id="hrVinylCur">0:00</span><span id="hrVinylDur">0:00</span></div>` +
    `</div>` +
    `<div class="hr-vinyl-controls">` +
    `<button type="button" class="hr-vinyl-btn" id="hrVinylPrev" aria-label="上一首">⏮</button>` +
    `<button type="button" class="hr-vinyl-btn hr-vinyl-btn--play" id="hrVinylPlay" aria-label="播放">▶</button>` +
    `<button type="button" class="hr-vinyl-btn" id="hrVinylNext" aria-label="下一首">⏭</button>` +
    `</div>` +
    `</div>`;

  const disc = root.querySelector<HTMLElement>('#hrVinylDisc')!;
  const cover = root.querySelector<HTMLImageElement>('#hrVinylCover')!;
  const titleEl = root.querySelector('#hrVinylTitle')!;
  const artistEl = root.querySelector('#hrVinylArtist')!;
  const seek = root.querySelector<HTMLInputElement>('#hrVinylSeek')!;
  const curEl = root.querySelector('#hrVinylCur')!;
  const durEl = root.querySelector('#hrVinylDur')!;
  const playBtn = root.querySelector<HTMLButtonElement>('#hrVinylPlay')!;

  const loadLyrics = async (track: MusicTrack) => {
    const key = track.id || track.lrcUrl || track.url;
    if (lyricCache.has(key)) {
      lyrics = lyricCache.get(key)!;
      return;
    }
    const lrcUrl =
      track.lrcUrl ||
      (track.id
        ? `https://api.injahow.cn/meting/?server=netease&type=lrc&id=${encodeURIComponent(track.id)}`
        : '');
    const raw = lrcUrl ? await fetchText(lrcUrl) : '';
    lyrics = parseLrc(raw);
    lyricCache.set(key, lyrics);
  };

  const syncLyric = (time: number) => {
    const t = radio.track;
    if (!lyrics.length) {
      setLyric(`♪ ${t?.title || '次元电台'}`, radio.playing);
      return;
    }
    const i = activeLyricIndex(lyrics, time);
    if (i === lyricIndex) return;
    lyricIndex = i;
    setLyric(i >= 0 ? lyrics[i].text : `♪ ${t?.title || ''}`, radio.playing);
  };

  let lastTrackId = '';
  const syncUi = () => {
    const t = radio.track;
    if (!t) return;
    if (t.id !== lastTrackId) {
      lastTrackId = t.id;
      lyricIndex = -1;
      titleEl.textContent = t.title;
      artistEl.textContent = t.artist;
      cover.src = t.cover || '';
      cover.alt = t.title;
      setLyric(`♪ ${t.title}`, radio.playing);
      void loadLyrics(t).then(() => syncLyric(radio.audio.currentTime || 0));
    }
    if (!seeking && radio.audio.duration) {
      seek.value = String(Math.floor((radio.audio.currentTime / radio.audio.duration) * 1000));
      curEl.textContent = formatRadioTime(radio.audio.currentTime);
      durEl.textContent = formatRadioTime(radio.audio.duration);
    } else {
      curEl.textContent = formatRadioTime(radio.audio.currentTime || 0);
    }
    disc.classList.toggle('is-playing', radio.playing);
    playBtn.textContent = radio.playing ? '❚❚' : '▶';
    syncLyric(radio.audio.currentTime || 0);
  };

  playBtn.addEventListener('click', () => radio.toggle());
  root.querySelector('#hrVinylPrev')?.addEventListener('click', () => {
    void radio.prev(true);
  });
  root.querySelector('#hrVinylNext')?.addEventListener('click', () => {
    void radio.next(true);
  });

  seek.addEventListener('pointerdown', () => {
    seeking = true;
  });
  seek.addEventListener('pointerup', () => {
    seeking = false;
    radio.seekRatio(Number(seek.value) / 1000);
  });
  seek.addEventListener('change', () => {
    seeking = false;
    radio.seekRatio(Number(seek.value) / 1000);
  });

  radio.subscribe(syncUi);
  syncUi();
}

export function renderMusicMountShell(): string {
  return `<div class="hr-music" id="hrMusicRoot" aria-label="次元电台"><p class="hr-music-loading">电台连接中…</p></div>`;
}

export function renderLyricBar(): string {
  return (
    `<section class="hr-lyric-bar hr-glass hr-reveal" id="hrLyricBar" aria-live="polite" aria-label="歌词字幕">` +
    `<span class="hr-lyric-ico" aria-hidden="true">♪</span>` +
    `<p class="hr-lyric-text" id="hrLyricText">♪ 次元电台待命中</p>` +
    `<span class="hr-lyric-note" aria-hidden="true">LYRICS</span>` +
    `</section>`
  );
}

export function renderGlitchText(text: string, className = 'hr-glitch'): string {
  const t = escapeHtml(text);
  return `<span class="${className}" data-text="${t}">${t}</span>`;
}
