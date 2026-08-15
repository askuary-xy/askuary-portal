# 文章配图（uploads）

放 **journal / 博客正文里的配图**，与摄影墙分开：

| 目录 | 用途 | 构建产物 |
|------|------|----------|
| `content/photowall/` | 摄影原图 | `public/photowall/` |
| `content/uploads/` | 文章配图 | `public/uploads/` |

部署时只改文章图就上传本目录（或对应的 `public/uploads`），**不必覆盖** `photowall`。

Markdown 里用：

```md
![](/uploads/2026/07/example.png)
```

从 WordPress 备份迁入：

```powershell
node scripts/migrate-uploads.mjs "D:\backup\wp-content\uploads"
```
