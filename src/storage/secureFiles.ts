import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { logger } from '../utils/logger';

/**
 * Short-lived storage for sensitive documents (payslips, letters, ID documents).
 *
 *  - Files live in the app's private cache dir under `secure-docs/`, never in Downloads.
 *  - File names are random, never the employee ID or month.
 *  - Everything is deleted on logout and anything older than MAX_AGE_MS on start/login.
 */
export const MAX_AGE_MS = 15 * 60 * 1000;

const dir = () => `${ReactNativeBlobUtil.fs.dirs.CacheDir}/secure-docs`;

function randomName(ext: string): string {
  const rand = Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `doc-${rand}.${ext}`;
}

async function ensureDir(): Promise<string> {
  const d = dir();
  if (!(await ReactNativeBlobUtil.fs.isDir(d))) {
    await ReactNativeBlobUtil.fs.mkdir(d);
  }
  return d;
}

export const secureFiles = {
  /** Writes a base64 PDF (e.g. payslip `data.path`) and returns the local path. */
  async writeBase64Pdf(base64: string): Promise<string> {
    const clean = base64.replace(/^data:[^;]+;base64,/, '');
    if (!clean) {
      throw new Error('Empty document');
    }
    const path = `${await ensureDir()}/${randomName('pdf')}`;
    await ReactNativeBlobUtil.fs.writeFile(path, clean, 'base64');
    return path;
  },

  /**
   * Downloads a file with the Authorization header. Today the backend serves these
   * publicly (GAP P0-11); sending the token keeps the app correct once auth is added.
   */
  async download(url: string, token: string | null, ext = 'pdf'): Promise<string> {
    const path = `${await ensureDir()}/${randomName(ext)}`;
    const res = await ReactNativeBlobUtil.config({ path }).fetch(
      'GET',
      url,
      token ? { Authorization: `Bearer ${token}` } : {},
    );
    const status = res.info().status;
    if (status < 200 || status >= 300) {
      await ReactNativeBlobUtil.fs.unlink(path).catch(() => undefined);
      throw new Error(`Download failed (${status})`);
    }
    return path;
  },

  async open(path: string, mime = 'application/pdf'): Promise<void> {
    if (Platform.OS === 'android') {
      await ReactNativeBlobUtil.android.actionViewIntent(path, mime);
    } else {
      await ReactNativeBlobUtil.ios.openDocument(path);
    }
  },

  async purgeStale(maxAgeMs = MAX_AGE_MS, now = Date.now()): Promise<void> {
    try {
      const d = dir();
      if (!(await ReactNativeBlobUtil.fs.isDir(d))) {
        return;
      }
      const entries = await ReactNativeBlobUtil.fs.lstat(d);
      await Promise.all(
        entries
          .filter(e => now - Number(e.lastModified) > maxAgeMs)
          .map(e => ReactNativeBlobUtil.fs.unlink(e.path).catch(() => undefined)),
      );
    } catch (e) {
      logger.error('secureFiles.purgeStale failed', e);
    }
  },

  async purgeAll(): Promise<void> {
    try {
      const d = dir();
      if (await ReactNativeBlobUtil.fs.isDir(d)) {
        await ReactNativeBlobUtil.fs.unlink(d);
      }
    } catch (e) {
      logger.error('secureFiles.purgeAll failed', e);
    }
  },
};
