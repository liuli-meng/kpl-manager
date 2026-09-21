# ai-model — 双模型（玩家经济 × AI def 名册）

总索引：[docs/RULES.md](../RULES.md)  
主责源码：`transfer.js`（aiTransferWindow / aiRosterDefMap / aiAttachDef）、`rules.js`（canSign AI 臂）

## 两个世界，一份 `S`

| | 玩家俱乐部 | AI 俱乐部 |
|---|---|---|
| 阵容真相 | `s.players` 真对象 | `s.aiRosterDefs[tn]` = def id 列表 |
| 人数 | ≤ `ROSTER_MAX` 10 | ≤ 5（五位置） |
| 资金/工资帽 | 真实 `fund` / `wageCap` / 税 | **无**玩家式扣费账本 |
| 战力 | `teamPower` 读名单 | `aiRosterPower` 读 def + 教练 + 冠军班底 |
| 缓存 | — | `s.aiRosters` 读档即弃、入册即清 |

## 隐性规则

1. **AI 补强不走 `buyPlayer`**，也不做超帽确认——经济对玩家才有「压力」。  
2. **一人一队**：任何玩家签人/转会落地 → `aiDetachDef`；AI 入册 → 先全局 detach 再 attach。  
3. **双挂是已知历史病**：幽灵注册、def 挂两队——靠写入口消毒 + `auditSave` 扫，不是理论不会发生。  
4. **续约决策按 tier 偏置**：豪门更愿留人（holdBias 负），弱旅更爱放人重组。  
5. **自由球员**：弱旅优先捡漏；豪门优先挑总值高的 FA；同位置要强 ≥3 才顶替首发。  
6. **新星 def**：`extraDefs` 每季底子水涨船高（封顶 +12 量级）；池尽走音节命名。  

## 易踩坑

- 把 `aiRosters` 写进存档 = 浪费体积且读档还要重建  
- 玩家队名也在 `AI_TEAMS` 池里时要 **过滤 `s.teamName`**，避免 AI「签走」自己  
- 杯赛/时代临时队可能没有 def 表：`canSign` AI 臂对无 map 的队 **放行**，避免误伤  

## 相关测试

- `tests/verify-ai-coach.js`、`verify-hall.js`（AI 难度）  
- `tests/late-game-probe.js`（名册不变量）
