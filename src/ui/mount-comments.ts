import type { CommentsConfig } from '../types/config';
import { fetchComments, submitComment } from '../api/friends-api';
import { escapeHtml } from '../utils/html';
import { bindEmojiPicker, renderEmojiPickerHtml } from './comment-emoji';

function escapeAttr(text: string): string {
  return escapeHtml(text);
}

function formatCommentBody(content: string): string {
  return escapeHtml(content).replace(/\r\n|\r|\n/g, '<br>');
}

function canUseGiscus(config: CommentsConfig): boolean {
  const g = config.giscus;
  return Boolean(
    g?.enabled &&
      g.repo?.trim() &&
      g.repoId?.trim() &&
      g.categoryId?.trim(),
  );
}

function mountGiscus(container: HTMLElement, config: CommentsConfig): void {
  const g = config.giscus!;
  container.innerHTML = '';
  const script = document.createElement('script');
  script.src = 'https://giscus.app/client.js';
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.setAttribute('data-repo', g.repo);
  script.setAttribute('data-repo-id', g.repoId);
  script.setAttribute('data-category', g.category || 'General');
  script.setAttribute('data-category-id', g.categoryId);
  script.setAttribute('data-mapping', g.mapping || 'pathname');
  script.setAttribute('data-strict', '0');
  script.setAttribute('data-reactions-enabled', g.reactionsEnabled || '1');
  script.setAttribute('data-emit-metadata', '0');
  script.setAttribute('data-input-position', g.inputPosition || 'top');
      script.setAttribute('data-theme', g.theme || 'light');
  script.setAttribute('data-lang', g.lang || 'zh-CN');
  script.setAttribute('data-loading', 'lazy');
  container.appendChild(script);
}

function avatarLetter(author: string): string {
  const t = String(author || '旅').trim();
  return t.slice(0, 1) || '旅';
}

