import type { ShiftSchedulerApp } from '../../app';
import {
  fetchNotifications,
  markNotificationAsRead,
  type NotificationListItem,
} from '../../services/notification';
import {
  ensurePageAccess,
  getHomePathForRole,
  returnToTestEntry,
  type GuardState,
} from '../../utils/route-guard';

interface NotificationCardView {
  notificationId: number;
  title: string;
  content: string;
  createdAtText: string;
  statusLabel: string;
  isRead: boolean;
  targetPath: string;
}

interface NotificationsPageData {
  guardState: GuardState;
  guardTitle: string;
  guardDescription: string;
  requestState: 'loading' | 'ready' | 'error';
  unreadCount: number;
  cards: NotificationCardView[];
}

function formatNotificationTime(value: string): string {
  const [datePart, timePart = ''] = value.split('T');
  return `${datePart} ${timePart.slice(0, 5)}`.trim();
}

function toNotificationCard(item: NotificationListItem): NotificationCardView {
  return {
    notificationId: item.notificationId,
    title: item.title,
    content: item.content,
    createdAtText: formatNotificationTime(item.createdAt),
    statusLabel: item.isRead ? '已读' : '未读',
    isRead: item.isRead,
    targetPath: item.targetPath,
  };
}

Page({
  data: {
    guardState: 'checking',
    guardTitle: '检查中',
    guardDescription: '正在确认通知中心访问权限。',
    requestState: 'loading',
    unreadCount: 0,
    cards: [],
  } as NotificationsPageData,

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

    const result = await fetchNotifications();

    if (!result.ok || !result.data) {
      this.setData({
        requestState: 'error',
      });
      return;
    }

    this.setData({
      requestState: 'ready',
      unreadCount: result.data.unreadCount,
      cards: result.data.items.map(toNotificationCard),
    });
  },

  async handleOpenNotification(event: { currentTarget: { dataset: { id?: number; path?: string } } }): Promise<void> {
    const notificationId = Number(event.currentTarget.dataset.id);
    const targetPath = event.currentTarget.dataset.path ?? '';

    if (Number.isInteger(notificationId) && notificationId > 0) {
      const result = await markNotificationAsRead(notificationId);

      if (result.ok && result.data) {
        this.setData({
          unreadCount: result.data.unreadCount,
          cards: this.data.cards.map((item) =>
            item.notificationId === notificationId
              ? {
                  ...item,
                  isRead: true,
                  statusLabel: '已读',
                }
              : item,
          ),
        });
      }
    }

    if (!targetPath) {
      return;
    }

    wx.navigateTo({
      url: targetPath,
      fail: () => {
        wx.redirectTo({
          url: targetPath,
        });
      },
    });
  },

  async handleRefresh(): Promise<void> {
    await this.loadPage();

    if (this.data.requestState === 'ready') {
      wx.showToast({
        title: '通知已刷新',
        icon: 'success',
      });
    }
  },

  handleBack(): void {
    const role = getApp<ShiftSchedulerApp>().getGlobalState().currentUser?.role ?? 'assistant';

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
});
