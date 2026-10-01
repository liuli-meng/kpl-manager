# KPL 经理 · 第二阶段演进方案

> **归档对象**：第一阶段交付报告（2026-10-01）「二、遗留什么」四项。
> **核实日期**：2026-10-01　·　**核实基线**：工作区 `E:\sex` 当前状态
> **门禁基线**：`cd kpl-manager && node tests/run.js` → **89/89 通过 · 128.9s**
> **重要前提**：`kpl-manager/` 是**独立的嵌套 git 仓库**（自带 `.git`、`main` 分支、415 个跟踪文件、remote `github.com/liuli-meng/kpl-manager.git`）。父仓 `.gitignore:11` 只是让父仓不跟踪它，**不等于它没有版本控制**。真正的风险是 **`main` 领先 `origin/main` 17 个提交且尚未推送**（见 §5.1）。

---

## 0. 核实结论：四项建议中三项已有实现基础

写方案前逐项核对了代码。原报告把四项都描述为「待做」，实际盘点如下——**两项是"增强既有功能"，不是"新建功能"**，这会显著改变工作量与验收口径：

| 交付报告原表述 | 代码现状（已核实） | 真实缺口 | 优先级 |
|---|---|---|---|
| 选手卡紧凑列表模式 | 无相关实现 | 全量新建 | **P1** |
| 聚焦式聚光灯引导（Spotlight） | 引导**内容与进度**已完整存在（[guide.js](src/js/guide.js)），呈现是居中弹窗 | 仅缺遮罩层呈现 | P2 |
| 四维属性雷达图（Canvas 渲染） | **SVG 雷达已存在并使用**（[data.js:244](src/js/data.js:244)） | 未上卡片 | P3（小） |
| 长赛季数据回顾页 | **年度回顾页已存在**（[career.js:441](src/js/career.js:441) / [ui.js:152](src/js/ui.js:152)） | 折线是**名次**口径，非胜率 | P2 |

> **据此修正一项设计口径**：雷达图**不引入 Canvas**，复用既有 `radarSvg`。理由见 §3。

---

## 1. 选手卡紧凑列表模式（P1 · 主推）

> **状态：已完成并提交 `f7ded7c`「feat(ui): 实现选手卡紧凑列表模式并同步修复面板跨栏判定」。**
> 落地物：`state.js:263-267`（`compactMode()` / `toggleCompactMode()`，偏好键 `uiPref('compact')`）、`ui.js:34`（`opts.compact` / `opts.autoCompact` 分支）、`ui.js:85-121`（`pcardCompact()` / `compactViewToggle()`）、`style.css:858+`（`.pcompact-list` / `.pcard-compact`）、`ui-lineup.js:23-34`、`ui-market.js:251-253`。
> **§1.4 标为「必现 bug」的跨栏判定已同步修复**：`ui.js:276` 的选择器已补 `.pcompact-list,.pcard-compact`。
>
> ⚠️ **行号漂移警告**：本文档 §1 的行号是**提交前**采集的。`f7ded7c` 给 `ui.js` 增加 42 行、`style.css` 增加 105 行，因此：
> - `ui.js` 中位于插入点（约 34–121 行）**之后**的引用全部下移约 42 行（例：跨栏判定 235→276，`hideProfile` 78→79）；
> - `style.css` 真实总行数由 855 变为 **960**，`ui.js` 由 1786 变为 **1827**；
> - `src/js` 下 `.js` 文件数为 **43**（非早期误记的 33/37）；
> - `ui-lineup.js` / `ui-market.js` / `draft.js` 的行号漂移见 `git show f7ded7c --stat`。
> 引用本节行号时请以 `git show f7ded7c` 之后的版本为准。
>
> 以下保留原始方案文本，作为验收清单与设计依据；§1.4 的风险项可标记为已闭环。

### 1.1 现状

选手卡由单一渲染器产出，改造点唯一，这是本项最大的有利条件：

