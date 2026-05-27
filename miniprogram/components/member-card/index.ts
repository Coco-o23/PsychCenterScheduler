Component({
  properties: {
    name: { type: String, value: '' },
    avatarText: { type: String, value: '' },
    studentId: { type: String, value: '' },
    college: { type: String, value: '' },
    gender: { type: String, value: '' },
    grade: { type: String, value: '' },
    shiftCount: { type: Number, value: 0 },
    roleLabel: { type: String, value: '' },
    editable: { type: Boolean, value: false },
  },
  methods: {
    handleEdit(): void {
      this.triggerEvent('edit');
    },
  },
});
