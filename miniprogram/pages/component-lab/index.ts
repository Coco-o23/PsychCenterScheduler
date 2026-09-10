interface NavItem {
  icon: string;
  key: string;
  label: string;
}

interface FilterOption {
  active: boolean;
  label: string;
}

interface FilterGroup {
  options: FilterOption[];
  title: string;
}

interface ComponentLabData {
  assistantNav: NavItem[];
  filterGroups: FilterGroup[];
  isDialogVisible: boolean;
  isFilterVisible: boolean;
  shiftPeopleA: string[];
  shiftPeopleB: string[];
}

Page<{
  data: ComponentLabData;
  closeDialog: () => void;
  closeFilter: () => void;
  openDialog: () => void;
  openFilter: () => void;
}>({
  data: {
    assistantNav: [
      { key: 'availability', label: '\u586b\u62a5', icon: 'edit_note' },
      { key: 'schedule', label: '\u65e5\u7a0b', icon: 'calendar_month' },
      { key: 'team', label: '\u56e2\u961f', icon: 'groups' },
      { key: 'profile', label: '\u4e2a\u4eba', icon: 'person' },
    ],
    filterGroups: [
      {
        title: '\u5b66\u9662',
        options: [
          { label: '\u5168\u90e8', active: true },
          { label: '\u5fc3\u7406\u5b66\u9662', active: false },
          { label: '\u6559\u80b2\u5b66\u9662', active: false },
        ],
      },
      {
        title: '\u89d2\u8272',
        options: [
          { label: '\u52a9\u7406', active: true },
          { label: '\u7ba1\u7406\u5458', active: false },
          { label: '\u53ef\u5355\u72ec\u503c\u73ed', active: false },
        ],
      },
    ],
    isDialogVisible: false,
    isFilterVisible: false,
    shiftPeopleA: ['\u6797\u590f', '\u9648\u6668'],
    shiftPeopleB: ['\u5468\u5b81'],
  },

  openDialog(): void {
    this.setData({ isDialogVisible: true });
  },

  closeDialog(): void {
    this.setData({ isDialogVisible: false });
  },

  openFilter(): void {
    this.setData({ isFilterVisible: true });
  },

  closeFilter(): void {
    this.setData({ isFilterVisible: false });
  },
});
