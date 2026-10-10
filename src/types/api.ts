/**
 * Typed models for backend responses, derived from docs/mobile-api-inventory.json
 * and the examples in docs/mobile-backend-handover.md §9.
 *
 * Where the inventory does not document a response shape, the type says so with
 * `// shape unverified` and the consuming code reads fields defensively.
 */

// ---------- Auth ----------
export interface MobileLoginData {
  token: string;
  companyid: number;
  userid: number;
  firstname: string;
  middlename?: string;
  lastname: string;
  userNumber: string;
  email: string;
  /** 1 = the user must change the password before continuing. */
  resetpassword: 0 | 1 | number;
}

export interface RolePermissionRow {
  rolePermissionID: number;
  formMaster?: { formName: string };
  operation?: { operationName: string };
}

export type AttendanceFrom = 'mobile' | 'biometric' | 'mobileandbiometric' | null;

export interface AttendancePolicy {
  attendancePolicyID?: number;
  selfieAttendance?: number;
  selfieWithFaceDetection?: number;
  outsidePunchInPunchOut?: number;
  singleMultiplePunchInPunchOut?: string;
  attendanceInMobile?: number;
  missPunchMinutes?: number;
  attBrType?: string;
}

export interface DashboardCheckData {
  tracking: boolean;
  trackingInterval?: number;
  statusMonitoring?: number;
  expensesubmittedindays?: number;
  attendancepolicy: AttendancePolicy | null;
  biometricSerialNo?: string | null;
  biometricCode?: string | null;
  attendanceFrom: AttendanceFrom;
  customizeProfileFields: string[];
}

export interface PermissionEntry {
  formName: string;
  formMasterID: number;
  operationName: string[];
}

export interface FinalPermissionBody {
  status: number;
  master?: string[];
  data?: PermissionEntry[];
}

export interface CelebrationRow {
  // shape unverified
  [k: string]: unknown;
}

// ---------- Profile ----------
export interface ProfileSummary {
  name?: string;
  firstName?: string;
  lastName?: string;
  userNumber?: string;
  email?: string;
  dob?: string;
  employeeCode?: string;
  /** Full photo URL (public). */
  profile?: string;
  isPhotoLock?: number;
  companyName?: string;
  designation?: string;
  department?: string;
  branch?: string;
  address?: {
    houseNumber?: string;
    houseName?: string;
    landmark?: string;
    area?: string;
    zipcode?: string;
    city?: string;
  };
}

export interface ManagerRow {
  userMasterID: number;
  companyMasterID?: number;
  companyName?: string;
  name?: string;
  mobile?: string;
  photo?: string;
}

// ---------- Attendance ----------
export interface PunchLog {
  logDateTime: string;
  direction: 'in' | 'out' | string;
  address?: string;
}

export interface AttendanceStatusBody {
  status: number;
  data: { In_Data: PunchLog | null; Out_Data: PunchLog | null };
  continuePunchIN?: boolean;
}

export interface CalendarDay {
  date: string;
  title: string;
  inTime?: string | null;
  outTime?: string | null;
  shift?: string | null;
  shiftName?: string | null;
  shiftInTime?: string | null;
  shiftOutTime?: string | null;
  shiftHours?: string | null;
  inHours?: string | null;
  outHours?: string | null;
  lateBy?: string | null;
  earlyBy?: string | null;
  penalty?: unknown;
  branchName?: string | null;
  otStatus?: unknown;
  remarks?: string | null;
}

export interface AttendanceSummary {
  presentDays?: number;
  lateDays?: number;
  earlyDays?: number;
  absentDays?: number;
  leaveDays?: number;
  missPunchDays?: number;
  weekoffValue?: number;
  holidayValue?: number;
  totalDaysInMonth?: number;
  totalWorkingDays?: number;
}

// ---------- Leave ----------
export interface LeaveBalanceRow {
  leaveName: string;
  LeaveDesc: string;
  LeaveTranId: number;
  Leave_CF?: string;
  LeaveID: number;
  Balance: number;
}

/** authorizationStatus: 0 no approver, 1/2 pending, 3 approved, 4 rejected, 5 cancelled. */
export type AuthorizationStatus = 0 | 1 | 2 | 3 | 4 | 5 | number;

export interface LeaveApplication {
  UserLeaveApplicationID: number;
  FromDate: string;
  ToDate: string;
  LeaveDays: number;
  DayType?: string;
  Remark?: string;
  authorizationStatus: AuthorizationStatus;
  attachment?: string | null;
  createdAt?: string;
  hrLeaveType?: { LeaveMaster?: { LeaveName?: string } };
  userLeaveTransactions?: unknown[];
  approvedLeaveAuthorizations?: Array<Record<string, unknown>>;
}

export interface LeaveApprovers {
  Auth_Criteria?: { Criteria?: string };
  Auth_person?: Array<{ userMasterID: number; userName?: string; Number?: string; picture?: string }>;
}

// ---------- Payslip ----------
export interface GeneratorPayslip {
  yearMonth: string;
  payrollFrequency?: string;
  startDate?: string;
  endDate?: string;
  /** Relative path under the public uploads dir, e.g. uploads/PaySlips/<c>/<f>.pdf */
  path: string;
}

export interface MainPayslip {
  userMasterID: number;
  salaryYYYYMM: string;
  salarySlipIssue: 0 | 1 | number;
  paid?: boolean;
  /** base64 PDF */
  path?: string;
}

// ---------- Notifications ----------
export interface InboxItem {
  id: number;
  activityTable: string;
  activityTablePK: number;
  message: string;
  companyMasterID?: number;
  assignedTo?: number;
  assignedBy?: number;
  createdAt: string;
}

export interface AnnouncementRow {
  // shape unverified; read with pick()
  [k: string]: unknown;
}

// ---------- Team ----------
export interface TeamMember {
  reportToID: number;
  userMasterID: number;
  employee?: {
    displayName?: string;
    userNumber?: string;
    photo?: string;
    employeeDesignations?: Array<{ designation?: { designationName?: string } }>;
    employeeDepartments?: Array<{ department?: { departmentName?: string } }>;
    employeeBranches?: Array<{ branchMaster?: { branchName?: string } }>;
    attendanceTransactions?: Array<{
      AttendanceTransID?: number;
      InDatetime?: string | null;
      OutDateTime?: string | null;
      fulldayhalfday?: string | null;
    }>;
  };
}

export interface TeamBody {
  status: number;
  childCount?: number;
  totalcount?: number;
  data: { currentUser?: unknown; child: TeamMember[] };
}

export interface PendingCounts {
  leaveCount?: number;
  OTcount?: number;
  expenseAuthorizationsCount?: number;
  [k: string]: unknown;
}

// ---------- Tasks ----------
export interface TaskRow {
  // shape partially unverified
  user_TasksID: number;
  TaskName?: string;
  TaskDesc?: string;
  priority?: string;
  endDate?: string;
  taskStatus?: number;
  [k: string]: unknown;
}

export interface TaskCounts {
  pending?: number;
  accepted?: number;
  rejected?: number;
  completed?: number;
}
