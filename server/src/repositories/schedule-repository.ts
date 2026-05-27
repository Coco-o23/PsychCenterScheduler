import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';
import { AppError } from '../errors/app-error';
import type { CollectionDetailMember, CollectionDetailPayload } from '../models/availability';
import type { UserRecord } from '../models/user';
import type {
  AssignmentPlan,
  CandidateUser,
  ManualScheduleAssignmentInput,
  PublishScheduleInput,
  SaveScheduleRulesInput,
  ScheduleAssignedMember,
  ScheduleCandidateMember,
  SchedulePlanSummary,
  ScheduleRiskTag,
  ScheduleRuleConfig,
  ScheduleSlotPayload,
  ScheduleStatus,
  ScheduleStrategyKey,
  ScheduleWorkspacePayload,
  ShiftSlot,
  StoredScheduleDraft,
} from '../models/schedule';
import { getCollectionDetail } from './availability-repository';
import { getSchedulerWorkSettings } from './configuration-repository';
import { generateSchedulePlans } from '../services/schedule-planner';

interface SystemSettingRow extends RowDataPacket {
  setting_key: string;
  setting_value: string;
}

interface CollectionRow extends RowDataPacket {
  collection_id: number;
  title: string;
  teaching_week: number | null;
  week_start_date: Date;
  week_end_date: Date;
  status: 'pending' | 'active' | 'completed';
  total_users: number;
  submitted_users: number;
}

interface ScheduleRow extends RowDataPacket {
  schedule_id: number;
  collection_id: number | null;
  week_start_date: Date;
  week_end_date: Date;
  status: 'draft' | 'published' | 'adjusted';
  risk_summary: string | null;
  confirmed_by: number | null;
  confirmed_at: Date | null;
}

interface AssignmentRow extends RowDataPacket {
  assignment_id: number;
  schedule_id: number;
  work_date: Date;
  shift_template_id: number;
  user_id: number;
  assignment_source: 'auto' | 'manual' | 'swap';
  risk_tags: string | null;
  notes: string | null;
}

interface ExportedFileRow extends RowDataPacket {
  exported_file_id: number;
}

interface UserShiftLimitRow extends RowDataPacket {
  user_id: number;
  max_weekly_shifts: number | null;
}

interface ScheduleShareMemberView {
  userId: number;
  studentId: string;
  name: string;
  role: 'assistant' | 'admin' | 'super_admin';
  memberType: 'new_assistant' | 'senior_assistant' | 'intern_assistant' | 'manager_assistant';
  isSelf: boolean;
}

interface ScheduleShareSlotView {
  workDate: string;
  dateLabel: string;
  weekday: number;
  weekdayLabel: string;
  shiftTemplateId: number;
  shiftLabel: string;
  startTime: string;
  endTime: string;
  assignedMembers: ScheduleShareMemberView[];
}

interface ScheduleShareDayView {
  workDate: string;
  dateLabel: string;
  weekday: number;
  weekdayLabel: string;
  slots: ScheduleShareSlotView[];
}

const DEFAULT_RULE_CONFIG: ScheduleRuleConfig = {
  preferCrossCollege: true,
  preferCrossGrade: true,
  preferGenderBalance: true,
  preferSeniorNewPair: true,
  prioritizeReliability: true,
};

const DEFAULT_EXPORT_DIRECTORY = 'server/exports';
const WORKSPACE_ROOT = path.resolve(__dirname, '../../..');

const STRATEGY_NAME_MAP: Record<ScheduleStrategyKey, string> = {
  coverage_first: '覆盖优先',
  full_staffing_first: '满员优先',
  balanced_fairness: '均衡优先',
};

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateOnly(value: Date): string {
  return `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}-${padDatePart(value.getDate())}`;
}

function formatDateTime(value: Date | null): string | null {
  if (!value) {
    return null;
  }

  return `${formatDateOnly(value)}T${padDatePart(value.getHours())}:${padDatePart(value.getMinutes())}:${padDatePart(value.getSeconds())}`;
}

function formatWeekLabel(startDate: Date, endDate: Date): string {
  return `${formatDateOnly(startDate)} ~ ${formatDateOnly(endDate)}`;
}

function getWeekdayLabel(weekday: number): string {
  return ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][weekday - 1] ?? '';
}

