# journal 封面图库（主页文章）

把真实封面图（JPG / PNG / WEBP / GIF / AVIF）放进此目录：

`api/covers/journal/`

Docker 部署时该目录挂载到容器 `/app/covers/journal/`，放入后**无需重建镜像**即可生效。

- 目录为空时会自动生成 3 张 SVG 渐变占位（看起来像「没有随机图」）
- 一旦放入实图，系统会优先使用实图，忽略 SVG 占位
- `GET /api/covers/journal/img?seed=文章slug` — 按 seed 稳定选图
- `GET /api/covers` — 查看各图库文件数量
