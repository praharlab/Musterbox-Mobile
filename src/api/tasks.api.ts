import { api } from './index';
import { EP } from './endpoints';
import type { LegacyEnvelope } from './envelope';
import { legacyPageParams, toPage } from './pagination';
import { requireIdentity } from '../auth/identity';
import type { TaskCounts, TaskRow } from '../types/api';

/** taskStatus: 0 pending, 1 accepted, 2 rejected, 3 completed. */
export const TASK_STATUS_LABEL: Record<number, string> = {
  0: 'Pending',
  1: 'Accepted',
  2: 'Rejected',
  3: 'Completed',
};

export const tasksApi = {
  async mine(page: number, taskstatus?: number) {
    const { userMasterID } = requireIdentity();
    const body = await api.post<LegacyEnvelope<TaskRow[]>>(EP.tasks.mine, {
      userMasterID,
      ...(taskstatus === undefined ? {} : { taskstatus }),
      ...legacyPageParams(page),
    });
    return toPage(body.data, page, body.totalcount);
  },

  counts(start: string, end: string) {
    const { userMasterID } = requireIdentity();
    return api.post<LegacyEnvelope<TaskCounts>>(EP.tasks.counts, { userMasterID, startDate: start, endDate: end });
  },

  /** status 1 accept, 2 reject. Server does not check the assignee; the list only contains my tasks. */
  respond(taskId: number, accept: boolean) {
    return api.post<LegacyEnvelope<unknown>>(EP.tasks.acceptReject, { user_TasksID: taskId, status: accept ? 1 : 2 });
  },
};
