---
name: dual-platform-mobile-staged-release
description: Build a shared-code mobile app compatible with Android and iOS from day one, release Android first, and add iOS distribution only when justified by demand. Bundle the app locally, keep native bridges thin, build Android APKs in GitHub Actions, and preserve an iOS-ready WKWebView/native bridge architecture.
---

# Dual-platform Mobile App / Staged Release Skill

Use this as the default workflow for new mobile apps.

## Product strategy

Develop the product core once for both Android and iOS, but release in stages:

1. Shared cross-platform application core first.
2. Android wrapper, APK build, testing, and public GitHub Release first.
3. Keep an iOS wrapper contract and compatible APIs from the beginning.
4. Do not pay for or configure Apple Developer Program distribution until there is real iOS user demand.
5. When iOS demand exists, add signing, TestFlight/App Store packaging without rewriting the product core.

This avoids duplicate development and avoids premature Apple annual developer fees.

## Shared-core architecture

Keep product UI, business logic, local data schema, validation, charts, questionnaires, and domain models platform-neutral.

Preferred layout:

- `<product>/shared/index.html`
- `<product>/shared/app.css`
- `<product>/shared/app.js`
- `<product>/shared/assets/*`
- `<product>/android/*`
- `<product>/ios/*` (can remain a scaffold until needed)

The Android build copies/bundles the shared core into `app/src/main/assets/`.
The future iOS wrapper loads the same shared core in `WKWebView`.

Do not fork business logic into Android-only and iOS-only implementations.

## UI rule

This is an app UI, not a browser page:

- lock text zoom at 100%
- disable pinch zoom and browser-style zoom controls
- disable overscroll glow where practical
- use edge-to-edge mobile layout
- keep touch targets mobile-sized
- no desktop navigation or webpage chrome
- fixed bottom navigation is acceptable for the installed app
- safe-area aware
- support 320px+ logical width without page-level horizontal scrolling

## Native bridge contract

Expose only narrow, named capabilities. Keep a platform-neutral JavaScript facade so Android and iOS can implement the same calls.

Examples:

- `getTodaySteps()`
- `requestActivityPermission()`
- `pickOrCapturePhoto()`
- `getAppVersion()`

Android implementation examples:
- `TYPE_STEP_COUNTER` + `ACTIVITY_RECOGNITION`
- `WebChromeClient.onShowFileChooser` + FileProvider

Future iOS implementation examples:
- Core Motion / CMPedometer
- WKScriptMessageHandler
- PHPicker / UIImagePickerController as appropriate

Never expose arbitrary filesystem, shell, or unrestricted native methods.

## Local-first / privacy rule

Bundle the UI and core data locally. Use remote services only for features that truly need them.

Never embed private API keys in the APK/IPA.
For food-photo AI, medical AI, or other paid models, use a secure backend and make upload explicit.

## Android baseline

- Java 17
- Gradle 8.11.1
- Android Gradle Plugin 8.7.3
- compileSdk / targetSdk 35
- minSdk 23
- Android first public distribution through GitHub Releases
- debug-signed APK is acceptable for sideload testing
- production stores require stable private release signing

## iOS readiness baseline

Even before Apple Developer enrollment:

- keep the shared core compatible with WKWebView
- avoid Android-only browser APIs in product logic
- route native calls through the platform-neutral bridge facade
- avoid reliance on filesystem URLs that cannot map to an iOS bundle
- keep bundle identifiers and versioning documented
- do not claim App Store/TestFlight distribution is available until signing/provisioning exists

## GitHub Android release workflow

For Android-first distribution:

1. create/update a feature branch
2. checkout
3. install Java 17 and Gradle
4. install Android SDK
5. assemble APK
6. rename to stable public filename
7. upload workflow artifact
8. create/update GitHub Release and attach APK

Use `permissions: contents: write` only for workflows that publish releases.

## Release naming

- tag: `<product>-vMAJOR.MINOR.PATCH`
- Android: `<Product>-Standalone-vMAJOR.MINOR.PATCH.apk`
- later iOS releases use the same semantic product version

## Health and fitness app safety

- calorie, macro, exercise burn, step, recovery, food-photo, alcohol and risk outputs are estimates unless explicitly measured
- disease modes are educational decision support, not diagnosis or treatment
- do not invent a medical mortality or cardiovascular risk score from lifestyle inputs
- distinguish a user-facing “behavior load / negative buff” score from validated clinical risk scores
- smoking has no safe exposure threshold
- alcohol should be represented in grams of ethanol when possible; do not call any nonzero intake “safe”
- diabetes fasting mode must warn users on insulin or hypoglycemia-causing medicines
- gout mode emphasizes hydration and avoiding crash weight loss
- high-risk cardiovascular history (hypertension, coronary disease, prior myocardial infarction, prior stroke) must trigger more conservative exercise and symptom warnings
- preserve local privacy by default; photo upload requires explicit user action

## Completion checklist

Before reporting Android completion:

- app core remains platform-neutral
- Android scale/zoom behavior is locked
- Android build succeeded
- APK artifact exists
- GitHub Release exists
- public download URL exists
- package/version/min Android documented
- explain which features are local-only and which require future backend/iOS work
