import type { ShiftSchedulerApp } from '../../app';
import type {
  CollectionDetailPayload,
  CollectionDetailSlot,
} from '../../services/availability';
import {
  fetchCollectionDetail,
  updateCollectionManualAvailability,
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

interface CandidateView {
  userId: number;
  name: string;
  studentId: string;
  summary: string;
}

interface SlotView extends CollectionDetailSlot {
  key: string;
  countText: string;
}

interface SlotDayView {
  key: string;
  dateLabel: string;
  slots: SlotView[];
}

interface AdminCollectionDetailData {
  guardState: GuardState;
  guardTitle: string;
  guardDescription: string;
  requestState: 'loading' | 'ready' | 'error';
  collectionId: number | null;
  userName: string;
  title: string;
  weekLabel: string;
  status: CollectionDetailPayload['status'];
  statusLabel: string;
  progressPercent: number;
  totalUsers: number;
  submittedUsers: number;
  dayGroups: SlotDayView[];
  isModalVisible: boolean;
  modalTitle: string;
  modalSubtitle: string;
  modalCandidates: CandidateView[];
  modalWorkDate: string;
  modalShiftTemplateId: number | null;
  activeNavKey: string;
  navItems: NavItem[];
}

const STATUS_LABEL_MAP: Record<CollectionDetailPayload['status'], string> = {
  pending: '待发布',
  active: '收集中',
  completed: '已完成',
};

function toRiskText(slot: CollectionDetailSlot): string {
  return `${slot.availableCount} / ${slot.defaultRequiredCount} 人`;
}

function groupSlots(slots: CollectionDetailSlot[]): SlotDayView[] {
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
      countText: toRiskText(slot),
    });

    groups.set(slot.workDate, current);
  });

  return Array.from(groups.values());
}

function buildModalCandidates(
  payload: CollectionDetailPayload,
  workDate: string,
  shiftTemplateId: number,
): CandidateView[] {
  const currentSlot = payload.slots.find(
    (slot) => slot.workDate === workDate && slot.shiftTemplateId === shiftTemplateId,
  );
  const selectedUserIds = new Set((currentSlot?.members ?? []).map((member) => member.userId));

  return payload.candidateMembers
    .filter((candidate) => !selectedUserIds.has(candidate.userId))
    .map((candidate) => ({
      userId: candidate.userId,
      name: candidate.name,
      studentId: candidate.studentId,
      summary: `${candidate.college} · ${candidate.grade}`,
    }));
}

let currentDetailPayload: CollectionDetailPayload | null = null;

Page<{
  data: AdminCollectionDetailData;
  onLoad: (options?: Record<string, string>) => void;
  onShow: () => void;
  loadPage: () => Promise<void>;
  applyDetail: (payload: CollectionDetailPayload) => void;
  handleNavChange: (event: { detail?: { key?: string } }) => void;
  handleBack: () => void;
  handleRefresh: () => Promise<void>;
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
    status: 'active',
    statusLabel: '收集中',
    progressPercent: 0,
    totalUsers: 0,
    submittedUsers: 0,
    dayGroups: [],
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

    const result = await fetchCollectionDetail(this.data.collectionId);

    if (!result.ok || !result.data) {
      this.setData({
        requestState: 'error',
      });
      return;
    }

    this.applyDetail(result.data);
  },

  applyDetail(payload: CollectionDetailPayload): void {
    const app = getApp<ShiftSchedulerApp>();
    const state = app.getGlobalState();

    currentDetailPayload = payload;
    this.setData({
      requestState: 'ready',
      userName: state.currentUser?.name ?? '',
      title: payload.title,
      weekLabel: payload.weekLabel,
      status: payload.status,
      statusLabel: STATUS_LABEL_MAP[payload.status],
      progressPercent: payload.progressPercent,
      totalUsers: payload.totalUsers,
      submittedUsers: payload.submittedUsers,
      dayGroups: groupSlots(payload.slots),
      isModalVisible: false,
      modalTitle: '',
      modalSubtitle: '',
      modalCandidates: [],
      modalWorkDate: '',
      modalShiftTemplateId: null,
    });
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
        title: '统计已刷新',
        icon: 'success',
      });
    }
  },

  noop(): void {},

  handleOpenAddModal(event): void {
    if (!currentDetailPayload) {
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
      modalTitle: `添加可排成员 · ${label}`,
      modalSubtitle: '只会调整本次收集详情，不会改动成员默认空闲时间。',
      modalCandidates: buildModalCandidates(currentDetailPayload, workDate, shiftTemplateId),
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
    const { collectionId, modalShiftTemplateId, modalWorkDate } = this.data;

    if (
      collectionId === null ||
      modalShiftTemplateId === null ||
      !modalWorkDate ||
      !Number.isInteger(userId)
    ) {
      return;
    }

    const result = await updateCollectionManualAvailability(collectionId, {
      action: 'add',
      workDate: modalWorkDate,
      shiftTemplateId: modalShiftTemplateId,
      userId,
    });

    if (!result.ok || !result.data) {
      return;
    }

    wx.showToast({
      title: '已加入可排名单',
      icon: 'success',
    });

    this.applyDetail(result.data);
  },

  async handleRemoveMember(event): Promise<void> {
    const userId = Number(event.currentTarget.dataset.userId);
    const shiftTemplateId = Number(event.currentTarget.dataset.shiftTemplateId);
    const workDate = event.currentTarget.dataset.workDate ?? '';
    const memberName = event.currentTarget.dataset.memberName ?? '该成员';
    const collectionId = this.data.collectionId;

    if (
      collectionId === null ||
      !Number.isInteger(userId) ||
      !Number.isInteger(shiftTemplateId) ||
      !workDate
    ) {
      return;
    }

    const confirmed = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: '移出可排名单',
        content: `确认将 ${memberName} 从当前班次可排名单中移出吗？`,
        success: (modalResult: { confirm: boolean }) => {
          resolve(modalResult.confirm);
        },
        fail: () => resolve(false),
      });
    });

    if (!confirmed) {
      return;
    }

    const result = await updateCollectionManualAvailability(collectionId, {
      action: 'remove',
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

    this.applyDetail(result.data);
  },

  handleReturnToEntry(): void {
    returnToTestEntry(true);
  },
});
