import { APP_CONFIG } from './config/app-config';
import {
  AppState,
  TestIdentity,
  createInitialAppState,
} from './state/app-state';

export interface ShiftSchedulerApp {
  globalData: AppState;
  setTestIdentity: (identity: TestIdentity) => void;
  clearTestIdentity: () => void;
}

App<ShiftSchedulerApp>({
  globalData: createInitialAppState(APP_CONFIG),

  setTestIdentity(identity: TestIdentity): void {
    this.globalData.currentIdentity = identity;
    this.globalData.currentRole = identity.role;
  },

  clearTestIdentity(): void {
    this.globalData.currentIdentity = null;
    this.globalData.currentRole = null;
  },
});
