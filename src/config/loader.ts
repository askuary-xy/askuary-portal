import { fetchContentPost, fetchContentVisibility, fetchPublishedContent } from '../api/content-api';
import { fetchPhotosApi } from '../api/photos-api';
import { fetchLibraryApi, mergeLibraryIndex } from '../api/library-api';
import { fetchPortalItems, fetchPortalOverlay } from '../api/portal-api';
import type {
  AboutPageData,
  ArchiveEntry,
  ArchivePageData,
  BlogListPageData,
  BlogPostMeta,
  BlogPostPageData,
  FriendsPageData,
  HomePageData,
  JournalPostPageData,
  MeteorWord,
  LibraryPageData,
  PhotosPageData,
  PortalConfig,
  SiteConfig,
} from '../types/config';
import { mergeArchiveIndex, mergePostIndex } from '../utils/content-merge';
import { mergePhotowallIndex } from '../utils/photos-merge';

const dataBase = () => import.meta.env.BASE_URL + 'data';

/** 避免浏览器缓存旧 JSON，上传后首页看起来“没变化” */
const noStore: RequestInit = { cache: 'no-store' };

async function resolveMeteorWords(
  apiBase: string | undefined,
  fallback: MeteorWord[],
): Promise<MeteorWord[]> {
  const fromApi = await fetchPortalItems<MeteorWord>(apiBase, 'meteor-words');
  return fromApi ?? fallback;
}

async function loadSite(): Promise<SiteConfig> {
  return fetch(`${dataBase()}/site.json`, noStore).then((r) => r.json());
}

export { loadSite };

async function mergeJournalIndex(
  staticPosts: BlogPostMeta[],
  apiBase?: string,
): Promise<BlogPostMeta[]> {
  if (!apiBase?.trim()) {
    return staticPosts.map((p) => ({ ...p, origin: p.origin || 'static' }));
  }
  const [apiPosts, visibility] = await Promise.all([
    fetchPublishedContent(apiBase, 'journal'),
    fetchContentVisibility(apiBase, 'journal'),
  ]);
  // 后台已接管：只显示 API 已发布，不再用静态 JSON 垫底
  const base = visibility.managed ? [] : staticPosts;
  return mergePostIndex(base, apiPosts, visibility.suppressedKeys);
}

async function mergeBlogIndex(
  staticPosts: BlogPostMeta[],
  apiBase?: string,
): Promise<BlogPostMeta[]> {
  if (!apiBase?.trim()) {
    return staticPosts.map((p) => ({ ...p, origin: p.origin || 'static' }));
  }
  const [apiPosts, visibility] = await Promise.all([
    fetchPublishedContent(apiBase, 'blog'),
    fetchContentVisibility(apiBase, 'blog'),
  ]);
  const base = visibility.managed ? [] : staticPosts;
  return mergePostIndex(base, apiPosts, visibility.suppressedKeys);
}

export async function loadConfig(): Promise<PortalConfig> {
  const base = dataBase();
  const [site, navStars, spots, friends, meteorWords] = await Promise.all([
    fetch(`${base}/site.json`, noStore).then((r) => r.json()),
    fetch(`${base}/nav-stars.json`, noStore).then((r) => r.json()),
    fetch(`${base}/spots.json`, noStore).then((r) => r.json()),
    fetch(`${base}/friends.json`, noStore).then((r) => r.json()),
    fetch(`${base}/meteor-words.json`, noStore).then((r) => r.json()),
  ]);
  const overlay = await fetchPortalOverlay(site.apiBase);
  return {
    site,
    navStars: overlay.navStars ?? navStars,
    spots: overlay.spots ?? spots,
    friends,
    meteorWords: overlay.meteorWords ?? meteorWords,
  };
}

export async function loadAboutPage(): Promise<AboutPageData> {
  const base = dataBase();
  const [about, site, meteorWords] = await Promise.all([
    fetch(`${base}/about.json`, noStore).then((r) => {
      if (!r.ok) throw new Error('about.json not found');
      return r.json();
    }),
    fetch(`${base}/site.json`, noStore).then((r) => r.json()),
    fetch(`${base}/meteor-words.json`, noStore).then((r) => r.json()),
  ]);
  return {
    about,
    site,
    meteorWords: await resolveMeteorWords(site.apiBase, meteorWords),
  };
}

export async function loadFriendsPage(): Promise<FriendsPageData> {
  const base = dataBase();
  const [page, site, friends, meteorWords, applicationsRaw, commentsRaw] = await Promise.all([
    fetch(`${base}/friends-page.json`, noStore).then((r) => {
      if (!r.ok) throw new Error('friends-page.json not found');
      return r.json();
    }),
    fetch(`${base}/site.json`, noStore).then((r) => r.json()),
    fetch(`${base}/friends.json`, noStore).then((r) => r.json()),
    fetch(`${base}/meteor-words.json`, noStore).then((r) => r.json()),
    fetch(`${base}/friend-applications.json`, noStore).then((r) =>
      r.ok ? r.json() : { applications: [] },
    ),
    fetch(`${base}/comments.json`, noStore).then((r) => (r.ok ? r.json() : { enabled: false })),
  ]);
  const applications = Array.isArray(applicationsRaw)
    ? applicationsRaw
    : applicationsRaw?.applications || [];
  return {
    page,
    site,
    friends,
    meteorWords: await resolveMeteorWords(site.apiBase, meteorWords),
    applications,
    comments: commentsRaw || { enabled: false },
  };
}

