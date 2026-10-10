import { interpretResponse } from '../src/api/envelope';
import { ApiError } from '../src/api/errors';

function kindOf(http: number, body: unknown): string {
  try {
    interpretResponse(http, body);
    return 'ok';
  } catch (e) {
    return (e as ApiError).kind;
  }
}

describe('response envelope (handover §1.1)', () => {
  it('accepts legacy success', () => {
    expect(interpretResponse(200, { status: 200, message: 'ok', data: { a: 1 } })).toEqual({
      status: 200,
      message: 'ok',
      data: { a: 1 },
    });
  });

  it('accepts REST-style bodies that have no status field', () => {
    expect(kindOf(200, { message: 'ok', data: [], totalcount: 0, page: 1, pageSize: 10 })).toBe('ok');
  });

  it('does not treat HTTP 200 as success when body.status is an error', () => {
    expect(kindOf(200, { status: 400, message: 'Please enter valid loginid and password.', data: {} })).toBe(
      'validation',
    );
    expect(kindOf(200, { status: 501, message: 'User not found.' })).toBe('business');
    expect(kindOf(200, { status: 500, message: 'boom' })).toBe('server');
  });

  it('keeps the server message for business errors', () => {
    try {
      interpretResponse(200, { status: 401, message: 'You are not in attendance area.' });
    } catch (e) {
      expect((e as ApiError).kind).toBe('business');
      expect((e as ApiError).message).toBe('You are not in attendance area.');
    }
  });

  it('detects the force-update signal', () => {
    expect(kindOf(200, { status: 401, message: 'Please update app version.', data: {} })).toBe('forceUpdate');
  });

  it('detects inactive account / subscription messages', () => {
    expect(kindOf(200, { status: 401, message: 'Company deactivated or deleted!' })).toBe('accountInactive');
    expect(kindOf(200, { status: 401, message: 'Please subscribe any plan..' })).toBe('accountInactive');
    expect(kindOf(200, { status: 401, message: 'You dont have rights for mobile Login!!' })).toBe('accountInactive');
  });

  it('maps middleware denial to session expiry', () => {
    expect(kindOf(403, { msg: 'Authorization Denied!' })).toBe('sessionExpired');
  });

  it('maps HTTP status codes', () => {
    expect(kindOf(400, { message: 'bad file' })).toBe('validation');
    expect(kindOf(404, { message: 'not found' })).toBe('business');
    expect(kindOf(502, '')).toBe('server');
  });
});
