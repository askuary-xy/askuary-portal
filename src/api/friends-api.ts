import type { CommentItem, Friend, FriendApplication } from '../types/config';

function normalizeBase(apiBase: string): string {
  return apiBase.replace(/\/$/, '');
}

export async function fetchFriendApplications(
  apiBase: string,
  opts?: { status?: string; name?: string },
): Promise<FriendApplication[]> {
  const q = new URLSearchParams();
  if (opts?.status && opts.status !== 'all') q.set('status', opts.status);
  if (opts?.name?.trim()) q.set('name', opts.name.trim());
  const qs = q.toString();
  const res = await fetch(
    `${normalizeBase(apiBase)}/api/friend-applications${qs ? `?${qs}` : ''}`,
  );
  if (!res.ok) throw new Error(`申请列表加载失败 (${res.status})`);
  const data = (await res.json()) as { applications?: FriendApplication[] };
  return data.applications || [];
}

export async function fetchPublishedFriends(apiBase: string): Promise<Friend[]> {
  const res = await fetch(`${normalizeBase(apiBase)}/api/friends`);
  if (!res.ok) throw new Error(`友链加载失败 (${res.status})`);
  const data = (await res.json()) as { friends?: Friend[] };
  return data.friends || [];
}

export async function checkFriendExists(
  apiBase: string,
  url: string,
): Promise<{ exists: boolean; suggestType: 'new' | 'update' }> {
  const res = await fetch(
    `${normalizeBase(apiBase)}/api/friend-applications/check-exists?url=${encodeURIComponent(url)}`,
  );
  if (!res.ok) return { exists: false, suggestType: 'new' };
  const data = (await res.json()) as {
    exists?: boolean;
    suggestType?: 'new' | 'update';
  };
  return {
    exists: Boolean(data.exists),
    suggestType: data.suggestType === 'update' ? 'update' : 'new',
  };
}

export async function submitFriendApplication(
  apiBase: string,
  payload: {
    name: string;
    url: string;
    avatar?: string;
    description?: string;
    screenshot?: string;
    email?: string;
    type?: 'new' | 'update';
  },
): Promise<void> {
  const res = await fetch(`${normalizeBase(apiBase)}/api/friend-applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `提交失败 (${res.status})`);
  }
}

export async function fetchComments(
  apiBase: string,
  path = '/friends/',
): Promise<CommentItem[]> {
  const res = await fetch(
    `${normalizeBase(apiBase)}/api/comments?path=${encodeURIComponent(path)}`,
  );
  if (!res.ok) throw new Error(`评论加载失败 (${res.status})`);
  const data = (await res.json()) as { items?: CommentItem[] };
  return data.items || [];
}

export async function submitComment(
  apiBase: string,
  payload: {
    path: string;
    author: string;
    email?: string;
    website?: string;
    content: string;
  },
): Promise<CommentItem & { message?: string }> {
  const res = await fetch(`${normalizeBase(apiBase)}/api/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `发表失败 (${res.status})`);
  }
  return res.json() as Promise<CommentItem & { message?: string }>;
}
