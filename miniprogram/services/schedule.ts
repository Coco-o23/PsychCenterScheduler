import type { ApiRequestResult } from './request';
import { requestApi } from './request';

export type ScheduleStatus = 'none' | 'draft' | 'published' | 'adjusted';
export type ScheduleRiskLevel = 'none' | 'warning' | 'critical';
export type ScheduleRiskTag =
  | 'NO_CANDIDATE'
  | 'UNDER_MIN_COUNT'
  | 'UNDER_REQUIRED_COUNT'
  | 'SINGLE_SHIFT'
  | 'NEW_ASSISTANT_ALONE'
  | 'NO_SENIOR_WITH_NEW'
  | 'SAME_COLLEGE'
  | 'SAME_GRADE'
  | 'SAME_GENDER'
  | 'OVER_MAX_WEEKLY_SHIFTS';

export type ScheduleStrategyKey =
  | 'coverage_first'
  | 'full_staffing_first'
  | 'balanced_fairness';

export interface ScheduleRuleConfig {
  preferCrossCollege: boolean;
  preferCrossGrade: boolean;
  preferGenderBalance: boolean;
  preferSeniorNewPair: boolean;
  prioritizeReliability: boolean;
}

export interface ScheduleAssignedMember {
  userId: number;
  studentId: string;
  name: string;
  gender: 'male' | 'female';
  college: string;
  grade: string;
  role: 'assistant' | 'admin' | 'super_admin';
  memberType: 'new_assistant' | 'senior_assistant' | 'intern_assistant' | 'manager_assistant';
  canSoloShift: boolean;
  reliabilityTag: boolean;
  isManualAdded: boolean;
  assignmentId: number | null;
  assignmentSource: 'auto' | 'manual' | 'swap';
  riskTags: ScheduleRiskTag[];
  notes: string | null;
  maxWeeklyShifts: number;
}

export interface ScheduleSlotPayload {
  slotId: string;
  workDate: string;
  weekday: number;
  dateLabel: string;
  shiftTemplateId: number;
  shiftLabel: string;
  startTime: string;
  endTime: string;
  defaultRequiredCount: number;
  minCount: number;
  allowSolo: boolean;
  assignedCount: number;
  riskLevel: ScheduleRiskLevel;
  riskLabel: string;
  riskTags: ScheduleRiskTag[];
  assignedMembers: ScheduleAssignedMember[];
}

export interface ScheduleCandidateMember {
  userId: number;
  studentId: string;
  name: string;
  gender: 'male' | 'female';
  college: string;
  grade: string;
  role: 'assistant' | 'admin' | 'super_admin';
  memberType: 'new_assistant' | 'senior_assistant' | 'intern_assistant' | 'manager_assistant';
  canSoloShift: boolean;
  reliabilityTag: boolean;
  isManualAdded: boolean;
  recommended: boolean;
  summary: string;
}

export interface SchedulePlanSummary {
  totalSlots: number;
  fullStaffedSlots: number;
  coveredSlots: number;
  emptySlots: number;
  singlePersonSlots: number;
  underRequiredSlots: number;
  averageAssignedCount: number;
  maxAssignedCount: number;
  minAssignedCount: number;
  riskCount: number;
}

export interface SchedulePlan {
  strategyKey: ScheduleStrategyKey;
  strategyName: string;
  score: number;
  summary: SchedulePlanSummary;
  slots: ScheduleSlotPayload[];
}

export interface ScheduleWorkspacePayload {
  collectionId: number;
  title: string;
  teachingWeek: number | null;
  weekLabel: string;
  collectionStatus: 'pending' | 'active' | 'completed';
  totalUsers: number;
  submittedUsers: number;
  progressPercent: number;
  scheduleId: number | null;
  scheduleStatus: ScheduleStatus;
  confirmedAt: string | null;
  ruleConfig: ScheduleRuleConfig;
  plans: SchedulePlan[];
  recommendedStrategy: ScheduleStrategyKey | null;
  selectedStrategyKey: ScheduleStrategyKey | null;
  candidateMembers: ScheduleCandidateMember[];
}

