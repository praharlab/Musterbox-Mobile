import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { errorMessage } from '../../api/errors';
import {
  ApplyLeaveInput,
  LEAVE_ATTACHMENT_MAX_BYTES,
  LEAVE_ATTACHMENT_TYPES,
  leaveApi,
  LocalFile,
} from '../../api/leave.api';
import { DateField } from '../../components/DateField';
import { Banner, Button, Card, Chip, ErrorState, LoadingState, Screen, Section, TextField } from '../../components/ui';
import { qk } from '../../hooks/queries';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import type { RootStackParamList } from '../../navigation/types';
import { font, spacing } from '../../theme';
import { daysInclusive } from '../../utils/dates';
import { useLeaveBalance, useMyApprovers } from './hooks';

type Props = NativeStackScreenProps<RootStackParamList, 'ApplyLeave'>;

export function validateLeave(input: Partial<ApplyLeaveInput>, balance?: number): string | undefined {
  if (!input.leaveTranId) {
    return 'Select a leave type.';
  }
  if (!input.fromDate || !input.toDate) {
    return 'Select the start and end dates.';
  }
  if (input.toDate < input.fromDate) {
    return 'The end date cannot be before the start date.';
  }
  if (!input.remark?.trim()) {
    return 'Add a reason for the leave.';
  }
  if (balance !== undefined && (input.leaveDays ?? 0) > balance) {
    return `You have only ${balance} day(s) of this leave available.`;
  }
  if (input.attachment) {
    if (!LEAVE_ATTACHMENT_TYPES.includes(input.attachment.type)) {
      return 'Attachments must be JPG, PNG or PDF.';
    }
    if ((input.attachment.size ?? 0) > LEAVE_ATTACHMENT_MAX_BYTES) {
      return 'Attachments must be 10 MB or smaller.';
    }
  }
  return undefined;
}

export function ApplyLeaveScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const balance = useLeaveBalance();
  const approvers = useMyApprovers();
  const [leaveTranId, setLeaveTranId] = useState<number>();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [remark, setRemark] = useState('');
  const [attachment, setAttachment] = useState<LocalFile>();
  const [error, setError] = useState<string>();
  const { run, busy } = useSubmitGuard();

  // The server applies sandwich/holiday rules; this is the calendar-day estimate shown before submitting.
  const leaveDays = useMemo(() => (fromDate && toDate ? daysInclusive(fromDate, toDate) : 0), [fromDate, toDate]);
  const selected = balance.data?.find(b => b.LeaveTranId === leaveTranId);

  const chooseFile = async () => {
    try {
      const [file] = await pick({ type: [types.images, types.pdf] });
      setAttachment({
        uri: file.uri,
        name: file.name ?? 'attachment',
        type: file.type ?? 'application/octet-stream',
        size: file.size,
      });
    } catch (e) {
      if (!(isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED)) {
        setError('Could not open the file picker.');
      }
    }
  };

  const submit = () =>
    run(async () => {
      const input: ApplyLeaveInput = {
        leaveTranId: leaveTranId as number,
        fromDate,
        toDate,
        leaveDays,
        dayType: 'Full Day',
        remark: remark.trim(),
        attachment,
      };
      const problem = validateLeave(input, selected?.Balance);
      if (problem) {
        setError(problem);
        return;
      }
      setError(undefined);
      try {
        const res = await leaveApi.apply(input);
        await queryClient.invalidateQueries({ queryKey: qk('leave') });
        Alert.alert('Leave requested', res.message || 'Your leave request was submitted for approval.');
        navigation.goBack();
      } catch (e) {
        // On timeout the request may have reached the server: tell the user to check history, not to resubmit.
        const msg = errorMessage(e);
        setError(
          (e as { isUncertain?: boolean }).isUncertain
            ? `${msg} Check "My requests" before submitting again - it may already have been recorded.`
            : msg,
        );
        queryClient.invalidateQueries({ queryKey: qk('leave') });
      }
    });

  return (
    <Screen>
      {error ? <Banner message={error} tone="danger" /> : null}
      <Section title="Leave type">
        {balance.isLoading ? (
          <LoadingState />
        ) : balance.isError ? (
          <ErrorState message={errorMessage(balance.error)} onRetry={() => balance.refetch()} />
        ) : (
          <View style={styles.chips}>
            {(balance.data ?? []).map(b => (
              <Chip
                key={b.LeaveTranId}
                label={`${b.LeaveDesc || b.leaveName} (${b.Balance})`}
                selected={b.LeaveTranId === leaveTranId}
                onPress={() => setLeaveTranId(b.LeaveTranId)}
              />
            ))}
          </View>
        )}
      </Section>
      <View style={styles.dates}>
        <DateField
          testID="leave-from"
          label="From"
          value={fromDate}
          onChange={v => {
            setFromDate(v);
            if (!toDate || toDate < v) {
              setToDate(v);
            }
          }}
        />
        <DateField testID="leave-to" label="To" value={toDate} onChange={setToDate} minDate={fromDate || undefined} />
      </View>
      {leaveDays > 0 ? (
        <Text style={[font.caption, styles.days]}>
          {leaveDays} calendar day(s), full day. Weekends and holidays are applied by your leave policy.
        </Text>
      ) : null}
      <TextField
        testID="leave-remark"
        label="Reason"
        value={remark}
        onChangeText={setRemark}
        multiline
        maxLength={500}
      />
      <Section title="Attachment (optional)">
        {attachment ? (
          <Card>
            <Text style={font.body} numberOfLines={1}>
              {attachment.name}
            </Text>
            <Button title="Remove" variant="ghost" onPress={() => setAttachment(undefined)} />
          </Card>
        ) : (
          <Button title="Add JPG, PNG or PDF (max 10 MB)" variant="secondary" onPress={chooseFile} />
        )}
      </Section>
      {approvers.data?.Auth_person?.length ? (
        <Text style={[font.caption, styles.days]}>
          Approver(s):{' '}
          {approvers.data.Auth_person.map(p => p.userName)
            .filter(Boolean)
            .join(', ')}
          {approvers.data.Auth_Criteria?.Criteria ? ` · ${approvers.data.Auth_Criteria.Criteria}` : ''}
        </Text>
      ) : null}
      <Button testID="leave-submit" title="Submit request" large loading={busy} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dates: { flexDirection: 'row', gap: spacing.md },
  days: { marginBottom: spacing.md },
});
