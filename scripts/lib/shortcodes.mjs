/**
 * 旧站 Sakurairo-child 短代码 → HTML（构建期）
 * 兼容 Argon / Kizumi / ghcard 语法，见 docs/SHORTCODES.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/'/g, '&#39;');
}

function parseAttrs(raw) {
  const attrs = {};
  const re = /([a-zA-Z_][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'\]]+))/g;
  let m;
  while ((m = re.exec(String(raw || '')))) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

function renderInner(md, marked) {
  const raw = String(md || '').trim();
  if (!raw) return '';
  if (!marked) return `<p>${escapeHtml(raw)}</p>`;
  try {
    return String(marked.parse(raw));
  } catch {
    return `<p>${escapeHtml(raw)}</p>`;
  }
}

function colorMap(color, map, fallback = 'indigo') {
  const key = String(color || fallback).toLowerCase();
  return map[key] || map[fallback] || Object.values(map)[0];
}

const LABEL_COLOR = {
  indigo: 'child-badge-primary',
  green: 'child-badge-success',
  red: 'child-badge-danger',
  orange: 'child-badge-warning',
  blue: 'child-badge-info',
  black: 'child-badge-dark',
  grey: 'child-badge-light',
};

const ALERT_COLOR = {
  indigo: 'child-alert-primary',
  green: 'child-alert-success',
  red: 'child-alert-danger',
  orange: 'child-alert-warning',
  blue: 'child-alert-info',
  black: 'child-alert-default',
  grey: 'child-alert-default',
};

const ADMON_COLOR = {
  indigo: 'admonition-primary',
  green: 'admonition-success',
  red: 'admonition-danger',
  orange: 'admonition-warning',
  blue: 'admonition-info',
  black: 'admonition-default',
  grey: 'admonition-grey',
};

const COLLAPSE_COLOR = {
  indigo: 'collapse-block-primary',
  green: 'collapse-block-success',
  red: 'collapse-block-danger',
  orange: 'collapse-block-warning',
  blue: 'collapse-block-info',
  black: 'collapse-block-default',
  grey: 'collapse-block-grey',
  none: 'collapse-block-transparent',
};

const PROGRESS_COLOR = {
  indigo: 'bg-primary',
  green: 'bg-success',
  red: 'bg-danger',
  orange: 'bg-warning',
  blue: 'bg-info',
};

const YAOWAN_STYLE = {
  1: 'child-badge-primary',
  2: 'child-badge-secondary',
  3: 'child-badge-info',
  4: 'child-badge-success',
  5: 'child-badge-danger',
  6: 'child-badge-warning',
  7: 'child-badge-light',
  8: 'child-badge-dark',
  9: 'child-badge-gradient-primary',
  10: 'child-badge-gradient-secondary',
};

function iconSpan(icon) {
  if (!icon) return '';
  // 静态站不依赖 Font Awesome，用文本记号
  return `<span class="sc-icon" aria-hidden="true">✦</span> `;
}

function replacePaired(src, names, handler) {
  const nameRe = Array.isArray(names) ? names.join('|') : names;
  const re = new RegExp(
    `\\[(${nameRe})((?:\\s[^\\]]*)?)\\]([\\s\\S]*?)\\[\\/\\1\\]`,
    'gi',
  );
  let out = src;
  let prev;
  let guard = 0;
  do {
    prev = out;
    out = out.replace(re, (_, name, attrRaw, body) =>
      handler(String(name).toLowerCase(), parseAttrs(attrRaw), body),
    );
    guard += 1;
  } while (out !== prev && guard < 8);
  return out;
}

function loadFriends() {
  try {
    const file = path.join(root, 'data', 'friends.json');
    if (!fs.existsSync(file)) return [];
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(raw) ? raw : raw.friends || [];
  } catch {
    return [];
  }
}

function renderFriendlinks() {
  const friends = loadFriends().filter((f) => f?.name && f?.url);
  if (!friends.length) {
    return `<p class="sc-empty">暂无友联数据</p>`;
  }
  const cards = friends
    .map((f) => {
      const name = escapeHtml(f.name);
      const url = escapeAttr(f.url);
      const desc = escapeHtml(f.description || f.desc || '');
      const avatar = String(f.avatar || '').trim();
      const initial = escapeHtml(String(f.name).slice(0, 1));
      const face = avatar
        ? `<img src="${escapeAttr(avatar)}" alt="" loading="lazy" decoding="async" />`
        : initial;
      return (
        `<a class="friend-link-card" href="${url}" target="_blank" rel="noopener noreferrer">` +
        `<div class="friend-link-card-avatar">${face}</div>` +
        `<div class="friend-link-card-body">` +
        `<div class="friend-link-card-title">${name}</div>` +
        (desc ? `<div class="friend-link-card-desc">${desc}</div>` : '') +
        `</div></a>`
      );
    })
    .join('');
  return `<div class="friend-links-simple"><div class="friend-links-grid">${cards}</div></div>`;
}

function parseGhcardPath(raw) {
  let p = String(raw || '').trim();
  if (p.startsWith('https://github.com/')) p = p.slice('https://github.com/'.length);
  p = p.replace(/^\/+|\/+$/g, '');
  if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(p)) return '';
  return p;
}

function renderGhcard(attrs) {
  const pathStr = parseGhcardPath(attrs.path || 'askuary-xy/askuary-portal');
  if (!pathStr) {
    return `<p class="ghcard-error">GitHub 仓库路径无效</p>`;
  }
  const [username, repo] = pathStr.split('/');
  const img =
    `https://github-readme-stats.vercel.app/api/pin/?hide_border=true` +
    `&username=${encodeURIComponent(username)}&repo=${encodeURIComponent(repo)}`;
  const href = `https://github.com/${pathStr}`;
  return (
    `<div class="ghcard">` +
    `<a class="ghcard-link" href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">` +
    `<img class="ghcard-img" src="${escapeAttr(img)}" alt="${escapeAttr(`${username}/${repo} on GitHub`)}" loading="lazy" decoding="async" width="420" height="120" />` +
    `</a></div>`
  );
}

/**
 * @param {string} markdown
 * @param {import('marked').Marked | { parse: (s: string) => string }} marked
 */
