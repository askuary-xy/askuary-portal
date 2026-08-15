import './styles/universe.css';
import './styles/earth.css';
import './styles/blackhole.css';
import './styles/atlas.css';
import './styles/page-chrome.css';
import './styles/starport-theme.css';
import './styles/interaction-polish.css';
import { loadConfig } from './config/loader';
import { GalaxyPointCloud } from './app/galaxy-point-cloud';
import { GalaxySystem } from './app/galaxy-system';
import { SolarSystemScene } from './app/solar-system-scene';
import { BlackholeScene } from './app/blackhole-scene';

let galaxySystem: GalaxySystem | undefined;
let pointCloud: GalaxyPointCloud | undefined;
let solarSystem: SolarSystemScene | undefined;
let blackhole: BlackholeScene | undefined;
let disposed = false;

function cleanupRuntime(): void {
  if (disposed) return;
  disposed = true;
  galaxySystem?.destroy();
  pointCloud?.destroy();
  solarSystem?.destroy();
  const destroyableBlackhole = blackhole as (BlackholeScene & { destroy?: () => void }) | undefined;
  destroyableBlackhole?.destroy?.();
  galaxySystem = undefined;
  pointCloud = undefined;
  solarSystem = undefined;
  blackhole = undefined;
}

const handlePageHide = (): void => cleanupRuntime();
window.addEventListener('pagehide', handlePageHide);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener('pagehide', handlePageHide);
    cleanupRuntime();
  });
}

async function boot(): Promise<void> {
  const config = await loadConfig();
  if (disposed) return;
  const { site } = config;

  document.documentElement.classList.add('footprint-html');
  document.body.classList.add('fp-journey', 'fp-galaxy-mode');

  document.title = site.name;
  const canvas = document.getElementById('fpGalaxySystem') as HTMLCanvasElement | null;
  const pointCloudCanvas = document.getElementById('fpGalaxyPointCloud') as HTMLCanvasElement | null;
  const solarSystemCanvas = document.getElementById('fpSolarSystemScene') as HTMLCanvasElement | null;
  const blackholeCanvas = document.getElementById('fpBlackholeSystemScene') as HTMLCanvasElement | null;
  pointCloud = pointCloudCanvas ? new GalaxyPointCloud(pointCloudCanvas) : undefined;
  solarSystem = solarSystemCanvas ? new SolarSystemScene(solarSystemCanvas) : undefined;
  solarSystem?.setFriends(config.friends);
  solarSystem?.setNavigationCraft(config.navStars);
  blackhole = blackholeCanvas ? new BlackholeScene(blackholeCanvas) : undefined;
  galaxySystem = canvas ? new GalaxySystem(canvas, config.friends, config.navStars, config.meteorWords, pointCloud, solarSystem, blackhole) : undefined;
}

boot().catch((err) => {
  if (disposed) return;
  console.error(err);
  cleanupRuntime();
  const root = document.getElementById('bootError');
  if (root) {
    root.hidden = false;
    root.textContent = '配置加载失败，请检查 public/data/*.json';
  }
});