- **渲染器**：`pcard(p, extra, opts)` — [ui.js:31](src/js/ui.js:31)
- **`opts` 参数已存在**，目前仅用到 `opts.hideProfile`（[ui.js:78](src/js/ui.js:78)）。新增 `opts.compact` 是**向后兼容**的扩展，不动签名、不动现有 9 个调用点。
- **9 个调用点**（紧凑模式需要逐个确认是"跟随全局偏好"还是"恒定完整卡"）：

  | 调用点 | 场景 | 建议 |
  |---|---|---|
  | [ui-lineup.js:28](src/js/ui-lineup.js:28) | 首发阵容 | **紧凑候选**（主场景） |
  | [ui-lineup.js:36](src/js/ui-lineup.js:36) | 替补席 | **紧凑候选**（主场景） |
  | [ui-market.js:247](src/js/ui-market.js:247) | 买断市场 | **紧凑候选**（比价场景） |
  | [ui-market.js:253](src/js/ui-market.js:253) | 自由球员签约 | **紧凑候选** |
  | [ui-market.js:320](src/js/ui-market.js:320) | `.grid.g4` 全员网格 | 跟随全局 |
  | [ui.js:1212](src/js/ui.js:1212) | 训练页 | 保持完整（要操作属性） |
  | [ui.js:1426](src/js/ui.js:1426) | K甲下放 | 保持完整（要看出场日志） |
  | [ui.js:1442](src/js/ui.js:1442) | 二队名单 | 跟随全局 |
  | [draft.js:617](src/js/draft.js:617) | 选秀大会 | 保持完整（竞拍要点） |

### 1.2 方案

1. **紧凑卡形态**：单行横条——头像 + 姓名 + 位置角标 + 总值 + 战力 + 身价 + 状态旗标（伤停/K甲/租借/合同到期），右侧保留该场景的主操作按钮（`extra` 原样透传）。目标行高 ≤ 44px，一屏可见 ≥ 12 人。
2. **切换开关**：阵容页与转会页各放一个「紧凑 / 完整」切换按钮，与既有分区页签同排（`marketSecHost` 的 `.msec-tabs` 行内追加，[ui-market.js:22](src/js/ui-market.js:22)）。
3. **偏好持久化**：沿用本仓既有范式，**不进存档**（纯本机 UI 偏好，与 `km_mktab`/`km_sort` 同级）：
   - 键名 `km_cardmode`，参考 [ui-market.js:3-5](src/js/ui-market.js:3) 的 `_mktSecLoad/_mktSecSave` 写法（含 `try/catch` 兜底，存储不可用时退化为默认值）。
   - 对照范式：[ui.js:1729-1732](src/js/ui.js:1729) 的 `km_sort`，[main.js:47-72](src/js/main.js:47) 的 `pfold_*`。
4. **CSS**：新增 `.pcard.compact` 与 `.plist`（单行容器），放在 [style.css](src/css/style.css) 文件尾部、「动效」区块之前，保持既有分区注释结构。

### 1.3 验收标准

- 阵容页 10 人阵容在 1280×720 视口下**无需滚动**即可看全（当前需滚动）。
- 切换开关点击后**立即生效且刷新后保持**；清空 localStorage 回落完整卡不报错。
- 9 个调用点全部渲染正常，`g4` 网格在紧凑态下不错行、不溢出。
- `node tests/run.js` 全绿，重点回归 `verify-render-size.js`、`verify-prefs.js`、`verify-card-bo.js`。

### 1.4 风险（已定位，非泛泛提示）

> **必须同步处理跨栏判定**（当前位于 [ui.js:276](src/js/ui.js:276)，其上方 [ui.js:272](src/js/ui.js:272) 是同类注释；**提交 `f7ded7c` 之前它在 235/231 行**）。
> 判定式为 `p.querySelector('.tbl')||p.querySelector('.g3 .pcard,.g4 .pcard,.g5 .pcard')`，注释明确：*「含宽表格或卡片网格（g3/g4/g5 里的 pcard）的面板必须跨栏，否则表格被挤成半宽」*。
> 紧凑模式把 `.grid.g4` 换成 `.plist` 后，**该判定会失配**，面板退化为半宽造成布局回归。改造时必须同步更新这个选择器，否则是必现 bug。

---

## 2. 聚焦式聚光灯引导 Spotlight（P2）

### 2.1 现状：逻辑齐全，只缺呈现

原报告写「开局前 3 步通过遮罩层引导新玩家点击」——**"3 步"这套东西已经完整存在**，别重写：

