/**
 * Every backend path the app calls, taken verbatim from docs/mobile-api-inventory.json.
 * Paths are relative to API_BASE_URL (no leading slash). Do not add a path here
 * unless it exists in the inventory.
 */
export const EP = {
  auth: {
    mobileLogin: 'auth/v1/mobilelogin',
    dashboardCheck: 'auth/v1/dashboardcheck',
    finalCheckPermission: 'auth/v1/finalcheckpermission',
    resetPasswordFirstLogin: 'auth/v1/resetpassword',
    changePassword: 'auth/v1/changepassword',
    forgotSmsOtp: 'auth/v1/forgotpasswordOtpMARS',
    verifySmsOtp: 'auth/v1/checkPasswordTokenMARS',
    resetByMobile: 'auth/v1/reset',
    logout: 'auth/v1/userLogout',
    birthdays: 'auth/v1/birthday',
    anniversaries: 'auth/v1/anniversary',
    profileMasked: (id: number) => `auth/v1/getprofileWithCutomizeFields/${id}`,
  },
  attendance: {
    status: 'attendanceTransaction/v2/attendancestatus',
    punch: 'attendanceTransaction/v1/attendanceApi',
    calendar: 'attendanceTransaction/v1/getcalenderdatamonthwise',
    summary: 'attendanceTransaction/v1/userAttendanceSummary',
    dayLogs: 'attendanceTransaction/v1/getUserLogDateWise',
    faceCheck: 'empJoining/v1/checkUserFaces',
    correctionReasons: 'attendanceCorrectionReason/v1/list',
    correctionCurrentLogs: 'attendanceCorrection/v1/getAlldata',
    correctionAdd: 'attendanceCorrectionRequest/v1/add',
    correctionMine: 'attendanceCorrectionRequest/v1/getByUserId',
  },
  leave: {
    balance: 'userleave/v1/getUserLeaveBalance',
    apply: 'userleave/v2/bulk/add',
    history: 'userleave/v2/LeaveByUser',
    withdraw: (id: number) => `userleave/v1/delete/${id}`,
    myApprovers: (userId: number) => `leaveauthorizationRequest/v1/leaveAuthCriteria/${userId}`,
  },
  payslip: {
    generatorList: 'paySlipGenerator/v1/getMyPaySlipData',
    mainPdf: 'salaryTrans/v1/getUserWiseSalarySlip',
  },
  notifications: {
    inbox: 'userInbox/v1/getUserInboxData',
    announcements: 'announcement/v1/getbyuserId',
    unreadAnnouncements: 'announcement/v1/countUnreadAnnouncement',
  },
  profile: {
    addresses: (id: number) => `useraddress/v1/getbyuserid/${id}`,
    family: (id: number) => `userfamily/v1/getbyuserid/${id}`,
    education: (id: number) => `usereducation/v1/getbyuserid/${id}`,
    experience: (id: number) => `userexperience/v1/getbyuserid/${id}`,
    documents: (id: number) => `userdocument/v1/getbyuserid/${id}`,
    letters: 'userLetters/v1/getAllUserLetter',
    managers: (id: number) => `reportto/v1/getbyid/${id}`,
  },
  team: {
    immediateChildren: 'reportTo/v1/reportstoImmediateChild',
  },
  approvals: {
    authList: 'AuthorizationDetails/v1/getAuthList',
    pendingCounts: 'leaveauthorizationRequest/v1/countpending',
    leaveList: 'leaveauthorizationRequest/v2/listLeaveAuthRequestNew',
    leaveDetails: (referenceId: number) => `leaveauthorizationRequest/v1/leavedetails/${referenceId}`,
    leaveDecide: 'leaveauthorizationRequest/v1/authorizationacceptreject',
    regularizationList: 'attendanceCorrectionAuthorization/listAttendaceAuthorization',
    regularizationDecide: 'attendanceCorrectionAuthorization/attendancecorrectionauthorizationrequest',
    overtimeList: 'authorizationRequest/v1/viewauthorizationrequestbyuseridforovertime',
    overtimeDecide: 'authorizationRequest/v1/authorizationacceptrejectovertime',
    expenseList: 'authorizationRequest/v3/getExpenseAuthByUser',
    expenseDecide: 'authorizationRequest/v1/authorizationacceptrejectexpenseall',
  },
  tasks: {
    mine: 'user_tasks/v3/getTaskbyUser',
    counts: 'user_tasks/v1/getTaskReport',
    acceptReject: 'user_tasks/v1/TaskAcceptReject',
  },
} as const;

/** Public file locations (served without auth - see docs/BACKEND_GAPS.md, P0-11). */
export const FILE_PATHS = {
  leaveAttachment: (file: string) => `uploads/employee-leave-attachment/${file}`,
  userDocument: (file: string) => `uploads/user/document/${file}`,
  userPhoto: (file: string) => `uploads/user/photo/${file}`,
};
