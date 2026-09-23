# 架构目标（rewrite/arch）

> **⚠ 本线已停止（2026-09-18）**：唯一被实测认可的收益「常规赛 schedule 进扁平表 mid（L2b）」
> 已于当日移植回主线 `kpl-manager`（含 P2-7 续赛身份校验与 `tests/verify-series-resume.js` 回归）。
> 其余项均已被实测否决：L3 选手 byId 索引（A/B 全落在噪声里，`s.players` 只有 8 人）、
> core/engine/ui 目录分层（约束力已由主线静态门禁 ③b 提供，搬家是纯 churn）。
> 本目录仅作历史参考保留，不要再当合并候选。

单文件发行不变（`build.js` 拼 `src/index.html` 的 script 顺序）。源码按三层切开：

```
src/js/
  core/     纯数据与存档：常量、状态、比赛表、RNG（无 DOM）
  engine/   玩法推进：赛程/杯赛/转会/训练/BP/比赛模拟（只改状态，不碰 DOM）
  ui/       渲染与入口：读状态、调 engine、写 innerHTML
```

## 硬约定

1. **对阵只存 `mid`**：`s.matches[mid]` 为真相；series 不持有活对象。
2. **`nextAction(s)` 是唯一「该点什么」**：UI 按钮从它派生；引擎可被测试直接调。
3. **engine 不 import DOM**：`toast`/`renderAll` 仅 ui 层；引擎用可选回调或调用方负责刷新。
4. **新字段进 `SAVE_DEFAULTS`**，读档 `rebuildMatchStore`。
5. **测试以 `src/index.html` 的 script 顺序为唯一清单**（harness 已如此）。

## 加载顺序（index.html）

`core/data → core/state → core/players → engine/*（依赖序）→ ui/* → main`

## 重构阶梯

| 层级 | 状态 |
|---|---|
| 目录分层 core/engine/ui | 已完成 |
| L1/L2/L2b 比赛扁平表 mid（含常规赛） | 已完成 |
| engine/actions nextAction + runEngineAction | 已完成 |
| engine/calendar stepCalendar/pumpCalendar | 已完成 |
| 选手 byId findPlayer + findTeam | 已完成 |
| 转会市场实体表 | 可选后续 |
| UI 彻底去全局 S（依赖注入） | 可选后续 |

**本分支结论**：整仓「架构重写」已到可合入形态——分层清晰、比赛链全部 mid、有状态机入口、关键与扩展回归全绿。更深的 UI 解耦/市场实体表可合回主仓后再做。

## 回滚

本目录为独立 git（`rewrite/arch`），与 `kpl-manager` 主仓隔离。合回前全量 `npm test`。
