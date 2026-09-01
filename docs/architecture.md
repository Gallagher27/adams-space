# Adams Home 工程说明

## 三层关系

1. `apps/` 保存四个平级应用的源码。
2. `content/site-content.mjs` 保存项目在主站上的展示信息和工程映射。
3. 根目录构建脚本负责生成主站页面，并把静态应用同步到公开目录。

## 应用映射

| 应用 | 本地源码 | 主站入口 | 运行方式 | 部署位置 |
| --- | --- | --- | --- | --- |
| KL Food Map | `apps/food-map/` | `/food-map/` | static | Adams Home |
| 汇率转换 | `apps/currency-converter/` | `/currency-converter/` | static | Adams Home |
| Voice Lab | `apps/voice-lab/` | 外部链接 | cloudflare-worker | `voice-lab.gallagher.lol` |
| Moon 时沐恩家庭纪念页 | `apps/moon/` | 外部链接 | cloudflare-pages | `moon.gallagher.lol` |

## 修改时看哪里

- 修改个人主页文字、项目名称、项目简介或入口链接：编辑 `content/site-content.mjs`。
- 修改美食地图：编辑 `apps/food-map/`。
- 修改汇率工具：编辑 `apps/currency-converter/`。
- 修改中英文跟练：编辑 `apps/voice-lab/`，它有自己的 `package.json`、构建和 Cloudflare 部署配置。
- 修改时沐恩家庭纪念页：编辑 `apps/moon/`，它有自己的 `package.json`、构建、Pages Functions 和 Cloudflare 绑定配置。
- 修改主站公共样式：编辑 `assets/site.css`。
- 修改主站生成逻辑：编辑 `scripts/build.mjs`。

## 每次修改后的标准检查

```bash
npm run check:apps
npm run build
git diff --check
git status --short
```

如果只修改了 `apps/voice-lab/`，还要进入该目录运行它自己的检查：

```bash
cd apps/voice-lab
npm run lint
npm test
```

也可以在仓库根目录直接运行完整检查：

```bash
npm run verify
```

确认无误后，再提交 GitHub。主站和 Voice Lab 可以分别部署，但源码和变更记录属于同一个 Adams Home 工程。
