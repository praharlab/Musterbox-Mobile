# MusterBox Mobile

React Native companion app for the MusterBox / Aptavetan HRMS. The web app stays the full admin platform. This app covers employees' daily tasks (attendance, leave, payslips, notifications, profile) and managers' team view and approvals.

The backend contract comes from `mobile-backend-handover.md` and `mobile-api-inventory.json`. Put both in `docs/`; code comments refer to them by section (§) and ID (C5, P0-3…). This project does **not** modify the backend. See **[docs/BACKEND_GAPS.md](docs/BACKEND_GAPS.md)** for what the backend cannot yet support and which response shapes are assumed.

## Quick start

Requirements: Node ≥ 22.11, JDK 17+, Android SDK, and Xcode + CocoaPods for iOS.

```sh
npm install
cp .env.example .env              # set API_BASE_URL to your backend (REST on port 3000, trailing slash)
npm start                         # Metro
npm run android                   # or:
(bundle install && cd ios && bundle exec pod install) && npm run ios
```

Android emulators reach a backend on the host at `http://10.0.2.2:3000/`.

```sh
npm test            # Jest (94 tests)
npm run lint        # ESLint
npx tsc --noEmit    # types
```

## What works

| Area | Employee | Manager (shown only when the backend says so) |
|---|---|---|
| Auth | Mobile login, forced first-login password change, change password, logout, session expiry → login, force-update gate, account-inactive gate | same |
| Home | Today's punch state + one-tap check-in/out, leave balance, pending leave, latest payslip, action items + unread announcements, birthdays | + pending approval counts |
| Attendance | Check in / resume / check out (location, selfie and face check per policy), shift and hours today, month summary, history calendar, day punches, regularization list + request | own attendance tab |
| Leave | Balance, apply (with JPG/PNG/PDF attachment), history with status, approvers, detail, withdraw pending | via Profile → My workspace |
| Payslip | Published payslips (generator) and payroll payslip by month; PDFs open in the OS viewer from a short-lived private cache | via Profile → My workspace |
| Notifications | Action inbox (taps route to the related screen), announcements; FCM push with `data.screen` routing | same |
| Profile | Summary, employment, contact, managers; addresses, family, education, experience, documents (read-only, whitelisted fields, masked numbers) | same |
| Team | — | Direct reports with today's/yesterday's attendance, search |
| Approvals | — | Leave, regularization, overtime, expense: list, detail, approve/reject with remarks (flag-controlled, see BACKEND_GAPS §1) |
| Tasks | — | My tasks, counts, accept/reject |

Navigation depends on the role. There is no "manager" user type in the backend (§3.2), so the app decides from data at startup:
- `isManager`: `reportTo/v1/reportstoImmediateChild` returns at least one direct report
- `isApprover`: `AuthorizationDetails/v1/getAuthList` is non-empty
- Features are hidden using `finalcheckpermission` form names (`Leave`, `Attendance`, …) and the attendance policy from `dashboardcheck`.

Employees get **Home · Attendance · Leave · Payslip · Alerts · Profile**. Managers and approvers get **Home · Team · Approvals · Attendance · Tasks · Profile**; a tab is left out when its capability is missing.

## Architecture

