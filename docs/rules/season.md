# season.js — 赛程 / 日结 / 王朝 / 年度

对应源文件：`src/js/season.js`  
总索引：[docs/RULES.md](../RULES.md)

## 硬数值 / 赛制骨架

| 阶段 phase | 含义 |
|---|---|
| r1 / r2 / r3 | 常规赛三轮（S/A/B 分组） |
| card | 卡位赛（BO 系列，规则用 `KPL.CARD`，与 playoff 区分） |
| playoff | 10 强双败季后赛 |
| champion / eliminated | 单季终局 |
| challenger / ewc / asiad / annual | 年度赛历杯赛 |

| 日结 | 规则 |
|---|---|
| 每日 | day++，trained/socialUsed 等重置；K甲/租借/亚运/板凳日结 |
| 每 3 天 | 签到补贴 +80 万 |
| 发薪周期 | `WAGE_EVERY`（见源码）发周薪 |
| 年度 | `newSeason`：年龄+1、合同-1、转会期、AI 转会、临时席、auditSave |

### 王朝反制（连冠 ≥2）

1. 对阵连冠队：研究方有效战力 +2%/连冠季（上限约 +6%）  
2. 连冠队工资帽成长减半（正常 +6 → 王朝 +3）  
3. 新版本针对核心：属性/士气/状态受挫，力度随连冠加码  

### 年度积分（摘要）

春夏两段累计，名次映射到积分（冠军 100 → 末位 0）；前 12 进年总（以源码 `ANNUAL_PTS` / 年总逻辑为准）。

## 隐性规则

1. **玩家出局后联盟仍要补完**——AI 场次照打，才能产生冠军/连冠链，避免王朝断档。  
2. **日结可 `_quietSave`**：批量跳过转会期时由外层统一 save，避免 30 次全量序列化。  
3. **发薪超帽缴税**，资金为负钳 0 + 全队士气大降；**不**因此禁止下场比赛。  
4. **随机事件**依赖名单有人；名单被卖空会跳过事件。  
5. **`advanceCalendar` / `newSeason` / 杯赛 setup** 失败时读档侧有结构恢复（见 state.md），运行期仍可能卡 phase——UI 要有可推进入口。  
6. **年度回顾**在清数据前快照（`buildYearReview`），再轮换。

## 易踩坑

- 选手模式常规赛走 `startPlayerMatch`（内部已 `playerAutoSeries` + `finishSeries`），**不要**再手工 `forceSeries` 一次  
- 改积分/晋级规则要同步：积分榜 UI、年总名单、board KPI、成就  
- `seasonShapeOk` 判「缺 groups 就重置联赛」——错误重建会毁进行中的赛季，逻辑已在 migrate 里收紧  

## 相关测试

- `tests/sim-quick.js`、`sim-yearend.js`、`sim-player.js`  
- `tests/verify-annual.js`、`verify-achieve.js`、`verify-board.js`
