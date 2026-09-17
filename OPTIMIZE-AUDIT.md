# KPL 经理 · 优化诊断报告

- 审计对象：`E:\sex\kpl-manager` 主仓 @ `6b54d1b`（重构 L2 之后）
- 审计方式：三路并行只读审计（架构/状态、运行时性能、测试与代码健康度）+ 人工复核关键结论
- 规模基线：`src/js` 22 个文件 / 10,555 行；`tests/` 50 个脚本；产物 `game.html` 685 KB

> **修订记录（2026-09-17，动手阶段）**
> 初版报告有三处是**审计 agent 报的、我没复核就采信**的错误结论，动手实测后已全部推翻并在正文标注修正：
> 1. P0-2 说「`transferList` 占全文 36%，可一刀切剥离」→ 错。真实存档里它是 **0**（转会窗关着）；而 `market`/`freeAgents` 由随机数生成，剥掉会**换人**。
> 2. P0-2 说「给 `save()` 加 400 ms 防抖」→ 错。会违反 `verify-save.js:72` 的既有断言，测试必红。
> 3. P0-3 说「静默改判冠军」→ 不准确。`season.js:339` 本来就有 `logEvent` 留痕，丢的是**异常原因**。
>
> 教训：agent 报的「体积占比」「可重建」结论必须自己量一遍再信。三处里两处都是**量化错误**，不是判断分歧。
>
> P0-1 / P0-2（部分）/ P0-3 本次已实施并跑通回归，详见各节「已实施」。

---

## 结论速览

| 级别 | 数量 | 性质 | 状态 |
|---|---|---|---|
| **P0** | 3 | 1 个平衡性回归（沉默 bug）+ 1 个存档瘦身 + 1 个异常留痕 | **3 项已修** |
| **P1** | 8 | 性能热点、约定失守、测试盲区 | 待排期 |
| **P2** | 12 | 可维护性、健壮性、一致性 | 待排期 |

本次实修清单：
- `data.js` 27 条时代俱乐部模板 ÷6（P0-1），并用 `audit-static` 加刻度区间门禁
- `serializeForSave` 剥离 `matches`，存档 121,049 → 111,065 字符（P0-2）
- 季后赛异常留痕 `_poError` + `verify-entrypoints` 断言（P0-3）

---

## P0

### P0-1　历代联盟开档经济是真实刻度的 6 倍〔平衡性回归 · 已修〕

**这是本次审计最重要的发现。**

`866ec5c`（09-12「经济压缩到真实刻度」）把全联盟货币 ÷6，但它**只压缩了现代 `CLUB_TEMPLATES`，漏掉了历代联盟 `KPL_ERAS` 里的俱乐部模板**。

证据：

```
src/js/data.js:456   {name:'成都AG超玩会',...budget:2500,cap:250,...}   ← 现代模板，已 ÷6
src/js/data.js:850   {name:'QGhappy',...budget:14000,cap:1450,...}     ← 时代模板，仍是 ÷6 之前
```

`14000 / 6 = 2333`、`1450 / 6 = 241.67` —— 正好等于现代顶级模板「重庆狼队」的 `2333 / 242`（`data.js:457`）。这说明时代模板**原封不动停在了旧刻度**。

而且自动迁移救不了它：

```
src/js/state.js:195   ...moneyScaled:true,econReal:true,    ← newState 直接标记「已迁移」
src/js/main.js:780    S.fund=tmpl.budget;
src/js/main.js:781    S.wageCap=tmpl.cap;                   ← 原样赋值，无人做 ÷6
```

`newState()` 新建档时就把两条缩放迁移标记为已完成，`applyClub()` 随后把 `14000/1450` 直接盖上去，于是 `migrateMoneyScale` / `migrateEconReal` 永远不会再对这个档生效。

**影响**：选「历代联盟」开档，资金 14000、工资帽 1450；但选手周薪来自 `wageOf(overall(p))`（`players.js:7`），已经是真实刻度（单人数十、`PLAYER_WAGE_MAX` 封顶），赞助/门票/代言也全是真实刻度。结果是**工资帽永不触发、奢侈税永不产生、资金多到没意义**——历代档的难度直接崩塌。

**为什么测试没拦住**：`tests/audit-static.js:124` 只断言了 `S.wageCap=tmpl.cap` 这句赋值存在，没有断言数值区间，所以两边刻度差 6 倍它照样绿。

**已实施**（选了方案 ①，因为 `seed` 是战力、不该跟着缩放）：
1. `data.js` 里 27 条时代俱乐部模板的 `budget` / `cap` 全部 `Math.round(÷6)`：2017 时代 12 条（`data.js:853-864`）+ 2019 时代 15 条（`data.js:947-961`）。`seed`、`players`、`coach` 一字未动。
2. 数值对齐得很干净，进一步印证 ÷6 就是正确还原——`QGhappy 14000/1450 → 2333/242` 正好等于现代顶级模板「重庆狼队」；`AS仙阁 9000/1180 → 1500/197` 等于「广州TTG」；`JC 8500/1120 → 1417/187` 等于「苏州KSG」。
3. `audit-static.js` 新增 `econBadOf()` 刻度门禁，**现役模板和时代模板都过一遍**：断言 `cap ∈ [150,300]`、`budget ∈ [800,2700]`、以及 `budget/cap ∈ [4.5,12]`。第三条才是真正能抓住「漏缩放」的那条——单看数值区间，6 倍偏差很容易被误当成「设计上的强队」。
4. 四条开局路径（`applyClub` / `applyCoachClub` / `createPlayerCareer` / `main.js:341` 转投豪门）全部从 `CLUB_TEMPLATES` 取模板，而 `installEra` 开局时会把 `CLUB_TEMPLATES` 整体换成时代模板（`data.js:1005`），所以改数据表即全覆盖。

