import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import type { ServerEnv } from '../config/env';
import {
  getCollectionDashboard,
  getCollectionDetail,
  publishUpcomingCollection,
  republishCurrentCollection,
  syncLatestPublishedCollectionStats,
  updateCollectionManualAvailability,
} from '../repositories/availability-repository';
import { getDatabasePool } from '../database/mysql';
import { AppError } from '../errors/app-error';
import { getAuthContext, requireAuth, requireRole } from '../middleware/auth';
import type { ManualAvailabilityMutationInput } from '../models/availability';
import type {
  AccountStatus,
  AdminTeamFilters,
  MemberType,
  TeamMemberMutationInput,
  UserGender,
  UserRecord,
  UserRole,
} from '../models/user';
import { insertNotification } from '../repositories/notification-repository';
import {
  countActiveAdminUsers,
  createTeamMember,
  deleteTeamMember,
  findUserById,
  getAdminTeamMemberById,
  getTeamSummary,
  listTeamMembersForAssistant,
  listTeamMembersForAdmin,
  updateTeamMember,
} from '../repositories/user-repository';
import { writeOperationLog } from '../services/operation-log-service';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import {
  expectBoolean,
  expectEnum,
  expectIsoDate,
  expectNonEmptyString,
  expectObjectBody,
  expectPositiveInteger,
  normalizeOptionalString,
} from '../utils/validation';

interface PublishPreviewInput {
  teachingWeek: number;
  title: string;
  weekEndDate: string;
  weekStartDate: string;
}

interface CollectionDetailMutationBody extends ManualAvailabilityMutationInput {}

const USER_ROLES: UserRole[] = ['assistant', 'admin', 'super_admin'];
const ACCOUNT_STATUSES: AccountStatus[] = ['pending', 'active', 'rejected', 'disabled'];
const MEMBER_TYPES: MemberType[] = [
  'new_assistant',
  'senior_assistant',
  'intern_assistant',
  'manager_assistant',
];
const USER_GENDERS: UserGender[] = ['male', 'female'];

function parsePublishPreviewInput(body: unknown): PublishPreviewInput {
  const normalizedBody = expectObjectBody(body);
  const title = expectNonEmptyString(normalizedBody.title, 'title', { maxLength: 255 });
  const weekStartDate = expectIsoDate(normalizedBody.weekStartDate, 'weekStartDate');
  const weekEndDate = expectIsoDate(normalizedBody.weekEndDate, 'weekEndDate');
  const teachingWeek = expectPositiveInteger(normalizedBody.teachingWeek, 'teachingWeek', {
    min: 1,
    max: 30,
  });

  if (weekEndDate < weekStartDate) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'weekEndDate must be greater than or equal to weekStartDate.',
    );
  }

  return {
    teachingWeek,
    title,
    weekEndDate,
    weekStartDate,
  };
}

function readQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return readQueryValue(value[0]);
  }

  return undefined;
}

function parseAdminTeamFilters(query: Record<string, unknown>): AdminTeamFilters {
  const filters: AdminTeamFilters = {};
  const keyword = readQueryValue(query.keyword);
  const role = readQueryValue(query.role);
  const accountStatus = readQueryValue(query.accountStatus);
  const memberType = readQueryValue(query.memberType);

  if (keyword) {
    filters.keyword = keyword;
  }

  if (role) {
    filters.role = expectEnum(role, 'role', USER_ROLES);
  }

  if (accountStatus) {
    filters.accountStatus = expectEnum(accountStatus, 'accountStatus', ACCOUNT_STATUSES);
  }

  if (memberType) {
    filters.memberType = expectEnum(memberType, 'memberType', MEMBER_TYPES);
  }

  return filters;
}

function parseUserIdParam(value: string | undefined): number {
  const userId = Number(value);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'userId must be a positive integer.');
  }

  return userId;
}

