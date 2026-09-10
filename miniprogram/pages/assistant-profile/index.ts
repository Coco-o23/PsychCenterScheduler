import {
  fetchProfileOverview,
  updateDefaultAvailability,
  type DefaultAvailabilitySlot,
} from '../../services/profile';
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

interface WeekdayOption {
  label: string;
  shortLabel: string;
  value: number;
}

interface AvailabilityRow {
  label: string;
  shiftIndex: number;
  cells: Array<{
    weekday: number;
    active: boolean;
  }>;
}

type ModalType = 'availability' | null;

interface AssistantProfileData {
  guardState: GuardState;
  guardTitle: string;
  guardDescription: string;
  requestState: 'loading' | 'ready' | 'error';
  activeNavKey: string;
  navItems: NavItem[];
  avatarText: string;
  userName: string;
  studentId: string;
  roleLabel: string;
  college: string;
  grade: string;
  availabilityHeadDays: WeekdayOption[];
  availabilityRows: AvailabilityRow[];
  selectedAvailabilityKeys: string[];
  workdaysSummary: string;
  shiftsSummary: string;
  overridesSummary: string;
  notificationSummary: string;
  modalType: ModalType;
}

const WEEKDAY_OPTIONS: WeekdayOption[] = [
  { label: '周一', shortLabel: 'Mon', value: 1 },
  { label: '周二', shortLabel: 'Tue', value: 2 },
  { label: '周三', shortLabel: 'Wed', value: 3 },
  { label: '周四', shortLabel: 'Thu', value: 4 },
  { label: '周五', shortLabel: 'Fri', value: 5 },
  { label: '周六', shortLabel: 'Sat', value: 6 },
  { label: '周日', shortLabel: 'Sun', value: 7 },
];

function createAvatarText(name: string): string {
  const normalized = name.trim();
  return normalized ? normalized.slice(-1) : '?';
}

function toRoleLabel(role: 'assistant' | 'admin' | 'super_admin'): string {
  if (role === 'super_admin') {
    return '超级管理员';
  }

  if (role === 'admin') {
    return '管理员';
  }

  return '助理';
}

function summarizeWorkdays(selectedWorkdays: number[]): string {
  const labels = WEEKDAY_OPTIONS.filter((item) => selectedWorkdays.includes(item.value)).map(
    (item) => item.label,
  );

  return labels.length > 0 ? labels.join('、') : '未设置';
}

function buildAvailabilityHeadDays(selectedWorkdays: number[]): WeekdayOption[] {
  const headDays = WEEKDAY_OPTIONS.filter((item) => selectedWorkdays.includes(item.value));
  return headDays.length > 0 ? headDays : WEEKDAY_OPTIONS.slice(0, 5);
}

function summarizeNotificationCount(unreadCount: number): string {
  if (unreadCount <= 0) {
    return '暂无未读消息';
  }

  return `有 ${unreadCount} 条未读消息`;
}

function normalizeAvailabilityKeys(slots: DefaultAvailabilitySlot[]): string[] {
  return Array.from(new Set(slots.map((item) => `${item.shiftIndex}-${item.weekday}`))).sort();
}

function expandAvailabilitySlots(selectedAvailabilityKeys: string[]): DefaultAvailabilitySlot[] {
  return selectedAvailabilityKeys
    .map((item) => {
      const [shiftIndexText, weekdayText] = item.split('-');
      const shiftIndex = Number(shiftIndexText);
      const weekday = Number(weekdayText);

      if (!Number.isInteger(shiftIndex) || !Number.isInteger(weekday)) {
        return null;
      }

      return {
        shiftIndex,
        weekday,
      };
    })
    .filter((item): item is DefaultAvailabilitySlot => item !== null);
}

function buildAvailabilityRows(
  headDays: WeekdayOption[],
  labels: string[],
  selectedAvailabilityKeys: string[],
): AvailabilityRow[] {
  return labels.map((label, shiftIndex) => ({
    label,
    shiftIndex,
    cells: headDays.map((day) => ({
      weekday: day.value,
      active: selectedAvailabilityKeys.includes(`${shiftIndex}-${day.value}`),
    })),
  }));
}

