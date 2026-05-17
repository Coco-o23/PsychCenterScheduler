# 实施进度记录

## 2026-05-16

### 已完成：实施计划步骤 1.1 建立需求追踪清单

执行内容：

1. 阅读了 `oriDocument` 目录下所有现有文档与 HTML 原型，包括 `implementation_plan.md`、`design_document.md`、`tech_stack.md`、`DESIGN.md`、全部助理端 HTML、全部管理端 HTML、`architecture.md` 和 `progress.md`。
2. 按 `implementation_plan.md` 的步骤 1.1 要求，基于 `design_document.md` 第 2 至第 10 章整理了需求追踪清单。
3. 追踪范围已覆盖账号、学期、团队、收集、填报、排班、日程、换班、加班、导出、个人设置、公共导航。
4. 提炼了账号状态、收集任务状态、排班状态、换班状态、加班状态等状态机。
5. 提炼了 User、Semester、AvailabilityCollection、Availability、Shift、Schedule、SwapRequest、OvertimeRecord、Notifications、PasswordResetCodes、OperationLogs 等关键数据对象。
6. 将已确认产品决策转为实施约束，包括学号密码登录、邮箱验证码、站内通知、Excel 必做、确认即发布、默认工作日与默认班次、每周最高排班数规则、手动强排通知、助理端团队字段可见性、图片可选。

验证结果：

1. 用户已确认步骤 1.1 验证通过。
2. 按用户要求，在验证通过前未开始步骤 1.2。
3. 本次记录完成后，下一步应从 `implementation_plan.md` 的“步骤 1.2：建立技术追踪清单”开始。

遗留问题：

1. 当前尚未执行步骤 1.2。
2. 当前尚未创建任何小程序代码、云函数代码、配置或测试文件。
3. `architecture.md` 当前仅记录文档与原型职责，尚未记录实际工程文件职责。

### 已完成：实施计划步骤 1.2 建立技术追踪清单（旧 CloudBase 路线，已被后续路线变更取代）

执行内容：

1. 重新阅读了 `oriDocument` 目录下所有现有文档与 HTML 原型，并重点阅读 `progress.md` 确认步骤 1.1 已由用户验证通过。
2. 按 `implementation_plan.md` 的步骤 1.2 要求，基于 `tech_stack.md` 整理了技术实现追踪清单。
3. 当时技术追踪范围覆盖微信原生小程序、TypeScript、WXML、WXSS、WeUI、自定义组件、WXSS 设计 Token、CloudBase、云数据库、云函数、云存储和定时触发器。
4. 明确了账号体系与通知边界：学号 + 密码登录，邮箱仅用于密码验证码，小程序内站内通知为核心通知机制，不做微信一键登录和微信订阅消息。
5. 明确了后端与数据追踪范围：所有敏感业务逻辑由云函数校验，云数据库集合至少覆盖用户、学期、班次模板、空闲时间收集、填报、排班、换班、加班、通知、验证码、操作日志和系统设置。
6. 明确了排班算法、Excel 导出、分享页、可选图片生成、工程化、测试体系和开发顺序的技术约束。
7. 检查了现有 HTML 原型的技术特征：当前原型主要使用 Tailwind CDN、Material Symbols、静态 HTML 和少量内联脚本，后续只能作为视觉与交互参考，不能直接机械转译为小程序代码。

验证结果：

1. 用户已确认步骤 1.2 验证通过。
2. 按用户要求，在验证通过前未开始步骤 1.3。
3. 本次记录完成后，下一步应从 `implementation_plan.md` 的“步骤 1.3：抽取视觉设计 Token”开始。
4. 2026-05-17 用户确认技术路线改为微信原生小程序 + Node.js Express + TypeScript + 本地 MySQL + 后期腾讯云服务器和 COS；因此该旧技术追踪清单只保留历史参考，不再作为后续实施依据。

遗留问题：

1. 当前尚未执行步骤 1.3。
2. 当前尚未创建任何小程序代码、云函数代码、配置或测试文件。
3. 后续进入代码阶段前，仍必须完整阅读 `architecture.md` 和 `design_document.md`。

### 已完成：实施计划步骤 1.3 抽取视觉设计 Token

执行内容：

1. 重新阅读了 `oriDocument` 目录下所有现有文档与 HTML 原型，并重点阅读 `progress.md` 确认步骤 1.1 和 1.2 已由用户验证通过。
2. 按 `implementation_plan.md` 的步骤 1.3 要求，从 `DESIGN.md` 和全部 HTML 原型中抽取了小程序全局样式规范。
3. 视觉 Token 已覆盖 primary、secondary、tertiary、error、surface、outline、background、on-surface、on-surface-variant 等核心颜色。
4. 字体层级已覆盖 24px、20px、16px、14px、12px 和 10px 辅助文字，并记录了对应行高、字重和使用场景。
5. 间距规则已覆盖 8px 基准间距、16px 页面边距、12px 卡片间距、16px/20px/24px 卡片内边距、1px 网格分隔和底部安全区。
6. 组件视觉规则已覆盖顶部栏、底部导航、主按钮、卡片、状态标签、时间格子、日历格子、弹窗和输入框。
7. 明确后续 WXSS 设计系统应优先沉淀统一 Token 与组件类名，不能在每个页面散写不同视觉规则。

