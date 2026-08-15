import '../styles/pixel-pet.css';
import { escapeHtml } from '../pages/home/shared';
import { adoptSiteWidgetsIntoPet } from './mount-site-widgets';

const STORAGE_KEY = 'askuary_pixel_pet';
const HIDDEN_KEY = 'askuary_pixel_pet_hidden';

export type PetKind = 'cat' | 'dog' | 'bunny';

const PET_ORDER: PetKind[] = ['cat', 'dog', 'bunny'];

const PET_LABEL: Record<PetKind, string> = {
  cat: '像素猫',
  dog: '像素狗',
  bunny: '像素兔',
};

const PET_PREFIX: Record<PetKind, string> = {
  cat: '喵',
  dog: '汪',
  bunny: '哼',
};

const DEFAULT_LINES = [
  '喵…今天也要慢慢逛～',
  '汪！欢迎穿越回来！',
  '角落有光，也有我。',
  '点我可以换一句废话。',
  '粉蓝天空，透气刚刚好。',
  '黑洞那头泡好了茶。',
  '别急，宇宙不催人。',
  '我的小鱼干…去哪了…',
];

const PAGE_LINES: Record<string, string[]> = {
  home: [
    '指挥台在线，今天读点什么？',
    '最新文章在下方，像拼图一样摆着。',
    '公告栏有新鲜事，别漏看～',
    '从黑洞穿越回来啦？先歇口气。',
  ],
  shuoshuo: [
    '碎念像小石子，丢进湖面会有涟漪。',
    '短句也有重量，慢慢翻就好。',
    '这里的字很轻，但留得住。',
  ],
  photos: [
    '快门声最小化，我在旁边守着。',
    '每张照片背后，都有一段故事。',
    '光落在像素上，也会变暖。',
    '摄影墙的光，我帮你看着呢。',
  ],
  'photos/album': [
    '这一帧的故事，值得慢慢读。',
    '作者栏下面还有音乐，别漏听～',
    '上一张下一张，像翻相册一样。',
  ],
  library: [
    '馆藏是另一个宇宙，一本一本翻。',
    '在读什么？可以跟我讲讲～',
    '封面好看，内容更好看。',
  ],
  archive: [
    '归档像星图，找旧文很方便。',
    '标签是坐标，点一下就能定位。',
  ],
  blog: [
    '长文适合泡杯茶，慢慢读。',
    '目录在侧栏，别迷路～',
  ],
  friends: [
    '友联卫星轨道正常，信号友好。',
    '去串门记得回来，我还在这儿。',
  ],
  about: [
    '关于页是自我介绍，像名片一样。',
  ],
};

const TIME_LINES: Record<'morning' | 'afternoon' | 'evening' | 'night', string[]> = {
  morning: ['早安～今天也要元气满满。', '晨光不错，适合随便逛逛。', '早起的星星还没下班呢。'],
  afternoon: ['午后有点困？点我聊聊天。', '阳光正好，适合翻摄影墙。', '下午茶时间到～'],
  evening: ['傍晚的风很温柔，慢慢走。', '天色渐暗，站点灯还亮着。', '今天过得怎么样？'],
  night: ['夜深了，键盘声要小一点哦。', '月亮在值班，我也在。', '别熬太晚，明天宇宙还在。'],
};

const ACTION_LINES: Record<'pat' | 'feed' | 'poke', Record<PetKind, string[]>> = {
  pat: {
    cat: ['呼噜呼噜…再摸一下？', '喵～毛茸茸认证通过。', '下巴那里…也可以。'],
    dog: ['汪！尾巴摇成螺旋桨了！', '摸头杀成功，好感度+1。', '好舒服，继续继续！'],
    bunny: ['耳朵抖了一下…开心。', '哼唧，软绵绵的。', '脸颊鼓鼓，别停～'],
  },
  feed: {
    cat: ['小鱼干！今日最佳！', '喵～吃饱了想睡觉…', '罐头等级：SSR。'],
    dog: ['骨头 crunch crunch～', '汪！能量补满！', '饭后散步？走！'],
    bunny: ['胡萝卜！脆脆的～', '哼，腮帮子又鼓了。', '牧草新鲜度：五星。'],
  },
  poke: {
    cat: ['喵？！别戳鼻子…', '再戳就咬你（假的）。', '已启动无视模式…3秒。'],
    dog: ['汪！吓一跳…但很开心。', '突然袭击！反击是舔脸。', '嘿嘿，抓到你了。'],
    bunny: ['耳朵竖起来！发生什么了？', '哼，跳跃闪避失败。', '弹一下，退后三步。'],
  },
};