export function expandShortcodes(markdown, marked) {
  let src = String(markdown || '');

  // --- paired ---
  src = replacePaired(src, ['collapse', 'fold'], (_name, attrs, body) => {
    const collapsed = String(attrs.collapsed ?? 'true') === 'true';
    const klass = colorMap(attrs.color || 'none', COLLAPSE_COLOR, 'none');
    const hideBorder = String(attrs.showleftborder ?? 'false') !== 'true';
    const title = escapeHtml(attrs.title || '点击展开');
    const inner = renderInner(body, marked);
    return (
      `\n\n<div class="collapse-block ${klass}${collapsed ? ' collapsed' : ''}${hideBorder ? ' hide-border-left' : ''}">` +
      `<div class="collapse-block-title" role="button" tabindex="0">` +
      iconSpan(attrs.icon) +
      `<span class="collapse-block-title-inner">${title}</span>` +
      `<span class="collapse-icon" aria-hidden="true">▾</span>` +
      `</div>` +
      `<div class="collapse-block-body"${collapsed ? ' hidden' : ''}>${inner}</div>` +
      `</div>\n\n`
    );
  });

  src = replacePaired(src, ['alert'], (_n, attrs, body) => {
    const klass = colorMap(attrs.color, ALERT_COLOR);
    const title = attrs.title ? `<strong>${escapeHtml(attrs.title)}</strong> ` : '';
    const inner = renderInner(body, marked);
    return (
      `\n\n<div class="child-alert ${klass}">` +
      (attrs.icon ? `<span class="child-alert-icon">${iconSpan(attrs.icon)}</span>` : '') +
      `<div class="child-alert-text">${title}${inner}</div>` +
      `</div>\n\n`
    );
  });

  src = replacePaired(src, ['admonition'], (_n, attrs, body) => {
    const klass = colorMap(attrs.color, ADMON_COLOR);
    const title = attrs.title
      ? `<div class="admonition-title">${iconSpan(attrs.icon)}${escapeHtml(attrs.title)}</div>`
      : '';
    const inner = body.trim() ? `<div class="admonition-body">${renderInner(body, marked)}</div>` : '';
    return `\n\n<div class="admonition ${klass}">${title}${inner}</div>\n\n`;
  });

  src = replacePaired(src, ['hidden', 'spoiler'], (_n, attrs, body) => {
    const type =
      String(attrs.type || 'blur') === 'background'
        ? 'argon-hidden-text-background'
        : 'argon-hidden-text-blur';
    const tip = attrs.tip ? ` title="${escapeAttr(attrs.tip)}"` : '';
    return `<span class="argon-hidden-text ${type}"${tip}>${escapeHtml(String(body || '').trim())}</span>`;
  });

  src = replacePaired(src, ['timeline'], (_n, _attrs, body) => {
    const lines = String(body || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return '';
    const nodes = lines
      .map((line) => {
        const parts = line.split('|');
        const time = escapeHtml(parts[0] || '').replace(/\//g, '<br />');
        const title = escapeHtml(parts[1] || '');
        const content = escapeHtml(parts.slice(2).join(' ').trim());
        return (
          `<div class="argon-timeline-node">` +
          `<div class="argon-timeline-time">${time}</div>` +
          `<div class="argon-timeline-card">` +
          (title ? `<div class="argon-timeline-title">${title}</div>` : '') +
          (content ? `<div class="argon-timeline-content">${content}</div>` : '') +
          `</div></div>`
        );
      })
      .join('');
    return `\n\n<div class="argon-timeline">${nodes}</div>\n\n`;
  });

  src = replacePaired(src, ['checkbox'], (_n, attrs, body) => {
    const checked = String(attrs.checked || 'false') === 'true';
    const inline = String(attrs.inline || 'false') === 'true';
    const klass = `shortcode-todo${inline ? ' inline' : ''}`;
    const label = escapeHtml(String(body || '').replace(/<[^>]+>/g, '').trim() || body);
    return (
      `<label class="${klass}">` +
      `<input type="checkbox"${checked ? ' checked' : ''} disabled />` +
      `<span>${label}</span></label>`
    );
  });

  src = replacePaired(src, ['label'], (_n, attrs, body) => {
    let klass = colorMap(attrs.color, LABEL_COLOR);
    if (String(attrs.shape || '') === 'round') klass += ' child-badge-pill';
    return `<span class="child-badge ${klass}">${escapeHtml(body.trim())}</span>`;
  });

  src = replacePaired(src, ['progressbar'], (_n, attrs, body) => {
    const progress = Math.min(100, Math.max(0, Number(attrs.progress) || 100));
    const bar = colorMap(attrs.color, PROGRESS_COLOR);
    const label = body.trim()
      ? `<div class="child-progress-label"><span>${escapeHtml(body.trim())}</span></div>`
      : '';
    return (
      `\n\n<div class="child-progress-wrapper"><div class="child-progress-info">` +
      label +
      `<div class="child-progress-percentage"><span>${progress}%</span></div>` +
      `</div><div class="child-progress"><div class="child-progress-bar ${bar}" style="width:${progress}%"></div></div></div>\n\n`
    );
  });

  src = replacePaired(src, ['h2set'], (_n, _a, body) => {
    return `\n\n<h2 class="child-section-title child-section-title--set"><span><span class="sc-icon" aria-hidden="true">✦</span> ${escapeHtml(body.trim())}</span></h2>\n\n`;
  });

  src = replacePaired(src, ['h2down'], (_n, _a, body) => {
    return `\n\n<h2 class="child-section-title child-section-title--down"><span><span class="sc-icon" aria-hidden="true">↓</span> ${escapeHtml(body.trim())}</span></h2>\n\n`;
  });

  src = replacePaired(src, ['downloadbtn'], (_n, attrs, body) => {
    const link = escapeAttr(attrs.link || '#');
    return `<a href="${link}" class="child-btn-download" target="_blank" rel="noopener noreferrer">${escapeHtml(body.trim() || '下载')}</a>`;
  });

  src = replacePaired(src, ['linksbtn'], (_n, attrs, body) => {
    const link = escapeAttr(attrs.link || '#');
    return `<a href="${link}" class="child-btn-link" target="_blank" rel="noopener noreferrer">${escapeHtml(body.trim() || '访问')}</a>`;
  });

  src = replacePaired(src, ['blockquote1'], (_n, attrs, body) => {
    const cite = attrs.name ? `<cite>${escapeHtml(attrs.name)}</cite>` : '';
    return `\n\n<div class="child-quote child-quote--classic"><blockquote><p>${escapeHtml(body.trim())}</p>${cite}</blockquote></div>\n\n`;
  });

  src = replacePaired(src, ['blockquote2'], (_n, attrs, body) => {
    const cite = attrs.name ? `<cite>${escapeHtml(attrs.name)}</cite>` : '';
    return `\n\n<div class="child-quote child-quote--animated"><blockquote><p>${escapeHtml(body.trim())}</p>${cite}</blockquote></div>\n\n`;
  });

  src = replacePaired(src, ['yaowan'], (_n, attrs, body) => {
    const style = String(attrs.style || '1');
    const klass = YAOWAN_STYLE[style] || YAOWAN_STYLE['1'];
    return `<span class="child-badge child-badge-pill ${klass}">${escapeHtml(body.trim())}</span>`;
  });

  src = replacePaired(src, ['userreading'], (_n, _a, _body) => {
    return `\n\n<div class="child-alert child-alert-warning"><span class="child-alert-icon" aria-hidden="true">🔒</span><div class="child-alert-text">静态站无登录态，原「仅登录可见」内容已隐藏。</div></div>\n\n`;
  });

  src = replacePaired(src, ['steamuser'], (_n, _a, body) => {
    const id = escapeHtml(String(body || '').trim());
    return `\n\n<div class="child-alert child-alert-info"><div class="child-alert-text">Steam 卡片需 API Key，暂未启用（ID: ${id || '—'}）。</div></div>\n\n`;
  });

  // --- self / empty closing ---
  src = src.replace(/\[friendlinks(?:\s[^\]]*)?\](?:\[\/friendlinks\])?/gi, () => {
    return `\n\n${renderFriendlinks()}\n\n`;
  });

  src = src.replace(/\[acg_categories(?:\s[^\]]*)?\](?:\[\/acg_categories\])?/gi, () => {
    return `\n\n<div class="child-alert child-alert-info"><div class="child-alert-text">ACG 分类墙依赖 WordPress 分类数据，静态站请改用归档标签页。</div></div>\n\n`;
  });

  src = src.replace(
    /\[ghcard((?:\s[^\]]*)?)\](?:\[\/ghcard\])?/gi,
    (_, attrRaw) => `\n\n${renderGhcard(parseAttrs(attrRaw))}\n\n`,
  );

  return src;
}
