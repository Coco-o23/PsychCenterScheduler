import type { ApiRequestResult } from './request';
import { requestApi } from './request';

export interface NotificationListItem {
  notificationId: number;
  type: string;
  title: string;
  content: string;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
  readAt: string | null;
  createdAt: string;
  isRead: boolean;
  targetPath: string;
}

export interface NotificationListResponse {
  unreadCount: number;
  items: NotificationListItem[];
}

export interface MarkNotificationReadResponse {
  notificationId: number;
  unreadCount: number;
}

export function fetchNotifications(): Promise<ApiRequestResult<NotificationListResponse>> {
  return requestApi<NotificationListResponse>({
    path: '/notifications',
    method: 'GET',
  });
}

export function markNotificationAsRead(
  notificationId: number,
): Promise<ApiRequestResult<MarkNotificationReadResponse>> {
  return requestApi<MarkNotificationReadResponse>({
    path: `/notifications/${notificationId}/read`,
    method: 'PUT',
    data: {},
    showLoading: false,
  });
}
