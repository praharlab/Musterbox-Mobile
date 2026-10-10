import { PermissionsAndroid, Platform } from 'react-native';
import { logger } from '../utils/logger';

/**
 * Push notifications via Firebase Cloud Messaging (the backend already sends FCM
 * HTTP v1 messages and stores one token per user, handover §12).
 *
 * Every call is wrapped so the app keeps working when Firebase is not configured
 * (no google-services.json / GoogleService-Info.plist) - push is then simply off.
 */
export interface PushMessage {
  data?: Record<string, string | object>;
  notification?: { title?: string; body?: string };
}

type Messaging = typeof import('@react-native-firebase/messaging');

let mod: Messaging | null | undefined;

function messagingModule(): Messaging | null {
  if (mod !== undefined) {
    return mod;
  }
  try {
    mod = require('@react-native-firebase/messaging') as Messaging;
    mod.getMessaging();
  } catch (e) {
    logger.warn('Push disabled: Firebase is not configured', e);
    mod = null;
  }
  return mod;
}

export const push = {
  isAvailable(): boolean {
    return messagingModule() !== null;
  },

  async requestPermission(): Promise<boolean> {
    const m = messagingModule();
    if (!m) {
      return false;
    }
    try {
      if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
        const res = await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as never);
        return res === PermissionsAndroid.RESULTS.GRANTED;
      }
      const status = await m.requestPermission(m.getMessaging());
      return status === m.AuthorizationStatus.AUTHORIZED || status === m.AuthorizationStatus.PROVISIONAL;
    } catch (e) {
      logger.error('push.requestPermission failed', e);
      return false;
    }
  },

  /** FCM registration token, sent in mobilelogin and every dashboardcheck. */
  async getToken(): Promise<string | undefined> {
    const m = messagingModule();
    if (!m) {
      return undefined;
    }
    try {
      return await m.getToken(m.getMessaging());
    } catch (e) {
      logger.error('push.getToken failed', e);
      return undefined;
    }
  },

  async deleteToken(): Promise<void> {
    const m = messagingModule();
    if (m) {
      await m.deleteToken(m.getMessaging()).catch(() => undefined);
    }
  },

  onTokenRefresh(listener: (token: string) => void): () => void {
    const m = messagingModule();
    return m ? m.onTokenRefresh(m.getMessaging(), listener) : () => {};
  },

  onForegroundMessage(listener: (msg: PushMessage) => void): () => void {
    const m = messagingModule();
    return m ? m.onMessage(m.getMessaging(), listener as never) : () => {};
  },

  onNotificationOpened(listener: (msg: PushMessage) => void): () => void {
    const m = messagingModule();
    return m ? m.onNotificationOpenedApp(m.getMessaging(), listener as never) : () => {};
  },

  async initialNotification(): Promise<PushMessage | null> {
    const m = messagingModule();
    if (!m) {
      return null;
    }
    return (await m.getInitialNotification(m.getMessaging()).catch(() => null)) as PushMessage | null;
  },
};

export function screenOf(msg: PushMessage | null | undefined): string | undefined {
  const s = msg?.data?.screen;
  return typeof s === 'string' ? s : undefined;
}
