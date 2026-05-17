# 微信小程序全栈技术栈推荐

## 1. 推荐结论

本项目改用 **微信原生小程序 + TypeScript + Node.js Express + TypeScript + 本地 MySQL + 腾讯云服务器 + 腾讯云 COS** 作为完整技术栈。

开发阶段先完成一个本地可运行、可测试、可闭环的全栈程序：微信开发者工具运行小程序前端，小程序通过 HTTP 请求访问本地 Express 后端，后端读写 `localhost:3306` 的本地 MySQL 数据库。所有核心功能在本地确认通过后，再将后端部署到腾讯云服务器，生产数据库暂定使用腾讯云服务器本机 MySQL，导出文件和后续文件类资源使用腾讯云 COS。

账号体系同步调整：正式版不再使用学号 + 密码 + 邮箱登录，不做邮箱验证码找回密码；用户身份最终由后端通过微信 `openid` 识别。测试阶段暂不实现真实 `openid` 登录，先提供一个临时测试分流页，允许选择 1 个管理员入口和多个助理入口进入系统。该测试分流页是开发期工具，正式接入微信登录后必须移除。

## 2. 工程目录约定

项目根目录为 `E:\C_life\CareerProject\shiftArangement`。后续工程代码按三个主目录组织：

```text
shiftArangement/
  miniprogram/   # 微信原生小程序前端
  server/        # Node.js + Express + TypeScript 后端
  sql/           # MySQL 建表、初始化数据、迁移脚本和种子数据
  oriDocument/   # 需求、设计、技术栈、实施计划和开发记录
```

`oriDocument` 后续仍作为文档目录，开发过程中默认只持续更新 `architecture.md` 和 `progress.md`；若技术路线、需求或计划发生变更，才修改 `tech_stack.md`、`design_document.md`、`implementation_plan.md`。

## 3. 前端技术栈

| 层级 | 推荐技术 | 说明 |
|---|---|---|
| 小程序框架 | 微信原生小程序 | 使用 WXML、WXSS、TypeScript，兼容微信生态，适合迁移现有移动端原型 |
| 开发语言 | TypeScript | 为页面状态、接口入参、接口响应、用户、班次、排班等对象提供类型约束 |
| UI 组件 | WeUI for 小程序 + 自定义组件 | 表单、弹窗、Toast 可参考 WeUI；底部导航、时间格子、排班卡片、成员卡片自定义 |
| 样式 | WXSS + 设计 Token | 将 `DESIGN.md` 和 HTML 原型中的颜色、字号、间距、圆角沉淀为全局样式 |
| 状态 | 页面状态 + 轻量全局状态 | 保存当前测试身份或正式用户、角色、当前学期、当前收集任务、后端 API 基础地址 |
| 请求 | `wx.request` 封装 | 统一处理 baseURL、加载态、错误、身份头、权限失败、空数据 |

前端必须保持现有原型的现代企业极简风格、移动端优先布局、底部四栏导航、卡片式排班信息、时间格子、状态标签、蓝绿红语义色和 8px 间距体系。

## 4. 后端技术栈

| 层级 | 推荐技术 | 说明 |
|---|---|---|
| 运行时 | Node.js LTS | 本地开发和腾讯云服务器部署统一运行时 |
| Web 框架 | Express | 提供 REST API、统一错误处理、权限中间件和静态/文件下载能力 |
| 开发语言 | TypeScript | 为接口、服务层、数据模型和排班算法提供类型约束 |
| 配置 | `.env` + `dotenv` | 管理端口、数据库连接、微信 AppID/AppSecret、COS 配置等敏感信息 |
| 数据库访问 | MySQL 驱动或轻量查询层 | 优先保持 SQL 清晰可控；后续可按复杂度决定是否引入 ORM |
| 校验 | Zod 或同类 schema 校验 | 统一校验请求体、路径参数、查询参数和枚举状态 |
| 日志 | pino/winston 或轻量日志封装 | 本地调试、错误追踪、关键业务审计 |
| 定时任务 | Node cron 或服务器 crontab | 后续用于周期收集任务和提醒任务 |

后端是可信业务边界。所有权限校验、身份识别、排班生成、状态流转、Excel 导出、操作日志和敏感字段脱敏都必须在 Express 后端完成，不能依赖前端隐藏按钮。

## 5. 数据库技术栈

开发期使用本地安装的 MySQL：

```text
host: localhost
port: 3306
database: psych_scheduler
```

数据库连接信息不得写死在代码里，必须放在 `server/.env`。建议字段：

```text
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=psych_scheduler
```

生产期暂定使用腾讯云服务器本机 MySQL。部署阶段再根据服务器实际情况填写生产 `.env`，并执行 `sql/` 中的建表和初始化脚本。

## 6. 数据表建议

MySQL 表应覆盖以下业务对象：

