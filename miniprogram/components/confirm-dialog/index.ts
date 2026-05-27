Component({
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '' },
    message: { type: String, value: '' },
    confirmLabel: { type: String, value: '' },
    cancelLabel: { type: String, value: '' },
    tone: { type: String, value: 'primary' },
  },
  methods: {
    handleCancel(): void {
      this.triggerEvent('cancel');
    },
    handleConfirm(): void {
      this.triggerEvent('confirm');
    },
  },
});
