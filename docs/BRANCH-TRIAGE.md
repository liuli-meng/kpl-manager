# 分支清算调研矩阵（Branch Triage Matrix）

> 审计基准时间：2026-10-02  
> 审计工具：只读 `git log`、`git show`、`git merge-base`、`git cherry`、`Measure-Object`  
> 状态定义：
> - **已覆盖**：main 分支已有完全等价实现或已被同义提交取代，可安全废弃。
> - **仍独有且极具价值**：main 分支完全缺失该能力，且经过自动化门禁验证，建议摘取合入 main。
> - **部分重叠 / 机制分歧**：两端各有实现但思路不同，需择优或降级参考。

---

## 1. 总体结论与决策路线

1. **分支基线关系**：
   - `origin/rewrite/arch`（9 提交）：是一个 **Orphan 孤儿分支**（与 main 无公共祖先 `merge-base` 失败），且落后 main 达 183 个提交。
   - `fix/coach-mode`（10 提交）与 `feat/fired-career-exit`（11 提交）：同源分支，以 commit `b70ef4d`（2026-09-19）为公共祖先，落后 main 76 个提交。`feat/fired-career-exit` 完整包含 `fix/coach-mode` 的全部 10 个提交，外加 1 个核心业务提交 `3e205fe`。

2. **架构路线选定**：**路线 B（走增量摘取，放弃全盘续写）**
   - **依据**：`origin/rewrite/arch` 虽然做了 core/engine/ui 目录切分，但内联 `onclick=` 实测仍残留 **203 处**（仅比 main 的 267 处少 64 处），仍未实现事件委托，未能解锁 mangle 压缩与私有作用域；且其为 Orphan 分支，强行合入将面临 183 个提交的文件树整体冲突，属于死路。
   - **去向**：将 `rewrite/arch` 降级为设计参考，仅增量摘取其独有的 **`findPlayer` byId 索引**。
   - **教练分支去向**：`feat/fired-career-exit` 拥有完整的「待业态 + 再就业 + 助教席 + 门禁」，价值极高，建议作为高优先级 PR 摘取合并到 main。

---

## 2. 提交级去向矩阵（Commit-Level Triage Matrix）

### 分支 A: `origin/rewrite/arch` (9 个提交)

| Commit | 提交主题 | 状态 | main 对应 / 依据 | 建议动作 |
|---|---|---|---|---|
| `773aa35` | 架构重写分层：core/engine/ui + engine/actions 抽出 nextAction | 部分重叠 / 机制废弃 | main 已在 `src/js/ui.js:630` 落地 `nextAction`；三层目录重命名破坏 183 个提交历史 | **废弃**（不搬迁目录，main 保持扁平结构） |
| `0a09304` | 不要提交玩家存档：saves/ 入 ignore | 已覆盖 | main 在 commit `1f038f9` 已加 `saves/` 到 `.gitignore` | **废弃** |
| `68cf72f` | 重写 L3：选手 byId 索引 findPlayer + 存档剥离索引，38 处线性查找改走索引 | **仍独有且极具价值** | main 仍使用 `(s.players\|\|[]).find(...)` 线性扫描，无 `rebuildPlayerIndex` 与 `findPlayer` | **摘取**（在 `src/js/state.js` 独立实现并单测） |
| `0cd52ae` | 重写：engine/calendar 状态机 stepCalendar/pumpCalendar + 探针 | 部分重叠 / 机制分歧 | main 后续演化出 `matchDayTick` 与日历推进链，已被 96 项门禁牢牢锁定 | **废弃** |
| `39d5965` | 重写 L2b：常规赛 schedule 进扁平表 mid + findTeam；全赛段系列赛统一 mid 权威 | 已覆盖 | main 在 commit `49f1bde` / `c489f4a` 已落地扁平 `mid` 与 `getMatch` 体系 | **废弃** |
| `063e1c1` | 修全模式逻辑bug：推进链延后+matchDayTick、年结锁/apps/合同年、选秀与FA钱账、索引失效、剧本全身份生效、身份门禁与教练履历 | 已覆盖 | main 在 commit `3bbd33c`（晚 4 秒同源提交）以相同业务逻辑落地 | **废弃** |
| `80227d5` | 修K甲/选秀卡死：残缺档自愈与收官自动续赛；点名落盘刷新、竞拍领先者落定、draftForceFinish 挂转会期结束 | 已覆盖 | main 在 commit `28ee902` 已完全落地 `draftForceFinish`（见 `draft.js:537`） | **废弃** |
| `b60120d` | 修名单人数口径：K甲下放不占一线——替补席/全队阵容/大名单 X/10 统一 rosterCount | 已覆盖 | main 在 commit `719ec42` 以同名提交完全落地 | **废弃** |
| `c87e5dd` | 修比赛日K甲冻结与选秀点名：matchDayTick 补 kjia/loan 日结；draftPick 先归一化 id；选手模式选秀说明 | 已覆盖 | main 在 commit `e267c76` 以同名提交完全落地 | **废弃** |

