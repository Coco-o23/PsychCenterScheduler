import type { ShiftSchedulerApp } from '../app';
import { APP_CONFIG } from '../config/app-config';

export type ApiRequestStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'empty'
  | 'error'
  | 'unauthorized'
  | 'forbidden'
  | 'offline';

export type ApiRequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type RequestHeaders = Record<string, string>;

export interface ApiRequestResult<TData = unknown> {
  ok: boolean;
  status: ApiRequestStatus;
  statusCode: number;
  message: string;
  code: string;
  data: TData | null;
  requestHeaders: RequestHeaders;
}

export interface ApiRequestOptions<TBody = unknown> {
  path: string;
  method?: ApiRequestMethod;
  data?: TBody;
  headers?: RequestHeaders;
  identityKey?: string;
  showLoading?: boolean;
  loadingTitle?: string;
  showErrorToast?: boolean;
}

interface BackendEnvelope<TData> {
  success?: boolean;
  data?: TData;
  message?: string;
  code?: string;
  error?: {
    code?: string;
    message?: string;
  };
}

function readCurrentIdentityKey(): string {
  try {
    return getApp<ShiftSchedulerApp>().globalData.currentIdentity?.id ?? '';
  } catch {
    return '';
  }
}

function normalizePath(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  let runtimeBaseUrl = APP_CONFIG.apiBaseUrl;

  try {
    runtimeBaseUrl = getApp<ShiftSchedulerApp>().globalData.apiBaseUrl ?? APP_CONFIG.apiBaseUrl;
  } catch {
    runtimeBaseUrl = APP_CONFIG.apiBaseUrl;
  }

  return `${runtimeBaseUrl}${normalizedPath}`;
}

function isBackendEnvelope<TData>(value: unknown): value is BackendEnvelope<TData> {
  return typeof value === 'object' && value !== null && ('success' in value || 'data' in value);
}

function isEmptyData(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }

  return false;
}

function statusFromCode(statusCode: number): ApiRequestStatus {
  if (statusCode === 401) {
    return 'unauthorized';
  }

  if (statusCode === 403) {
    return 'forbidden';
  }

  return 'error';
}

function messageFromStatus(status: ApiRequestStatus): string {
  const messages: Record<ApiRequestStatus, string> = {
    idle: '\u5c1a\u672a\u53d1\u8d77\u8bf7\u6c42',
    loading: '\u8bf7\u6c42\u4e2d',
    success: '\u8bf7\u6c42\u6210\u529f',
    empty: '\u6682\u65e0\u6570\u636e',
    error: '\u8bf7\u6c42\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5',
    unauthorized: '\u8eab\u4efd\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u9009\u62e9\u8eab\u4efd',
    forbidden: '\u5f53\u524d\u8eab\u4efd\u65e0\u6743\u8bbf\u95ee\u8be5\u529f\u80fd',
    offline: '\u7f51\u7edc\u4e0d\u53ef\u7528\uff0c\u8bf7\u68c0\u67e5\u540e\u7aef\u670d\u52a1\u6216\u672c\u5730\u7f51\u7edc',
  };

  return messages[status];
}

export function buildRequestHeaders(identityKey?: string, extraHeaders: RequestHeaders = {}): RequestHeaders {
  const activeIdentityKey = identityKey ?? readCurrentIdentityKey();
  const headers: RequestHeaders = {
    'Content-Type': 'application/json',
    'X-Client-Env': APP_CONFIG.environment,
    ...extraHeaders,
  };

  if (activeIdentityKey) {
    headers['X-Test-Identity'] = activeIdentityKey;
  }

  return headers;
}

export function createRequestResult<TData>(params: {
  status: ApiRequestStatus;
  statusCode: number;
  data?: TData | null;
  message?: string;
  code?: string;
  requestHeaders: RequestHeaders;
}): ApiRequestResult<TData> {
  return {
    ok: params.status === 'success' || params.status === 'empty',
    status: params.status,
    statusCode: params.statusCode,
    data: params.data ?? null,
    message: params.message ?? messageFromStatus(params.status),
    code: params.code ?? params.status.toUpperCase(),
    requestHeaders: params.requestHeaders,
  };
}

export function requestApi<TData = unknown, TBody = unknown>(
  options: ApiRequestOptions<TBody>,
): Promise<ApiRequestResult<TData>> {
  const requestHeaders = buildRequestHeaders(options.identityKey, options.headers);
  const showLoading = options.showLoading ?? true;
  const showErrorToast = options.showErrorToast ?? true;

  if (showLoading) {
    wx.showLoading({
      title: options.loadingTitle ?? '\u52a0\u8f7d\u4e2d',
      mask: true,
    });
  }

  return new Promise<ApiRequestResult<TData>>((resolve) => {
    wx.request<BackendEnvelope<TData> | TData>({
      url: normalizePath(options.path),
      method: options.method ?? 'GET',
      data: options.data,
      header: requestHeaders,
      success(response): void {
        const { statusCode } = response;
        const rawData = response.data;

        if (statusCode >= 200 && statusCode < 300) {
          const envelope = isBackendEnvelope<TData>(rawData) ? rawData : null;
          const failedByEnvelope = envelope?.success === false;

          if (failedByEnvelope) {
            resolve(
              createRequestResult<TData>({
                status: 'error',
                statusCode,
                message: envelope.error?.message ?? envelope.message,
                code: envelope.error?.code ?? envelope.code,
                requestHeaders,
              }),
            );
            return;
          }

          const payload = envelope && 'data' in envelope ? envelope.data ?? null : (rawData as TData);
          resolve(
            createRequestResult<TData>({
              status: isEmptyData(payload) ? 'empty' : 'success',
              statusCode,
              data: payload,
              requestHeaders,
            }),
          );
          return;
        }

        const envelope = isBackendEnvelope<TData>(rawData) ? rawData : null;
        const status = statusFromCode(statusCode);
        resolve(
          createRequestResult<TData>({
            status,
            statusCode,
            message: envelope?.error?.message ?? envelope?.message ?? messageFromStatus(status),
            code: envelope?.error?.code ?? envelope?.code ?? status.toUpperCase(),
            requestHeaders,
          }),
        );
      },
      fail(): void {
        resolve(
          createRequestResult<TData>({
            status: 'offline',
            statusCode: 0,
            requestHeaders,
          }),
        );
      },
      complete(): void {
        if (showLoading) {
          wx.hideLoading();
        }
      },
    });
  }).then((result: ApiRequestResult<TData>) => {
    if (!result.ok && showErrorToast) {
      wx.showToast({
        title: result.message,
        icon: 'none',
      });
    }

    return result;
  });
}
