import { Router } from 'express';
import type { ServerEnv } from '../config/env';
import { checkDatabaseConnection } from '../database/mysql';

export function createHealthRouter(env: ServerEnv): Router {
  const router = Router();

  router.get('/', (_request, response) => {
    response.json({
      success: true,
      data: {
        service: 'psych-scheduler-server',
        status: 'ok',
        environment: env.nodeEnv,
        timestamp: new Date().toISOString(),
      },
    });
  });

  router.get('/database', async (_request, response) => {
    try {
      const connection = await checkDatabaseConnection(env.database);

      response.json({
        success: true,
        data: {
          status: 'ok',
          connection,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database connection error.';

      response.status(503).json({
        success: false,
        error: {
          code: 'DATABASE_CONNECTION_FAILED',
          message:
            'Unable to connect to local MySQL. Check server/.env and ensure MySQL is running.',
          details: {
            database: env.database.database,
            host: env.database.host,
            port: env.database.port,
            user: env.database.user,
            cause: message,
          },
        },
      });
    }
  });

  return router;
}
