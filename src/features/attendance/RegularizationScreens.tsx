import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { attendanceApi } from '../../api/attendance.api';
import { errorMessage } from '../../api/errors';
import { useSession } from '../../auth/AuthProvider';
import { DateField } from '../../components/DateField';
import { PagedList } from '../../components/PagedList';
import { requestStatus } from '../../components/status';
import {
  Badge,
  Banner,
  Button,
  Chip,
  ErrorState,
  ListItem,
  LoadingState,
  Screen,
  Section,
  TextField,
} from '../../components/ui';
import { qk, usePaginated } from '../../hooks/queries';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import type { RootStackParamList } from '../../navigation/types';
import { spacing } from '../../theme';
import { formatDate, isoDate, todayIso } from '../../utils/dates';
import { asArray, pickNumber, pickString } from '../../utils/pick';
import { buildCorrectionLogs, isValidTime } from './regularization';

export function RegularizationListScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Regularizations'>) {
  const { capabilities } = useSession();
  const end = todayIso();
  const start = isoDate(new Date(Date.now() - 90 * 86400000));
  const list = usePaginated(['attendance', 'corrections', start], page =>
    attendanceApi.myCorrections(page, start, end),
  );

  return (
    <PagedList
      query={list}
      keyOf={(r, i) => String(pickNumber(r, ['attendanceCorrectionRequestId', 'id']) ?? i)}
      emptyTitle="No regularization requests"
      emptyMessage="Requests from the last 90 days appear here."
      header={
        capabilities.regularizationSubmit ? (
          <View style={styles.header}>
            <Button title="New request" onPress={() => navigation.navigate('RegularizationForm')} />
          </View>
        ) : undefined
      }
      renderItem={({ item }) => {
        const s = requestStatus(pickNumber(item, ['correctionStatus', 'authorizationStatus']));
        return (
          <ListItem
            title={formatDate(pickString(item, ['AttendanceDate', 'attendanceDate']))}
            subtitle={pickString(item, ['remark'])}
            right={<Badge label={s.label} tone={s.tone} />}
          />
        );
      }}
    />
  );
}

export function RegularizationFormScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'RegularizationForm'>) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(route.params?.date ?? '');
  const [reasonId, setReasonId] = useState<number>();
  const [inTime, setInTime] = useState('');
  const [outTime, setOutTime] = useState('');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState<string>();
  const { run, busy } = useSubmitGuard();

  const reasons = useQuery({
    queryKey: qk('attendance', 'correctionReasons'),
    queryFn: async () => asArray<Record<string, unknown>>((await attendanceApi.correctionReasons()).data),
    staleTime: 60 * 60 * 1000,
  });

  const submit = () =>
    run(async () => {
      setError(undefined);
      if (!date || !reasonId || !remark.trim()) {
        setError('Select a date and reason and add a remark.');
        return;
      }
      if (!isValidTime(inTime) && !isValidTime(outTime)) {
        setError('Enter a corrected in-time or out-time as HH:MM (24-hour).');
        return;
      }
      try {
        const current = await attendanceApi.correctionCurrentLogs(date);
        const logs = buildCorrectionLogs({ date, inTime, outTime }, current.data);
        await attendanceApi.addCorrection({ date, remark: remark.trim(), reasonId, logs });
        await queryClient.invalidateQueries({ queryKey: qk('attendance') });
        Alert.alert('Request submitted', 'Your regularization request was sent for approval.');
        navigation.goBack();
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  return (
    <Screen>
      {error ? <Banner message={error} tone="danger" /> : null}
      <DateField label="Date" value={date} onChange={setDate} maxDate={todayIso()} />
      <Section title="Reason">
        {reasons.isLoading ? (
          <LoadingState />
        ) : reasons.isError ? (
          <ErrorState message={errorMessage(reasons.error)} onRetry={() => reasons.refetch()} />
        ) : (
          <View style={styles.chips}>
            {(reasons.data ?? []).map(r => {
              const id = pickNumber(r, ['attendanceCorrectionReasonID', 'attendanceCorrectionReasonId', 'id']);
              const label = pickString(r, ['reason', 'reasonName', 'name', 'title']) ?? `Reason ${id}`;
              return id ? (
                <Chip key={id} label={label} selected={id === reasonId} onPress={() => setReasonId(id)} />
              ) : null;
            })}
          </View>
        )}
      </Section>
      <View style={styles.times}>
        <View style={styles.flex}>
          <TextField
            label="Correct in-time (HH:MM)"
            value={inTime}
            onChangeText={setInTime}
            placeholder="09:00"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label="Correct out-time (HH:MM)"
            value={outTime}
            onChangeText={setOutTime}
            placeholder="18:00"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
        </View>
      </View>
      <TextField label="Remark" value={remark} onChangeText={setRemark} multiline maxLength={500} />
      <Button title="Submit request" large loading={busy} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { marginBottom: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  times: { flexDirection: 'row', gap: spacing.md },
});
