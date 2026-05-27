import type { ApiRequestResult } from './request';
import { requestApi } from './request';

export type CollectionDashboardStatus = 'pending' | 'active' | 'completed' | 'missing_semester';
export type CollectionStatus = 'pending' | 'active' | 'completed' | 'none';
export type AvailabilityRiskLevel = 'none' | 'warning' | 'critical';
export type CollectionWorkflowState =
  | 'none'
  | 'collecting'
  | 'collection_completed'
  | 'schedule_draft'
  | 'schedule_published';
export type CollectionScheduleStatus = 'none' | 'draft' | 'published' | 'adjusted';

export interface CollectionDashboardSummary {
  collectionId: number | null;
  status: CollectionDashboardStatus;
  title: string;
  teachingWeek: number | null;
  weekEndDate: string | null;
  weekLabel: string | null;
  weekStartDate: string | null;
  totalUsers: number;
  submittedUsers: number;
  progressPercent: number;
  publishedAt: string | null;
  completedAt: string | null;
  canPublish: boolean;
  hasSemesterConfiguration: boolean;
}

export interface CollectionDashboardPayload {
  summary: CollectionDashboardSummary;
  shiftTemplates: Array<{
    shiftTemplateId: number;
    name: string;
    startTime: string;
    endTime: string;
    defaultRequiredCount: number;
    minCount: number;
    allowSolo: boolean;
  }>;
  submittedMembersPreview: Array<{
    userId: number;
    name: string;
    studentId: string;
  }>;
  unsubmittedMembersPreview: Array<{
    userId: number;
    name: string;
    studentId: string;
  }>;
}

export interface CollectionFillDay {
  date: string;
  label: string;
  weekday: number;
}

export interface CollectionFillSlot {
  shiftTemplateId: number;
  shiftLabel: string;
  startTime: string;
  endTime: string;
}

export interface CurrentCollectionFillPayload {
  collectionId: number | null;
  collectionStatus: CollectionStatus;
  collectionWorkflowState: CollectionWorkflowState;
  title: string;
  teachingWeek: number | null;
  weekLabel: string | null;
  days: CollectionFillDay[];
  slots: CollectionFillSlot[];
  selectedKeys: string[];
  maxWeeklyShiftsLimit: number;
  selectedMaxWeeklyShifts: number;
  isWeekLeave: boolean;
  submittedAt: string | null;
  scheduleId: number | null;
  scheduleStatus: CollectionScheduleStatus;
  schedulePublished: boolean;
}

export interface SaveCollectionSubmissionPayload {
  saveAsDefault: boolean;
  selectedKeys: string[];
  selectedMaxWeeklyShifts: number;
  isWeekLeave: boolean;
}

export interface CollectionDetailMember {
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
}

export interface CollectionDetailSlot {
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
  availableCount: number;
  riskLevel: AvailabilityRiskLevel;
  riskLabel: string;
  members: CollectionDetailMember[];
}

export interface CollectionDetailPayload {
  collectionId: number;
  title: string;
  teachingWeek: number | null;
  weekLabel: string;
  status: 'pending' | 'active' | 'completed';
  totalUsers: number;
  submittedUsers: number;
  progressPercent: number;
  slots: CollectionDetailSlot[];
  candidateMembers: Array<{
    userId: number;
    studentId: string;
    name: string;
    gender: 'male' | 'female';
    college: string;
    grade: string;
    role: 'assistant' | 'admin' | 'super_admin';
    memberType: 'new_assistant' | 'senior_assistant' | 'intern_assistant' | 'manager_assistant';
  }>;
}

export interface ManualAvailabilityMutationPayload {
  action: 'add' | 'remove';
  workDate: string;
  shiftTemplateId: number;
  userId: number;
}

export function fetchCollectionDashboard(): Promise<ApiRequestResult<CollectionDashboardPayload>> {
  return requestApi<CollectionDashboardPayload>({
    path: '/admin/dashboard',
    method: 'GET',
  });
}

export function publishCurrentCollection(): Promise<ApiRequestResult<CollectionDashboardPayload>> {
  return requestApi<CollectionDashboardPayload, Record<string, never>>({
    path: '/admin/collections/publish',
    method: 'POST',
    data: {},
  });
}

export function republishCurrentCollection(): Promise<ApiRequestResult<CollectionDashboardPayload>> {
  return requestApi<CollectionDashboardPayload, Record<string, never>>({
    path: '/admin/collections/republish',
    method: 'POST',
    data: {},
    loadingTitle: '\u91cd\u65b0\u53d1\u5e03\u4e2d',
  });
}

export function fetchCurrentCollectionFill(): Promise<ApiRequestResult<CurrentCollectionFillPayload>> {
  return requestApi<CurrentCollectionFillPayload>({
    path: '/availability/current',
    method: 'GET',
  });
}

export function saveCurrentCollectionFill(
  payload: SaveCollectionSubmissionPayload,
): Promise<ApiRequestResult<CurrentCollectionFillPayload>> {
  return requestApi<CurrentCollectionFillPayload, SaveCollectionSubmissionPayload>({
    path: '/availability/current',
    method: 'PUT',
    data: payload,
  });
}

export function fetchCollectionDetail(
  collectionId: number,
): Promise<ApiRequestResult<CollectionDetailPayload>> {
  return requestApi<CollectionDetailPayload>({
    path: `/admin/collections/${collectionId}/detail`,
    method: 'GET',
  });
}

export function updateCollectionManualAvailability(
  collectionId: number,
  payload: ManualAvailabilityMutationPayload,
): Promise<ApiRequestResult<CollectionDetailPayload>> {
  return requestApi<CollectionDetailPayload, ManualAvailabilityMutationPayload>({
    path: `/admin/collections/${collectionId}/detail/manual-availability`,
    method: 'PUT',
    data: payload,
  });
}