| 已有件 | 位置 | 说明 |
|---|---|---|
| 引导状态机 | [guide.js:23](src/js/guide.js:23) | `_tour={on:false,i:0,mode:'quick'}`，`mode` 支持 `quick`/`full`/`new` |
| **3 步上手内容** | [guide.js:194](src/js/guide.js:194) | `quickSteps()`，由 `missionDefs(mode)` 生成，每步带 `{page,title,text,tryBtn}` |
| 呈现 | [guide.js:252](src/js/guide.js:252) | `renderTour()` → 写入 `#app-modal-body` + `#app-modal.classList.add('on')`，**居中弹窗** |
| 触发 | [guide.js:208](src/js/guide.js:208) | `maybeStartTour()`，已处理「赛前转会期先不弹，开赛后弹」（[guide.js:213](src/js/guide.js:213)） |
| 进度持久化 | guide.js:5 | `km_tour` / `km_tour2` / `km_hints` / `km_missions` |

**缺口是纯粹的呈现层**：当前是居中弹窗，玩家读完弹窗还要自己找按钮，没有"指向目标并高亮"的聚光效果。

### 2.2 方案

在 `renderTour()` 之外**并列**新增一条呈现分支，不动状态机与步骤内容：

1. 新增 `renderSpotlight(st)`：读取当前步的 `st.page` / `st.tryBtn`，解析出目标元素（优先 `#page-<name>` 的分区页签或页面首个 `.panel`），计算 `getBoundingClientRect()`。
2. 遮罩实现：单个 fixed 全屏 `div` + `box-shadow: 0 0 0 9999px rgba(0,0,0,.72)` 的"挖洞"层（**不切四块 div**，避免滚动/resize 时拼接缝隙），配 `border-radius` 与目标对齐。
3. 气泡定位：目标下方优先，空间不足翻上方；`window.innerWidth<560` 时退化为底部固定条。
4. **降级纪律**：`prefers-reduced-motion` 下取消挖洞层过渡动画（跟随现有 [style.css:850](src/css/style.css:850) 的降级块写法）；`matchMedia('(pointer:coarse)')` 命中时气泡改为底部条并加大热区。
5. **保留弹窗回退**：新增开关 `_tour.render='spotlight'|'modal'`，默认 `spotlight`，异常（目标元素找不到）时自动回落 `renderTour()`。**`closeModal('app-modal')` 的收尾路径**（[guide.js:297](src/js/guide.js:297)）必须在新分支同样走到，否则 `_tourEnd` 后遮罩残留。
6. 滚动/resize 监听：`resize` 与 `scroll` 时重算目标矩形（`passive: true`），结束时移除监听。

### 2.3 验收标准

- 全新档（清空 `km_tour`/`km_tour2`）进入，3 步引导全部以遮罩态呈现，每步「去试试」能正确切页并高亮目标。
- 「跳过」与「走完」两条路径结束后**遮罩无残留**、`_tour.on===false`、`localStorage` 标记正确写入。
- 老档（仅有 `km_tour`、无 `km_tour2`）仍走 `startWhatsNew()` 分支不受影响。
- `prefers-reduced-motion` 与窄屏（<560px）两种降级下均可用。
- 回归 `verify-guide.js`（**本项直接相关，必跑**）。

---

## 3. 四维雷达图进卡面（P3 · 小改动）

### 3.1 现状：雷达图已存在，且是 SVG

```js
function radarSvg(p,size){ // 四维雷达（对线/运营/团战/心态，刻度 0-99）
```
— [data.js:244](src/js/data.js:244)

已在两处使用：
- [ui-career.js:165](src/js/ui-career.js:165) — 生涯页选手自身
- [ui.js:205](src/js/ui.js:205) — 选手档案弹窗

### 3.2 修正原报告的技术选型：不用 Canvas

原报告写「用 **Canvas** 轻量渲染」，建议**改为复用 `radarSvg`**，理由（可验证，非偏好）：

1. **已有实现零成本**，Canvas 要重写一遍同样的多边形逻辑。
2. **主题跟随**：SVG 用 `var(--gold)` 等 CSS 变量随主题走；Canvas 需手工读取计算样式并在主题切换时重绘。
3. **DPR**：Canvas 必须处理 `devicePixelRatio` 缩放否则高分屏发虚，SVG 天然矢量。
4. **本仓 Canvas 先例**仅用于**导出图片**（[hall.js:104-111](src/js/hall.js:104) 战绩分享图），是"必须位图"的场景；卡面展示不属于此类。

### 3.3 方案

