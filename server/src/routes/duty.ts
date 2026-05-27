import { Router } from 'express';
import type { ServerEnv } from '../config/env';
import { getDatabasePool } from '../database/mysql';
import { AppError } from '../errors/app-error';
import { getAuthContext, requireAuth } from '../middleware/auth';
import {
  createOvertimeRecord,
  createSwapRequest,
  getAssistantDutyOverview,
  peerReviewSwapRequest,
} from '../repositories/duty-repository';
import { insertNotification } from '../repositories/notification-repository';
import { writeOperationLog } from '../services/operation-log-service';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import {
  expectEnum,
  expectObjectBody,
  expectPositiveInteger,
  normalizeOptionalString,
} from '../utils/validation';

function normalizeQueryParam(value: unknown): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === 'string' ? value : null;
}

function parseCreateSwapInput(body: unknown) {
  const normalizedBody = expectObjectBody(body);

  return {
    originalAssignmentId: expectPositiveInteger(
      normalizedBody.originalAssignmentId,
      'originalAssignmentId',
      { min: 1 },
    ),
    targetUserId: expectPositiveInteger(normalizedBody.targetUserId, 'targetUserId', { min: 1 }),
    reason: normalizeOptionalString(normalizedBody.reason, 'reason', { maxLength: 500 }),
  };
}

function parsePeerReviewInput(body: unknown) {
  const normalizedBody = expectObjectBody(body);

  return {
    decision: expectEnum(normalizedBody.decision, 'decision', ['confirm', 'reject'] as const),
  };
}

function parseCreateOvertimeInput(body: unknown) {
  const normalizedBody = expectObjectBody(body);

  return {
    assignmentId: expectPositiveInteger(normalizedBody.assignmentId, 'assignmentId', { min: 1 }),
    durationMinutes: expectPositiveInteger(normalizedBody.durationMinutes, 'durationMinutes', {
      min: 1,
      max: 600,
    }),
    reason: normalizeOptionalString(normalizedBody.reason, 'reason', { maxLength: 500 }),
  };
}

export function createDutyRouter(env: ServerEnv): Router {
  const router = Router();

  router.get(
    '/overview',
    requireAuth(env),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const payload = await getAssistantDutyOverview(
        getDatabasePool(env.database),
        user.userId,
        normalizeQueryParam(request.query.month),
        normalizeQueryParam(request.query.date),
      );

      sendSuccess(response, payload);
    }),
  );

  router.post(
    '/swap-requests',
    requireAuth(env),
    asyncHandler(async (request, response) => {
      const pool = getDatabasePool(env.database);
      const { user } = getAuthContext(request);
      const payload = await createSwapRequest(pool, user.userId, parseCreateSwapInput(request.body));

      await insertNotification(pool, {
        recipientUserId: payload.targetUserId!,
        type: 'swap_peer_confirmation',
        title: '有新的换班确认请求',
        content: `${payload.requesterName} 邀请你接替 ${payload.originalWorkDate} 的 ${payload.originalShiftLabel}。`,
        relatedEntityType: 'swap_request',
        relatedEntityId: payload.swapRequestId,
      });

      await writeOperationLog(pool, {
        actorUserId: user.userId,
        action: 'swap_request_create',
        entityType: 'swap_request',
        entityId: payload.swapRequestId,
        result: 'success',
        detail: `Created swap request ${payload.swapRequestId}.`,
      });

      sendSuccess(response, payload);
    }),
  );

  router.post(
    '/swap-requests/:swapRequestId/peer-review',
    requireAuth(env),
    asyncHandler(async (request, response) => {
      const pool = getDatabasePool(env.database);
      const { user } = getAuthContext(request);
      const swapRequestId = Number(request.params.swapRequestId);

      if (!Number.isInteger(swapRequestId) || swapRequestId <= 0) {
        throw new AppError(400, 'VALIDATION_ERROR', 'swapRequestId must be a positive integer.');
      }

      const payload = await peerReviewSwapRequest(
        pool,
        user.userId,
        swapRequestId,
        parsePeerReviewInput(request.body),
      );

      await insertNotification(pool, {
        recipientUserId: payload.requesterId,
        type: 'swap_peer_result',
        title: payload.status === 'pending_admin' ? '换班已被对方确认' : '换班请求被拒绝',
        content:
          payload.status === 'pending_admin'
            ? `${payload.targetUserName ?? '对方'} 已确认换班，请等待管理员审核。`
            : `${payload.targetUserName ?? '对方'} 拒绝了换班请求。`,
        relatedEntityType: 'swap_request',
        relatedEntityId: payload.swapRequestId,
      });

      await writeOperationLog(pool, {
        actorUserId: user.userId,
        action: 'swap_request_peer_review',
        entityType: 'swap_request',
        entityId: payload.swapRequestId,
        result: 'success',
        detail: `Peer review result: ${payload.status}.`,
      });

      sendSuccess(response, payload);
    }),
  );

  router.post(
    '/overtime-records',
    requireAuth(env),
    asyncHandler(async (request, response) => {
      const pool = getDatabasePool(env.database);
      const { user } = getAuthContext(request);
      const payload = await createOvertimeRecord(
        pool,
        user.userId,
        parseCreateOvertimeInput(request.body),
      );

      await writeOperationLog(pool, {
        actorUserId: user.userId,
        action: 'overtime_record_create',
        entityType: 'overtime_record',
        entityId: payload.overtimeId,
        result: 'success',
        detail: `Created overtime record ${payload.overtimeId}.`,
      });

      sendSuccess(response, payload);
    }),
  );

  return router;
}
