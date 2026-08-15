import { escapeHtml } from './html';
import { sitePath } from './site-path';

export interface LegalBeianItem {
  icon?: string;
  iconAlt?: string;
  label: string;
  url: string;
  rel?: string;
}

export interface LegalConfig {
  copyright?: string;
  runtimeStart?: string;
  showRuntime?: boolean;
  runtimeIcon?: string;
  beian?: LegalBeianItem[];
  /** @deprecated 使用 beian */
  icp?: { number: string; url: string; icon?: string } | null;
  /** @deprecated 使用 beian */
  gongan?: { number: string; url: string; icon?: string } | null;
  license?: { name: string; url: string } | null;
  links?: { label: string; url: string }[];
  extraHtml?: string;
}

function escapeAttr(text: string): string {
  return escapeHtml(text);
}

function collectBeian(legal: LegalConfig): LegalBeianItem[] {
  if (legal.beian?.length) return legal.beian;
  const items: LegalBeianItem[] = [];
  if (legal.gongan?.number) {
    items.push({
      icon: legal.gongan.icon,
      iconAlt: '公安备案',
      label: legal.gongan.number,
      url: legal.gongan.url,
      rel: 'noreferrer',
    });
  }
  if (legal.icp?.number) {
    items.push({
      icon: legal.icp.icon,
      iconAlt: 'ICP备案',
      label: legal.icp.number,
      url: legal.icp.url,
    });
  }
  return items;
}

function renderBeianItem(item: LegalBeianItem): string {
  const href = escapeAttr(item.url);
  const rel = item.rel ? ` rel="${escapeAttr(item.rel)}"` : ' rel="noopener noreferrer"';
  const icon = item.icon
    ? `<img src="${escapeAttr(sitePath(item.icon))}" alt="${escapeAttr(item.iconAlt || '')}" width="16" height="16" loading="lazy" decoding="async" onerror="this.remove()" />`
    : '';

  return (
    `<a class="site-legal-beian-item" href="${href}"${rel} target="_blank">` +
    icon +
    `<span>${escapeHtml(item.label)}</span>` +
    `</a>`
  );
}

export function formatRuntimeDetail(start: string, now = Date.now()): string {
  const begin = new Date(start).getTime();
  if (Number.isNaN(begin)) return '';
  const diff = Math.max(0, now - begin);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `本站已运行 ${days} 天 ${hours} 时 ${mins} 分 ${secs} 秒`;
}

export function renderLegalFooter(legal: LegalConfig | null | undefined, _siteName: string): string {
  if (!legal) return '';

  const parts: string[] = [];

  // 统一顺序：备案 → 运行时长 → 版权 → 许可 → 链接
  const beian = collectBeian(legal);
  if (beian.length) {
    parts.push(
      `<div class="site-legal-beian" aria-label="备案信息">${beian.map(renderBeianItem).join('')}</div>`,
    );
  }

  if (legal.showRuntime && legal.runtimeStart) {
    const icon = legal.runtimeIcon || '⏳';
    parts.push(
      `<p class="site-legal-runtime">` +
        `<span class="site-legal-runtime-icon" aria-hidden="true">${escapeHtml(icon)}</span>` +
        `<span id="runtime_span" data-runtime-start="${escapeAttr(legal.runtimeStart)}"></span>` +
        `</p>`,
    );
  }

  if (legal.copyright) {
    parts.push(`<p class="site-legal-copy">${escapeHtml(legal.copyright)}</p>`);
  }

  if (legal.license?.name) {
    parts.push(
      `<p class="site-legal-badges">` +
        `<a class="site-legal-badge" href="${escapeHtml(legal.license.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(legal.license.name)}</a>` +
        `</p>`,
    );
  }

  if (legal.links?.length) {
    const links = legal.links
      .map((link) => {
        const href = sitePath(link.url);
        return `<a class="site-legal-link" href="${escapeHtml(href)}">${escapeHtml(link.label)}</a>`;
      })
      .join('<span class="site-legal-sep" aria-hidden="true">·</span>');
    parts.push(`<nav class="site-legal-links" aria-label="站点链接">${links}</nav>`);
  }

  if (legal.extraHtml) {
    parts.push(`<div class="site-legal-extra">${legal.extraHtml}</div>`);
  }

  if (!parts.length) return '';

  return `<div class="site-legal">${parts.join('')}</div>`;
}

export function startRuntimeClock(root: ParentNode = document): number | null {
  const el = root.querySelector('#runtime_span') as HTMLElement | null;
  if (!el) return null;

  const start = el.dataset.runtimeStart;
  if (!start) return null;

  const tick = () => {
    const text = formatRuntimeDetail(start);
    if (text) el.textContent = text;
  };

  tick();
  return window.setInterval(tick, 1000);
}

export async function loadLegalConfig(): Promise<LegalConfig | null> {
  const base = import.meta.env.BASE_URL + 'data';
  try {
    const res = await fetch(`${base}/legal.json`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
