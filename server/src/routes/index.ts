import { Router } from 'express';
import type { ServerEnv } from '../config/env';
import { createAdminConfigurationRouter } from './admin-configuration';
import { createAdminDutyRouter } from './admin-duty';
import { createAdminRouter } from './admin';
import { createAdminScheduleRouter } from './admin-schedule';
import { createAvailabilityRouter } from './availability';
import { createAuthRouter } from './auth';
import { createDutyRouter } from './duty';
import { createHealthRouter } from './health';
import { createNotificationsRouter } from './notifications';
import { createProfileRouter } from './profile';
import { createScheduleShareRouter } from './schedule-share';
import { createTeamRouter } from './team';

export function createApiRouter(env: ServerEnv): Router {
  const router = Router();

  router.use('/health', createHealthRouter(env));
  router.use('/auth', createAuthRouter(env));
  router.use('/availability', createAvailabilityRouter(env));
  router.use('/duty', createDutyRouter(env));
  router.use('/notifications', createNotificationsRouter(env));
  router.use('/profile', createProfileRouter(env));
  router.use('/schedule-share', createScheduleShareRouter(env));
  router.use('/team', createTeamRouter(env));
  router.use('/admin', createAdminRouter(env));
  router.use('/admin/configuration', createAdminConfigurationRouter(env));
  router.use('/admin/duty', createAdminDutyRouter(env));
  router.use('/admin/schedules', createAdminScheduleRouter(env));

  return router;
}
