import { AppConfig } from '../config/app-config';

export type UserRole = 'admin' | 'assistant';

export interface TestIdentity {
  id: string;
  role: UserRole;
  displayName: string;
  studentNo: string;
}

export interface AppState {
  apiBaseUrl: string;
  currentIdentity: TestIdentity | null;
  currentRole: UserRole | null;
  environment: AppConfig['environment'];
}

export const TEST_IDENTITIES: TestIdentity[] = [
  {
    id: 'test-admin',
    role: 'admin',
    displayName: '\u7ba1\u7406\u5458\u5165\u53e3',
    studentNo: '19318109',
  },
  {
    id: 'test-assistant-a',
    role: 'assistant',
    displayName: '\u52a9\u7406\u5165\u53e3 A',
    studentNo: 'A0001',
  },
  {
    id: 'test-assistant-b',
    role: 'assistant',
    displayName: '\u52a9\u7406\u5165\u53e3 B',
    studentNo: 'A0002',
  },
  {
    id: 'test-assistant-c',
    role: 'assistant',
    displayName: '\u52a9\u7406\u5165\u53e3 C',
    studentNo: 'A0003',
  },
];

export function createInitialAppState(config: AppConfig): AppState {
  return {
    apiBaseUrl: config.apiBaseUrl,
    currentIdentity: null,
    currentRole: null,
    environment: config.environment,
  };
}
