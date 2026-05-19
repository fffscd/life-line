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

预览前先生成一次记录页面：

```bash
node scripts/build-records.js
python3 -m http.server 8000 --directory site
```

然后访问：

```text
http://127.0.0.1:8000/
```

## 日常更新

写文章只需要新增或修改 Markdown 文件，然后提交并推送到 `main` 分支。GitHub Actions 会自动运行 `node scripts/build-records.js`，生成文章网页、更新首页记录列表，并发布到 `gh-pages` 分支。

如果使用仓库里的脚本，可以执行：

```bash
./auto-commit.sh
```

它会先生成记录页面，再提交并推送。

## 写博客

文章正文使用 Markdown。新增记录推荐沿用现在的 `年/月日` 习惯：

```text
2026/0519.md
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

也可以省略 `.md` 后缀：

```text
2026/0519
```

生成脚本会扫描 `2026/0519.md`、`2026/0519` 以及 `site/records/**/index.md`，自动生成文章页面和 `site/records/index.js`。`site/records/**/index.html` 属于生成结果，日常写作无需手动修改。

Markdown 正文支持常用格式：段落、二级到五级标题、无序列表、有序列表、引用、分割线、行内代码、代码块、粗体、链接和图片。
