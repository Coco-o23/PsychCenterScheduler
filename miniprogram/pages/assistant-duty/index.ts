import {
  createOvertimeRecord,
  createSwapRequest,
  fetchAssistantDutyOverview,
  peerReviewSwapRequest,
  type AssistantDutyOverviewPayload,
  type DutyAssignmentItem,
  type DutyCalendarDay,
  type OvertimeRecordView,
  type SwapPeerOption,
  type SwapRequestView,
} from '../../services/duty';
import {
  ensurePageAccess,
  returnToTestEntry,
  type GuardState,
} from '../../utils/route-guard';

interface NavItem {
  key: string;
  label: string;
  icon: string;
}

interface DurationOption {
  label: string;
  value: number;
}

type DutyModalType = 'swap' | 'overtime' | null;

interface AssistantDutyData {
  guardState: GuardState;
  guardTitle: string;
  guardDescription: string;
  requestState: 'loading' | 'ready' | 'error';
  activeNavKey: string;
  navItems: NavItem[];
  weekdayHeaders: string[];
  month: string;
  monthLabel: string;
  teachingWeekLabel: string;
  selectedDate: string;
  selectedDateLabel: string;
  calendarDays: DutyCalendarDay[];
  currentDayAssignments: DutyAssignmentItem[];
  upcomingScheduleDays: AssistantDutyOverviewPayload['upcomingScheduleDays'];
  monthlySummary: AssistantDutyOverviewPayload['monthlySummary'];
  scheduledHoursText: string;
  overtimeHoursText: string;
  totalHoursText: string;
  pendingPeerSwapRequests: Array<SwapRequestView & { statusLabel: string }>;
  mySwapRequests: Array<SwapRequestView & { statusLabel: string }>;
  myOvertimeRecords: Array<OvertimeRecordView & { statusLabel: string }>;
  modalType: DutyModalType;
  modalShiftLabel: string;
  modalAssignmentId: number | null;
  swapTargetIndex: number;
  swapTargetLabel: string;
  swapPickerItems: Array<SwapPeerOption & { label: string }>;
  swapReason: string;
  overtimeDurationItems: DurationOption[];
  overtimeDurationIndex: number;
  overtimeDurationLabel: string;
  overtimeReason: string;
}

const WEEKDAY_HEADERS = ['一', '二', '三', '四', '五', '六', '日'];
const DURATION_OPTIONS: DurationOption[] = [
  { label: '30 分钟', value: 30 },
  { label: '60 分钟', value: 60 },
  { label: '90 分钟', value: 90 },
  { label: '120 分钟', value: 120 },
  { label: '150 分钟', value: 150 },
  { label: '180 分钟', value: 180 },
];

const STATUS_LABEL_MAP: Record<SwapRequestView['status'] | OvertimeRecordView['status'], string> = {
  pending_peer: '待对方确认',
  pending_admin: '待管理员审批',
  approved: '已通过',
  rejected: '已拒绝',
  cancelled: '已取消',
  pending: '待审批',
};

