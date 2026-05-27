import { Router } from 'express';
import path from 'node:path';
import type { ServerEnv } from '../config/env';
import { getDatabasePool } from '../database/mysql';
import { AppError } from '../errors/app-error';
import { getAuthContext, requireAuth, requireRole } from '../middleware/auth';
import type {
  ShiftTemplateInput,
  UpdateSemesterInput,
  UpdateWorkSettingsInput,
  WorkdayOverrideInput,
  WorkdayOverrideType,
} from '../models/configuration';
import {
  confirmGradeUpdates,
  getCurrentSemester,
  getSchedulerWorkSettings,
  previewGradeUpdates,
  saveCurrentSemester,
  saveSchedulerWorkSettings,
} from '../repositories/configuration-repository';
import { writeOperationLog } from '../services/operation-log-service';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import {
  expectBoolean,
  expectIsoDate,
  expectNonEmptyString,
  expectObjectBody,
  expectPositiveInteger,
  normalizeOptionalString,
} from '../utils/validation';

const WORKDAY_OVERRIDE_TYPES: WorkdayOverrideType[] = ['workday', 'non_workday', 'no_shift'];
const WORKSPACE_ROOT = path.resolve(__dirname, '../../..');

function parseExportDirectory(value: unknown): string {
  const normalized = expectNonEmptyString(value, 'exportDirectory', { maxLength: 255 })
    .replace(/\\/g, '/')
    .trim();

  if (normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'exportDirectory must be a workspace-relative path.',
    );
  }

  const segments = normalized.split('/').filter((item) => item.length > 0);

  if (segments.length === 0 || segments.some((item) => item === '.' || item === '..')) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'exportDirectory must stay within the project workspace.',
    );
  }

  const resolvedPath = path.resolve(WORKSPACE_ROOT, normalized);

  if (!resolvedPath.startsWith(WORKSPACE_ROOT)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'exportDirectory must stay within the project workspace.',
    );
  }

  return segments.join('/');
}

