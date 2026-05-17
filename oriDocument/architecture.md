# 架构与文件职责记录

## 工作区约束

1. 项目根目录为 `E:\C_life\CareerProject\shiftArangement`。
2. 所有后续小程序代码、后端代码、SQL、配置和测试文件都必须放在项目根目录下，不能放入 `oriDocument`。
3. `oriDocument` 是需求、设计、原型和开发记录目录。后续开发过程中，除非用户明确要求，只有 `architecture.md` 和 `progress.md` 可以持续更新。
4. 写任何代码前必须完整阅读 `oriDocument/architecture.md` 和 `oriDocument/design_document.md`。
5. 每完成重大功能或里程碑后，必须更新本文件，说明新增或修改文件的作用；同时更新 `progress.md` 记录完成步骤和验证状态。

## 当前文档职责

### `oriDocument/implementation_plan.md`

程序设计实施计划，是后续 AI 开发者的主任务清单。2026-05-17 已按用户确认重写为微信原生小程序 + Node.js Express + MySQL 路线。此前 CloudBase 版第 2.1 不作为有效完成步骤。后续开发必须按用户指定步骤推进，且用户验证通过前不得擅自进入下一步。

### `oriDocument/design_document.md`

产品设计与业务规则来源。包含产品目标、MVP 范围、已确认产品决策、角色权限、信息架构、核心流程、功能模块、数据对象、状态机和优先级。2026-05-17 已同步新身份体系：开发期测试身份分流，正式期微信 openid 登录。后续写代码前必须完整阅读此文件，业务行为以此文件为准。

### `oriDocument/tech_stack.md`

技术栈与工程建议来源。当前确定微信原生小程序、TypeScript、WXSS、WeUI、Node.js Express、TypeScript 后端、本地 MySQL、`.env`、腾讯云服务器、腾讯云 COS、站内通知、Excel 导出和测试策略。旧 CloudBase 路线已废弃，后续技术实现不得再把 CloudBase、云数据库或云函数作为主实现方案。

### `oriDocument/DESIGN.md`

视觉设计系统来源。定义颜色、字体、字号、圆角、间距、阴影、卡片、状态标签、日程网格、按钮和整体“现代企业极简”风格。步骤 1.3 已基于此文件与 HTML 原型抽取小程序全局样式规范，后续视觉迁移和组件设计必须以此文件为基础。

### `oriDocument/progress.md`

实施进度记录。用于记录已完成步骤、验证结果、下一步位置和遗留问题。当前已记录步骤 1.1、旧路线步骤 1.2、步骤 1.3 和步骤 1.4 完成且用户验证通过，并记录 2026-05-17 技术路线重构。后续按新版实施计划和用户指定步骤推进。

### `oriDocument/architecture.md`

架构与文件职责记录，即本文件。用于说明当前文档和后续工程文件的作用。后续每新增或修改重要文件，都应在此补充对应职责。

## HTML 原型职责

### `oriDocument/loginPage.html`

登录页移动端 HTML 原型。体现顶部品牌栏、登录表单、密码显示切换、忘记密码入口、联系管理员入口和整体登录页视觉。后续不再实现学号密码登录，该原型仅作为品牌、表单密度和入口视觉参考；开发期入口改为测试身份分流页，正式期入口改为微信 openid 识别。

### `oriDocument/assistanceMainPage.html`

助理端填报页 HTML 原型。体现下周空闲时间填报、全周请假、每周最高排班数、设为默认空闲时间、时间格子、有空/没空状态、底部提交按钮和助理端底部导航。

### `oriDocument/assistanceDutyPage.html`

助理端日程页 HTML 原型。体现月历、教学周、当日排班、未来值班、班次卡片和助理端底部导航。后续助理端日程只能展示本人相关排班。

### `oriDocument/assistanceTeamPage.html`

助理端团队页 HTML 原型。体现团队概览、搜索筛选入口、成员卡片、查看更多和底部导航。后续实现需补齐产品决策中要求展示的性别、年级字段，并隐藏邮箱、可靠性标签和权限编辑能力。

### `oriDocument/assistanceMyPage.html`

助理端个人中心 HTML 原型。体现个人信息、默认空闲时间编辑、通知提醒入口、账户安全、修改密码弹窗、退出登录和底部导航。

### `oriDocument/managerMainPage.html`

管理端排班主页 HTML 原型。体现管理员身份信息、个人填报入口、空闲时间收集状态、发布收集、收集中进度、已完成状态、详情管理入口、生成排班表入口和管理端底部导航。

### `oriDocument/managerDutyPage.html`

管理端日程页 HTML 原型。体现月历、教学周、无需值班开关、当日排班、未来排班和管理端底部导航。后续管理端可查看全部排班并设置未来日期是否需要值班。

### `oriDocument/managerTeamPage.html`

