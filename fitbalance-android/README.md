# 动衡 FitBalance v1.3.0

当前目标：**先把真正的本地独立版做稳，API 只预留，不让核心体验依赖网络。**

## v1.3.0

- 新增 Android SQLite 本地数据库 `fitbalance.db`
- 新增 30 天《庄子》本地内容包
- 《庄子》模块可完全离线运行：
  - 每日一则
  - 章节 / 标题 / 原文短句
  - 故事
  - 当代理解
  - 今日行动
  - 情绪 / 健康标签
  - 30 日完成进度
  - 前一天 / 后一天自由复习
- 首次打开庄子模块自动记录本地开始日期
- 30 天结束后仍可离线反复复习
- API Gateway 已预留，但默认 `enabled=false`
- App 当前仍不需要互联网权限来运行核心模块
- 本地 SQLite 同时预留 `sync_queue`，后续接入 API 时不用重构数据层

## 本地数据库

当前表：

- `zhuangzi_content`
- `zhuangzi_progress`
- `app_meta`
- `sync_queue`

庄子内容来自独立的结构化数据文件：

`app/src/main/assets/zhuangzi_seed.json`

而不是散落在 UI 或日期判断代码中。

## API 预留

当前仅存在接口层：

- `api-config.json`
- `api-gateway.js`

默认关闭：

- content sync
- rule sync
- cloud backup
- food-photo AI
- health-analysis AI

以后可以接：

`Local SQLite ↔ Repository/Sync ↔ API Gateway ↔ FastAPI ↔ PostgreSQL`

但 v1.3.0 的日常核心使用不需要服务器。

## 庄子模块边界

庄子内容用于日常反思、心态调整、情绪调节和生活节奏提示，不作为心理治疗或医学治疗。

## 现有本地核心功能

- 营养、蛋白质、碳水、脂肪、热量记录
- 体重、BMI、BMR/TDEE
- 糖尿病、痛风/高尿酸
- 高血压、心脏病、既往心梗、既往卒中/TIA
- 紧急联系人与中国大陆 120 系统拨号入口
- 16:8 / 14:10 / 12:12
- 步数、走路、跑步、力量、骑行
- 肌肉恢复
- 食物拍照记录
- 吸烟、啤酒、白酒、纯酒精克数、熬夜负 Buff
- 30 日庄子养心
