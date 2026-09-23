# 🏆 KPL Manager - 真实还原重构方案 v2.0

## 📋 项目目标

将现有游戏从"FM 经理风格模拟"升级为**真正还原真实 KPL 职业电竞俱乐部运营**的硬核模拟器，核心对标以下维度:

### 一、经济体系真实性 ⭐⭐⭐⭐⭐

#### 问题现状
| 项目 | 当前值 | 真实 KPL | 差距倍数 |
|------|--------|---------|---------|
| 豪门俱乐部预算 | 2500 万 | 1-2 亿 RMB/年 | **40-80 倍** |
| 选手顶薪 (周) | 70 万 ≈364 万/年 | 400 万/年 | 接近但结构不同 |
| 新人底薪 (周) | 2 万 ≈104 万/年 | 15-30 万/年 | **4-7 倍虚高** |
| 转会费封顶 | 1500 万 | 顶星可达 5000 万-1 亿 | **3-7 倍压低** |
| 工资帽 | 150-250 万/周 | 无固定帽 (但有大名单成本约束) | **制度不存在** |

#### 重构方案

##### 1.1 俱乐部预算系统
```javascript
// data.js - CLUB_TEMPLATES 新增字段
const CLUB_BUDGETS = {
  elite: { // 顶级豪门
    fund: 15000,      // 初始资金：1.5 亿 RMB
    annual_budget: 30000, // 年度总预算：3 亿
    wage_cap: 400,    // 薪资总额上限：400 万/年/人 (顶薪)
    transfer_budget: 5000, // 转会专项资金：5000 万
    commercial_ops: 5000,   // 商业开发投入：5000 万/年
  },
  mid_tier: { // 中坚队伍
    fund: 8000,
    annual_budget: 15000,
    wage_cap: 350,
    transfer_budget: 2000,
    commercial_ops: 2000,
  },
  low_tier: { // 平民战队
    fund: 3000,
    annual_budget: 6000,
    wage_cap: 250,
    transfer_budget: 500,
    commercial_ops: 500,
  }
};

// 按年份动态调整
const YEAR_ECONOMY = {
  2017: { fund_mul: 0.6, wage_mul: 0.5, transfer_cap: 800 },
  2018: { fund_mul: 0.7, wage_mul: 0.6, transfer_cap: 1000 },
  2019: { fund_mul: 0.8, wage_mul: 0.7, transfer_cap: 1500 },
  2020: { fund_mul: 0.85, wage_mul: 0.8, transfer_cap: 2000 },
  2021: { fund_mul: 0.9, wage_mul: 0.85, transfer_cap: 3000 },
  2022: { fund_mul: 0.95, wage_mul: 0.9, transfer_cap: 4000 },
  2023: { fund_mul: 1.0, wage_mul: 0.95, transfer_cap: 5000 },
  2024: { fund_mul: 1.0, wage_mul: 1.0, transfer_cap: 8000 },
  2025: { fund_mul: 1.0, wage_mul: 1.0, transfer_cap: 10000 },
  2026: { fund_mul: 1.0, wage_mul: 1.0, transfer_cap: 12000 },
};
```

##### 1.2 选手薪资体系
```javascript
// players.js - 真实的薪资结构
const PLAYER_SALARY = {
  base: { // 新人底薪
    rookie: 15,       // 15 万/年 (U17 青训)
    junior: 25,       // 25 万/年 (次级联赛选手)
    veteran: 50,      // 50 万/年 (有经验的老将)
  },
  top_salary: { // 顶薪分级
    SSR: 400,         // S 级选手：400 万/年
    SR: 250,          // A 级选手：250 万/年
    R: 150,           // B 级选手：150 万/年
    N: 80,            // C 级选手：80 万/年
  },
  components: { // 薪资组成
    base_salary: '基本工资',     // 固定部分
    match_bonus: '比赛奖金',     // 按场次结算
    win_bonus: '胜场奖励',      // 每赢一场额外 +X 万
    championship: '冠军奖金',    // 夺冠一次性奖励
    endorsement: '代言收入',     // 个人商业活动
    performance: '表现系数',    // KDA/MVP 等浮动
  },
  contract_terms: { // 合同年限规则
    min_years: 1,        // 最短 1 年
    max_years: 5,        // 最长 5 年
    option_year: true,   // 可选续约条款
    buyout_clause: true, // 违约金条款
  }
};
```

