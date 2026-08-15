/** 站点基础信息 */
export interface SiteConfig {
  name: string;
  /** 静态简介（无 taglines 时显示） */
  intro: string;
  /** 打字机轮播句，优先于 intro */
  taglines?: string[];
  avatar: string;
  avatarAlt?: string;
  /** 为 false 或 avatar 为空时不显示头像 */
  showAvatar?: boolean;
  /** 品牌字标 / logo 图 */
  logo?: string;
  /** 黑洞穿越目标（站点主页）；warpEnabled 为 false 时不跳转 */
  homeUrl?: string;
  /** @deprecated 旧字段，等同 homeUrl */
  blogUrl?: string;
  warpEnabled?: boolean;
  warpHint?: string;
  /** RSS / 绝对链接用，如 https://example.com/ */
  siteUrl?: string;
  /** Nest API 根地址，如 https://www.askuary.cn */
  apiBase?: string;
  /**
   * 随机封面图 API 模板。可用 {seed}/{slug}/{kind}，例如：
   * https://t.alcy.cc/moe/?t={seed}
   * /api/covers/{kind}/img?seed={seed}
   */
  coverImageApi?: string;
  /** 无显式封面时是否使用 coverImageApi，默认 true */
  coverRandom?: boolean;
  /** 主页/文章壳背景随机图，如 https://t.alcy.cc/fj/ */
  homeBackgroundApi?: string;
  /** 高德 JS API Key（必填才能显示足迹地图；控制台开「Web端(JS API)」并配域名） */
  amapKey?: string;
  /** 高德安全密钥 securityJsCode（JS API 2.0 通常需要） */
  amapSecurityJsCode?: string;
  /** 作者简介（摄影故事页等） */
  authorBio?: string;
  /** 天气小部件默认配置 */
  weather?: {
    enabled?: boolean;
    city?: string;
    lat?: number;
    lng?: number;
  };
  social?: SocialLink[];
}

export interface SocialLink {
  label: string;
  url: string;
  icon?: string;
}

/** 背景导航恒星 — 点击弹出入口 */
export interface NavStar {
  id: string;
  label: string;
  desc?: string;
  url: string;
  icon?: string;
  /** false 时仅展示「即将开放」 */
  enabled?: boolean;
  disabledHint?: string;
  x?: number;
  y?: number;
}

/** 地球光点 */
export interface EarthSpot {
  lat: number;
  lng: number;
  title: string;
  text: string;
  style: 'star' | 'amber' | 'violet' | 'rose' | 'mint' | 'ember' | 'friend';
  url?: string;
  linkLabel?: string;
  avatar?: string;
}

/** 友联卫星 */
export interface Friend {
  title: string;
  text: string;
  avatar?: string;
  /** 站点截图（友联页卡片展示） */
  screenshot?: string;
  url: string;
  linkLabel?: string;
}

/** 流星文字 */
export interface MeteorWord {
  text: string;
  author?: string;
}

export interface AboutSection {
  heading: string;
  body: string;
}

export interface AboutLink {
  label: string;
  url: string;
  icon?: string;
}

export interface AboutPageConfig {
  title: string;
  lead?: string;
  sections: AboutSection[];
  links?: AboutLink[];
}

export interface PortalConfig {
  site: SiteConfig;
  navStars: NavStar[];
  spots: EarthSpot[];
  friends: Friend[];
  meteorWords: MeteorWord[];
}

export interface AboutPageData {
  about: AboutPageConfig;
  site: SiteConfig;
  meteorWords: MeteorWord[];
}

export interface FriendsExchangeConfig {
  title: string;
  subtitle?: string;
  siteName: string;
  siteUrl: string;
  description: string;
  logo?: string;
  avatar?: string;
  /** 本站截图，用于「复制我的友联」与表单示例 */
  screenshot?: string;
  /** 站长联系邮箱 */
  email?: string;
  requirements?: string[];
  applyHint?: string;
  /** 申请入口，如 mailto: */
  applyUrl?: string;
}

export interface FriendsPageConfig {
  title: string;
  lead?: string;
  empty?: string;
  /** Nest API 根地址，如 https://www.askuary.cn */
  apiBase?: string;
  exchange?: FriendsExchangeConfig;
  links?: AboutLink[];
}

