import { useCallback, useRef, useState } from 'react';

/**
 * Prevents duplicate submissions: a second tap while a submission is in flight is ignored
 * (a ref, not state, so two taps in the same frame cannot both pass).
 * The backend has no idempotency keys, so this is the only duplicate protection.
 */
export function useSubmitGuard() {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current) {
      return undefined;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);

  return { run, busy };
}
