import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { attendanceApi } from '../../api/attendance.api';
import { errorMessage } from '../../api/errors';
import { useSession } from '../../auth/AuthProvider';
import { dayTone } from '../../components/status';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  KeyValue,
  ListItem,
  LoadingState,
  Screen,
  Section,
} from '../../components/ui';
import { qk } from '../../hooks/queries';
import type { RootStackParamList } from '../../navigation/types';
import { formatDate, formatTime } from '../../utils/dates';
import { asArray } from '../../utils/pick';
import type { PunchLog } from '../../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'DayDetail'>;

export function DayDetailScreen({ route, navigation }: Props) {
  const { date } = route.params;
  const { capabilities } = useSession();
  const day = useQuery({
    queryKey: qk('attendance', 'calendar', date, date),
    queryFn: async () => (await attendanceApi.calendar(date, date)).data?.[0] ?? null,
  });
  const logs = useQuery({
    queryKey: qk('attendance', 'logs', date),
    queryFn: async () => asArray<PunchLog>((await attendanceApi.dayLogs(date)).data),
  });

  const d = day.data;
  return (
    <Screen
      refreshing={day.isRefetching || logs.isRefetching}
      onRefresh={() => {
        day.refetch();
        logs.refetch();
      }}>
      <Card>
        {day.isLoading ? (
          <LoadingState />
        ) : day.isError ? (
          <ErrorState message={errorMessage(day.error)} onRetry={() => day.refetch()} />
        ) : (
          <>
            <Badge label={d?.title || '—'} tone={dayTone(d?.title)} />
            <KeyValue label="Date" value={formatDate(date)} />
            <KeyValue label="Shift" value={d?.shiftName ?? d?.shift} />
            <KeyValue label="In / Out" value={d ? `${d.inTime ?? '—'} / ${d.outTime ?? '—'}` : undefined} />
            <KeyValue label="Worked" value={d?.inHours} />
            <KeyValue label="Break / outside" value={d?.outHours} />
            <KeyValue label="Late by" value={d?.lateBy} />
            <KeyValue label="Early by" value={d?.earlyBy} />
            <KeyValue label="Branch" value={d?.branchName} />
          </>
        )}
      </Card>
      <Section title="Punches">
        <Card>
          {logs.isLoading ? (
            <LoadingState />
          ) : logs.isError ? (
            <ErrorState message={errorMessage(logs.error)} onRetry={() => logs.refetch()} />
          ) : logs.data && logs.data.length > 0 ? (
            logs.data.map((l, i) => (
              <ListItem
                key={`${l.logDateTime}-${i}`}
                title={`${String(l.direction).toUpperCase() === 'IN' ? 'In' : 'Out'} · ${formatTime(l.logDateTime)}`}
                subtitle={l.address}
              />
            ))
          ) : (
            <EmptyState title="No punches recorded" />
          )}
        </Card>
      </Section>
      {capabilities.regularizationSubmit ? (
        <Button
          title="Request correction"
          variant="secondary"
          onPress={() => navigation.navigate('RegularizationForm', { date })}
        />
      ) : null}
    </Screen>
  );
}
