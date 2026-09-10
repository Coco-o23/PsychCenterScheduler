import {
  adminReviewOvertimeRecord,
  adminReviewSwapRequest,
  createSwapRequest,
  fetchAdminDutyOverview,
  updateNoShift,
  type AdminDutyOverviewPayload,
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

interface AdminDutyData {
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
  upcomingScheduleDays: AdminDutyOverviewPayload['upcomingScheduleDays'];
  monthlySummary: AdminDutyOverviewPayload['monthlySummary'];
  scheduledHoursText: string;
  overtimeHoursText: string;
  totalHoursText: string;
  noShiftEnabled: boolean;
  pendingSwapRequests: Array<SwapRequestView & { statusLabel: string }>;
  pendingOvertimeRecords: Array<OvertimeRecordView & { statusLabel: string }>;
  modalType: 'swap' | null;
  modalShiftLabel: string;
  modalAssignmentId: number | null;
  swapTargetIndex: number;
  swapTargetLabel: string;
  swapPickerItems: Array<SwapPeerOption & { label: string }>;
  swapReason: string;
}

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
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
  data: AdminDutyData;
  onShow: () => void;
  loadPage: (month?: string, date?: string) => Promise<void>;
  applyPayload: (payload: AdminDutyOverviewPayload) => void;
  handleNavChange: (event: { detail?: { key?: string } }) => void;
  handleChangeMonth: (event: { currentTarget: { dataset: { delta?: string | number } } }) => void;
  handleSelectDate: (event: { currentTarget: { dataset: { date?: string } } }) => void;
  handleToggleNoShift: () => Promise<void>;
  handleOpenSwapModal: (
    event: { currentTarget: { dataset: { assignmentId?: number; shiftLabel?: string } } },
  ) => void;
  handleCloseModal: () => void;
  handleSwapTargetChange: (event: { detail?: { value?: number | string } }) => void;
  handleSwapReasonInput: (event: { detail?: { value?: string } }) => void;
  handleSubmitSwap: () => Promise<void>;
  handleReviewSwap: (
    event: { currentTarget: { dataset: { swapRequestId?: number; decision?: 'approve' | 'reject' } } },
  ) => Promise<void>;
  handleReviewOvertime: (
    event: { currentTarget: { dataset: { overtimeId?: number; decision?: 'approve' | 'reject' } } },
  ) => Promise<void>;
  noop: () => void;
  handleReturnToEntry: () => void;
}>({
  data: {
    guardState: 'checking',
    guardTitle: '检查中',
    guardDescription: '正在确认管理端日程页访问权限。',
    requestState: 'loading',
    activeNavKey: 'duty',
    navItems: [
      { key: 'schedule', label: '排班', icon: 'view_quilt' },
      { key: 'duty', label: '日程', icon: 'calendar_month' },
      { key: 'team', label: '团队', icon: 'groups' },
      { key: 'profile', label: '个人', icon: 'person' },
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
    noShiftEnabled: false,
    pendingSwapRequests: [],
    pendingOvertimeRecords: [],
    modalType: null,
    modalShiftLabel: '',
    modalAssignmentId: null,
    swapTargetIndex: 0,
    swapTargetLabel: '请选择接替对象',
    swapPickerItems: [],
    swapReason: '',
  },

  onShow(): void {
    const allowed = ensurePageAccess(this, {
      allowedRoles: ['admin', 'super_admin'],
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

    const result = await fetchAdminDutyOverview({ month, date, scope: 'all' });

    if (!result.ok || !result.data) {
      this.setData({
        requestState: 'error',
      });
      return;
    }

    this.applyPayload(result.data);
  },

  applyPayload(payload: AdminDutyOverviewPayload): void {
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
      noShiftEnabled: payload.noShiftEnabled,
      pendingSwapRequests: decorateSwapRequests(payload.pendingSwapRequests),
      pendingOvertimeRecords: decorateOvertimeRecords(payload.pendingOvertimeRecords),
      modalType: null,
      modalShiftLabel: '',
      modalAssignmentId: null,
      swapTargetIndex: 0,
      swapTargetLabel: swapPickerItems[0]?.label ?? '请选择接替对象',
      swapPickerItems,
      swapReason: '',
    });
  },

  handleNavChange(event): void {
    const targetKey = event.detail?.key ?? '';

    if (targetKey === 'schedule') {
      wx.redirectTo({ url: '/pages/admin-main/index' });
      return;
    }

    if (targetKey === 'team') {
      wx.redirectTo({ url: '/pages/admin-team/index' });
      return;
    }

    if (targetKey === 'profile') {
      wx.redirectTo({ url: '/pages/admin-profile/index' });
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

  async handleToggleNoShift(): Promise<void> {
    const result = await updateNoShift({
      workDate: this.data.selectedDate,
      enabled: !this.data.noShiftEnabled,
      reason: null,
    });

    if (!result.ok || !result.data) {
      return;
    }

    wx.showToast({
      title: !this.data.noShiftEnabled ? '已开启无需值班' : '已关闭无需值班',
      icon: 'success',
    });

    this.applyPayload(result.data);
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

  handleCloseModal(): void {
    this.setData({
      modalType: null,
      modalShiftLabel: '',
      modalAssignmentId: null,
      swapReason: '',
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

  async handleSubmitSwap(): Promise<void> {
    if (this.data.modalAssignmentId === null) {
      return;
    }

    const target = this.data.swapPickerItems[this.data.swapTargetIndex];
    if (!target) {
      wx.showToast({
        title: '请选择接替对象',
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
      title: '换班申请已提交',
      icon: 'success',
    });

    this.handleCloseModal();
    await this.loadPage(this.data.month, this.data.selectedDate);
  },

  async handleReviewSwap(event): Promise<void> {
    const swapRequestId = Number(event.currentTarget.dataset.swapRequestId);
    const decision = event.currentTarget.dataset.decision;

    if (!Number.isInteger(swapRequestId) || (decision !== 'approve' && decision !== 'reject')) {
      return;
    }

    const confirmed = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: decision === 'approve' ? '审批换班申请' : '拒绝换班申请',
        content: decision === 'approve' ? '确认通过这条换班申请吗？' : '确认拒绝这条换班申请吗？',
        success: (modalResult) => resolve(modalResult.confirm),
        fail: () => resolve(false),
      });
    });

    if (!confirmed) {
      return;
    }

    const result = await adminReviewSwapRequest(swapRequestId, {
      decision,
      reviewNote: null,
    });

    if (!result.ok) {
      return;
    }

    wx.showToast({
      title: decision === 'approve' ? '已通过换班申请' : '已拒绝换班申请',
      icon: 'success',
    });

    await this.loadPage(this.data.month, this.data.selectedDate);
  },

  async handleReviewOvertime(event): Promise<void> {
    const overtimeId = Number(event.currentTarget.dataset.overtimeId);
    const decision = event.currentTarget.dataset.decision;

    if (!Number.isInteger(overtimeId) || (decision !== 'approve' && decision !== 'reject')) {
      return;
    }

    const confirmed = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: decision === 'approve' ? '审批加班记录' : '拒绝加班记录',
        content: decision === 'approve' ? '确认通过这条加班记录吗？' : '确认拒绝这条加班记录吗？',
        success: (modalResult) => resolve(modalResult.confirm),
        fail: () => resolve(false),
      });
    });

    if (!confirmed) {
      return;
    }

    const result = await adminReviewOvertimeRecord(overtimeId, {
      decision,
      reviewNote: null,
    });

    if (!result.ok) {
      return;
    }

    wx.showToast({
      title: decision === 'approve' ? '已通过加班记录' : '已拒绝加班记录',
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
