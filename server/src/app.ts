import cors from 'cors';
import express from 'express';
import type { ServerEnv } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found';
import { createApiRouter } from './routes';

export function createApp(env: ServerEnv): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json());
  app.use('/api', createApiRouter(env));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
