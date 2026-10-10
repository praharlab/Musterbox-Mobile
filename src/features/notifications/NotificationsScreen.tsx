import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRoute } from '@react-navigation/native';
import { notificationsApi } from '../../api/notifications.api';
import { useSession } from '../../auth/AuthProvider';
import { PagedList } from '../../components/PagedList';
import { Badge, Banner, ListItem, Segmented } from '../../components/ui';
import { qk, usePaginated } from '../../hooks/queries';
import { routeForInboxActivity } from '../../notifications/screenRouter';
import { useAppNavigation } from '../../navigation/types';
import { colors, spacing } from '../../theme';
import { formatDate } from '../../utils/dates';
import { pickNumber, pickString } from '../../utils/pick';
import type { AnnouncementRow, InboxItem } from '../../types/api';

type Segment = 'inbox' | 'announcements';

export function NotificationsScreen() {
  const route = useRoute();
  const initial = (route.params as { segment?: Segment } | undefined)?.segment ?? 'inbox';
  const [segment, setSegment] = useState<Segment>(initial);
  return (
    <View style={styles.flex}>
      <View style={styles.bar}>
        <Segmented
          value={segment}
          onChange={setSegment}
          options={[
            { value: 'inbox', label: 'Action items' },
            { value: 'announcements', label: 'Announcements' },
          ]}
        />
      </View>
      {segment === 'inbox' ? <InboxList /> : <AnnouncementList />}
    </View>
  );
}

function InboxList() {
  const nav = useAppNavigation();
  const { capabilities } = useSession();
  const list = usePaginated<InboxItem>(['notifications', 'inbox'], page => notificationsApi.inbox(page));
  return (
    <PagedList
      query={list}
      keyOf={i => String(i.id)}
      emptyTitle="You're all caught up"
      emptyMessage="Requests that need your attention appear here."
      header={<Banner tone="neutral" message="Items leave this list once the request is decided." />}
      renderItem={({ item }) => {
        const target = routeForInboxActivity(item.activityTable, capabilities.mode);
        const navigable = target.name !== 'HomeTab';
        return (
          <ListItem
            title={item.message}
            subtitle={formatDate(item.createdAt)}
            right={<Badge label="Pending" tone="info" />}
            onPress={
              navigable
                ? () => nav.navigate('Tabs', { screen: target.name as never, params: target.params })
                : undefined
            }
          />
        );
      }}
    />
  );
}

function AnnouncementList() {
  const queryClient = useQueryClient();
  // Fetching marks every announcement read on the server, so refresh the badge afterwards.
  const list = usePaginated<AnnouncementRow>(['notifications', 'announcements'], async page => {
    const res = await notificationsApi.announcements(page);
    queryClient.invalidateQueries({ queryKey: qk('notifications', 'unread') });
    return res;
  });
  return (
    <PagedList
      query={list}
      keyOf={(a, i) => String(pickNumber(a, ['announcementID', 'announcementId', 'id']) ?? i)}
      emptyTitle="No announcements"
      renderItem={({ item }) => (
        <ListItem
          title={pickString(item, ['title', 'announcementTitle', 'subject']) ?? 'Announcement'}
          subtitle={[
            pickString(item, ['description', 'announcementDescription', 'message', 'details']),
            formatDate(pickString(item, ['createdAt', 'announcementDate', 'date'])),
          ]
            .filter(Boolean)
            .join(' · ')}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  bar: { paddingHorizontal: spacing.lg, backgroundColor: colors.surface },
});
