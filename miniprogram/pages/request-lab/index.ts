import type { ShiftSchedulerApp } from '../../app';
import {
  AppState,
  TEST_IDENTITIES,
  TestIdentity,
} from '../../state/app-state';
import {
  MOCK_REQUEST_SCENARIOS,
  MockPayload,
  MockRequestScenario,
  runMockRequestScenario,
} from '../../services/request-mock';
import { ApiRequestResult, ApiRequestStatus } from '../../services/request';

interface IdentityOption extends TestIdentity {
  roleLabel: string;
}

interface DisplayRow {
  label: string;
  value: string;
}

interface RequestLabData {
  copy: {
    eyebrow: string;
    title: string;
    subtitle: string;
    identityTitle: string;
    scenarioTitle: string;
    headerTitle: string;
    resultTitle: string;
    stateTitle: string;
  };
  identities: IdentityOption[];
  scenarios: typeof MOCK_REQUEST_SCENARIOS;
  selectedIdentityId: string;
  selectedIdentityName: string;
  status: ApiRequestStatus;
  statusTone: 'info' | 'success' | 'warning' | 'error' | 'neutral';
  statusLabel: string;
  stateTitle: string;
  stateDescription: string;
  headerRows: DisplayRow[];
  resultRows: DisplayRow[];
  sessionRows: DisplayRow[];
}

function toIdentityOption(identity: TestIdentity): IdentityOption {
  return {
    ...identity,
    roleLabel: identity.role === 'admin' ? '\u7ba1\u7406\u5458' : '\u52a9\u7406',
  };
}

function statusToTone(status: ApiRequestStatus): RequestLabData['statusTone'] {
  const toneMap: Record<ApiRequestStatus, RequestLabData['statusTone']> = {
    idle: 'neutral',
    loading: 'info',
    success: 'success',
    empty: 'neutral',
    error: 'error',
    unauthorized: 'warning',
    forbidden: 'error',
    offline: 'error',
  };

  return toneMap[status];
}

function statusToLabel(status: ApiRequestStatus): string {
  const labelMap: Record<ApiRequestStatus, string> = {
    idle: '\u672a\u8bf7\u6c42',
    loading: '\u52a0\u8f7d\u4e2d',
    success: '\u6210\u529f',
    empty: '\u7a7a\u6570\u636e',
    error: '\u9519\u8bef',
    unauthorized: '\u672a\u767b\u5f55',
    forbidden: '\u65e0\u6743\u9650',
    offline: '\u65ad\u7f51',
  };

  return labelMap[status];
}

function buildSessionRows(state: AppState): DisplayRow[] {
  const user = state.currentUser;
  const semester = state.currentSemester;
  const collection = state.currentCollection;
  const shiftSummary = state.systemConfig.defaultShiftTimes
    .map((shift) => `${shift.startTime}-${shift.endTime}`)
    .join(' / ');

  return [
    { label: '\u7528\u6237', value: user?.name ?? '\u672a\u9009\u62e9' },
    { label: '\u89d2\u8272', value: user?.role ?? '\u672a\u9009\u62e9' },
    { label: '\u8d26\u53f7\u72b6\u6001', value: user?.accountStatus ?? '\u672a\u9009\u62e9' },
    { label: '\u5f53\u524d\u5b66\u671f', value: semester ? `${semester.name} / ${semester.totalWeeks} \u5468` : '\u5c1a\u672a\u914d\u7f6e' },
    { label: '\u5f53\u524d\u6536\u96c6', value: collection ? `${collection.title} / ${collection.status}` : '\u5c1a\u672a\u53d1\u5e03' },
    { label: '\u6bcf\u5468\u4e0a\u9650', value: String(state.systemConfig.maxWeeklyShiftsLimit) },
    { label: '\u9ed8\u8ba4\u73ed\u6b21', value: shiftSummary },
  ];
}

function buildResultRows(result: ApiRequestResult<MockPayload>): DisplayRow[] {
  const rows: DisplayRow[] = [
    { label: 'HTTP', value: String(result.statusCode) },
    { label: '\u4ee3\u7801', value: result.code },
    { label: '\u72b6\u6001', value: result.status },
  ];

  if (result.data?.rows.length) {
    return rows.concat(result.data.rows);
  }

  return rows;
}

