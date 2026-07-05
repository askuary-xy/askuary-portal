# WordPress → Askuary Portal 迁移方案

目标：将 `askuary.cn` 从 **WordPress 全站** 过渡到 **静态宇宙门户 + 独立博客**，保留 Link Start 全部视觉能力。

---

## 一、整体架构（目标态）

```
askuary.cn/              ← askuary-portal（本仓库，Vite 静态）
askuary.cn/blog/         ← 静态博客 或 子域 blog.askuary.cn
askuary.cn/archive/      ← 文章列表（博客模块内）
```

| 模块 | 现 WordPress | 新方案 |
|------|--------------|--------|
| 首页 Link Start | `page-footprint.php` + JS | 本仓库 `index.html` + Canvas |
| 光点 / 友联 / 流星配置 | WP Options 后台 | `data/*.json`（后期可加 Decap CMS） |
| 文章 | WP Posts | Markdown + frontmatter（见第三节） |
| 分类 / 标签 | WP Taxonomy | 文件夹或 frontmatter 字段 |
| 评论 | WP Comments | Giscus / Twikoo / 关闭 |
| RSS | WP Feed | vite-plugin 或 Hugo/Astro 子项目生成 |

---

## 二、数据迁移（非文章内容）

### 2.1 从 WordPress 导出

在现站后台或使用 WP-CLI 导出以下 option：

| WP Option | 目标文件 |
|-----------|----------|
| `sakurairo_footprint_earth_spots_list` | `data/spots.json` |
| `sakurairo_footprint_friends_list` | `data/friends.json` |
| `sakurairo_footprint_meteor_words_list` | `data/meteor-words.json` |
| Link Start 简介 / 头像 / 社交 | `data/site.json` |

**手动方式**：各独立后台页面 → 导出 JSON → 放入 `data/`。

**脚本方式（推荐，后续添加）**：

```powershell
# scripts/export-wp-options.ps1（待实现）
# 需要：WP REST Application Password 或 wp-cli ssh
```

字段映射与 Sakurairo-child 一致：

```json
// spots.json
{ "lat", "lng", "title", "text", "style", "url", "linkLabel" }

// friends.json
{ "title", "text", "avatar", "url", "linkLabel" }

// meteor-words.json
{ "text", "author" }
```

### 2.2 导航恒星（新增）

在 `data/nav-stars.json` 中配置入口，例如：

```json
{
  "id": "blog",
  "label": "博客",
  "desc": "全部文章",
  "url": "/blog/",
  "x": 0.2,
  "y": 0.25
}
```

---

## 三、文章迁移

### 方案 A：Markdown 静态博客（推荐）

1. **导出 WordPress XML**  
   后台 → 工具 → 导出 → 「所有内容」→ `wordpress.xml`

2. **转换为 Markdown**  
   工具任选其一：
   - [wordpress-export-to-markdown](https://github.com/lonekorean/wordpress-export-to-markdown)
   - `npx @wordpress/block-serialization-default-parser` + 自定义脚本

3. **目录结构**

   ```
   content/posts/
     2024/
       hello-world.md
   ```

   Frontmatter 示例：

   ```yaml
   ---
   title: 文章标题
   date: 2024-01-01
   tags: [随笔]
   categories: [生活]
   slug: hello-world
   ---
   ```

4. **博客渲染**（Phase 3 二选一）
   - 同仓库加 `src/blog/` + Vite SSR/SSG 插件
   - 子目录 `blog/` 用 **Astro** 或 **vitepress** 单独构建，部署到 `/blog/`

### 方案 B：保留 WordPress 仅作 CMS（过渡期）

- 门户静态化，博客仍 `askuary.cn/blog/` 指向 WP
- REST API 拉文章列表到 `/archive` 预览
- 逐步导出 Markdown 后下线 WP

### 方案 C：Headless WordPress

- 门户 + 前端框架读 WP GraphQL
- 运维成本高，**不推荐** 作为最终态

---

## 四、Canvas 模块迁移顺序

| 顺序 | 源文件 | 目标 |
|------|--------|------|
| 1 | `footprint-stars.js` | `src/canvas/starfield.ts`（已部分实现） |
| 2 | `footprint-earth.js` | `src/canvas/earth.ts` |
| 3 | `footprint-atlas.js` | `src/ui/spot-panel.ts` |
| 4 | `footprint-blackhole.js` + CSS | `src/canvas/blackhole.ts` |
| 5 | `footprint-intro.js` | `src/app/scroll.ts` 滚动分屏 |

迁移原则：IIFE → ES Module + TypeScript；`window.sakurairoChild*` → `loadConfig()`。

---

## 五、部署

| 平台 | 说明 |
|------|------|
| Cloudflare Pages | `npm run build`，`dist/` 发布，自定义域 askuary.cn |
| Nginx | `root /var/www/askuary-portal/dist` |
| GitHub Actions | push main → 自动 build + deploy（后续 `.github/workflows/deploy.yml`） |

**切换 DNS 前**：在子路径或预览域完整验收门户 + 博客链接。

---

## 六、检查清单

- [ ] 导出 spots / friends / meteor-words / site 配置
- [ ] 配置 nav-stars.json 六个入口
- [ ] 导出全部文章为 Markdown
- [ ] 图片迁移到 `public/uploads/` 或图床，更新文中链接
- [ ] 301：旧 WP 文章 URL → 新 slug（Nginx 或 Cloudflare Rules）
- [ ] Phase 2 地球 + 黑洞迁移完成
- [ ] 根域切到静态门户

---

## 七、时间线建议

| 周 | 任务 |
|----|------|
| W1 | 本仓库 Phase 1–2，JSON 数据灌入 |
| W2 | WP XML → Markdown，博客可读 |
| W3 | 预览域联调，301 规则 |
| W4 | 正式上线，WP 只读或下线 |
