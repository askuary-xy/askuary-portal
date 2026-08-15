import type { Friend, MeteorWord, NavStar } from '../types/config';
import type { GalaxyPointCloud } from './galaxy-point-cloud';
import type { SolarSystemScene } from './solar-system-scene';
import type { BlackholeScene } from './blackhole-scene';

type Planet = {
  id: string;
  name: string;
  designation: string;
  description: string;
  href: string;
  color: [number, number, number];
  orbit: number;
  angle: number;
  radius: number;
  texture: string;
  cloudTexture?: string;
  nightTexture?: string;
  kind?: 'earth' | 'saturn';
};

type FriendSelection = { id: string; name: string; designation: string; description: string; href: string; avatar?: string; friend: true };
type CraftSelection = { id: string; name: string; designation: string; description: string; href: string; craft: true };
type Selected = Planet | FriendSelection | CraftSelection | null;

type UiParticle = { x: number; y: number; tx: number; ty: number; delay: number; size: number; alpha: number; dx?: number; dy?: number };
type Meteor = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  cruiseSpeed: number;
  reveal: number;
  text: string;
  author?: string;
  holdUntil: number;
};

const JOURNEY = {
  solarArrivalStart: .72,
  solarArrivalEnd: .97,
  solarDepartureStart: 1.42,
  solarDepartureEnd: 1.76,
  blackholeApproachStart: 2.02,
  blackholeArrival: 2.72,
  max: 2.78,
} as const;

const PLANETS: Planet[] = [
  { id: 'home', name: '地球', designation: 'CENTRAL STATION / HOME', description: '中央星站。这里保留日常信号、游戏世界与整个站点的起点。', href: '/home/', color: [69, 181, 236], orbit: 0.29, angle: -0.7, radius: 23, texture: '/assets/universe/solar-system/textures/2k_earth_daymap.jpg', nightTexture: '/assets/universe/solar-system/textures/2k_earth_nightmap.jpg', cloudTexture: '/assets/universe/solar-system/textures/2k_earth_clouds.jpg', kind: 'earth' },
  { id: 'articles', name: '火星', designation: 'ARCHIVE ORBIT / ARTICLES', description: '文章星球。收录完整文章、教程与长期写作。', href: '/articles/', color: [225, 97, 66], orbit: 0.45, angle: 0.6, radius: 15, texture: '/assets/universe/solar-system/textures/2k_mars.jpg' },
  { id: 'photos', name: '金星', designation: 'OPTICAL NEBULA / PHOTOS', description: '摄影星球。把路过的光线、旅途与相册存成可回看的记忆。', href: '/photos/', color: [238, 183, 104], orbit: 0.62, angle: -2.05, radius: 17, texture: '/assets/universe/solar-system/textures/2k_venus_surface.jpg', cloudTexture: '/assets/universe/solar-system/textures/2k_venus_atmosphere.jpg' },
  { id: 'signals', name: '水星', designation: 'SIGNAL STREAM / SHUOSHUO', description: '碎念星球。短暂信号、日常想法与不需要归档的即时记录。', href: '/shuoshuo/', color: [177, 189, 205], orbit: 0.2, angle: 2.35, radius: 10, texture: '/assets/universe/solar-system/textures/2k_mercury.jpg' },
  { id: 'library', name: '木星', designation: 'COLLECTION VAULT / LIBRARY', description: '馆藏星球。书籍、漫画、游戏与正在积累的兴趣星图。', href: '/library/', color: [210, 157, 108], orbit: 0.79, angle: 2.8, radius: 27, texture: '/assets/universe/solar-system/textures/2k_jupiter.jpg' },
  { id: 'archive', name: '土星', designation: 'MEMORY INDEX / ARCHIVE', description: '归档星球。按时间回望所有已经抵达过的内容坐标。', href: '/archive/', color: [225, 198, 133], orbit: 0.96, angle: 0.2, radius: 21, texture: '/assets/universe/solar-system/textures/2k_saturn.jpg', kind: 'saturn' },
];

const MOON_TARGET: Planet = {
  id: 'moon',
  name: '月球',
  designation: 'LUNAR RELAY / EARTH ORBIT',
  description: '环绕中央星站的月球中继。点击可读取地球主页的日常信号。',
  href: '/home/',
  color: [194, 204, 219],
  orbit: 0,
  angle: 0,
  radius: 8,
  texture: '/assets/universe/solar-system/textures/2k_moon.jpg',
};

const SUN_TEXTURE = '/assets/universe/solar-system/textures/2k_sun.jpg';
const MOON_TEXTURE = '/assets/universe/solar-system/textures/2k_moon.jpg';
const SATURN_RING_TEXTURE = '/assets/universe/solar-system/textures/2k_saturn_ring_alpha.png';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function ease(value: number): number {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
}

