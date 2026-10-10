import type { DashboardCheckData, FinalPermissionBody } from '../types/api';
import type { EnvConfig } from '../config/env';

/**
 * What this user may see in the app, derived from what the backend reports.
 *
 * "Manager" is not a user type in this backend (handover §3.2): it is data.
 *  - isManager  = someone reports to me (reportstoImmediateChild returns a child)
 *  - isApprover = I am configured as an approver (getAuthList non-empty)
 * Role rights from finalcheckpermission are UI-only; the server does not enforce them.
 */
export type NavigationMode = 'employee' | 'manager';

export interface Capabilities {
  mode: NavigationMode;
  isManager: boolean;
  isApprover: boolean;
  attendance: boolean;
  /** Mobile punching allowed (not a biometric-only employee, policy allows mobile). */
  canPunchFromMobile: boolean;
  selfieRequired: boolean;
  faceCheckRequired: boolean;
  /** Policy lets the employee punch outside the geofence. */
  outsideAllowed: boolean;
  leave: boolean;
  payslip: boolean;
  notifications: boolean;
  profile: boolean;
  birthdays: boolean;
  anniversaries: boolean;
  team: boolean;
  approvals: boolean;
  approvalDecisions: boolean;
  tasks: boolean;
  regularizationSubmit: boolean;
}

/**
 * Feature -> formMaster.formName values that grant it. Only names confirmed in the
 * handover are listed; features without a confirmed name are not permission-gated
 * (they are self-service for every tenant user). Extend when HR confirms form names.
 */
export const PERMISSION_FORMS = {
  attendance: ['Attendance'],
  leave: ['Leave'],
  birthdays: ['BirthdayList'],
  anniversaries: ['WorkAnniversaryList'],
} as const;

export class PermissionSet {
  private readonly forms: Set<string>;
  constructor(readonly known: boolean, formNames: string[] = []) {
    this.forms = new Set(formNames.map(f => f.toLowerCase()));
  }
  static fromResponse(body: FinalPermissionBody | null | undefined): PermissionSet {
    if (!body) {
      return new PermissionSet(false);
    }
    const names = [...(body.master ?? []), ...(body.data ?? []).map(d => d.formName)].filter(
      (n): n is string => typeof n === 'string',
    );
    return new PermissionSet(names.length > 0, names);
  }
  /**
   * When the permission list could not be loaded we do not hide features:
   * UI gating is a convenience, the server stays the security boundary.
   */
  allows(formNames: readonly string[]): boolean {
    if (!this.known) {
      return true;
    }
    return formNames.some(f => this.forms.has(f.toLowerCase()));
  }
}

export interface CapabilityInputs {
  permissions: PermissionSet;
  bootstrap: DashboardCheckData | null;
  isManager: boolean;
  isApprover: boolean;
  features: EnvConfig['features'];
}

export function deriveCapabilities(input: CapabilityInputs): Capabilities {
  const { permissions, bootstrap, isManager, isApprover, features } = input;
  const policy = bootstrap?.attendancepolicy ?? null;
  const attendance = permissions.allows(PERMISSION_FORMS.attendance);
  const canPunchFromMobile =
    attendance && bootstrap?.attendanceFrom !== 'biometric' && Number(policy?.attendanceInMobile ?? 1) !== 0;

  return {
    mode: isManager || isApprover ? 'manager' : 'employee',
    isManager,
    isApprover,
    attendance,
    canPunchFromMobile,
    selfieRequired: Number(policy?.selfieAttendance ?? 0) === 1,
    faceCheckRequired: Number(policy?.selfieWithFaceDetection ?? 0) === 1,
    outsideAllowed: Number(policy?.outsidePunchInPunchOut ?? 0) === 1,
    leave: permissions.allows(PERMISSION_FORMS.leave),
    payslip: true,
    notifications: true,
    profile: true,
    birthdays: permissions.allows(PERMISSION_FORMS.birthdays),
    anniversaries: permissions.allows(PERMISSION_FORMS.anniversaries),
    team: isManager,
    approvals: isApprover,
    approvalDecisions: isApprover && features.approvalDecisions,
    tasks: isManager || isApprover,
    regularizationSubmit: attendance && features.regularizationSubmit,
  };
}

export interface TabSpec {
  name: string;
  label: string;
}

/** The tab bar for a user. Features the backend reports as unavailable are omitted. */
export function tabsFor(c: Capabilities): TabSpec[] {
  const tabs: Array<TabSpec & { show: boolean }> =
    c.mode === 'manager'
      ? [
          { name: 'HomeTab', label: 'Home', show: true },
          { name: 'TeamTab', label: 'Team', show: c.team },
          { name: 'ApprovalsTab', label: 'Approvals', show: c.approvals },
          { name: 'AttendanceTab', label: 'Attendance', show: c.attendance },
          { name: 'TasksTab', label: 'Tasks', show: c.tasks },
          { name: 'ProfileTab', label: 'Profile', show: c.profile },
        ]
      : [
          { name: 'HomeTab', label: 'Home', show: true },
          { name: 'AttendanceTab', label: 'Attendance', show: c.attendance },
          { name: 'LeaveTab', label: 'Leave', show: c.leave },
          { name: 'PayslipTab', label: 'Payslip', show: c.payslip },
          { name: 'NotificationsTab', label: 'Alerts', show: c.notifications },
          { name: 'ProfileTab', label: 'Profile', show: c.profile },
        ];
  return tabs.filter(t => t.show).map(({ name, label }) => ({ name, label }));
}