function parseTeamMemberMutationInput(body: unknown): TeamMemberMutationInput {
  const normalizedBody = expectObjectBody(body);

  return {
    studentId: expectNonEmptyString(normalizedBody.studentId, 'studentId', { maxLength: 32 }),
    name: expectNonEmptyString(normalizedBody.name, 'name', { maxLength: 64 }),
    avatarUrl: normalizeOptionalString(normalizedBody.avatarUrl, 'avatarUrl', { maxLength: 512 }),
    gender: expectEnum(normalizedBody.gender, 'gender', USER_GENDERS),
    college: expectNonEmptyString(normalizedBody.college, 'college', { maxLength: 128 }),
    grade: expectNonEmptyString(normalizedBody.grade, 'grade', { maxLength: 32 }),
    memberType: expectEnum(normalizedBody.memberType, 'memberType', MEMBER_TYPES),
    role: expectEnum(normalizedBody.role, 'role', USER_ROLES),
    accountStatus: expectEnum(normalizedBody.accountStatus, 'accountStatus', ACCOUNT_STATUSES),
    canSoloShift: expectBoolean(normalizedBody.canSoloShift, 'canSoloShift'),
    reliabilityTag: expectBoolean(normalizedBody.reliabilityTag, 'reliabilityTag'),
    testIdentityKey: normalizeOptionalString(normalizedBody.testIdentityKey, 'testIdentityKey', {
      maxLength: 64,
    }),
  };
}

function parseCollectionDetailMutationBody(body: unknown): CollectionDetailMutationBody {
  const normalizedBody = expectObjectBody(body);

  return {
    action: expectEnum(normalizedBody.action, 'action', ['add', 'remove']),
    workDate: expectIsoDate(normalizedBody.workDate, 'workDate'),
    shiftTemplateId: expectPositiveInteger(normalizedBody.shiftTemplateId, 'shiftTemplateId', {
      min: 1,
    }),
    userId: expectPositiveInteger(normalizedBody.userId, 'userId', { min: 1 }),
  };
}

function describesAnActiveAdmin(user: UserRecord | TeamMemberMutationInput): boolean {
  return ['admin', 'super_admin'].includes(user.role) && user.accountStatus === 'active';
}

async function ensureLastAdminProtection(
  pool: Pool,
  currentUser: UserRecord,
  nextInput: TeamMemberMutationInput,
): Promise<void> {
  if (!describesAnActiveAdmin(currentUser)) {
    return;
  }

  if (describesAnActiveAdmin(nextInput)) {
    return;
  }

  const remainingAdminCount = await countActiveAdminUsers(pool, currentUser.userId);

  if (remainingAdminCount === 0) {
    throw new AppError(
      409,
      'LAST_ADMIN_PROTECTION',
      'At least one active admin must remain in the system.',
    );
  }
}

async function ensureDeleteAllowed(pool: Pool, targetUser: UserRecord): Promise<void> {
  if (!describesAnActiveAdmin(targetUser)) {
    return;
  }

  const remainingAdminCount = await countActiveAdminUsers(pool, targetUser.userId);

  if (remainingAdminCount === 0) {
    throw new AppError(
      409,
      'LAST_ADMIN_PROTECTION',
      'At least one active admin must remain in the system.',
    );
  }
}

function describeUserSnapshot(user: UserRecord | TeamMemberMutationInput): string {
  return `${user.studentId}/${user.name}/${user.role}/${user.accountStatus}`;
}

async function createPermissionNotification(
  pool: Pool,
  recipientUserId: number,
  title: string,
  content: string,
): Promise<void> {
  await insertNotification(pool, {
    recipientUserId,
    type: 'team_member_permission_change',
    title,
    content,
    relatedEntityType: 'user',
    relatedEntityId: recipientUserId,
  });
}

