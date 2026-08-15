# Askuary 旧站 → 新站迁移清单

从 **WordPress + Sakurairo 子主题**（旧站）迁移到 **Askuary Portal**（Vite + TypeScript 静态站）的功能对照表。  
用于逐项勾选、排期与验收，避免两套代码逻辑混淆。

---

## 仓库与路径

| 项目 | 路径 | 说明 |
|------|------|------|
| **旧站主题** | `f:\网站备份2026.6.30\themes2\Sakurairo-child` | WordPress 子主题，线上 askuary.cn |
| **新站门户** | `C:\Users\Administrator\Projects\askuary-portal` | 独立仓库，GitHub Pages / 自定义域部署 |
| **新站路线图** | [ROADMAP.md](./ROADMAP.md) | 架构与阶段计划 |
| **旧站短代码备忘** | 旧主题 `assets/shortcodes-cheatsheet.md` | Argon / Kizumi 等 |

---

## 状态图例

| 标记 | 含义 |
|------|------|
| ✅ | 新站已实现，可对照旧站验收 |
| 🟡 | 新站部分实现或数据已对齐、功能未完整 |
| ⬜ | 未开始 |
| 🔒 | 旧站保留，暂不迁移（或仅链出） |
| ⚠️ | 需重写（非 PHP 直搬，技术栈不同） |

---

## 1. 宇宙门户 / Link Start

| 功能 | 旧站 | 新站 | 状态 | 备注 |
|------|------|------|------|------|
| 宇宙门户首页 | `templates/page-footprint.php` | `/` + `src/pages/home/` | ✅ | 地球、恒星、scroll-snap |
| 黑洞穿越进主页 | `footprint-blackhole.js` | `src/canvas/blackhole.ts` | ✅ | |
| 背景恒星导航 | — | `nav-stars.json` + `nav-stars.ts` | ✅ | |
| 地球光点 | `footprint-earth-spots.php` | `spots.json` + `earth.ts` | 🟡 | 核对光点数据是否与旧站一致 |
| 流星词 | `footprint-meteor-words.php` | `meteor-words.json` | 🟡 | 确认文案与触发逻辑 |
| 友联卫星 | `footprint-friends.php` | `friends.json` + 地球轨道 | ✅ | |
| 星图导航（第二屏） | — | `src/ui/atlas.ts` | ✅ | 新站增强 |
| Link Start 后台设置 | `footprint-settings.php` | `data/*.json` 手改 | 🟡 | 后期可选 Decap CMS |
| 门户子页壳（关于/博客） | `footprint-subpages.php` | `/about/`、`/blog/` | ✅ | |
| 门户专用 Mashiro 特效字 | `mashiro-glitch.php` | — | ⬜ | ⚠️ 按需重做 |
| 手机布局 / 关闭弹层误触 | 多轮 UX 修复 | — | ⬜ | 迁移时回归测试 |

---

## 2. 内容与页面

| 功能 | 旧站模板 / 模块 | 新站目标 | 状态 | 数据迁移 |
|------|-----------------|----------|------|----------|
| 博客列表与文章 | WP 文章 + `footprint-blog-cpt` | `/blog/`、`content/posts/*.md` | 🟡 | `npm run export:wp`；journal 轨 20 篇已导入 |
| 博客归档 | WP 归档 | `/archive/` | ✅ | 构建时生成 |
| 标签 / 分类 / RSS | WP 原生 | 构建时生成 | ✅ | 归档页标签筛选 + `rss.xml` |
| 宇宙门户「博客」文章页 | `single-footprint-article.php` | 合并进 `/blog/:slug` | 🟡 | |
| 关于页 | `page-footprint-about.php` | `/about/` + `about.json` | ✅ | |
| 友联页 | 子页 + 后台 | `/friends/` + `friends.json` | ✅ | |
| 说说 | `page-shuoshuo.php` | 并入 `content/journal/`（标签：碎念） | 🟡 | 11 条已导出 |
| 摄影墙 | `page-photowall.php` + `deploy/watermark.php` | `/photos/`（主页入口）+ `content/photowall` | ✅ | 相册 + 时间轴；不进宇宙导航 |
| AI 摘要 | 母主题 ChatGPT `ai_summon_excerpt` | 主页 journal 正文 AI 摘要框 | ✅ | frontmatter `aiSummary` / `summary`；`npm run ai:summary` |
| 图书馆 / 馆藏 | `page-books.php`、`library-*.php` | `/library/` + `data/library.json` + `/admin` 馆藏管理（`/api/library`） | ✅ | 静态 JSON 可导入 DB；后台接管后前台以 API 为准 |
| 足迹 / 旅行 | `page-trips.php`、`trip-*.php` | 待定 | ⬜ | CPT `trip` 导出 |
| 留言板 | `page-guestbook.php` | 待定（静态需第三方或 API） | ⬜ | ⚠️ 无 WP 评论则需替代方案 |
| ACG 分类页 | `page-acg-categories.php` | 按需 | ⬜ | |

