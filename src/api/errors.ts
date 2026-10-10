export type ApiErrorKind =
  /** Business rule rejected (legacy body.status != 200), message is user-facing. */
  | 'business'
  /** HTTP 400 from Joi/multer, or body.status 400. */
  | 'validation'
  /** HTTP 403 "Authorization Denied!" - token invalid/expired or user/company deactivated. */
  | 'sessionExpired'
  /** body.status 401 "Please update app version." */
  | 'forceUpdate'
  /** Company deactivated, no subscription, no mobile rights. */
  | 'accountInactive'
  | 'server'
  | 'network'
  | 'timeout'
  /** A client-side guard refused to send the request (e.g. tenant/identity mismatch). */
  | 'clientGuard';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** Status reported in the legacy body (`body.status`), if any. */
  readonly bodyStatus?: number;
  readonly httpStatus?: number;

  constructor(kind: ApiErrorKind, message: string, opts: { bodyStatus?: number; httpStatus?: number } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.bodyStatus = opts.bodyStatus;
    this.httpStatus = opts.httpStatus;
  }

  /** True when the server may or may not have processed the request. */
  get isUncertain(): boolean {
    return this.kind === 'network' || this.kind === 'timeout';
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

const FALLBACK: Record<ApiErrorKind, string> = {
  business: 'The request could not be completed.',
  validation: 'Please check the details and try again.',
  sessionExpired: 'Your session has expired. Please sign in again.',
  forceUpdate: 'A new version of the app is required.',
  accountInactive: 'Your account is not active. Please contact HR.',
  server: 'The server had a problem. Please try again shortly.',
  network: 'No connection. Check your internet and try again.',
  timeout: 'The server took too long to respond.',
  clientGuard: 'This action is not allowed from the app.',
};

/** A message that is safe to show the user. */
export function errorMessage(e: unknown): string {
  if (isApiError(e)) {
    return e.message || FALLBACK[e.kind];
  }
  return 'Something went wrong. Please try again.';
}
