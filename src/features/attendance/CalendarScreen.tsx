import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi } from '../../api/attendance.api';
import { errorMessage } from '../../api/errors';
import { dayTone } from '../../components/status';
import { Badge, EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { qk } from '../../hooks/queries';
import { useAppNavigation } from '../../navigation/types';
import { colors, font, spacing, TOUCH_MIN } from '../../theme';
import { currentYearMonth, formatDate, monthLabel, monthRange, shiftMonth, todayIso } from '../../utils/dates';
import type { CalendarDay } from '../../types/api';

export function CalendarScreen() {
  const nav = useAppNavigation();
  const [cursor, setCursor] = useState(currentYearMonth());
  const range = monthRange(cursor.year, cursor.month);
  const now = currentYearMonth();
  const isCurrent = cursor.year === now.year && cursor.month === now.month;

  const cal = useQuery({
    queryKey: qk('attendance', 'calendar', range.start, range.end),
    queryFn: async () => (await attendanceApi.calendar(range.start, range.end)).data ?? [],
  });

  const today = todayIso();
  const days = (cal.data ?? []).filter(d => d.date <= today).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <View style={styles.flex}>
      <View style={styles.monthBar}>
        <Pressable
          accessibilityLabel="Previous month"
          style={styles.nav}
          onPress={() => setCursor(shiftMonth(cursor.year, cursor.month, -1))}>
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Text style={font.heading}>{monthLabel(cursor.year, cursor.month)}</Text>
        <Pressable
          accessibilityLabel="Next month"
          disabled={isCurrent}
          style={[styles.nav, isCurrent && styles.disabled]}
          onPress={() => setCursor(shiftMonth(cursor.year, cursor.month, 1))}>
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>
      {cal.isLoading ? (
        <LoadingState />
      ) : cal.isError ? (
        <ErrorState message={errorMessage(cal.error)} onRetry={() => cal.refetch()} />
      ) : (
        <FlatList
          data={days}
          keyExtractor={d => d.date}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={cal.isRefetching}
              onRefresh={() => {
                cal.refetch();
              }}
            />
          }
          ListEmptyComponent={<EmptyState title="No attendance records" />}
          renderItem={({ item }) => (
            <DayRow day={item} onPress={() => nav.navigate('DayDetail', { date: item.date })} />
          )}
        />
      )}
    </View>
  );
}

function DayRow({ day, onPress }: { day: CalendarDay; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.flex}>
        <Text style={font.body}>{formatDate(day.date)}</Text>
        <Text style={font.caption}>
          {day.inTime || day.outTime ? `In ${day.inTime ?? '—'} · Out ${day.outTime ?? '—'}` : day.shiftName ?? ''}
          {day.inHours ? ` · ${day.inHours} h` : ''}
          {day.lateBy && day.lateBy !== '00:00' ? ` · Late ${day.lateBy}` : ''}
        </Text>
      </View>
      <Badge label={day.title || '—'} tone={dayTone(day.title)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  nav: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 26, color: colors.primary },
  disabled: { opacity: 0.3 },
  list: { padding: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 10,
    marginBottom: spacing.sm,
    minHeight: 60,
  },
  pressed: { opacity: 0.7 },
});
