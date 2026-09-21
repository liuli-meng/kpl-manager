# KPL 经理 · 第二轮全量体检报告（2026-09-18）

对象：`kpl-manager/`（主仓）。上一轮报告见 `OPTIMIZE-AUDIT.md`（2026-09-17，三轮清账）。
本报告不重复上一轮已修的条目，只做三件事：**用真实存档重新量一遍**、**推翻上一轮被口径带偏的结论**、**判定三份副本该怎么处置**。

所有数字都可用 `node tests/dev/audit-perf.js` 复现（探针已入库）。测量口径的坑写在第六节，别重复踩。

---

## 一、结论速览

| | 结论 | 状态 |
|---|---|---|
| 1 | **转会页在真实存档下是 123.5 KB / 5,023 个标签**，不是上一轮记录的「已修至 28.6 KB / 604 元素」 | 已修，→ 55.7 KB / 2,169 标签（−55% / −57%） |
| 2 | **读档不是瓶颈**：热身后中位 **5.1 ms**。上一轮「手机白屏 100–250 ms」和它自己的反驳「0.25 ms」两个数都不成立——都没区分 V8 冷编译与热路径 | 无需动 |
| 3 | **选手名单索引化是伪优化**：`s.players` 实测 8 人，39 处 `players.find` 每次扫 ≤8 个元素；A/B 实测改动落在噪声里。`rewrite` 线的头号架构收益（L3 38 处改索引）应放弃 | 已否决，证据在第三节 |
| 4 | **`tests/dev/` 下 4 个诊断脚本自搬目录起就没跑过**（`require('./harness')` 少一级）。修好当天报出 2 个弹窗抛错 + 6 处脏文本 | 已修路径 + 已补兜底 + 已挂常驻门禁 |
| 5 | 三份副本里只有 `kpl-manager` 是活的；`refactor` 已被完全取代（0 个独有标识符）；`rewrite` 落后主线一批选秀 bugfix，整体不合回，只挑 2 项 | 建议见第二节 |
| 6 | 存档 145 K 字符、`.skill` 重复 5.4 K、`history.logs` 占 15% —— **都测过，都不建议动**（理由见第五节，含上一轮遗留的两个待拍板项） | 已量化，建议关闭议题 |

---

## 二、三份副本横向对比

| 副本 | git | 最近动作 | src 与主仓差异 | 测试 | 判定 |
|---|---|---|---|---|---|
| `kpl-manager` | 78 条提交 + GitHub remote | 2026-09-18 16:44 仍在改 | 基准 | **51/51 绿，47.0 s** | **主线，本轮全部改动落在这里** |
| `kpl-manager-rewrite` | 独立 `git init`（5 条提交，与主仓**无共同祖先**，无法 `git merge`） | 2026-09-17 22:13 停住 | 24 个模块里 **17 个逐字节相同**（忽略行尾），差异集中在 10 个文件 | 52/52 绿，42.1 s | 只挑 2 项收益回移植，其余废弃 |
| `kpl-manager-refactor` | 无 git | 2026-09-16 快照 | 缺 `draft.js`、`rules.js`；19 个共有文件**全部落后**；**独有标识符 0 个** | 未单独跑 | 已完全取代，建议删除或移到 `archive/` |

### rewrite 线值不值得合回

它的 `ARCHITECTURE.md` 自称「已到可合入形态」。用 diff 逐文件核下来，实情是：

**它缺主线的东西（合回就会把 bugfix 冲掉）**

| 主线提交 | 内容 | rewrite 现状 |
|---|---|---|
| `28ee902` / `8e9ec09` / `b9a07cb` / `0aeaf0b` | 选秀大会整场丢失、点名不落盘、竞拍 `draftBidRaise` 叫价 NaN、整卡可点 | `draft.js` 只有 **360 行 vs 主线 531 行**，差异 **315 行**——一整批修复都不在 |
| `8885a0a` | 跨队重名：`aiDetachDef` 摘青训营 + 入册前全局除名 + 收尾排重 | `transfer.js` 里这几段**逐行缺失**（diff 可见 `-` 号整块） |
| `c8bb3fb` | EWC 海外选手占位名「外援1…30」 | `cups.js` 仍是 `if(!name\|\|used.has(name))name='外援'+(i+1);` |
| 年龄基准 | `def.age0/ageFrom` 让第 10 季选中的 18 岁新秀不会一出场 27 岁 | `transfer.js` 仍是 `for(let i=0;i<s.season-1;i++)` |

**它比主线多的东西（真正值得看的只有 2 项）**