export interface ManualScheduleAssignmentPayload {
  action: 'add' | 'remove';
  strategyKey: ScheduleStrategyKey;
  workDate: string;
  shiftTemplateId: number;
  userId: number;
}

export interface PublishSchedulePayload {
  strategyKey: ScheduleStrategyKey;
}

export interface ScheduleExportPayload {
  exportedFileId: number;
  scheduleId: number;
  fileName: string;
  localPath: string;
  generatedAt: string;
}

export interface ScheduleShareMemberPayload {
  userId: number;
  studentId: string;
  name: string;
  role: 'assistant' | 'admin' | 'super_admin';
  memberType: 'new_assistant' | 'senior_assistant' | 'intern_assistant' | 'manager_assistant';
  isSelf: boolean;
}

export interface ScheduleShareSlotPayload {
  workDate: string;
  dateLabel: string;
  weekday: number;
  weekdayLabel: string;
  shiftTemplateId: number;
  shiftLabel: string;
  startTime: string;
  endTime: string;
  assignedMembers: ScheduleShareMemberPayload[];
}

export interface ScheduleShareDayPayload {
  workDate: string;
  dateLabel: string;
  weekday: number;
  weekdayLabel: string;
  slots: ScheduleShareSlotPayload[];
}

export interface ScheduleSharePayload {
  collectionId: number;
  scheduleId: number;
  title: string;
  teachingWeek: number | null;
  weekLabel: string;
  confirmedAt: string | null;
  viewerRole: 'assistant' | 'admin' | 'super_admin';
  viewerName: string;
  viewScope: 'full' | 'self_only';
  emptyStateMessage: string | null;
  days: ScheduleShareDayPayload[];
}

export function fetchScheduleWorkspace(
  collectionId: number,
): Promise<ApiRequestResult<ScheduleWorkspacePayload>> {
  return requestApi<ScheduleWorkspacePayload>({
    path: `/admin/schedules/collections/${collectionId}`,
    method: 'GET',
  });
}

export function saveScheduleRules(
  collectionId: number,
  payload: ScheduleRuleConfig,
): Promise<ApiRequestResult<ScheduleWorkspacePayload>> {
  return requestApi<ScheduleWorkspacePayload, ScheduleRuleConfig>({
    path: `/admin/schedules/collections/${collectionId}/rules`,
    method: 'PUT',
    data: payload,
  });
}

export function generateSchedule(
  collectionId: number,
): Promise<ApiRequestResult<ScheduleWorkspacePayload>> {
  return requestApi<ScheduleWorkspacePayload, Record<string, never>>({
    path: `/admin/schedules/collections/${collectionId}/generate`,
    method: 'POST',
    data: {},
  });
}

export function updateScheduleAssignment(
  collectionId: number,
  scheduleId: number,
  payload: ManualScheduleAssignmentPayload,
): Promise<ApiRequestResult<ScheduleWorkspacePayload>> {
  return requestApi<ScheduleWorkspacePayload, ManualScheduleAssignmentPayload>({
    path: `/admin/schedules/collections/${collectionId}/schedules/${scheduleId}/assignments/manual`,
    method: 'PUT',
    data: payload,
  });
}

export function publishScheduleDraft(
  collectionId: number,
  payload: PublishSchedulePayload,
): Promise<ApiRequestResult<ScheduleWorkspacePayload>> {
  return requestApi<ScheduleWorkspacePayload, PublishSchedulePayload>({
    path: `/admin/schedules/collections/${collectionId}/publish`,
    method: 'POST',
    data: payload,
  });
}

export function exportPublishedSchedule(
  collectionId: number,
): Promise<ApiRequestResult<ScheduleExportPayload>> {
  return requestApi<ScheduleExportPayload, Record<string, never>>({
    path: `/admin/schedules/collections/${collectionId}/export`,
    method: 'POST',
    data: {},
  });
}

export function fetchScheduleShare(
  collectionId: number,
): Promise<ApiRequestResult<ScheduleSharePayload>> {
  return requestApi<ScheduleSharePayload>({
    path: `/schedule-share/collections/${collectionId}`,
    method: 'GET',
  });
}
