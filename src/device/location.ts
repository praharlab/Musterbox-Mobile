import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export interface Fix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export class LocationError extends Error {
  constructor(readonly reason: 'denied' | 'unavailable' | 'timeout', message: string) {
    super(message);
    this.name = 'LocationError';
  }
}

async function ensurePermission(): Promise<void> {
  if (Platform.OS === 'android') {
    const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      title: 'Location for attendance',
      message: 'Your location is sent with check-in and check-out so the office geofence can be verified.',
      buttonPositive: 'Allow',
    });
    if (res !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new LocationError('denied', 'Location permission is required to mark attendance.');
    }
    return;
  }
  await new Promise<void>((resolve, reject) =>
    Geolocation.requestAuthorization(resolve, () =>
      reject(new LocationError('denied', 'Location permission is required to mark attendance.')),
    ),
  );
}

/** One fresh high-accuracy fix. Cached positions older than 10 s are not accepted. */
export async function getCurrentFix(timeoutMs = 20000): Promise<Fix> {
  await ensurePermission();
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      pos =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
        }),
      err => {
        if (err.code === 1) {
          reject(new LocationError('denied', 'Location permission is required to mark attendance.'));
        } else if (err.code === 3) {
          reject(new LocationError('timeout', 'Could not get your location in time. Move to an open area and retry.'));
        } else {
          reject(new LocationError('unavailable', 'Location is unavailable. Turn on GPS and retry.'));
        }
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 10000 },
    );
  });
}

/**
 * The backend expects an address string. Reverse geocoding needs a third-party service
 * that the backend does not provide, so the coordinates are sent as the address.
 */
export function describeFix(fix: Fix): string {
  return `Lat ${fix.latitude.toFixed(5)}, Long ${fix.longitude.toFixed(5)}`;
}
