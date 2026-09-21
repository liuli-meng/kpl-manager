# transfer.js — 转会 / 经济闸门

对应源文件：`src/js/transfer.js`  
总索引：[docs/RULES.md](../RULES.md)

## 硬数值

| 常量 | 值 | 含义 |
|---|---|---|
| TRANSFER_CAP | 1500 | 单笔转会费封顶（万） |
| ROSTER_MAX | 10 | 玩家大名单上限 |
| PLAYER_WAGE_MAX | 70 | 个人周薪顶薪（万） |
| OFFER_TTL | 3 | 赛中报价有效期（天） |
| RENEW_YEARS | 2 | 续约谈判默认年限 |
| LOAN_DAYS | 21 | 租借天数 |
| MARKET_REFRESH_COST | 5 | 非转会期刷新市场（万）；窗内每日首刷免费 |
| 奢侈税 | 超帽部分 ×60%/周 | 发薪日扣，**不是禁止签约** |
| 卖出限制 | 一窗卖出 ≤ 名单一半（向下取整） | `sellGuard` |

## 隐性规则

### 玩家路径（有闸门）

- **签约**：`canSign(actor:'player')` → 身份 / 挂牌期不能买断 / 名单≤10 / 已在册 / 租借·K甲状态 → 资金 →（可选）超帽 confirm  
- **出售**：`canRelease(asSale)` → 集训/外租/K甲/租借选手不能卖；挂牌中的先撤牌  
- **报价三选**：留人（涨薪约8%，士气/忠诚+）/ 放人（钱入账，粉丝与队友士气损）/ 抬价（约半数接受、有的锁最终价、有的离场）  
- **转售保护**：买入后出场 &lt;5 → 卖价上限约 acqCost×0.9；打满 5 场解除  

### AI 路径（与玩家**不是同一套经济**）

- AI 阵容是 **def id 表**（`aiRosterDefMap`），名册上限 **5**、一位置一人  
- `aiTransferWindow`：退役 → 续约决策（弱旅更爱放人）→ 自由池补强 → **没有**玩家式资金/工资帽扣费  
- `aiBidTick`：对玩家挂牌报价（同样受 1500 封顶与转售保护）；非卖品破例被豪门挖走时 `aiAttachDef` 换注册队  
- **`aiAttachDef` / `aiDetachDef`**：入册前全局除名（含青训营），防同一 def 双挂；玩家 `buyPlayer` 后必须 detach  

### 续约 / 租借

- 合同年 &lt;=0：选手模式俱乐部自动续约 1 年并可能涨薪；经理转会期进「到期名单」  
- 续约费用与年限溢价：年限越长签字费越高；剩余多年**不可提前锁死**（谈不了）  
- 租借：外租选手工资由原队承担（`weeklyWage` 不计 `p.loan`）；到期自动归队；选手自请租借见 career.js  

## 易踩坑

- **超帽能签**，只是发薪缴税——UI confirm 文案必须写清「税」而不是假装不能签  
- 玩家买人后若 `aiRosters` 未失效，对手阵容可能仍显示旧人（入册函数里要清缓存）  
- 挂牌期（见 rules.js）**禁止**买断/直签，但仍可挂牌/竞价/续约/租借  

## 相关测试

- `tests/verify-offer.js`、`verify-contract.js`、`verify-kplrules.js`、`verify-wagecap.js`  
- `tests/verify-rules.js` canSign/canRelease
