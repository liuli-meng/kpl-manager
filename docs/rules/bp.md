# bp.js — KPL 两段式 BP

对应源文件：`src/js/bp.js`  
总索引：[docs/RULES.md](../RULES.md)

## 硬数值（顺序）

1. 第一轮 BAN：蓝→红→蓝→红（各 2）  
2. 第一轮 PICK：蓝→红×2→蓝→红（各 3）  
3. 第二轮 BAN：红→蓝→红→蓝（再各 2，共 4）  
4. 第二轮 PICK：红→蓝×2→红（补满 5）  

系列赛 **全局 BP**：己方用过不可复用。  
**巅峰对决**：BO 系列拖入决胜局 → 无 BAN、盲选、不受全局 BP 限制。

## 隐性规则

- BAN 可禁全英雄池（不是只禁对方池）——以当前实现 `bp.js` 为准  
- AI：抢版本强势、护招牌、按你已选给 counter  
- 全局 BP 记账在 `series.used` / `usedOpp`；时代档 `globalBp=false` 时每局独立  
- 体力不足/不可出场的位置：BP/开赛前会被 `matchEligible` 口径处理（空位警告见阵容）  

## 相关测试

- `tests/verify-regression` / smoke 中的 BP 结构用例  
- `verify-champcore` 等间接依赖 series 形状
