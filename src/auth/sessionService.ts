import { authApi } from '../api/auth.api';
import { approvalsApi } from '../api/approvals';
import { teamApi } from '../api/team.api';
import { ApiError, isApiError } from '../api/errors';
import { env } from '../config/env';
import { appVersion, deviceType, deviceUniqueId } from '../device/deviceInfo';
import { push } from '../notifications/push';
import { secureFiles } from '../storage/secureFiles';
import { isTokenExpired, secureStore, StoredSession } from '../storage/secureStore';
import { todayIso } from '../utils/dates';
import { logger } from '../utils/logger';
import { Capabilities, deriveCapabilities, PermissionSet } from './capabilities';
import { setIdentity } from './identity';
import type { DashboardCheckData } from '../types/api';

/**
 * Non-React session logic, kept separate from AuthProvider so it can be unit-tested.
 * The JWT lives in memory here and in the Keychain; nowhere else.
 */
let token: string | null = null;

export function currentToken(): string | null {
  return token;
}

function activate(session: StoredSession): void {
  token = session.token;
  setIdentity({ userMasterID: session.userMasterID, companyMasterID: session.companyMasterID });
}

function deactivate(): void {
  token = null;
  setIdentity(null);
}

export async function restoreSession(): Promise<StoredSession | null> {
  const stored = await secureStore.loadSession();
  if (!stored) {
    return null;
  }
  if (isTokenExpired(stored.token)) {
    await secureStore.clearSession();
    return null;
  }
  activate(stored);
  return stored;
}

export async function signIn(phone: string, password: string): Promise<StoredSession> {
  const [firebaseToken, uniqueID] = await Promise.all([push.getToken(), deviceUniqueId()]);
  const body = await authApi.login({ phone: phone.trim(), password, firebaseToken, uniqueID });
  const d = body.data;
  if (!d?.token || !Number.isFinite(Number(d.userid)) || !Number.isFinite(Number(d.companyid))) {
    throw new ApiError('server', 'Unexpected login response.');
  }
  const session: StoredSession = {
    token: d.token,
    userMasterID: Number(d.userid),
    companyMasterID: Number(d.companyid),
    firstName: d.firstname ?? '',
    lastName: d.lastname ?? '',
    email: d.email ?? '',
    userNumber: d.userNumber ?? '',
    mustChangePassword: Number(d.resetpassword) === 1,
    savedAt: Date.now(),
  };
  await secureStore.saveSession(session);
  await secureFiles.purgeAll();
  activate(session);
  return session;
}

export async function markPasswordChanged(session: StoredSession): Promise<StoredSession> {
  const updated = { ...session, mustChangePassword: false };
  await secureStore.saveSession(updated);
  return updated;
}

export interface BootstrapResult {
  bootstrap: DashboardCheckData | null;
  permissions: PermissionSet;
  capabilities: Capabilities;
}

/**
 * Runs after login and on every app start: dashboardcheck (version/subscription gate
 * and FCM token save) then permissions and manager/approver probes.
 * Throws forceUpdate / accountInactive / sessionExpired errors for the caller to route.
 */
export async function bootstrap(): Promise<BootstrapResult> {
  const firebaseToken = await push.getToken();
  const check = await authApi.dashboardCheck({ deviceType: deviceType(), appVersion: appVersion(), firebaseToken });

  const [perm, manager, approver] = await Promise.allSettled([
    authApi.finalCheckPermission(),
    teamApi.hasDirectReports(todayIso()),
    approvalsApi.isApprover(),
  ]);
  const hardFailure = [perm, manager, approver].find(
    r => r.status === 'rejected' && isApiError(r.reason) && r.reason.kind === 'sessionExpired',
  ) as PromiseRejectedResult | undefined;
  if (hardFailure) {
    throw hardFailure.reason;
  }

  const permissions = PermissionSet.fromResponse(perm.status === 'fulfilled' ? perm.value : null);
  const bootstrapData = check.data ?? null;
  return {
    bootstrap: bootstrapData,
    permissions,
    capabilities: deriveCapabilities({
      permissions,
      bootstrap: bootstrapData,
      isManager: manager.status === 'fulfilled' && manager.value,
      isApprover: approver.status === 'fulfilled' && approver.value,
      features: env.features,
    }),
  };
}

/**
 * Logout: best-effort server call (it only clears the FCM token; the JWT is not revoked),
 * then always wipe local secrets and cached documents.
 */
export async function signOut(opts: { callServer: boolean }): Promise<void> {
  if (opts.callServer && token) {
    await authApi.logout().catch(e => logger.error('logout call failed', e));
  }
  await Promise.all([secureStore.clearSession(), secureFiles.purgeAll(), push.deleteToken()]);
  deactivate();
}