**反向验证过**：把 `QGhappy` 改回 `14000/1450` 后，`audit-static` 立刻报 `["2017:QGhappy经济刻度工资帽1450/资金14000"]`；还原后恢复绿。门禁是真的会响，不是摆设。

---

### P0-2　存档 121 K 字符，真正可剥的只有 8.2%〔原结论已修正〕

> **修正说明（2026-09-17，动手阶段复测）**：本节初版写的是「`transferList` 占全文 36%，可一刀切剥离，顺带给 `save()` 加防抖」——**这两条都被实测推翻了**，下面是复测数据。

把真实存档（`saves/KPL存档_AG_2026年_槽1.json`，121,049 字符）按字段拆开量：

| 字段 | 字符 | 占比 | 能不能剥 |
|---|---|---|---|
| `extraDefs` | 23,975 | 19.8% | ❌ 持久化的「联盟新生 def」，作者已给它做了 CAP 剪枝（`transfer.js:60-72`） |
| `history` | 23,548 | 19.5% | ⚠️ 其中 96% 是历史比赛的直播文案（单条 1,132/1,177 字符），属产品取舍 |
| `eventLog` | 11,197 | 9.3% | ❌ 已封顶 200 条（`season.js:54`） |
| **`matches`** | **9,909** | **8.2%** | ✅ **纯派生**（bracket + `series.mid` 的投影），读档 `rebuildMatchStore` 会重灌 |
| `transferList` | **0** | 0% | — 转会窗关闭时本来就是空的 |

**三个必须记住的坑**（初版建议全踩了）：

1. **`market` / `freeAgents` 绝对不能剥。** 初版说「它们同理是缓存」是错的：`refreshMarket` 用 `Math.random()` 生成货架 6 人（`transfer.js:1218-1227`），`buildTransferMarket` 用 `shuffle/pick/rnd` 生成自由球员（`transfer.js:523-545`）。剥掉再重建 = **读档后货架和自由市场直接换一批人**，那是 bug 不是优化。
2. **`transferList` 可剥，但有副作用。** 它只在转会窗打开时存在，那一刻实测 86 人 / 71,883 字符，占全长 **37.3%**——确实是存档最大的时刻。但 `buildTransferMarket` 里 `willingness` 是 `rnd()` 掷出来的（`transfer.js:511-513`）。剥掉 + 读档重建 = 谈判难度重新掷骰，等于开了**存档刷分**的口子。收益大，但要你拍板能否接受。
3. **`save()` 不能改防抖。** 初版建议加 400 ms 合并写，会直接违反既有断言 `tests/verify-save.js:72`「解除静默后 save 未落盘」，整套测试变红。作者已有的 `_quietSave` 才是正确范式（`transfer.js:1175` + `season.js:510`，配套断言 `verify-save.js:59-74`）：批量操作期间静默、结束后统一落盘。

**本次已实施**：`serializeForSave` 剥离 `matches`——121,049 → 111,065 字符（省 8.2%），并在函数注释里写清上面三个坑，防止以后有人再「顺手优化」出问题。

**留给你拍板的两件事**：
- `history` 里约 18.7% 是历史比赛文案。若只保留最近 5 场的 `logs`，能再省约 14%——代价是牺牲「回看旧比赛」。
- 转会窗期那 37%（`transferList`）要不要拿，取决于你能否接受「读档重掷谈判意愿」。

---

### P0-3　季后赛推进异常被吞掉，兜底只剩「走了兜底」没有「为什么」〔已修〕

```
src/js/season.js:317-318   try{buildPlayoff(s);}catch(e){}
src/js/season.js:324       try{playoffStep(s);}catch(e){break;}
```

> **修正说明**：初版写「静默改判冠军」**不准确**——`season.js:339` 本来就有 `logEvent(' 季后赛残局补完：…')`，兜底是有留痕的（而且这个函数 `ensureLeagueChampion` 是**玩家被淘汰时 AI 补出联赛冠军**的路径，由 `cups.js:34` 在杯赛开始前调用，不是玩家的季后赛）。真正丢掉的只是**异常原因**：`catch(e){}` 把 `e.message` 扔了，所以事后只能知道「走过兜底」，不知道「为什么走兜底」。

**影响**：这是 L1/L2 比赛链归一化最容易藏 bug 的位置（`mid` 找不到、引用失效、bracket 缺口都会抛错）。抛错后兜底会按 S/A 排名指定冠军——玩家和测试看到的都是「成功产生冠军」，只有 `_poError` 这种留痕才能把真 bug 从「合法结算」里区分出来。

