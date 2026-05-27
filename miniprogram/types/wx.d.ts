interface WechatPageInstance {
  setData(data: Record<string, unknown>): void;
}

interface WechatComponentInstance {
  data: Record<string, unknown>;
  setData(data: Record<string, unknown>): void;
  triggerEvent(name: string, detail?: Record<string, unknown>): void;
}

type WxRequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface WxRequestSuccessResult<T = unknown> {
  data: T;
  statusCode: number;
  header?: Record<string, string>;
}

interface WxRequestFailResult {
  errMsg: string;
}

interface WxShowModalSuccessResult {
  cancel: boolean;
  confirm: boolean;
}

interface WxSystemInfoResult {
  statusBarHeight?: number;
}

declare function App<T extends object>(options: T & ThisType<T>): void;

declare function Page<T extends object>(
  options: T & ThisType<T & WechatPageInstance>,
): void;

declare function Component<T extends object>(
  options: T & ThisType<T & WechatComponentInstance>,
): void;

declare function getApp<T = Record<string, unknown>>(): T;

declare const wx: {
  navigateTo(options: {
    url: string;
    fail?: () => void;
  }): void;
  navigateBack(options?: {
    delta?: number;
    fail?: () => void;
  }): void;
  redirectTo(options: {
    url: string;
    fail?: () => void;
  }): void;
  reLaunch(options: {
    url: string;
  }): void;
  request<T = unknown>(options: {
    url: string;
    method?: WxRequestMethod;
    data?: unknown;
    header?: Record<string, string>;
    timeout?: number;
    success?: (result: WxRequestSuccessResult<T>) => void;
    fail?: (result: WxRequestFailResult) => void;
    complete?: () => void;
  }): void;
  showLoading(options: {
    title: string;
    mask?: boolean;
  }): void;
  hideLoading(): void;
  showToast(options: {
    title: string;
    icon?: 'success' | 'none' | 'error' | 'loading';
    duration?: number;
  }): void;
  showModal(options: {
    title: string;
    content: string;
    success?: (result: WxShowModalSuccessResult) => void;
    fail?: () => void;
  }): void;
  getSystemInfoSync(): WxSystemInfoResult;
};
