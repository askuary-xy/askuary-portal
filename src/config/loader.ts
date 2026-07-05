import type {
  AboutPageData,
  BlogListPageData,
  BlogPostPageData,
  FriendsPageData,
  HomePageData,
  JournalPostPageData,
  PortalConfig,
} from '../types/config';

const dataBase = () => import.meta.env.BASE_URL + 'data';

export async function loadConfig(): Promise<PortalConfig> {
  const base = dataBase();
  const [site, navStars, spots, friends, meteorWords] = await Promise.all([
    fetch(`${base}/site.json`).then((r) => r.json()),
    fetch(`${base}/nav-stars.json`).then((r) => r.json()),
    fetch(`${base}/spots.json`).then((r) => r.json()),
    fetch(`${base}/friends.json`).then((r) => r.json()),
    fetch(`${base}/meteor-words.json`).then((r) => r.json()),
  ]);
  return { site, navStars, spots, friends, meteorWords };
}

export async function loadAboutPage(): Promise<AboutPageData> {
  const base = dataBase();
  const [about, site, meteorWords] = await Promise.all([
    fetch(`${base}/about.json`).then((r) => {
      if (!r.ok) throw new Error('about.json not found');
      return r.json();
    }),
    fetch(`${base}/site.json`).then((r) => r.json()),
    fetch(`${base}/meteor-words.json`).then((r) => r.json()),
  ]);
  return { about, site, meteorWords };
}

export async function loadFriendsPage(): Promise<FriendsPageData> {
  const base = dataBase();
  const [page, site, friends, meteorWords] = await Promise.all([
    fetch(`${base}/friends-page.json`).then((r) => {
      if (!r.ok) throw new Error('friends-page.json not found');
      return r.json();
    }),
    fetch(`${base}/site.json`).then((r) => r.json()),
    fetch(`${base}/friends.json`).then((r) => r.json()),
    fetch(`${base}/meteor-words.json`).then((r) => r.json()),
  ]);
  return { page, site, friends, meteorWords };
}

export async function loadBlogListPage(): Promise<BlogListPageData> {
  const base = dataBase();
  const [page, site, posts, meteorWords] = await Promise.all([
    fetch(`${base}/blog-page.json`).then((r) => {
      if (!r.ok) throw new Error('blog-page.json not found');
      return r.json();
    }),
    fetch(`${base}/site.json`).then((r) => r.json()),
    fetch(`${base}/posts-index.json`).then((r) => {
      if (!r.ok) return [];
      return r.json();
    }),
    fetch(`${base}/meteor-words.json`).then((r) => r.json()),
  ]);
  return { page, site, posts, meteorWords };
}

export async function loadBlogPostPage(slug: string): Promise<BlogPostPageData> {
  const base = dataBase();
  const [post, site, meteorWords] = await Promise.all([
    fetch(`${base}/posts/${encodeURIComponent(slug)}.json`).then((r) => {
      if (!r.ok) throw new Error(`post not found: ${slug}`);
      return r.json();
    }),
    fetch(`${base}/site.json`).then((r) => r.json()),
    fetch(`${base}/meteor-words.json`).then((r) => r.json()),
  ]);
  return { post, site, meteorWords };
}

export async function loadHomePage(): Promise<HomePageData> {
  const base = dataBase();
  const [page, site, posts] = await Promise.all([
    fetch(`${base}/home.json`).then((r) => {
      if (!r.ok) throw new Error('home.json not found');
      return r.json();
    }),
    fetch(`${base}/site.json`).then((r) => r.json()),
    fetch(`${base}/journal-index.json`).then((r) => {
      if (!r.ok) return [];
      return r.json();
    }),
  ]);
  return { page, site, posts };
}

export async function loadJournalPostPage(slug: string): Promise<JournalPostPageData> {
  const base = dataBase();
  const [post, site] = await Promise.all([
    fetch(`${base}/journal/${encodeURIComponent(slug)}.json`).then((r) => {
      if (!r.ok) throw new Error(`journal post not found: ${slug}`);
      return r.json();
    }),
    fetch(`${base}/site.json`).then((r) => r.json()),
  ]);
  return { post, site };
}
