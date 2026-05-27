import type { ShiftSchedulerApp } from '../../app';
import type {
  ScheduleCandidateMember,
  SchedulePlan,
  ScheduleRuleConfig,
  ScheduleSlotPayload,
  ScheduleStatus,
  ScheduleStrategyKey,
  ScheduleWorkspacePayload,
} from '../../services/schedule';
import {
  exportPublishedSchedule,
  fetchScheduleWorkspace,
  generateSchedule,
  publishScheduleDraft,
  saveScheduleRules,
  updateScheduleAssignment,
} from '../../services/schedule';
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

interface RuleItemView {
  key: keyof ScheduleRuleConfig;
  title: string;
  description: string;
  active: boolean;
}

interface StrategyCardView {
  strategyKey: ScheduleStrategyKey;
  strategyName: string;
  score: number;
  coveredSlots: number;
  fullStaffedSlots: number;
  emptySlots: number;
  singlePersonSlots: number;
  riskCount: number;
  active: boolean;
  recommended: boolean;
}

interface CandidateView extends ScheduleCandidateMember {
  summaryText: string;
}

interface SlotView extends ScheduleSlotPayload {
  key: string;
  countText: string;
  riskTagLabels: string[];
}

interface SlotDayView {
  key: string;
  dateLabel: string;
  slots: SlotView[];
}

interface AdminScheduleData {
  guardState: GuardState;
  guardTitle: string;
  guardDescription: string;
  requestState: 'loading' | 'ready' | 'error';
  collectionId: number | null;
  userName: string;
  title: string;
  weekLabel: string;
  scheduleStatus: ScheduleStatus;
  scheduleStatusLabel: string;
  scheduleStatusClassName: string;
  collectionStatus: 'pending' | 'active' | 'completed';
  progressPercent: number;
  totalUsers: number;
  submittedUsers: number;
  totalAssignments: number;
  assignedSlots: number;
  totalSlots: number;
  riskSlotCount: number;
  canGenerate: boolean;
  canPublish: boolean;
  canShare: boolean;
  generateButtonLabel: string;
  publishButtonLabel: string;
  ruleConfig: ScheduleRuleConfig;
  ruleItems: RuleItemView[];
  strategyCards: StrategyCardView[];
  selectedStrategyKey: ScheduleStrategyKey | null;
  recommendedStrategyKey: ScheduleStrategyKey | null;
  dayGroups: SlotDayView[];
  isRuleDirty: boolean;
  isModalVisible: boolean;
  modalTitle: string;
  modalSubtitle: string;
  modalCandidates: CandidateView[];
  modalWorkDate: string;
  modalShiftTemplateId: number | null;
  activeNavKey: string;
  navItems: NavItem[];
}

const STATUS_LABEL_MAP: Record<ScheduleStatus, string> = {
  none: '未生成',
  draft: '草稿',
  adjusted: '待确认',
  published: '已发布',
};

const STATUS_CLASS_MAP: Record<ScheduleStatus, string> = {
  none: 'pending',
  draft: 'draft',
  adjusted: 'adjusted',
  published: 'completed',
};

const RULE_META: Array<{
  key: keyof ScheduleRuleConfig;
  title: string;
  description: string;
}> = [
  {
    key: 'preferCrossCollege',
    title: '跨学院搭配',
    description: '优先让同班次成员来自不同学院。',
  },
  {
    key: 'preferCrossGrade',
    title: '跨年级搭配',
    description: '优先避免同班次成员年级完全相同。',
  },
  {
    key: 'preferGenderBalance',
    title: '性别搭配',
    description: '优先让同班次成员保持性别组合。',
  },
  {
    key: 'preferSeniorNewPair',
    title: '新老搭配',
    description: '优先让新助理和老助理同班。',
  },
  {
    key: 'prioritizeReliability',
    title: '优先可靠标签',
    description: '优先安排带可靠标签的成员补位。',
  },
];

