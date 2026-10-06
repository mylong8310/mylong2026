# FitBalance v1.2 心脑血管紧急联系模块

## 目标

降低高风险用户从“发现异常”到“呼叫急救 / 联系家属”的操作步骤，同时避免把 App 做成医疗诊断工具。

## 触发健康模式

- 高血压
- 冠心病 / 其他心脏病
- 既往心肌梗死
- 既往脑卒中 / TIA

这些模式可与糖尿病、痛风同时开启。

## 首次问卷

首次启动可选择填写，也可直接跳过。问卷只采集基础资料、既往病史和一位可选紧急联系人；跳过后仍可在“我的”补充。

## 紧急联系人数据

本地保存两位：
- 姓名
- 关系
- 手机号码

不上传，不写入远程服务。

## 呼叫策略

### 中国大陆急救
全国院前医疗急救呼叫号码为 120。

### Android
使用 ACTION_DIAL 打开系统电话界面，不申请 CALL_PHONE 权限。这样避免 App 静默拨打电话，也兼容急救号码的系统限制。

### iOS
使用 tel:// 交给系统电话流程。iOS 可能显示系统确认。

因此产品文案采用“一键进入系统呼叫流程”，而不是承诺绕过系统确认的静默直拨。

## 心梗 / ACS 提示

AHA/ACC 2025 患者信息列出的常见警讯包括：
- 胸部疼痛或不适
- 气短
- 头晕、恶心或呕吐
- 下颌、颈部或背部疼痛
- 手臂或肩部不适

出现可疑急症应快速呼叫急救。

## 卒中提示

American Stroke Association 使用 B.E.F.A.S.T.：
- B：Balance，突然平衡异常
- E：Eyes，突然视力变化
- F：Face，面部下垂
- A：Arm，手臂无力
- S：Speech，言语异常
- T：Time，立即呼叫急救并记录症状开始时间

## 权威来源

- 中国国家卫生健康委员会，《院前医疗急救管理办法》：
  https://www.nhc.gov.cn/wjw/c100221/202201/26ea3c97e82d466f9aa2b4a9901ae187.shtml
- 2025 ACC/AHA/ACEP/NAEMSP/SCAI Acute Coronary Syndromes Guideline:
  https://professional.heart.org/en/science-news/2025-guideline-for-the-management-of-patients-with-acute-coronary-syndromes
- AHA 2025 ACS patient messages:
  https://professional.heart.org/en/science-news/patient-resources/key-patient-messages-2025-acute-coronary-syndromes-guideline
- American Stroke Association, Stroke Symptoms / B.E.F.A.S.T.:
  https://www.stroke.org/en/about-stroke/stroke-symptoms
- 2024 ESC Guidelines for Elevated Blood Pressure and Hypertension:
  https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/elevated-blood-pressure-and-hypertension/

## 后续接口

该模块后续可与：
- 周报 / 月报
- 血压趋势
- 心率趋势
- 运动强度限制
- 负 Buff 趋势
- 食物疾病联动
连接，但不能把这些变量直接合成未经验证的“死亡概率”。
