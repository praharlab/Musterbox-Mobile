import React from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FILE_PATHS } from '../../api/endpoints';
import { errorMessage } from '../../api/errors';
import { currentToken } from '../../auth/sessionService';
import { env } from '../../config/env';
import { Button, Card, EmptyState, ErrorState, KeyValue, LoadingState, Screen } from '../../components/ui';
import { qk } from '../../hooks/queries';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import type { RootStackParamList } from '../../navigation/types';
import { secureFiles } from '../../storage/secureFiles';
import { font } from '../../theme';
import { pickString } from '../../utils/pick';
import { PROFILE_SECTIONS, rowsOf } from './sections';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileSection'>;

const SAFE_FILE = /^[\w\-.]+\.(pdf|jpe?g|png)$/i;

export function ProfileSectionScreen({ route, navigation }: Props) {
  const spec = PROFILE_SECTIONS[route.params.section];
  const { run, busy } = useSubmitGuard();
  React.useLayoutEffect(() => navigation.setOptions({ title: spec.title }), [navigation, spec.title]);

  const q = useQuery({
    queryKey: qk('profile', route.params.section),
    queryFn: async () => rowsOf((await spec.load()).data),
  });

  const openDocument = (file: string) =>
    run(async () => {
      try {
        const ext = file.split('.').pop()!.toLowerCase();
        const path = await secureFiles.download(
          `${env.fileBaseUrl}${FILE_PATHS.userDocument(file)}`,
          currentToken(),
          ext,
        );
        await secureFiles.open(path, ext === 'pdf' ? 'application/pdf' : 'image/jpeg');
      } catch (e) {
        Alert.alert('Could not open document', errorMessage(e));
      }
    });

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState
          title={`No ${spec.title.toLowerCase()} on record`}
          message="Contact HR to add or update these details."
        />
      ) : (
        q.data.map((row, i) => {
          const file = route.params.section === 'documents' ? pickString(row, ['document']) : undefined;
          return (
            <Card key={i}>
              <Text style={font.heading}>{spec.titleOf(row)}</Text>
              {spec.fields.map(f => (
                <KeyValue key={f.label} label={f.label} value={f.value(row)} />
              ))}
              {file && SAFE_FILE.test(file) ? (
                <Button title="View document" variant="secondary" loading={busy} onPress={() => openDocument(file)} />
              ) : null}
            </Card>
          );
        })
      )}
      <Text style={[font.caption, styles.note]}>Changes to these records are made by HR on the web portal.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { textAlign: 'center', marginTop: 8 },
});
