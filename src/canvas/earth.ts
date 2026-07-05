import type { EarthSpot, Friend } from '../types/config';
import {
  destroyEarthScene,
  initEarthScene,
  revealFriendByIndex,
  revealSpotByIndex,
  getEarthFriends,
  getEarthSpots,
} from './earth-scene.js';

export interface EarthConfigInput {
  spots: EarthSpot[];
  friends: Friend[];
}

export interface EarthController {
  destroy: () => void;
  revealSpotByIndex: (index: number) => boolean;
  revealFriendByIndex: (index: number) => boolean;
  getSpots: () => ReturnType<typeof getEarthSpots>;
  getFriends: () => ReturnType<typeof getEarthFriends>;
}

/** 启动粒子地球（光点 + 友联卫星 + 天空文字层） */
export function initEarth(
  canvas: HTMLCanvasElement,
  config: EarthConfigInput,
): EarthController {
  const normalized = {
    spots: config.spots.map((s) => ({
      lat: s.lat,
      lng: s.lng,
      title: s.title,
      text: s.text,
      style: s.style,
      url: s.url ?? '',
      link_label: s.linkLabel ?? '',
    })),
    friends: config.friends.map((f) => ({
      title: f.title,
      text: f.text,
      avatar: f.avatar ?? '',
      url: f.url,
      link_label: f.linkLabel ?? '',
    })),
    styles: {},
  };

  initEarthScene(canvas, normalized);

  const hasContent = normalized.spots.length > 0 || normalized.friends.length > 0;
  if (hasContent) {
    canvas.classList.add('fp-earth-has-spots');
    canvas.setAttribute('aria-hidden', 'false');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', '可点击的粒子地球');
  }

  return {
    destroy: () => destroyEarthScene(canvas),
    revealSpotByIndex,
    revealFriendByIndex,
    getSpots: getEarthSpots,
    getFriends: getEarthFriends,
  };
}
