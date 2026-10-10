import { api } from './index';
import { EP } from './endpoints';
import type { LegacyEnvelope } from './envelope';
import { requireIdentity } from '../auth/identity';
import type {
  CelebrationRow,
  DashboardCheckData,
  FinalPermissionBody,
  MobileLoginData,
  RolePermissionRow,
} from '../types/api';

export interface LoginInput {
  phone: string;
  password: string;
  firebaseToken?: string;
  uniqueID?: string;
}

export type LoginBody = LegacyEnvelope<MobileLoginData> & { Permission?: RolePermissionRow[] };

export const authApi = {
  login(input: LoginInput) {
    return api.post<LoginBody>(EP.auth.mobileLogin, { ...input }, { anonymous: true });
  },

  /** App bootstrap: version gate, subscription gate, FCM token save, attendance policy. */
  dashboardCheck(input: { deviceType: 'android' | 'ios'; appVersion: string; firebaseToken?: string }) {
    const { userMasterID } = requireIdentity();
    return api.post<LegacyEnvelope<DashboardCheckData>>(EP.auth.dashboardCheck, {
      userMasterID,
      deviceType: input.deviceType,
      appVersion: input.appVersion,
      FirebaseToken: input.firebaseToken ?? '',
    });
  },

  finalCheckPermission() {
    const { userMasterID } = requireIdentity();
    return api.post<FinalPermissionBody>(EP.auth.finalCheckPermission, { userMasterID });
  },

  /** Forced first-login change (resetpassword == 1). Endpoint has no VT; we still send the token. */
  changeInitialPassword(oldPassword: string, newPassword: string) {
    const { userMasterID } = requireIdentity();
    return api.post<LegacyEnvelope<unknown>>(EP.auth.resetPasswordFirstLogin, {
      userMasterID,
      password: oldPassword,
      newpassword: newPassword,
    });
  },

  changePassword(oldPassword: string, newPassword: string) {
    const { userMasterID } = requireIdentity();
    return api.post<LegacyEnvelope<unknown>>(EP.auth.changePassword, {
      userMasterID,
      password: oldPassword,
      newpassword: newPassword,
    });
  },

  /** Only clears the server-side FCM token. The JWT is not revoked (backend limitation). */
  logout() {
    const { userMasterID } = requireIdentity();
    return api.post<LegacyEnvelope<unknown>>(EP.auth.logout, { userMasterID });
  },

  // --- Forgot password: SMS (MARS) flow only. The email flow (/auth/v1/forgot) returns the
  // OTP in the response and is intentionally NOT used. Gated by FEATURE_FORGOT_PASSWORD.
  sendResetOtp(mobile: string) {
    return api.post<LegacyEnvelope<{ mobile: string }>>(EP.auth.forgotSmsOtp, { mobile }, { anonymous: true });
  },
  verifyResetOtp(mobile: string, otp: string) {
    return api.post<LegacyEnvelope<{ verified: boolean }>>(
      EP.auth.verifySmsOtp,
      { mobile, passwordToken: otp },
      { anonymous: true },
    );
  },
  /** WARNING: server does not re-check the OTP here (GAP P0-1). */
  resetPassword(mobile: string, newPassword: string) {
    return api.post<LegacyEnvelope<unknown>>(
      EP.auth.resetByMobile,
      { mobile, new_password: newPassword },
      { anonymous: true },
    );
  },

  birthdays() {
    return api.get<LegacyEnvelope<CelebrationRow[]>>(EP.auth.birthdays);
  },
  anniversaries() {
    return api.get<LegacyEnvelope<CelebrationRow[]>>(EP.auth.anniversaries);
  },
};
