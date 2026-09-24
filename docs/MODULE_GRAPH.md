# MODULE_GRAPH — 模块依赖契约（扁平 src/js）

> **真相源**。`ARCHITECTURE.md` 里的 `render-*.js` / core·engine·ui 严格分层是愿景，**不是**当前结构。  
> 测试沙箱（`tests/harness.js`）**只加载 `src/js/*`**，不加载 `src/core/*`。浏览器 `game.html` 两者都拼。

## 加载顺序（`src/index.html`，build.js 按此顺序内联）

```
data.js          静态表 / 经济参数 / 英雄池 / 时代 installEra
stateStore.js    状态薄门面：getState/setState/patchState/崩溃快照/冻结
permission.js    模式权限 canOperate / blockReason / denyIfBlocked
gameLog.js       工程日志环形缓冲（与 s.eventLog 分离）
perf-monitor.js
state.js         全局 S、存档迁移、战力、match 扁平表 rebuildMatchStore
players.js
transfer.js
train.js
season.js
natcamp.js
board.js
clubops.js
kjia.js
draft.js
rules.js
cups.js
career.js
playerops.js
hall.js
guide.js
bp.js
match.js
ui.js / ui-lineup.js / ui-market.js / ui-career.js
bgm.js
core/plugin-engine.js → sandbox-runner.js → plugin-loader.js
core/constants.js     （只读注释，不导出全局）
core/state.js         （只挂 window.CoreState.*，禁止覆盖 newState）
perf-dashboard.js
main.js               入口 / 开局 / 导入导出 / _reportErr
```

## 对外入口（高频）

| 模块 | 对外函数（节选） | 依赖 |
|---|---|---|
| data.js | `ECON` `HEROES` `PLAYER_POOL` `installEra` `fmtOf` | 无 |
| stateStore.js | `getState` `setState` `patchState` `writeCrashSnapshot` `freezeStatics` | localStorage, S |
| permission.js | `canOperate` `blockReason` `denyIfBlocked` | 无（读 s.mode） |
| gameLog.js | `gameLog.info/warn/error/exportText` | 可选 StateStore |
| state.js | `newState` `save` `load` `migrateSave` `playerPower` `teamPower` `rebuildMatchStore` | data, store |
| transfer.js | `openNegotiation` `openSellNego` `buildTransferMarket` `aiTransferWindow` `endPreseason` | state, rules, permission |
| season.js | `nextDay` `advancePhase` `startSplit` `newSeason` | match, transfer, cups, board… |
| match.js | `startMatch` `playGame` `finishSeries` `singleGame`(纯) | bp, season, cups |
| bp.js | `openBP` `bpConfirm` `autoPlayNext` | state |
| cups.js | `startCup` `setupChallenger` `setupEWC` `setupAnnual` `finishAnnual` | match, season |
| career.js | `coachAutoSquad` `playerRequestTransfer` `playerToCoach` | transfer, state |
| board.js | `boardSettle` `applyBoardTrust` | state |
| clubops.js | `initFans` `dailyCommercialIncome` `dressingRoomCheck` | state |
| draft.js | `initDraft` `draftPick` `draftFinish` | transfer, permission |
| rules.js | `canSign` `canRelease` `transferPhase` | state |
| main.js | `createTeam` `applyClub` `sanitizeImport` `applyImport` `renderAll` `goPage` | 几乎全部 |

## 循环依赖（已知、可接受、禁止再恶化）

```
season.js ⇄ match.js     finishSeries → queueMatchAdvance → advancePhase
season.js → transfer.js  startSplit → coachAutoSquad / endPreseason
season.js → cups.js      advanceCalendar → setupChallenger/EWC/Annual
transfer.js → career.js  coachAutoSquad → 签人
match.js → season.js     finishSeries → recordSeason / advance
ui.js → 几乎所有引擎       渲染只读 S + 调入口
main.js → 几乎所有        入口粘合
```

**禁止新增**：引擎模块直接调 `ui.js` / `main.js` 渲染函数。刷新一律 `save()+renderAll()` 由调用方（多为 main/ui 入口）负责。

## 权限表（permission.js）

| action | manager | coach | player |
|---|---|---|---|
| buyPlayer / sellPlayer / releasePlayer / renew / list / market / draft / kjia / sponsor / coach人事 | ✓ | | |
| manageLineup / setTactic / setCaptain / startMatch / BP / natCampPick | ✓ | ✓ | |
| loanIn（应急租借） | ✓ | ✓ | |
| coachRequest / coachPoachAccept | | ✓ | |
| playerTrain / playerRequest* / playerRespondOffer / playerMedia / playerToCoach | | | ✓ |

未登记 action：仅 manager，并 `console.warn`。

## 静态表冻结（data.js 末尾 freezeDataStatics）

**冻结**：ECON, YEAR_ECONOMY, POS, POS_ORDER, HEROES, HERO_BY_NAME, KPL, KPL_FORMAT, TACTICS, SCENARIOS, ACHIEVEMENTS, KPL_ERAS, SPONSORS, TRAIN_ITEMS…  

**禁止冻结**（installEra 原地改写）：`PLAYER_POOL` `AI_TEAMS` `AI_ROSTERS` `CLUB_TEMPLATES` `FA_2026` `COACH_POOL` `TEAM_BONDS`

## core/ 命名空间约定

| 文件 | 允许导出 | 禁止 |
|---|---|---|
| core/state.js | `window.CoreState.*` | `window.newState` / `cloneState` / `isValidState`（会覆盖 js/state.js） |
| core/constants.js | 无全局 | 与 data.js 抢名字 |
| core/plugin-*.js | 插件 API | 直接改 S 业务字段绕过引擎 |

## 测试

- `tests/harness.js` 按 index.html 的 `<script src="js/...">` 顺序拼接
- 新增 `js/*.js` 会自动进沙箱；`core/*` 不会
- 门禁清单在 `tests/run.js` SUITES
