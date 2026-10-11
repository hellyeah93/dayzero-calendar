# DayZero Calendar

A grey/black calendar and task planner covering **October 1, 2026 through January 15, 2027**, with:
- Monthly navigation and responsive calendar squares
- Add, complete, and delete daily tasks
- Overdue task panel
- Electron Windows desktop build
- Capacitor Android build
- Firebase Email/Password Authentication + Cloud Firestore sync
- Local task preview when Firebase isn't configured
- Basic notification hooks for Electron, browser, and Android

## Important honest limitations

1. **Firebase Spark is free but has quotas.** This app is designed for low personal usage, but no cloud service can be promised as unlimited. Stay on Spark and do not upgrade to Blaze if you don't want billing.
2. The daily reminder code schedules the next 7:00 AM reminder while the app is running. Electron notifications are native while the desktop app is open. Android notification support is wired through Capacitor Local Notifications; test it on your device. Reliable reminders while the app is fully closed/rebooted may need additional native scheduling and battery-optimization testing.
3. This starter uses email/password accounts. Use the same account on both devices. Never put a Firebase service-account key in this app.
4. The included Firestore rules are a starting point; deploy them and test them in Firebase Rules Playground before putting real data in the app.
5. The initial local preview stores tasks per installation; cross-device sync starts after Firebase is configured and you're signed in.

## 1. Requirements

- Node.js LTS (20+ recommended)
- Git
- For Windows `.exe`: Windows machine recommended
- For Android APK: Android Studio + Android SDK + JDK 17 (Android Studio normally manages the SDK/JDK)

## 2. Install

```bash
npm install
```

## 3. Set up Firebase (free Spark plan)

1. Open https://console.firebase.google.com/
2. Create a project.
3. Add a **Web App** in Project settings and copy its config.
4. In **Authentication -> Sign-in method**, enable **Email/Password**.
5. In **Firestore Database**, create a database.
6. In Firestore Rules, paste `firestore.rules` and publish.
7. Copy the config values into `src/firebase-config.js`.
8. Keep the project on the Spark plan if you want to avoid enabling billing.

The web app config is not a private service-account credential. Security must be enforced by Firebase Authentication and Firestore Rules.

## 4. Run in browser for development

```bash
npm run dev
```

The local task preview works without Firebase, but only on that device. Firebase sign-in is required for cross-device sync.

## 5. Run Electron on PC

Development mode:

```bash
npm run electron:dev
```

Build a Windows installer and portable executable:

```bash
npm run electron:pack
```

Output will be in `release/`. Build Windows installers on Windows where possible.

## 6. Build Android APK

First build and add the Android platform:

```bash
npm run build
npx cap add android
npx cap sync
npx cap open android
```

In Android Studio, allow Gradle sync to finish. Use **Build -> Build Bundle(s) / APK(s) -> Build APK(s)**. Android Studio will show the APK output path.

After UI changes, run:

```bash
npm run cap:sync
```

Then rebuild the APK in Android Studio.

## 7. Cross-device sync test

1. Install/run the PC app and APK.
2. Create an account on one device.
3. Sign in with that same email/password on the other.
4. Add a task on one device; it should appear on the other while online.
5. Complete it on the phone; confirm it updates on the PC.
6. Test offline mode and reconnect. Do not assume conflicting offline edits are merged perfectly; this starter relies on Firestore's normal synchronization behaviour.

## 8. Calendar range and reminder time

The calendar is fixed to `2026-10-01` through `2027-01-15`. The current reminder time is 7:00 AM in the device's local timezone. Search `scheduleDailyReminder` in `src/main.js` to change it.

## 9. Before using real data

- Configure Firebase Authentication and rules.
- Do not publish passwords, private keys, or service-account JSON.
- Test the app on both devices.
- Check Firebase usage in the console.
- If you use GitHub, commit `src/firebase-config.js` only if you're comfortable publishing the Firebase web config. Never commit service-account credentials.


## 10. Build EXE and APK using GitHub Actions (no Android Studio on your PC)

1. Upload this project folder's contents to a GitHub repository.
2. Open the repository's **Actions** tab and enable Actions if GitHub asks.
3. Choose **Build Windows EXE** and click **Run workflow**. When it finishes, open the run and download the `dayzero-windows-build` artifact.
4. Choose **Build Android APK** and click **Run workflow**. When it finishes, download the `dayzero-android-apk` artifact.
5. The Android artifact is a **debug APK** for personal testing, not a Play Store release.

The GitHub workflows in `.github/workflows/` create the Android platform during the workflow, so you do not need Android Studio locally. The Firebase web configuration in `src/firebase-config.js` is filled for the DayZero Calendar project. Keep Firestore Rules owner-only and never add service-account private keys to this repository.
