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
