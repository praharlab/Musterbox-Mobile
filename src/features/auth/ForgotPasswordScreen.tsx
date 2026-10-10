import React, { useState } from 'react';
import { Text } from 'react-native';
import { authApi } from '../../api/auth.api';
import { ApiError, errorMessage } from '../../api/errors';
import { Banner, Button, Screen, TextField } from '../../components/ui';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import { font } from '../../theme';
import { passwordProblem } from './passwordRules';

/**
 * SMS OTP reset (forgotpasswordOtpMARS -> checkPasswordTokenMARS -> reset).
 * Only reachable when FEATURE_FORGOT_PASSWORD=true, because the backend's final
 * /auth/v1/reset call does not re-verify the OTP (docs/BACKEND_GAPS.md, P0-1).
 * The email flow (/auth/v1/forgot) is never used: it returns the OTP in the response.
 */
type Step = 'mobile' | 'otp' | 'password' | 'done';

export function ForgotPasswordScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>('mobile');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string>();
  const { run, busy } = useSubmitGuard();

  const act = (fn: () => Promise<void>) =>
    run(async () => {
      setError(undefined);
      try {
        await fn();
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  return (
    <Screen>
      {error ? <Banner message={error} tone="danger" /> : null}
      {step === 'mobile' && (
        <>
          <Text style={font.body}>Enter your registered mobile number. We will send a one-time code by SMS.</Text>
          <TextField label="Mobile number" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" />
          <Button
            title="Send code"
            loading={busy}
            disabled={mobile.trim().length < 6}
            onPress={() =>
              act(async () => {
                await authApi.sendResetOtp(mobile.trim());
                setStep('otp');
              })
            }
          />
        </>
      )}
      {step === 'otp' && (
        <>
          <Text style={font.body}>Enter the 4-digit code sent to your phone. It is valid for 10 minutes.</Text>
          <TextField
            label="Code"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
          />
          <Button
            title="Verify"
            loading={busy}
            disabled={otp.length < 4}
            onPress={() =>
              act(async () => {
                const res = await authApi.verifyResetOtp(mobile.trim(), otp);
                if (!res.data?.verified) {
                  throw new ApiError('validation', 'The code is incorrect or expired.');
                }
                setOtp('');
                setStep('password');
              })
            }
          />
        </>
      )}
      {step === 'password' && (
        <>
          <TextField label="New password" value={pw} onChangeText={setPw} secureToggle autoCapitalize="none" />
          <TextField
            label="Confirm new password"
            value={pw2}
            onChangeText={setPw2}
            secureTextEntry
            autoCapitalize="none"
          />
          <Button
            title="Set password"
            loading={busy}
            onPress={() =>
              act(async () => {
                const problem = passwordProblem(pw, pw2);
                if (problem) {
                  throw new ApiError('validation', problem);
                }
                await authApi.resetPassword(mobile.trim(), pw);
                setPw('');
                setPw2('');
                setStep('done');
              })
            }
          />
        </>
      )}
      {step === 'done' && (
        <>
          <Banner message="Your password has been changed. Sign in with the new password." tone="success" />
          <Button title="Back to sign in" onPress={onDone} />
        </>
      )}
    </Screen>
  );
}
