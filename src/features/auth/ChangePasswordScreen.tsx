import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { authApi } from '../../api/auth.api';
import { errorMessage } from '../../api/errors';
import { Banner, Button, Screen, TextField } from '../../components/ui';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import { font } from '../../theme';
import { passwordProblem } from './passwordRules';

/**
 * mode "initial": forced first-login change (/auth/v1/resetpassword, resetpassword == 1).
 * mode "change":  normal change from Profile (/auth/v1/changepassword).
 */
export function ChangePasswordScreen({ mode, onDone }: { mode: 'initial' | 'change'; onDone: () => void }) {
  const [old, setOld] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const { run, busy } = useSubmitGuard();

  const submit = () =>
    run(async () => {
      setError(undefined);
      const problem = passwordProblem(pw, pw2, old);
      if (problem) {
        setError(problem);
        return;
      }
      try {
        if (mode === 'initial') {
          await authApi.changeInitialPassword(old, pw);
        } else {
          await authApi.changePassword(old, pw);
        }
        setOld('');
        setPw('');
        setPw2('');
        setSuccess(true);
        onDone();
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  return (
    <Screen>
      {mode === 'initial' ? (
        <Text style={[font.body, styles.intro]}>For your security, please set a new password before continuing.</Text>
      ) : null}
      {error ? <Banner message={error} tone="danger" /> : null}
      {success ? <Banner message="Password changed." tone="success" /> : null}
      <TextField label="Current password" value={old} onChangeText={setOld} secureToggle autoCapitalize="none" />
      <TextField label="New password" value={pw} onChangeText={setPw} secureToggle autoCapitalize="none" />
      <TextField label="Confirm new password" value={pw2} onChangeText={setPw2} secureToggle autoCapitalize="none" />
      <Button title="Save password" large loading={busy} disabled={!old || !pw || !pw2} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: 16 },
});