**已实施**：
1. `catch(e)` 改为记录 `s._poError='buildPlayoff: '+e.message` / `'playoffStep: '+e.message`，并 `console.warn` 保留现场。
2. 兜底的 `logEvent` 追加原因：`（推进异常：…）`。
3. `_poError` 登记进 `SAVE_DEFAULTS`（`state.js:69`），并在 `newSeason` 按赛季归零——干净走完的赛季必须为空。
4. `verify-entrypoints` 在春/夏两次 `advanceCalendar` 后各加一条断言：`_poError` 非空即失败。

**反向验证过**：注入 `playoffStep=()=>{throw new Error('__probe_injected__')}` 后，`_poError` 确实变成 `"playoffStep: __probe_injected__"` 且异常不再逃逸——门禁是真的会响，不是永远通过。

---

### P0-4（新发现，修 P0-1 时顺手量出来的）　现役豪门开局周薪就已经超过工资帽

修完 P0-1 做验收时，我把时代档和现役档并排跑了一遍，结果现役档也不干净：

| 档位 | 初始资金 | 工资帽 | 首发周薪 | 占帽 |
|---|---|---|---|---|
| 现役 · 成都AG超玩会 | 2,500 | 250 | **289** | **116%** |
| 2017时代 · QGhappy | 2,333 | 242 | 246 | 102% |

（`weeklyWage` 含教练与助教，见 `state.js:472-474`）

**这不是我改出来的**：`git diff src/js/data.js` 只有 `@@ -853,12` 和 `@@ -947,15` 两段，全在 `KPL_ERAS` 里；现役 `CLUB_TEMPLATES`（`data.js:456`）一字未改。也就是说**改动前后现役档都是超帽开局**。

**为什么值得管**：`overCapTax` 的奢侈税是在签约时计算的（`state.js:40-42`）。如果开局就 116%，那么玩家从第 1 天起就处在「帽上」状态——要么奢侈税逻辑对存量阵容不生效（设计如此），要么就是一处没对齐。这需要你判断是哪种，我暂时不下结论。

**顺带说明 P0-1 的修复效果**：时代档从修复前的 `246/1450 = 17%`（帽形同虚设）变成 `246/242 = 102%`，和现役档 116% 落进同一量级——这正好反证 ÷6 是对的。修复前两个档位的「帽占比」差了 7 倍，那才是真正的异常。

**建议**：确认一下「开局超帽」是刻意设计（豪门压力）还是漏配。若是前者，README 的「已知限制」值得补一句；若是后者，`cap` 要跟着 `budget` 一起重标。

---

### P1-1　切页 = 整页 `innerHTML` 全量重建，转会页 81 KB / 1540 个节点

`ui-market.js:184` 一次性把横幅 + 教练 + 助教 + 买断市场 + 自由市场 + 我的挂牌拼成一整块字符串写进 `#page-market`。实测各页单次重建规模：**market 81.3 KB / 1540 元素、train 30.7 KB / 749、kjia 24.8 KB / 611、union 25.8 KB / 578**。中端手机单次切页 ≈ 60–150 ms 白屏。

更糟的是排序：

```
src/js/ui.js:1250   function setSortKey(key,v){...goPage(curPageName());}
```

点一下排序 chip 会触发**整页重建**，而它只需要重排列表。

**建议**：把 `renderMarket()` 里的 `rows` / `listed` / `cands` 三段抽成独立 `renderMarketRows()`，`setSortKey` / `setPosFilter` 只调它；列表先渲染前 30 条 + 「显示更多」，复用现成的 `max-height:340px;overflow-y:auto` 容器（`ui-market.js:116`）。另外「简化模式 `simple`」目前只跳过确认弹窗、完全不减少渲染量（`state.js:148`），可以顺手让它也降低列表长度。

### P1-2　读档时同步跑「年度收官恢复」，手机白屏 100–250 ms

```
src/js/state.js:740-742   if(typeof yearRollPending==='function'&&yearRollPending(S)&&finishAnnual(S,true))...
```

实测这条路径让 `migrateSave()` 从稳态的 0.86 ms 涨到 **31.9 ms（Node）**，同时把存档从 121 K 涨到 207 K 并立即写盘。手机浏览器 ≈ 100–250 ms 主线程全阻塞，正好落在首屏。

**建议**：把这步从读档同步路径里拿出来，改成读档后 UI 提示「上一赛季未收官，点击补完」再执行。

### P1-3　「选手状态唯一出口」被绕过〔原估算 60 处，实际 10 处 · 已修〕

> **修正说明**：初版写的「约 60 处」是审计 agent 用粗 grep 数出来的，**高估了 6 倍**。那个 grep 把单旗标判断（`if(p.loanOut)`）也算了进去，但**单旗标判断不会因为新增旗标而失效，组合判断才会**。重建判据后实际只有 10 处。

README 第 136 行自己定的规矩是「一律读 `playerStatus(p,s)`，禁止各处自己拼条件」。精确判据 = **一行内裸拼 ≥2 个旗标且带条件运算符**，实测命中 10 处：

