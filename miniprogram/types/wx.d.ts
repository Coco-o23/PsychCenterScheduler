interface WechatPageInstance {
  setData(data: Record<string, unknown>): void;
}

declare function App<T extends object>(options: T & ThisType<T>): void;

declare function Page<T extends object>(
  options: T & ThisType<T & WechatPageInstance>,
): void;

declare function getApp<T = Record<string, unknown>>(): T;

declare const wx: {
  showToast(options: {
    title: string;
    icon?: 'success' | 'none' | 'error' | 'loading';
    duration?: number;
  }): void;
};