---

## 3. 装饰与交互

| 功能 | 旧站 | 新站 | 状态 | 备注 |
|------|------|------|------|------|
| 34 种天气现象 + 定位 | `weather-atmosphere.php` | `weather-service.ts` + `mount-weather-atmosphere.ts` | 🟡 | IP/定位 + Open-Meteo；核心现象（樱花/落叶/雨雪/雾/雷雨）已迁，未全量 34 种 |
| 季节樱花 / 落叶 | `weather-phenomena.php` | `solar-terms.ts` + 氛围 Canvas | ✅ | 按二十四节气判定樱花/落叶；晴好天气触发 |
| 看板娘 Live2D 进阶版 | `waifu.php` | — | ⬜ | ⚠️ live2d-widgets v1 |
| 自定义 ANI 光标 | `cursor.php` | — | ⬜ | |
| 鼠标点击粒子 | `effects.js` | — | ⬜ | |
| 母主题樱花飘落 | Sakurairo `741.js` | — | 🔒 | 可由新站天气/季节替代 |
| PJAX 无刷新 | `pjax.php` | — | 🔒 | 静态站多页或 SPA 自选 |
| 样式菜单天气控件 | 皮肤菜单 `#changskin` | 右上角天气条 + 昼夜按钮 | 🟡 | 展示城市/节气/气温/现象；昼夜支持自动（跟时间）与手动 |
| 昼夜自动主题 | 旧站时间 / `is_day` | `mount-site-widgets.ts` | ✅ | 默认按本地时间与 Open-Meteo `is_day`；单击手动，双击恢复自动 |

---

## 4. 短代码与增强

| 功能 | 旧站 | 新站 | 状态 |
|------|------|------|------|
| Argon 短代码 | `argon-shortcodes.php` | `scripts/lib/shortcodes.mjs` + `src/styles/shortcodes.css` | ✅ |
| Kizumi 短代码 / 标签 | `kizumi-*.php` | 同上 | ✅ |
| GitHub 卡片 | `ghcard-shortcode.php` | `[ghcard path="user/repo"]` | ✅ |
| Steam 展示 | `steam.php` | 占位提示（需 API Key） | 🟡 |

> 速查：[`docs/SHORTCODES.md`](./SHORTCODES.md)。构建时展开；折叠 / 剧透 / tabs 由前台 `mountArticlePlugins` 绑定。
> 示例文：`/blog/shortcodes/`。

---

## 5. 基础设施

| 功能 | 旧站 | 新站 | 状态 |
|------|------|------|------|
| 域名 / HTTPS 跳转 | `domain-redirect.php` | 服务器 / Pages 规则 | ⬜ |
| 安全头 / 加固 | `security.php` | 托管平台配置 | ⬜ |
| SEO / 结构化数据 | `seo.php` | 各页 meta + sitemap | ⬜ |
| 性能按需加载 | `performance.php` | Vite 分包 + lazy | 🟡 |
| 随机背景 / 视差 | `background.php` | CSS 或门户层 | ⬜ |
| 摄影水印服务 | `deploy/watermark.php` | 构建脚本或边缘函数 | ⬜ |

---

## 6. 后台与运维（旧站 → 新站对照）

| 旧站 WordPress 入口 | 新站替代 |
|---------------------|----------|
| 设置 → Link Start / 光点 / 流星 / 友联 | 编辑 `data/*.json` 或 `npm run sync:live` |
| 设置 → 看板娘 / 天气特效 | 尚未有；迁移后 `data/` 或 CMS |
| 固定链接 / 阅读设置 | 静态路由 + `vite.config` |
| 媒体库 | `public/` 或对象存储 URL |
| 主题 iro-Options | 新站 `site.json` + 各页 JSON |
| **页脚 / 备案 / 版权** | iro-Options → Footer Info | `data/legal.json` + 各页 footer | 🟡 | 组件已接入；ICP 待从旧站填入 |

改 `data/` 后同步到构建目录：

```powershell
Copy-Item data\* public\data\ -Force
npm run build
```

---

## 7. 版权、备案与合规

