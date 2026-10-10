import { PermissionsAndroid, Platform } from 'react-native';
import { launchCamera } from 'react-native-image-picker';

/**
 * Android: CAMERA is declared in the manifest, so it must also be granted at runtime,
 * otherwise launchCamera fails with "permission". iOS asks automatically (Info.plist string).
 */
async function ensureCameraPermission(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
    title: 'Camera for attendance',
    message: 'Your company requires a selfie when you check in or check out.',
    buttonPositive: 'Allow',
  });
  if (res !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error('Camera permission is required for selfie attendance. Allow it in Settings and try again.');
  }
}

/**
 * Captures a front-camera selfie for attendance as raw base64 (no data: prefix),
 * downscaled as the handover recommends (~640 px, quality 0.6). Nothing is saved to the gallery.
 */
export async function captureSelfie(): Promise<string | null> {
  await ensureCameraPermission();
  const res = await launchCamera({
    mediaType: 'photo',
    cameraType: 'front',
    includeBase64: true,
    maxWidth: 640,
    maxHeight: 640,
    quality: 0.6,
    saveToPhotos: false,
  });
  if (res.didCancel) {
    return null;
  }
  if (res.errorCode) {
    if (res.errorCode === 'camera_unavailable') {
      throw new Error('Camera is not available on this device.');
    }
    if (res.errorCode === 'permission') {
      throw new Error('Camera permission is required for selfie attendance. Allow it in Settings and try again.');
    }
    throw new Error('Could not open the camera.');
  }
  return res.assets?.[0]?.base64 ?? null;
}
