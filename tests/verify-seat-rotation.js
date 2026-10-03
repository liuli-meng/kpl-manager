// 门禁：临时席位轮换保真（席位改造后 · K甲冠军直授 + 资格赛 + 夺冠保留）
// 出处：GUIDE-席位与资格赛-改造指南-2026-10-03.md §9（S1 ~ S12 全场景断言）
const vm = require('vm');
const { makeDom, makeTester } = require('./harness');
const T = makeTester('临时席位轮换与保真门禁');

function runInFreshDom(fn) {
  const { dom } = makeDom();
  return vm.runInContext('(' + fn.toString() + ')()', dom);
}

const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

// S1：玩家临时席夺冠 → 保留
const resS1 = runInFreshDom(function() {
  const s = newState('常山UUG', 'x');
  initGroups(s);
  s.season = 1;
  s.titleHistory = [{ champ: s.teamName, event: '春季赛', season: 1 }];
  initKjia(s);
  s.kjia.champ = 'K甲·苍穹';
  s.kjia.runnerUp = 'K甲·星火';
  s.kjia.third = 'K甲·沧澜';
  s.kjia.fourth = 'K甲·曜石';
  s.kjia.seatHistory = [{year:2026,split:'spring',champion:'K甲·苍穹',runnerUp:'K甲·星火',third:'K甲·沧澜',fourth:'K甲·曜石'}];
  settleTempSeats(s, {kglSplitResult:{champion:'K甲·苍穹',runnerUp:'K甲·星火',third:'K甲·沧澜',fourth:'K甲·曜石'}});
  const f = FIXED_SEAT_TEAMS;
  return {
    seatLost: !!s.seatLost,
    tempSeats: s.tempSeats,
    tempSeatFixed: s.tempSeatFixed,
    log: (s.tempSeatLog || []).join('; '),
    eventLog: (s.eventLog || []).map(e => e.txt).join(' | '),
    leagueLen: (s.leagueTeams || []).length,
    aiLen: AI_TEAMS.length,
    playerInLeague: (s.leagueTeams || []).includes(s.teamName),
    playerInAI: AI_TEAMS.some(t => t.name === s.teamName),
    aiNonFixed: AI_TEAMS.map(t => t.name).filter(n => !f.includes(n)).sort(),
    leagueNonFixed: (s.leagueTeams || []).filter(n => !f.includes(n)).sort(),
    seatPlayoff: s.seatPlayoff
  };
});
T.check(resS1.seatLost === false, 'S1 玩家夺冠保留席不得被收回');
T.check(resS1.tempSeats.includes('常山UUG'), 'S1 夺冠队必须仍在临时席');
T.check(resS1.tempSeatFixed.includes('常山UUG'), 'S1 夺冠队必须在 tempSeatFixed');
T.check(resS1.seatPlayoff && resS1.seatPlayoff.cancelled === true, 'S1 夺冠保留 → 资格赛取消');
T.check(resS1.leagueLen === 18 && resS1.aiLen === 18, 'S1 两名录各 18 支');
T.check(sameSet(resS1.aiNonFixed, resS1.leagueNonFixed), 'S1 AI 与联盟非固定席同构');

// S2：他人夺冠保留 + 玩家未夺冠 → 玩家 tempSeatExpired
const resS2 = runInFreshDom(function() {
  const s = newState('常山UUG', 'x');
  initGroups(s);
  s.season = 1;
  s.titleHistory = [{ champ: '桐乡情久', event: '春季赛', season: 1 }];
  initKjia(s);
  s.kjia.champ = 'K甲·苍穹';
  s.kjia.seatHistory = [{year:2026,split:'spring',champion:'K甲·苍穹',runnerUp:'K甲·星火',third:'K甲·沧澜',fourth:'K甲·曜石'}];
  settleTempSeats(s, {kglSplitResult:{champion:'K甲·苍穹',runnerUp:'K甲·星火',third:'K甲·沧澜',fourth:'K甲·曜石'}});
  return {
    seatLost: !!s.seatLost,
    seatLostReason: s.seatLostReason,
    tempSeats: s.tempSeats,
    seatPlayoff: s.seatPlayoff
  };
});
T.check(resS2.seatLost === true, 'S2 玩家未夺冠 → seatLost');
T.check(resS2.seatLostReason === 'tempSeatExpired', 'S2 seatLostReason=tempSeatExpired（夺冠保留取消资格赛，玩家直接到期）');
T.check(resS2.seatPlayoff && resS2.seatPlayoff.cancelled === true, 'S2 他人夺冠 → 资格赛取消');

