# rules.js — 联盟规则扩展 + 规则中心

对应源文件：`src/js/rules.js`  
总索引：[docs/RULES.md](../RULES.md)

## 硬数值

| 常量 | 值 | 含义 |
|---|---|---|
| TEMP_SEAT_COUNT | 2 | 临时席数量（固定 16 + 临时 2） |
| TRANSFER_FREE_DAYS | 4 | 7 天窗前 4 天自由交易，后 3 天挂牌期 |
| YOUTH_DIRECT_ENTRY | 2 | 开季青训直进名额 |
| AI_ROSTER_MAX | 5 | AI def 名册上限 |

## 隐性规则

### 转会窗分段

- `transferPhase(s)`：`free` \| `list` \| null  
- 仅 `free` 阶段 `canFreeSign`——买断/自由市场直签开放  
- 挂牌期文案：只能挂牌/竞价/续约/租借；**`buyPlayer` 会被 `freeSignBlockedReason` 拦住**

### 临时席

- 联盟席位「只升不降」：固定队不因成绩掉出联盟  
- 年度结算 `settleTempSeats`：临时席里年度积分最低者收回，由 K甲冠军/次席顶上  
- 玩家俱乐部是固定席，**不受收回影响**

### canSign / canRelease（规则中心）

- **必须双端复用**：玩家 UI、AI 入册、选秀点名  
- 玩家：`transferOpsBlockedReason` + 挂牌期 + `rosterFull` + 已在册 + 租借/K甲（经 `playerStatus`）  
- AI：名册长度、同位置占用、已在该队册；`allowReplace` 可放开顶替场景  
- **不要在 onclick 里再写一套名单判断**

### auditSave（业务不变量，非字段修复）

检出并尽量修复：

1. 双挂：玩家名单 ∩ AI 名册 → **玩家优先**，AI 侧 detach  
2. 同一 def 两支 AI 队 → 保留先出现的队  
3. AI 名册超编 → 截断到 5  
4. 首发/队长/报价幽灵 → 清除  
5. 状态旗冲突（loan×loanOut、租借×K甲、挂牌但 busy）→ 修复  
6. 玩家名单 &gt; ROSTER_MAX → 保留总值前 10，其余进自由市场  
7. fund/wage 非法 → 归零 / 留给 scrubWages  

触发：`migrateSave` 末尾 + `newSeason` 末尾。

## 易踩坑

- 静态审计禁止业务文件裸拼 `p.loanOut && p.kjia` 等——**读 `playerStatus`**  
- 直进青训 / 点名仍受名单上限约束；15 年压测曾因选秀绕闸出现名单 13 人  
- 临时席变动要进联盟日志，避免玩家以为「AI 队消失了」

## 相关测试

- `tests/verify-rules.js`（窗分段/临时席/直进/`canSign`/`auditSave`/`canRelease`）  
- `tests/late-game-probe.js` 长局名单膨胀
