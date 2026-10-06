---
name: app-dual-platform-standardization
description: App双端标准化建设。面向所有新 App 的统一开发协议：Android + iOS 从第一天共用一套业务代码和数据模型，Android 先分发，iOS 按真实需求后续签名发布；本地数据库 + 规则引擎 + 原生能力桥 + 预留 API 层；健康核心功能必须离线可用。
---

# App双端标准化建设

这是后续所有新 App 的默认标准。除非项目有明确技术约束，不再为 Android 和 iOS 分别维护两套业务实现。

## 0. 总原则

> App 负责展示和本地计算，数据库负责知识，规则引擎负责判断，API 负责扩展。

产品从第一天就按 Android + iOS 双端兼容设计，但分发分阶段：

1. 一套共享业务代码、数据模型、规则、组件和主题系统。
2. Android 先构建、测试、APK 分发。
3. iOS 代码结构和原生能力接口从第一天兼容。
4. 有真实 iOS 用户需求后，再办理 Apple Developer Program、签名、TestFlight / App Store。
5. 不允许因为“暂时只发 Android”而把业务代码写成 Android-only，避免以后重写。

## 1. 默认技术栈

新项目优先采用 Flutter 单代码库：

- Flutter / Dart：UI、业务逻辑、主题、路由、状态管理。
- SQLite + Drift：本地结构化数据与历史记录。
- Repository / Service 层：隔离本地数据库和未来远程 API。
- Rules Engine：疾病、食物、恢复、行为 Buff/Debuff 等规则计算。
- Platform Bridge / Plugin：Health Connect、HealthKit、步数、相机、系统电话等。
- API Gateway：先定义接口，不要求 MVP 就上线。
- 后端需要时采用 FastAPI + PostgreSQL。

允许旧项目使用 WebView 共享核心继续迭代，但新项目默认 Flutter；旧项目进入大版本重构时迁移到同一分层协议。

## 2. 标准分层

```
App / Presentation
        │
        ├── Theme & Component System
        ├── Local State / ViewModel
        │
        ▼
Rules Engine
        │
        ├── Disease rules
        ├── Food classification rules
        ├── Recovery rules
        ├── Buff / Debuff rules
        └── Recommendation rules
        │
        ▼
Repository Layer
     ┌───────┴────────┐
     ▼                ▼
SQLite / Drift     API Gateway (reserved)
     │                │
     │                ▼
     │             FastAPI
     │                │
     │                ▼
     │            PostgreSQL
     │
     ├── Health Connect / HealthKit
     ├── Camera / Photo
     ├── Steps / Heart rate / Sleep
     └── Emergency call / native platform capabilities
```

## 3. 本地数据库协议

必须建立本地数据库；健康、运动、内容型 App 禁止把核心内容散落硬编码在 UI 文件里。

本地库可包含：

- content / story / knowledge
- food_library
- disease_tags
- food_disease_rules
- exercise_library
- custom_exercise
- recovery_models
- habit_logs
- smoking_logs
- alcohol_logs
- sleep_deprivation_logs
- daily_status
- buff_rules
- health_profile
- emergency_contacts
- measurements
- weekly_reports
- monthly_reports
- sync_queue
- app_settings

规则或内容变化优先通过数据库记录变化完成，不要求重新发布 APK/IPA。

禁止：

- `if (today == ...)` 形式硬编码内容日历。
- 把食物红黄绿分类直接写死在页面样式。
- 把疾病规则分散在多个页面。
- 把默认运动项目固定成不可扩展常量。

## 4. 内容数据化协议

内容型数据应使用结构化表模型。例如庄子内容：

- id
- chapter
- title
- original_text
- story
- interpretation
- action
- mood_tags
- health_tags
- priority

新增内容应能通过数据库新增记录完成，而不是修改业务代码。

## 5. 规则引擎协议

所有“联动判断”集中到 Rules Engine，不由 UI 自己判断。

示例：

- 痛风 + 高嘌呤 → 红色
- 痛风 +有利于控制尿酸/膳食改善 → 绿色
- 中性 → 黄色
- 糖尿病 + 高糖/高快速吸收碳水 → 红色
- 高血压 + 高钠 → 红色
- 冠心病/心梗史 + 不利心血管膳食模式 → 红色
- 恢复差 → 自动降低高强度运动建议
- 吸烟、饮酒、熬夜 → 记录为行为负 Buff
- 情绪烦躁 → 可推荐庄子/冥想/呼吸等非医疗调节内容

UI 只消费统一结果，例如：

```
RuleResult {
  status: green | yellow | red
  score: optional
  reasons: []
  evidence_ids: []
  actions: []
}
```

规则必须可追溯到 evidence_id 或 guideline_id，医学规则禁止来源不明。

## 6. 健康核心离线协议

以下功能不得依赖网络：

