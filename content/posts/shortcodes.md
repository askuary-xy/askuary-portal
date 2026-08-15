---
title: 短代码教程
date: 2026-07-25
summary: 在文章里使用提示框、折叠、进度条、GitHub 卡片等短代码（兼容旧站 Argon / Kizumi）。
tags:
  - 指南
---

写文章时可以直接粘贴旧站短代码。构建 / 后台发布后会自动变成样式组件。完整列表见仓库 `docs/SHORTCODES.md`。

## 最常用

[alert color="blue" title="提示"]宇宙博客与主页文章都支持这些短代码。[/alert]

[admonition color="orange" title="注意"]成对标签必须闭合，例如 collapse、alert、fold。[/admonition]

[label color="red" shape="round"]重要[/label]
[yaowan style="9"]渐变药丸[/yaowan]

[progressbar progress="80" color="green"]迁移进度[/progressbar]

[collapse title="点击展开详情" collapsed="true" color="blue"]
可写列表：

1. 折叠默认收起
2. 点击标题展开
3. 剧透点一下显示
[/collapse]

剧透：[hidden type="blur" tip="点击显示"]这是模糊隐藏的文字[/hidden]

## 时间线与按钮

[timeline]
2026/06|门户重建|Vite + TypeScript
2026/07|短代码迁移|Argon / Kizumi / ghcard
[/timeline]

[h2down]资源与外链[/h2down]

[downloadbtn link="https://github.com/askuary-xy/askuary-portal"]GitHub 仓库[/downloadbtn]
[linksbtn link="/about/"]关于本站[/linksbtn]

[ghcard path="askuary-xy/askuary-portal"]

## 安知鱼风格容器

::: tip 小贴士
也可以写 tip / info / warning / fold / tabs。
:::

后台编辑器工具栏有「提示」「折叠」「短代码?」可一键插入。
