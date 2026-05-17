import type { ShiftSchedulerApp } from '../../app';
import { TEST_IDENTITIES, TestIdentity } from '../../state/app-state';

interface IdentityView extends TestIdentity {
  roleLabel: string;
}

interface TestEntryData {
  copy: {
    currentIdentity: string;
    enter: string;
    eyebrow: string;
    selected: string;
    subtitle: string;
    title: string;
  };
  identities: IdentityView[];
  selectedId: string;
  selectedName: string;
}

function toIdentityView(identity: TestIdentity): IdentityView {
  return {
    ...identity,
    roleLabel: identity.role === 'admin' ? '\u7ba1\u7406\u5458' : '\u52a9\u7406',
  };
}

Page<{
  data: TestEntryData;
  handleSelectIdentity: (event: { currentTarget: { dataset: { id?: string } } }) => void;
}>({
  data: {
    copy: {
      currentIdentity: '\u5f53\u524d\u8eab\u4efd',
      enter: '\u8fdb\u5165',
      eyebrow: '\u672c\u5730\u5f00\u53d1',
      selected: '\u5df2\u9009\u62e9',
      subtitle:
        '\u6b64\u5165\u53e3\u4ec5\u7528\u4e8e\u672c\u5730\u8054\u8c03\uff0c\u6b63\u5f0f\u7248\u672c\u5c06\u7531\u540e\u7aef\u8bc6\u522b\u5fae\u4fe1 openID\u3002',
      title: '\u9009\u62e9\u6d4b\u8bd5\u8eab\u4efd',
    },
    identities: TEST_IDENTITIES.map(toIdentityView),
    selectedId: '',
    selectedName: '',
  },

  handleSelectIdentity(event): void {
    const identityId = event.currentTarget.dataset.id;
    const identity = TEST_IDENTITIES.find((item) => item.id === identityId);

    if (!identity) {
      wx.showToast({
        title: '\u672a\u627e\u5230\u6d4b\u8bd5\u8eab\u4efd',
        icon: 'none',
      });
      return;
    }

    getApp<ShiftSchedulerApp>().setTestIdentity(identity);

    this.setData({
      selectedId: identity.id,
      selectedName: identity.displayName,
    });

    wx.showToast({
      title: `\u5df2\u9009\u62e9${identity.displayName}`,
      icon: 'success',
    });
  },
});
