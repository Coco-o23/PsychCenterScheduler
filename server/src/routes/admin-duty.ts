import { Router } from 'express';
import type { ServerEnv } from '../config/env';
import { getDatabasePool } from '../database/mysql';
import { AppError } from '../errors/app-error';
import { getAuthContext, requireAuth, requireRole } from '../middleware/auth';
import {
  adminReviewOvertimeRecord,
  adminReviewSwapRequest,
  getAdminDutyOverview,
  updateNoShiftOverride,
} from '../repositories/duty-repository';
import { insertNotification } from '../repositories/notification-repository';
import { writeOperationLog } from '../services/operation-log-service';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import {
  expectBoolean,
  expectEnum,
  expectIsoDate,
  expectObjectBody,
  normalizeOptionalString,
} from '../utils/validation';

function normalizeQueryParam(value: unknown): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === 'string' ? value : null;
}

function parsePositiveId(value: unknown, fieldName: string): number {
  const normalized = Array.isArray(value) ? value[0] : value;
  const parsed = Number(normalized);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} must be a positive integer.`);
  }

  return parsed;
}

function parseNoShiftInput(body: unknown) {
  const normalizedBody = expectObjectBody(body);

  return {
    workDate: expectIsoDate(normalizedBody.workDate, 'workDate'),
    enabled: expectBoolean(normalizedBody.enabled, 'enabled'),
    reason: normalizeOptionalString(normalizedBody.reason, 'reason', { maxLength: 255 }),
  };
}

function parseAdminSwapReviewInput(body: unknown) {
  const normalizedBody = expectObjectBody(body);

  return {
    decision: expectEnum(normalizedBody.decision, 'decision', ['approve', 'reject'] as const),
    reviewNote: normalizeOptionalString(normalizedBody.reviewNote, 'reviewNote', { maxLength: 500 }),
  };
}

function parseAdminOvertimeReviewInput(body: unknown) {
  const normalizedBody = expectObjectBody(body);

  return {
    decision: expectEnum(normalizedBody.decision, 'decision', ['approve', 'reject'] as const),
    reviewNote: normalizeOptionalString(normalizedBody.reviewNote, 'reviewNote', { maxLength: 500 }),
  };
}

export function createAdminDutyRouter(env: ServerEnv): Router {
  const router = Router();

  router.get(
    '/overview',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'admin_duty_overview_read',
      entityType: 'schedule',
    }),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const scope = normalizeQueryParam(request.query.scope) === 'all' ? 'all' : 'me';
      const payload = await getAdminDutyOverview(
        getDatabasePool(env.database),
        user.userId,
        normalizeQueryParam(request.query.month),
        normalizeQueryParam(request.query.date),
        scope,
      );

      sendSuccess(response, payload);
    }),
  );

  router.put(
    '/no-shift',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'admin_no_shift_update',
      entityType: 'workday_override',
    }),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);
      const input = parseNoShiftInput(request.body);

      await updateNoShiftOverride(pool, user.userId, input);
      await writeOperationLog(pool, {
        actorUserId: user.userId,
        action: 'admin_no_shift_update',
        entityType: 'workday_override',
        entityId: null,
        result: 'success',
        detail: `${input.enabled ? 'enabled' : 'disabled'} no_shift for ${input.workDate}.`,
      });

      const payload = await getAdminDutyOverview(
        pool,
        user.userId,
        input.workDate.slice(0, 7),
        input.workDate,
        'all',
      );
      sendSuccess(response, payload);
    }),
  );

  router.put(
    '/swap-requests/:swapRequestId/review',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'swap_request_admin_review',
      entityType: 'swap_request',
    }),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);
      const swapRequestId = parsePositiveId(request.params.swapRequestId, 'swapRequestId');
      const payload = await adminReviewSwapRequest(
        pool,
        user.userId,
        swapRequestId,
        parseAdminSwapReviewInput(request.body),
      );

      await writeOperationLog(pool, {
        actorUserId: user.userId,
        action: 'swap_request_admin_review',
        entityType: 'swap_request',
        entityId: payload.swapRequestId,
        result: 'success',
        detail: `Admin review result: ${payload.status}.`,
      });

      await insertNotification(pool, {
        recipientUserId: payload.requesterId,
        type: 'swap_admin_result',
        title: payload.status === 'approved' ? '换班申请已通过' : '换班申请被驳回',
        content:
          payload.status === 'approved'
            ? `${payload.originalWorkDate} 的 ${payload.originalShiftLabel} 已完成换班。`
            : `管理员驳回了 ${payload.originalWorkDate} 的换班申请。`,
        relatedEntityType: 'swap_request',
        relatedEntityId: payload.swapRequestId,
      });

      if (payload.targetUserId) {
        await insertNotification(pool, {
          recipientUserId: payload.targetUserId,
          type: 'swap_admin_result',
          title: payload.status === 'approved' ? '换班安排已确认' : '换班安排未通过',
          content:
            payload.status === 'approved'
              ? `管理员已确认你接替 ${payload.originalWorkDate} 的 ${payload.originalShiftLabel}。`
              : `管理员驳回了你参与的换班申请。`,
          relatedEntityType: 'swap_request',
          relatedEntityId: payload.swapRequestId,
        });
      }

      await writeOperationLog(pool, {
        actorUserId: user.userId,
        action: 'swap_request_admin_review',
        entityType: 'swap_request',
        entityId: payload.swapRequestId,
        result: 'success',
        detail: `Admin review result: ${payload.status}.`,
      });

      sendSuccess(response, payload);
    }),
  );

  router.put(
    '/overtime-records/:overtimeId/review',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'overtime_admin_review',
      entityType: 'overtime_record',
    }),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);
      const overtimeId = parsePositiveId(request.params.overtimeId, 'overtimeId');
      const payload = await adminReviewOvertimeRecord(
        pool,
        user.userId,
        overtimeId,
        parseAdminOvertimeReviewInput(request.body),
      );

      await writeOperationLog(pool, {
        actorUserId: user.userId,
        action: 'overtime_admin_review',
        entityType: 'overtime_record',
        entityId: payload.overtimeId,
        result: 'success',
        detail: `Admin review result: ${payload.status}.`,
      });

      await insertNotification(pool, {
        recipientUserId: payload.userId,
        type: 'overtime_admin_result',
        title: payload.status === 'approved' ? '加班申请已通过' : '加班申请被驳回',
        content:
          payload.status === 'approved'
            ? `${payload.workDate} 的加班时长已记入统计。`
            : `${payload.workDate} 的加班申请未通过审核。`,
        relatedEntityType: 'overtime_record',
        relatedEntityId: payload.overtimeId,
      });

      await writeOperationLog(pool, {
        actorUserId: user.userId,
        action: 'overtime_admin_review',
        entityType: 'overtime_record',
        entityId: payload.overtimeId,
        result: 'success',
        detail: `Admin review result: ${payload.status}.`,
      });

      sendSuccess(response, payload);
    }),
  );

  return router;
}
