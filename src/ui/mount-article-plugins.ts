import '../styles/shortcodes.css';
import { mountShortcodes } from './mount-shortcodes';

/** 绑定正文插件交互：短代码折叠/剧透 + ::: tabs / fold */
export function mountArticlePlugins(root: ParentNode | null): void {
  mountShortcodes(root);
}
