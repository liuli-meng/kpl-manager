// 门禁：真实 KPL 保真度验证（席位架构、2026 权威名录覆盖、临时席真实轮换与持久化）
const vm = require('vm');
const { makeDom, makeTester } = require('./harness');
const { dom } = makeDom();
const T = makeTester('KPL 复刻保真度门禁');

const q = (code) => vm.runInContext(code, dom);

// ① 席位结构：真实 KPL = 16 固定席 + 2 临时席
const fixed = q('FIXED_SEAT_TEAMS');
const temp = q('TEMP_SEAT_TEAMS');
const aiTeams = q('AI_TEAMS.map(t=>t.name)');

T.check(Array.isArray(fixed) && fixed.length === 16, '固定席必须为 16 支：实为 ' + (fixed ? fixed.length : 0));
T.check(q('TEMP_SEAT_COUNT') === 2, '临时席必须为 2 席');
T.check(Array.isArray(temp) && temp.length === 2, '初始临时席必须为 2 支');

// AI_TEAMS 与固定席的差集，必须恰等于临时席两支
const nonFixed = aiTeams.filter(n => !fixed.includes(n));
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
T.check(sameSet(nonFixed, temp), 'AI_TEAMS 与固定席的差集必须恰为临时席：nonFixed=' + nonFixed.join(',') + ' temp=' + temp.join(','));

// ② 2026 档必须覆盖全部固定席 + 全部临时席，且不含名录外队（不得缺 DYG/TES.A，不得含 sViper）
const y26 = q('teamsAtYear(2026)');
const missingFixed = fixed.filter(n => !y26.includes(n));
const missingTemp = temp.filter(n => !y26.includes(n));
const extraTeams = y26.filter(n => !fixed.includes(n) && !temp.includes(n));

T.check(missingFixed.length === 0, '2026 档缺固定席：' + missingFixed.join(','));
T.check(missingTemp.length === 0, '2026 档缺临时席：' + missingTemp.join(','));
T.check(extraTeams.length === 0, '2026 档含非席位队（如历史遗留 sViper）：' + extraTeams.join(','));
T.check(y26.length === 18, '2026 档必须恰好 18 支队伍：实为 ' + y26.length);

// ③ 席位轮换必须真写回联盟（AI_TEAMS / AI_ROSTERS / s.leagueTeams）
const rotTest = q(`(function(){
  const s = newState('席位轮换测试队', '⚔️');
  initGroups(s);
  s.season = 1;
  // 设置常山UUG年度积分为最低
  s.annualPts = { '常山UUG': 10, '桐乡情久': 50 };
  const prevSeats = s.tempSeats ? s.tempSeats.slice() : ['常山UUG','桐乡情久'];
  s.tempSeats = prevSeats.slice();
  
  settleTempSeats(s);
  
  const worst = '常山UUG';
  const incoming = (s.tempSeats || []).find(t => !prevSeats.includes(t));
  const hasIncomingInLeague = (s.leagueTeams || []).includes(incoming);
  const hasIncomingInAI = AI_TEAMS.some(t => t.name === incoming);
  const hasIncomingRoster = !!AI_ROSTERS[incoming];
  const hasWorstInLeague = (s.leagueTeams || []).includes(worst);
  const hasWorstInAI = AI_TEAMS.some(t => t.name === worst);

  return {
    worst,
    incoming,
    hasIncomingInLeague,
    hasIncomingInAI,
    hasIncomingRoster,
    hasWorstInLeague,
    hasWorstInAI,
    log1: s.tempSeatLog && s.tempSeatLog[0]
  };
})()`);

T.check(rotTest.incoming != null, '临时席轮换必须选出新升班马顶上');
T.check(rotTest.hasIncomingInLeague === true, '新升班马必须写入 s.leagueTeams 联盟名单');
T.check(rotTest.hasIncomingInAI === true, '新升班马必须写入 AI_TEAMS 战队名录');
T.check(rotTest.hasIncomingRoster === true, '新升班马必须在 AI_ROSTERS 生成阵容');
T.check(rotTest.hasWorstInLeague === false, '被收回席位战队必须从 s.leagueTeams 移出');
T.check(rotTest.hasWorstInAI === false, '被收回席位战队必须从 AI_TEAMS 移出');

// ④ 轮换状态必须持久（不得年年重置回常量）
const persistTest = q(`(function(){
  const s = newState('席位持久测试队', '⚔️');
  initGroups(s);
  s.season = 1;
  s.annualPts = { '常山UUG': 10, '桐乡情久': 50 };
  settleTempSeats(s);
  const logYear1 = s.tempSeatLog ? s.tempSeatLog[0] : '';
  
  // 模拟进入第二年再次结算
  s.season = 2;
  const tSeats = (s.tempSeats || []).slice();
  const targetWorst = tSeats[0] || '桐乡情久';
  s.annualPts = {};
  s.annualPts[targetWorst] = 5;
  tSeats.forEach(t => { if(t !== targetWorst) s.annualPts[t] = 80; });
  
  settleTempSeats(s);
  const logYear2 = s.tempSeatLog ? s.tempSeatLog[0] : '';
  
  return { logYear1, logYear2 };
})()`);

