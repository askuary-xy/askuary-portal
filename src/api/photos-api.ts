import type { PhotoAlbum, PhotoMetaItem } from '../types/config';

function normalizeBase(apiBase: string): string {
  return apiBase.replace(/\/$/, '');
}

export async function fetchPhotosApi(
  apiBase: string,
): Promise<{
  albums: PhotoAlbum[];
  photos: PhotoMetaItem[];
  suppressedIds?: string[];
} | null> {
  if (!apiBase?.trim()) return null;
  try {
    const res = await fetch(`${normalizeBase(apiBase)}/api/photos`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      albums?: PhotoAlbum[];
      photos?: PhotoMetaItem[];
      suppressedIds?: string[];
    };
    return {
      albums: data.albums || [],
      photos: data.photos || [],
      suppressedIds: data.suppressedIds || [],
    };
  } catch {
    return null;
  }
}
