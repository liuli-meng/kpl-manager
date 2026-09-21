# match.js — 比赛模拟

对应源文件：`src/js/match.js`  
总索引：[docs/RULES.md](../RULES.md)

## 隐性规则

1. **战力**：`playerPower` = 四维×战术权重 + 技能/英雄/伤停/体力修正；系列赛内体力逐局扣。  
2. **选手模式**：`startPlayerMatch` → `playerAutoSeries` **直接调 `finishSeries`**，无手动 BP 台（除非另一路径）。  
3. **`finishSeries`**：首发各 `apps+1`；小概率伤停；连胜/爆冷/翻船；按 stage 写积分/卡位/季后/杯赛；最后可能 `playerAfterMatch`（媒体）。  
4. **爆冷/翻船**：按纸面差触发，boost 按赛段累计，`startSplit` 清零。  
5. **文案**：`genMatchStory` 模板池 + 系列赛内去重（`_usedTxt` 随存档）。  
6. **AI 战报**：默认关，key 在 localStorage 不进存档，失败静默。  
7. **受伤**：约 8% 赛后随机一名首发伤停 2–4 天，自动 `autoFillLineup`。  

## 易踩坑

- 模拟函数 **无事务**：循环中途异常会留下已写入的场次结果  
- 简化模式 `optimizeLineup` 只在 UI 入口，门禁直调引擎不会自动优化  
- 战术克制 ±3% 量级，不要写成「必胜克制」  

## 相关测试

- `tests/verify-commentary.js`、`verify-upset.js`、`verify-tactics.js`  
- `smoke.js` BP/比分链路
