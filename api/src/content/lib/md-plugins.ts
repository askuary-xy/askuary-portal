/**
 * Markdown 容器插件 + 旧站短代码预处理
 * 在 marked.parse 之前调用。
 */
// @ts-nocheck
import { expandShortcodes } from './shortcodes';

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function protectCode(src) {
  const slots = [];
  const stash = (chunk) => {
    const id = slots.length;
    slots.push(chunk);
    return `\0SCCODE${id}\0`;
  };
  let out = String(src || '');
  out = out.replace(/```[\s\S]*?```/g, (m) => stash(m));
  out = out.replace(/`[^`\n]+`/g, (m) => stash(m));
  return { text: out, slots };
}

function restoreCode(src, slots) {
  return String(src || '').replace(/\0SCCODE(\d+)\0/g, (_, i) => slots[Number(i)] ?? '');
}

function renderInner(md, marked) {
  const raw = String(md || '').trim();
  if (!raw) return '';
  try {
    return String(marked.parse(raw));
  } catch {
    return `<p>${escapeHtml(raw)}</p>`;
  }
}

function noteClass(kind) {
  if (kind === 'warning' || kind === 'warn') return 'ask-note ask-note--warning';
  if (kind === 'info') return 'ask-note ask-note--info';
  return 'ask-note ask-note--tip';
}

function noteLabel(kind, title) {
  if (title) return title;
  if (kind === 'warning' || kind === 'warn') return '注意';
  if (kind === 'info') return '提示';
  return '小贴士';
}

function transformTabs(body, marked) {
  const parts = String(body || '').split(/^==\s+/m).filter((s) => s.trim());
  const tabs = [];
  for (const part of parts) {
    const nl = part.indexOf('\n');
    const title = (nl >= 0 ? part.slice(0, nl) : part).trim();
    const content = nl >= 0 ? part.slice(nl + 1) : '';
    if (!title) continue;
    tabs.push({ title, html: renderInner(content, marked) });
  }
  if (!tabs.length) return '';
  const nav = tabs
    .map(
      (t, i) =>
        `<button type="button" class="ask-tabs-btn${i === 0 ? ' is-active' : ''}" data-ask-tab="${i}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}">${escapeHtml(t.title)}</button>`,
    )
    .join('');
  const panels = tabs
    .map(
      (t, i) =>
        `<div class="ask-tabs-panel${i === 0 ? ' is-active' : ''}" data-ask-panel="${i}" role="tabpanel"${i === 0 ? '' : ' hidden'}>${t.html}</div>`,
    )
    .join('');
  return (
    `<div class="ask-tabs" data-ask-tabs>` +
    `<div class="ask-tabs-nav" role="tablist">${nav}</div>` +
    `<div class="ask-tabs-body">${panels}</div>` +
    `</div>`
  );
}

export function preprocessMdPlugins(markdown, marked) {
  const { text: protectedMd, slots } = protectCode(String(markdown || ''));

  let src = expandShortcodes(protectedMd, marked);

  src = src.replace(/:::[\t ]*tabs[\t ]*\r?\n([\s\S]*?):::/gi, (_, body) => {
    return `\n\n${transformTabs(body, marked)}\n\n`;
  });

  src = src.replace(
    /:::[\t ]*fold(?:[\t ]+([^\r\n]+))?[\t ]*\r?\n([\s\S]*?):::/gi,
    (_, title, body) => {
      const label = String(title || '点击展开').trim();
      const inner = renderInner(body, marked);
      return (
        `\n\n<details class="ask-fold">` +
        `<summary class="ask-fold-summary">${escapeHtml(label)}</summary>` +
        `<div class="ask-fold-body">${inner}</div>` +
        `</details>\n\n`
      );
    },
  );

  src = src.replace(
    /:::[\t ]*(tip|info|warning|warn)(?:[\t ]+([^\r\n]+))?[\t ]*\r?\n([\s\S]*?):::/gi,
    (_, kind, title, body) => {
      const k = String(kind || 'tip').toLowerCase();
      const label = noteLabel(k, String(title || '').trim());
      const inner = renderInner(body, marked);
      return (
        `\n\n<aside class="${noteClass(k)}" role="note">` +
        `<div class="ask-note-label">${escapeHtml(label)}</div>` +
        `<div class="ask-note-body">${inner}</div>` +
        `</aside>\n\n`
      );
    },
  );

  return restoreCode(src, slots);
}
