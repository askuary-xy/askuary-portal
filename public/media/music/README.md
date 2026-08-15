# 自建电台曲库

把可合法使用的音频放到本目录，然后在仓库根目录执行：

```bash
npm run music:index
```

会生成 / 更新 `data/music-playlist.json`（并同步到 `public/data/`）。

## 命名

- `艺术家 - 歌名.mp3`（推荐）
- 或 `歌名.mp3`（艺术家默认 ASKUARY）

同名可选附属文件：

- `艺术家 - 歌名.lrc` 歌词
- `艺术家 - 歌名.jpg` / `.png` / `.webp` 封面

## 配置

`data/home.json`：

```json
"music": {
  "source": "local",
  "playlistUrl": "/data/music-playlist.json",
  "title": "次元电台",
  "artist": "ASKUARY"
}
```

也可在 `music-playlist.json` 里手写 `tracks`（`url` 必填）。

请只上传你有权使用的音频；勿上传未授权的商业曲目。
