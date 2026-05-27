import type { ShiftSchedulerApp } from '../../app';
import type {
  CollectionFillDay,
  CollectionFillSlot,
  CurrentCollectionFillPayload,
} from '../../services/availability';
import {
  fetchCurrentCollectionFill,
  saveCurrentCollectionFill,
} from '../../services/availability';
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

interface FillSlotView {
  key: string;
  label: string;
  timeRange: string;
  isAvailable: boolean;
}

interface FillDayView {
  date: string;
  label: string;
  displayDate: string;
  slots: FillSlotView[];
}

interface MaxWeeklyShiftOption {
  label: string;
  value: number;
}

interface AssistantMainData {
  guardState: GuardState;
  guardTitle: string;
  guardDescription: string;
  requestState: 'loading' | 'ready' | 'error';
  pageTitle: string;
  pageEyebrow: string;
  collectionTitle: string;
  collectionWeekLabel: string;
  collectionStatus: CurrentCollectionFillPayload['collectionStatus'];
  collectionWorkflowState: CurrentCollectionFillPayload['collectionWorkflowState'];
  isSchedulePublishedForCurrentCollection: boolean;
  fillDays: FillDayView[];
  selectedKeys: string[];
  maxWeeklyShiftsLimit: number;
  selectedMaxWeeklyShifts: number;
  maxWeeklyShiftOptions: MaxWeeklyShiftOption[];
  maxWeeklyShiftIndex: number;
  selectedMaxWeeklyShiftLabel: string;
  isWeekLeave: boolean;
  saveAsDefault: boolean;
  submittedAtText: string;
  submittedSummaryExpanded: boolean;
  submittedSummaryLines: string[];
  submittedSummaryVisible: boolean;
  activeNavKey: string;
  navItems: NavItem[];
}

function buildFillDays(
  days: CollectionFillDay[],
  slots: CollectionFillSlot[],
  selectedKeys: string[],
): FillDayView[] {
  return days.map((day) => ({
    date: day.date,
    label: day.label,
    displayDate: day.date.slice(5),
    slots: slots.map((slot, shiftIndex) => ({
      key: `${shiftIndex}-${day.weekday}`,
      label: slot.shiftLabel,
      timeRange: `${slot.startTime} - ${slot.endTime}`,
      isAvailable: selectedKeys.includes(`${shiftIndex}-${day.weekday}`),
    })),
  }));
}

function createMaxWeeklyShiftOptions(limit: number): MaxWeeklyShiftOption[] {
  const maxValue = Math.max(1, limit);
  return Array.from({ length: maxValue }, (_item, index) => ({
    label: `${index + 1} 次`,
    value: index + 1,
  }));
}

function buildNavItems(role: string): { activeNavKey: string; navItems: NavItem[] } {
  if (role === 'assistant') {
    return {
      activeNavKey: 'availability',
      navItems: [
        { key: 'availability', label: '填报', icon: '填' },
        { key: 'schedule', label: '日程', icon: '班' },
        { key: 'team', label: '团队', icon: '人' },
        { key: 'profile', label: '个人', icon: '我' },
      ],
    };
  }

  return {
    activeNavKey: 'schedule',
    navItems: [
      { key: 'schedule', label: '排班', icon: '排' },
      { key: 'duty', label: '日程', icon: '班' },
      { key: 'team', label: '团队', icon: '人' },
      { key: 'profile', label: '个人', icon: '我' },
    ],
  };
}

function syncCurrentCollection(app: ShiftSchedulerApp, payload: CurrentCollectionFillPayload): void {
  app.patchGlobalState({
    currentCollection:
      payload.collectionId === null || payload.weekLabel === null || payload.teachingWeek === null
        ? null
        : {
            id: String(payload.collectionId),
            title: payload.title,
            weekRange: payload.weekLabel,
            teachingWeek: payload.teachingWeek,
            status:
              payload.collectionStatus === 'none'
                ? 'pending'
                : payload.collectionStatus === 'pending'
                  ? 'pending'
                  : payload.collectionStatus,
          },
  });
}

function buildSubmittedSummaryLines(
  fillDays: FillDayView[],
  selectedKeys: string[],
  isWeekLeave: boolean,
): string[] {
  if (isWeekLeave) {
    return ['整周请假，本周所有班次均提交为没空。'];
  }

  const lines = fillDays
    .map((day) => {
      const availableSlots = day.slots.filter((slot) => selectedKeys.includes(slot.key));

      if (availableSlots.length === 0) {
        return null;
      }

      return `${day.label} ${day.displayDate}：${availableSlots
        .map((slot) => slot.timeRange)
        .join('、')}`;
    })
    .filter((item): item is string => item !== null);

  if (lines.length > 0) {
    return lines;
  }

  return ['当前提交结果为本周所有班次都没空。'];
}

function createSubmittedAtText(submittedAt: string | null): string {
  return submittedAt
    ? `本次提交时间：${submittedAt.slice(0, 16).replace('T', ' ')}`
    : '';
}

