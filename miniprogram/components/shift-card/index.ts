Component({
  properties: {
    time: { type: String, value: '' },
    title: { type: String, value: '' },
    people: { type: Array, value: [] },
    location: { type: String, value: '' },
    statusLabel: { type: String, value: '' },
    statusTone: { type: String, value: 'info' },
    riskLabel: { type: String, value: '' },
  },
  methods: {
    handleTap(): void {
      this.triggerEvent('select');
    },
  },
});
