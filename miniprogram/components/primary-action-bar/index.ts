Component({
  properties: {
    label: { type: String, value: '' },
    secondaryLabel: { type: String, value: '' },
    disabled: { type: Boolean, value: false },
  },
  methods: {
    handlePrimary(): void {
      if (!this.data.disabled) {
        this.triggerEvent('primary');
      }
    },
    handleSecondary(): void {
      this.triggerEvent('secondary');
    },
  },
});
