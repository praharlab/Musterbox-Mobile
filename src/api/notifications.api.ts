import { api } from './index';
import { EP } from './endpoints';
import type { LegacyEnvelope } from './envelope';
import { legacyPageParams, toPage } from './pagination';
import { requireIdentity } from '../auth/identity';
import type { AnnouncementRow, InboxItem } from '../types/api';

export const notificationsApi = {
  /** Token-scoped action inbox. Rows disappear when the request is decided; no read state (GAP P1-4). */
  async inbox(page: number) {
    const body = await api.get<LegacyEnvelope<InboxItem[]>>(EP.notifications.inbox, legacyPageParams(page));
    return toPage(body.data, page, body.totalcount);
  },

  /** Side effect: the server marks ALL unread announcements as read when this is fetched. */
  async announcements(page: number) {
    const { userMasterID } = requireIdentity();
    const body = await api.post<LegacyEnvelope<AnnouncementRow[]>>(EP.notifications.announcements, {
      userMasterID,
      ...legacyPageParams(page),
    });
    return toPage(body.data, page, body.totalcount);
  },

  async unreadAnnouncements(): Promise<number> {
    const { userMasterID } = requireIdentity();
    const body = await api.post<LegacyEnvelope<number>>(EP.notifications.unreadAnnouncements, { userMasterID });
    return Number(body.data) || 0;
  },
};
