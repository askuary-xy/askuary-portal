import type { EarthController } from '../canvas/earth';

export interface AtlasItem {
  index: number;
  title: string;
  text: string;
  style: string;
  url: string;
  linkLabel?: string;
  kind: 'spot' | 'satellite';
  lat?: number;
  lng?: number;
  avatar?: string;
  isFriend?: boolean;
}

export interface AtlasController {
  destroy: () => void;
}

const STYLE_LABELS: Record<string, string> = {
  star: '星辉',
  amber: '琥珀',
  violet: '星云',
  rose: '樱粉',
  mint: '薄荷',
  ember: '余烬',
  friend: '友联',
};

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text);
}

function getStyleLabel(item: AtlasItem): string {
  if (item.kind === 'satellite' || item.isFriend) return '友联';
  return STYLE_LABELS[item.style] ?? item.style;
}

function getLinkLabel(item: AtlasItem): string {
  if (item.linkLabel) return item.linkLabel;
  return item.kind === 'satellite' ? '访问友联' : '查看链接';
}

/** 第二屏星图导航 — 浏览光点/友联，定位回地球 */
export function initAtlas(root: HTMLElement, earth: EarthController): AtlasController {
  const panel = document.getElementById('fpAtlas');
  const listEl = document.getElementById('fpAtlasList');
  const friendsListEl = document.getElementById('fpAtlasFriendsList');
  const friendsSection = panel?.querySelector('.fp-atlas-friends-section') as HTMLElement | null;
  const searchEl = document.getElementById('fpAtlasSearch') as HTMLInputElement | null;
  const detailEl = document.getElementById('fpAtlasDetail');

  if (!panel || !listEl) {
    return { destroy: () => {} };
  }

  const spotList = listEl;

  const spots = earth.getSpots() as AtlasItem[];
  const friends = earth.getFriends() as AtlasItem[];

  if (!spots.length && !friends.length) {
    panel.hidden = true;
    return { destroy: () => {} };
  }

  panel.hidden = false;
  let query = '';
  let activeKind: 'spot' | 'satellite' = 'spot';
  let activeIndex = -1;

  function renderDetail(item: AtlasItem | null): void {
    if (!detailEl) return;
    if (!item) {
      detailEl.hidden = true;
      detailEl.innerHTML = '';
      return;
    }

    const isSat = item.kind === 'satellite';
    let html = `<div class="fp-atlas-detail-card fp-spot-${item.style}${isSat ? ' is-friend-link' : ''}">`;
    if (isSat) {
      html += '<span class="fp-atlas-friend-badge">友联卫星</span>';
    }
    if (item.avatar) {
      html += `<img class="fp-atlas-detail-avatar" src="${escapeAttr(item.avatar)}" alt="${escapeAttr(item.title || '')}" width="64" height="64" loading="lazy" decoding="async">`;
    }
    html += `<span class="fp-atlas-detail-style">${escapeHtml(getStyleLabel(item))}</span>`;
    html += `<strong class="fp-atlas-detail-title">${escapeHtml(item.title || '未命名')}</strong>`;
    if (item.text) {
      html += `<p class="fp-atlas-detail-text">${escapeHtml(item.text)}</p>`;
    }
    html += '<div class="fp-atlas-detail-actions">';
    html += `<button type="button" class="fp-atlas-locate" data-kind="${item.kind}" data-index="${item.index}">◎ ${isSat ? '定位卫星' : '定位到地球'}</button>`;
    if (item.url) {
      html += `<a class="fp-atlas-link" href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer">↗ ${escapeHtml(getLinkLabel(item))}</a>`;
    }
    html += '</div></div>';

    detailEl.hidden = false;
    detailEl.innerHTML = html;
  }

  function filterItems(items: AtlasItem[]): AtlasItem[] {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const hay = `${item.title} ${item.text} ${getStyleLabel(item)}`.toLowerCase();
      return hay.includes(q);
    });
  }

  function renderItemRow(item: AtlasItem): HTMLLIElement {
    const isSat = item.kind === 'satellite';
    const li = document.createElement('li');
    li.className = `fp-atlas-item fp-spot-${item.style}${isSat ? ' is-friend-link' : ''}${
      item.kind === activeKind && item.index === activeIndex ? ' is-active' : ''
    }`;
    li.setAttribute('role', 'option');
    li.dataset.kind = item.kind;
    li.dataset.index = String(item.index);

    const avatarHtml =
      isSat && item.avatar
        ? `<img class="fp-atlas-item-avatar" src="${escapeAttr(item.avatar)}" alt="" width="36" height="36" loading="lazy" decoding="async">`
        : '<span class="fp-atlas-item-dot" aria-hidden="true"></span>';

    const linkHtml = item.url
      ? `<a class="fp-atlas-item-link" href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(getLinkLabel(item))}">↗</a>`
      : '';

    li.innerHTML =
      avatarHtml +
      `<span class="fp-atlas-item-main">` +
      `<strong class="fp-atlas-item-title">${escapeHtml(item.title || '未命名')}</strong>` +
      `<span class="fp-atlas-item-meta">${escapeHtml(getStyleLabel(item))}</span>` +
      `</span>` +
      (item.text ? `<span class="fp-atlas-item-snippet">${escapeHtml(item.text)}</span>` : '') +
      linkHtml;

    return li;
  }

  function renderLists(): void {
    const filteredSpots = filterItems(spots);
    spotList.innerHTML = '';

    if (!filteredSpots.length) {
      spotList.innerHTML = '<li class="fp-atlas-empty">没有匹配的光点</li>';
    } else {
      filteredSpots.forEach((item) => spotList.appendChild(renderItemRow(item)));
    }

    if (friendsListEl && friendsSection) {
      const filteredFriends = filterItems(friends);
      friendsListEl.innerHTML = '';
      if (!friends.length) {
        friendsSection.hidden = true;
      } else {
        friendsSection.hidden = false;
        if (!filteredFriends.length) {
          friendsListEl.innerHTML = '<li class="fp-atlas-empty">没有匹配的友联</li>';
        } else {
          filteredFriends.forEach((item) => friendsListEl.appendChild(renderItemRow(item)));
        }
      }
    }

    if (activeIndex >= 0) {
      const pool = activeKind === 'satellite' ? friends : spots;
      const current = pool.find((s) => s.index === activeIndex) ?? null;
      renderDetail(current);
    } else {
      renderDetail(null);
    }
  }

  function navigateToItem(kind: 'spot' | 'satellite', index: number): void {
    activeKind = kind;
    activeIndex = index;
    renderLists();

    window.scrollTo({ top: 0, behavior: 'smooth' });

    window.setTimeout(() => {
      if (kind === 'satellite') {
        earth.revealFriendByIndex(index);
      } else {
        earth.revealSpotByIndex(index);
      }
      root.classList.remove('is-hole-screen');
    }, 650);
  }

  function onListClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (target.closest('.fp-atlas-item-link')) return;

    const item = target.closest('.fp-atlas-item') as HTMLElement | null;
    if (!item) return;

    activeKind = (item.dataset.kind as 'spot' | 'satellite') || 'spot';
    activeIndex = parseInt(item.dataset.index ?? '', 10);
    if (Number.isNaN(activeIndex)) return;

    const pool = activeKind === 'satellite' ? friends : spots;
    renderDetail(pool.find((s) => s.index === activeIndex) ?? null);
    renderLists();
  }

  function onDetailClick(event: Event): void {
    const btn = (event.target as HTMLElement).closest('.fp-atlas-locate') as HTMLElement | null;
    if (!btn) return;

    const index = parseInt(btn.dataset.index ?? '', 10);
    const kind = (btn.dataset.kind as 'spot' | 'satellite') || 'spot';
    if (!Number.isNaN(index)) {
      navigateToItem(kind, index);
    }
  }

  function onSearchInput(): void {
    query = searchEl?.value ?? '';
    renderLists();
  }

  searchEl?.addEventListener('input', onSearchInput);
  spotList.addEventListener('click', onListClick);
  friendsListEl?.addEventListener('click', onListClick);
  detailEl?.addEventListener('click', onDetailClick);

  renderLists();

  return {
    destroy: () => {
      searchEl?.removeEventListener('input', onSearchInput);
      spotList.removeEventListener('click', onListClick);
      friendsListEl?.removeEventListener('click', onListClick);
      detailEl?.removeEventListener('click', onDetailClick);
    },
  };
}
