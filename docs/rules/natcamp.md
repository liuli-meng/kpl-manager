# natcamp.js — 亚运国家队征召

对应源文件：`src/js/natcamp.js`  
总索引：[docs/RULES.md](../RULES.md)

## 隐性规则

1. **宣布时点**：亚运年夏季赛前 `announceNatCamp`；名单 = 全联盟各位置总值最高。  
2. **入选选手**：`natCamp=true`，**整段夏赛缺席俱乐部**；首发立刻 `autoFillLineup`。  
3. **无替补**：位置空缺，转会期必须签人——开赛前有警告，空位会拦 `startMatch`。  
4. **集训日结**：每 5 天汇报（状态/小幅成长）；约第 20 天热身赛状态拉满。  
5. **选手模式**可选 `natFocus`（playerops），由 `applyNatFocus` 在汇报时微调。  
6. **出征/收官**：奖牌回流人气/身价/士气；年总体力−；`natCamp` 清除。  
7. **守卫**：集训中不可出售/外租/下放/申请转会（`canRelease`/career 路径）。  

## 相关测试

- `tests/verify-natcamp.js`
