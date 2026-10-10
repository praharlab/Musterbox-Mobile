import { api } from '../index';
import { EP } from '../endpoints';
import type { LegacyEnvelope } from '../envelope';
import { ApiError } from '../errors';
import { legacyPageParams, toPage } from '../pagination';
import { requireIdentity } from '../../auth/identity';
import { asArray, pickNumber, pickPath, pickString } from '../../utils/pick';
import { eachDate, formatDate } from '../../utils/dates';
import type { ApprovalAdapter, ApprovalItem } from './types';

export interface LeaveTransactionRow {
  ReferenceID: number;
  userMasterID: number;
  LeaveTranId: number;
  days: number;
  date: string;
  issandwichleave: 'Yes' | 'No';
}

/**
 * Builds `leavetransaction[]` for an approval from GET leavedetails/:id
 * ({finaldate, leavebalance, sandwichdate, leavedata}).
 *
 * The inventory documents only the top-level keys, so this accepts the plausible
 * encodings (dates as strings or {date, days}) and refuses to guess otherwise.
 * VERIFY against the web client before enabling decisions in production.
 */
export function buildLeaveTransactions(referenceId: number, details: unknown): LeaveTransactionRow[] {
  const d = (details ?? {}) as Record<string, unknown>;
  const leave = (Array.isArray(d.leavedata) ? d.leavedata[0] : d.leavedata) as Record<string, unknown> | undefined;
  const userMasterID = pickNumber(leave, ['userMasterID', 'userMasterId']);
  const leaveTranId = pickNumber(leave, ['LeaveTranId', 'leaveTranId']);
  if (!userMasterID || !leaveTranId) {
    throw new ApiError('business', 'Leave details are incomplete. Please approve this request on the web.');
  }

  const sandwich = new Set(
    asArray(d.sandwichdate)
      .map(s => (typeof s === 'string' ? s : pickString(s, ['date'])))
      .filter(Boolean)
      .map(s => String(s).slice(0, 10)),
  );

  let entries: Array<{ date: string; days: number }> = asArray(d.finaldate)
    .map(e => {
      if (typeof e === 'string') {
        return { date: e.slice(0, 10), days: 1 };
      }
      const date = pickString(e, ['date', 'Date', 'leaveDate']);
      return date ? { date: date.slice(0, 10), days: pickNumber(e, ['days', 'day', 'LeaveDays']) ?? 1 } : null;
    })
    .filter((e): e is { date: string; days: number } => !!e);

  if (entries.length === 0) {
    const from = pickString(leave, ['FromDate']);
    const to = pickString(leave, ['ToDate']);
    const total = pickNumber(leave, ['LeaveDays']);
    const dates = from && to ? eachDate(from.slice(0, 10), to.slice(0, 10)) : [];
    // Only safe when the requested days equal the calendar span (no half days, no exclusions).
    if (dates.length === 0 || total !== dates.length) {
      throw new ApiError('business', 'Could not prepare the day breakdown. Please approve this request on the web.');
    }
    entries = dates.map(date => ({ date, days: 1 }));
  }

  return entries.map(e => ({
    ReferenceID: referenceId,
    userMasterID,
    LeaveTranId: leaveTranId,
    days: e.days,
    date: e.date,
    issandwichleave: sandwich.has(e.date) ? 'Yes' : 'No',
  }));
}

function toItem(row: Record<string, unknown>): ApprovalItem {
  const authorizationRequestId = pickNumber(row, ['AuthorizationRequestId']);
  const referenceId = pickNumber(row, ['ReferenceID']);
  const leave = pickPath(row, ['userLeave']);
  const name = pickString(pickPath(leave, ['userMaster']), ['displayName']) ?? 'Employee';
  const leaveName = pickString(pickPath(leave, ['hrLeaveType', 'LeaveMaster']), ['LeaveName']) ?? 'Leave';
  const from = pickString(leave, ['FromDate']);
  const to = pickString(leave, ['ToDate']);
  const days = pickString(leave, ['LeaveDays']);
  const decidable = !!authorizationRequestId && !!referenceId;
  return {
    key: `leave-${authorizationRequestId ?? referenceId}`,
    module: 'leave',
    requesterName: name,
    title: leaveName,
    subtitle: `${formatDate(from)} – ${formatDate(to)}${days ? ` · ${days} day(s)` : ''}`,
    createdAt: pickString(row, ['createdAt']),
    details: [
      { label: 'Leave type', value: leaveName },
      { label: 'From', value: formatDate(from) },
      { label: 'To', value: formatDate(to) },
      { label: 'Days', value: days ?? '—' },
      { label: 'Reason', value: pickString(leave, ['Remark']) ?? '—' },
    ],
    decidable,
    notDecidableReason: decidable ? undefined : 'Request identifiers missing.',
    ids: { authorizationRequestId, referenceId },
  };
}

export const leaveApprovals: ApprovalAdapter = {
  module: 'leave',
  label: 'Leave',
  async list(page) {
    const { userMasterID } = requireIdentity();
    const body = await api.post<LegacyEnvelope<Array<Record<string, unknown>>>>(EP.approvals.leaveList, {
      userMasterID,
      status: 2,
      ...legacyPageParams(page),
      startdate: '',
      enddate: '',
      user: [],
    });
    return toPage(asArray<Record<string, unknown>>(body.data).map(toItem), page, body.totalcount);
  },
  async decide(item, approve, remarks) {
    const { authorizationRequestId, referenceId } = item.ids;
    if (!authorizationRequestId || !referenceId) {
      throw new ApiError('clientGuard', 'This request cannot be decided from the app.');
    }
    const body: Record<string, unknown> = {
      AuthorizationRequestId: authorizationRequestId,
      ReferenceID: referenceId,
      authstatus: approve ? 1 : 0,
      rejectionRemarks: remarks,
    };
    if (approve) {
      const details = await api.get<LegacyEnvelope<unknown>>(EP.approvals.leaveDetails(referenceId));
      body.leavetransaction = buildLeaveTransactions(referenceId, details.data);
    }
    await api.post(EP.approvals.leaveDecide, body);
  },
};
