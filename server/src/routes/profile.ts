import { Router } from 'express';
import type { ServerEnv } from '../config/env';
import { getDatabasePool } from '../database/mysql';
import { getAuthContext, requireAuth } from '../middleware/auth';
import {
  countUnreadNotifications,
} from '../repositories/notification-repository';
import {
  getDefaultAvailabilityConfiguration,
  getCurrentSemester,
  getProfileViewer,
  getSchedulerWorkSettings,
  saveDefaultAvailabilityConfiguration,
} from '../repositories/configuration-repository';
import { AppError } from '../errors/app-error';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import { expectObjectBody, expectPositiveInteger } from '../utils/validation';

function parseDefaultAvailabilityInput(body: unknown): {
  selectedSlots: Array<{
    shiftIndex: number;
    weekday: number;
  }>;
} {
  const normalizedBody = expectObjectBody(body);

  if (!Array.isArray(normalizedBody.selectedSlots)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'selectedSlots must be an array.');
  }

  const selectedSlots = normalizedBody.selectedSlots.map((item, index) => {
    const normalizedItem = expectObjectBody(item, `selectedSlots[${index}] must be an object.`);

    return {
      shiftIndex: expectPositiveInteger(
        normalizedItem.shiftIndex,
        `selectedSlots[${index}].shiftIndex`,
        { min: 0, max: 20 },
      ),
      weekday: expectPositiveInteger(
        normalizedItem.weekday,
        `selectedSlots[${index}].weekday`,
        { min: 1, max: 7 },
      ),
    };
  });

  return {
    selectedSlots,
  };
}

export function createProfileRouter(env: ServerEnv): Router {
  const router = Router();

  router.get(
    '/overview',
    requireAuth(env),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);
      const [viewer, semester, workSettings] = await Promise.all([
        getProfileViewer(pool, user.userId),
        getCurrentSemester(pool),
        getSchedulerWorkSettings(pool),
      ]);
      const unreadNotificationCount = await countUnreadNotifications(pool, user.userId);
      const defaultAvailability = await getDefaultAvailabilityConfiguration(
        pool,
        user.userId,
        workSettings,
      );

      sendSuccess(response, {
        viewer: viewer
          ? {
              userId: viewer.userId,
              studentId: viewer.studentId,
              name: viewer.name,
              avatarUrl: viewer.avatarUrl,
              role: viewer.role,
              accountStatus: viewer.accountStatus,
              college: viewer.college,
              grade: viewer.grade,
            }
          : null,
        semester,
        workSettings,
        defaultAvailability,
        unreadNotificationCount,
        canManageSettings: ['admin', 'super_admin'].includes(user.role),
      });
    }),
  );

  router.put(
    '/default-availability',
    requireAuth(env),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);
      const input = parseDefaultAvailabilityInput(request.body);
      const workSettings = await getSchedulerWorkSettings(pool);
      const maxShiftIndex = Math.max(workSettings.shiftTemplates.length - 1, 0);

      input.selectedSlots.forEach((item, index) => {
        if (item.shiftIndex > maxShiftIndex) {
          throw new AppError(
            400,
            'VALIDATION_ERROR',
            `selectedSlots[${index}].shiftIndex exceeds the current active shift count.`,
          );
        }
      });

      const defaultAvailability = await saveDefaultAvailabilityConfiguration(pool, user.userId, {
        selectedSlots: input.selectedSlots,
      });

      sendSuccess(response, {
        defaultAvailability,
      });
    }),
  );

  return router;
}
