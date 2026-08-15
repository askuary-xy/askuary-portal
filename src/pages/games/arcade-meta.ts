import type { AnyIcon } from '@pxlkit/core';
import {
  Axe,
  Bomb,
  Boots,
  Chest,
  Coin,
  Crown,
  Flag,
  Gem,
  Heart,
  Key,
  Lightning,
  Medal,
  Potion,
  QuestCompass,
  QuestMap,
  Ring,
  Scroll,
  Shield,
  SparkleStar,
  Star,
  Sword,
  Target,
  Trophy,
} from '@pxlkit/gamification';
import { Clock, Hourglass, Megaphone, MessageSquare, Sparkles } from '@pxlkit/feedback';

export type GameStats = {
  playMs: number;
  sessionMs: number;
  sessions: number;
  lastPlayedAt: number;
  firstPlayedAt: number;
  achievements: string[];
  quests: string[];
  playedDays: string[];
  propClicks: number;
  shared: boolean;
  rated: boolean;
  galleryPosts: number;
  wikiOpened: boolean;
};

export type ArcadeStore = {
  games: Record<string, GameStats>;
};

export type AchievementDef = {
  id: string;
  title: string;
  desc: string;
  icon: AnyIcon;
  tier: 'bronze' | 'silver' | 'gold' | 'legend';
};

export type QuestDef = {
  id: string;
  title: string;
  desc: string;
  icon: AnyIcon;
  reward: string;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_boot', title: '插入卡带', desc: '第一次按下 START', icon: Key, tier: 'bronze' },
  { id: 'play_5m', title: '热身五分钟', desc: '累计游玩满 5 分钟', icon: Hourglass, tier: 'bronze' },
  { id: 'play_15m', title: '热身完毕', desc: '累计游玩满 15 分钟', icon: Boots, tier: 'bronze' },
  { id: 'play_30m', title: '道馆练习生', desc: '累计游玩满 30 分钟', icon: Sword, tier: 'silver' },
  { id: 'play_1h', title: '训练家之路', desc: '累计游玩满 1 小时', icon: Shield, tier: 'silver' },
  { id: 'play_2h', title: '联盟候补', desc: '累计游玩满 2 小时', icon: Trophy, tier: 'gold' },
  { id: 'play_5h', title: '厅堂传说', desc: '累计游玩满 5 小时', icon: Crown, tier: 'legend' },
  { id: 'session_45m', title: '马拉松局', desc: '单次开局游玩满 45 分钟', icon: Target, tier: 'gold' },
  { id: 'night_owl', title: '夜间训练', desc: '在 22:00 后开过局', icon: Sparkles, tier: 'silver' },
  { id: 'early_bird', title: '清晨特训', desc: '在 7:00 前开过局', icon: SparkleStar, tier: 'silver' },
  { id: 'comeback', title: '再战一天', desc: '间隔超过 24 小时后回归', icon: Ring, tier: 'bronze' },
  { id: 'streak_3', title: '三日连胜', desc: '在 3 个不同日期开过局', icon: Flag, tier: 'silver' },
  { id: 'streak_7', title: '一周修行', desc: '在 7 个不同日期开过局', icon: Medal, tier: 'gold' },
  { id: 'share_hero', title: '街机广播员', desc: '分享本页一次', icon: Megaphone, tier: 'bronze' },
  { id: 'critic', title: '道馆评审', desc: '给游戏打分一次', icon: Star, tier: 'bronze' },
  { id: 'curator', title: '画廊馆长', desc: '在玩家画廊发布一条', icon: Scroll, tier: 'silver' },
  { id: 'prop_touch', title: '宇宙拾荒', desc: '点击背景道具 5 次', icon: Gem, tier: 'bronze' },
  { id: 'prop_hunter', title: '星际收藏家', desc: '点击背景道具 20 次', icon: Chest, tier: 'gold' },
  { id: 'wiki_reader', title: '攻略学者', desc: '打开攻略维基面板', icon: QuestMap, tier: 'bronze' },
  { id: 'social', title: '留言板常客', desc: '打开评论区互动', icon: MessageSquare, tier: 'bronze' },
  { id: 'collector', title: '徽章收藏家', desc: '解锁任意 10 枚成就', icon: Lightning, tier: 'gold' },
  { id: 'completionist', title: '全图鉴预备', desc: '解锁任意 16 枚成就', icon: Axe, tier: 'legend' },
];

