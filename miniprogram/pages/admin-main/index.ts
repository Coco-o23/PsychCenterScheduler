import type { ShiftSchedulerApp } from '../../app';
import type {
  CollectionDashboardPayload,
  CollectionDashboardStatus,
} from '../../services/availability';
import {
  fetchCollectionDashboard,
  publishCurrentCollection,
  republishCurrentCollection,
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

interface SubmittedMemberPreview {
  userId: number;
  name: string;
  studentId: string;
}

interface ShiftSummary {
  key: string;
  title: string;
  detail: string;
}

interface AdminMainData {
  guardState: GuardState;
  guardTitle: string;
  guardDescription: string;
  requestState: 'loading' | 'ready' | 'error';
  userName: string;
  roleLabel: string;
  semesterName: string;
  teachingWeekLabel: string;
  collectionTitle: string;
  collectionWeekLabel: string;
  collectionStatus: CollectionDashboardStatus;
  collectionStatusLabel: string;
  statusNote: string;
  progressPercent: number;
  totalUsers: number;
  submittedUsers: number;
  canPublish: boolean;
  currentCollectionId: number | null;
  submittedMembersPreview: SubmittedMemberPreview[];
  unsubmittedMembersPreview: SubmittedMemberPreview[];
  visibleSubmittedMembersPreview: SubmittedMemberPreview[];
  visibleUnsubmittedMembersPreview: SubmittedMemberPreview[];
  submittedMembersExpanded: boolean;
  unsubmittedMembersExpanded: boolean;
  shiftSummaries: ShiftSummary[];
  activeNavKey: string;
  navItems: NavItem[];
  republishButtonLabel: string;
}

const STATUS_LABEL_MAP: Record<CollectionDashboardStatus, string> = {
  pending: '待发布',
  active: '收集中',
  completed: '已完成',
  missing_semester: '待配置',
};

function toStatusNote(payload: CollectionDashboardPayload): string {
  const summary = payload.summary;

  if (summary.status === 'missing_semester') {
    return '请先在个人页完成学期和教学周配置。';
  }

  if (summary.status === 'pending') {
    return '本周可以直接发布新的空闲时间收集任务。';
  }

  if (summary.status === 'active') {
    return `已有 ${summary.submittedUsers} / ${summary.totalUsers} 名成员完成填报。`;
  }

  return '本轮填报已完成，可以进入详情查看每个班次的可排情况。';
}

function toShiftSummaries(payload: CollectionDashboardPayload): ShiftSummary[] {
  return payload.shiftTemplates.map((item) => ({
    key: String(item.shiftTemplateId),
    title: item.name,
    detail: `${item.startTime} - ${item.endTime} · 建议 ${item.defaultRequiredCount} 人`,
  }));
}

function syncCurrentCollection(app: ShiftSchedulerApp, payload: CollectionDashboardPayload): void {
  const summary = payload.summary;

  app.patchGlobalState({
    currentCollection:
      summary.collectionId === null || summary.weekLabel === null || summary.teachingWeek === null
        ? null
        : {
            id: String(summary.collectionId),
            title: summary.title,
            weekRange: summary.weekLabel,
            teachingWeek: summary.teachingWeek,
            status: summary.status === 'missing_semester' ? 'pending' : summary.status,
          },
  });
}

function buildVisibleMembers(
  members: SubmittedMemberPreview[],
  expanded: boolean,
): SubmittedMemberPreview[] {
  if (expanded || members.length <= 3) {
    return members;
  }

  return members.slice(0, 3);
}

function confirmRepublish(): Promise<boolean> {
  return new Promise((resolve) => {
    wx.showModal({
      title: '\u91cd\u65b0\u53d1\u5e03',
      content: '\u5c06\u6309\u6700\u65b0\u914d\u7f6e\u91cd\u5efa\u672c\u8f6e\u586b\u62a5\u8868\uff0c\u5df2\u63d0\u4ea4\u7684\u586b\u62a5\u7ed3\u679c\u4f1a\u88ab\u6e05\u7a7a\u3002',
      success: (result) => {
        resolve(result.confirm);
      },
      fail: () => {
        resolve(false);
      },
    });
  });
}

Page<{
  data: AdminMainData;
  onShow: () => void;
  loadPage: () => Promise<void>;
  applyDashboard: (payload: CollectionDashboardPayload) => void;
  handleToggleSubmittedMembers: () => void;
  handleToggleUnsubmittedMembers: () => void;
  handleNavChange: (event: { detail?: { key?: string } }) => void;
  handleOpenOwnAvailability: () => void;
  handleOpenNotifications: () => void;
  handlePublishCollection: () => Promise<void>;
  handleRepublishCollection: () => Promise<void>;
  handleOpenCollectionDetail: () => void;
  handleShowStage10Hint: () => void;
  handleReturnToEntry: () => void;
}>({
  data: {
    guardState: 'checking',
    guardTitle: '检查中',
    guardDescription: '正在确认当前页面访问权限。',
    requestState: 'loading',
    userName: '',
    roleLabel: '管理员',
    semesterName: '',
    teachingWeekLabel: '',
    collectionTitle: '',
    collectionWeekLabel: '',
    collectionStatus: 'pending',
    collectionStatusLabel: STATUS_LABEL_MAP.pending,
    statusNote: '',
    progressPercent: 0,
    totalUsers: 0,
    submittedUsers: 0,
    canPublish: false,
    currentCollectionId: null,
    submittedMembersPreview: [],
    unsubmittedMembersPreview: [],
    visibleSubmittedMembersPreview: [],
    visibleUnsubmittedMembersPreview: [],
    submittedMembersExpanded: false,
    unsubmittedMembersExpanded: false,
    shiftSummaries: [],
    activeNavKey: 'schedule',
    republishButtonLabel: '\u91cd\u65b0\u53d1\u5e03',
    navItems: [
      { key: 'schedule', label: '排班', icon: '排' },
      { key: 'duty', label: '日程', icon: '班' },
      { key: 'team', label: '团队', icon: '人' },
      { key: 'profile', label: '个人', icon: '我' },
    ],
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
    this.setData({
      requestState: 'loading',
    });

    const result = await fetchCollectionDashboard();

    if (!result.ok || !result.data) {
      this.setData({
        requestState: 'error',
      });
      return;
    }

    this.applyDashboard(result.data);
  },

  applyDashboard(payload: CollectionDashboardPayload): void {
    const app = getApp<ShiftSchedulerApp>();
    const state = app.getGlobalState();
    syncCurrentCollection(app, payload);
    const submittedMembersExpanded = false;
    const unsubmittedMembersExpanded = false;
    const submittedMembersPreview = payload.submittedMembersPreview;
    const unsubmittedMembersPreview = payload.unsubmittedMembersPreview;

    this.setData({
      requestState: 'ready',
      userName: state.currentUser?.name ?? '',
      roleLabel: state.currentRole === 'super_admin' ? '超级管理员' : '管理员',
      semesterName: state.currentSemester?.name ?? '未配置学期',
      teachingWeekLabel:
        payload.summary.teachingWeek === null ? '暂未计算教学周' : `第 ${payload.summary.teachingWeek} 教学周`,
      collectionTitle: payload.summary.title,
      collectionWeekLabel: payload.summary.weekLabel ?? '待配置',
      collectionStatus: payload.summary.status,
      collectionStatusLabel: STATUS_LABEL_MAP[payload.summary.status],
      statusNote: toStatusNote(payload),
      progressPercent: payload.summary.progressPercent,
      totalUsers: payload.summary.totalUsers,
      submittedUsers: payload.summary.submittedUsers,
      canPublish: payload.summary.canPublish,
      currentCollectionId: payload.summary.collectionId,
      submittedMembersPreview,
      unsubmittedMembersPreview,
      visibleSubmittedMembersPreview: buildVisibleMembers(submittedMembersPreview, submittedMembersExpanded),
      visibleUnsubmittedMembersPreview: buildVisibleMembers(
        unsubmittedMembersPreview,
        unsubmittedMembersExpanded,
      ),
      submittedMembersExpanded,
      unsubmittedMembersExpanded,
      shiftSummaries: toShiftSummaries(payload),
    });
  },

  handleToggleSubmittedMembers(): void {
    const submittedMembersExpanded = !this.data.submittedMembersExpanded;

    this.setData({
      submittedMembersExpanded,
      visibleSubmittedMembersPreview: buildVisibleMembers(
        this.data.submittedMembersPreview,
        submittedMembersExpanded,
      ),
    });
  },

  handleToggleUnsubmittedMembers(): void {
    const unsubmittedMembersExpanded = !this.data.unsubmittedMembersExpanded;

    this.setData({
      unsubmittedMembersExpanded,
      visibleUnsubmittedMembersPreview: buildVisibleMembers(
        this.data.unsubmittedMembersPreview,
        unsubmittedMembersExpanded,
      ),
    });
  },

  handleNavChange(event): void {
    const targetKey = event.detail?.key ?? '';

    this.setData({
      activeNavKey: targetKey || 'schedule',
    });

    if (targetKey === 'team') {
      wx.redirectTo({
        url: '/pages/admin-team/index',
      });
      return;
    }

    if (targetKey === 'duty') {
      wx.redirectTo({
        url: '/pages/admin-duty/index',
      });
      return;
    }

    if (targetKey === 'profile') {
      wx.redirectTo({
        url: '/pages/admin-profile/index',
      });
      return;
    }

    if (targetKey !== 'schedule') {
      wx.showToast({
        title: '第 9 阶段先验收排班主页与收集闭环',
        icon: 'none',
      });
    }
  },

  handleOpenOwnAvailability(): void {
    wx.navigateTo({
      url: '/pages/assistant-main/index?from=admin',
    });
  },

  handleOpenNotifications(): void {
    wx.navigateTo({
      url: '/pages/notifications/index',
    });
  },

  async handlePublishCollection(): Promise<void> {
    if (!this.data.canPublish) {
      return;
    }

    const result = await publishCurrentCollection();

    if (!result.ok || !result.data) {
      return;
    }

    wx.showToast({
      title: '收集任务已发布',
      icon: 'success',
    });

    this.applyDashboard(result.data);
  },

  async handleRepublishCollection(): Promise<void> {
    if (this.data.collectionStatus !== 'active') {
      return;
    }

    const confirmed = await confirmRepublish();

    if (!confirmed) {
      return;
    }

    const result = await republishCurrentCollection();

    if (!result.ok || !result.data) {
      return;
    }

    wx.showToast({
      title: '\u5df2\u91cd\u65b0\u53d1\u5e03',
      icon: 'success',
    });

    this.applyDashboard(result.data);
  },

  handleOpenCollectionDetail(): void {
    if (this.data.currentCollectionId === null) {
      return;
    }

    wx.navigateTo({
      url: `/pages/admin-collection-detail/index?collectionId=${this.data.currentCollectionId}`,
    });
  },

  handleShowStage10Hint(): void {
    if (this.data.currentCollectionId === null) {
      return;
    }

    wx.navigateTo({
      url: `/pages/admin-schedule/index?collectionId=${this.data.currentCollectionId}`,
    });
  },

  handleReturnToEntry(): void {
    returnToTestEntry(true);
  },
});
