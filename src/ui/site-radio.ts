import type { HomeMusicConfig, HomeMusicTrack } from '../types/config';
import { sitePath } from '../utils/site-path';

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  cover: string;
  url: string;
  lrcUrl?: string;
};

type PersistState = {
  playlistId: string;
  tracks: MusicTrack[];
  index: number;
  currentTime: number;
  playing: boolean;
  updatedAt: number;
};

const STORAGE_KEY = 'askuary_site_radio_v3';
/** 网易云 VIP 试听常见约 30s；略放宽以免误伤短曲 */
const TRIAL_MAX_SEC = 35;
const METING_BASES = [
  'https://api.injahow.cn/meting/',
  'https://api.i-meto.com/meting/api',
];

type Listener = () => void;

function metingUrl(base: string, params: Record<string, string>): string {
  const q = new URLSearchParams({ server: 'netease', ...params });
  return `${base}?${q}`;
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function parseTrack(raw: Record<string, unknown>, fallbackId = ''): MusicTrack | null {
  const url = String(raw.url || raw.src || '');
  if (!url) return null;
  const idMatch = /[?&]id=(\d+)/.exec(url) || /[?&]id=(\d+)/.exec(String(raw.lrc || ''));
  const id = String(raw.id || idMatch?.[1] || fallbackId || '').trim();
  return {
    id: id || fallbackId || url,
    title: String(raw.name || raw.title || '未知曲目'),
    artist: String(raw.artist || raw.author || '未知艺术家'),
    cover: String(raw.pic || raw.cover || ''),
    url,
    lrcUrl: String(raw.lrc || raw.lrcUrl || '') || undefined,
  };
}

function fromLocalEntry(raw: HomeMusicTrack, index: number): MusicTrack | null {
  const url = String(raw.url || '').trim();
  if (!url) return null;
  const id = String(raw.id || raw.neteaseId || `local-${index + 1}`).trim();
  return {
    id,
    title: String(raw.title || '未知曲目'),
    artist: String(raw.artist || 'ASKUARY'),
    cover: String(raw.cover || ''),
    url: sitePath(url),
    lrcUrl: raw.lrc || raw.lrcUrl ? sitePath(String(raw.lrc || raw.lrcUrl)) : undefined,
  };
}

function tracksFromPlaylistPayload(data: unknown): MusicTrack[] {
  if (!data || typeof data !== 'object') return [];
  const root = data as { tracks?: unknown; playlist?: unknown };
  const list = Array.isArray(root.tracks)
    ? root.tracks
    : Array.isArray(root.playlist)
      ? root.playlist
      : Array.isArray(data)
        ? data
        : [];
  return list
    .map((item, i) =>
      item && typeof item === 'object'
        ? fromLocalEntry(item as HomeMusicTrack, i)
        : null,
    )
    .filter((t): t is MusicTrack => !!t);
}

async function loadLocalTracks(music?: HomeMusicConfig): Promise<MusicTrack[]> {
  const inline = (music?.playlist || [])
    .map((item, i) => fromLocalEntry(item, i))
    .filter((t): t is MusicTrack => !!t);
  if (inline.length) return inline;

  const playlistUrl = String(
    music?.playlistUrl ||
      (music?.source === 'local' ? '/data/music-playlist.json' : ''),
  ).trim();
  if (!playlistUrl) return [];

  const data = await fetchJson(sitePath(playlistUrl));
  return tracksFromPlaylistPayload(data);
}

export async function fetchPlaylistTracks(playlistId: string): Promise<MusicTrack[]> {
  for (const base of METING_BASES) {
    const data = await fetchJson(metingUrl(base, { type: 'playlist', id: playlistId }));
    if (!Array.isArray(data) || !data.length) continue;
    const tracks = data
      .map((item) =>
        item && typeof item === 'object' ? parseTrack(item as Record<string, unknown>) : null,
      )
      .filter((t): t is MusicTrack => !!t);
    if (tracks.length) return tracks;
  }
  return [];
}

function fingerprintTracks(tracks: MusicTrack[]): string {
  const fp = tracks.map((t) => `${t.id}|${t.url}`).join(';;');
  let hash = 0;
  for (let i = 0; i < fp.length; i += 1) {
    hash = (Math.imul(31, hash) + fp.charCodeAt(i)) | 0;
  }
  return `${tracks.length}:${hash}`;
}

async function loadTracks(music?: HomeMusicConfig): Promise<{ playlistId: string; tracks: MusicTrack[] }> {
  const source = String(music?.source || 'auto').toLowerCase();
  const preferLocal =
    source === 'local' ||
    source === 'self' ||
    Boolean(music?.playlistUrl) ||
    (music?.playlist || []).some((t) => Boolean(t?.url));

  if (preferLocal || source === 'auto') {
    const local = await loadLocalTracks(music);
    if (local.length) {
      return {
        playlistId: `local:${music?.playlistUrl || 'inline'}:${fingerprintTracks(local)}`,
        tracks: local,
      };
    }
    if (source === 'local' || source === 'self') {
      return { playlistId: 'local:empty', tracks: [] };
    }
  }

  if (source !== 'local' && source !== 'self') {
    const playlistId = String(music?.playlistId || '').trim();
    if (playlistId) {
      const list = await fetchPlaylistTracks(playlistId);
      if (list.length) {
        return {
          playlistId: `netease:${playlistId}:${fingerprintTracks(list)}`,
          tracks: list,
        };
      }
    }
  }

  return {
    playlistId: 'fallback:empty',
    tracks: [],
  };
}

function readPersist(): PersistState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistState;
    if (!data || !Array.isArray(data.tracks) || !data.tracks.length) return null;
    return data;
  } catch {
    return null;
  }
}

