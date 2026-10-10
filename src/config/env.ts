import Config from 'react-native-config';

/**
 * Build-time configuration. Values come from `.env*` files via react-native-config.
 * Nothing tenant-specific (company, employee, customer) is ever configured here:
 * identity always comes from the login response.
 */
export type AppEnv = 'development' | 'staging' | 'production';

export interface EnvConfig {
  appEnv: AppEnv;
  apiBaseUrl: string;
  fileBaseUrl: string;
  socketUrl: string;
  timeoutMs: number;
  uploadTimeoutMs: number;
  features: {
    forgotPassword: boolean;
    approvalDecisions: boolean;
    regularizationSubmit: boolean;
  };
}

type RawConfig = Record<string, string | undefined>;

function withTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

function flag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') {
    return fallback;
  }
  return value.toLowerCase() === 'true';
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function parseEnv(raw: RawConfig): EnvConfig {
  const appEnv = (raw.APP_ENV as AppEnv) || 'development';
  const apiBaseUrl = withTrailingSlash(raw.API_BASE_URL || 'http://10.0.2.2:3000/');
  if (appEnv === 'production' && !apiBaseUrl.startsWith('https://')) {
    throw new Error('API_BASE_URL must use https in production builds');
  }
  return {
    appEnv,
    apiBaseUrl,
    fileBaseUrl: withTrailingSlash(raw.FILE_BASE_URL || apiBaseUrl),
    socketUrl: raw.SOCKET_URL || '',
    timeoutMs: num(raw.API_TIMEOUT_MS, 30000),
    uploadTimeoutMs: num(raw.API_UPLOAD_TIMEOUT_MS, 60000),
    features: {
      // Default OFF: the backend reset flow is not safe (see docs/BACKEND_GAPS.md).
      forgotPassword: flag(raw.FEATURE_FORGOT_PASSWORD, false),
      // Default OFF in production until the server binds decisions to the approver.
      approvalDecisions: flag(raw.FEATURE_APPROVAL_DECISIONS, appEnv !== 'production'),
      regularizationSubmit: flag(raw.FEATURE_REGULARIZATION_SUBMIT, appEnv !== 'production'),
    },
  };
}

export const env: EnvConfig = parseEnv(Config as RawConfig);