1. 卡面紧凑/完整两态都插入 `radarSvg(p, compact?28:44)`，置于 `.attr` 四维数字区块**旁边**（完整卡）或**替换之**（紧凑卡——紧凑态没空间放四个数字，迷你雷达信息密度更高）。
2. 完整卡建议：`.attr` 保留数字，雷达加在右侧，用 `display:flex` 两栏，不新增网络请求、不新增 DOM 层级深度。
3. 性能：卡片列表单页最多约 10–20 张，`radarSvg` 是纯字符串拼接，无需缓存；**但**若紧凑模式把训练页/选秀页也切了，需实测渲染耗时（参考 `verify-render-size.js` 与 `perf-monitor.js` 的口径）。

### 3.4 验收标准

- 卡片上雷达与 `.attr` 数字**一致**（同一 `p.attrs` 源，不得出现两套读数）。
- 残缺档兜底：`p.attrs` 缺失时，[ui.js:35](src/js/ui.js:35) 已有兜底补默认值，雷达需在该兜底**之后**取值，不得自己再判一次（避免两处阈值漂移）。
- 28px 尺寸下四个轴标签不可读 → 紧凑态**只画多边形与网格，不画标签**，这一点需在 `radarSvg` 增加 `opts` 或尺寸分支实现。

---

## 4. 年度回顾补胜率折线（P2）

### 4.1 现状：回顾页已存在，缺口很具体

原报告写「长赛季数据回顾页：赛季结算展示胜率折线与最佳阵容回顾」——**两个名词都已经实现了**：

| 能力 | 位置 | 现状 |
|---|---|---|
| 年度回顾快照 | [career.js:441](src/js/career.js:441) `buildYearReview(s)` | 在 `newSeason` 前定格，压入 `s.yearReviews` |
| 保存条数 | [career.js:457](src/js/career.js:457) | `slice(0,10)` — 保留最近 10 年 |
| 存档字段 | [state.js:31](src/js/state.js:31) | `['yearReviews',[],'年度回顾']` |
| 回顾页渲染 | [ui.js:152](src/js/ui.js:152) | 读 `S.yearReviews[idx]` |
| **折线图** | [ui.js:121](src/js/ui.js:121) `yearTrendSvg(stages)` | **画的是"名次"走势**，Y 轴经 [ui.js:108](src/js/ui.js:108) `yearPlaceRank()` 把"冠军/亚军/四强"映射成数值 |
| 最佳阵容 | [ui.js:1568](src/js/ui.js:1568) 实时评选 + [hall.js:81](src/js/hall.js:81) 历届入册 | 已有 |
| 触发时机 | [cups.js:661](src/js/cups.js:661) | 年度轮换前调用 |

**精确缺口**：折线是**名次**口径（1=冠军，越上越好），**不是胜率**。名次折线看不出"这一季赢了多少场"。所以本项范围应缩小为**给年度回顾补一条胜率口径的数据线**，而不是"新建回顾页"。

### 4.2 数据来源：`s.history[].win` 已可用

- 成绩曲线数据源 `yearStages` **只有 `{ev, place}`**，无胜负字段（写入点：[cups.js:147](src/js/cups.js:147)、[242](src/js/cups.js:242)、[359](src/js/cups.js:359)、[656](src/js/cups.js:656)、[season.js:1092](src/js/season.js:1092)；年度清零 [season.js:1001](src/js/season.js:1001)）。**要画胜率必须新增累计。**
- 但队史 `s.history` 条目**已带 `win` 与 `score`**——[career.js:447](src/js/career.js:447) 正在用：`.map(h=>({opp:h.opp,stage:h.stage,score:h.score,win:h.win,peak:h.peak}))`。
- **实现第一步**：核实 `history[].win` 在三种模式（manager/player/coach）与全部赛制年代下**是否都为布尔且已写入**（用 `tests/audit-static.js` 的思路做静态普查 + 抽一个多年档跑 `tests/sim-yearend.js` 验数据）。若存在缺失，退路是新增 `s.yearWins`/`s.yearLosses` 双计数器，在 `buildYearReview` 里随快照定格。

### 4.3 方案

