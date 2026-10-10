import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

export function deviceType(): 'android' | 'ios' {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

/** Must match the backend AppVersion row for this platform exactly (dashboardcheck gate). */
export function appVersion(): string {
  return DeviceInfo.getVersion();
}

export async function deviceUniqueId(): Promise<string> {
  try {
    return await DeviceInfo.getUniqueId();
  } catch {
    return '';
  }
}
