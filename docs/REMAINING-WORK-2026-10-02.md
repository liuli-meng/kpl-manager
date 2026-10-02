# KPL 经理 · 未完成项清单（2026-10-02）

> 本文是「现存可优化项审计与实施计划」的执行收尾：**已完成的部分见 §0，未完成的部分见 §1–§4**。
> 每条都带 `file:line` 或实测输出，可直接照做；凡我未验证的一律标 UNVERIFIED。
>
> 核验基线（本文写作时的实测值）：
> - `node tests/run.js` → **99/100 通过 · 136.8s**，唯一红线 `sim-quick` 见 §1（**非本次改动所致**）
> - `node build.js` → `game.html 945 KB / 38 模块`；**再构建一次哈希不变**（产物与 src 一致，CI 的 `git diff --exit-code game.html` 可过）
> - `src/index.html` 引用的 38 个模块**全部解析通过**；`KM_BUILD='2026-10-02a'`
> - 浏览器真机门禁 `verify-browser-ui` → **15/15**（含新增的裁切断言与证伪）

---

## 0. 本次已落地（附核验方式，勿重复做）

| # | 项 | 关键改动 | 核验 |
|---|---|---|---|
| 0-1 | **点名阶段选秀卡被静默裁切**（玩家可见 · 阻断级） | `draft.js` 把可点网格包进有界滚动容器；`style.css` 把固定 `max-height:1200px` 换成实测 `var(--panel-h,1200px)`；`main.js` 新增 `syncPanelCaps()`（renderPage / 展开点击两处挂点，+8px 余量） | 真机实测：修复前 375/768/1280 视口下网格自然高 4320/3683/1929 px 全被裁；修复后 `verify-browser-ui` 裁切检查 0 命中；**摘掉容器会被门禁报红**（已证伪） |
| 0-2 | **唯一真机门禁在干净检出里恒绿** | `verify-browser-ui` 改为 `exit(3)` 跳过语义（含 `KPL_NO_BROWSER=1` 确定性入口）；`run.js` 新增 `SKIP_EXIT`/`KNOWN_SKIPABLE`/`--require-browser`，跳过**不计通过**、汇总单列 | 强制跳过 → `0/0 通过 · 1 跳过`、exit 0；加 `--require-browser` → 判失败、exit 1 |
| 0-3 | **沙箱把 40 个模块拼成一个脚本，改变了 JS 语义** | `harness.js` 改为逐模块 `vm.runInContext`（新增 `loadModules`/`runScripts`，`opts.scripts`/`opts.prepend`）；`verify-built` 改为逐 `<script>` 执行；新增 `tests/verify-harness-fidelity.js` 并注册 | 沙箱 `KPL_ERAS` 由 2 个变 **11 个**（与浏览器一致）；新门禁钉住两条实测语义（后置 `const` 的 `typeof` 得 `'undefined'`；跨 script 同名 `const` 只毁第二个 script） |
| 0-4 | **幽灵队：2020–2026 七个年档各多出一支同名队**（沙箱保真后暴露的真缺陷） | `data.js` 修 2018 `out` 笔误（`成都AG超玩会`→`AG超玩会`，该条原本空转）；`teamsAtYear` 加去重兜底；AG 更名移到 2019（与 `in` 同名）；`applyHistoricalLeague` 的回归年与重返判定改为**更名感知**并同步 `s.teamName` | 11 个年档 `dup` 全空；`verify-era-history` / `verify-mode-achieve` 用真实队名重写并**加强了断言**（原先两条用例都在钉错误行为，②/⑥ 还是恒真） |
| 0-5 | `audit-static` 时代档循环只覆盖 2/11，且把「18 队」钉死 | 改为结构性不变量：名录不得同名队 / 规模 ∈[10,18] / 模板数 ≤ 联盟队数；新增 ②b **跨模块顶层同名声明**静态门禁（生产里等于后一个模块整块不执行，Chrome 实测过） | 11 个年档全绿；②b 在 `eventStoryLines` 重复期会报红 |
| 0-6 | 回收商一口价绕过转售上限（零出场套利 757 万） | `transfer.js` `lowball` 夹 `sellCeiling` | `verify-value-fee` ⑤b：1800 ≤ 上限 1800（原式 2730） |
| 0-7 | 自动续约永久锁低薪（工资帽可旁路） | `transfer.js` `endTransferWindow` 自动续约时把年薪拉回 `wageOf(o,age,pop)`（取 max，不降薪） | `verify-contract` ⑪：20 万 → 67 万 |
| 0-8 | 青训晋升不写 `acqCost`（转售无上限） | `train.js` 招募/单独培养/一键培养累计 `trainSpend`；`promoteRookie` 写入 `acqCost` | `verify-academy` ⑨：`acqCost=9万 · 转售上限 8万`（原 null） |
| 0-9 | K甲下放是绕开个人天花板的无限成长通道 | `kjia.js` `kjiaGrantReturnGrowth` 改为受 `p.peak[k]` 约束、无空间不计 gain | `verify-kjia` ⑤c：达峰选手 8 轮归队成长 **+0**（原每轮 +5） |
| 0-10 | 奢侈税展示比实扣高 9 倍 / 「1500 万封顶」文案 | `ui.js` 按发薪日口径展示（含一年 `ECON.payWeeks` 次数）；`transfer.js` 7 处 `1500` 改由 `TRANSFER_CAP` 派生；`docs/rules/transfer.md`、`docs/rules/data.md` 全面更正（含 `PLAYER_WAGE_MAX 70→400`、身价锚点、`wageOf` 双口径） | 全仓 `grep 1500` 在 transfer 相关处 0 命中 |
| 0-11 | 迁移失败不可观测、且「把失败当成功上报」 | `state.js` 删除伪造 phase + 无条件「已尝试重建」；失败写 `_migErr` 且按真实结果分岔日志；`migrateSave` 收尾广播 `_migErr`；`debug-panel.js` 常驻展示 `_migErr`/`_lastAudit` | `verify-migrate` ⑧ 仍绿 |
| 0-12 | 崩溃快照有完整存档却无恢复入口 | `debug-panel.js` 新增「恢复此快照」走真实 `applyImport` 链路（含确认框） | 面板渲染冒烟通过；**端到端恢复未实测（见 §4）** |
| 0-13 | `perf-monitor`/`perf-dashboard` 假装挂上（谎报 `Hooked to renderAll`） | 两个模块从 `src/index.html` 摘除（无消费者，产物减 2 段/约 5.8KB，40→38 模块） | `verify-built` 报「产物内联脚本段数 40→38」；全套仍绿 |
| 0-14 | `verify-market-refresh` 运行时半场**无法让 runner 变红**（打印 `[FAIL]` 仍 exit 0） | 末尾补 `if (/\[FAIL\]/.test(out)) process.exitCode = 1;` | **已证伪**：把 `marketRefreshFree` 改 `return false` → 3 条 `[FAIL]`、exit 1；还原后 exit 0 |
| 0-15 | `KM_BUILD` 与玩家可见变更脱节 | `2026-09-19i` → `2026-10-02a` | `game.html` 内实测读取到新戳 |

