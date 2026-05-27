Component({
  properties: {
    title: { type: String, value: '' },
    description: { type: String, value: '' },
    type: { type: String, value: 'empty' },
    actionLabel: { type: String, value: '' },
  },
  methods: {
    handleAction(): void {
      this.triggerEvent('action');
    },
  },
});
