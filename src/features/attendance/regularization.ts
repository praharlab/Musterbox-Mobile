import { asArray, pickNumber, pickString } from '../../utils/pick';

/**
 * Builds `attendaceLogs` for /attendanceCorrectionRequest/v1/add.
 * Inventory shape: [{logDateTime, direction, attendanceStatus, isChangeLog, shiftID, logId}].
 *
 * The meaning of `attendanceStatus` and where `shiftID` comes from are not documented, so
 * they are copied from the existing log of the same direction (from getAlldata) when present.
 * VERIFY against the web client before enabling FEATURE_REGULARIZATION_SUBMIT in production.
 */
export interface CorrectionInput {
  date: string;
  /** HH:mm, 24h, IST */
  inTime?: string;
  outTime?: string;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(v: string | undefined): boolean {
  return !!v && HHMM.test(v);
}

export function buildCorrectionLogs(input: CorrectionInput, currentLogs: unknown): Array<Record<string, unknown>> {
  const existing = asArray<Record<string, unknown>>(
    Array.isArray(currentLogs) ? currentLogs : (currentLogs as { logs?: unknown })?.logs,
  );
  const byDirection = (dir: 'in' | 'out') =>
    existing.find(l => String(pickString(l, ['direction']) ?? '').toLowerCase() === dir);
  const shiftID = pickNumber(existing[0], ['shiftID', 'shiftId', 'ShiftID']);

  const out: Array<Record<string, unknown>> = [];
  for (const [dir, time] of [
    ['in', input.inTime],
    ['out', input.outTime],
  ] as const) {
    if (!isValidTime(time)) {
      continue;
    }
    const prev = byDirection(dir);
    out.push({
      logDateTime: `${input.date}T${time}:00+05:30`,
      direction: dir,
      attendanceStatus: prev?.attendanceStatus ?? 1,
      isChangeLog: true,
      shiftID: pickNumber(prev, ['shiftID', 'shiftId']) ?? shiftID ?? null,
      logId: pickNumber(prev, ['logId', 'attendanceLogsID', 'id']) ?? null,
    });
  }
  return out;
}
