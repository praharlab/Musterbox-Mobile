import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { configureApiSession } from '../api';
import { ApiError, errorMessage, isApiError } from '../api/errors';
import { push } from '../notifications/push';
import { secureFiles } from '../storage/secureFiles';
import type { StoredSession } from '../storage/secureStore';
import { logger } from '../utils/logger';
import type { Capabilities } from './capabilities';
import {
  bootstrap as runBootstrap,
  BootstrapResult,
  currentToken,
  markPasswordChanged,
  restoreSession,
  signIn as serviceSignIn,
  signOut as serviceSignOut,
} from './sessionService';

export type AuthStatus =
  | { kind: 'loading' }
  | { kind: 'signedOut'; notice?: string }
  | { kind: 'mustChangePassword'; session: StoredSession }
  | { kind: 'bootstrapping'; session: StoredSession }
  | { kind: 'bootstrapError'; session: StoredSession; message: string }
  | { kind: 'forceUpdate'; message: string }
  | { kind: 'accountInactive'; message: string }
  | { kind: 'signedIn'; session: StoredSession; boot: BootstrapResult };

interface AuthContextValue {
  status: AuthStatus;
  signIn(phone: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  passwordChanged(): Promise<void>;
  retryBootstrap(): Promise<void>;
  refreshCapabilities(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, queryClient }: { children: React.ReactNode; queryClient: QueryClient }) {
  const [status, setStatus] = useState<AuthStatus>({ kind: 'loading' });
  const statusRef = useRef(status);
  statusRef.current = status;

  const endSession = useCallback(
    async (notice?: string, callServer = false) => {
      await serviceSignOut({ callServer });
      // Never keep another user's data in memory.
      queryClient.clear();
      setStatus({ kind: 'signedOut', notice });
    },
    [queryClient],
  );

  const boot = useCallback(
    async (session: StoredSession) => {
      if (session.mustChangePassword) {
        setStatus({ kind: 'mustChangePassword', session });
        return;
      }
      setStatus({ kind: 'bootstrapping', session });
      try {
        const result = await runBootstrap();
        setStatus({ kind: 'signedIn', session, boot: result });
      } catch (e) {
        if (isApiError(e) && e.kind === 'forceUpdate') {
          setStatus({ kind: 'forceUpdate', message: e.message });
        } else if (isApiError(e) && e.kind === 'accountInactive') {
          await serviceSignOut({ callServer: false });
          setStatus({ kind: 'accountInactive', message: e.message });
        } else if (isApiError(e) && e.kind === 'sessionExpired') {
          await endSession('Your session has expired. Please sign in again.');
        } else {
          setStatus({ kind: 'bootstrapError', session, message: errorMessage(e) });
        }
      }
    },
    [endSession],
  );

  useEffect(() => {
    configureApiSession({
      getToken: currentToken,
      onSessionExpired: () => {
        if (statusRef.current.kind !== 'signedOut') {
          endSession('Your session has expired. Please sign in again.').catch(() => undefined);
        }
      },
      onForceUpdate: message => setStatus({ kind: 'forceUpdate', message }),
    });
  }, [endSession]);

  useEffect(() => {
    (async () => {
      await secureFiles.purgeStale();
      const session = await restoreSession();
      if (session) {
        await boot(session);
      } else {
        setStatus({ kind: 'signedOut' });
      }
    })().catch(e => {
      logger.error('startup failed', e);
      setStatus({ kind: 'signedOut' });
    });
  }, [boot]);

  // Re-register the FCM token with the backend when Firebase rotates it.
  useEffect(() => {
    return push.onTokenRefresh(() => {
      if (statusRef.current.kind === 'signedIn') {
        runBootstrap().catch(() => undefined);
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      async signIn(phone, password) {
        const session = await serviceSignIn(phone, password);
        await boot(session);
      },
      async signOut() {
        await endSession(undefined, true);
      },
      async passwordChanged() {
        const s = statusRef.current;
        if (s.kind === 'mustChangePassword') {
          await boot(await markPasswordChanged(s.session));
        }
      },
      async retryBootstrap() {
        const s = statusRef.current;
        if (s.kind === 'bootstrapError') {
          await boot(s.session);
        }
      },
      async refreshCapabilities() {
        const s = statusRef.current;
        if (s.kind === 'signedIn') {
          try {
            setStatus({ kind: 'signedIn', session: s.session, boot: await runBootstrap() });
          } catch (e) {
            if (!(e instanceof ApiError)) {
              logger.error('refreshCapabilities failed', e);
            }
          }
        }
      },
    }),
    [status, boot, endSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}

/** For screens rendered only when signed in. */
export function useSession(): { session: StoredSession; capabilities: Capabilities; boot: BootstrapResult } {
  const { status } = useAuth();
  if (status.kind !== 'signedIn') {
    throw new Error('useSession used outside a signed-in tree');
  }
  return { session: status.session, capabilities: status.boot.capabilities, boot: status.boot };
}