---

## 1. 待外部处理（不是我的改动造成的，也不该由我「修绿」）

### 1-1 `sim-quick` 红线：现代档 `AG豪门` 夺冠率 86% > 85%

- 现状：全套唯一失败项，断言 `tests/sim-quick.js` 的 `AG 夺冠率 86% 越界 ≤85%（基线 ~65%~75%）`。
- **归因（已排除本次改动）**：现代档（`era=null`）不走 `applyHistoricalLeague`（2026 的 `out`/`rename` 全空），本次改动不触及该路径；且我**在动手任何一行之前**（刚修完 `match.js` 时）实测即为 86%。
- 真实来源：并发会话在 14:15 前后替换了 `match.js` 的 `eventStoryLines`（新增更丰富的解说实现），它消耗的 `Math.random()` 次数与旧版不同 → **固定种子的随机流整体平移** → 平衡门禁的区间被打穿。这是「种子化模拟 + 随机流耦合」的既有脆弱性，不是数值被改坏。
- **处置建议（不要靠放宽区间解决）**：
  1. 由该会话确认新解说实现是最终形态后，重跑 `npm run sim`（大样本）拿到新基线，再**显式**调整区间并写理由；或
  2. 让解说文案生成使用独立随机源（例如另一个 mulberry32 实例），与比赛结算的随机流解耦——这样改文案不再移动平衡门禁。**推荐 2**，它把这类「改文案就打穿平衡门禁」的耦合一次性去掉。
