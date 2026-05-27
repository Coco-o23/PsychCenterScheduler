Component({
  properties: {
    title: { type: String, value: '' },
    subtitle: { type: String, value: '' },
    state: { type: String, value: 'neutral' },
    disabled: { type: Boolean, value: false },
  },
  methods: {
    handleTap(): void {
      if (!this.data.disabled) {
        this.triggerEvent('select');
      }
    },
  },
});
