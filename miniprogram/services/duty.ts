import type { ApiRequestResult } from './request';
import { requestApi } from './request';

export type DutyOverviewScope = 'me' | 'all';

export interface DutyCalendarDay {
  date: string;
  dayOfMonth: number;
  weekday: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasAssignments: boolean;
  assignmentCount: number;
  noShift: boolean;
}

export interface DutyAssignmentItem {
  assignmentId: number;
  scheduleId: number;
  workDate: string;
  weekday: number;
  dateLabel: string;
  shiftTemplateId: number;
  shiftLabel: string;
  startTime: string;
  endTime: string;
  status: 'published' | 'adjusted';
  partnerNames: string[];
  partnerDisplayText: string;
  memberNames: string[];
  memberDisplayText: string;
  canRequestSwap: boolean;
  canSubmitOvertime: boolean;
}

export interface DutyScheduleDay {
  date: string;
  dateLabel: string;
  noShift: boolean;
  assignments: DutyAssignmentItem[];
}

export interface DutyMonthlySummary {
  month: string;
  publishedShiftCount: number;
  scheduledMinutes: number;
  approvedOvertimeMinutes: number;
  totalWorkingMinutes: number;
}

export interface SwapPeerOption {
  userId: number;
  name: string;
  studentId: string;
}

export interface SwapRequestView {
  swapRequestId: number;
  requesterId: number;
  requesterName: string;
  requesterStudentId: string;
  targetUserId: number | null;
  targetUserName: string | null;
  targetUserStudentId: string | null;
  originalAssignmentId: number;
  originalWorkDate: string;
  originalShiftLabel: string;
  originalTimeRange: string;
  reason: string | null;
  status: 'pending_peer' | 'pending_admin' | 'approved' | 'rejected' | 'cancelled';
  peerConfirmedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface OvertimeRecordView {
  overtimeId: number;
  userId: number;
  userName: string;
  userStudentId: string;
  assignmentId: number;
  workDate: string;
  shiftLabel: string;
  timeRange: string;
  durationMinutes: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface AssistantDutyOverviewPayload {
  monthLabel: string;
  month: string;
  teachingWeekLabel: string;
  selectedDate: string;
  calendarDays: DutyCalendarDay[];
  currentDayAssignments: DutyAssignmentItem[];
  upcomingScheduleDays: DutyScheduleDay[];
  monthlySummary: DutyMonthlySummary;
  swapTargetOptions: SwapPeerOption[];
  pendingPeerSwapRequests: SwapRequestView[];
  mySwapRequests: SwapRequestView[];
  myOvertimeRecords: OvertimeRecordView[];
}

export interface AdminDutyOverviewPayload {
  monthLabel: string;
  month: string;
  teachingWeekLabel: string;
  selectedDate: string;
  scope: DutyOverviewScope;
  calendarDays: DutyCalendarDay[];
  currentDayAssignments: DutyAssignmentItem[];
  upcomingScheduleDays: DutyScheduleDay[];
  monthlySummary: DutyMonthlySummary;
  noShiftEnabled: boolean;
  swapTargetOptions: SwapPeerOption[];
  pendingSwapRequests: SwapRequestView[];
  pendingOvertimeRecords: OvertimeRecordView[];
}

export interface CreateSwapRequestPayload {
  originalAssignmentId: number;
  targetUserId: number;
  reason: string | null;
}

export interface CreateOvertimePayload {
  assignmentId: number;
  durationMinutes: number;
  reason: string | null;
}

export interface PeerReviewSwapPayload {
  decision: 'confirm' | 'reject';
}

export interface AdminReviewSwapPayload {
  decision: 'approve' | 'reject';
  reviewNote: string | null;
}

export interface AdminReviewOvertimePayload {
  decision: 'approve' | 'reject';
  reviewNote: string | null;
}

export interface UpdateNoShiftPayload {
  workDate: string;
  enabled: boolean;
  reason: string | null;
}

function buildQueryString(params: Record<string, string | undefined>): string {
  const pairs = Object.entries(params)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);

  return pairs.length > 0 ? `?${pairs.join('&')}` : '';
}

export function fetchAssistantDutyOverview(params: {
  month?: string;
  date?: string;
} = {}): Promise<ApiRequestResult<AssistantDutyOverviewPayload>> {
  return requestApi<AssistantDutyOverviewPayload>({
    path: `/duty/overview${buildQueryString({
      month: params.month,
      date: params.date,
    })}`,
    method: 'GET',
  });
}

export function createSwapRequest(
  payload: CreateSwapRequestPayload,
): Promise<ApiRequestResult<SwapRequestView>> {
  return requestApi<SwapRequestView, CreateSwapRequestPayload>({
    path: '/duty/swap-requests',
    method: 'POST',
    data: payload,
  });
}

export function peerReviewSwapRequest(
  swapRequestId: number,
  payload: PeerReviewSwapPayload,
): Promise<ApiRequestResult<SwapRequestView>> {
  return requestApi<SwapRequestView, PeerReviewSwapPayload>({
    path: `/duty/swap-requests/${swapRequestId}/peer-review`,
    method: 'POST',
    data: payload,
  });
}

export function createOvertimeRecord(
  payload: CreateOvertimePayload,
): Promise<ApiRequestResult<OvertimeRecordView>> {
  return requestApi<OvertimeRecordView, CreateOvertimePayload>({
    path: '/duty/overtime-records',
    method: 'POST',
    data: payload,
  });
}

export function fetchAdminDutyOverview(params: {
  month?: string;
  date?: string;
  scope?: DutyOverviewScope;
} = {}): Promise<ApiRequestResult<AdminDutyOverviewPayload>> {
  return requestApi<AdminDutyOverviewPayload>({
    path: `/admin/duty/overview${buildQueryString({
      month: params.month,
      date: params.date,
      scope: params.scope,
    })}`,
    method: 'GET',
  });
}

export function updateNoShift(
  payload: UpdateNoShiftPayload,
): Promise<ApiRequestResult<AdminDutyOverviewPayload>> {
  return requestApi<AdminDutyOverviewPayload, UpdateNoShiftPayload>({
    path: '/admin/duty/no-shift',
    method: 'PUT',
    data: payload,
  });
}

export function adminReviewSwapRequest(
  swapRequestId: number,
  payload: AdminReviewSwapPayload,
): Promise<ApiRequestResult<SwapRequestView>> {
  return requestApi<SwapRequestView, AdminReviewSwapPayload>({
    path: `/admin/duty/swap-requests/${swapRequestId}/review`,
    method: 'PUT',
    data: payload,
  });
}

export function adminReviewOvertimeRecord(
  overtimeId: number,
  payload: AdminReviewOvertimePayload,
): Promise<ApiRequestResult<OvertimeRecordView>> {
  return requestApi<OvertimeRecordView, AdminReviewOvertimePayload>({
    path: `/admin/duty/overtime-records/${overtimeId}/review`,
    method: 'PUT',
    data: payload,
  });
}
