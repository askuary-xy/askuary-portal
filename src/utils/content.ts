export { escapeHtml, formatDate } from './html';

export function isShuoshuo(post: { tags?: string[] }): boolean {
  return Boolean(
    post.tags?.some((t) => {
      const tag = String(t || '').trim().toLowerCase();
      return tag === '碎念' || tag === '说说' || tag === 'shuoshuo';
    }),
  );
}

/** 文章详情返回目标：碎念 / 文章列表 / 主页 */
export function resolveJournalBack(post: { tags?: string[] }): {
  href: string;
  label: string;
} {
  let fromStorage = '';
  try {
    fromStorage = sessionStorage.getItem('askuary:from') || '';
  } catch {
    /* ignore */
  }

  const fromQuery = new URLSearchParams(window.location.search).get('from');
  const fromReferrerShuoshuo = /\/shuoshuo\/?/i.test(document.referrer || '');
  const fromReferrerArticles = /\/articles\/?/i.test(document.referrer || '');
  const toShuoshuo =
    isShuoshuo(post) ||
    fromQuery === 'shuoshuo' ||
    fromStorage === 'shuoshuo' ||
    fromReferrerShuoshuo;

  if (toShuoshuo) {
    try {
      sessionStorage.removeItem('askuary:from');
    } catch {
      /* ignore */
    }
    return { href: '/shuoshuo/', label: '← 返回碎念' };
  }

  const toArticles =
    fromQuery === 'articles' ||
    fromStorage === 'articles' ||
    fromReferrerArticles ||
    !isShuoshuo(post);

  if (toArticles && (fromQuery === 'articles' || fromStorage === 'articles' || fromReferrerArticles)) {
    try {
      sessionStorage.removeItem('askuary:from');
    } catch {
      /* ignore */
    }
    return { href: '/articles/', label: '← 返回文章' };
  }

  // 非碎念默认回文章列表（主页已不再挂文章流）
  if (!isShuoshuo(post)) {
    return { href: '/articles/', label: '← 返回文章' };
  }

  return { href: '/home/', label: '← 返回主页' };
}

export function commentPathFor(
  kind: 'journal' | 'blog' | 'friends' | 'photos',
  slug?: string,
): string {
  if (kind === 'friends') return '/friends/';
  if (kind === 'blog') return `/blog/${slug || ''}/`.replace(/\/+/g, '/');
  if (kind === 'photos') {
    return `/photos/item/${slug || ''}/`.replace(/\/+/g, '/');
  }
  return `/journal/${slug || ''}/`.replace(/\/+/g, '/');
}

/** 主页/碎念详情链接：API 文走 view 壳，静态文走构建页 */
export function journalPostHref(
  post: { slug: string; origin?: string },
  opts?: { from?: string },
): string {
  if (post.origin === 'api') {
    const params = new URLSearchParams({ slug: post.slug });
    if (opts?.from) params.set('from', opts.from);
    return `/journal/view/?${params.toString()}`;
  }
  if (opts?.from) {
    return `/journal/${post.slug}/?from=${encodeURIComponent(opts.from)}`;
  }
  return `/journal/${post.slug}/`;
}

export function blogPostHref(post: { slug: string; origin?: string }): string {
  if (post.origin === 'api') {
    return `/blog/view/?slug=${encodeURIComponent(post.slug)}`;
  }
  return `/blog/${post.slug}/`;
}
