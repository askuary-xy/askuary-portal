import { gridToSvg, type PxlKitData, type AnyIcon } from '@pxlkit/core';

/** 将 Pxlkit 图标（静态 / 动画首帧）转为内联 SVG */
export function iconToSvg(icon: AnyIcon | PxlKitData): string {
  const data = toStaticIcon(icon);
  if (!data) return '';
  try {
    return gridToSvg(data);
  } catch {
    return '';
  }
}

export function toStaticIcon(icon: AnyIcon | PxlKitData): PxlKitData | null {
  if (!icon || typeof icon !== 'object') return null;
  const any = icon as PxlKitData & { frames?: string[][] };
  if (Array.isArray(any.grid) && any.grid.length) return any as PxlKitData;
  if (Array.isArray(any.frames) && any.frames[0]) {
    return {
      name: any.name,
      size: any.size,
      category: any.category,
      grid: any.frames[0],
      palette: any.palette,
      tags: any.tags || [],
      author: any.author,
    };
  }
  return null;
}

export function iconImgHtml(
  icon: AnyIcon | PxlKitData,
  options: { className?: string; label?: string } = {},
): string {
  const svg = iconToSvg(icon);
  if (!svg) return '';
  const cls = options.className ? ` class="${options.className}"` : '';
  const label = options.label ? ` aria-label="${options.label}"` : ' aria-hidden="true"';
  return `<span${cls}${label}>${svg}</span>`;
}