- 我**没有**改 `sim-quick.js` 的任何阈值（那属于「为了让验证变绿而放宽阈值」，纪律禁止）。

### 1-2 并发会话正在改 `src/js/match.js`（我只做了最小修复）

- 我发现时：`match.js` 有重复声明（`genMatchStory` 内两份 `const evLines`）→ 整个模块 SyntaxError，全套门禁红。经用户确认后我删掉重复的两行，并删掉其上方**遗留的旧版 `eventStoryLines` 副本**（第 15–54 行；后置同名函数本来就覆盖前者，删除是行为等价的，且 `audit-static` ② 明确禁止重复函数定义）。
- 现状：`match.js` 解析通过、`audit-static` 通过，但**该会话的改动尚未收尾**（`eventStoryLines` 的新实现、`sim-quick` 的新基线都由他们定）。
- 疑似肇事者：`tests/dev/apply-match-events.js` 与 `tests/dev/replace-singlegame.js` **直接原地改写 `src/js/match.js`**（自改脚本，当前自身已坏）。**不要再运行它们**；建议连同 §3 的卫生清单一起处置。

---

## 2. P1 未完成（3 项，都是「改了会影响平衡/流程，需要先定口径」）

### 2-1 【高】时代档年终**完全不结算**：2016–2023 共 8 个年档永远不结算

- 证据：`cups.js:490-496` `setupAnnual()` 开头 `if(!fmtOf(s).hasAnnual){ logEvent(...'赛季收官'); newSeason(s); return; }`，而结算只在 `finishAnnual`：`cups.js:658-661` `playerYearSettle(s)` / `boardSettle(s)` / `coachPoach(s)` / `buildYearReview(s)`。
- 实测影响面（`KPL_ERAS[k].rules.hasAnnual`）：**2016–2023 全部 false**，2024–2026 才是 true。也就是说从这 8 个年档开局，玩家：
  - **永远不会被解约**（`board.fired=true` 只在 `boardSettle` 内，`board.js:74`）；董事会 KPI / 信任度年度结算整体失效；
  - `managerCareer.years` 恒为 0（「执教 N 个赛季」永远是 0）；
  - **年度回顾面板永久空白**（`yearReviews` 不增长）；
  - 教练档没有豪门挖角（`coachPoach`），选手档没有赛季结算（`playerYearSettle`）。
- 建议改法：抽 `yearEndSettle(s)`，把 `cups.js:658-661` 那四行搬进去，`hasAnnual` 分支在 `newSeason(s)` **之前**调用它。
- 为什么没做：它在赛季收官主链上，`sim-yearend`/`late-game-probe`/`verify-annual` 等门禁都压着这条链；改动需要重新标定这些门禁，且「时代档该不该有年度回顾」是产品口径（有些年代确实没有年总，但**年度回顾/董事会结算**与年总是两件事）。**建议 owner 先确认「无年总的年代也要年度结算」**，再做这一步。

### 2-2 `wageOf` 两条口径未对齐（最大差 43%）

- 证据：`data.js` `function wageOf(o,age,pop)` —— 1 参走 `WAGE_PTS` 曲线，3 参走 `PLAYER_SALARY_REAL.calculate_wage`。实测：85 → 220 / 289；99 → 400 / 400；55 → 42 / 72。
- 调用点分裂：1 参用在 `draft.js`（选秀定薪）、`train.js:209`（青训定薪）、`transfer.js`（续约要价/成交）、`season.js`（涨薪）；3 参用在 `state.js` 的 `scrubWages` 与 `migrateEconV2`。**于是迁移按一条曲线改写年薪，而续约 UI/谈判按另一条问价。**
- 为什么没做：统一到任一条都会改动**全局工资水平**（例如 1 参统一到 3 参，选秀/青训底薪会整体上移 40%+），进而移动 `sim-quick`/`sim-yearend`/`verify-idle`/`verify-paycadence` 的区间 —— 这与 §3-1 的 ECO-01 是同一个「量级口径」决策，应一并拍板后一次性重标定。
- 现在已做的：`docs/rules/data.md` 如实写明了两条口径与实测值，不再假装只有一条。