```
career.js:75      const eligible=matchEligible(s,me)&&!me.loanOut&&(me.kjia||0)<=0;   ← 纯冗余
career.js:226     const playable=p=>p&&!p.loan&&!p.loanOut&&(p.kjia||0)<=0&&matchEligible(s,p);
clubops.js:64     if(p.retiring||p.loan||p.loanOut||p.kjia>0)return;
clubops.js:92     return !p.retiring&&!p.loan&&p.age>=m.gold+1&&overall(p)>=70;
cups.js:221       forEach(p=>{if(!p.loan&&!p.retiring)pool.push(p);});
playerops.js:45   filter(p=>p.id!==me.id&&!p.loanOut&&!(p.kjia>0)&&!p.retiring);
transfer.js:1280  filter(p=>p.pos===pos&&matchEligible(s,p)&&!p.loanOut&&(p.kjia||0)<=0)  ← 纯冗余
transfer.js:1352  if(!p||p.loan||p.loanOut||p.kjia>0)return false;
ui-career.js:120  const canReq=…&&!me.loanOut&&(me.kjia||0)<=0&&!natCamping(S,me)&&…
ui.js:25          const appsHtml=(p.apps||p.transferRequest||p.kjia>0||p.loanOut)?…
```

另外 `ui.js:220 playerBusy(s,p)` 是真漏了参数：`playerStatus(p)` 拿着 `s` 不传，丢掉了 `natCamping(s,p)` 分支。本次一并修掉。

**已实施**：
1. 两处**纯冗余**直接删掉多余条件——`matchEligible` 已覆盖 外租/K甲/伤停/集训/未成年（`state.js:294`），`&&!p.loanOut&&(p.kjia||0)<=0` 是死代码。只保留它不管的「租入」`loan`。
2. 其余 8 处等值改写为 `const st=playerStatus(p,s)` 后读 `st.loanOut/st.kjia/st.natCamp/st.retiring`——**行为不变**，只是走单一出口。刻意没换成 `st.busy`（那会把伤停/集训也算进去，是另一层语义变化，不该顺手改平衡）。
3. `playerBusy` → `return playerStatus(p,s).busy;`。
4. **检测器固化成 `audit-static` 第 ③ 项常驻门禁**：扫 `src/js/*.js`，命中「≥2 旗标 + 条件运算符」即失败。跳过 `state.js`（出口定义处）与复位赋值行（如 `s.players.forEach(p=>{p.natCamp=false;})`，那是误报）。只匹配 `p.`/`s.`/`me.`/`p1.` 前缀，刻意不匹配 `st.`/`pst.`——那正是合法出口。
   双向验证：门禁清零后注入 `const probe=p.kjia>0||p.loanOut;`，立刻报 `playerops.js:45(kjia+loanOut)`；还原即绿。

**这条门禁的价值大于那 10 处修复本身**：它把「加第 10 个旗标时记得检查 60 个地方」变成了「CI 直接告诉你哪里漏了」。

### P1-4　`ui-career.js` 在 UI 层实现游戏规则〔已修〕

```
src/js/ui-career.js:159-161   me.attrs[k]=clamp(me.attrs[k]+r.gain,40,99);
                              me.energy=clamp(me.energy-10,0,ENERGY_MAX);
                              S.trained=true;
```

加练 / 英雄特训 / 休息（`ui-career.js:180-181`、`190-193`）三条规则全部写在 UI 文件里，而选手决策引擎 `playerops.js` 只有媒体/社交/国家队。破「引擎↔UI 分离」约定，数值平衡调不动、测试也覆盖不到。

**已实施**：三条规则的**规则与结算**搬进 `playerops.js`，成为 `playerTrainDay(s,k)` / `playerHeroTrainDay(s)` / `playerRestDay(s)`，统一返回 `{ok,reason,...}`；`ui-career.js` 里三个同名函数缩成纯转发（`toast(reason)` + `save/renderAll`），**onclick 名字不变**，UI 无感。补了 ⑪⑫⑬ 三条引擎级断言进 `verify-playerops.js`——这三条规则以前在 UI 里根本测不到。写测试时还抓到一个真实交互：⑫ 休息留下的 3 天伤情会被 `trainBlockedReason` 拦截 ⑬，说明门槛确实在引擎侧生效。

### P1-5　KPL 两段式 BP 引擎零回归断言

`bp.js:111 kplDraftSteps()`（8 ban + 10 pick）与 `bp.js:119 expandSteps()` 是赛制正确性的核心，但全仓 `grep` 这两个名字在 `tests/` 下命中 **0 次**。唯一涉 BP 的 `verify-fixes.js` 只测巅峰对决 UI，`bpState/bpAuto` 只出现在 `tests/playthrough/`，而 playthrough 没进 `npm test`。

**影响**：18 手顺序、ban/pick 交替、位置落位、swap 阶段、`aiDraftStep` 选人逻辑全部无兜底。重构比赛链时改到 `draftAction/applyBp`，错了没人拦。

**建议**：新增 `verify-bp.js` 并挂进 `run.js`——断言 `expandSteps` 长度 = 18、ban 8 / pick 10、红蓝侧映射、peak 返回 5，并跑一次 `bpAutoAll` + `applyBp` 后校验英雄集合与 steps 一致。

### P1-6　三个现成测试从未纳入 `npm test`

`tests/fuzz.js`、`tests/late-game-probe.js`、`tests/verify-scenarios-audit.js` 都不在 `run.js` 的 `SUITES` 里。尤其 `verify-scenarios-audit.js` 是完整的五剧本审计（真开局 + 断言资金/士气/位置缺口），白白闲置。

**建议**：`verify-scenarios-audit` 直接加进 `SUITES`；`fuzz` 进 `test:fast` 或单开一个 CI job。

