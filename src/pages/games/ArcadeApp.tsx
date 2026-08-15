import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AnimatedPxlKitIcon,
  PxlKitIcon,
  isAnimatedIcon,
  type AnyIcon,
} from '@pxlkit/core';
import {
  Chest,
  Coin,
  Flag,
  Key,
  Medal,
  QuestCompass,
  QuestMap,
  Star,
  Trophy,
} from '@pxlkit/gamification';
import { Clock, Megaphone, Sparkles } from '@pxlkit/feedback';
import {
  PixelBadge,
  PixelButton,
  PixelCard,
  PixelCarousel,
  PixelCarouselItem,
  PixelChip,
  PixelEmptyState,
  PixelFileUpload,
  PixelGrid,
  PixelInput,
  PixelKbd,
  PixelModal,
  PixelProgress,
  PixelSectionHeader,
  PixelStack,
  PixelStarRating,
  PixelStatCard,
  PixelTextarea,
  PixelTextLink,
  PxlKitSurfaceProvider,
  PxlKitToastProvider,
  useToast,
} from '@pxlkit/ui-kit';
import type {
  ArcadeGame,
  ArcadeGallerySeed,
  ArcadeGuideItem,
  ArcadeNewsItem,
  CommentsConfig,
  GamesPageConfig,
  SiteConfig,
} from '../../types/config';
import {
  fetchArcadeGallery,
  fetchArcadeLeaderboard,
  fetchArcadeRatings,
  fetchArcadeVisitor,
  saveArcadeVisitor,
  submitArcadeRating,
  syncArcadeScore,
  uploadArcadeGallery,
  type ArcadeGalleryItem,
  type ArcadeLeaderboardRow,
  type ArcadeRatingSummary,
} from '../../api/arcade-api';
import { sitePath } from '../../utils/site-path';
import { mountLegalFooter } from '../../ui/mount-legal';
import { mountComments } from '../../ui/mount-comments';
import {
  ACHIEVEMENTS,
  QUESTS,
  dayKey,
  emptyStats,
  evaluateAchievements,
  evaluateQuests,
  formatPlayTime,
  unlock,
  type ArcadeStore,
  type GameStats,
} from './arcade-meta';

const STORAGE_KEY = 'askuary_arcade_v2';
const NICK_KEY = 'askuary_arcade_nick_v1';

type PanelId = 'keys' | 'save' | 'share' | 'wiki' | 'news' | 'about' | 'quests' | null;

type ArcadeAppProps = {
  page: GamesPageConfig;
  site: SiteConfig;
  comments?: CommentsConfig;
  onPropClick?: (handler: () => void) => void;
};

function readStore(): ArcadeStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem('askuary_arcade_v1');
      if (legacy) {
        const old = JSON.parse(legacy) as { games?: Record<string, Partial<GameStats>> };
        const next: ArcadeStore = { games: {} };
        for (const [id, st] of Object.entries(old.games || {})) {
          next.games[id] = { ...emptyStats(), ...st, achievements: st.achievements || [] };
        }
        return next;
      }
      return { games: {} };
    }
    const data = JSON.parse(raw) as ArcadeStore;
    return data?.games ? data : { games: {} };
  } catch {
    return { games: {} };
  }
}

function writeStore(store: ArcadeStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

function getStats(store: ArcadeStore, gameId: string): GameStats {
  const cur = store.games[gameId];
  if (!cur) return emptyStats();
  return {
    ...emptyStats(),
    ...cur,
    achievements: cur.achievements || [],
    quests: cur.quests || [],
    playedDays: cur.playedDays || [],
  };
}

function resolveAsset(src?: string): string {
  if (!src) return '';
  if (/^https?:\/\//i.test(src) || src.startsWith('data:')) return src;
  return sitePath(src.startsWith('/') ? src : `/${src}`);
}

function pickActive(page: GamesPageConfig): ArcadeGame | null {
  const games = page.games || [];
  if (!games.length) return null;
  const hit = games.find((g) => g.id === page.activeId);
  if (hit?.embedUrl) return hit;
  return games.find((g) => g.embedUrl && g.playable !== false) || games[0];
}

function Ico({ icon, size = 18 }: { icon: AnyIcon; size?: number }) {
  if (isAnimatedIcon(icon)) {
    return <AnimatedPxlKitIcon icon={icon} size={size} />;
  }
  return <PxlKitIcon icon={icon} size={size} />;
}

class ArcadeErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };

  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

  render() {
    if (this.state.error) {
      return (
        <p className="m-4 border-[3px] border-black bg-black p-4 text-[var(--retro-red)] shadow-[4px_4px_0_#000]">
          街机界面异常：{this.state.error}
        </p>
      );
    }
    return this.props.children;
  }
}

