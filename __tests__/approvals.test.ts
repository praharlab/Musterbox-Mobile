import { APPROVAL_ADAPTERS, isApproverResponse } from '../src/api/approvals';
import { buildLeaveTransactions } from '../src/api/approvals/leave.adapter';
import { setupApi } from './support/helpers';

const leaveRow = {
  AuthorizationRequestId: 7702,
  ReferenceID: 9001,
  authstatus: 2,
  createdAt: '2026-09-23T10:15:00+05:30',
  userLeave: {
    UserLeaveApplicationID: 9001,
    FromDate: '2026-10-05',
    ToDate: '2026-10-06',
    LeaveDays: 2,
    Remark: 'Family function',
    userMaster: { displayName: 'Asha Patel', password: '$2b$10$hash' },
    hrLeaveType: { LeaveMaster: { LeaveName: 'Casual Leave' } },
  },
};

describe('leave approvals', () => {
  it('lists pending requests for the signed-in approver (status 2) and never exposes extra fields', async () => {
    const { mock } = setupApi();
    mock
      .onPost('leaveauthorizationRequest/v2/listLeaveAuthRequestNew')
      .reply(200, { status: 200, totalcount: 1, data: [leaveRow] });
    const page = await APPROVAL_ADAPTERS.leave.list(1);
    expect(JSON.parse(mock.history.post[0].data)).toMatchObject({ userMasterID: 345, status: 2, page: 1, limit: 20 });
    expect(page.items[0]).toMatchObject({ requesterName: 'Asha Patel', title: 'Casual Leave', decidable: true });
    expect(JSON.stringify(page.items[0])).not.toContain('$2b$');
  });

  it('approve: builds leavetransaction from leavedetails and posts the decision', async () => {
    const { mock } = setupApi();
    mock.onPost('leaveauthorizationRequest/v2/listLeaveAuthRequestNew').reply(200, { status: 200, data: [leaveRow] });
    mock.onGet('leaveauthorizationRequest/v1/leavedetails/9001').reply(200, {
      status: 200,
      data: {
        finaldate: ['2026-10-05', '2026-10-06'],
        sandwichdate: [],
        leavedata: { userMasterID: 345, LeaveTranId: 81, FromDate: '2026-10-05', ToDate: '2026-10-06', LeaveDays: 2 },
      },
    });
    mock.onPost('leaveauthorizationRequest/v1/authorizationacceptreject').reply(200, { status: 200, data: {} });
    const [item] = (await APPROVAL_ADAPTERS.leave.list(1)).items;
    await APPROVAL_ADAPTERS.leave.decide(item, true, '');
    const body = JSON.parse(mock.history.post[1].data);
    expect(body).toMatchObject({ AuthorizationRequestId: 7702, ReferenceID: 9001, authstatus: 1 });
    expect(body.leavetransaction).toHaveLength(2);
    expect(body.leavetransaction[0]).toEqual({
      ReferenceID: 9001,
      userMasterID: 345,
      LeaveTranId: 81,
      days: 1,
      date: '2026-10-05',
      issandwichleave: 'No',
    });
  });

  it('reject: sends remarks and no breakdown', async () => {
    const { mock } = setupApi();
    mock.onPost('leaveauthorizationRequest/v2/listLeaveAuthRequestNew').reply(200, { status: 200, data: [leaveRow] });
    mock.onPost('leaveauthorizationRequest/v1/authorizationacceptreject').reply(200, { status: 200 });
    const [item] = (await APPROVAL_ADAPTERS.leave.list(1)).items;
    await APPROVAL_ADAPTERS.leave.decide(item, false, 'Quarter-end freeze');
    const body = JSON.parse(mock.history.post[1].data);
    expect(body).toEqual({
      AuthorizationRequestId: 7702,
      ReferenceID: 9001,
      authstatus: 0,
      rejectionRemarks: 'Quarter-end freeze',
    });
    expect(mock.history.get).toHaveLength(0);
  });

  it('refuses to guess a breakdown for half days', () => {
    expect(() =>
      buildLeaveTransactions(1, {
        leavedata: { userMasterID: 1, LeaveTranId: 2, FromDate: '2026-10-05', ToDate: '2026-10-05', LeaveDays: 0.5 },
      }),
    ).toThrow(/approve this request on the web/);
  });

  it('marks sandwich days', () => {
    const rows = buildLeaveTransactions(1, {
      finaldate: [{ date: '2026-10-09' }, { date: '2026-10-10' }],
      sandwichdate: ['2026-10-10'],
      leavedata: [{ userMasterID: 1, LeaveTranId: 2 }],
    });
    expect(rows.map(r => r.issandwichleave)).toEqual(['No', 'Yes']);
  });
});

describe('other approval modules', () => {
  it('regularization rows missing IDs are shown read-only', async () => {
    const { mock } = setupApi();
    mock.onPost('attendanceCorrectionAuthorization/listAttendaceAuthorization').reply(200, {
      status: 200,
      data: [{ remark: 'forgot', userMaster: { displayName: 'Ravi' } }],
    });
    const [item] = (await APPROVAL_ADAPTERS.regularization.list(1)).items;
    expect(item.decidable).toBe(false);
    await expect(APPROVAL_ADAPTERS.regularization.decide(item, true, '')).rejects.toMatchObject({
      kind: 'clientGuard',
    });
  });

  it('expense decision uses the documented newArray shape', async () => {
    const { mock } = setupApi();
    mock.onPost('authorizationRequest/v3/getExpenseAuthByUser').reply(200, {
      status: 200,
      data: [{ userexpensetransactionid: 5, authorizationrequestid: 6, expenseAmount: 100 }],
    });
    mock.onPost('authorizationRequest/v1/authorizationacceptrejectexpenseall').reply(200, { status: 200 });
    const [item] = (await APPROVAL_ADAPTERS.expense.list(1)).items;
    await APPROVAL_ADAPTERS.expense.decide(item, false, 'No receipt');
    expect(JSON.parse(mock.history.post[1].data)).toEqual({
      authstatus: 0,
      newArray: [{ userexpensetransactionid: 5, authorizationrequestid: 6, remarks: 'No receipt' }],
    });
  });

  it('interprets the approver probe', () => {
    expect(isApproverResponse([])).toBe(false);
    expect(isApproverResponse({ leave: 0, expense: 0 })).toBe(false);
    expect(isApproverResponse({ leave: 2 })).toBe(true);
    expect(isApproverResponse([{ id: 1 }])).toBe(true);
  });
});
