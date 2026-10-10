# Backend gaps and contract assumptions

This file lists everything the mobile app **cannot do safely** with the current backend, and every place where the app had to **assume** a response shape the inventory does not document. Section numbers (§) and IDs (C1, H2, P0-3…) refer to `mobile-backend-handover.md`.

The app does not invent endpoints. When something is missing, the feature is hidden, shown read-only, or behind a flag.

## 1. Feature flags that exist because of backend gaps

| Flag (`.env*`) | Default | Why it exists | Turn on in production when |
|---|---|---|---|
| `FEATURE_FORGOT_PASSWORD` | `false` everywhere | `/auth/v1/reset` sets a password for any mobile number with no OTP check (C1). The app would only follow the SMS flow, but the endpoint itself is the hole. | P0-1 is deployed (reset requires a single-use token from `checkPasswordTokenMARS`). |
| `FEATURE_APPROVAL_DECISIONS` | `true` in dev/staging, `false` in production | Accept/reject endpoints do not check that the caller is the approver or that the request is still pending (C5, P0-10). The leave endpoint also trusts a client-built `leavetransaction[]`. | P0-10 is deployed **and** the leave breakdown builder (§3) is checked against the web client. |
| `FEATURE_REGULARIZATION_SUBMIT` | `true` in dev/staging, `false` in production | The `attendaceLogs[]` payload semantics (`attendanceStatus`, `shiftID`) are not documented (§3). | The payload builder is checked against the web client. |

When `FEATURE_APPROVAL_DECISIONS=false`, managers still see pending approvals (read-only) with a banner telling them to decide on the web.

## 2. Features not built because the backend does not support them

| Requested | Status in app | Backend change needed |
|---|---|---|
| Login OTP | Not built | Not supported (§2.5). |
| Refresh token / short sessions | Not built. The 365-day JWT is kept in the Keychain; a 403 signs the user out. | P1-1, P1-2 |
| Server-side logout | Logout calls `userLogout` (clears FCM only) and wipes the device. The JWT stays valid until expiry. | P1-2 |
| Payslip month list (main payroll) | App shows a 12-month picker and asks per month. | P0-6 |
| Authenticated file downloads | All files are public under `/uploads`. The app downloads with the `Authorization` header anyway (future-proof) into a private cache and deletes after 15 min / on logout. It never displays or shares the URL. | P0-11 |
| Notification read/unread | Inbox is shown as "Pending action" items (no read state). Announcements: fetching marks all read server-side, so the list is loaded only when the tab is opened. | P1-4 |
| "My open requests" on Home | Home shows pending **leave** only. | P1-10 |
| Unified approval queue | One adapter per module (leave, regularization, overtime, expense). Short leave, comp-off, gate pass, extra days and resignation approvals are not in the MVP. | P0-9 |
| Half-day leave | Only `DayType = "Full Day"` is sent. The half-day `DayType` strings are not documented. | Confirm values; then add to `ApplyLeaveInput.dayType`. |
| Cancel an **approved** leave day | Not built: `/leavecancel` has no approval step. Pending leave can be withdrawn. | P1-8 |
| Background location tracking (`dashboardcheck.tracking=true`) | Not built in this milestone. | None; mobile work (`/Tracking/v1/savedatabulk` exists). |
| Secure mobile punch | Built on the existing `attendanceApi` (see §4). | P0-3 |
| Reverse-geocoded address | The punch `address` is `"Lat …, Long …"`. The backend needs a string and provides no geocoder. | Optional. |
| Multi-device push | Last device to log in receives pushes. | P1-3 |
| Profile editing | Profile is read-only; "Changes are made by HR". Profile `add` endpoints skip scope checks on multipart. | P2-5 / H3 |

## 3. Assumed response shapes (verify before production)

The inventory documents request bodies for these but not the response rows. Code reads them through whitelisted candidate keys (`src/utils/pick.ts`) and never renders a row generically, because many rows include the password hash (H4).

