/**
 * Pxlkit 风格背景：缓慢漂移的宇宙星空 + 悬停斥力道具
 */
import {
  CoolEmoji,
  CyberEye,
  GhostFriend,
  MagicOrb,
  NeonSkull,
  PixelCrown,
  PixelHeart,
  PixelRocket,
  RetroJoystick,
  RetroTV,
} from '@pxlkit/parallax';
import {
  Armor,
  Axe,
  Bomb,
  Boots,
  Bow,
  Chest,
  Coin,
  Dagger,
  Elixir,
  Fire,
  Gem,
  Heart,
  Helmet,
  Key,
  Lightning,
  Potion,
  Ring,
  Scroll,
  Shield,
  Skull,
  SpellBook,
  Star,
  Sword,
  Trophy,
} from '@pxlkit/gamification';
import { iconToSvg, toStaticIcon } from '../lib/pxlkit-svg';
import type { AnyIcon, ParallaxPxlKitData } from '@pxlkit/core';

type StageProp = {
  id: string;
  x: number;
  y: number;
  size: number;
  tip: string;
  svg: string;
};

type StarDot = {
  x: number;
  y: number;
  z: number;
  s: number;
};

export type PixelStageOptions = {
  onPropClick?: (id: string) => void;
};

function flattenIcon(icon: ParallaxPxlKitData | AnyIcon): string {
  const para = icon as ParallaxPxlKitData;
  if (Array.isArray(para.layers) && para.layers.length) {
    const mid =
      para.layers.find((l) => Math.abs(Number(l.depth) || 0) < 0.2) ||
      para.layers[Math.floor(para.layers.length / 2)] ||
      para.layers[0];
    const st = toStaticIcon(mid.icon as AnyIcon);
    return st ? iconToSvg(st) : '';
  }
  return iconToSvg(icon as AnyIcon);
}

