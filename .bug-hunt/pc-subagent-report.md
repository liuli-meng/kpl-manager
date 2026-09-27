# Player + Coach 真实浏览器实测报告（subagent）

- **Date**: 2026-09-27
- **Target**: `E:\sex\kpl-manager` game.html @ `http://127.0.0.1:8931`
- **Method**: Playwright 真实浏览器（`tests/playthrough/pw.js` launch/shot），UI 点击 + 必要时 `page.evaluate` 注入状态/调引擎；收集 pageerror / console.error / toast / 名单变更
- **Scripts**: `.bug-hunt/probe-pc-sub8.js` · `probe-pc-sub8b.js` · `probe-pc-sub8c.js`
- **Raw**: `.bug-hunt/pc-subagent-probe8.json` · `probe8b.json` · `probe8c.json`
- **Constraint**: 未改 `src/**`，未 commit
- **Unique root-cause**: **P0=1 · P1=1 · P2=5**

> FAIL 判定：身份越权、按钮点了没反应、非法输入静默、pageerror、文案与能力矛盾。

---

## Coverage（任务书路径）

| 路径 | 结果 |
|------|------|
| 选手 switchStartTab → createPlayerCareer | ✓ mode=player，落地 career，弹窗关闭 |
| 生涯训练/社交/媒体 | ✓ 训练4钮+英雄特训/休息；社交3钮；媒体三选一可点并清 offer |
| 俱乐部出战 startPlayerMatch | ✓ matchIdx/history/career.matches 推进，赛后弹窗「继续」可关 |
| goPage 非法页门禁（market/lineup/biz/train） | ✓ toast+回 club，不进页 |
| 二队页不得出现可用「提拔一线队」 | ✓ **已修**：无按钮；引擎 `promoteKjiaPlayer` toast 拒绝、名单不变 |
| 教练 applyCoachClub | ✓ mode=coach，落地 club |
| 阵容/训练 | ✓ 换人/队长/战术可用；训练 20+ 钮可加属性 |
| 转会页不能挂牌出售 | ✓ UI 无挂牌/出售；引擎 listPlayer/openSellNego toast 拒绝 |
| 豪门邀约 accept / reject / 非法队名 | ✓ accept 换队保留 coach.id；reject 留任信任+3；**非法队名已有 toast**（旧 P1-A 已修） |
| 赛前 / BP 入口 | ✓ uiStartMatch → 赛前准备 → 进入 BP → `_draft` 就绪，可见「确定出战」 |
| pageerror / console.error | 用户路径 **0**（openBP 裸调 throw 见 P1-A） |

---

## Bugs

### [P0-A] 教练可「外租练级」——俱乐部人事/交易权泄漏

- **优先级**: **P0**
- **范围**: coach · 阵容页替补卡
- **复现**:
  1. `switchStartTab('coach')` → `pickCoachClub` → `applyCoachClub`
  2. 阵容页把任一选手换下，使替补席出现卡片（或开局班底本有替补）
  3. 点替补卡「外租练级」`clubLoanOutPlayer(S, id)`
- **期望**: 教练不能挂牌出售/外租（`permission.js` `loanOut: ['manager']`）；按钮隐藏或 toast「教练生涯不能操作『租出』」
- **实际**:
  - UI：`src/js/ui-lineup.js:35-36` 替补卡对 **所有非 manager** 固定渲染「下放 K甲」「外租练级」，**无** `S.mode==='manager'` 门禁（对照同卡出售按钮 `:34` 有门禁）
  - 引擎：`src/js/career.js:183-208` `clubLoanOutPlayer` **只**拦 `mode==='player'`（`:185`），**不**走 `denyIfBlocked('loanOut')`
  - 真实点击：toast「大帅 已外租 常山UUG」，`p.loanOut={team,days}` 成功写入，名单状态变更
- **涉及**:
  - `src/js/career.js:183` `clubLoanOutPlayer`（缺 `denyIfBlocked('loanOut',s)`）
  - `src/js/ui-lineup.js:36` 外租按钮无 mode 门禁
  - `src/js/permission.js:25` `loanOut: ['manager']`（规则与实现不一致）
  - 选择器: `#page-lineup button[onclick*="clubLoanOutPlayer"]`
- **证据**: `.bug-hunt/pc-subagent-probe8c.json` → `loanOutClick` / `benchUI`；截图 `pc8b-coach-lineup.png`
- **建议**:
  1. `clubLoanOutPlayer` 入口 `if(denyIfBlocked('loanOut',s))return;`
  2. `ui-lineup.js` 外租按钮仅 `S.mode==='manager'` 渲染（与出售一致）
  3. 若设计上教练可外租，改 `permission.js` 为 `loanOut: ['manager','coach']` 并更新文案——二选一，当前规则与实现互相矛盾

---

### [P1-A] `openBP` 无权限门禁且 `S.series==null` 时 TypeError

- **优先级**: **P1**
- **范围**: 全模式 · `src/js/bp.js:274`
- **复现**:
  1. 任意身份开局后（或换队后 `S.series` 被清空）
  2. 控制台/程序调用 `openBP('X', fn)`（选手身份同样）
