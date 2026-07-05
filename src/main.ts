import './styles/universe.css';
import './styles/earth.css';
import './styles/blackhole.css';
import { Starfield } from './canvas/starfield';
import { initEarth } from './canvas/earth';
import { loadConfig } from './config/loader';
import { initNavPanel, showNavPanel } from './ui/nav-panel';
import { initScrollJourney } from './app/scroll-journey';

async function boot(): Promise<void> {
  const config = await loadConfig();
  const { site } = config;

  document.documentElement.classList.add('footprint-html');
  document.body.classList.add('fp-journey');

  document.title = `${site.name} | Link Start`;

  const root = document.getElementById('footprintIntro');
  if (!root) return;

  root.dataset.homeUrl = site.homeUrl;
  root.dataset.fallbackBlogUrl = site.blogUrl;

  const nameEl = document.getElementById('siteName');
  const introEl = document.getElementById('siteIntro');
  const avatarWrap = document.getElementById('siteAvatarWrap');
  const avatarEl = document.getElementById('siteAvatar') as HTMLImageElement | null;
  const socialEl = document.getElementById('siteSocial');

  if (nameEl) nameEl.textContent = site.name;
  if (introEl) introEl.textContent = site.intro;
  if (avatarEl && site.avatar) {
    avatarEl.src = site.avatar;
    avatarEl.alt = site.avatarAlt || site.name;
    avatarWrap?.removeAttribute('hidden');
  }

  if (socialEl && site.social?.length) {
    socialEl.innerHTML = site.social
      .map(
        (s) =>
          `<a class="fp-social-link" href="${s.url}" target="_blank" rel="noopener noreferrer">${s.label}</a>`,
      )
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
    initEarth(earthCanvas, {
      spots: config.spots,
      friends: config.friends,
    });
  }

  initScrollJourney(root, {
    homeUrl: site.homeUrl,
    blogUrl: site.blogUrl,
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