function pixelSvg(kind: PetKind): string {
  if (kind === 'dog') {
    return (
      `<svg class="pixel-pet-svg" viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true">` +
      `<rect x="8" y="10" width="16" height="12" fill="#e8c49a"/>` +
      `<rect x="6" y="8" width="6" height="6" fill="#c4925a"/>` +
      `<rect x="20" y="8" width="6" height="6" fill="#c4925a"/>` +
      `<rect x="10" y="14" width="3" height="3" fill="#3a2a20"/>` +
      `<rect x="19" y="14" width="3" height="3" fill="#3a2a20"/>` +
      `<rect x="14" y="18" width="4" height="2" fill="#d4a878"/>` +
      `<rect x="12" y="22" width="8" height="6" fill="#e8c49a"/>` +
      `<rect x="22" y="16" width="4" height="3" fill="#c4925a"/>` +
      `</svg>`
    );
  }
  if (kind === 'bunny') {
    return (
      `<svg class="pixel-pet-svg" viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true">` +
      `<rect x="10" y="2" width="4" height="10" fill="#efe6d8"/>` +
      `<rect x="18" y="2" width="4" height="10" fill="#efe6d8"/>` +
      `<rect x="11" y="4" width="2" height="6" fill="#e8c8b8"/>` +
      `<rect x="19" y="4" width="2" height="6" fill="#e8c8b8"/>` +
      `<rect x="9" y="11" width="14" height="12" fill="#f4efe6"/>` +
      `<rect x="11" y="15" width="3" height="3" fill="#2a3a48"/>` +
      `<rect x="18" y="15" width="3" height="3" fill="#2a3a48"/>` +
      `<rect x="14" y="19" width="4" height="2" fill="#d4a878"/>` +
      `<rect x="12" y="23" width="8" height="5" fill="#f4efe6"/>` +
      `</svg>`
    );
  }
  return (
    `<svg class="pixel-pet-svg" viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true">` +
    `<rect x="8" y="6" width="4" height="4" fill="#f2d5b8"/>` +
    `<rect x="20" y="6" width="4" height="4" fill="#f2d5b8"/>` +
    `<rect x="9" y="7" width="2" height="2" fill="#3a2a40"/>` +
    `<rect x="21" y="7" width="2" height="2" fill="#3a2a40"/>` +
    `<rect x="8" y="10" width="16" height="12" fill="#f7e0c8"/>` +
    `<rect x="8" y="10" width="5" height="5" fill="#5c4033"/>` +
    `<rect x="19" y="10" width="5" height="5" fill="#5c4033"/>` +
    `<rect x="11" y="14" width="3" height="3" fill="#4aa3ff"/>` +
    `<rect x="18" y="14" width="3" height="3" fill="#4aa3ff"/>` +
    `<rect x="14" y="18" width="4" height="2" fill="#d4a878"/>` +
    `<rect x="12" y="22" width="8" height="6" fill="#f7e0c8"/>` +
    `<rect x="15" y="12" width="2" height="2" fill="#c4925a"/>` +
    `</svg>`
  );
}

function readKind(): PetKind {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'cat' || v === 'dog' || v === 'bunny') return v;
  } catch {
    /* ignore */
  }
  return 'cat';
}

function writeKind(kind: PetKind): void {
  try {
    localStorage.setItem(STORAGE_KEY, kind);
  } catch {
    /* ignore */
  }
}

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