| 表 | 用途 |
|---|---|
| users | 用户、微信 openid、角色、账号状态、学院、年级、成员标签 |
| semesters | 学期、教学周、年级更新状态 |
| shift_templates | 默认班次配置 |
| workday_overrides | 法定工作日、调休补班、无需值班日期等工作日规则 |
| availability_collections | 每周空闲时间收集任务 |
| availabilities | 用户按日期和班次提交的空闲状态 |
| schedules | 排班结果主表 |
| schedule_assignments | 排班人员明细 |
| swap_requests | 换班申请和审批状态 |
| overtime_records | 加班记录和审核结果 |
| notifications | 小程序内站内通知、首页提醒、已读未读状态 |
| operation_logs | 管理员关键操作审计日志 |
| system_settings | 全局配置，如默认每班人数、规则开关 |
| exported_files | Excel 导出文件、COS 地址、生成时间和版本 |

`users` 表正式版必须包含 `openid` 字段。测试阶段可使用 `test_identity_key` 或固定种子用户来模拟不同身份，但不得把测试身份机制设计成正式登录方案。

## 7. 登录与身份识别

### 7.1 测试阶段

测试阶段先实现临时身份分流页：

1. 页面展示 1 个管理员测试入口和多个助理测试入口。
2. 用户选择入口后，前端保存测试身份并请求后端测试登录接口。
3. 后端只允许在开发环境启用测试登录。
4. 后端返回用户 ID、角色、账号状态和可访问页面。
5. 正式接入微信 `openid` 后删除该页面和测试登录接口。

### 7.2 正式阶段

正式阶段使用微信 `openid`：

1. 小程序调用 `wx.login()` 获取临时 `code`。
2. 前端将 `code` 发给 Express 后端。
3. 后端使用 AppID 和 AppSecret 调用微信接口换取 `openid`。
4. 后端根据 `openid` 查询 `users` 表。
5. 已登记用户进入对应角色页面；未登记用户进入待登记或联系管理员状态。
6. 管理员在团队管理中维护用户资料、角色、账号状态和排班标签。

正式版不再使用学号 + 密码 + 邮箱验证码作为登录手段。学号仍可作为成员资料字段、搜索字段和排班管理字段。

## 8. 导出、文件与 COS

Excel 导出仍是 MVP 发布阻断项。

开发期：Express 后端生成 `.xlsx` 文件，可直接返回下载或保存到本地临时目录，并在 `exported_files` 表记录导出版本。

生产期：Express 后端生成 Excel 后上传到腾讯云 COS，数据库保存 COS key、访问 URL、文件名、排班周期、生成者和生成时间。

图片导出仍为可选能力，优先保证 Excel 导出完整可用。

## 9. 本地开发流程

1. 安装 Node.js LTS。
2. 安装本地 MySQL，创建 `psych_scheduler` 数据库。
3. 在 `server/.env` 中配置本地 MySQL 连接信息和服务端口。
4. 执行 `sql/` 中的建表脚本和种子数据脚本。
5. 启动 Express 后端，确认健康检查接口可访问。
6. 使用微信开发者工具打开 `miniprogram`。
7. 小程序通过本地 API 地址访问 Express 后端。
8. 通过测试分流页进入管理员或助理身份，完成业务闭环。

## 10. 生产部署方向

生产部署放在后期，不阻塞本地完整功能开发。部署阶段需要补充：

1. 小程序 AppID。
2. 微信 AppSecret。
3. 腾讯云服务器公网 IP、操作系统、登录方式和安全组端口。
4. 生产域名、HTTPS 证书和小程序 request 合法域名配置。
5. 腾讯云服务器本机 MySQL 账号、密码、数据库名。
6. 腾讯云 COS Bucket、地域、SecretId、SecretKey 或安全的服务器访问方式。
7. 后端服务进程管理方式，如 PM2。
8. Nginx 反向代理配置。

## 11. 工程化与质量保障

| 能力 | 推荐方案 |
|---|---|
| 代码规范 | ESLint + Prettier |
| 类型检查 | TypeScript strict 模式 |
| 后端单元测试 | Vitest 或 Jest，覆盖排班算法、权限守卫、状态流转、统计、导出数据 |
| API 测试 | Supertest 或等价工具 |
| 数据库测试 | 使用测试数据库或事务回滚策略 |
| 人工测试 | 覆盖管理员和多个助理完整主流程 |
| 环境隔离 | `.env.development`、`.env.production` 或部署环境变量 |
| 敏感信息 | `.env` 不提交仓库；AppSecret、数据库密码、COS 密钥只存在服务端 |

## 12. 最终推荐版本

```text
前端：微信原生小程序 + TypeScript + WXML + WXSS + WeUI
后端：Node.js LTS + Express + TypeScript
数据库：本地 MySQL 开发，生产期腾讯云服务器本机 MySQL
配置：server/.env 管理数据库、端口、微信和 COS 配置
身份：开发期测试分流页，正式期微信 openid
文件：开发期本地生成，生产期腾讯云 COS
导出：Express 生成 Excel
通知：MySQL notifications 表 + 小程序站内通知
测试：Vitest/Jest + API 测试 + 人工主流程测试
部署：腾讯云服务器 + PM2 + Nginx + HTTPS
```