1. `buildYearReview`（career.js:441）在快照里新增 `wins`/`losses`/`winRate` 三个字段，**旧档缺失时在渲染侧兜 `null` 并隐藏该线**（前向兼容，禁止让 10 年旧档因为读不到字段而炸回顾页）。
2. `yearTrendSvg`（ui.js:121）增加可选的**第二条折线**：名次线保持现状（左轴，1–16 翻转），胜率线用 0–100% 右轴。两条线共用 x 轴赛段。
3. **不要动 `yearPlaceRank`**（ui.js:108）——它是名次线的专用映射，已被多处依赖，改它等于全局改口径。
4. 图例：两线不同色 + 底部图例（`名次` / `胜率`），并在 `aria-label`（现 [ui.js:145](src/js/ui.js:145) 已有）里补文字描述，保证无障碍可读。
5. 回顾页在「最佳阵容回顾」上已具备（`hall.js:81` 历届一阵/二阵），本项**只需确保回顾弹窗内能直达该区块**（加一个跳转按钮即可），不重复建设。

### 4.4 验收标准

- 旧档（`yearReviews` 无 `wins` 字段）打开回顾页**不报错、不空白**，只少一条线。
- 新跑满 1 年 → 回顾页出现胜率线，且 `wins+losses` 与队史该年度场次**对得上**。
- 冠军赛季（胜率最高）与摆烂赛季（胜率最低）两条线的相对位置符合直觉，不出现 Y 轴串轴。
- 回归 `verify-review.js`（**直接相关，必跑**）、`verify-career-review-visibility.js`、`verify-year3-doc.js`。

---

## 5. 通用工程约束（四项都适用）

### 5.1 版本控制现状与真实风险（**本节已修正**）

> **修正说明**：本节初稿写的是「kpl-manager 不在任何 git commit 内、无回滚点，建议先纳入版本控制」。**该结论是错的**，源于在父仓库 `E:\sex` 执行 `git check-ignore` / `git ls-files` / `git worktree list` 后，把"父仓不跟踪"越界推广成了"没有版本控制"，未检查嵌套 `.git`。实测：

```
$ git -C kpl-manager rev-parse --show-toplevel   → E:/sex/kpl-manager
$ git -C kpl-manager branch --show-current       → main
$ git -C kpl-manager ls-files | wc -l            → 415
$ git -C kpl-manager remote -v                   → github.com/liuli-meng/kpl-manager.git
$ git -C kpl-manager rev-list --left-right --count origin/main...HEAD → 0  17
$ git -C kpl-manager worktree list
  E:/sex/kpl-manager  f7ded7c [main]
  E:/sex/.wt-coach    4b07797 [fix/coach-mode]
  E:/sex/.wt-fired    3e205fe [feat/fired-career-exit]
```

**结论**：改动**可 diff、可回滚**，`.wt-coach` / `.wt-fired` 也是**正式注册的 linked worktree**（不是残留副本）。

**真实风险不是"没有版本控制"，而是"17 个已提交但未推送的提交只存在于单块物理盘"**：`kpl-manager-rewrite` 是同一 remote 的独立 clone（不是备份），两个 worktree 共用同一对象库（同一块盘），`Win32_DiskDrive` 只枚举到 1 块物理盘。因此建议：

1. `git -C kpl-manager push origin main`（**属高危操作，需 owner 明确确认**）或至少 `git bundle create` 异地归档。
2. 顺带裁决 `feat/fired-career-exit`（`.wt-fired`，11 个不在 main 的提交）与 `fix/coach-mode` 两条长期未合并分支。
3. 本轮工作已提交为 `f7ded7c`（紧凑列表模式 + 面板跨栏判定修复）。

**对第一阶段交付报告的影响**：`60ee13f`「升级页面动效、KPI数字跳动、快捷键与确认流安全收敛」即该报告的改动，**已在仓库内**，同样属于那 17 个未推送提交。

### 5.2 新增持久化状态必须走注册表

若某项需要写进**存档**（如 §5.1 提到的 `yearWins`），必须在 [state.js:20-64](src/js/state.js:20) 的 `key, default, note` 字段表里注册，否则存档迁移链（`verify-migrate.js`）不认这个字段。**纯本机 UI 偏好（如 `km_cardmode`）不进存档**，走 `localStorage`，与本仓既有 `km_sort`/`km_mktab`/`pfold_*` 同级。

### 5.3 新动效必须有 reduced-motion 降级

第一阶段已在 [style.css:850-854](src/css/style.css:850) 建立降级块。本阶段新增的遮罩过渡、雷达入场、紧凑卡切换动画**必须追加到该块内**，否则是无障碍回归。

### 5.4 门禁流程（每项完成都要走一遍）

