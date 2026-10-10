import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { approvalsApi } from '../../api/approvals';
import { authApi } from '../../api/auth.api';
import { notificationsApi } from '../../api/notifications.api';
import { payslipApi } from '../../api/payslip.api';
import { useSession } from '../../auth/AuthProvider';
import { Card, ListItem, Screen, Section } from '../../components/ui';
import { qk } from '../../hooks/queries';
import { openFeature, useAppNavigation } from '../../navigation/types';
import { colors, font, spacing } from '../../theme';
import { formatDate, greeting, yyyymmLabel } from '../../utils/dates';
import { asArray, pickString } from '../../utils/pick';
import { PunchCard } from '../attendance/PunchCard';
import { LeaveBalanceStrip } from '../leave/LeaveScreen';
import { useLeaveHistory } from '../leave/hooks';

/**
 * Home shows only what the backend actually provides. There is no single
 * "my open requests" endpoint (GAP P1-10), so pending requests = pending leave.
 */
export function HomeScreen() {
  const nav = useAppNavigation();
  const queryClient = useQueryClient();
  const { session, capabilities } = useSession();
  const mode = capabilities.mode;

  const history = useLeaveHistory(capabilities.leave);
  const pendingLeave = history.items.filter(l => [1, 2].includes(Number(l.authorizationStatus))).length;

  const payslips = useQuery({
    queryKey: qk('payslip', 'generator'),
    queryFn: async () => (await payslipApi.generatorList()).data ?? [],
    enabled: capabilities.payslip,
  });
  const latestSlip = payslips.data?.[0];

  const unread = useQuery({ queryKey: qk('notifications', 'unread'), queryFn: notificationsApi.unreadAnnouncements });
  const inbox = useQuery({ queryKey: qk('notifications', 'inboxCount'), queryFn: () => notificationsApi.inbox(1) });

  const pending = useQuery({
    queryKey: qk('approvals', 'counts'),
    queryFn: async () => (await approvalsApi.pendingCounts()).data,
    enabled: capabilities.approvals,
  });

  const birthdays = useQuery({
    queryKey: qk('home', 'birthdays'),
    queryFn: async () => asArray((await authApi.birthdays()).data),
    enabled: capabilities.birthdays,
    staleTime: 60 * 60 * 1000,
  });

  const onRefresh = () => queryClient.invalidateQueries({ queryKey: qk() });
  const chev = <Text style={styles.chev}>›</Text>;

  return (
    <Screen onRefresh={onRefresh} refreshing={false}>
      <Text style={font.title}>
        {greeting()}, {session.firstName || 'there'}
      </Text>
      <Text style={[font.caption, styles.date]}>{formatDate(new Date().toISOString())}</Text>

      {capabilities.attendance ? <PunchCard /> : null}

      {capabilities.approvals ? (
        <Card>
          <ListItem
            title="Pending approvals"
            subtitle={
              pending.data
                ? `Leave ${pending.data.leaveCount ?? 0} · Overtime ${pending.data.OTcount ?? 0} · Expense ${
                    pending.data.expenseAuthorizationsCount ?? 0
                  }`
                : pending.isError
                ? 'Could not load counts'
                : 'Loading…'
            }
            right={chev}
            onPress={() => nav.navigate('Tabs', { screen: 'ApprovalsTab' })}
          />
        </Card>
      ) : null}

      {capabilities.leave ? (
        <Section title="Leave balance">
          <Card>
            <LeaveBalanceStrip />
            <ListItem
              title="My leave requests"
              subtitle={pendingLeave > 0 ? `${pendingLeave} awaiting approval` : 'No pending requests'}
              right={chev}
              onPress={() => openFeature(nav, mode, 'leave')}
            />
          </Card>
        </Section>
      ) : null}

      <Section title="Updates">
        <Card>
          <ListItem
            title="Notifications"
            subtitle={
              [
                inbox.data
                  ? `${Number.isFinite(inbox.data.total) ? inbox.data.total : inbox.data.items.length} action item(s)`
                  : null,
                unread.data ? `${unread.data} unread announcement(s)` : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'Nothing new'
            }
            right={chev}
            onPress={() => openFeature(nav, mode, 'notifications')}
          />
          {capabilities.payslip ? (
            <ListItem
              title="Payslips"
              subtitle={latestSlip ? `Latest: ${yyyymmLabel(latestSlip.yearMonth)}` : 'View your payslips'}
              right={chev}
              onPress={() => openFeature(nav, mode, 'payslip')}
            />
          ) : null}
        </Card>
      </Section>

      {birthdays.data && birthdays.data.length > 0 ? (
        <Section title="Birthdays today">
          <Card>
            <View style={styles.people}>
              {birthdays.data.slice(0, 10).map((b, i) => (
                <Text key={i} style={font.body}>
                  🎂 {pickString(b, ['displayName', 'name', 'firstName']) ?? 'Colleague'}
                </Text>
              ))}
            </View>
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  date: { marginBottom: spacing.lg },
  chev: { fontSize: 22, color: colors.textMuted },
  people: { gap: spacing.xs },
});
