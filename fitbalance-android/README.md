# 动衡 FitBalance v1.6.0 RC

这版不继续堆 UI，优先修“营养数据库、手机计步、数据关联”三条底层链路。

## 1. 营养数据进入 SQLite

新增：

- `food_sources`
- `foods`
- `food_core_seed.json`

每条食物现在保存：

- 生 / 熟状态
- 计量基准（例如“每100g熟重”）
- kcal / 蛋白质 / 碳水 / 脂肪
- 膳食纤维 / 钠（有可靠值时）
- 数据源 ID
- 数据来源地区
- 数据说明
- contentVersion

### 米饭不再混用生重和熟重

当前明确拆成：

- `米饭（蒸，熟重）`
  - 100g 熟重约 120 kcal
  - 碳水约 25.9g
  - 由中国食物交换份“75g米饭=90kcal、碳水19.4g”换算

- `大米（生重，谷物类参考）`
  - 独立条目
  - 明确标注为生重 / 谷物类交换份参考

UI 会显示当前食物的“基准”和“来源”，避免 100g 生米和 100g 熟饭混为一谈。

### GitHub-first 调研结论

调研了：

- Sanotsu/china-food-composition-data
- Sanotsu/free-fitness

其中 china-food-composition-data 很适合学习导入、校验、foodCode、数据版本化结构，但仓库没有开源许可证，并明确声明原始食物成分数据版权归原作者，因此 **FitBalance 不直接复制/打包其完整数据库**。

当前只保留少量人工核对核心条目；国际公开值用 USDA FoodData Central 作为回退来源。后续找到明确许可的中国食物成分数据源后，可直接通过当前 SQLite schema 导入，而不需要重写 UI。

## 2. Android 计步逻辑重写

旧版问题：

`TYPE_STEP_COUNTER` 第一次打开 App 才设当天 baseline，导致当日早些时候的步数全部丢失。

v1.6 改为：

`TYPE_STEP_COUNTER 累积原始值 → 持久化 lastRaw → 下一次读数计算 delta → daily_steps SQLite`

特点：

- 直接读取手机硬件步数传感器
- 每次 SensorEvent 实时推送 WebView UI
- App 关闭后再次打开，可用累计原始值追回关闭期间新增步数
- 手机重启后识别 counter reset
- 今日步数进入 SQLite `daily_steps`
- 周报/月报优先读取 native step history

已参考 GitHub 中成熟的 daily baseline / cumulative delta 计步思路，例如 Wayfarer、rook_flutter_sdk 等实现。

限制：

- 如果 App 在午夜前后长时间都没启动，单靠 `TYPE_STEP_COUNTER` 无法精确知道午夜瞬间的 raw counter，因此跨日差值会标记为 `cross_day_estimate`。
- 后续 Android Health Connect 接入后，可作为历史步数的更高优先级来源。

## 3. 建立统一 daily_metrics

新增 SQLite：

`daily_metrics`

每天把以下数据汇总到同一时间轴：

- 摄入 kcal
- 蛋白质
- 碳水
- 脂肪
- 步数
- 活动消耗
- 运动分钟
- 冥想分钟
- 体重
- 香烟
- 纯酒精克数
- 熬夜时长
- 疾病规则红色食物次数

这一步解决“数据彼此孤立”的问题。

以后周报/月报、趋势分析和规则联动都以：

`date → daily_metrics`

为共同底层，而不是各页面各算一套。

## 4. 数据库版本

- App version: 1.6.0
- versionCode: 7
- SQLite schemaVersion: 4
- contentVersion: 2
- API: 继续 OFF

v1.5 schema 3 → v1.6 schema 4 使用非破坏 migration。

## 5. 当前仍需继续推进

v1.6 RC 是底层修复版，不宣称所有健康数据已经最终完成。

下一步：

- 增加更多具有明确授权来源的中国常见食物
- 食物日志从 localStorage 完整迁移到 SQLite normalized tables
- Health Connect 作为 Android 历史步数第一优先级
- 睡眠、心率进入 daily_metrics
- 基于同一时间轴重做周报/月报相关性
