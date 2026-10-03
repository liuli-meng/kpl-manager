// 门禁：临时席位轮换保真与真实时序验证（含 D-1 夺冠保留与 D-2 每赛段结算）
// 出处：GUIDE-席位与资格赛-改造指南-2026-10-03.md §9
const vm = require('vm');
const { makeDom, makeTester } = require('./harness');
const T = makeTester('临时席位轮换与保真门禁');

function runInFreshDom(fn) {
  const { dom } = makeDom();
  return vm.runInContext('(' + fn.toString() + ')()', dom);
}

const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

// D-1 / S1 真实时序验证：玩家临时席夺冠 → 走真实 newSeason（s.season 先自增）后保留生效
const resRealNewSeason = runInFreshDom(function() {
  const s = newState('常山UUG', 'x');
  S = s;
  initGroups(s);
  s.season = 1;
  s.split = 'summer';
  s.titleHistory = [{ season: 1, split: 'summer', event: '2026夏季赛总决赛', champ: '常山UUG' }];
  initKjia(s);
  s.kjia.champ = 'K甲·苍穹';
  s.kjia.runnerUp = 'K甲·星火';
  s.kjia.third = 'K甲·沧澜';
  s.kjia.seatHistory = [{ year: 2026, split: 'summer', champion: 'K甲·苍穹', runnerUp: 'K甲·星火', third: 'K甲·沧澜' }];

  // 走真实年度轮换时序（season.js:900 s.season++ 先执行，而后进入 settleTempSeats）
  newSeason(s);

  const f = FIXED_SEAT_TEAMS;
  return {
    season: s.season,
    seatLost: !!s.seatLost,
    tempSeats: s.tempSeats,
    tempSeatFixed: s.tempSeatFixed,
    cancelled: s.seatPlayoff ? s.seatPlayoff.cancelled : null,
    reason: s.seatPlayoff ? s.seatPlayoff.reason : null,
    leagueLen: (s.leagueTeams || []).length,
    aiLen: AI_TEAMS.length,
    playerInLeague: (s.leagueTeams || []).includes(s.teamName),
    playerInAI: AI_TEAMS.some(t => t.name === s.teamName),
    aiNonFixed: AI_TEAMS.map(t => t.name).filter(n => !f.includes(n)).sort(),
    leagueNonFixed: (s.leagueTeams || []).filter(n => !f.includes(n)).sort()
  };
});
T.check(resRealNewSeason.season === 2, 'D-1 真实时序：season 自增至 2');
T.check(resRealNewSeason.seatLost === false, 'D-1 真实时序：常山UUG 夺冠保留席生效（seatLost=false）');
T.check(resRealNewSeason.tempSeats.includes('常山UUG'), 'D-1 真实时序：常山UUG 必须在 tempSeats');
T.check(resRealNewSeason.tempSeatFixed.includes('常山UUG'), 'D-1 真实时序：常山UUG 必须在 tempSeatFixed');
T.check(resRealNewSeason.cancelled === true, 'D-1 真实时序：夺冠保留必须取消本届资格赛');
T.check(resRealNewSeason.leagueLen === 18 && resRealNewSeason.aiLen === 18, 'D-1 真实时序：两名录各 18 支');
T.check(sameSet(resRealNewSeason.aiNonFixed, resRealNewSeason.leagueNonFixed), 'D-1 真实时序：两名录非固定席同构');

// D-2 真实时序验证：夏季赛开幕（startSplit('summer')）必须触发临时席位结算
const resRealSummerSplit = runInFreshDom(function() {
  const s = newState('常山UUG', 'x');
  S = s;
  initGroups(s);
  s.season = 1;
  s.split = 'spring';
  initKjia(s);
  s.kjia.champ = 'K甲·苍穹';
  s.kjia.runnerUp = 'K甲·星火';
  s.kjia.third = 'K甲·沧澜';
  s.kjia.seatHistory = [{ year: 2026, split: 'spring', champion: 'K甲·苍穹', runnerUp: 'K甲·星火', third: 'K甲·沧澜' }];

  // 模拟挑战者杯后开启夏季赛
  startSplit(s, 'summer');

  return {
    split: s.split,
    hasPlayoff: !!s.seatPlayoff,
    playoffDone: s.seatPlayoff ? s.seatPlayoff.done : false,
    tempSeats: s.tempSeats,
    settleKey: s._lastSeatSettleKey
  };
});
T.check(resRealSummerSplit.split === 'summer', 'D-2 夏季赛赛段开启');
T.check(resRealSummerSplit.hasPlayoff === true, 'D-2 夏季赛开幕前必须触发资格赛');
T.check(resRealSummerSplit.playoffDone === true, 'D-2 资格赛正常完成');
T.check(resRealSummerSplit.settleKey === '1_summer', 'D-2 结算防重守卫已标记为 1_summer');
T.check(resRealSummerSplit.tempSeats.length === 2, 'D-2 夏季赛 2 支临时席位在列');

