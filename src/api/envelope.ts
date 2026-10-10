import { ApiError } from './errors';

/**
 * The backend has three response styles (handover §1.1):
 *  - legacy:     { status, message, data, totalcount? }  HTTP 200 even for business errors
 *  - rest:       { message, data, totalcount, page, pageSize }  real HTTP codes, no `status`
 *  - middleware: HTTP 403 { msg: "Authorization Denied!" }
 *
 * Success <=> HTTP 2xx AND (body.status absent OR body.status == 200).
 */
export interface LegacyEnvelope<T> {
  status: number;
  message?: string;
  data: T;
  totalcount?: number;
  [extra: string]: unknown;
}

export interface RestEnvelope<T> {
  message?: string;
  data: T;
  totalcount?: number;
  page?: number;
  pageSize?: number;
}

const FORCE_UPDATE = /update app version/i;
const ACCOUNT_INACTIVE = /company deactivated|subscribe any plan|rights for mobile|user deactivated|deactive/i;

function bodyMessage(body: unknown): string | undefined {
  if (body && typeof body === 'object') {
    const b = body as { message?: unknown; msg?: unknown };
    if (typeof b.message === 'string' && b.message) {
      return b.message;
    }
    if (typeof b.msg === 'string' && b.msg) {
      return b.msg;
    }
  }
  return undefined;
}

function bodyStatus(body: unknown): number | undefined {
  if (body && typeof body === 'object' && 'status' in body) {
    const n = Number((body as { status: unknown }).status);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** Classifies a legacy `body.status` value that is not 200. */
function classifyBodyStatus(status: number, message: string | undefined): ApiError {
  if (status === 401 && message && FORCE_UPDATE.test(message)) {
    return new ApiError('forceUpdate', message, { bodyStatus: status });
  }
  if (message && ACCOUNT_INACTIVE.test(message)) {
    return new ApiError('accountInactive', message, { bodyStatus: status });
  }
  if (status === 400) {
    return new ApiError('validation', message ?? '', { bodyStatus: status });
  }
  if (status === 500) {
    return new ApiError('server', message ?? '', { bodyStatus: status });
  }
  // 401 is also used for ordinary business errors ("You are not in attendance area.").
  return new ApiError('business', message ?? '', { bodyStatus: status });
}

/** Returns the body when the call succeeded, otherwise throws a classified ApiError. */
export function interpretResponse<T = unknown>(httpStatus: number, body: unknown): T {
  const message = bodyMessage(body);

  if (httpStatus === 401 || httpStatus === 403) {
    return throwError(new ApiError('sessionExpired', message ?? '', { httpStatus }));
  }
  if (httpStatus === 400 || httpStatus === 413 || httpStatus === 422) {
    return throwError(new ApiError('validation', message ?? '', { httpStatus }));
  }
  if (httpStatus >= 500) {
    return throwError(new ApiError('server', message ?? '', { httpStatus }));
  }
  if (httpStatus < 200 || httpStatus >= 300) {
    return throwError(new ApiError('business', message ?? '', { httpStatus }));
  }

  // Some middleware denials arrive with a body `msg` even when proxied as 200.
  if (message === 'Authorization Denied!') {
    return throwError(new ApiError('sessionExpired', message, { httpStatus }));
  }

  const status = bodyStatus(body);
  if (status !== undefined && status !== 200) {
    const err = classifyBodyStatus(status, message);
    return throwError(new ApiError(err.kind, err.message, { bodyStatus: status, httpStatus }));
  }
  return body as T;
}

function throwError(e: ApiError): never {
  throw e;
}