/** 连续宇宙入口：在银河内锁定恒星并飞抵太阳系。 */
export class GalaxySystem {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly stars: Array<{ a: number; r: number; arm: number; jitter: number; size: number; hue: number }>;
  private readonly dust: Array<{ x: number; y: number; z: number; size: number }>;
  private readonly planetPanel: HTMLElement | null;
  private readonly stageLabel: HTMLElement | null;
  private readonly hint: HTMLElement | null;
  private readonly blackholeLegal: HTMLElement | null;
  private readonly friends: Friend[];
  private readonly navStars: NavStar[];
  private readonly meteorWords: MeteorWord[];
  private width = 0;
  private height = 0;
  private dpr = 1;
  private progress = 0;
  private target = 0;
  private time = 0;
  private selected: Selected = null;
  private focusItem: Selected = null;
  private focus = 0;
  private focusTarget = 0;
  private uiPhase = 0;
  private uiPhaseTarget = 0;
  private uiReturning = false;
  private uiParticles: UiParticle[] = [];
  private uiGlyph: HTMLCanvasElement | null = null;
  private meteors: Meteor[] = [];
  private nextMeteorAt = 0;
  private meteorSerial = 0;
  private lastStamp = 0;
  private pointer = { x: -1000, y: -1000 };
  private touchStartY: number | null = null;
  private hudKey = '';
  private hudStageTarget = '';
  private hudHintTarget = '';
  private hudChars = 0;
  private hudLastTick = 0;
  private planetPositions = new Map<string, { x: number; y: number; r: number; item: Planet }>();
  private satellitePositions = new Map<string, { x: number; y: number; r: number; friend: Friend }>();
  private craftPositions = new Map<string, { x: number; y: number; r: number; nav: NavStar }>();
  private textureImages = new Map<string, HTMLImageElement>();
  private readonly blackhole?: BlackholeScene;
  private readonly pointCloud?: GalaxyPointCloud;
  private readonly solarSystem?: SolarSystemScene;
  private animationFrameId: number | null = null;
  private warpTimeoutId: number | null = null;
  private destroyed = false;

