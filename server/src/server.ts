import { createApp } from './app';
import { loadEnv } from './config/env';

function buildRootHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>心理中心排班系统</title>
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f5f7fb;
        color: #1f2937;
      }
      main {
        max-width: 760px;
        margin: 48px auto;
        padding: 0 20px;
      }
      .panel {
        background: #ffffff;
        border: 1px solid #dbe3f0;
        border-radius: 16px;
        padding: 28px;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
      }
      h1 {
        margin: 0 0 12px;
        font-size: 28px;
      }
      p {
        margin: 0 0 16px;
        line-height: 1.7;
      }
      .status {
        display: inline-block;
        padding: 6px 12px;
        border-radius: 999px;
        background: #e8f7ec;
        color: #166534;
        font-weight: 600;
      }
      ul {
        padding-left: 20px;
        line-height: 1.8;
      }
      a {
        color: #2563eb;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      .muted {
        color: #6b7280;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="panel">
        <h1>心理中心排班系统</h1>
        <p>本域名用于微信小程序后端接口服务。</p>
        <p><span class="status">服务状态：运行中</span></p>
        <ul>
          <li>健康检查链接：<a href="/api/health">/api/health</a></li>
          <li>简版健康页：<a href="/health">/health</a></li>
          <li>隐私政策说明：<a href="/privacy">/privacy</a></li>
        </ul>
        <p class="muted">当前页面仅用于浏览器访问、域名审核和服务状态确认；小程序业务接口仍通过既有 API 路径提供。</p>
      </section>
    </main>
  </body>
</html>`;
}

function buildHealthHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>服务健康检查</title>
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f5f7fb;
        color: #1f2937;
      }
      main {
        max-width: 760px;
        margin: 48px auto;
        padding: 0 20px;
      }
      .panel {
        background: #ffffff;
        border: 1px solid #dbe3f0;
        border-radius: 16px;
        padding: 28px;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
      }
      h1 {
        margin: 0 0 12px;
        font-size: 28px;
      }
      p {
        line-height: 1.7;
      }
      a {
        color: #2563eb;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="panel">
        <h1>服务正常</h1>
        <p>心理中心排班系统后端服务运行中。</p>
        <p>API 健康检查：<a href="/api/health">/api/health</a></p>
      </section>
    </main>
  </body>
</html>`;
}

function buildPrivacyHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>隐私说明 - 心理中心排班系统</title>
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f5f7fb;
        color: #1f2937;
      }
      main {
        max-width: 760px;
        margin: 48px auto;
        padding: 0 20px;
      }
      .panel {
        background: #ffffff;
        border: 1px solid #dbe3f0;
        border-radius: 16px;
        padding: 28px;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
      }
      h1 {
        margin: 0 0 12px;
        font-size: 28px;
      }
      p, li {
        line-height: 1.7;
      }
      a {
        color: #2563eb;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="panel">
        <h1>隐私政策简版说明</h1>
        <p>本服务用于心理中心排班、空闲时间收集、通知与团队协作，仅处理完成排班业务所需的账号、班次与操作记录信息。</p>
        <ul>
          <li>仅面向获授权的团队成员开放使用。</li>
          <li>账号、排班、通知等数据仅用于系统业务处理与审计留痕。</li>
          <li>如需进一步了解数据处理方式，请联系系统管理员。</li>
        </ul>
        <p><a href="/">返回首页</a></p>
      </section>
    </main>
  </body>
</html>`;
}

function startServer(): void {
  const env = loadEnv();
  const app = createApp(env);

  app.get('/', (_request, response) => {
    response.type('html').send(buildRootHtml());
  });

  app.get('/health', (_request, response) => {
    response.type('html').send(buildHealthHtml());
  });

  app.get('/privacy', (_request, response) => {
    response.type('html').send(buildPrivacyHtml());
  });

  app.listen(env.port, '0.0.0.0', () => {
    console.log(`Server is running on port ${env.port}`);
    console.log(`Health check path: /api/health`);
  });
}

try {
  startServer();
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown startup error.';
  console.error(`Failed to start server: ${message}`);
  process.exit(1);
}
