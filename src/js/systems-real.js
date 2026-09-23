/* V2REF：设计参考实现，未接入 index.html / harness。
   生产经济唯一源是 data.js 的 ECON / wageOf / valueOf / CLUB_TEMPLATES。
   本文件顶层声明已包进 V2REF 命名空间，避免与 data.js/season.js 双源撞名。 */
var V2REF = (typeof V2REF !== 'undefined' && V2REF) || {};
(function (exports) {
/* ================= 真实 KPL 赛制系统 v2.0 =================
   还原 KPL 2016-2026 完整历史赛制演变 */

// ================= 赛区制度 (随年份变化) =================
const DIVISION_SYSTEM = {
  // 2016-2020: 东西部赛区
  east_west_division: {
    years: [2016, 2017, 2018, 2019, 2020],
    format: '常规赛东西部分组 + 季后赛合并',
    rules: {
      regular_season: '同分区内 BO5 双循环，跨分区 BO5 单循环',
      playoff_qualification: '东西部各前四名晋级季后赛',
      playoff_format: '10 队 BO7 双败淘汰',
      cross_division_matches: 2, // 每年 2 场跨分区交流赛
    },
    typical_teams: {
      east: ['成都 AG 超玩会', '武汉 eStarPro', 'AS 仙阁', 'QGhappy', 'XQ'],
      west: ['重庆狼队', '南京 Hero 久竞', '济南 RW 侠', '广州 TTG', '深圳 DYG'],
    }
  },
  
  // 2021-2024: 大分组时代 (取消升降级)
  large_groups: {
    years: [2021, 2022, 2023, 2024],
    format: 'S/A/B三组 + 卡位赛',
    rules: {
      promotion_relegation: false, // 取消升降级
      group_structure: '蛇形分档 (按上赛季成绩)',
      phases: ['第一轮 (3 组单循环)', '第二轮 (S/A/B)', '卡位赛', '第三轮 (S/A)'],
      playoff_qualification: 'S 组前 4+A 组前 4+卡位赛冠军',
    }
  },
  
  // 2025-2026: 最新赛制
  current_format: {
    years: [2025, 2026],
    teams: 18,
    splits: ['春季赛', '夏季赛'],
    structure: '两轮循环赛 + 季后赛',
    rules: {
      spring_summer: '春夏两赛季独立积分',
      annual_finals_qualification: '年度积分前 12 入围年总',
      playoff_format: 'BO7 双败淘汰 + 巅峰对决',
    }
  }
};

// ================= 席位数拍卖制度 =================
const SEAT_AUCTION = {
  base_fee: 10000,           // 基础席位费：1 亿元 (2020 后)
  annual_maintenance: 2000,  // 年度维护费：2000 万
  
  auction_process: {
    eligibility_requirements: [
      '资金实力证明 (至少 3 亿流动资金)',
      '主场城市承诺 (提供场馆或场地租赁计划)',
      '青训建设计划 (U15/U17梯队建设)',
      '商业开发能力证明',
    ],
    bidding_stages: [
      '资格预审 → 报价提交 → 多轮竞价 → 最终确认',
    ],
    minimum_bid_increment: 500, // 每次加价至少 500 万
    max_rounds: 5,              // 最多 5 轮竞价
  },
  
  expulsion_rules: {
    conditions: [
      '连续 2 个赛季未进季后赛',
      '严重违反联盟规定 (如假赛)',
      '财务无法持续运营 (欠薪超过 3 个月)',
      '主场设施不达标且拒不整改',
    ],
    appeal_period: 30, // 申诉期 30 天
  },
  
  relocation: {
    fee: 3000,         // 迁移费：3000 万
    restrictions: [
      '每个城市每年最多新增 1 支战队',
      '需获得原俱乐部和联盟双方同意',
    ]
  }
};

// ================= 完整合同系统 =================
const CONTRACT_ENGINE = {
  duration_limits: {
    min_years: 1,
    max_years: 5,
    typical_duration: {
      rookie: 2,        // 新人通常签 2 年
      star_player: 3,   // 明星选手 3 年
      veteran: 4,       // 老将 4 年
      special_case: 5,  // 顶星可签 5 年长约
    }
  },
  
  salary_struct: {
    base_salary: { // 基本工资
      calculation: '按月发放，年薪制',
      tax_rate: 0.2, // 个人所得税 20%
    },
    bonus_structure: {
      match_bonus: '每场比赛 1-5 万',
      win_bonus: '胜利额外 +2 万/场',
      playoff_bonus: '进季后赛 50 万起',
      championship: '夺冠 200-500 万',
    },
    prize_share: { // 奖金分成 (符合 KPL 官方规则)
      club_share: 0.3,  // 俱乐部拿 30%
      player_share: 0.7, // 选手拿 70%
      description: '联盟规定选手奖金分成不得低于 70%',
    },
    endorsement_split: { // 代言分成
      default_ratio: [0.3, 0.7], // 俱乐部 30%/选手 70%
      negotiated: '可与选手协商调整',
    }
  },
  
  contract_clauses: {
    buyout_clause: {
      enabled: true,
      formula: function(player) {
        // 违约金 = 剩余年限 × 年薪 × 系数
        const remaining_years = player.contract;
        const annual_wage = player.wage;
        const multiplier = 1.5; // 标准系数 1.5
        
        return Math.round(remaining_years * annual_wage * multiplier);
      },
      negotiation_window: '最后 1 年可协商降低至 1.0 倍',
    },
    
    option_year: {
      club_option: true,      // 俱乐部有选择权续约 1 年
      player_option: false,   // 选手无强制选择权
      trigger_deadline: '赛季结束后 30 天内通知',
      exercise_wage_increase: 0.15, // 执行选项时涨薪 15%
    },
    
    release_clause: {
      historical: '2017-2019 年间存在',
      current_status: false, // 现 KPL 已取消解约金条款
    }
  },
  
  renewal_process: {
    notice_requirement: {
      window_start: '合同到期前 90 天',
      window_end: '合同到期前 30 天',
    },
    negotiation_rules: {
      max_rounds: 5,
      break_threshold: 3, // 谈崩 3 次自动终止
      cooling_off: 7,     // 每次谈判间隔至少 7 天
    },
    free_agency: {
      trigger: '合同到期未续约',
      restrictions: '受保护球员不能成为自由人',
    }
  },
  
  // 薪资谈判逻辑
  negotiate_contract: function(player, offer, year) {
    const base_wage = player.base_wage || PLAYER_SALARY_REAL.calculate_wage(player.overall, player.age, player.popularity);
    
    // 考虑玩家出价合理性
    if(offer.wage < base_wage * 0.7) {
      return {
        accepted: false,
        reason: '报价过低，选手拒绝',
        counter_offer: Math.round(base_wage * 0.9),
      };
    }
    
    // 考虑选手意愿度
    const will_factor = (player.willingness || 50) / 100;
    const accept_prob = 0.3 + will_factor * 0.5 + (offer.wage - base_wage) / base_wage * 0.3;
    
    if(Math.random() < accept_prob) {
      // 接受报价
      const final_wage = Math.min(offer.wage, PLAYER_SALARY_REAL.top_salary_by_rating.ovr_95_plus);
      
      // 检查工资帽
      const team_wage = calculate_team_wage(this.save);
      if(team_wage + final_wage > this.save.wageCap) {
        return {
          accepted: false,
          reason: '超出工资帽预算',
        };
      }
      
      player.wage = final_wage;
      player.contract = offer.years;
      player.willingness = Math.min(100, player.willingness + 10);
      
      logEvent(this.save, `续约成功：${player.name} 签下 ${offer.years}年合同，年薪${final_wage}万`);
      
      return { accepted: true, final_wage };
    } else {
      // 拒绝并反报价
      const counter = Math.round(base_wage * 1.2);
      return {
        accepted: false,
        reason: '等待更高报价',
        counter_offer: counter,
      };
    }
  }
};

// ================= 伤病管理系统 =================
const INJURY_SYSTEM = {
  injury_types: {
    acute: {
      name: '急性肌肉拉伤',
      recovery_days_min: 7,
      recovery_days_max: 14,
      severity: 2, // 1-5 级
      recurrence_chance: 0.1,
    },
    chronic: {
      name: '慢性手腕劳损',
      recovery_days_min: 30,
      recovery_days_max: 90,
      severity: 4,
      flare_up_chance: 0.3, // 复发概率 30%
      permanent_damage: 0.05, // 5% 永久属性下降
    },
    overuse: {
      name: '过度使用疲劳',
      recovery_days_min: 3,
      recovery_days_max: 7,
      severity: 1,
      prevention: '合理轮换',
    },
    severe: {
      name: '严重伤病 (十字韧带等)',
      recovery_days_min: 180,
      recovery_days_max: 365,
      severity: 5,
      career_threatening: true,
    }
  },
  
  diagnosis_process: {
    medical_staff_required: true,
    confirmation_time: 1, // 确诊需要 1 天
    severity_assessment: function(player) {
      // 根据比赛表现和身体状态评估伤病风险
      const fatigue = 1 - (player.energy || 100) / 100;
      const recent_performance = player.last_n_games_avg || 100;
      
      let risk = fatigue * 0.4 + (1 - recent_performance/100) * 0.6;
      return Math.min(5, Math.ceil(risk * 5));
    }
  },
  
  treatment_options: {
    rest: {
      days: 7,
      effectiveness: 0.6,
      cost: 0,
    },
    rehabilitation: {
      days: 14,
      effectiveness: 0.8,
      cost: 20, // 康复训练 20 万
    },
    advanced_medical: {
      days: 21,
      effectiveness: 0.9,
      cost: 50, // 高级医疗 50 万
    },
    experimental: {
      days: 30,
      effectiveness: 0.95,
      cost: 100, // 实验性治疗 100 万
      risk: 0.1, // 10% 失败风险
    }
  },
  
  return_to_play: {
    fitness_test_required: true,
    gradual_load_schedule: [
      { day: 1, load: 0.3 },   // 30% 负荷
      { day: 3, load: 0.6 },   // 60% 负荷
      { day: 5, load: 0.8 },   // 80% 负荷
      { day: 7, load: 1.0 },   // 100% 负荷
    ],
    re_injury_risk: 0.15, // 复出后 15% 再次受伤风险
  },
  
  // 伤病判定和恢复
  check_injury: function(player) {
    const fatigue = 1 - (player.energy || 100) / 100;
    const heavy_schedule = this.is_heavy_schedule(this.save);
    
    const injury_chance = fatigue * 0.3 + (heavy_schedule ? 0.2 : 0.1);
    
    if(Math.random() < injury_chance) {
      const type_keys = Object.keys(this.injury_types);
      const type = this.injury_types[type_keys[Math.floor(Math.random() * type_keys.length)]];
      
      player.injury = {
        type: type.name,
        severity: type.severity,
        recovery_ends: Date.now() + type.recovery_days_min * 24*60*60*1000,
      };
      
      logEvent(this.save, `⚠️ 伤病警报：${player.name} 遭遇${type.name},预计休养${type.recovery_days_min}-${type.recovery_days_max}天!`);
      
      return true;
    }
    
    return false;
  },
  
  is_heavy_schedule: function(save) {
    // 密集赛程增加伤病风险
    const games_this_month = save.matchLog.filter(m => m.date >= save.currentMonth).length;
    return games_this_month > 15;
  },
  
  treat_injury: function(player, treatment_type) {
    const treatment = this.treatment_options[treatment_type];
    
    if(!treatment) return { success: false, reason: '无效治疗方案' };
    
    // 扣除医疗费用
    if(this.save.fund < treatment.cost) {
      return { success: false, reason: '医疗预算不足' };
    }
    
    this.save.fund -= treatment.cost;
    
    // 计算恢复进度
    const recovery_progress = (Date.now() - player.injury.start_date) / 
                              (treatment.days * 24*60*60*1000);
    
    if(recovery_progress >= 1) {
      const success_chance = treatment.effectiveness * (1 - player.injury.severity * 0.1);
      
      if(Math.random() < success_chance) {
        player.injury = null;
        logEvent(this.save, `✅ ${player.name} 康复归队!`);
        return { success: true };
      } else {
        // 治疗失败，延长恢复期
        player.injury.recovery_ends += treatment.days * 24*60*60*1000;
        return { success: false, reason: '治疗效果不佳' };
      }
    }
    
    return { success: false, reason: '恢复期未满' };
  }
};

// ================= 赛季初始化 (带年份赛制) =================
function init_season_with_system(save) {
  const year = gameYear(save);
  const div_system = this.get_division_system_for_year(year);
  
  save.divisionSystem = div_system.format;
  save.rules = JSON.parse(JSON.stringify(div_system.rules));
  
  // 初始化当年的经济参数
  save.economy = YEAR_ECONOMY[year] || YEAR_ECONOMY[2026];
  
  // 更新工资帽 (随年份增长)
  const economy_param = YEAR_ECONOMY[year];
  if(economy_param) {
    save.wageCap = Math.round(save.wageCap * (1 + economy_param.inflation));
  }
  
  logEvent(save, `📅 ${year}赛季开启 - 启用${div_system.format}赛制`);
  
  return save;
}

function get_division_system_for_year(year) {
  if(DIVISION_SYSTEM.east_west_division.years.includes(year)) {
    return DIVISION_SYSTEM.east_west_division;
  } else if(DIVISION_SYSTEM.large_groups.years.includes(year)) {
    return DIVISION_SYSTEM.large_groups;
  } else {
    return DIVISION_SYSTEM.current_format;
  }
}

})(V2REF);