验证结果：

1. 用户已确认步骤 1.3 验证通过。
2. 按用户要求，在验证通过前未开始步骤 1.4。
3. 本次记录完成后，下一步应从 `implementation_plan.md` 的“步骤 1.4：分析 HTML 页面结构”开始。

遗留问题：

1. 当前尚未执行步骤 1.4。
2. 当前尚未创建任何小程序代码、云函数代码、配置或测试文件。
3. 后续进入代码阶段前，仍必须完整阅读 `architecture.md` 和 `design_document.md`。

### 已完成：实施计划步骤 1.4 分析 HTML 页面结构

执行内容：

1. 重新阅读了 `oriDocument` 目录下所有现有文档与 HTML 原型，并重点阅读 `progress.md` 确认步骤 1.1、1.2 和 1.3 已由用户验证通过。
2. 逐个检查了 `loginPage.html`、助理端四个页面和管理端五个页面，完成 HTML 原型到小程序页面的结构映射。
3. 已将 `loginPage.html` 映射为公共登录页；将助理端填报、日程、团队、个人页分别映射为助理端四个主页面；将管理端排班、日程、团队、个人设置、个人填报页映射为管理端页面。
4. 提炼出可复用结构，包括固定顶部栏、品牌登录顶栏、底部导航、主内容安全区、卡片容器、日历网格、班次卡、成员卡、搜索筛选栏、设置项、弹窗、悬浮操作按钮和底部主按钮。
5. 明确助理端与管理端应共用底层组件，并通过角色、权限和入口差异区分页面行为。
6. 明确 `assistanceMainPage.html` 与 `managerTimePage.html` 复用填报结构；`assistanceDutyPage.html` 与 `managerDutyPage.html` 复用日历和班次卡结构；`assistanceTeamPage.html` 与 `managerTeamPage.html` 复用团队列表结构；`assistanceMyPage.html` 与 `managerMyPage.html` 复用个人中心结构。

验证结果：

1. 用户已确认步骤 1.4 验证通过。
2. 按用户要求，在验证通过前未开始步骤 2.1。
3. 用户随后确认此前按 CloudBase 路线生成的 2.1 产物不作为有效进度记录，因为已与新技术路线冲突。

遗留问题：

1. 当前新的 `implementation_plan.md` 已改为自建后端路线，下一步应从新版“步骤 1.2：建立技术追踪清单”或用户指定的新步骤继续。
2. 此前按 CloudBase 路线生成的第 2.1 产物不计入有效完成步骤，后续如与新路线冲突应清理。
3. 后续进入代码阶段前，仍必须完整阅读 `architecture.md` 和 `design_document.md`。

### 已完成：技术路线重构文档更新

执行内容：

1. 根据用户在 2026-05-17 的确认，将技术路线从 CloudBase 改为微信原生小程序 + Node.js Express + TypeScript + 本地 MySQL。
2. 明确本地开发数据库为 `localhost:3306`，数据库名暂定为 `psych_scheduler`，后端通过 `server/.env` 管理连接信息。
3. 明确生产部署后置，后期使用腾讯云服务器本机 MySQL 和腾讯云 COS。
4. 明确正式登录使用微信 `openid`，测试阶段先使用 1 个管理员入口和多个助理入口的临时测试分流页。
5. 已更新 `tech_stack.md`、`implementation_plan.md` 和 `design_document.md` 中与新路线相关的内容。

验证结果：

1. 本次是文档路线更新，不代表新版实施计划任一开发步骤已完成。
2. 此前 CloudBase 版第 2.1 不记录为有效完成步骤。

遗留问题：

1. 后续真正进入开发前，应按新版实施计划从用户指定步骤开始。
2. 如项目根目录仍存在旧 CloudBase 路线产物，应在新版步骤 2.1 中识别并经用户确认后清理。
3. 后续实施过程中需要用户补充小程序 AppID、微信 AppSecret、MySQL 本地安装信息、腾讯云服务器信息、生产域名、HTTPS 和 COS 配置。

### 已完成：新版实施计划步骤 2.1 清理旧路线产物并建立三目录边界

执行内容：