function writeHidden(hidden: boolean): void {
  try {
    localStorage.setItem(HIDDEN_KEY, hidden ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function nextKind(cur: PetKind): PetKind {
  const i = PET_ORDER.indexOf(cur);
  return PET_ORDER[(i + 1) % PET_ORDER.length];
}

function pickLine(lines: string[], last: string): string {
  const pool = lines.length ? lines : DEFAULT_LINES;
  if (pool.length === 1) return pool[0];
  let next = pool[Math.floor(Math.random() * pool.length)];
  let guard = 0;
  while (next === last && guard++ < 6) {
    next = pool[Math.floor(Math.random() * pool.length)];
  }
  return next;
}

function timeSlot(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

function pageKey(): string {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path.includes('/photos/album')) return 'photos/album';
  if (path.includes('/photos')) return 'photos';
  if (path.includes('/shuoshuo')) return 'shuoshuo';
  if (path.includes('/library')) return 'library';
  if (path.includes('/archive')) return 'archive';
  if (path.includes('/friends')) return 'friends';
  if (path.includes('/about')) return 'about';
  if (path.includes('/blog')) return 'blog';
  if (path.includes('/home') || path.endsWith('/index.html') || path === '/') return 'home';
  return 'home';
}

function buildLinePool(customLines: string[]): string[] {
  const base = customLines.length ? customLines : DEFAULT_LINES;
  const page = PAGE_LINES[pageKey()] || [];
  const time = TIME_LINES[timeSlot()] || [];
  return [...base, ...page, ...time];
}

function actionLine(action: 'pat' | 'feed' | 'poke', kind: PetKind): string {
  const pool = ACTION_LINES[action][kind];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function mountPixelPet(options?: { lines?: string[] }): void {
  const existing = document.getElementById('pixelPet');
  if (existing) {
    adoptSiteWidgetsIntoPet(existing.querySelector('#pixelPetClimate'));
    return;
  }

  const customLines = (options?.lines || [])
    .map((s) => String(s || '').trim())
    .filter(Boolean);

  let kind = readKind();
  let lastLine = '';
  let hidden = readHidden();
  let idleTimer = 0;
  let clickTimer = 0;
  let clickCount = 0;

  const root = document.createElement('div');
  root.id = 'pixelPet';
  root.className = 'pixel-pet';
  root.innerHTML =
    `<div class="pixel-pet-bubble" id="pixelPetBubble" hidden></div>` +
    `<div class="pixel-pet-climate" id="pixelPetClimate" aria-label="天气与昼夜"></div>` +
    `<div class="pixel-pet-toolbar" id="pixelPetToolbar">` +
    `<button type="button" class="pixel-pet-action" data-action="pat" title="摸头">摸</button>` +
    `<button type="button" class="pixel-pet-action" data-action="feed" title="喂食">食</button>` +
    `<button type="button" class="pixel-pet-switch" id="pixelPetSwitch" title="切换宠物">⇄</button>` +
    `<button type="button" class="pixel-pet-hide" id="pixelPetHide" title="收起">−</button>` +
    `</div>` +
    `<div class="pixel-pet-stage">` +
    `<button type="button" class="pixel-pet-body" id="pixelPetBody" aria-label="${escapeHtml(PET_LABEL[kind])}">` +
    pixelSvg(kind) +
    `</button>` +
    `</div>` +
    `<button type="button" class="pixel-pet-restore" id="pixelPetRestore" title="唤出伙伴" hidden>` +
    `<span class="pixel-pet-restore-dot" aria-hidden="true"></span>` +
    `<span class="pixel-pet-restore-label">${PET_PREFIX[kind]}</span>` +
    `</button>`;

  document.body.appendChild(root);
  adoptSiteWidgetsIntoPet(root.querySelector('#pixelPetClimate'));

  const bubble = root.querySelector<HTMLElement>('#pixelPetBubble');
  const bodyBtn = root.querySelector<HTMLButtonElement>('#pixelPetBody');
  const switchBtn = root.querySelector<HTMLButtonElement>('#pixelPetSwitch');
  const hideBtn = root.querySelector<HTMLButtonElement>('#pixelPetHide');
  const restoreBtn = root.querySelector<HTMLButtonElement>('#pixelPetRestore');
  const toolbar = root.querySelector<HTMLElement>('#pixelPetToolbar');
  let hideBubbleTimer = 0;

  const getPool = () => buildLinePool(customLines);

  const bounce = () => {
    if (!bodyBtn) return;
    bodyBtn.classList.remove('is-bounce', 'is-wiggle', 'is-hop');
    void bodyBtn.offsetWidth;
    bodyBtn.classList.add('is-bounce');
  };

  const showBubble = (text: string, duration = 3400) => {
    if (!bubble || hidden) return;
    bubble.hidden = false;
    bubble.textContent = text;
    bubble.classList.add('is-show');
    window.clearTimeout(hideBubbleTimer);
    hideBubbleTimer = window.setTimeout(() => {
      bubble.classList.remove('is-show');
      window.setTimeout(() => {
        bubble.hidden = true;
      }, 220);
    }, duration);
  };

  const renderPet = () => {
    if (!bodyBtn) return;
    bodyBtn.innerHTML = pixelSvg(kind);
    bodyBtn.setAttribute('aria-label', PET_LABEL[kind]);
    const restoreLabel = root.querySelector('.pixel-pet-restore-label');
    if (restoreLabel) restoreLabel.textContent = PET_PREFIX[kind];
  };

  const applyHidden = () => {
    root.classList.toggle('is-hidden', hidden);
    if (restoreBtn) restoreBtn.hidden = !hidden;
    if (toolbar) toolbar.hidden = hidden;
    if (bodyBtn) bodyBtn.hidden = hidden;
    if (bubble && hidden) {
      bubble.hidden = true;
      bubble.classList.remove('is-show');
    }
  };

  const scheduleIdle = () => {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(
      () => {
        if (hidden || document.hidden) {
          scheduleIdle();
          return;
        }
        lastLine = pickLine(getPool(), lastLine);
        showBubble(lastLine, 3800);
        scheduleIdle();
      },
      85000 + Math.floor(Math.random() * 55000),
    );
  };

  bodyBtn?.addEventListener('click', () => {
    clickCount += 1;
    window.clearTimeout(clickTimer);
    clickTimer = window.setTimeout(() => {
      if (clickCount >= 2) {
        showBubble(actionLine('poke', kind));
        bodyBtn?.classList.add('is-wiggle');
        window.setTimeout(() => bodyBtn?.classList.remove('is-wiggle'), 500);
      } else {
        lastLine = pickLine(getPool(), lastLine);
        showBubble(lastLine);
        bounce();
      }
      clickCount = 0;
    }, 260);
  });

  switchBtn?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    kind = nextKind(kind);
    writeKind(kind);
    renderPet();
    showBubble(`换成${PET_LABEL[kind]}啦～`);
    bounce();
  });

  hideBtn?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    hidden = true;
    writeHidden(true);
    applyHidden();
  });

  restoreBtn?.addEventListener('click', () => {
    hidden = false;
    writeHidden(false);
    applyHidden();
    showBubble(`${PET_PREFIX[kind]}…你回来啦！`);
    bounce();
  });

  toolbar?.querySelectorAll<HTMLButtonElement>('.pixel-pet-action').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const action = btn.dataset.action as 'pat' | 'feed' | undefined;
      if (!action) return;
      showBubble(actionLine(action, kind));
      bounce();
      if (action === 'feed') bodyBtn?.classList.add('is-hop');
      window.setTimeout(() => bodyBtn?.classList.remove('is-hop'), 520);
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden || hidden) return;
    showBubble(pickLine(TIME_LINES[timeSlot()], lastLine), 2800);
  });

  applyHidden();
  renderPet();
  scheduleIdle();

  if (!hidden) {
    window.setTimeout(() => {
      const greet =
        pageKey() === 'photos/album'
          ? '这张照片的故事，慢慢读～'
          : pickLine(getPool(), '');
      lastLine = greet;
      showBubble(greet);
    }, 900);
  }
}
