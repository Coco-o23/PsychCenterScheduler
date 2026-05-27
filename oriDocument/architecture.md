# 架构与文件职责记�?
## 工作区约�?
1. 项目根目录为 `E:\C_life\CareerProject\shiftArangement`�?2. 所有后续小程序代码、后端代码、SQL、配置和测试文件都必须放在项目根目录下，不能放入 `oriDocument`�?3. `oriDocument` 是需求、设计、原型和开发记录目录。后续开发过程中，除非用户明确要求，只有 `architecture.md` �?`progress.md` 可以持续更新�?4. 写任何代码前必须完整阅读 `oriDocument/architecture.md` �?`oriDocument/design_document.md`�?5. 每完成重大功能或里程碑后，必须更新本文件，说明新增或修改文件的作用；同时更新 `progress.md` 记录完成步骤和验证状态�?
## 当前文档职责

### `oriDocument/implementation_plan.md`

程序设计实施计划，是后续 AI 开发者的主任务清单�?026-05-17 已按用户确认重写为微信原生小程序 + Node.js Express + MySQL 路线。此�?CloudBase 版第 2.1 不作为有效完成步骤。后续开发必须按用户指定步骤推进；自 3.3 验收通过后，执行节奏改为“阶段内小步骤可连续实施、阶段结束后统一验收”，但仍不得一次跨越多个大阶段连续开发�?
### `oriDocument/design_document.md`

产品设计与业务规则来源。包含产品目标、MVP 范围、已确认产品决策、角色权限、信息架构、核心流程、功能模块、数据对象、状态机和优先级�?026-05-17 已同步新身份体系：开发期测试身份分流，正式期微信 openid 登录。后续写代码前必须完整阅读此文件，业务行为以此文件为准�?
### `oriDocument/tech_stack.md`

技术栈与工程建议来源。当前确定微信原生小程序、TypeScript、WXSS、WeUI、Node.js Express、TypeScript 后端、本�?MySQL、`.env`、腾讯云服务器、腾讯云 COS、站内通知、Excel 导出和测试策略。旧 CloudBase 路线已废弃，后续技术实现不得再�?CloudBase、云数据库或云函数作为主实现方案�?
### `oriDocument/DESIGN.md`

视觉设计系统来源。定义颜色、字体、字号、圆角、间距、阴影、卡片、状态标签、日程网格、按钮和整体“现代企业极简”风格。步�?1.3 已基于此文件�?HTML 原型抽取小程序全局样式规范，后续视觉迁移和组件设计必须以此文件为基础�?
### `oriDocument/progress.md`

实施进度记录。用于记录已完成步骤、验证结果、下一步位置和遗留问题。当前已记录步骤 1.1、旧路线步骤 1.2、步�?1.3 和步�?1.4 完成且用户验证通过，并记录 2026-05-17 技术路线重构。后续按新版实施计划和用户指定步骤推进�?
### `oriDocument/architecture.md`

架构与文件职责记录，即本文件。用于说明当前文档和后续工程文件的作用。后续每新增或修改重要文件，都应在此补充对应职责�?
## HTML 原型职责

### `oriDocument/loginPage.html`

登录页移动端 HTML 原型。体现顶部品牌栏、登录表单、密码显示切换、忘记密码入口、联系管理员入口和整体登录页视觉。后续不再实现学号密码登录，该原型仅作为品牌、表单密度和入口视觉参考；开发期入口改为测试身份分流页，正式期入口改为微�?openid 识别�?
### `oriDocument/assistanceMainPage.html`

助理端填报页 HTML 原型。体现下周空闲时间填报、全周请假、每周最高排班数、设为默认空闲时间、时间格子、有�?没空状态、底部提交按钮和助理端底部导航�?
### `oriDocument/assistanceDutyPage.html`

助理端日程页 HTML 原型。体现月历、教学周、当日排班、未来值班、班次卡片和助理端底部导航。后续助理端日程只能展示本人相关排班�?
### `oriDocument/assistanceTeamPage.html`

助理端团队页 HTML 原型。体现团队概览、搜索筛选入口、成员卡片、查看更多和底部导航。后续实现需补齐产品决策中要求展示的性别、年级字段，并隐藏邮箱、可靠性标签和权限编辑能力�?
### `oriDocument/assistanceMyPage.html`

助理端个人中�?HTML 原型。体现个人信息、默认空闲时间编辑、通知提醒入口、账户安全、修改密码弹窗、退出登录和底部导航�?
### `oriDocument/managerMainPage.html`

管理端排班主�?HTML 原型。体现管理员身份信息、个人填报入口、空闲时间收集状态、发布收集、收集中进度、已完成状态、详情管理入口、生成排班表入口和管理端底部导航�?
### `oriDocument/managerDutyPage.html`

管理端日程页 HTML 原型。体现月历、教学周、无需值班开关、当日排班、未来排班和管理端底部导航。后续管理端可查看全部排班并设置未来日期是否需要值班�?
### `oriDocument/managerTeamPage.html`

管理端团队页 HTML 原型。体现团队概览、搜索筛选、成员列表、新增成员、编辑成员、删除成员、查看更多和管理端底部导航。后续需扩展认证审核、角色权限、敏感标签和防止取消最后一个管理员等规则�?
### `oriDocument/managerMyPage.html`

管理端个人与系统设置 HTML 原型。体现个人信息、默认空闲时间、工作日设置、默认班次设置、通知提醒、账户安全、修改密码和退出登录�?
### `oriDocument/managerTimePage.html`

管理端个人填报页 HTML 原型。体现管理端用户也可以填报本人空闲时间，结构接近助理端填报页，但导航回到管理端排班主页�?
## 当前架构洞察

