# 短代码速查（Askuary Portal）

> 从旧站 Sakurairo-child 迁移。在 `content/posts/`、`content/journal/` 的 Markdown 中直接书写；  
> `npm run content:build` 时由 `scripts/lib/shortcodes.mjs` 展开为 HTML。  
> 另支持安知鱼风格容器：`::: tip` / `::: info` / `::: warning` / `::: fold` / `::: tabs`。

**静态站差异：**

| 短代码 | 说明 |
|--------|------|
| `[friendlinks]` | 读取 `data/friends.json` |
| `[userreading]` | 无 WP 登录，显示锁定提示 |
| `[steamuser]` | 需 Steam API，暂显示占位 |
| `[acg_categories]` | 依赖 WP 分类，提示改用归档 |

---

## 页面 / 导航


| 短代码 | 说明 |
|--------|------|
| `[acg_categories]` | Kizumi 风格分类卡片墙（数量 + 悬停动效） |
| `[friendlinks]` | 友情链接卡片（读取 WP「链接」） |
| `[steamuser]…[/steamuser]` | Steam 用户卡片（需 Sakurairo 配置 Steam API Key） |

```text
[acg_categories]
[acg_categories parent="3"]
[acg_categories parent="0" hide_empty="1" exclude="1,2"]

[friendlinks]
[friendlinks sort="rating" order="DESC"]

[steamuser]76561198840095990[/steamuser]
```

**ACG 分类页快捷方式：** 新建页面 → 模板选「ACG 分类导航」→ 正文写 `[acg_categories]`。

---

## Argon 组件

**通用颜色 `color`：** `indigo`（默认）· `green` · `red` · `orange` · `blue` · `black` · `grey`

### 标签 · 进度 · 提示

```text
[label color="red" shape="round"]重要[/label]

[progressbar progress="75" color="green"]完成度[/progressbar]

[alert color="blue" title="提示" icon="circle-info"]提示正文[/alert]

[admonition color="orange" title="注意" icon="triangle-exclamation"]说明正文[/admonition]
```

| 参数 | 说明 |
|------|------|
| `label` · `shape="round"` | 圆角药丸形 |
| `progressbar` · `progress="0-100"` | 进度百分比 |
| `alert` / `admonition` · `title` · `icon` | Font Awesome 图标名（不含 `fa-` 前缀） |

### 折叠 · 隐藏

```text
[collapse title="点击展开" collapsed="true" color="none" icon="folder"]
折叠内容
[/collapse]

[fold title="同上"]fold 是 collapse 别名[/fold]

[hidden type="blur" tip="点击显示"]模糊文字[/hidden]

[spoiler type="background"]遮罩文字[/spoiler]
```

| 参数 | 说明 |
|------|------|
| `collapsed="true"` | 默认收起（`false` 为展开） |
| `color` | `none` · `indigo` · `green` · `red` · `orange` · `blue` · `black` · `grey` |
| `hidden` · `type` | `blur` 模糊 / `background` 遮罩 |

### 时间线 · 待办

```text
[timeline]
2024/01|项目启动|立项完成
2024/06|公测|用户突破 1000
2025/01|正式版|全功能上线
[/timeline]
```

每行：`时间|标题|正文（可选）`，时间中的 `/` 会换行。

```text
[checkbox checked="false" inline="true"]待办一[/checkbox]
[checkbox checked="true"]已完成[/checkbox]
```

---

## Kizumi 组件

### 章节标题

```text
[h2set]章节标题[/h2set]
[h2down]下载章节[/h2down]
```

### 按钮

```text
[downloadbtn link="https://example.com/file.zip"]下载资源[/downloadbtn]
[linksbtn link="https://example.com"]访问链接[/linksbtn]
```

### 引用

```text
[blockquote1 name="作者"]引用内容[/blockquote1]
[blockquote2 name="作者"]动画边框引用[/blockquote2]
```

### 药丸标签 yaowan

```text
[yaowan style="1"]默认粉[/yaowan]
[yaowan style="4"]绿[/yaowan]
[yaowan style="5"]红[/yaowan]
[yaowan style="9"]渐变[/yaowan]
```

`style` 取值 `1`–`10`。

### 登录可见

```text
[userreading]
仅登录用户可见的内容
[/userreading]
```

---

## 场景模板（复制即用）

### 资源下载页

```text
[h2down]资源下载[/h2down]

[alert color="blue" title="说明"]本站资源仅供学习交流[/alert]

[downloadbtn link="https://你的链接"]主包下载[/downloadbtn]
[linksbtn link="https://你的链接"]在线预览[/linksbtn]
```

### 教程文章

```text
[admonition color="green" title="前置知识"]需要先了解 WordPress 基础[/admonition]

[collapse title="详细步骤" collapsed="true"]
1. 第一步
2. 第二步
[/collapse]

[label color="orange" shape="round"]新手向[/label]
[label color="red" shape="round"]进阶[/label]
```

### 分类导航页

```text
[acg_categories]
```

或选用页面模板：**ACG 分类导航**。

---

## 按需求速查

| 需求 | 短代码 |
|------|--------|
| 分类导航页 | `[acg_categories]` |
| 友链展示 | `[friendlinks]` |
| 彩色小标签 | `[label]` / `[yaowan]` |
| 进度条 | `[progressbar progress="80"]` |
| 提示框 | `[alert]` / `[admonition]` |
| 折叠 FAQ | `[collapse title="…"]…[/collapse]` |
| 剧透/隐藏 | `[hidden]` / `[spoiler]` |
| 时间轴 | `[timeline]…[/timeline]` |
| 待办清单 | `[checkbox]` |
| 下载按钮 | `[downloadbtn link="…"]` |
| 仅登录可见 | `[userreading]…[/userreading]` |
| Steam 卡片 | `[steamuser]ID[/steamuser]` |

---

## 注意事项

1. 成对标签必须闭合：`[alert]…[/alert]`、`[collapse]…[/collapse]` 等。
2. `[friendlinks]` 依赖后台 **链接** 菜单数据。
3. `[steamuser]` 内写 17 位 SteamID（7656 开头），可多个。
4. 若父主题/插件已注册同名短代码，子主题不会覆盖 Argon/Kizumi 系列。
5. 相关实现：`scripts/lib/shortcodes.mjs` · `src/styles/shortcodes.css` · `src/ui/mount-shortcodes.ts`
6. 示例文章：`/blog/shortcodes/`

