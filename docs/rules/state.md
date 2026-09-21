# state.js — 状态 / 存档 / 派生

对应源文件：`src/js/state.js`  
总索引：[docs/RULES.md](../RULES.md)

## 硬数值

| 项 | 值 | 说明 |
|---|---|---|
| 存储键 | `esport_manager_save_v3` | 键名带 v3 是历史遗留，**永不跟 SAVE_VERSION 改** |
| SAVE_VERSION | 4 | 结构变更才 +1，并在 `MIGRATIONS` 登记 |
| MATCH_MIN_AGE | 18 | 未满不能代表俱乐部出场（训练/加练仍可） |
| 本机偏好键 | `km_prefs` | 简化模式/高对比，**不进存档、不随导出** |

### AGE_MODEL（位置生命周期）

| 位置 | gold 黄金期末 | decline 起 | retire 退役 | decay/年 |
|---|---|---|---|---|
| jg 打野 | 21 | 22 | 24 | 2 |
| ad 发育路 | 21 | 22 | 24 | 2 |
| top 对抗 | 22 | 23 | 26 | 1 |
| mid 中路 | 22 | 23 | 26 | 1 |
| sup 游走 | 24 | 25 | 31 | 1 |

- `ageStage`：`age≥retire` 已退役；`retire-1` 即将退役；`>gold` 下滑期；否则黄金期  
- 年度 `newSeason`：黄金期属性可能 +1（还受 `ensurePlayerPeak` 天花板约束）；下滑期按 `decay` 随机减

## 隐性规则

1. **`weeklyWage(s)` 是派生函数**，不是 `totalSalary` 字段。每次现算：选手（租借中不计）+ 主教练 + 助教。禁止另存一份「总周薪」再手动同步。  
2. **`scrubWages`**：工资 NaN/负/undefined → 按 `wageOf(overall) × val/100` 重估，并夹在 \[2, PLAYER_WAGE_MAX\]。读档、发薪前会调。  
3. **`migrateSave`**：字段默认 → 结构恢复（赛季形态/杯赛/年总卡死）→ 货币缩放链 → **`auditSave` 业务巡检**。迁移某步失败**不推进版本号**（防止半迁移档被写回伪装成完整档）。  
4. **`SAVE_DEFAULTS`** 是读档兜底的唯一字段来源；`audit-static` 盯着新增字段别漏登记。  
5. **`playerStatus(p,s)`** 是状态旗唯一出口（injury/kjia/loan/loanOut/natCamp/natFill/retiring/busy/minor…）。业务文件禁止裸拼多旗标。  
6. **`buildBestLineup` / `matchEligible`**：伤停、租借出、K甲、集训、未满 18 → 不可出场；排首发必须过滤，不能「有 id 就塞」。  
7. **双开检测**：`km_tab_lock` + BroadcastChannel，只警告不强制；多标签写同一 origin 会互相覆盖存档。  
8. **UI 偏好**在 localStorage，**导出/换机不会带走**。

## 守卫入口（引擎层，无 toast 依赖可被门禁调用）

- `requireSave`：未开局拦截 UI  
- `confirmDanger` / `confirmSoft`：高代价确认；简化模式只跳过 soft  
- `uiDebounce`：同 key 约 450ms 防连点  

## 易踩坑

- 读档后 `aiRosters` 一律清空重建，**不要把缓存当真相源**  
- `matches` 是派生索引，序列化时剥离；真相在 bracket/schedule  
- `transferList` / `freeAgents` / `market` 含随机数，**不能当可重建缓存剥掉**  
- 资金为负：发薪路径会钳到 0 并扣全队士气，不是「允许负债运营」

## 相关测试

- `tests/verify-save.js` — 迁移链/导入清洗  
- `tests/verify-prefs.js` — 本机偏好  
- `tests/verify-playerops` 等 — 状态旗经 playerStatus