function buildScheduleRuleKey(collectionId: number): string {
  return `schedule_rules_collection_${collectionId}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildExcelHtml(params: {
  title: string;
  weekLabel: string;
  rows: Array<{
    workDate: string;
    weekdayLabel: string;
    shiftTime: string;
    shiftLabel: string;
    memberNames: string;
    notes: string;
  }>;
}): string {
  const tableRows = params.rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(params.weekLabel)}</td>
          <td>${escapeHtml(row.workDate)}</td>
          <td>${escapeHtml(row.weekdayLabel)}</td>
          <td>${escapeHtml(row.shiftTime)}</td>
          <td>${escapeHtml(row.shiftLabel)}</td>
          <td>${escapeHtml(row.memberNames)}</td>
          <td>${escapeHtml(row.notes)}</td>
        </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(params.title)}</title>
</head>
<body>
  <table border="1">
    <thead>
      <tr>
        <th>周期</th>
        <th>日期</th>
        <th>星期</th>
        <th>班次时间</th>
        <th>班次名称</th>
        <th>值班人员</th>
        <th>备注</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;
}

function isNewAssistant(memberType: CollectionDetailMember['memberType']): boolean {
  return memberType === 'new_assistant' || memberType === 'intern_assistant';
}

function isSeniorAssistant(memberType: CollectionDetailMember['memberType']): boolean {
  return memberType === 'senior_assistant' || memberType === 'manager_assistant';
}

function dedupeRiskTags(tags: ScheduleRiskTag[]): ScheduleRiskTag[] {
  return Array.from(new Set(tags));
}

function toRiskPresentation(tags: ScheduleRiskTag[]): {
  riskLevel: ScheduleSlotPayload['riskLevel'];
  riskLabel: string;
} {
  if (tags.includes('NO_CANDIDATE')) {
    return {
      riskLevel: 'critical',
      riskLabel: '无人可排',
    };
  }

  if (
    tags.includes('UNDER_MIN_COUNT') ||
    tags.includes('NEW_ASSISTANT_ALONE') ||
    tags.includes('SINGLE_SHIFT')
  ) {
    return {
      riskLevel: 'warning',
      riskLabel: '需人工调整',
    };
  }

  if (tags.length > 0) {
    return {
      riskLevel: 'warning',
      riskLabel: '存在偏好风险',
    };
  }

  return {
    riskLevel: 'none',
    riskLabel: '',
  };
}

function normalizeAssignedMember(
  member: ScheduleAssignedMember,
): ScheduleAssignedMember {
  return {
    ...member,
    assignmentId: member.assignmentId ?? null,
    assignmentSource: member.assignmentSource ?? 'auto',
    riskTags: member.riskTags ?? [],
    notes: member.notes ?? null,
    maxWeeklyShifts: member.maxWeeklyShifts,
  };
}

function toDetailLikeMember(
  member: CollectionDetailPayload['candidateMembers'][number],
): CollectionDetailMember {
  return {
    ...member,
    canSoloShift: false,
    reliabilityTag: false,
    isManualAdded: false,
  };
}

function computeSlotRiskTags(
  slot: ScheduleSlotPayload,
  members: ScheduleAssignedMember[],
  ruleConfig: ScheduleRuleConfig,
  assignedCountMap: Map<number, number>,
): ScheduleRiskTag[] {
  const tags: ScheduleRiskTag[] = [];

  if (members.length === 0) {
    tags.push('NO_CANDIDATE', 'UNDER_MIN_COUNT', 'UNDER_REQUIRED_COUNT');
    return dedupeRiskTags(tags);
  }

  if (members.length < slot.minCount) {
    tags.push('UNDER_MIN_COUNT');
  }

  if (members.length < slot.defaultRequiredCount) {
    tags.push('UNDER_REQUIRED_COUNT');
  }

  if (members.length === 1) {
    tags.push('SINGLE_SHIFT');

    if (isNewAssistant(members[0].memberType)) {
      tags.push('NEW_ASSISTANT_ALONE');
    }
  }

  const hasNew = members.some((member) => isNewAssistant(member.memberType));
  const hasSenior = members.some((member) => isSeniorAssistant(member.memberType));

  if (hasNew && !hasSenior) {
    tags.push('NO_SENIOR_WITH_NEW');
  }

  if (members.length >= 2) {
    const colleges = new Set(members.map((member) => member.college));
    const grades = new Set(members.map((member) => member.grade));
    const genders = new Set(members.map((member) => member.gender));

    if (ruleConfig.preferCrossCollege && colleges.size < 2) {
      tags.push('SAME_COLLEGE');
    }

    if (ruleConfig.preferCrossGrade && grades.size < 2) {
      tags.push('SAME_GRADE');
    }

    if (ruleConfig.preferGenderBalance && genders.size < 2) {
      tags.push('SAME_GENDER');
    }
  }

  members.forEach((member) => {
    const assignedCount = assignedCountMap.get(member.userId) ?? 0;

    if (assignedCount > member.maxWeeklyShifts) {
      tags.push('OVER_MAX_WEEKLY_SHIFTS');
    }
  });

  return dedupeRiskTags(tags);
}

function summarizePlan(slots: ScheduleSlotPayload[]): SchedulePlanSummary {
  const totalAssignments = slots.reduce((sum, slot) => sum + slot.assignedCount, 0);
  const assignedCountMap = new Map<number, number>();
  slots.forEach((slot) => {
    slot.assignedMembers.forEach((member) => {
      assignedCountMap.set(member.userId, (assignedCountMap.get(member.userId) ?? 0) + 1);
    });
  });
  const assignedCounts = Array.from(assignedCountMap.values());
  const averageAssignedCount =
    assignedCounts.length > 0 ? totalAssignments / assignedCounts.length : 0;

  return {
    totalSlots: slots.length,
    fullStaffedSlots: slots.filter((slot) => slot.assignedCount >= slot.defaultRequiredCount).length,
    coveredSlots: slots.filter((slot) => slot.assignedCount > 0).length,
    emptySlots: slots.filter((slot) => slot.assignedCount === 0).length,
    singlePersonSlots: slots.filter((slot) => slot.assignedCount === 1).length,
    underRequiredSlots: slots.filter((slot) => slot.assignedCount < slot.defaultRequiredCount).length,
    averageAssignedCount: Number(averageAssignedCount.toFixed(2)),
    maxAssignedCount: assignedCounts.length > 0 ? Math.max(...assignedCounts) : 0,
    minAssignedCount: assignedCounts.length > 0 ? Math.min(...assignedCounts) : 0,
    riskCount: slots.reduce((sum, slot) => sum + slot.riskTags.length, 0),
  };
}

function scorePlan(strategyKey: ScheduleStrategyKey, slots: ScheduleSlotPayload[]): number {
  let score = 1000;
  const summary = summarizePlan(slots);

  slots.forEach((slot) => {
    if (slot.riskTags.includes('NO_CANDIDATE')) {
      score -= strategyKey === 'coverage_first' ? 220 : 260;
    }
    if (slot.riskTags.includes('UNDER_MIN_COUNT')) {
      score -= 160;
    }
    if (slot.riskTags.includes('UNDER_REQUIRED_COUNT')) {
      score -= strategyKey === 'full_staffing_first' ? 90 : 60;
    }
    if (slot.riskTags.includes('SINGLE_SHIFT')) {
      score -= strategyKey === 'full_staffing_first' ? 80 : 45;
    }
    if (slot.riskTags.includes('NEW_ASSISTANT_ALONE')) {
      score -= 140;
    }
    if (slot.riskTags.includes('NO_SENIOR_WITH_NEW')) {
      score -= 80;
    }
    if (slot.riskTags.includes('SAME_COLLEGE')) {
      score -= strategyKey === 'balanced_fairness' ? 30 : 12;
    }
    if (slot.riskTags.includes('SAME_GRADE')) {
      score -= strategyKey === 'balanced_fairness' ? 30 : 12;
    }
    if (slot.riskTags.includes('SAME_GENDER')) {
      score -= strategyKey === 'balanced_fairness' ? 24 : 10;
    }
    if (slot.riskTags.includes('OVER_MAX_WEEKLY_SHIFTS')) {
      score -= 200;
    }
  });

  if (strategyKey === 'coverage_first') {
    score += summary.coveredSlots * 24 + summary.fullStaffedSlots * 8;
  } else if (strategyKey === 'full_staffing_first') {
    score += summary.fullStaffedSlots * 26 + summary.coveredSlots * 14;
  } else {
    score += summary.fullStaffedSlots * 18 + summary.coveredSlots * 16;
    score -= (summary.maxAssignedCount - summary.minAssignedCount) * 24;
  }

  return Math.max(0, Math.round(score / 10));
}

function toCandidateSummary(member: CollectionDetailMember): string {
  return `${member.college} · ${member.grade}`;
}

function parseRuleConfig(rawValue: string | null): ScheduleRuleConfig {
  if (!rawValue) {
    return { ...DEFAULT_RULE_CONFIG };
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<ScheduleRuleConfig>;

    return {
      preferCrossCollege: parsed.preferCrossCollege ?? DEFAULT_RULE_CONFIG.preferCrossCollege,
      preferCrossGrade: parsed.preferCrossGrade ?? DEFAULT_RULE_CONFIG.preferCrossGrade,
      preferGenderBalance:
        parsed.preferGenderBalance ?? DEFAULT_RULE_CONFIG.preferGenderBalance,
      preferSeniorNewPair:
        parsed.preferSeniorNewPair ?? DEFAULT_RULE_CONFIG.preferSeniorNewPair,
      prioritizeReliability:
        parsed.prioritizeReliability ?? DEFAULT_RULE_CONFIG.prioritizeReliability,
    };
  } catch {
    return { ...DEFAULT_RULE_CONFIG };
  }
}

function parseDraftStore(rawValue: string | null, ruleConfig: ScheduleRuleConfig): StoredScheduleDraft | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredScheduleDraft>;

    if (!parsed || !Array.isArray(parsed.plans)) {
      return null;
    }

    return {
      ruleConfig: parsed.ruleConfig ?? ruleConfig,
      recommendedStrategy: parsed.recommendedStrategy ?? null,
      selectedStrategyKey: parsed.selectedStrategyKey ?? parsed.recommendedStrategy ?? null,
      plans: parsed.plans.map((plan) => ({
        strategyKey: plan.strategyKey ?? 'coverage_first',
        strategyName: plan.strategyName ?? STRATEGY_NAME_MAP[plan.strategyKey ?? 'coverage_first'],
        score: plan.score ?? 0,
        summary: plan.summary ?? {
          totalSlots: 0,
          fullStaffedSlots: 0,
          coveredSlots: 0,
          emptySlots: 0,
          singlePersonSlots: 0,
          underRequiredSlots: 0,
          averageAssignedCount: 0,
          maxAssignedCount: 0,
          minAssignedCount: 0,
          riskCount: 0,
        },
        slots: (plan.slots ?? []).map((slot) => ({
          ...slot,
          assignedMembers: (slot.assignedMembers ?? []).map((member) =>
            normalizeAssignedMember(member),
          ),
        })),
      })),
    };
  } catch {
    return null;
  }
}

async function readSystemSettingsMap(
  executor: Pool | PoolConnection,
  keys: string[],
): Promise<Record<string, string>> {
  if (keys.length === 0) {
    return {};
  }

  const placeholders = keys.map(() => '?').join(', ');
  const [rows] = await executor.query<SystemSettingRow[]>(
    `
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key IN (${placeholders})
    `,
    keys,
  );

  return rows.reduce<Record<string, string>>((accumulator, row) => {
    accumulator[row.setting_key] = row.setting_value;
    return accumulator;
  }, {});
}

async function upsertSystemSetting(
  connection: PoolConnection,
  settingKey: string,
  settingValue: string,
  description: string,
  updatedBy: number,
): Promise<void> {
  await connection.query(
    `
      INSERT INTO system_settings (
        setting_key,
        setting_value,
        description,
        updated_by
      ) VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        setting_value = VALUES(setting_value),
        description = VALUES(description),
        updated_by = VALUES(updated_by)
    `,
    [settingKey, settingValue, description, updatedBy],
  );
}

async function getCollectionById(
  executor: Pool | PoolConnection,
  collectionId: number,
): Promise<CollectionRow | null> {
  const [rows] = await executor.query<CollectionRow[]>(
    `
      SELECT
        collection_id,
        title,
        teaching_week,
        week_start_date,
        week_end_date,
        status,
        total_users,
        submitted_users
      FROM availability_collections
      WHERE collection_id = ?
      LIMIT 1
    `,
    [collectionId],
  );

  return rows[0] ?? null;
}

async function getScheduleByCollectionId(
  executor: Pool | PoolConnection,
  collectionId: number,
): Promise<ScheduleRow | null> {
  const [rows] = await executor.query<ScheduleRow[]>(
    `
      SELECT
        schedule_id,
        collection_id,
        week_start_date,
        week_end_date,
        status,
        risk_summary,
        confirmed_by,
        confirmed_at
      FROM schedules
      WHERE collection_id = ?
      ORDER BY schedule_id DESC
      LIMIT 1
    `,
    [collectionId],
  );

  return rows[0] ?? null;
}

async function listScheduleAssignments(
  executor: Pool | PoolConnection,
  scheduleId: number,
): Promise<AssignmentRow[]> {
  const [rows] = await executor.query<AssignmentRow[]>(
    `
      SELECT
        assignment_id,
        schedule_id,
        work_date,
        shift_template_id,
        user_id,
        assignment_source,
        risk_tags,
        notes
      FROM schedule_assignments
      WHERE schedule_id = ?
      ORDER BY work_date ASC, shift_template_id ASC, assignment_id ASC
    `,
    [scheduleId],
  );

  return rows;
}

async function listUserShiftLimits(
  executor: Pool | PoolConnection,
  collectionId: number,
  defaultLimit: number,
): Promise<Map<number, number>> {
  const [rows] = await executor.query<UserShiftLimitRow[]>(
    `
      SELECT
        user_id,
        MAX(max_weekly_shifts) AS max_weekly_shifts
      FROM availabilities
      WHERE collection_id = ?
      GROUP BY user_id
    `,
    [collectionId],
  );

  const result = new Map<number, number>();
  rows.forEach((row) => {
    result.set(row.user_id, row.max_weekly_shifts ?? defaultLimit);
  });

  return result;
}

async function getRuleConfig(
  executor: Pool | PoolConnection,
  collectionId: number,
): Promise<ScheduleRuleConfig> {
  const settings = await readSystemSettingsMap(executor, [buildScheduleRuleKey(collectionId)]);
  return parseRuleConfig(settings[buildScheduleRuleKey(collectionId)] ?? null);
}

async function saveRuleConfig(
  connection: PoolConnection,
  collectionId: number,
  input: SaveScheduleRulesInput,
  updatedBy: number,
): Promise<void> {
  await upsertSystemSetting(
    connection,
    buildScheduleRuleKey(collectionId),
    JSON.stringify(input),
    'Schedule generation rule flags for the current collection',
    updatedBy,
  );
}

function buildShiftSlots(detail: CollectionDetailPayload): ShiftSlot[] {
  return detail.slots.map((slot) => ({
    slotId: `${slot.workDate}-${slot.shiftTemplateId}`,
    date: slot.workDate,
    weekday: slot.weekday,
    dateLabel: slot.dateLabel,
    shiftTemplateId: slot.shiftTemplateId,
    shiftLabel: slot.shiftLabel,
    startTime: slot.startTime,
    endTime: slot.endTime,
    requiredCount: slot.defaultRequiredCount,
    minCount: slot.minCount,
    allowSingle: slot.allowSolo,
    candidates: slot.members,
  }));
}

function buildCandidateUsers(
  detail: CollectionDetailPayload,
  maxWeeklyShiftsMap: Map<number, number>,
  defaultLimit: number,
): CandidateUser[] {
  const slotIdsByUserId = new Map<number, string[]>();

  detail.slots.forEach((slot) => {
    const slotId = `${slot.workDate}-${slot.shiftTemplateId}`;

    slot.members.forEach((member) => {
      const current = slotIdsByUserId.get(member.userId) ?? [];
      current.push(slotId);
      slotIdsByUserId.set(member.userId, current);
    });
  });

  return detail.candidateMembers.map((member) => ({
    ...toDetailLikeMember(member),
    maxWeeklyShifts: maxWeeklyShiftsMap.get(member.userId) ?? defaultLimit,
    assignedCount: 0,
    availableSlotIds: slotIdsByUserId.get(member.userId) ?? [],
    userScarcityValue: 0,
  }));
}

function buildCandidateMembers(
  detail: CollectionDetailPayload,
  selectedPlan: AssignmentPlan | null,
): ScheduleCandidateMember[] {
  const assignedUserIds = new Set<number>();

  selectedPlan?.slots.forEach((slot) => {
    slot.assignedMembers.forEach((member) => {
      assignedUserIds.add(member.userId);
    });
  });

  return detail.candidateMembers.map((member) => ({
    ...toDetailLikeMember(member),
    recommended: !assignedUserIds.has(member.userId),
    summary: toCandidateSummary(toDetailLikeMember(member)),
  }));
}

function buildDraftStoreFromGeneratedPlans(params: {
  ruleConfig: ScheduleRuleConfig;
  plans: AssignmentPlan[];
  recommendedStrategy: ScheduleStrategyKey;
}): StoredScheduleDraft {
  return {
    ruleConfig: params.ruleConfig,
    recommendedStrategy: params.recommendedStrategy,
    selectedStrategyKey: params.recommendedStrategy,
    plans: params.plans,
  };
}

function normalizePlanAfterManualChange(
  plan: AssignmentPlan,
  ruleConfig: ScheduleRuleConfig,
): AssignmentPlan {
  const assignedCountMap = new Map<number, number>();

  plan.slots.forEach((slot) => {
    slot.assignedMembers.forEach((member) => {
      assignedCountMap.set(member.userId, (assignedCountMap.get(member.userId) ?? 0) + 1);
    });
  });

  const slots = plan.slots.map((slot) => {
    const normalizedMembers = slot.assignedMembers.map((member) =>
      normalizeAssignedMember(member),
    );
    const riskTags = computeSlotRiskTags(slot, normalizedMembers, ruleConfig, assignedCountMap);
    const riskPresentation = toRiskPresentation(riskTags);

    return {
      ...slot,
      assignedCount: normalizedMembers.length,
      riskTags,
      riskLevel: riskPresentation.riskLevel,
      riskLabel: riskPresentation.riskLabel,
      assignedMembers: normalizedMembers.map((member) => ({
        ...member,
        riskTags,
      })),
    };
  });

  return {
    ...plan,
    slots,
    summary: summarizePlan(slots),
    score: scorePlan(plan.strategyKey, slots),
  };
}

function buildWorkspacePayload(params: {
  collection: CollectionRow;
  schedule: ScheduleRow | null;
  draftStore: StoredScheduleDraft | null;
  ruleConfig: ScheduleRuleConfig;
  candidateMembers: ScheduleCandidateMember[];
}): ScheduleWorkspacePayload {
  const { collection, schedule, draftStore, ruleConfig, candidateMembers } = params;

  return {
    collectionId: collection.collection_id,
    title: collection.title,
    teachingWeek: collection.teaching_week,
    weekLabel: formatWeekLabel(collection.week_start_date, collection.week_end_date),
    collectionStatus: collection.status,
    totalUsers: collection.total_users,
    submittedUsers: collection.submitted_users,
    progressPercent:
      collection.total_users > 0
        ? Math.round((collection.submitted_users / collection.total_users) * 100)
        : 0,
    scheduleId: schedule?.schedule_id ?? null,
    scheduleStatus: (schedule?.status ?? 'none') as ScheduleStatus,
    confirmedAt: formatDateTime(schedule?.confirmed_at ?? null),
    ruleConfig: draftStore?.ruleConfig ?? ruleConfig,
    plans: draftStore?.plans ?? [],
    recommendedStrategy: draftStore?.recommendedStrategy ?? null,
    selectedStrategyKey:
      draftStore?.selectedStrategyKey ?? draftStore?.recommendedStrategy ?? null,
    candidateMembers,
  };
}

async function upsertScheduleRow(
  connection: PoolConnection,
  collection: CollectionRow,
): Promise<number> {
  const existingSchedule = await getScheduleByCollectionId(connection, collection.collection_id);

  if (existingSchedule) {
    if (existingSchedule.status === 'published') {
      throw new AppError(
        409,
        'SCHEDULE_ALREADY_PUBLISHED',
        'The current collection has already been published. Please adjust the published schedule instead of regenerating it.',
      );
    }

    await connection.query(
      `
        UPDATE schedules
        SET
          status = 'draft',
          confirmed_by = NULL,
          confirmed_at = NULL
        WHERE schedule_id = ?
      `,
      [existingSchedule.schedule_id],
    );

    return existingSchedule.schedule_id;
  }

  const [result] = await connection.query<ResultSetHeader>(
    `
      INSERT INTO schedules (
        collection_id,
        week_start_date,
        week_end_date,
        status,
        risk_summary,
        confirmed_by,
        confirmed_at
      ) VALUES (?, ?, ?, 'draft', NULL, NULL, NULL)
    `,
    [
      collection.collection_id,
      formatDateOnly(collection.week_start_date),
      formatDateOnly(collection.week_end_date),
    ],
  );

  return result.insertId;
}

function findPlanByStrategy(
  draftStore: StoredScheduleDraft,
  strategyKey: ScheduleStrategyKey,
): AssignmentPlan {
  const plan = draftStore.plans.find((item) => item.strategyKey === strategyKey);

  if (!plan) {
    throw new AppError(404, 'SCHEDULE_PLAN_NOT_FOUND', `Strategy ${strategyKey} is not available.`);
  }

  return plan;
}

function ensureSlotExists(
  plan: AssignmentPlan,
  workDate: string,
  shiftTemplateId: number,
): ScheduleSlotPayload {
  const slot = plan.slots.find(
    (item) => item.workDate === workDate && item.shiftTemplateId === shiftTemplateId,
  );

  if (!slot) {
    throw new AppError(404, 'SLOT_NOT_FOUND', 'The requested schedule slot does not exist.');
  }

  return slot;
}

function buildPublishedPlanFromAssignments(params: {
  detail: CollectionDetailPayload;
  assignments: AssignmentRow[];
  ruleConfig: ScheduleRuleConfig;
  strategyKey: ScheduleStrategyKey;
}): AssignmentPlan {
  const { detail, assignments, ruleConfig, strategyKey } = params;
  const membersByUserId = new Map<number, CollectionDetailMember>();

  detail.candidateMembers.forEach((member) => {
    membersByUserId.set(member.userId, toDetailLikeMember(member));
  });
  detail.slots.forEach((slot) => {
    slot.members.forEach((member) => {
      membersByUserId.set(member.userId, member);
    });
  });

  const assignedCountMap = new Map<number, number>();
  assignments.forEach((assignment) => {
    assignedCountMap.set(assignment.user_id, (assignedCountMap.get(assignment.user_id) ?? 0) + 1);
  });

  const slots = detail.slots.map((slot) => {
    const slotMembers = assignments
      .filter(
        (assignment) =>
          formatDateOnly(assignment.work_date) === slot.workDate &&
          assignment.shift_template_id === slot.shiftTemplateId,
      )
      .map((assignment) => {
        const member = membersByUserId.get(assignment.user_id);

        if (!member) {
          return null;
        }

        return {
          ...member,
          assignmentId: assignment.assignment_id,
          assignmentSource: assignment.assignment_source,
          riskTags: [],
          notes: assignment.notes,
          maxWeeklyShifts: assignedCountMap.get(assignment.user_id) ?? 99,
        } satisfies ScheduleAssignedMember;
      })
      .filter(isNonNull);
    const riskTags = computeSlotRiskTags(
      {
        slotId: `${slot.workDate}-${slot.shiftTemplateId}`,
        workDate: slot.workDate,
        weekday: slot.weekday,
        dateLabel: slot.dateLabel,
        shiftTemplateId: slot.shiftTemplateId,
        shiftLabel: slot.shiftLabel,
        startTime: slot.startTime,
        endTime: slot.endTime,
        defaultRequiredCount: slot.defaultRequiredCount,
        minCount: slot.minCount,
        allowSolo: slot.allowSolo,
        assignedCount: slotMembers.length,
        riskLevel: 'none',
        riskLabel: '',
        riskTags: [],
        assignedMembers: slotMembers,
      },
      slotMembers,
      ruleConfig,
      assignedCountMap,
    );
    const riskPresentation = toRiskPresentation(riskTags);

    return {
      slotId: `${slot.workDate}-${slot.shiftTemplateId}`,
      workDate: slot.workDate,
      weekday: slot.weekday,
      dateLabel: slot.dateLabel,
      shiftTemplateId: slot.shiftTemplateId,
      shiftLabel: slot.shiftLabel,
      startTime: slot.startTime,
      endTime: slot.endTime,
      defaultRequiredCount: slot.defaultRequiredCount,
      minCount: slot.minCount,
      allowSolo: slot.allowSolo,
      assignedCount: slotMembers.length,
      riskLevel: riskPresentation.riskLevel,
      riskLabel: riskPresentation.riskLabel,
      riskTags,
      assignedMembers: slotMembers.map((member) => ({
        ...member,
        riskTags,
      })),
    };
  });

  return {
    strategyKey,
    strategyName: STRATEGY_NAME_MAP[strategyKey],
    score: scorePlan(strategyKey, slots),
    summary: summarizePlan(slots),
    slots,
  };
}

function buildScheduleShareDays(
  plan: AssignmentPlan,
  viewer: Pick<UserRecord, 'userId' | 'role'>,
): ScheduleShareDayView[] {
  const days = new Map<string, ScheduleShareDayView>();
  const showFullSchedule = viewer.role === 'admin' || viewer.role === 'super_admin';

  plan.slots.forEach((slot) => {
    const visibleMembers = (showFullSchedule
      ? slot.assignedMembers
      : slot.assignedMembers.filter((member) => member.userId === viewer.userId))
      .map((member) => ({
        userId: member.userId,
        studentId: member.studentId,
        name: member.name,
        role: member.role,
        memberType: member.memberType,
        isSelf: member.userId === viewer.userId,
      }));

    if (visibleMembers.length === 0) {
      return;
    }

    const currentDay = days.get(slot.workDate) ?? {
      workDate: slot.workDate,
      dateLabel: slot.dateLabel,
      weekday: slot.weekday,
      weekdayLabel: getWeekdayLabel(slot.weekday),
      slots: [],
    };

    currentDay.slots.push({
      workDate: slot.workDate,
      dateLabel: slot.dateLabel,
      weekday: slot.weekday,
      weekdayLabel: getWeekdayLabel(slot.weekday),
      shiftTemplateId: slot.shiftTemplateId,
      shiftLabel: slot.shiftLabel,
      startTime: slot.startTime,
      endTime: slot.endTime,
      assignedMembers: visibleMembers,
    });

    days.set(slot.workDate, currentDay);
  });

  return Array.from(days.values());
}

export async function getScheduleWorkspace(
  pool: Pool,
  collectionId: number,
): Promise<ScheduleWorkspacePayload> {
  const collection = await getCollectionById(pool, collectionId);

  if (!collection) {
    throw new AppError(404, 'COLLECTION_NOT_FOUND', 'The requested collection does not exist.');
  }

  const [detail, schedule, ruleConfig] = await Promise.all([
    getCollectionDetail(pool, collectionId),
    getScheduleByCollectionId(pool, collectionId),
    getRuleConfig(pool, collectionId),
  ]);

  let draftStore = parseDraftStore(schedule?.risk_summary ?? null, ruleConfig);

  if (!draftStore && schedule && schedule.status === 'published') {
    const assignments = await listScheduleAssignments(pool, schedule.schedule_id);
    const plan = buildPublishedPlanFromAssignments({
      detail,
      assignments,
      ruleConfig,
      strategyKey: 'coverage_first',
    });
    draftStore = {
      ruleConfig,
      recommendedStrategy: plan.strategyKey,
      selectedStrategyKey: plan.strategyKey,
      plans: [plan],
    };
  }

  const selectedPlan =
    draftStore?.plans.find((item) => item.strategyKey === draftStore.selectedStrategyKey) ?? null;

  return buildWorkspacePayload({
    collection,
    schedule,
    draftStore,
    ruleConfig,
    candidateMembers: buildCandidateMembers(detail, selectedPlan),
  });
}

export async function updateScheduleRules(
  pool: Pool,
  collectionId: number,
  actorUserId: number,
  input: SaveScheduleRulesInput,
): Promise<ScheduleWorkspacePayload> {
  const collection = await getCollectionById(pool, collectionId);

  if (!collection) {
    throw new AppError(404, 'COLLECTION_NOT_FOUND', 'The requested collection does not exist.');
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await saveRuleConfig(connection, collectionId, input, actorUserId);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getScheduleWorkspace(pool, collectionId);
}

export async function generateScheduleDraft(
  pool: Pool,
  collectionId: number,
  _actorUserId: number,
): Promise<ScheduleWorkspacePayload> {
  const collection = await getCollectionById(pool, collectionId);

  if (!collection) {
    throw new AppError(404, 'COLLECTION_NOT_FOUND', 'The requested collection does not exist.');
  }

  if (collection.status !== 'completed') {
    throw new AppError(
      409,
      'COLLECTION_NOT_READY',
      'Please wait until the collection is completed before generating the schedule.',
    );
  }

  const [detail, workSettings, ruleConfig] = await Promise.all([
    getCollectionDetail(pool, collectionId),
    getSchedulerWorkSettings(pool),
    getRuleConfig(pool, collectionId),
  ]);
  const maxWeeklyShiftsMap = await listUserShiftLimits(
    pool,
    collectionId,
    workSettings.maxWeeklyShiftsLimit,
  );
  const plannerResult = generateSchedulePlans({
    slots: buildShiftSlots(detail),
    users: buildCandidateUsers(detail, maxWeeklyShiftsMap, workSettings.maxWeeklyShiftsLimit),
    ruleConfig,
  });
  const draftStore = buildDraftStoreFromGeneratedPlans({
    ruleConfig,
    plans: plannerResult.plans,
    recommendedStrategy: plannerResult.recommendedStrategy,
  });

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const scheduleId = await upsertScheduleRow(connection, collection);

    await connection.query(
      `
        DELETE FROM schedule_assignments
        WHERE schedule_id = ?
      `,
      [scheduleId],
    );

    await connection.query(
      `
        UPDATE schedules
        SET risk_summary = ?, status = 'draft', confirmed_by = NULL, confirmed_at = NULL
        WHERE schedule_id = ?
      `,
      [JSON.stringify(draftStore), scheduleId],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getScheduleWorkspace(pool, collectionId);
}

export async function updateScheduleAssignmentManually(
  pool: Pool,
  collectionId: number,
  scheduleId: number,
  _actorUserId: number,
  input: ManualScheduleAssignmentInput,
): Promise<{ workspace: ScheduleWorkspacePayload; notifyUserId: number | null }> {
  const [collection, detail, schedule, ruleConfig] = await Promise.all([
    getCollectionById(pool, collectionId),
    getCollectionDetail(pool, collectionId),
    getScheduleByCollectionId(pool, collectionId),
    getRuleConfig(pool, collectionId),
  ]);

  if (!collection || !schedule || schedule.schedule_id !== scheduleId) {
    throw new AppError(404, 'SCHEDULE_NOT_FOUND', 'The requested schedule does not exist.');
  }

  const draftStore = parseDraftStore(schedule.risk_summary ?? null, ruleConfig);

  if (!draftStore) {
    throw new AppError(409, 'SCHEDULE_DRAFT_REQUIRED', 'Please generate a draft before adjusting assignments.');
  }

  const plan = findPlanByStrategy(draftStore, input.strategyKey);
  const slot = ensureSlotExists(plan, input.workDate, input.shiftTemplateId);
  const detailMemberMap = new Map<number, CollectionDetailMember>();
  detail.candidateMembers.forEach((member) => {
    detailMemberMap.set(member.userId, toDetailLikeMember(member));
  });
  detail.slots.forEach((item) => {
    item.members.forEach((member) => {
      detailMemberMap.set(member.userId, member);
    });
  });
  const targetMember = detailMemberMap.get(input.userId);

  if (!targetMember) {
    throw new AppError(404, 'USER_NOT_FOUND', 'The requested user cannot be scheduled.');
  }

  const existingMemberIndex = slot.assignedMembers.findIndex((member) => member.userId === input.userId);

  if (input.action === 'remove') {
    if (existingMemberIndex >= 0) {
      slot.assignedMembers.splice(existingMemberIndex, 1);
    }
  } else if (existingMemberIndex === -1) {
    const maxWeeklyShifts =
      plan.slots
        .flatMap((item) => item.assignedMembers)
        .find((member) => member.userId === input.userId)?.maxWeeklyShifts ?? 3;

    slot.assignedMembers.push({
      ...targetMember,
      assignmentId: null,
      assignmentSource: 'manual',
      riskTags: [],
      notes: slot.assignedMembers.some((member) => member.userId === input.userId)
        ? 'Manual balancing'
        : 'Forced assignment outside submitted availability',
      maxWeeklyShifts,
    });
  }

  slot.assignedCount = slot.assignedMembers.length;
  const normalizedPlan = normalizePlanAfterManualChange(plan, ruleConfig);
  draftStore.selectedStrategyKey = input.strategyKey;
  draftStore.plans = draftStore.plans.map((item) =>
    item.strategyKey === input.strategyKey ? normalizedPlan : item,
  );

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query(
      `
        UPDATE schedules
        SET
          risk_summary = ?,
          status = CASE WHEN status = 'published' THEN 'adjusted' ELSE status END,
          confirmed_by = CASE WHEN status = 'published' THEN NULL ELSE confirmed_by END,
          confirmed_at = CASE WHEN status = 'published' THEN NULL ELSE confirmed_at END
        WHERE schedule_id = ?
      `,
      [JSON.stringify(draftStore), scheduleId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const slotFromDetail = detail.slots.find(
    (item) => item.workDate === input.workDate && item.shiftTemplateId === input.shiftTemplateId,
  );
  const notifyUserId =
    input.action === 'add' && !slotFromDetail?.members.some((member) => member.userId === input.userId)
      ? input.userId
      : null;

  return {
    workspace: await getScheduleWorkspace(pool, collectionId),
    notifyUserId,
  };
}

export async function publishSchedule(
  pool: Pool,
  collectionId: number,
  actorUserId: number,
  input: PublishScheduleInput,
): Promise<ScheduleWorkspacePayload> {
  const schedule = await getScheduleByCollectionId(pool, collectionId);

  if (!schedule) {
    throw new AppError(404, 'SCHEDULE_NOT_FOUND', 'Please generate a draft before publishing.');
  }

  const draftStore = parseDraftStore(schedule.risk_summary ?? null, DEFAULT_RULE_CONFIG);

  if (!draftStore) {
    throw new AppError(409, 'SCHEDULE_DRAFT_REQUIRED', 'Please generate a draft before publishing.');
  }

  const selectedPlan = findPlanByStrategy(draftStore, input.strategyKey);
  draftStore.selectedStrategyKey = input.strategyKey;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `
        DELETE FROM schedule_assignments
        WHERE schedule_id = ?
      `,
      [schedule.schedule_id],
    );

    for (const slot of selectedPlan.slots) {
      for (const member of slot.assignedMembers) {
        await connection.query(
          `
            INSERT INTO schedule_assignments (
              schedule_id,
              work_date,
              shift_template_id,
              user_id,
              assignment_source,
              risk_tags,
              notes,
              created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            schedule.schedule_id,
            slot.workDate,
            slot.shiftTemplateId,
            member.userId,
            member.assignmentSource,
            JSON.stringify(slot.riskTags),
            member.notes,
            actorUserId,
          ],
        );
      }
    }

    await connection.query(
      `
        UPDATE schedules
        SET
          status = 'published',
          confirmed_by = ?,
          confirmed_at = CURRENT_TIMESTAMP,
          risk_summary = ?
        WHERE schedule_id = ?
      `,
      [actorUserId, JSON.stringify(draftStore), schedule.schedule_id],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getScheduleWorkspace(pool, collectionId);
}

