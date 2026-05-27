import { Router } from 'express';
import type { ServerEnv } from '../config/env';
import { getDatabasePool } from '../database/mysql';
import { AppError } from '../errors/app-error';
import { getAuthContext, requireAuth } from '../middleware/auth';
import {
  getCurrentCollectionFillPayload,
  saveCurrentCollectionSubmission,
} from '../repositories/availability-repository';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import { expectBoolean, expectObjectBody, expectPositiveInteger } from '../utils/validation';

function parseSubmissionInput(body: unknown) {
  const normalizedBody = expectObjectBody(body);

  if (!Array.isArray(normalizedBody.selectedKeys)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'selectedKeys must be an array.');
  }

  const selectedKeys = normalizedBody.selectedKeys.map((item, index) => {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new AppError(400, 'VALIDATION_ERROR', `selectedKeys[${index}] must be a non-empty string.`);
    }

    return item.trim();
  });

  return {
    saveAsDefault: expectBoolean(normalizedBody.saveAsDefault, 'saveAsDefault'),
    selectedKeys,
    selectedMaxWeeklyShifts: expectPositiveInteger(
      normalizedBody.selectedMaxWeeklyShifts,
      'selectedMaxWeeklyShifts',
      { min: 1, max: 20 },
    ),
    isWeekLeave: expectBoolean(normalizedBody.isWeekLeave, 'isWeekLeave'),
  };
}

export function createAvailabilityRouter(env: ServerEnv): Router {
  const router = Router();
  const databasePool = getDatabasePool(env.database);

  router.get(
    '/current',
    requireAuth(env),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const payload = await getCurrentCollectionFillPayload(databasePool, user.userId);

      sendSuccess(response, payload);
    }),
  );

  router.put(
    '/current',
    requireAuth(env),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const payload = await saveCurrentCollectionSubmission(
        databasePool,
        user.userId,
        parseSubmissionInput(request.body),
      );

      sendSuccess(response, payload);
    }),
  );

  return router;
}
