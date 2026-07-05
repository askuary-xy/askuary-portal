/** 站点基础信息 */
export interface SiteConfig {
  name: string;
  intro: string;
  avatar: string;
  avatarAlt?: string;
  homeUrl: string;
  blogUrl: string;
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
  /** 屏幕归一化坐标 0–1，留空则自动分布 */
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

export interface PortalConfig {
  site: SiteConfig;
  navStars: NavStar[];
  spots: EarthSpot[];
  friends: Friend[];
  meteorWords: MeteorWord[];
}
