import { attendanceApi, PunchAction } from '../../api/attendance.api';
import { ApiError, errorMessage, isApiError } from '../../api/errors';
import type { Capabilities } from '../../auth/capabilities';
import { captureSelfie } from '../../device/camera';
import { describeFix, getCurrentFix, LocationError } from '../../device/location';
import type { AttendanceStatusBody, PunchLog } from '../../types/api';

export type PunchState =
  | { kind: 'notStarted' }
  | { kind: 'in'; since: PunchLog }
  | { kind: 'completed'; inLog: PunchLog; outLog: PunchLog; canResume: boolean }
  | { kind: 'missedPunchOut'; inLog: PunchLog };

export function derivePunchState(body: AttendanceStatusBody | undefined): PunchState {
  const inLog = body?.data?.In_Data ?? null;
  const outLog = body?.data?.Out_Data ?? null;
  if (!inLog) {
    return { kind: 'notStarted' };
  }
  if (!outLog) {
    return { kind: 'in', since: inLog };
  }
  if (outLog.address === 'Missed Punch Out') {
    return { kind: 'missedPunchOut', inLog };
  }
  // continuePunchIN is read as "a resume (continue punch-in) is allowed" - verify with backend.
  return { kind: 'completed', inLog, outLog, canResume: body?.continuePunchIN === true };
}

export function nextAction(state: PunchState): PunchAction | null {
  switch (state.kind) {
    case 'notStarted':
      return 'checkIn';
    case 'in':
      return 'checkOut';
    case 'completed':
      return state.canResume ? 'resume' : null;
    default:
      return null;
  }
}

export const ACTION_LABEL: Record<PunchAction, string> = {
  checkIn: 'Check in',
  resume: 'Resume work',
  checkOut: 'Check out',
};

export type PunchOutcome =
  | { result: 'accepted'; message: string }
  | { result: 'rejected'; message: string }
  /** The server may or may not have recorded it; the user must check before retrying. */
  | { result: 'unconfirmed'; message: string }
  | { result: 'cancelled' };

/** Did the status move the way `action` should have moved it? */
export function statusReflects(
  action: PunchAction,
  before: AttendanceStatusBody | undefined,
  after: AttendanceStatusBody,
): boolean {
  const b = before?.data;
  const a = after.data;
  if (action === 'checkOut') {
    return !!a?.Out_Data && a.Out_Data.logDateTime !== b?.Out_Data?.logDateTime;
  }
  if (action === 'checkIn') {
    return !!a?.In_Data && a.In_Data.logDateTime !== b?.In_Data?.logDateTime;
  }
  // resume: an open "in" again, or a newer in-log.
  return !!a?.In_Data && (!a.Out_Data || a.In_Data.logDateTime !== b?.In_Data?.logDateTime);
}

export interface PunchDeps {
  getFix: typeof getCurrentFix;
  captureSelfie: typeof captureSelfie;
  api: Pick<typeof attendanceApi, 'punch' | 'todayStatus' | 'faceCheck'>;
}

const defaultDeps: PunchDeps = { getFix: getCurrentFix, captureSelfie, api: attendanceApi };

/**
 * The full check-in/check-out flow (handover §11.2):
 *   location -> selfie (if policy) -> face check (if policy, client-side only) -> punch.
 * A timeout or dropped connection is NOT reported as failure: the status is re-read
 * from the server to tell the user what actually happened.
 */
export async function performPunch(
  action: PunchAction,
  caps: Pick<Capabilities, 'selfieRequired' | 'faceCheckRequired' | 'outsideAllowed'>,
  before: AttendanceStatusBody | undefined,
  deps: PunchDeps = defaultDeps,
): Promise<PunchOutcome> {
  // 1. Location - required for the server-side geofence unless policy allows outside punches.
  let latitude = '';
  let longitude = '';
  let address = '';
  try {
    const fix = await deps.getFix();
    latitude = String(fix.latitude);
    longitude = String(fix.longitude);
    address = describeFix(fix);
  } catch (e) {
    if (!caps.outsideAllowed) {
      return { result: 'rejected', message: e instanceof LocationError ? e.message : 'Location is unavailable.' };
    }
  }

  // 2. Selfie
  let photo = '';
  if (caps.selfieRequired || caps.faceCheckRequired) {
    let shot: string | null;
    try {
      shot = await deps.captureSelfie();
    } catch (e) {
      return { result: 'rejected', message: (e as Error).message };
    }
    if (!shot) {
      return { result: 'cancelled' };
    }
    photo = shot;
  }

  // 3. Face match (not bound to the punch on the server - see BACKEND_GAPS).
  if (caps.faceCheckRequired) {
    try {
      await deps.api.faceCheck(photo);
    } catch (e) {
      if (isApiError(e) && e.isUncertain) {
        return { result: 'rejected', message: 'Face verification could not be completed. Check your connection.' };
      }
      return { result: 'rejected', message: errorMessage(e) || 'Face verification failed.' };
    }
  }

  // 4. Punch
  try {
    const res = await deps.api.punch({ action, latitude, longitude, address, photoBase64: photo });
    return { result: 'accepted', message: res.message || `${ACTION_LABEL[action]} recorded.` };
  } catch (e) {
    if (!(e instanceof ApiError) || !e.isUncertain) {
      return { result: 'rejected', message: errorMessage(e) };
    }
  }

  // 5. Uncertain outcome: ask the server what happened.
  try {
    const after = await deps.api.todayStatus();
    if (statusReflects(action, before, after)) {
      return { result: 'accepted', message: `${ACTION_LABEL[action]} recorded (confirmed with server).` };
    }
    return { result: 'rejected', message: `${ACTION_LABEL[action]} was not recorded. Please try again.` };
  } catch {
    return {
      result: 'unconfirmed',
      message:
        'We could not confirm with the server whether this was recorded. Refresh the status before trying again.',
    };
  }
}
