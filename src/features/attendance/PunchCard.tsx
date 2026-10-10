import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../../api/errors';
import { useSession } from '../../auth/AuthProvider';
import { Badge, Banner, Button, Card, ErrorState, LoadingState } from '../../components/ui';
import { font, spacing } from '../../theme';
import { formatTime } from '../../utils/dates';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { usePunch } from './hooks';
import { ACTION_LABEL, PunchState } from './punch';

function describe(state: PunchState): {
  label: string;
  tone: 'success' | 'info' | 'warning' | 'neutral';
  detail: string;
} {
  switch (state.kind) {
    case 'notStarted':
      return { label: 'Not checked in', tone: 'neutral', detail: 'You have not checked in today.' };
    case 'in':
      return { label: 'Checked in', tone: 'success', detail: `Since ${formatTime(state.since.logDateTime)}` };
    case 'completed':
      return {
        label: 'Checked out',
        tone: 'info',
        detail: `In ${formatTime(state.inLog.logDateTime)} · Out ${formatTime(state.outLog.logDateTime)}`,
      };
    case 'missedPunchOut':
      return { label: 'Missed check-out', tone: 'warning', detail: 'Request a regularization to correct it.' };
  }
}

/** Today's status and the single primary attendance action. Used on Home and Attendance. */
export function PunchCard() {
  const { capabilities, boot } = useSession();
  const { status, state, action, punch, busy } = usePunch();
  const online = useNetworkStatus();

  if (status.isLoading) {
    return (
      <Card>
        <LoadingState label="Checking today's attendance…" />
      </Card>
    );
  }
  if (status.isError) {
    return (
      <Card>
        <ErrorState message={errorMessage(status.error)} onRetry={() => status.refetch()} />
      </Card>
    );
  }

  const d = describe(state);
  return (
    <Card>
      <View style={styles.header}>
        <Text style={font.heading}>Today</Text>
        <Badge label={d.label} tone={d.tone} />
      </View>
      <Text style={[font.body, styles.detail]}>{d.detail}</Text>
      {!capabilities.canPunchFromMobile ? (
        <Banner
          tone="neutral"
          message={
            boot.bootstrap?.attendanceFrom === 'biometric'
              ? 'Your attendance is recorded by the biometric device.'
              : 'Mobile attendance is not enabled for you.'
          }
        />
      ) : action ? (
        <Button
          testID="punch-button"
          title={ACTION_LABEL[action]}
          large
          variant={action === 'checkOut' ? 'secondary' : 'primary'}
          onPress={punch}
          loading={busy}
          disabled={!online}
          accessibilityHint="Uses your current location to record attendance"
        />
      ) : (
        <Text style={font.caption}>Attendance for today is complete.</Text>
      )}
      {capabilities.canPunchFromMobile && capabilities.selfieRequired ? (
        <Text style={[font.caption, styles.hint]}>A selfie is required for attendance.</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detail: { marginVertical: spacing.md },
  hint: { marginTop: spacing.sm },
});