1. 系统将分为公共入口、助理端、管理端三个前端区域，但底层组件应复用�?2. 正式身份以微�?`openid` 为准；开发期先使用临时测试身份分流页，包�?1 个管理员入口和多个助理入口�?3. 站内通知是核心通知机制，不接入微信订阅消息；邮箱验证码和密码登录不属于当前路线能力�?4. 排班确认和发布是同一个业务动作，排班状态应�?`draft -> published -> adjusted` 为主�?5. Excel 导出�?MVP 发布阻断项，图片生成是可选能力�?6. 现有 HTML 原型只作为视觉和交互参考，不能直接机械转译为小程序代码�?7. 技术实现必须保持微信原生小程序 + TypeScript + WXSS + WeUI + Node.js Express + TypeScript + MySQL 的主线，不引�?Vue、React、Taro、uni-app �?CloudBase 作为 MVP 主基座�?8. Express 后端是权限校验、身份识别、排班生成、状态流转、Excel 导出和操作日志的可信执行边界；前端只负责展示、输入和交互反馈�?9. MySQL 核心表应至少覆盖 `users`、`semesters`、`shift_templates`、`workday_overrides`、`availability_collections`、`availabilities`、`schedules`、`schedule_assignments`、`swap_requests`、`overtime_records`、`notifications`、`operation_logs`、`system_settings`、`exported_files`�?10. 视觉 Token 已从 `DESIGN.md` �?HTML 原型中抽取完成，后续 WXSS 全局样式应统一沉淀颜色、字号、行高、圆角、间距、阴影、卡片、状态标签、时间格子、底部导航、按钮和弹窗规则�?11. 颜色主线应以 `primary #005bbf`、`primary-container #1a73e8`、`secondary #006e2c`、`secondary-container #86f898`、`tertiary #9e4300`、`error #ba1a1a`、`surface/background #f9f9ff`、`surface-container-lowest #ffffff`、`outline-variant #c1c6d6`、`on-surface #191c23` 为基础�?12. 字体层级应覆�?24px/32px/700�?0px/28px/600�?6px/24px/400�?4px/20px/400�?2px/16px/500 �?10px 辅助文字；后续小程序可优先使用系统字体，但必须保持层级与行高节奏�?13. 布局节奏应遵�?8px 基准间距�?6px 页面边距�?2px 卡片间距�?0px �?54px 主按钮高度�?6px 顶部栏和�?64px 底部导航高度�?14. 组件视觉应保持现代企业极简风格：卡片使用白色背景�?2px 圆角和轻阴影；状态标签使用语义色；时间格子使用有空绿色、不可用中性白/灰、风险红/橙；底部导航选中态使用绿色胶囊�?15. HTML 原型结构分析已完成：登录页映射为公共入口；助理端映射为填报、日程、团队、个人四个主页面；管理端映射为排班、日程、团队、个�?系统设置和管理端个人填报页面�?16. 后续组件边界应优先抽�?`top-app-bar`、`brand-header`、`bottom-nav`、`page-shell`、`surface-card`、`status-chip`、`shift-slot`、`calendar-grid`、`duty-card`、`member-card`、`search-filter-bar`、`setting-row`、`modal-dialog`、`floating-action-button` �?`bottom-action-bar`�?17. 助理端和管理端应共享底层组件，差异通过角色、导航配置、权限控制和页面 service 数据源表达�?18. 新工程主目录应为 `miniprogram`、`server`、`sql`：小程序前端、Express 后端�?MySQL 脚本分别独立管理�?19. 本地开发数据库�?MySQL `localhost:3306`，数据库名暂�?`psych_scheduler`；连接信息必须通过 `server/.env` 管理，真实密码不得写入文档或仓库�?20. 生产部署放在后期，暂定腾讯云服务器本�?MySQL、PM2/Nginx/HTTPS 和腾讯云 COS�?21. 此前�?CloudBase 路线生成的工程文件不代表有效架构进度，后续如果与新版步骤冲突，应在新版步�?2.1 中经用户确认后清理�?22. �?2026-05-17 用户确认的新执行方式起，只有以下场景必须中途暂停并向用户确认：删除或覆盖已有文件、可能影响已有数据的数据库结构修改、改变既定技术路线或架构、处理敏感配置、需要用户手动配置外部环境、阶段验收失败且无法自行判断修复方向�?23. SQL 阶段边界已调整：阶段二的 SQL 工作负责目录结构、迁移编号、基础建表和种子执行方式；阶段四不再重复创建同一批基础表，而应以“验证与修正 MySQL 数据模型”为主�?24. 当前优先级已重新划分�?P0、P1、P2：P0 优先形成本地可演示闭环，P1 作为第二轮增强，P2 处理 openid、云部署和扩展能力�?25. 阶段四已确认采用“增量修正”而非重建策略：后续数据库结构增强应继续优先通过新迁移脚本追加字段、索引和约束，避免直接覆写已存在的基础表�?
## 当前工程目录职责

### `miniprogram/`

微信原生小程序前端目录。当前已由新版实施计划步�?2.2 初始化最小可编译前端骨架，用于后续存放小程序页面、组件、样式、请求封装、测试身份分流入口和前端全局状态�?
### `project.config.json`

微信开发者工具项目配置文件。指�?`miniprogram/` 为小程序源码目录，启�?TypeScript 编译插件，并记录当前本地小程�?AppID 配置。该文件不承载后端、数据库或云开发配置�?
### `project.private.config.json`

微信开发者工具本机偏好配置文件。仅用于本地开发工具偏好，不应承载业务配置或敏感信息。已移除曾经锁定�?`libVersion: 3.15.2`，避免微信开发者工具在基础库下载失败时反复触发模拟器初始化错误�?
### `tsconfig.json`

当前小程序前�?TypeScript 类型检查配置。覆�?`miniprogram/**/*.ts` �?`miniprogram/**/*.d.ts`，用于验证小程序前端 TypeScript 文件；后端在步骤 2.3 中应拥有独立�?`server/tsconfig.json`�?
### `miniprogram/app.json`

小程序全局页面与窗口配置。当前注�?`pages/test-entry/index`、`pages/style-lab/index`、`pages/component-lab/index` �?`pages/request-lab/index`，其�?`pages/test-entry/index` 仍为启动页，确保启动语义保持开发期测试身份入口。显式声�?`subPackages: []`，用于兼容微信开发者工具读取应用配置时对分包字段的脆弱处理。后续新增页面必须在此登记，但不得在用户验证对应阶段前改变启动页语义�?
### `miniprogram/app.ts`

小程序应用入口。初始化全局状态，并提供设置和清空测试身份、读取全局状态和局部更新全局状态的方法。当前仍不直接承载业务请求，但已成为前端请求层读取测试身份和运行时配置的入口�?
### `miniprogram/app.wxss`

小程序全局基础样式。当前已引入 `miniprogram/styles/tokens.wxss`，并让页面背景、默认文字颜色和字体族使用全局 Token；同时保留基础 box-sizing 和按�?reset�?
### `miniprogram/styles/`

小程序全局样式目录。用于存放设�?Token、跨页面视觉工具类和后续可复用样式基础，不承载具体业务页面样式�?
### `miniprogram/styles/tokens.wxss`

全局 WXSS 设计 Token。由新版实施计划步骤 3.1 落地，覆�?`DESIGN.md` 中的颜色、字号、行高、圆角、间距、阴影、卡片、状态标签、按钮、输入框和时间格子基础样式。后续页面和组件应优先复用这里的变量与类名，避免在页面内散写不一致的视觉规则�?
### `miniprogram/config/app-config.ts`

小程序前端运行配置。当前记录开发期 API 基础地址 `http://127.0.0.1:3000/api` 和环境标识；真实后端接口将在后续步骤接入�?
### `miniprogram/state/app-state.ts`

