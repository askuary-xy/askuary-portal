import './styles/universe.css';
import './styles/earth.css';
import './styles/blackhole.css';
import './styles/atlas.css';
import { Starfield } from './canvas/starfield';
import { initEarth } from './canvas/earth';
import { loadConfig } from './config/loader';
import { initNavPanel, showNavPanel } from './ui/nav-panel';
import { initScrollJourney } from './app/scroll-journey';
import { mountTypewriter } from './ui/typewriter';
import { initAtlas } from './ui/atlas';

const SOCIAL_ICONS: Record<string, string> = {
  github: '⌘',
  email: '✉',
  link: '🔗',
};

async function boot(): Promise<void> {
  const config = await loadConfig();
  const { site } = config;

  document.documentElement.classList.add('footprint-html');
  document.body.classList.add('fp-journey');

  document.title = site.name;

  const root = document.getElementById('footprintIntro');
  if (!root) return;

  const nameEl = document.getElementById('siteName');
  const introEl = document.getElementById('siteIntro');
  const avatarWrap = document.getElementById('siteAvatarWrap');
  const avatarEl = document.getElementById('siteAvatar') as HTMLImageElement | null;
  const socialEl = document.getElementById('siteSocial');

  if (nameEl) nameEl.textContent = site.name;

  if (introEl) {
    const lines = site.taglines?.filter(Boolean);
    if (lines?.length) {
      mountTypewriter(introEl, lines);
    } else {
      introEl.textContent = site.intro;
    }
  }

  if (avatarWrap && avatarEl && site.avatar && site.showAvatar !== false) {
    avatarEl.src = site.avatar;
    avatarEl.alt = site.avatarAlt || site.name;
    avatarWrap.removeAttribute('hidden');
  } else {
    avatarWrap?.remove();
  }

  if (socialEl && site.social?.length) {
    socialEl.innerHTML = site.social
      .map((s) => {
        const icon = SOCIAL_ICONS[s.icon ?? ''] ?? '';
        return `<a class="fp-social-link" href="${s.url}" target="_blank" rel="noopener noreferrer" aria-label="${s.label}"><span class="fp-social-icon" aria-hidden="true">${icon}</span><span>${s.label}</span></a>`;
      })
      .join('');
  }

  initNavPanel();

  const canvas = document.getElementById('fpStars') as HTMLCanvasElement | null;
  if (canvas) {
    const starfield = new Starfield(canvas, (hit) => showNavPanel(hit));
    starfield.setNavStars(config.navStars);
    starfield.setMeteorWords(config.meteorWords);
    starfield.start();
  }

  const earthCanvas = document.getElementById('fpEarth') as HTMLCanvasElement | null;
  if (earthCanvas) {
    const earth = initEarth(earthCanvas, {
      spots: config.spots,
      friends: config.friends,
    });
    initAtlas(root, earth);
  }

  initScrollJourney(root, {
    homeUrl: site.homeUrl || site.blogUrl,
    warpEnabled: site.warpEnabled,
    warpHint: site.warpHint,
  });
}

boot().catch((err) => {
  console.error(err);
  const root = document.getElementById('bootError');
  if (root) {
    root.hidden = false;
    root.textContent = '配置加载失败，请检查 public/data/*.json';
  }
});
