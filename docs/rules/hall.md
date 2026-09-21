# hall.js — 荣誉馆

对应源文件：`src/js/hall.js`  
总索引：[docs/RULES.md](../RULES.md)

## 隐性规则

1. **数据源**：`s.honors` / `titleHistory` / `fmvpHonor` / 最佳阵容等赛季入册字段，荣誉馆只读渲染。  
2. **王朝**：同一队春+夏两连冠计一段；不同杯赛冠军不混算（以 `titleHistory` 时间序为准）。  
3. **FMVP 榜**由历届表汇总，不单独维护一份排名真相。  
4. **分享图**：canvas 生成；沙箱/无 canvas 环境应失败静默，不阻断游戏。  
5. 三种身份导航都含 hall（`MODE_PAGES`）。  

## 相关测试

- `tests/verify-hall.js`
