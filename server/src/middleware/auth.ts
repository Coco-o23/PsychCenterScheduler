import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { getDatabasePool } from '../database/mysql';
import { AppError } from '../errors/app-error';
import type { UserRecord, UserRole } from '../models/user';
import type { ServerEnv } from '../config/env';
import { getUserByTestIdentityKey } from '../services/auth-service';
import { writeOperationLog } from '../services/operation-log-service';

const authContextKey = Symbol('auth-context');

export interface AuthContext {
  user: UserRecord;
}

type RequestWithAuth = Request & {
  [authContextKey]?: AuthContext;
};

function setAuthContext(request: Request, context: AuthContext): void {
  (request as RequestWithAuth)[authContextKey] = context;
}

export function getAuthContext(request: Request): AuthContext {
  const context = (request as RequestWithAuth)[authContextKey];

  if (!context) {
    throw new AppError(500, 'AUTH_CONTEXT_MISSING', 'Auth context is not available for this request.');
  }

  return context;
}

async function logForbiddenAttempt(
  env: ServerEnv,
  user: UserRecord,
  action: string,
  entityType: string | null,
): Promise<void> {
  try {
    await writeOperationLog(getDatabasePool(env.database), {
      actorUserId: user.userId,
      action,
      entityType,
      entityId: null,
      result: 'failed',
      detail: `Role ${user.role} attempted to access an admin-only endpoint.`,
    });
  } catch {
    return;
  }
}

export function requireAuth(env: ServerEnv): RequestHandler {
  return async (request: Request, _response: Response, next: NextFunction) => {
    try {
      if (env.nodeEnv === 'production') {
        throw new AppError(
          401,
          'REAL_AUTH_REQUIRED',
          'Test identity headers are disabled in production. Use the future openid login flow.',
        );
      }

      const headerValue = request.header('x-test-identity');

      if (!headerValue || headerValue.trim() === '') {
        throw new AppError(
          401,
          'AUTHENTICATION_REQUIRED',
          'Missing X-Test-Identity header. Select a test identity before requesting protected APIs.',
        );
      }

      const user = await getUserByTestIdentityKey(getDatabasePool(env.database), headerValue.trim());

      if (user.accountStatus === 'disabled') {
        throw new AppError(403, 'ACCOUNT_DISABLED', 'This account is disabled.');
      }

      setAuthContext(request, { user });
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRole(
  env: ServerEnv,
  allowedRoles: UserRole[],
  options: {
    action: string;
    entityType: string | null;
  },
): RequestHandler {
  return async (request: Request, _response: Response, next: NextFunction) => {
    try {
      const { user } = getAuthContext(request);

      if (!allowedRoles.includes(user.role)) {
        await logForbiddenAttempt(env, user, options.action, options.entityType);
        throw new AppError(
          403,
          'FORBIDDEN',
          'Your current role does not have permission to access this endpoint.',
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
