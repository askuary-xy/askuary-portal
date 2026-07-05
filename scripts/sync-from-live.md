# 从 askuary.cn 同步配置

当 [askuary.cn](https://askuary.cn) 仍在运行时，可在浏览器控制台执行以下代码，复制输出到 `data/` 对应文件：

```javascript
copy(JSON.stringify({
  site: {
    name: document.querySelector('.fp-title')?.textContent?.trim(),
    intro: document.querySelector('.fp-desc')?.textContent?.trim(),
    avatar: document.querySelector('.fp-avatar img')?.src,
    avatarAlt: document.querySelector('.fp-avatar img')?.alt,
  },
  spots: (window.sakurairoChildEarth?.spots || []).map(s => ({
    lat: s.lat,
    lng: s.lng,
    title: s.title,
    text: s.text,
    style: s.style,
    url: s.url || '',
    linkLabel: s.link_label || s.linkLabel || '',
  })),
  friends: window.sakurairoChildEarth?.friends || [],
  meteorWords: window.sakurairoChildStars?.words || [],
}, null, 2));
```

然后将字段拆入 `data/site.json`、`data/spots.json` 等，并执行：

```powershell
Copy-Item data\* public\data\ -Force
```

**说明**：新项目默认不保留指向旧站文章/旅记的 `url`，光点以 `title` / `text` 为主；需要外链时在 `spots.json` 里手动填写。
