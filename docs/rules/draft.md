# draft.js — 选秀大会

对应源文件：`src/js/draft.js`  
总索引：[docs/RULES.md](../RULES.md)

## 硬数值

| 常量 | 值 |
|---|---|
| DRAFT_SIZE | 20 池 |
| DRAFT_WAGE / CONTRACT | 3 / 3 |
| DRAFT_BID_TOP / REST / STEP | 60 / 50 / 10（万） |
| AI def 注册上限 | 约 6（首发 5 + 轮换） |

## 隐性规则

1. **流程**：竞拍签位 → 点名；弱队优先竞拍顺序。  
2. **不能选自家青训**（第一轮）：`draftBlockedFor`；自家苗子走训练页自留签。  
3. **点名必须过 `canSign`/`rosterGuard`**：名单满则该签作废并推进，禁止无限 `players.push`。  
4. **AI 新秀入册**：必须写成 def（`extraDefs` + `aiRosterDefs`），只 push `aiRosters` 缓存会导致读档蒸发。  
5. **落选者**进自由市场（带 signCost/willingness），不是消失。  
6. **坏档**：NaN 竞拍价、池空、phase 不一致 → `draftRepair` 收敛为可推进或 done。  
7. **全局名字查重**：池内名不与市场/自由/AI/新星撞。  

## 易踩坑

- 15 年压测曾因 AI 替玩家点名绕过名单闸 → 名单 13 人；现已接 `canSign` + `auditSave` 收敛  
- `endPreseason` 强制收官要保证无人蒸发/双挂  

## 相关测试

- 测试链中 draft 相关用例（竞拍/点名/AI 入册/满员/坏档）  
- `tests/late-game-probe.js`