##### 1.3 转会费计算
```javascript
// transfer.js - 真实转会机制
const TRANSFER_SYSTEM = {
  cap_base: 8000,    // 基础封顶：8000 万
  ssr_cap: 12000,    // S 级顶星：1.2 亿
  special_players: { // 特殊球员不限价
    'Fly': '传奇老将',
    '一诺': '国民 ADC',
    '久诚': '法刺之神',
  },
  
  price_factors: { // 价格影响因素
    overall_rating: 1.0,   // 综合评分系数
    age_factor: 1.2,       // 年龄因素 (黄金期溢价)
    popularity: 1.5,       // 人气加成
    team_need: 2.0,        // 球队急需程度
    contract_status: 1.3,  // 合同状态 (最后一年打折)
    market_demand: 1.1,    // 市场供需
    bidding_war: 1.8,      // 竞价战 (多队争抢)
  },
  
  negotiation_system: { // 谈判系统
    rounds: 3,           // 最多 3 轮报价
    counter_offer: true, // 反报价机制
    walk_away: true,     // 谈判破裂
    mediator: false,     // 联盟调解 (仅特定情况)
  }
};
```

---

## 二、赛制细节补全 ⭐⭐⭐⭐⭐

### 2.1 东西部赛区制度 (2021 前) / 大分组 (2021 后)
```javascript
// season.js - 赛区制度
const DIVISION_SYSTEM = {
  2016_2020: { // 东西部赛区
    east_division: ['成都 AG 超玩会', '武汉 eStarPro', 'AS 仙阁', 'QGhappy', 'XQ'],
    west_division: ['重庆狼队', '南京 Hero 久竞', '济南 RW 侠', '广州 TTG', '深圳 DYG'],
    rules: {
      regular_season: '同分区内战 + 跨分区交流赛',
      playoffs: '东西部前四名合并季后赛',
      format: 'BO5 单循环 → BO7 双败淘汰',
    }
  },
  
  2021_2024: { // 大分组时代
    groups: ['S 组', 'A 组', 'B 组'],
    rules: {
      promotion_relegation: false, // 取消升降级
      group_swap: '每赛季根据上赛季成绩蛇形分档',
      format: '三组单循环 → S/A 卡位赛 → 季后赛',
    }
  },
  
  2025_2026: { // 最新赛制
    teams: 18,
    splits: ['春季赛', '夏季赛'],
    playoff_format: '10 队 BO7 双败淘汰',
    points_system: {
      spring: { p1:100, p2:80, p34:60, p56:40, p78:20, p910:10, p1112:5 },
      summer: { p1:120, p2:100, p34:80, p56:50, p78:30, p910:20, p1112:10 },
    }
  }
};
```

### 2.2 席位数拍卖制度 (2020 后)
```javascript
// seat_auction.js - 席位管理
const SEAT_AUCTION = {
  base_fee: 10000,   // 基础席位费：1 亿元
  annual_maintenance: 2000, // 每年维护费：2000 万
  
  auction_rules: {
    eligibility: ['资金实力证明', '主场城市承诺', '青训建设计划'],
    bidding_rounds: 3,
    minimum_bid_increase: 500, // 每次加价至少 500 万
  },
  
  relocation_fee: 3000, // 俱乐部迁移费：3000 万
  expulsion_conditions: [
    '连续两年未进季后赛',
    '严重违反联盟规定',
    '财务无法持续运营',
  ]
};
```

### 2.3 选手合同系统
```javascript
// contracts.js - 完整合同引擎
const CONTRACT_SYSTEM = {
  duration: {
    min: 1,
    max: 5,
    typical: { rookie: 2, star: 3, veteran: 4 },
  },
  
  salary_structure: {
    base_salary: '固定月薪',
    performance_bonus: '绩效奖金',
    prize_share: '奖金分成 (官方 70%)',
    endorsement_split: '代言分成 (俱乐部 30%/选手 70%)',
  },
  
  clauses: {
    buyout: {
      enabled: true,
      formula: '剩余合同年限 × 年薪 × 1.5',
      exceptions: '顶星选手可协商降低',
    },
    
    option_year: {
      club_option: true,  // 俱乐部选择权
      player_option: true, // 选手选择权
      trigger_deadline: '赛季结束后 30 天内',
    },
    
    release_clause: {
      enabled: false, // 现 KPL 已取消解约金
      historical: '2017-2019 年存在',
    },
  },
  
  renewal_process: {
    notice_period: 60, // 提前 60 天通知
    negotiations: {
      max_rounds: 5,
      break_threshold: 3, // 谈崩 3 次自动终止
    },
  }
};
```

