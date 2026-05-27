import type { ShiftSchedulerApp } from '../../app';
import type {
  ScheduleShareDayPayload,
  ScheduleSharePayload,
} from '../../services/schedule';
import { fetchScheduleShare } from '../../services/schedule';
import {
  ensurePageAccess,
  getHomePathForRole,
  returnToTestEntry,
  type GuardState,
} from '../../utils/route-guard';

interface ShareMemberView {
  userId: number;
  label: string;
  meta: string;
  isSelf: boolean;
}

interface ShareSlotView {
  key: string;
  shiftLabel: string;
  timeLabel: string;
  assignedMembers: ShareMemberView[];
}

interface ShareDayView {
  key: string;
  dateLabel: string;
  weekdayLabel: string;
  slots: ShareSlotView[];
}

interface ScheduleSharePageData {
  guardState: GuardState;
  guardTitle: string;
  guardDescription: string;
  requestState: 'loading' | 'ready' | 'error';
  collectionId: number | null;
  title: string;
  weekLabel: string;
  confirmedAt: string;
  viewerName: string;
  scopeLabel: string;
  scopeDescription: string;
  emptyStateMessage: string;
  dayGroups: ShareDayView[];
}

const MEMBER_TYPE_LABEL_MAP: Record<string, string> = {
  new_assistant: '新助理',
  senior_assistant: '老助理',
  intern_assistant: '实习助理',
  manager_assistant: '管理助理',
};

function parseCollectionId(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toConfirmedText(value: string | null): string {
  if (!value) {
    return '未记录发布时间';
  }

  const [datePart, timePart = ''] = value.split('T');
  return `${datePart} ${timePart.slice(0, 5)}`.trim();
}

function buildScopeCopy(payload: ScheduleSharePayload): { label: string; description: string } {
  if (payload.viewScope === 'full') {
    return {
      label: '完整排班',
      description: '当前视图展示本周已发布的完整排班结果。',
    };
  }

  return {
    label: '仅本人相关',
    description: '当前视图只展示与你相关的已发布班次。',
  };
}

function toDayGroups(days: ScheduleShareDayPayload[]): ShareDayView[] {
  return days.map((day) => ({
    key: day.workDate,
    dateLabel: day.dateLabel,
    weekdayLabel: day.weekdayLabel,
    slots: day.slots.map((slot) => ({
      key: `${slot.workDate}-${slot.shiftTemplateId}`,
      shiftLabel: slot.shiftLabel,
      timeLabel: `${slot.startTime} - ${slot.endTime}`,
      assignedMembers: slot.assignedMembers.map((member) => ({
        userId: member.userId,
        label: member.name,
        meta: `${member.studentId} · ${MEMBER_TYPE_LABEL_MAP[member.memberType] ?? member.memberType}`,
        isSelf: member.isSelf,
      })),
    })),
  }));
}

Page({
  data: {
    guardState: 'checking',
    guardTitle: '检查中',
    guardDescription: '正在确认当前页面访问权限。',
    requestState: 'loading',
    collectionId: null,
    title: '',
    weekLabel: '',
    confirmedAt: '',
    viewerName: '',
    scopeLabel: '',
    scopeDescription: '',
    emptyStateMessage: '',
    dayGroups: [],
  } as ScheduleSharePageData,

  onLoad(options?: Record<string, string>): void {
    this.setData({
      collectionId: parseCollectionId(options?.collectionId),
    });
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
    if (this.data.collectionId === null) {
      this.setData({
        requestState: 'error',
        emptyStateMessage: '缺少分享所需的 collectionId。',
      });
      return;
    }

    this.setData({
      requestState: 'loading',
    });

    const result = await fetchScheduleShare(this.data.collectionId);

    if (!result.ok || !result.data) {
      this.setData({
        requestState: 'error',
      });
      return;
    }

    this.applyPayload(result.data);
  },

  applyPayload(payload: ScheduleSharePayload): void {
    const app = getApp<ShiftSchedulerApp>();
    const state = app.getGlobalState();
    const scopeCopy = buildScopeCopy(payload);

    this.setData({
      requestState: 'ready',
      title: payload.title,
      weekLabel: payload.weekLabel,
      confirmedAt: toConfirmedText(payload.confirmedAt),
      viewerName: state.currentUser?.name ?? payload.viewerName,
      scopeLabel: scopeCopy.label,
      scopeDescription: scopeCopy.description,
      emptyStateMessage: payload.emptyStateMessage ?? '当前没有可展示的排班内容。',
      dayGroups: toDayGroups(payload.days),
    });
  },

  async handleRefresh(): Promise<void> {
    await this.loadPage();

    if (this.data.requestState === 'ready') {
      wx.showToast({
        title: '分享页已刷新',
        icon: 'success',
      });
    }
  },

  handleBack(): void {
    const app = getApp<ShiftSchedulerApp>();
    const role = app.getGlobalState().currentUser?.role ?? 'assistant';

    wx.navigateBack({
      fail: () => {
        wx.redirectTo({
          url: getHomePathForRole(role),
        });
      },
    });
  },

  handleReturnToEntry(): void {
    returnToTestEntry(true);
  },

  onShareAppMessage(): { title: string; path: string } {
    const collectionId = this.data.collectionId ?? 0;
    return {
      title: `${this.data.title || '排班结果'} ${this.data.weekLabel}`.trim(),
      path: `/pages/schedule-share/index?collectionId=${collectionId}`,
    };
  },
});
