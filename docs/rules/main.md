# main.js — 开局 / 身份 / 导航

对应源文件：`src/js/main.js`  
总索引：[docs/RULES.md](../RULES.md)

## 硬数值

| 项 | 值 |
|---|---|
| MODE_PAGES.manager | club/lineup/market/train/league/kjia/union/hall/biz（+career 等以源码为准） |
| MODE_PAGES.player | career/club/league/kjia/union/hall 类精简集 |
| MODE_PAGES.coach | 竞技向，市场有限、无经营全权 |
| 选手出身 | youth 17 / semi 19 / returnee 21（属性与人气档不同） |

## 隐性规则

1. **三种开局**：自建队 / 执教原版俱乐部 / 选手或教练生涯；「历代联盟」走 `installEra` 替换联盟。  
2. **`createPlayerCareer`**：写 `career`（含默认 `role`/`stats`/`media`/`natFocus`），`mode=player`，无转会期，`initKjia`+`initFans`。  
3. **`applyClub`**：继承模板预算/工资帽/阵容；赛前转会期 7 天量级。  
4. **导入清洗**：短键集合、id 字符白名单、剥控制字符与 `<>`——防脏 JSON 注入。  
5. **导航**：`goPage` 对当前 mode 不可见页回落；`maybeStartTour` 首进弹引导。  
6. **音效** localStorage `km_sfx`；与存档无关。  

## 易踩坑

- `installEra` 读档必须按 `S.era` 重装，否则上一档时代数据残留  
- 选手/教练身份下 `transferOpsBlockedReason` 拦买断生意  

## 相关测试

- `tests/verify-career.js`、`verify-guide.js`、模式同步相关用例
