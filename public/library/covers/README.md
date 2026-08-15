# 馆藏封面

由 `npm run library:covers`（可选 `--force` / `--only=id`）多源拉取：

| 类型 | 来源 |
|------|------|
| 图书 / 小说 | 微信读书、豆瓣（标题校验）、起点、番茄 |
| 动漫 / 漫画 | Bangumi、B站番剧搜索、Anilist、[yuc.wiki](https://yuc.wiki/) 新番表、豆瓣 |
| 综艺 | 豆瓣移动端 / 搜索、B站 |

路径形如 `/library/covers/{id}.jpg`，在 `data/library.json` 的 `cover` 字段引用。

**注意：** 豆瓣 subject 链接可能过期或错号，脚本会用标题校验拒绝错误条目，并回退到搜索 / 微信读书。
