import { AppConfig } from '../config/app-config';

export type UserRole = 'assistant' | 'admin' | 'super_admin';
export type AccountStatus = 'pending' | 'active' | 'rejected' | 'disabled';
export type CollectionStatus = 'pending' | 'active' | 'completed';

export interface TestIdentity {
  id: string;
  role: UserRole;
  displayName: string;
  studentNo: string;
  accountStatus?: AccountStatus;
}

export interface CurrentUser {
  id: string;
  testIdentityKey: string;
  studentNo: string;
  name: string;
  role: UserRole;
  accountStatus: AccountStatus;
}

export interface CurrentSemester {
  id: string;
  name: string;
  firstWeekStartDate: string;
  totalWeeks: number;
}

export interface CurrentCollection {
  id: string;
  title: string;
  weekRange: string;
  teachingWeek: number;
  status: CollectionStatus;
}

export interface SystemConfig {
  maxWeeklyShiftsLimit: number;
  weeklyWorkdays: number[];
  defaultShiftRequiredCount: number;
  defaultShiftTimes: Array<{
    id: string;
    label: string;
    startTime: string;
    endTime: string;
    minCount?: number;
    allowSolo?: boolean;
  }>;
  workdayOverrides: Array<{
    workDate: string;
    overrideType: 'workday' | 'non_workday' | 'no_shift';
    reason: string | null;
  }>;
}

export interface AppState {
  apiBaseUrl: string;
  currentIdentity: TestIdentity | null;
  currentRole: UserRole | null;
  currentUser: CurrentUser | null;
  currentSemester: CurrentSemester | null;
  currentCollection: CurrentCollection | null;
  systemConfig: SystemConfig;
  environment: AppConfig['environment'];
}

export const DEFAULT_CURRENT_SEMESTER: CurrentSemester = {
  id: 'semester-dev-current',
  name: '2026 \u6625\u5b63\u5b66\u671f',
  firstWeekStartDate: '2026-03-02',
  totalWeeks: 18,
};

export const DEFAULT_CURRENT_COLLECTION: CurrentCollection = {
  id: 'collection-dev-current',
  title: '\u7b2c 11 \u6559\u5b66\u5468\u7a7a\u95f2\u65f6\u95f4\u6536\u96c6',
  weekRange: '2026-05-18 ~ 2026-05-22',
  teachingWeek: 11,
  status: 'pending',
};

export const TEST_IDENTITIES: TestIdentity[] = [
  {
    id: 'test-admin',
    role: 'admin',
    displayName: '\u7ba1\u7406\u5458\u5165\u53e3',
    studentNo: '19318109',
    accountStatus: 'active',
  },
  {
    id: 'test-assistant-a',
    role: 'assistant',
    displayName: '\u52a9\u7406\u5165\u53e3 A',
    studentNo: 'A0001',
    accountStatus: 'active',
  },
  {
    id: 'test-assistant-b',
    role: 'assistant',
    displayName: '\u52a9\u7406\u5165\u53e3 B',
    studentNo: 'A0002',
    accountStatus: 'active',
  },
  {
    id: 'test-assistant-c',
    role: 'assistant',
    displayName: '\u52a9\u7406\u5165\u53e3 C',
    studentNo: 'A0003',
    accountStatus: 'active',
  },
  {
    id: 'test-disabled-assistant',
    role: 'assistant',
    displayName: '\u505c\u7528\u52a9\u7406\u9a8c\u6536\u5165\u53e3',
    studentNo: 'A0004',
    accountStatus: 'disabled',
  },
];

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  maxWeeklyShiftsLimit: 3,
  weeklyWorkdays: [1, 2, 3, 4, 5],
  defaultShiftRequiredCount: 2,
  defaultShiftTimes: [
    {
      id: 'morning',
      label: '\u4e0a\u5348\u73ed',
      startTime: '08:30',
      endTime: '13:00',
      minCount: 1,
      allowSolo: false,
    },
    {
      id: 'afternoon',
      label: '\u4e0b\u5348\u73ed',
      startTime: '13:00',
      endTime: '17:30',
      minCount: 1,
      allowSolo: false,
    },
  ],
  workdayOverrides: [],
};

export function createUserFromTestIdentity(identity: TestIdentity): CurrentUser {
  return {
    id: identity.id,
    testIdentityKey: identity.id,
    studentNo: identity.studentNo,
    name: identity.displayName,
    role: identity.role,
    accountStatus: identity.accountStatus ?? 'active',
  };
}

export function createInitialAppState(config: AppConfig): AppState {
  return {
    apiBaseUrl: config.apiBaseUrl,
    currentIdentity: null,
    currentRole: null,
    currentUser: null,
    currentSemester: DEFAULT_CURRENT_SEMESTER,
    currentCollection: DEFAULT_CURRENT_COLLECTION,
    systemConfig: DEFAULT_SYSTEM_CONFIG,
    environment: config.environment,
  };
}
