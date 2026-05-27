import { Router } from 'express';
import type { ServerEnv } from '../config/env';
import { getDatabasePool } from '../database/mysql';
import { AppError } from '../errors/app-error';
import { requireAuth, getAuthContext } from '../middleware/auth';
import { loginWithTestIdentity } from '../services/auth-service';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import { expectNonEmptyString, expectObjectBody } from '../utils/validation';

export function createAuthRouter(env: ServerEnv): Router {
  const router = Router();

  router.post(
    '/test-login',
    asyncHandler(async (request, response) => {
      if (env.nodeEnv === 'production') {
        throw new AppError(
          403,
          'TEST_LOGIN_DISABLED',
          'Test login is disabled in production. Use the future openid login flow.',
        );
      }

      const body = expectObjectBody(request.body);
      const testIdentityKey = expectNonEmptyString(body.testIdentityKey, 'testIdentityKey', {
        maxLength: 64,
      });

      const result = await loginWithTestIdentity(getDatabasePool(env.database), testIdentityKey);

      sendSuccess(response, {
        accessibleArea: result.accessibleArea,
        user: {
          accountStatus: result.user.accountStatus,
          role: result.user.role,
          studentId: result.user.studentId,
          testIdentityKey: result.user.testIdentityKey,
          userId: result.user.userId,
          name: result.user.name,
        },
      });
    }),
  );

  router.get(
    '/session',
    requireAuth(env),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);

      sendSuccess(response, {
        accessibleArea: user.role === 'assistant' ? 'assistant' : 'admin',
        user: {
          accountStatus: user.accountStatus,
          role: user.role,
          studentId: user.studentId,
          testIdentityKey: user.testIdentityKey,
          userId: user.userId,
          name: user.name,
        },
      });
    }),
  );

  return router;
}
