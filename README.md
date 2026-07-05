# Askuary Portal

脱离 WordPress 的 **Link Start 宇宙门户**（方案 1：Vite + TypeScript + Canvas 2D）。

保留：地球光点、友联卫星、深空流星、黑洞穿越；**导航入口在背景恒星上**，点击弹出卡片。

## 技术栈

| 层 | 选型 |
|----|------|
| 构建 | Vite 8 + TypeScript |
| 渲染 | Canvas 2D（星空 / 导航恒星；地球、黑洞 Phase 2 迁移） |
| 配置 | `data/*.json` → 构建时复制到 `public/data/` |
| 博客 | 独立模块（Markdown / headless，见 `docs/MIGRATION.md`） |

## 快速开始

```bash
cd C:\Users\Administrator\Projects\askuary-portal
npm install
npm run dev      # http://localhost:5173
npm run build    # 输出 dist/
npm run preview  # 预览构建结果
```

## 目录

```
askuary-portal/
├── data/                 # 配置源（编辑后同步到 public/data/）
├── public/data/          # 运行时加载的 JSON
├── docs/MIGRATION.md     # WordPress 文章与数据迁移方案
├── src/
│   ├── canvas/           # 星空、导航恒星、地球、黑洞
│   ├── config/           # 配置加载
│   ├── ui/               # 恒星入口弹层
│   └── styles/
└── scripts/              # 迁移脚本（后续）
```

## 配置

- `data/site.json` — 站点名、简介、头像、社交、博客 URL
- `data/nav-stars.json` — **背景导航恒星**（x/y 为 0–1 屏幕比例）
- `data/spots.json` — 地球光点
- `data/friends.json` — 友联
- `data/meteor-words.json` — 流星文字

修改 `data/` 后执行：

```powershell
Copy-Item data\* public\data\ -Force
```

## 开发阶段

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 0 | 项目脚手架 + Git | ✅ |
| Phase 1 | 星空 + 背景导航恒星 + 弹层 | ✅ |
| Phase 2 | 迁移 earth（光点 + 友联 + 天空文字） | ✅ |
| Phase 2b | 黑洞第二屏 + 下滑穿越 + 完整流星 | ✅ |
| Phase 3 | WordPress 文章导出 → 静态博客 | 见 MIGRATION.md |
| Phase 4 | 部署 askuary.cn 根域 | 待做 |

## GitHub

```bash
git remote add origin https://github.com/<你的用户名>/askuary-portal.git
git branch -M main
git push -u origin main
```

## 来源

视觉与交互自 [Sakurairo-child](https://www.askuary.cn/) Link Start 页迁移
