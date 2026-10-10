import MockAdapter from 'axios-mock-adapter';
import { api, configureApiSession } from '../../src/api';
import { setIdentity } from '../../src/auth/identity';

// Jest runs on Node; declared here to avoid pulling @types/node into the app's type space.
declare const Buffer: { from(s: string): { toString(encoding: 'base64url'): string } };

export const EMPLOYEE = { userMasterID: 345, companyMasterID: 12 };

/** A syntactically valid JWT with the given expiry (seconds since epoch). */
export function fakeJwt(expSeconds: number): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ token: { usermasterid: 345 }, exp: expSeconds })}.sig`;
}

export function setupApi(opts: { token?: string | null } = {}) {
  const mock = new MockAdapter(api.axios);
  const onSessionExpired = jest.fn();
  const onForceUpdate = jest.fn();
  configureApiSession({
    getToken: () => (opts.token === undefined ? 'test-token' : opts.token),
    onSessionExpired,
    onForceUpdate,
  });
  setIdentity(EMPLOYEE);
  return { mock, onSessionExpired, onForceUpdate };
}

export function lastBody(mock: MockAdapter, method: 'post' | 'get' = 'post') {
  const calls = mock.history[method];
  const c = calls[calls.length - 1];
  return method === 'get' ? c.params : typeof c.data === 'string' ? JSON.parse(c.data) : c.data;
}