// S3：无人夺冠 → 资格赛举办（参赛 = 上届2临时席 + K甲亚季军）
const resS3 = runInFreshDom(function() {
  const s = newState('常山UUG', 'x');
  initGroups(s);
  s.season = 1;
  s.titleHistory = [];
  initKjia(s);
  s.kjia.champ = 'K甲·苍穹';
  s.kjia.runnerUp = 'K甲·星火';
  s.kjia.third = 'K甲·沧澜';
  s.kjia.fourth = 'K甲·曜石';
  s.kjia.seatHistory = [{year:2026,split:'spring',champion:'K甲·苍穹',runnerUp:'K甲·星火',third:'K甲·沧澜',fourth:'K甲·曜石'}];
  settleTempSeats(s, {kglSplitResult:{champion:'K甲·苍穹',runnerUp:'K甲·星火',third:'K甲·沧澜',fourth:'K甲·曜石'}});
  return {
    seatLost: !!s.seatLost,
    tempSeats: s.tempSeats,
    seatPlayoff: s.seatPlayoff,
    leagueLen: (s.leagueTeams || []).length,
    aiLen: AI_TEAMS.length
  };
});
T.check(resS3.seatPlayoff && !resS3.seatPlayoff.cancelled, 'S3 无人夺冠 → 资格赛举办');
T.check(resS3.seatPlayoff && resS3.seatPlayoff.winner, 'S3 资格赛有胜者');
T.check(resS3.tempSeats.length === 2, 'S3 最终临时席 = 2');
T.check(resS3.tempSeats.includes('K甲·苍穹'), 'S3 K甲冠军获直授席位');
T.check((resS3.seatPlayoff.teams || []).length === 4, 'S3 4 支队伍参赛（2 KPL临时 + 2 K甲亚季军）');

// S4：玩家赢下资格赛 → seatLost=false
const resS4 = runInFreshDom(function() {
  const s = newState('常山UUG', 'x');
  initGroups(s);
  s.season = 1;
  s.titleHistory = [];
  // 玩家战力碾压（确保赢下资格赛）
  const me = AI_TEAMS.find(t => t.name === '常山UUG');
  if (me) me.power = 999;
  initKjia(s);
  s.kjia.champ = 'K甲·苍穹';
  s.kjia.runnerUp = 'K甲·星火';
  s.kjia.third = 'K甲·沧澜';
  settleTempSeats(s, {kglSplitResult:{champion:'K甲·苍穹',runnerUp:'K甲·星火',third:'K甲·沧澜'}});
  return { seatLost: !!s.seatLost, winner: s.seatPlayoff ? s.seatPlayoff.winner : null };
});
T.check(resS4.seatLost === false, 'S4 玩家赢下资格赛 → 保级成功（seatLost=false）');
T.check(resS4.winner === '常山UUG', 'S4 资格赛胜者为玩家战队');

// S5：玩家输掉资格赛 → seatLost=true, seatLostReason='tempSeatPlayoffLost'
const resS5 = runInFreshDom(function() {
  const s = newState('常山UUG', 'x');
  initGroups(s);
  s.season = 1;
  s.titleHistory = [];
  // 玩家战力设为极低，对手设为极高
  const me = AI_TEAMS.find(t => t.name === '常山UUG');
  if (me) me.power = 100;
  const opp = AI_TEAMS.find(t => t.name === '桐乡情久');
  if (opp) opp.power = 999;
  initKjia(s);
  s.kjia.champ = 'K甲·苍穹';
  s.kjia.runnerUp = 'K甲·星火';
  s.kjia.third = 'K甲·沧澜';
  settleTempSeats(s, {kglSplitResult:{champion:'K甲·苍穹',runnerUp:'K甲·星火',third:'K甲·沧澜'}});
  return { seatLost: !!s.seatLost, seatLostReason: s.seatLostReason, winner: s.seatPlayoff ? s.seatPlayoff.winner : null };
});
T.check(resS5.seatLost === true, 'S5 玩家输掉资格赛 → seatLost=true');
T.check(resS5.seatLostReason === 'tempSeatPlayoffLost', 'S5 输掉资格赛 reason=tempSeatPlayoffLost');