function shiftMonth(month: string, delta: number): string {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const rawMonth = Number(monthText);
  const next = new Date(year, rawMonth - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function minutesToHoursText(minutes: number): string {
  const hours = minutes / 60;
  return `${hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)} 小时`;
}

function formatSelectedDateLabel(selectedDate: string, calendarDays: DutyCalendarDay[]): string {
  const parts = selectedDate.split('-');

  if (parts.length !== 3) {
    return selectedDate;
  }

  const [, monthText, dayText] = parts;
  const selectedCalendarDay = calendarDays.find((item) => item.date === selectedDate);
  const weekdayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const weekdayLabel =
    selectedCalendarDay && selectedCalendarDay.weekday >= 1 && selectedCalendarDay.weekday <= 7
      ? weekdayLabels[selectedCalendarDay.weekday - 1]
      : '';

  return weekdayLabel ? `${monthText}-${dayText} ${weekdayLabel}` : `${monthText}-${dayText}`;
}

function decorateSwapRequests(items: SwapRequestView[]): Array<SwapRequestView & { statusLabel: string }> {
  return items.map((item) => ({
    ...item,
    statusLabel: STATUS_LABEL_MAP[item.status],
  }));
}

function decorateOvertimeRecords(
  items: OvertimeRecordView[],
): Array<OvertimeRecordView & { statusLabel: string }> {
  return items.map((item) => ({
    ...item,
    statusLabel: STATUS_LABEL_MAP[item.status],
  }));
}

function buildSwapPickerItems(options: SwapPeerOption[]): Array<SwapPeerOption & { label: string }> {
  return options.map((item) => ({
    ...item,
    label: `${item.name} · ${item.studentId}`,
  }));
}

Page<{
  data: AssistantDutyData;
  onShow: () => void;
  loadPage: (month?: string, date?: string) => Promise<void>;
  applyPayload: (payload: AssistantDutyOverviewPayload) => void;
  handleNavChange: (event: { detail?: { key?: string } }) => void;
  handleChangeMonth: (event: { currentTarget: { dataset: { delta?: string | number } } }) => void;
  handleSelectDate: (event: { currentTarget: { dataset: { date?: string } } }) => void;
  handleOpenSwapModal: (
    event: { currentTarget: { dataset: { assignmentId?: number; shiftLabel?: string } } },
  ) => void;
  handleOpenOvertimeModal: (
    event: { currentTarget: { dataset: { assignmentId?: number; shiftLabel?: string } } },
  ) => void;
  handleCloseModal: () => void;
  handleSwapTargetChange: (event: { detail?: { value?: number | string } }) => void;
  handleSwapReasonInput: (event: { detail?: { value?: string } }) => void;
  handleOvertimeDurationChange: (event: { detail?: { value?: number | string } }) => void;
  handleOvertimeReasonInput: (event: { detail?: { value?: string } }) => void;
  handleSubmitSwap: () => Promise<void>;
  handleSubmitOvertime: () => Promise<void>;
  handlePeerReviewSwap: (
    event: { currentTarget: { dataset: { swapRequestId?: number; decision?: 'confirm' | 'reject' } } },
  ) => Promise<void>;
  noop: () => void;
  handleReturnToEntry: () => void;
}>( {
  data: {
    guardState: 'checking',
    guardTitle: '检查中',
    guardDescription: '正在确认日程页访问权限。',
    requestState: 'loading',
    activeNavKey: 'schedule',
    navItems: [
      { key: 'availability', label: '填报', icon: '填' },
      { key: 'schedule', label: '日程', icon: '班' },
      { key: 'team', label: '团队', icon: '组' },
      { key: 'profile', label: '个人', icon: '我' },
    ],
    weekdayHeaders: WEEKDAY_HEADERS,
    month: '',
    monthLabel: '',
    teachingWeekLabel: '',
    selectedDate: '',
    selectedDateLabel: '',
    calendarDays: [],
    currentDayAssignments: [],
    upcomingScheduleDays: [],
    monthlySummary: {
      month: '',
      publishedShiftCount: 0,
      scheduledMinutes: 0,
      approvedOvertimeMinutes: 0,
      totalWorkingMinutes: 0,
    },
    scheduledHoursText: '0 小时',
    overtimeHoursText: '0 小时',
    totalHoursText: '0 小时',
    pendingPeerSwapRequests: [],
    mySwapRequests: [],
    myOvertimeRecords: [],
    modalType: null,
    modalShiftLabel: '',
    modalAssignmentId: null,
    swapTargetIndex: 0,
    swapTargetLabel: '请选择接替对象',
    swapPickerItems: [],
    swapReason: '',
    overtimeDurationItems: DURATION_OPTIONS,
    overtimeDurationIndex: 1,
    overtimeDurationLabel: DURATION_OPTIONS[1].label,
    overtimeReason: '',
  },

  onShow(): void {
    const allowed = ensurePageAccess(this, {
      allowedRoles: ['assistant', 'admin', 'super_admin'],
    });

    if (!allowed) {
      return;
    }

    void this.loadPage(this.data.month || undefined, this.data.selectedDate || undefined);
  },

  async loadPage(month?: string, date?: string): Promise<void> {
    this.setData({
      requestState: 'loading',
    });

    const result = await fetchAssistantDutyOverview({ month, date });

    if (!result.ok || !result.data) {
      this.setData({
        requestState: 'error',
      });
      return;
    }

    this.applyPayload(result.data);
  },

  applyPayload(payload: AssistantDutyOverviewPayload): void {
    const swapPickerItems = buildSwapPickerItems(payload.swapTargetOptions);

    this.setData({
      requestState: 'ready',
      month: payload.month,
      monthLabel: payload.monthLabel,
      teachingWeekLabel: payload.teachingWeekLabel,
      selectedDate: payload.selectedDate,
      selectedDateLabel: formatSelectedDateLabel(payload.selectedDate, payload.calendarDays),
      calendarDays: payload.calendarDays,
      currentDayAssignments: payload.currentDayAssignments,
      upcomingScheduleDays: payload.upcomingScheduleDays,
      monthlySummary: payload.monthlySummary,
      scheduledHoursText: minutesToHoursText(payload.monthlySummary.scheduledMinutes),
      overtimeHoursText: minutesToHoursText(payload.monthlySummary.approvedOvertimeMinutes),
      totalHoursText: minutesToHoursText(payload.monthlySummary.totalWorkingMinutes),
      pendingPeerSwapRequests: decorateSwapRequests(payload.pendingPeerSwapRequests),
      mySwapRequests: decorateSwapRequests(payload.mySwapRequests),
      myOvertimeRecords: decorateOvertimeRecords(payload.myOvertimeRecords),
      modalType: null,
      modalShiftLabel: '',
      modalAssignmentId: null,
      swapTargetIndex: 0,
      swapTargetLabel: swapPickerItems[0]?.label ?? '请选择接替对象',
      swapPickerItems,
      swapReason: '',
      overtimeDurationIndex: 1,
      overtimeDurationLabel: DURATION_OPTIONS[1].label,
      overtimeReason: '',
    });
  },

  handleNavChange(event): void {
    const targetKey = event.detail?.key ?? '';

    if (targetKey === 'availability') {
      wx.redirectTo({ url: '/pages/assistant-main/index' });
      return;
    }

    if (targetKey === 'team') {
      wx.redirectTo({ url: '/pages/assistant-team/index' });
      return;
    }

    if (targetKey === 'profile') {
      wx.redirectTo({ url: '/pages/assistant-profile/index' });
      return;
    }
  },

  handleChangeMonth(event): void {
    const delta = Number(event.currentTarget.dataset.delta);
    if (!Number.isInteger(delta) || !this.data.month) {
      return;
    }

    const nextMonth = shiftMonth(this.data.month, delta);
    void this.loadPage(nextMonth, `${nextMonth}-01`);
  },

  handleSelectDate(event): void {
    const date = event.currentTarget.dataset.date ?? '';
    if (!date) {
      return;
    }

    void this.loadPage(this.data.month, date);
  },

  handleOpenSwapModal(event): void {
    const assignmentId = Number(event.currentTarget.dataset.assignmentId);
    const shiftLabel = event.currentTarget.dataset.shiftLabel ?? '';

    if (!Number.isInteger(assignmentId)) {
      return;
    }

    if (this.data.swapPickerItems.length === 0) {
      wx.showToast({
        title: '暂无可选的接替对象',
        icon: 'none',
      });
      return;
    }

    this.setData({
      modalType: 'swap',
      modalAssignmentId: assignmentId,
      modalShiftLabel: shiftLabel,
      swapTargetIndex: 0,
      swapTargetLabel: this.data.swapPickerItems[0]?.label ?? '请选择接替对象',
      swapReason: '',
    });
  },

  handleOpenOvertimeModal(event): void {
    const assignmentId = Number(event.currentTarget.dataset.assignmentId);
    const shiftLabel = event.currentTarget.dataset.shiftLabel ?? '';

    if (!Number.isInteger(assignmentId)) {
      return;
    }

    this.setData({
      modalType: 'overtime',
      modalAssignmentId: assignmentId,
      modalShiftLabel: shiftLabel,
      overtimeDurationIndex: 1,
      overtimeDurationLabel: DURATION_OPTIONS[1].label,
      overtimeReason: '',
    });
  },

  handleCloseModal(): void {
    this.setData({
      modalType: null,
      modalShiftLabel: '',
      modalAssignmentId: null,
      swapReason: '',
      overtimeReason: '',
    });
  },

  handleSwapTargetChange(event): void {
    const index = Number(event.detail?.value);
    if (!Number.isInteger(index) || index < 0 || index >= this.data.swapPickerItems.length) {
      return;
    }

    this.setData({
      swapTargetIndex: index,
      swapTargetLabel: this.data.swapPickerItems[index].label,
    });
  },

  handleSwapReasonInput(event): void {
    this.setData({
      swapReason: event.detail?.value ?? '',
    });
  },

  handleOvertimeDurationChange(event): void {
    const index = Number(event.detail?.value);
    if (!Number.isInteger(index) || index < 0 || index >= this.data.overtimeDurationItems.length) {
      return;
    }

    this.setData({
      overtimeDurationIndex: index,
      overtimeDurationLabel: this.data.overtimeDurationItems[index].label,
    });
  },

  handleOvertimeReasonInput(event): void {
    this.setData({
      overtimeReason: event.detail?.value ?? '',
    });
  },

  async handleSubmitSwap(): Promise<void> {
    if (this.data.modalAssignmentId === null) {
      return;
    }

    const target = this.data.swapPickerItems[this.data.swapTargetIndex];
    if (!target) {
      wx.showToast({
      title: '换班申请已提交',
        icon: 'none',
      });
      return;
    }

    const result = await createSwapRequest({
      originalAssignmentId: this.data.modalAssignmentId,
      targetUserId: target.userId,
      reason: this.data.swapReason.trim() || null,
    });

    if (!result.ok) {
      return;
    }

    wx.showToast({
      title: '加班记录已提交',
      icon: 'success',
    });

    this.handleCloseModal();
    await this.loadPage(this.data.month, this.data.selectedDate);
  },

  async handleSubmitOvertime(): Promise<void> {
    if (this.data.modalAssignmentId === null) {
      return;
    }

    const duration = this.data.overtimeDurationItems[this.data.overtimeDurationIndex]?.value ?? 60;
    const result = await createOvertimeRecord({
      assignmentId: this.data.modalAssignmentId,
      durationMinutes: duration,
      reason: this.data.overtimeReason.trim() || null,
    });

    if (!result.ok) {
      return;
    }

    wx.showToast({
      title: '加班记录已提交',
      icon: 'success',
    });

    this.handleCloseModal();
    await this.loadPage(this.data.month, this.data.selectedDate);
  },

  async handlePeerReviewSwap(event): Promise<void> {
    const swapRequestId = Number(event.currentTarget.dataset.swapRequestId);
    const decision = event.currentTarget.dataset.decision;

    if (
      !Number.isInteger(swapRequestId) ||
      (decision !== 'confirm' && decision !== 'reject')
    ) {
      return;
    }

    const result = await peerReviewSwapRequest(swapRequestId, { decision });
    if (!result.ok) {
      return;
    }

    wx.showToast({
      title: decision === 'confirm' ? '已确认换班申请' : '已拒绝换班申请',
      icon: 'success',
    });

    await this.loadPage(this.data.month, this.data.selectedDate);
  },

  noop(): void {
    return;
  },

  handleReturnToEntry(): void {
    returnToTestEntry(true);
  },
});
