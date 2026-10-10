import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '../../api/errors';
import { PagedList } from '../../components/PagedList';
import { requestStatus } from '../../components/status';
import { Badge, Button, Card, ErrorState, ListItem, LoadingState } from '../../components/ui';
import { qk } from '../../hooks/queries';
import { useAppNavigation } from '../../navigation/types';
import { colors, font, spacing } from '../../theme';
import { formatDate } from '../../utils/dates';
import { useLeaveBalance, useLeaveHistory } from './hooks';

export function LeaveBalanceStrip() {
  const balance = useLeaveBalance();
  if (balance.isLoading) {
    return <LoadingState label="Loading balance…" />;
  }
  if (balance.isError) {
    return <ErrorState message={errorMessage(balance.error)} onRetry={() => balance.refetch()} />;
  }
  if (!balance.data?.length) {
    return <Text style={font.caption}>No leave types are assigned to you.</Text>;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {balance.data.map(b => (
        <View key={b.LeaveTranId} style={styles.balance} accessibilityLabel={`${b.LeaveDesc} balance ${b.Balance}`}>
          <Text style={styles.balanceValue}>{b.Balance}</Text>
          <Text style={font.caption} numberOfLines={1}>
            {b.LeaveDesc || b.leaveName}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

export function LeaveScreen() {
  const nav = useAppNavigation();
  const queryClient = useQueryClient();
  const history = useLeaveHistory();

  const header = (
    <View>
      <Card>
        <Text style={[font.heading, styles.gap]}>Balance</Text>
        <LeaveBalanceStrip />
      </Card>
      <Button testID="apply-leave" title="Apply for leave" large onPress={() => nav.navigate('ApplyLeave')} />
      <Text style={[font.heading, styles.historyTitle]}>My requests</Text>
    </View>
  );

  return (
    <View style={styles.flex}>
      <PagedList
        query={{
          ...history,
          refetch: () => {
            queryClient.invalidateQueries({ queryKey: qk('leave', 'balance') });
            return history.refetch();
          },
        }}
        header={header}
        keyOf={l => String(l.UserLeaveApplicationID)}
        emptyTitle="No leave requests yet"
        renderItem={({ item }) => {
          const s = requestStatus(item.authorizationStatus);
          return (
            <ListItem
              title={item.hrLeaveType?.LeaveMaster?.LeaveName ?? 'Leave'}
              subtitle={`${formatDate(item.FromDate)} – ${formatDate(item.ToDate)} · ${item.LeaveDays} day(s)`}
              right={<Badge label={s.label} tone={s.tone} />}
              onPress={() => nav.navigate('LeaveDetail', { leave: item })}
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  gap: { marginBottom: spacing.sm },
  strip: { gap: spacing.sm },
  balance: {
    minWidth: 96,
    padding: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
  },
  balanceValue: { fontSize: 22, fontWeight: '700', color: colors.primary },
  historyTitle: { marginTop: spacing.xl, marginBottom: spacing.sm },
});
