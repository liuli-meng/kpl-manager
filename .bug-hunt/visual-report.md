# 视觉排查报告

> 生成时间：2026-09-19T14:25:00Z  
> 目标：kpl-manager 正式版 `game.html`（build `KM_BUILD=2026-09-19g`）  
> 视口：desktop **1280×800** + mobile **390×844**  
> 身份：`manager` / `player` / `coach` · 页面：`MODE_PAGES` 全量 + start modal 五标签（player/coach/self/club/era）  
> 方法：Playwright + 本机 Chrome → `http://127.0.0.1:8931/game.html`；`page.evaluate` 内检测溢出/裁切/命中；截图见 `.bug-hunt/visual/`  
> 脚本：`tests/playthrough/visual-bug-hunt.js` · 深挖：`tests/playthrough/visual-probe-deep.js` · 原始数据：`.bug-hunt/probe-deep.json`

---

## 摘要

| 指标 | 结果 |
|------|------|
| 扫描点（视口×身份×页/start tab） | **56** |
| document 横向溢出（scrollW > clientW+2） | **0 / 56** |
| P0 | **0** |
| P1 | **4**（合并同源后） |
| P2 | **5** |
| 运行时 console/pageerror | **0** |
| 截图 | 58 张（`.bug-hunt/visual/`） |

**总评**：两视口下 **没有任何页面出现 document 级横向溢出**；nav/header/modal 均未撑破视口；移动端 `.btn`/`nav button` 的 `min-height` 生效（42/38/52px）。真正影响「读得到 / 点得到」的问题集中在：**移动端 toast 单行 ellipsis、转会卡 `.tname` 信息挤爆、训练页默认排序 chip 被横滑容器藏到视口外、createTeam/applyClub 后导航未按身份裁剪**。

---

## P0 列表

（无）

两视口 × 三身份 × 全部 `MODE_PAGES` + start 五标签：
- `documentElement.scrollWidth <= clientWidth`
- `#nav` / `#header` / `#app-modal` 未超出视口
- 无按钮被永久遮挡（深挖 `elementFromPoint` 复核后，首轮 coach market「被 h3 遮挡」为滚动位置误报，按钮 `hit.same=true`）

---

## P1 列表

### P1-01 · toast 长文案在移动端被 ellipsis 截断

- **视口**: mobile 390×844（desktop 1280 不受影响）
- **页面/弹窗**: 全局 `#toast`（训练/联盟/俱乐部等任意触发 toast 的页）
- **现象**: 较长 toast 单行被裁。实测：文案「这是一条用于视觉排查的 toast 提示，字数故意写得比较长以观察是否截断或溢出视口」→ `scrollWidth=483` / `clientWidth=348`，可见部分止于「…故意写得比较长以观察是否截断或溢...」。游戏内真实 toast（开局规则说明、异常提示 `_reportErr`、赛程结算）同样会被吃掉后半句。
- **选择器/CSS线索**: `#toast` · `src/css/style.css` 约 244–247 行  
  `white-space:nowrap; max-width:90vw; overflow:hidden; text-overflow:ellipsis`
- **复现步骤**: 390×844 打开 game.html → 开任意档 → `toast('任意超过约 25 个汉字的说明文')` → 观察底部 toast
- **截图**: `.bug-hunt/visual/mobile-probe-toast.png`

### P1-02 · 转会/市场卡片 `.tname` 在移动端信息挤爆（职位/俱乐部/总值/年龄大量不可见）

- **视口**: mobile 390×844（desktop 同 DOM 未检出 ellipsis）
- **页面/弹窗**: `market`（manager 自建转会市场；coach 紧急租借列表同样命中）
- **现象**: 玩家名后的括号元数据被塞进同一 nowrap 行：  
  `一诺 (发育路 · 成都AG超玩会 · 总值92 · 18岁)` → 可见宽仅 ~130px，**dx≈79px**（约一半不可见）；`钟意 (打野 · 成都AG超玩会 · …)` dx≈71；coach 租借列表 `子阳 (武汉eStarPro · 游走 · 总值92)` dx≈54。  
  `.tname` **无 `title` 属性**，移动端又无 hover，截断后无法看到完整归属/总值/年龄——直接影响谈判决策可读性。