```
App.tsx                     providers: SafeArea, React Query (memory-only cache), Auth
src/
  config/env.ts             .env via react-native-config; https enforced in production; feature flags
  api/
    client.ts               axios instance: token, timeouts, envelope handling, error classification
    envelope.ts             legacy {status,…} / REST / middleware {msg} → success or ApiError
    errors.ts               ApiError kinds: business, validation, sessionExpired, forceUpdate,
                            accountInactive, server, network, timeout, clientGuard
    requestGuard.ts         tenant-isolation guard + never-send keys
    endpoints.ts            every path used (all from the inventory)
    pagination.ts           page/limit helpers, next-page logic
    *.api.ts                one module per feature; identity injected from the session
    approvals/              one adapter per approval module → a single ApprovalItem model
  auth/
    identity.ts             signed-in userMasterID/companyMasterID (from login only)
    sessionService.ts       login, restore, bootstrap (dashboardcheck + probes), logout
    AuthProvider.tsx        session state machine used by the navigator
    capabilities.ts         permissions + probes → capabilities → tabs
  storage/
    secureStore.ts          session in Keychain / Keystore (WHEN_UNLOCKED_THIS_DEVICE_ONLY)
    secureFiles.ts          sensitive PDFs: private cache, random names, 15-min TTL, wiped on logout
  device/                   location, camera, device info
  notifications/            FCM wrapper (degrades when Firebase is absent), data.screen router
  navigation/               role-based tabs + root stack
  features/<feature>/       screens, hooks and pure logic (e.g. attendance/punch.ts)
  components/               design system: ui.tsx, DateField, PagedList, status mapping
  theme/                    tokens (colours, spacing, type, 48 dp touch targets)
  hooks/                    user-scoped query keys, paginated lists, submit guard, network status
  types/api.ts              typed backend models (unverified shapes are marked)
__tests__/                  Jest + Testing Library
```

### Rules the code follows

- **HTTP 200 is not success.** `interpretResponse` checks `body.status`. HTTP 403 or `"Authorization Denied!"` ends the session once, even when several requests fail together. `"Please update app version."` opens the force-update screen.
- **Identity is never user input.** `userMasterID` and `companyMasterID` come from the login response. The request guard refuses any request that carries a different ID.
- **Sensitive data:** the JWT is stored only in Keychain/Keystore. The query cache is never written to disk and is cleared on logout; query keys include the user ID. PDFs live in a private cache for at most 15 minutes. Release builds log nothing, and dev logs are redacted.
- **No false success:** a timed-out punch is checked against the server. A timed-out leave request or approval says it may already have been recorded. Double taps are ignored (`useSubmitGuard`). Nothing is queued offline.
- **No fake features:** if the backend lacks something, the app hides it, shows it read-only, or puts it behind a flag, and `docs/BACKEND_GAPS.md` records it.

## Configuration

`.env.example` documents each variable. Environments: `.env` (debug), `.env.staging`, `.env.production` (release). Push needs `google-services.json` / `GoogleService-Info.plist` from the **same Firebase projects the backend uses**. Without them the app runs with push disabled.

Production build and release checklist: **[docs/RELEASE.md](docs/RELEASE.md)**.

## Tests

| Suite | Covers |
|---|---|
| `api.envelope` | three envelope styles, HTTP 200 business errors, force-update, account-inactive, 403 |
| `api.client` | token attached, expired token → one logout, anonymous login, network/timeout/5xx, forbidden keys, **tenant isolation** (other user/company ID refused) |
| `auth.session` | login stores session in Keychain, forced password change, wrong password, restore, expired token discarded, logout wipes everything even offline, employee vs manager bootstrap, force-update |
| `capabilities` | employee/manager/approver tabs, permission filtering, biometric-only, policy flags |
| `attendance` | punch payload contract, state machine, location denied, selfie cancel, face fail, geofence rejection, timeout confirmed by server, unconfirmed never reported as success, regularization payload |
| `leave` | indexed multipart with session identity, attachment rules, server errors, withdraw only pending |
| `payslip` | no `status` sent, unissued month, base64 → random private file, auth-header download, path validation, retention purge |
| `approvals` | leave list/approve/reject payloads, breakdown refusal for half days, sandwich days, read-only rows, expense payload |
| `LoginScreen` | submit, server and network errors, session-expired notice, double-tap guard |
| `utils` | log redaction, pagination, push routing, env rules, dates |

## Next steps

1. Backend P0 fixes (BACKEND_GAPS §1–2). Then switch attendance to P0-3 and payslips to P0-6/P0-7 by changing the API modules only; screens do not change.
2. Verify the assumed shapes in BACKEND_GAPS §3 against a staging backend, then enable the flags.
3. Background tracking when `dashboardcheck.tracking` is true; Android notification channel + foreground display (`notifee`).
4. Phase 2 modules (expenses, gate pass, visits, help desk) as new `features/*` + `api/*` modules.
