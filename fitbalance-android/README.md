# 动衡 FitBalance v1.5.0 RC

当前阶段首先修正“版本升级基础设施”，避免继续用一次性 debug 签名发布新版本。

## v1.5.0 基础变更

- Android `versionCode = 6`
- SQLite `schemaVersion = 3`
- 数据库升级使用非破坏 migration，不删除用户历史数据
- 新增 `release_audit` 和 `migration_audit`
- App 本地记录：
  - appVersion
  - versionCode
  - schemaVersion
  - ruleVersion
  - contentVersion
  - evidenceVersion
  - commit SHA
- “我的”页面新增版本与数据审计卡
- GitHub Release 改为历史版本不可覆盖
- 正式发布 APK 改为长期固定 release keystore
- 工作流先执行 JS / JSON / Android 编译验证，再允许签名发布

## 稳定签名

正式发布需要 GitHub Actions Secrets：

- `FITBALANCE_KEYSTORE_BASE64`
- `FITBALANCE_KEYSTORE_PASSWORD`
- `FITBALANCE_KEY_ALIAS`
- `FITBALANCE_KEY_PASSWORD`

任何 keystore / 密码均不得提交到 Git。

详见：

`docs/SIGNING_AND_RELEASE.md`

## 旧版本兼容说明

v1.0.0–v1.4.0 使用 GitHub Actions 临时 debug 签名，无法保证与新的长期 release key 原地覆盖安装。

v1.5.0 是稳定签名链的起点。从这一版开始，只要长期私钥不丢失、包名不变、versionCode 单调递增，就可以维持后续 Android 正常升级链。

如果旧版已有重要本地数据，在没有备份前不要直接卸载。

## 历史版本

所有历史 Release 与 APK 保留。

见：

`CHANGELOG.md`