小程序全局状态模型和开发期测试身份数据。当前除 1 个管理员入口�?3 个助理入口外，还保存当前用户、角色、当前学期、当前收集任务和基础班次配置，供后续页面和请求层复用；正式身份体系后续改由后端识别微�?`openid`�?
### `miniprogram/types/wx.d.ts`

当前前端骨架所需的最小微信小程序类型声明。用于在未安装完整微信类型包前支�?TypeScript 检查，后续可在工程化完善时替换为官方或社区类型声明。步�?3.2 已补充最�?`Component` 类型、组件实�?`data`、`setData` �?`triggerEvent` 声明；步�?3.3 进一步补充了 `wx.request`、`wx.showLoading` �?`wx.hideLoading`，用于支持统一请求封装�?
### `miniprogram/pages/test-entry/`

开发期临时测试身份入口页。用于在本地开发和联调阶段选择管理员或助理身份；正式版本上线前应由微信 `openid` 自动识别身份后替代该入口�?
### `miniprogram/pages/style-lab/`

样式验收页面目录。由新版实施计划步骤 3.1 创建，用于展示全局设计 Token 在小程序中的实际效果，包括颜色、字体层级、卡片、状态标签、按钮、输入框和时间格子。该页面只用于视觉验收和开发参考，不承载正式业务流程�?
### `miniprogram/components/`

小程序基础组件目录。由新版实施计划步骤 3.2 建立，用于存放跨助理端和管理端复用的原生小程序组件。当前组件只负责视觉结构、基础交互事件和本地展示，不包含后端请求、权限判断或业务数据加载�?
### `miniprogram/components/app-top-bar/`

顶部栏组件。支持眉标、标题、副标题、返回按钮和右侧操作按钮，用于承�?HTML 原型中的固定顶部栏结构�?
### `miniprogram/components/bottom-nav/`

底部导航组件。支持四栏导航、当前项绿色选中态和点击事件。后续助理端与管理端应通过不同导航配置复用该组件�?
### `miniprogram/components/shift-card/`

班次卡片组件。展示班次时间、标题、地点、值班人员、状态标签和风险提示，是后续日程页、排班结果页和收集详情页的基础展示单元�?
### `miniprogram/components/time-slot/`

时间格子组件。支持有空、已选择、警告、中性和禁用状态，用于填报页、默认空闲时间设置和班次选择场景�?
### `miniprogram/components/status-chip/`

状态标签组件。支�?info、success、warning、error、neutral 语义色，用于收集状态、排班状态、风险状态、账号状态等短状态展示�?
### `miniprogram/components/member-card/`

成员卡片组件。展示头像字、姓名、学号、学院、性别、年级、班次数、角色标签和可选编辑入口。助理端和管理端可复用，但敏感字段展示应由后续页面和后端权限控制决定�?
### `miniprogram/components/state-view/`

状态反馈组件。用于空状态、加载状态和错误状态展示，可附带操作按钮。后续页面应优先使用该组件表达空列表、请求中和请求失败�?
### `miniprogram/components/confirm-dialog/`

确认弹窗组件。用于普通确认和危险确认场景，承接后续发布排班、删除成员、退出身份等二次确认交互�?
### `miniprogram/components/filter-panel/`

筛选面板组件。用于团队、排班、收集详情等列表筛选场景，支持分组筛选选项、重置和应用事件�?
### `miniprogram/components/primary-action-bar/`

底部主操作栏组件。用于提交填报、确认发布、保存设置等高频主操作，位置设计为底部导航上方，避免遮挡导航�?
### `miniprogram/pages/component-lab/`

基础组件验收页面。由新版实施计划步骤 3.2 创建，用于集中展示顶部栏、底部导航、班次卡片、时间格子、状态标签、成员卡片、空/加载/错误状态、确认弹窗、筛选面板和底部主操作栏。该页面只用于人工视觉和交互验收，不承载正式业务流程�?
### `miniprogram/services/`

前端服务层目录。由新版实施计划步骤 3.3 建立，用于存放请求封装、接口适配、开发期 mock 和后续页�?service。该目录是页面与后端 API 之间的统一边界，不应被业务页面绕过�?
### `miniprogram/services/request.ts`

前端统一请求封装。负责处理运行时 baseURL、测试身份请求头、加载态、错误提示�?01/403 权限失败、空数据归一化和统一响应结构。后续业务页面应优先通过这里发起请求，而不是散�?`wx.request`�?
### `miniprogram/services/request-mock.ts`

开发期请求场景模拟工具。用于在没有完整业务接口时模拟成功、空数据�?00�?01�?03�?00 和断网响应，并复用统一请求返回结构。主要服务于 3.3 的请求验收和后续联调前的页面状态开发�?
### `miniprogram/pages/request-lab/`

前端请求与状态验收页面。由新版实施计划步骤 3.3 创建，用于切换测试身份、模拟不同请求场景，并展示页面状态、请求头和统一响应结果。该页面只用于请求层和状态表达验收，不承载正式业务流程�?
### `server/`

Node.js Express TypeScript 后端目录。当前已由新版实施计划步�?2.3 初始�?Express TypeScript 最小骨架，后续用于存放控制器、服务层、权限中间件、数据库连接、测试和导出逻辑。步�?2.4 前不得提前实现数据库连接�?
### `server/package.json`

后端 npm 包配置。当前保留已�?Express、CORS、dotenv、mysql2、TypeScript、ts-node-dev 等依赖，并提�?`dev`、`build`、`start`、`typecheck` 脚本。当�?`mysql2` 依赖已安装但数据库连接模块留到步�?2.4 使用�?
### `server/package-lock.json`

后端 npm 锁文件。用于固定当前后端依赖版本，必须跟随 `server/package.json` 同步更新�?
### `server/.gitignore`

后端忽略规则。忽�?`node_modules/`、`dist/`、`.env`、`.env.*` �?npm 调试日志，并允许提交 `.env.example`，避免提交本地依赖、构建产物和敏感环境变量�?
### `server/.env`

后端本地运行环境文件。当前包�?`NODE_ENV`、`PORT`、`DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`，用于本�?Express �?MySQL 连接验证。该文件不应提交仓库�?
### `server/.env.example`

后端环境变量模板。包含本地开发默认端口、MySQL `localhost:3306` 和数据库�?`psych_scheduler` 的配置示例，不包含真实数据库密码或其他敏感信息�?
### `server/tsconfig.json`

后端 TypeScript 配置。限定源码根目录�?`server/src`，构建输出到 `server/dist`，启�?strict 类型检查，与根目录小程序前�?`tsconfig.json` 相互独立�?
### `server/src/server.ts`