export type FriendApplicationStatus = 'pending' | 'approved' | 'rejected';
export type FriendApplicationType = 'new' | 'update';

export interface FriendApplication {
  id: string;
  name: string;
  url?: string;
  description?: string;
  /** new=新增申请，update=修改信息 */
  type?: FriendApplicationType;
  status: FriendApplicationStatus;
  rejectReason?: string;
  reviewedAt?: string;
  /** ISO 日期，如 2026-07-17 */
  createdAt?: string;
}

export interface FriendApplicationsData {
  applications: FriendApplication[];
}

export interface CommentItem {
  id: string;
  author: string;
  content: string;
  date: string;
  website?: string;
}

export interface GiscusConfig {
  enabled?: boolean;
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
  mapping?: string;
  theme?: string;
  lang?: string;
  inputPosition?: string;
  reactionsEnabled?: string;
}

export interface CommentsConfig {
  enabled?: boolean;
  title?: string;
  empty?: string;
  /** 留言发往的邮箱；缺省用友联页 exchange.email */
  mailto?: string;
  items?: CommentItem[];
  giscus?: GiscusConfig;
}

export interface FriendsPageData {
  page: FriendsPageConfig;
  site: SiteConfig;
  friends: Friend[];
  meteorWords: MeteorWord[];
  applications: FriendApplication[];
  comments: CommentsConfig;
}

export interface BlogPostMeta {
  slug: string;
  title: string;
  date: string;
  summary?: string;
  /** AI 摘要（文章页展示）；缺省时可用 summary */
  aiSummary?: string;
  /** 结合本文的「介绍自己」文案 */
  aiSelfIntro?: string;
  /** 文章大纲（多行，`- ` 列表） */
  aiOutline?: string;
  /** 为 false 时不在正文页显示 AI 摘要框 */
  showAiSummary?: boolean;
  tags?: string[];
  /** 封面图 URL；空则可用正文首图或站点 coverImageApi */
  cover?: string;
  /** 来自 API 入库发布时为 api；静态 Markdown 构建为 static */
  origin?: 'api' | 'static';
}

export interface BlogPost extends BlogPostMeta {
  html: string;
}

export interface BlogPageConfig {
  title: string;
  lead?: string;
  empty?: string;
  links?: AboutLink[];
}

export interface BlogListPageData {
  page: BlogPageConfig;
  site: SiteConfig;
  posts: BlogPostMeta[];
  meteorWords: MeteorWord[];
}

export interface BlogPostPageData {
  post: BlogPost;
  site: SiteConfig;
  meteorWords: MeteorWord[];
}

export interface HomeSection {
  heading: string;
  body: string;
}

export interface HomeShowcase {
  title: string;
  desc?: string;
  url: string;
  icon?: string;
}

export interface HomeNotice {
  title: string;
  body?: string;
  date?: string;
  tag?: string;
  url?: string;
}

export interface HomeMusicTrack {
  /** 网易云单曲 ID（可选；自建 mp3 可不填） */
  neteaseId?: string;
  id?: string;
  title?: string;
  artist?: string;
  cover?: string;
  /** 自建音频地址，如 /media/music/foo.mp3 */
  url?: string;
  /** 歌词 LRC 地址（可选） */
  lrc?: string;
  lrcUrl?: string;
}

export interface HomeMusicConfig {
  /**
   * local = 自建 mp3（playlist / playlistUrl）
   * netease = 网易云歌单（playlistId）
   * 默认：有本地曲目用本地，否则网易云
   */
  source?: 'local' | 'netease' | 'auto';
  /** 网易云歌单 ID */
  playlistId?: string;
  neteaseId?: string;
  title?: string;
  artist?: string;
  cover?: string;
  /** 内联曲目（含 url 的自建项，或仅 neteaseId） */
  playlist?: HomeMusicTrack[];
  /** 外置歌单 JSON，如 /data/music-playlist.json */
  playlistUrl?: string;
  /** 自动跳过网易云 VIP 试听（约 ≤35s）；自建源默认关闭 */
  skipTrial?: boolean;
}

export interface HomeGalleryConfig {
  image?: string;
  title?: string;
  caption?: string;
  url?: string;
}