### 2.4 伤病管理系统
```javascript
// injury_system.js - 真实伤病机制
const INJURY_SYSTEM = {
  types: {
    acute: { // 急性伤
      name: '肌肉拉伤',
      recovery: '7-14 天',
      severity: '中等',
    },
    chronic: { // 慢性伤
      name: '手腕劳损',
      recovery: '长期恢复期',
      severity: '严重',
      flare_up_chance: 0.3, // 复发概率 30%
    },
    overuse: { // 过度使用
      name: '疲劳累积',
      recovery: '休息即可',
      prevention: '合理轮换',
    }
  },
  
  diagnosis: {
    medical_staff_required: true,
    severity_scale: [1, 2, 3, 4, 5], // 1 轻微~5 致命
    confirmation_days: 1, // 确诊需要时间
  },
  
  treatment: {
    rest: { days: 7, effectiveness: 0.6 },
    rehabilitation: { days: 14, effectiveness: 0.8 },
    advanced_medical: { days: 21, effectiveness: 0.9, cost: 50 }, // 高级医疗 50 万
  },
  
  return_to_play: {
    fitness_test: true,
    gradual_load: true, // 逐步增加负荷
    re_injury_risk: 0.15, // 复出后再次受伤风险 15%
  }
};
```

---

## 三、团队管理维度 ⭐⭐⭐⭐

### 3.1 教练团队配置
```javascript
// coaching_staff.js - 完整教练体系
const COACHING_STAFF = {
  positions: {
    head_coach: {
      role: '主教练',
      responsibility: ['战术制定', '临场指挥', '人员选拔'],
      influence: 1.0, // 对胜率影响权重
    },
    assistant_coach: {
      role: '助理教练',
      responsibility: ['日常训练', '数据分析'],
      influence: 0.3,
    },
    bp_coordinator: {
      role: 'BP 教练',
      responsibility: ['英雄池分析', 'Ban/Pick策略'],
      influence: 0.4,
    },
    mental_coach: {
      role: '心理辅导师',
      responsibility: ['心态调节', '压力管理'],
      influence: 0.2,
    },
    data_analyst: {
      role: '数据分析师',
      responsibility: ['对手研究', '自身数据复盘'],
      influence: 0.25,
    },
    physical_trainer: {
      role: '体能训练师',
      responsibility: ['身体状态维持', '伤病预防'],
      influence: 0.15,
    }
  },
  
  qualification_levels: {
    license_a: 'KPL 持证教练 (最高级别)',
    license_b: '区域认证教练',
    intern: '实习教练',
  }
};
```

### 3.2 数据分析团队
```javascript
// data_analysis.js - 数据分析系统
const DATA_ANALYSIS = {
  capabilities: {
    opponent_scouting: {
      name: '对手侦查',
      output: '对手战术倾向报告',
      time_required: '3 天',
      accuracy: 0.85,
    },
    own_performance: {
      name: '自身复盘',
      output: '比赛数据分析报告',
      time_required: '1 天',
      improvement_potential: 0.05, // 每周提升 5% 潜力
    },
    hero_pool: {
      name: '英雄池优化',
      output: '推荐练习列表',
      efficiency_boost: 0.1, // 训练效率 +10%
    },
    meta_analysis: {
      name: '版本趋势分析',
      output: '强势英雄预测',
      relevance: 0.75, // BP 成功率提升
    }
  },
  
  tools: {
    replay_system: '录像回放系统',
    stat_tracking: '数据统计平台',
    prediction_model: 'AI 预测模型',
  }
};
```

### 3.3 康复医疗团队
```javascript
// medical_team.js - 医疗康复系统
const MEDICAL_TEAM = {
  personnel: {
    doctor: {
      qualifications: ['执业医师资格', '运动医学专业'],
      responsibilities: ['诊断', '治疗方案制定'],
    },
    physiotherapist: {
      qualifications: ['康复治疗师执照'],
      responsibilities: ['物理治疗', '康复训练指导'],
    },
    massage_therapist: {
      qualifications: ['按摩师资格证'],
      responsibilities: ['放松恢复', '筋膜释放'],
    }
  },
  
  facilities: {
    rehab_center: {
      name: '康复中心',
      equipment: ['冷疗设备', '电刺激仪', '超声波治疗仪'],
      capacity: '每日接待 10 人次',
    },
    training_clinic: {
      name: '训练诊所',
      focus: '职业病预防 (手腕/腰椎)',
    }
  },
  
  programs: {
    daily_checkup: '每日健康检查',
    weekly_assessment: '周度评估',
    injury_prevention: '伤病预防计划',
    recovery_protocol: '标准化恢复流程',
  }
};
```

---

## 四、商业化运营 ⭐⭐⭐⭐⭐