Express 后端启动入口。读取环境配置、创�?Express 应用并监听端口；启动失败时输出清晰错误并退出�?
### `server/src/app.ts`

Express 应用组装入口。负责注�?CORS、JSON 解析、API 路由�?04 处理和统一错误处理�?
### `server/src/config/env.ts`

后端环境配置读取模块。当前校�?`server/.env` 是否存在，并读取 `NODE_ENV`、`PORT` �?MySQL 连接信息；缺失文件、缺失变量、非法端口或非法数据库端口会给出清晰错误�?
### `server/src/database/mysql.ts`

MySQL 连接模块。使�?`mysql2/promise` 根据 `.env` 中的数据库配置创建连接池，提供数据库连通性检查和关闭连接池方法。当前只负责连接验证，不包含表结构或业务查询�?
### `server/src/routes/index.ts`

后端 API 路由入口。当前挂载健康检查路由，后续业务模块路由应从这里统一接入�?
### `server/src/routes/health.ts`

健康检查路由。当前提�?`GET /api/health` 用于确认 Express 服务启动成功，并提供 `GET /api/health/database` 用于检查本�?MySQL 连接；数据库连接失败时返回明确错误和非敏感连接摘要�?
### `server/src/errors/app-error.ts`

后端统一应用错误类型。用于携�?HTTP 状态码、业务错误码、错误消息和可选详情�?
### `server/src/middleware/not-found.ts`

404 中间件。未匹配路由时生成统一�?`ROUTE_NOT_FOUND` 错误�?
### `server/src/middleware/error-handler.ts`

统一错误响应中间件。将业务错误和未知错误转为统一 JSON 响应格式�?
### `sql/`

MySQL 脚本目录。当前由新版实施计划步骤 2.5 建立脚本组织方式，用于存放脚本说明、建表迁移脚本、种子数据脚本和迁移记录说明。后�?SQL 文件必须继续使用顺序编号命名，便�?AI 开发者和用户按顺序执行�?
### `sql/README.md`

SQL 脚本执行说明。记录本�?MySQL `psych_scheduler` 数据库的推荐执行顺序、重复执行策略和测试数据检查方式。后续新增迁移或种子脚本时，应同步更新此说明�?
### `sql/migrations/`

数据库结构迁移脚本目录。用于存放按顺序编号的结构变更脚本。后续结构变更不得直接混入种子数据脚本�?
### `sql/migrations/001_create_core_tables.sql`

核心建表迁移脚本。负责创�?`psych_scheduler` 数据库、`schema_migrations` 表和当前阶段的核心业务表，包�?`users`、`semesters`、`system_settings`、`shift_templates`、`workday_overrides`、`availability_collections`、`availabilities`、`schedules`、`schedule_assignments`、`swap_requests`、`overtime_records`、`notifications`、`operation_logs`、`exported_files`。脚本显式使�?`utf8mb4`，并通过 `CREATE TABLE IF NOT EXISTS` �?`schema_migrations` 提供可重复执行的基础策略�?
### `sql/migrations/002_refine_core_query_support.sql`

阶段四的增量修正迁移脚本。通过 `information_schema` 检查后再追加字段和索引，为 `availability_collections` 补充标题、管理员周上限快照和备注字段，为 `availabilities` 补充提交时间，并为收集、填报、排班、换班、加班、通知和导出相关读写路径增加查询索引。该脚本不重建已有基础表�?
### `sql/seeds/`

种子数据脚本目录。用于存放开发和本地测试所需的固定测试数据。种子脚本不写入 `schema_migrations`，因�?`schema_migrations` 只代表结构迁移版本，不代表种子脚本执行历史�?
### `sql/seeds/001_seed_test_users.sql`

测试身份与基础配置种子脚本。负责写�?1 个管理员测试身份�? 个助理测试身份、默认上�?下午班次和基础系统设置。脚本使用唯一键与 `ON DUPLICATE KEY UPDATE`，重复执行时更新固定测试数据，不生成重复脏数据；同时显式设置 `utf8mb4` 并兼容修�?`users` 表的常用文本字段长度�?
### `sql/seeds/002_seed_stage4_validation_data.sql`

阶段四验证种子脚本。负责写�?disabled 助理、未绑定 openid 用户、当前学期、工作日覆盖、pending/active/completed 收集任务、availabilities、draft 排班、swap request、approved overtime、notification、operation log �?exported file 等验证数据。脚本采用幂等写法，用于支撑阶段四数据模型验证和阶段�?API 开发前的联调数据准备�?
### `sql/migration_records/`

迁移记录说明目录。当前不承载真实迁移状态，真实结构迁移状态存放在数据库内�?`schema_migrations` 表中�?
### `sql/migration_records/README.md`

迁移记录说明文件。解�?`schema_migrations` 表的职责，以及为什么种子脚本执行不会出现在迁移记录中�?
## 2026-05-17 阶段五新增职责补�?
### `server/src/models/user.ts`

后端用户领域模型定义文件。统一约束用户角色、账号状态、成员类型，以及团队列表接口返回的助理端与管理端数据结构，供认证、团队和权限层共享�?
### `server/src/repositories/user-repository.ts`

用户数据访问层。负责按测试身份 key 查询用户，以及分别生成助理端脱敏团队列表和管理端完整团队列表，是阶段五认证与团队基础 API 的数据库读取边界�?
### `server/src/repositories/operation-log-repository.ts`

操作日志数据访问层。负责把关键管理操作与失败尝试写�?`operation_logs`，供权限守卫和后续业务服务复用�?
### `server/src/services/auth-service.ts`

认证服务层。封装测试身份登录、测试身份查人、账号状态检查和可访问区域判定，避免路由层直接拼接认证逻辑�?
### `server/src/services/operation-log-service.ts`

操作日志服务层。对路由和中间件暴露统一日志写入方法，保证日志字段结构、成功失败标记和细节信息写入方式一致�?
### `server/src/middleware/auth.ts`

统一认证与权限守卫中间件。负责解�?`X-Test-Identity`、在开发环境识别测试身份、拦�?disabled 用户、限制管理员接口角色访问，并在助理误访管理端接口时写失败日志�?
### `server/src/utils/validation.ts`

后端输入校验工具集。负责对象体、非空字符串、日期和数值等基础校验，供阶段五及后续业务 API 统一复用�?
### `server/src/utils/async-handler.ts`

异步路由包装工具。负责把 async 路由中的异常统一交给错误处理中间件，减少重复 try/catch�?
### `server/src/utils/api-response.ts`

统一成功响应工具。负责输出结构一致的 `success/data/message` 响应体，便于前端请求封装稳定解析�?
### `server/src/routes/auth.ts`

