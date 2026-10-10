/**
 * The only logger the app uses. It never prints in release builds and redacts
 * credentials, OTPs, salary data, identity documents and base64 payloads in dev.
 */
const SENSITIVE_KEY =
  /pass(word)?|token|otp|authorization|secret|salary|amount|balance|aadha?r|pan\b|pannumber|bank|account|ifsc|documentnumber|photo|userface|path|attachment|base64|dob/i;

const MAX_STRING = 200;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return '[depth]';
  }
  if (typeof value === 'string') {
    // Long strings are almost always base64 files or JWTs.
    return value.length > MAX_STRING ? `[string:${value.length}]` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(v => redact(v, depth + 1));
  }
  if (value && typeof value === 'object') {
    if (typeof FormData !== 'undefined' && value instanceof FormData) {
      return '[FormData]';
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

const enabled = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

export const logger = {
  debug(message: string, data?: unknown) {
    if (enabled) {
      console.log(`[musterbox] ${message}`, data === undefined ? '' : redact(data));
    }
  },
  warn(message: string, data?: unknown) {
    if (enabled) {
      console.warn(`[musterbox] ${message}`, data === undefined ? '' : redact(data));
    }
  },
  /** Errors are reported without request/response bodies. */
  error(message: string, error?: unknown) {
    if (enabled) {
      const e = error as { name?: string; message?: string; kind?: string } | undefined;
      console.warn(`[musterbox] ${message}`, e ? { name: e.name, kind: e.kind, message: e.message } : '');
    }
  },
};