| 项 | 内容 | 判定 |
|---|---|---|
| ~~L3 选手 byId 索引~~ | `findPlayer`/`rebuildPlayerIndex` + 38 处线性查找改索引 | **不做**，见第三节实测 |
| ~~core/engine/ui 目录分层~~ | 24 个文件搬家 | **不做**：纯 churn，且上一轮已用静态门禁 ③b（引擎禁 DOM / UI 禁改数值）拿到同样的约束力，不需要靠目录表达 |
| 常规赛 `schedule` 进扁平表 `mid` | `series.mid` 全赛段统一 | **值得单独移植**：它和上一轮遗留的 P2-7（续赛判定只看 `stage` 未校验 `mid`）同源，是正确性而不是性能 |
| `engine/calendar.js` `stepCalendar` | 日历状态机 | 可选，低优先：只有 27 行，收益是形状 |
| `engine/actions.js` `nextAction` | 从 `ui.js` 抽出「下一步该点什么」 | 可选：主线已有同名实现，抽文件属搬家 |

**建议**：`rewrite` 目录保留作参考，不整体合回。若要拿 `mid` 归一化，就在主仓照主线现有代码单独做一次（顺带清 P2-7），别去解那 315 行 `draft.js` 冲突。

---

## 三、实测数据（真实存档 `saves/KPL存档_AG_2026年_槽1.json`，第 2 季转会期 · 名单 8 人 · transferList 89 人 · 选秀池 20 人）

### 3-1 读档

| 口径 | 数值 |
|---|---|
| `JSON.parse` 121 K 字符 | 2 ms |
| `installEra` | 0 ms |
| 完整 `load()`，**冷启动第一次** | 48 ms |
| 完整 `load()`，热身 6 次后中位（15 次采样） | **5.1 ms**（min 4.3 / max 7.3） |
| 对已迁移状态重复 `migrateSave()` | 2–3 ms |
| `serializeForSave()` / `save()` | 1 ms |

上一轮报告先说「读档同步跑年度收官，手机白屏 100–250 ms」，后又用「正常档 `migrateSave` 0.25 ms」把它推翻。两个数都对不上现实：48 ms 是 V8 冷编译，5 ms 是热路径。**结论：读档路径没有性能问题，「改成异步」这一项可以继续放着不动**（上一轮「不改」的决定对，但理由不对）。

### 3-2 切页渲染（10 页各渲染一次，真实存档）

| 页面 | 改前 KB / 标签 | 改后 KB / 标签 |
|---|---|---|
| market | **123.6 / 5,023** | **55.7 / 2,169** |
| train | 30.9 / 1,464 | 未动 |
| union | 25.8 / 1,066 | 未动 |
| kjia | 25.7 / 1,198 | 未动 |
| league | 21.7 / 777 | 未动 |
| biz | 21.1 / 804 | 未动 |
| lineup | 20.5 / 896 | 未动 |
| club | 9.5 / 247 | 未动 |
| hall | 5.8 / 245 | 未动 |
| 合计 | 285.1 KB | 216.7 KB |

转会页拆开看，两个大头都不是上一轮说的「81 KB 列表」：

| 面板 | 改前 | 改后 | 手段 |
|---|---|---|---|
| `mtransfer` 转会市场 | 43.8 KB（89 行 `.match` 全量） | 8.7 KB（15 行 + 显示其余 74 人） | `ui.js` 新增 `truncSlice/truncMoreHtml/listMore` |
| `mdraft` 选秀大会 | 40.7 KB（20 张完整 `pcard`，80 个 `.p-hero`） | 7.8 KB（21 行紧凑条目） | 非本队点名回合改紧凑行；轮到自己点名仍是完整可点卡片 |
| 其余 7 个面板 | 39.0 KB | 39.2 KB | 未动 |

渲染**耗时**从来不是问题（`renderMarket` 热身 1.7 ms）。问题是**节点数**：5,023 个标签在手机上一次 layout 才是白屏来源，而且它随 `transferList` 线性增长——转会窗开得越久越长。

> 口径说明：上表「标签」是产物里 `<` 的个数（含闭合标签），**约等于 2× 元素数**，不是 DOM 元素数。
> 真实浏览器（`file:///…/game.html`，新档第 1 天转会期 · transferList 90 人 · 选秀池 20 人）实测：
>
> | | 默认（截断+紧凑行） | 点「显示其余 75 人」后 | 改前（无截断，20 张完整新秀卡） |
> |---|---|---|---|
> | `#page-market` 元素节点 | **906** | 1,507 | ≈1,900（按 `<` 数 5,023 折算） |
> | `#page-market` 字符 | 45.0 KB | 80.5 KB | 123.6 KB |
> | 选秀面板 | 7.5 KB / 139 节点 | — | 40.7 KB |
> | 转会市场面板 | 8.8 KB / 147 节点 | 43.8 KB | 43.8 KB |
>
> 其余 8 页元素节点数（同一次浏览器会话）：club 97 · lineup 242 · train 264 · league 450 · kjia 547 · union 578 · hall 40 · biz 269。控制台零报错。