阶段五认证路由。提供开发环境测试登录接�?`POST /api/auth/test-login` 和会话接�?`GET /api/auth/session`，用于前端测试分流页和后续页面守卫获取当前用户会话�?
### `server/src/routes/team.ts`

阶段五团队基础路由。提�?`GET /api/team/members`，并按调用角色返回助理端脱敏成员列表或管理端完整成员列表，是后续团队页的最小数据入口�?
### `server/src/routes/admin.ts`

阶段五管理端基础权限路由。当前承载管理员会话校验接口与收集发布预检接口，同时作为后续排班主页、收集发布和管理操作 API 的扩展入口�?
### `server/src/routes/index.ts`

后端总路由入口。当前除健康检查外，还统一挂载 `auth`、`team` �?`admin` 业务路由，成为阶段五后的正式 API 组装边界�?## 2026-05-17 阶段六新增职责补�?### `miniprogram/services/auth.ts`

前端测试登录服务封装。负责调�?`POST /api/auth/test-login` �?`GET /api/auth/session`，把测试身份选择页从本地假数据切换为真实后端测试登录结果，是阶段六前后端联调的直接入口�?### `miniprogram/utils/route-guard.ts`

前端页面访问守卫工具。负责检查当前全局用户、账号状态和允许角色，在未选身份、账号停用和角色不匹配场景下执行回退、拦截或重定向，用于保护管理端与助理端落脚页�?### `miniprogram/pages/admin-main/`

管理端排班首页壳页。承接阶段六的管理员角色落脚点，展示当前学期与收集任务摘要，提供“本人填报”入口，并作为后续排班主页面能力的继续扩展位置�?### `miniprogram/pages/assistant-main/`

助理端填报首页壳页。承接阶段六的助理角色落脚点，展示当前学期、收集任务和填报预览区域，并作为后续真实空闲时间填报页的主要扩展位置�?### `miniprogram/pages/test-entry/`

开发期测试身份分流页。阶段六后不再只写入本地测试身份，而是直接请求后端测试登录接口并按返回结果切换到对应角色落脚页，同时负责处理停用账号和登录失败反馈�?### `miniprogram/state/app-state.ts`

前端全局状态模型。除测试身份、当前用户和基础配置外，阶段六补充了停用测试身份场景，使页面守卫和落脚页可以共享账号状态判断�?## 2026-05-17 阶段七新增职责补�?### `server/src/repositories/notification-repository.ts`

站内通知写入仓储。负责把成员权限变化、账号状态变化和管理端关键成员维护动作写�?`notifications`，为后续首页提醒与通知列表提供基础数据来源�?
### `server/src/routes/admin.ts`

阶段七后扩展为管理端团队成员管理主路由。除原有会话校验和收集预览接口外，还承载团队成员列表、成员创建、成员更新、成员删除，以及最后一�?active 管理员保护逻辑，是后续管理端人员维护能力的核心入口�?
### `server/src/repositories/user-repository.ts`

用户与团队数据访问层。除测试身份查找外，阶段七补充了管理端筛选查询、单成员读取、成员创�?更新/删除、管理员计数保护和团队汇总统计，供团队页与后续个人页、排班页复用�?
### `miniprogram/services/team.ts`

前端团队接口封装。统一管理助理端团队列表、管理端团队列表、成员创建、成员更新和成员删除请求，是团队页与后续成员配置页访问团队数据的唯一入口�?
### `miniprogram/styles/team-page.wxss`

团队页共享样式文件。沉淀了团队概览卡、搜索栏、筛选面板、成员名片、浮动管理按钮、弹窗和底部留白规则，供 `admin-team` �?`assistant-team` 两个页面共用，并作为后续其他“卡片式列表页”的样式参考�?
### `miniprogram/pages/admin-team/`

管理端团队页。负责展示团队统计、搜索筛选结果、成员详情展开、进�?退出管理模式、新增成员、编辑成员、删除成员和成员信息维护反馈；阶段七后也是当前项目里最完整的管理型小程序页面之一�?
### `miniprogram/pages/assistant-team/`

助理端团队页。与管理端保持一致的视觉骨架，但仅提供只读团队浏览、搜索和成员类型筛选，不暴露编辑和删除能力，用于保证双端风格统一同时保持权限边界�?
### `miniprogram/components/bottom-nav/index.wxss`

底部导航样式。阶段七配合团队页滚动和浮动按钮需求，进一步固定为页面沉底且持续可见的导航条，后续个人页、排班页和日程页应继续沿用这一导航行为�?## 2026-05-17 闃舵鍏柊澧炶亴璐ｈˉ鍏?
### `server/src/models/configuration.ts`

绯荤粺閰嶇疆涓庝釜浜洪〉閰嶇疆棰嗗煙妯″瀷銆傞樁娈靛叓鎵╁睍浜嗗鏈熼厤缃€佸伐浣滄棩涓庣彮娆￠厤缃€佺壒娈婃棩鏈熷拰榛樿绌洪棽鏃堕棿鐨勬暟鎹粨鏋勶紝渚涗釜浜洪〉銆佺郴缁熻缃拰鍚庣画鏀堕泦鍙戝竷閫昏緫鍏变韩銆?
### `server/src/repositories/configuration-repository.ts`

绯荤粺閰嶇疆涓庨粯璁ょ┖闂叉椂闂存暟鎹闂眰銆傞櫎鍘熸湁瀛︽湡鍜屽伐浣滄棩閰嶇疆璇诲啓澶栵紝闃舵鍏ˉ鍏呬簡鎸夌敤鎴蜂繚瀛橀粯璁ょ┖闂叉椂闂淬€佽鍙栭粯璁ょ┖闂叉椂闂村洖鏄俱€佷互鍙婂吋瀹瑰綋鍓嶇彮娆＄粨鏋勭殑榛樿鍊肩敓鎴愰€昏緫銆?
### `server/src/routes/profile.ts`

涓汉椤靛悗绔帴鍙ｃ€傝礋璐旇繑鍥炲綋鍓嶇敤鎴蜂釜浜洪〉鎬昏銆侀粯璁ょ┖闂叉椂闂淬€佸綋鍓嶅伐浣滄棩鍜岀彮娆＄粨鏋勶紝骞舵彁渚涢粯璁ょ┖闂叉椂闂翠繚瀛樻帴鍙ｏ紝鏄鐞嗙涓庡姪鐞嗙涓汉椤靛叡浜殑鏁版嵁鍏ュ彛銆?
### `server/src/routes/admin-configuration.ts`