- **选择器/CSS线索**:  
  DOM：`div.match > div.vs > span.tname > span[style*=font-size:10px]`  
  构造：`src/js/ui-market.js` 约 106–107 / 147–148 / 221–222 行  
  CSS：`src/css/style.css` 约 186 行 `.match .vs .tname{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`  
  父级 `div.vs` 移动端有效宽约 124–212px
- **复现步骤**: 经理模式 `createTeam` → `goPage('market')` → 390×844 看转会市场列表首屏
- **截图**: `.bug-hunt/visual/mobile-probe-mgr-market.png` · `.bug-hunt/visual/mobile-manager-market.png` · `.bug-hunt/visual/mobile-coach-market.png`

### P1-03 · 训练页默认排序 chip「总值」被横滑容器藏出视口，当前筛选不可见

- **视口**: mobile 390×844
- **页面/弹窗**: `train`（manager + coach 均复现）
- **现象**: `.sort-row` 为 `overflow-x:auto` 横滑条，内容总宽 **612px**、可视宽 **344px**。默认选中 `.s-chip.on`「总值」实测 `left≈408 > vw=390`，**完全在视口右侧外**；「身价 / 年轻 / 士气」同样 offX。首屏只能看到「全部/对抗路/打野/中路/发育路/游…」，用户无法知道当前按总值排序，也未必发现还要横滑。
- **选择器/CSS线索**:  
  `div.sort-row > button.s-chip.on`（text=总值）  
  CSS：`src/css/style.css` 224 行 `.sort-row{display:flex;overflow-x:auto;scrollbar-width:none}` + 362 行移动端 `.s-chip{min-height:38px}`  
  父级：`parentScrollW=612` / `parentClientW=344` / `parentOverflow=auto`
- **复现步骤**: 任一身份 → `goPage('train')` @ 390×844 → 看「选手训练」下的筛选 chip 行
- **截图**: `.bug-hunt/visual/mobile-probe-train.png` · `.bug-hunt/visual/mobile-manager-train.png`

### P1-04 · `createTeam` / `applyClub` 后未调用 `applyModeNav`，经理档导航残留「生涯」等无关页签

- **视口**: desktop + mobile（均复现）
- **页面/弹窗**: 全局 `#nav`（开局后任意页）
- **现象**: 冷启动 `initStart()` 后 nav 全部按钮默认可见；`createTeam()` 与 `applyClub()` 只 `goPage('market')+save()`，**不调用 `applyModeNav()`**。结果 manager 模式导航仍显示 10 个页签，含 **「生涯」(career)**——该页不在 `MODE_PAGES.manager` 中。点击会走 `goPage` 身份门禁：toast「当前身份没有「生涯」页，已回到俱乐部」并跳回 club。功能上未死链，但 **错误页签可见可点，与身份不符**，首局体验像导航坏了。  
  对比：`applyCoachClub()` / `createPlayerCareer()` 正确调用了 `applyModeNav()`（`src/js/main.js` 670–697 / 700–745 行）。
- **选择器/CSS线索**:  
  `#nav button[data-page="career"]`（manager 下应 `display:none`）  
  `src/js/main.js` 29–34 行 `MODE_PAGES`；35–45 行 `applyModeNav`  
  `createTeam`：`src/js/main.js` 797–849 / `game.html` 11727–11780（无 applyModeNav）  
  `applyClub`：`game.html` 11783–11818（无 applyModeNav）  
  读档路径倒是正确：`game.html` 11964–11967 `if(load()&&S&&S.teamName){applyModeNav();…}`
- **复现步骤**: 清 localStorage → 390 或 1280 打开 → start modal「经理模式」→ 输入队名 → 创建战队 → 看导航是否仍有「生涯」→ 点「生涯」→ 出现身份门禁 toast
- **截图**: `.bug-hunt/visual/mobile-manager-club.png`（底部 nav 含「生涯」）· `.bug-hunt/visual/desktop-manager-club.png`

---

## P2 列表

### P2-01 · 联赛/二队 VS 卡队名在移动端 ellipsis

