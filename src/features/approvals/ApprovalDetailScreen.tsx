import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { APPROVAL_ADAPTERS } from '../../api/approvals';
import { errorMessage } from '../../api/errors';
import { useSession } from '../../auth/AuthProvider';
import { Banner, Button, Card, KeyValue, Screen, TextField } from '../../components/ui';
import { qk } from '../../hooks/queries';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import type { RootStackParamList } from '../../navigation/types';
import { spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ApprovalDetail'>;

export function ApprovalDetailScreen({ route, navigation }: Props) {
  const { item } = route.params;
  const { capabilities } = useSession();
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string>();
  const { run, busy } = useSubmitGuard();
  const adapter = APPROVAL_ADAPTERS[item.module];

  const canDecide = capabilities.approvalDecisions && item.decidable;

  const decide = (approve: boolean) => {
    if (!approve && !remarks.trim()) {
      setError('Add a reason before rejecting.');
      return;
    }
    Alert.alert(approve ? 'Approve request?' : 'Reject request?', `${item.requesterName} · ${item.title}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: approve ? 'Approve' : 'Reject',
        style: approve ? 'default' : 'destructive',
        onPress: () =>
          run(async () => {
            setError(undefined);
            try {
              await adapter.decide(item, approve, remarks.trim());
              await queryClient.invalidateQueries({ queryKey: qk('approvals') });
              Alert.alert(approve ? 'Approved' : 'Rejected', 'The employee will be notified.');
              navigation.goBack();
            } catch (e) {
              await queryClient.invalidateQueries({ queryKey: qk('approvals') });
              setError(
                (e as { isUncertain?: boolean }).isUncertain
                  ? `${errorMessage(e)} The decision may have been saved; the list has been refreshed.`
                  : errorMessage(e),
              );
            }
          }),
      },
    ]);
  };

  return (
    <Screen>
      <Card>
        <KeyValue label="Employee" value={item.requesterName} />
        {item.details.map(d => (
          <KeyValue key={d.label} label={d.label} value={d.value} />
        ))}
      </Card>
      {error ? <Banner message={error} tone="danger" /> : null}
      {!capabilities.approvalDecisions ? (
        <Banner tone="warning" message="Decisions from the app are disabled. Please use the web portal." />
      ) : !item.decidable ? (
        <Banner tone="warning" message={`${item.notDecidableReason ?? ''} Please decide on the web portal.`} />
      ) : null}
      {canDecide ? (
        <>
          <TextField
            label="Remarks (required to reject)"
            value={remarks}
            onChangeText={setRemarks}
            multiline
            maxLength={500}
          />
          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button title="Reject" variant="danger" loading={busy} onPress={() => decide(false)} />
            </View>
            <View style={styles.flex}>
              <Button title="Approve" loading={busy} onPress={() => decide(true)} />
            </View>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.md },
});