export interface HomePageConfig {
  title: string;
  tagline?: string;
  /** 首屏简介（优先于 tagline） */
  bio?: string;
  heroIntro?: string;
  sections?: HomeSection[];
  showcases?: HomeShowcase[];
  /** 主页「次元波动」滚动短句（不跟文章发布） */
  waveLines?: string[];
  /** 像素宠物气泡文案 */
  petLines?: string[];
  /** 背景滚动励志字 */
  bgQuotes?: string[];
  waveTitle?: string;
  waveLead?: string;
  postsTitle?: string;
  postsLimit?: number;
  empty?: string;
  nav?: AboutLink[];
  links?: AboutLink[];
  /** 公告栏 */
  notices?: HomeNotice[];
  /** 网易云音乐卡片 */
  music?: HomeMusicConfig;
  /** 图展 / 站点掠影 */
  gallery?: HomeGalleryConfig;
  weather?: {
    enabled?: boolean;
    city?: string;
    lat?: number;
    lng?: number;
  };
  widgets?: {
    weather?: {
      enabled?: boolean;
      city?: string;
      lat?: number;
      lng?: number;
    };
    themeDefault?: 'light' | 'dark' | 'auto';
    allowThemeSwitch?: boolean;
  };
  themeDefault?: 'light' | 'dark' | 'auto';
}

export interface HomePageData {
  page: HomePageConfig;
  site: SiteConfig;
  posts: BlogPostMeta[];
}

export interface JournalPost extends BlogPostMeta {
  html: string;
}

export interface JournalPostPageData {
  post: JournalPost;
  site: SiteConfig;
}

export interface ArchiveEntry extends BlogPostMeta {
  source: 'blog' | 'journal';
  path: string;
}

export interface ArchiveIndex {
  entries: ArchiveEntry[];
  tags: string[];
}

export interface ArchivePageConfig {
  title: string;
  lead?: string;
  empty?: string;
  emptyTag?: string;
  links?: AboutLink[];
}

export interface ArchivePageData {
  page: ArchivePageConfig;
  site: SiteConfig;
  archive: ArchiveIndex;
  meteorWords: MeteorWord[];
}

export interface PhotoStoryMusic {
  neteaseId: string;
  title?: string;
  artist?: string;
}

export interface PhotoStory {
  intro?: string;
  device?: string;
  timeLabel?: string;
  locationLabel?: string;
  weather?: string;
  authorBio?: string;
  music?: PhotoStoryMusic | null;
}

/** @deprecated 使用 PhotoStory */
export type PhotoAlbumStory = PhotoStory;
/** @deprecated 使用 PhotoStoryMusic */
export type PhotoAlbumMusic = PhotoStoryMusic;

export interface PhotoMetaItem {
  id: string;
  file: string;
  src: string;
  thumb: string;
  album: string;
  date: string;
  time?: string;
  location: string;
  category: string;
  note: string;
  title: string;
  /** 拍摄设备（EXIF 或清单覆盖） */
  device?: string;
  lat: number | null;
  lng: number | null;
  /** 单图故事（介绍 / 设备 / 时间 / 地点 / 天气 / 音乐） */
  story?: PhotoStory | null;
  sortTs: number;
}

export interface PhotoAlbum {
  key: string;
  label: string;
  description?: string;
  theme?: string;
  cover: string;
  count: number;
  latestDate?: string;
  /** API / DB 相册日期（同步自行程文件夹或后台编辑） */
  date?: string;
  story?: PhotoStory | null;
}

export interface PhotoMapPoint {
  lat: number;
  lng: number;
  label: string;
  photos: { index: number; id: string; title: string; thumb: string }[];
}

export interface PhotowallIndex {
  albums: PhotoAlbum[];
  photos: PhotoMetaItem[];
  categories: string[];
  mapPoints: PhotoMapPoint[];
  generatedAt?: string;
}

export interface PhotosPageConfig {
  title: string;
  lead?: string;
  empty?: string;
  heroKicker?: string;
  viewTitle?: string;
  viewLead?: string;
  noteTitle?: string;
  categories?: string[];
  links?: AboutLink[];
}