### P1-7　导入存档无清洗，玩家可控文本直插 `innerHTML`

工具函数是现成的（`data.js:72 _escTxt`），但 `ui-market.js` 用了 **0 次**，通篇 `${p.name}` / `${p.id}` 直插，包括内联属性 `onclick="openNegotiation(S,'${p.id}')"`（`ui-market.js:94`）。`ui.js:178` / `641` 也直插 `S.teamName`。

开局输入有 `maxlength=8` 兜着，问题不大；但 `applyImport`（`main.js:271-282`）接受任意 `.json` / base64 存档码——这是 README 宣传的分享功能——其中 `teamName` / `players[].name` / `id` 完全不受限。

**建议**：`applyImport` 里加白名单清洗（`d.teamName = d.teamName.replace(/[<>&"']/g,'')`，`players[].id/name` 同）；渲染层优先改 `ui.js:31`（`pcard`）和 `ui-market.js` 所有插值点。

### P1-8　每次渲染都同步读写 localStorage

```
src/js/ui.js:820    try{if(typeof markMissionSeen==='function')markMissionSeen('seenLeague');}catch(_){}
```

这句在 `renderLeague` 顶部**无条件**执行，落到 `guide.js:47` 就是一次 `JSON.parse + stringify + setItem`——每进一次联赛页写一次盘。`guide.js:71 pageHint()` 每次渲染 `JSON.parse`，`main.js:7 foldCls()` 每个折叠面板一次 `getItem`（转会页 6 次）。

**建议**：`guide.js` 加模块级 `let _seen={}` 内存缓存，命中即 return；`foldCls` / `pageHint` 结果缓存进 `Map`，只在 `setUiPref` / `dismissHint` 时失效。

---

## P2（可维护性 / 健壮性，不紧急但值得排队）

| # | 问题 | 证据 | 建议 |
|---|---|---|---|
| P2-1 | 迁移链静默失败：抛错后仍 `v++` 继续走 | `state.js:719-724` `catch(e){console.warn(…)} S.v++;` | catch 里 `return` 并提示用户导出存档；`S.v=Number(S.v)\|\|3` 防非数字导致整链跳过 |
| P2-2 | ~~`applySaveDefaults` 早于缩放迁移，兜底值被二次放大~~ **已评估：有意保持现状，不改** | `state.js:122` `if(!s.wageCap\|\|s.wageCap<50)s.wageCap=150;` 确实执行在缩放迁移之前；实测「缺失 cap」的档最终得到 250 而非 150 | **动手改过，被 `verify-migrate` ④ 拦下后撤回**：那条测试断言 `cap 180 ÷6 = 30` 且注释写明「之后会被 <50 规则抬回 150」——**作者当时就知道这个交互并锁成了预期**。两种顺序各有代价：留在迁移前 → 缺失 cap 得 250（现役区间 150~250 的顶格，偏宽松）；移到迁移后 → 合法迁移出的 30 被抬成 150（篡改迁移结果）。没有足够理由改动一个有测试锁定的经济行为，已在代码里写明理由与两种代价 |
| P2-3 | `SAVE_DEFAULTS` 只覆盖 53/76 字段，缺 `eventLog` 等 | `newState` 76 键 vs 默认表 53 键；`season.js:54 logEvent` 直接 `s.eventLog.unshift(…)` | `logEvent` 加 `(s.eventLog=s.eventLog\|\|[])`；其余引擎字段补登记 |
| P2-4 | ~~`s.matches` 可派生却写进存档（冗余 ~8%）~~ **已修** | `state.js:499 serializeForSave` 现同时剥离 `aiRosters` + `matches`；实测 121,049 → 111,065 字符 | 已完成。配套 `verify-save` ⑨ / `probe-matchstore` 断言派生表不落盘、读档由 `rebuildMatchStore` 重灌 |
| P2-5 | 派生索引查询优先于真相源 + 自愈失败被吞 | `state.js:652-654` `getMatch` 先于 bracket 检索；`state.js:729 try{rebuildMatchStore(S);}catch(e){}` | bracket 优先；rebuild 失败至少 `console.warn` 并清空 `s.matches` |
| P2-6 | 切槽不重置模块级全局 | `main.js:180 setSlot` 只 `load()`；漏 `guide.js:23 _tour`、`transfer.js:1029 _nego`、`state.js:118 _uiArm`、`main.js:469 _clubPick/_pcPos/_pcArch/_coachPick/_scenario` | 抽 `resetRuntimeGlobals()`，在 `setSlot` / `applyImport` / `restoreAutoBackup` 后调用 |
| P2-7 | 续赛判定只看 stage，未用 `mid` | `season.js:433` `if(s.series&&s.series.stage==='po')`（对照 `cups.js:554` 有 `&&s.series.cupSlot===slot`） | 补 `&&s.series.poSlot===slot` / `&&s.series.mid==='card_'+s.card.idx` |
| P2-8 | `cups.js` 内 `const loserOf=` 定义 **7 次** | `cups.js:75,97,186,275,445,476,503`，四处双败败者落位骨架逐字重复（`:79-80` vs `:449-450`） | 提为顶层 `const loserOf=m=>m.r===m.a?m.b:m.a;` + 统一 `seedNext(round)` |
| P2-9 | 超长函数「一人干五件事」 | `transfer.js:221-476 aiTransferWindow` **256 行**（内部注释分 7 段）；`match.js:14-191 genMatchStory` 178；`ui-market.js:1-185 renderMarket` 184；`match.js:483-598 finishSeries` 116；`season.js:588-716 newSeason` 129 | 优先拆 `aiTransferWindow` 为 `retireTick/releaseTick/fillGaps/starMove/raid`，让 `verify-aiplan` 能逐段断言 |
| P2-10 | ~~模块清单双份 + harness 加载模型失真~~ **已修** | `harness.js` 的 `FILES` 改为 `readModuleList()` 从 `src/index.html` 解析 `<script src>`（与 `build.ps1` 同一份真相源），解析 <10 个即抛错拒绝空跑 | 已完成。实测有效：用户 14:06 新增 `rules.js`，harness 自动纳入（24 个模块），零改动 |
| P2-11 | `run.js` 无超时保护 | `tests/run.js:82 spawnSync(...)` 未传 `timeout` | 加 `timeout:120000` 并断言 `r.signal`——比赛链重构常见的 while 不收敛会让 `npm test` 永久挂起 |
| P2-12 | 魔法数字散落，经济刻度无单点 | `match.js:523 const bonus=winGames*13;`、`:524 if(finalWin&&Math.random()<0.5)S.fund+=33;`、`ui.js:27 *0.3`、`ui.js:662 *0.08`、`ui.js:660 /500` | 抽 `ECON={PRIZE_PER_GAME:13,…}` 到 `data.js`，测试引用同一常量 |

