# guide.js — 引导 / 任务条

对应源文件：`src/js/guide.js`  
总索引：[docs/RULES.md](../RULES.md)

## 硬数值 / 键

| 项 | 值 |
|---|---|
| TOUR_KEY | `km_tour` |
| HINT_KEY | `km_hints` |
| MISSION_KEY | `km_missions` |
| SEASONQ_KEY | `km_seasonquest` |
| 首进引导 | quick **5 步**（欢迎 + 3 任务 + 收尾） |
| 完整 tour | 可见页 + 2（经理约 11 / 选手约 8） |
| 新手任务条 | 仅前 **3** 个游戏日 |

## 隐性规则

1. 首进默认 **3 步上手**（目标驱动）；完整页码 tour 从「管理 → 重玩新手引导」。  
2. 引导进度/提示 **不进存档**，localStorage 每浏览器一份。  
3. 任务完成条件读引擎字段（训练/社交/比赛次数、`matchIdx` 等），完成即写 done。  
4. `missionStrip` 挂 club/career 首行；day&gt;3 隐藏新手任务（赛季主线可另键显示）。  
5. 引导内部 `goPage` 由 `_tour.on` 防递归。  

## 相关测试

- `tests/verify-guide.js`
