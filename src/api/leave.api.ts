import { api } from './index';
import { EP } from './endpoints';
import type { LegacyEnvelope } from './envelope';
import { legacyPageParams, toPage } from './pagination';
import { requireIdentity, Identity } from '../auth/identity';
import type { LeaveApplication, LeaveApprovers, LeaveBalanceRow } from '../types/api';

export interface LocalFile {
  uri: string;
  name: string;
  type: string;
  size?: number | null;
}

export interface ApplyLeaveInput {
  leaveTranId: number;
  fromDate: string;
  toDate: string;
  leaveDays: number;
  /** Only "Full Day" is sent until the half-day DayType values are confirmed (BACKEND_GAPS). */
  dayType: 'Full Day';
  remark: string;
  attachment?: LocalFile;
}

export const LEAVE_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
export const LEAVE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Multipart body for /userleave/v2/bulk/add with indexed keys (suffix 0 = first leave).
 * The server's permission check skips multipart bodies, so identity here is taken from
 * the session and nowhere else.
 */
export function buildApplyLeaveForm(input: ApplyLeaveInput, identity: Identity): FormData {
  const form = new FormData();
  const i = 0;
  form.append(`LeaveTranId${i}`, String(input.leaveTranId));
  form.append(`userMasterID${i}`, String(identity.userMasterID));
  form.append(`companyMasterID${i}`, String(identity.companyMasterID));
  form.append(`FromDate${i}`, input.fromDate);
  form.append(`ToDate${i}`, input.toDate);
  form.append(`LeaveDays${i}`, String(input.leaveDays));
  form.append(`DayType${i}`, input.dayType);
  form.append(`Remark${i}`, input.remark);
  form.append(`isattachment${i}`, input.attachment ? 'yes' : 'no');
  form.append(`createByIp${i}`, '');
  if (input.attachment) {
    form.append('attachment', {
      uri: input.attachment.uri,
      name: input.attachment.name,
      type: input.attachment.type,
    } as unknown as Blob);
  }
  return form;
}

/** Pending states in which the employee may still withdraw the request. */
export function isWithdrawable(leave: Pick<LeaveApplication, 'authorizationStatus'>): boolean {
  return [0, 1, 2].includes(Number(leave.authorizationStatus));
}

export const leaveApi = {
  balance() {
    const { userMasterID, companyMasterID } = requireIdentity();
    return api.get<LegacyEnvelope<LeaveBalanceRow[]>>(EP.leave.balance, { companyMasterID, userMasterID });
  },

  apply(input: ApplyLeaveInput) {
    return api.postMultipart<LegacyEnvelope<unknown>>(EP.leave.apply, buildApplyLeaveForm(input, requireIdentity()));
  },

  async history(page: number, start: string, end: string) {
    const { userMasterID } = requireIdentity();
    const body = await api.post<LegacyEnvelope<LeaveApplication[]>>(EP.leave.history, {
      userMasterID,
      ...legacyPageParams(page),
      startdate: start,
      enddate: end,
      searchQuery: '',
    });
    return toPage(body.data, page, body.totalcount);
  },

  /** GET with a side effect; the server has no owner/status guard, so the UI only offers it for own pending leave. */
  withdraw(leave: LeaveApplication) {
    if (!isWithdrawable(leave)) {
      throw new Error('Only pending leave can be withdrawn.');
    }
    return api.get<LegacyEnvelope<unknown>>(EP.leave.withdraw(leave.UserLeaveApplicationID));
  },

  myApprovers() {
    const { userMasterID } = requireIdentity();
    return api.get<LegacyEnvelope<LeaveApprovers>>(EP.leave.myApprovers(userMasterID));
  },
};