async function notifyCollectionPublication(
  pool: Pool,
  input: {
    collectionId: number | null;
    title: string;
    recipients: Array<{ userId: number }>;
    republished?: boolean;
  },
): Promise<void> {
  for (const member of input.recipients) {
    await insertNotification(pool, {
      recipientUserId: member.userId,
      type: 'collection_published',
      title: input.republished ? '空闲时间收集已重新发布' : '新的空闲时间收集已发布',
      content: input.republished
        ? `${input.title} 已按最新排班规则重新发布，请重新确认并提交本周空闲时间。`
        : `${input.title} 已发布，请尽快完成本周填报。`,
      relatedEntityType: 'availability_collection',
      relatedEntityId: input.collectionId,
    });
  }
}

async function notifyAccountReviewResult(
  pool: Pool,
  recipientUserId: number,
  approved: boolean,
): Promise<void> {
  await insertNotification(pool, {
    recipientUserId,
    type: approved ? 'account_review_approved' : 'account_review_rejected',
    title: approved ? '成员认证已通过' : '成员认证未通过',
    content: approved
      ? '管理员已通过你的成员认证，你现在可以进入系统参与填报和值班流程。'
      : '管理员驳回了你的成员认证，请联系管理员确认资料后再试。',
    relatedEntityType: 'user',
    relatedEntityId: recipientUserId,
  });
}

