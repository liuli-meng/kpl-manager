# playerops.js — 选手日决策 + 状态成长

对应源文件：`src/js/playerops.js`  
总索引：[docs/RULES.md](../RULES.md)

## 硬数值

| 项 | 值 |
|---|---|
| 状态 form 阈值 | 火热 ≥80 / 平稳 55–79 / 低迷 &lt;55 |
| form 公式 | valScore×0.5 + 士气×0.25 + 体力×0.25 − 过黄金期×6/岁 − 伤停 15 |
| valScore | (val−90)×1.5+40，钳 \[0,100\]（约 val130→满格） |
| 天花板房间 | 未成年 12 / gold 前 8 / gold 内 5 / 下滑 2 / 退役 0；OVR≥90 房间≤3，≥85≤5；peak 硬顶 96 |
| 突破天花板 | 未过黄金 + form≥90 + 8% → peak+1（上限 98） |
| 社交行动 | 聚餐体力−5 / 陪练−8 / 直播−4；每日 1 次（`socialUsed`） |
| proj 培养 | 火热且房间≥2 时加练保底 +2 |

## 隐性规则

1. **加练不保证上涨**：`trainOutcome(role,p,k)` 看 form + 天花板 + 是否过黄金；低迷大概率 0。  
2. **合同角色** `career.role`：`star` / `rot` / `proj`——板凳士气与加练保底不同；开局按出身档默认（新秀培养/次级轮换/海归核心）。  
3. **社交与训练并行**：`S.socialUsed` 与 `S.trained` 独立；`nextDay` 两者都重置。  
4. **媒体采访**：赛后约 45% / 夺冠必开 / 日结偶发；写入 `career.media`，生涯页三选一后结算人气/士气/心态。  
5. **国家队专注** `career.natFocus`：`form` 额外状态但耗体力 / `rest` 回体力 / `bond` 心态+人气；`natCampTick` 调 `applyNatFocus`。  
6. **经理 `doTrain` 共用 `trainOutcome`**，不是选手专属 nerf。  

## 易踩坑

- 状态 UI 显示 `当前/天花板`；到顶后再练是「维持」不是 bug  
- 英雄特训 **不受** 四维天花板限制（战力另一条线）  
- 长局 sim 曾 ovr 刷到 99；改公式后约 85–87 封顶震荡  

## 相关测试

- `tests/verify-playerops.js`  
- `tests/sim-player.js`
