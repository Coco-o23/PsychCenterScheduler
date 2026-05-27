import { APP_CONFIG } from './config/app-config';
import {
  AppState,
  TestIdentity,
  createInitialAppState,
  createUserFromTestIdentity,
} from './state/app-state';

export interface ShiftSchedulerApp {
  globalData: AppState;
  setTestIdentity: (identity: TestIdentity) => void;
  clearTestIdentity: () => void;
  patchGlobalState: (patch: Partial<AppState>) => void;
  getGlobalState: () => AppState;
}

App<ShiftSchedulerApp>({
  globalData: createInitialAppState(APP_CONFIG),

  setTestIdentity(identity: TestIdentity): void {
    this.globalData.currentIdentity = identity;
    this.globalData.currentRole = identity.role;
    this.globalData.currentUser = createUserFromTestIdentity(identity);
  },

  clearTestIdentity(): void {
    this.globalData.currentIdentity = null;
    this.globalData.currentRole = null;
    this.globalData.currentUser = null;
  },

  patchGlobalState(patch: Partial<AppState>): void {
    this.globalData = {
      ...this.globalData,
      ...patch,
    };
  },

  getGlobalState(): AppState {
    return this.globalData;
  },
});