export async function loadBlogListPage(): Promise<BlogListPageData> {
  const base = dataBase();
  const [page, site, posts, meteorWords] = await Promise.all([
    fetch(`${base}/blog-page.json`, noStore).then((r) => {
      if (!r.ok) throw new Error('blog-page.json not found');
      return r.json();
    }),
    loadSite(),
    fetch(`${base}/posts-index.json`, noStore).then((r) => {
      if (!r.ok) return [];
      return r.json();
    }),
    fetch(`${base}/meteor-words.json`, noStore).then((r) => r.json()),
  ]);
  return {
    page,
    site,
    posts: await mergeBlogIndex(posts, site.apiBase),
    meteorWords: await resolveMeteorWords(site.apiBase, meteorWords),
  };
}

export async function loadBlogPostPage(slug: string): Promise<BlogPostPageData> {
  const base = dataBase();
  const site = await loadSite();
  const fromApi = site.apiBase
    ? await fetchContentPost(site.apiBase, 'blog', slug)
    : null;
  if (fromApi) {
    const meteorWords = await fetch(`${base}/meteor-words.json`, noStore).then((r) =>
      r.json(),
    );
    return {
      post: fromApi,
      site,
      meteorWords: await resolveMeteorWords(site.apiBase, meteorWords),
    };
  }

  // 后台已接管：未发布即不存在，禁止回退静态 JSON
  if (site.apiBase?.trim()) {
    const visibility = await fetchContentVisibility(site.apiBase, 'blog');
    if (visibility.managed) {
      throw new Error(`post not found: ${slug}`);
    }
  }

  const [post, meteorWords] = await Promise.all([
    fetch(`${base}/posts/${encodeURIComponent(slug)}.json`, noStore).then((r) => {
      if (!r.ok) throw new Error(`post not found: ${slug}`);
      return r.json();
    }),
    fetch(`${base}/meteor-words.json`, noStore).then((r) => r.json()),
  ]);
  return {
    post,
    site,
    meteorWords: await resolveMeteorWords(site.apiBase, meteorWords),
  };
}

export async function loadHomePage(): Promise<HomePageData> {
  const base = dataBase();
  const [page, site, posts] = await Promise.all([
    fetch(`${base}/home.json`, noStore).then((r) => {
      if (!r.ok) throw new Error('home.json not found');
      return r.json();
    }),
    loadSite(),
    fetch(`${base}/journal-index.json`, noStore).then((r) => {
      if (!r.ok) return [];
      return r.json();
    }),
  ]);
  return {
    page,
    site,
    posts: await mergeJournalIndex(posts, site.apiBase),
  };
}

export async function loadJournalPostPage(slug: string): Promise<JournalPostPageData> {
  const base = dataBase();
  const site = await loadSite();
  const fromApi = site.apiBase
    ? await fetchContentPost(site.apiBase, 'journal', slug)
    : null;
  if (fromApi) return { post: fromApi, site };

  // 后台已接管 / 草稿 / 已删：禁止回退到静态 JSON
  if (site.apiBase?.trim()) {
    const visibility = await fetchContentVisibility(site.apiBase, 'journal');
    if (visibility.managed) {
      throw new Error(`journal post not found: ${slug}`);
    }
  }

  const post = await fetch(`${base}/journal/${encodeURIComponent(slug)}.json`, noStore).then(
    (r) => {
      if (!r.ok) throw new Error(`journal post not found: ${slug}`);
      return r.json();
    },
  );
  return { post, site };
}

export async function loadArchivePage(): Promise<ArchivePageData> {
  const base = dataBase();
  const [page, site, archive, meteorWords] = await Promise.all([
    fetch(`${base}/archive-page.json`, noStore).then((r) => {
      if (!r.ok) throw new Error('archive-page.json not found');
      return r.json();
    }),
    loadSite(),
    fetch(`${base}/archive-index.json`, noStore).then((r) => {
      if (!r.ok) return { entries: [], tags: [] };
      return r.json();
    }),
    fetch(`${base}/meteor-words.json`, noStore).then((r) => r.json()),
  ]);

  let merged = archive;
  if (site.apiBase?.trim()) {
    const [journalApi, blogApi, journalVis, blogVis] = await Promise.all([
      fetchPublishedContent(site.apiBase, 'journal'),
      fetchPublishedContent(site.apiBase, 'blog'),
      fetchContentVisibility(site.apiBase, 'journal'),
      fetchContentVisibility(site.apiBase, 'blog'),
    ]);
    // 已接管的 kind：去掉静态条目，只保留 API 已发布
    let staticArchive = archive;
    if (journalVis.managed || blogVis.managed) {
      staticArchive = {
        ...archive,
        entries: (archive.entries || []).filter((e: ArchiveEntry) => {
          if (e.source === 'journal' && journalVis.managed) return false;
          if (e.source === 'blog' && blogVis.managed) return false;
          return true;
        }),
      };
    }
    merged = mergeArchiveIndex(staticArchive, journalApi, blogApi, {
      journal: journalVis.suppressedKeys,
      blog: blogVis.suppressedKeys,
    });
  }

  return {
    page,
    site,
    archive: merged,
    meteorWords: await resolveMeteorWords(site.apiBase, meteorWords),
  };
}

