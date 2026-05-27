import type { ApiRequestResult } from './request';
import { requestApi } from './request';

export type ProfileRole = 'assistant' | 'admin' | 'super_admin';
export type WorkdayOverrideType = 'workday' | 'non_workday' | 'no_shift';

export interface ProfileViewer {
  userId: number;
  studentId: string;
  name: string;
  avatarUrl: string | null;
  role: ProfileRole;
  accountStatus: 'pending' | 'active' | 'rejected' | 'disabled';
  college: string;
  grade: string;
}

export interface SemesterConfiguration {
  semesterId: number;
  name: string;
  firstWeekStartDate: string;
  totalWeeks: number;
  gradeUpdateStatus: 'pending' | 'confirmed' | 'skipped';
  isCurrent: boolean;
  currentTeachingWeek: number | null;
}

export interface ShiftTemplateConfiguration {
  shiftTemplateId: number;
  name: string;
  startTime: string;
  endTime: string;
  defaultRequiredCount: number;
  minCount: number;
  allowSolo: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface WorkdayOverrideConfiguration {
  overrideId: number;
  workDate: string;
  overrideType: WorkdayOverrideType;
  reason: string | null;
}

export interface SchedulerWorkSettings {
  weeklyWorkdays: number[];
  maxWeeklyShiftsLimit: number;
  exportDirectory: string;
  shiftTemplates: ShiftTemplateConfiguration[];
  overrides: WorkdayOverrideConfiguration[];
}

export interface DefaultAvailabilitySlot {
  shiftIndex: number;
  weekday: number;
}

export interface DefaultAvailabilityConfiguration {
  selectedSlots: DefaultAvailabilitySlot[];
}

export interface ProfileOverviewResponse {
  viewer: ProfileViewer | null;
  semester: SemesterConfiguration | null;
  workSettings: SchedulerWorkSettings;
  defaultAvailability: DefaultAvailabilityConfiguration;
  unreadNotificationCount: number;
  canManageSettings: boolean;
}

export interface GradeUpdatePreviewItem {
  userId: number;
  studentId: string;
  name: string;
  currentGrade: string;
  nextGrade: string;
  willChange: boolean;
}

export interface GradeUpdatePreviewSummary {
  totalUsers: number;
  changedUsers: number;
  unchangedUsers: number;
  items: GradeUpdatePreviewItem[];
}

export interface AdminConfigurationResponse {
  semester: SemesterConfiguration | null;
  workSettings: SchedulerWorkSettings;
  gradeUpdatePreview: GradeUpdatePreviewSummary;
  canGenerateCollection: boolean;
}

export interface UpdateSemesterPayload {
  name: string;
  firstWeekStartDate: string;
  totalWeeks: number;
}

export interface ShiftTemplatePayload {
  name: string;
  startTime: string;
  endTime: string;
  defaultRequiredCount: number;
  minCount: number;
  allowSolo: boolean;
}

export interface WorkdayOverridePayload {
  workDate: string;
  overrideType: WorkdayOverrideType;
  reason: string | null;
}

export interface UpdateWorkSettingsPayload {
  weeklyWorkdays: number[];
  shiftTemplates: ShiftTemplatePayload[];
  overrides: WorkdayOverridePayload[];
}

export function fetchProfileOverview(): Promise<ApiRequestResult<ProfileOverviewResponse>> {
  return requestApi<ProfileOverviewResponse>({
    path: '/profile/overview',
    method: 'GET',
  });
}

export function updateDefaultAvailability(
  payload: DefaultAvailabilityConfiguration,
): Promise<ApiRequestResult<{ defaultAvailability: DefaultAvailabilityConfiguration }>> {
  return requestApi<{ defaultAvailability: DefaultAvailabilityConfiguration }, DefaultAvailabilityConfiguration>({
    path: '/profile/default-availability',
    method: 'PUT',
    data: payload,
  });
}

export function fetchAdminConfiguration(): Promise<ApiRequestResult<AdminConfigurationResponse>> {
  return requestApi<AdminConfigurationResponse>({
    path: '/admin/configuration',
    method: 'GET',
  });
}

export function updateSemesterConfiguration(
  payload: UpdateSemesterPayload,
): Promise<ApiRequestResult<{ semester: SemesterConfiguration }>> {
  return requestApi<{ semester: SemesterConfiguration }, UpdateSemesterPayload>({
    path: '/admin/configuration/semester',
    method: 'PUT',
    data: payload,
  });
}

export function previewGradeUpdates(): Promise<
  ApiRequestResult<{ preview: GradeUpdatePreviewSummary }>
> {
  return requestApi<{ preview: GradeUpdatePreviewSummary }>({
    path: '/admin/configuration/grade-update/preview',
    method: 'POST',
    data: {},
  });
}

export function confirmGradeUpdates(): Promise<
  ApiRequestResult<{ preview: GradeUpdatePreviewSummary }>
> {
  return requestApi<{ preview: GradeUpdatePreviewSummary }>({
    path: '/admin/configuration/grade-update/confirm',
    method: 'POST',
    data: {},
  });
}

export function updateWorkSettings(
  payload: UpdateWorkSettingsPayload,
): Promise<ApiRequestResult<{ workSettings: SchedulerWorkSettings }>> {
  return requestApi<{ workSettings: SchedulerWorkSettings }, UpdateWorkSettingsPayload>({
    path: '/admin/configuration/work-settings',
    method: 'PUT',
    data: payload,
  });
}
