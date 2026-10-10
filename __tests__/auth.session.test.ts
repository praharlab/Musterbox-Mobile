import * as Keychain from 'react-native-keychain';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { getIdentity, setIdentity } from '../src/auth/identity';
import { bootstrap, currentToken, restoreSession, signIn, signOut } from '../src/auth/sessionService';
import { isTokenExpired, secureStore } from '../src/storage/secureStore';
import { fakeJwt, lastBody, setupApi } from './support/helpers';

const future = Math.floor(Date.now() / 1000) + 3600;
const past = Math.floor(Date.now() / 1000) - 60;

function loginReply(token: string, resetpassword = 0) {
  return {
    status: 200,
    message: 'User login successfully.',
    data: {
      token,
      companyid: 12,
      userid: 345,
      firstname: 'Asha',
      middlename: '',
      lastname: 'Patel',
      userNumber: '9876500001',
      email: 'a@example.com',
      resetpassword,
    },
  };
}

beforeEach(async () => {
  (Keychain as unknown as { __reset: () => void }).__reset();
  setIdentity(null);
  jest.clearAllMocks();
});

describe('login', () => {
  it('stores the session in the keychain (not AsyncStorage) and activates identity', async () => {
    const { mock } = setupApi({ token: null });
    setIdentity(null);
    const token = fakeJwt(future);
    mock.onPost('auth/v1/mobilelogin').reply(200, loginReply(token));

    const session = await signIn(' 9876500001 ', 'secret');

    expect(lastBody(mock)).toMatchObject({ phone: '9876500001', password: 'secret', uniqueID: 'device-1' });
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      'session',
      expect.any(String),
      expect.objectContaining({ accessible: 'AccessibleWhenUnlockedThisDeviceOnly' }),
    );
    expect(session).toMatchObject({ userMasterID: 345, companyMasterID: 12, mustChangePassword: false });
    expect(getIdentity()).toEqual({ userMasterID: 345, companyMasterID: 12 });
    expect(currentToken()).toBe(token);
  });

  it('flags a forced password change when resetpassword == 1', async () => {
    const { mock } = setupApi({ token: null });
    mock.onPost('auth/v1/mobilelogin').reply(200, loginReply(fakeJwt(future), 1));
    expect((await signIn('9876500001', 'x')).mustChangePassword).toBe(true);
  });

  it('surfaces wrong-password errors and stores nothing', async () => {
    const { mock } = setupApi({ token: null });
    mock.onPost('auth/v1/mobilelogin').reply(200, { status: 400, message: 'Please enter valid loginid and password.' });
    await expect(signIn('9876500001', 'bad')).rejects.toMatchObject({
      kind: 'validation',
      message: 'Please enter valid loginid and password.',
    });
    expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
  });
});

describe('token persistence', () => {
  it('restores a valid stored session', async () => {
    const token = fakeJwt(future);
    await secureStore.saveSession({
      token,
      userMasterID: 345,
      companyMasterID: 12,
      firstName: 'Asha',
      lastName: 'Patel',
      email: '',
      userNumber: '',
      mustChangePassword: false,
      savedAt: Date.now(),
    });
    const restored = await restoreSession();
    expect(restored?.userMasterID).toBe(345);
    expect(currentToken()).toBe(token);
  });

  it('discards an expired stored token', async () => {
    await secureStore.saveSession({
      token: fakeJwt(past),
      userMasterID: 345,
      companyMasterID: 12,
      firstName: '',
      lastName: '',
      email: '',
      userNumber: '',
      mustChangePassword: false,
      savedAt: Date.now(),
    });
    expect(await restoreSession()).toBeNull();
    expect(Keychain.resetGenericPassword).toHaveBeenCalled();
    expect(isTokenExpired(fakeJwt(past))).toBe(true);
  });

  it('rejects malformed stored data', async () => {
    await Keychain.setGenericPassword('session', '{"token":""}');
    expect(await restoreSession()).toBeNull();
  });
});

describe('logout', () => {
  it('wipes keychain, cached documents and identity even if the server call fails', async () => {
    const { mock } = setupApi();
    mock.onPost('auth/v1/userLogout').networkError();
    await secureStore.saveSession({
      token: fakeJwt(future),
      userMasterID: 345,
      companyMasterID: 12,
      firstName: '',
      lastName: '',
      email: '',
      userNumber: '',
      mustChangePassword: false,
      savedAt: Date.now(),
    });
    await restoreSession();

    await signOut({ callServer: true });

    expect(mock.history.post[0].url).toBe('auth/v1/userLogout');
    expect(await secureStore.loadSession()).toBeNull();
    expect(ReactNativeBlobUtil.fs.unlink).toHaveBeenCalledWith('/cache/secure-docs');
    expect(getIdentity()).toBeNull();
    expect(currentToken()).toBeNull();
  });
});

describe('bootstrap', () => {
  function stubBootstrap(mock: ReturnType<typeof setupApi>['mock'], opts: { reports: number; approver: unknown }) {
    mock.onPost('auth/v1/dashboardcheck').reply(200, {
      status: 200,
      data: {
        tracking: false,
        attendancepolicy: { selfieAttendance: 1, attendanceInMobile: 1 },
        attendanceFrom: 'mobile',
        customizeProfileFields: [],
      },
    });
    mock.onPost('auth/v1/finalcheckpermission').reply(200, {
      status: 200,
      master: ['Leave', 'Attendance'],
      data: [{ formName: 'Leave', formMasterID: 20, operationName: ['View'] }],
    });
    mock.onGet('reportTo/v1/reportstoImmediateChild').reply(200, {
      status: 200,
      childCount: opts.reports,
      data: { child: Array.from({ length: opts.reports }, (_, i) => ({ reportToID: 345, userMasterID: 400 + i })) },
    });
    mock.onPost('AuthorizationDetails/v1/getAuthList').reply(200, { status: 200, data: opts.approver });
  }

  it('employee: no reports, not an approver -> employee navigation', async () => {
    const { mock } = setupApi();
    stubBootstrap(mock, { reports: 0, approver: [] });
    const r = await bootstrap();
    expect(r.capabilities.mode).toBe('employee');
    expect(r.capabilities.selfieRequired).toBe(true);
    const check = JSON.parse(mock.history.post.find(c => c.url === 'auth/v1/dashboardcheck')!.data);
    expect(check).toMatchObject({ userMasterID: 345, deviceType: 'ios', appVersion: '1.0.0' });
  });

  it('manager: has direct reports and approvals -> manager navigation', async () => {
    const { mock } = setupApi();
    stubBootstrap(mock, { reports: 2, approver: [{ formName: 'Leave' }] });
    const r = await bootstrap();
    expect(r.capabilities).toMatchObject({ mode: 'manager', team: true, approvals: true });
  });

  it('propagates force-update from dashboardcheck', async () => {
    const { mock } = setupApi();
    mock.onPost('auth/v1/dashboardcheck').reply(200, { status: 401, message: 'Please update app version.' });
    await expect(bootstrap()).rejects.toMatchObject({ kind: 'forceUpdate' });
  });

  it('still boots when the permission probe fails (UI gating fails open, server is the boundary)', async () => {
    const { mock } = setupApi();
    stubBootstrap(mock, { reports: 0, approver: [] });
    mock.onPost('auth/v1/finalcheckpermission').reply(500, {});
    const r = await bootstrap();
    expect(r.capabilities.leave).toBe(true);
    expect(r.permissions.known).toBe(false);
  });
});