### 3-3 切页期的 localStorage

10 页一次遍历：**读 16 次 · 写 1 次**。唯一那次写是 `km_missions`（进联赛页时 `activeMissions` 合并成一次写），属上一轮 P1-8 的设计内行为，不是回归。
另有 4 次写发生在 `load()` 内部（主档 ×2 + 赛季自动备份 + 标签页锁），与渲染无关。

### 3-4 查找规模（顺手量的，结论是别动）

| 指标 | 数值 |
|---|---|
| `load()` 期间 `Array.prototype.find` | 2,598 次调用 / 109,079 次元素比较 |
| 最长的被扫描数组 | 139（是 `extraDefs`，**不是** `s.players`） |
| `defOf()` 调用次数（10 页遍历） | 2,026 |
| `s.players` 长度 | **8** |

`transfer.js:138` 的注释「动态池保持线性」是有道理的。A/B 实测（同一状态、热身 5 次后取 20 次中位）：

| 变体 | 读档中位 | 转会页渲染中位 |
|---|---|---|
| 现状 | 4.9 ms | 1.7 ms |
| `extraDefs` 建 Map 索引 | 4.6 ms | 1.4 ms |
| `players` 建 byId 索引 | 5.0 ms | 2.1 ms |
| 两者都建 | 4.8 ms | 1.4 ms |

**全部落在噪声里。** 139 长度的数组扫几千次也就是零点几毫秒，为它引入一个「push/filter 后索引变陈旧」的正确性风险（我自己第一版覆写就因为漏了这个，`transferList` 从 89 变成 0）不划算。

---

## 四、本轮已实施

| # | 改动 | 文件 | 验证 |
|---|---|---|---|
| 1 | 长列表按需展开原语 `truncSlice/truncMoreHtml/listMore/resetListMore`，默认 15 条；展开状态是会话级、**不写 localStorage**（上一轮刚清掉的渲染期写盘不再引回来） | `ui.js` | `verify-render-size` 断言展开后行数 ≥ `transferList` 长度（截断不许变成丢数据）+ 必须渲染「显示其余 N 人」入口 |
| 2 | 转会市场列表接上截断 | `ui-market.js` | 同上，实测 43.8 → 8.7 KB |
| 3 | 选秀面板分级渲染：非本队点名回合 → 紧凑行；本队点名 → 完整可点卡片（保住 `0aeaf0b` 的「整卡可点」与满员提示） | `draft.js` | `verify-render-size` 断言紧凑行提示文案在位；`verify-draft` 原有 315 行相关断言全绿 |
| 4 | `resetRuntimeGlobals()`（P2-6）：换档/导入/恢复备份时清 `_nego`、开局选择 7 个变量、`_uiArm` 时间戳、`_listMore`、`_tour`；**刻意不清** `_foldCache/_sortCache/_missionCache/_hintCache/_defIdx`（跨档共享的偏好与静态索引） | `main.js` 三处调用 | `verify-render-size` 断言复位生效 |
| 5 | `showYearReview` 缺字段兜底：`r.achieved`/`r.transfers` 未防护会**整个弹窗抛错**，`year`/`season`/`annualPts`/`fund`/`fans` 会渲染成 `undefined`/`NaN` | `ui.js` | `verify-render-size` 新增「兜底档」用例（构造只有 `stage` 字段的 yearReviews），改前 THROW、改后 clean |
| 6 | `showReplay` 逐条日志兜底 + `_escTxt` 转义（日志行实测不含内联标签，转义安全；顺手堵掉一个复盘注入面） | `ui.js` | 同上 |
| 7 | `hall.js` / `ui.js` 荣誉墙 3 处 `S${t.season}` / `'赛季'+h.season` / 按赛事分组键兜底 | `hall.js`、`ui.js` | 渲染脏文本断言 |
| 8 | `tests/run.js` 单项超时保护（默认 120 s，`--timeout=秒` 可调）+ `[TIMEOUT]` 归因（P2-11） | `tests/run.js` | 全套仍 51→52 项绿；挂死场景由 `r.error.code==='ETIMEDOUT'`/`SIGKILL` 识别 |
| 9 | 修好 `tests/dev/` 4 个脚本的 require 路径，并跑通 | `tests/dev/*.js` | 4/4 可执行（此前 4/4 `MODULE_NOT_FOUND`） |
| 10 | 新增常驻门禁 `tests/verify-render-size.js`：9 个页面的体积/节点数阈值 + 脏文本（`>undefined<` / `>NaN<` / `="undefined"`）+ 截断/展开/换档复位/缺字段兜底 | `tests/verify-render-size.js` | 挂进 `SUITES`，本地绿 |
| 11 | 新增体检探针 `tests/dev/audit-perf.js`（真实存档口径）；`.gitattributes` 终结行尾混态 | 见文件 | 见第六节口径说明 |
| 12 | P2-8：`cups.js` 里逐字相同的 `const loserOf=` 定义 **7 处 → 顶层 1 处**（7 个 `*PoStep` 函数各自的局部定义删除，行为不变） | `cups.js` | 全套杯赛门禁（`verify-cups`/`verify-annual`/`sim-yearend`/`late-game-probe`）全绿 |
| 13 | P2-3 的一部分：`logEvent` 加 `(s.eventLog=s.eventLog\|\|[])` 兜底，残缺/导入档缺该字段不再抛错 | `season.js` | `verify-logcat` + `verify-save` 全绿 |
| 14 | `KM_BUILD` 升到 `2026-09-18a`（本轮有玩家可见的 UI 行为变化，按项目惯例必须换版本戳） | `main.js` | 浏览器实测读回 `build:"2026-09-18a"` |