管理端团队页 HTML 原型。体现团队概览、搜索筛选、成员列表、新增成员、编辑成员、删除成员、查看更多和管理端底部导航。后续需扩展认证审核、角色权限、敏感标签和防止取消最后一个管理员等规则。

### `oriDocument/managerMyPage.html`

管理端个人与系统设置 HTML 原型。体现个人信息、默认空闲时间、工作日设置、默认班次设置、通知提醒、账户安全、修改密码和退出登录。

### `oriDocument/managerTimePage.html`

管理端个人填报页 HTML 原型。体现管理端用户也可以填报本人空闲时间，结构接近助理端填报页，但导航回到管理端排班主页。

## 当前架构洞察

1. 系统将分为公共入口、助理端、管理端三个前端区域，但底层组件应复用。
2. 正式身份以微信 `openid` 为准；开发期先使用临时测试身份分流页，包含 1 个管理员入口和多个助理入口。
3. 站内通知是核心通知机制，不接入微信订阅消息；邮箱验证码和密码登录不属于当前路线能力。
4. 排班确认和发布是同一个业务动作，排班状态应以 `draft -> published -> adjusted` 为主。
5. Excel 导出是 MVP 发布阻断项，图片生成是可选能力。
6. 现有 HTML 原型只作为视觉和交互参考，不能直接机械转译为小程序代码。
7. 技术实现必须保持微信原生小程序 + TypeScript + WXSS + WeUI + Node.js Express + TypeScript + MySQL 的主线，不引入 Vue、React、Taro、uni-app 或 CloudBase 作为 MVP 主基座。
8. Express 后端是权限校验、身份识别、排班生成、状态流转、Excel 导出和操作日志的可信执行边界；前端只负责展示、输入和交互反馈。
9. MySQL 核心表应至少覆盖 `users`、`semesters`、`shift_templates`、`workday_overrides`、`availability_collections`、`availabilities`、`schedules`、`schedule_assignments`、`swap_requests`、`overtime_records`、`notifications`、`operation_logs`、`system_settings`、`exported_files`。
10. 视觉 Token 已从 `DESIGN.md` 与 HTML 原型中抽取完成，后续 WXSS 全局样式应统一沉淀颜色、字号、行高、圆角、间距、阴影、卡片、状态标签、时间格子、底部导航、按钮和弹窗规则。
11. 颜色主线应以 `primary #005bbf`、`primary-container #1a73e8`、`secondary #006e2c`、`secondary-container #86f898`、`tertiary #9e4300`、`error #ba1a1a`、`surface/background #f9f9ff`、`surface-container-lowest #ffffff`、`outline-variant #c1c6d6`、`on-surface #191c23` 为基础。
12. 字体层级应覆盖 24px/32px/700、20px/28px/600、16px/24px/400、14px/20px/400、12px/16px/500 和 10px 辅助文字；后续小程序可优先使用系统字体，但必须保持层级与行高节奏。
13. 布局节奏应遵守 8px 基准间距、16px 页面边距、12px 卡片间距、50px 至 54px 主按钮高度、56px 顶部栏和约 64px 底部导航高度。
14. 组件视觉应保持现代企业极简风格：卡片使用白色背景、12px 圆角和轻阴影；状态标签使用语义色；时间格子使用有空绿色、不可用中性白/灰、风险红/橙；底部导航选中态使用绿色胶囊。
15. HTML 原型结构分析已完成：登录页映射为公共入口；助理端映射为填报、日程、团队、个人四个主页面；管理端映射为排班、日程、团队、个人/系统设置和管理端个人填报页面。
16. 后续组件边界应优先抽象 `top-app-bar`、`brand-header`、`bottom-nav`、`page-shell`、`surface-card`、`status-chip`、`shift-slot`、`calendar-grid`、`duty-card`、`member-card`、`search-filter-bar`、`setting-row`、`modal-dialog`、`floating-action-button` 和 `bottom-action-bar`。
17. 助理端和管理端应共享底层组件，差异通过角色、导航配置、权限控制和页面 service 数据源表达。
18. 新工程主目录应为 `miniprogram`、`server`、`sql`：小程序前端、Express 后端和 MySQL 脚本分别独立管理。
19. 本地开发数据库为 MySQL `localhost:3306`，数据库名暂定 `psych_scheduler`；连接信息必须通过 `server/.env` 管理，真实密码不得写入文档或仓库。
20. 生产部署放在后期，暂定腾讯云服务器本机 MySQL、PM2/Nginx/HTTPS 和腾讯云 COS。
21. 此前按 CloudBase 路线生成的工程文件不代表有效架构进度，后续如果与新版步骤冲突，应在新版步骤 2.1 中经用户确认后清理。

## 当前工程目录职责

### `miniprogram/`

微信原生小程序前端目录。当前已由新版实施计划步骤 2.2 初始化最小可编译前端骨架，用于后续存放小程序页面、组件、样式、请求封装、测试身份分流入口和前端全局状态。

### `project.config.json`

