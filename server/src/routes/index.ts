import { Router } from 'express';
import type { ServerEnv } from '../config/env';
import { createHealthRouter } from './health';

export function createApiRouter(env: ServerEnv): Router {
  const router = Router();

  router.use('/health', createHealthRouter(env));

  return router;
}
