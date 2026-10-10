import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { interpretResponse } from './envelope';
import { ApiError } from './errors';
import { guardPayload } from './requestGuard';
import { getIdentity } from '../auth/identity';
import { logger } from '../utils/logger';

export interface ApiClientOptions {
  baseURL: string;
  timeoutMs: number;
  uploadTimeoutMs: number;
  getToken: () => string | null;
  /** Called once per expired session (HTTP 403 / "Authorization Denied!"). */
  onSessionExpired: () => void;
  /** Called when the backend demands an app update. */
  onForceUpdate?: (message: string) => void;
}

export interface RequestOptions {
  /** Skip the session-expired handler (used by login, where 403 means bad input). */
  anonymous?: boolean;
  signal?: AbortSignal;
}

export interface ApiClient {
  get<T>(path: string, params?: Record<string, unknown>, opts?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: Record<string, unknown>, opts?: RequestOptions): Promise<T>;
  put<T>(path: string, body?: Record<string, unknown>, opts?: RequestOptions): Promise<T>;
  postMultipart<T>(path: string, form: FormData, opts?: RequestOptions): Promise<T>;
  readonly axios: AxiosInstance;
}

function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) {
    return e;
  }
  const err = e as AxiosError;
  if (axios.isCancel(e) || err?.code === 'ERR_CANCELED') {
    return new ApiError('network', 'Request cancelled.');
  }
  if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT' || /timeout/i.test(err?.message ?? '')) {
    return new ApiError('timeout', '');
  }
  if (err?.response) {
    try {
      interpretResponse(err.response.status, err.response.data);
    } catch (classified) {
      return classified as ApiError;
    }
    return new ApiError('server', '', { httpStatus: err.response.status });
  }
  return new ApiError('network', '');
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const instance = axios.create({
    baseURL: options.baseURL,
    timeout: options.timeoutMs,
    headers: { Accept: 'application/json' },
  });

  // Several in-flight requests can fail with 403 together; notify once per token.
  let expiredNotified = false;
  let lastToken: string | null = null;

  instance.interceptors.request.use(config => {
    const token = options.getToken();
    if (token !== lastToken) {
      lastToken = token;
      expiredNotified = false;
    }
    if (token && !(config as { anonymous?: boolean }).anonymous) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    const identity = getIdentity();
    const url = config.url ?? '';
    config.data = guardPayload(url, config.data, identity);
    config.params = guardPayload(url, config.params, identity);
    logger.debug(`→ ${config.method?.toUpperCase()} ${url}`, config.data ?? config.params);
    return config;
  });

  async function send<T>(config: AxiosRequestConfig & { anonymous?: boolean }): Promise<T> {
    try {
      const res = await instance.request(config);
      const body = interpretResponse<T>(res.status, res.data);
      logger.debug(`← ${res.status} ${config.url}`);
      return body;
    } catch (e) {
      const apiError = toApiError(e);
      logger.error(`✕ ${config.url}`, apiError);
      if (apiError.kind === 'sessionExpired' && !config.anonymous && !expiredNotified) {
        expiredNotified = true;
        options.onSessionExpired();
      }
      if (apiError.kind === 'forceUpdate') {
        options.onForceUpdate?.(apiError.message);
      }
      throw apiError;
    }
  }

  return {
    axios: instance,
    get: (path, params, opts) =>
      send({ method: 'GET', url: path, params, signal: opts?.signal, anonymous: opts?.anonymous }),
    post: (path, body, opts) =>
      send({ method: 'POST', url: path, data: body ?? {}, signal: opts?.signal, anonymous: opts?.anonymous }),
    put: (path, body, opts) =>
      send({ method: 'PUT', url: path, data: body ?? {}, signal: opts?.signal, anonymous: opts?.anonymous }),
    postMultipart: (path, form, opts) =>
      send({
        method: 'POST',
        url: path,
        data: form,
        timeout: options.uploadTimeoutMs,
        // Let the platform add the multipart boundary.
        headers: { 'Content-Type': 'multipart/form-data' },
        transformRequest: d => d,
        signal: opts?.signal,
        anonymous: opts?.anonymous,
      }),
  };
}
