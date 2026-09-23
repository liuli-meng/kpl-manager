/* V2REF：设计参考实现，未接入 index.html / harness。
   生产经济唯一源是 data.js 的 ECON / wageOf / valueOf / CLUB_TEMPLATES。
   本文件顶层声明已包进 V2REF 命名空间，避免与 data.js/season.js 双源撞名。 */
var V2REF = (typeof V2REF !== 'undefined' && V2REF) || {};
(function (exports) {
/* ================= 真实 KPL 团队管理系统 v2.0 =================
   完整教练组、数据分析、康复医疗等专业化配置 */

// ================= 教练团队配置 =================
const COACHING_STAFF_SYSTEM = {
  positions: {
    head_coach: { // 主教练
      role: 'Head Coach',
      responsibility: [
        '制定整体战术体系',
        '临场指挥和 BP 决策',
        '选手选拔和首发阵容确定',
        '训练计划监督',
      ],
      influence_on_winrate: 0.35, // 对胜率影响权重 35%
      license_required: 'KPL 持证教练 (A 级)',
      typical_salary_range: [400, 600], // 年薪 400-600 万
    },
    
    assistant_coach: { // 助理教练
      role: 'Assistant Coach',
      responsibility: [
        '日常训练指导',
        '技术动作纠正',
        '协助战术演练',
      ],
      count_per_team: 2,
      influence_on_winrate: 0.15,
      license_required: 'B 级认证',
      typical_salary_range: [80, 150],
    },
    
    bp_coordinator: { // BP 教练
      role: 'BP Coordinator',
      responsibility: [
        'Ban/Pick策略制定',
        '对手英雄池分析',
        '版本强势解读',
        '储备英雄方案',
      ],
      influence_on_winrate: 0.20, // BP 占比赛胜负权重的 20%
      license_required: '专业 BP 认证',
      typical_salary_range: [100, 200],
    },
    
    mental_coach: { // 心理辅导师
      role: 'Mental Coach',
      responsibility: [
        '赛前心理建设',
        '压力管理和情绪调节',
        '逆风局心态调整',
        '团队凝聚力培养',
      ],
      influence_on_winrate: 0.10, // 关键时刻心态影响 10%
      license_required: '运动心理学硕士',
      typical_salary_range: [60, 120],
    },
    
    data_analyst: { // 数据分析师
      role: 'Data Analyst',
      responsibility: [
        '对手比赛录像分析',
        '自身数据复盘',
        '英雄选择数据挖掘',
        '战术有效性评估',
      ],
      influence_on_winrate: 0.12,
      license_required: '数据科学背景',
      typical_salary_range: [70, 150],
    },
    
    physical_trainer: { // 体能训练师
      role: 'Physical Trainer',
      responsibility: [
        '手速和反应力训练',
        '体能状态维持',
        '伤病预防指导',
        '作息管理监督',
      ],
      influence_on_winrate: 0.08,
      license_required: '康复治疗师资格',
      typical_salary_range: [40, 80],
    }
  },
  
  total_staff_cost: function(club) {
    let total = 0;
    const staff = club.coaching_staff || [];
    
    staff.forEach(member => {
      total += member.wage || 0;
    });
    
    return total;
  },
  
  hire_decision: function(club, position, candidate) {
    // AI 俱乐部 hiring 逻辑
    const budget = club.budget_for_hiring || 200;
    const needs = this.assess_needs(club, position);
    
    if(candidate.salary > budget * 1.2) {
      return {
        approved: false,
        reason: '薪资超出预算',
      };
    }
    
    if(candidate.license < needs.min_license) {
      return {
        approved: false,
        reason: '资质不足',
      };
    }
    
    const fit_score = this.calculate_fit_score(candidate, needs);
    
    if(fit_score >= 0.8) {
      logEvent(club.save, `✅ ${club.name}签下${candidate.name}担任${position}`);
      return { approved: true, fit_score };
    } else {
      return {
        approved: false,
        reason: '匹配度不足',
      };
    }
  },
  
  assess_needs: function(club, position) {
    // 评估俱乐部对该岗位的需求程度
    const current = club.coaching_staff.find(c => c.role === position);
    
    if(current) {
      return {
        min_license: current.license, // 已有人员水平
        urgency: 'low',
      };
    }
    
    // 根据成绩和需求判断
    const recent_winrate = club.recent_performance.winrate || 0.5;
    
    if(recent_winrate < 0.4 && position === 'head_coach') {
      return {
        min_license: 3, // A 级
        urgency: 'high',
      };
    }
    
    return {
      min_license: 2, // B 级
      urgency: 'medium',
    };
  },
  
  calculate_fit_score: function(candidate, needs) {
    let score = 0;
    
    // 资质达标
    if(candidate.license >= needs.min_license) score += 0.3;
    
    // 执教风格匹配
    if(candidate.style === club.tactic_style) score += 0.3;
    
    // 薪酬合理
    if(candidate.salary <= needs.budget) score += 0.2;
    
    // 历史战绩
    if(candidate.championships >= 2) score += 0.2;
    
    return score;
  },
};

// ================= 数据分析系统 =================
const DATA_ANALYSIS_SYSTEM = {
  capabilities: {
    opponent_scouting: {
      name: '对手侦查报告',
      time_required: 3, // 需要 3 天准备
      output: {
        hero_pools: '对手各位置英雄偏好',
        playstyle: '运营/团战/分推倾向',
        weak_points: '战术漏洞识别',
        key_players: '核心选手识别',
      },
      accuracy: 0.85, // 准确率 85%
      winrate_boost: 0.08, // 提升 8% 胜率
    },
    
    own_replay_review: {
      name: '比赛复盘分析',
      time_required: 1, // 赛后 1 天内完成
      output: {
        mistake_analysis: '失误点统计',
        decision_quality: '关键决策质量评估',
        improvement_areas: '需要改进的方向',
      },
      frequency: '每场比赛后',
      improvement_potential: 0.03, // 每周通过复盘提升 3% 潜力
    },
    
    meta_analysis: {
      name: '版本趋势预测',
      time_required: 1,
      output: {
        strong_heroes: '未来一周强势英雄',
        banned_trends: '必 ban 英雄预测',
        pick_order: '最佳Pick顺序',
      },
      relevance: 0.75, // BP 成功率 +15%
    },
    
    player_development: {
      name: '选手成长规划',
      time_required: 7, // 月度评估
      output: {
        strength_weakness: '优劣势分析',
        training_plan: '个性化训练方案',
        milestone_targets: '阶段性目标设定',
      },
      growth_boost: 0.05, // 训练效率 +5%
    }
  },
  
  run_opponent_scouting: function(team, opponent, days_before_match) {
    if(days_before_match < 3) {
      return {
        available: false,
        reason: '时间不足，需至少提前 3 天',
      };
    }
    
    const report = {
      opponent_name: opponent.name,
      hero_pools: this.analyze_hero_pools(opponent),
      playstyle: this.detect_playstyle(opponent),
      weak_points: this.find_weak_points(opponent),
      recommendations: this.generate_bp_recommendations(opponent),
    };
    
    team.analysis_reports.push({
      type: 'opponent_scouting',
      target: opponent.name,
      created_at: Date.now(),
      report: report,
    });
    
    logEvent(team.save, `📊 ${team.name}获得对手${opponent.name}的侦查报告`);
    
    return { available: true, report };
  },
  
  analyze_hero_pools: function(team) {
    const pools = {};
    team.roster.forEach(p => {
      if(p.starting) {
        const main_heros = p.hero_pool.filter(h => h.mastered_level >= 90);
        pools[p.pos] = main_heros.map(h => h.id);
      }
    });
    return pools;
  },
  
  detect_playstyle: function(team) {
    // 通过分析战队近期比赛决定打法倾向
    const matches = team.match_history.slice(-10);
    
    const avg_game_duration = matches.reduce((sum, m) => sum + m.duration, 0) / matches.length;
    const teamfight_count = matches.reduce((sum, m) => sum + m.teamfights, 0) / matches.length;
    const objective_control = matches.reduce((sum, m) => sum + m.objectives.controlled, 0) / matches.length;
    
    if(avg_game_duration < 25) {
      return '快攻型';
    } else if(teamfight_count > 25) {
      return '团战致胜';
    } else if(objective_control > 0.7) {
      return '运营拉扯';
    } else {
      return '均衡型';
    }
  },
  
  find_weak_points: function(team) {
    const weaknesses = [];
    
    team.roster.forEach(p => {
      if(p.overall < 85) {
        weaknesses.push({
          type: 'individual',
          player: p.name,
          issue: '个人能力不足',
          severity: 85 - p.overall,
        });
      }
    });
    
    // 英雄池单一问题
    const main_hero_count = team.roster.filter(p => 
      p.hero_pool.filter(h => h.mastered_level >= 95).length < 3
    ).length;
    
    if(main_hero_count >= 3) {
      weaknesses.push({
        type: 'systemic',
        issue: '英雄池过窄',
        severity: 0.7,
      });
    }
    
    return weaknesses;
  },
  
  generate_bp_recommendations: function(opponent) {
    const recs = [];
    
    // 针对对手招牌英雄建议 ban
    const enemy_bans = Object.keys(opponent.hero_pools).flatMap(pos => 
      opponent.hero_pools[pos].slice(0, 2)
    );
    
    recs.push({
      type: 'ban_priority',
      heroes: enemy_bans,
      reason: '对手使用率最高的英雄',
    });
    
    // 推荐 counter 英雄
    recs.push({
      type: 'pick_counter',
      heroes: this.select_good_counters(enemy_bans),
      reason: 'Counter 对手核心英雄',
    });
    
    return recs;
  },
  
  select_good_counters: function(enemy_heroes) {
    const counters = [];
    enemy_heroes.forEach(hero_id => {
      const hero = HEROES.find(h => h.id === hero_id);
      if(hero && hero.counters) {
        counters.push(...hero.counters.slice(0, 1));
      }
    });
    return [...new Set(counters)]; // 去重
  },
};

// ================= 康复医疗系统 =================
const MEDICAL_REHAB_SYSTEM = {
  staff: {
    team_doctor: {
      qualifications: ['执业医师资格证', '运动医学专业背景'],
      responsibilities: [
        '伤病诊断和分级',
        '治疗方案制定',
        '康复进度监控',
        '归队许可签发',
      ],
      salary: [120, 200], // 年薪 120-200 万
    },
    
    physiotherapist: {
      qualifications: ['康复治疗师执照', '运动康复专长'],
      responsibilities: [
        '物理治疗实施',
        '康复训练指导',
        '伤痛缓解处理',
      ],
      count: 2,
      salary: [60, 100],
    },
    
    massage_therapist: {
      qualifications: ['高级按摩师证'],
      responsibilities: [
        '肌肉放松',
        '筋膜释放',
        '赛前热身辅助',
      ],
      count: 2,
      salary: [40, 70],
    }
  },
  
  facilities: {
    rehab_center: {
      name: '职业康复中心',
      equipment: [
        '冷疗设备 ( Cryotherapy)',
        '电刺激治疗仪',
        '超声波治疗仪',
        '高压氧舱',
        '水疗池',
      ],
      daily_capacity: 10, // 每日可接待 10 人次
      maintenance_cost: 50, // 每月维护费 50 万
    },
    
    training_clinic: {
      name: '职业病预防诊所',
      focus: [
        '手腕劳损预防',
        '腰椎保护',
        '视力疲劳缓解',
      ],
      checkup_frequency: 'weekly', // 每周检查
    }
  },
  
  daily_care_routine: function(club) {
    const routines = [];
    
    // 健康检查
    routines.push({
      time: '08:00',
      activity: '晨间健康监测',
      staff: '队医',
      targets: '全体选手',
    });
    
    // 物理治疗
    routines.push({
      time: '14:00',
      activity: '针对性理疗',
      staff: '康复师',
      targets: '伤病/疲劳选手',
    });
    
    // 按摩放松
    routines.push({
      time: '18:00',
      activity: '肌肉放松按摩',
      staff: '按摩师',
      targets: '全员 (重点手部)',
    });
    
    club.daily_medical_log = routines;
  },
  
  injury_prevention_program: function(club) {
    const program = {
      name: '选手健康保障计划',
      components: [
        {
          name: ' ergonomics 优化',
          description: '调整座椅、键盘、鼠标符合人体工学',
          cost: 20,
          effectiveness: 0.3, // 降低 30% 职业病风险
        },
        {
          name: '定期运动培训',
          description: '专业体能教练指导拉伸和力量训练',
          cost: 30,
          effectiveness: 0.4,
        },
        {
          name: '心理健康筛查',
          description: '每月一次心理咨询',
          cost: 15,
          effectiveness: 0.2,
        },
      ],
      total_cost: 65,
      annual_effectiveness: 0.7, // 每年降低 70% 伤病率
    };
    
    club.injury_prevention = program;
  },
  
  treatment_protocol: function(player, injury_type) {
    const protocols = {
      acute_muscle_strain: {
        days_0_3: 'RICE 原则 (休息冰敷加压抬高)',
        days_4_7: '轻度活动和热敷',
        days_8_14: '力量恢复训练',
        day_15_plus: '逐步回归训练',
        medical_checkpoint: 7, // 第 7 天复查
      },
      
      chronic_wrist_injury: {
        days_0_14: '严格制动 + 药物消炎',
        days_15_30: '物理治疗 + 渐进负荷',
        days_31_60: '功能恢复训练',
        days_61_90: '模拟比赛强度',
        medical_checkpoint: 30,
      },
      
      overuse_fatigue: {
        days_0_3: '完全休息',
        days_4_7: '低强度活动',
        day_8_plus: '恢复正常训练',
        medical_checkpoint: 3,
      }
    };
    
    return protocols[injury_type] || protocols.overuse_fatigue;
  },
  
  return_to_play_assessment: function(player) {
    const assessment = {
      criteria: [
        { name: '无痛范围活动', required: true },
        { name: '力量恢复至伤前 90%', required: true },
        { name: '专项技能测试合格', required: true },
        { name: '队医评估通过', required: true },
      ],
      gradual_load_schedule: [
        { day: 1, load: 30, duration: '1 小时' },
        { day: 3, load: 50, duration: '2 小时' },
        { day: 5, load: 70, duration: '3 小时' },
        { day: 7, load: 90, duration: '4 小时' },
        { day: 10, load: 100, duration: 'full' },
      ],
      re_injury_risk: 0.15, // 复出后 15% 再伤风险
    };
    
    return assessment;
  },
};

// ================= UI 渲染组件 =================
function render_coaching_staff_panel(club) {
  const staff = club.coaching_staff || [];
  
  let html = `<div class="staff-panel"><h3>👔 教练团队</h3>`;
  
  staff.forEach(member => {
    html += `
      <div class="staff-card">
        <div class="staff-header">
          <span class="name">${member.name}</span>
          <span class="role">${get_position_name(member.role)}</span>
        </div>
        <div class="staff-details">
          <div>资质：${get_license_level(member.license)}</div>
          <div>工资：${member.wage}万/年</div>
          <div>风格：${STYLE_NAME[member.style]||'—'}</div>
          <div class="bonus">全队战力 +${member.bonus}%</div>
        </div>
      </div>
    `;
  });
  
  html += `
    <button class="btn" onclick="hireCoachingStaff()">+ 聘请教练</button>
    </div>
  `;
  
  return html;
}

function render_medical_status_panel(club) {
  const injured = club.roster.filter(p => p.injury);
  
  let html = `<div class="medical-panel"><h3>⚕️ 医疗康复</h3>`;
  
  if(injured.length === 0) {
    html += '<div class="status-ok">✅ 全员健康</div>';
  } else {
    injured.forEach(p => {
      const recovery_days = Math.ceil((p.injury.recovery_ends - Date.now()) / (24*60*60*1000));
      html += `
        <div class="injury-alert">
          <div class="player-name">${p.name}</div>
          <div class="injury-type">${p.injury.type}</div>
          <div class="recovery-timer">预计 ${recovery_days}天后归队</div>
          <div class="treatment-options">
            <button onclick="treatInjury('${p.id}', 'rest')">普通休息 (7 天/免费)</button>
            <button onclick="treatInjury('${p.id}', 'rehab')">康复治疗 (14 天/20 万)</button>
            <button onclick="treatInjury('${p.id}', 'advanced')">高级医疗 (21 天/50 万)</button>
          </div>
        </div>
      `;
    });
  }
  
  html += '</div>';
  return html;
}

function get_position_name(role) {
  const names = {
    'head_coach': '主教练',
    'assistant_coach': '助理教练',
    'bp_coordinator': 'BP 教练',
    'mental_coach': '心理辅导师',
    'data_analyst': '数据分析师',
    'physical_trainer': '体能训练师',
  };
  return names[role] || role;
}

function get_license_level(level) {
  const levels = {
    1: '实习',
    2: 'B 级认证',
    3: 'A 级持证',
    4: '传奇教头',
  };
  return levels[level] || '未知';
}

})(V2REF);