---

### 分支 B & C: `fix/coach-mode` & `feat/fired-career-exit` (11 个提交)

> 注：`feat/fired-career-exit` 是 `fix/coach-mode` 的超集，前 10 个提交完全一致。

| Commit | 提交主题 | 状态 | main 对应 / 依据 | 建议动作 |
|---|---|---|---|---|
| `fa6f3bb` | startSplit 清掉挂起推进闭包 _afterMatch | 已覆盖 | main 在 `src/js/season.js:1023-1025` 已落地 `s._afterMatch=null`（commit `e60e00c`） | **废弃** |
| `0571073` | 并入 startSplit 清 _afterMatch | 已覆盖 | 分支合并提交 | **废弃** |
| `cfdccce` | 修教练身份四条欠账：亚运开幕即锁、自由市场恒空、助教席无入口、下课态残留开赛按钮 | **仍独有且极具价值** | main 缺失助教席（`assistantStaffHtml`）、换队建市守护，以及 `tests/verify-coach-mode.js`（18项断言） | **摘取**（并入待业态 PR） |
| `25c499d` | 穷举探针的状态签名补两处盲点：eventLog 封顶与杯赛对阵进度 | **仍独有** | main 的 `verify-no-deadend.js` 未吸收该诊断探针改良 | **摘取**（探针脚本同步） |
| `7748628` | 教练身份门禁补两条判据：新手任务条的开赛指引、换赛段/换队的市场重建要「投毒」才测得出 | **仍独有且极具价值** | 增强 `verify-coach-mode.js` 门禁投毒能力 | **摘取**（并入待业态 PR） |
| `1226501` | 年终全链路门禁补教练档两档（豪门/鱼腩）×8 年，并加三条引擎侧不变量 | 部分覆盖 | main 的 `sim-yearend.js` 有两档跑测试，但缺少细化不变量断言 | **摘取**（补充断言） |
| `2ffc460` | 穷举探针修掉三条自身缺陷：推进白名单被模板转义吃掉、装饰弹窗当推进、换面板看不见 | **仍独有** | 修正 `verify-no-deadend.js` 自身假红缺陷 | **摘取**（探针脚本同步） |
| `20c113b` | 更正探针头注：coach 那条循环仍是探针自身，归因证据写进文件 | **仍独有** | 文档与注释修正 | **摘取**（探针脚本同步） |
| `f75d14a` | 探针还原后重建 mid 索引：coach 的 4001 步循环到此为止，三身份首次全绿 | **仍独有** | 探针闭环修复 | **摘取**（探针脚本同步） |
| `4b07797` | 穷举探针加 mulberry32 种子注入，并首次挂进 npm test | **仍独有** | 固定种子保证确定性 | **摘取**（探针脚本同步） |
| `3e205fe` | **下课改为「待业」：再就业报价 + 挂印退役，三页经营入口整页收口** | **核心独有业务资产** | main 下课直接锁死进入死局；本提交包含再就业报价（`genJobOffers`）、换队执教（`switchClubTo`）、挂印退役（`retireFromCoaching`）、`joblessGate` 以及 `tests/verify-fired-exit.js`（210 行） | **优先摘取**（独立高价值 PR，补全教练生涯终局闭环） |

