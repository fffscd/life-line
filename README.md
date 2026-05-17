# Life Line

一个已经部署到 GitHub Pages 的个人公开主页。站点源码放在 `site/` 目录，部署流程放在 `.github/workflows/pages.yml`。

公开地址：

```text
https://fffscd.github.io/life-line/
```

## 部署原理

这个仓库使用 GitHub Pages 的分支发布方式：

1. `main` 分支收到推送。
2. GitHub Actions 读取 `site/` 目录。
3. workflow 把静态文件同步到 `gh-pages` 分支。
4. GitHub Pages 从 `gh-pages` 分支根目录发布公开网站。

## 首次发布

先在 GitHub 上创建一个空仓库，然后在本地执行：

```bash
git add .
git commit -m "Create GitHub Pages site"
git remote add origin git@github.com:fffscd/life-line.git
git push -u origin main
```

如果需要重新配置 Pages，进入 GitHub 仓库的 `Settings` → `Pages`，把 `Build and deployment` 的 `Source` 设为 `Deploy from a branch`，分支选择 `gh-pages`，目录选择 `/root`。工作流完成后，网站地址通常是：

```text
https://<你的 GitHub 用户名>.github.io/life-line/
```

如果仓库名是 `<你的 GitHub 用户名>.github.io`，网站地址通常是：

```text
https://<你的 GitHub 用户名>.github.io/
```

## 本地预览

这个站点没有构建步骤，直接打开 `site/index.html` 即可预览。也可以启动一个静态服务器：

```bash
python3 -m http.server 8000 --directory site
```

然后访问：

```text
http://127.0.0.1:8000/
```

## 日常更新

修改 `site/index.html`、`site/styles.css` 或 `site/script.js` 后提交并推送到 `main` 分支，GitHub Actions 会更新 `gh-pages` 分支，公开网站会随后刷新。

## 写博客

文章正文使用 Markdown。新增记录只需要创建一个 Markdown 文件，推荐沿用现在的 `年/月日` 习惯：

```text
2026/0517.md
```

推荐写法：

```md
---
title: 记录标题
category: 生活
summary: 首页显示的摘要
---

正文从这里开始写。
```

`title`、`category`、`summary` 都可以省略。省略时系统会从路径、一级标题和正文自动推导。

如果你希望文件完全放在站点目录里，也可以使用这个路径：

```text
site/records/2026/05/17/index.md
```

发布时 GitHub Actions 会运行：

```bash
node scripts/build-records.js
```

这个脚本会扫描 `2026/0517.md`、`2026/0517` 以及 `site/records/**/index.md`，自动生成文章页面和 `site/records/index.js`，首页会读取生成后的索引，把最新记录显示在“近期记录”区域。使用 `./auto-commit.sh` 时也会先自动生成记录文件。

本地预览前可以手动运行一次：

```bash
node scripts/build-records.js
python3 -m http.server 8000 --directory site
```

Markdown 正文支持常用格式：段落、二级到五级标题、无序列表、有序列表、引用、分割线、行内代码、代码块、粗体和链接。
