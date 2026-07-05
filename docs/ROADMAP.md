# Askuary Portal — 开发路线图

**全新独立项目**：视觉体验延续 [askuary.cn](https://askuary.cn)，但代码、数据与域名独立部署，不与旧 WordPress 站绑定。

---

## 目标架构

```
/                 ← 宇宙门户（本仓库，已实现）
/blog/            ← 博客首页（已实现）
/blog/:slug       ← 文章详情（已实现）
/archive/         ← 归档列表（待开发）
/about/           ← 关于页（已实现）
/friends/         ← 友联页（已实现）
```

| 模块 | 技术 | 状态 |
|------|------|------|
| 宇宙门户 | Vite + TS + Canvas 2D | ✅ |
| 友联页 | `/friends/` + `data/friends.json` | ✅ |
| 关于页 | `/about/` + `data/about.json` | ✅ |
| 博客 | Markdown + `/blog/` | ✅ |
| 部署 | GitHub Pages / Cloudflare Pages | 待做 |

---

## 博客方案（待选）

### 方案 A：同仓库多页（Vite + Markdown）

```
content/posts/*.md
src/pages/blog.ts
```

- 优点：单仓库、单部署
- 工具：`vite-plugin-md` 或 build 时生成 JSON 索引

### 方案 B：Astro 子应用

```
apps/portal/   ← 当前门户
apps/blog/     ← Astro 静态博客
```

- 优点：SEO、标签/分类成熟
- 部署：根域 `/` 门户，`/blog/` 子路径

### 方案 C：独立仓库 `askuary-blog`

- 门户恒星 / 黑洞指向 `blogUrl: "/blog/"` 或子域
- 两项目独立迭代

**当前默认**：`site.json` 中 `blogUrl: "/blog/"`，黑洞穿越与「博客」恒星均指向该路径，博客页尚未创建时会 404，属预期。

---

## 门户配置（无后台）

| 文件 | 用途 |
|------|------|
| `data/site.json` | 站名、简介、头像、`blogUrl` |
| `data/about.json` | 关于页文案与链接 |
| `data/nav-stars.json` | 背景导航恒星 |
| `data/spots.json` | 地球光点 |
| `data/friends.json` | 友联卫星（地球 + 友联页共用） |
| `data/friends-page.json` | 友联页文案 |
| `data/blog-page.json` | 博客页文案 |
| `content/posts/*.md` | 文章源文件（Markdown） |

改 `data/` 后：

```powershell
Copy-Item data\* public\data\ -Force
```

后期可选：Decap CMS / Tina 编辑 JSON 或 Markdown。

---

## 阶段计划

| 阶段 | 内容 |
|------|------|
| ✅ Phase 0–2 | 门户脚手架、恒星、地球、黑洞、流星 |
| Phase 3 | 博客 Markdown 管线 + `/blog/` 列表页 | ✅ |
| Phase 4 | 标签、RSS、归档 | 待做 |
| ✅ Phase 5 | 星图导航（第二屏 atlas） |
| Phase 6 | 生产部署 + 自定义域名 |

---

## 部署提示

- 门户构建：`npm run build` → `dist/`
- 若博客为 SPA 子路由，服务器需对 `/blog/*` 配置 fallback 或预渲染
- GitHub 仓库：https://github.com/askuary-xy/askuary-portal