// S6：固定席玩家 → 永不 seatLost
const resS6 = runInFreshDom(function() {
  const s = newState('成都AG超玩会', 'x');
  initGroups(s);
  s.season = 1;
  initKjia(s);
  s.kjia.champ = 'K甲·苍穹';
  s.kjia.seatHistory = [{year:2026,split:'spring',champion:'K甲·苍穹',runnerUp:'K甲·星火',third:'K甲·沧澜'}];
  settleTempSeats(s, {kglSplitResult:{champion:'K甲·苍穹',runnerUp:'K甲·星火',third:'K甲·沧澜'}});
  return { seatLost: !!s.seatLost };
});
T.check(resS6.seatLost === false, 'S6 固定席永不 seatLost');

// S8：名录不变量（任一场景后 AI_TEAMS 非固定席集合 == leagueTeams 非固定席集合）
T.check(sameSet(resS1.aiNonFixed, resS1.leagueNonFixed), 'S8 名录同构（S1）');

// S9：文案不含"垫底/收回"
const resS9 = runInFreshDom(function() {
  const s = newState('常山UUG', 'x');
  initGroups(s);
  s.season = 1;
  initKjia(s);
  s.kjia.champ = 'K甲·苍穹';
  s.kjia.seatHistory = [{year:2026,split:'spring',champion:'K甲·苍穹',runnerUp:'K甲·星火',third:'K甲·沧澜'}];
  settleTempSeats(s, {kglSplitResult:{champion:'K甲·苍穹',runnerUp:'K甲·星火',third:'K甲·沧澜'}});
  const panel = typeof tempSeatsPanelHtml === 'function' ? tempSeatsPanelHtml() : '';
  const logs = (s.eventLog || []).map(e => e.txt).join(' | ');
  const seatLog = (s.tempSeatLog || []).join(' | ');
  return { panel, logs, seatLog };
});
T.check(!resS9.panel.includes('垫底'), 'S9 面板文案不含"垫底"');
T.check(!resS9.panel.includes('收回'), 'S9 面板文案不含"收回"');
T.check(!resS9.seatLog.includes('收回'), 'S9 席位日志不含"收回"');

// S10：K甲 连续性（AI 队身份不变、战力单调演化）
const resS10 = runInFreshDom(function() {
  const s = newState('常山UUG', 'x');
  s.season = 1;
  initKjia(s);
  const pw1 = {};
  KJIA_AI_TEAMS.forEach(t => { pw1[t] = s.kjia.powers[t]; });
  s.season = 2;
  initKjia(s);
  const pw2 = {};
  KJIA_AI_TEAMS.forEach(t => { pw2[t] = s.kjia.powers[t]; });
  const bs = s.kjia.baseSeason;
  const monotonic = KJIA_AI_TEAMS.every(t => pw2[t] >= pw1[t]);
  return { pw1, pw2, baseSeason: bs, monotonic, teams: KJIA_AI_TEAMS.slice() };
});
T.check(resS10.baseSeason === 1, 'S10 baseSeason 固定为首次初始化时的赛季');
T.check(resS10.monotonic === true, 'S10 AI 队战力逐年单调演化: ' + JSON.stringify(resS10.pw1) + ' -> ' + JSON.stringify(resS10.pw2));

// S11：赛制分档（3晋1 单循环 / 2晋1 单场）
const resS11 = runInFreshDom(function() {
  const s = newState('常山UUG', 'x');
  // 仅 1 支 K甲队参赛 → 3 晋 1 单循环
  const po3 = buildSeatPlayoff(s, { champion: 'K甲·苍穹', runnerUp: 'K甲·星火' }, ['常山UUG', '桐乡情久']);
  // 无 K甲亚/季军参赛 → 2 晋 1 单场
  const po2 = buildSeatPlayoff(s, { champion: 'K甲·苍穹' }, ['常山UUG', '桐乡情久']);
  return { mode3: po3.mode, mode2: po2.mode };
});
T.check(resS11.mode3 === '3to1RoundRobin', 'S11 3支队走 3晋1单循环（3to1RoundRobin）');
T.check(resS11.mode2 === '2to1Single', 'S11 2支队走 2晋1单场BO7（2to1Single）');