**另外两处小的**：
- 重复计算：`ui.js:181` 与 `:196` 一次 `renderHeader` 里 `teamPower(S)` / `weeklyWage(S)` 各算 2 遍；`ui.js:867` 把它写在 `S.schedule.map()` 里，5 行赛程算 5 遍。顶部取一次即可。`allStarTeams(S)`（`season.js:558`）每次 `renderUnion` 全联盟重算（0.46 ms），可缓存。
- CSS 用宽度做动画：`style.css:260 .bp-stepbar i{transition:width .2s}` 与 `.pts-bar i` / `.progress i` 触发重排重绘，改 `transform:scaleX()` 更划算。

---

## 已核对，确认没问题（不用动）

这些我专门查了，作者做得对，列出来免得你重复怀疑：

- **L2 双写确实清干净了**：全项目无 `cardMatch=` / `poMatch=` / `cupMatch=` 赋值，只剩 `state.js:582` / `672` 作旧档只读兜底借队名；`tagMatch` 存的是同一对象引用，会话内不存在「改 A 忘 B」的写路径。真相源清晰：bracket 是真相，`s.matches` 是派生索引。
- **无事件/定时器泄漏**：全项目 `setInterval` **0 处**；11 处 `addEventListener` 全在模块顶层或一次性覆盖层元素上；切页只改 class，按钮走 inline `onclick`——不存在重复绑定。`toast` 用 `clearTimeout(t._h)` 复用。
- **文字直播没有高频重排**：`match.js` 是整场系列赛同步算完后一次性 `innerHTML` 输出（`match.js:616`），`bp.js:395 autoPlayNext` 是同步递归而非 `setTimeout`。全项目只有 `main.js:850` 一处 `getBoundingClientRect`，且在 mousemove 里有 `pointer:fine` 守卫。CSS 动画全走 `transform/opacity`。
- **`data.js` 顶层没有大循环**：108 KB 全是对象字面量，顶层唯一执行语句是 `data.js:259` 的索引构建和 `data.js:969` 的一次深拷贝。首屏成本来自「685 KB JS 内联在 body 且无 defer」，不是数据构造。
- **测试隔离良好、无静默通过**：`run.js` 每个 suite `spawnSync` 独立进程，`harness.makeDom` 每文件新建 vm 上下文；verify 统一 `fail → hadFail → throw`，异常冒泡使 exit ≠ 0。
- **死代码极少**：全仓只有 `career.js:388 signFreeAgent` 在 src 内定义未调用（仅 tests 用）。
- **各项列表都有封顶**：`honors` 20、`history` 20、`eventLog` 200、`titleHistory` 48、`awards` 10，所以 `renderHall` 实测只 5.8 KB / 125 元素，不是热点。
- **`audit-static.js` 本身很扎实**：onclick 存在性、重复函数定义、英雄/选手/教练 Schema、索引一致性、历代联盟往返 + 教练池泄漏、存档往返渲染都覆盖了。

---

## 建议动手顺序

**第一批 ✅ 已完成（2026-09-17）**
1. ~~P0-1 时代模板 ÷6 + 补刻度区间断言~~ —— 已做，含反向验证
2. ~~P0-2 存档瘦身~~ —— 已做「剥 `matches`」（121,049 → 111,065 字符）。原计划的「剥 `transferList`/`market`/`freeAgents` + `save()` 防抖」经实测证伪，已撤销（见 P0-2 修正说明）
3. ~~P0-3 季后赛异常留痕 + `_poError` 断言~~ —— 已做，含反向验证

