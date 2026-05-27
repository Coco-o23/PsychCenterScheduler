interface ColorSwatch {
  name: string;
  token: string;
  value: string;
}

interface StatusChip {
  className: string;
  label: string;
}

interface TimeSlot {
  className: string;
  meta: string;
  title: string;
}

interface StyleLabData {
  chips: StatusChip[];
  copy: {
    body: string;
    cardBody: string;
    cardTitle: string;
    input: string;
    primaryAction: string;
    secondaryAction: string;
    subtitle: string;
    title: string;
  };
  slots: TimeSlot[];
  swatches: ColorSwatch[];
}

Page<{ data: StyleLabData }>({
  data: {
    copy: {
      body: '\u7528\u4e8e\u6838\u5bf9\u5c0f\u7a0b\u5e8f\u5168\u5c40 Token \u4e0e HTML \u539f\u578b\u7684\u89c6\u89c9\u6c14\u8d28\u3002',
      cardBody: '\u767d\u8272\u8868\u9762\u300112px \u5706\u89d2\u548c\u8f7b\u9634\u5f71\uff0c\u4fdd\u6301\u7ba1\u7406\u5de5\u5177\u7684\u6e05\u723d\u5bc6\u5ea6\u3002',
      cardTitle: '\u6392\u73ed\u5361\u7247\u793a\u4f8b',
      input: '\u8bf7\u9009\u62e9\u6559\u5b66\u5468\u6216\u8f93\u5165\u5173\u952e\u5b57',
      primaryAction: '\u4fdd\u5b58\u8bbe\u7f6e',
      secondaryAction: '\u67e5\u770b\u660e\u7ec6',
      subtitle: '\u989c\u8272\u3001\u5b57\u53f7\u3001\u5706\u89d2\u3001\u95f4\u8ddd\u548c\u9634\u5f71\u7684\u4e00\u6b21\u6027\u9a8c\u6536\u9875\u3002',
      title: '\u8bbe\u8ba1 Token \u9a8c\u6536',
    },
    swatches: [
      { name: '\u4e3b\u8272', token: 'primary', value: '#005bbf' },
      { name: '\u4e3b\u64cd\u4f5c', token: 'primary-container', value: '#1a73e8' },
      { name: '\u6210\u529f', token: 'secondary', value: '#006e2c' },
      { name: '\u6210\u529f\u5bb9\u5668', token: 'secondary-container', value: '#86f898' },
      { name: '\u8b66\u544a', token: 'tertiary', value: '#9e4300' },
      { name: '\u9519\u8bef', token: 'error', value: '#ba1a1a' },
      { name: '\u8868\u9762', token: 'surface', value: '#f9f9ff' },
      { name: '\u5361\u7247', token: 'surface-container-lowest', value: '#ffffff' },
    ],
    chips: [
      { className: 'status-chip--info', label: '\u5df2\u53d1\u5e03' },
      { className: 'status-chip--success', label: '\u53ef\u503c\u73ed' },
      { className: 'status-chip--warning', label: '\u9700\u5173\u6ce8' },
      { className: 'status-chip--error', label: '\u51b2\u7a81' },
    ],
    slots: [
      { className: 'time-slot--available', meta: '\u4e0a\u5348\u73ed', title: '08:30-13:00' },
      { className: 'time-slot--selected', meta: '\u5df2\u9009\u62e9', title: '13:00-17:30' },
      { className: 'time-slot--unavailable', meta: '\u4e0d\u53ef\u7528', title: '\u65e0\u7a7a\u95f2' },
      { className: 'time-slot--warning', meta: '\u4eba\u6570\u4e0d\u8db3', title: '\u9700\u8c03\u6574' },
    ],
  },
});
