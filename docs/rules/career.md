# career.js — 选手生涯出口

对应源文件：`src/js/career.js`  
总索引：[docs/RULES.md](../RULES.md)

## 隐性规则

### 申请转会 `playerRequestTransfer`

- 接盘分：`ovr + (val-100)*0.35 + pop*0.15 + 合同年+6`；**&lt;78 无人报价**  
- 强队更爱挖高总值；合同最后一年更易被捡漏  
- 报价费用：`buyoutPrice × (0.9~1.25)`，TTL=`OFFER_TTL`（3 天）  
- 集训/外租/K甲/已有 pendingMove/已有报价 → 拒绝  

### 板凳计数 `tickPlayerBench`

- 健康可出场却不在 `lineup` → `benchDays++`  
- 连续 ≥3 天：士气按合同角色扣（`benchMoraleDelta`：核心 ×2，轮换/培养约 1）  
- 首发时清零  

### 自请租借 / K甲

- 租借需 **连续替补 ≥3 天**；K甲可随时申请（教练/选手模式同守卫）  
- 目标队：缺同位置、优先弱旅；`LOAN_DAYS=21`  
- 租借日结：约每 3 天一场模拟出场，有成长；到期归队争首发  
- 下放走 `sendKjia`，天数 `KJIA_DAYS`  

### 转会落地 `applyPlayerMove`

- 整队按新东家模板重建，**本人保留**；合同重置 2 年，薪资随转会费上浮  
- 租借/K甲状态清空；`benchDays=0`；首发重新 `buildBestLineup`  

### 退役 / 转教练

- 年龄达 `AGE_MODEL[pos].retire` → `career.retired`，legacy 快照（选手从名单移除后 UI 只读 legacy）  
- `coachPath`：可 `playerToCoach` 继续执教生涯，履历写入教练合同  

## 易踩坑

- `dressingRoomCheck` 对 **选手模式本人** 不记更衣室不满（自己写在生涯页）  
- 未满 18：可加练，不可出场；转会申请逻辑仍跑，但上场要等满龄  
- 媒体/社交日决策在 **playerops.js**，不在本文件  

## 相关测试

- `tests/verify-career.js`、`tests/verify-offer.js`
