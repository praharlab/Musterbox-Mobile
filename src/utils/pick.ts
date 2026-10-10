/**
 * Defensive readers for response rows whose shape the inventory does not document.
 * Only ever read a whitelisted set of candidate keys - never render a row generically,
 * because several list endpoints also return password hashes and FCM tokens (H4).
 */
export function pickString(row: unknown, keys: string[]): string | undefined {
  if (!row || typeof row !== 'object') {
    return undefined;
  }
  const r = row as Record<string, unknown>;
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'string' && v.trim() !== '') {
      return v;
    }
    if (typeof v === 'number') {
      return String(v);
    }
  }
  return undefined;
}

export function pickNumber(row: unknown, keys: string[]): number | undefined {
  if (!row || typeof row !== 'object') {
    return undefined;
  }
  const r = row as Record<string, unknown>;
  for (const k of keys) {
    const n = Number(r[k]);
    if (r[k] !== null && r[k] !== undefined && r[k] !== '' && Number.isFinite(n)) {
      return n;
    }
  }
  return undefined;
}

/** Reads a nested value like pickPath(row, ['userMaster', 'displayName']). */
export function pickPath(row: unknown, path: string[]): unknown {
  let cur: unknown = row;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

export function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/** Shows only the last 4 characters of an identifier (document numbers, phones). */
export function maskTail(value?: string | null, visible = 4): string {
  if (!value) {
    return '—';
  }
  if (value.length <= visible) {
    return value;
  }
  return `${'•'.repeat(Math.min(8, value.length - visible))}${value.slice(-visible)}`;
}