  private readonly handleResize = (): void => this.resize(this.canvas);

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    if (this.selected) return;
    const dir = Math.sign(event.deltaY);
    this.target = clamp(this.target + dir * 0.08, 0, JOURNEY.max);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    this.canvas.style.cursor = this.hitTest() || this.hitMeteor() ? 'pointer' : 'default';
  };

  private readonly handlePointerLeave = (): void => {
    this.pointer = { x: -1000, y: -1000 };
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    this.touchStartY = event.pointerType === 'touch' ? event.clientY : null;
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (this.touchStartY !== null) {
      const delta = this.touchStartY - event.clientY;
      if (Math.abs(delta) > 24 && !this.selected) this.target = clamp(this.target + Math.sign(delta) * 0.12, 0, JOURNEY.max);
    }
    this.touchStartY = null;
  };

  private readonly handleClick = (): void => this.onClick();

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.select(null);
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') this.target = clamp(this.target + 0.08, 0, JOURNEY.max);
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') this.target = clamp(this.target - 0.08, 0, JOURNEY.max);
  };

  private readonly handlePanelClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-galaxy-close]')) this.select(null);
  };

  private readonly handlePanelImageError = (event: Event): void => {
    const avatar = event.target;
    if (!(avatar instanceof HTMLImageElement) || !avatar.classList.contains('fp-friend-orbit-card__avatar')) return;
    const card = avatar.closest('.fp-friend-orbit-card');
    avatar.remove();
    card?.classList.add('fp-friend-orbit-card--no-media');
  };

  constructor(
    canvas: HTMLCanvasElement,
    friends: Friend[],
    navStars: NavStar[],
    meteorWords: MeteorWord[],
    pointCloud?: GalaxyPointCloud,
    solarSystem?: SolarSystemScene,
    blackhole?: BlackholeScene,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.canvas = canvas;
    this.ctx = ctx;
    this.friends = friends;
    this.navStars = navStars.filter((item) => item.enabled !== false && ['blog', 'about', 'friends'].includes(item.id));
    this.meteorWords = meteorWords;
    this.blackhole = blackhole;
    this.pointCloud = pointCloud;
    this.solarSystem = solarSystem;
    this.planetPanel = document.getElementById('fpPlanetPanel');
    this.stageLabel = document.getElementById('fpGalaxyStage');
    this.hint = document.getElementById('fpGalaxyHint');
    this.blackholeLegal = document.getElementById('fpBlackholeLegal');
    this.stars = Array.from({ length: 980 }, (_, index) => ({
      a: Math.random() * Math.PI * 2,
      r: Math.pow(Math.random(), 0.55),
      arm: index % 4,
      jitter: (Math.random() - 0.5) * 0.54,
      size: Math.random() * 1.6 + 0.25,
      hue: Math.random() > 0.84 ? 206 : Math.random() > 0.88 ? 45 : 220,
    }));
    this.dust = Array.from({ length: 180 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random(), size: Math.random() * 1.8 + 0.3 }));

    this.handleResize();
    window.addEventListener('resize', this.handleResize);
    canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerleave', this.handlePointerLeave);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('click', this.handleClick);
    window.addEventListener('keydown', this.handleKeyDown);
    this.planetPanel?.addEventListener('click', this.handlePanelClick);
    this.planetPanel?.addEventListener('error', this.handlePanelImageError, true);
    this.render(0);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
    if (this.warpTimeoutId !== null) window.clearTimeout(this.warpTimeoutId);
    this.animationFrameId = null;
    this.warpTimeoutId = null;
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('click', this.handleClick);
    this.planetPanel?.removeEventListener('click', this.handlePanelClick);
    this.planetPanel?.removeEventListener('error', this.handlePanelImageError, true);
    this.planetPanel?.replaceChildren();
    if (this.planetPanel) this.planetPanel.hidden = true;
    if (this.blackholeLegal) this.blackholeLegal.hidden = true;
    this.canvas.style.cursor = '';
    this.planetPositions.clear();
    this.satellitePositions.clear();
    this.craftPositions.clear();
    this.textureImages.clear();
    this.meteors = [];
    this.uiParticles = [];
    this.uiGlyph = null;
    document.body.classList.remove('fp-planet-focus', 'fp-particle-ui', 'fp-blackhole-warp');
  }

  private resize(canvas: HTMLCanvasElement): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, window.innerWidth);
    this.height = Math.max(1, window.innerHeight);
    canvas.width = Math.round(this.width * this.dpr);
    canvas.height = Math.round(this.height * this.dpr);
    canvas.style.width = `${this.width}px`;
    canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private onClick(): void {
    const blackholeTarget = this.blackhole?.getTarget();
    if (blackholeTarget && Math.hypot(this.pointer.x - blackholeTarget.x, this.pointer.y - blackholeTarget.y) < blackholeTarget.r) {
      if (document.body.classList.contains('fp-blackhole-warp')) return;
      document.body.classList.add('fp-blackhole-warp');
      this.blackhole?.activateWarp();
      this.warpTimeoutId = window.setTimeout(() => window.location.assign('/home/'), 760);
      return;
    }
    const hit = this.hitTest();
    if (hit && 'friend' in hit) {
      this.select({ id: `friend-${hit.friend.title}`, name: hit.friend.title, designation: 'ORBITAL ALLY / FRIEND SATELLITE', description: hit.friend.text, href: hit.friend.url, avatar: hit.friend.avatar, friend: true });
      return;
    }
    if (hit && 'nav' in hit) {
      this.select({ id: `craft-${hit.nav.id}`, name: hit.nav.label, designation: 'ORBITAL STATION / PAGE GATE', description: hit.nav.desc || '正在行星轨道巡航的页面太空站。', href: hit.nav.url, craft: true });
      return;
    }
    if (hit) {
      this.select(hit.item);
      return;
    }
    const meteor = this.hitMeteor();
    if (meteor) {
      meteor.holdUntil = this.time + clamp(3.8 + meteor.text.length * .18, 4.8, 10);
      return;
    }
    // 只有真正的空白深空才会退出；行星与卫星始终是独立的可点击对象。
    if (this.selected) this.select(null);
  }

  private hitTest(): { item: Planet } | { friend: Friend } | { nav: NavStar } | null {
    if (this.progress < 0.92 || this.progress > JOURNEY.solarDepartureStart + .04) return null;
    for (const satellite of this.satellitePositions.values()) {
      if (Math.hypot(this.pointer.x - satellite.x, this.pointer.y - satellite.y) < satellite.r + 14) return { friend: satellite.friend };
    }
    for (const craft of this.craftPositions.values()) {
      if (Math.hypot(this.pointer.x - craft.x, this.pointer.y - craft.y) < craft.r + 14) return { nav: craft.nav };
    }
    for (const planet of this.planetPositions.values()) {
      if (Math.hypot(this.pointer.x - planet.x, this.pointer.y - planet.y) < planet.r + 18) return { item: planet.item };
    }
    return null;
  }

  private hitMeteor(): Meteor | null {
    if (this.progress < .9 || this.progress > JOURNEY.solarDepartureEnd) return null;
    for (let index = this.meteors.length - 1; index >= 0; index -= 1) {
      const meteor = this.meteors[index];
      const length = 150;
      const mag = Math.hypot(meteor.vx, meteor.vy) || 1;
      const tx = meteor.x - (meteor.vx / mag) * length;
      const ty = meteor.y - (meteor.vy / mag) * length;
      if (this.distanceToSegment(this.pointer.x, this.pointer.y, meteor.x, meteor.y, tx, ty) < 18) return meteor;
    }
    return null;
  }

  private distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy || 1;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1);
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }

  private select(item: Selected): void {
    this.selected = item;
    if (item) this.focusItem = item;
    this.focusTarget = item ? 1 : 0;
    this.uiPhaseTarget = 0;
    this.uiReturning = false;
    document.body.classList.toggle('fp-planet-focus', Boolean(item));
    document.body.classList.remove('fp-particle-ui');
    if (this.planetPanel) {
      // 选中星球只展示档案。页面跳转统一保留给旅程终点的黑洞。
      if (item && ('friend' in item || 'craft' in item)) {
        const isFriend = 'friend' in item;
        const avatar = isFriend && item.avatar ? `<img class="fp-friend-orbit-card__avatar" src="${esc(item.avatar)}" alt="${esc(item.name)}" />` : '';
        this.planetPanel.hidden = false;
        this.planetPanel.innerHTML = `<section class="fp-friend-orbit-card${isFriend ? '' : ' fp-friend-orbit-card--craft'}${avatar ? '' : ' fp-friend-orbit-card--no-media'}"><button type="button" class="fp-friend-orbit-card__close" data-galaxy-close aria-label="关闭">×</button>${avatar}<div><p>${isFriend ? 'ORBITAL ALLY' : 'ORBITAL STATION'}</p><h2>${esc(item.name)}</h2><span>${esc(item.description)}</span><a href="${esc(item.href)}"${isFriend ? ' target="_blank" rel="noopener noreferrer"' : ''}>${isFriend ? esc(item.href) : '进入航线 →'}</a></div></section>`;
      } else {
        if (item) {
          this.planetPanel.hidden = false;
          this.planetPanel.innerHTML = `<section class="fp-planet-lock-card"><button type="button" class="fp-friend-orbit-card__close" data-galaxy-close aria-label="关闭">×</button><span class="fp-planet-lock-card__eyebrow">CELESTIAL OBJECT LOCKED</span><h2>${esc(item.name)}</h2><i aria-hidden="true"></i></section>`;
        } else {
          this.planetPanel.hidden = true;
          this.planetPanel.innerHTML = '';
        }
      }
    }
    // 太阳系锁定界面改用轻量 DOM 科幻框，不再创建数千粒子来拼字。
    this.uiParticles = [];
  }

  private render = (stamp: number): void => {
    if (this.destroyed) return;
    const dt = this.lastStamp ? Math.min((stamp - this.lastStamp) / 1000, .05) : 1 / 60;
    this.lastStamp = stamp;
    this.time = stamp * 0.001;
    this.progress += (this.target - this.progress) * (1 - Math.exp(-4.7 * dt));
    this.pointCloud?.setProgress(this.progress);
    const solarArrival = ease((this.progress - JOURNEY.solarArrivalStart) / (JOURNEY.solarArrivalEnd - JOURNEY.solarArrivalStart));
    // 太阳系必须先完全退远，再经过一段纯黑深空，黑洞才从远处进入镜头。
    const solarDeparture = ease((this.progress - JOURNEY.solarDepartureStart) / (JOURNEY.solarDepartureEnd - JOURNEY.solarDepartureStart));
    const blackholeMix = ease((this.progress - JOURNEY.blackholeApproachStart) / (JOURNEY.blackholeArrival - JOURNEY.blackholeApproachStart));
    this.solarSystem?.setProgress(solarArrival);
    this.solarSystem?.setDeparture(solarDeparture);
    this.blackhole?.setProgress(blackholeMix);
    const sceneFocus = this.selected
      ? ('friend' in this.selected ? 'home' : this.selected.id)
      : null;
    this.solarSystem?.setFocus(sceneFocus);
    this.focus += (this.focusTarget - this.focus) * (1 - Math.exp(-4.1 * dt));
    this.uiPhase += (this.uiPhaseTarget - this.uiPhase) * (1 - Math.exp(-(this.uiPhaseTarget ? 5 : 9) * dt));
    if (!this.selected && this.focus < 0.012 && this.uiPhase < .012) {
      this.focusItem = null;
      this.uiParticles = [];
      this.uiGlyph = null;
      this.uiReturning = false;
    }
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawBackdrop(ctx);
    // 银河锁定恒星后，先从遥远深空看见太阳系，再持续推进到可探索的固定轨道。
    const solarMix = solarArrival * (1 - solarDeparture);
    this.drawGalaxy(ctx, document.body.classList.contains('fp-ply-galaxy-ready') ? 0 : 1 - solarArrival);
    if (this.solarSystem && solarMix > .01) this.syncSolarTargets(this.solarSystem);
    else this.drawSolarSystem(ctx, solarMix);
    this.drawMeteors(ctx, solarMix, blackholeMix, dt);
    this.drawParticleInterface(ctx);
    this.updateHud(solarMix, blackholeMix);
    this.animationFrameId = requestAnimationFrame(this.render);
  };

  private syncSolarTargets(solarSystem: SolarSystemScene): void {
    this.planetPositions.clear();
    this.satellitePositions.clear();
    this.craftPositions.clear();
    for (const target of solarSystem.getTargets().values()) {
      if (target.friendIndex !== undefined) {
        const friend = this.friends[target.friendIndex];
        if (friend) this.satellitePositions.set(`friend-${target.friendIndex}`, { x: target.x, y: target.y, r: target.r, friend });
        continue;
      }
      if (target.craftIndex !== undefined) {
        const navId = target.id.replace(/^craft-/, '');
        const nav = this.navStars.find((item) => item.id === navId);
        if (nav) this.craftPositions.set(target.id, { x: target.x, y: target.y, r: target.r, nav });
        continue;
      }
      const item = target.id === 'moon' ? MOON_TARGET : PLANETS.find((planet) => planet.id === target.id);
      if (item) this.planetPositions.set(item.id, { x: target.x, y: target.y, r: target.r, item });
    }
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D): void {
    if (this.progress >= JOURNEY.solarDepartureEnd - .04) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, this.width, this.height);
      return;
    }
    // 点云银河就绪后，背景改为透明，让下方的 WebGL 星系成为真实首景；Canvas 仅保留交互层。
    if (!document.body.classList.contains('fp-ply-galaxy-ready')) {
      const bg = ctx.createRadialGradient(this.width * 0.52, this.height * 0.46, 0, this.width * 0.52, this.height * 0.46, Math.max(this.width, this.height) * 0.76);
      bg.addColorStop(0, '#07182a');
      bg.addColorStop(0.44, '#020914');
      bg.addColorStop(1, '#000207');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, this.width, this.height);
    }
    const uiRect = this.focus > 0.02 ? this.getUiRect() : null;
    for (const mote of this.dust) {
      // 星体档案出现时，这一层的真实星尘离开原位并汇聚成线与文字。
      if (this.uiParticles.length && this.uiPhase > .04) continue;
      const x = mote.x * this.width + Math.sin(this.time * 0.08 + mote.z * 9) * 16;
      const y = mote.y * this.height + Math.cos(this.time * 0.07 + mote.x * 7) * 12;
      const insideUi = uiRect && x > uiRect.x - 24 && x < uiRect.x + uiRect.w + 24 && y > uiRect.y - 24 && y < uiRect.y + uiRect.h + 24;
      ctx.globalAlpha = insideUi ? 0.01 : 0.1 + mote.z * 0.18;
      ctx.fillStyle = '#b8e6ff';
      ctx.fillRect(x, y, mote.size, mote.size);
    }
    // 接近目标恒星时，深空中的光线被拉成长束。它提供速度感，并将两段场景接成同一次航行。
    const approach = ease((this.progress - 0.58) / 0.38);
    if (approach > 0.01 && this.progress < 0.985) {
      const cx = this.width * 0.5;
      const cy = this.height * 0.5;
      const flare = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(this.width, this.height) * (0.08 + approach * 0.32));
      flare.addColorStop(0, `rgba(255, 240, 196, ${approach * 0.36})`);
      flare.addColorStop(0.09, `rgba(185, 218, 255, ${approach * 0.14})`);
      flare.addColorStop(0.34, `rgba(80, 156, 234, ${approach * 0.025})`);
      flare.addColorStop(1, 'rgba(27, 97, 181, 0)');
      ctx.fillStyle = flare;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(this.width, this.height) * (0.08 + approach * 0.32), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(196, 231, 255, ${approach * 0.22})`;
      ctx.lineWidth = 1;
      for (let index = 0; index < 78; index++) {
        const angle = index * 2.399 + this.time * .03;
        const start = Math.min(this.width, this.height) * (.08 + ((index * 37) % 100) / 100 * .55);
        const length = (10 + (index % 9) * 8) * approach;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * start, cy + Math.sin(angle) * start);
        ctx.lineTo(cx + Math.cos(angle) * (start + length), cy + Math.sin(angle) * (start + length));
        ctx.stroke();
      }
    }
    if (this.focus > 0.03) {
      const centerX = this.width * 0.31;
      const centerY = this.height * 0.52;
      ctx.strokeStyle = `rgba(140, 220, 255, ${this.focus * 0.13})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 90; i++) {
        const angle = (i * 2.399 + this.time * 0.03) % (Math.PI * 2);
        const dist = ((i * 47 + this.time * 200) % Math.max(this.width, this.height)) * 0.75 + 120;
        const len = 8 + this.focus * 86 * (0.4 + (i % 5) / 8);
        const x = centerX + Math.cos(angle) * dist;
        const y = centerY + Math.sin(angle) * dist;
        if (x > this.width * 0.61) continue;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawGalaxy(ctx: CanvasRenderingContext2D, alpha: number): void {
    if (alpha < 0.015) return;
    const cx = this.width * 0.5;
    const cy = this.height * 0.5;
    const radius = Math.min(this.width, this.height) * (0.31 + this.progress * 0.78);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.rotate(-0.2 + this.time * 0.012);
    for (const star of this.stars) {
      const spiral = star.a + star.arm * (Math.PI / 2) + star.r * 5.4;
      const dist = star.r * radius;
      const x = Math.cos(spiral) * dist + Math.cos(star.a * 9) * radius * star.jitter * star.r;
      const y = Math.sin(spiral) * dist * 0.36 + Math.sin(star.a * 7) * radius * star.jitter * 0.18;
      const color = `hsl(${star.hue} 76% ${62 + star.r * 24}%)`;
      ctx.globalAlpha = alpha * (0.18 + (1 - star.r) * 0.66);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, star.size, star.size);
    }
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.25);
    core.addColorStop(0, 'rgba(238,249,255,.86)');
    core.addColorStop(0.16, 'rgba(154,216,255,.35)');
    core.addColorStop(1, 'rgba(60,126,208,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawSolarSystem(ctx: CanvasRenderingContext2D, mix: number): void {
    if (mix < 0.01) return;
    const cx = this.width * 0.5;
    const cy = this.height * 0.5;
    const systemR = Math.min(this.width, this.height) * 0.4;
    const selectedPlanet = this.focusItem && !('friend' in this.focusItem) ? this.focusItem.id : '';
    const selected = PLANETS.find((planet) => planet.id === selectedPlanet);
    const selectedAngle = selected ? selected.angle + this.time * (selected.id === 'home' ? 0.12 : 0.03 + selected.orbit * 0.04) : 0;
    const focusX = selected ? Math.cos(selectedAngle) * systemR * selected.orbit : 0;
    const focusY = selected ? Math.sin(selectedAngle) * systemR * selected.orbit * 0.46 : 0;
    const arrivalScale = 0.025 + mix * 0.975;
    const cameraScale = arrivalScale * (1 + this.focus * 3.45);
    const cameraX = cx + (this.width * 0.31 - cx) * this.focus;
    const cameraY = cy + (this.height * 0.52 - cy) * this.focus;
    ctx.save();
    ctx.globalAlpha = clamp(mix * 1.35, 0, 1);
    ctx.translate(cameraX, cameraY);
    ctx.scale(cameraScale, cameraScale);
    ctx.translate(-focusX * this.focus, -focusY * this.focus);
    for (const orbit of [0.2, 0.29, 0.45, 0.62, 0.79, 0.96]) {
      ctx.strokeStyle = `rgba(128, 202, 232, ${0.05 + mix * 0.12})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, systemR * orbit, systemR * orbit * 0.46, -0.16, 0, Math.PI * 2);
      ctx.stroke();
    }
    this.drawSun(ctx, 0, 0, systemR * 0.12);
    this.planetPositions.clear();
    this.satellitePositions.clear();
    for (const planet of PLANETS) {
      const speed = planet.id === 'home' ? 0.12 : 0.03 + planet.orbit * 0.04;
      const a = planet.angle + this.time * speed;
      const x = Math.cos(a) * systemR * planet.orbit;
      const y = Math.sin(a) * systemR * planet.orbit * 0.46;
      const isSelected = selectedPlanet === planet.id;
      const r = planet.radius * (isSelected ? 2.1 : 1);
      this.drawPlanet(ctx, planet, x, y, r, isSelected);
      const screenX = cameraX + (x - focusX * this.focus) * cameraScale;
      const screenY = cameraY + (y - focusY * this.focus) * cameraScale;
      this.planetPositions.set(planet.id, { x: screenX, y: screenY, r, item: planet });
      if (planet.kind === 'earth') {
        this.drawMoon(ctx, x, y, r);
        this.drawSatellites(ctx, x, y, r, cameraX, cameraY, cameraScale, focusX * this.focus, focusY * this.focus);
      }
    }
    ctx.restore();
  }

  private drawPlanet(ctx: CanvasRenderingContext2D, planet: Planet, x: number, y: number, r: number, focused: boolean): void {
    const [pr, pg, pb] = planet.color;
    const glow = ctx.createRadialGradient(x, y, r * 0.24, x, y, r * 2.9);
    glow.addColorStop(0, `rgba(${pr},${pg},${pb},${focused ? 0.48 : 0.22})`);
    glow.addColorStop(1, `rgba(${pr},${pg},${pb},0)`);
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 2.9, 0, Math.PI * 2); ctx.fill();
    this.drawTexturedSphere(ctx, planet.texture, x, y, r, 0.13 + planet.orbit * 0.12);
    if (planet.nightTexture) this.drawTexturedSphere(ctx, planet.nightTexture, x, y, r, 0.16, 0.33);
    if (planet.cloudTexture) this.drawTexturedSphere(ctx, planet.cloudTexture, x, y, r * 1.026, 0.23, planet.kind === 'earth' ? 0.34 : 0.2);
    const terminator = ctx.createRadialGradient(x - r * 0.36, y - r * 0.38, r * .16, x + r * .42, y + r * .32, r * 1.22);
    terminator.addColorStop(0, 'rgba(255,255,255,.16)');
    terminator.addColorStop(.5, 'rgba(0,8,22,.02)');
    terminator.addColorStop(1, 'rgba(0,3,12,.72)');
    ctx.fillStyle = terminator; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    if (planet.kind === 'saturn') this.drawSaturnRing(ctx, x, y, r);
    if (focused) { ctx.strokeStyle = 'rgba(175,239,255,.88)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r + 8, 0, Math.PI * 2); ctx.stroke(); }
  }

  private drawSun(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    const glow = ctx.createRadialGradient(x, y, r * .18, x, y, r * 2.9);
    glow.addColorStop(0, 'rgba(255,255,215,.96)');
    glow.addColorStop(.24, 'rgba(255,203,91,.55)');
    glow.addColorStop(.58, 'rgba(250,126,43,.14)');
    glow.addColorStop(1, 'rgba(250,88,27,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 2.9, 0, Math.PI * 2); ctx.fill();
    this.drawTexturedSphere(ctx, SUN_TEXTURE, x, y, r, .08);
    const hot = ctx.createRadialGradient(x - r * .34, y - r * .36, 1, x, y, r);
    hot.addColorStop(0, 'rgba(255,252,208,.62)'); hot.addColorStop(.58, 'rgba(255,178,52,.08)'); hot.addColorStop(1, 'rgba(172,50,10,.24)');
    ctx.fillStyle = hot; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  private drawTexturedSphere(ctx: CanvasRenderingContext2D, texture: string, x: number, y: number, r: number, velocity: number, alpha = 1): void {
    const image = this.textureImages.get(texture);
    if (!image || !image.complete || !image.naturalWidth) {
      ctx.fillStyle = 'rgba(130,181,226,.52)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      return;
    }
    // 贴图是 2:1 的等距圆柱投影。以四倍半径铺开后再裁成圆，避免把整张世界地图硬压进一个正方形。
    const span = r * 4;
    const phase = ((this.time * velocity * r) % span + span) % span;
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.globalAlpha = alpha;
    ctx.drawImage(image, x - span * .5 - phase, y - r, span, r * 2);
    ctx.drawImage(image, x + span * .5 - phase, y - r, span, r * 2);
    ctx.restore();
  }

  private drawSaturnRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    const image = this.textureImages.get(SATURN_RING_TEXTURE);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(-.3);
    if (image?.complete && image.naturalWidth) {
      ctx.globalAlpha = .78;
      ctx.drawImage(image, -r * 1.82, -r * .48, r * 3.64, r * .96);
    }
    ctx.strokeStyle = 'rgba(250,225,166,.7)'; ctx.lineWidth = Math.max(1.5, r * .075);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.72, r * .49, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  private drawMoon(ctx: CanvasRenderingContext2D, x: number, y: number, earthRadius: number): void {
    const a = this.time * .62 + .86;
    const orbit = earthRadius * 1.95;
    const moonX = x + Math.cos(a) * orbit;
    const moonY = y + Math.sin(a) * orbit * .38;
    const moonR = Math.max(3, earthRadius * .27);
    ctx.strokeStyle = 'rgba(193,223,245,.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y, orbit, orbit * .38, 0, 0, Math.PI * 2); ctx.stroke();
    this.drawTexturedSphere(ctx, MOON_TEXTURE, moonX, moonY, moonR, .04);
  }

  private drawSatellites(ctx: CanvasRenderingContext2D, x: number, y: number, earthRadius: number, cameraX: number, cameraY: number, cameraScale: number, offsetX: number, offsetY: number): void {
    const count = Math.max(1, this.friends.length);
    for (let i = 0; i < count; i++) {
      const friend = this.friends[i];
      const a = this.time * 0.72 + (Math.PI * 2 * i) / count;
      const orbit = earthRadius + 26 + i * 11;
      const sx = x + Math.cos(a) * orbit;
      const sy = y + Math.sin(a) * orbit * 0.38;
      ctx.strokeStyle = 'rgba(205,231,255,.2)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, orbit, orbit * .38, 0, 0, Math.PI * 2); ctx.stroke();
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 12); glow.addColorStop(0, '#fff'); glow.addColorStop(.22, '#b8dcff'); glow.addColorStop(1, 'rgba(122,192,255,0)'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.fill();
      this.satellitePositions.set(friend?.title || 'friend', { x: cameraX + (sx - offsetX) * cameraScale, y: cameraY + (sy - offsetY) * cameraScale, r: 6, friend: friend || { title: '友联', text: '轨道中的友联卫星', url: '/friends/' } });
    }
  }

  private getUiRect(): { x: number; y: number; w: number; h: number } {
    const margin = clamp(this.width * 0.05, 16, 80);
    const w = Math.min(400, this.width - margin * 2);
    const h = 228;
    return { x: this.width - margin - w, y: this.height * 0.5 - h * 0.5, w, h };
  }

  private drawParticleInterface(ctx: CanvasRenderingContext2D): void {
    if (!this.uiParticles.length || this.uiPhase < 0.012) return;
    const activation = this.uiPhase;
    ctx.save();
    const rect = this.getUiRect();
    // 这是深空遮光区，而非实体卡片：让星点构成的文字在复杂星空里仍然可读。
    ctx.fillStyle = `rgba(0, 5, 14, ${ease(activation) * 0.74})`;
    ctx.beginPath();
    ctx.moveTo(rect.x + 18, rect.y + 2); ctx.lineTo(rect.x + rect.w - 40, rect.y + 2);
    ctx.lineTo(rect.x + rect.w - 2, rect.y + 40); ctx.lineTo(rect.x + rect.w - 2, rect.y + rect.h - 40);
    ctx.lineTo(rect.x + rect.w - 40, rect.y + rect.h - 2); ctx.lineTo(rect.x + 18, rect.y + rect.h - 2);
    ctx.lineTo(rect.x + 2, rect.y + rect.h - 18); ctx.lineTo(rect.x + 2, rect.y + 18); ctx.closePath(); ctx.fill();
    ctx.shadowColor = '#58d6ff';
    ctx.shadowBlur = 6;
    for (const particle of this.uiParticles) {
      // 进入时按星尘抵达时间汇聚，离开时立刻反向散回原星空，不能在成形态停顿。
      const p = this.uiReturning
        ? ease(activation)
        : ease(clamp((activation - particle.delay) / Math.max(0.06, 1 - particle.delay), 0, 1));
      const x = particle.x + (particle.tx - particle.x) * p;
      const y = particle.y + (particle.ty - particle.y) * p;
      ctx.globalAlpha = particle.alpha * (0.18 + p * 0.82);
      ctx.fillStyle = p > 0.92 ? '#effdff' : '#79e1ff';
      ctx.fillRect(x, y, particle.size, particle.size);
      if (particle.dx !== undefined && particle.dy !== undefined && p > .04) {
        ctx.strokeStyle = p > .78 ? '#d5f9ff' : '#69d9f5';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + particle.dx * p, y + particle.dy * p);
        ctx.stroke();
      }
    }
    // 星尘抵达后，线框与文字短暂闪现为稳定的细线。离开时立即熄灭，再由星点散回原位。
    if (this.uiGlyph && !this.uiReturning && activation > .9) {
      ctx.globalAlpha = ease((activation - .9) / .1) * (.72 + Math.sin(this.time * 12) * .16);
      ctx.shadowBlur = 5;
      ctx.drawImage(this.uiGlyph, rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
  }

  private drawMeteors(ctx: CanvasRenderingContext2D, solarMix: number, blackholeMix: number, dt: number): void {
    const opacity = solarMix * (1 - blackholeMix);
    if (opacity < .18) {
      this.meteors = [];
      return;
    }
    if (this.time > this.nextMeteorAt) {
      this.nextMeteorAt = this.time + 4.6 + Math.random() * 5.8;
      const entry = this.meteorWords.length
        ? this.meteorWords[this.meteorSerial % this.meteorWords.length]
        : { text: '星辰' };
      this.meteorSerial += 1;
      const score = Array.from(entry.text).length + (entry.author ? Array.from(entry.author).length * .4 : 0);
      this.meteors.push({
        id: this.meteorSerial,
        x: this.width + 90,
        y: this.height * (.06 + Math.random() * .34),
        vx: -340 - Math.random() * 150,
        vy: 115 + Math.random() * 95,
        speed: 1,
        cruiseSpeed: clamp(.96 - score * .026, .34, .86),
        reveal: 0,
        text: entry.text,
        author: entry.author,
        holdUntil: 0,
      });
    }
    const remaining: Meteor[] = [];
    ctx.save();
    for (const meteor of this.meteors) {
      const active = meteor.holdUntil > this.time;
      const targetSpeed = active ? .055 : meteor.cruiseSpeed;
      meteor.speed += (targetSpeed - meteor.speed) * (1 - Math.exp(-5.5 * dt));
      meteor.reveal += ((active ? 1 : 0) - meteor.reveal) * (1 - Math.exp(-(active ? 5.5 : 2.4) * dt));
      meteor.x += meteor.vx * meteor.speed * dt;
      meteor.y += meteor.vy * meteor.speed * dt;
      if (meteor.x < -420 || meteor.y > this.height + 160) continue;
      remaining.push(meteor);
      const life = opacity;
      const magnitude = Math.hypot(meteor.vx, meteor.vy) || 1;
      const tailX = meteor.x - (meteor.vx / magnitude) * 170;
      const tailY = meteor.y - (meteor.vy / magnitude) * 170;
      const trail = ctx.createLinearGradient(tailX, tailY, meteor.x, meteor.y);
      trail.addColorStop(0, 'rgba(144,208,255,0)');
      trail.addColorStop(.7, `rgba(164,220,255,${life * .32})`);
      trail.addColorStop(1, `rgba(255,244,204,${life})`);
      ctx.strokeStyle = trail;
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(meteor.x, meteor.y); ctx.stroke();
      ctx.fillStyle = `rgba(248,253,255,${meteor.reveal * opacity})`;
      ctx.shadowColor = '#7fdcff';
      ctx.shadowBlur = 8 * meteor.reveal;
      ctx.font = '600 15px "Noto Sans SC", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(meteor.text, meteor.x + 18, meteor.y - 14);
      if (meteor.author) {
        ctx.fillStyle = `rgba(151,212,239,${meteor.reveal * opacity * .8})`;
        ctx.font = '11px "Noto Sans SC", sans-serif';
        ctx.fillText(`— ${meteor.author}`, meteor.x + 18, meteor.y + 6);
      }
    }
    ctx.restore();
    this.meteors = remaining;
  }

  private updateHud(solarMix: number, blackholeMix: number): void {
    const inBlackhole = blackholeMix > .75;
    if (this.blackholeLegal) this.blackholeLegal.hidden = !inBlackhole;
    const inSolar = solarMix > 0.78 && !inBlackhole;
    const towardBlackhole = this.progress > JOURNEY.solarDepartureStart - .06 && !inBlackhole;
    const inApproach = this.progress > .56 && !inSolar && !towardBlackhole;
    const stage = inBlackhole
      ? 'EVENT HORIZON / RETURN GATE'
      : towardBlackhole
      ? 'DEEP SPACE / BLACK HOLE VECTOR'
      : inSolar
      ? 'SOLAR SYSTEM / ASKUARY'
      : inApproach ? 'INTERSTELLAR SPACE / APPROACH VECTOR' : 'MILKY WAY / LOCAL ARM';
    const hint = inBlackhole
      ? '点击黑洞，穿越回中央星站'
      : towardBlackhole
      ? (this.progress < JOURNEY.solarDepartureEnd ? '太阳系正在远离，航向深空' : '穿过静默深空，锁定遥远事件视界')
      : inSolar
      ? (this.selected ? '点击空白深空，返回太阳系' : '点击星球、卫星或飞船，读取星系档案；流星也可以捕获')
      : inApproach ? '锁定恒星，正在驶入太阳系' : '向前滚动，驶向银河中的太阳系恒星';
    const key = `${stage}|${hint}`;
    if (key !== this.hudKey) {
      this.hudKey = key;
      this.hudStageTarget = stage;
      this.hudHintTarget = hint;
      this.hudChars = 0;
      this.hudLastTick = this.time;
      this.stageLabel?.classList.add('is-decoding');
      this.hint?.classList.add('is-decoding');
    }
    if (this.time - this.hudLastTick >= .028 && this.hudChars < Math.max(stage.length, hint.length)) {
      this.hudChars += 2;
      this.hudLastTick = this.time;
      if (this.stageLabel) this.stageLabel.textContent = this.hudStageTarget.slice(0, this.hudChars);
      if (this.hint) this.hint.textContent = this.hudHintTarget.slice(0, this.hudChars);
    }
    if (this.hudChars >= Math.max(stage.length, hint.length)) {
      this.stageLabel?.classList.remove('is-decoding');
      this.hint?.classList.remove('is-decoding');
    }
  }
}
