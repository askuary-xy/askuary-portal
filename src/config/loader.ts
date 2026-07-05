import type { PortalConfig } from '../types/config';

export async function loadConfig(): Promise<PortalConfig> {
  const base = import.meta.env.BASE_URL + 'data';
  const [site, navStars, spots, friends, meteorWords] = await Promise.all([
    fetch(`${base}/site.json`).then((r) => r.json()),
    fetch(`${base}/nav-stars.json`).then((r) => r.json()),
    fetch(`${base}/spots.json`).then((r) => r.json()),
    fetch(`${base}/friends.json`).then((r) => r.json()),
    fetch(`${base}/meteor-words.json`).then((r) => r.json()),
  ]);
  return { site, navStars, spots, friends, meteorWords };
}
