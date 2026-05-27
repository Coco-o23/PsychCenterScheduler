Component({
  properties: {
    items: { type: Array, value: [] },
    activeKey: { type: String, value: '' },
  },
  methods: {
    handleTap(event: { currentTarget: { dataset: { key?: string } } }): void {
      this.triggerEvent('change', { key: event.currentTarget.dataset.key });
    },
  },
});
