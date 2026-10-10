import { attendanceApi, buildPunchBody } from '../src/api/attendance.api';
import { ApiError } from '../src/api/errors';
import { LocationError } from '../src/device/location';
import { derivePunchState, nextAction, performPunch, PunchDeps } from '../src/features/attendance/punch';
import { buildCorrectionLogs } from '../src/features/attendance/regularization';
import type { AttendanceStatusBody } from '../src/types/api';
import { lastBody, setupApi } from './support/helpers';

const status = (inAt: string | null, outAt: string | null, cont = false): AttendanceStatusBody => ({
  status: 200,
  data: {
    In_Data: inAt ? { logDateTime: inAt, direction: 'in', address: 'x' } : null,
    Out_Data: outAt ? { logDateTime: outAt, direction: 'out', address: 'x' } : null,
  },
  continuePunchIN: cont,
});

const caps = { selfieRequired: false, faceCheckRequired: false, outsideAllowed: false };

function deps(over: Partial<PunchDeps['api']> = {}, extra: Partial<PunchDeps> = {}): PunchDeps {
  return {
    getFix: jest.fn(async () => ({ latitude: 23.0225, longitude: 72.5714, accuracy: 5 })),
    captureSelfie: jest.fn(async () => 'c2VsZmll'),
    api: {
      punch: jest.fn(async () => ({ status: 200, message: 'PunchIn successfully.', data: {} })),
      todayStatus: jest.fn(async () => status(null, null)),
      faceCheck: jest.fn(async () => ({ status: 200, data: {} })),
      ...over,
    },
    ...extra,
  };
}

describe('punch body', () => {
  it('matches the documented attendanceApi contract', () => {
    expect(
      buildPunchBody(
        { action: 'checkIn', latitude: '1', longitude: '2', address: 'a', photoBase64: 'data:image/png;base64,QQ==' },
        345,
      ),
    ).toEqual({
      userMasterID: 345,
      direction: 'in',
      newpunchin: true,
      attendnaceFrom: 'mobile',
      latitude: '1',
      longitude: '2',
      address: 'a',
      photo: 'QQ==',
      createBy: 345,
      createByIp: '',
    });
  });

  it('resume sends newpunchin=false; checkout omits it', () => {
    expect(
      buildPunchBody({ action: 'resume', latitude: '', longitude: '', address: '', photoBase64: '' }, 1),
    ).toMatchObject({
      direction: 'in',
      newpunchin: false,
    });
    expect(
      buildPunchBody({ action: 'checkOut', latitude: '', longitude: '', address: '', photoBase64: '' }, 1),
    ).not.toHaveProperty('newpunchin');
  });

  it('never sends attendnaceFrom "web" (geofence bypass) and uses the session user', async () => {
    const { mock } = setupApi();
    mock.onPost('attendanceTransaction/v1/attendanceApi').reply(200, { status: 200, message: 'PunchIn successfully.' });
    await attendanceApi.punch({ action: 'checkIn', latitude: '1', longitude: '2', address: 'a', photoBase64: '' });
    expect(lastBody(mock)).toMatchObject({ attendnaceFrom: 'mobile', userMasterID: 345, createBy: 345 });
  });
});

describe('punch state', () => {
  it('derives the next action', () => {
    expect(nextAction(derivePunchState(status(null, null)))).toBe('checkIn');
    expect(nextAction(derivePunchState(status('2026-09-23T09:00:00+05:30', null)))).toBe('checkOut');
    expect(nextAction(derivePunchState(status('a', 'b', true)))).toBe('resume');
    expect(nextAction(derivePunchState(status('a', 'b', false)))).toBeNull();
  });

  it('recognises a missed punch-out', () => {
    const s = status('a', 'b');
    s.data.Out_Data!.address = 'Missed Punch Out';
    expect(derivePunchState(s).kind).toBe('missedPunchOut');
  });
});

