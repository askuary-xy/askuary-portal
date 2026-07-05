# Askuary Portal

**全新**个人宇宙门户（Vite + TypeScript + Canvas 2D），与任何旧站无关联。

保留：地球光点、友联卫星、深空流星、黑洞穿越；**导航入口在背景恒星上**。

## 技术栈

| 层 | 选型 |
|----|------|
| 构建 | Vite 8 + TypeScript |
| 渲染 | Canvas 2D（星空、地球、黑洞） |
| 配置 | `data/*.json` |
| 博客 | Markdown 双轨：`content/journal/`（主页）+ `content/posts/`（宇宙·博客） |


## 快速开始

```bash
cd C:\Users\Administrator\Projects\askuary-portal
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

## 目录

```
askuary-portal/
├── data/              # 配置源
├── public/data/       # 运行时 JSON
├── docs/ROADMAP.md    # 博客与后续开发计划
└── src/
    ├── canvas/        # 星空、地球、黑洞
    ├── app/           # 滚动分屏、穿越
    └── ui/            # 恒星弹层
```

## 页面与内容

| 路径 | 说明 | 内容源 |
|------|------|--------|
| `/` | 宇宙门户 | `data/*.json` |
| `/home/` | 站点主页（黑洞穿越） | `content/journal/*.md` |
| `/blog/` | 宇宙·博客 | `content/posts/*.md` |
| `/about/`、`/friends/` | 关于、友联 | `data/about.json` 等 |

`npm run dev` / `npm run build` 会自动执行 `content:build`（宇宙博客 + 主页 journal）。

## 博客（宇宙·博客）

文章放在 `content/posts/*.md`，frontmatter 示例：

```yaml
---
title: 文章标题
date: 2026-07-01
summary: 列表页摘要
tags: [随笔]
---
```

`npm run content:build` 生成：

- `/blog/` 列表页与 `/blog/{slug}/`
- `/home/` 主页与 `/journal/{slug}/`
- `public/data/posts-index.json`、`public/data/journal-index.json`


## 配置

- `data/site.json` — 站名、`homeUrl`（黑洞穿越目标）、黑洞开关
- `data/home.json` — 站点主页文案与展示区块
- `data/blog-page.json` — 宇宙·博客页标题与导语
- `data/nav-stars.json` — 背景导航恒星
- `data/friends.json` — 友联列表（地球卫星 + 友联页共用）
- `data/friends-page.json` — 友联页标题与空状态文案

```powershell
Copy-Item data\* public\data\ -Force
```

## 进度

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 0–2 | 门户 + 地球 + 黑洞 + 流星 | ✅ |
| 关于页 | `/about/` | ✅ |
| 友联页 | `/friends/` | ✅ |
| 站点主页 | `/home/` + journal | ✅ |
| 宇宙·博客 | `/blog/` + Markdown | ✅ |
| 部署 | GitHub Pages | ✅ |

## GitHub Pages 部署

推送 `main` 分支后，GitHub Actions 会自动构建并发布站点。

**首次启用（仓库 Settings 里操作一次）：**

1. 打开 https://github.com/askuary-xy/askuary-portal/settings/pages
2. **Build and deployment → Source** 选 **GitHub Actions**
3. 保存后，在 **Actions** 页查看 `Deploy GitHub Pages` 工作流是否成功

**线上地址：** https://askuary-xy.github.io/askuary-portal/

本地模拟 Pages 构建：

```powershell
npm run build:pages
npm run preview
```

若日后绑定自定义域名（根路径 `/`），改用 `npm run build` 即可，无需 `--base=/askuary-portal/`。

## 仓库

https://github.com/askuary-xy/askuary-portal

## 来源

- **视觉与交互**：延续 [askuary.cn](https://askuary.cn) 线上宇宙门户（粒子地球、光点、深空流星、黑洞穿越、星图导航等）。
- **技术实现**：由 WordPress Sakurairo-child Link Start 页重构为 Vite + TypeScript + Canvas 2D 独立仓库；**数据、域名与文章内容均独立新建**，不承接旧站 WordPress 内容。

