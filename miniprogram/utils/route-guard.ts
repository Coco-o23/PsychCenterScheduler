import type { ShiftSchedulerApp } from '../app';
import type { CurrentUser, UserRole } from '../state/app-state';

export type GuardState = 'checking' | 'ready' | 'disabled';

export interface GuardStatePatch {
  guardState: GuardState;
  guardTitle: string;
  guardDescription: string;
}

interface GuardedPage {
  setData(data: Record<string, unknown>): void;
}

interface EnsurePageAccessOptions {
  allowedRoles: UserRole[];
}

export function getHomePathForRole(role: UserRole): string {
  return role === 'assistant' ? '/pages/assistant-main/index' : '/pages/admin-main/index';
}

export function navigateToRoleHome(role: UserRole): void {
  wx.reLaunch({
    url: getHomePathForRole(role),
  });
}

export function returnToTestEntry(resetIdentity = false): void {
  const app = getApp<ShiftSchedulerApp>();

  if (resetIdentity) {
    app.clearTestIdentity();
  }

  wx.reLaunch({
    url: '/pages/test-entry/index',
  });
}

function patchGuardState(page: GuardedPage, patch: GuardStatePatch): void {
  page.setData({
    guardState: patch.guardState,
    guardTitle: patch.guardTitle,
    guardDescription: patch.guardDescription,
  });
}

function readCurrentUser(): CurrentUser | null {
  try {
    return getApp<ShiftSchedulerApp>().getGlobalState().currentUser;
  } catch {
    return null;
  }
}

export function ensurePageAccess(page: GuardedPage, options: EnsurePageAccessOptions): boolean {
  const currentUser = readCurrentUser();

  if (!currentUser) {
    wx.showToast({
      title: '\u8bf7\u5148\u9009\u62e9\u6d4b\u8bd5\u8eab\u4efd',
      icon: 'none',
    });
    returnToTestEntry(false);
    return false;
  }

  if (currentUser.accountStatus === 'disabled') {
    patchGuardState(page, {
      guardState: 'disabled',
      guardTitle: '\u8d26\u53f7\u5df2\u505c\u7528',
      guardDescription:
        '\u5f53\u524d\u6d4b\u8bd5\u8d26\u53f7\u5df2\u88ab\u505c\u7528\uff0c\u8bf7\u8fd4\u56de\u5206\u6d41\u9875\u5207\u6362\u5176\u4ed6\u8eab\u4efd\uff0c\u6216\u8054\u7cfb\u7ba1\u7406\u5458\u786e\u8ba4\u8d26\u53f7\u72b6\u6001\u3002',
    });
    return false;
  }

  if (!options.allowedRoles.includes(currentUser.role)) {
    wx.showToast({
      title:
        currentUser.role === 'assistant'
          ? '\u52a9\u7406\u4e0d\u80fd\u8fdb\u5165\u7ba1\u7406\u7aef'
          : '\u5df2\u4e3a\u4f60\u5207\u6362\u5230\u53ef\u7528\u9875\u9762',
      icon: 'none',
    });
    wx.redirectTo({
      url: getHomePathForRole(currentUser.role),
    });
    return false;
  }

  patchGuardState(page, {
    guardState: 'ready',
    guardTitle: '',
    guardDescription: '',
  });
  return true;
}
