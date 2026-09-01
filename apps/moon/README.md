# 时沐恩 · 家庭私享纪念页

这是时沐恩的家庭私享纪念页。它围绕“月光、生命线、祝福星图”展开，照片只作为时间线里的小小入口；本地预览仍保留，方便继续打磨。

它是 Adams Home 下的独立子项目，公网地址为 `https://moon.gallagher.lol/`，不会改变主站 `https://gallagher.lol/`。

## 本地打开

在这个文件夹中运行：

```bash
npm install
npm run dev
```

随后在浏览器打开终端显示的本地地址。

## 已完成的体验

- 持续跳动的出生计时，基于 2026 年 8 月 25 日 08:52。
- 可查看的生命时间线；现有三张照片只以缩略图出现，点击后才展开。
- 家人文字留言会成为祝福星；可录制语音祝福，语音星会有不同的呼吸节奏。
- 手机端有“生命时间线 / 家人祝福”章节入口，电脑端则同时展示三个叙事区域。
- 本地管理入口支持追加文字、图片、音频、视频、PDF、Word、TXT 或 Markdown 文档，并删除本机内容。

## 管理与共享

本地预览的管理入口演示密码为 `08250852`，只用于离线演示。共享版由服务端访问密码保护，密码不写入前端；每月自动轮换，并保留登录、查看、上传与删除的审计记录。

共享版的时间线、留言、录音和管理员上传内容由 Cloudflare 的 D1 与 R2 保存，家人使用同一入口即可看到最新内容。录音只在用户明确点击并允许浏览器麦克风后开始。

## Cloudflare 部署

1. 在 Cloudflare 创建 D1 数据库（建议名称 `moon-db`）和 R2 存储桶（建议名称 `moon-media`）。
2. 复制 `wrangler.example.jsonc` 为本机的 `wrangler.jsonc`，把 `database_id` 换成真实 D1 ID；这个本机文件不要提交到 GitHub。
3. 在 Cloudflare Worker 的 Secrets 中配置 `MOON_INITIAL_PASSWORD`、`MOON_ENCRYPTION_KEY`、`MOON_SESSION_SECRET`，三个值都不要写入仓库。
4. 在 `moon.gallagher.lol` 配置 Worker 路由或自定义域名，并把 DNS 交给 Cloudflare 托管。
5. 运行 `npm install`、`npm run deploy`。首次部署后，执行 `wrangler d1 migrations apply moon-db --remote`。

`wrangler.example.jsonc` 中的月度 Cron 会在每月 UTC 月初触发密码轮换；站点会在 D1 中记录版本和审计事件。

本地完成构建后可以运行 `npm run test:worker`，检查 Worker 的静态回退、API 边界和发布产物。

## 当前发布边界

主站 `gallagher.lol` 不会被改动，子站使用 `moon.gallagher.lol`。发布前需要在 Cloudflare 完成数据库、媒体存储、Worker 路由和运行时密钥绑定，并在真实浏览器里确认语音录制能取得麦克风权限；未完成这些检查时不应把链接交给家人。
