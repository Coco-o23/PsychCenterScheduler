import type { ShiftSchedulerApp } from '../../app';
import type { CurrentSemester, SystemConfig } from '../../state/app-state';
import {
  fetchAdminConfiguration,
  fetchProfileOverview,
  updateDefaultAvailability,
  updateSemesterConfiguration,
  updateWorkSettings,
  type AdminConfigurationResponse,
  type DefaultAvailabilitySlot,
  type SchedulerWorkSettings,
  type ShiftTemplatePayload,
  type UpdateSemesterPayload,
  type WorkdayOverridePayload,
  type WorkdayOverrideType,
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

interface ModalWeekdayOption extends WeekdayOption {
  active: boolean;
}

interface AvailabilityRow {
  label: string;
  shiftIndex: number;
  cells: Array<{
    weekday: number;
    active: boolean;
  }>;
}

interface ShiftEditorItem {
  localId: string;
  name: string;
  startTime: string;
  endTime: string;
  defaultRequiredCount: string;
  minCount: string;
  allowSolo: boolean;
}

interface OverrideEditorItem {
  localId: string;
  workDate: string;
  overrideType: WorkdayOverrideType;
  reason: string;
}

interface SemesterFormState {
  name: string;
  firstWeekStartDate: string;
  totalWeeksText: string;
}

type ModalType = 'availability' | 'semester' | 'workdays' | 'shifts' | 'overrides' | 'export' | null;

interface DerivedStateSource {
  semester: AdminConfigurationResponse['semester'];
  workSettings: SchedulerWorkSettings;
  selectedAvailabilityKeys: string[];
}

interface AdminProfileData {
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
  semesterSummary: string;
  workdaysSummary: string;
  shiftsSummary: string;
  overridesSummary: string;
  notificationSummary: string;
  exportDirectorySummary: string;
  exportDirectoryInput: string;
  workdayOptionsForModal: ModalWeekdayOption[];
  shiftEditors: ShiftEditorItem[];
  overrideEditors: OverrideEditorItem[];
  semesterForm: SemesterFormState;
  modalType: ModalType;
}

const app = getApp<ShiftSchedulerApp>();

const WEEKDAY_OPTIONS: WeekdayOption[] = [
  { label: '周一', shortLabel: 'Mon', value: 1 },
  { label: '周二', shortLabel: 'Tue', value: 2 },
  { label: '周三', shortLabel: 'Wed', value: 3 },
  { label: '周四', shortLabel: 'Thu', value: 4 },
  { label: '周五', shortLabel: 'Fri', value: 5 },
  { label: '周六', shortLabel: 'Sat', value: 6 },
  { label: '周日', shortLabel: 'Sun', value: 7 },
];

let localIdSeed = 0;

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

function createLocalId(): string {
  localIdSeed += 1;
  return `local-${localIdSeed}`;
}

function sortNumberList(values: number[]): number[] {
  return [...values].sort((left, right) => left - right);
}

function summarizeWorkdays(selectedWorkdays: number[]): string {
  const labels = WEEKDAY_OPTIONS.filter((item) => selectedWorkdays.includes(item.value)).map(
    (item) => item.label,
  );
  return labels.length > 0 ? labels.join('、') : '未设置';
}

function summarizeShifts(workSettings: SchedulerWorkSettings): string {
  if (workSettings.shiftTemplates.length === 0) {
    return '未设置';
  }

  return `${workSettings.shiftTemplates.length} 个班次`;
}

function summarizeOverrides(workSettings: SchedulerWorkSettings): string {
  if (workSettings.overrides.length === 0) {
    return '未设置';
  }

  return `${workSettings.overrides.length} 个特殊日期`;
}

function summarizeExportDirectory(workSettings: SchedulerWorkSettings): string {
  return workSettings.exportDirectory.trim() || 'server/exports';
}

function summarizeNotificationCount(unreadCount: number): string {
  if (unreadCount <= 0) {
    return '暂无未读消息';
  }

  return `有 ${unreadCount} 条未读消息`;
}

function summarizeSemester(semester: AdminConfigurationResponse['semester']): string {
  if (!semester) {
    return '未设置';
  }

  return `${semester.name} · 第 1 周从 ${semester.firstWeekStartDate} 开始`;
}

function isMondayDate(dateText: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return false;
  }

  const [yearText, monthText, dayText] = dateText.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return utcDay === 1;
}