Page<{
  data: AssistantMainData;
  onShow: () => void;
  loadPage: () => Promise<void>;
  applyFillPayload: (payload: CurrentCollectionFillPayload) => void;
  handleNavChange: (event: { detail?: { key?: string } }) => void;
  handleGoToDutyPage: () => void;
  handleOpenNotifications: () => void;
  handleToggleSubmittedSummary: () => void;
  handleToggleSlot: (event: { currentTarget: { dataset: { key?: string } } }) => void;
  handleMaxWeeklyShiftChange: (event: { detail?: { value?: number | string } }) => void;
  handleToggleWeekLeave: () => void;
  handleToggleSaveDefault: () => void;
  handleSubmit: () => Promise<void>;
  handleReturnToEntry: () => void;
}>({
  data: {
    guardState: 'checking',
    guardTitle: '检查中',
    guardDescription: '正在确认当前页面访问权限。',
    requestState: 'loading',
    pageTitle: '下周空闲时间填报',
    pageEyebrow: '空闲填报',
    collectionTitle: '',
    collectionWeekLabel: '',
    collectionStatus: 'none',
    collectionWorkflowState: 'none',
    isSchedulePublishedForCurrentCollection: false,
    fillDays: [],
    selectedKeys: [],
    maxWeeklyShiftsLimit: 3,
    selectedMaxWeeklyShifts: 1,
    maxWeeklyShiftOptions: [
      { label: '1 次', value: 1 },
      { label: '2 次', value: 2 },
      { label: '3 次', value: 3 },
    ],
    maxWeeklyShiftIndex: 0,
    selectedMaxWeeklyShiftLabel: '1 次',
    isWeekLeave: false,
    saveAsDefault: false,
    submittedAtText: '',
    submittedSummaryExpanded: false,
    submittedSummaryLines: [],
    submittedSummaryVisible: false,
    activeNavKey: 'availability',
    navItems: [
      { key: 'availability', label: '填报', icon: '填' },
      { key: 'schedule', label: '日程', icon: '班' },
      { key: 'team', label: '团队', icon: '人' },
      { key: 'profile', label: '个人', icon: '我' },
    ],
  },

  onShow(): void {
    const allowed = ensurePageAccess(this, {
      allowedRoles: ['assistant', 'admin', 'super_admin'],
    });

    if (!allowed) {
      return;
    }

    void this.loadPage();
  },

  async loadPage(): Promise<void> {
    this.setData({
      requestState: 'loading',
    });

    const result = await fetchCurrentCollectionFill();

    if (!result.ok || !result.data) {
      this.setData({
        requestState: 'error',
      });
      return;
    }

    this.applyFillPayload(result.data);
  },

  applyFillPayload(payload: CurrentCollectionFillPayload): void {
    const app = getApp<ShiftSchedulerApp>();
    const state = app.getGlobalState();
    const currentRole = state.currentRole ?? 'assistant';
    const navState = buildNavItems(currentRole);
    const maxWeeklyShiftOptions = createMaxWeeklyShiftOptions(payload.maxWeeklyShiftsLimit);
    const maxWeeklyShiftIndex = Math.max(
      0,
      maxWeeklyShiftOptions.findIndex((item) => item.value === payload.selectedMaxWeeklyShifts),
    );
    const fillDays = buildFillDays(payload.days, payload.slots, payload.selectedKeys);
    const submittedSummaryVisible = payload.submittedAt !== null;

    syncCurrentCollection(app, payload);

    this.setData({
      requestState: 'ready',
      pageTitle: currentRole === 'assistant' ? '下周空闲时间填报' : '本人空闲时间填报',
      pageEyebrow: currentRole === 'assistant' ? '空闲填报' : '本人填报',
      collectionTitle: payload.title || '第 X 教学周空闲时间收集',
      collectionWeekLabel: payload.weekLabel ?? '当前暂无待填报周次',
      collectionStatus: payload.collectionStatus,
      collectionWorkflowState: payload.collectionWorkflowState,
      isSchedulePublishedForCurrentCollection: payload.schedulePublished,
      fillDays,
      selectedKeys: payload.selectedKeys,
      maxWeeklyShiftsLimit: payload.maxWeeklyShiftsLimit,
      selectedMaxWeeklyShifts: payload.selectedMaxWeeklyShifts,
      maxWeeklyShiftOptions,
      maxWeeklyShiftIndex,
      selectedMaxWeeklyShiftLabel: maxWeeklyShiftOptions[maxWeeklyShiftIndex]?.label ?? '1 次',
      isWeekLeave: payload.isWeekLeave,
      saveAsDefault: false,
      submittedAtText: createSubmittedAtText(payload.submittedAt),
      submittedSummaryExpanded: false,
      submittedSummaryLines: buildSubmittedSummaryLines(
        fillDays,
        payload.selectedKeys,
        payload.isWeekLeave,
      ),
      submittedSummaryVisible,
      activeNavKey: navState.activeNavKey,
      navItems: navState.navItems,
    });
  },

  handleNavChange(event): void {
    const targetKey = event.detail?.key ?? '';
    const app = getApp<ShiftSchedulerApp>();
    const currentRole = app.getGlobalState().currentRole ?? 'assistant';

    this.setData({
      activeNavKey: targetKey || this.data.activeNavKey,
    });

    if (currentRole === 'assistant') {
      if (targetKey === 'schedule') {
        wx.redirectTo({ url: '/pages/assistant-duty/index' });
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

      if (targetKey !== 'availability') {
        wx.showToast({
          title: '日程页会在后续阶段接入',
          icon: 'none',
        });
      }

      return;
    }

    if (targetKey === 'schedule') {
      wx.redirectTo({ url: '/pages/admin-main/index' });
      return;
    }

    if (targetKey === 'duty') {
      wx.redirectTo({ url: '/pages/admin-duty/index' });
      return;
    }

    if (targetKey === 'team') {
      wx.redirectTo({ url: '/pages/admin-team/index' });
      return;
    }

    if (targetKey === 'profile') {
      wx.redirectTo({ url: '/pages/admin-profile/index' });
      return;
    }

    wx.showToast({
      title: '日程页会在后续阶段接入',
      icon: 'none',
    });
  },

  handleGoToDutyPage(): void {
    wx.redirectTo({ url: '/pages/assistant-duty/index' });
  },

  handleOpenNotifications(): void {
    wx.navigateTo({
      url: '/pages/notifications/index',
    });
  },

  handleToggleSubmittedSummary(): void {
    if (!this.data.submittedSummaryVisible) {
      return;
    }

    this.setData({
      submittedSummaryExpanded: !this.data.submittedSummaryExpanded,
    });
  },

  handleToggleSlot(event): void {
    if (
      this.data.collectionStatus !== 'active' ||
      this.data.isWeekLeave ||
      this.data.isSchedulePublishedForCurrentCollection
    ) {
      return;
    }

    const key = event.currentTarget.dataset.key ?? '';

    if (!key) {
      return;
    }

    const selectedKeys = this.data.selectedKeys.includes(key)
      ? this.data.selectedKeys.filter((item) => item !== key)
      : [...this.data.selectedKeys, key].sort();
    const fillDays = this.data.fillDays.map((day) => ({
      ...day,
      slots: day.slots.map((slot) => ({
        ...slot,
        isAvailable: selectedKeys.includes(slot.key),
      })),
    }));

    this.setData({
      selectedKeys,
      fillDays,
    });
  },

  handleMaxWeeklyShiftChange(event): void {
    if (this.data.isSchedulePublishedForCurrentCollection) {
      return;
    }

    const index = Number(event.detail?.value);

    if (!Number.isInteger(index) || index < 0 || index >= this.data.maxWeeklyShiftOptions.length) {
      return;
    }

    this.setData({
      maxWeeklyShiftIndex: index,
      selectedMaxWeeklyShifts: this.data.maxWeeklyShiftOptions[index].value,
      selectedMaxWeeklyShiftLabel: this.data.maxWeeklyShiftOptions[index].label,
    });
  },

  handleToggleWeekLeave(): void {
    if (this.data.isSchedulePublishedForCurrentCollection) {
      return;
    }

    const nextValue = !this.data.isWeekLeave;
    const fillDays = this.data.fillDays.map((day) => ({
      ...day,
      slots: day.slots.map((slot) => ({
        ...slot,
        isAvailable: nextValue ? false : this.data.selectedKeys.includes(slot.key),
      })),
    }));

    this.setData({
      isWeekLeave: nextValue,
      fillDays,
    });
  },

  handleToggleSaveDefault(): void {
    if (this.data.isSchedulePublishedForCurrentCollection) {
      return;
    }

    this.setData({
      saveAsDefault: !this.data.saveAsDefault,
    });
  },

  async handleSubmit(): Promise<void> {
    if (
      this.data.collectionStatus !== 'active' ||
      this.data.isSchedulePublishedForCurrentCollection
    ) {
      return;
    }

    const result = await saveCurrentCollectionFill({
      saveAsDefault: this.data.saveAsDefault,
      selectedKeys: this.data.isWeekLeave ? [] : this.data.selectedKeys,
      selectedMaxWeeklyShifts: this.data.selectedMaxWeeklyShifts,
      isWeekLeave: this.data.isWeekLeave,
    });

    if (!result.ok) {
      return;
    }

    wx.showToast({
      title: '填报已提交',
      icon: 'success',
    });

    if (result.data) {
      this.applyFillPayload(result.data);
      return;
    }

    this.setData({
      submittedAtText: '本次提交时间：已提交，等待刷新后同步',
      submittedSummaryExpanded: false,
      submittedSummaryLines: buildSubmittedSummaryLines(
        this.data.fillDays,
        this.data.selectedKeys,
        this.data.isWeekLeave,
      ),
      submittedSummaryVisible: true,
    });
  },

  handleReturnToEntry(): void {
    returnToTestEntry(true);
  },
});