### 4.1 赞助系统
```javascript
// sponsorship.js - 完整赞助体系
const SPONSORSHIP = {
  tiers: {
    platinum: {
      name: '战略合作伙伴',
      value: 1000, // 1000 万/年
      requirements: { fans: 500, ranking: '前 6' },
      benefits: ['主场广告', '队服 LOGO', '优先权益'],
    },
    gold: {
      name: '官方赞助商',
      value: 500,
      requirements: { fans: 300, ranking: '前 12' },
      benefits: ['场边广告', '社交媒体推广'],
    },
    silver: {
      name: '合作伙伴',
      value: 200,
      requirements: { fans: 150 },
      benefits: ['线上曝光', '周边合作'],
    },
    bronze: {
      name: '支持商',
      value: 100,
      requirements: { fans: 100 },
      benefits: ['基础品牌露出'],
    }
  },
  
  negotiation: {
    duration_options: [1, 2, 3, 4, 5], // 年限选项
    bonus_clauses: {
      playoff: '进入季后赛额外 +10%',
      championship: '夺冠额外 +25%',
    }
  }
};
```

### 4.2 粉丝经济
```javascript
// fan_economy.js - 粉丝运营模式
const FAN_ECONOMY = {
  fan_types: {
    casual: { percentage: 60, spending_power: 0.3 },
    loyal: { percentage: 30, spending_power: 1.0 },
    superfan: { percentage: 10, spending_power: 3.0 },
  },
  
  revenue_streams: {
    merchandise: {
      products: ['队服', '应援棒', '纪念品'],
      margin: 0.4, // 毛利率 40%
      peak_periods: ['夺冠后', '选手生日'],
    },
    ticket_sales: {
      avg_price: 200, // 平均票价 200 元
      capacity: 3000, // 主场容量 3000 人
      premium_price: 800, // VIP 票价 800 元
    },
    streaming_rights: {
      platform_deals: '与直播平台签约',
      revenue_share: 0.3, // 平台分成 30%
    },
    membership: {
      tier_fees: { basic: 50, vip: 200, svip: 500 },
      perks: ['专属内容', '线下活动优先权', '签名周边'],
    }
  },
  
  engagement_activities: {
    meet_and_greet: '粉丝见面会',
    online_streaming: '选手直播',
    social_media: '社交媒体运营',
    offline_events: '线下主题店活动',
  }
};
```

### 4.3 选手 IP 打造
```javascript
// player_ip.js - 选手 IP 运营
const PLAYER_IP = {
  channels: {
    streaming: {
      platforms: ['虎牙', '斗鱼', 'B 站'],
      revenue_share: 0.5, // 平台分成 50%
      requirements: '每周直播时长≥50 小时',
    },
    variety_shows: {
      type: '综艺节目',
      appearance_fee: '50-200 万/期',
      exposure_boost: 0.15, // 人气 +15%
    },
    endorsements: {
      categories: ['游戏外设', '饮料', '服装品牌'],
      contract_value: '100-1000 万/年',
      suitability: '需选手形象匹配',
    }
  },
  
  management: {
    pr_team: '公关团队',
    content_creation: '内容创作支持',
    brand_positioning: '个人品牌定位',
  }
};
```

---

## 五、AI 行为升级 ⭐⭐⭐⭐

### 5.1 俱乐部 AI 策略
```javascript
// ai_strategy.js - 智能俱乐部 AI
const AI_STRATEGIES = {
  build_types: {
    aggressive: {
      name: '激进扩张型',
      behavior: [
        '高价挖角顶星',
        '频繁更换教练',
        '忽视青训培养',
      ],
      financial_risk: 0.8, // 财务风险高
      success_rate: 0.4,   // 成功率低但上限高
    },
    balanced: {
      name: '均衡发展型',
      behavior: [
        '合理引援 + 青训',
        '稳定教练团队',
        '注重商业开发',
      ],
      financial_risk: 0.3,
      success_rate: 0.7,
    },
    conservative: {
      name: '保守稳健型',
      behavior: [
        '全靠青训晋升',
        '低价买断老将',
        '严格控制薪资',
      ],
      financial_risk: 0.1,
      success_rate: 0.5,
    }
  },
  
  decision_logic: {
    transfer_window: {
      analysis: ['评估阵容短板', '查看自由市场', '计算薪资空间'],
      priority_targets: ['首发位置', '替补深度', '特殊技能'],
      budget_allocation: '根据策略类型分配',
    },
    coaching: {
      hire_criteria: ['战术风格匹配', '执教成绩', '薪资要求'],
      firing_threshold: '连续 3 个月未达标',
    }
  }
};
```

