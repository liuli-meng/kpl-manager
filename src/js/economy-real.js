/* V2REF：设计参考实现，未接入 index.html / harness。
   生产经济唯一源是 data.js 的 ECON / wageOf / valueOf / CLUB_TEMPLATES。
   本文件顶层声明已包进 V2REF 命名空间，避免与 data.js/season.js 双源撞名。 */
var V2REF = (typeof V2REF !== 'undefined' && V2REF) || {};
(function (exports) {
/* ================= 真实 KPL 经济系统 v2.0 =================
   对标真实 KPL 2016-2026 年俱乐部运营模式，还原真实财务数据 */

// ================= 年份经济参数 (逐年增长) =================
const YEAR_ECONOMY = {
  // { 基础预算系数，薪资系数，转会费封顶，通货膨胀率 }
  2016: { fund_mul: 0.5, wage_mul: 0.4, transfer_cap: 500, inflation: 0.0 },
  2017: { fund_mul: 0.6, wage_mul: 0.5, transfer_cap: 800, inflation: 0.02 },
  2018: { fund_mul: 0.7, wage_mul: 0.6, transfer_cap: 1000, inflation: 0.03 },
  2019: { fund_mul: 0.8, wage_mul: 0.7, transfer_cap: 1500, inflation: 0.04 },
  2020: { fund_mul: 0.85, wage_mul: 0.75, transfer_cap: 2000, inflation: 0.05 },
  2021: { fund_mul: 0.9, wage_mul: 0.8, transfer_cap: 3000, inflation: 0.06 },
  2022: { fund_mul: 0.95, wage_mul: 0.88, transfer_cap: 4000, inflation: 0.07 },
  2023: { fund_mul: 1.0, wage_mul: 0.95, transfer_cap: 5000, inflation: 0.08 },
  2024: { fund_mul: 1.05, wage_mul: 1.0, transfer_cap: 8000, inflation: 0.09 },
  2025: { fund_mul: 1.1, wage_mul: 1.05, transfer_cap: 10000, inflation: 0.1 },
  2026: { fund_mul: 1.15, wage_mul: 1.1, transfer_cap: 12000, inflation: 0.12 },
};

// ================= 俱乐部分级预算标准 =================
const CLUB_TIERS = {
  elite: { // 顶级豪门
    budget_scale: 1.15,      // 预算系数 1.15
    wage_capacity: 'high',   // 高薪容许度
    transfer_aggression: 0.9, // 引援激进程度
    commercial_focus: 0.85,   // 商业开发优先级
  },
  mid_tier: { // 中坚队伍
    budget_scale: 1.0,
    wage_capacity: 'medium',
    transfer_aggression: 0.6,
    commercial_focus: 0.7,
  },
  low_tier: { // 平民战队
    budget_scale: 0.7,
    wage_capacity: 'low',
    transfer_aggression: 0.3,
    commercial_focus: 0.5,
  }
};

// ================= 选手真实薪资体系 =================
const PLAYER_SALARY_REAL = {
  // 新人底薪 (单位：万 RMB/年)
  base_salary: {
    rookie_17: 15,        // 17 岁青训新人
    junior_19: 25,        // 19 岁次级联赛
    veteran_experienced: 50, // 有经验老将
  },
  
  // 顶薪分级 (基于综合评分 OVR)
  top_salary_by_rating: {
    ovr_95_plus: 400,     // S+级 (国民选手)
    ovr_90_94: 350,       // S 级 (明星选手)
    ovr_85_89: 250,       // A 级 (主力选手)
    ovr_80_84: 150,       // B 级 (轮换选手)
    ovr_75_79: 100,       // C 级 (替补/边缘)
    ovr_below_75: 60,     // D 级 (青训/末位)
  },
  
  // 薪资组成部分
  salary_components: {
    base: '基本工资',           // 固定月薪×12
    match_bonus: '比赛奖金',     // 每场 1-5 万
    win_bonus: '胜场奖励',      // 赢一场 +2 万
    playoff_bonus: '季后赛奖金', // 进季后赛额外 50 万
    championship: '冠军奖金',    // 夺冠 200-500 万
    endorsement: '个人代言',     // 商业活动收入
    performance: '表现系数',    // KDA/MVP浮动
  },
  
  // 薪资计算公式
  calculate_wage: function(overall, age, popularity, contract_year) {
    let base = this.get_base_by_rating(overall);
    let age_factor = this.get_age_factor(age); // 黄金期溢价
    let pop_factor = 1 + (popularity - 50) / 200; // 人气影响
    let contract_factor = contract_year === 1 ? 0.85 : 1.0; // 最后一年打折
    
    return Math.round(base * age_factor * pop_factor * contract_factor);
  },
  
  get_base_by_rating: function(ovr) {
    if(ovr >= 95) return this.base_salary.rookie_17 * 15;
    if(ovr >= 90) return this.base_salary.rookie_17 * 12;
    if(ovr >= 85) return this.base_salary.rookie_19 * 8;
    if(ovr >= 80) return this.base_salary.veteran_experienced * 3;
    if(ovr >= 75) return this.base_salary.veteran_experienced * 2;
    return this.base_salary.veteran_experienced;
  },
  
  get_age_factor: function(age) {
    if(age <= 18) return 0.6;  // 新人折扣
    if(age <= 21) return 0.85; // 年轻选手
    if(age <= 25) return 1.2;  // 黄金期溢价
    if(age <= 27) return 1.1;  // 巅峰晚期
    if(age <= 29) return 0.95; // 老将
    return 0.7;                // 高龄 discount
  },
};

// ================= 转会费计算系统 =================
const TRANSFER_FEE_SYSTEM = {
  // 基础封顶 (随年份变化)
  get_cap_for_year: function(year) {
    return YEAR_ECONOMY[year] ? YEAR_ECONOMY[year].transfer_cap : 12000;
  },
  
  // 身价计算公式 (单位：万 RMB)
  calculate_value: function(player, year) {
    const base = this.get_base_value(player.overall);
    const factors = this.calculate_factors(player, year);
    
    let value = base * factors.age * factors.popularity * 
                factors.performance * factors.contract * 
                factors.market_demand;
    
    // 特殊顶星不限价
    if(this.is_special_player(player)) {
      value *= 1.5; // 顶星可溢价 50%
    }
    
    // 应用封顶
    const cap = this.get_cap_for_year(year);
    value = Math.min(value, cap);
    
    return Math.round(value);
  },
  
  get_base_value: function(ovr) {
    if(ovr >= 95) return 8000;    // S+起底 8000 万
    if(ovr >= 90) return 5000;    // S 级
    if(ovr >= 85) return 2000;    // A级
    if(ovr >= 80) return 800;     // B级
    if(ovr >= 75) return 300;     // C级
    return 100;                    // D 级
  },
  
  calculate_factors: function(player, year) {
    const age = player.age;
    const age_factor = age <= 18 ? 0.5 : 
                       age <= 22 ? 1.3 :
                       age <= 26 ? 1.5 : // 黄金期峰值
                       age <= 28 ? 1.2 : 0.8;
    
    const popularity_factor = 1 + (player.popularity || 50) / 100;
    
    const perf_factor = (player.val || 100) / 100;
    
    const contract_factor = player.contract === 1 ? 0.7 :  // 最后一年便宜
                           player.contract === 2 ? 0.9 : 1.0;
    
    const market_factor = this.calculate_market_demand(player.pos, year);
    
    return {
      age: age_factor,
      popularity: popularity_factor,
      performance: perf_factor,
      contract: contract_factor,
      market_demand: market_factor
    };
  },
  
  calculate_market_demand: function(pos, year) {
    // 根据各位置人才密度动态调整需求系数
    const supply_demand = {
      'top': { supply: 0.6, demand: 0.8 },
      'jg': { supply: 0.4, demand: 0.95 }, // 野人少，需求高
      'mid': { supply: 0.7, demand: 0.85 },
      'ad': { supply: 0.5, demand: 0.9 },
      'sup': { supply: 0.8, demand: 0.7 },
    };
    
    const s = supply_demand[pos];
    return 1 + (s.demand - s.supply) * 0.5;
  },
  
  is_special_player: function(player) {
    const legends = ['Fly', '一诺', '久诚', '暖阳', '花海'];
    return legends.includes(player.name);
  },
};

// ================= 俱乐部模板更新 =================
function build_club_templates() {
  const templates = [];
  
  // 现代俱乐部 (2026 年)
  const modern_clubs = [
    { name: '成都 AG 超玩会', tier: 'elite', seed: 680 },
    { name: '重庆狼队', tier: 'elite', seed: 670 },
    { name: '武汉 eStarPro', tier: 'elite', seed: 650 },
    { name: '北京 WB', tier: 'mid_tier', seed: 600 },
    { name: '广州 TTG', tier: 'mid_tier', seed: 560 },
    { name: '南京 Hero 久竞', tier: 'mid_tier', seed: 520 },
    { name: '苏州 KSG', tier: 'mid_tier', seed: 500 },
    { name: '北京 JDG', tier: 'mid_tier', seed: 540 },
    { name: '济南 RW侠', tier: 'mid_tier', seed: 510 },
    { name: '佛山 DRG', tier: 'mid_tier', seed: 490 },
    { name: '深圳 DYG', tier: 'low_tier', seed: 470 },
    { name: '长沙 TES.A', tier: 'low_tier', seed: 450 },
    { name: '杭州 LGD.NBW', tier: 'low_tier', seed: 430 },
    { name: '上海 EDG.M', tier: 'low_tier', seed: 410 },
    { name: '上海 RNG.M', tier: 'low_tier', seed: 400 },
    { name: '西安 WE', tier: 'low_tier', seed: 380 },
    { name: '桐乡情久', tier: 'low_tier', seed: 360 },
    { name: '常山 UUG', tier: 'low_tier', seed: 340 },
  ];
  
  modern_clubs.forEach((c, idx) => {
    const budget = this.get_club_budget(c.tier, 2026);
    templates.push({
      id: `mod_${idx}`,
      name: c.name,
      tier: c.tier,
      budget: budget.fund,
      annual_budget: budget.annual,
      wage_cap: budget.cap,
      coach: this.get_coach_for_team(c.name),
      seedPower: c.seed,
      players: this.generate_lineup(c.tier),
      desc: this.get_team_desc(c.name, c.tier),
    });
  });
  
  return templates;
}

function get_club_budget(tier, year) {
  const base = {
    elite: { fund: 15000, annual: 30000, cap: 400 },
    mid_tier: { fund: 8000, annual: 15000, cap: 300 },
    low_tier: { fund: 3000, annual: 6000, cap: 200 },
  };
  
  const economy = YEAR_ECONOMY[year] || YEAR_ECONOMY[2026];
  const tier_mult = CLUB_TIERS[tier].budget_scale;
  
  return {
    fund: Math.round(base[tier].fund * economy.fund_mul * tier_mult),
    annual: Math.round(base[tier].annual * economy.fund_mul * tier_mult),
    cap: Math.round(base[tier].cap * economy.wage_mul),
  };
}

// ================= 存档迁移兼容 =================
function migrate_economy_v2(save) {
  // 旧存档自动升级到新经济系统
  if(!save.econVersion || save.econVersion < 2) {
    logEvent(save, '📈 经济系统升级：联盟进入真实 KPL 模式');
    
    // 缩放现有数值到真实刻度
    if(save.fund) save.fund = Math.round(save.fund * 6); // ×6 放大
    if(save.wageCap) save.wageCap = Math.round(save.wageCap * 6);
    
    if(save.players) {
      save.players.forEach(p => {
        if(p.wage) p.wage = Math.round(p.wage * 6); // 周薪→年薪
      });
    }
    
    save.econVersion = 2;
    save.econMigrated = true;
  }
  
  return save;
}

// ================= UI 显示辅助 =================
function fmtWage(wage) {
  // 格式化薪资显示 (单位：万/年)
  if(wage >= 10000) {
    return (wage / 10000).toFixed(1) + '亿/年';
  } else if(wage >= 1000) {
    return (wage / 1000).toFixed(1) + '千万/年';
  } else {
    return wage + '万/年';
  }
}

function fmtFund(fund) {
  // 资金显示
  if(fund >= 10000) {
    return (fund / 10000).toFixed(1) + '亿';
  } else {
    return fund + '万';
  }
}

})(V2REF);
