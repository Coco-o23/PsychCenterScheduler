import type { AccountStatus, CurrentUser, UserRole } from '../state/app-state';
import { requestApi, type ApiRequestResult } from './request';

type AccessibleArea = 'assistant' | 'admin';

interface AuthSessionUserPayload {
  userId: number;
  studentId: string;
  name: string;
  role: UserRole;
  accountStatus: AccountStatus;
  testIdentityKey: string | null;
}

interface AuthSessionPayload {
  accessibleArea: AccessibleArea;
  user: AuthSessionUserPayload;
}

interface TestLoginBody {
  testIdentityKey: string;
}

export interface AuthSessionResult {
  accessibleArea: AccessibleArea;
  user: CurrentUser;
}

function toCurrentUser(user: AuthSessionUserPayload): CurrentUser {
  return {
    id: String(user.userId),
    testIdentityKey: user.testIdentityKey ?? '',
    studentNo: user.studentId,
    name: user.name,
    role: user.role,
    accountStatus: user.accountStatus,
  };
}

function withSession<T extends ApiRequestResult<AuthSessionPayload>>(
  result: T,
): T & { session: AuthSessionResult | null } {
  if (!result.ok || !result.data) {
    return {
      ...result,
      session: null,
    };
  }

  return {
    ...result,
    session: {
      accessibleArea: result.data.accessibleArea,
      user: toCurrentUser(result.data.user),
    },
  };
}

export async function loginWithTestIdentity(testIdentityKey: string) {
  const result = await requestApi<AuthSessionPayload, TestLoginBody>({
    path: '/auth/test-login',
    method: 'POST',
    data: {
      testIdentityKey,
    },
    identityKey: testIdentityKey,
    loadingTitle: '\u8eab\u4efd\u767b\u5f55\u4e2d',
    showErrorToast: false,
  });

  return withSession(result);
}

export async function fetchCurrentSession(testIdentityKey?: string) {
  const result = await requestApi<AuthSessionPayload>({
    path: '/auth/session',
    method: 'GET',
    identityKey: testIdentityKey,
    loadingTitle: '\u52a0\u8f7d\u4f1a\u8bdd',
    showErrorToast: false,
  });

  return withSession(result);
}
