Component({
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '' },
    groups: { type: Array, value: [] },
  },
  methods: {
    handleClose(): void {
      this.triggerEvent('close');
    },
    handleReset(): void {
      this.triggerEvent('reset');
    },
    handleApply(): void {
      this.triggerEvent('apply');
    },
  },
});
