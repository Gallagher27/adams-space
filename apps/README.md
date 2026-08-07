# Adams Home 应用目录

这里是 Adams Home 的应用源码目录。每一个子目录代表一个平级应用，不要把应用功能代码直接写进主站首页。

## 当前应用

- `food-map/`：静态的吉隆坡美食地图
- `currency-converter/`：静态汇率转换工具
- `voice-lab/`：独立的 Cloudflare Worker / Vinext 应用

## 新增应用流程

1. 在 `apps/` 下创建新的应用目录。
2. 在 `content/site-content.mjs` 的 `projects` 数组增加一条项目配置，至少填写 `slug`、`sourceDir`、`runtime`、`deployment` 和 `path`。
3. 运行 `npm run check:apps`，确认源码目录和项目登记一致。
4. 运行 `npm run build`，让主站重新生成主页、项目列表和静态应用页面。
5. 检查 `git diff`，确认只改到了预期的应用和主站输出。
6. 如果修改了 Voice Lab，再运行 `npm run check:voice-lab`；也可以直接运行 `npm run verify` 做完整检查。
7. 提交到 GitHub。

## 约定

- 主站展示信息统一放在 `content/site-content.mjs`，不要在多个 HTML 页面里重复修改项目名称和链接。
- 静态应用由主站构建流程复制到公开目录。
- 有 API Key、登录、数据库或 Cloudflare Worker 的应用保留自己的运行时和部署配置。
- 密钥只放在对应应用的本地环境变量或 Cloudflare Secret，不进入主站和 GitHub。
