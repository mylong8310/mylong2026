---
name: offline-android-app-release
description: Build a self-contained Android APK from a mobile web app, bundle all HTML/CSS/JS/assets locally, add optional native Android bridges (sensors/camera), build in GitHub Actions, and publish a public GitHub Release APK.
---

# Offline Android App Release Skill

Use this skill when the user wants a mobile web prototype turned into a real Android APK that can be installed independently and shared with others.

## Core rule

Do not ship a WebView that depends on a temporary preview URL. Bundle the application UI and data in `app/src/main/assets/` and load it with:

`file:///android_asset/index.html`

Remote APIs are optional extensions only. Never embed private API keys or secrets in the APK.

## Standard project layout

- `<app>-android/settings.gradle`
- `<app>-android/build.gradle`
- `<app>-android/gradle.properties`
- `<app>-android/app/build.gradle`
- `<app>-android/app/src/main/AndroidManifest.xml`
- `<app>-android/app/src/main/java/<package>/MainActivity.java`
- `<app>-android/app/src/main/assets/index.html`
- `<app>-android/app/src/main/res/drawable/ic_launcher.xml`
- optional `res/xml/file_paths.xml` for camera/file chooser support

## Default Android baseline

- Java 17
- Gradle 8.11.1
- Android Gradle Plugin 8.7.3
- compileSdk / targetSdk 35
- minSdk 23
- bundled local-first WebView
- DOM/localStorage enabled
- no network permission unless the product genuinely requires remote APIs

## Native bridges

When requested, expose native capabilities through a narrow JavaScript interface. Typical examples:

- step counter: Android `TYPE_STEP_COUNTER` + `ACTIVITY_RECOGNITION`
- camera/photo chooser: `WebChromeClient.onShowFileChooser` + FileProvider
- vibration/notifications only when explicitly needed

Keep the bridge minimal and never expose arbitrary file or shell access.

## GitHub workflow

Create a dedicated feature branch. Add a workflow under `.github/workflows/` that:

1. checks out the branch
2. installs Java 17
3. provisions Gradle
4. installs Android SDK 35
5. runs `:app:assembleDebug`
6. renames the APK to a stable public filename
7. uploads the workflow artifact
8. publishes/updates a GitHub Release with `gh release create/upload`

Set:

`permissions: contents: write`

for release publishing.

## Release convention

- product tag: `<product>-vMAJOR.MINOR.PATCH`
- APK: `<Product>-Standalone-vMAJOR.MINOR.PATCH.apk`
- release title should state that it is an independent/offline install
- include a concise privacy and dependency note

## Validation checklist

Before reporting completion:

- GitHub Actions build conclusion is `success`
- APK artifact exists
- GitHub Release exists
- release asset content type is Android APK
- public `browser_download_url` exists
- report version, package name, min Android version, and whether network access is required

## Signing note

Debug builds are fine for private testing and direct sideloading. For Play Store or long-term production distribution, switch to a stable private release keystore stored in GitHub Actions Secrets. Never commit the keystore or passwords to the repository.

## Health-app safety

For nutrition/fitness/medical-adjacent apps:

- clearly label calorie, macro, step, and food-photo values as estimates
- disease modes provide conservative educational prompts, not diagnosis or medication advice
- diabetes fasting mode must warn users on insulin or hypoglycemia-causing medicines to confirm fasting plans with their clinician
- gout mode should emphasize hydration and avoiding rapid/crash weight loss
- do not claim photo nutrition analysis is exact
- preserve local privacy by default; do not upload photos unless a user explicitly enables a remote AI service