function buildProps(): StageProp[] {
  const defs: Omit<StageProp, 'svg'>[] = [
    { id: 'joystick', x: 6, y: 18, size: 64, tip: '街机摇杆 · START 开玩' },
    { id: 'tv', x: 92, y: 14, size: 62, tip: '复古电视 · 嵌入模拟器' },
    { id: 'rocket', x: 84, y: 62, size: 56, tip: '像素火箭 · 冲下一关' },
    { id: 'emoji', x: 10, y: 68, size: 48, tip: 'Cool · 悬停我会躲开' },
    { id: 'ghost', x: 48, y: 8, size: 46, tip: '幽灵朋友 · 夜间训练？' },
    { id: 'orb', x: 94, y: 40, size: 44, tip: '魔法球 · 成就在蓄力' },
    { id: 'crown', x: 28, y: 84, size: 44, tip: '王冠 · 集齐徽章' },
    { id: 'heart', x: 62, y: 88, size: 40, tip: '爱心 · HP 回满' },
    { id: 'chest', x: 3, y: 42, size: 40, tip: '宝箱 · 模拟器内可存档' },
    { id: 'trophy', x: 74, y: 34, size: 36, tip: '奖杯 · 成就墙' },
    { id: 'coin', x: 38, y: 48, size: 30, tip: '金币 · 时间变经验' },
    { id: 'sword', x: 22, y: 30, size: 34, tip: '长剑 · 30 分钟成就' },
    { id: 'potion', x: 88, y: 80, size: 34, tip: '药水 · 歇口气' },
    { id: 'gem', x: 54, y: 28, size: 28, tip: '宝石 · 闪一闪' },
    { id: 'eye', x: 16, y: 52, size: 42, tip: '赛博之眼 · 盯着你的队伍' },
    { id: 'skull', x: 70, y: 72, size: 40, tip: '霓虹骷髅 · 高难度警告' },
    { id: 'armor', x: 96, y: 58, size: 36, tip: '铠甲 · 抗住一击' },
    { id: 'bow', x: 42, y: 72, size: 36, tip: '长弓 · 远程训练' },
    { id: 'shield', x: 8, y: 86, size: 36, tip: '盾牌 · 守住道馆' },
    { id: 'scroll', x: 58, y: 58, size: 32, tip: '卷轴 · 打开攻略维基' },
    { id: 'book', x: 32, y: 14, size: 34, tip: '法术书 · 配置大全' },
    { id: 'star', x: 78, y: 10, size: 30, tip: '星星 · 去评分吧' },
    { id: 'bolt', x: 50, y: 40, size: 28, tip: '闪电 · 连胜加速' },
    { id: 'bomb', x: 20, y: 74, size: 32, tip: '炸弹 · 小心自爆流' },
    { id: 'ring', x: 66, y: 18, size: 28, tip: '戒指 · 再战一天' },
    { id: 'key', x: 90, y: 26, size: 28, tip: '钥匙 · 插入卡带' },
    { id: 'helmet', x: 14, y: 28, size: 34, tip: '头盔 · 硬核模式' },
    { id: 'dagger', x: 44, y: 90, size: 30, tip: '匕首 · 速攻队' },
    { id: 'elixir', x: 82, y: 48, size: 30, tip: '灵药 · 满状态' },
    { id: 'fire', x: 36, y: 62, size: 30, tip: '火焰 · 火系覆盖' },
    { id: 'boots', x: 72, y: 86, size: 32, tip: '靴子 · 热身完毕' },
    { id: 'axe', x: 26, y: 58, size: 34, tip: '战斧 · 全图鉴预备' },
    { id: 'gskull', x: 56, y: 76, size: 34, tip: '头骨 · 团灭警告' },
    { id: 'pheart', x: 4, y: 60, size: 36, tip: '像素心 · 评论打气' },
  ];
  const icons: Record<string, ParallaxPxlKitData | AnyIcon> = {
    joystick: RetroJoystick,
    tv: RetroTV,
    rocket: PixelRocket,
    emoji: CoolEmoji,
    ghost: GhostFriend,
    orb: MagicOrb,
    crown: PixelCrown,
    heart: PixelHeart,
    chest: Chest,
    trophy: Trophy,
    coin: Coin,
    sword: Sword,
    potion: Potion,
    gem: Gem,
    eye: CyberEye,
    skull: NeonSkull,
    armor: Armor,
    bow: Bow,
    shield: Shield,
    scroll: Scroll,
    book: SpellBook,
    star: Star,
    bolt: Lightning,
    bomb: Bomb,
    ring: Ring,
    key: Key,
    helmet: Helmet,
    dagger: Dagger,
    elixir: Elixir,
    fire: Fire,
    boots: Boots,
    axe: Axe,
    gskull: Skull,
    pheart: Heart,
  };
  return defs
    .map((d) => ({ ...d, svg: flattenIcon(icons[d.id]) }))
    .filter((p) => !!p.svg);
}

function tipEl(): HTMLElement {
  let el = document.getElementById('gpPropTip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'gpPropTip';
    el.className = 'gp-prop-tip';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  return el;
}

function showTip(text: string, x: number, y: number): void {
  const el = tipEl();
  el.textContent = text;
  el.style.left = `${Math.min(window.innerWidth - 220, Math.max(12, x + 14))}px`;
  el.style.top = `${Math.min(window.innerHeight - 64, Math.max(12, y - 12))}px`;
  el.classList.add('is-on');
  window.clearTimeout((el as HTMLElement & { _t?: number })._t);
  (el as HTMLElement & { _t?: number })._t = window.setTimeout(() => {
    el.classList.remove('is-on');
  }, 2000);
}

function mountStarfield(host: HTMLElement): () => void {
  const canvas = document.createElement('canvas');
  canvas.className = 'gp-starfield';
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => canvas.remove();

  let w = 0;
  let h = 0;
  let raf = 0;
  let t = 0;
  const stars: StarDot[] = [];

  const resize = () => {
    w = window.innerWidth;
    h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!stars.length) {
      for (let i = 0; i < 160; i += 1) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          z: 0.25 + Math.random() * 1.4,
          s: 0.6 + Math.random() * 1.8,
        });
      }
    }
  };

  const tick = () => {
    t += 1;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(120, 90, 200, 0.06)';
    ctx.lineWidth = 1;
    const gap = 48;
    const ox = (t * 0.08) % gap;
    const oy = (t * 0.05) % gap;
    ctx.beginPath();
    for (let x = -gap + ox; x < w + gap; x += gap) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = -gap + oy; y < h + gap; y += gap) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    for (const star of stars) {
      star.x += 0.15 * star.z;
      star.y += 0.04 * star.z;
      if (star.x > w + 4) star.x = -4;
      if (star.y > h + 4) star.y = -4;
      const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.04 + star.x));
      ctx.fillStyle = `rgba(230, 240, 255, ${twinkle})`;
      const size = star.s * star.z;
      ctx.fillRect(Math.floor(star.x), Math.floor(star.y), size, size);
    }
    raf = requestAnimationFrame(tick);
  };

  resize();
  window.addEventListener('resize', resize);
  raf = requestAnimationFrame(tick);

  return () => {
    window.removeEventListener('resize', resize);
    cancelAnimationFrame(raf);
    canvas.remove();
  };
}