**第二批 ✅ 已完成三项（2026-09-17 下午）**
4. ~~P1-3 统一 `playerStatus(p,s)`（含修 `playerBusy`）~~ —— 已做，**实际 10 处而非 60 处**，并把检测器固化成常驻门禁（见 P1-3 修正说明）
5. ~~P1-4 `ui-career.js` 三条规则迁进 `playerops.js`~~ —— 已做，补了 ⑪⑫⑬ 引擎级断言
6. ~~P2-10 模块清单去重~~ —— 已做，`rules.js` 落地时当场验证生效
7. P1-5 补 `verify-bp.js`、P1-6 把三个闲置测试挂进 `SUITES` —— 还没做
8. P2-2 把 `wageCap` 兜底移到缩放迁移之后（和 P0-1 同源，趁记忆新一起收）—— 还没做

**本批顺带交付的新功能：青训一键培养**
- 起因：`academyTrained` 是**全局单标志**，青训一多就只能跨天一个个点。
- `train.js` 新增 `trainAllRookies(s)`：一次点完，给**所有未达标青训各培养一次**（每人 17 万，按潜力从高到低优先，资金不足的跳过并提示）。抽出 `applyRookieTrain(r)` 让单独/一键共用同一成长公式，抽出 `ROOKIE_TRAIN_COST` 替掉两处硬编码的 17。
- 日志**聚合成一条**——逐人各写一条会把 `eventLog`（上限 200）刷满，批量操作尤其危险。
- UI 在青训营面板加按钮，文案直接显示「一键培养（N 人 · M 万）」，`academyTrained` 或全部达标时置灰。
- 新增 `tests/verify-academy.js`（8 条断言），含「训练页必须渲染出 `trainAllRookies`」的入口渲染断言——正是年总那次「面板渲染了、入口没渲染」的同类防线。

**第三批（2–3 天，动结构，留足回归时间）**
9. P1-1 转会页拆分局部渲染 + 列表截断
10. P1-2 读档年度恢复改异步
11. P2-9 拆 `aiTransferWindow`，为下一轮 L3 重构铺路

**需要你拍板的两件事**（都不该由我替你决定）
- `history` 里约 18.7% 是历史比赛直播文案，只留最近 5 场能再省约 14%，代价是牺牲「回看旧比赛」
- 转会窗期那 37%（`transferList`）要不要拿，取决于能否接受「读档重掷谈判意愿」

---

*本报告初版由只读审计生成；2026-09-17 动手实施第一、二批，并修正了初版三处被实测推翻的结论（P0-2 体积占比、`save()` 防抖、P1-3 的 60 处估算）。*

---

## 后续进展（2026-09-17 下午 · 第二轮「完善」）

**新增两道常驻门禁**（`audit-static`，均做过反向验证）：

- **④ 存档字段登记**：`newState()` 的字段必须都在 `SAVE_DEFAULTS` 里。改之前 78 个字段只登记了 57 个——差的 30 个含 `eventLog`，而 `logEvent` 直接 `s.eventLog.unshift(...)`（`season.js:54`），残缺/导入档缺它就会抛错。已补齐 26 个（`state.js`）。**避开的坑**：`v` / `moneyScaled` / `econReal` 三个**不能登记**——缺省本身就是「未迁移」语义，登记了会让整条迁移链跳过（`applySaveDefaults` 跑在缩放迁移之前）；`fund` / `wageCap` 另有经济逻辑处理，也不登记。
- **⑤ 引擎⇄UI 分离**：`ui*.js` 不得改数值/写名单/写日志。当前 **0 命中**，作为棘轮锁住约定（上一轮已把 `ui-career` 的三条规则下沉干净）。`main.js` 排除——它建初始状态属设计内。

**结论修正：不再建议「为压缩引依赖」**

上一轮把「加压缩步骤」列为最容易拿的收益，**实测后推翻了**：`game.html` 718 KB 经 GitHub Pages 的 brotli 只剩 **184 KB**（gzip 241 KB），网络从来不是瓶颈；用项目自己的 harness 实测完整加载 24 个模块仅 **7.6 ms**（桌面）≈ 手机 30 ms。上压缩属过度工程。

**但随后自己写的 `build.js` 是更好的解法**：不引任何依赖（手写「安全压缩」——只删注释/空行/尾空白，**不改标识符**，所以 `onclick="foo()"` 照旧可点），而且顺带把 PowerShell/Node 双实现的分叉消掉了，CI 与本地统一走 `npm run build`。产物 720 → 629 KB。**这比「不需要动」更有价值**——我漏算了双实现漂移这一项。

**一次尝试后被撤回的改动（P2-2）**：把 `wageCap` 兜底从 `applySaveDefaults` 移到缩放迁移之后，被 `verify-migrate` ④ 拦下——那条测试注释里就写着这个交互（`cap 180÷6=30，不得被抬回 150`），是作者有意的取舍。已完整撤回，并在代码注释里写明两种顺序各自的代价。

**新增门禁 ③b（本次由作者补写）**：引擎文件禁 DOM 且 UI 禁直接改四维。引擎禁 DOM 拦到 3 个文件，经评估均为合理例外并显式白名单化（`data.js` 提供 `$`/`$$` 给 UI、`hall.js` 分享图 canvas 不可避免、`match.js` 可选 AI 战报读输入框）——从「今天的红」变成了「以后新增文件不许碰 DOM」的棘轮。

---

## 第三轮（2026-09-17 傍晚）：剩余项清账

作者已先行提交（`a910928` / `194c588`），并自行完成了 **P1-1（转会页渲染 81.3 KB/1540 元素 → 28.6 KB/604 元素）** 与 **`transferList` 不落盘 + 读档重建**这两项。

