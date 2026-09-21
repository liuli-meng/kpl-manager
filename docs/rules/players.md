# players.js — 选手生成

对应源文件：`src/js/players.js`  
总索引：[docs/RULES.md](../RULES.md)

## 硬数值

| 项 | 值 |
|---|---|
| 自由人档位 base | star≈85–92 / mid≈74–82 / low≈66–73（四维各抽） |
| 英雄池 | 招牌 lv3 + 本职及摇摆位全 lv2（**只含本位置可用英雄**） |
| 合同年限生成 | rnd 2–3 年 |
| 士气生成 | rnd 75–92 |

## 隐性规则

1. **`genPlayer(def)` 产出即含 `peak` 天花板**（若 `ensurePlayerPeak` 已加载）：按年龄/总值定加练房间，防后期刷满 99。  
2. **传奇老将**（def.team==='传奇'）：年龄 = 该位置 retire−rnd(1,2)，即「最后一舞」。  
3. **青训标签**：出道年龄 16–17；工资打折（主播 0.5× / 青训 0.7× 量级）。  
4. **`buyPlayer`**：必须走 `canSign`（或旧的 roster/窗口/身份守卫）+ 资金 + 可选超帽 confirm；**签约后 `aiDetachDef`**，防与 AI 名册双挂。  
5. **人口味 `popularity`** 由 OVR 档位出，主播再 ×1.5——影响转会接盘与代言，不是纯装饰。

## 易踩坑

- 自由人 id 为 `fa_pos_xxx`，出售时若 def 不存在要在 `completeSale` **补建 def**，否则 AI「查无此人」  
- 生成时若 `ensurePlayerPeak` 未定义（加载顺序问题），读档侧 `migrateSave` 会补 peak  
- `genPlayer` 里 overall 用临时对象算完再构选手；改 attrs 后 OVR **不自动写回选手字段**（OVR 本就实时算）

## 相关测试

- `tests/verify-career.js` 开局路径  
- `tests/verify-names.js` 名字唯一