export async function exportPublishedScheduleAsExcel(
  pool: Pool,
  collectionId: number,
  actorUserId: number,
): Promise<{
  exportedFileId: number;
  scheduleId: number;
  fileName: string;
  localPath: string;
  generatedAt: string;
}> {
  const collection = await getCollectionById(pool, collectionId);

  if (!collection) {
    throw new AppError(404, 'COLLECTION_NOT_FOUND', 'The requested collection does not exist.');
  }

  const schedule = await getScheduleByCollectionId(pool, collectionId);

  if (!schedule || schedule.status !== 'published') {
    throw new AppError(
      409,
      'SCHEDULE_NOT_PUBLISHED',
      'Only published schedules can be exported.',
    );
  }

  const [detail, assignments, workSettings] = await Promise.all([
    getCollectionDetail(pool, collectionId),
    listScheduleAssignments(pool, schedule.schedule_id),
    getSchedulerWorkSettings(pool),
  ]);
  const plan = buildPublishedPlanFromAssignments({
    detail,
    assignments,
    ruleConfig: DEFAULT_RULE_CONFIG,
    strategyKey: 'coverage_first',
  });

  const rows = plan.slots.map((slot) => {
    const notes = Array.from(
      new Set(
        slot.assignedMembers
          .map((member) => member.notes?.trim() ?? '')
          .filter((item) => item.length > 0),
      ),
    ).join('；');

    return {
      workDate: slot.workDate,
      weekdayLabel: getWeekdayLabel(slot.weekday),
      shiftTime: `${slot.startTime} - ${slot.endTime}`,
      shiftLabel: slot.shiftLabel,
      memberNames:
        slot.assignedMembers.length > 0
          ? slot.assignedMembers.map((member) => member.name).join('、')
          : '无人值班',
      notes: notes || slot.riskLabel || '',
    };
  });

  const exportDirectorySetting = workSettings.exportDirectory.trim() || DEFAULT_EXPORT_DIRECTORY;
  const exportsDirectory = path.resolve(WORKSPACE_ROOT, exportDirectorySetting);
  fs.mkdirSync(exportsDirectory, { recursive: true });

  const fileName = `schedule-${formatDateOnly(collection.week_start_date)}-to-${formatDateOnly(collection.week_end_date)}.xls`;
  const localPath = path.join(exportsDirectory, fileName);
  const fileContent = buildExcelHtml({
    title: collection.title,
    weekLabel: formatWeekLabel(collection.week_start_date, collection.week_end_date),
    rows,
  });
  fs.writeFileSync(localPath, fileContent, 'utf8');

  const [result] = await pool.query<ExportedFileRow[] & ResultSetHeader>(
    `
      INSERT INTO exported_files (
        schedule_id,
        export_type,
        file_name,
        local_path,
        generated_by
      ) VALUES (?, 'excel', ?, ?, ?)
    `,
    [schedule.schedule_id, fileName, localPath, actorUserId],
  );

  return {
    exportedFileId: (result as ResultSetHeader).insertId,
    scheduleId: schedule.schedule_id,
    fileName,
    localPath,
    generatedAt: new Date().toISOString(),
  };
}