1. 重新阅读了 `oriDocument` 目录下所有现有文档与 HTML 原型，并重点阅读 `progress.md` 确认当前已切换为微信原生小程序 + Express + MySQL 路线。
2. 检查项目根目录，确认不存在旧 CloudBase 路线产物：`cloudfunctions`、`cloudbase.env.example.json`、旧版根目录 `project.config.json`、`project.private.config.json`、根目录旧 `tsconfig.json` 均不存在。
3. 在项目根目录创建新版主目录 `miniprogram`、`server`、`sql`。
4. 未删除 `oriDocument` 中任何文档或 HTML 原型。

验证结果：

1. 用户已确认步骤 2.1 验证通过。
2. 本步骤完成时，项目根目录包含 `miniprogram`、`server`、`sql`。
3. 按用户要求，在验证通过前未开始步骤 2.2。
4. 用户随后指定继续执行步骤 2.2，并要求在验证步骤 2.2 前不要开始步骤 2.3。

遗留问题：

1. 当前尚未执行步骤 2.2。
2. 当前尚未初始化小程序前端工程文件。
3. 后续进入代码阶段前，仍必须完整阅读 `architecture.md` 和 `design_document.md`。

### 已完成：新版实施计划步骤 2.2 初始化微信原生小程序前端

执行内容：

1. 在项目根目录建立微信开发者工具项目配置，指定 `miniprogram/` 为小程序源码目录，并启用 TypeScript 编译插件。
2. 在 `miniprogram/` 中创建微信原生小程序最小骨架，包括 `app.json`、`app.ts`、`app.wxss`、`sitemap.json`。
3. 建立前端全局应用状态和开发期 API 基础地址配置，默认 API 地址为 `http://127.0.0.1:3000/api`。
4. 建立临时测试身份入口页 `pages/test-entry/index`，提供 1 个管理员测试入口和多个助理测试入口。
5. 修复微信开发者工具中页面正文不渲染的问题：将 WXML 中不被小程序解析的 HTML 实体文案改为由 TypeScript 数据注入。
6. 修复 TypeScript 配置中的弃用提示，确保当前前端 TypeScript 文件可通过类型检查。
7. 未实现任何真实业务页面、真实登录、后端请求、数据库逻辑或 2.3/2.4 后续能力。

验证结果：

1. 用户已确认步骤 2.2 验证通过。
2. 启动页为测试身份入口，并可在页面中选择管理员或助理测试身份。
3. 本地 TypeScript 类型检查已通过。
4. 按用户要求，在验证通过前未开始步骤 2.3。
5. 用户随后指定继续执行步骤 2.3，并要求在验证步骤 2.3 前不要开始步骤 2.4。

遗留问题：

1. 当前尚未执行步骤 2.3。
2. 当前后端目录中存在用户或工具先前生成的 `package.json`、`package-lock.json` 和 `node_modules`，执行步骤 2.3 时需要先检查其内容，再决定保留、修改或清理。
3. 当前尚未建立 MySQL `.env`、数据库连接模块或 SQL 脚本，这些属于步骤 2.4 及后续步骤。

### 已完成：新版实施计划步骤 2.3 初始化 Express TypeScript 后端

执行内容：

1. 检查了 `server` 目录中已有的 `package.json`、`package-lock.json` 和 `node_modules`，确认已有依赖包括 Express、CORS、dotenv、mysql2、TypeScript 和 ts-node-dev。
2. 保留已有依赖和锁文件，没有删除 `mysql2`；但本步骤未使用数据库连接，数据库能力留到步骤 2.4。
3. 在 `server/src` 中建立 Express TypeScript 后端最小骨架，包括应用入口、服务启动入口、路由入口、健康检查路由、统一错误类型、404 中间件和统一错误处理中间件。
4. 建立 `server/tsconfig.json`，让后端拥有独立于小程序前端的 TypeScript 配置。
5. 更新 `server/package.json`，添加 `dev`、`build`、`start`、`typecheck` 脚本。
6. 建立 `server/.env`，当前只包含 2.3 启动所需的 `NODE_ENV=development` 和 `PORT=3000`。
7. 建立 `server/.gitignore`，忽略 `.env`、`.env.*`、`dist` 和 `node_modules`。

验证结果：

1. 用户已确认步骤 2.3 验证通过。
2. `npm.cmd run typecheck` 已通过。
3. `npm.cmd run build` 已通过。
4. 启动后访问 `GET http://127.0.0.1:3000/api/health` 返回 `success: true` 和 `status: ok`。
5. 临时移走 `server/.env` 后启动后端，后端能输出清晰错误：缺少必需的 `server/.env` 文件。
6. 按用户要求，在验证通过前未开始步骤 2.4。
7. 用户随后指定继续执行步骤 2.4，并要求在验证步骤 2.4 前不要开始步骤 2.5。

遗留问题：

1. 当前尚未执行步骤 2.4。
2. 当前尚未建立 `.env.example`、MySQL 连接配置解析或数据库连接模块。
3. 当前尚未建立 SQL 脚本、建表脚本、种子数据或迁移记录目录，这些属于步骤 2.5 及后续步骤。
