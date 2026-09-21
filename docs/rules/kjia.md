# kjia.js — K甲二队

对应源文件：`src/js/kjia.js`  
总索引：[docs/RULES.md](../RULES.md)

## 硬数值

| 常量 | 值 |
|---|---|
| KJIA_DAYS | 30 下放天数 |
| KJIA_MIN_RECALL | 7 提前召回最少已练天数 |
| KJIA_EVERY | 2 天一轮（8 队单循环约 7 轮） |

## 隐性规则

1. 二队独立赛程/积分；下放选手真实出战（KDA/MVP 累计）。  
2. **锻炼中禁止**出售/挂牌/放走/外租等（`canRelease`/训练守卫）。  
3. **归队结算成长**（场上即时 + 归队奖励）；提前召回需 ≥7 天。  
4. 二队夺冠：奖金/粉丝/关注度；可能挂钩选秀池「K甲前三」底子。  
5. 班底上调进一队同样受 `rosterGuard`/`canSign`。  
6. 每赛段重开一届；`initKjia` 懒初始化兼容旧档。  

## 相关测试

- `tests/verify-kjia.js`
