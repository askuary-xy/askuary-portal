# Askuary Portal

ASKUARY 的个人博客、摄影档案与互动宇宙入口。入口是一段连续航行：从银河远景接近太阳系，探索行星、友链卫星和页面太空站，最后穿越黑洞返回中央主页。

站点不是单一 3D 展示页：宇宙入口负责沉浸式导航，文章、摄影、馆藏、碎念、归档、游戏与后台仍保留各自完整的信息结构和功能。

## 技术栈

| 层 | 选型 |
|----|------|
| 构建 | Vite 8 + TypeScript |
| 渲染 | Three.js / WebGL（银河、太阳系、黑洞）+ Canvas 2D（流星与交互层） |
| 配置 | `data/*.json` |
| 页面 | Vite 多页面入口 + TypeScript；站内软导航保留公共宇宙壳 |
| 内容 | Markdown 双轨：`content/journal/`（日常与故事）+ `content/posts/`（独立文章）；支持短代码，见 `docs/SHORTCODES.md` |


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
├── docs/              # 部署、迁移、短代码与开发记录
└── src/
    ├── app/           # 银河点云、太阳系、黑洞与连续航行
    ├── canvas/        # 流星与视觉交互层
    ├── pages/         # 各页面入口与业务逻辑
    ├── styles/        # 全局设计系统与页面主题
    └── ui/            # 导航、天气、音乐、备案等公共组件
