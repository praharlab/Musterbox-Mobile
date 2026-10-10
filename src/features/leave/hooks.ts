import { useQuery } from '@tanstack/react-query';
import { leaveApi } from '../../api/leave.api';
import { qk, usePaginated } from '../../hooks/queries';
import { currentYearMonth } from '../../utils/dates';

export function useLeaveBalance() {
  return useQuery({ queryKey: qk('leave', 'balance'), queryFn: async () => (await leaveApi.balance()).data ?? [] });
}

/** Financial-year-ish window: 12 months back to 12 months ahead (leave can be future-dated). */
export function historyWindow() {
  const { year } = currentYearMonth();
  return { start: `${year - 1}-01-01`, end: `${year + 1}-12-31` };
}

export function useLeaveHistory(enabled = true) {
  const w = historyWindow();
  return usePaginated(['leave', 'history', w.start], page => leaveApi.history(page, w.start, w.end), enabled);
}

export function useMyApprovers() {
  return useQuery({ queryKey: qk('leave', 'approvers'), queryFn: async () => (await leaveApi.myApprovers()).data });
}
