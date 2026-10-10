import { api } from './index';
import { EP } from './endpoints';
import type { LegacyEnvelope } from './envelope';
import { legacyPageParams, toPage } from './pagination';
import { requireIdentity } from '../auth/identity';
import type { AttendanceStatusBody, AttendanceSummary, CalendarDay, PunchLog } from '../types/api';

export type PunchAction = 'checkIn' | 'resume' | 'checkOut';

export interface PunchInput {
  action: PunchAction;
  latitude: string;
  longitude: string;
  address: string;
  /** Raw base64 without a data: prefix, or '' when no selfie is required. */
  photoBase64: string;
}

/**
 * Builds the attendanceApi body exactly as the handover documents (§9.5/§9.6).
 * The acting user comes from the session; the server stamps the time.
 */
export function buildPunchBody(input: PunchInput, userMasterID: number): Record<string, unknown> {
  const body: Record<string, unknown> = {
    userMasterID,
    direction: input.action === 'checkOut' ? 'out' : 'in',
    // The key really is misspelled on the server. Always "mobile" (never "web": that skips geofencing).
    attendnaceFrom: 'mobile',
    // NOT NULL columns in attendancelogs: send '' rather than omitting.
    latitude: input.latitude ?? '',
    longitude: input.longitude ?? '',
    address: input.address ?? '',
    photo: (input.photoBase64 ?? '').replace(/^data:[^;]+;base64,/, ''),
    createBy: userMasterID,
    createByIp: '',
  };
  if (input.action !== 'checkOut') {
    // JSON boolean: true = new day, false = resume after a break.
    body.newpunchin = input.action === 'checkIn';
  }
  return body;
}

export const attendanceApi = {
  todayStatus() {
    const { userMasterID } = requireIdentity();
    return api.post<AttendanceStatusBody>(EP.attendance.status, { userMasterID });
  },

  punch(input: PunchInput) {
    const { userMasterID } = requireIdentity();
    return api.post<LegacyEnvelope<unknown>>(EP.attendance.punch, buildPunchBody(input, userMasterID));
  },

  calendar(start: string, end: string) {
    const { userMasterID } = requireIdentity();
    // Always userMasterID, never the `userid` alias (which bypasses scope checks).
    return api.post<LegacyEnvelope<CalendarDay[]>>(EP.attendance.calendar, {
      userMasterID,
      calendarstartdate: start,
      calendarenddate: end,
    });
  },

  summary(start: string, end: string) {
    const { userMasterID } = requireIdentity();
    return api.get<LegacyEnvelope<AttendanceSummary>>(EP.attendance.summary, {
      startdate: start,
      enddate: end,
      userMasterID,
    });
  },

  dayLogs(date: string) {
    const { userMasterID } = requireIdentity();
    return api.post<LegacyEnvelope<PunchLog[]>>(EP.attendance.dayLogs, { userMasterID, attendanceDate: date });
  },

  /** Client-side face gate only; the result is not bound to the punch on the server. */
  faceCheck(base64: string) {
    const { userMasterID } = requireIdentity();
    return api.post<LegacyEnvelope<unknown>>(EP.attendance.faceCheck, { userFace: base64, userMasterID });
  },

  // ---- Regularization ----
  correctionReasons() {
    return api.post<LegacyEnvelope<Array<Record<string, unknown>>>>(EP.attendance.correctionReasons, {});
  },

  correctionCurrentLogs(date: string) {
    const { userMasterID } = requireIdentity();
    return api.get<LegacyEnvelope<unknown>>(EP.attendance.correctionCurrentLogs, { userMasterID, date });
  },

  addCorrection(input: { date: string; remark: string; reasonId: number; logs: Array<Record<string, unknown>> }) {
    const { userMasterID } = requireIdentity();
    return api.post<LegacyEnvelope<unknown>>(EP.attendance.correctionAdd, {
      userMasterID,
      AttendanceDate: input.date,
      remark: input.remark,
      attendaceLogs: input.logs,
      correctionStatus: 2,
      attendanceCorrectionReasonID: input.reasonId,
    });
  },

  async myCorrections(page: number, start: string, end: string) {
    const { userMasterID } = requireIdentity();
    const body = await api.post<LegacyEnvelope<Array<Record<string, unknown>>>>(EP.attendance.correctionMine, {
      ...legacyPageParams(page),
      userMasterID,
      startDate: start,
      endDate: end,
    });
    return toPage(body.data, page, body.totalcount);
  },
};
