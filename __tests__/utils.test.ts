import { nextPageParam, toPage } from '../src/api/pagination';
import { parseEnv } from '../src/config/env';
import { routeForInboxActivity, routeForPushScreen } from '../src/notifications/screenRouter';
import { daysInclusive, eachDate, monthRange, yyyymmLabel } from '../src/utils/dates';
import { redact } from '../src/utils/logger';
import { maskTail } from '../src/utils/pick';

describe('logger redaction (never log secrets)', () => {
  it('redacts tokens, passwords, OTPs, salary and document data', () => {
    expect(
      redact({
        token: 'eyJ...',
        password: 'p',
        newpassword: 'n',
        passwordToken: '4821',
        otp: 1234,
        Authorization: 'Bearer x',
        salaryAmount: 5,
        documentNumber: '1234',
        photo: 'b64',
        path: 'JVBER',
        name: 'ok',
      }),
    ).toEqual({
      token: '[redacted]',
      password: '[redacted]',
      newpassword: '[redacted]',
      passwordToken: '[redacted]',
      otp: '[redacted]',
      Authorization: '[redacted]',
      salaryAmount: '[redacted]',
      documentNumber: '[redacted]',
      photo: '[redacted]',
      path: '[redacted]',
      name: 'ok',
    });
  });

  it('truncates long strings (base64 / JWT) even under innocent keys', () => {
    expect(redact({ data: 'x'.repeat(500) })).toEqual({ data: '[string:500]' });
  });
});

describe('pagination', () => {
  it('stops when everything is loaded', () => {
    const p1 = toPage([1, 2], 1, 3);
    const p2 = toPage([3], 2, 3);
    expect(nextPageParam(p1, [p1])).toBe(2);
    expect(nextPageParam(p2, [p1, p2])).toBeUndefined();
  });

  it('treats a short page without totalcount as the last page', () => {
    const p = toPage([1], 1, undefined);
    expect(nextPageParam(p, [p])).toBeUndefined();
  });
});

describe('push / inbox routing', () => {
  it('routes approval pushes only for managers', () => {
    expect(routeForPushScreen('leaveauth', 'manager')).toEqual({ name: 'ApprovalsTab', params: { module: 'leave' } });
    expect(routeForPushScreen('LEAVEAUTH', 'employee')).toEqual({ name: 'HomeTab' });
  });
  it('routes known screens and falls back to Home', () => {
    expect(routeForPushScreen('leave', 'employee')).toEqual({ name: 'LeaveTab' });
    expect(routeForPushScreen('announcement', 'employee').name).toBe('NotificationsTab');
    expect(routeForPushScreen('chat', 'employee')).toEqual({ name: 'HomeTab' });
    expect(routeForPushScreen(undefined, 'manager')).toEqual({ name: 'HomeTab' });
  });
  it('maps inbox activity tables', () => {
    expect(routeForInboxActivity('LeaveAuthorizationRequest', 'manager').name).toBe('ApprovalsTab');
  });
});

describe('env', () => {
  it('requires https in production and defaults risky flags off', () => {
    expect(() => parseEnv({ APP_ENV: 'production', API_BASE_URL: 'http://x' })).toThrow();
    const prod = parseEnv({ APP_ENV: 'production', API_BASE_URL: 'https://x' });
    expect(prod.features).toEqual({ forgotPassword: false, approvalDecisions: false, regularizationSubmit: false });
    expect(prod.apiBaseUrl).toBe('https://x/');
  });
});

describe('dates and masking', () => {
  it('computes ranges', () => {
    expect(monthRange(2026, 2)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(daysInclusive('2026-10-05', '2026-10-06')).toBe(2);
    expect(eachDate('2026-12-31', '2027-01-01')).toEqual(['2026-12-31', '2027-01-01']);
    expect(yyyymmLabel('202608')).toBe('Aug 2026');
  });
  it('masks identifiers', () => {
    expect(maskTail('123412341234')).toBe('••••••••1234');
  });
});
