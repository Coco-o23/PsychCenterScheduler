import { Router } from 'express';
import type { ServerEnv } from '../config/env';
import { getDatabasePool } from '../database/mysql';
import { AppError } from '../errors/app-error';
import { getAuthContext, requireAuth } from '../middleware/auth';
import {
  countUnreadNotifications,
  listNotifications,
  markNotificationRead,
  type NotificationRecord,
} from '../repositories/notification-repository';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';

function parseNotificationId(value: string | string[] | undefined): number {
  const normalized = Array.isArray(value) ? value[0] : value;
  const parsed = Number(normalized);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'notificationId must be a positive integer.');
  }

  return parsed;
}

function getTargetPath(notification: NotificationRecord, role: 'assistant' | 'admin' | 'super_admin'): string {
  if (
    notification.type === 'collection_published' ||
    notification.relatedEntityType === 'availability_collection'
  ) {
    return role === 'assistant' ? '/pages/assistant-main/index' : '/pages/admin-main/index';
  }

  if (
    notification.type === 'manual_schedule_assignment' ||
    notification.type === 'schedule_published' ||
    notification.type === 'swap_peer_confirmation' ||
    notification.type === 'swap_peer_result' ||
    notification.type === 'swap_admin_result' ||
    notification.type === 'overtime_admin_result' ||
    notification.relatedEntityType === 'schedule' ||
    notification.relatedEntityType === 'swap_request' ||
    notification.relatedEntityType === 'overtime_record'
  ) {
    return role === 'assistant' ? '/pages/assistant-duty/index' : '/pages/admin-duty/index';
  }

  return role === 'assistant' ? '/pages/assistant-profile/index' : '/pages/admin-profile/index';
}

export function createNotificationsRouter(env: ServerEnv): Router {
  const router = Router();

  router.get(
    '/',
    requireAuth(env),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);
      const [notifications, unreadCount] = await Promise.all([
        listNotifications(pool, user.userId),
        countUnreadNotifications(pool, user.userId),
      ]);

      sendSuccess(response, {
        unreadCount,
        items: notifications.map((item) => ({
          notificationId: item.notificationId,
          type: item.type,
          title: item.title,
          content: item.content,
          relatedEntityType: item.relatedEntityType,
          relatedEntityId: item.relatedEntityId,
          readAt: item.readAt,
          createdAt: item.createdAt,
          isRead: item.readAt !== null,
          targetPath: getTargetPath(item, user.role),
        })),
      });
    }),
  );

  router.put(
    '/:notificationId/read',
    requireAuth(env),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);
      const notificationId = parseNotificationId(request.params.notificationId);
      const updated = await markNotificationRead(pool, user.userId, notificationId);

      if (!updated) {
        throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
      }

      const unreadCount = await countUnreadNotifications(pool, user.userId);

      sendSuccess(response, {
        notificationId,
        unreadCount,
      });
    }),
  );

  return router;
}
