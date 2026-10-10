import { api } from '../src/api';
import { ApiError } from '../src/api/errors';
import { guardPayload } from '../src/api/requestGuard';
import { EMPLOYEE, lastBody, setupApi } from './support/helpers';

describe('API client', () => {
  it('attaches the bearer token', async () => {
    const { mock } = setupApi({ token: 'abc' });
    mock.onPost('x').reply(200, { status: 200, data: 1 });
    await api.post('x', {});
    expect(mock.history.post[0].headers?.Authorization).toBe('Bearer abc');
  });

  it('throws a business error for HTTP 200 + body status 401', async () => {
    const { mock } = setupApi();
    mock.onPost('x').reply(200, { status: 401, message: 'Branch not assigned' });
    await expect(api.post('x', {})).rejects.toMatchObject({ kind: 'business', message: 'Branch not assigned' });
  });

  it('expired token: calls the session-expired handler once for parallel failures', async () => {
    const { mock, onSessionExpired } = setupApi();
    mock.onAny().reply(403, { msg: 'Authorization Denied!' });
    await Promise.allSettled([api.get('a'), api.get('b'), api.post('c', {})]);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('does not treat a failed anonymous call (login) as session expiry', async () => {
    const { mock, onSessionExpired } = setupApi({ token: null });
    mock.onPost('auth/v1/mobilelogin').reply(403, { msg: 'Authorization Denied!' });
    await expect(api.post('auth/v1/mobilelogin', {}, { anonymous: true })).rejects.toBeInstanceOf(ApiError);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('reports force-update', async () => {
    const { mock, onForceUpdate } = setupApi();
    mock.onPost('auth/v1/dashboardcheck').reply(200, { status: 401, message: 'Please update app version.' });
    await expect(api.post('auth/v1/dashboardcheck', {})).rejects.toMatchObject({ kind: 'forceUpdate' });
    expect(onForceUpdate).toHaveBeenCalledWith('Please update app version.');
  });

  it('classifies network failure and timeout as uncertain', async () => {
    const { mock } = setupApi();
    mock.onGet('net').networkError();
    mock.onGet('slow').timeout();
    const net = await api.get('net').catch(e => e);
    const slow = await api.get('slow').catch(e => e);
    expect(net).toMatchObject({ kind: 'network', isUncertain: true });
    expect(slow).toMatchObject({ kind: 'timeout', isUncertain: true });
  });

  it('classifies 5xx as server error', async () => {
    const { mock } = setupApi();
    mock.onGet('boom').reply(500, { status: 500, message: 'Internal' });
    await expect(api.get('boom')).rejects.toMatchObject({ kind: 'server' });
  });
});

describe('request guard (tenant isolation + forbidden keys)', () => {
  it('strips keys the app must never send', async () => {
    const { mock } = setupApi();
    mock.onPost('anything').reply(200, { status: 200 });
    await api.post('anything', { exportData: true, Export: 1, declarationFrom: 'x', verifyBy: 1, admin: 2, keep: 1 });
    expect(lastBody(mock)).toEqual({ keep: 1 });
  });

  it('strips status from the payslip request (status "01" bypasses the publish flag)', () => {
    expect(
      guardPayload(
        'salaryTrans/v1/getUserWiseSalarySlip',
        { userMasterID: 345, yyyymm: '202608', status: '01' },
        EMPLOYEE,
      ),
    ).toEqual({ userMasterID: 345, yyyymm: '202608' });
  });

  it("refuses to send another user's ID", async () => {
    const { mock } = setupApi();
    mock.onPost('x').reply(200, { status: 200 });
    await expect(api.post('x', { userMasterID: 999 })).rejects.toMatchObject({ kind: 'clientGuard' });
    expect(mock.history.post).toHaveLength(0);
  });

  it("refuses to send another company's ID (query params too)", async () => {
    const { mock } = setupApi();
    mock.onGet('x').reply(200, { status: 200 });
    await expect(api.get('x', { companyMasterID: 77, userMasterID: 345 })).rejects.toMatchObject({
      kind: 'clientGuard',
    });
  });

  it('allows the signed-in identity', () => {
    expect(guardPayload('x', { userMasterID: 345, companyMasterID: 12, createBy: 345 }, EMPLOYEE)).toEqual({
      userMasterID: 345,
      companyMasterID: 12,
      createBy: 345,
    });
  });
});