### 2-3 「K甲顶班」只改文案、不进联盟，且每年重置

- 证据：`rules.js:49-108` 只改 `s.tempSeats/tempSeatFixed/tempSeatLog`，`AI_TEAMS` 全程只被读（`rules.js:38/78/86`）；实测 `S.leagueTeams.includes('K甲·苍穹') === false`。且 `rules.js:51` 每次都调 `initTempSeats`，`rules.js:36` 把列表重置回两个硬编码升班马 → 连续两年打印同一句「收回 常山UUG 临时席 → K甲·苍穹 顶上」，而 `rules.js:94` 却公告「获得下赛季 KPL 临时席位」。
- 建议改法：升班真的写 `AI_TEAMS`/`AI_ROSTERS`/`s.leagueTeams`；去掉 `settleTempSeats` 内的重置；垫底判据从「两个临时席之间取最小」改成全年积分榜。
- 为什么没做：改的是联盟成员表本身（影响赛程/分组/平衡），且与 §4-2 的「2027+ 联盟变更机制」是同一块地基。

---

## 3. 需要 owner 决策的刻度问题（P2）

| # | 问题 | 证据 | 两条路与后果 |
|---|---|---|---|
| 3-1 | **ECO-01 量级**：收入按「万/日」、工资与工资帽按「万/年」 | 实测 63 天净增 +25,050 万 ≈ 25,050 万/年，对 `wageCapDefault=2000` 万/年 = **12.5×**（未饱和口径 16.8×）；`data.js:23/28`、`season.js:702`、`clubops.js:36-44` | **A（推荐）**：不动收入，把约束做成规则 —— `hardWageCap(s)=wageCap*1.35`（`data.js:30`，已在 `players.js:61`/`transfer.js:941`/`career.js:633` 使用）变成真熔断（超硬帽禁注册/禁续约），奢侈税提到有痛感档，`ECON_SOFT_CAP` 绑 `wageCap×3`。**15 条经济门禁无需重标定。** **B**：`ECON.dailyScale=1/payWeeks` 施加到所有按日来源，收入 ÷9；但转会费/身价仍按现值（封顶 12000 万）→ 玩家买不起人，必须**整体重标定身价/成本 + 6~8 条门禁阈值**。无明确平衡目标口径时不要走 B |
| 3-2 | **ECO-08 债务无牙**：`fund` 被硬钳 ≥0，欠薪只掉士气；`破产` 在 `src/` 里 0 次出现；`ui.js` 的负资金告警分支不可达；而 `docs/BRANCH-TRIAGE.md:91` 却把「破产率 0%」当平衡证据 | `season.js:798-801`、`state.js:665`、`board.js:261` | 要么给财政危机真牙齿（负资金 → 扣分/转会禁令/强制卖人），要么从剧本文案与文档里撤掉「负债」承诺并停止引用破产率 |
| 3-3 | **难度阶梯**：王朝反制钉在 `streak 3`、首季即可达成，AI 侧无 season 项 | `season.js:819 Math.min(streak,3)`、`season.js:953 capGrow`、`transfer.js:298`（1.24 上限）、`transfer.js:362-364`（elite10/mid8/weak6 无年份项）、`transfer.js:276/147`（S7/S8 后走平）。实测 S1 与 S9 旋钮相同 | 反制改按「执教赛季数」递进而非冠军 streak；AI 训练预算加 `season` 项；并**补一条不强制胜负的多赛季模拟门禁**（现有 sim-quick/sim-coach 是「50 条独立首季」，sim-yearend/late-game-probe 强制胜） |
| 3-4 | **成就时间轴** | `data.js` `five_year` 用绝对年份 `gameYear(s)>=2030` 且被 MGR 白名单限制 → 2016 档要第 15 季、教练/选手档**零时间型成就**；`co_iron` 会被同一赛季的 3 条赛季中脉冲点亮（`board.js:155-157` 往同一日志写 `mid:true`）；`t_summer` 要求 `event==='夏季赛'` 而 `season.js:57` 在 ≤2021 记成「秋季赛」 | 改用 `s.season`/`split` 口径；`co_iron` 过滤 `!l.mid` 且按赛季去重；给教练/选手档补时间型条目 |
| 3-5 | **赛制/联盟地平线** | `data.js` 的 `yearFmt` 对 y>2026 回落到 2026（`verify-year-format.js:84` **主动断言**了该回落，属有意设计）；`AI_TEAMS` 实测 2026–2035 完全不变（`applyHistoricalLeague` 年年返回 `[]`）→ 联盟从**第 1 季**就冻结 | 要么为 2027+ 做轮换机制，要么在 UI/文档明确宣告「2026 为数据地平线」。**现状最糟**：`season.js:1174` 把「2026 赛制」硬编码给了每一年，玩家看不出那是地平线 |
| 3-6 | **2026 年档与现役联盟不一致（内容缺口）** | 实测 `teamsAtYear(2026)`（17 队）vs 现役 `AI_TEAMS`（18 队）：**少 `长沙TES.A`、`深圳DYG`，多 `sViper`**（sViper 从 2016 起从未被移出，`长沙TES.A`/`深圳DYG` 从未被任何 `in` 表加入） | 这是「数据作者口径」而非结构缺陷：补齐需要加 2 支队、移出 1 支（会动分组/赛程/平衡门禁）。**建议与 3-5 一起裁决**。注：`KPL_YEAR_ICON` 里已经写了这两支队的图标，说明作者本意是它们要在 |
| 3-7 | **27 条随机事件池无年份/赛段门禁** | `data.js` 事件池、`season.js:746` 均匀抽 → 非亚运年也会抽到「亚运征召」，还会抽到日历里根本不办的「冠军杯启程」 | 给条目加可选 `years`/`phases` 谓词（改动局部，风险低，可随时做） |
| 3-8 | **转会意愿 7 个重复分支（已证死代码）** | `transfer.js` 中 7 个完全相同的 `else if(p.willingness==null){ p.willingness=rnd(35,85); }`；且 `players.js:20` 已保证非 null → 整链不可达 | 删到一处（或改成无条件补值）。纯清理，建议随手做 |

