Component({
  data: {
    topInset: 0,
  },
  properties: {
    eyebrow: { type: String, value: '' },
    title: { type: String, value: '' },
    subtitle: { type: String, value: '' },
    showBack: { type: Boolean, value: false },
    actionLabel: { type: String, value: '' },
  },
  lifetimes: {
    attached(): void {
      try {
        const topInset = wx.getSystemInfoSync?.().statusBarHeight ?? 0;
        this.setData({
          topInset,
        });
      } catch {
        this.setData({
          topInset: 0,
        });
      }
    },
  },
  methods: {
    handleBack(): void {
      this.triggerEvent('back');
    },
    handleAction(): void {
      this.triggerEvent('action');
    },
  },
});