- **视口**: mobile 390×844
- **页面/弹窗**: `league` / `kjia`（三身份皆命中）
- **现象**: `div.tname` 单行截断，例如 `eStar 武汉eStarPro` dx≈14、`HERO 南京Hero久竞` dx≈17、`成都AG超玩会二队` dx≈33（coach）、`视觉扫雷二队` dx≈10。短前缀尚可辨认，二队全名/长俱乐部名读不全。
- **选择器/CSS线索**: `.match .vs .tname` / `.vs-tname` · `style.css` 186、438 行 `nowrap+ellipsis`
- **复现步骤**: mobile → `goPage('league')` 或 `kjia`
- **截图**: `.bug-hunt/visual/mobile-probe-league.png` · `.bug-hunt/visual/mobile-manager-league.png` · `.bug-hunt/visual/mobile-coach-kjia.png`

### P2-02 · 页内提示关闭钮 `button.ph-x` 高度仅 16.8px，移动端难点

- **视口**: mobile（desktop 鼠标可点，仍偏小）
- **页面/弹窗**: 凡有 `.page-hint` 的页（club/market/train/kjia/biz 等）
- **现象**: 引导条右侧「×」`h=16.8` / `w=13.6`，`min-height:auto`；移动端媒体查询给 `.btn/.btn.sm/nav button` 设了 38–52px min-height，**未覆盖 `.ph-x`**。触控目标远低于 28px 门槛。
- **选择器/CSS线索**: `button.ph-x` · `src/css/style.css` 221–222 行  
  `padding:0 2px; font-size:14px; line-height:1.2`  
  构造：`src/js/guide.js` 155 行 `dismissHint`
- **复现步骤**: mobile → 任意带页提示的页 → 点右上角 ×
- **截图**: `.bug-hunt/visual/mobile-manager-club.png`（推进日期提示行右侧 ×）

### P2-03 · start modal 主 CTA 需在弹窗内滚动才能到达（功能可用）

- **视口**: mobile 为主；desktop coach/club tab 亦然
- **页面/弹窗**: `#start-modal` tabs：`player` / `coach` / `self` / `club`
- **现象**: 弹窗本体 `overflow-y:auto` + `max-height:94dvh` 工作正常，**不溢出视口**。但内容高：  
  mobile coach `scrollH=1742` vs `clientH=791`（溢出 951px），CTA「开始执教生涯」文档坐标 y≈1725；  
  mobile player CTA y≈1091（溢出 328）；mobile self「创建战队」y≈1175（溢出 401）；  
  desktop coach 溢出 521px。用户必须先滚动才能点到主按钮。属信息架构/高度问题，非不可点。
- **选择器/CSS线索**: `#start-modal-body` · `#coach-apply-btn` / `button[onclick="createPlayerCareer()"]` / `button[onclick="createTeam()"]`  
  CSS：`style.css` 370、386–388 行 `.modal{max-height:92vh/94dvh}` `.modal-bg{align-items:flex-end}`（移动端贴底）
- **复现步骤**: 清档 → 切到「教练生涯」或「选手生涯」→ 不滚动直接找主按钮
- **截图**: `.bug-hunt/visual/mobile-probe-start-coach.png` · `.bug-hunt/visual/mobile-start-player.png` · `.bug-hunt/visual/mobile-start-self.png`

### P2-04 · 移动端 sticky `#header` 高约 218px，约占视口 26%

- **视口**: mobile 390×844
- **页面/弹窗**: 全局 header
- **现象**: `header{position:sticky; top:0}`，实测 `h=218`（logo+队名+存档/管理/音效 + 重开 + 六宫格 stat + …）。无横向溢出（`scrollW=clientW`），但垂直侵占大，正文首屏被压缩。属布局密度，非截断。
- **选择器/CSS线索**: `#header` · `style.css` 53、339 行移动端 header 规则
- **复现步骤**: mobile 任意已开局页面测量 `#header.getBoundingClientRect()`
- **截图**: `.bug-hunt/visual/mobile-manager-club.png` · `.bug-hunt/visual/mobile-player-career.png`

### P2-05 · 桌面 start modal 页签按钮高度 28px（无移动端 min-height）

- **视口**: desktop 1280×800
- **页面/弹窗**: start modal 顶部五标签
- **现象**: `#tab-player/#tab-coach/#tab-self/#tab-club/#tab-era` 高 **28px**。桌面鼠标可用；若触屏笔记本则偏矮。移动端同批按钮为 38px（媒体查询生效）。
- **选择器/CSS线索**: `#tab-*` · `.btn.sm` 桌面无 `min-height`；仅 `@media(max-width:640px)` 设 38px（`style.css` 361–363、381–382）
- **复现步骤**: desktop → start modal 量 tab 高度
- **截图**: `.bug-hunt/visual/desktop-00-start-modal.png` · `.bug-hunt/visual/desktop-start-player.png`

