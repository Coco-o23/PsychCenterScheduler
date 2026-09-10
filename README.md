# 心理中心排班系统

这是一个面向高校心理中心的微信小程序排班系统，包含管理员和助理两种使用视角。系统覆盖空闲时间收集、自动排班、日程查看、团队管理、换班申请、加班记录和站内通知等功能。

## 演示使用指引

打开小程序后，首先进入身份角色选择页。为方便展示不同角色的功能和页面视角，演示版本保留了手动切换入口；实际使用中，系统会根据用户的 OpenID 自动识别身份并进入对应页面。

### 管理员视角

选择“管理员”或“超级管理员”身份后，可以体验：

1. 在“排班”页发布空闲时间收集，查看成员填报进度和收集详情。
2. 点击“本人填报”，填写管理员自己的空闲时间。
3. 收集完成后生成排班表，并查看排班结果和风险提示。
4. 在“日程”页按日期查看值班安排，管理无需值班日期、换班和加班记录。
5. 在“团队”页搜索、筛选、新增和编辑成员。
6. 在“个人”页维护默认空闲时间、班次和工作日等设置。

### 助理视角

选择任一助理身份后，可以体验：

1. 在“填报”页选择下周可值班时段，设置每周最高排班次数并提交。
2. 在“日程”页查看个人值班安排，提交换班申请或加班记录。
3. 在“团队”页查看团队成员信息。
4. 在“个人”页维护个人资料和默认空闲时间。

底部导航栏可在四个主要功能页面之间切换。若想体验另一种身份，可在个人页面退出当前身份并重新选择。

## 本地运行

### 1. 准备环境

- Node.js
- MySQL 8
- 微信开发者工具

### 2. 初始化数据库

创建 MySQL 数据库后，按以下顺序执行脚本：

    sql/migrations/001_create_core_tables.sql
    sql/migrations/002_refine_core_query_support.sql
    sql/seeds/001_seed_test_users.sql
    sql/seeds/002_seed_stage4_validation_data.sql

更详细的数据库说明见 [sql/README.md](sql/README.md)。

### 3. 启动后端

进入 server 目录，安装依赖并创建本地环境配置：

    cd server
    npm install
    cp .env.example .env

在 .env 中填写本地 MySQL 账号和密码，然后启动服务：

    npm run dev

可访问 GET /api/health 检查服务是否正常。

### 4. 运行小程序

1. 使用微信开发者工具导入项目根目录。
2. 确认 project.config.json 中的 miniprogramRoot 指向 miniprogram/。
3. 按实际环境修改 miniprogram/config/app-config.ts 中的后端 API 地址。
4. 编译项目，从身份角色选择页进入系统。

## 项目结构

    miniprogram/   微信原生小程序前端
    server/        Express + TypeScript 后端
    sql/           MySQL 迁移和演示数据
    oriDocument/   产品设计、原型和开发文档

## 技术栈

- 微信原生小程序、TypeScript、WXML、WXSS
- Node.js、Express、TypeScript
- MySQL

本地 .env、数据库密码和服务器密钥不应提交到仓库。