T.check(persistTest.logYear1 !== '', '首年轮换必须产生日志');
T.check(persistTest.logYear1 !== persistTest.logYear2, '临时席轮换必须持久化，禁止年年重置打印同一句：log1=' + persistTest.logYear1 + ' log2=' + persistTest.logYear2);

// ⑤ 财政真实性与不变量断言
const econTest = q(`(function(){
  const s = newState('财政断言测试队', '⚔️');
  s.fund = 5;
  s.players = [
    { id: 'p1', name: '测试选手A', wage: 200, attrs: {lane:80,farm:80,team:80,mind:80}, morale: 80, willingness: 80, val: 100 },
    { id: 'p2', name: '测试选手B', wage: 150, attrs: {lane:80,farm:80,team:80,mind:80}, morale: 80, willingness: 80, val: 100 }
  ];
  s.wageCap = 500;
  s.board = { trust: 60, kpi: null, warn: 0, fired: false, firedSeason: 0, log: [] };
  
  // 触发周结发薪：总支出远超 5万
  payWage(s);
  
  const fundNonNegative = s.fund === 0;
  const defaulted = (s.wageDefaulted || 0) > 0;
  const moraleDropped = s.players.every(p => p.morale <= 65);
  const willingnessDropped = s.players.every(p => p.willingness <= 70);
  const trustDropped = s.board.trust < 60;
  
  // 测试超硬帽续约拦截
  let renewBlocked = false;
  let renewErr = null;
  try {
    S = s;
    const origToast = typeof toast === 'function' ? toast : null;
    toast = function(msg) { if(msg.includes('超过硬工资帽')) renewBlocked = true; };
    s.players[0].contract = 1;
    s.wageCap = 300; // 软帽 300，硬帽 405；续约后总薪资 550 > 405 必触发硬帽否决
    s.fund = 5000;
    renewPlayer(s, 'p1', 2, 400);
    toast = origToast;
  } catch(e) { renewErr = e.message; }

  return {
    fundNonNegative,
    defaulted,
    moraleDropped,
    willingnessDropped,
    trustDropped,
    renewBlocked,
    renewErr
  };
})()`);

T.check(econTest.fundNonNegative === true, '资金不变量：资金扣款后永不持久为负，底线钳0');
T.check(econTest.defaulted === true, '资金断流时必须记录欠薪 wageDefaulted');
T.check(econTest.moraleDropped === true, '欠薪必须真实扣减选手士气');
T.check(econTest.willingnessDropped === true, '欠薪必须真实破坏选手续约/留队意愿');
T.check(econTest.trustDropped === true, '欠薪必须真实扣减董事会信任度');
T.check(econTest.renewBlocked === true, '超硬工资帽时必须硬性否决续约（严禁超帽续约）: err=' + econTest.renewErr);

// ⑥ 夺冠保留后 leagueTeams 仍为 18 且含玩家（独立上下文避免全局 AI_TEAMS 污染）
const champDom = makeDom().dom;
const q2 = (code) => vm.runInContext(code, champDom);
const champRetainTest = q2(`(function(){
  const s = newState('常山UUG', '⚔️');
  initGroups(s);
  s.season = 1;
  // 模拟常山UUG（临时席队伍）夺冠
  s.titleHistory = [{ champ: '常山UUG', event: '银龙杯冠军' }];
  s.annualPts = { '常山UUG': 90, '桐乡情久': 80 };
  s.tempSeats = ['常山UUG', '桐乡情久'];
  settleTempSeats(s);
  return {
    leagueLen: s.leagueTeams ? s.leagueTeams.length : -1,
    hasPlayer: (s.leagueTeams || []).includes('常山UUG'),
    seatLost: !!s.seatLost,
    fixed: (s.tempSeatFixed || []).slice()
  };
})()`);

T.check(champRetainTest.leagueLen === 18, '夺冠保留后联盟必须仍为 18 队：实为 ' + champRetainTest.leagueLen);
T.check(champRetainTest.hasPlayer === true, '夺冠保留后玩家必须仍在联盟名录中');
T.check(champRetainTest.seatLost === false, '夺冠保留后玩家不得被降级');
T.check(champRetainTest.fixed.includes('常山UUG'), '夺冠队伍必须进入 tempSeatFixed');

// ⑦ 连续 5 年 leagueTeams.length === 18（临时席正常轮换不破坏联盟规模）（独立上下文）
const yearDom = makeDom().dom;
const q3 = (code) => vm.runInContext(code, yearDom);
const multiYearTest = q3(`(function(){
  const s = newState('多赛季联盟队数测试队', '⚔️');
  initGroups(s);
  var bad = [];
  for (var y = 1; y <= 5; y++) {
    s.season = y;
    // 每年设置不同的最低积分队
    var seats = (s.tempSeats || []).slice();
    s.annualPts = {};
    seats.forEach(function(t, i) { s.annualPts[t] = (i === 0) ? 5 : 80; });
    settleTempSeats(s);
    var len = s.leagueTeams ? s.leagueTeams.length : -1;
    if (len !== 18) bad.push('年' + y + ':' + len + '队');
    // 为下一年度重置临时席相关状态
    s.annualPts = {};
  }
  return { bad: bad };
})()`);

T.check(multiYearTest.bad.length === 0, '连续 5 年联盟必须恒为 18 队：' + multiYearTest.bad.join(', '));

T.report();
