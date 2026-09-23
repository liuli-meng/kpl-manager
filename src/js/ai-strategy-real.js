/* V2REF：设计参考实现，未接入 index.html / harness。
   生产经济唯一源是 data.js 的 ECON / wageOf / valueOf / CLUB_TEMPLATES。
   本文件顶层声明已包进 V2REF 命名空间，避免与 data.js/season.js 双源撞名。 */
var V2REF = (typeof V2REF !== 'undefined' && V2REF) || {};
(function (exports) {
/* ================= KPL AI 俱乐部行为引擎 v2.0 =================
   基于真实俱乐部运营策略，实现长期规划 + 战术需求导向的决策系统 */

// ================= AI 俱乐部建队策略 =================
const AI_BUILD_STRATEGIES = {
  aggressive_expansion: { // 激进扩张型
    name: '银河战舰',
    philosophy: '不惜一切代价追求即战力',
    transfer_behavior: {
      priority: ['明星选手', '老将补强', '青训忽略'],
      budget_allocation: 0.8, // 80% 预算用于引援
      bid_aggression: 1.3,   // 出价溢价 30%
      willing_to_breakeven: true, // 愿意接受财政赤字
    },
    roster_building: {
      target_average_age: 25,
      star_count_target: 4,   // 至少 4 个顶星
      academy_investment: 0.1, // 仅投资 10% 青训
    },
    coaching: {
      hire_standard: '冠军教头',
      firing_threshold: 0.2, // 胜率低于 20%就下课
    },
    financial_risk: 0.8, // 高风险
    success_probability: 0.4, // 成功率较低 (资源浪费)
    example_teams: ['QGhappy(2017)', '成都 AG 超玩会 (2025)'],
  },
  
  balanced_growth: { // 均衡发展型
    name: '稳健建设',
    philosophy: '平衡引援+青训，可持续发展',
    transfer_behavior: {
      priority: ['位置补强', '潜力新人', '性价比老将'],
      budget_allocation: 0.5,
      bid_aggression: 1.0, // 理性出价
      willing_to_breakeven: false,
    },
    roster_building: {
      target_average_age: 24,
      star_count_target: 2,
      academy_investment: 0.4, // 40% 资源投入青训
    },
    coaching: {
      hire_standard: '优秀教练',
      firing_threshold: 0.35,
    },
    financial_risk: 0.3,
    success_probability: 0.7,
    example_teams: ['武汉 eStarPro(2022)', '重庆狼队 (2023-2024)'],
  },
  
  conservative_produce: { // 保守产出型
    name: '青训王朝',
    philosophy: '全靠自家青训，零外购',
    transfer_behavior: {
      priority: ['免费签老将', '低价捡漏', '拒绝竞价'],
      budget_allocation: 0.1,
      bid_aggression: 0.7, // 压价购买
      willing_to_breakeven: false,
    },
    roster_building: {
      target_average_age: 22,
      star_count_target: 1,
      academy_investment: 0.8, // 80% 资源青训
    },
    coaching: {
      hire_standard: '擅长培养的新手教练',
      firing_threshold: 0.5, // 容忍度高
    },
    financial_risk: 0.1,
    success_probability: 0.5, // 周期长但上限也高
    example_teams: ['AS 仙阁 (2016 黑八奇迹)'],
  },
  
  tactical_specialist: { // 战术专家型
    name: '体系之师',
    philosophy: '特定战术体系 > 明星堆砌',
    transfer_behavior: {
      priority: ['战术适配性', '角色球员', '风格匹配'],
      budget_allocation: 0.4,
      bid_aggression: 0.9,
      willing_to_breakeven: false,
    },
    roster_building: {
      target_average_age: 23.5,
      star_count_target: 2,
      specialty_focus: true, // 强调特色 (如：运营队/团战队)
    },
    coaching: {
      hire_standard: '战术大师',
      style_match: true, // 必须与战术理念契合
    },
    financial_risk: 0.25,
    success_probability: 0.65,
    example_teams: ['Hero 久竞 (2018)', '佛山 DRG.GK(2021)'],
  }
};

// ================= AI 转会决策引擎 =================
const AI_TRANSFER_AI = {
  // 转会期决策主逻辑
  evaluate_transfer_window: function(club, year) {
    const strategy = this.get_strategy_for_club(club);
    const budget = this.available_budget(club, year);
    
    // 1. 阵容评估
    const weaknesses = this.analyze_weaknesses(club.roster);
    const strengths = this.analyze_strengths(club.roster);
    
    // 2. 目标定位
    const targets = this.identify_targets(weaknesses, budget, strategy);
    
    // 3. 执行谈判
    const actions = [];
    for(const target of targets) {
      const offer = this.make_offer(club, target, budget, strategy);
      actions.push(offer);
    }
    
    return actions;
  },
  
  get_strategy_for_club: function(club) {
    // 根据俱乐部历史成绩和资金实力分配策略类型
    const championships = club.championships || 0;
    const fund = club.fund;
    
    if(championships >= 5 || fund > 12000) {
      return AI_BUILD_STRATEGIES.aggressive_expansion;
    } else if(fund > 6000) {
      return AI_BUILD_STRATEGIES.balanced_growth;
    } else if(fund < 4000) {
      return AI_BUILD_STRATEGIES.conservative_produce;
    } else {
      return AI_BUILD_STRATEGIES.tactical_specialist;
    }
  },
  
  available_budget: function(club, year) {
    // 计算可用转会预算
    const annual_budget = club.annual_budget || 15000;
    const current_spend = club.transfers_made_this_year || 0;
    const wage_overhead = this.calculate_wage_overhead(club);
    
    // 保留部分预算应对紧急情况
    const reserve_ratio = 0.2;
    
    return Math.round((annual_budget - current_spend - wage_overhead) * (1 - reserve_ratio));
  },
  
  analyze_weaknesses: function(roster) {
    const positions = ['top', 'jg', 'mid', 'ad', 'sup'];
    const weaknesses = [];
    
    positions.forEach(pos => {
      const player = roster.find(p => p.pos === pos && p.starting);
      if(player) {
        if(player.overall < 85) {
          weaknesses.push({
            position: pos,
            severity: 85 - player.overall,
            current_rating: player.overall,
            priority: pos === 'jg' ? 'high' : 'medium', // 打野更稀缺
          });
        }
      } else {
        weaknesses.push({
          position: pos,
          severity: 100,
          current_rating: 0,
          priority: 'critical',
        });
      }
    });
    
    return weaknesses.sort((a, b) => b.severity - a.severity);
  },
  
  identify_targets: function(weaknesses, budget, strategy) {
    const targets = [];
    
    weaknesses.forEach(w => {
      if(budget <= 0) return;
      
      // 寻找自由市场上的合适目标
      const free_agents = FREE_AGENTS.filter(fa => 
        fa.pos === w.position && 
        fa.willingness > 40 // 只考虑有意离队的
      );
      
      // 按评分排序
      free_agents.sort((a, b) => b.overall - a.overall);
      
      // 选择目标 (策略影响选择)
      let selected;
      if(strategy === AI_BUILD_STRATEGIES.aggressive_expansion) {
        // 选最强的，不管价格
        selected = free_agents[0];
      } else if(strategy === AI_BUILD_STRATEGIES.conservative_produce) {
        // 选性价比高的 (便宜但有潜力的)
        selected = free_agents.filter(fa => fa.value < 1000)[0] || free_agents[0];
      } else {
        // 均衡选择
        const mid_idx = Math.floor(free_agents.length / 2);
        selected = free_agents[mid_idx];
      }
      
      if(selected && selected.value <= budget * 0.6) { // 单人不花超过 60% 预算
        targets.push({
          player: selected,
          estimated_cost: selected.value,
          fit_score: this.calculate_fit_score(selected, w),
        });
        
        budget -= selected.value;
      }
    });
    
    return targets;
  },
  
  calculate_fit_score: function(player, weakness) {
    // 计算选手对填补空白的适配度
    const rating_improvement = player.overall - weakness.current_rating;
    const position_match = 1.0;
    const strategy_bonus = player.age <= 22 ? 0.1 : 0; // 年轻选手适合长期规划
    
    return rating_improvement * position_match * strategy_bonus;
  },
  
  make_offer: function(club, target, budget, strategy) {
    const base_value = target.player.value;
    
    // 根据策略调整出价
    let offer_multiplier;
    if(strategy === AI_BUILD_STRATEGIES.aggressive_expansion) {
      offer_multiplier = 1.2; // 溢价 20% 确保拿下
    } else if(strategy === AI_BUILD_STRATEGIES.conservative_produce) {
      offer_multiplier = 0.8; // 压价 20%
    } else {
      offer_multiplier = 1.0; // 理性出价
    }
    
    const offer = {
      player_id: target.player.id,
      fee: Math.round(base_value * offer_multiplier),
      wage: target.player.desired_wage || PLAYER_SALARY_REAL.calculate_wage(target.player.overall, target.player.age),
      years: this.get_contract_years(target.player, strategy),
    };
    
    return offer;
  },
  
  get_contract_years: function(player, strategy) {
    if(strategy === AI_BUILD_STRATEGIES.aggressive_expansion) {
      return Math.min(5, player.age <= 22 ? 4 : 3); // 年轻人给长约
    } else if(strategy === AI_BUILD_STRATEGIES.conservative_produce) {
      return 2; // 短约试探
    } else {
      return player.age <= 23 ? 3 : 2;
    }
  },
};

// ================= AI 赛季中期管理 =================
const AI_SEASON_MANAGEMENT = {
  // 每月例行决策
  monthly_decision: function(club, month, year) {
    const decisions = [];
    
    // 1. 青训提拔检查
    if(month === 3 || month === 9) { // 每季度检查一次
      const promotion_candidates = this.evaluate_academy_promotions(club);
      decisions.push(...promotion_candidates);
    }
    
    // 2. 伤病治疗决策
    const injured = club.roster.filter(p => p.injury);
    if(injured.length > 0) {
      decisions.push(this.decide_treatment(club, injured));
    }
    
    // 3. 战术调整
    if(club.recent_performance.streak < -2) { // 连败 3 场以上
      decisions.push({ type: 'tactic_change', new_tactic: 'conservative' });
    }
    
    // 4. 替补深度不足时租借应急
    const bench_depth = club.roster.filter(p => !p.starting && p.energy > 80).length;
    if(bench_depth < 2 && injured.length > 1) {
      decisions.push({ type: 'emergency_loan', candidates: this.find_loan_candidates(club) });
    }
    
    return decisions;
  },
  
  evaluate_academy_promotions: function(club) {
    const academy_roster = club.academy || [];
    const promotions = [];
    
    academy_roster.forEach(player => {
      // 青训评分达到标准可提拔
      if(player.training_score >= 85 && player.overall >= 80) {
        // 检查是否有空缺位置
        const needs_position = club.needs_position();
        if(needs_position) {
          promotions.push({
            type: 'promote',
            player_id: player.id,
            training_days: player.days_in_academy,
          });
        }
      }
    });
    
    return promotions;
  },
  
  decide_treatment: function(club, injured_players) {
    // 根据财政实力和球员重要性决定治疗方案
    const serious_injuries = injured_players.filter(p => p.injury.severity >= 4);
    
    if(serious_injuries.length > 0) {
      // 核心球员受伤，用高级医疗
      const star_player = serious_injuries.find(p => p.overall >= 90);
      if(star_player && club.fund >= 100) {
        return {
          type: 'advanced_medical',
          player_id: star_player.id,
          cost: 100,
          description: `为 ${star_player.name}安排实验性康复治疗`,
        };
      } else {
        return {
          type: 'standard_rehab',
          players: injured_players.map(p => p.id),
          cost: 20 * injured_players.length,
        };
      }
    }
    
    return null;
  },
  
  find_loan_candidates: function(club) {
    // 寻找适合外租培养的替补
    return club.roster.filter(p => 
      !p.starting && 
      p.contract > 2 && // 合同较长，外租不影响
      p.age <= 23       // 年轻选手
    );
  },
};

// ================= AI 财务管理 =================
const AI_FINANCIAL_AI = {
  quarterly_review: function(club, quarter, year) {
    const report = {
      revenue: this.calculate_revenue(club),
      expenses: this.calculate_expenses(club),
      surplus_deficit: 0,
      recommendations: [],
    };
    
    report.surplus_deficit = report.revenue - report.expenses;
    
    // 财务健康度评估
    if(report.surplus_deficit < -500) {
      report.recommendations.push({
        action: 'cost_cutting',
        areas: ['非紧急转会', '商业活动缩减'],
        expected_savings: 200,
      });
    }
    
    if(report.revenue < report.expenses * 0.8) {
      report.recommendations.push({
        action: 'revenue_boost',
        areas: ['增加赞助洽谈', '举办粉丝活动'],
      });
    }
    
    return report;
  },
  
  calculate_revenue: function(club) {
    return (
      (club.sponsorship_income || 0) +
      (club.merchandise_sales || 0) +
      (club.ticket_sales || 0) +
      (club.prize_money || 0) +
      (club.endorsements || 0)
    );
  },
  
  calculate_expenses: function(club) {
    return (
      (club.player_salaries || 0) +
      (club.coaching_staff || 0) +
      (club.academy_maintenance || 0) +
      (club.medical_staff || 0) +
      (club.facilities || 0) +
      (club.travel || 0)
    );
  },
};

// ================= AI 比赛策略 =================
const AI_BATTLE_STRATEGY = {
  // BP 阶段决策
  bp_decision: function(team, phase, ban_pick_context) {
    const tactic_style = team.tactic_style || 'balanced';
    
    switch(phase) {
      case 'first_ban':
        return this.first_ban_phase(team, ban_pick_context);
      
      case 'first_pick':
        return this.first_pick_phase(team, ban_pick_context);
      
      case 'second_ban':
        return this.second_ban_phase(team, ban_pick_context);
      
      case 'second_pick':
        return this.second_pick_phase(team, ban_pick_context);
      
      case 'overdraft':
        return this.overdraft_phase(team, ban_pick_context);
      
      default:
        return null;
    }
  },
  
  first_ban_phase: function(team, context) {
    // 针对对手强势英雄 ban 掉
    const enemy_picks = context.enemy_side.picks;
    const meta_strong = context.meta_pool.filter(h => h.win_rate > 0.55);
    
    // Ban 策略优先级：版本强势 > 对手招牌 > 自身克制
    if(enemy_picks.length > 0) {
      // 针对对手已选
      return this.select_counter_ban(enemy_picks[0]);
    } else {
      // Ban 版本最强
      return meta_strong[0].id;
    }
  },
  
  first_pick_phase: function(team, context) {
    const hero_pool = team.hero_pool;
    
    // 优先选择体系英雄 (能带动节奏的)
    const system_heroes = hero_pool.filter(h => h.type === 'system');
    if(system_heroes.length > 0) {
      return system_heroes[0].id;
    }
    
    // 否则 pick 版本强势
    return context.meta_pool[0].id;
  },
  
  second_ban_phase: function(team, context) {
    // 保护己方核心英雄池
    const our_picks = context.our_side.picks;
    const key_heroes = our_picks.filter(h => h.is_key_hero);
    
    if(key_heroes.length > 0) {
      // ban 掉对面可能 counter 我们核心的
      const counters = key_heroes[0].counters;
      return counters[0];
    }
    
    // 继续 ban 版本强势
    return context.meta_pool[1].id;
  },
  
  second_pick_phase: function(team, context) {
    // Counter 对面最后一选
    const enemy_last_pick = context.enemy_side.picks[context.enemy_side.picks.length - 1];
    return this.select_best_counter(enemy_last_pick);
  },
  
  overdraft_phase: function(team, context) {
    // 巅峰对决盲选，选信心最高的
    const confidence_scores = team.hero_pool.map(h => ({
      id: h.id,
      confidence: h.mastered_level * 0.6 + context.last_series_result * 0.4,
    }));
    
    confidence_scores.sort((a, b) => b.confidence - a.confidence);
    return confidence_scores[0].id;
  },
  
  select_counter_ban: function(hero_id) {
    const hero = HEROES.find(h => h.id === hero_id);
    return hero.counters[0];
  },
  
  select_best_counter: function(enemy_hero_id) {
    const enemy_hero = HEROES.find(h => h.id === enemy_hero_id);
    const counters = enemy_hero.counters;
    
    // 在己方英雄池中找最能 counter 的
    const our_counters = this.team_hero_pool.filter(h => 
      counters.includes(h.id) && h.mastered_level >= 90
    );
    
    if(our_counters.length > 0) {
      return our_counters.sort((a, b) => b.mastered_level - a.mastered_level)[0].id;
    }
    
    // 没有完美 counter，选版本强势
    return META_POOL[0].id;
  },
};

// ================= 工具函数 =================
function logEvent(save, text) {
  (save.eventLog = save.eventLog || []).unshift({
    txt: text,
    t: Date.now(),
    level: text.indexOf('⚠️') >= 0 ? 'lose' : 'info',
  });
  save.eventLog = save.eventLog.slice(0, 200);
}

})(V2REF);