| Where | Assumption | File |
|---|---|---|
| `leaveauthorizationRequest/v1/leavedetails/:id` | `finaldate` is an array of `YYYY-MM-DD` strings or `{date, days}`; `sandwichdate` lists sandwich dates; `leavedata` (object or `[object]`) has `userMasterID`, `LeaveTranId`. If `finaldate` is missing, the breakdown is built only when `LeaveDays` equals the calendar span; otherwise the app refuses and says "approve on the web". | `src/api/approvals/leave.adapter.ts` |
| `AuthorizationDetails/v1/getAuthList` | Any non-empty array or positive count means "is an approver". | `src/api/approvals/index.ts` |
| Regularization / overtime / expense approval lists | IDs read from `id`/`attendanceCorrectionRequestId`, `AuthorizationRequestId`/`ReferenceID`, `userexpensetransactionid`/`authorizationrequestid` (with casing variants). Rows without them are read-only. | `src/api/approvals/other.adapters.ts` |
| `attendanceCorrection/v1/getAlldata` + `attendanceCorrectionRequest/v1/add` | New logs copy `attendanceStatus`, `shiftID`, `logId` from the existing log of the same direction; `attendanceStatus` defaults to `1`; `correctionStatus` is sent as `2` (pending). | `src/features/attendance/regularization.ts` |
| `attendanceTransaction/v2/attendancestatus` | `continuePunchIN === true` means "resume is allowed". | `src/features/attendance/punch.ts` |
| `hrleavetypes/v1/getDataWithoutOutDuty/:id` | Not used: the `:id` meaning is undocumented. The leave-type picker uses the balance list, which already carries `LeaveTranId`. | `src/features/leave/ApplyLeaveScreen.tsx` |
| Announcements, birthdays, regularization reasons, day logs, tasks, profile sub-sections | Field names taken from the matching `add` request bodies or common names (`title`, `description`, `displayName`…). | the respective screens |
| Role permission form names | Only `Leave`, `Attendance`, `BirthdayList`, `WorkAnniversaryList` are used to hide features. Other features are not permission-gated. If permissions fail to load, nothing is hidden (UI gating is a convenience; the server is the boundary). | `src/auth/capabilities.ts` |

## 4. Attendance: what the app does and does not guarantee

The backend has a server-side geofence and server timestamps, so the app integrates location properly. It does **not** fake anything the server does not enforce.

The app:
- always sends `attendnaceFrom: "mobile"` (never `"web"`, which skips the geofence);
- sends a fresh high-accuracy fix and blocks the punch without one, unless policy `outsidePunchInPunchOut = 1`;
- captures a selfie when `selfieAttendance = 1`, and calls `checkUserFaces` when `selfieWithFaceDetection = 1`;
- hides the punch button for `attendanceFrom = "biometric"` or `attendanceInMobile = 0`;
- treats a timeout or dropped connection as **unknown**. It re-reads today's status and tells the user whether the punch was recorded. It never reports success it could not confirm;
- blocks double taps and offline punches, and never queues punches for later (the server stamps its own time).

Only the backend can fix these (Mobile Attendance Gap 1–11, P0-3):
- the punching user is still read from the body (buddy punching);
- selfie, face match, `attendanceFrom` and device binding are not enforced on the server. The face check is client-side only;
- there is no mock-location or accuracy validation, and no device data on the punch.

## 5. Client-side safeguards that compensate for server gaps

These do not replace the backend fixes. They stop the app itself from triggering the known holes.

- **Identity injection:** every call takes `userMasterID` / `companyMasterID` from the login response (`src/auth/identity.ts`). Screens never pass IDs.
- **Request guard** (`src/api/requestGuard.ts`): rejects any request whose top-level `userMasterID`, `userid`, `createBy`, `updateBy`, `authuser`, `senderID` or `companyMasterID` differs from the signed-in identity. It also strips `exportData`, `Export`, `declarationFrom`, `verifyBy` and `admin`, strips `status` from the payslip call, and strips `companyMasterID` from `/policyDocument`.
- **Not used at all:** `/auth/v1/forgot` (leaks the OTP), `/auth/v1/editprofile` (no auth), `/salaryTrans/v1/salaryslipuserwise` (SQL-injectable), `/common/*`, and the `userid` alias on attendance endpoints.
- **Leave withdraw** (a GET with a side effect and no guard) is offered only for the user's own pending leave.
- **Payslip paths** from `getMyPaySlipData` are accepted only if they match `uploads/PaySlips/…pdf`.
- **Logging:** release builds log nothing. Dev logs redact tokens, passwords, OTPs, salary fields, document numbers and base64.
