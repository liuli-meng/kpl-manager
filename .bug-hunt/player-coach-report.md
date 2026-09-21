# Player + Coach Mode Bug Hunt Report

- **Date**: 2026-09-19
- **Target**: `E:\sex\kpl-manager` 正式版 · 选手模式（player）+ 教练模式（coach）
- **Method**:
  - Playwright 打开 `game.html`（`http://127.0.0.1:8931`）
  - 真实开局 UI：`switchStartTab('player'|'coach')` → `pickPlayer*` / `pickCoachClub` → `createPlayerCareer` / `applyCoachClub`
  - `page.evaluate` 推进：`startPlayerMatch` / `startMatch` / `openBP` / UI 点击「进入 BP」/`coachAutoSquad` / `respondCoachOffer` / `playerRequest*`
  - 每步截图至 `E:\sex\gui-test-screenshots\pc-*.png` / `coach-*.png`
  - 收集 `pageerror` / `console.error` / toast
  - 引擎侧：`tests/harness.js` makeDom 探针 + 既有回归 `verify-career` / `verify-playerops` / `verify-playerstatus`
- **Scripts**（只读探测，未改 src/game）:
  - `.bug-hunt/probe-player-coach.js`
  - `.bug-hunt/probe-coach.js`
  - `.bug-hunt/probe-deep.js`
  - `.bug-hunt/probe-uibp.js`
  - `.bug-hunt/probe-leak.js`
- **Constraint**: 未修改 `src/**`、`game.html`；未 commit
- **Raw JSON**: `.bug-hunt/player-coach-probe*.json`
- **Unique root-cause totals**: **P0=1 · P1=2 · P2=3**

> FAIL 判定：进不去身份页；按钮点了没反应；身份专属功能缺失却无提示；身份越权（经理功能泄漏到选手/教练）；文案残缺；报错/pageerror。

---

## Coverage

| 检查项 | player | coach | 结果 |
|--------|--------|-------|------|
| 开局身份页 tab / 选队 / 默认名 | ✓ | ✓ | 选手空名→「无名小将」；教练卡绑定 `pickCoachClub`；未选队 toast |
| createPlayerCareer / applyCoachClub | ✓ | ✓ | mode/合同/日志/落地页正确（career / club） |
| MODE_PAGES 页签全部可开 | career/club/league/kjia/union/hall | club/lineup/market/train/league/kjia/union/hall | 均可打开，textLen≥325，无空页 |
| 非法页 goPage 门禁 | market/lineup/biz/train → toast 回 club | biz → toast 回 club | **通过**（toast 文案含 TOUR_TITLES） |
| coach `goPage('market')` | — | market **在** MODE_PAGES.coach | 设计允许；落地「教练工作台·应急与引援」 |
| 生涯：训练/社交/申请转会/租借/K甲 | ✓ | — | 按钮齐全；板凳满3天可租借；引擎日志完整 |
| startPlayerMatch | ✓ | — | matchIdx/history/career.matches 推进 |
| 伤停 / 未成年 / 退役 UI | ✓ | — | 伤停训练钮 disabled + 「伤停 N 天」；未成年不进首发+日志；退役结算屏+重新开始 |
| 教练阵容/训练/自动引援 | — | ✓ | 阵容有战术无出售；训练 25 钮；`coachAutoSquad` 缺位租借+签人有日志 |
| 豪门邀约 accept/reject | — | ✓（模板名正确时） | 换队/留任 + 保留玩家教练 id；非法队名见 P1 |
| startMatch / BP | — | ✓ | 赛前准备 modal → `openBP` → BP UI → 确认 → `playGame` 比分推进 |
| pageerror | — | — | 用户路径 **0**（探针乱序调 playGame 的 throw 见备注） |
| 引擎回归 verify-career/playerops/playerstatus | ✓ | ✓ | **全部 PASS** |

---

## Cross-mode bugs（根因）

### [P0-A] 选手模式二队页可提拔 K甲选手进一队（俱乐部管理权泄漏）

- **优先级**: **P0**
- **范围**: player · kjia 页
- **复现**:
  1. 选手生涯开局（任意位置/出身）→ 导航「二队」
  2. 滚动到「二队班底」→ 点任意「↑ 提拔一线队」
- **期望**:
  - 选手身份无俱乐部人事权：按钮隐藏/禁用，或 toast「选手生涯请让俱乐部运作」
  - pageHint 不应指向选手打不开的「阵容」页
- **实际**:
  - `promoteKjiaPlayer` **无** `S.mode==='player'` 门禁（`src/js/kjia.js` ~L185–207）
  - 探针：`promoteTry='ok'`，`playersAfterPromote` 名单人数增加（二队班底 5→4，一队 +1）
  - UI 文案仍为经理向：「阵容页『下放 K甲』…」「表现好可提拔上一队」（`src/js/ui.js` `renderKjia` ~L989–1049）
  - 同页「召回一队」按钮仅在有 `p.kjia>0` 的下放选手时出现；选手自请 K甲 后同样可能出现无门禁的 `recallKjia`
