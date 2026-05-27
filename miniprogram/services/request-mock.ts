import {
  ApiRequestResult,
  ApiRequestStatus,
  RequestHeaders,
  buildRequestHeaders,
  createRequestResult,
} from './request';

export type MockRequestScenario =
  | 'success'
  | 'empty'
  | 'bad-request'
  | 'unauthorized'
  | 'forbidden'
  | 'server-error'
  | 'offline';

export interface MockScenarioOption {
  key: MockRequestScenario;
  label: string;
  description: string;
  tone: 'info' | 'success' | 'warning' | 'error' | 'neutral';
}

export interface MockPayload {
  title: string;
  rows: Array<{
    label: string;
    value: string;
  }>;
}

export const MOCK_REQUEST_SCENARIOS: MockScenarioOption[] = [
  {
    key: 'success',
    label: '\u6210\u529f',
    description: '\u6a21\u62df 200 \u4e14\u8fd4\u56de\u6570\u636e',
    tone: 'success',
  },
  {
    key: 'empty',
    label: '\u7a7a\u6570\u636e',
    description: '\u6a21\u62df 200 \u4f46\u5217\u8868\u4e3a\u7a7a',
    tone: 'neutral',
  },
  {
    key: 'bad-request',
    label: '400',
    description: '\u6a21\u62df\u5165\u53c2\u4e0d\u5408\u6cd5',
    tone: 'warning',
  },
  {
    key: 'unauthorized',
    label: '401',
    description: '\u6a21\u62df\u8eab\u4efd\u5931\u6548',
    tone: 'warning',
  },
  {
    key: 'forbidden',
    label: '403',
    description: '\u6a21\u62df\u6743\u9650\u4e0d\u8db3',
    tone: 'error',
  },
  {
    key: 'server-error',
    label: '500',
    description: '\u6a21\u62df\u540e\u7aef\u5f02\u5e38',
    tone: 'error',
  },
  {
    key: 'offline',
    label: '\u65ad\u7f51',
    description: '\u6a21\u62df wx.request fail',
    tone: 'error',
  },
];

function statusForScenario(scenario: MockRequestScenario): ApiRequestStatus {
  const statusMap: Record<MockRequestScenario, ApiRequestStatus> = {
    success: 'success',
    empty: 'empty',
    'bad-request': 'error',
    unauthorized: 'unauthorized',
    forbidden: 'forbidden',
    'server-error': 'error',
    offline: 'offline',
  };

  return statusMap[scenario];
}

function statusCodeForScenario(scenario: MockRequestScenario): number {
  const codeMap: Record<MockRequestScenario, number> = {
    success: 200,
    empty: 200,
    'bad-request': 400,
    unauthorized: 401,
    forbidden: 403,
    'server-error': 500,
    offline: 0,
  };

  return codeMap[scenario];
}

function messageForScenario(scenario: MockRequestScenario): string {
  const messageMap: Record<MockRequestScenario, string> = {
    success: '\u540e\u7aef\u8fd4\u56de\u6210\u529f\u6570\u636e',
    empty: '\u8bf7\u6c42\u6210\u529f\uff0c\u4f46\u5f53\u524d\u6ca1\u6709\u53ef\u5c55\u793a\u6570\u636e',
    'bad-request': '\u8bf7\u6c42\u53c2\u6570\u4e0d\u5408\u6cd5\uff0c\u8bf7\u68c0\u67e5\u586b\u5199\u5185\u5bb9',
    unauthorized: '\u8eab\u4efd\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u9009\u62e9\u6d4b\u8bd5\u8eab\u4efd',
    forbidden: '\u5f53\u524d\u8eab\u4efd\u65e0\u6743\u8bbf\u95ee\u8be5\u529f\u80fd',
    'server-error': '\u540e\u7aef\u670d\u52a1\u5f02\u5e38\uff0c\u8bf7\u67e5\u770b Express \u65e5\u5fd7',
    offline: '\u65e0\u6cd5\u8fde\u63a5\u540e\u7aef\uff0c\u8bf7\u786e\u8ba4\u672c\u5730\u670d\u52a1\u662f\u5426\u542f\u52a8',
  };

  return messageMap[scenario];
}

function dataForScenario(scenario: MockRequestScenario, headers: RequestHeaders): MockPayload | null {
  if (scenario === 'success') {
    return {
      title: '\u8bf7\u6c42\u7ed3\u679c',
      rows: [
        { label: '\u5f53\u524d\u8eab\u4efd', value: headers['X-Test-Identity'] ?? '\u672a\u9009\u62e9' },
        { label: '\u4e1a\u52a1\u6570\u636e', value: '\u6a21\u62df\u83b7\u53d6\u5f53\u524d\u6392\u73ed\u6982\u89c8' },
      ],
    };
  }

  if (scenario === 'empty') {
    return {
      title: '\u7a7a\u5217\u8868',
      rows: [],
    };
  }

  return null;
}

export function runMockRequestScenario(
  scenario: MockRequestScenario,
  identityKey?: string,
): Promise<ApiRequestResult<MockPayload>> {
  const requestHeaders = buildRequestHeaders(identityKey);
  const data = dataForScenario(scenario, requestHeaders);

  return Promise.resolve(
    createRequestResult<MockPayload>({
      status: statusForScenario(scenario),
      statusCode: statusCodeForScenario(scenario),
      data,
      message: messageForScenario(scenario),
      code: scenario.toUpperCase().replace('-', '_'),
      requestHeaders,
    }),
  );
}