export async function getScheduleSharePayload(
  pool: Pool,
  collectionId: number,
  viewer: Pick<UserRecord, 'userId' | 'role' | 'name'>,
): Promise<{
  collectionId: number;
  scheduleId: number;
  title: string;
  teachingWeek: number | null;
  weekLabel: string;
  confirmedAt: string | null;
  viewerRole: UserRecord['role'];
  viewerName: string;
  viewScope: 'full' | 'self_only';
  emptyStateMessage: string | null;
  days: ScheduleShareDayView[];
}> {
  const collection = await getCollectionById(pool, collectionId);

  if (!collection) {
    throw new AppError(404, 'COLLECTION_NOT_FOUND', 'The requested collection does not exist.');
  }

  const schedule = await getScheduleByCollectionId(pool, collectionId);

  if (!schedule || schedule.status !== 'published') {
    throw new AppError(
      409,
      'SCHEDULE_NOT_PUBLISHED',
      'Only published schedules can be shared.',
    );
  }

  const [detail, assignments] = await Promise.all([
    getCollectionDetail(pool, collectionId),
    listScheduleAssignments(pool, schedule.schedule_id),
  ]);

  const plan = buildPublishedPlanFromAssignments({
    detail,
    assignments,
    ruleConfig: DEFAULT_RULE_CONFIG,
    strategyKey: 'coverage_first',
  });
  const days = buildScheduleShareDays(plan, viewer);
  const isFullView = viewer.role === 'admin' || viewer.role === 'super_admin';

  return {
    collectionId: collection.collection_id,
    scheduleId: schedule.schedule_id,
    title: collection.title,
    teachingWeek: collection.teaching_week,
    weekLabel: formatWeekLabel(collection.week_start_date, collection.week_end_date),
    confirmedAt: formatDateTime(schedule.confirmed_at),
    viewerRole: viewer.role,
    viewerName: viewer.name,
    viewScope: isFullView ? 'full' : 'self_only',
    emptyStateMessage: isFullView
      ? null
      : days.length > 0
        ? null
        : '\u672c\u5468\u6ca1\u6709\u4e0e\u4f60\u76f8\u5173\u7684\u5df2\u53d1\u5e03\u6392\u73ed\u3002',
    days,
  };
}

export async function listPublishedScheduleAssignmentsForNotification(
  pool: Pool,
  scheduleId: number,
): Promise<Array<{ userId: number; workDate: string; shiftLabel: string }>> {
  const [rows] = await pool.query<
    Array<RowDataPacket & { user_id: number; work_date: Date; shift_name: string }>
  >(
    `
      SELECT
        sa.user_id,
        sa.work_date,
        st.name AS shift_name
      FROM schedule_assignments sa
      INNER JOIN shift_templates st ON st.shift_template_id = sa.shift_template_id
      WHERE sa.schedule_id = ?
      ORDER BY sa.user_id ASC, sa.work_date ASC, st.sort_order ASC
    `,
    [scheduleId],
  );

  return rows.map((row) => ({
    userId: row.user_id,
    workDate: formatDateOnly(row.work_date),
    shiftLabel: row.shift_name,
  }));
}
