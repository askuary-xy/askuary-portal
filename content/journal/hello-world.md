---
title: 世界，您好！
date: 2026-07-15
summary: 欢迎来到 ASKUARY。这是示例文章，也演示了阅读壳标签插件。
aiSummary: 这是 ASKUARY 的第一篇示例文章，顺带展示 tip / tabs / fold 标签插件与 AI 摘要交互。
aiSelfIntro: 我是 ASKUARY 的阅读小助手。今天带你逛「世界，您好！」——一篇用来演示阅读壳与标签插件的见面礼，点下面按钮还能看简介和大纲哦。
aiOutline: |
  - 欢迎语与站点入口
  - tip / info / warning 提示条
  - tabs 与 fold 插件预览
  - 发布后如何 content:build 验收
tags:
  - 示例
  - 阅读壳
legacyUrl: "https://www.askuary.cn/hello-world/"
---

欢迎来到 ASKUARY。这是你的第一篇文章——可以编辑或删除它，然后开始写作。

::: tip 阅读壳小贴士
正文写在白卡片里，封面英雄区会自动用封面图；AI 摘要卡底部的按钮可以展开摘要、介绍站点或跳转相关归档。
:::

::: info
粉蓝视觉保留 ASKUARY 自己的气质，布局借鉴安知鱼主题的文章阅读体验。
:::

::: warning 过期提醒示例
如果这是很久以前的技术笔记，记得核对链接是否还有效。
:::

## 标签插件预览

::: tabs
== 标签语法
使用 `::: tip` / `::: info` / `::: warning` / `::: fold` / `::: tabs` 包裹内容即可。
== 样式预览
切换这个标签页，就能看到 tabs 组件如何工作。
== 示例源码
在 Markdown 里写 `== 标题` 分段，外层用 `::: tabs` 包裹。
:::

::: fold 点我展开更多
折叠块适合放较长的补充说明、歌词原文或配置示例，默认收起不占版面。
:::

写完一篇碎念后，跑一次 `npm run content:build`，再打开对应文章页验收即可。
