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

export interface CreateSwapRequestInput {
  originalAssignmentId: number;
  targetUserId: number;
  reason: string | null;
}

export interface PeerReviewSwapInput {
  decision: 'confirm' | 'reject';
}

export interface AdminReviewSwapInput {
  decision: 'approve' | 'reject';
  reviewNote: string | null;
}

export interface CreateOvertimeInput {
  assignmentId: number;
  durationMinutes: number;
  reason: string | null;
}

export interface AdminReviewOvertimeInput {
  decision: 'approve' | 'reject';
  reviewNote: string | null;
}

export interface UpdateNoShiftInput {
  workDate: string;
  enabled: boolean;
  reason: string | null;
}
