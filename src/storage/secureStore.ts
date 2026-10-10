import * as Keychain from 'react-native-keychain';
import { logger } from '../utils/logger';

/**
 * The session (JWT + identity from login) lives only in the iOS Keychain /
 * Android Keystore-backed storage, bound to this device and readable only while unlocked.
 * Never AsyncStorage.
 */
const SERVICE = 'com.musterbox.mobile.session';

export interface StoredSession {
  token: string;
  userMasterID: number;
  companyMasterID: number;
  firstName: string;
  lastName: string;
  email: string;
  userNumber: string;
  mustChangePassword: boolean;
  savedAt: number;
}

function isStoredSession(v: unknown): v is StoredSession {
  const s = v as StoredSession;
  return (
    !!s &&
    typeof s.token === 'string' &&
    s.token.length > 0 &&
    Number.isFinite(s.userMasterID) &&
    Number.isFinite(s.companyMasterID)
  );
}

export const secureStore = {
  async saveSession(session: StoredSession): Promise<void> {
    await Keychain.setGenericPassword('session', JSON.stringify(session), {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async loadSession(): Promise<StoredSession | null> {
    try {
      const creds = await Keychain.getGenericPassword({ service: SERVICE });
      if (!creds) {
        return null;
      }
      const parsed = JSON.parse(creds.password);
      return isStoredSession(parsed) ? parsed : null;
    } catch (e) {
      logger.error('secureStore.loadSession failed', e);
      return null;
    }
  },

  async clearSession(): Promise<void> {
    try {
      await Keychain.resetGenericPassword({ service: SERVICE });
    } catch (e) {
      logger.error('secureStore.clearSession failed', e);
    }
  },
};

/** Reads `exp` from a JWT without verifying it (the server verifies). */
export function jwtExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }
    const json = decodeBase64Url(payload);
    const exp = JSON.parse(json).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, now = Date.now()): boolean {
  const exp = jwtExpiry(token);
  return exp !== null && exp <= now;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/* eslint-disable no-bitwise */
function decodeBase64Url(input: string): string {
  const s = input.replace(/-/g, '+').replace(/_/g, '/');
  let bits = 0;
  let value = 0;
  let out = '';
  for (const ch of s) {
    const idx = B64.indexOf(ch);
    if (idx < 0) {
      continue;
    }
    value = (value << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((value >> bits) & 0xff);
    }
  }
  // UTF-8 decode without relying on the deprecated escape().
  return decodeURIComponent(Array.from(out, c => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''));
}
/* eslint-enable no-bitwise */
