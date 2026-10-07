# FitBalance Release History

Historical versions are retained. New releases do not overwrite old release assets.

## v1.6.0 RC — nutrition database / sensor / data timeline rebuild

- versionCode 7
- database schemaVersion 4
- contentVersion 2
- added source-aware local food catalog in SQLite
- separated cooked rice from raw rice to prevent weight-state carbohydrate errors
- food UI now displays measurement basis and source
- rewrote Android TYPE_STEP_COUNTER handling as a persistent cumulative-delta ledger
- live sensor events push step updates immediately to the UI
- native daily step history now persists in SQLite
- added unified `daily_metrics` timeline for nutrition, activity, body weight and behavior variables
- historical data preserved through migration
- API remains disabled

Known limitation:
- cross-midnight step attribution cannot be exact with TYPE_STEP_COUNTER alone if no sample exists near midnight; such records are marked as estimated.
- v1.6.0 is currently a validation/debug test build until the long-term release signing secrets are configured.

## v1.5.0 — stable-signing / migration foundation

Status: release candidate until the long-term signing secrets are configured and the signed GitHub Release is published.

- versionCode 6
- database schemaVersion 3
- ruleVersion 1
- contentVersion 1
- evidenceVersion 1
- added non-destructive SQLite migration from schema v2 to v3
- added `release_audit`
- added `migration_audit`
- app now records installed app version, commit SHA, schema/rule/content/evidence versions locally
- added profile UI for version and data audit
- release workflow no longer overwrites an existing historical tag
- signed release builds require a stable private keystore stored in GitHub Actions Secrets

Rollback note:
- v1.5.0 begins the stable signing lineage.
- v1.0.0–v1.4.0 were debug-signed and are not guaranteed to install over/under the stable-signed lineage.

## v1.4.0

- local disease × food rule engine
- custom activity / meditation
- training readiness curve
- offline muscle body map
- local weekly / monthly reports

Signing: GitHub Actions debug key.

## v1.3.0

- local SQLite knowledge layer
- 30-day offline Zhuangzi module
- API gateway reserved and disabled

Signing: GitHub Actions debug key.

## v1.2.0

- cardiovascular disease modes
- emergency contacts
- mainland-China 120 system dial entry
- first-run health questionnaire

Signing: GitHub Actions debug key.

## v1.1.0

- fixed app UI scaling
- smoking / alcohol / late-night behavior tracking
- Android/iOS bridge compatibility scaffold

Signing: GitHub Actions debug key.

## v1.0.0

- first standalone FitBalance Android prototype

Signing: GitHub Actions debug key.
