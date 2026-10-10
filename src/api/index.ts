import { createApiClient, ApiClient } from './client';
import { env } from '../config/env';

/**
 * App-wide API client. The auth layer wires the token getter and the
 * session-expired handler at startup via `configureApiSession`.
 */
let tokenGetter: () => string | null = () => null;
let sessionExpiredHandler: () => void = () => {};
let forceUpdateHandler: (message: string) => void = () => {};

export const api: ApiClient = createApiClient({
  baseURL: env.apiBaseUrl,
  timeoutMs: env.timeoutMs,
  uploadTimeoutMs: env.uploadTimeoutMs,
  getToken: () => tokenGetter(),
  onSessionExpired: () => sessionExpiredHandler(),
  onForceUpdate: message => forceUpdateHandler(message),
});

export function configureApiSession(handlers: {
  getToken: () => string | null;
  onSessionExpired: () => void;
  onForceUpdate: (message: string) => void;
}): void {
  tokenGetter = handlers.getToken;
  sessionExpiredHandler = handlers.onSessionExpired;
  forceUpdateHandler = handlers.onForceUpdate;
}

export { ApiError, errorMessage, isApiError } from './errors';
export type { LegacyEnvelope, RestEnvelope } from './envelope';