function likedSet(): Set<string> {
  try {
    const raw = localStorage.getItem('askuary_comment_likes') || '[]';
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveLiked(set: Set<string>): void {
  localStorage.setItem('askuary_comment_likes', JSON.stringify([...set]));
}

function likeCountKey(id: string): string {
  return `askuary_comment_like_n_${id}`;
}

function getLikeCount(id: string): number {
  const n = Number(localStorage.getItem(likeCountKey(id)) || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function setLikeCount(id: string, n: number): void {
  localStorage.setItem(likeCountKey(id), String(Math.max(0, n)));
}

function bindCommentActions(listEl: HTMLElement): void {
  const liked = likedSet();
  listEl.querySelectorAll<HTMLElement>('[data-like-id]').forEach((btn) => {
    const id = btn.dataset.likeId || '';
    if (!id) return;
    const countEl = btn.querySelector('[data-like-count]');
    let count = getLikeCount(id);
    if (liked.has(id)) btn.classList.add('is-liked');
    if (countEl) countEl.textContent = String(count);

    btn.onclick = () => {
      if (liked.has(id)) {
        liked.delete(id);
        count = Math.max(0, count - 1);
        btn.classList.remove('is-liked');
      } else {
        liked.add(id);
        count += 1;
        btn.classList.add('is-liked');
      }
      saveLiked(liked);
      setLikeCount(id, count);
      if (countEl) countEl.textContent = String(count);
    };
  });

  listEl.querySelectorAll<HTMLElement>('[data-reply-author]').forEach((btn) => {
    btn.onclick = () => {
      const author = btn.dataset.replyAuthor || '';
      const form = listEl.closest('.fp-comment-mount, .home-comments, .fp-friend-comments')
        ?.querySelector('#commentForm') as HTMLFormElement | null
        || document.querySelector('#commentForm');
      const ta = form?.querySelector('textarea[name="content"]') as HTMLTextAreaElement | null;
      if (!ta) return;
      const prefix = `@${author} `;
      if (!ta.value.includes(prefix)) ta.value = prefix + ta.value;
      ta.focus();
      form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  });
}

function renderCommentList(
  listEl: HTMLElement,
  items: { id: string; author: string; content: string; date: string; website?: string }[],
  empty: string,
): void {
  if (!items.length) {
    listEl.innerHTML = `<p class="fp-comment-empty">${escapeHtml(empty)}</p>`;
    return;
  }
  const liked = likedSet();
  listEl.innerHTML = `<ul class="fp-comment-list">${items
    .map((item) => {
      const count = getLikeCount(item.id);
      const isLiked = liked.has(item.id);
      return (
        `<li class="fp-comment-item">` +
        `<div class="fp-comment-avatar" aria-hidden="true">${escapeHtml(avatarLetter(item.author))}</div>` +
        `<div class="fp-comment-main">` +
        `<div class="fp-comment-meta">` +
        `<span class="fp-comment-author">${escapeHtml(item.author)}</span>` +
        (item.date ? `<time class="fp-comment-date">${escapeHtml(item.date)}</time>` : '') +
        `</div>` +
        `<p class="fp-comment-body">${formatCommentBody(item.content)}</p>` +
        (item.website
          ? `<a class="fp-comment-site" href="${escapeAttr(item.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.website)}</a>`
          : '') +
        `<div class="fp-comment-actions">` +
        `<button type="button" class="fp-comment-action${isLiked ? ' is-liked' : ''}" data-like-id="${escapeAttr(item.id)}">❤ <span data-like-count>${count}</span></button>` +
        `<button type="button" class="fp-comment-action" data-reply-author="${escapeAttr(item.author)}">回复</button>` +
        `</div>` +
        `</div></li>`
      );
    })
    .join('')}</ul>`;
  bindCommentActions(listEl);
}

async function mountApiComments(
  container: HTMLElement,
  apiBase: string,
  config: CommentsConfig,
  commentPath: string,
): Promise<void> {
  const empty = config.empty || '还没有留言，来做第一个吧。';
  const path = commentPath.endsWith('/') ? commentPath : `${commentPath}/`;
  container.innerHTML =
    `<div class="fp-comment-board" id="commentBoard"></div>` +
    `<form class="fp-comment-form" id="commentForm">` +
    `<p class="fp-comment-form-hint">留言提交后需站长审核，通过后才会显示。</p>` +
    `<label class="fp-friend-field"><span>昵称</span>` +
    `<input name="author" type="text" required maxlength="32" placeholder="例如：旅人" autocomplete="nickname"></label>` +
    `<label class="fp-friend-field"><span>邮箱（可选）</span>` +
    `<input name="email" type="email" placeholder="例如：you@example.com" autocomplete="email"></label>` +
    `<label class="fp-friend-field"><span>网址（可选）</span>` +
    `<input name="website" type="url" placeholder="例如：https://www.askuary.cn/"></label>` +
    `<div class="fp-comment-content-wrap">` +
    `<div class="fp-comment-content-head">` +
    `<span>留言内容</span>` +
    renderEmojiPickerHtml() +
    `</div>` +
    `<label class="fp-friend-field fp-comment-content-field">` +
    `<textarea name="content" required maxlength="500" rows="3" placeholder="说点什么吧… 可点上方表情插入"></textarea>` +
    `</label></div>` +
    `<div class="fp-friend-apply-actions">` +
    `<button type="submit" class="fp-flink-btn is-primary">发送留言</button>` +
    `</div></form>` +
    `<p class="fp-comment-toast" id="commentToast" hidden role="status"></p>`;

  const board = container.querySelector('#commentBoard') as HTMLElement;
  const form = container.querySelector('#commentForm') as HTMLFormElement | null;
  const toast = container.querySelector('#commentToast') as HTMLElement | null;
  const textarea = form?.querySelector(
    'textarea[name="content"]',
  ) as HTMLTextAreaElement | null;
  const emojiRoot = form?.querySelector('.fp-emoji-picker') as HTMLElement | null;
  if (emojiRoot && textarea) bindEmojiPicker(emojiRoot, textarea);

  const reload = async () => {
    try {
      const items = await fetchComments(apiBase, path);
      renderCommentList(board, items, empty);
    } catch (err) {
      board.innerHTML = `<p class="fp-comment-empty">${escapeHtml(String((err as Error).message || err))}</p>`;
    }
  };

  await reload();

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const author = String(data.get('author') || '').trim();
    const email = String(data.get('email') || '').trim();
    const website = String(data.get('website') || '').trim();
    const content = String(data.get('content') || '').trim();
    if (!author || !content) return;

    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    if (submitBtn) submitBtn.disabled = true;
    try {
      await submitComment(apiBase, {
        path,
        author,
        email: email || undefined,
        website: website || undefined,
        content,
      });
      form.reset();
      if (toast) {
        toast.hidden = false;
        toast.textContent = '已提交，审核通过后显示';
        window.setTimeout(() => {
          toast.hidden = true;
        }, 2200);
      }
      await reload();
    } catch (err) {
      if (toast) {
        toast.hidden = false;
        toast.textContent = String((err as Error).message || err);
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

/** 挂载评论区：优先 API（按 path），其次 Giscus */
export function mountComments(
  root: HTMLElement | null,
  config: CommentsConfig | undefined,
  apiBase?: string,
  commentPath = '/friends/',
): void {
  if (!root) return;
  if (!config || config.enabled === false) {
    root.hidden = true;
    root.innerHTML = '';
    return;
  }

  root.hidden = false;
  const title = config.title || '评论';
  root.innerHTML =
    `<h2 class="fp-comment-title">${escapeHtml(title)}</h2>` +
    `<div class="fp-comment-mount" id="commentMount"></div>`;

  const mount = root.querySelector('#commentMount') as HTMLElement | null;
  if (!mount) return;

  if (apiBase?.trim()) {
    void mountApiComments(mount, apiBase.trim(), config, commentPath);
    return;
  }

  if (canUseGiscus(config)) {
    mountGiscus(mount, config);
    return;
  }

  mount.innerHTML =
    `<p class="fp-comment-empty">评论服务未配置。请在 site.json 设置 apiBase。</p>`;
}