### 已实施

| 项 | 内容 | 验证 |
|---|---|---|
| **P1-5** | 新增 `tests/verify-bp.js`（10 条断言）——BP 引擎此前 **vm 层零覆盖**（`kplDraftSteps`/`expandSteps` 在 `tests/` 命中 0 次）。覆盖：18 手两段式结构（BAN4/PICK6/BAN4/PICK4）· 蓝红镜像 · 巅峰对决盲选（3:3 触发、3:2 不误触发）· 无 UI 跑完整局 · 位置落位 · 英雄唯一性 · 全局 BP 分队记账 · `draftAction` 跳过对方连续手 · 英雄池耗尽兜底 · `bpConfirm` 收口 | 挂进 `run.js` SUITES |
| **P1-6** | `late-game-probe.js`（15 年长局压测，4.75 s，失败 `exit 1`）挂进 `SUITES`。另**纠正上一轮说法**：`fuzz.js` 在 `ci.yml` 里本来就跑，只有 `late-game-probe` 和 `verify-scenarios-audit` 是真孤儿，现已全部收编 | 套件 49 → 51 |
| **P1-7** | `applyImport` 加 `sanitizeImport()` 清洗。实测注入面：44 处 `${teamName}`、79 处 `${.name}` 仅 5 处转义，20+ 处 `${p.id}` 进内联 `onclick`。逐点转义 120+ 个渲染点不现实，**在唯一入口做白名单清洗**：① 去控制字符与尖括号；② id 类字段只留 `[A-Za-z0-9_-]`（防 `onclick="f('${p.id}')"` 引号逃逸）；③ 短展示字段截断、**长文本不截断**（履历/比赛文案/战报保原样） | `verify-save` 新增 ⑥b；反向验证过（停用清洗 → 精确报出注入串） |
| **P2-1** | 迁移链失败语义：原来是 `catch(e){…}` 后**照样 `S.v++`** → 该步永久跳过、半迁移档被写回伪装成完整档。改为失败即中止不推进 + 记 `S._migErr` + `break`（下次读档自动重试）。另修版本号非数字（`"3a"` 会让 `S.v<SAVE_VERSION` 恒 false、整条链静默跳过） | `verify-migrate` 新增 ⑧；反向验证过（去掉 `break` → 报「版本号被推进了（应停在 3，实际 4）」） |
| **P2-5** | `rebuildMatchStore` 失败不再被 `catch(e){}` 吞掉：改为 `console.warn` + 记 `_migErr` + **清空 `s.matches`**（`getMatch` 只读这个派生索引，留着半建的索引比空索引更危险） | 随 P2-1 的 `_migErr` 一并留痕 |
| **P1-8** | 渲染期 localStorage 内存缓存：`pageHint` / `missionState` / `foldCls` / `_sortPrefs`。实测一次 10 页遍历 **25 → 14 次访问（降 44%）**，且**写从 1 次降到 0 次**（`markMissionSeen` 每次进联赛页都写盘的毛病没了）。同时把 `activeMissions` 里「在 filter 内部逐任务 parse + 逐次写盘」改成只读一次、合并成一次写 | A/B 实测（渲染前清缓存 = 忠实复现改造前口径） |

### 评估后决定「不做」的两项（附理由）

- **P1-2 读档同步跑年度收官 —— 不改。** 初版报的是「读档时同步跑年度恢复，手机白屏 100–250 ms」。实测**推翻了前提**：`yearRollPending` 要求 `phase==='annual' && annual.po.final.r`，即**只在「年总已打完但未轮换」的卡死档**才成立。正常档 `migrateSave` **0.25 ms**（补完根本不执行），卡死档才 **3.40 ms**，不是 31.9 ms。而「读档自动恢复」正是作者在 `0f33168` 里**有意加的修复**——改成「读档后提示再执行」会把那个卡死 bug 带回来。
- **P2-9 拆 `aiTransferWindow` —— 建议不做。** 它是「为下一轮 L3 铺路」的纯结构改动，无用户可见收益，且与「别为不完美的形状而重构、为该加的功能而重构」的判断标准相矛盾。要做也应在真正要动转会 AI 时顺手做。
- **`uiPrefs` 缓存 —— 主动放弃。** 收益只有 1 次读（2→1），但 `verify-prefs.js:17/90` **直接** `localStorage.removeItem('km_prefs')` 绕过任何缓存，加缓存会让它读到陈旧值。收益 < 风险，不做。

### 新发现（顺手发现的，未改）

**仓库行尾是混的**：77 个源文件里 **9 个是 CRLF**（`board/career/clubops/cups/kjia/natcamp/season/state/ui-market.js`），其余 LF；`core.autocrlf=true` 且**没有 `.gitattributes`**。作者编辑器保存时会写成 CRLF。
- 影响：任何按行做精确替换的脚本在 CRLF 文件上会「匹配 0 次」静默失败（本次就被绊了一次）；`build.js` 已处理 `\r\n` 所以产物无碍。
- 建议：加一行 `.gitattributes`（`* text=auto eol=lf`）终结这种混态。**没有擅自改**——它会让大量文件在下次 `git add` 时显示为已修改，产生一次噪音很大的提交，时机该由作者定。