// S2 真实时序验证：他人夺冠保留 + 玩家未夺冠 → 走真实 newSeason 后玩家 tempSeatExpired
const resS2Real = runInFreshDom(function() {
  const s = newState('常山UUG', 'x');
  S = s;
  initGroups(s);
  s.season = 1;
  s.split = 'summer';
  s.titleHistory = [{ season: 1, split: 'summer', event: '2026夏季赛总决赛', champ: '桐乡情久' }];
  initKjia(s);
  s.kjia.champ = 'K甲·苍穹';
  s.kjia.runnerUp = 'K甲·星火';
  s.kjia.third = 'K甲·沧澜';
  s.kjia.seatHistory = [{ year: 2026, split: 'summer', champion: 'K甲·苍穹', runnerUp: 'K甲·星火', third: 'K甲·沧澜' }];

  newSeason(s);

  return {
    season: s.season,
    seatLost: !!s.seatLost,
    seatLostReason: s.seatLostReason,
    tempSeats: s.tempSeats,
    cancelled: s.seatPlayoff ? s.seatPlayoff.cancelled : false
  };
});
T.check(resS2Real.season === 2, 'S2 真实时序自增至 2');
T.check(resS2Real.seatLost === true, 'S2 真实时序：桐乡情久夺冠，常山UUG 失去席位');
T.check(resS2Real.seatLostReason === 'tempSeatExpired', 'S2 真实时序：seatLostReason=tempSeatExpired');
T.check(resS2Real.cancelled === true, 'S2 真实时序：他人夺冠同样取消资格赛');

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
  // 提升首发选手属性确保 teamPower 碾压
  (s.players || []).forEach(p => {
    p.attrs = { lane: 99, farm: 99, team: 99, mind: 99 };
  });
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
  // 玩家选手全部降低属性
  (s.players || []).forEach(p => {
    p.attrs = { lane: 30, farm: 30, team: 30, mind: 30 };
  });
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
T.check(resS10.monotonic === true, 'S10 AI 队战力逐年单调演化');

// S11：赛制分档（3晋1 单循环 / 2晋1 单场）与 Tiebreak
const resS11 = runInFreshDom(function() {
  const s = newState('常山UUG', 'x');
  const po3 = buildSeatPlayoff(s, { champion: 'K甲·苍穹', runnerUp: 'K甲·星火' }, ['常山UUG', '桐乡情久']);
  const po2 = buildSeatPlayoff(s, { champion: 'K甲·苍穹' }, ['常山UUG', '桐乡情久']);
  const sim3 = simSeatPlayoff(s, po3);
  return { mode3: po3.mode, mode2: po2.mode, sim3Done: sim3.done, sim3Winner: sim3.winner.length === 1 };
});
T.check(resS11.mode3 === '3to1RoundRobin', 'S11 3支队走 3晋1单循环（3to1RoundRobin）');
T.check(resS11.mode2 === '2to1Single', 'S11 2支队走 2晋1单场BO7（2to1Single）');
T.check(resS11.sim3Done && resS11.sim3Winner, 'S11 3晋1 单循环正常完赛并决出单一胜者');

// 年档规模快照防漂移
const { dom: dDom } = makeDom();
const ERA_SIZE = { 2016: 12, 2017: 19, 2018: 12, 2019: 14, 2020: 15, 2021: 17, 2022: 16, 2023: 16, 2024: 16, 2025: 18, 2026: 18 };
Object.entries(ERA_SIZE).forEach(([y, n]) => {
  const act = vm.runInContext('teamsAtYear(' + y + ').length', dDom);
  T.check(act === n, y + ' 档规模漂移：期望 ' + n + ' 实为 ' + act);
});

T.report();