Page<{
  data: AssistantProfileData;
  onShow: () => void;
  loadPage: () => Promise<void>;
  handleNavChange: (event: { detail?: { key?: string } }) => void;
  openModal: (event: { currentTarget: { dataset: { type?: ModalType } } }) => void;
  closeModal: () => void;
  handleToggleAvailabilityCell: (event: {
    currentTarget: { dataset: { shiftIndex?: number; weekday?: number } };
  }) => void;
  handleSaveAvailability: () => Promise<void>;
  handleNotificationEntry: () => void;
  handleLogout: () => void;
  noop: () => void;
  handleReturnToEntry: () => void;
}>({
  data: {
    guardState: 'checking',
    guardTitle: '检查中',
    guardDescription: '正在确认个人页访问权限。',
    requestState: 'loading',
    activeNavKey: 'profile',
    navItems: [
      { key: 'availability', label: '填报', icon: 'edit_note' },
      { key: 'schedule', label: '日程', icon: 'calendar_month' },
      { key: 'team', label: '团队', icon: 'groups' },
      { key: 'profile', label: '个人', icon: 'person' },
    ],
    avatarText: '?',
    userName: '',
    studentId: '',
    roleLabel: '',
    college: '',
    grade: '',
    availabilityHeadDays: WEEKDAY_OPTIONS.slice(0, 5),
    availabilityRows: [],
    selectedAvailabilityKeys: [],
    workdaysSummary: '未设置',
    shiftsSummary: '未设置',
    overridesSummary: '未设置',
    notificationSummary: '暂无未读消息',
    modalType: null,
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

    const result = await fetchProfileOverview();

    if (!result.ok || !result.data) {
      this.setData({
        requestState: 'error',
      });
      return;
    }

    const overview = result.data;
    const selectedWorkdays = overview.workSettings.weeklyWorkdays;
    const availabilityHeadDays = buildAvailabilityHeadDays(selectedWorkdays);
    const selectedAvailabilityKeys = normalizeAvailabilityKeys(
      overview.defaultAvailability.selectedSlots,
    );

    this.setData({
      requestState: 'ready',
      avatarText: createAvatarText(overview.viewer?.name ?? ''),
      userName: overview.viewer?.name ?? '',
      studentId: overview.viewer?.studentId ?? '',
      roleLabel: toRoleLabel(overview.viewer?.role ?? 'assistant'),
      college: overview.viewer?.college ?? '',
      grade: overview.viewer?.grade ?? '',
      availabilityHeadDays,
      availabilityRows: buildAvailabilityRows(
        availabilityHeadDays,
        overview.workSettings.shiftTemplates.map((item) => item.name),
        selectedAvailabilityKeys,
      ),
      selectedAvailabilityKeys,
      workdaysSummary: summarizeWorkdays(selectedWorkdays),
      shiftsSummary: `${overview.workSettings.shiftTemplates.length} 个班次`,
      overridesSummary:
        overview.workSettings.overrides.length > 0
          ? `${overview.workSettings.overrides.length} 个特殊日期`
          : '未设置',
      notificationSummary: summarizeNotificationCount(overview.unreadNotificationCount ?? 0),
      modalType: null,
    });
  },

  handleNavChange(event): void {
    const targetKey = event.detail?.key ?? '';

    this.setData({
      activeNavKey: targetKey || 'profile',
    });

    if (targetKey === 'availability') {
      wx.redirectTo({
        url: '/pages/assistant-main/index',
      });
      return;
    }

    if (targetKey === 'schedule') {
      wx.redirectTo({
        url: '/pages/assistant-duty/index',
      });
      return;
    }

    if (targetKey === 'team') {
      wx.redirectTo({
        url: '/pages/assistant-team/index',
      });
    }
  },

  openModal(event): void {
    const modalType = event.currentTarget.dataset.type ?? null;

    if (modalType !== 'availability') {
      return;
    }

    this.setData({
      modalType,
    });
  },

  closeModal(): void {
    this.setData({
      modalType: null,
    });
  },

  handleToggleAvailabilityCell(event): void {
    const shiftIndex = Number(event.currentTarget.dataset.shiftIndex);
    const weekday = Number(event.currentTarget.dataset.weekday);

    if (!Number.isInteger(shiftIndex) || !Number.isInteger(weekday)) {
      return;
    }

    const key = `${shiftIndex}-${weekday}`;
    const selectedAvailabilityKeys = this.data.selectedAvailabilityKeys.includes(key)
      ? this.data.selectedAvailabilityKeys.filter((item) => item !== key)
      : [...this.data.selectedAvailabilityKeys, key].sort();

    this.setData({
      selectedAvailabilityKeys,
      availabilityRows: this.data.availabilityRows.map((row) => ({
        ...row,
        cells: row.cells.map((cell) => ({
          ...cell,
          active: selectedAvailabilityKeys.includes(`${row.shiftIndex}-${cell.weekday}`),
        })),
      })),
    });
  },

  async handleSaveAvailability(): Promise<void> {
    const result = await updateDefaultAvailability({
      selectedSlots: expandAvailabilitySlots(this.data.selectedAvailabilityKeys),
    });

    if (!result.ok) {
      return;
    }

    wx.showToast({
      title: '默认空闲时间已保存',
      icon: 'success',
    });

    this.closeModal();
    await this.loadPage();
  },

  handleNotificationEntry(): void {
    wx.navigateTo({
      url: '/pages/notifications/index',
    });
  },

  handleLogout(): void {
    wx.showModal({
      title: '退出测试身份',
      content: '退出后将返回测试分流页，需要重新选择身份进入。',
      success: (result) => {
        if (!result.confirm) {
          return;
        }

        returnToTestEntry(true);
      },
    });
  },

  noop(): void {
    return;
  },

  handleReturnToEntry(): void {
    returnToTestEntry(true);
  },
});