---

## 4. P3 门禁真实性与工程卫生（按价值排序）

### 4-1 【高】门禁缺「最小断言」契约 —— 零断言用例仍算通过

- 证据（本机复现）：`node -e "require('./tests/harness').makeTester('零断言').report()"` → 打印 `[PASS] 零断言` 且 `exit 0`；`run.js` 只看退出码（`ok = code === 0`）。因此「跑了个空壳」与「真断言」在汇总行不可区分。
- 已做的一半：`verify-browser-ui` 的跳过语义、`verify-market-refresh` 的失败通道（§0-2/§0-14）。
- 未做：`harness.makeTester` 计数断言数、`report()` 打印 `[PASS] name (N 断言)`、`N<1` 直接判失败；`run.js` 解析该标记，对 sim/probe 类维护显式白名单（未登记的零断言 suite 判失败）。
- 注意：`tests/verify-ui-standards.js`/`verify-browser-ui.js` 用的是自建 `T`（已经打印 `(N/N checks)`），可参考其形态统一。

### 4-2 待整合的门禁质量问题（逐条独立，都是小改）

| 文件 | 问题 | 改法 |
|---|---|---|
| `tests/verify-ui-standards.js:43` | 用正则前瞻切 `max-width:640px` 块，而块内第一个 `\n@media`（style.css:559 的 760px 块）就终止匹配 → 47–49 三条 `min-height` 断言**结构上不可能失败**；`:64` 断言的还是 `main.js` 而非 `style.css` | 改花括号配对切块；断言对象改成 `styleCss`；补「粗指针下最小 44px」真实断言 |
| `tests/verify-idle.js` | 断言 `<=25`（±25%）但 PASS 文案写「带内 ±10%」，注释、区间、文案三处不一致 | 先修文案与注释；区间收紧应在 §3-1 口径拍板后重新标定 |
| `tests/verify-paycadence.js` | ② 用**自己的公式**复算 `weeklyWage/payWeeks`，而非量 `s.fund` 差值 → 测不出「扣多了」；且 `season.js:677` 把 `payWage` 异常吞掉（对比 `season.js:731` 未吞），抛错的发薪仍被计为成功 | 改为量发薪日前后 `s.fund` 差值；去掉 `season.js:677` 的静默吞异常（或至少记日志） |
| `tests/verify-storage-fallback.js` | 只桩「读+写都抛」，无法发现 `storeGet/storeSet` 不对称（而这正是上一轮的真实故障形态） | 补第三种桩：`setItem` 抛、`getItem` 正常 |
| `tests/verify-corruption.js:85` | `if(S.teamName!=='半残'&&S.teamName!=='半残'){}` 恒假空断言；④ 只断言「不崩」，从不校验 `v` 回落值 | 删空断言；补 `v` 断言 |
| `tests/verify-statestore.js` | ④ 至今没有 `d.v` 断言；`dirty` 对象构造了却从未传给 `sanitizeImport`（其注入断言从未执行） | 把 `dirty` 真正喂进去；补 `v` 边界用例（`-1e9/0/'abc'/true/4.9`） |
| `tests/late-game-probe.js` | 默认 `FORCE_WIN=true` 且已注册 → 门禁只跑「一直赢」的轨迹，`--lose` 永不执行 | 默认两条轨迹都跑（或把 `--lose` 纳入 SUITES 的第二条） |
| `tests/sim-quick.js` | 种子注入整块**重复两遍**；band 契约 `filter(x=>typeof x==='string')` 把非字符串当通过 | 删重复块；契约改 `.filter(x => x !== true)`；区间按 §1-1 重新标定 |
| `tests/fuzz.js` | 是**真门禁**（4 条不变量 + `T.report()`），却不在 `SUITES`，也没有说明排除理由 | 注册进 `run.js`（固定种子，或给 SUITES 项加 `args` 字段） |
| `tests/econ-fee-probe.js`、`tests/value-fee-probe.js` | 拆掉公式只打印、**零断言**，且没有任何排除说明（`tests/` 下放着名字像门禁的文件却永不执行） | 补首行「诊断脚本，非门禁」声明（照 `verify-no-deadend.js:1` 的做法）或移入 `tests/dev/` |
| `tests/playthrough/**` | `run.js:122` 只扫顶层目录 → 目录下的脚本（含真实浏览器存读档用例）完全在注册表之外；且多处写**固定绝对路径**（`E:/sex/gui-test-screenshots/...`、`.bug-hunt/...`） | 要么登记、要么在 `tests/playthrough/README` 明确「非门禁」；固定路径改随 `RUN_ID`/`pid` 隔离（多会话并发会互踩） |

