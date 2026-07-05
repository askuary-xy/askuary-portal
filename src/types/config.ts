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
  /** 黑洞穿越目标（站点主页）；warpEnabled 为 false 时不跳转 */
  homeUrl?: string;
  /** @deprecated 旧字段，等同 homeUrl */
  blogUrl?: string;
  warpEnabled?: boolean;
  warpHint?: string;
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

export interface FriendsPageConfig {
  title: string;
  lead?: string;
  empty?: string;
  links?: AboutLink[];
}

export interface FriendsPageData {
  page: FriendsPageConfig;
  site: SiteConfig;
  friends: Friend[];
  meteorWords: MeteorWord[];
}

export interface BlogPostMeta {
  slug: string;
  title: string;
  date: string;
  summary?: string;
  tags?: string[];
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

export interface HomePageConfig {
  title: string;
  tagline?: string;
  heroIntro?: string;
  sections?: HomeSection[];
  showcases?: HomeShowcase[];
  postsTitle?: string;
  postsLimit?: number;
  empty?: string;
  nav?: AboutLink[];
  links?: AboutLink[];
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
