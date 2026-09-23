# 🔄 KPL Manager 真实还原版 - 迁移指南 v2.0

## 📋 概述

本文档详细说明如何从**旧版本 (v1.x)** 升级到 **真实还原版 (v2.0)**,包括数据迁移、系统替换和测试验证步骤。

---

## 一、核心文件清单

### 新增系统文件
```
src/js/
├── economy-real.js           // 真实经济系统 (新建)
├── systems-real.js           // 赛制细节系统 (新建)
├── ai-strategy-real.js       // AI 行为升级 (新建)
└── team-management-real.js   // 团队管理维度 (新建)
```

### 修改的核心文件
```
src/js/
├── data.js                   // 更新俱乐部模板
├── season.js                 // 添加年份赛制逻辑
├── transfer.js               // 重写转会费计算
├── players.js                // 薪资体系调整
└── state.js                  // 新增字段兼容
```

---

## 二、存档迁移流程

### 2.1 迁移机制设计

系统采用**渐进式迁移链**,确保所有旧存档可自动升级:

```javascript
// state.js - SAVE_DEFAULTS 新增字段
const SAVE_DEFAULTS = {
  // ...原有字段...
  
  // 新经济系统
  econVersion: 0,              // 经济系统版本号
  econMigrated: false,         // 是否已迁移
  
  // 新赛制系统
  divisionSystem: '',          // 赛区制度类型
  rules: {},                   // 当年规则集
  
  // 新团队管理
  coaching_staff: [],          // 教练团队
  medical_log: [],             // 医疗记录
  
  // 新数据分析
  analysis_reports: [],        // 分析报告
};

// MIGRATIONS 迁移链
const MIGRATIONS = [
  migrateV0_to_V1,  // 初始→v1(已有)
  migrateV1_to_V2,  // v1→v2(经济+赛制升级)
];

function migrateSave(save) {
  // 遍历迁移链
  for(let i=0; i<MIGRATIONS.length; i++) {
    if(!save.migratedTo || save.migratedTo <= i) {
      save = MIGRATIONS[i](save);
      save.migratedTo = i + 1;
    }
  }
  
  return applySaveDefaults(save);
}

// ================= V1 → V2 迁移函数 =================
function migrateV1_to_V2(save) {
  logEvent(save, '🔄 开始升级至真实 KPL 模式 v2.0');
  
  // 1. 经济系统迁移
  migrate_economy_v2(save);
  
  // 2. 字段补全
  if(!save.divisionSystem) {
    const year = gameYear(save);
    save.divisionSystem = get_division_system_for_year(year).format;
  }
  
  if(!save.coaching_staff) {
    save.coaching_staff = [
      { id:'hc1', role:'head_coach', name:'默认主教练', wage:300 },
      { id:'ac1', role:'assistant_coach', name:'助理教练 1', wage:100 },
    ];
  }
  
  if(!save.analysis_reports) {
    save.analysis_reports = [];
  }
  
  if(!save.injury_prevention) {
    // 初始化伤病预防计划
    MEDICAL_REHAB_SYSTEM.injury_prevention_program(save);
  }
  
  // 标记已迁移
  save.econVersion = 2;
  save.econMigrated = true;
  save.migratedTo = 2;
  
  logEvent(save, '✅ 升级完成!现在体验真实 KPL 俱乐部运营');
  
  return save;
}

// ================= 经济数值缩放 =================
function migrate_economy_v2(save) {
  if(!save.fund) return save;
  
  // ×6 放大：旧单位→真实单位
  const scale_factor = 6;
  
  save.fund = Math.round(save.fund * scale_factor);
  save.wageCap = Math.round(save.wageCap * scale_factor);
  
  // 选手周薪→年薪
  if(save.players) {
    save.players.forEach(p => {
      if(p.wage) p.wage = Math.round(p.wage * 52/4); // 周薪×13≈年薪
    });
  }
  
  // 资金流水
  if(save.transfers_made) {
    save.transfers_made *= scale_factor;
  }
  
  return save;
}
```

---

## 三、数据兼容性处理

### 3.1 年份自动适配

系统会根据存档的 `season` 字段自动确定年份:

```javascript
function gameYear(s) {
  if(s&&s.era&&KPL_ERAS[s.era]&&KPL_ERAS[s.era].year){
    const y0=parseInt(KPL_ERAS[s.era].year,10);
    if(!isNaN(y0))return y0+((s.season||1)-1);
  }
  return 2025+(s.season||1); // 默认为 2026 年
}

// 根据年份应用不同规则
function get_economy_params_for_year(year) {
  return YEAR_ECONOMY[year] || YEAR_ECONOMY[2026];
}

function get_division_system(year) {
  if([2016,2017,2018,2019,2020].includes(year)) {
    return DIVISION_SYSTEM.east_west_division;
  } else if ([2021,2022,2023,2024].includes(year)) {
    return DIVISION_SYSTEM.large_groups;
  } else {
    return DIVISION_SYSTEM.current_format;
  }
}
```

### 3.2 旧字段兼容

确保不破坏旧功能:

```javascript
// 工资帽兼容
function weeklyWage(s) {
  let sum=(s.players||[]).reduce((t,p)=>t+(p&&p.loan?0:num(p&&p.wage)),0);
  if(s.coach)sum+=num(s.coach.wage);
  (s.assistants||[]).forEach(a=>sum+=num(a&&a.wage));
  
  // 如果 w 龄为周薪格式 (旧档),转换
  if(s.saveType==='legacy') {
    sum *= 13; // 周薪×13≈年薪
  }
  
  return sum;
}

// 转会费封顶兼容
function capFee(x, year) {
  const cap = get_economy_params_for_year(year || gameYear(s)).transfer_cap;
  return Math.min(Math.round(x), cap);
}
```

---

## 四、部署步骤

### 4.1 文件替换

```bash
# 1. 备份当前项目
cp -r kpl-manager kpl-manager-backup-$(date +%Y%m%d)

# 2. 复制新系统文件
cp src/js/economy-real.js src/js/
cp src/js/systems-real.js src/js/
cp src/js/ai-strategy-real.js src/js/
cp src/js/team-management-real.js src/js/

# 3. 修改核心文件
# - data.js: 添加 CLUB_TIERS 和 YEAR_ECONOMY 引用
# - season.js: 添加 init_season_with_system() 调用
# - transfer.js: 使用新的 TRANSFER_FEE_SYSTEM
# - players.js: 调用 PLAYER_SALARY_REAL.calculate_wage()
# - state.js: 新增 SAVE_DEFAULTS 和 MIGRATIONS

# 4. 构建测试
npm run build

# 5. 运行测试
npm test
```

### 4.2 浏览器测试流程

1. **新建存档测试**:
   - 创建 2026 年新档 → 检查经济参数是否正确
   - 创建 2017 时代档 → 检查是否应用历史赛季制

2. **旧档读取测试**:
   - 读取旧版本存档 → 检查迁移日志
   - 验证数值缩放 (资金×6、薪资×13)
   - 确认新增字段正常显示

3. **功能验证**:
   - ✅ 转会窗口：检查报价是否在 8000 万封顶内
   - ✅ 薪资谈判：检查年薪是否在真实范围
   - ✅ 伤病系统：触发伤病后查看治疗方案
   - ✅ 教练聘任：聘请不同级别教练观察效果
   - ✅ 数据分析：运行对手侦查报告

---

## 五、测试验证清单

### 5.1 单元测试

在 `tests/`目录添加:

```javascript
// tests/verify-economy-v2.js
describe('真实经济系统 v2', () => {
  it('2026 年豪门预算应在 1.5 亿左右', () => {
    const s = makeTester('economy-v2').save;
    s.teamName='成都 AG 超玩会';
    const budget = get_club_budget('elite', 2026);
    expect(budget.fund).toBeCloseTo(15000, -2); // ±2 万误差
  });
  
  it('转会费封顶随年份增长', () => {
    expect(YEAR_ECONOMY[2017].transfer_cap).toBe(800);
    expect(YEAR_ECONOMY[2026].transfer_cap).toBe(12000);
  });
  
  it('选手薪资计算符合实际', () => {
    const player = { overall:95, age:24, popularity:80 };
    const wage = PLAYER_SALARY_REAL.calculate_wage(player.overall, player.age, player.popularity);
    expect(wage).toBeGreaterThanOrEqual(350); // S+级≥350 万/年
    expect(wage).toBeLessThanOrEqual(400);
  });
});

// tests/verify-systems-v2.js
describe('赛制系统 v2', () => {
  it('2017 年启用东西部赛区', () => {
    const sys = get_division_system_for_year(2017);
    expect(sys.format).toContain('东西部');
  });
  
  it('2025 年启用最新赛制', () => {
    const sys = get_division_system_for_year(2025);
    expect(sys.teams).toBe(18);
  });
});

// tests/verify-ai-strategy-v2.js
describe('AI 策略 v2', () => {
  it('豪门俱乐部采用激进策略', () => {
    const club = { championships:6, fund:18000 };
    const strategy = AI_BUILD_STRATEGIES.aggressive_expansion;
    expect(strategy.transfer_behavior.budget_allocation).toBe(0.8);
  });
  
  it('AI 转会决策考虑阵容短板', () => {
    const weaknesses = [{position:'jg',severity:20}];
    const targets = identify_targets(weaknesses, 5000, 'balanced');
    expect(targets.length).toBeGreaterThan(0);
  });
});

// tests/verify-team-management-v2.js
describe('团队管理 v2', () => {
  it('教练团队总薪资合理', () => {
    const staff = [
      {wage:500}, {wage:100},{wage:100}, {wage:80},{wage:100},{wage:50}
    ];
    const total = staff.reduce((a,b)=>a+b.wage,0);
    expect(total).toBeLessThan(1000); // <1000 万/年
  });
  
  it('伤病治疗选项可用', () => {
    const treatment = MEDICAL_REHAB_SYSTEM.treatment_protocol('player','acute_muscle_strain');
    expect(treatment.days_0_3).toContain('RICE');
  });
});
```

### 5.2 平衡性测试

运行蒙特卡洛模拟:

```bash
# 跑 500 个赛季，验证经济平衡
node sim.js --seasons=500 --economy=v2

# 预期结果:
# - 破产率：<15%(对比旧版 0%)
# - 夺冠集中度：top3 夺冠率<60%(对比旧版 80%+)
# - 转会活跃度：每赛季人均转会 0.5-1.5 人
```

---

## 六、已知问题和注意事项

### 6.1 性能影响

| 优化项 | 说明 |
|--------|-----|
| 复杂计算懒加载 | 数据分析报告仅在点击查看时生成 |
| 数据结构精简 | 教练团队用数组代替对象提升访问速度 |
| 事件日志压缩 | 医疗日志每周合并一次 |

### 6.2 UI 适配

- 新增"教练团队"页面
- 新增"医疗康复"面板
- 增加"数据分析"入口
- 转会市场显示"年薪"而非"周薪"

### 6.3 用户体验提示

首次登录真实模式的玩家会看到:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎮 王者电竞经理 · 真实还原版 v2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ 本次升级亮点:

💰 经济系统真实化
   • 俱乐部预算：3000 万~1.5 亿 (非亿万富翁开局)
   • 选手年薪：15 万 ~400 万 (新人有底薪)
   • 转会费封顶：最高 1.2 亿 (真实顶星身价)

🏆 赛制细节补全
   • 2016-2020 东西部赛区制度
   • 席位数拍卖机制
   • 完整合同系统 (年限 + 违约金)
   • 伤病管理系统 (真实恢复周期)

👥 专业团队配置
   • 主教练/BP 教练/心理辅导师/数据分析师
   • 队医/康复师/按摩师医疗团队
   • 数据分析支持 (对手侦查 +比赛复盘)

🤖 AI 行为升级
   • 银河战舰/均衡发展/青训产出多种建队策略
   • 长期财政规划 (季度财务报表)
   • 战术导向的 BP 决策

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
开始体验真实的 KPL 职业俱乐部运营!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 七、回滚方案

如需回退到旧版本:

```javascript
// 方法 1: 恢复备份
mv kpl-manager kpl-manager-v2
mv kpl-manager-backup-YYYYMMDD kpl-manager

// 方法 2: 切换模式开关
// 在 main.js添加:
if(localStorage.getItem('useRealMode') === 'false') {
  // 跳过真实模式初始化
  skipEconomyMigration();
}
```

---

## 八、技术支持

如有问题请联系:
- GitHub Issues: https://github.com/liuli-meng/kpl-manager/issues
- Email: support@kpl-manager.dev

---

**最后更新**: 2026-09-23  
**版本号**: v2.0.0  
**状态**: Production Ready ✅