const RISK_TAG_LABEL_MAP: Record<string, string> = {
  NO_CANDIDATE: '无人可排',
  UNDER_MIN_COUNT: '低于最低人数',
  UNDER_REQUIRED_COUNT: '低于目标人数',
  SINGLE_SHIFT: '单人班',
  NEW_ASSISTANT_ALONE: '新助理单独值班',
  NO_SENIOR_WITH_NEW: '新助理没有老助理搭配',
  SAME_COLLEGE: '未满足跨学院偏好',
  SAME_GRADE: '未满足跨年级偏好',
  SAME_GENDER: '未满足性别搭配偏好',
  OVER_MAX_WEEKLY_SHIFTS: '超过个人每周上限',
};

function buildRuleItems(ruleConfig: ScheduleRuleConfig): RuleItemView[] {
  return RULE_META.map((item) => ({
    ...item,
    active: ruleConfig[item.key],
  }));
}

function toSlotCountText(slot: ScheduleSlotPayload): string {
  return `当前已排 ${slot.assignedCount} / 目标 ${slot.defaultRequiredCount} · 最低 ${slot.minCount}`;
}

function groupSlots(slots: ScheduleSlotPayload[]): SlotDayView[] {
  const groups = new Map<string, SlotDayView>();

  slots.forEach((slot) => {
    const current = groups.get(slot.workDate) ?? {
      key: slot.workDate,
      dateLabel: slot.dateLabel,
      slots: [],
    };

    current.slots.push({
      ...slot,
      key: `${slot.workDate}-${slot.shiftTemplateId}`,
      countText: toSlotCountText(slot),
      riskTagLabels: slot.riskTags.map((item) => RISK_TAG_LABEL_MAP[item] ?? item),
    });
    groups.set(slot.workDate, current);
  });

  return Array.from(groups.values());
}

function toCandidateSummary(candidate: ScheduleCandidateMember): string {
  const badges: string[] = [];

  if (candidate.recommended) {
    badges.push('推荐');
  }

  if (candidate.reliabilityTag) {
    badges.push('可靠');
  }

  if (candidate.canSoloShift) {
    badges.push('可单独值班');
  }

  const badgeText = badges.length > 0 ? ` · ${badges.join(' / ')}` : '';
  return `${candidate.studentId} · ${candidate.college} · ${candidate.grade}${badgeText}`;
}

function buildStrategyCards(
  plans: SchedulePlan[],
  selectedStrategyKey: ScheduleStrategyKey | null,
  recommendedStrategyKey: ScheduleStrategyKey | null,
): StrategyCardView[] {
  return plans.map((plan) => ({
    strategyKey: plan.strategyKey,
    strategyName: plan.strategyName,
    score: plan.score,
    coveredSlots: plan.summary.coveredSlots,
    fullStaffedSlots: plan.summary.fullStaffedSlots,
    emptySlots: plan.summary.emptySlots,
    singlePersonSlots: plan.summary.singlePersonSlots,
    riskCount: plan.summary.riskCount,
    active: plan.strategyKey === selectedStrategyKey,
    recommended: plan.strategyKey === recommendedStrategyKey,
  }));
}

function pickActivePlan(
  payload: ScheduleWorkspacePayload,
  selectedStrategyKey: ScheduleStrategyKey | null,
): SchedulePlan | null {
  if (payload.plans.length === 0) {
    return null;
  }

  return (
    payload.plans.find((item) => item.strategyKey === selectedStrategyKey) ??
    payload.plans.find((item) => item.strategyKey === payload.selectedStrategyKey) ??
    payload.plans[0]
  );
}

