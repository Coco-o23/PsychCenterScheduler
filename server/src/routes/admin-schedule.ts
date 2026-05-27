import { Router } from 'express';
import type { ServerEnv } from '../config/env';
import { getDatabasePool } from '../database/mysql';
import { AppError } from '../errors/app-error';
import { getAuthContext, requireAuth, requireRole } from '../middleware/auth';
import type {
  ManualScheduleAssignmentInput,
  PublishScheduleInput,
  SaveScheduleRulesInput,
  ScheduleStrategyKey,
} from '../models/schedule';
import { insertNotification } from '../repositories/notification-repository';
import {
  exportPublishedScheduleAsExcel,
  generateScheduleDraft,
  getScheduleWorkspace,
  listPublishedScheduleAssignmentsForNotification,
  publishSchedule,
  updateScheduleAssignmentManually,
  updateScheduleRules,
} from '../repositories/schedule-repository';
import { writeOperationLog } from '../services/operation-log-service';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import {
  expectBoolean,
  expectIsoDate,
  expectObjectBody,
  expectPositiveInteger,
} from '../utils/validation';

function normalizeParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseCollectionId(value: string | string[] | undefined): number {
  const normalizedValue = normalizeParam(value);
  const parsed = Number(normalizedValue);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'collectionId must be a positive integer.');
  }

  return parsed;
}

function parseScheduleId(value: string | string[] | undefined): number {
  const normalizedValue = normalizeParam(value);
  const parsed = Number(normalizedValue);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'scheduleId must be a positive integer.');
  }

  return parsed;
}

function parseRuleInput(body: unknown): SaveScheduleRulesInput {
  const normalizedBody = expectObjectBody(body);

  return {
    preferCrossCollege: expectBoolean(normalizedBody.preferCrossCollege, 'preferCrossCollege'),
    preferCrossGrade: expectBoolean(normalizedBody.preferCrossGrade, 'preferCrossGrade'),
    preferGenderBalance: expectBoolean(normalizedBody.preferGenderBalance, 'preferGenderBalance'),
    preferSeniorNewPair: expectBoolean(normalizedBody.preferSeniorNewPair, 'preferSeniorNewPair'),
    prioritizeReliability: expectBoolean(normalizedBody.prioritizeReliability, 'prioritizeReliability'),
  };
}

function parseManualAssignmentInput(body: unknown): ManualScheduleAssignmentInput {
  const normalizedBody = expectObjectBody(body);
  const strategyKey = normalizedBody.strategyKey;

  return {
    action:
      normalizedBody.action === 'add' || normalizedBody.action === 'remove'
        ? normalizedBody.action
        : (() => {
            throw new AppError(400, 'VALIDATION_ERROR', 'action must be add or remove.');
          })(),
    strategyKey:
      strategyKey === 'coverage_first' ||
      strategyKey === 'full_staffing_first' ||
      strategyKey === 'balanced_fairness'
        ? (strategyKey as ScheduleStrategyKey)
        : (() => {
            throw new AppError(
              400,
              'VALIDATION_ERROR',
              'strategyKey must be coverage_first, full_staffing_first or balanced_fairness.',
            );
          })(),
    workDate: expectIsoDate(normalizedBody.workDate, 'workDate'),
    shiftTemplateId: expectPositiveInteger(normalizedBody.shiftTemplateId, 'shiftTemplateId', {
      min: 1,
    }),
    userId: expectPositiveInteger(normalizedBody.userId, 'userId', { min: 1 }),
  };
}

function parsePublishInput(body: unknown): PublishScheduleInput {
  const normalizedBody = expectObjectBody(body);
  const strategyKey = normalizedBody.strategyKey;

  if (
    strategyKey !== 'coverage_first' &&
    strategyKey !== 'full_staffing_first' &&
    strategyKey !== 'balanced_fairness'
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'strategyKey must be coverage_first, full_staffing_first or balanced_fairness.',
    );
  }

  return {
    strategyKey,
  };
}