---

## 全页面 overflow 扫描表

判定：`overflowPx = documentElement.scrollWidth - clientWidth`；>2 记 ⚠️。本轮 **全部为 0**。  
「文字裁切」= 含 ellipsis/hidden/line-clamp 且 scroll 差 >2 的可见元素数；「按钮问题」含高度&lt;28、文字被裁、命中被挡、横向出界（**不含**仅因页面未滚动而落在视口下方的按钮）。

| 视口 | 身份 | 页面 | overflowPx | scrollW/clientW | 文字裁切 | 按钮问题* | 备注 |
|------|------|------|------------|-----------------|----------|-----------|------|
| desktop | boot | start-modal:player | 0 | — | 0 | 10 | 多为 tab/隐藏 CTA 误报；主 CTA 可见 |
| desktop | boot | start-modal:coach | 0 | — | 0 | 17 | 同上；CTA 在弹窗内需滚动 |
| desktop | boot | start-modal:self | 0 | — | 0 | 10 | 创建战队可见 |
| desktop | boot | start-modal:club | 0 | — | 0 | 17 | CTA 在弹窗内需滚动 |
| desktop | boot | start-modal:era | 0 | — | 0 | 10 | 正常 |
| desktop | manager | club | 0 | 1280/1280 | 0 | 11 | ph-x + 折叠下方按钮 |
| desktop | manager | lineup | 0 | 1280/1280 | 0 | 6 | 战术 chip 正常 |
| desktop | manager | market | 0 | 1280/1280 | 0 | 96* | 列表内大量卡片按钮在首屏下方（可滚动，非缺陷） |
| desktop | manager | train | 0 | 1280/1280 | 0 | 14 | 同上 |
| desktop | manager | league | 0 | 1280/1280 | 0 | 1 | 仅 ph-x |
| desktop | manager | kjia | 0 | 1280/1280 | 0 | 11 | 桌面 tname 未裁切 |
| desktop | manager | union | 0 | 1280/1280 | 0 | 12 | 表格 tr 有 onclick，桌面 nav 静态不挡 |
| desktop | manager | hall | 0 | 1280/1280 | 0 | 1 | 干净 |
| desktop | manager | biz | 0 | 1280/1280 | 0 | 1 | 干净 |
| desktop | player | career | 0 | 1280/1280 | 0 | 2 | ph-x + 下方 CTA |
| desktop | player | club | 0 | 1280/1280 | 0 | 1 | 干净 |
| desktop | player | league | 0 | 1280/1280 | 0 | 1 | 干净 |
| desktop | player | kjia | 0 | 1280/1280 | 0 | 11 | 见上 |
| desktop | player | union | 0 | 1280/1280 | 0 | 12 | 见上 |
| desktop | player | hall | 0 | 1280/1280 | 0 | 1 | 干净 |
| desktop | coach | club | 0 | 1280/1280 | 0 | 7 | 正常 |
| desktop | coach | lineup | 0 | 1280/1280 | 0 | 6 | 正常 |
| desktop | coach | market | 0 | 1280/1280 | 0 | 10 | 深挖复核：租借钮 hit.self，**不可点误报已排除** |
| desktop | coach | train | 0 | 1280/1280 | 0 | 14 | 正常 |
| desktop | coach | league | 0 | 1280/1280 | 0 | 1 | 干净 |
| desktop | coach | kjia | 0 | 1280/1280 | 0 | 11 | 正常 |
| desktop | coach | union | 0 | 1280/1280 | 0 | 12 | 正常 |
| desktop | coach | hall | 0 | 1280/1280 | 0 | 1 | 干净 |
| mobile | boot | start-modal:player | 0 | 390/390 | 0 | 14 | tab 38px OK；CTA 需滚 |
| mobile | boot | start-modal:coach | 0 | 390/390 | 0 | 25 | 同上 |
| mobile | boot | start-modal:self | 0 | 390/390 | 0 | 25 | 创建战队需滚 |
| mobile | boot | start-modal:club | 0 | 390/390 | 0 | 23 | 同上 |
| mobile | boot | start-modal:era | 0 | 390/390 | 0 | 10 | 正常 |
| mobile | manager | club | 0 | 390/390 | 0 | 13 | **nav 含「生涯」见 P1-04** |
| mobile | manager | lineup | 0 | 390/390 | 0 | 18 | 按钮 min-h 38 OK |
| mobile | manager | market | 0 | 390/390 | **22** | 96 | **tname 挤爆 P1-02** |
| mobile | manager | train | 0 | 390/390 | 0 | 36 | **sort-chip 视口外 P1-03** |
| mobile | manager | league | 0 | 390/390 | **2** | 1 | **队名 ellipsis P2-01** |
| mobile | manager | kjia | 0 | 390/390 | **1** | 11 | 二队名 ellipsis |
| mobile | manager | union | 0 | 390/390 | 0 | 12 | 表格行可滚；footer/body 有 bottom padding |
| mobile | manager | hall | 0 | 390/390 | 0 | 1 | 干净 |
| mobile | manager | biz | 0 | 390/390 | 0 | 4 | 设置按钮完整 |
| mobile | player | career | 0 | 390/390 | 0 | 14 | 加练按钮 38px OK |
| mobile | player | club | 0 | 390/390 | 0 | 6 | 正常 |
| mobile | player | league | 0 | 390/390 | **2** | 1 | 队名 ellipsis |
| mobile | player | kjia | 0 | 390/390 | **1** | 11 | 二队名 ellipsis |
| mobile | player | union | 0 | 390/390 | 0 | 12 | 见上 |
| mobile | player | hall | 0 | 390/390 | 0 | 1 | 干净 |
| mobile | coach | club | 0 | 390/390 | 0 | 9 | 主 CTA 完整 344×42 |
| mobile | coach | lineup | 0 | 390/390 | 0 | 15 | 正常 |
| mobile | coach | market | 0 | 390/390 | **8** | 14 | **租借列表 tname 挤爆 P1-02** |
| mobile | coach | train | 0 | 390/390 | 0 | 35 | **sort-chip 视口外 P1-03** |
| mobile | coach | league | 0 | 390/390 | **2** | 1 | 队名 ellipsis |
| mobile | coach | kjia | 0 | 390/390 | **1** | 11 | 二队名 ellipsis |
| mobile | coach | union | 0 | 390/390 | 0 | 12 | 见上 |
| mobile | coach | hall | 0 | 390/390 | 0 | 1 | 干净 |