**收尾验证**：`npm run build` → `game.html 644 KB / 24 模块`；`npm test` → **52/52 通过 · 40.0 s**（原 51 项 + 本轮新增的渲染规模门禁）；真实浏览器开档走查转会页无控制台报错。
**反向验证**：① 把截断和紧凑行同时停用 → 渲染门禁立刻报「market 页渲染 80.1 KB，超阈值 72 KB」，还原后转绿；② `node tests/run.js --only=late-game-probe --timeout=1` → 1.0 s 被强杀、打印 `[TIMEOUT]`、runner `exit=1`。

---

## 五、评估后决定「不做」的四项（附实测理由）

- **选手名单 / def 池索引化**（含 rewrite 的 L3）。数据见第三节 3-4：A/B 全在噪声里，而 `s.players` 只有 8 人。**连带结论：`rewrite` 的头号收益不成立，这直接改变第二节的合并建议。**
- **存档瘦身：`extraDefs.skill` 字典化**。136 条只有 16 种，重复 5,380 字符；`career` 重复 2,266 字符。听起来能省 5%，但：存档 145 K 字符 × 4 槽 + 自动备份 ≈ 1 MB，离 localStorage 上限很远；GitHub Pages 走 brotli（上一轮实测 184 KB），传输也不是瓶颈。省这 7.6 K 要付「改存档格式 + 迁移链 + 旧档兼容」的代价，和上一轮 P0-2「剥 transferList 被实测证伪」是同一类过度工程。**不做。**
- **`history.logs`（21,715 字符 = 全档 15%）**。上一轮留的待拍板项「只留最近 5 场省 14%」，现在有了准确分母：**15% 的体积，代价是牺牲回看旧比赛**。既然体积不是瓶颈（上一条），**建议直接关闭这个议题**，别再挂着。
- **整仓 core/engine/ui 目录分层**。24 个文件搬家，而约束力已经由静态门禁 ③b 提供。真要分层，等 UI 依赖注入那次一起做，别单独做。

### 存档构成的准确画像（供以后引用，别再重新量）

读入 120,972 → 迁移后落盘 144,289 字符（+19.4%，主要是 `draft` 池 17.6 K 由迁移重建 + `eventLog` 涨 7 K，属一次性）。落盘后 top：`extraDefs` 18.5%、`history` 16.5%、`eventLog` 12.8%、`draft` 12.3%、`academy` 6.0%、`players` 5.5%。
**反复读档不会持续膨胀**：落盘→读档往返 4 轮是 `+157 / −117 / +303 / +167`，噪声来自重建时的随机数，不是单调增长。

---

## 六、测量口径的两个坑（下次量之前先读）

