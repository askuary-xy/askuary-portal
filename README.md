# Askuary Portal

**全新**个人宇宙门户（Vite + TypeScript + Canvas 2D），与任何旧站无关联。

保留：地球光点、友联卫星、深空流星、黑洞穿越；**导航入口在背景恒星上**。

## 技术栈

| 层 | 选型 |
|----|------|
| 构建 | Vite 8 + TypeScript |
| 渲染 | Canvas 2D（星空、地球、黑洞） |
| 配置 | `data/*.json` |
| 博客 | **待在本项目内新建**（见 `docs/ROADMAP.md`） |

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

## 博客

文章放在 `content/posts/*.md`，frontmatter 示例：

```yaml
---
title: 文章标题
date: 2026-07-01
summary: 列表页摘要
tags: [随笔]
---
```

`npm run dev` / `npm run build` 会自动执行 `posts:build`，生成：

- `/blog/` 列表页
- `/blog/{slug}/` 文章页
- `public/data/posts-index.json` 与 `public/data/posts/*.json`

## 配置

- `data/site.json` — 站名、`blogUrl`、黑洞穿越开关
- `data/blog-page.json` — 博客页标题与导语
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
| 博客 | `/blog/` + Markdown | ✅ |
| Phase 3 | 博客模块（Markdown） | 待做 |
| Phase 4 | 部署 | 待做 |

## 仓库

https://github.com/askuary-xy/askuary-portal

## 来源

- **视觉与交互**：延续 [askuary.cn](https://askuary.cn) 线上宇宙门户（粒子地球、光点、深空流星、黑洞穿越、星图导航等）。
- **门户入口**：背景恒星导航为本项目独立设计，**并非**参考 yukari.one。
- **技术实现**：由 WordPress 主题页重构为 Vite + TypeScript + Canvas 2D 独立仓库；**数据、域名与文章内容均独立新建**，不承接旧站 WordPress 内容。