\* 扫描器会把首屏下方、页面可滚动到达的按钮记入 raw「按钮问题」；人工复核后仅 P1/P2 列表中的项为真实缺陷。

### 补充测量（深挖 probe）

| 项目 | desktop | mobile | 结论 |
|------|---------|--------|------|
| `#header` overflowX | 0（h=76） | 0（h=218） | 无横向溢出；mobile 纵向过高 P2-04 |
| `#nav` position | static 顶栏 h=45 | fixed 底栏 h=57 top=787 | 符合设计；btn h=35/52 |
| body padding-bottom | 20px | 76px | 配合 fixed nav；footer 另 +80px |
| toast overflow | 不裁切（w=530） | **裁切** scrollW483>clientW348 | P1-01 |
| train `.sort-row` | scrollW=clientW=992，chip 全在视口内 | **scrollW612 > clientW344**，选中 chip offX | P1-03 |
| coach market 租借钮 hit | `same=true` | `same=true` | 不可点为误报 |
| modal 横向 | 未溢出视口 | 未溢出视口 | max-height + overflow auto 正常 |

---

## Top 10 Bug（按优先级与影响面）

1. **[P1]** `#toast` @ mobile · 长提示单行 ellipsis，后半句不可读 · `style.css` `.toast{white-space:nowrap;text-overflow:ellipsis;max-width:90vw}` · `mobile-probe-toast.png`
2. **[P1]** `market` span.tname @ mobile · 选手「名(位置·俱乐部·总值·年龄)」挤爆，dx 最高 ~79px 且无 title · `ui-market.js` + `.match .vs .tname` · `mobile-probe-mgr-market.png`
3. **[P1]** `train` div.sort-row @ mobile · 默认选中「总值」chip 在横滑容器外，当前排序不可见 · `.sort-row{overflow-x:auto}` · `mobile-probe-train.png`
4. **[P1]** `#nav` @ 双视口 · `createTeam`/`applyClub` 未调用 `applyModeNav`，manager 仍显示「生涯」页签，点击被门禁弹回 · `main.js` MODE_PAGES vs createTeam · `mobile-manager-club.png`
5. **[P2]** `league`/`kjia` div.tname @ mobile · 队名/二队名 ellipsis · `.tname` nowrap+ellipsis · `mobile-probe-league.png`
6. **[P2]** `button.ph-x` @ mobile · 关闭钮 16.8px，无 min-height · `style.css` `.ph-x` · 多页 page-hint
7. **[P2]** `#start-modal` @ mobile/desktop coach·club·player·self · 主 CTA 在弹窗滚动区下方，需滚动才能点到 · `#start-modal-body` max-height
8. **[P2]** `#header` @ mobile · sticky 高 218px，占视口约 1/4 · `#header` sticky
9. **[P2]** start modal tabs @ desktop · 五标签高 28px，桌面无 min-height · `#tab-*` / `.btn.sm`
10. **[信息]** coach/market 首轮扫描「被 h3 遮挡」→ 深挖为滚动误报，按钮实际可点（保留以免回归时误判）

