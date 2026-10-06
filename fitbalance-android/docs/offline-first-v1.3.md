# FitBalance v1.3 Offline-first Architecture

## 当前阶段

先完成“无服务器也能长期使用”的本地版。

核心原则：

> App 负责展示和本地计算，数据库负责知识，规则引擎负责判断，API 负责扩展。

## 本地运行边界

即使设备没有网络，以下仍应工作：

- 健康档案
- 紧急联系人
- 120 / ICE 系统拨号入口
- 疾病提示
- 饮食记录
- 运动记录
- 步数与本地缓存
- Buff / Debuff 记录
- 体重趋势
- 基础恢复
- 30 日庄子内容
- 庄子阅读进度

## 庄子 30 日

结构化内容字段：

- id
- day_no
- chapter
- title
- original_text
- story
- interpretation
- action
- mood_tags
- health_tags
- priority
- content_version

首次使用写入 `zhuangzi_start_date`。

显示日序：

`min(30, 首次使用后的自然日差 + 1)`

第 30 天后不删除内容，进入自由复习状态。

## API 预留但不上线

`api-config.json` 当前：

- enabled=false
- content_sync=false
- rule_sync=false
- cloud_backup=false
- food_photo_ai=false
- health_analysis_ai=false

这意味着 v1.3.0 不需要为了 API 可用性承担任何运行依赖。

## 后续接入

未来只增加：

`SQLite ↔ Sync Engine ↔ API Gateway ↔ FastAPI ↔ PostgreSQL`

数据库表和内容版本已经为后续同步预留：

- `content_version`
- `sync_queue`

因此以后接 API 是扩展，不是推倒重写。