### 5.2 选秀与青训系统
```javascript
// draft_academy.js - 选秀青训
const DRAFT_ACADEMY = {
  draft_rules: {
    eligibility: ['年满 17 周岁', '无合同纠纷', '通过体检'],
    order: '上赛季排名倒序',
    picks: {
      total_rounds: 3,
      picks_per_round: 5, // 每个位置选 1 人
    }
  },
  
  academy_system: {
    tiers: {
      u15: { name: 'U15 青训营', age_range: '13-15 岁', focus: '基础训练' },
      u17: { name: 'U17 梯队', age_range: '15-17 岁', focus: '战术意识' },
      u19: { name: 'U19 二队', age_range: '17-19 岁', focus: '实战经验' },
    },
    
    training_programs: {
      technical: '技术训练 (每天 +1 属性)',
      tactical: '战术理解 (每周提升)',
      mental: '心理建设 (减少失误)',
      physical: '身体素质 (耐力/反应)',
    },
    
    promotion_path: {
      criteria: ['训练评分≥85', '二队比赛表现', '教练推荐'],
      process: '试用期 1 个月 → 正式合同',
    }
  }
};
```

---

## 六、实施路线图

### Phase 1: 经济体系重构 (Week 1-2)
- [ ] 重写 CLUB_TEMPLATES 字段 (真实预算)
- [ ] 修改薪资计算公式 (年薪制结构)
- [ ] 更新转会费逻辑 (8000 万 + 竞价机制)
- [ ] 添加年份经济参数 (YEAR_ECONOMY)
- [ ] 测试验证所有数值平衡

### Phase 2: 赛制细节补全 (Week 3-4)
- [ ] 实现赛区制度 (2016-2020 东西部)
- [ ] 添加席位拍卖系统
- [ ] 完善合同引擎 (年限 + 违约金)
- [ ] 建立伤病管理系统
- [ ] 历史赛制存档兼容

### Phase 3: 团队管理升级 (Week 5-6)
- [ ] 构建完整教练团队配置
- [ ] 添加数据分析模块
- [ ] 建立医疗康复系统
- [ ] UI 适配新增管理页面
- [ ] 训练机制重新设计

### Phase 4: 商业化运营 (Week 7-8)
- [ ] 实现赞助系统多层级
- [ ] 建立粉丝经济模型
- [ ] 添加选手 IP 打造
- [ ] 商业收入计算
- [ ] 财务压力真实化

### Phase 5: AI 智能升级 (Week 9-10)
- [ ] 重写 AI 俱乐部决策
- [ ] 添加建队策略差异
- [ ] 优化转会行为逻辑
- [ ] 改进青训成长机制
- [ ] 长期财政规划

### Phase 6: 全面测试优化 (Week 11-12)
- [ ] 全量回归测试
- [ ] 蒙特卡洛平衡验证
- [ ] 用户体验测试
- [ ] 文档完善
- [ ] 性能优化

---

## 七、预期效果

### 对比当前版本 vs 重构后
| 维度 | 当前 | 重构后 | 提升幅度 |
|-----|------|--------|---------|
| **经济真实性** | ⭐⭐ | ⭐⭐⭐⭐⭐ | **+150%** |
| **赛制还原度** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **+67%** |
| **管理深度** | ⭐⭐ | ⭐⭐⭐⭐⭐ | **+150%** |
| **AI 智能** | ⭐⭐ | ⭐⭐⭐⭐ | **+100%** |
| **玩家体验** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **+25%** |
| **专业水准** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **+67%** |

### 最终目标
打造一个**真正的 KPL 职业电竞俱乐部模拟经营游戏**,让玩家能够:
- ✅ 感受到真实的俱乐部运营压力 (不是亿万富翁开局)
- ✅ 理解 KPL 赛制的复杂性和策略性
- ✅ 体验完整的商业开发和品牌建设
- ✅ 做出专业的战术和管理决策
- ✅ 在财务约束下建设可持续成功的俱乐部

---

## 八、技术要点

### 数据迁移兼容性
- 保留 `MIGRATIONS` 链支持旧存档
- 新增字段默认值处理
- 经济刻度转换工具函数

### 测试保障
- 单元测试覆盖率≥90%
- 平衡门禁 (蒙特卡洛 500 赛季)
- 回归测试保证不破坏既有功能

### 性能优化
- 复杂计算懒加载
- 数据结构优化
- 渲染性能监控

---

**备注**: 本方案基于真实 KPL 2016-2026 年赛事发展史和俱乐部运营模式设计，所有数值参考行业公开报道和行业标准。
