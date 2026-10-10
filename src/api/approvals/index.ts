import { api } from '../index';
import { EP } from '../endpoints';
import type { LegacyEnvelope } from '../envelope';
import { requireIdentity } from '../../auth/identity';
import type { PendingCounts } from '../../types/api';
import { leaveApprovals } from './leave.adapter';
import { expenseApprovals, overtimeApprovals, regularizationApprovals } from './other.adapters';
import type { ApprovalAdapter, ApprovalModule } from './types';

export * from './types';

export const APPROVAL_ADAPTERS: Record<ApprovalModule, ApprovalAdapter> = {
  leave: leaveApprovals,
  regularization: regularizationApprovals,
  overtime: overtimeApprovals,
  expense: expenseApprovals,
};

export const APPROVAL_MODULE_ORDER: ApprovalModule[] = ['leave', 'regularization', 'overtime', 'expense'];

/**
 * Interprets the (undocumented) getAuthList response: any non-empty array or any
 * positive count means the user is configured as an approver somewhere.
 */
export function isApproverResponse(data: unknown): boolean {
  if (Array.isArray(data)) {
    return data.length > 0;
  }
  if (typeof data === 'number') {
    return data > 0;
  }
  if (data && typeof data === 'object') {
    return Object.values(data as Record<string, unknown>).some(v => isApproverResponse(v));
  }
  return false;
}

export const approvalsApi = {
  async isApprover(): Promise<boolean> {
    const { userMasterID } = requireIdentity();
    const body = await api.post<LegacyEnvelope<unknown>>(EP.approvals.authList, { userMasterID });
    return isApproverResponse(body.data);
  },

  pendingCounts() {
    const { userMasterID } = requireIdentity();
    return api.post<LegacyEnvelope<PendingCounts>>(EP.approvals.pendingCounts, { userMasterID });
  },
};