| 功能 | 旧站 | 新站 | 状态 | 备注 |
|------|------|------|------|------|
| 页脚版权行 `© 年份 · 站名` | Sakurairo `footer.php` + 门户 `footprint-intro` | `home/main.ts` 等仅 `© year · name` | 🟡 | 各子页需统一组件 |
| 自定义页脚 HTML `footer_info` | iro-Options → **Footer Info** | — | ⬜ | 支持 HTML，可含备案链接 |
| **ICP 备案号**（工信部） | 通常在 `footer_info` 内 | — | ⬜ | 切域后需与新域一致 |
| **公安备案**（若有） | `footer_info` | — | ⬜ | 图标 + 链接 |
| 站点运行时间 | 子主题 `.footer-runtime` / `#runtime_span` | — | ⬜ | 可选：`runtimeStart` 计算 |
| 文章版权声明 / CC 许可 | 母主题文章页 + 子主题样式 | — | ⬜ | 如 CC BY-NC-SA |
| 转载规范（复制提示等） | 看板娘 `waifu-tips` 等 | — | ⬜ | 按需 |
| 页脚一言 hitokoto | iro-Options `footer_yiyan` | — | ⬜ | 可选 |
| UPYun CDN 页脚声明 | 母主题 `footer_upyun` | — | 🔒 | 仍用 CDN 则保留 |
| 主题作者链接 Sakurairo | `footer.php` `.theme-info` | — | 🔒 | 新站非 WP 主题可省略 |
| 隐私政策 / 用户协议 | 若有独立页面 | — | ⬜ | 留言板、统计、定位功能上线前建议有 |
| 宇宙门户 `/` 页脚 | 旧站门户壳层 | 门户页当前无统一 legal 区 | ⬜ | 切主域前必须补全 |

### 旧站页脚信息从哪里抄

1. WordPress 后台 → **iro-Options** → 全局 / 页脚相关 → **Footer Info**（`footer_info`，支持 HTML）。  
2. 线上页脚「查看网页源代码」搜索 `footer_info`、`备案`、`beian`。  
3. 子主题样式参考：`assets/css/global.css`（运行时间、备案图标尺寸）。

### 新站建议配置（待实现）

在 `data/site.json` 或独立 `data/legal.json` 中集中维护，构建时注入各页 footer：

```json
{
  "copyright": "Copyright © 2020–2026 ASKUARY. All Rights Reserved.",
  "icp": {
    "number": "京ICP备XXXXXXXX号",
    "url": "https://beian.miit.gov.cn/"
  },
  "gongan": {
    "number": "京公网安备 XXXXXXXXXXXX号",
    "url": "https://www.beian.gov.cn/portal/registerSystemInfo?recordcode=XXXX"
  },
  "license": {
    "name": "CC BY-NC-SA 4.0",
    "url": "https://creativecommons.org/licenses/by-nc-sa/4.0/"
  },
  "runtimeStart": "2020-01-01",
  "extraHtml": ""
}
```

实现时建议：

- 在 `src/pages/home/shared.ts` 增加 `renderSiteLegal()`，供 `/home/`、`/blog/`、`/about/`、`/friends/` 共用。  
- 宇宙门户 `/` 增加精简页脚或「关于 / 备案」入口，避免主域无备案展示。  
- **切域名前验收**：备案号主体与解析域名一致；公安备案链接可点开；移动端页脚不换行错乱。

---

## 建议迁移顺序

1. **内容与数据**：博客归档/RSS → 说说 → 摄影墙 → 图书馆 → 足迹  
2. **门户数据对齐**：`spots`、`meteor-words`、`friends` 与旧站导出逐条 diff  
3. **体验层**：天气氛围 → 看板娘 → 光标 / 粒子（新 UI 设计）  
4. **合规与页脚**：从旧站复制 `footer_info` → 新站 `legal` 配置 + 全站 footer 组件  
5. **长尾**：Steam API、留言板、SEO、**正式切域（备案生效后）**  

---

## 单次迁移验收模板

每完成一项，建议记录：

```markdown
### [功能名]
- [ ] 旧站 URL / 行为描述
- [ ] 新站 URL / 行为描述
- [ ] 数据文件 / 脚本路径
- [ ] 桌面 + 手机目测
- [ ] 深色模式（若适用）
- [ ] 备案 / 版权链接可点击、与主域一致（若适用）
```

---

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-06-30 | 初版：对照 Sakurairo-child 模块与新站 ROADMAP |
| 2026-07-09 | 新增迁移脚本 `sync-from-live.mjs`、`export-wp.mjs`；归档/RSS 已实现；journal 20 篇导入 |

---

相关文档：[ROADMAP.md](./ROADMAP.md) · 旧站同步备忘见 `scripts/sync-from-live.md`（若从线上拉 JSON）
