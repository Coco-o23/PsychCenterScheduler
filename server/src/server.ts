import { createApp } from './app';
import { loadEnv } from './config/env';

function startServer(): void {
  const env = loadEnv();
  const app = createApp(env);

  app.listen(env.port, () => {
    console.log(`Server is running at http://127.0.0.1:${env.port}`);
    console.log(`Health check: http://127.0.0.1:${env.port}/api/health`);
  });
}

try {
  startServer();
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown startup error.';
  console.error(`Failed to start server: ${message}`);
  process.exit(1);
}
