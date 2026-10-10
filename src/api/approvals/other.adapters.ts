import { api } from '../index';
import { EP } from '../endpoints';
import type { LegacyEnvelope } from '../envelope';
import { ApiError } from '../errors';
import { legacyPageParams, toPage } from '../pagination';
import { requireIdentity } from '../../auth/identity';
import { asArray, pickNumber, pickPath, pickString } from '../../utils/pick';
import { formatDate } from '../../utils/dates';
import type { ApprovalAdapter, ApprovalItem, ApprovalModule } from './types';

/*
 * The inventory documents the request bodies for these modules but not the list row
 * shapes. Rows are read through whitelisted candidate keys; when the IDs needed for a
 * decision are absent the item is shown read-only with "decide on web".
 */

type Row = Record<string, unknown>;

function requesterName(row: Row): string {
  return (
    pickString(pickPath(row, ['userMaster']), ['displayName', 'userName']) ??
    pickString(pickPath(row, ['employee']), ['displayName']) ??
    pickString(row, ['displayName', 'userName', 'employeeName']) ??
    'Employee'
  );
}

function makeItem(
  module: ApprovalModule,
  row: Row,
  ids: Record<string, number | undefined>,
  required: string[],
  title: string,
  details: Array<{ label: string; value: string | undefined }>,
): ApprovalItem {
  const missing = required.filter(k => !ids[k]);
  return {
    key: `${module}-${Object.values(ids).join('-')}`,
    module,
    requesterName: requesterName(row),
    title,
    subtitle: details.find(d => d.value)?.value,
    createdAt: pickString(row, ['createdAt']),
    details: details.map(d => ({ label: d.label, value: d.value ?? '—' })),
    decidable: missing.length === 0,
    notDecidableReason: missing.length ? 'Required identifiers are missing from the server response.' : undefined,
    ids,
  };
}

function need(item: ApprovalItem, keys: string[]): void {
  if (!item.decidable || keys.some(k => !item.ids[k])) {
    throw new ApiError('clientGuard', 'This request cannot be decided from the app. Please use the web.');
  }
}

// ---------------- Attendance regularization ----------------
export const regularizationApprovals: ApprovalAdapter = {
  module: 'regularization',
  label: 'Regularization',
  async list(page) {
    const { userMasterID } = requireIdentity();
    const body = await api.post<LegacyEnvelope<Row[]>>(EP.approvals.regularizationList, {
      ...legacyPageParams(page),
      startdate: '',
      enddate: '',
      userMasterID,
      user: [],
      status: 2,
    });
    const items = asArray<Row>(body.data).map(row => {
      const request = (pickPath(row, ['attendanceCorrectionRequest']) as Row | undefined) ?? row;
      return makeItem(
        'regularization',
        row,
        {
          id: pickNumber(row, ['id', 'attendanceCorrectionAuthorizationID', 'attendanceCorrectionAuthorizationId']),
          attendanceCorrectionRequestId: pickNumber(row, [
            'attendanceCorrectionRequestId',
            'attendanceCorrectionRequestID',
          ]),
        },
        ['id', 'attendanceCorrectionRequestId'],
        'Attendance regularization',
        [
          { label: 'Date', value: formatDate(pickString(request, ['AttendanceDate', 'attendanceDate'])) },
          { label: 'Remark', value: pickString(request, ['remark', 'remarks']) },
        ],
      );
    });
    return toPage(items, page, body.totalcount);
  },
  async decide(item, approve, remarks) {
    need(item, ['id', 'attendanceCorrectionRequestId']);
    const { userMasterID } = requireIdentity();
    await api.post(EP.approvals.regularizationDecide, {
      id: item.ids.id,
      remarks,
      authstatus: approve ? 1 : 0,
      attendanceCorrectionRequestId: item.ids.attendanceCorrectionRequestId,
      userMasterID,
    });
  },
};

// ---------------- Overtime ----------------
export const overtimeApprovals: ApprovalAdapter = {
  module: 'overtime',
  label: 'Overtime',
  async list(page) {
    const { userMasterID } = requireIdentity();
    // Documented request is only {authuser}; the endpoint is not paginated.
    const body = await api.post<LegacyEnvelope<Row[]>>(EP.approvals.overtimeList, { authuser: userMasterID });
    const all = asArray<Row>(body.data).map(row =>
      makeItem(
        'overtime',
        row,
        {
          authorizationRequestId: pickNumber(row, ['AuthorizationRequestId', 'authorizationRequestId']),
          referenceId: pickNumber(row, ['ReferenceID', 'referenceId']),
        },
        ['authorizationRequestId', 'referenceId'],
        'Overtime',
        [
          { label: 'Date', value: formatDate(pickString(row, ['date', 'AttendanceDate', 'otDate'])) },
          { label: 'Hours', value: pickString(row, ['otHours', 'hours', 'OTHours']) },
        ],
      ),
    );
    return toPage(page === 1 ? all : [], page, all.length);
  },
  async decide(item, approve, remarks) {
    need(item, ['authorizationRequestId', 'referenceId']);
    const { userMasterID } = requireIdentity();
    await api.post(EP.approvals.overtimeDecide, {
      AuthorizationRequestId: item.ids.authorizationRequestId,
      ReferenceID: item.ids.referenceId,
      authstatus: approve ? 1 : 0,
      remarks,
      createBy: userMasterID,
    });
  },
};

// ---------------- Expense ----------------
export const expenseApprovals: ApprovalAdapter = {
  module: 'expense',
  label: 'Expense',
  async list(page) {
    const { userMasterID } = requireIdentity();
    const body = await api.post<LegacyEnvelope<Row[]>>(EP.approvals.expenseList, {
      userMasterID,
      ...legacyPageParams(page),
    });
    const items = asArray<Row>(body.data).map(row =>
      makeItem(
        'expense',
        row,
        {
          userexpensetransactionid: pickNumber(row, [
            'userexpensetransactionid',
            'userExpenseTransactionID',
            'userExpenseTransactionId',
          ]),
          authorizationrequestid: pickNumber(row, [
            'authorizationrequestid',
            'AuthorizationRequestId',
            'authorizationRequestId',
          ]),
        },
        ['userexpensetransactionid', 'authorizationrequestid'],
        'Expense claim',
        [
          { label: 'Date', value: formatDate(pickString(row, ['expense_date', 'expenseDate'])) },
          { label: 'Amount', value: pickString(row, ['expenseAmount', 'amount']) },
          { label: 'Description', value: pickString(row, ['description']) },
        ],
      ),
    );
    return toPage(items, page, body.totalcount);
  },
  async decide(item, approve, remarks) {
    need(item, ['userexpensetransactionid', 'authorizationrequestid']);
    // Actor is taken from the token by this endpoint.
    await api.post(EP.approvals.expenseDecide, {
      authstatus: approve ? 1 : 0,
      newArray: [
        {
          userexpensetransactionid: item.ids.userexpensetransactionid,
          authorizationrequestid: item.ids.authorizationrequestid,
          remarks,
        },
      ],
    });
  },
};