### 4-3 卫生与孤儿文件（需 owner 一句话才能删）

- `src/core/plugin-engine.js` + `sandbox-runner.js` + `plugin-loader.js`（约 440 行）+ `mods/`：**孤儿** —— 三个类被实例化只为打印日志，`src/js` 无任何调用者，且 `plugin-loader.js` 的 `require('fs')` 在浏览器里根本不可能工作。删掉可减约 14KB 与 5 行启动日志，但「模组能力要不要保留」是产品取舍。**若保留**，请补一条「模组入口存在」的门禁，否则它只是包体里的死码。
- `src/core/state.js`：第二个 `CORE_SAVE_VERSION=4` + 平行 schema，零消费者，却被 `src/index.html` 加载并拼进产物。建议移出 `src/`（删除类操作，需确认）。
- `src/js/perf-monitor.js`、`src/js/perf-dashboard.js`：已从 `index.html` 摘除（§0-13），但**文件还在**。建议物理删除。
- `src/js/bpm-addition.py`：174 字节，内容是 JS 注释的 `.py`，混在 `src/js/` 里（不进构建）。
- `h2h.js`（仓根）：自带一份 DOM 桩与手抄模块清单，与 `harness.js` 的「清单单一真相源」冲突；且不在任何门禁里。
- `patchState`/`setState`/`freezeStatics`（`stateStore.js`）：**零调用者**的 API 面，注释写着「新代码优先用」。要么删，要么在某个真实入口采纳，别继续挂着「建议用法」。
- `.gitattributes`/行尾：本次有 7 个文件出现「working copy 为 CRLF、git 将在下次接触时转 LF」的告警。提交时 git 会归一化，但**建议提交前确认 `git diff --check` 干净**，避免又回到上一轮被专门终结的行尾混态。
- `README.md:15/16/298`：仍写「72 项测试 / 约 800 KB / 成就 24 项」，实测 **100 项 / 945 KB / 47 项**。
- `data.js:12` 注释仍写「发薪日扣 年薪/52」，而同文件 `ECON.payWeeks=9`（`season.js` 内也有同款注释）——口径已改、注释未改。