function expectTimeString(value: unknown, fieldName: string): string {
  const normalized = expectNonEmptyString(value, fieldName, { minLength: 5, maxLength: 5 });

  if (!/^\d{2}:\d{2}$/.test(normalized)) {
    throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} must be in HH:MM format.`);
  }

  const [hour, minute] = normalized.split(':').map(Number);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new AppError(400, 'VALIDATION_ERROR', `${fieldName} is not a valid time.`);
  }

  return normalized;
}

function compareTimeText(left: string, right: string): number {
  return left.localeCompare(right);
}

function parseSemesterInput(body: unknown): UpdateSemesterInput {
  const normalizedBody = expectObjectBody(body);

  return {
    name: expectNonEmptyString(normalizedBody.name, 'name', { maxLength: 128 }),
    firstWeekStartDate: expectIsoDate(normalizedBody.firstWeekStartDate, 'firstWeekStartDate'),
    totalWeeks: expectPositiveInteger(normalizedBody.totalWeeks, 'totalWeeks', {
      min: 1,
      max: 30,
    }),
  };
}

function parseWorkdayOverrideInput(value: unknown, index: number): WorkdayOverrideInput {
  const item = expectObjectBody(value, `overrides[${index}] must be an object.`);
  const overrideType = expectNonEmptyString(item.overrideType, `overrides[${index}].overrideType`);

  if (!WORKDAY_OVERRIDE_TYPES.includes(overrideType as WorkdayOverrideType)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `overrides[${index}].overrideType must be one of: ${WORKDAY_OVERRIDE_TYPES.join(', ')}.`,
    );
  }

  return {
    workDate: expectIsoDate(item.workDate, `overrides[${index}].workDate`),
    overrideType: overrideType as WorkdayOverrideType,
    reason: normalizeOptionalString(item.reason, `overrides[${index}].reason`, { maxLength: 255 }),
  };
}

function parseShiftTemplateInput(value: unknown, index: number): ShiftTemplateInput {
  const item = expectObjectBody(value, `shiftTemplates[${index}] must be an object.`);
  const startTime = expectTimeString(item.startTime, `shiftTemplates[${index}].startTime`);
  const endTime = expectTimeString(item.endTime, `shiftTemplates[${index}].endTime`);

  if (compareTimeText(endTime, startTime) <= 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `shiftTemplates[${index}].endTime must be later than startTime.`,
    );
  }

  const defaultRequiredCount = expectPositiveInteger(
    item.defaultRequiredCount,
    `shiftTemplates[${index}].defaultRequiredCount`,
    { min: 1, max: 20 },
  );
  const minCount = expectPositiveInteger(item.minCount, `shiftTemplates[${index}].minCount`, {
    min: 1,
    max: 20,
  });

  if (minCount > defaultRequiredCount) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `shiftTemplates[${index}].minCount must be less than or equal to defaultRequiredCount.`,
    );
  }

  return {
    name: expectNonEmptyString(item.name, `shiftTemplates[${index}].name`, { maxLength: 64 }),
    startTime,
    endTime,
    defaultRequiredCount,
    minCount,
    allowSolo: expectBoolean(item.allowSolo, `shiftTemplates[${index}].allowSolo`),
  };
}

function parseWorkSettingsInput(body: unknown): UpdateWorkSettingsInput {
  const normalizedBody = expectObjectBody(body);

  if (!Array.isArray(normalizedBody.weeklyWorkdays) || normalizedBody.weeklyWorkdays.length === 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'weeklyWorkdays must be a non-empty array of weekday numbers.',
    );
  }

  const weeklyWorkdays = Array.from(
    new Set(
      normalizedBody.weeklyWorkdays.map((value, index) =>
        expectPositiveInteger(value, `weeklyWorkdays[${index}]`, { min: 1, max: 7 }),
      ),
    ),
  ).sort((left, right) => left - right);

  if (!Array.isArray(normalizedBody.shiftTemplates) || normalizedBody.shiftTemplates.length === 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'shiftTemplates must contain at least one active shift template.',
    );
  }

  const shiftTemplates = normalizedBody.shiftTemplates.map((item, index) =>
    parseShiftTemplateInput(item, index),
  );
  const shiftSignatureSet = new Set<string>();

  shiftTemplates.forEach((item, index) => {
    const signature = `${item.name}|${item.startTime}|${item.endTime}`;

    if (shiftSignatureSet.has(signature)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `shiftTemplates[${index}] duplicates an earlier shift configuration.`,
      );
    }

    shiftSignatureSet.add(signature);
  });

  const overrides = Array.isArray(normalizedBody.overrides)
    ? normalizedBody.overrides.map((item, index) => parseWorkdayOverrideInput(item, index))
    : [];

  const overrideDateSet = new Set<string>();
  overrides.forEach((item, index) => {
    if (overrideDateSet.has(item.workDate)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `overrides[${index}] duplicates an earlier workDate.`,
      );
    }

    overrideDateSet.add(item.workDate);
  });

  return {
    weeklyWorkdays,
    exportDirectory: parseExportDirectory(normalizedBody.exportDirectory),
    shiftTemplates,
    overrides,
  };
}

export function createAdminConfigurationRouter(env: ServerEnv): Router {
  const router = Router();

  router.get(
    '/',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'admin_configuration_read',
      entityType: 'system_setting',
    }),
    asyncHandler(async (_request, response) => {
      const pool = getDatabasePool(env.database);
      const [semester, workSettings, gradeUpdatePreview] = await Promise.all([
        getCurrentSemester(pool),
        getSchedulerWorkSettings(pool),
        previewGradeUpdates(pool),
      ]);

      sendSuccess(response, {
        semester,
        workSettings,
        gradeUpdatePreview,
        canGenerateCollection: semester !== null,
      });
    }),
  );

  router.put(
    '/semester',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'semester_configuration_update',
      entityType: 'semester',
    }),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);
      const input = parseSemesterInput(request.body);
      const semester = await saveCurrentSemester(pool, input);

      await writeOperationLog(pool, {
        actorUserId: user.userId,
        action: 'semester_configuration_update',
        entityType: 'semester',
        entityId: semester.semesterId,
        result: 'success',
        detail: `Updated current semester to ${semester.name}, start ${semester.firstWeekStartDate}, total ${semester.totalWeeks} weeks.`,
      });

      sendSuccess(response, {
        semester,
      });
    }),
  );

  router.post(
    '/grade-update/preview',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'grade_update_preview',
      entityType: 'user',
    }),
    asyncHandler(async (_request, response) => {
      const pool = getDatabasePool(env.database);
      const preview = await previewGradeUpdates(pool);
      sendSuccess(response, {
        preview,
      });
    }),
  );

  router.post(
    '/grade-update/confirm',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'grade_update_confirm',
      entityType: 'user',
    }),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);
      const preview = await confirmGradeUpdates(pool);

      await writeOperationLog(pool, {
        actorUserId: user.userId,
        action: 'grade_update_confirm',
        entityType: 'user',
        entityId: null,
        result: 'success',
        detail: `Confirmed grade update for ${preview.changedUsers} users, ${preview.unchangedUsers} users unchanged.`,
      });

      sendSuccess(response, {
        preview,
      });
    }),
  );

  router.put(
    '/work-settings',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'work_settings_update',
      entityType: 'system_setting',
    }),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);
      const input = parseWorkSettingsInput(request.body);
      const workSettings = await saveSchedulerWorkSettings(pool, input, user.userId);

      await writeOperationLog(pool, {
        actorUserId: user.userId,
        action: 'work_settings_update',
        entityType: 'system_setting',
        entityId: null,
        result: 'success',
        detail: `Updated ${workSettings.shiftTemplates.length} active shifts, ${workSettings.weeklyWorkdays.length} default workdays, export directory ${workSettings.exportDirectory} and ${workSettings.overrides.length} override dates.`,
      });

      sendSuccess(response, {
        workSettings,
      });
    }),
  );

  return router;
}
