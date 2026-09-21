# Adams Space 安全边界

这套项目由一个公开主站和多个独立子站组成。主站负责导航和公开内容，子站负责自己的功能、登录、数据和运行时。域名只是路由边界，不能当作身份验证。

## 当前边界

| 区域 | 地址 | 职责 | 数据规则 |
| --- | --- | --- | --- |
| 主站 | `https://gallagher.lol` | 个人介绍、项目目录、站内静态页面 | 只放公开内容，不放密钥、会话或团队私有数据 |
| 站内静态应用 | `gallagher.lol/food-map/`、`gallagher.lol/currency-converter/` | 可公开访问的地图与换算工具 | 按公开前端处理，不把它们当作私有系统 |
| Voice Lab | `https://voice-lab.gallagher.lol` | 独立训练工具与自己的运行时 | API 密钥、Worker 配置和历史记录留在自己的项目 |
| Cardroom | `https://cards.gallagher.lol` | 团队名片、账户、D1、R2、审计 | 账户、会话、联系人和图片只留在 Cardroom 项目 |
| Moon | `https://moon.gallagher.lol` | 独立家庭纪念页 | 页面和 Functions 自己负责访问控制，不由主站代管 |

## 明确规则

1. `gallagher.lol` 只绑定主站；子站使用各自精确的子域名。不要把任何私有应用绑定到 apex、`www` 或 wildcard。
2. 主站只能通过项目登记生成入口。外部入口必须是 HTTPS，并且必须使用 `*.gallagher.lol` 子域；`scripts/check-apps.mjs` 会检查 URL 与部署主机是否一致。
3. 主站不发放登录凭证、不共享父域 Cookie、不依赖 `Referer` 作为权限判断，也不通过隐藏链接保护数据。
4. 子站必须在自己的运行时校验 Host；需要保护内容时，再使用自己的账户登录或 Cloudflare Access。删除子域名前缀只能改变浏览器目标地址，不能被当作安全绕过或安全防线。
5. 所有密钥、数据库、对象存储和会话只配置在实际使用它们的子站项目；不提交到主站仓库，不写入静态 HTML、JavaScript 或内容数据。
6. 公开主站可以被用户直接打开、收藏或手动输入。真正需要限制的是子站的数据接口和私有资源，而不是试图阻止用户返回一个公开首页。

## 浏览器端第三方 Key

KL Food Map 使用 Google Maps 浏览器端 Key。它会随页面请求被用户看到，因此不能当作服务器密钥；安全控制应放在 Google Cloud Console：只允许 `https://gallagher.lol/food-map/*`（以及明确需要的本地开发来源），并限制到实际使用的 Maps API。若当前 Key 没有 HTTP Referrer 和 API 限制，应先限制或轮换它。

## 发布检查

在主站或子站发布前，至少检查：

- 主站构建与项目映射：`npm run verify`
- 主站源码没有把密钥、D1、R2 或会话字段写入静态资源
- `gallagher.lol`、各个子域和 Cloudflare Pages 项目是一对一绑定
- 子站的错误 Host 不会返回另一个项目的页面
- 未登录访问私有 API、图片和数据资源会被拒绝
- 登录 Cookie、Secrets、D1/R2 绑定只存在于对应子站项目

## 能力边界

从 Cardroom 打开主站后，用户当然可以手动删除 `cards.` 再访问 `gallagher.lol`，因为主站本来就是公开站点。Cardroom 能做的是拒绝错误 Host 下的 Cardroom 内容，并保护自己的 API、图片和数据库；如果未来要限制主站本身，需给主站增加独立认证或 Cloudflare Access，而不是依赖域名结构。
