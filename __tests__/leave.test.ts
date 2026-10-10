import { buildApplyLeaveForm, isWithdrawable, leaveApi } from '../src/api/leave.api';
import { validateLeave } from '../src/features/leave/ApplyLeaveScreen';
import type { LeaveApplication } from '../src/types/api';
import { EMPLOYEE, setupApi } from './support/helpers';

function formEntries(form: FormData): Record<string, unknown> {
  // RN's FormData keeps parts in `_parts`.
  return Object.fromEntries((form as unknown as { _parts: Array<[string, unknown]> })._parts);
}

const base = {
  leaveTranId: 81,
  fromDate: '2026-10-05',
  toDate: '2026-10-06',
  leaveDays: 2,
  dayType: 'Full Day' as const,
  remark: 'Family function',
};

describe('leave submission', () => {
  it('builds indexed multipart keys with identity from the session', () => {
    const parts = formEntries(buildApplyLeaveForm(base, EMPLOYEE));
    expect(parts).toMatchObject({
      LeaveTranId0: '81',
      userMasterID0: '345',
      companyMasterID0: '12',
      FromDate0: '2026-10-05',
      ToDate0: '2026-10-06',
      LeaveDays0: '2',
      DayType0: 'Full Day',
      Remark0: 'Family function',
      isattachment0: 'no',
      createByIp0: '',
    });
    expect(parts).not.toHaveProperty('attachment');
  });

  it('adds the attachment and flags it', () => {
    const parts = formEntries(
      buildApplyLeaveForm(
        { ...base, attachment: { uri: 'file:///x.pdf', name: 'x.pdf', type: 'application/pdf' } },
        EMPLOYEE,
      ),
    );
    expect(parts.isattachment0).toBe('yes');
    expect(parts.attachment).toMatchObject({ name: 'x.pdf', type: 'application/pdf' });
  });

  it('posts multipart to the live apply endpoint', async () => {
    const { mock } = setupApi();
    mock.onPost('userleave/v2/bulk/add').reply(200, { status: 200, message: 'Leave applied' });
    const res = await leaveApi.apply(base);
    expect(res.message).toBe('Leave applied');
    expect(mock.history.post[0].headers?.['Content-Type']).toContain('multipart/form-data');
  });

  it('surfaces policy errors from the server', async () => {
    const { mock } = setupApi();
    mock.onPost('userleave/v2/bulk/add').reply(200, { status: 401, message: 'Insufficient leave balance' });
    await expect(leaveApi.apply(base)).rejects.toMatchObject({
      kind: 'business',
      message: 'Insufficient leave balance',
    });
  });

  it('validates input before sending', () => {
    expect(validateLeave({ ...base, leaveTranId: undefined })).toBe('Select a leave type.');
    expect(validateLeave({ ...base, toDate: '2026-10-01' })).toMatch(/end date/);
    expect(validateLeave({ ...base, remark: ' ' })).toMatch(/reason/);
    expect(validateLeave(base, 1)).toMatch(/only 1 day/);
    expect(
      validateLeave({ ...base, attachment: { uri: 'u', name: 'a.exe', type: 'application/x-msdownload' } }),
    ).toMatch(/JPG, PNG or PDF/);
    expect(
      validateLeave({
        ...base,
        attachment: { uri: 'u', name: 'a.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 },
      }),
    ).toMatch(/10 MB/);
    expect(validateLeave(base, 5)).toBeUndefined();
  });
});

describe('leave withdraw', () => {
  const leave = (authorizationStatus: number) =>
    ({ UserLeaveApplicationID: 9001, FromDate: '', ToDate: '', LeaveDays: 1, authorizationStatus } as LeaveApplication);

  it('only pending leave is withdrawable', () => {
    expect([0, 1, 2].map(s => isWithdrawable(leave(s)))).toEqual([true, true, true]);
    expect([3, 4, 5].map(s => isWithdrawable(leave(s)))).toEqual([false, false, false]);
  });

  it('refuses to call the server for approved leave', () => {
    expect(() => leaveApi.withdraw(leave(3))).toThrow();
  });

  it('history sends page+limit (both are required) and the session user', async () => {
    const { mock } = setupApi();
    mock.onPost('userleave/v2/LeaveByUser').reply(200, { status: 200, totalcount: 1, data: [leave(2)] });
    const page = await leaveApi.history(1, '2026-01-01', '2026-12-31');
    expect(JSON.parse(mock.history.post[0].data)).toMatchObject({ userMasterID: 345, page: 1, limit: 20 });
    expect(page).toMatchObject({ page: 1, total: 1 });
  });
});
