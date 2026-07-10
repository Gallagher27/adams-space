# Adam's Space

个人主页网站，托管在 GitHub Pages。

## 网站结构

```text
/              → 主站首页
/about/        → 个人简介
/projects/     → 项目入口页
/food-map/     → 吉隆坡美食地图
/assets/       → 公共样式
/content/      → 站点内容数据
/scripts/      → 静态页面构建脚本
```

## 管理方式

这个站点现在是一个轻量的静态站，但已经改成了统一内容源管理：

- `content/site-content.mjs`
  存放首页、简介页、项目页共用的内容数据。
- `scripts/build.mjs`
  根据同一份内容数据生成首页、`about` 和 `projects` 页面。
- `assets/site.css`
  存放主站共用样式，统一整体的 Notion 风格。

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

1. 在 `content/site-content.mjs` 的 `projects` 数组里新增一个项目对象。
2. 如果是站内页面，把你的新页面目录放到网站根目录，例如：

```text
/new-project/
```

3. 在项目对象里把 `path` 指向对应目录，例如：

```text
path: "new-project/"
```

4. 运行：

```bash
npm run build
```

这样首页和项目页就会自动带上这个新项目入口。

## 本地预览

```bash
npm run preview
```

然后在浏览器里打开本地地址即可。

## 部署

通过 GitHub Pages 自动部署，推送到 `main` 分支即生效。
