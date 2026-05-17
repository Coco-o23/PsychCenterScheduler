export interface AppConfig {
  apiBaseUrl: string;
  environment: 'development' | 'production';
}

export const APP_CONFIG: AppConfig = {
  apiBaseUrl: 'http://127.0.0.1:3000/api',
  environment: 'development',
};