function buildModalCandidates(
  workspace: ScheduleWorkspacePayload,
  strategyKey: ScheduleStrategyKey,
  workDate: string,
  shiftTemplateId: number,
): CandidateView[] {
  const activePlan =
    workspace.plans.find((item) => item.strategyKey === strategyKey) ?? workspace.plans[0] ?? null;
  const currentSlot = activePlan?.slots.find(
    (slot) => slot.workDate === workDate && slot.shiftTemplateId === shiftTemplateId,
  );
  const selectedUserIds = new Set((currentSlot?.assignedMembers ?? []).map((member) => member.userId));

  return workspace.candidateMembers
    .filter((candidate) => !selectedUserIds.has(candidate.userId))
    .map((candidate) => ({
      ...candidate,
      summaryText: toCandidateSummary(candidate),
    }));
}

let currentWorkspace: ScheduleWorkspacePayload | null = null;

Page<{
  data: AdminScheduleData;
  onLoad: (options?: Record<string, string>) => void;
  onShow: () => void;
  loadPage: () => Promise<void>;
  applyWorkspace: (
    payload: ScheduleWorkspacePayload,
    nextSelectedStrategyKey?: ScheduleStrategyKey | null,
  ) => void;
  handleBack: () => void;
  handleRefresh: () => Promise<void>;
  handleNavChange: (event: { detail?: { key?: string } }) => void;
  handleToggleRule: (event: { currentTarget: { dataset: { key?: keyof ScheduleRuleConfig } } }) => void;
  handleSaveRules: () => Promise<void>;
  handleGenerateDraft: () => Promise<void>;
  handleSelectStrategy: (
    event: { currentTarget: { dataset: { strategyKey?: ScheduleStrategyKey } } },
  ) => void;
  handlePublishSchedule: () => Promise<void>;
  handleExportSchedule: () => Promise<void>;
  onShareAppMessage: () => { title: string; path: string };
  noop: () => void;
  handleOpenAddModal: (
    event: { currentTarget: { dataset: { workDate?: string; shiftTemplateId?: number; label?: string } } },
  ) => void;
  handleCloseModal: () => void;
  handleAddCandidate: (
    event: { currentTarget: { dataset: { userId?: number } } },
  ) => Promise<void>;
  handleRemoveMember: (
    event: {
      currentTarget: {
        dataset: {
          workDate?: string;
          shiftTemplateId?: number;
          userId?: number;
          memberName?: string;
        };
      };
    },
  ) => Promise<void>;
  handleReturnToEntry: () => void;
}>({
  data: {
    guardState: 'checking',
    guardTitle: '检查中',
    guardDescription: '正在确认当前页面访问权限。',
    requestState: 'loading',
    collectionId: null,
    userName: '',
    title: '',
    weekLabel: '',
    scheduleStatus: 'none',
    scheduleStatusLabel: STATUS_LABEL_MAP.none,
    scheduleStatusClassName: STATUS_CLASS_MAP.none,
    collectionStatus: 'pending',
    progressPercent: 0,
    totalUsers: 0,
    submittedUsers: 0,
    totalAssignments: 0,
    assignedSlots: 0,
    totalSlots: 0,
    riskSlotCount: 0,
    canGenerate: false,
    canPublish: false,
    canShare: false,
    generateButtonLabel: '生成排班草稿',
    publishButtonLabel: '确认并发布',
    ruleConfig: {
      preferCrossCollege: true,
      preferCrossGrade: true,
      preferGenderBalance: true,
      preferSeniorNewPair: true,
      prioritizeReliability: true,
    },
    ruleItems: buildRuleItems({
      preferCrossCollege: true,
      preferCrossGrade: true,
      preferGenderBalance: true,
      preferSeniorNewPair: true,
      prioritizeReliability: true,
    }),
    strategyCards: [],
    selectedStrategyKey: null,
    recommendedStrategyKey: null,
    dayGroups: [],
    isRuleDirty: false,
    isModalVisible: false,
    modalTitle: '',
    modalSubtitle: '',
    modalCandidates: [],
    modalWorkDate: '',
    modalShiftTemplateId: null,
    activeNavKey: 'schedule',
    navItems: [
      { key: 'schedule', label: '排班', icon: '排' },
      { key: 'duty', label: '日程', icon: '班' },
      { key: 'team', label: '团队', icon: '人' },
      { key: 'profile', label: '个人', icon: '我' },
    ],
  },

  onLoad(options): void {
    const collectionId = Number(options?.collectionId);

    this.setData({
      collectionId: Number.isInteger(collectionId) && collectionId > 0 ? collectionId : null,
    });
  },

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
    if (this.data.collectionId === null) {
      this.setData({
        requestState: 'error',
      });
      return;
    }

    this.setData({
      requestState: 'loading',
    });

    const result = await fetchScheduleWorkspace(this.data.collectionId);

    if (!result.ok || !result.data) {
      this.setData({
        requestState: 'error',
      });
      return;
    }

    this.applyWorkspace(result.data, this.data.selectedStrategyKey);
  },

  applyWorkspace(
    payload: ScheduleWorkspacePayload,
    nextSelectedStrategyKey?: ScheduleStrategyKey | null,
  ): void {
    const app = getApp<ShiftSchedulerApp>();
    const state = app.getGlobalState();

    currentWorkspace = payload;
    const selectedStrategyKey =
      nextSelectedStrategyKey ??
      payload.selectedStrategyKey ??
      payload.recommendedStrategy ??
      payload.plans[0]?.strategyKey ??
      null;
    const activePlan = pickActivePlan(payload, selectedStrategyKey);

    this.setData({
      requestState: 'ready',
      userName: state.currentUser?.name ?? '',
      title: payload.title,
      weekLabel: payload.weekLabel,
      scheduleStatus: payload.scheduleStatus,
      scheduleStatusLabel: STATUS_LABEL_MAP[payload.scheduleStatus],
      scheduleStatusClassName: STATUS_CLASS_MAP[payload.scheduleStatus],
      collectionStatus: payload.collectionStatus,
      progressPercent: payload.progressPercent,
      totalUsers: payload.totalUsers,
      submittedUsers: payload.submittedUsers,
      totalAssignments: activePlan?.summary.totalSlots
        ? activePlan.slots.reduce((sum, slot) => sum + slot.assignedCount, 0)
        : 0,
      assignedSlots: activePlan?.summary.coveredSlots ?? 0,
      totalSlots: activePlan?.summary.totalSlots ?? 0,
      riskSlotCount: activePlan?.summary.riskCount ?? 0,
      canGenerate: payload.collectionStatus === 'completed' && payload.scheduleStatus !== 'published',
      canPublish:
        payload.scheduleId !== null &&
        payload.plans.length > 0 &&
        (payload.scheduleStatus === 'draft' || payload.scheduleStatus === 'adjusted'),
      canShare: payload.scheduleId !== null && payload.scheduleStatus === 'published',
      generateButtonLabel:
        payload.scheduleStatus === 'draft' || payload.scheduleStatus === 'adjusted'
          ? '重新生成草稿'
          : '生成排班草稿',
      publishButtonLabel:
        payload.scheduleStatus === 'adjusted' ? '重新确认并发布' : '确认并发布',
      ruleConfig: payload.ruleConfig,
      ruleItems: buildRuleItems(payload.ruleConfig),
      strategyCards: buildStrategyCards(
        payload.plans,
        selectedStrategyKey,
        payload.recommendedStrategy,
      ),
      selectedStrategyKey,
      recommendedStrategyKey: payload.recommendedStrategy,
      dayGroups: activePlan ? groupSlots(activePlan.slots) : [],
      isRuleDirty: false,
      isModalVisible: false,
      modalTitle: '',
      modalSubtitle: '',
      modalCandidates: [],
      modalWorkDate: '',
      modalShiftTemplateId: null,
    });
  },

  handleBack(): void {
    wx.navigateBack({
      fail: () => {
        wx.redirectTo({
          url: '/pages/admin-main/index',
        });
      },
    });
  },

  async handleRefresh(): Promise<void> {
    await this.loadPage();

    if (this.data.requestState === 'ready') {
      wx.showToast({
        title: '排班方案已刷新',
        icon: 'success',
      });
    }
  },

  handleNavChange(event): void {
    const targetKey = event.detail?.key ?? '';

    if (targetKey === 'schedule') {
      wx.redirectTo({
        url: '/pages/admin-main/index',
      });
      return;
    }

    if (targetKey === 'duty') {
      wx.redirectTo({
        url: '/pages/admin-duty/index',
      });
      return;
    }

    if (targetKey === 'team') {
      wx.redirectTo({
        url: '/pages/admin-team/index',
      });
      return;
    }

    if (targetKey === 'profile') {
      wx.redirectTo({
        url: '/pages/admin-profile/index',
      });
      return;
    }
  },

  handleToggleRule(event): void {
    const key = event.currentTarget.dataset.key;

    if (!key) {
      return;
    }

    const nextRuleConfig: ScheduleRuleConfig = {
      ...this.data.ruleConfig,
      [key]: !this.data.ruleConfig[key],
    };

    this.setData({
      ruleConfig: nextRuleConfig,
      ruleItems: buildRuleItems(nextRuleConfig),
      isRuleDirty: true,
    });
  },

  async handleSaveRules(): Promise<void> {
    if (this.data.collectionId === null || !this.data.isRuleDirty) {
      return;
    }

    const result = await saveScheduleRules(this.data.collectionId, this.data.ruleConfig);

    if (!result.ok || !result.data) {
      return;
    }

    wx.showToast({
      title: '规则已保存',
      icon: 'success',
    });

    this.applyWorkspace(result.data, this.data.selectedStrategyKey);
  },

  async handleGenerateDraft(): Promise<void> {
    if (this.data.collectionId === null || !this.data.canGenerate) {
      return;
    }

    const result = await generateSchedule(this.data.collectionId);

    if (!result.ok || !result.data) {
      return;
    }

    wx.showToast({
      title: '排班方案已生成',
      icon: 'success',
    });

    this.applyWorkspace(result.data, result.data.recommendedStrategy);
  },

  handleSelectStrategy(event): void {
    if (!currentWorkspace) {
      return;
    }

    const strategyKey = event.currentTarget.dataset.strategyKey ?? null;

    if (!strategyKey) {
      return;
    }

    this.applyWorkspace(currentWorkspace, strategyKey);
  },

  async handlePublishSchedule(): Promise<void> {
    if (
      this.data.collectionId === null ||
      !this.data.canPublish ||
      this.data.selectedStrategyKey === null
    ) {
      return;
    }

    if (this.data.riskSlotCount > 0) {
      const confirmed = await new Promise<boolean>((resolve) => {
        wx.showModal({
          title: '仍存在风险班次',
          content: `当前还有 ${this.data.riskSlotCount} 个风险标签，确认按当前方案继续发布吗？`,
          success: (modalResult: { confirm: boolean }) => {
            resolve(modalResult.confirm);
          },
          fail: () => resolve(false),
        });
      });

      if (!confirmed) {
        return;
      }
    }

    const result = await publishScheduleDraft(this.data.collectionId, {
      strategyKey: this.data.selectedStrategyKey,
    });

    if (!result.ok || !result.data) {
      return;
    }

    wx.showToast({
      title: '排班已确认发布',
      icon: 'success',
    });

    this.applyWorkspace(result.data, this.data.selectedStrategyKey);
  },

  async handleExportSchedule(): Promise<void> {
    if (this.data.collectionId === null) {
      return;
    }

    const result = await exportPublishedSchedule(this.data.collectionId);

    if (!result.ok || !result.data) {
      return;
    }

    wx.showModal({
      title: '导出成功',
      content: `已生成文件：${result.data.fileName}\n保存位置：${result.data.localPath}`,
    });
  },

  onShareAppMessage(): { title: string; path: string } {
    if (this.data.collectionId === null || !this.data.canShare) {
      return {
        title: '排班结果',
        path: '/pages/admin-main/index',
      };
    }

    return {
      title: `${this.data.title} ${this.data.weekLabel}`.trim(),
      path: `/pages/schedule-share/index?collectionId=${this.data.collectionId}`,
    };
  },

  noop(): void {},

  handleOpenAddModal(event): void {
    if (!currentWorkspace || !this.data.selectedStrategyKey) {
      return;
    }

    const workDate = event.currentTarget.dataset.workDate ?? '';
    const shiftTemplateId = Number(event.currentTarget.dataset.shiftTemplateId);
    const label = event.currentTarget.dataset.label ?? '当前班次';

    if (!workDate || !Number.isInteger(shiftTemplateId)) {
      return;
    }

    this.setData({
      isModalVisible: true,
      modalTitle: `添加成员 · ${label}`,
      modalSubtitle: '这里可以直接加入未标记有空的成员，系统会照常保存并通知对方。',
      modalCandidates: buildModalCandidates(
        currentWorkspace,
        this.data.selectedStrategyKey,
        workDate,
        shiftTemplateId,
      ),
      modalWorkDate: workDate,
      modalShiftTemplateId: shiftTemplateId,
    });
  },

  handleCloseModal(): void {
    this.setData({
      isModalVisible: false,
      modalTitle: '',
      modalSubtitle: '',
      modalCandidates: [],
      modalWorkDate: '',
      modalShiftTemplateId: null,
    });
  },

  async handleAddCandidate(event): Promise<void> {
    const userId = Number(event.currentTarget.dataset.userId);
    const { collectionId, modalShiftTemplateId, modalWorkDate, selectedStrategyKey } = this.data;

    if (
      collectionId === null ||
      modalShiftTemplateId === null ||
      !modalWorkDate ||
      !Number.isInteger(userId) ||
      !currentWorkspace?.scheduleId ||
      !selectedStrategyKey
    ) {
      return;
    }

    const result = await updateScheduleAssignment(collectionId, currentWorkspace.scheduleId, {
      action: 'add',
      strategyKey: selectedStrategyKey,
      workDate: modalWorkDate,
      shiftTemplateId: modalShiftTemplateId,
      userId,
    });

    if (!result.ok || !result.data) {
      return;
    }

    wx.showToast({
      title: '成员已加入班次',
      icon: 'success',
    });

    this.applyWorkspace(result.data, selectedStrategyKey);
  },

  async handleRemoveMember(event): Promise<void> {
    const userId = Number(event.currentTarget.dataset.userId);
    const shiftTemplateId = Number(event.currentTarget.dataset.shiftTemplateId);
    const workDate = event.currentTarget.dataset.workDate ?? '';
    const memberName = event.currentTarget.dataset.memberName ?? '该成员';
    const collectionId = this.data.collectionId;
    const selectedStrategyKey = this.data.selectedStrategyKey;

    if (
      collectionId === null ||
      !currentWorkspace?.scheduleId ||
      !Number.isInteger(userId) ||
      !Number.isInteger(shiftTemplateId) ||
      !workDate ||
      !selectedStrategyKey
    ) {
      return;
    }

    const confirmed = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: '移出当前班次',
        content: `确认把 ${memberName} 从当前班次移出吗？`,
        success: (modalResult: { confirm: boolean }) => {
          resolve(modalResult.confirm);
        },
        fail: () => resolve(false),
      });
    });

    if (!confirmed) {
      return;
    }

    const result = await updateScheduleAssignment(collectionId, currentWorkspace.scheduleId, {
      action: 'remove',
      strategyKey: selectedStrategyKey,
      workDate,
      shiftTemplateId,
      userId,
    });

    if (!result.ok || !result.data) {
      return;
    }

    wx.showToast({
      title: '已移出当前班次',
      icon: 'success',
    });

    this.applyWorkspace(result.data, selectedStrategyKey);
  },

  handleReturnToEntry(): void {
    returnToTestEntry(true);
  },
});
