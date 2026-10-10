import React from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '../../components/Logo';
import { Button } from '../../components/ui';
import { colors, font, spacing } from '../../theme';

function Gate({ title, message, children }: { title: string; message: string; children?: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.gate}>
      <Text style={[font.title, styles.center]}>{title}</Text>
      <Text style={[font.body, styles.center, styles.message]}>{message}</Text>
      {children}
    </SafeAreaView>
  );
}

/** Same colours and logo as the native BootSplash, so the hand-over is seamless. */
export function SplashScreen() {
  return (
    <SafeAreaView style={styles.splash}>
      <Logo size={112} inverse />
      <ActivityIndicator color={colors.textInverse} style={styles.spinner} accessibilityLabel="Starting" />
    </SafeAreaView>
  );
}

export function ForceUpdateScreen({ message }: { message: string }) {
  return (
    <Gate title="Update required" message={message || 'Please update the app to continue.'}>
      <Button
        title={Platform.OS === 'ios' ? 'Open App Store' : 'Open Play Store'}
        onPress={() =>
          Linking.openURL(
            Platform.OS === 'ios' ? 'itms-apps://apps.apple.com' : 'market://details?id=com.musterbox.mobile',
          ).catch(() => undefined)
        }
      />
    </Gate>
  );
}

export function AccountInactiveScreen({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <Gate title="Account unavailable" message={message || 'Your account is not active. Please contact HR.'}>
      <Button title="Back to sign in" variant="secondary" onPress={onBack} />
    </Gate>
  );
}

export function BootstrapErrorScreen({
  message,
  onRetry,
  onSignOut,
}: {
  message: string;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  return (
    <Gate title="Could not connect" message={message}>
      <Button title="Try again" onPress={onRetry} />
      <Button title="Sign out" variant="ghost" onPress={onSignOut} />
    </Gate>
  );
}

const styles = StyleSheet.create({
  gate: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md, backgroundColor: colors.background },
  center: { textAlign: 'center' },
  message: { marginBottom: spacing.lg },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  spinner: { marginTop: spacing.xl },
});
