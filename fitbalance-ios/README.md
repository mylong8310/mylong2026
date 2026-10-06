# FitBalance iOS readiness scaffold

This folder is intentionally not a distributed iOS app yet.

The product strategy is:

- maintain one shared HTML/CSS/JavaScript product core
- publish Android first
- keep iOS native bridge compatibility from the beginning
- enroll in Apple Developer Program only after real iOS demand exists

## Bridge contract

The shared app uses a platform-neutral bridge:

- Android: `window.FitBridge.getTodaySteps()`
- iOS: `window.webkit.messageHandlers.fitbridge.postMessage(...)`
- iOS returns asynchronous values through `window.FitNative.receiveSteps(value)`

The included `FitBalanceViewController.swift` demonstrates the iOS Core Motion implementation.

## Future iOS packaging

When distribution is justified:

1. create the Xcode project / bundle identifier
2. include the same shared web assets under the app bundle's `shared/` directory
3. add `NSMotionUsageDescription`
4. add photo/camera usage descriptions for meal-photo capture
5. configure signing only then
6. distribute through TestFlight/App Store

No Apple Developer subscription is needed merely to keep this source architecture iOS-ready.
