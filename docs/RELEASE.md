# Production build

## 1. Environment

1. Fill in `.env.production` (committed with placeholders only; keep real values in CI secrets):
   - `API_BASE_URL` / `FILE_BASE_URL` must be `https://…/`. The app refuses to start with an `http` URL in production.
   - Leave `FEATURE_APPROVAL_DECISIONS` and `FEATURE_REGULARIZATION_SUBMIT` set to `false` until the items in `docs/BACKEND_GAPS.md` §1 are done. Leave `FEATURE_FORGOT_PASSWORD=false`.
2. **Coordinate the app version with the backend.** `dashboardcheck` requires the `AppVersion` row for each platform to equal the app's version string *exactly*. If a platform has no row, the backend crashes. Before release, update the row with `POST /appversion/v1/updatebyid`. The app shows a force-update screen on a mismatch.
   - Android: `versionName` in `android/app/build.gradle`
   - iOS: `MARKETING_VERSION` in Xcode

## 2. Firebase (push)

The backend uses two Firebase apps: Android/default and iOS (`config/firebase.js`). Use the **same projects**.

- Android: put `google-services.json` in `android/app/`. The Google Services plugin is applied only when this file exists.
- iOS: add `GoogleService-Info.plist` to the `MusterBox` target. Upload the APNs key to the iOS Firebase project. Enable the Push Notifications capability.
- Both files are git-ignored. Without them the app runs with push disabled.

## 3. Android release

Add these to `~/.gradle/gradle.properties` or to CI environment properties (never commit them):

```
MUSTERBOX_UPLOAD_STORE_FILE=/secure/path/upload.keystore
MUSTERBOX_UPLOAD_STORE_PASSWORD=…
MUSTERBOX_UPLOAD_KEY_ALIAS=…
MUSTERBOX_UPLOAD_KEY_PASSWORD=…
```

```
cd android && ./gradlew bundleRelease     # reads .env.production
```

Without these properties the release build is **unsigned**. It never falls back to the debug key. `android:allowBackup="false"` keeps app data out of device backups. Cleartext HTTP is allowed only in debug builds (`usesCleartextTraffic` comes from the RN template's debug manifest placeholder).

## 4. iOS release

```
bundle install && cd ios && bundle exec pod install     # static frameworks (Firebase)
```

- react-native-config reads `.env` by default. For per-scheme files, add a "Staging"/"Release" scheme with the pre-action `cp "${PROJECT_DIR}/../.env.production" "${PROJECT_DIR}/../.env"`, or set `ENVFILE` as described in the react-native-config README.
- Before App Store submission, remove `NSAllowsLocalNetworking` from `Info.plist` (it is only there for local development).

## 5. Pre-release checklist

- [ ] `npm run lint && npx tsc --noEmit && npm test` all pass
- [ ] `AppVersion` rows updated for both platforms
- [ ] Production URL is https; flags reviewed against `docs/BACKEND_GAPS.md`
- [ ] Punch in/out tested on a real device inside and outside the geofence, with and without selfie policy
- [ ] Payslip opened on both platforms; file gone after logout
- [ ] Push received and tapped (app killed, backgrounded, foreground) for `leaveauth` and `announcement`