function writePersist(state: PersistState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

class SiteRadio {
  readonly audio: HTMLAudioElement;
  tracks: MusicTrack[] = [];
  playlistId = '';
  index = 0;
  private listeners = new Set<Listener>();
  private ready = false;
  private persistTimer = 0;
  private bound = false;
  /** 用户意图是否播放（换页时 audio 可能被浏览器暂停） */
  private wantPlaying = false;
  /** 本轮已判定为试听并跳过的下标；整表都是试听时清空并照播 */
  private trialSkip = new Set<number>();
  private skipTrial = true;

  constructor() {
    let audio = document.getElementById('askuarySiteRadio') as HTMLAudioElement | null;
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = 'askuarySiteRadio';
      audio.preload = 'metadata';
      audio.crossOrigin = 'anonymous';
      audio.style.display = 'none';
      document.body.appendChild(audio);
    }
    this.audio = audio;
    this.bindAudio();
  }

  private bindAudio(): void {
    if (this.bound) return;
    this.bound = true;
    const emit = () => this.emit();
    this.audio.addEventListener('timeupdate', () => {
      this.schedulePersist();
      emit();
    });
    this.audio.addEventListener('play', emit);
    this.audio.addEventListener('pause', emit);
    this.audio.addEventListener('loadedmetadata', () => {
      this.maybeSkipTrial();
      emit();
    });
    this.audio.addEventListener('durationchange', () => {
      this.maybeSkipTrial();
    });
    this.audio.addEventListener('ended', () => {
      void this.next(true);
    });
    window.addEventListener('pagehide', () => this.persist(true));
    window.addEventListener('beforeunload', () => this.persist(true));
  }

  /** 当前音频是否像 VIP 试听片段 */
  private isLikelyTrial(): boolean {
    const d = this.audio.duration;
    return Number.isFinite(d) && d > 0 && d <= TRIAL_MAX_SEC;
  }

  private maybeSkipTrial(): void {
    if (!this.skipTrial || !this.tracks.length) return;
    if (!this.isLikelyTrial()) {
      this.trialSkip.clear();
      return;
    }
    if (this.trialSkip.has(this.index)) return;
    this.trialSkip.add(this.index);
    if (this.trialSkip.size >= this.tracks.length) {
      // 歌单几乎全是试听：停止跳过，允许听 30s
      this.trialSkip.clear();
      return;
    }
    void this.applyTrack(this.index + 1, this.wantPlaying, 0);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  get track(): MusicTrack | null {
    return this.tracks[this.index] || null;
  }

  get playing(): boolean {
    return !this.audio.paused;
  }

  private schedulePersist(): void {
    window.clearTimeout(this.persistTimer);
    this.persistTimer = window.setTimeout(() => this.persist(false), 400);
  }

  persist(_force?: boolean): void {
    if (!this.tracks.length) return;
    writePersist({
      playlistId: this.playlistId,
      tracks: this.tracks,
      index: this.index,
      currentTime: this.audio.currentTime || 0,
      playing: this.wantPlaying,
      updatedAt: Date.now(),
    });
  }

  async ensure(music?: HomeMusicConfig): Promise<boolean> {
    // 自建源默认不跳试听；网易云默认跳
    const source = String(music?.source || '').toLowerCase();
    const isLocal = source === 'local' || source === 'self' || Boolean(music?.playlistUrl);
    this.skipTrial =
      music?.skipTrial !== undefined ? music.skipTrial !== false : !isLocal;

    const loaded = await loadTracks(music);
    if (this.ready && this.tracks.length && this.playlistId === loaded.playlistId) {
      return true;
    }

    const saved = readPersist();
    if (
      saved?.tracks?.length &&
      saved.playlistId === loaded.playlistId &&
      loaded.tracks.length
    ) {
      this.playlistId = saved.playlistId;
      this.tracks = saved.tracks;
      this.index = Math.max(0, Math.min(saved.index, this.tracks.length - 1));
      this.ready = true;
      this.wantPlaying = Boolean(saved.playing);
      this.trialSkip.clear();
      await this.applyTrack(this.index, false, saved.currentTime);
      if (saved.playing) {
        await this.play();
      }
      this.emit();
      return true;
    }

    this.playlistId = loaded.playlistId;
    this.tracks = loaded.tracks;
    this.ready = true;
    this.trialSkip.clear();
    if (this.tracks.length) {
      await this.applyTrack(0, false, 0);
      this.persist();
    }
    this.emit();
    return this.tracks.length > 0;
  }

  private async applyTrack(i: number, autoplay: boolean, seekTo = 0): Promise<void> {
    if (!this.tracks.length) return;
    this.index = ((i % this.tracks.length) + this.tracks.length) % this.tracks.length;
    const t = this.tracks[this.index];
    if (this.audio.src !== t.url) {
      this.audio.src = t.url;
    }
    const onMeta = () => {
      if (seekTo > 0 && Number.isFinite(this.audio.duration)) {
        this.audio.currentTime = Math.min(seekTo, Math.max(0, this.audio.duration - 0.25));
      }
      this.audio.removeEventListener('loadedmetadata', onMeta);
      this.emit();
    };
    if (this.audio.readyState >= 1) onMeta();
    else this.audio.addEventListener('loadedmetadata', onMeta);
    this.emit();
    if (autoplay) await this.play();
    this.persist();
  }

  async play(): Promise<void> {
    this.wantPlaying = true;
    try {
      await this.audio.play();
      this.persist();
      this.emit();
    } catch {
      this.emit();
    }
  }

  pause(): void {
    this.wantPlaying = false;
    this.audio.pause();
    this.persist();
    this.emit();
  }

  toggle(): void {
    if (this.audio.paused) void this.play();
    else this.pause();
  }

  async next(autoplay = true): Promise<void> {
    await this.applyTrack(this.index + 1, autoplay, 0);
  }

  async prev(autoplay = true): Promise<void> {
    await this.applyTrack(this.index - 1, autoplay, 0);
  }

  seekRatio(ratio: number): void {
    if (!this.audio.duration) return;
    this.audio.currentTime = Math.max(0, Math.min(1, ratio)) * this.audio.duration;
    this.persist();
    this.emit();
  }
}

let singleton: SiteRadio | null = null;

export function getSiteRadio(): SiteRadio {
  if (!singleton) singleton = new SiteRadio();
  return singleton;
}

export function formatRadioTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function isHomeMusicPage(): boolean {
  return Boolean(document.getElementById('hrMusicRoot'));
}
