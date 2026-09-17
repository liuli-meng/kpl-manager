# 架构目标（rewrite/arch）

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
| L1/L2 比赛扁平表 mid | 已在主线 |
| 目录分层 + actions 抽出 | 本分支 |
| 实体 byId | 待做 |
| step 状态机收束 season | 待做 |
| 去掉 series 缓存字段 | 待做 |

## 回滚

本目录为独立 git（`rewrite/arch`），与 `kpl-manager` 主仓隔离。合回前全量 `npm test`。