- **涉及**:
  - `src/js/kjia.js` `promoteKjiaPlayer` / `recallKjia` / `sendKjia`（引擎无 mode 守卫）
  - `src/js/ui.js` `renderKjia` ~L1047–1049（班底卡片固定渲染提拔按钮）
  - `src/js/guide.js` `PAGE_HINTS.kjia`
  - 选择器: `#page-kjia button[onclick*="promoteKjiaPlayer"]`
- **证据**: `.bug-hunt/player-coach-probe-leak.json`；截图 `player-kjia-leak.png`
- **建议修复（未改代码）**:
  1. `renderKjia`：`S.mode==='player'` 时隐藏班底「提拔/召回」操作，改为只读数据 + 指向「生涯」页自请 K甲/租借
  2. 引擎：`promoteKjiaPlayer` / `recallKjia` / `sendKjia`（非 player 自请路径）对 `mode==='player'` 直接 toast 拒绝
  3. `PAGE_HINTS.kjia` 按身份分支（选手 vs 经理/教练）

---

### [P1-A] 豪门邀约 `team` 不在 CLUB_TEMPLATES 时接受=静默吞掉

- **优先级**: **P1**
- **范围**: coach · `respondCoachOffer(true)`
- **复现**:
  1. 教练生涯 → `S.coachOffer={team:'AG超玩会'}`（或任意非当前 `CLUB_TEMPLATES[].name`）
  2. 俱乐部页点「接受（换队执教）」
- **期望**: 换队成功，或明确 toast「邀约俱乐部不存在/已变更」并保留可再选
- **实际**:
  - `src/js/main.js` ~L404–406：`const tmpl=CLUB_TEMPLATES.find(...); if(!tmpl){S.coachOffer=null;return;}`
  - 无 toast、无 `coachDeal.log`、球队不变、offer 清空 → 玩家以为点了没反应
  - 对照：`CLUB_TEMPLATES` 精确名（如 `成都AG超玩会`）接受成功：team 切换、阵容换班底、deal log「离任…转投…」、`coach.id` 保留
  - 自然路径 `coachPoach` 使用 `pick(CLUB_TEMPLATES).name`，正常可命中；时代档改名/导入脏档/手改 offer 会踩中
- **涉及**: `src/js/main.js` `respondCoachOffer`；`src/js/career.js` `coachPoach`
- **证据**: `.bug-hunt/player-coach-probe-deep.json`（ACCEPT_EXACT moved=true vs SILENT_BAD）；`.bug-hunt/player-coach-probe-uibp.json`
- **建议**: 找不到模板时 toast + 保留 offer 或写 deal log「邀约失效」；勿静默 return

---

### [P1-B] 选手二队页文案与按钮仍按经理身份编写

- **优先级**: **P1**（与 P0-A 同界面，独立文案问题）
- **范围**: player · kjia pageHint
- **实际**:
  - `PAGE_HINTS.kjia`：「K甲二队：替补和青训生的练级场，**表现好可提拔上一队**」
  - 面板正文：「**阵容页**『下放 K甲』把替补/青训送进二队…」——选手模式 **无** lineup 页（goPage 会 toast 回 club）
  - 选手合法路径在「生涯」页：`playerRequestKjia` / `playerRequestLoanOut`，与上述文案不一致
- **涉及**: `src/js/guide.js` ~L9；`src/js/ui.js` `renderKjia` ~L989–990
- **建议**: 按 `S.mode` 切换 hint；选手版写「生涯页可自请下放 K甲 / 租借」

---

### [P2-A] 加练无收益时 toast 仅显示状态词

- **优先级**: **P2**
- **范围**: player · 生涯页「练对线/运营/团战/心态」
- **复现**: 状态低迷（如 morale/val 偏低）时点加练
- **期望**: 明确「今天没有提升」+ 原因
- **实际**:
  - `src/js/ui-career.js` `playerTrain`：`if(r.gain<=0)toast(r.note)`
  - `trainOutcome` 在未顶天花板且 gain=0 时 `note=formLabel(form)` → toast 仅「平稳」「低迷」
  - 引擎日志更完整：`playerTrainDay` 写「…低迷（状态 43），今天没有提升」（`src/js/playerops.js` ~L284–286）
- **建议**: gain≤0 时 toast 用与日志同级文案，或 `toast(r.note+'，今天没有提升')`

---

### [P2-B] `pickPlayerPos` 不校验非法位置键

- **优先级**: **P2**（UI 正常路径按钮键为 `top/jg/mid/ad/sup`，不易触发）
- **实际**: `pickPlayerPos('jungle')` 静默写入 `_pcPos`；`createPlayerCareer` 在 `POS[_pcPos][0]` 抛 `TypeError: Cannot read properties of undefined (reading 'n')`（game.html createPlayerCareer 日志文案处）
- **涉及**: `src/js/main.js` `pickPlayerPos` / `createPlayerCareer`
- **建议**: `if(!POS[p])return;` 白名单 `POS_ORDER`

---

### [P2-C] 教练转会页 pageHint 仍以经理向文案开头