export interface PhotosPageData {
  page: PhotosPageConfig;
  site: SiteConfig;
  photowall: PhotowallIndex;
}

export type LibraryKind =
  | 'book'
  | 'novel'
  | 'manga'
  | 'game'
  | 'anime'
  | 'movie'
  | 'drama'
  | 'variety';

/** 3D 形态；缺省由 type 映射 */
export type LibraryShape =
  | 'book'
  | 'book-slim'
  | 'book-tankobon'
  | 'cartridge'
  | 'vhs'
  | 'disc-case'
  | 'disc-case-thick'
  | 'remote';

export type LibraryStatus = 'reading' | 'finished' | 'planned' | 'dropped';

export interface LibraryLink {
  label: string;
  url: string;
}

export interface LibraryRatingStars {
  score: number;
  stars: number;
  max: number;
  label: string;
}

export interface LibraryItem {
  id: string;
  title: string;
  author: string;
  type: LibraryKind;
  typeLabel: string;
  /** 覆盖 type→默认 mesh；一般不用填 */
  shape?: LibraryShape;
  cover?: string;
  status: LibraryStatus;
  statusLabel: string;
  progress?: string;
  progressCurrent?: number;
  progressTotal?: number;
  progressPercent?: number;
  rating?: number;
  ratingStars?: LibraryRatingStars;
  year?: string;
  platform?: string;
  link?: string;
  links?: LibraryLink[];
  genre?: string;
  /** 作品简介 */
  summary?: string;
  /** 阅读/观看想法 */
  thoughts?: string;
  /** 好句摘录 */
  quotes?: string[];
  /** 总结 / 收获 */
  takeaways?: string[];
  updated?: string;
}

export interface LibraryIndex {
  items: LibraryItem[];
  kinds?: Record<string, { label: string; emoji?: string }>;
  statuses?: Record<string, { label: string }>;
  generatedAt?: string;
}

export interface LibraryPageConfig {
  title: string;
  lead?: string;
  heroKicker?: string;
  empty?: string;
  searchPlaceholder?: string;
  links?: AboutLink[];
}

export interface LibraryPageData {
  page: LibraryPageConfig;
  site: SiteConfig;
  library: LibraryIndex;
  meteorWords: MeteorWord[];
}

export interface GameControlHint {
  keys: string;
  action: string;
}

export interface ArcadeGame {
  id: string;
  title: string;
  subtitle?: string;
  platform?: string;
  year?: string;
  tags?: string[];
  cover?: string;
  /** Retro Games Nexus 等嵌入地址；空则仅展示卡 */
  embedUrl?: string;
  sourceUrl?: string;
  /** 下载 / 原页（可与 sourceUrl 相同） */
  downloadUrl?: string;
  blurb?: string;
  /** 玩法特色短句 */
  features?: string[];
  controls?: GameControlHint[];
  /** 存档与下载说明 */
  saveTips?: string[];
  /** 截图 / 氛围图轮播 */
  screenshots?: string[];
  /** 大厅卡是否可玩 */
  playable?: boolean;
  comingSoon?: boolean;
}

export interface ArcadeNewsItem {
  id: string;
  date: string;
  title: string;
  body: string;
  tag?: string;
}

export interface ArcadeGuideItem {
  id: string;
  title: string;
  summary: string;
  /** 可一键复制的配置 / 代码 */
  copyText?: string;
  copyLabel?: string;
}

export interface ArcadeGallerySeed {
  id: string;
  nick: string;
  note: string;
  kind?: 'tip' | 'art' | 'run';
}

export interface GamesPageConfig {
  title: string;
  kicker?: string;
  lead?: string;
  activeId?: string;
  cabinetLabel?: string;
  insertCoin?: string;
  /** 装饰用像素精灵路径 */
  spriteDeck?: string[];
  games: ArcadeGame[];
  news?: ArcadeNewsItem[];
  guides?: ArcadeGuideItem[];
  /** 种子画廊（站长精选） */
  gallerySeed?: ArcadeGallerySeed[];
  notices?: string[];
  credit?: {
    host?: string;
    hostUrl?: string;
    note?: string;
  };
}

export interface GamesPageData {
  page: GamesPageConfig;
  site: SiteConfig;
  comments?: CommentsConfig;
}