绠＄悊绔郴缁熼厤缃帴鍙ｃ€傞樁娈靛叓鎵胯浇瀛︽湡璁剧疆銆佸伐浣滄棩璁剧疆銆侀粯璁ょ彮娆¤缃拰鐗规畩鏃ユ湡閰嶇疆锛屾槸鍚庣画鏀堕泦鍙戝竷銆佹暀瀛﹀懆灞曠ず鍜屾帓鐝鍒欒鍙栫殑鍩虹閰嶇疆杈圭晫銆?
### `miniprogram/services/profile.ts`

涓汉椤典笌绯荤粺閰嶇疆鍓嶇鏈嶅姟灏佽銆傜粺涓€绠＄悊涓汉椤垫€昏銆侀粯璁ょ┖闂叉椂闂翠繚瀛樸€佸鏈熼厤缃繚瀛樺拰宸ヤ綔璁剧疆淇濆瓨璇锋眰锛屼緵绠＄悊绔釜浜洪〉銆佸姪鐞嗙涓汉椤典互鍙婂悗缁富椤甸潰璇诲彇閰嶇疆澶嶇敤銆?
### `miniprogram/styles/profile-page.wxss`

涓汉椤靛叡浜牱寮忔枃浠躲€傛矇娣€绠＄悊绔笌鍔╃悊绔釜浜洪〉鐨勮祫鏂欏崱銆侀粯璁ょ┖闂叉椂闂寸綉鏍笺€佽缃銆佸脊绐椼€佺彮娆＄紪杈戝尯鍜屽伐浣滄棩閫夐」鏍峰紡锛屾槸闃舵鍏悗涓汉椤电浉鍏崇晫闈㈢殑缁熶竴瑙嗚鍩虹�?
### `miniprogram/pages/admin-profile/`

绠＄悊绔釜浜洪〉銆傚熀�?`managerMyPage.html` 鐨勬帓甯冨疄鐜颁釜浜鸿祫鏂欍€侀粯璁ょ┖闂叉椂闂淬€佸鏈熻缃€佹瘡鍛ㄥ伐浣滄椂闂淬€侀粯璁ょ彮娆″拰鐗规畩鏃ユ湡閰嶇疆锛涢樁娈靛叓鍚庝篃鏄郴缁熺骇閰嶇疆鐨勪富瑕佸墠绔叆鍙ｄ箣涓€銆?
### `miniprogram/pages/assistant-profile/`

鍔╃悊绔釜浜洪〉銆傚熀�?`assistanceMyPage.html` 鐨勬帓甯冨疄鐜颁釜浜鸿祫鏂欏拰榛樿绌洪棽鏃堕棿缁存姢锛涙寜闃舵鍏渶缁堝彛寰勶紝涓嶅睍绀虹郴缁熶晶鎺掔彮瑕佹眰閰嶇疆锛屼粎淇濈暀涓庡姪鐞嗘湰浜烘湁鍏崇殑榛樿绌洪棽鏃堕棿鑳藉姏�?
### `miniprogram/pages/admin-main/`

绠＄悊绔帓鐝富椤靛３椤点€傞樁娈靛叓鍚庣户缁綔涓洪樁娈典節涓婚〉闈㈢殑鎵挎帴鐐癸紝鍚庣画灏嗗湪姝ら〉闈㈠疄鐜版敹闆嗙姸鎬併€佸彂甯冩敹闆嗐€佽繘搴︿紶杈惧拰杩涘叆鏀堕泦璇︽儏鐨勫叆鍙ｃ�?
### `miniprogram/pages/assistant-main/`

鍔╃悊绔～鎶ヤ富椤靛３椤点€傞樁娈靛叓鍚庣户缁綔涓洪樁娈典節鍔╃悊濉姤椤甸潰鐨勬壙鎺ョ偣锛屽悗缁皢鍦ㄦ椤甸潰瀹炵幇涓€鍛ㄦ椂闂存牸瀛愬～鎶ャ€佸叏鍛ㄨ鍋囥€佹瘡鍛ㄤ笂闄愰€夋嫨鍜岄粯璁ょ┖闂叉椂闂村啓鍥炲叆鍙ｃ€?