export function createAdminScheduleRouter(env: ServerEnv): Router {
  const router = Router();

  router.get(
    '/collections/:collectionId',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'schedule_workspace_read',
      entityType: 'schedule',
    }),
    asyncHandler(async (request, response) => {
      const collectionId = parseCollectionId(request.params.collectionId);
      const payload = await getScheduleWorkspace(getDatabasePool(env.database), collectionId);

      sendSuccess(response, payload);
    }),
  );

  router.put(
    '/collections/:collectionId/rules',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'schedule_rules_update',
      entityType: 'schedule',
    }),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);
      const collectionId = parseCollectionId(request.params.collectionId);

      try {
        const input = parseRuleInput(request.body);
        const payload = await updateScheduleRules(pool, collectionId, user.userId, input);

        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'schedule_rules_update',
          entityType: 'schedule',
          entityId: payload.scheduleId,
          result: 'success',
          detail: `Updated rule flags for collection ${collectionId}.`,
        });

        sendSuccess(response, payload);
      } catch (error) {
        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'schedule_rules_update',
          entityType: 'schedule',
          entityId: null,
          result: 'failed',
          detail: error instanceof Error ? error.message : 'Unknown schedule rule update failure.',
        });

        throw error;
      }
    }),
  );

  router.post(
    '/collections/:collectionId/generate',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'schedule_generate',
      entityType: 'schedule',
    }),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);
      const collectionId = parseCollectionId(request.params.collectionId);

      try {
        const payload = await generateScheduleDraft(pool, collectionId, user.userId);

        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'schedule_generate',
          entityType: 'schedule',
          entityId: payload.scheduleId,
          result: 'success',
          detail: `Generated draft schedule for collection ${collectionId}.`,
        });

        sendSuccess(response, payload);
      } catch (error) {
        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'schedule_generate',
          entityType: 'schedule',
          entityId: null,
          result: 'failed',
          detail: error instanceof Error ? error.message : 'Unknown schedule generation failure.',
        });

        throw error;
      }
    }),
  );

  router.put(
    '/collections/:collectionId/schedules/:scheduleId/assignments/manual',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'schedule_assignment_manual_update',
      entityType: 'schedule_assignment',
    }),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);
      const collectionId = parseCollectionId(request.params.collectionId);
      const scheduleId = parseScheduleId(request.params.scheduleId);

      try {
        const input = parseManualAssignmentInput(request.body);
        const result = await updateScheduleAssignmentManually(
          pool,
          collectionId,
          scheduleId,
          user.userId,
          input,
        );

        if (result.notifyUserId !== null && input.action === 'add') {
          await insertNotification(pool, {
            recipientUserId: result.notifyUserId,
            type: 'manual_schedule_assignment',
            title: '你被加入了新的值班安排',
            content: `管理员已将你加入 ${input.workDate} 的班次安排；如果这与原填报空闲时间不一致，请及时留意并联系管理员确认。`,
            relatedEntityType: 'schedule',
            relatedEntityId: scheduleId,
          });
        }

        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'schedule_assignment_manual_update',
          entityType: 'schedule_assignment',
          entityId: scheduleId,
          result: 'success',
          detail: `${input.action} user ${input.userId} for ${input.workDate} shift ${input.shiftTemplateId}.`,
        });

        sendSuccess(response, result.workspace);
      } catch (error) {
        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'schedule_assignment_manual_update',
          entityType: 'schedule_assignment',
          entityId: scheduleId,
          result: 'failed',
          detail:
            error instanceof Error
              ? error.message
              : 'Unknown schedule manual adjustment failure.',
        });

        throw error;
      }
    }),
  );

  router.post(
    '/collections/:collectionId/export',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'schedule_export',
      entityType: 'exported_file',
    }),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);
      const collectionId = parseCollectionId(request.params.collectionId);

      try {
        const payload = await exportPublishedScheduleAsExcel(pool, collectionId, user.userId);

        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'schedule_export',
          entityType: 'exported_file',
          entityId: payload.exportedFileId,
          result: 'success',
          detail: `Exported published schedule ${payload.scheduleId} for collection ${collectionId}.`,
        });

        sendSuccess(response, payload);
      } catch (error) {
        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'schedule_export',
          entityType: 'exported_file',
          entityId: null,
          result: 'failed',
          detail: error instanceof Error ? error.message : 'Unknown schedule export failure.',
        });

        throw error;
      }
    }),
  );

  router.post(
    '/collections/:collectionId/publish',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'schedule_publish',
      entityType: 'schedule',
    }),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);
      const collectionId = parseCollectionId(request.params.collectionId);

      try {
        const input = parsePublishInput(request.body);
        const payload = await publishSchedule(pool, collectionId, user.userId, input);

        if (payload.scheduleId !== null) {
          const notifications = await listPublishedScheduleAssignmentsForNotification(
            pool,
            payload.scheduleId,
          );

          for (const item of notifications) {
            await insertNotification(pool, {
              recipientUserId: item.userId,
              type: 'schedule_published',
              title: '新的排班已发布',
              content: `你在 ${item.workDate} 的 ${item.shiftLabel} 班次已确认发布，请在日程页查看。`,
              relatedEntityType: 'schedule',
              relatedEntityId: payload.scheduleId,
            });
          }
        }

        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'schedule_publish',
          entityType: 'schedule',
          entityId: payload.scheduleId,
          result: 'success',
          detail: `Published schedule for collection ${collectionId}.`,
        });

        sendSuccess(response, payload);
      } catch (error) {
        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'schedule_publish',
          entityType: 'schedule',
          entityId: null,
          result: 'failed',
          detail: error instanceof Error ? error.message : 'Unknown schedule publish failure.',
        });

        throw error;
      }
    }),
  );

  return router;
}