/** 宇宙·博客专用归档（仅 source=blog） */
export async function loadBlogArchivePage(): Promise<ArchivePageData> {
  const base = dataBase();
  const [page, site, archive, meteorWords] = await Promise.all([
    fetch(`${base}/blog-archive-page.json`, noStore).then((r) => {
      if (!r.ok) throw new Error('blog-archive-page.json not found');
      return r.json();
    }),
    loadSite(),
    fetch(`${base}/blog-archive-index.json`, noStore).then((r) => {
      if (!r.ok) return { entries: [], tags: [] };
      return r.json();
    }),
    fetch(`${base}/meteor-words.json`, noStore).then((r) => r.json()),
  ]);

  let merged = archive;
  if (site.apiBase?.trim()) {
    const [blogApi, blogVis] = await Promise.all([
      fetchPublishedContent(site.apiBase, 'blog'),
      fetchContentVisibility(site.apiBase, 'blog'),
    ]);
    const staticArchive = blogVis.managed
      ? { ...archive, entries: [] }
      : archive;
    merged = mergeArchiveIndex(staticArchive, [], blogApi, {
      blog: blogVis.suppressedKeys,
    });
    merged = {
      entries: merged.entries.filter((e: ArchiveEntry) => e.source === 'blog'),
      tags: merged.tags,
    };
  }

  return {
    page,
    site,
    archive: merged,
    meteorWords: await resolveMeteorWords(site.apiBase, meteorWords),
  };
}

/** 同页内复用摄影数据，避免主页多处重复拉索引 + API */
let photosPageCache: Promise<PhotosPageData> | null = null;

export async function loadPhotosPage(): Promise<PhotosPageData> {
  if (photosPageCache) return photosPageCache;

  photosPageCache = (async () => {
    const base = dataBase();
    const [page, site, photowall] = await Promise.all([
      fetch(`${base}/photos-page.json`, noStore).then((r) => {
        if (!r.ok) throw new Error('photos-page.json not found');
        return r.json();
      }),
      fetch(`${base}/site.json`, noStore).then((r) => r.json()),
      fetch(`${base}/photowall-index.json`, noStore).then((r) => {
        if (!r.ok) return { albums: [], photos: [], categories: [], mapPoints: [] };
        return r.json();
      }),
    ]);

    let merged = photowall;
    if (site.apiBase?.trim()) {
      const api = await fetchPhotosApi(site.apiBase);
      if (api) merged = mergePhotowallIndex(photowall, api);
    }

    return { page, site, photowall: merged };
  })();

  try {
    return await photosPageCache;
  } catch (err) {
    photosPageCache = null;
    throw err;
  }
}

export async function loadLibraryPage(): Promise<LibraryPageData> {
  const base = dataBase();
  const [page, site, library, meteorWords] = await Promise.all([
    fetch(`${base}/library-page.json`, noStore).then((r) => {
      if (!r.ok) throw new Error('library-page.json not found');
      return r.json();
    }),
    loadSite(),
    fetch(`${base}/library.json`, noStore).then((r) => {
      if (!r.ok) return { items: [] };
      return r.json();
    }),
    fetch(`${base}/meteor-words.json`, noStore).then((r) => r.json()),
  ]);

  let merged = library;
  if (site.apiBase?.trim()) {
    const api = await fetchLibraryApi(site.apiBase);
    if (api) merged = mergeLibraryIndex(library, api);
  }

  return {
    page,
    site,
    library: merged,
    meteorWords: await resolveMeteorWords(site.apiBase, meteorWords),
  };
}

export async function loadGamesPage(): Promise<
  import('../types/config').GamesPageData
> {
  const base = dataBase();
  const [page, site, comments] = await Promise.all([
    fetch(`${base}/games-page.json`, noStore).then((r) => {
      if (!r.ok) throw new Error('games-page.json not found');
      return r.json();
    }),
    loadSite(),
    loadCommentsConfig(),
  ]);
  return { page, site, comments };
}

export async function loadCommentsConfig(): Promise<
  import('../types/config').CommentsConfig
> {
  const base = dataBase();
  const r = await fetch(`${base}/comments.json`, noStore);
  if (!r.ok) return { enabled: true, title: '评论' };
  return r.json();
}
