/* global jest */
// Native modules are mocked so logic and screens can be tested without a device.

jest.mock('react-native-config', () => ({
  APP_ENV: 'development',
  API_BASE_URL: 'https://api.test/',
  FILE_BASE_URL: 'https://api.test/',
  FEATURE_APPROVAL_DECISIONS: 'true',
  FEATURE_REGULARIZATION_SUBMIT: 'true',
  FEATURE_FORGOT_PASSWORD: 'false',
}));

jest.mock('react-native-keychain', () => {
  let store = null;
  return {
    ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly' },
    setGenericPassword: jest.fn(async (username, password) => {
      store = { username, password };
      return { service: 'test' };
    }),
    getGenericPassword: jest.fn(async () => store || false),
    resetGenericPassword: jest.fn(async () => {
      store = null;
      return true;
    }),
    __reset: () => {
      store = null;
    },
  };
});

jest.mock('react-native-blob-util', () => {
  const files = new Map();
  const fs = {
    dirs: { CacheDir: '/cache' },
    isDir: jest.fn(async () => true),
    mkdir: jest.fn(async () => undefined),
    writeFile: jest.fn(async (path, data) => {
      files.set(path, { data, lastModified: Date.now() });
    }),
    unlink: jest.fn(async path => {
      for (const k of [...files.keys()]) {
        if (k === path || k.startsWith(`${path}/`)) {
          files.delete(k);
        }
      }
    }),
    lstat: jest.fn(async () => [...files.entries()].map(([path, f]) => ({ path, lastModified: f.lastModified }))),
    __files: files,
  };
  return {
    __esModule: true,
    default: {
      fs,
      config: jest.fn(() => ({
        fetch: jest.fn(async () => ({ info: () => ({ status: 200 }) })),
      })),
      android: { actionViewIntent: jest.fn(async () => true) },
      ios: { openDocument: jest.fn(async () => undefined) },
    },
  };
});

jest.mock('react-native-device-info', () => ({
  getVersion: () => '1.0.0',
  getUniqueId: jest.fn(async () => 'device-1'),
}));

jest.mock('@react-native-community/geolocation', () => ({
  requestAuthorization: jest.fn(ok => ok()),
  getCurrentPosition: jest.fn(ok => ok({ coords: { latitude: 23.0225, longitude: 72.5714, accuracy: 8 } })),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(async () => ({ assets: [{ base64: 'c2VsZmll' }] })),
}));

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  types: { images: 'image/*', pdf: 'application/pdf' },
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
  isErrorWithCode: () => false,
}));

// Firebase not configured in tests: push must degrade gracefully.
jest.mock('@react-native-firebase/messaging', () => {
  throw new Error('Firebase not configured');
});

// Use React Native's FormData (keeps file parts as {uri,name,type}) instead of Node's.
// eslint-disable-next-line @react-native/no-deep-imports -- test-only polyfill
global.FormData = require('react-native/Libraries/Network/FormData').default;

// Keep test output readable: drop the app's own (already redacted) dev logs.
for (const level of ['log', 'warn']) {
  const original = console[level];
  console[level] = (...args) => {
    if (typeof args[0] === 'string' && args[0].startsWith('[musterbox]')) {
      return;
    }
    original(...args);
  };
}

jest.mock('react-native-bootsplash', () => ({
  __esModule: true,
  default: { hide: jest.fn(async () => undefined), isVisible: jest.fn(async () => false) },
}));
