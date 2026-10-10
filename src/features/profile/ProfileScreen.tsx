import React from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { errorMessage } from '../../api/errors';
import { profileApi } from '../../api/profile.api';
import { useAuth, useSession } from '../../auth/AuthProvider';
import { Button, Card, ErrorState, KeyValue, ListItem, LoadingState, Screen, Section } from '../../components/ui';
import { qk } from '../../hooks/queries';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import { openFeature, useAppNavigation } from '../../navigation/types';
import { colors, font, spacing } from '../../theme';
import { PROFILE_SECTIONS, ProfileSectionKey } from './sections';

export function useProfile() {
  return useQuery({
    queryKey: qk('profile', 'summary'),
    queryFn: async () => (await profileApi.summary()).data,
    staleTime: 10 * 60 * 1000,
  });
}

/** Company config can hide fields; hidden fields arrive as "-". */
const shown = (v?: string) => (v && v !== '-' ? v : undefined);

export function ProfileScreen() {
  const nav = useAppNavigation();
  const { signOut } = useAuth();
  const { session, capabilities } = useSession();
  const profile = useProfile();
  const managers = useQuery({
    queryKey: qk('profile', 'managers'),
    queryFn: async () => (await profileApi.managers()).data ?? [],
  });
  const { run, busy } = useSubmitGuard();
  const p = profile.data;

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You will need your password to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => run(signOut) },
    ]);

  return (
    <Screen refreshing={profile.isRefetching} onRefresh={() => profile.refetch()}>
      <Card>
        {profile.isLoading ? (
          <LoadingState />
        ) : profile.isError ? (
          <ErrorState message={errorMessage(profile.error)} onRetry={() => profile.refetch()} />
        ) : (
          <View style={styles.header}>
            {shown(p?.profile) ? (
              <Image source={{ uri: p?.profile }} style={styles.photo} accessibilityIgnoresInvertColors />
            ) : (
              <View style={[styles.photo, styles.initials]}>
                <Text style={styles.initialsText}>{(session.firstName[0] ?? '') + (session.lastName[0] ?? '')}</Text>
              </View>
            )}
            <View style={styles.flex}>
              <Text style={font.title}>{shown(p?.name) ?? `${session.firstName} ${session.lastName}`}</Text>
              <Text style={font.caption}>
                {[shown(p?.designation), shown(p?.department)].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>
        )}
      </Card>

      {p ? (
        <Section title="Employment">
          <Card>
            <KeyValue label="Employee code" value={shown(p.employeeCode)} />
            <KeyValue label="Company" value={shown(p.companyName)} />
            <KeyValue label="Designation" value={shown(p.designation)} />
            <KeyValue label="Department" value={shown(p.department)} />
            <KeyValue label="Branch" value={shown(p.branch)} />
            <KeyValue
              label="Reports to"
              value={
                (managers.data ?? [])
                  .map(m => m.name)
                  .filter(Boolean)
                  .join(', ') || undefined
              }
            />
          </Card>
        </Section>
      ) : null}

      {p ? (
        <Section title="Contact">
          <Card>
            <KeyValue label="Mobile" value={shown(p.userNumber)} />
            <KeyValue label="Email" value={shown(p.email)} />
            <KeyValue
              label="Address"
              value={
                p.address
                  ? [p.address.houseNumber, p.address.houseName, p.address.area, p.address.city, p.address.zipcode]
                      .filter(v => v && v !== '-')
                      .join(', ')
                  : undefined
              }
            />
          </Card>
        </Section>
      ) : null}

      <Section title="My records">
        <Card>
          {(Object.keys(PROFILE_SECTIONS) as ProfileSectionKey[]).map(key => (
            <ListItem
              key={key}
              title={PROFILE_SECTIONS[key].title}
              right={<Text style={styles.chev}>›</Text>}
              onPress={() => nav.navigate('ProfileSection', { section: key })}
            />
          ))}
        </Card>
      </Section>

      {capabilities.mode === 'manager' ? (
        <Section title="My workspace">
          <Card>
            <ListItem
              title="Leave"
              right={<Text style={styles.chev}>›</Text>}
              onPress={() => openFeature(nav, 'manager', 'leave')}
            />
            <ListItem
              title="Payslips"
              right={<Text style={styles.chev}>›</Text>}
              onPress={() => openFeature(nav, 'manager', 'payslip')}
            />
            <ListItem
              title="Notifications"
              right={<Text style={styles.chev}>›</Text>}
              onPress={() => openFeature(nav, 'manager', 'notifications')}
            />
          </Card>
        </Section>
      ) : null}

      <Section title="Account">
        <Card>
          <ListItem
            title="Change password"
            right={<Text style={styles.chev}>›</Text>}
            onPress={() => nav.navigate('ChangePassword')}
          />
        </Card>
        <Button testID="sign-out" title="Sign out" variant="danger" loading={busy} onPress={confirmSignOut} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  photo: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft },
  initials: { alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontSize: 22, fontWeight: '700', color: colors.primary },
  chev: { fontSize: 22, color: colors.textMuted },
});