---

## 无问题的项简要说明

- **document 横向溢出**：56 个扫描点全部 `overflowPx=0`。桌面与手机均无 `scrollWidth > clientWidth+2`。
- **`#nav` / `#header` / `#app-modal` / `#start-modal` 外壳**：未超出视口；modal 均在 `max-height` 内纵向滚动。
- **导航触控高度（移动端）**：`nav button` 实测 h=52（CSS min-height 52px），两身份所有可见页签可点且在视口内横排放得下（manager 9 页 / player 6 页 / coach 8 页）。
- **主 CTA 按钮**：mobile `.btn` min-height 42px、`.btn.sm` 38px 生效；coach club「赛前准备 · 调整阵容 / BP 开赛（BO5 全局BP）」344×42 完整可读可点；「创建战队 / 开启选手生涯 / 开始执教生涯」在弹窗内尺寸正常。
- **桌面文字裁切**：league/market/header 等在 1280 下未检出 ellipsis 裁切（`div.tname` items 为空）。
- **桌面 toast**：长文完整显示（w=530，无 clipped）。
- **运行时**：三身份 × 两视口 goPage 全流程 **0 条 console.error / pageerror**。
- **读档路径导航**：`if(load()&&S&&S.teamName)` 后正确 `applyModeNav()`，身份页签与 `MODE_PAGES` 一致（问题仅在新建 createTeam/applyClub 路径）。
- **`.tbl` 横滑**：移动端表格 `overflow-x:auto` 为有意设计，未计入 document 溢出，也未把可滚容器误判为文字截断。
- **选手/教练开局**：`createPlayerCareer` / `applyCoachClub` 均调用 `applyModeNav()`，其 nav 与 `MODE_PAGES.player|coach` 一致。

---

## 方法与产物

| 路径 | 说明 |
|------|------|
| `tests/playthrough/visual-bug-hunt.js` | 全量扫描（双视口×三身份×MODE_PAGES+start 五 tab） |
| `tests/playthrough/visual-probe-deep.js` | 深挖：toast/header/nav 遮挡/sort-row/start CTA/tname |
| `.bug-hunt/visual-report.md` | 本报告 |
| `.bug-hunt/probe-deep.json` | 深挖原始 JSON |
| `.bug-hunt/visual/*.png` | 58 张截图（desktop/mobile × 页面/probe） |

**未改动** `src/**`、`game.html`、`package.json`；未 commit；未创建 git worktree。

**修复建议（仅建议，未实施）**  
1. `.toast`：移动端允许 `white-space:normal` 或最多 2 行 + `overflow-wrap`；或缩短默认文案。  
2. 市场/租借卡：移动端把元数据放到 `.tname` 第二行，或给 `span.tname` 补 `title="完整信息"`。  
3. `.sort-row`：默认 `scrollLeft` 滚到 `.s-chip.on`；或选中 chip 固定在行首。  
4. `createTeam`/`applyClub` 成功路径补一行 `applyModeNav()`（与 coach/player 开局对齐）。