// 保留席一季化（第 1 季夺冠保留，第 2 季他人夺冠保留 → 玩家 seatLost）
const resExpire = runInFreshDom(function() {
  const s = newState('常山UUG', 'x');
  initGroups(s);
  s.season = 1;
  s.titleHistory = [{ champ: '常山UUG', event: '春季赛', season: 1 }];
  initKjia(s);
  s.kjia.champ = 'K甲·苍穹';
  s.kjia.seatHistory = [{year:2026,split:'spring',champion:'K甲·苍穹',runnerUp:'K甲·星火',third:'K甲·沧澜'}];
  settleTempSeats(s, {kglSplitResult:{champion:'K甲·苍穹',runnerUp:'K甲·星火',third:'K甲·沧澜'}});
  const s1Fixed = (s.tempSeatFixed || []).slice();
  // 第 2 季：同池临时席队伍（K甲·苍穹）夺冠保留，资格赛取消，常山UUG 未夺冠
  s.season = 2;
  s.seatLost = false;
  s.seatLostReason = null;
  s.titleHistory = [{ champ: 'K甲·苍穹', event: '春季赛', season: 2 }];
  settleTempSeats(s, {kglSplitResult:{champion:'K甲·星火',runnerUp:'K甲·沧澜',third:'K甲·曜石'}});
  return { s1Fixed, s2SeatLost: !!s.seatLost, s2TempSeats: s.tempSeats };
});
T.check(resExpire.s1Fixed.includes('常山UUG'), '保留席第 1 季夺冠后有效');
T.check(resExpire.s2SeatLost === true, '保留席一季化：第 2 季未夺冠且他人夺冠保留 → seatLost');

// 连续夺冠保护续期
const resRenew = runInFreshDom(function() {
  const s = newState('常山UUG', 'x');
  initGroups(s);
  s.season = 1;
  s.titleHistory = [{ champ: '常山UUG', event: '春季赛', season: 1 }];
  initKjia(s);
  s.kjia.champ = 'K甲·苍穹';
  s.kjia.seatHistory = [{year:2026,split:'spring',champion:'K甲·苍穹',runnerUp:'K甲·星火',third:'K甲·沧澜'}];
  settleTempSeats(s, {kglSplitResult:{champion:'K甲·苍穹',runnerUp:'K甲·星火',third:'K甲·沧澜'}});
  s.season = 2;
  s.seatLost = false;
  s.titleHistory.push({ champ: '常山UUG', event: '春季赛', season: 2 });
  settleTempSeats(s, {kglSplitResult:{champion:'K甲·苍穹',runnerUp:'K甲·星火',third:'K甲·沧澜'}});
  return { seatLost: !!s.seatLost, tempSeats: s.tempSeats };
});
T.check(resRenew.seatLost === false, '连续夺冠续期保护');

// 老档迁移
const resLegacy = runInFreshDom(function() {
  const s = newState('常山UUG', 'x');
  initGroups(s);
  s.season = 2;
  s.tempSeatFixed = ['常山UUG'];
  initKjia(s);
  s.kjia.champ = 'K甲·苍穹';
  s.kjia.seatHistory = [{year:2027,split:'spring',champion:'K甲·苍穹',runnerUp:'K甲·星火',third:'K甲·沧澜'}];
  // 他人夺冠，使常山UUG 无法依赖资格赛胜出
  s.titleHistory = [{ champ: '桐乡情久', event: '春季赛', season: 2 }];
  settleTempSeats(s, {kglSplitResult:{champion:'K甲·苍穹',runnerUp:'K甲·星火',third:'K甲·沧澜'}});
  return { seatLost: !!s.seatLost };
});
T.check(resLegacy.seatLost === true, '老档无 expiry 保护视为已过期');

// 年档规模快照防漂移（保留原有门禁）
const { dom: dDom } = makeDom();
const ERA_SIZE = { 2016: 12, 2017: 19, 2018: 12, 2019: 14, 2020: 15, 2021: 17, 2022: 16, 2023: 16, 2024: 16, 2025: 18, 2026: 18 };
Object.entries(ERA_SIZE).forEach(([y, n]) => {
  const act = vm.runInContext('teamsAtYear(' + y + ').length', dDom);
  T.check(act === n, y + ' 档规模漂移：期望 ' + n + ' 实为 ' + act);
});

T.report();
