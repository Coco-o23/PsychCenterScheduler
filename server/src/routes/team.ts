import { Router } from 'express';
import type { ServerEnv } from '../config/env';
import { getDatabasePool } from '../database/mysql';
import { getAuthContext, requireAuth } from '../middleware/auth';
import {
  getTeamSummary,
  listTeamMembersForAdmin,
  listTeamMembersForAssistant,
} from '../repositories/user-repository';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';

export function createTeamRouter(env: ServerEnv): Router {
  const router = Router();

  router.get(
    '/members',
    requireAuth(env),
    asyncHandler(async (request, response) => {
      const { user } = getAuthContext(request);
      const pool = getDatabasePool(env.database);

      if (user.role === 'assistant') {
        const members = await listTeamMembersForAssistant(pool);
        sendSuccess(response, {
          scope: 'assistant',
          members,
        });
        return;
      }

      const members = await listTeamMembersForAdmin(pool);
      const summary = await getTeamSummary(pool);
      sendSuccess(response, {
        scope: 'admin',
        members,
        summary,
      });
    }),
  );

  return router;
}
