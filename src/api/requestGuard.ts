import { ApiError } from './errors';
import type { Identity } from '../auth/identity';

/**
 * Keys the handover says the mobile app must never send (§15.3):
 *  - exportData / Export switch list responses to XLSX streams
 *  - declarationFrom self-approves investment declarations
 *  - verifyBy self-verifies profile records
 *  - admin changes user type
 */
const GLOBAL_FORBIDDEN = ['exportData', 'Export', 'declarationFrom', 'verifyBy', 'admin'];

/** Keys forbidden only on specific paths. */
const PATH_FORBIDDEN: Record<string, string[]> = {
  // status:"01" bypasses the payslip publish flag.
  'salaryTrans/v1/getUserWiseSalarySlip': ['status'],
  // companyMasterID overrides the token tenant filter.
  'policyDocument/v1': ['companyMasterID'],
};

/**
 * Top-level identity keys that, when present, must equal the signed-in identity.
 * This is the client half of tenant isolation: a bug or a tampered screen can never
 * send another user's or company's ID. (The backend remains the security boundary.)
 */
const USER_KEYS = ['userMasterID', 'userid', 'createBy', 'updateBy', 'authuser', 'senderID'];
const COMPANY_KEYS = ['companyMasterID'];

function normalisePath(url: string): string {
  return url
    .replace(/^https?:\/\/[^/]+\//, '')
    .replace(/^\//, '')
    .split('?')[0];
}

function strip(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out = { ...obj };
  for (const k of keys) {
    delete out[k];
  }
  return out;
}

function checkIdentity(obj: Record<string, unknown>, identity: Identity | null): void {
  for (const k of USER_KEYS) {
    if (obj[k] !== undefined && obj[k] !== '' && identity && Number(obj[k]) !== identity.userMasterID) {
      throw new ApiError('clientGuard', 'Requests can only be made for your own account.');
    }
  }
  for (const k of COMPANY_KEYS) {
    if (obj[k] !== undefined && obj[k] !== '' && identity && Number(obj[k]) !== identity.companyMasterID) {
      throw new ApiError('clientGuard', 'Requests can only be made for your own company.');
    }
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    !!v && typeof v === 'object' && !Array.isArray(v) && !(typeof FormData !== 'undefined' && v instanceof FormData)
  );
}

/** Sanitises a request's JSON body or query params before it leaves the device. */
export function guardPayload<T>(url: string, payload: T, identity: Identity | null): T {
  if (!isPlainObject(payload)) {
    return payload;
  }
  const path = normalisePath(url);
  const pathKeys = Object.entries(PATH_FORBIDDEN)
    .filter(([p]) => path === p || path.startsWith(`${p}/`))
    .flatMap(([, keys]) => keys);
  const cleaned = strip(payload, [...GLOBAL_FORBIDDEN, ...pathKeys]);
  checkIdentity(cleaned, identity);
  return cleaned as T;
}