/** 挂载宇宙背景 + 斥力道具；返回销毁函数 */
export function mountPixelStage(
  host: HTMLElement | null,
  options: PixelStageOptions = {},
): () => void {
  if (!host) return () => undefined;

  const disposeStars = mountStarfield(host);
  const props = buildProps();
  const layer = document.createElement('div');
  layer.className = 'gp-prop-layer-root';
  layer.innerHTML = props
    .map(
      (p) =>
        `<button type="button" class="gp-prop" data-prop="${p.id}" ` +
        `style="left:${p.x}%;top:${p.y}%;--gp-prop-size:${p.size}px" ` +
        `aria-label="${p.tip}">${p.svg}</button>`,
    )
    .join('');
  host.appendChild(layer);

  const nodes = [...layer.querySelectorAll<HTMLElement>('.gp-prop')];
  const offsets = new Map<HTMLElement, { x: number; y: number }>();
  nodes.forEach((n) => offsets.set(n, { x: 0, y: 0 }));

  let raf = 0;
  let mx = -9999;
  let my = -9999;
  const radius = 140;
  const strength = 56;

  const apply = () => {
    raf = 0;
    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = cx - mx;
      const dy = cy - my;
      const dist = Math.hypot(dx, dy) || 0.001;
      const cur = offsets.get(node) || { x: 0, y: 0 };
      let tx = 0;
      let ty = 0;
      if (dist < radius) {
        const force = (1 - dist / radius) * strength;
        tx = (dx / dist) * force;
        ty = (dy / dist) * force;
      }
      cur.x += (tx - cur.x) * 0.22;
      cur.y += (ty - cur.y) * 0.22;
      if (Math.abs(cur.x) < 0.05) cur.x = 0;
      if (Math.abs(cur.y) < 0.05) cur.y = 0;
      offsets.set(node, cur);
      node.style.translate = `${cur.x}px ${cur.y}px`;
    }
  };

  const onMove = (ev: PointerEvent) => {
    mx = ev.clientX;
    my = ev.clientY;
    if (!raf) raf = requestAnimationFrame(apply);
  };

  const onLeave = () => {
    mx = -9999;
    my = -9999;
    if (!raf) raf = requestAnimationFrame(apply);
  };

  const onClick = (ev: Event) => {
    const btn = (ev.target as HTMLElement).closest<HTMLElement>('.gp-prop');
    if (!btn) return;
    const id = btn.dataset.prop || '';
    const prop = props.find((p) => p.id === id);
    btn.classList.remove('is-pop');
    void btn.offsetWidth;
    btn.classList.add('is-pop');
    const pe = ev as PointerEvent;
    showTip(prop?.tip || '…', pe.clientX || 0, pe.clientY || 0);
    options.onPropClick?.(id);
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerleave', onLeave);
  layer.addEventListener('click', onClick);

  return () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerleave', onLeave);
    layer.removeEventListener('click', onClick);
    if (raf) cancelAnimationFrame(raf);
    tipEl().classList.remove('is-on');
    disposeStars();
    layer.remove();
    host.innerHTML = '';
  };
}