const PANEL_META: Record<
  Exclude<PanelId, null>,
  { title: string; tone: 'cyan' | 'green' | 'gold' | 'purple' | 'red' | 'pink' | 'neutral'; icon: AnyIcon }
> = {
  keys: { title: '键盘映射', tone: 'cyan', icon: Key },
  save: { title: '下载与存档', tone: 'green', icon: Chest },
  wiki: { title: '攻略维基', tone: 'gold', icon: QuestMap },
  share: { title: '一键分享', tone: 'purple', icon: Megaphone },
  news: { title: '新闻公告', tone: 'red', icon: Megaphone },
  quests: { title: '任务板', tone: 'pink', icon: QuestCompass },
  about: { title: '关于本局', tone: 'neutral', icon: Sparkles },
};

function ArcadeInner({ page, site, comments, onPropClick }: ArcadeAppProps) {
  const { toast } = useToast();
  const apiBase = (site.apiBase || '').trim();
  const [store, setStore] = useState(readStore);
  const [activeId, setActiveId] = useState(() => pickActive(page)?.id || '');
  const active = useMemo(
    () => (page.games || []).find((g) => g.id === activeId) || pickActive(page),
    [page, activeId],
  );
  const stats = useMemo(
    () => (active ? getStats(store, active.id) : emptyStats()),
    [store, active],
  );

  const [playing, setPlaying] = useState(false);
  const [panel, setPanel] = useState<PanelId>(null);
  const [nick, setNick] = useState(() => {
    try {
      return localStorage.getItem(NICK_KEY) || '';
    } catch {
      return '';
    }
  });
  const [nickDraft, setNickDraft] = useState('');
  const [nickPromptOpen, setNickPromptOpen] = useState(false);
  const [nickSaving, setNickSaving] = useState(false);
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [gallery, setGallery] = useState<Array<ArcadeGalleryItem | ArcadeGallerySeed & { pending?: boolean; imageUrl?: string }>>(
    () => page.gallerySeed || [],
  );
  const [leaderboard, setLeaderboard] = useState<ArcadeLeaderboardRow[]>([]);
  const [rating, setRating] = useState<ArcadeRatingSummary | null>(null);
  const [uploading, setUploading] = useState(false);
  const sessionRef = useRef('');
  const lastSyncRef = useRef(0);
  const commentsRef = useRef<HTMLDivElement | null>(null);
  const legalRef = useRef<HTMLDivElement | null>(null);
  const socialUnlocked = useRef(false);

  const applyProgress = useCallback((gameId: string, mutator: (st: GameStats) => void, announce = true) => {
    setStore((prev) => {
      const st = getStats(prev, gameId);
      mutator(st);
      const gainedA = evaluateAchievements(st);
      const gainedQ = evaluateQuests(st);
      const next = { ...prev, games: { ...prev.games, [gameId]: st } };
      writeStore(next);
      if (announce) {
        void Promise.resolve().then(() => {
          for (const id of gainedA) {
            const def = ACHIEVEMENTS.find((a) => a.id === id);
            if (def) toast.success(`成就解锁：${def.title}`);
          }
          for (const id of gainedQ) {
            const def = QUESTS.find((q) => q.id === id);
            if (def) toast.success(`任务完成：${def.title}`);
          }
        });
      }
      return next;
    });
  }, [toast]);

  const bumpProp = useCallback(() => {
    if (!active) return;
    applyProgress(active.id, (st) => {
      st.propClicks += 1;
    });
  }, [active, applyProgress]);

  useEffect(() => {
    onPropClick?.(bumpProp);
  }, [onPropClick, bumpProp]);

  const loadRemote = useCallback(async () => {
    if (!apiBase || !active) return;
    try {
      const [g, lb, rt] = await Promise.all([
        fetchArcadeGallery(apiBase, active.id),
        fetchArcadeLeaderboard(apiBase, active.id, 15),
        fetchArcadeRatings(apiBase, active.id),
      ]);
      // 导入后 API 已含种子：按 id / nick+note 去重，避免出现双份投稿
      const seed = page.gallerySeed || [];
      const idKeys = new Set(g.map((it) => it.id).filter(Boolean));
      const contentKeys = new Set(
        g.map((it) => `${(it.nick || '').trim()}|${(it.note || '').trim()}`),
      );
      const extras = seed.filter((s) => {
        if (s.id && idKeys.has(s.id)) return false;
        const soft = `${(s.nick || '').trim()}|${(s.note || '').trim()}`;
        return !contentKeys.has(soft);
      });
      setGallery([...g, ...extras].slice(0, 36));
      setLeaderboard(lb);
      setRating(rt);
    } catch {
      setGallery(page.gallerySeed || []);
    }
  }, [apiBase, active, page.gallerySeed]);

  useEffect(() => {
    void loadRemote();
  }, [loadRemote]);

  useEffect(() => {
    let cancelled = false;
    const bootNick = async () => {
      let local = '';
      try {
        local = localStorage.getItem(NICK_KEY) || '';
      } catch {
        local = '';
      }
      if (!apiBase) {
        if (!local) {
          setNickDraft('');
          setNickPromptOpen(true);
        }
        return;
      }
      try {
        const visitor = await fetchArcadeVisitor(apiBase);
        if (cancelled) return;
        if (visitor.known && visitor.nick) {
          setNick(visitor.nick);
          try {
            localStorage.setItem(NICK_KEY, visitor.nick.slice(0, 24));
          } catch {
            /* ignore */
          }
          setNickPromptOpen(false);
          return;
        }
      } catch {
        /* 接口不可用时回退本地 */
      }
      if (cancelled) return;
      if (!local) {
        setNickDraft('');
        setNickPromptOpen(true);
      }
    };
    void bootNick();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const confirmNick = async () => {
    const value = nickDraft.trim().slice(0, 24);
    if (!value) {
      toast.error('请填写训练家姓名');
      return;
    }
    setNickSaving(true);
    try {
      let saved = value;
      if (apiBase) {
        const res = await saveArcadeVisitor(apiBase, value);
        saved = res.nick || value;
      }
      setNick(saved);
      try {
        localStorage.setItem(NICK_KEY, saved);
      } catch {
        /* ignore */
      }
      setNickPromptOpen(false);
      toast.success(`欢迎，${saved}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setNickSaving(false);
    }
  };

  const pushScore = useCallback(() => {
    if (!apiBase || !active) return;
    const st = getStats(store, active.id);
    if (st.playMs <= 0 || st.playMs === lastSyncRef.current) return;
    lastSyncRef.current = st.playMs;
    void syncArcadeScore(apiBase, {
      gameId: active.id,
      nick: nick || '训练家',
      playMs: st.playMs,
      sessions: st.sessions,
      badges: st.achievements.length,
    }).then(async () => {
      try {
        setLeaderboard(await fetchArcadeLeaderboard(apiBase, active.id, 15));
      } catch {
        /* ignore */
      }
    });
  }, [apiBase, active, nick, store]);

  useEffect(() => {
    if (!playing || !active) return;
    const gameId = active.id;
    const tick = window.setInterval(() => {
      applyProgress(gameId, (st) => {
        st.playMs += 1000;
        st.sessionMs += 1000;
        st.lastPlayedAt = Date.now();
      });
    }, 1000);
    const sync = window.setInterval(() => pushScore(), 30_000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(sync);
      pushScore();
    };
  }, [playing, active, applyProgress, pushScore]);

  useEffect(() => {
    if (!legalRef.current) return;
    void mountLegalFooter(legalRef.current, site.name);
  }, [site.name]);

  useEffect(() => {
    if (!commentsRef.current || !active) return;
    mountComments(commentsRef.current, comments, site.apiBase, `/games/${active.id}/`);
    const el = commentsRef.current;
    const onFocus = () => {
      if (socialUnlocked.current || !active) return;
      socialUnlocked.current = true;
      applyProgress(active.id, (st) => {
        unlock(st, 'social');
      });
    };
    el.addEventListener('focusin', onFocus, { once: true });
    return () => el.removeEventListener('focusin', onFocus);
  }, [active, comments, site.apiBase, applyProgress]);

  const startGame = () => {
    if (!active?.embedUrl) return;
    const gameId = active.id;
    applyProgress(gameId, (st) => {
      const now = Date.now();
      if (st.lastPlayedAt && now - st.lastPlayedAt > 24 * 3600_000) {
        if (unlock(st, 'comeback')) toast.success('成就解锁：再战一天');
      }
      if (sessionRef.current !== gameId) {
        st.sessions += 1;
        st.sessionMs = 0;
        sessionRef.current = gameId;
      }
      if (!st.firstPlayedAt) st.firstPlayedAt = now;
      st.lastPlayedAt = now;
      const day = dayKey();
      if (!st.playedDays.includes(day)) st.playedDays = [...st.playedDays, day].slice(-60);
    });
    setPlaying(true);
  };

  const openPanel = (id: Exclude<PanelId, null>) => {
    setPanel(id);
    if (id === 'wiki' && active) {
      applyProgress(active.id, (st) => {
        st.wikiOpened = true;
      });
    }
  };

  const doShare = async () => {
    if (!active) return;
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${active.title} · ASKUARY`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('链接已复制');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('链接已复制');
      } catch {
        toast.error('分享失败');
        return;
      }
    }
    applyProgress(active.id, (st) => {
      st.shared = true;
    });
  };

  const onRate = async (score: number) => {
    if (!active || !apiBase) {
      toast.error('请先配置站点 apiBase');
      return;
    }
    try {
      await submitArcadeRating(apiBase, active.id, score);
      applyProgress(active.id, (st) => {
        st.rated = true;
      });
      setRating(await fetchArcadeRatings(apiBase, active.id));
      toast.success(`已评分 ${score} 星`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '评分失败');
    }
  };

  const onUpload = async () => {
    if (!active || !apiBase) return;
    const file = files[0];
    if (!nick.trim() || !note.trim() || !file) {
      toast.error('请填写昵称、心得并选择截图');
      return;
    }
    setUploading(true);
    try {
      localStorage.setItem(NICK_KEY, nick.trim().slice(0, 24));
      await uploadArcadeGallery(apiBase, {
        gameId: active.id,
        nick: nick.trim(),
        note: note.trim(),
        file,
      });
      applyProgress(active.id, (st) => {
        st.galleryPosts += 1;
      });
      setFiles([]);
      setNote('');
      toast.success('已提交，通过后会出现在画廊');
      setGallery((prev) => [
        { id: `pending-${Date.now()}`, nick: nick.trim(), note: note.trim(), kind: 'run', pending: true },
        ...prev,
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制');
    } catch {
      toast.error('复制失败');
    }
  };

  if (!active) {
    return (
      <PixelEmptyState
        title="还没有配置游戏"
        description="请编辑 data/games-page.json"
      />
    );
  }

  const achPct = Math.round((stats.achievements.length / ACHIEVEMENTS.length) * 100);
  const shots = (active.screenshots || []).map(resolveAsset).filter(Boolean);

  return (
    <PixelStack gap={6} className="w-full min-w-0 max-w-full pb-8">
      <PixelSectionHeader
        eyebrow={page.kicker || 'ASKUARY ARCADE'}
        title={page.title || '像素街机'}
        description={page.lead || page.insertCoin || 'PRESS START'}
        titleTone="green"
        size="md"
        className="min-w-0"
        actions={
          <PixelBadge tone={playing ? 'green' : 'neutral'} variant="solid">
            {playing ? 'PLAY' : 'IDLE'}
          </PixelBadge>
        }
      />

      <PixelGrid cols={4} gap={3} className="max-md:grid-cols-2 min-w-0">
        <PixelStatCard
          label="TIME"
          value={formatPlayTime(stats.playMs)}
          icon={<Ico icon={Clock} />}
          tone="cyan"
          valueTone
        />
        <PixelStatCard
          label="SESSIONS"
          value={String(stats.sessions)}
          icon={<Ico icon={Flag} />}
          tone="gold"
          valueTone
        />
        <PixelStatCard
          label="BADGES"
          value={`${stats.achievements.length}/${ACHIEVEMENTS.length}`}
          icon={<Ico icon={Medal} />}
          tone="purple"
          valueTone
        />
        <PixelStatCard
          label="STATUS"
          value={playing ? 'PLAY' : 'IDLE'}
          icon={<Ico icon={Coin} />}
          tone="green"
          valueTone
        />
      </PixelGrid>

      <section>
        <PixelSectionHeader eyebrow="LOBBY" title="游戏大厅" description="精选卡带 · 点选上机" size="sm" />
        <div className="gp-h-scroll mt-3 flex gap-3 pb-2">
          {(page.games || []).map((g) => {
            const soon = g.comingSoon || !g.embedUrl;
            const cover = resolveAsset(g.cover);
            return (
              <PixelCard
                key={g.id}
                title={g.title}
                tone={g.id === active.id ? 'green' : 'cyan'}
                interactive={!soon}
                onClick={
                  soon
                    ? undefined
                    : () => {
                        setPlaying(false);
                        setActiveId(g.id);
                      }
                }
                className="gp-cart-card w-[min(200px,68vw)] max-w-[240px] shrink-0 max-md:w-[min(148px,58vw)]"
                footer={
                  soon ? (
                    <PixelBadge tone="gold">COMING SOON</PixelBadge>
                  ) : (
                    <PixelBadge tone="green" variant="outline">
                      SELECT
                    </PixelBadge>
                  )
                }
              >
                {cover ? (
                  <img
                    src={cover}
                    alt=""
                    className="mb-2 h-16 w-full object-cover [image-rendering:pixelated]"
                  />
                ) : null}
                <p className="text-sm opacity-70">{g.subtitle || [g.platform, g.year].filter(Boolean).join(' · ')}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(g.tags || []).slice(0, 3).map((t) => (
                    <PixelChip key={t} label={t} size="sm" />
                  ))}
                </div>
              </PixelCard>
            );
          })}
        </div>
      </section>

      <PixelCard
        title={active.title}
        tone="gold"
        icon={<Ico icon={Trophy} />}
        footer={
          <div className="flex max-w-full flex-wrap gap-2">
            {(Object.keys(PANEL_META) as Exclude<PanelId, null>[]).map((id) => (
              <PixelButton
                key={id}
                size="sm"
                tone={PANEL_META[id].tone}
                variant="outline"
                iconLeft={<Ico icon={PANEL_META[id].icon} size={14} />}
                onClick={() => openPanel(id)}
              >
                {PANEL_META[id].title}
              </PixelButton>
            ))}
          </div>
        }
        className="min-w-0 max-w-full"
      >
        <p className="mb-2 font-pixel text-[12px] tracking-wider text-[var(--retro-gold,#ffe566)]">
          {page.cabinetLabel || 'PLAYER 1'} · {active.platform || 'GBA'}
        </p>
        {(active.tags || []).length ? (
          <div className="mb-3 flex flex-wrap gap-1">
            {active.tags!.map((t) => (
              <PixelBadge key={t} tone="cyan" size="sm" variant="outline">
                {t}
              </PixelBadge>
            ))}
          </div>
        ) : null}
        <div className="gp-screen-wrap">
          {playing && active.embedUrl ? (
            <iframe
              src={active.embedUrl}
              title={active.title}
              allow="gamepad; fullscreen; autoplay"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="gp-screen-placeholder">
              <p className="font-pixel text-[12px] leading-relaxed text-[var(--retro-cyan,#3de7ff)]">
                READY
                <br />
                PLAYER ONE
              </p>
              {active.embedUrl && active.playable !== false ? (
                <PixelButton tone="green" size="lg" iconLeft={<Ico icon={Star} />} onClick={startGame}>
                  START
                </PixelButton>
              ) : (
                <PixelBadge tone="gold">COMING SOON</PixelBadge>
              )}
            </div>
          )}
        </div>
      </PixelCard>

      <PixelCard title="成就墙" tone="gold" icon={<Ico icon={Trophy} />}>
        <PixelProgress value={achPct} tone="green" label={`${stats.achievements.length}/${ACHIEVEMENTS.length}`} />
        <div className="mt-3 grid max-h-72 grid-cols-1 gap-2 overflow-auto sm:grid-cols-2">
          {ACHIEVEMENTS.map((a) => {
            const on = stats.achievements.includes(a.id);
            return (
              <PixelCard
                key={a.id}
                title={a.title}
                tone={on ? 'green' : 'neutral'}
                icon={<Ico icon={a.icon} size={16} />}
                className={on ? '' : 'opacity-45'}
              >
                <p className="text-xs opacity-70">{a.desc}</p>
                <PixelBadge className="mt-2" tone={on ? 'green' : 'neutral'} size="sm">
                  {on ? 'GET' : 'LOCK'}
                </PixelBadge>
              </PixelCard>
            );
          })}
        </div>
      </PixelCard>

      <PixelCard title="排行榜" tone="gold" icon={<Ico icon={Trophy} />}>
        {leaderboard.length ? (
          <ol className="m-0 grid list-none gap-2 p-0">
            {leaderboard.map((r, i) => (
              <li
                key={r.id}
                className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 border-[3px] border-black bg-black/40 px-2 py-1.5 shadow-[3px_3px_0_#000] sm:grid-cols-[2.5rem_1fr_auto_auto]"
              >
                <span className="font-pixel text-[11px] text-[var(--retro-gold)]">#{i + 1}</span>
                <strong className="truncate">{r.nick}</strong>
                <span className="justify-self-end text-sm sm:justify-self-auto">{formatPlayTime(r.playMs)}</span>
                <span className="col-span-3 text-xs opacity-60 sm:col-span-1">
                  {r.badges}★ · {r.sessions}局
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <PixelEmptyState title="暂无上榜" description="开玩后时长会同步到这里" />
        )}
      </PixelCard>

      {shots.length ? (
        <PixelCard title="像素展示" tone="purple" className="min-w-0 max-w-full">
          <div className="gp-carousel-host">
            <PixelCarousel aria-label="游戏截图" showArrows showDots opts={{ loop: true }}>
              {shots.map((src) => (
                <PixelCarouselItem key={src}>
                  <div className="flex h-40 items-center justify-center bg-black/50 sm:h-48">
                    <img
                      src={src}
                      alt=""
                      className="max-h-full max-w-[70%] object-contain [image-rendering:pixelated]"
                    />
                  </div>
                </PixelCarouselItem>
              ))}
            </PixelCarousel>
          </div>
        </PixelCard>
      ) : null}

      <PixelCard title="社区" tone="purple" icon={<Ico icon={Megaphone} />}>
        <PixelStack gap={4}>
          <div>
            <p className="mb-2 font-pixel text-[12px]">评分</p>
            <PixelStarRating
              value={rating?.mine || 0}
              interactive
              showCount
              tone="gold"
              onChange={(n) => void onRate(n)}
            />
            <p className="mt-1 text-xs opacity-60">
              {rating?.count
                ? `${rating.avg.toFixed(1)} · ${rating.count} 票`
                : '还没有评分'}
            </p>
          </div>

          <div>
            <PixelSectionHeader eyebrow="GALLERY" title="玩家画廊" description="上传截图 · 分享战绩" size="sm" />
            <div className="mt-3 grid max-h-56 grid-cols-1 gap-2 overflow-auto sm:grid-cols-2">
              {gallery.length ? (
                gallery.map((g, idx) => (
                  <PixelCard key={`${g.id || g.nick}-${idx}`} title={g.nick} tone="cyan">
                    {'imageUrl' in g && g.imageUrl ? (
                      <a href={g.imageUrl} target="_blank" rel="noopener noreferrer">
                        <img
                          src={g.imageUrl}
                          alt=""
                          className="mb-2 h-24 w-full object-cover [image-rendering:pixelated]"
                        />
                      </a>
                    ) : null}
                    <PixelBadge size="sm" tone={'pending' in g && g.pending ? 'gold' : 'cyan'}>
                      {g.kind || 'tip'}
                      {'pending' in g && g.pending ? ' · WAIT' : ''}
                    </PixelBadge>
                    <p className="mt-2 text-sm opacity-80">{g.note}</p>
                  </PixelCard>
                ))
              ) : (
                <PixelEmptyState title="还没有投稿" description="来当第一个？" />
              )}
            </div>
            {apiBase ? (
              <PixelStack gap={3} className="mt-3">
                <PixelInput
                  label="训练家昵称"
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                  maxLength={20}
                />
                <PixelTextarea
                  label="心得"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={200}
                  rows={2}
                />
                <PixelFileUpload
                  label="选择截图"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  maxSize={2 * 1024 * 1024}
                  maxFiles={1}
                  value={files}
                  onChange={setFiles}
                  dropzone
                />
                <PixelButton
                  tone="green"
                  loading={uploading}
                  iconLeft={<Ico icon={Chest} />}
                  onClick={() => void onUpload()}
                >
                  上传到画廊
                </PixelButton>
              </PixelStack>
            ) : null}
          </div>

          <div className="gp-comments-host" ref={commentsRef} />
        </PixelStack>
      </PixelCard>

      <PixelCard title="NOTICE" tone="red" className="min-w-0 max-w-full">
        <ol className="m-0 list-decimal space-y-2 pl-5 text-sm opacity-75">
          {(page.notices || []).map((n) => (
            <li key={n.slice(0, 24)}>{n}</li>
          ))}
        </ol>
        {page.credit?.hostUrl ? (
          <p className="mt-3 text-sm">
            嵌入来源：
            <PixelTextLink href={page.credit.hostUrl} target="_blank" rel="noopener noreferrer">
              {page.credit.host || 'Host'}
            </PixelTextLink>
            {page.credit.note ? `。${page.credit.note}` : '。'}
          </p>
        ) : null}
      </PixelCard>

      <div className="gp-legal-host" ref={legalRef} />

      <PixelModal
        open={panel !== null}
        title={panel ? PANEL_META[panel].title : ''}
        onClose={() => setPanel(null)}
        size="lg"
        closeLabel="关闭"
      >
        {panel === 'keys' ? (
          <PixelStack gap={3}>
            <p className="text-sm opacity-70">嵌套模拟器键位可能略有差异；推荐外接手柄。</p>
            {(active.controls || []).map((c) => (
              <div key={c.keys} className="grid grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)] items-start gap-2 sm:grid-cols-[7rem_1fr]">
                <PixelKbd>{c.keys}</PixelKbd>
                <span className="text-sm break-words">{c.action}</span>
              </div>
            ))}
          </PixelStack>
        ) : null}
        {panel === 'save' ? (
          <PixelStack gap={3}>
            <ol className="list-decimal space-y-2 pl-5 text-sm opacity-80">
              {(active.saveTips || []).map((t) => (
                <li key={t.slice(0, 20)}>{t}</li>
              ))}
            </ol>
            {(active.downloadUrl || active.sourceUrl) && (
              <PixelButton
                tone="green"
                asChild
              >
                <a
                  href={active.downloadUrl || active.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  打开原站 / 下载 ROM
                </a>
              </PixelButton>
            )}
          </PixelStack>
        ) : null}
        {panel === 'wiki' ? (
          <PixelStack gap={4}>
            {(page.guides || []).map((g: ArcadeGuideItem) => (
              <PixelCard key={g.id} title={g.title} tone="gold">
                <p className="text-sm opacity-80">{g.summary}</p>
                {g.copyText ? (
                  <>
                    <pre className="mt-2 whitespace-pre-wrap border-[3px] border-black bg-black/50 p-2 text-xs text-[var(--retro-cyan)] shadow-[3px_3px_0_#000]">
                      {g.copyText}
                    </pre>
                    <PixelButton className="mt-2" size="sm" tone="cyan" onClick={() => void copyText(g.copyText!)}>
                      {g.copyLabel || '一键复制'}
                    </PixelButton>
                  </>
                ) : null}
              </PixelCard>
            ))}
          </PixelStack>
        ) : null}
        {panel === 'news' ? (
          <PixelStack gap={3}>
            {(page.news || []).map((n: ArcadeNewsItem) => (
              <PixelCard key={n.id} title={n.title} tone="red">
                <PixelBadge size="sm" tone="red">
                  {n.tag || 'NEWS'}
                </PixelBadge>
                <p className="mt-1 text-xs opacity-50">{n.date}</p>
                <p className="mt-2 text-sm opacity-80">{n.body}</p>
              </PixelCard>
            ))}
          </PixelStack>
        ) : null}
        {panel === 'quests' ? (
          <PixelStack gap={2}>
            {QUESTS.map((q) => {
              const on = stats.quests.includes(q.id);
              return (
                <PixelCard key={q.id} title={q.title} tone={on ? 'green' : 'pink'} icon={<Ico icon={q.icon} size={16} />}>
                  <p className="text-sm opacity-75">{q.desc}</p>
                  <p className="mt-1 text-xs text-[var(--retro-gold)]">奖励：{q.reward}</p>
                  <PixelBadge className="mt-2" size="sm" tone={on ? 'green' : 'neutral'}>
                    {on ? 'DONE' : '…'}
                  </PixelBadge>
                </PixelCard>
              );
            })}
          </PixelStack>
        ) : null}
        {panel === 'share' ? (
          <PixelStack gap={3}>
            <p className="text-sm opacity-80">分享本页可解锁「街机广播员」勋章。</p>
            <PixelButton tone="purple" iconLeft={<Ico icon={Megaphone} />} onClick={() => void doShare()}>
              一键分享 / 复制链接
            </PixelButton>
          </PixelStack>
        ) : null}
        {panel === 'about' ? (
          <PixelStack gap={3}>
            <p className="font-pixel text-[12px] tracking-wider text-[var(--retro-gold,#ffe566)]">
              {active.title}
              {active.subtitle ? ` · ${active.subtitle}` : ''}
            </p>
            {active.blurb ? <p className="text-sm leading-relaxed opacity-80">{active.blurb}</p> : null}
            {(active.features || []).length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm opacity-75">
                {(active.features || []).map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm opacity-60">切换大厅卡带后，这里会显示对应介绍。</p>
            )}
          </PixelStack>
        ) : null}
      </PixelModal>

      <PixelModal
        open={nickPromptOpen}
        title="训练家登记"
        onClose={() => setNickPromptOpen(false)}
        size="md"
        closeLabel="稍后"
      >
        <PixelStack gap={3}>
          <p className="text-sm opacity-80">
            首次进入街机请填写姓名，用于排行榜统计。同一网络（同 IP）的其他设备不会再弹此提示。
          </p>
          <PixelInput
            label="姓名 / 昵称"
            value={nickDraft}
            onChange={(e) => setNickDraft(e.target.value)}
            maxLength={20}
            placeholder="例如：赤红"
          />
          <PixelButton tone="green" loading={nickSaving} onClick={() => void confirmNick()}>
            确认登记
          </PixelButton>
        </PixelStack>
      </PixelModal>
    </PixelStack>
  );
}

export function ArcadeApp(props: ArcadeAppProps) {
  return (
    <ArcadeErrorBoundary>
      <PxlKitSurfaceProvider surface="pixel">
        <PxlKitToastProvider position="bottom-center" surface="pixel">
          <div className="dark min-h-screen w-full min-w-0 max-w-full overflow-x-clip text-[var(--retro-fg,#e8ecff)]">
            <ArcadeInner {...props} />
          </div>
        </PxlKitToastProvider>
      </PxlKitSurfaceProvider>
    </ArcadeErrorBoundary>
  );
}

export function mountArcadeApp(el: HTMLElement, props: ArcadeAppProps): () => void {
  const root = createRoot(el);
  root.render(<ArcadeApp {...props} />);
  return () => root.unmount();
}
