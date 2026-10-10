import { api } from './index';
import { EP } from './endpoints';
import { legacyPageParams, toPage } from './pagination';
import { requireIdentity } from '../auth/identity';
import type { TeamBody } from '../types/api';

export const teamApi = {
  /** Direct reports with attendance for `date`. Always queried for the signed-in manager. */
  async directReports(input: { page: number; date: string; search?: string; limit?: number }) {
    const { userMasterID } = requireIdentity();
    const body = await api.get<TeamBody>(EP.team.immediateChildren, {
      userMasterID,
      date: input.date,
      search: input.search ?? '',
      ...legacyPageParams(input.page, input.limit),
    });
    const child = Array.isArray(body.data?.child) ? body.data.child : [];
    return toPage(child, input.page, body.childCount ?? body.totalcount);
  },

  /** Capability probe: does anyone report to me? */
  async hasDirectReports(date: string): Promise<boolean> {
    const page = await teamApi.directReports({ page: 1, limit: 1, date });
    return page.items.length > 0;
  },
};