- **优先级**: **P2**
- **实际**: `PAGE_HINTS.market` = 「**买人卖人**：赛前转会期自由组队…教练模式=应急租借与引援申请」
  - 教练页正文已是「教练工作台」「**不能挂牌出售选手**」
  - 首句与身份能力矛盾（轻微认知噪音，非功能缺失）
- **涉及**: `src/js/guide.js` ~L9；`src/js/ui-market.js` `renderCoachMarket`
- **建议**: 教练模式 hint 首句改为「应急租借与引援申请；买卖由俱乐部打理」

---

## P0 清单（汇总）

1. **[player/kjia] 选手可提拔 K甲选手进一队** — `promoteKjiaPlayer` 无 mode 门禁，名单可被选手身份改写；文案仍引导经理路径。

---

## 路径核对（任务书条目 → 结论）

### 选手 player

| 路径 | 结论 |
|------|------|
| 开局（无名小将/选队） | **通过** · 空名默认「无名小将」；3 张可选队卡 +「换一批」；`pickPlayerTeam` 不重掷 |
| 生涯：训练 | **通过** · 四维+英雄特训+休息；`S.trained` 日限；伤停/集训/外租拦截有 toast |
| 生涯：申请转会 | **通过** · `playerRequestTransfer` 产出 `S.offers`，生涯页有留队/接受按钮 |
| 生涯：租借/K甲 | **通过** · 板凳出路面板；满 3 天可租借；confirm 后 `loanOut` 生效 |
| 生涯：退役 | **通过** · 引擎到龄退役 + 生涯结算屏（履历表/重新开始/条件性转教练） |
| startPlayerMatch | **通过** · 自动 BO5；`matchIdx`/`history`/`career.stats.matches` 推进 |
| MODE_PAGES.player 六页 | **通过** · 均可打开；league 为只读榜单（内容非空） |
| 被征召/伤停/退役 UI | **通过** · 伤停训练 disabled + 文案；未成年不进首发；退役后 match/nextDay toast 拦截 |
| 越权 kjia 提拔 | **FAIL · P0-A** |

### 教练 coach

| 路径 | 结论 |
|------|------|
| 选队→开始执教 | **通过** · `pickCoachClub` + `applyCoachClub`；`coachDeal.years=2`；nav=MODE_PAGES.coach |
| 阵容/训练/自动引援可见 | **通过** · lineup 有首发/战术/无出售；train 可用；缺位 `coachAutoSquad` 有日志 |
| 豪门邀约 accept/reject | **部分通过** · 精确模板名 OK；非法名静默失败 → **P1-A** |
| goPage('market') 无 market 时 | **说明** · coach **有** market 页签（应急租借/引援），非缺失；player 无 market → toast+回退 **通过** |
| goPage('biz') | **通过** · toast「当前身份没有「经营 · 钱袋子」页，已回到俱乐部」 |
| startMatch / BP | **通过** · UI 全链路：`uiStartMatch` → 赛前准备 → `openBP` → BP 征召 → `bpConfirm`/`playGame` 推进 |

---

## 修复建议（仅报告，未改代码）

1. **P0** `src/js/kjia.js` `promoteKjiaPlayer` / `recallKjia` / `sendKjia`：`if(s.mode==='player'){toast('…');return;}`；`src/js/ui.js` `renderKjia` 选手分支隐藏班底操作按钮。
2. **P0/P1** `src/js/guide.js` `PAGE_HINTS.kjia` / `renderKjia` 正文：选手身份改写为「生涯页自请下放/租借」。
3. **P1** `src/js/main.js` `respondCoachOffer`：`!tmpl` 时 toast + deal log，勿静默 `coachOffer=null`。
4. **P2** `src/js/ui-career.js` `playerTrain`：gain≤0 时 toast 补全「今天没有提升」。
5. **P2** `src/js/main.js` `pickPlayerPos`：POS_ORDER 白名单。
6. **P2** `src/js/guide.js` `PAGE_HINTS.market`：教练身份首句去「买人卖人」。

---

## 备注

- **未修改** src/**、game.html；未 commit。
- 截图：`E:\sex\gui-test-screenshots\pc-*.png`、`coach-*.png`、`player-kjia-leak.png`。
- 探针 JSON：`.bug-hunt/player-coach-probe.json` / `*-coach.json` / `*-deep.json` / `*-uibp.json` / `*-leak.json`。
- 探针曾用错误 POS 键 `jungle` 导致 `createPlayerCareer` 抛错 → 归入 **P2-B**（输入校验），非 UI 按钮缺陷。
- 在 series 已结算后直接 `playGame()` 会 `S.series=null` 抛错，属探针乱序调用；**UI 正常 BP 路径已验证推进**，不计入产品 P0。
- 既有引擎门禁 `tests/verify-career.js`、`verify-playerops.js`、`verify-playerstatus.js` 本轮全部 PASS。
- `MODE_PAGES.coach` **包含** `market`：任务书中「无 market 时 goPage('market')」在正式版不成立；对应门禁实测在 player 侧（market/lineup/biz/train）与 coach 的 biz 页，行为正常。