```bash
cd kpl-manager
node build.js          # src → game.html 单文件产物
node tests/run.js      # 89/89 基线，不得降级
```

`tests/` 下共 103 个 `.js`（其中 90 个 `verify-*.js`），与本阶段直接相关的重点回归集：

| 项 | 必跑测试 |
|---|---|
| §1 紧凑卡 | `verify-render-size.js`、`verify-prefs.js`、`verify-card-bo.js`、`verify-sort.js` |
| §2 Spotlight | `verify-guide.js` |
| §3 雷达图 | `verify-card-bo.js`、`verify-performance-baseline.js` |
| §4 胜率折线 | `verify-review.js`、`verify-career-review-visibility.js`、`verify-migrate.js` |
| 全部 | `verify-built.js`（构建产物校验）、`verify-entrypoints.js` |

> 注意 `build.js` 头部注释明确：压缩**不做 mangle/改写标识符**，因为 `onclick="foo()"` 依赖全局函数名。新增函数必须保持全局可见，不要包进 IIFE 或模块作用域。

### 5.5 体积预算

第一阶段 `game.html` 为 **949,160 字节（926.9 KiB）**。四项合计建议控制在 **+15 KiB** 以内（雷达图与折线均为内联 SVG 字符串，增量主要来自逻辑代码而非资源）。若超标，优先检查是否误引入了重复的内联样式。

---

## 6. 建议落地顺序

| 顺序 | 项 | 优先级 | 依赖 | 预估 |
|---|---|---|---|---|
| 0 | 推送 17 个未推送提交 / 异地归档（§5.1） | 前置 | 需 owner 确认 | 小 |
| 1 | 紧凑列表模式（§1） | P1 | — | **已完成并提交 `f7ded7c`** |
| 2 | 雷达图进卡面（§3） | P3 | 依赖 §1 的紧凑卡尺寸定型 | 小 |
| 3 | 年度回顾胜率线（§4） | P2 | 先核实 `history[].win` 完整性 | 中 |
| 4 | Spotlight 遮罩（§2） | P2 | — | 中 |

§3 排在 §1 之后是因为紧凑卡的行高/尺寸一旦返工，雷达尺寸要跟着改——**先定卡形态，再定卡内元素**。

---

## 7. 明确不在本阶段范围

以下内容原报告未提，经盘点确认**已具备**，不要重复建设：

- 赛季最佳阵容评选与历届入册 — 已有（[ui.js:1568](src/js/ui.js:1568)、[hall.js:81](src/js/hall.js:81)、[season.js:821](src/js/season.js:821)）
- 战绩分享图导出 — 已有（[hall.js:104](src/js/hall.js:104)，Canvas）
- 3 日前置任务条 / 每页提示 / 完整页码 tour — 已有（[guide.js:74](src/js/guide.js:74)、[guide.js:154](src/js/guide.js:154)、[guide.js:184](src/js/guide.js:184)）
- 年度成绩名次折线 — 已有（[ui.js:121](src/js/ui.js:121)）；本阶段只**增**胜率线，不重画
- 卡片排序偏好 — 已有（[ui.js:1729](src/js/ui.js:1729) `km_sort`）

---

## 8. 设计偏差记录

沿用第一阶段交付报告的「设计偏差」体例，记录本方案对原报告的**主动修正**：

1. **雷达图渲染技术：Canvas → SVG**。原报告指定 Canvas，改用既有 `radarSvg`（[data.js:244](src/js/data.js:244)）。理由：已有实现零成本、自动跟随 CSS 变量主题、无 DPR 发虚问题；本仓 Canvas 先例仅用于必须位图的图片导出场景。**这是技术选型修正，不是缩水。**
2. **「新建赛季回顾页」→「给已有回顾页补胜率口径」**。原报告将回顾页列为待建，实际 `buildYearReview` + 年度回顾弹窗 + 最佳阵容均已落地。范围收窄为避免重复建设。
3. **「新建 Spotlight 引导」→「为已有 3 步引导加遮罩呈现」**。原报告将 3 步引导列为待做，实际 [guide.js:194](src/js/guide.js:194) `quickSteps()` 的 3 步内容、进度持久化、触发时机均已完备。只补呈现层，且保留弹窗回退分支。
4. **四项均标注为「遗留」的表述本身需要修正**：三项（雷达图、回顾页、Spotlight）是**增强既有功能**，只有紧凑列表模式是全新建设。这直接影响排期与验收口径。