function buildHeaderRows(result: ApiRequestResult<MockPayload>): DisplayRow[] {
  return Object.keys(result.requestHeaders).map((key) => ({
    label: key,
    value: result.requestHeaders[key],
  }));
}

function readAppState(): AppState {
  return getApp<ShiftSchedulerApp>().getGlobalState();
}

Page<{
  data: RequestLabData;
  onLoad: () => void;
  handleSelectIdentity: (event: { currentTarget: { dataset: { id?: string } } }) => void;
  handleRunScenario: (event: { currentTarget: { dataset: { scenario?: MockRequestScenario } } }) => Promise<void>;
}>({
  data: {
    copy: {
      eyebrow: '\u6b65\u9aa4 3.3',
      title: '\u8bf7\u6c42\u4e0e\u72b6\u6001\u9a8c\u6536',
      subtitle: '\u6a21\u62df\u540e\u7aef\u54cd\u5e94\uff0c\u68c0\u67e5\u8eab\u4efd\u5934\u3001\u52a0\u8f7d\u6001\u3001\u6743\u9650\u5931\u8d25\u548c\u7a7a\u6570\u636e\u8868\u8fbe\u3002',
      identityTitle: '\u6d4b\u8bd5\u8eab\u4efd',
      scenarioTitle: '\u54cd\u5e94\u573a\u666f',
      headerTitle: '\u8bf7\u6c42\u5934',
      resultTitle: '\u54cd\u5e94\u7ed3\u679c',
      stateTitle: '\u9875\u9762\u72b6\u6001',
    },
    identities: TEST_IDENTITIES.map(toIdentityOption),
    scenarios: MOCK_REQUEST_SCENARIOS,
    selectedIdentityId: '',
    selectedIdentityName: '\u672a\u9009\u62e9',
    status: 'idle',
    statusTone: 'neutral',
    statusLabel: '\u672a\u8bf7\u6c42',
    stateTitle: '\u5c1a\u672a\u53d1\u8d77\u8bf7\u6c42',
    stateDescription: '\u5148\u9009\u62e9\u6d4b\u8bd5\u8eab\u4efd\uff0c\u518d\u70b9\u51fb\u4e0b\u65b9\u573a\u666f\u3002',
    headerRows: [],
    resultRows: [],
    sessionRows: [],
  },

  onLoad(): void {
    const state = readAppState();
    this.setData({
      selectedIdentityId: state.currentIdentity?.id ?? '',
      selectedIdentityName: state.currentIdentity?.displayName ?? '\u672a\u9009\u62e9',
      sessionRows: buildSessionRows(state),
    });
  },

  handleSelectIdentity(event): void {
    const identityId = event.currentTarget.dataset.id;
    const identity = TEST_IDENTITIES.find((item) => item.id === identityId);

    if (!identity) {
      wx.showToast({
        title: '\u672a\u627e\u5230\u6d4b\u8bd5\u8eab\u4efd',
        icon: 'none',
      });
      return;
    }

    getApp<ShiftSchedulerApp>().setTestIdentity(identity);

    this.setData({
      selectedIdentityId: identity.id,
      selectedIdentityName: identity.displayName,
      sessionRows: buildSessionRows(readAppState()),
    });
  },

  async handleRunScenario(event): Promise<void> {
    const scenario = event.currentTarget.dataset.scenario;

    if (!scenario) {
      wx.showToast({
        title: '\u672a\u627e\u5230\u54cd\u5e94\u573a\u666f',
        icon: 'none',
      });
      return;
    }

    this.setData({
      status: 'loading',
      statusTone: statusToTone('loading'),
      statusLabel: statusToLabel('loading'),
      stateTitle: '\u8bf7\u6c42\u4e2d',
      stateDescription: '\u6b63\u5728\u6a21\u62df wx.request \u7edf\u4e00\u5c01\u88c5\u7684\u8fd4\u56de\u3002',
    });

    const result = await runMockRequestScenario(scenario, this.data.selectedIdentityId || undefined);

    this.setData({
      status: result.status,
      statusTone: statusToTone(result.status),
      statusLabel: statusToLabel(result.status),
      stateTitle: result.status === 'success' ? '\u8bf7\u6c42\u6210\u529f' : statusToLabel(result.status),
      stateDescription: result.message,
      headerRows: buildHeaderRows(result),
      resultRows: buildResultRows(result),
    });
  },
});