微信开发者工具项目配置文件。指定 `miniprogram/` 为小程序源码目录，启用 TypeScript 编译插件，并记录当前本地小程序 AppID 配置。该文件不承载后端、数据库或云开发配置。

### `project.private.config.json`

微信开发者工具本机偏好配置文件。仅用于本地开发工具偏好，不应承载业务配置或敏感信息。

### `tsconfig.json`

当前小程序前端 TypeScript 类型检查配置。覆盖 `miniprogram/**/*.ts` 和 `miniprogram/**/*.d.ts`，用于验证小程序前端 TypeScript 文件；后端在步骤 2.3 中应拥有独立的 `server/tsconfig.json`。

### `miniprogram/app.json`

小程序全局页面与窗口配置。当前只注册 `pages/test-entry/index`，确保启动页为开发期测试身份入口。

### `miniprogram/app.ts`

小程序应用入口。初始化全局状态，并提供设置和清空测试身份的方法。当前不发起后端请求。

### `miniprogram/app.wxss`

小程序全局基础样式。当前只包含页面背景、默认文字和按钮基础 reset；完整视觉 Token 和组件样式将在后续视觉落地步骤继续扩展。

### `miniprogram/config/app-config.ts`

小程序前端运行配置。当前记录开发期 API 基础地址 `http://127.0.0.1:3000/api` 和环境标识；真实后端接口将在后续步骤接入。

### `miniprogram/state/app-state.ts`

小程序全局状态模型和开发期测试身份数据。当前包含 1 个管理员入口和 3 个助理入口，正式身份体系后续改由后端识别微信 `openid`。

### `miniprogram/types/wx.d.ts`

当前前端骨架所需的最小微信小程序类型声明。用于在未安装完整微信类型包前支撑 TypeScript 检查，后续可在工程化完善时替换为官方或社区类型声明。

### `miniprogram/pages/test-entry/`

开发期临时测试身份入口页。用于在本地开发和联调阶段选择管理员或助理身份；正式版本上线前应由微信 `openid` 自动识别身份后替代该入口。

### `server/`

Node.js Express TypeScript 后端目录。当前已由新版实施计划步骤 2.3 初始化 Express TypeScript 最小骨架，后续用于存放控制器、服务层、权限中间件、数据库连接、测试和导出逻辑。步骤 2.4 前不得提前实现数据库连接。

### `server/package.json`

后端 npm 包配置。当前保留已有 Express、CORS、dotenv、mysql2、TypeScript、ts-node-dev 等依赖，并提供 `dev`、`build`、`start`、`typecheck` 脚本。当前 `mysql2` 依赖已安装但数据库连接模块留到步骤 2.4 使用。

### `server/package-lock.json`

后端 npm 锁文件。用于固定当前后端依赖版本，必须跟随 `server/package.json` 同步更新。

### `server/.gitignore`

后端忽略规则。忽略 `node_modules/`、`dist/`、`.env`、`.env.*` 和 npm 调试日志，避免提交本地依赖、构建产物和敏感环境变量。

### `server/.env`

后端本地运行环境文件。当前只包含 `NODE_ENV=development` 和 `PORT=3000`，用于步骤 2.3 本地启动验证；后续步骤 2.4 会补充本地 MySQL 连接信息。该文件不应提交仓库。

### `server/tsconfig.json`

后端 TypeScript 配置。限定源码根目录为 `server/src`，构建输出到 `server/dist`，启用 strict 类型检查，与根目录小程序前端 `tsconfig.json` 相互独立。

### `server/src/server.ts`

Express 后端启动入口。读取环境配置、创建 Express 应用并监听端口；启动失败时输出清晰错误并退出。

### `server/src/app.ts`

Express 应用组装入口。负责注册 CORS、JSON 解析、API 路由、404 处理和统一错误处理。

### `server/src/config/env.ts`

后端环境配置读取模块。当前校验 `server/.env` 是否存在，并读取 `NODE_ENV` 与 `PORT`；缺失文件、缺失变量或非法端口会给出清晰错误。

### `server/src/routes/index.ts`

后端 API 路由入口。当前挂载健康检查路由，后续业务模块路由应从这里统一接入。

### `server/src/routes/health.ts`

健康检查路由。当前提供 `GET /api/health`，用于确认 Express 服务启动成功并返回当前环境与时间戳。

### `server/src/errors/app-error.ts`

后端统一应用错误类型。用于携带 HTTP 状态码、业务错误码、错误消息和可选详情。

### `server/src/middleware/not-found.ts`

404 中间件。未匹配路由时生成统一的 `ROUTE_NOT_FOUND` 错误。

### `server/src/middleware/error-handler.ts`

统一错误响应中间件。将业务错误和未知错误转为统一 JSON 响应格式。

### `sql/`

MySQL 脚本目录。当前由新版实施计划步骤 2.1 创建，后续用于存放建表脚本、迁移脚本、种子数据和迁移记录。步骤 2.5 前不得提前实现 SQL 脚本组织。