### 4-4 UNVERIFIED（我明确没验的）

- **崩溃快照的端到端恢复**（§0-12）：只做了渲染冒烟，没有真的「造一次崩溃 → 点恢复 → 校验状态一致」。需要一条真机用例。
- **`mcoach`/`mrenew` 在「教练市场满员 + 全员合同年」下是否会超过 `--panel-h`**：本轮两次实测都未复现超限，故只保留通用加固，没有针对性断言。
- **真机 44px 断言在 CI 的稳定性**：`verify-browser-ui` 依赖 `C:\Program Files\Google\Chrome` 与父工作区的 playwright-core（`package.json` 无任何依赖）。要让它在 CI 真跑，需 `npm i -D playwright-core`，否则会走 §0-2 的「跳过」路径（现在至少不会再假绿）。

---

## 5. 工作区状态与过程记录（给下一个会话）

- **未提交改动（全部是本次会话的）**：`src/js/{data,draft,main,kjia,train,transfer,ui,state,debug-panel,match}.js`、`src/css/style.css`、`src/index.html`、`game.html`、`docs/rules/{transfer,data}.md`、`tests/*`（15 个文件，含新增 `tests/verify-harness-fidelity.js`）。
- **本次会话之外、我未触碰的未提交改动**：`tests/verify-econ-snowball.js`（新增⑦巨资收敛用例，**已实测通过**，保留）、`tests/dev/diag-eco-*.js` 等 7 个未跟踪诊断脚本。**不要覆盖**。
- **事故与恢复（如实记录）**：我用 PowerShell 批量替换 `transfer.js` 里 7 处 `1500` 文案时，误用 `Get-Content`(数组) + `Set-Content -NoNewline` → **整个文件被写成一行**（103,621 字节 / 1 行，`//` 注释会吞掉后续代码）。处置：确认 `transfer.js` 在本次会话前是干净的（`git status` 当时只有 `match.js` 被改），用 `git checkout HEAD -- src/js/transfer.js` 还原到 2033 行，再用 `edit` 工具**逐条**重做 3 处改动（回收商上限、自动续约、7 处文案），复核 2046 行 / 解析通过 / 两个门禁绿。**教训：源码文件一律不用脚本改写**（`README.md` 里记过同类事故），批量替换只允许用 `edit` 逐条做。
- **验证口径**：`node tests/run.js`（100 项）、`node tests/verify-browser-ui.js`（真机 15 项）、`node build.js` + 二次构建哈希比对（产物可复现）。所有新增/修改的断言都做过**反向验证**（改坏 → 必报红 → 还原）：选秀裁切、真机跳过、`verify-market-refresh` 失败通道、`sim-quick` 阈值未被放宽。

---

## 6. 建议的下一步顺序

1. **等 `match.js` 那条线收尾**，然后按 §1-1 的**方案 2**（解说文案用独立随机源）解耦随机流，再重标定 `sim-quick` —— 这一步做完，门禁才有干净的 100/100 基线。
2. **§4-1 最小断言契约**（门禁可信度的地基，一次性收益最大）。
3. **§4-2 的六条假断言/假覆盖**（都是小改，且能立刻防止回归）。
4. **§3-1 ECO-01 口径拍板**（推荐方案 A），随后 §2-2 `wageOf` 统一与 §4-2 的 `verify-idle`/`verify-paycadence` 重标定一起做。
5. **§2-1 时代档年度结算**（影响 8/11 个开局，玩家可见；先确认产品口径）。
6. **§3-5/3-6 赛制与联盟地平线**（与 §2-3 K甲顶班同一块地基），以及 §4-3 的孤儿文件处置。

---

*本文只描述未完成项与过程事实；已完成项的核验方式见 §0 表格最后一列。凡我未能实测的都标了 UNVERIFIED，请勿当成结论使用。*