```

## 页面与内容

| 路径 | 说明 | 内容源 |
|------|------|--------|
| `/` | 银河 → 太阳系 → 黑洞的互动宇宙入口 | `data/nav-stars.json`、`data/friends.json`、`data/meteor-words.json` |
| `/home/` | 中央主页 / 像素世界 / 日常内容 | `content/journal/*.md`、`data/home.json` |
| `/articles/` | 独立文章列表 | `content/posts/*.md` |
| `/blog/` | 日志入口与文章兼容页 | `content/posts/*.md` |
| `/shuoshuo/` | 碎念信号流 | API + 本地数据 |
| `/library/` | 书籍、漫画、游戏与影音馆藏 | `data/library.json` |
| `/archive/` | 全部文章归档 + 标签筛选 | `content/*` 构建索引 |
| `/photos/` | 摄影墙 / 相册故事 | `content/photowall/` |
| `/games/` | 像素街机与嵌入游戏 | `data/games-page.json` |
| `/friends/`、`/about/` | 友联与站点说明 | `data/friends*.json`、`data/about.json` |
| `/admin/` | 个人内容管理后台 | 本地/API 配置 |

`npm run dev` / `npm run build` 会自动执行 `content:build`（宇宙博客 + 主页 journal + 归档索引 + RSS + 文章配图 + 摄影墙）。

## 内容目录分工

```text
content/
  journal/      # 主页文章 Markdown
  posts/        # 宇宙·博客 Markdown
  photowall/    # 摄影原图（独立上传，勿与文章图混盖）
  uploads/      # 文章配图（独立上传）
```

部署覆盖建议：改摄影只传 `content/photowall`（或构建后的 `public/photowall`）；改文章配图只传 `content/uploads`（或 `public/uploads`）。二者互不影响。

## 摄影墙

原图只放本机 `content/photowall/`（**不要上传到服务器**）。构建只产出带水印的缩略图，前台列表/大图都读缩略图。

构建缩略图时会自动加右下角水印 `askuary`（半透明），可在 `content/photowall/photos.json` 的 `_watermark` 里改：

```json
"_watermark": { "enabled": true, "text": "askuary", "opacity": 0.42 }
```

设 `"enabled": false` 可关闭。改文案/透明度后重新 `npm run photowall:build` 会强制重压缩略图。

```powershell
# 本机
npm run photowall:build
# 或整站：npm run build
```

上传到网站根（方案 A）只需：

- `dist/photowall/`（仅 `*.thumb.jpg`）
- `dist/data/photowall-index.json`

**推荐行程文件夹命名**（自动识别为相册）：

```text
content/photowall/
  2026.7.2齐云山/
    *.jpg
  2026.7.11云南/
    *.jpg
```

规则：`年.月.日` + 标题 → 相册名用标题，日期用文件夹日期。也兼容旧分类目录 `日常/`、`街拍/`、`风景/`，以及 `风景/2026.7.2齐云山/`（内层行程优先）。

可选元数据：`content/photowall/photos.json`（`_albums` / 单图覆盖 / `_locations`）。

后台「摄影管理」：先构建摄影墙，再点「从静态索引同步」，即可编辑标题与故事（不上传大图）。前台会合并 API 覆盖层。

旧图未改动会跳过压缩；若已有 `dist/`，`photowall:build` 会同步到 `dist/photowall` 与索引。

**方案 B（只在服务器构建）**：见 [`docs/DEPLOY-SERVER.md`](docs/DEPLOY-SERVER.md)。若用方案 B，服务器仓库里仍会有原图，体积更大；想省流量请用上面的本机构建、只传缩略图。

## 文章配图

正文图片放在 `content/uploads/`，Markdown 引用 `/uploads/...`。构建会复制到 `public/uploads/`。

从 WordPress 备份迁入：

```powershell
node scripts/migrate-uploads.mjs "D:\backup\wp-content\uploads"
npm run content:build
```

## 博客（宇宙·博客）

文章放在 `content/posts/*.md`，frontmatter 示例：

```yaml
---
title: 文章标题
date: 2026-07-01
summary: 列表页摘要
aiSummary: 可选，正文页「AI 摘要」框；省略时用 summary
tags: [随笔]
---
```

主页 journal 文章若有 `aiSummary` 或 `summary`，正文顶部会显示 **AI 摘要** 框（宇宙博客不显示）。

配置 API：复制 `.env.example` 为 `.env`，填写 DeepSeek 的 `CHATGPT_ACCESS_TOKEN`（默认 endpoint / model 已指向 DeepSeek）。

```powershell
npm run ai:summary:check        # 自检接口是否可用
npm run ai:summary              # 缺 aiSummary 时调用 API 生成；已有 summary 会先迁移
npm run ai:summary -- --force   # 强制用 API 重写全部
```

`npm run content:build` 生成：

- `/blog/` 列表页与 `/blog/{slug}/`
- `/home/` 主页与 `/journal/{slug}/`
- `public/data/posts-index.json`、`public/data/journal-index.json`
- `public/data/archive-index.json`、`public/rss.xml`


## 配置

- `data/site.json` — 站名、`homeUrl`（黑洞穿越目标）、黑洞开关、足迹地图 `amapKey` / `amapSecurityJsCode`（高德 JS API；控制台开 Web 端并配域名）
  - 构建会先 `sync:data`：源里密钥为空时，自动保留 `public/data` 或已有 `dist/data` 里的 Key，也可用 `.env` 的 `VITE_AMAP_KEY` / `VITE_AMAP_SECURITY_JS_CODE` 注入，避免重建清空
- `data/home.json` — 站点主页文案与展示区块
- `data/blog-page.json` — 宇宙·博客页标题与导语
- `data/nav-stars.json` — 太阳系中的博客 / 关于 / 友联导航太空站
- `data/friends.json` — 友联列表（地球卫星 + 友联页共用）
- `data/friends-page.json` — 友联页标题与空状态文案

```powershell
Copy-Item data\* public\data\ -Force
```

## 进度

| 阶段 | 内容 | 状态 |
|------|------|------|
| 连续宇宙入口 | 银河远景 → 太阳系 → 深空 → 黑洞 | 🚧 持续打磨 |
| 太阳系交互 | 行星聚焦、月球、友链卫星、导航太空站、文字流星 | 🚧 持续打磨 |
| 内容页面 | 主页、文章、碎念、摄影、馆藏、归档、游戏、关于、友联 | ✅ |
| 内容后台 | 文章、摄影、馆藏与友联管理 | ✅ |
| 响应式与主题 | 公共导航、天气昼夜、移动端适配 | 🚧 持续优化 |
| 部署 | 本地构建覆盖 / GitHub Pages | ✅ |

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

- **视觉与交互**：围绕“同一个宇宙，不同的星球”持续重构；宇宙入口借鉴沉浸式 3D 作品集的镜头语言，但站点结构、交互映射与视觉系统均为本项目实现。
- **3D 素材**：太阳系模型与黑洞素材的来源、作者和许可记录在 [`public/assets/universe/solar-system/ATTRIBUTION.md`](public/assets/universe/solar-system/ATTRIBUTION.md) 及站内声明页；运行时代码不会从第三方模型站动态加载素材。
- **内容归属**：文章、摄影、站点数据及品牌素材属于 ASKUARY；第三方作品封面、站点截图和外链仅用于对应内容展示。
