import '../styles/legal.css';
import { loadLegalConfig, renderLegalFooter, startRuntimeClock } from '../utils/legal-footer';

/** 在页面 main 或 footer 末尾挂载合规页脚 */
export async function mountLegalFooter(
  container: HTMLElement | null,
  _siteName: string,
): Promise<void> {
  if (!container) return;
  const legal = await loadLegalConfig();
  const html = renderLegalFooter(legal, _siteName);
  if (!html) return;

  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  const node = wrap.firstElementChild;
  if (node) {
    container.appendChild(node);
    startRuntimeClock(node);
  }
}