- 用户健康档案
- 紧急联系人
- 一键进入系统电话呼叫流程
- 中国大陆 120 快捷入口
- 疾病警示
- 食物红/黄/绿联动
- 基础营养计算
- 基础热量计算
- 基础肌肉恢复计算
- 步数历史的本地缓存
- 自定义运动项目
- 吸烟 / 饮酒 / 熬夜记录
- 历史健康数据
- 周报/月报的基础本地统计

网络不可用时 App 仍应完成核心记录、查询和判断。

## 7. 离线内容包协议

凡是“每日内容 / 每日提示 / 课程 / 故事 / 训练计划”这类内容模块，第一版必须自带足够的本地内容包，不能把首日体验绑定到 API。

默认要求：

- 至少覆盖产品承诺的完整离线周期。
- 例如“庄子每日养心”第一版至少内置 30 天结构化内容。
- 内容必须以数据库记录或独立 seed 数据文件存在，不得散落硬编码在 UI。
- 需要记录 content_version，便于以后 API 增量更新。
- 用户阅读/完成进度必须本地保存。
- 服务器上线后，API 只能扩展/更新内容，不得成为已经承诺的离线核心功能的单点依赖。
- 预留 sync_queue / updated_at / version 等字段，后续接 API 时不推倒重写。

## 9. 可联网扩展

允许服务器依赖：

- AI 食物照片识别
- AI 个性化分析
- AI 内容解释
- 云同步
- 多设备同步
- 内容更新
- 疾病规则/食物库在线更新
- 天气服务
- 医院与地图信息
- 后台运营

MVP：

```
Flutter App
  ↕
SQLite / Drift
```

成熟阶段：

```
SQLite / Drift
     ↕
Repository / Sync Engine
     ↕
API Gateway
     ↕
FastAPI
     ↕
PostgreSQL
```

## 9. 第三方能力原则

只在功能明确需要时接入，不为“有 API”而接 API。

- AI API：食物识别、健康分析、个性化内容。
- Weather API：高温、湿度、补水、户外运动提示。
- Android Health Connect：步数、心率、睡眠、运动。
- Apple HealthKit：步数、心率、睡眠、运动。
- Maps：医院、AED、急救地点。
- Camera：食物记录。
- System Phone：急救和 ICE 联系人。

任何第三方 API Key 不得写入客户端安装包。

## 10. 双端原生能力协议

业务层只调用统一接口，例如：

- `getTodaySteps()`
- `getHeartRateSummary()`
- `getSleepSummary()`
- `pickOrCapturePhoto()`
- `dialNumber(phone)`
- `getAppVersion()`

Android 和 iOS 分别实现底层，不改变业务层。

Android：
- Health Connect
- SensorManager
- ACTION_DIAL
- Camera / Photo Picker

iOS：
- HealthKit
- Core Motion
- tel:
- PHPicker / Camera

## 11. App UI 标准

这是 App，不是网页：

- 默认锁定应用缩放逻辑，不出现浏览器式 pinch-zoom。
- 不展示浏览器导航、地址栏思维或桌面网页布局。
- Android / iOS 使用同一套设计 token。
- 支持 Safe Area。
- 320 logical px 以上不出现整页水平滚动。
- 主操作触控区域建议不小于约 44 logical px。
- 底部 Tab、导航栈、Modal、Sheet 使用移动端语义。
- 字号、间距、圆角、模糊、阴影全部 token 化，不在页面随意写 magic number。
- 深色/浅色主题通过 ThemeData / token 切换，而不是复制两套页面。

默认视觉方向可采用：
- 深色玻璃拟态
- Gaussian blur / backdrop blur
- 半透明层级
- 高信息密度但留足触控间距
- 医疗警告红色仅用于高优先级风险
- 红/黄/绿只用于明确的健康规则状态，避免装饰性滥用

## 12. Design Token 标准

至少定义：

- color.background
- color.surface
- color.surfaceElevated
- color.textPrimary
- color.textSecondary
- color.success
- color.warning
- color.danger
- color.info
- color.accent
- spacing.1 ... spacing.n
- radius.sm / md / lg / xl
- blur.sm / md / lg
- elevation.1 ... elevation.n
- typography.body / label / title / headline / metric
- motion.fast / normal / slow

业务组件只消费 token，不自行定义随机颜色。

## 13. 组件标准

高频组件沉淀成共享组件：

- AppScaffold
- AppBottomNavigation
- GlassCard
- MetricCard
- HealthStatusChip
- DiseaseModeSwitch
- FoodRiskBadge
- TrendChart
- RecoveryChart
- MuscleBodyMap
- EmergencyContactCard
- PrimaryActionButton
- HealthWarningBanner
- QuestionnaireStep
- ReportCard
- EmptyState
- LoadingState
- ErrorState

组件必须 Android / iOS 同逻辑、同数据结构，允许平台级交互细节差异。

## 14. 健康问卷与档案

首次启动：

- 可填写
- 可跳过
- 后续可补填

常见字段：

- 年龄
- 性别
- 身高
- 体重
- 腰围
- 体脂（可选）
- 糖尿病
- 痛风 / 高尿酸
- 高血压
- 冠心病 / 心脏病
- 既往心梗
- 既往脑卒中 / TIA
- 吸烟情况
- 饮酒情况
- 睡眠 / 熬夜
- 活动水平
- 紧急联系人

