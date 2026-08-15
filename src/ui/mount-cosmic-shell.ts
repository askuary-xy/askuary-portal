import '../styles/cosmic-shell.css';
import { Starfield } from '../canvas/starfield';

let generatedStarfield: Starfield | null = null;

function clearGeneratedStarfield(): void {
  generatedStarfield?.stop();
  generatedStarfield = null;
  document.getElementById('cosmicShellFallback')?.remove();
  document.getElementById('cosmicShellStars')?.remove();
}

/**
 * 让所有枢纽内容页共享同一片动态星空。
 * 页面局部画布仅作为前景细节，不能替代全局星空底层。
 */
export function mountCosmicShell(): void {
  clearGeneratedStarfield();

  document.documentElement.classList.add('askuary-cosmos');
  document.body.classList.add('askuary-cosmos');

  document.querySelectorAll('.home-bg, .quote-bg, .weather-atmosphere').forEach((node) => node.remove());

  const fallback = document.createElement('div');
  fallback.id = 'cosmicShellFallback';
  fallback.className = 'cosmic-shell-fallback';
  fallback.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(fallback, document.body.firstChild);

  const canvas = document.createElement('canvas');
  canvas.id = 'cosmicShellStars';
  canvas.className = 'cosmic-shell-stars';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);

  generatedStarfield = new Starfield(canvas, () => {});
  generatedStarfield.setNavStars([]);
  generatedStarfield.setMeteorWords([]);
  generatedStarfield.start();
}

export function unmountCosmicShell(): void {
  clearGeneratedStarfield();
  document.documentElement.classList.remove('askuary-cosmos');
  document.body.classList.remove('askuary-cosmos');
}
