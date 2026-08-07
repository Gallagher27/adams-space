# Adam's Space

个人主页网站，托管在 GitHub Pages。

## 网站结构

```text
/              → 主站首页
/about/        → 个人简介
/projects/     → 项目入口页
/food-map/     → 吉隆坡美食地图
/currency-converter/ → 独立汇率转换工具
/apps/         → 三个平级应用的源码目录
/assets/       → 公共样式
/content/      → 站点内容数据
/scripts/      → 静态页面构建脚本
/templates/    → 新项目页面模板
```

## 管理方式

这个站点现在是一个轻量的静态站，但已经改成了统一内容源管理：

- `content/site-content.mjs`
  存放首页、简介页、项目页共用的内容数据。
- `scripts/build.mjs`
  根据同一份内容数据生成首页、`about` 和 `projects` 页面。
- `assets/site.css`
  存放主站共用样式，统一整体的 Notion 风格。
- `templates/project-page.html`
  新项目页面模板。新增站内项目时可以复制它作为起点。
- `apps/README.md`
  应用目录和标准新增流程。
- `scripts/check-apps.mjs`
  检查项目登记、源码目录、运行方式和公开地址是否一致。
- `docs/architecture.md`
  说明每个应用应该改哪里、构建后对应到哪里，以及统一检查流程。

## 如何更新内容

### 修改个人简介或首页文案

编辑：

```text
content/site-content.mjs
```

改完后运行：

```bash
npm run build
```

### 新增一个项目

1. 在 `apps/` 下创建一个新的应用目录，例如：

```text
/apps/new-project/
```

2. 在 `content/site-content.mjs` 的 `projects` 数组里新增一个项目对象，并填写 `sourceDir`、`runtime`、`deployment` 和 `path`。
3. 运行应用注册检查：

```bash
npm run check:apps
```

4. 运行构建：

```bash
npm run build
```

这样主站首页、项目列表和静态应用目录会从同一份项目登记自动更新。

### 站点基础优化

运行 `npm run build` 时，会自动更新：

- `index.html`
- `about/index.html`
- `projects/index.html`
- `404.html`
- `sitemap.xml`
- `robots.txt`
- `site.webmanifest`
- `.nojekyll`

## 本地预览

```bash
npm run preview
```

然后在浏览器里打开本地地址即可。

## 部署

通过 GitHub Pages 自动部署，推送到 `main` 分支即生效。
