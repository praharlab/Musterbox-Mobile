import React from 'react';
import { Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { errorMessage } from '../../api/errors';
import { FILE_PATHS } from '../../api/endpoints';
import { isWithdrawable, leaveApi } from '../../api/leave.api';
import { currentToken } from '../../auth/sessionService';
import { env } from '../../config/env';
import { requestStatus } from '../../components/status';
import { Badge, Button, Card, KeyValue, ListItem, Screen, Section } from '../../components/ui';
import { qk } from '../../hooks/queries';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import type { RootStackParamList } from '../../navigation/types';
import { secureFiles } from '../../storage/secureFiles';
import { formatDate } from '../../utils/dates';
import { pickNumber, pickPath, pickString } from '../../utils/pick';

type Props = NativeStackScreenProps<RootStackParamList, 'LeaveDetail'>;

export function LeaveDetailScreen({ route, navigation }: Props) {
  const { leave } = route.params;
  const queryClient = useQueryClient();
  const { run, busy } = useSubmitGuard();
  const s = requestStatus(leave.authorizationStatus);

  const withdraw = () =>
    Alert.alert('Withdraw leave request?', 'This cannot be undone.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: () =>
          run(async () => {
            try {
              await leaveApi.withdraw(leave);
              await queryClient.invalidateQueries({ queryKey: qk('leave') });
              navigation.goBack();
            } catch (e) {
              Alert.alert('Could not withdraw', errorMessage(e));
            }
          }),
      },
    ]);

  const openAttachment = () =>
    run(async () => {
      try {
        const ext = (leave.attachment ?? '').split('.').pop()?.toLowerCase() ?? 'pdf';
        const path = await secureFiles.download(
          `${env.fileBaseUrl}${FILE_PATHS.leaveAttachment(leave.attachment as string)}`,
          currentToken(),
          ext,
        );
        await secureFiles.open(path, ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`);
      } catch (e) {
        Alert.alert('Could not open attachment', errorMessage(e));
      }
    });

  return (
    <Screen>
      <Card>
        <Badge label={s.label} tone={s.tone} />
        <KeyValue label="Leave type" value={leave.hrLeaveType?.LeaveMaster?.LeaveName} />
        <KeyValue label="From" value={formatDate(leave.FromDate)} />
        <KeyValue label="To" value={formatDate(leave.ToDate)} />
        <KeyValue label="Days" value={leave.LeaveDays} />
        <KeyValue label="Day type" value={leave.DayType} />
        <KeyValue label="Reason" value={leave.Remark} />
      </Card>
      {leave.approvedLeaveAuthorizations?.length ? (
        <Section title="Approvals">
          <Card>
            {leave.approvedLeaveAuthorizations.map((a, i) => {
              const st = Number(pickNumber(a, ['authstatus']));
              const who =
                pickString(pickPath(a, ['userMaster']), ['displayName']) ??
                pickString(a, ['displayName']) ??
                'Approver';
              return (
                <ListItem
                  key={i}
                  title={who}
                  subtitle={pickString(a, ['rejectionRemarks', 'remarks'])}
                  right={
                    <Badge
                      label={st === 1 ? 'Approved' : st === 0 ? 'Rejected' : 'Pending'}
                      tone={st === 1 ? 'success' : st === 0 ? 'danger' : 'info'}
                    />
                  }
                />
              );
            })}
          </Card>
        </Section>
      ) : null}
      {leave.attachment ? (
        <Button title="View attachment" variant="secondary" loading={busy} onPress={openAttachment} />
      ) : null}
      {isWithdrawable(leave) ? (
        <Button title="Withdraw request" variant="danger" loading={busy} onPress={withdraw} />
      ) : null}
    </Screen>
  );
}