export const QUESTS: QuestDef[] = [
  {
    id: 'q_play_10m',
    title: '今日特训',
    desc: '本局累计再玩 10 分钟',
    icon: Potion,
    reward: '任务章 · 特训',
  },
  {
    id: 'q_props',
    title: '摸摸宇宙',
    desc: '点击任意 3 个背景道具',
    icon: Bomb,
    reward: '任务章 · 拾荒',
  },
  {
    id: 'q_share',
    title: '呼叫队友',
    desc: '使用一键分享',
    icon: Megaphone,
    reward: '任务章 · 广播',
  },
  {
    id: 'q_wiki',
    title: '查阅卷轴',
    desc: '打开攻略维基',
    icon: QuestCompass,
    reward: '任务章 · 学者',
  },
];

export const ICO = {
  time: Clock,
  sessions: Flag,
  badges: Medal,
  live: Coin,
  keys: Key,
  save: Chest,
  ach: Trophy,
  about: Sparkles,
  share: Megaphone,
  wiki: QuestMap,
  news: Megaphone,
  heart: Heart,
  quest: QuestCompass,
};

export function emptyStats(): GameStats {
  return {
    playMs: 0,
    sessionMs: 0,
    sessions: 0,
    lastPlayedAt: 0,
    firstPlayedAt: 0,
    achievements: [],
    quests: [],
    playedDays: [],
    propClicks: 0,
    shared: false,
    rated: false,
    galleryPosts: 0,
    wikiOpened: false,
  };
}

export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function unlock(stats: GameStats, id: string): boolean {
  if (stats.achievements.includes(id)) return false;
  stats.achievements = [...stats.achievements, id];
  return true;
}

export function unlockQuest(stats: GameStats, id: string): boolean {
  if (stats.quests.includes(id)) return false;
  stats.quests = [...stats.quests, id];
  return true;
}

export function evaluateAchievements(
  stats: GameStats,
  opts: { justStarted?: boolean } = {},
): string[] {
  const gained: string[] = [];
  const mark = (id: string) => {
    if (unlock(stats, id)) gained.push(id);
  };

  if (opts.justStarted || stats.sessions > 0) mark('first_boot');
  if (stats.playMs >= 5 * 60_000) mark('play_5m');
  if (stats.playMs >= 15 * 60_000) mark('play_15m');
  if (stats.playMs >= 30 * 60_000) mark('play_30m');
  if (stats.playMs >= 60 * 60_000) mark('play_1h');
  if (stats.playMs >= 2 * 3600_000) mark('play_2h');
  if (stats.playMs >= 5 * 3600_000) mark('play_5h');
  if (stats.sessionMs >= 45 * 60_000) mark('session_45m');

  const hour = new Date().getHours();
  if (opts.justStarted && hour >= 22) mark('night_owl');
  if (opts.justStarted && hour < 7) mark('early_bird');

  if (stats.playedDays.length >= 3) mark('streak_3');
  if (stats.playedDays.length >= 7) mark('streak_7');
  if (stats.shared) mark('share_hero');
  if (stats.rated) mark('critic');
  if (stats.galleryPosts >= 1) mark('curator');
  if (stats.propClicks >= 5) mark('prop_touch');
  if (stats.propClicks >= 20) mark('prop_hunter');
  if (stats.wikiOpened) mark('wiki_reader');
  if (stats.achievements.length >= 10) mark('collector');
  if (stats.achievements.length >= 16) mark('completionist');

  return gained;
}

export function evaluateQuests(stats: GameStats): string[] {
  const gained: string[] = [];
  const mark = (id: string) => {
    if (unlockQuest(stats, id)) gained.push(id);
  };
  if (stats.sessionMs >= 10 * 60_000) mark('q_play_10m');
  if (stats.propClicks >= 3) mark('q_props');
  if (stats.shared) mark('q_share');
  if (stats.wikiOpened) mark('q_wiki');
  return gained;
}

export function formatPlayTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}
