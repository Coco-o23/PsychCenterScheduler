import { Router } from 'express';
import type { ServerEnv } from '../config/env';
import { getDatabasePool } from '../database/mysql';
import { AppError } from '../errors/app-error';
import { getAuthContext, requireAuth } from '../middleware/auth';
import { getScheduleSharePayload } from '../repositories/schedule-repository';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';

function parseCollectionId(value: string | string[] | undefined): number {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number(normalizedValue);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'collectionId must be a positive integer.');
  }

  return parsed;
}

export function createScheduleShareRouter(env: ServerEnv): Router {
  const router = Router();

  router.get(
    '/collections/:collectionId',
    requireAuth(env),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const collectionId = parseCollectionId(request.params.collectionId);
      const payload = await getScheduleSharePayload(getDatabasePool(env.database), collectionId, {
        userId: user.userId,
        role: user.role,
        name: user.name,
      });

      sendSuccess(response, payload);
    }),
  );

  return router;
}