function buildAvailabilityHeadDays(selectedWorkdays: number[]): WeekdayOption[] {
  const headDays = WEEKDAY_OPTIONS.filter((item) => selectedWorkdays.includes(item.value));
  return headDays.length > 0 ? headDays : WEEKDAY_OPTIONS.slice(0, 5);
}

function buildWorkdayOptionsForModal(selectedWorkdays: number[]): ModalWeekdayOption[] {
  return WEEKDAY_OPTIONS.map((item) => ({
    ...item,
    active: selectedWorkdays.includes(item.value),
  }));
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

function buildShiftEditors(workSettings: SchedulerWorkSettings): ShiftEditorItem[] {
  return workSettings.shiftTemplates.map((item) => ({
    localId: createLocalId(),
    name: item.name,
    startTime: item.startTime,
    endTime: item.endTime,
    defaultRequiredCount: String(item.defaultRequiredCount),
    minCount: String(item.minCount),
    allowSolo: item.allowSolo,
  }));
}

function buildOverrideEditors(workSettings: SchedulerWorkSettings): OverrideEditorItem[] {
  return workSettings.overrides.map((item) => ({
    localId: createLocalId(),
    workDate: item.workDate,
    overrideType: item.overrideType,
    reason: item.reason ?? '',
  }));
}

function toSystemConfig(workSettings: SchedulerWorkSettings): SystemConfig {
  return {
    maxWeeklyShiftsLimit: workSettings.maxWeeklyShiftsLimit,
    weeklyWorkdays: [...workSettings.weeklyWorkdays],
    defaultShiftRequiredCount: workSettings.shiftTemplates[0]?.defaultRequiredCount ?? 0,
    defaultShiftTimes: workSettings.shiftTemplates.map((item, index) => ({
      id: String(item.shiftTemplateId ?? index),
      label: item.name,
      startTime: item.startTime,
      endTime: item.endTime,
      minCount: item.minCount,
      allowSolo: item.allowSolo,
    })),
    workdayOverrides: workSettings.overrides.map((item) => ({
      workDate: item.workDate,
      overrideType: item.overrideType,
      reason: item.reason,
    })),
  };
}

function syncGlobalConfig(
  semester: AdminConfigurationResponse['semester'],
  workSettings: SchedulerWorkSettings,
): void {
  const patch: {
    currentSemester?: CurrentSemester | null;
    systemConfig?: SystemConfig;
  } = {
    systemConfig: toSystemConfig(workSettings),
  };

  patch.currentSemester = semester
    ? {
        id: String(semester.semesterId),
        name: semester.name,
        firstWeekStartDate: semester.firstWeekStartDate,
        totalWeeks: semester.totalWeeks,
      }
    : null;

  app.patchGlobalState(patch);
}

function buildDerivedState(source: DerivedStateSource): Pick<
  AdminProfileData,
  | 'availabilityHeadDays'
  | 'availabilityRows'
  | 'semesterSummary'
  | 'workdaysSummary'
  | 'shiftsSummary'
  | 'overridesSummary'
  | 'notificationSummary'
  | 'exportDirectorySummary'
  | 'exportDirectoryInput'
  | 'workdayOptionsForModal'
  | 'shiftEditors'
  | 'overrideEditors'
  | 'semesterForm'
> {
  const availabilityHeadDays = buildAvailabilityHeadDays(source.workSettings.weeklyWorkdays);

  return {
    availabilityHeadDays,
    availabilityRows: buildAvailabilityRows(
      availabilityHeadDays,
      source.workSettings.shiftTemplates.map((item) => item.name),
      source.selectedAvailabilityKeys,
    ),
    semesterSummary: summarizeSemester(source.semester),
    workdaysSummary: summarizeWorkdays(source.workSettings.weeklyWorkdays),
    shiftsSummary: summarizeShifts(source.workSettings),
    overridesSummary: summarizeOverrides(source.workSettings),
    notificationSummary: '暂无未读消息',
    exportDirectorySummary: summarizeExportDirectory(source.workSettings),
    exportDirectoryInput: summarizeExportDirectory(source.workSettings),
    workdayOptionsForModal: buildWorkdayOptionsForModal(source.workSettings.weeklyWorkdays),
    shiftEditors: buildShiftEditors(source.workSettings),
    overrideEditors: buildOverrideEditors(source.workSettings),
    semesterForm: {
      name: source.semester?.name ?? '',
      firstWeekStartDate: source.semester?.firstWeekStartDate ?? '',
      totalWeeksText: source.semester ? String(source.semester.totalWeeks) : '',
    },
  };
}

Page({
  data: {
    guardState: 'checking',
    guardTitle: '检查中',
    guardDescription: '正在确认个人页访问权限。',
    requestState: 'loading',
    activeNavKey: 'profile',
    navItems: [
      { key: 'availability', label: '排班', icon: 'view_quilt' },
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
    semesterSummary: '未设置',
    workdaysSummary: '未设置',
    shiftsSummary: '未设置',
    overridesSummary: '未设置',
    notificationSummary: '暂无未读消息',
    exportDirectorySummary: 'server/exports',
    exportDirectoryInput: 'server/exports',
    workdayOptionsForModal: buildWorkdayOptionsForModal([1, 2, 3, 4, 5]),
    shiftEditors: [],
    overrideEditors: [],
    semesterForm: {
      name: '',
      firstWeekStartDate: '',
      totalWeeksText: '',
    },
    modalType: null,
  } as AdminProfileData,

  onShow(): void {
    const allowed = ensurePageAccess(this, {
      allowedRoles: ['admin', 'super_admin'],
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

    const [profileResult, adminConfigResult] = await Promise.all([
      fetchProfileOverview(),
      fetchAdminConfiguration(),
    ]);

    if (!profileResult.ok || !profileResult.data || !adminConfigResult.ok || !adminConfigResult.data) {
      this.setData({
        requestState: 'error',
      });
      return;
    }

    const overview = profileResult.data;
    const adminConfig = adminConfigResult.data;
    const selectedAvailabilityKeys = normalizeAvailabilityKeys(
      overview.defaultAvailability.selectedSlots,
    );

    syncGlobalConfig(adminConfig.semester, adminConfig.workSettings);
    this.applyViewState({
      adminConfig,
      overview,
      selectedAvailabilityKeys,
    });
  },

  applyViewState(input: {
    adminConfig: AdminConfigurationResponse;
    overview: Awaited<ReturnType<typeof fetchProfileOverview>>['data'];
    selectedAvailabilityKeys: string[];
  }): void {
    const overview = input.overview;

    if (!overview) {
      return;
    }

    const derivedState = buildDerivedState({
      semester: input.adminConfig.semester,
      workSettings: input.adminConfig.workSettings,
      selectedAvailabilityKeys: input.selectedAvailabilityKeys,
    });

    this.setData({
      requestState: 'ready',
      avatarText: createAvatarText(overview.viewer?.name ?? ''),
      userName: overview.viewer?.name ?? '',
      studentId: overview.viewer?.studentId ?? '',
      roleLabel: toRoleLabel(overview.viewer?.role ?? 'admin'),
      college: overview.viewer?.college ?? '',
      grade: overview.viewer?.grade ?? '',
      selectedAvailabilityKeys: input.selectedAvailabilityKeys,
      modalType: null,
      ...derivedState,
      notificationSummary: summarizeNotificationCount(overview.unreadNotificationCount ?? 0),
    });
  },

  handleNavChange(event: { detail?: { key?: string } }): void {
    const targetKey = event.detail?.key ?? '';

    this.setData({
      activeNavKey: targetKey || 'profile',
    });

    if (targetKey === 'availability') {
      wx.redirectTo({
        url: '/pages/admin-main/index',
      });
      return;
    }

    if (targetKey === 'schedule') {
      wx.redirectTo({
        url: '/pages/admin-duty/index',
      });
      return;
    }

    if (targetKey === 'team') {
      wx.redirectTo({
        url: '/pages/admin-team/index',
      });
    }
  },

  openModal(event: { currentTarget: { dataset: { type?: ModalType } } }): void {
    const modalType = event.currentTarget.dataset.type ?? null;

    if (!modalType) {
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

  handleToggleAvailabilityCell(event: {
    currentTarget: { dataset: { shiftIndex?: number; weekday?: number } };
  }): void {
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

  handleSemesterInput(event: {
    currentTarget: { dataset: { field?: keyof SemesterFormState } };
    detail?: { value?: string };
  }): void {
    const field = event.currentTarget.dataset.field;

    if (!field) {
      return;
    }

    this.setData({
      semesterForm: {
        ...this.data.semesterForm,
        [field]: event.detail?.value ?? '',
      },
    });
  },

  async handleSaveSemester(): Promise<void> {
    if (!isMondayDate(this.data.semesterForm.firstWeekStartDate)) {
      wx.showToast({
        title: '第 1 教学周起始日期必须是周一',
        icon: 'none',
      });
      return;
    }

    const totalWeeks = Number(this.data.semesterForm.totalWeeksText);

    if (!Number.isInteger(totalWeeks) || totalWeeks <= 0) {
      wx.showToast({
        title: '总周数必须大于 0',
        icon: 'none',
      });
      return;
    }

    const payload: UpdateSemesterPayload = {
      name: this.data.semesterForm.name.trim(),
      firstWeekStartDate: this.data.semesterForm.firstWeekStartDate.trim(),
      totalWeeks,
    };

    const result = await updateSemesterConfiguration(payload);

    if (!result.ok) {
      return;
    }

    wx.showToast({
      title: '学期设置已保存',
      icon: 'success',
    });

    this.closeModal();
    await this.loadPage();
  },

  handleToggleWorkday(event: { currentTarget: { dataset: { value?: number } } }): void {
    const value = Number(event.currentTarget.dataset.value);

    if (!Number.isInteger(value)) {
      return;
    }

    const weeklyWorkdays = sortNumberList(
      this.data.workdayOptionsForModal
        .filter((item) => item.active && item.value !== value)
        .map((item) => item.value)
        .concat(
          this.data.workdayOptionsForModal.some((item) => item.value === value && item.active)
            ? []
            : [value],
        ),
    );

    this.setData({
      workdayOptionsForModal: buildWorkdayOptionsForModal(weeklyWorkdays),
    });
  },

  handleShiftInput(event: {
    currentTarget: { dataset: { index?: number; field?: keyof ShiftEditorItem } };
    detail?: { value?: string };
  }): void {
    const index = Number(event.currentTarget.dataset.index);
    const field = event.currentTarget.dataset.field;

    if (!Number.isInteger(index) || !field) {
      return;
    }

    const shiftEditors = [...this.data.shiftEditors];
    shiftEditors[index] = {
      ...shiftEditors[index],
      [field]: event.detail?.value ?? '',
    };

    this.setData({
      shiftEditors,
    });
  },

  handleToggleShiftSolo(event: {
    currentTarget: { dataset: { index?: number } };
    detail?: { value?: boolean };
  }): void {
    const index = Number(event.currentTarget.dataset.index);

    if (!Number.isInteger(index)) {
      return;
    }

    const shiftEditors = [...this.data.shiftEditors];
    shiftEditors[index] = {
      ...shiftEditors[index],
      allowSolo: !!event.detail?.value,
    };

    this.setData({
      shiftEditors,
    });
  },

  handleAddShift(): void {
    this.setData({
      shiftEditors: [
        ...this.data.shiftEditors,
        {
          localId: createLocalId(),
          name: '',
          startTime: '',
          endTime: '',
          defaultRequiredCount: '2',
          minCount: '1',
          allowSolo: false,
        },
      ],
    });
  },

  handleRemoveShift(event: { currentTarget: { dataset: { index?: number } } }): void {
    const index = Number(event.currentTarget.dataset.index);

    if (!Number.isInteger(index) || this.data.shiftEditors.length <= 1) {
      return;
    }

    this.setData({
      shiftEditors: this.data.shiftEditors.filter((_, itemIndex) => itemIndex !== index),
    });
  },

  handleOverrideInput(event: {
    currentTarget: { dataset: { index?: number; field?: keyof OverrideEditorItem } };
    detail?: { value?: string };
  }): void {
    const index = Number(event.currentTarget.dataset.index);
    const field = event.currentTarget.dataset.field;

    if (!Number.isInteger(index) || !field) {
      return;
    }

    const overrideEditors = [...this.data.overrideEditors];
    overrideEditors[index] = {
      ...overrideEditors[index],
      [field]: event.detail?.value ?? '',
    };

    this.setData({
      overrideEditors,
    });
  },

  handleOverrideType(event: {
    currentTarget: { dataset: { index?: number; value?: WorkdayOverrideType } };
  }): void {
    const index = Number(event.currentTarget.dataset.index);
    const value = event.currentTarget.dataset.value;

    if (!Number.isInteger(index) || !value) {
      return;
    }

    const overrideEditors = [...this.data.overrideEditors];
    overrideEditors[index] = {
      ...overrideEditors[index],
      overrideType: value,
    };

    this.setData({
      overrideEditors,
    });
  },

  handleAddOverride(): void {
    this.setData({
      overrideEditors: [
        ...this.data.overrideEditors,
        {
          localId: createLocalId(),
          workDate: '',
          overrideType: 'workday',
          reason: '',
        },
      ],
    });
  },

  handleRemoveOverride(event: { currentTarget: { dataset: { index?: number } } }): void {
    const index = Number(event.currentTarget.dataset.index);

    if (!Number.isInteger(index)) {
      return;
    }

    this.setData({
      overrideEditors: this.data.overrideEditors.filter((_, itemIndex) => itemIndex !== index),
    });
  },

  async handleSaveWorkdays(): Promise<void> {
    const weeklyWorkdays = sortNumberList(
      this.data.workdayOptionsForModal.filter((item) => item.active).map((item) => item.value),
    );

    if (weeklyWorkdays.length === 0) {
      wx.showToast({
        title: '至少选择一个工作日',
        icon: 'none',
      });
      return;
    }

    await this.submitWorkSettings({
      weeklyWorkdays,
      exportDirectory: this.data.exportDirectoryInput,
      shiftTemplates: this.data.shiftEditors,
      overrides: this.data.overrideEditors,
      successMessage: '每周工作时间已保存',
    });
  },

  async handleSaveShifts(): Promise<void> {
    await this.submitWorkSettings({
      weeklyWorkdays: this.data.workdayOptionsForModal
        .filter((item) => item.active)
        .map((item) => item.value),
      exportDirectory: this.data.exportDirectoryInput,
      shiftTemplates: this.data.shiftEditors,
      overrides: this.data.overrideEditors,
      successMessage: '默认班次已保存',
    });
  },

  async handleSaveOverrides(): Promise<void> {
    await this.submitWorkSettings({
      weeklyWorkdays: this.data.workdayOptionsForModal
        .filter((item) => item.active)
        .map((item) => item.value),
      exportDirectory: this.data.exportDirectoryInput,
      shiftTemplates: this.data.shiftEditors,
      overrides: this.data.overrideEditors,
      successMessage: '特殊日期已保存',
    });
  },

  handleExportDirectoryInput(event: { detail?: { value?: string } }): void {
    this.setData({
      exportDirectoryInput: event.detail?.value ?? '',
    });
  },

  async handleSaveExportDirectory(): Promise<void> {
    await this.submitWorkSettings({
      weeklyWorkdays: this.data.workdayOptionsForModal
        .filter((item) => item.active)
        .map((item) => item.value),
      exportDirectory: this.data.exportDirectoryInput,
      shiftTemplates: this.data.shiftEditors,
      overrides: this.data.overrideEditors,
      successMessage: '导出位置已保存',
    });
  },

  async submitWorkSettings(input: {
    weeklyWorkdays: number[];
    exportDirectory: string;
    shiftTemplates: ShiftEditorItem[];
    overrides: OverrideEditorItem[];
    successMessage: string;
  }): Promise<void> {
    if (input.weeklyWorkdays.length === 0) {
      wx.showToast({
        title: '至少选择一个工作日',
        icon: 'none',
      });
      return;
    }

    const exportDirectory = input.exportDirectory.trim();

    if (!exportDirectory) {
      wx.showToast({
        title: '导出位置不能为空',
        icon: 'none',
      });
      return;
    }

    const shiftTemplates: ShiftTemplatePayload[] = input.shiftTemplates.map((item) => ({
      name: item.name.trim(),
      startTime: item.startTime.trim(),
      endTime: item.endTime.trim(),
      defaultRequiredCount: Number(item.defaultRequiredCount),
      minCount: Number(item.minCount),
      allowSolo: item.allowSolo,
    }));

    const invalidShift = shiftTemplates.some(
      (item) =>
        !item.name ||
        !item.startTime ||
        !item.endTime ||
        !Number.isInteger(item.defaultRequiredCount) ||
        item.defaultRequiredCount <= 0 ||
        !Number.isInteger(item.minCount) ||
        item.minCount <= 0,
    );

    if (invalidShift) {
      wx.showToast({
        title: '请完善班次信息',
        icon: 'none',
      });
      return;
    }

    const overrides: WorkdayOverridePayload[] = input.overrides
      .filter((item) => item.workDate.trim())
      .map((item) => ({
        workDate: item.workDate.trim(),
        overrideType: item.overrideType,
        reason: item.reason.trim() || null,
      }));

    if (overrides.some((item) => !/^\d{4}-\d{2}-\d{2}$/.test(item.workDate))) {
      wx.showToast({
        title: '特殊日期格式必须为 YYYY-MM-DD',
        icon: 'none',
      });
      return;
    }

    const payload = {
      weeklyWorkdays: sortNumberList(input.weeklyWorkdays),
      exportDirectory,
      shiftTemplates,
      overrides,
    };

    const result = await updateWorkSettings(payload);

    if (!result.ok) {
      return;
    }

    wx.showToast({
      title: input.successMessage,
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