## 2026-05-19 �׶ξŲ���ְ��
### `server/src/models/availability.ts`
�׶ξ��ռ��������ģ�Ͷ����ļ���ͳһԼ���������Ű���ҳ��������ǰ�ռ��ҳ���ռ�����ҳ�����ձ�ǩ����ԱԤ�����ֶ����ų�Ա������������ݽṹ����·�ɡ��ִ���ǰ�˷���㹲�á�
### `server/src/repositories/availability-repository.ts`
�׶ξ��ռ�����������ݷ��ʲ㡣�����ȡ��ǰѧ���ռ����񡢷��������ռ��������û�����ʱ���ύ��ͬ�� `availability_collections` ��Ӧ�/������������ɹ�������ҳ�����δ������������ռ�����ҳ����������ͼ��֧���ֶ���ɾ���ų�Ա�������Ŷӳ�Ա�䶯��ͬ���ѷ����ռ��Ĳ�������ͳ�ơ�
### `server/src/routes/availability.ts`
�׶ξ�������������˱����·�ɡ�����¶��ǰ�û���ǰ�ռ������ȡ���ύ�ӿڣ�ͳһ��������У�顢����У����ɹ���Ӧ�ṹ��
### `miniprogram/services/availability.ts`
�׶ξ�ǰ���ռ��������㡣ͳһ��װ�������Ű���ҳ�������ռ��������˵�ǰ�����ȡ���ύ���ռ������ȡ���ֶ���ɾ���ų�Ա�ӿڣ���Ϊ `admin-main`��`assistant-main` �� `admin-collection-detail` ��Ψһҵ��������ڡ�
### `miniprogram/pages/admin-main/`
�׶ξŹ������Ű���ҳ������չʾ��ǰ�ռ�״̬��Ӧ����������������δ�������������������ܰ�νṹ�������ռ���ڡ����������ں͹����˱������ڣ�����ģ��֧��ԭ���۵�չ���������˷��ص�����������������һ�¡�
### `miniprogram/pages/assistant-main/`
�׶ξ��������ҳ��ͬʱҲ�ǹ����ˡ������������ҳ������չʾ��ɫ�ռ�ͷͼ����һ�����ύ�۵���������������١�����Ű���ѡ�񡢱���ΪĬ�Ͽ���ʱ�俪�ء�һ��ʱ������ύ��ť�������ύ�󱣳ָ���״̬���˱�����һ�¡�
### `miniprogram/pages/admin-collection-detail/`
�׶ξŹ������ռ�����ҳ�������������β鿴��ǰ���ų�Ա����ʾ `���˿���`/`��������` ���ա�֧���ֶ����ӳ�Ա���Ƴ���Ա�������ֳ�Ա��ǩ��״̬оƬ�Ŀɶ����Ű档
### `miniprogram/styles/collection-page.wxss`
�׶ξ��ռ����ҳ�湲����ʽ�ļ��������������Ű���ҳ���������ҳ���ռ�����ҳ����ɫͷͼ���ռ����ȿ����۵��������ء�ʱ��񡢵ײ��ύ��������оƬ����Ա��ǩ�����鲼�ֹ���
### `miniprogram/pages/test-entry/`
�ڽ׶ξ������ڼ䲹�����ֶ����� `testIdentityKey` �Ĳ�����ڣ�֧�ֽ���������Ա��Ӧ�Ĳ�������ҳ�棬�����е����������ݷ���ְ��
### `miniprogram/pages/admin-team/`
�ڽ׶ξ������ڼ䲹�����ռ�ϵͳ�����Ĺ�����������������ģʽ�±�����Ա��չ��/������ڣ�ɾ��ȷ�ϵ����㼶���ڱ༭��Ա����������ȷ��ɾ����ͬʱ�ر���ص��㣬�����������
## 2026-05-20 �׶�ʮ����ְ�𲹳�
### server/src/services/schedule-planner.ts
�׶�ʮ�Ű����ɺ��ķ��񡣸�����ռ����顢��κͺ�ѡ��Ա����Ϊ ShiftSlot��CandidateUser��AssignmentPlan������ϡȱ����������Ի�����һ�����ɸ������ȡ���Ա���ȡ��������������Ű෽������������ձ�ǩ��ժҪ���Ƽ�������
### server/src/services/schedule-planner.test-cases.ts
�׶�ʮ�Ű��㷨���������ļ������и�����Ա���㡢��Ա���㡢��������ϡȱ�����˰����ȡ���������������ֵ�ࡢ��Ա������������Ȳ���ȵ����㷨�����������˹��˶�������Զ���������չ��
### server/src/repositories/schedule-repository.ts
�׶�ʮ�Ű๤��̨�������ݷ��ʲ㡣�����ȡ�Ű๤��̨�������Ű���򡢵����Ű�滮�������ɶ෽���ݸ塢�ֶ���ɾ��γ�Ա��ȷ�Ϸ���ѡ�еķ�������ͳһ�����Ű����ڸ�ʽ�������ժҪ�־û���
### server/src/routes/admin-schedule.ts
�׶�ʮ�������Ű���·�ɡ��ṩ�Ű๤��̨��ȡ�����򱣴桢�����Ű෽�����˹�������Ա��ȷ�Ϸ����ӿڣ��ǹ������Ű���ҳ���˵�Ψһ������ڡ�
### miniprogram/services/schedule.ts
�׶�ʮǰ���Ű����㡣ͳһ��װ�������Ű๤��̨��ȡ���Ű���򱣴桢�Ű�ݸ����ɡ��ֶ���ɾ��Ա��ȷ�Ϸ����ӿڣ��� dmin-main �� dmin-schedule ҳ�渴�á�
### miniprogram/pages/admin-schedule/
�׶�ʮ�������Ű���ҳ������չʾ�����Ű෽����ժҪ��Ƭ�������ںͰ�η�����Ű��������ձ�ǩ����ѡ��Ա�������˹���ɾ��Ա��ȷ�Ϸ����������ǽ׶�ʮ�Ű�ջ���ǰ����ҳ�档
### miniprogram/pages/admin-main/
�׶�ʮ������е��������Ű���ҳְ�𣬲������������Ű������ʵ��ת��ڣ�ʹ�ռ���ɺ�Ĺ������̴���ҳ�����Ű���ҳ��������ͣ���ڽ׶ξŵ�ռλ��ʾ��## 2026-05-21 �׶�ʮһ����ְ�𲹳�
### `server/src/models/duty.ts`
�׶�ʮһ�ճ̡����ࡢ�Ӱ���ͳ������ģ�Ͷ����ļ���ͳһԼ����������������ճ�������������Ԫ�񡢵����Űࡢδ���Űࡢ�¶�ͳ�ơ�����ֵ�࿪�أ��Լ�����/�Ӱ����״̬�ṹ����·�ɡ��ִ���ǰ�˷���㹲�á�
### `server/src/repositories/duty-repository.ts`
�׶�ʮһ�ճ�����������ݷ��ʲ㡣�����ȡ��������������ճ��������ۺ��������ѧ�����ݡ�ά�� `no_shift` ��ǡ�����������ֵ�ࡱ������ĵ����Ű�ʧЧ�������¶Ȱ���빤ʱͳ�ƣ����ṩ�����޸��ű����������Ű�ָ�������Դ��
### `server/src/routes/duty.ts`
�׶�ʮһ�������ճ�·�ɡ�����¶�������ճ�������ȡ�ӿڣ�ͳһ��������У�顢����У����ɹ���Ӧ�ṹ��ȷ�������˽��ܿ����뱾����ص��ѷ���/�ѵ����Űࡣ
### `server/src/routes/admin-duty.ts`
�׶�ʮһ�������ճ�·�ɡ�����¶�������ճ�����������ֵ�࿪�صȽӿڣ��ǹ����������鿴��δ������ֵ����Ƶ�Ψһ�����ڡ�
### `miniprogram/services/duty.ts`
�׶�ʮһǰ���ճ̷���㡣ͳһ��װ��������������ճ�����������ֵ���л�������/�Ӱ����������ڣ��� `assistant-duty` �� `admin-duty` ҳ�渴�á�
### `miniprogram/pages/assistant-duty/`
�׶�ʮһ�������ճ�ҳ������չʾ������������ѧ�ܡ����հ�Ρ�δ����Ρ�������Ӱ���ڣ���������������ֱ��ʹ�ú�˷��ص���ʵ���������ڱ�ǩ��
### `miniprogram/pages/admin-duty/`
�׶�ʮһ�������ճ�ҳ������չʾ����ֵ������������ֵ�࿪�ء������Űࡢδ���Ű����¶�ͳ�ƣ���֧�ֹ���Ա��δ���������á�����ֵ�ࡱ�Լ��鿴���ú��ʵ���Ű�����
### `miniprogram/styles/duty-page.wxss`
�׶�ʮһ�ճ����ҳ�湲����ʽ�ļ����������������������ճ�ҳ����������ͳ�ƿ�Ƭ������ֵ�࿪�������Ű࿨Ƭ��δ���ճ��б����ֹ���
### `server/scripts/repair-current-collection-dates.js`
�׶�ʮһ���ھ�ƫ�ű��������ڽ�ѧ����ʼ����������������ֻ��Ե�ǰ��Ӱ�� collection ��鲢�޸������ `week_start_date`��`week_end_date` ������Ű����ڡ�
### `server/scripts/repair-no-shift-day-assignments.js`
�׶�ʮһ�����Ű�ָ��ű��������ڹ���Ա��ĳ������Ϊ������ֵ�ࡱ����յ����Ű�󣬰�ָ�����ڴ� `schedules.risk_summary` ����ѡ��������ȱʧ�� `schedule_assignments`��
## 2026-05-22 阶段十三补充职责
### `server/src/routes/schedule-share.ts`
阶段 13.2 排班分享只读路由。负责暴露 `GET /api/schedule-share/collections/:collectionId`，在开发期沿用测试身份鉴权，并把当前用户身份传给分享仓储层，以便按角色返回完整排班或仅本人相关班次。
### `server/src/routes/index.ts`
后端总路由入口在阶段 13.2 挂载 `schedule-share` 路由，使分享页成为独立于管理端工作台的只读访问入口。
### `server/src/repositories/schedule-repository.ts`
阶段十的排班仓储在阶段 13.2 继续承担分享数据组装职责：新增 published 排班分享 payload 构造逻辑，基于已发布的 schedule_assignments 生成按日期分组的分享视图，并按角色过滤可见成员范围。
### `miniprogram/services/schedule.ts`
阶段十前端排班服务层在阶段 13.2 补充分享页类型与 `fetchScheduleShare` 请求方法，统一封装分享页所需的只读排班数据获取能力。
### `miniprogram/pages/schedule-share/`
阶段 13.2 小程序内排班分享页。负责展示已发布排班的周次、发布时间、权限范围说明，以及按日期和班次分组的成员列表；管理员可查看完整排班，助理仅查看本人相关班次。
### `miniprogram/pages/admin-schedule/`
阶段十管理端排班结果页在阶段 13.2 新增“微信分享”入口，仅在 published 状态下显示，并通过 `onShareAppMessage` 把分享路径指向新的排班分享页；原有 Excel 导出入口继续保留。
### `miniprogram/app.json`
小程序页面注册表在阶段 13.2 新增 `pages/schedule-share/index`，使分享路径可以被小程序直接打开。

