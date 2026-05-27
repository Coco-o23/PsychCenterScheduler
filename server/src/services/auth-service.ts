import type { Pool } from 'mysql2/promise';
import { AppError } from '../errors/app-error';
import type { UserRecord } from '../models/user';
import { findUserByTestIdentityKey } from '../repositories/user-repository';

export interface TestLoginResult {
  user: UserRecord;
  accessibleArea: 'assistant' | 'admin';
}

function toAccessibleArea(role: UserRecord['role']): 'assistant' | 'admin' {
  return role === 'assistant' ? 'assistant' : 'admin';
}

export async function getUserByTestIdentityKey(
  pool: Pool,
  testIdentityKey: string,
): Promise<UserRecord> {
  const user = await findUserByTestIdentityKey(pool, testIdentityKey);

  if (!user) {
    throw new AppError(401, 'TEST_IDENTITY_NOT_FOUND', 'Test identity does not match any seeded user.');
  }

  return user;
}

export async function loginWithTestIdentity(
  pool: Pool,
  testIdentityKey: string,
): Promise<TestLoginResult> {
  const user = await getUserByTestIdentityKey(pool, testIdentityKey);

  if (user.accountStatus === 'disabled') {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'This test user is disabled and cannot access the system.');
  }

  return {
    user,
    accessibleArea: toAccessibleArea(user.role),
  };
}
