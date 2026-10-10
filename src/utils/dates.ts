/**
 * The backend stores and compares dates in IST (+05:30). All "today" / month
 * boundaries are computed in IST regardless of the device timezone.
 */
const IST_OFFSET_MIN = 330;

function istParts(d: Date) {
  const ist = new Date(d.getTime() + (IST_OFFSET_MIN + d.getTimezoneOffset()) * 60000);
  return { y: ist.getFullYear(), m: ist.getMonth() + 1, day: ist.getDate(), h: ist.getHours(), min: ist.getMinutes() };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD in IST */
export function isoDate(d: Date = new Date()): string {
  const p = istParts(d);
  return `${p.y}-${pad(p.m)}-${pad(p.day)}`;
}

export function todayIso(): string {
  return isoDate(new Date());
}

/** YYYYMM for payroll. */
export function yyyymm(year: number, month: number): string {
  return `${year}${pad(month)}`;
}

export function monthRange(year: number, month: number): { start: string; end: string } {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(last)}` };
}

export function currentYearMonth(): { year: number; month: number } {
  const p = istParts(new Date());
  return { year: p.y, month: p.m };
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

/** "202608" -> "Aug 2026" */
export function yyyymmLabel(value: string): string {
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(4, 6));
  return y && m ? monthLabel(y, m) : value;
}

/** "2026-10-05" -> "05 Oct 2026" */
export function formatDate(value?: string | null): string {
  if (!value) {
    return '—';
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) {
    return value;
  }
  return `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** ISO datetime -> "09:02 AM" in IST */
export function formatTime(value?: string | null): string {
  if (!value) {
    return '—';
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value;
  }
  const p = istParts(d);
  const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
  return `${pad(h12)}:${pad(p.min)} ${p.h < 12 ? 'AM' : 'PM'}`;
}

/** Inclusive calendar days between two YYYY-MM-DD dates (0 when invalid). */
export function daysInclusive(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) {
    return 0;
  }
  return Math.round((b - a) / 86400000) + 1;
}

/** Every YYYY-MM-DD from `from` to `to` inclusive. */
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const n = daysInclusive(from, to);
  const start = Date.parse(`${from}T00:00:00Z`);
  for (let i = 0; i < n; i++) {
    out.push(new Date(start + i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

export function greeting(d: Date = new Date()): string {
  const h = istParts(d).h;
  if (h < 12) {
    return 'Good morning';
  }
  if (h < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}