敏感健康资料默认本地优先。

## 15. 健康安全协议

- App 不诊断。
- App 不生成未经验证的“死亡概率”。
- Buff/Debuff 必须与临床风险评分分开。
- 医学规则必须有指南/论文 evidence_id。
- 高风险疾病模式要采用更保守的运动建议。
- 急性胸痛、严重呼吸困难、意识异常、疑似卒中等情况优先急救，不等待 App 判断。
- 中国大陆版可提供 120。
- Android 优先 ACTION_DIAL，iOS 使用系统 tel: 流程。
- 吸烟不存在安全支数。
- 酒精记录用纯乙醇克数为标准化指标，不把任何非零饮酒描述为“安全”。
- 糖尿病 + 胰岛素/低血糖风险药物时，间歇性禁食必须显示额外警告。
- 痛风模式强调补水和避免快速减重。

## 16. 证据协议

医疗、营养、运动和恢复算法都要带证据层。

优先级：

1. WHO / 国家卫健委 / CDC 等官方公共卫生机构
2. 国际/国家专业学会指南
3. 系统综述 / Meta-analysis
4. 高质量 RCT / 前瞻性队列
5. Science / Nature / Cell / NEJM / Lancet / JAMA / BMJ 等高水平期刊及专业子刊
6. 其他经过同行评议的研究

Science 是高权威期刊之一，但不是所有健康问题都必须只找 Science。应优先使用“与具体问题最直接、等级最高”的证据。

每条可执行医疗规则建议至少保存：

- evidence_id
- title
- organization_or_journal
- year
- doi_or_url
- evidence_level
- population
- rule_scope
- last_reviewed_at

## 17. 中国用户默认基线

产品默认面向中国用户时：

- 食物库优先覆盖中国常见饮食。
- 单位默认 kg、cm、ml、g、kcal、mmHg。
- 白酒需支持 ml + %vol，并统一换算纯乙醇克数。
- 啤酒同样支持 ml + %vol。
- 默认院前急救 120。
- 本地化饮食规则、气候提醒和季节内容应与国际证据分层：
  - 基础医学结论：使用国际权威证据。
  - 中国人群参数：优先中国人群高质量研究/中国指南。
  - 地区气候：由天气/气候数据驱动，不写死。

## 18. 行为负 Buff 协议

可记录：

- 香烟支数
- 电子烟/其他烟草（后续）
- 啤酒 ml + %vol
- 白酒 ml + %vol
- 纯乙醇克数
- 熬夜时长
- 总睡眠时长
- 久坐时间（后续）

负 Buff 仅作为个人趋势和行为反馈，不得包装成临床死亡/心血管概率。

## 19. 周报 / 月报

本地优先生成：

周报：
- 平均步数
- 总运动分钟
- 运动类型分布
- 摄入热量
- 活动消耗
- 蛋白 / 碳水趋势
- 体重变化
- 睡眠 / 熬夜
- 吸烟
- 酒精克数
- 负 Buff 趋势
- 病种相关风险食物次数
- 肌肉恢复状态

月报：
- 4–5 周趋势
- 体重/腰围/体脂趋势
- 活动量变化
- 饮食结构变化
- 负 Buff 改善/恶化
- 健康模式相关指标
- 数据完整度

报告重点是“变化”，不是给用户一个虚构的综合健康分。

## 20. 数据迁移与版本协议

数据库必须有 schemaVersion / migration。

- 不因升级 App 丢失用户数据。
- 新字段提供安全默认值。
- 数据迁移要可回滚或至少可验证。
- 用户自定义项目不可在版本更新时覆盖。
- 疾病规则和知识数据使用独立 version。
- 云同步上线后使用 sync_version / updated_at / conflict strategy。

## 21. 发布策略

Android：
- 先 GitHub Release / 测试分发。
- 成熟后再做正式 release keystore 和商店。

iOS：
- 保持编译兼容。
- 有真实需求后购买 Apple Developer Program。
- 再配置 signing / provisioning / TestFlight / App Store。
- 不为等待 iOS 发布而阻塞 Android 产品验证。

## 22. 完成定义 Definition of Done

每个 App/版本在报告“完成”前至少检查：

- Android + iOS 业务代码可共享
- 数据模型平台中立
- 本地 DB schema 已定义
- migration 已定义
- Rules Engine 不散落在 UI
- 核心健康功能离线可用
- 原生能力走统一 bridge/service
- App UI 无网页式缩放和浏览器行为
- 主题 token 化
- 自定义内容可扩展
- 医疗规则有 evidence_id
- 紧急功能不依赖网络
- Android build success
- Android APK artifact exists
- GitHub Release exists
- public download URL exists
- iOS readiness checklist 通过
- 用户隐私/权限最小化
- 不把 API Secret 放客户端
- 版本号、schemaVersion、ruleVersion 已记录