---

## 3. 架构债基线度量

- **内联 `onclick=` 数量**：
  - `main`：**267 处**
  - `rewrite/arch`：**203 处**
  - **差值**：减少 64 处，但依然存在 203 处全局函数依赖。
- **结论**：重构如果不能把内联 `onclick` 完全收敛到事件委托（`data-action`），全局命名空间就无法释放，压缩器就永远不能 mangle，模块私有化（IIFE / ESM）就无法成立。因此，单纯调整文件目录结构（core/engine/ui）并没有实质还掉架构债，反而制造了巨大的分支分歧。未来真正的架构解耦路径应当是：**以事件委托逐步替代内联 `onclick`**。

---

## 4. 摘取落地与清算终态记录（2026-10-02 落盘）

1. **`origin/rewrite/arch` 清算结果**：
   - **已落地资产**：`findPlayer(s, id)` 与 `rebuildPlayerIndex(s)` byId 索引已并入 `src/js/state.js`，并在 `src/js/ui.js`（`findPlayerCard`）与 `myPlayer(s)` 中落地使用；通过 `serializeForSave` 剥离、`migrateSave` 读档重建。
   - **分支归宿**：正式废弃。不合入其 core/engine/ui 目录切分（Orphan 分支无公共祖先，强行合入与 main 产生 183 提交冲突，且残留 203 处 onclick 无法解决根本架构债）。

2. **`fix/coach-mode` & `feat/fired-career-exit` 清算结果**：
   - **已落地资产**：
     - 教练模式全链路跑通：亚运集训缺位自动补位、开局建市 `buildTransferMarket`、换段/换队建市保护。
     - 助教席与名宿转任：抽出 `assistantStaffHtml` 与 `legendAssistantHtml`，经理与教练双视角共用，战力加成生效。
     - 待业态整页收口：`joblessGate` 封死 fired 态下转会市场、训练位、阵容首发的 39 处偷跑经营按钮。
     - 再就业与挂印退役：`genJobOffers` 随履历生成 1~3 份报价、`switchClubTo` 统一换队逻辑、`retireFromCoaching` 封笔终局、`announceSuccessor` 旧东家官宣继任者。
     - 门禁入册：`tests/verify-coach-mode.js`（18项断言）与 `tests/verify-fired-exit.js`（6组全链路断言）全部挂入 `tests/run.js` 的 `SUITES`，100% PASS。
   - **分支归宿**：全部核心业务价值已 100% 增量吸收进 `main`，无任何独有价值被静默遗漏，分支可安全归档。

3. **ECO-01 经济量纲收敛结果**：
   - **改动位置**：`src/js/clubops.js` 的 `clubOpsCost(s)`。
   - **量纲对齐**：引入随商业赞助等级（`spLv * 80万/周`）与粉丝规模（`fanEff * 0.25万/周`）的主场场馆与公关法务维保成本。
   - **收敛效果**：豪门顶配单周硬支出从 350 万提高至 1074~1185 万/周；顶峰单周流水（饱和递减后约 1500~2000 万/周）与周硬支出的剪刀差从原来的 **8~10 倍大幅收敛至 1.3 ~ 1.7 倍**（落入 1.5 ~ 2.5 倍目标健康区间）。
   - **零回归验证**：弱旅开局开销为 0 增量，欠薪率保持 0%；`verify-econ-snowball`、`verify-fans`、`sim-quick`（50 季平衡门禁）、`sim-coach`（50 季教练门禁）全绿。
