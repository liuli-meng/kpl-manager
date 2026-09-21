---
name: kpl-dev
description: kpl-manager（王者电竞经理·KPL 篇，E:\sex\kpl-manager）的开发工作流与架构地图。凡是在这个仓库里加新玩法系统、改比赛/联盟/经济逻辑、修 bug、跑测试、构建 game.html、浏览器验收或推送 GitHub，都必须先读本技能——即使请求看起来只是"小改一下"。
---

# kpl-manager 开发工作流

纯前端单文件同人游戏：`src/`（JS 模块 + CSS + index.html）经 `node build.js` 拼接压缩成 `game.html` 分发；无后端、无网络请求、存档在 localStorage（3 槽）。**所有改动必须走完整闭环**：改 src → `npm test` 全绿 → `npm run build` 重建 → 浏览器实测 → 提交推送。

## 架构地图（改动该去哪个文件）

**隐性规则文档**：总索引 [`docs/RULES.md`](../../../docs/RULES.md) → 模块单篇 [`docs/rules/<模块>.md`](../../../docs/rules/)。加系统/改常量前先读对应单篇；改完数字要回写文档。

| 模块 | 职责 | 规则文档 |
|---|---|---|
| data.js | 常量与数据表（HEROES/AI_TEAMS/CLUB_TEMPLATES/SCENARIOS）、SVG 生成器、成就表、事件池 | docs/rules/data.md |
| state.js | `newState`/存档 3 槽/`migrateSave`/`playerStatus`/`weeklyWage`/AGE_MODEL | docs/rules/state.md |
| players.js | `genPlayer`（def→选手对象）、市场买入 | docs/rules/players.md |
| transfer.js | 转会谈判/挂牌/`completeSale`/赛中报价/AI 转会生态 | docs/rules/transfer.md |
| train.js | 训练/青训营/位置改造 | docs/rules/train.md |
| season.js | 赛程/年度赛历/日结/王朝/选手与教练生涯结算 | docs/rules/season.md |
| rules.js | 转会窗分段/临时席/**canSign/canRelease/auditSave** | docs/rules/rules.md |
| career.js | 选手申请转会/租借/K甲/退役/转教练 | docs/rules/career.md |
| playerops.js | 媒体/社交/合同角色/状态成长/国家队专注 | docs/rules/playerops.md |
| bp.js | KPL 两段式 BP 引擎与 BP 台 UI | docs/rules/bp.md |
| match.js | 比赛模拟/`finishSeries`/文案池/AI 战报 | docs/rules/match.md |
| cups.js | 挑战者杯/EWC/亚运/年总 | docs/rules/cups.md |
| draft.js | 选秀竞拍/点名 | docs/rules/draft.md |
| clubops.js | 粉丝商业/更衣室/战术/版本 | docs/rules/clubops.md |
| kjia.js | K甲二队 | docs/rules/kjia.md |
| board.js | 董事会信任度 | docs/rules/board.md |
| natcamp.js | 亚运征召 | docs/rules/natcamp.md |
| hall.js | 荣誉馆/王朝/FMVP | docs/rules/hall.md |
| guide.js | 3 步上手 + 完整 tour + 任务条 + 每页提示 | docs/rules/guide.md |
| main.js | 开局/导航 `MODE_PAGES`/音效/导入清洗 | docs/rules/main.md |
| ui*.js | 只渲染 + onclick 转发，**不得改数值** | docs/rules/ui.md |
| （横切）AI 双模型 | def 名册 vs 玩家经济 | docs/rules/ai-model.md |

三种身份 `s.mode`：manager（全权）/ player（选手生涯，导航精简、比赛走 `playerAutoSeries` 自动模拟）/ coach（竞技全权，俱乐部自动引援）。加新功能先想清楚它对三种模式分别意味着什么。

## 加新系统的固定清单（按序执行，跳步必返工）

1. **状态**：`newState` 加字段 + `migrateSave`/`SAVE_DEFAULTS` 旧档兜底——不改 SAVE_VERSION 除非结构破坏性变更；存储键名永不改
2. **规则文档**：在 `docs/rules/<主责模块>.md` 写清硬数值/守卫/易踩坑，并在 `docs/RULES.md` 总索引登记关键词
3. **引擎**：核心逻辑放对应模块；模式守卫；签约/放行走 `canSign`/`canRelease`，不要 UI 另写一套
4. **UI**：渲染函数 + `renderPage` 映射 + `index.html`（nav 与 section）+ `MODE_PAGES` 按模式收放；ui*.js 不得改数值
5. **测试**：新建 `tests/verify-<name>.js` 并挂进 tests/run.js（放在 smoke.js 之前）
6. **回归**：`npm test` 全绿（含 audit-static：状态旗走 playerStatus、ui/引擎分离、renderPage 清单）
7. **构建**：按仓库当前 `package.json` 的 build 脚本（以 SKILL 与 CI 为准）重建 `game.html`，产物与 src 一致
8. **浏览器实测**：见下方配方
9. **README**：按 `## 2026-09 <功能名>` 补一节；隐性规则写 docs/rules，不必在 README 重复常量表
10. **提交推送**：用户明确要求才 commit/push；完整清单与本机命令见 [`docs/PUSH.md`](../../../docs/PUSH.md)（wincred + 清代理；不主动 push）

## 测试规范（tests/）

- 基座 `tests/harness.js`：把 src 拼进 vm 沙箱（DOM/localStorage 全桩）。`fillRoster(S,band)` 组 5 人首发，需要替补自己 `genPlayer(genFreeAgentDef(...))` 追加
- **断言必须确定性**——三次踩坑教训：①不要用两套随机阵容互比（抽样噪声）②随机成长值撞固定门槛（如成长 4~8 撞门槛 5：改成多轮累计口径）③浮点比较先按展示精度舍入再比（`Math.abs(a-Math.round(b*10)/10)>0.001`）
- 沙箱 DOM 是空桩（innerHTML 赋值不产生子元素），UI 断言走 handler 函数 + 元素 stub 状态（如按钮 `disabled` 标志），不要 querySelector 找子节点
- `Math.random` 可在沙箱内整体替换实现确定性结局验证（参考 verify-offer 的抬价三结局）
- 平衡门禁（sim/sim-quick/fuzz）只驱动引擎到 champion，不触 UI；新系统若只作用于"玩家主动路径"或真实比赛结算，门禁数值不受影响——写清楚这一点，别让门禁误伤
- flaky 表现 = 同一命令多次运行结果不同：`for i in $(seq 1 N); do node tests/verify-x.js || echo $i; done` 跑 10-30 遍验收

## 环境红线（违反会出事故）

- **禁止 Bash heredoc**（`<<EOF`）：此环境终止符会失配，轻则命令尾部被灌进脚本、重则把文件截断成 0 字节（season.js 曾被清空，靠 git HEAD + game.html 双源恢复）。大段内容用 **Write 工具**写临时文件，再用 `python <临时脚本>` 处理；小改动一律用 Edit 工具
- 每次批量改完后 `node --check src/js/<每个改动文件>.js` 先过语法（模板串闭合反引号、三元运算符优先级是最常见的翻车点）
- 已知 flaky 修复优先改测试口径而非放宽游戏数值
- git 仓库在 kpl-manager 目录内（E:\sex 本身不是）

## 浏览器实测配方

1. `python -m http.server 8931 --bind 127.0.0.1`（在 kpl-manager 目录，后台运行）——浏览器技能不能开 `file:`，必须走 http
2. 加载 browser-use:control-browser 技能 → `agent.browsers.getForUrl("http://127.0.0.1:8931/game.html")` → 新标签 + `goto` + `waitForLoadState`
3. 截图验收用 `nodeRepl.emitImage(await tab.screenshot())`（可 clip 局部）；页面内操作优先 `evaluate(() => { 游戏全局函数 })` 直调引擎入口（等价于按钮 onclick），比 locator 点选稳
4. **跨 JS 调用页面可能被重置**：整个用户流程（点 A→点 B→读状态）放进**同一次 js 调用**的 evaluate 里跑完
5. 开局面板只在无存档/重开时出现；要回开局用 `localStorage.clear(); location.reload()`（会清测试 origin 的档，不影响用户本地 file:// 存档）
6. playwright locator 偶发 actionability 超时但元素实际可点：改用 `evaluate` 直调或 `cua.click` 坐标

## 已有系统速查（避免重复造轮子）

- 出售任何选手走 `completeSale`（单点含转会台账/def 补建/转售保护）；下放/伤停/集训选手有交易守卫
- 新增"按年度定格的回顾类数据"参考 `buildYearReview` + `yearStages` 埋点模式（在清数据的 newSeason 之前快照）
- 新增程序化视觉参考 `avatar`/`heroIcon`（确定性哈希：同实体永远同图，纯内联 SVG 零资源文件）
- 比赛文案池在 `genMatchStory`（模板池 + `storyPick` 系列赛内去重 + 语境槽位），加文案直接扩池，注意 `_usedTxt` 去重键
- AI 赛后战报（可选联网）在 match.js 末尾：默认关闭、key 存 localStorage 不进存档、失败静默回退——任何联网功能都必须遵守这个模式
