import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '../../api/attendance.api';
import { errorMessage } from '../../api/errors';
import { Card, ErrorState, KeyValue, ListItem, LoadingState, Screen, Section } from '../../components/ui';
import { qk } from '../../hooks/queries';
import { useAppNavigation } from '../../navigation/types';
import { colors, font, spacing } from '../../theme';
import { currentYearMonth, monthLabel, monthRange } from '../../utils/dates';
import { useTodayCalendar } from './hooks';
import { PunchCard } from './PunchCard';

export function AttendanceScreen() {
  const nav = useAppNavigation();
  const queryClient = useQueryClient();
  const today = useTodayCalendar();
  const { year, month } = currentYearMonth();
  const range = monthRange(year, month);
  const summary = useQuery({
    queryKey: qk('attendance', 'summary', range.start),
    queryFn: async () => (await attendanceApi.summary(range.start, range.end)).data,
  });

  const refreshing = today.isRefetching || summary.isRefetching;
  const t = today.data;

  return (
    <Screen refreshing={refreshing} onRefresh={() => queryClient.invalidateQueries({ queryKey: qk('attendance') })}>
      <PunchCard />

      <Section title="Shift & hours">
        <Card>
          {today.isLoading ? (
            <LoadingState />
          ) : today.isError ? (
            <ErrorState message={errorMessage(today.error)} onRetry={() => today.refetch()} />
          ) : t ? (
            <>
              <KeyValue label="Shift" value={t.shiftName ?? t.shift} />
              <KeyValue
                label="Shift timing"
                value={t.shiftInTime && t.shiftOutTime ? `${t.shiftInTime} – ${t.shiftOutTime}` : undefined}
              />
              <KeyValue label="Worked today" value={t.inHours} />
              {t.lateBy && t.lateBy !== '00:00' ? <KeyValue label="Late by" value={t.lateBy} /> : null}
            </>
          ) : (
            <Text style={font.caption}>No shift information for today.</Text>
          )}
        </Card>
      </Section>

      <Section title={`This month · ${monthLabel(year, month)}`}>
        <Card>
          {summary.isLoading ? (
            <LoadingState />
          ) : summary.isError ? (
            <ErrorState message={errorMessage(summary.error)} onRetry={() => summary.refetch()} />
          ) : (
            <View style={styles.stats}>
              <Stat label="Present" value={summary.data?.presentDays} tone={colors.success} />
              <Stat label="Absent" value={summary.data?.absentDays} tone={colors.danger} />
              <Stat label="Late" value={summary.data?.lateDays} tone={colors.warning} />
              <Stat label="Leave" value={summary.data?.leaveDays} tone={colors.info} />
              <Stat label="Missed punch" value={summary.data?.missPunchDays} tone={colors.warning} />
              <Stat label="Holidays" value={summary.data?.holidayValue} tone={colors.textMuted} />
            </View>
          )}
        </Card>
      </Section>

      <Card>
        <ListItem
          title="Attendance history"
          subtitle="Month calendar and daily punches"
          onPress={() => nav.navigate('AttendanceCalendar')}
          right={<Text style={styles.chev}>›</Text>}
        />
        <ListItem
          title="Regularization requests"
          subtitle="Correct a missed or wrong punch"
          onPress={() => nav.navigate('Regularizations')}
          right={<Text style={styles.chev}>›</Text>}
        />
      </Card>
    </Screen>
  );
}

function Stat({ label, value, tone }: { label: string; value?: number; tone: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: tone }]}>{value ?? '—'}</Text>
      <Text style={font.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { width: '33.33%', paddingVertical: spacing.sm, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700' },
  chev: { fontSize: 22, color: colors.textMuted },
});