- **期望**: 无 series 时 toast「请先开赛/赛程未就绪」；非 manager/coach 走 `denyIfBlocked('openBP')`
- **实际**:
  - `openBP` **无** `denyIfBlocked('openBP',S)`（规则表 `permission.js:40` 写了 `openBP: ['manager','coach']`）
  - `src/js/bp.js:274-278` 直接 `const sr=S.series` 后进 `expandSteps(sr,…)` / `draftAction`，`sr` 为 null 时抛 `Cannot read properties of null (reading 'side')`
  - 选手身份裸调同样 throw，而非权限 toast
  - 正常赛前 UI 路径有 series，不会踩；换队（`respondCoachOffer` 清 `S.series`）、导入脏档、误点重试弹窗残留回调时会踩
- **涉及**: `src/js/bp.js:274` `openBP`；`src/js/main.js:534` `respondCoachOffer`（清 series 后无 BP 保护）
- **证据**: `.bug-hunt/pc-subagent-probe8.json` `PLAYER_PRIV.openBP`；`probe8b.json` `openBp` / `coachOpenBp`
- **建议**: `openBP` 首行 `denyIfBlocked('openBP',S)` + `if(!S.series){toast(...);return;}`

---

### [P2-A] 教练换下空位 toast 仍写「可出售/挂牌」

- **优先级**: **P2**
- **范围**: coach · 阵容页 `swapPlayer`
- **实际**: `src/js/ui-lineup.js:78` toast 固定「…可出售/挂牌后补人…」——教练无出售权，文案误导
- **证据**: `probe8b.json` `SWAP_COPY`

### [P2-B] 教练阵容页 pageHint 仍是经理向

- **优先级**: **P2**
- **范围**: coach · lineup
- **实际**: `src/js/guide.js:8` `lineup:'选手卡管一切：训练、身价、续约、挂牌出售、替补轮换'` 渲染进教练阵容页顶部
- **证据**: `probe8c.json` `hints.lineup`

### [P2-C] 教练二队页 hint 仍写「表现好可提拔上一队」

- **优先级**: **P2**
- **范围**: coach · kjia
- **实际**: `src/js/guide.js:12`；教练侧提拔一线=经理人事权（`promoteRookie:['manager']`），hint 未按身份分支
- **证据**: `probe8c.json` `hints.kjia`

### [P2-D] 未成年选手无「板凳出路」UI，但引擎仍可自请下放 K甲

- **优先级**: **P2**
- **范围**: player · age&lt;18
- **实际**:
  - UI 条件 `ui-career.js:108` 要求 `age>=MATCH_MIN_AGE` 才渲染板凳面板 → 16 岁非首发看不到「下放 K甲/租借」
  - 直接调 `playerRequestKjia(S)` **成功**（`kjia=30`），toast 空
  - 与文案「K甲可随时申请」矛盾；`sendKjia` 引擎对未成年有拦（`career.js:195`），自请路径无
- **证据**: `probe8c.json` `under` / `player`

### [P2-E] 非法豪门邀约未写入执教履历 `coachDeal.log`

- **优先级**: **P2**
- **范围**: coach · `respondCoachOffer(true)` 非法队名
- **实际**: 已有 toast「邀约球队…不在当前联盟，邀约已作废」（旧 P1 已修）；但 `coachDeal.log` 无记录，履历看不出这次邀约
- **证据**: `probe8c.json` `dealLog.hasLog=false`

---

## 已验证「先前 bug 已修」

| 旧编号 | 现状 |
|--------|------|
| P0-A 选手可提拔 K甲进一队 | **已修**：`canPromote=canOperate('promoteRookie')`，选手无按钮；引擎 toast「选手生涯不能操作『提拔青训』」 |
| P1-A 非法队名邀约静默 | **已修**：toast「邀约球队「AG超玩会」不在当前联盟，邀约已作废」 |
| P1-B 选手二队页经理文案 | **已修**：正文改「人事权在俱乐部，生涯页可申请租借/K甲」 |
| P2-A 加练 toast 仅状态词 | **已修**：「加练对线：平稳，今天没有提升」 |
| P2-B pickPlayerPos 非法键 | **已修**：toast「无效位置」，不再 TypeError |
| P2-C 教练转会页经理 hint | **已修**：market hint 改为「教练工作台：应急租借与引援申请…」 |

---

## P0/P1/P2 汇总

1. **[P0] 教练外租练级越权** — `clubLoanOutPlayer` 无 `loanOut` 门禁 + UI 固定渲染按钮；真实外租成功。
2. **[P1] openBP 无权限/无 series 防护** — TypeError，换队后可踩。
3. **[P2×5]** 教练 toast/hint 经理文案 3 处、未成年板凳 UI 与引擎不一致、非法邀约未进履历。

---

## 路径核对（任务书 → 结论）

### 选手 player
- 开局 / 生涯训练社交媒体 / 俱乐部出战：**通过**
- goPage 非法页门禁：**通过**
- 二队「提拔一线队」：**通过（已修）**

### 教练 coach
- applyCoachClub / 阵容 / 训练：**通过**
- 转会页不能挂牌出售：**通过**
- 豪门邀约 accept/reject/非法队名 toast：**通过（非法 toast 已修）**
- 赛前 / BP：**通过**
- **外租练级越权：FAIL（P0）**
