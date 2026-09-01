# Adams Home 应用创建指南

## 一、主文件夹是什么

Adams Home 的主文件夹是：

```text
/Users/adam/Documents/adams-space
```

它对应 GitHub 项目：

```text
https://github.com/Gallagher27/adams-space
```

以后请在 VS Code 中打开 `adams-space`，不要把 `中英文演练` 或 `KLFOOD` 作为主工程。

## 二、当前工程结构

```text
adams-space/
├─ apps/
│  ├─ food-map/
│  ├─ currency-converter/
│  ├─ voice-lab/
│  └─ moon/
├─ assets/                         # 主站公共样式和图标
├─ content/site-content.mjs        # 主站内容和应用登记
├─ scripts/build.mjs               # 主站构建脚本
├─ scripts/check-apps.mjs          # 应用注册检查
├─ docs/                           # 工程说明文档
├─ package.json                    # 主站命令
└─ .github/workflows/validate.yml  # GitHub 自动检查
```

每一个 `apps/` 子目录都是一个平级应用。主站负责展示项目入口，应用本身负责自己的功能代码。

## 三、新增应用应该放在哪里

新应用直接放到 `apps/` 目录下：

```text
adams-space/apps/新应用名称/
```

例如：

```text
adams-space/apps/weather/
```

可以直接把新应用文件夹拖进 `apps/`，但不要直接拖到主文件夹根目录：

```text
正确：adams-space/apps/weather/
不建议：adams-space/weather/
```

## 四、在主站登记应用

打开：

```text
content/site-content.mjs
```

在 `projects` 数组中增加一条项目配置。最少需要填写以下字段：

```js
{
  slug: "weather",
  icon: "☁️",
  title: { zh: "天气工具", en: "Weather Tool" },
  status: { zh: "开发中", en: "In progress" },
  kind: { zh: "工具页", en: "Utility" },
  sourceDir: "apps/weather",
  runtime: "static",
  deployment: "main-site",
  path: "weather/",
  featured: false,
  summary: {
    zh: "一句话说明这个应用的用途。",
    en: "A short description of what this app does.",
  },
  homeSummary: {
    zh: "主页项目卡片上显示的简短说明。",
    en: "A short summary shown on the home page.",
  },
  detail: {
    zh: "项目详情页中使用的说明。",
    en: "A longer project description.",
  },
  bullets: [
    { zh: "功能一", en: "Feature one" },
    { zh: "功能二", en: "Feature two" },
  ],
  tags: ["HTML", "CSS", "JavaScript"],
  ctaLabel: { zh: "打开项目", en: "Open project" },
}
```

字段说明：

| 字段 | 用途 |
| --- | --- |
| `slug` | 应用唯一名称，不能重复 |
| `sourceDir` | 本地源码目录，必须位于 `apps/` 下 |
| `runtime` | 应用运行方式，例如 `static` 或 `cloudflare-worker` |
| `deployment` | 部署目标，例如 `main-site` 或 Cloudflare 项目域名 |
| `path` | 网站公开地址；主站内部页面使用相对路径，外部应用使用完整 URL |

## 五、不同类型应用的处理方式

### 1. 普通静态应用

适用于只有 HTML、CSS、JavaScript 的应用：

```js
runtime: "static",
deployment: "main-site",
path: "weather/",
```

构建时，主站会把：

```text
apps/weather/
```

同步到网站公开目录：

```text
weather/
```

### 2. 有 API 或独立运行时的应用

适用于 Voice Lab 这类需要 API、登录保护或 Cloudflare Worker 的应用：

```js
runtime: "cloudflare-worker",
deployment: "weather.gallagher.lol",
path: "https://weather.gallagher.lol/",
```

这类应用仍然放在 `apps/` 下，但保留自己的：

- `package.json`
- `package-lock.json`
- 构建配置
- 测试文件
- Cloudflare 配置

主站只负责提供项目入口，不会把它强行打包成静态页面。

Moon 按同样规则登记在 `apps/moon/`，公开地址使用 `https://moon.gallagher.lol/`。它的 `wrangler.example.jsonc` 只提供绑定模板；真实 D1 ID、R2 桶名和密码 Secret 只在 Cloudflare 配置，不进入 GitHub。

## 六、不要把这些文件拖进 GitHub

以下文件不要提交：

```text
node_modules/
dist/
.wrangler/
.vinext/
.env
.env.local
.dev.vars
*.pem
```

可以提交 `.env.example`，但里面只能放变量名称和空值，不能放真实 API Key。

## 七、每次修改后的标准流程

### 修改主站内容

编辑：

```text
content/site-content.mjs
```

### 修改某个应用

编辑对应目录，例如：

```text
apps/food-map/
apps/currency-converter/
apps/voice-lab/
```

### 执行检查

在主文件夹根目录运行：

```bash
npm run check:apps
npm run build
git diff --check
git status --short
```

如果修改了 Voice Lab，再运行：

```bash
npm run check:voice-lab
```

也可以一次运行全部检查：

```bash
npm run verify
```

## 八、检查修改了什么

查看文件状态：

```bash
git status --short
```

查看具体内容：

```bash
git diff
```

查看某个文件的修改：

```bash
git diff -- content/site-content.mjs
git diff -- apps/voice-lab/app/page.tsx
```

确认无误后，再提交：

```bash
git add .
git commit -m "Add new weather app"
```

## 九、Push 到 GitHub 和网站发布的关系

Push 到 GitHub 可以让远程仓库与本地文件保持一致：

```bash
git push origin main
```

当前仓库的 GitHub 地址是：

```text
https://github.com/Gallagher27/adams-space
```

GitHub 中的自动检查会验证：

- 应用目录是否存在；
- 项目是否登记；
- 主站是否可以构建；
- Voice Lab 是否可以通过测试。

但是，Push 是否会自动更新公网网站，取决于 GitHub Pages 或 Cloudflare 的部署连接。当前的 GitHub Workflow 主要负责检查，不负责替你修改 Cloudflare Secret 或发布 Voice Lab。

## 十、安全规则

- 主站是公开静态页面，不保存 API Key。
- Voice Lab 的 Google TTS API Key 只放在本地环境变量或 Cloudflare Secret 中。
- Moon 的 `MOON_INITIAL_PASSWORD`、`MOON_ENCRYPTION_KEY` 和 `MOON_SESSION_SECRET` 只放在 Cloudflare Secret 中。
- 访问密码只放在 Cloudflare 的环境变量中。
- 不要把真实 `.env` 文件、API Key、密码或私钥提交到 GitHub。

## 十一、最简记忆版

以后新增项目，只记住这五步：

1. 把源码放进 `apps/新项目/`。
2. 在 `content/site-content.mjs` 登记项目。
3. 运行 `npm run check:apps`。
4. 运行 `npm run verify`。
5. 查看 `git diff` 后再 commit 和 push。
