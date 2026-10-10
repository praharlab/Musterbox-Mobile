import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthProvider';
import { errorMessage } from '../../api/errors';
import { env } from '../../config/env';
import { Logo } from '../../components/Logo';
import { Banner, Button, Card, TextField } from '../../components/ui';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import { colors, font, spacing } from '../../theme';

export function LoginScreen({ onForgotPassword, notice }: { onForgotPassword: () => void; notice?: string }) {
  const { signIn } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const { run, busy } = useSubmitGuard();

  const canSubmit = phone.trim().length >= 6 && password.length > 0;

  const submit = () =>
    run(async () => {
      setError(undefined);
      try {
        await signIn(phone, password);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setPassword('');
      }
    });

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.column}>
            <View style={styles.brand}>
              <Logo subtitle="Your HR, attendance and leave in one place" />
            </View>
            {notice ? <Banner message={notice} tone="warning" /> : null}
            {error ? <Banner message={error} tone="danger" /> : null}
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Welcome back</Text>
              <Text style={[font.caption, styles.cardSubtitle]}>Enter your details to continue</Text>
              <TextField
                testID="login-phone"
                label="Mobile number"
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter your mobile number"
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                maxLength={15}
              />
              <TextField
                testID="login-password"
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                secureToggle
                autoCapitalize="none"
                autoComplete="password"
                textContentType="password"
                onSubmitEditing={canSubmit ? submit : undefined}
              />
              <Button
                testID="login-submit"
                title="Sign in"
                large
                onPress={submit}
                loading={busy}
                disabled={!canSubmit}
              />
            </Card>
            <View style={styles.forgot}>
              {env.features.forgotPassword ? (
                <Button title="Forgot password?" variant="ghost" onPress={onForgotPassword} />
              ) : (
                <Text style={[font.caption, styles.center]}>Forgot your password? Please contact your HR team.</Text>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  // Vertically centred; scrolls when the keyboard is open.
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  // Horizontally centred with a readable max width on tablets.
  column: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  brand: { marginBottom: spacing.xl },
  card: { padding: spacing.xl, borderRadius: 18 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  cardSubtitle: { marginTop: 2, marginBottom: spacing.xl },
  forgot: { marginTop: spacing.md, alignItems: 'center' },
  center: { textAlign: 'center' },
});