describe('performPunch', () => {
  it('check-in success reports the server message', async () => {
    const d = deps();
    const r = await performPunch('checkIn', caps, status(null, null), d);
    expect(r).toEqual({ result: 'accepted', message: 'PunchIn successfully.' });
    expect(d.api.punch).toHaveBeenCalledWith(expect.objectContaining({ latitude: '23.0225', longitude: '72.5714' }));
  });

  it('blocks when location is denied and the policy requires the geofence', async () => {
    const d = deps(
      {},
      {
        getFix: jest.fn(async () =>
          Promise.reject(new LocationError('denied', 'Location permission is required to mark attendance.')),
        ),
      },
    );
    const r = await performPunch('checkIn', caps, undefined, d);
    expect(r).toEqual({ result: 'rejected', message: 'Location permission is required to mark attendance.' });
    expect(d.api.punch).not.toHaveBeenCalled();
  });

  it('sends empty coordinates when outside punches are allowed and location fails', async () => {
    const d = deps({}, { getFix: jest.fn(async () => Promise.reject(new LocationError('timeout', 't'))) });
    await performPunch('checkIn', { ...caps, outsideAllowed: true }, undefined, d);
    expect(d.api.punch).toHaveBeenCalledWith(expect.objectContaining({ latitude: '', longitude: '' }));
  });

  it('captures a selfie when policy requires and cancels if the user backs out', async () => {
    const d = deps({}, { captureSelfie: jest.fn(async () => null) });
    expect(await performPunch('checkIn', { ...caps, selfieRequired: true }, undefined, d)).toEqual({
      result: 'cancelled',
    });
    expect(d.api.punch).not.toHaveBeenCalled();
  });

  it('blocks when the face check fails', async () => {
    const d = deps({ faceCheck: jest.fn(async () => Promise.reject(new ApiError('business', 'Face not matched'))) });
    const r = await performPunch('checkIn', { ...caps, faceCheckRequired: true }, undefined, d);
    expect(r).toEqual({ result: 'rejected', message: 'Face not matched' });
  });

  it('shows the server rejection (geofence)', async () => {
    const d = deps({
      punch: jest.fn(async () => Promise.reject(new ApiError('business', 'You are not in attendance area.'))),
    });
    expect(await performPunch('checkIn', caps, undefined, d)).toEqual({
      result: 'rejected',
      message: 'You are not in attendance area.',
    });
  });

  it('timeout: confirms with the server that the check-in was recorded', async () => {
    const d = deps({
      punch: jest.fn(async () => Promise.reject(new ApiError('timeout', ''))),
      todayStatus: jest.fn(async () => status('2026-09-23T09:00:00+05:30', null)),
    });
    const r = await performPunch('checkIn', caps, status(null, null), d);
    expect(r.result).toBe('accepted');
  });

  it('network failure: reports not recorded when the status did not change', async () => {
    const d = deps({ punch: jest.fn(async () => Promise.reject(new ApiError('network', ''))) });
    expect((await performPunch('checkIn', caps, status(null, null), d)).result).toBe('rejected');
  });

  it('network failure and status unavailable: reports unconfirmed, never success', async () => {
    const d = deps({
      punch: jest.fn(async () => Promise.reject(new ApiError('network', ''))),
      todayStatus: jest.fn(async () => Promise.reject(new ApiError('network', ''))),
    });
    expect((await performPunch('checkOut', caps, status('a', null), d)).result).toBe('unconfirmed');
  });
});

describe('regularization payload', () => {
  it('builds logs and reuses shift/log ids from existing punches', () => {
    const logs = buildCorrectionLogs({ date: '2026-09-20', inTime: '09:05', outTime: 'bad' }, [
      { direction: 'in', logId: 55, shiftID: 3, attendanceStatus: 1 },
    ]);
    expect(logs).toEqual([
      {
        logDateTime: '2026-09-20T09:05:00+05:30',
        direction: 'in',
        attendanceStatus: 1,
        isChangeLog: true,
        shiftID: 3,
        logId: 55,
      },
    ]);
  });
});