function isDatabaseError(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

function normalizeRepositoryError(error: unknown): never {
  if (isDatabaseError(error, 'ER_DUP_ENTRY')) {
    throw new AppError(
      409,
      'DUPLICATE_MEMBER',
      'studentId or testIdentityKey already exists. Please use a unique value.',
    );
  }

  if (isDatabaseError(error, 'ER_ROW_IS_REFERENCED_2')) {
    throw new AppError(
      409,
      'MEMBER_HAS_HISTORY',
      'This member already has related schedule or audit data and cannot be deleted directly.',
    );
  }

  throw error;
}

export function createAdminRouter(env: ServerEnv): Router {
  const router = Router();

  router.get(
    '/dashboard',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'collection_dashboard_read',
      entityType: 'availability_collection',
    }),
    asyncHandler(async (_request, response) => {
      const payload = await getCollectionDashboard(getDatabasePool(env.database));

      sendSuccess(response, payload);
    }),
  );

  router.get(
    '/session-check',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'admin_session_check',
      entityType: 'system',
    }),
    asyncHandler(async (_request, response) => {
      sendSuccess(response, {
        status: 'ok',
      });
    }),
  );

  router.post(
    '/collections/publish-preview',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'publish_collection_preview',
      entityType: 'availability_collection',
    }),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);

      try {
        const payload = parsePublishPreviewInput(request.body);

        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'publish_collection_preview',
          entityType: 'availability_collection',
          entityId: null,
          result: 'success',
          detail: `Previewed collection ${payload.title} for week ${payload.weekStartDate} to ${payload.weekEndDate}.`,
        });

        sendSuccess(response, {
          preview: {
            status: 'pending',
            submittedUsers: 0,
            title: payload.title,
            totalUsers: 4,
            teachingWeek: payload.teachingWeek,
            weekStartDate: payload.weekStartDate,
            weekEndDate: payload.weekEndDate,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown validation failure.';

        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'publish_collection_preview',
          entityType: 'availability_collection',
          entityId: null,
          result: 'failed',
          detail: message,
        });

        throw error;
      }
    }),
  );

  router.post(
    '/collections/publish',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'collection_publish',
      entityType: 'availability_collection',
    }),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);

      try {
        const payload = await publishUpcomingCollection(pool, user.userId);
        const assistantMembers = await listTeamMembersForAssistant(pool);

        await notifyCollectionPublication(pool, {
          collectionId: payload.summary.collectionId,
          title: payload.summary.title,
          recipients: assistantMembers,
        });

        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'collection_publish',
          entityType: 'availability_collection',
          entityId: payload.summary.collectionId,
          result: 'success',
          detail: `Published collection ${payload.summary.title}.`,
        });

        sendSuccess(response, payload);
      } catch (error) {
        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'collection_publish',
          entityType: 'availability_collection',
          entityId: null,
          result: 'failed',
          detail: error instanceof Error ? error.message : 'Unknown collection publish failure.',
        });

        throw error;
      }
    }),
  );

  router.post(
    '/collections/republish',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'collection_republish',
      entityType: 'availability_collection',
    }),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);

      try {
        const payload = await republishCurrentCollection(pool, user.userId);
        const assistantMembers = await listTeamMembersForAssistant(pool);

        await notifyCollectionPublication(pool, {
          collectionId: payload.summary.collectionId,
          title: payload.summary.title,
          recipients: assistantMembers,
          republished: true,
        });

        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'collection_republish',
          entityType: 'availability_collection',
          entityId: payload.summary.collectionId,
          result: 'success',
          detail: `Republished collection ${payload.summary.title}.`,
        });

        sendSuccess(response, payload);
      } catch (error) {
        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'collection_republish',
          entityType: 'availability_collection',
          entityId: null,
          result: 'failed',
          detail: error instanceof Error ? error.message : 'Unknown collection republish failure.',
        });

        throw error;
      }
    }),
  );

  router.get(
    '/collections/:collectionId/detail',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'collection_detail_read',
      entityType: 'availability_collection',
    }),
    asyncHandler(async (request, response) => {
      const collectionId = parseUserIdParam(readQueryValue(request.params.collectionId));
      const payload = await getCollectionDetail(getDatabasePool(env.database), collectionId);

      sendSuccess(response, payload);
    }),
  );

  router.put(
    '/collections/:collectionId/detail/manual-availability',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'collection_detail_manual_update',
      entityType: 'availability_collection',
    }),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);
      const collectionId = parseUserIdParam(readQueryValue(request.params.collectionId));
      const payload = parseCollectionDetailMutationBody(request.body);

      try {
        const result = await updateCollectionManualAvailability(pool, user.userId, collectionId, payload);

        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'collection_detail_manual_update',
          entityType: 'availability_collection',
          entityId: collectionId,
          result: 'success',
          detail: `${payload.action} user ${payload.userId} for ${payload.workDate} shift ${payload.shiftTemplateId}.`,
        });

        if (result.notifyUserId !== null) {
          await insertNotification(pool, {
            recipientUserId: result.notifyUserId,
            type: 'manual_availability_added',
            title: '你被补充到可值班名单',
            content: `管理员已将你补充到 ${payload.workDate} 该班次的可值班名单，请留意后续排班结果。`,
            relatedEntityType: 'availability_collection',
            relatedEntityId: collectionId,
          });
        }

        sendSuccess(response, result.detail);
      } catch (error) {
        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'collection_detail_manual_update',
          entityType: 'availability_collection',
          entityId: collectionId,
          result: 'failed',
          detail: error instanceof Error ? error.message : 'Unknown collection detail update failure.',
        });

        throw error;
      }
    }),
  );

  router.get(
    '/team/members',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'team_member_read',
      entityType: 'user',
    }),
    asyncHandler(async (request, response) => {
      const pool = getDatabasePool(env.database);
      const filters = parseAdminTeamFilters(request.query as Record<string, unknown>);
      const [members, summary] = await Promise.all([
        listTeamMembersForAdmin(pool, filters),
        getTeamSummary(pool),
      ]);

      sendSuccess(response, {
        filters,
        members,
        summary,
      });
    }),
  );

  router.post(
    '/team/members',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'team_member_create',
      entityType: 'user',
    }),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);

      try {
        const payload = parseTeamMemberMutationInput(request.body);
        const createdUserId = await createTeamMember(pool, payload);
        await syncLatestPublishedCollectionStats(pool);

        await createPermissionNotification(
          pool,
          createdUserId,
          '成员资料已建立',
          `管理员已为你建立成员记录：${payload.name}，当前角色为 ${payload.role}。`,
        );

        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'team_member_create',
          entityType: 'user',
          entityId: createdUserId,
          result: 'success',
          detail: `Created member ${describeUserSnapshot(payload)}.`,
        });

        const createdMember = await getAdminTeamMemberById(pool, createdUserId);

        sendSuccess(
          response,
          {
            member: createdMember,
          },
          201,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown create member failure.';

        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'team_member_create',
          entityType: 'user',
          entityId: null,
          result: 'failed',
          detail: message,
        });

        normalizeRepositoryError(error);
      }
    }),
  );

  router.patch(
    '/team/members/:userId',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'team_member_update',
      entityType: 'user',
    }),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);
      const targetUserId = parseUserIdParam(readQueryValue(request.params.userId));

      try {
        const currentUser = await findUserById(pool, targetUserId);

        if (!currentUser) {
          throw new AppError(404, 'MEMBER_NOT_FOUND', 'The requested member does not exist.');
        }

        const payload = parseTeamMemberMutationInput(request.body);
        await ensureLastAdminProtection(pool, currentUser, payload);
        await updateTeamMember(pool, targetUserId, payload);
        await syncLatestPublishedCollectionStats(pool);

        const permissionChanged =
          currentUser.role !== payload.role ||
          currentUser.accountStatus !== payload.accountStatus ||
          currentUser.canSoloShift !== payload.canSoloShift ||
          currentUser.reliabilityTag !== payload.reliabilityTag;
        const accountReviewChanged =
          currentUser.accountStatus === 'pending' &&
          (payload.accountStatus === 'active' || payload.accountStatus === 'rejected');

        if (accountReviewChanged) {
          await notifyAccountReviewResult(pool, targetUserId, payload.accountStatus === 'active');
        } else if (permissionChanged) {
          await createPermissionNotification(
            pool,
            targetUserId,
            '团队权限已调整',
            `管理员已更新你的成员权限：角色 ${payload.role}，账号状态 ${payload.accountStatus}。`,
          );
        }

        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'team_member_update',
          entityType: 'user',
          entityId: targetUserId,
          result: 'success',
          detail: `Updated member from ${describeUserSnapshot(currentUser)} to ${describeUserSnapshot(payload)}.`,
        });

        const updatedMember = await getAdminTeamMemberById(pool, targetUserId);

        sendSuccess(response, {
          member: updatedMember,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown update member failure.';

        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'team_member_update',
          entityType: 'user',
          entityId: targetUserId,
          result: 'failed',
          detail: message,
        });

        normalizeRepositoryError(error);
      }
    }),
  );

  router.delete(
    '/team/members/:userId',
    requireAuth(env),
    requireRole(env, ['admin', 'super_admin'], {
      action: 'team_member_delete',
      entityType: 'user',
    }),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);
      const targetUserId = parseUserIdParam(readQueryValue(request.params.userId));

      try {
        const targetUser = await findUserById(pool, targetUserId);

        if (!targetUser) {
          throw new AppError(404, 'MEMBER_NOT_FOUND', 'The requested member does not exist.');
        }

        await ensureDeleteAllowed(pool, targetUser);
        await deleteTeamMember(pool, targetUserId);
        await syncLatestPublishedCollectionStats(pool);

        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'team_member_delete',
          entityType: 'user',
          entityId: targetUserId,
          result: 'success',
          detail: `Deleted member ${describeUserSnapshot(targetUser)}.`,
        });

        sendSuccess(response, {
          deletedUserId: targetUserId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown delete member failure.';

        await writeOperationLog(pool, {
          actorUserId: user.userId,
          action: 'team_member_delete',
          entityType: 'user',
          entityId: targetUserId,
          result: 'failed',
          detail: message,
        });

        normalizeRepositoryError(error);
      }
    }),
  );

  return router;
}
