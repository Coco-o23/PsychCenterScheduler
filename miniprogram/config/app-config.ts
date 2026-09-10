export interface AppConfig {
  apiBaseUrl: string;
  environment: 'development' | 'production';
}

export const APP_CONFIG: AppConfig = {
  apiBaseUrl: 'https://www.psychcenter.online/api',
  environment: 'development',
};
