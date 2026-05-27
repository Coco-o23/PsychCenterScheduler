import type { ShiftSchedulerApp } from '../../app';
import { loginWithTestIdentity } from '../../services/auth';
import {
  TEST_IDENTITIES,
  type TestIdentity,
  createUserFromTestIdentity,
} from '../../state/app-state';
import { navigateToRoleHome } from '../../utils/route-guard';

interface IdentityView extends TestIdentity {
  roleLabel: string;
  statusLabel: string;
}

interface TestEntryData {
  copy: {
    currentIdentity: string;
    customEnter: string;
    customHint: string;
    customPlaceholder: string;
    customTitle: string;
    enter: string;
    eyebrow: string;
    helper: string;
    loading: string;
    selected: string;
    subtitle: string;
    title: string;
  };
  customTestKey: string;
  identities: IdentityView[];
  pendingId: string;
  selectedId: string;
  selectedName: string;
}

function toIdentityView(identity: TestIdentity): IdentityView {
  return {
    ...identity,
    roleLabel:
      identity.role === 'super_admin'
        ? '\u8d85\u7ea7\u7ba1\u7406\u5458'
        : identity.role === 'admin'
          ? '\u7ba1\u7406\u5458'
          : '\u52a9\u7406',
    statusLabel: identity.accountStatus === 'disabled' ? '\u505c\u7528\u9a8c\u6536' : '\u53ef\u8fdb\u5165',
  };
}

function createCustomIdentityFromSession(
  testIdentityKey: string,
  session: { user: { accountStatus: TestIdentity['accountStatus']; name: string; role: TestIdentity['role']; studentNo: string } },
): TestIdentity {
  return {
    id: testIdentityKey,
    role: session.user.role,
    displayName: session.user.name,
    studentNo: session.user.studentNo,
    accountStatus: session.user.accountStatus ?? 'active',
  };
}

Page<{
  data: TestEntryData;
  onShow: () => void;
  applyIdentitySession: (identity: TestIdentity, session: { user: Parameters<ShiftSchedulerApp['patchGlobalState']>[0]['currentUser'] extends infer T ? T : never }) => void;
  handleCustomKeyInput: (event: { detail?: { value?: string } }) => void;
  handleSelectIdentity: (event: { currentTarget: { dataset: { id?: string } } }) => Promise<void>;
  handleSubmitCustomKey: () => Promise<void>;
}>({
  data: {
    copy: {
      currentIdentity: '\u5f53\u524d\u8eab\u4efd',
      customEnter: '\u4f7f\u7528 key \u8fdb\u5165',
      customHint: '\u65b0\u589e\u6210\u5458\u540e\uff0c\u53ef\u4ee5\u5728\u8fd9\u91cc\u8f93\u5165 test key \u76f4\u63a5\u8fdb\u5165\u5bf9\u5e94\u754c\u9762\u3002',
      customPlaceholder: '\u8bf7\u8f93\u5165\u6d4b\u8bd5 key',
      customTitle: '\u624b\u52a8\u8f93\u5165\u6d4b\u8bd5 key',
      enter: '\u8fdb\u5165',
      eyebrow: '\u672c\u5730\u5f00\u53d1',
      helper:
        '\u8fd9\u4e2a\u9875\u9762\u662f\u5f00\u53d1\u671f\u4e34\u65f6\u5165\u53e3\u3002\u540e\u7eed\u6b63\u5f0f\u63a5\u5165 openid \u767b\u5f55\u540e\u4f1a\u79fb\u9664\u3002',
      loading: '\u8fdb\u5165\u4e2d',
      selected: '\u5df2\u9009\u62e9',
      subtitle:
        '\u70b9\u51fb\u4e0b\u65b9\u5165\u53e3\u540e\uff0c\u524d\u7aef\u4f1a\u5148\u8bf7\u6c42\u540e\u7aef\u6d4b\u8bd5\u767b\u5f55 API\uff0c\u518d\u6309\u89d2\u8272\u5206\u6d41\u5230\u5bf9\u5e94\u9875\u9762\u3002',
      title: '\u9009\u62e9\u6d4b\u8bd5\u8eab\u4efd',
    },
    customTestKey: '',
    identities: TEST_IDENTITIES.map(toIdentityView),
    pendingId: '',
    selectedId: '',
    selectedName: '',
  },

  onShow(): void {
    const currentIdentity = getApp<ShiftSchedulerApp>().getGlobalState().currentIdentity;

    this.setData({
      customTestKey: currentIdentity?.id ?? '',
      selectedId: currentIdentity?.id ?? '',
      selectedName: currentIdentity?.displayName ?? '',
      identities: TEST_IDENTITIES.map(toIdentityView),
      pendingId: '',
    });
  },

  applyIdentitySession(identity, session): void {
    const app = getApp<ShiftSchedulerApp>();

    app.setTestIdentity(identity);
    app.patchGlobalState({
      currentUser: session.user ?? null,
      currentRole: session.user?.role ?? null,
    });

    this.setData({
      customTestKey: identity.id,
      pendingId: '',
      selectedId: identity.id,
      selectedName: identity.displayName,
    });

    wx.showToast({
      title: `\u5df2\u8fdb\u5165${identity.displayName}`,
      icon: 'success',
    });

    navigateToRoleHome(session.user?.role ?? identity.role);
  },

  handleCustomKeyInput(event): void {
    this.setData({
      customTestKey: event.detail?.value ?? '',
    });
  },

  async handleSelectIdentity(event): Promise<void> {
    const identityId = event.currentTarget.dataset.id;
    const identity = TEST_IDENTITIES.find((item) => item.id === identityId);

    if (!identity) {
      wx.showToast({
        title: '\u672a\u627e\u5230\u6d4b\u8bd5\u8eab\u4efd',
        icon: 'none',
      });
      return;
    }

    this.setData({
      pendingId: identity.id,
    });

    const app = getApp<ShiftSchedulerApp>();
    const result = await loginWithTestIdentity(identity.id);

    if (result.ok && result.session) {
      this.applyIdentitySession(identity, result.session);
      return;
    }

    if (result.status === 'forbidden' && result.code === 'ACCOUNT_DISABLED') {
      app.setTestIdentity(identity);
      app.patchGlobalState({
        currentUser: createUserFromTestIdentity(identity),
        currentRole: identity.role,
      });

      this.setData({
        customTestKey: identity.id,
        pendingId: '',
        selectedId: identity.id,
        selectedName: identity.displayName,
      });

      wx.showToast({
        title: '\u8be5\u8d26\u53f7\u5df2\u505c\u7528',
        icon: 'none',
      });

      navigateToRoleHome(identity.role);
      return;
    }

    app.clearTestIdentity();
    this.setData({
      pendingId: '',
    });

    wx.showToast({
      title: result.message,
      icon: 'none',
    });
  },

  async handleSubmitCustomKey(): Promise<void> {
    const customTestKey = this.data.customTestKey.trim();

    if (!customTestKey) {
      wx.showToast({
        title: '\u8bf7\u5148\u8f93\u5165\u6d4b\u8bd5 key',
        icon: 'none',
      });
      return;
    }

    this.setData({
      pendingId: customTestKey,
    });

    const app = getApp<ShiftSchedulerApp>();
    const result = await loginWithTestIdentity(customTestKey);

    if (!result.ok || !result.session) {
      app.clearTestIdentity();
      this.setData({
        pendingId: '',
      });

      wx.showToast({
        title: result.message,
        icon: 'none',
      });
      return;
    }

    this.applyIdentitySession(
      createCustomIdentityFromSession(customTestKey, result.session),
      result.session,
    );
  },
});
