# FitBalance Android Stable Signing & Release

## Purpose

Starting with v1.5.0, FitBalance uses one long-lived Android release key so future versions can upgrade in place without changing the app signature.

Historical v1.0.0–v1.4.0 builds were produced with GitHub Actions debug signing. Those runners do not preserve a durable private debug key, so the historical debug signatures cannot be treated as a stable upgrade chain.

## Repository secrets

Configure these GitHub Actions repository secrets:

- FITBALANCE_KEYSTORE_BASE64
- FITBALANCE_KEYSTORE_PASSWORD
- FITBALANCE_KEY_ALIAS
- FITBALANCE_KEY_PASSWORD

The keystore itself must never be committed to Git.

## Release workflow

Branch pushes run validation only.

Publishing a release requires a manual workflow dispatch with:

`publish_release = true`

The release job:

1. refuses to overwrite an existing GitHub Release tag;
2. reconstructs the keystore from GitHub Actions Secrets;
3. builds `:app:assembleRelease`;
4. verifies the APK with `apksigner`;
5. produces signature report, SHA-256 and release metadata;
6. creates a new immutable GitHub Release.

## Historical release rule

Existing tags and APK assets are never replaced or deleted as part of a normal upgrade.

Each version keeps:

- tag
- commit SHA
- APK
- APK SHA-256
- certificate/signature report when stable signing is enabled
- database schemaVersion
- ruleVersion
- contentVersion
- evidenceVersion
- migration / rollback notes

## One-time transition warning

Because v1.0.0–v1.4.0 were not signed with the new long-term key, Android may reject direct installation of v1.5.0 over one of those builds with a signature mismatch.

Do not uninstall an older build if it contains irreplaceable local data until that data has been backed up.

From v1.5.0 onward, all release builds must use the same long-term key, so the normal Android upgrade chain can be preserved.
