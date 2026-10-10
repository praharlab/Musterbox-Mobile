import { deriveCapabilities, PermissionSet, tabsFor } from '../src/auth/capabilities';
import type { DashboardCheckData } from '../src/types/api';

const features = { forgotPassword: false, approvalDecisions: true, regularizationSubmit: true };

const boot = (over: Partial<DashboardCheckData> = {}): DashboardCheckData => ({
  tracking: false,
  attendancepolicy: { attendanceInMobile: 1 },
  attendanceFrom: 'mobile',
  customizeProfileFields: [],
  ...over,
});

const perms = (names: string[]) => PermissionSet.fromResponse({ status: 200, master: names });

describe('role-based navigation', () => {
  it('employee sees the employee tabs only', () => {
    const c = deriveCapabilities({
      permissions: perms(['Leave', 'Attendance']),
      bootstrap: boot(),
      isManager: false,
      isApprover: false,
      features,
    });
    expect(tabsFor(c).map(t => t.name)).toEqual([
      'HomeTab',
      'AttendanceTab',
      'LeaveTab',
      'PayslipTab',
      'NotificationsTab',
      'ProfileTab',
    ]);
    expect(c.team).toBe(false);
    expect(c.approvals).toBe(false);
  });

  it('manager with reports and approvals sees the manager tabs', () => {
    const c = deriveCapabilities({
      permissions: perms(['Leave', 'Attendance']),
      bootstrap: boot(),
      isManager: true,
      isApprover: true,
      features,
    });
    expect(tabsFor(c).map(t => t.name)).toEqual([
      'HomeTab',
      'TeamTab',
      'ApprovalsTab',
      'AttendanceTab',
      'TasksTab',
      'ProfileTab',
    ]);
  });

  it('a manager who approves nothing gets no Approvals tab', () => {
    const c = deriveCapabilities({
      permissions: perms(['Attendance']),
      bootstrap: boot(),
      isManager: true,
      isApprover: false,
      features,
    });
    expect(tabsFor(c).map(t => t.name)).not.toContain('ApprovalsTab');
    expect(tabsFor(c).map(t => t.name)).toContain('TeamTab');
  });

  it('an approver without direct reports gets Approvals but no Team tab', () => {
    const c = deriveCapabilities({
      permissions: perms(['Attendance']),
      bootstrap: boot(),
      isManager: false,
      isApprover: true,
      features,
    });
    const names = tabsFor(c).map(t => t.name);
    expect(names).toContain('ApprovalsTab');
    expect(names).not.toContain('TeamTab');
  });
});

describe('permission filtering', () => {
  it('hides Leave when the role has no Leave form', () => {
    const c = deriveCapabilities({
      permissions: perms(['Attendance']),
      bootstrap: boot(),
      isManager: false,
      isApprover: false,
      features,
    });
    expect(c.leave).toBe(false);
    expect(tabsFor(c).map(t => t.name)).not.toContain('LeaveTab');
  });

  it('matches form names case-insensitively', () => {
    expect(perms(['leave']).allows(['Leave'])).toBe(true);
  });

  it('does not hide features when permissions could not be loaded', () => {
    expect(new PermissionSet(false).allows(['Leave'])).toBe(true);
  });

  it('biometric-only employees cannot punch from mobile', () => {
    const c = deriveCapabilities({
      permissions: perms(['Attendance']),
      bootstrap: boot({ attendanceFrom: 'biometric' }),
      isManager: false,
      isApprover: false,
      features,
    });
    expect(c.attendance).toBe(true);
    expect(c.canPunchFromMobile).toBe(false);
  });

  it('policy attendanceInMobile = 0 disables mobile punching', () => {
    const c = deriveCapabilities({
      permissions: perms(['Attendance']),
      bootstrap: boot({ attendancepolicy: { attendanceInMobile: 0 } }),
      isManager: false,
      isApprover: false,
      features,
    });
    expect(c.canPunchFromMobile).toBe(false);
  });

  it('approval decisions follow the feature flag', () => {
    const c = deriveCapabilities({
      permissions: perms([]),
      bootstrap: boot(),
      isManager: false,
      isApprover: true,
      features: { ...features, approvalDecisions: false },
    });
    expect(c.approvals).toBe(true);
    expect(c.approvalDecisions).toBe(false);
  });
});