1. **冷编译**：vm 里第一次跑 `load()` 48 ms，第二次起 5–8 ms。任何「首屏/读档耗时」结论都必须先热身再取中位数，否则会把 JIT 当成算法成本——上一轮的两个相反结论都源自这里。
2. **导出存档是包装格式**：`saves/*.json` 顶层是 `{kplSave,v,exported,team,season,data}`，状态在 `.data` 里。直接 `JSON.parse` 整个文件当状态会拿到一个空壳，渲染出来只有 11.9 KB、`transferList` 0 人——**看着像优化生效，其实测的是废档**。本轮我在这上面翻过一次车，`audit-perf.js` 已内置拆包，临时脚本务必照抄。

另外一个观察：`tests/dev/` 的 4 个脚本从搬进子目录那天起就是坏的。**修不好的诊断脚本等于没有门禁**——这也是本轮把「渲染体积」从一次性手工测量升级成常驻门禁 `verify-render-size` 的原因。

---

## 七、剩余尾巴（下一轮可做，均非紧急）

> **2026-09-18 第三轮已清账**：下表除标注外全部关闭，实施细节与验证见 `README.md`
> 「2026-09 系列赛身份校验（P2-7）与本轮清账」一节。要点修正：**CSS 那条的前提是错的**——
> `.bp-stepbar i` 的 `transition:width` 从来不播放（BP 每手整块 innerHTML 重建，新元素无前态），
> 所以「改 transform 省 layout」是无中生有；真问题是那行死 CSS，现已连带动画做实。

| # | 项 | 现状 |
|---|---|---|
| ~~P2-3~~ | ~~`SAVE_DEFAULTS` 字段登记~~ | **已清**：根字段由 ④ 门禁锁住；实体级缺口（自由球员 `freeAgent`/`signCost`/`willingness`）由新增 `migrateFreeAgents` 兜底，挂点必须在两条货币迁移**之后**（否则补出的 `signCost` 会被再 ÷6）。`verify-save` ⑩/⑩b |
| ~~P2-7~~ | ~~续赛判定只看 `stage` 未校验 `mid`/`poSlot`~~ | **已清**：常规赛 schedule 进扁平表 mid（L2b，从 rewrite 移植）+ 常规/卡位/季后三处身份校验，僵尸系列赛废弃并留痕。新增 `tests/verify-series-resume.js` |
| ~~P2-8~~ | ~~`cups.js` 内 `const loserOf=` 定义 7 次~~ | **已清**（第四节 12 + 本轮）：`loserOf` 收敛为顶层 1 处；挑杯/年总各自 9 行的双败推进链进一步合并为 `cup8PoStep(s,p,cfg)` |
| ~~P2-12~~ | ~~经济魔法数字散落~~ | **已清**：`data.js` 新增「经济结算系数」区（`BONUS_PER_WIN_GAME`/`REG_WIN_EXTRA`/`PO_CHAMPION_BONUS`/`PRIZE_*_SHARE`/`ENDORSE_PER_POP`/`RENEW_MORALE_DIV`）。代言系数原先结算与 UI 各写一份 `0.3`，现共用常量 |
| ~~小~~ | ~~`renderHeader` 里 `teamPower(S)`/`weeklyWage(S)` 各算 2 遍；`ui.js` 在 `schedule.map()` 里重复算~~ | **已清**：`renderHeader` 各算一次复用；赛程面板把 `teamPower(S)` 提到 map 外（原来 5 行算 5 遍同一个值） |
| ~~小~~ | ~~CSS 用 `width` 做动画改 `transform:scaleX()`~~ | **已清（换了做法）**：`.bp-stepbar i` 改满宽 + `scaleX()`，并在渲染后「贴旧值→强制回流→写目标值」，补间这才真的会播放（原先是死 CSS）。`.progress i`/`.pts-bar i` 本就没有 transition，static width 无动画成本，**不动** |
| ~~新~~ | ~~`ui-market.js` 自由球员行 `signCost` 缺失渲染 `undefined万`~~ | **已清**：见 P2-3 行的 `migrateFreeAgents`（渲染层不再单独兜底，避免两套口径） |
| 新 | `verify-aiplan` 偶发红 | **已清**：断言是阈值型却没播种随机数，跑批里遇到过一次（单跑 42 次不复现）。现沙箱内替换 `Math.random`（mulberry32 固定种子），注入回归仍能报红 |

**副本处置**：**已执行**——`kpl-manager-refactor/` 删除；`kpl-manager-rewrite/ARCHITECTURE.md` 顶部标注「本线已停止」并写明 L3 索引化与目录分层两项已被实测否决、`mid` 归一化已移植回主线。

---

*本报告由只读测量 + 实施混合产出。第四节 11 项改动已落代码，验证方式见表格最后一列；第三节的每个数字可用 `node tests/dev/audit-perf.js` 复现。*
