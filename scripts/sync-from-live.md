# 从 askuary.cn 同步配置

## 一键迁移（推荐）

```powershell
cd C:\Users\Administrator\Projects\askuary-portal
npm run migrate:live
```

依次执行：

1. `sync-from-live.mjs` — 门户 JSON（光点、流星、恒星、站点信息）
2. `export-wp.mjs` — WordPress 文章 → `content/journal/`、`content/posts/`
3. `sync:data` — 复制 `data/` → `public/data/`
4. `content:build` — 生成文章页、归档索引、RSS、文章配图同步、摄影墙

文章配图请放 `content/uploads/`（与 `content/photowall/` 摄影墙分开，部署可单独覆盖）。从 WP 备份迁入：

```powershell
node scripts/migrate-uploads.mjs "D:\backup\wp-content\uploads"
```

## 分步执行

```powershell
npm run sync:live      # 仅门户配置
npm run export:wp      # 仅 WordPress 文章
npm run sync:data
npm run content:build
```

自定义旧站地址：

```powershell
node scripts/sync-from-live.mjs https://www.askuary.cn
node scripts/export-wp.mjs https://www.askuary.cn
```

## 浏览器控制台（备用）

在 [askuary.cn](https://askuary.cn) 控制台执行：

```javascript
copy(JSON.stringify({
  site: {
    name: document.querySelector('.fp-title')?.textContent?.trim(),
    intro: document.querySelector('.fp-desc')?.textContent?.trim(),
    avatar: document.querySelector('.fp-avatar img')?.src,
    avatarAlt: document.querySelector('.fp-avatar img')?.alt,
  },
  spots: (window.sakurairoChildEarth?.spots || []).map(s => ({
    lat: s.lat, lng: s.lng, title: s.title, text: s.text,
    style: s.style, url: s.url || '', linkLabel: s.link_label || s.linkLabel || '',
  })),
  friends: window.sakurairoChildEarth?.friends || [],
  meteorWords: window.sakurairoChildStars?.words || [],
}, null, 2));
```

拆入 `data/*.json` 后 `npm run sync:data`。

## 映射说明

| 旧站 | 新站 |
|------|------|
| WP `post` | `content/journal/` → `/journal/:slug/` |
| `shuoshuo` CPT | `content/journal/`（标签：碎念） |
| `fp_stellar` | `content/posts/` → `/blog/:slug/` |
| 黑洞穿越 `/blog/` | 新站 `/home/` |
| 导航恒星「博客」 | `/blog/` |
| 光点旅记外链 | 暂保留旧站绝对 URL，待旅行模块上线后改写 |

**友联**：线上「测试」条目无有效 URL，迁移时默认清空；请在 `data/friends.json` 手填真实友站。

**备案**：从旧站 iro-Options → Footer Info 复制到 `data/legal.json` 的 `icp` / `gongan` / `extraHtml`。
