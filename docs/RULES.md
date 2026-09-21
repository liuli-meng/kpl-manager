# 隐性规则总索引（kpl-manager）

本目录把**代码里埋着、界面不一定说清**的规则抽出来：读档/改系统/写测试时先查这里，再进对应源文件。

- **总文档**：本文件 `docs/RULES.md`
- **模块单篇**：`docs/rules/<模块>.md`，与 `src/js/<模块>.js` 一一对应（跨模块规则归到主责模块）

## 怎么用

1. 改玩法 / 加字段 / 写 verify → 先打开该模块单篇的「硬数值 / 守卫 / 易踩坑」
2. 不确定规则归属 → 用下表「关键词 → 文档」
3. 代码与文档冲突时：**以代码为准**，改完回来同步文档（本仓库 `audit-static` / 测试是真相源）

## 模块 ↔ 文档

| 源模块 | 规则文档 | 管什么 |
|---|---|---|
| state.js | [rules/state.md](rules/state.md) | 存档/迁移/年龄/状态旗/周薪派生 |
| data.js | [rules/data.md](rules/data.md) | 总值/身价/英雄/剧本/视觉哈希 |
| players.js | [rules/players.md](rules/players.md) | 生成选手/自由人/英雄池 |
| transfer.js | [rules/transfer.md](rules/transfer.md) | 签约/出售/挂牌/报价/租借/续约 |
| train.js | [rules/train.md](rules/train.md) | 训练/青训/晋升/状态驱动成长 |
| season.js | [rules/season.md](rules/season.md) | 赛制/日结/发薪/王朝/年度轮换 |
| rules.js | [rules/rules.md](rules/rules.md) | 转会窗分段/临时席/canSign/auditSave |
| career.js | [rules/career.md](rules/career.md) | 选手申请转会/租借/K甲/退役 |
| playerops.js | [rules/playerops.md](rules/playerops.md) | 媒体/社交/合同角色/国家队专注 |
| match.js | [rules/match.md](rules/match.md) | 比赛模拟/选手自动赛/文案 |
| bp.js | [rules/bp.md](rules/bp.md) | KPL 两段式 BP / 巅峰对决 |
| cups.js | [rules/cups.md](rules/cups.md) | 挑战者杯/EWC/亚运/年总 |
| draft.js | [rules/draft.md](rules/draft.md) | 选秀竞拍/点名/AI 新秀入册 |
| clubops.js | [rules/clubops.md](rules/clubops.md) | 粉丝商业/更衣室/战术/版本 |
| kjia.js | [rules/kjia.md](rules/kjia.md) | K甲二队/下放/召回/提拔 |
| board.js | [rules/board.md](rules/board.md) | 董事会信任度/KPI/解约 |
| natcamp.js | [rules/natcamp.md](rules/natcamp.md) | 亚运征召/集训/名单 |
| hall.js | [rules/hall.md](rules/hall.md) | 荣誉馆/王朝/FMVP |
| guide.js | [rules/guide.md](rules/guide.md) | 3步上手/任务条/每页提示 |
| main.js | [rules/main.md](rules/main.md) | 三身份开局/导航/导入清洗 |
| ui*.js | [rules/ui.md](rules/ui.md) | 只渲染+onclick；不得改数值 |

## 关键词 → 文档

| 现象 / 关键词 | 查 |
|---|---|
| 工资帽 / 奢侈税 / 顶薪 70 | transfer + season + data |
| 大名单 ≤10 / 双挂 / 幽灵 | rules + transfer + draft |
| 加练没涨 / 个人天花板 / 状态 | train + playerops |
| 选手坐板凳 / 租借 / K甲 | career + kjia |
| AI 不花钱补强 / def 表 | transfer + [rules/ai-model.md](rules/ai-model.md) |
| 读档缺字段 / NaN / 脏档 | state + rules（auditSave） |
| 王朝反制 / 连冠 | season + clubops |
| 亚运缺席夏赛 | natcamp |
| 董事会解约后点不了按钮 | board（UI 软终局） |
| BP 巅峰对决 / 全局 BP | bp |
| 临时席 / 挂牌期 | rules |
| 选秀满员点不了 | draft + rules |

## 横切约定（所有模块共用）

1. **三种身份 `s.mode`**：`manager` 全权 / `player` 选手生涯 / `coach` 竞技全权——经理专属系统在 player 下必须让路  
2. **引擎无 UI 依赖**：平衡门禁直接调 `nextDay`/`startMatch`；UI 层守卫（`uiGuard`）不阻断模拟  
3. **状态旗读走 `playerStatus()`**，禁止在业务文件里 `p.loanOut && p.kjia` 裸拼（`audit-static` 会拦）  
4. **签约/放行**优先 `canSign` / `canRelease`，不要在按钮里再写一套名单/窗口判断  
5. **读档后与赛季末**跑 `auditSave`；`migrateSave` 只负责字段/结构，不负责业务不变量  
6. **加新模块**：`src/index.html` 的 script 顺序 + 测试 harness 自动解析同一清单；规则写进对应 `docs/rules/*.md` 并在本索引登记  

## 维护

- 改了源码里的常量/守卫 → 同步改单篇里的数字  
- 新增隐性规则 → 写进**主责模块**单篇，并在本文件关键词表补一行  
- 开发工作流见 `.agents/skills/kpl-dev/SKILL.md`
- Git 推送流程见 [`docs/PUSH.md`](PUSH.md)（检查清单 / wincred 直连 / CI·Pages）
- 未推送变更的 commit 拆分见 [`docs/COMMIT-PLAN.md`](COMMIT-PLAN.md)（执行前需你确认）