## 2026-05-22 �׶�ʮ������ְ�𲹳�
### `server/src/repositories/notification-repository.ts`
�׶�ʮ��֪ͨ�ִ���ԭ��д������֮�⣬������֪ͨ�б���ȡ��δ�������͵����Ѷ��־û�������Ϊ֪ͨ����ҳ��͸���ҳδ�������ṩͳһ������Դ��
### `server/src/routes/notifications.ts`
�׶�ʮ��վ��֪ͨ·�ɡ�����¶֪ͨ�б���ȡ�͵�������Ѷ��ӿڣ�������ǰ��¼��ɫΪ��֪ͬͨ���ͼ���ҳ����תĿ�ꡣ
### `server/src/routes/profile.ts`
����ҳ����·���ڽ׶�ʮ�Ĳ��� `unreadNotificationCount` �����ֶΣ�ʹ������������˸���ҳ����ֱ��չʾδ��֪ͨժҪ��
### `miniprogram/services/notification.ts`
�׶�ʮ��ǰ��֪ͨ����㡣ͳһ��װ֪ͨ�б���ȡ�뵥������Ѷ����󣬹�֪ͨ����ҳ�渴�á�
### `miniprogram/pages/notifications/`
�׶�ʮ��������С����֪ͨ����ҳ�档����չʾ֪ͨ�б���δ��״̬��ˢ�¶������Լ����֪ͨ�����Ѷ�����ת����Ӧҵ��ҳ�档
### `miniprogram/pages/admin-profile/`
�����˸���ҳ�ڽ׶�ʮ�Ľ���վ��֪ͨ����ռλ��ڽ�Ϊ��ʵ��ڣ�����ʾδ��֪ͨժҪ��
### `miniprogram/pages/assistant-profile/`
�����˸���ҳ�ڽ׶�ʮ�Ľ���վ��֪ͨ����ռλ��ڽ�Ϊ��ʵ��ڣ�����ʾδ��֪ͨժҪ��
### `miniprogram/services/profile.ts`
����ҳ����ģ���ڽ׶�ʮ�Ĳ��� `unreadNotificationCount` �ֶΣ��нӺ�˷��ص�δ��������Ϣ��
### `miniprogram/app.json`
С����ҳ��ע����ڽ׶�ʮ������ `pages/notifications/index`��ʹ֪ͨ���Ŀɱ�ҳ�����ֱ�Ӵ򿪡�

## 2026-05-25 阶段十四职责补充
### `server/src/routes/admin.ts`
阶段十四 14.2 在管理端主路由补齐关键业务通知触发：收集重新发布时再次通知全体助理重新填写；手动补充成员进入可值班名单时发送定向提醒；成员账号从 `pending` 审核到 `active/rejected` 时发送明确的认证通过/驳回通知，而不是继续沿用泛化的权限调整文案。
### `server/src/routes/admin-schedule.ts`
阶段十四 14.2 在管理端排班结果路由优化手动安排通知文案：当管理员手动把成员加入班次时，提醒成员这可能与原填报空闲时间不一致，需要及时确认，承接“手动安排到非空闲时间”的通知语义。

## 2026-05-25 阶段十七职责补充
### `server/src/middleware/auth.ts`
阶段十七起步检查确认当前鉴权链仍完全依赖开发期 `x-test-identity` 头：生产环境会主动拒绝测试身份头，并提示“Use the future openid login flow”。这说明正式 openid 登录尚未落地，但后端已预留切换边界。
### `server/src/routes/auth.ts`
当前认证路由只提供 `/api/auth/test-login` 与 `/api/auth/session`，说明正式 openid 登录接口（接收 `wx.login` code、向微信换取 openid、绑定用户并返回会话）尚未开始实现。
### `project.config.json`
阶段十七起步检查确认当前小程序 AppID 已存在，为 `wx69a301880d878bdf`，可作为后续微信登录接入的已知前置条件之一。
### `server/.env.example`
阶段十七起步检查确认当前环境变量模板仅包含 Node 和 MySQL 配置，尚未声明 `WECHAT_APP_ID`、`WECHAT_APP_SECRET`、登录回调域名等正式 openid 登录所需配置。
### `miniprogram/config/app-config.ts`
阶段十七起步检查确认当前前端 API 基础地址仍为本地 `http://127.0.0.1:3000/api`，仅适用于开发期本地联调；后续如接入真机 openid 登录，需要 HTTPS 合法域名支持。
### `server/src/models/user.ts` / `server/src/repositories/user-repository.ts`
阶段十七起步检查确认用户模型与数据读取链已经保留 `openid` 字段，说明数据库结构对正式 openid 绑定有基础承接能力，但尚未存在按 openid 查询和绑定的完整登录流程。
