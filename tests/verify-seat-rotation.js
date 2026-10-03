// 门禁：临时席位轮换保真与名录一致性（FIX-A, FIX-B, FIX-C, FIX-E）
const vm = require('vm');
const { makeDom, makeTester } = require('./harness');
const T = makeTester('临时席位轮换与保真门禁');

function runInFreshDom(fn) {
  const { dom } = makeDom();
  return vm.runInContext('(' + fn.toString() + ')()', dom);
}

const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

// 场景 A：玩家夺冠保留席（成绩最好）
const resA = runInFreshDom(function() {
  const s = newState('常山UUG', 'x');
  initGroups(s);
  s.season = 1;
  s.titleHistory = [{ champ: s.teamName, event: '春季赛' }];
  s.annualPts = { '常山UUG': 90, '桐乡情久': 80 };
  settleTempSeats(s);
  const f = FIXED_SEAT_TEAMS;
  return {
    seatLost: !!s.seatLost,
    tempSeats: s.tempSeats,
    log: (s.tempSeatLog || [])[0],
    leagueLen: (s.leagueTeams || []).length,
    aiLen: AI_TEAMS.length,
    playerInLeague: (s.leagueTeams || []).includes(s.teamName),
    playerInAI: AI_TEAMS.some(t => t.name === s.teamName),
    aiNonFixed: AI_TEAMS.map(t => t.name).filter(n => !f.includes(n)).sort(),
    leagueNonFixed: (s.leagueTeams || []).filter(n => !f.includes(n)).sort()
  };
});

// 场景 B：玩家真垫底（无保护）→ 应被收回
const resB = runInFreshDom(function() {
  const s = newState('常山UUG', 'x');
  initGroups(s);
  s.season = 1;
  s.annualPts = { '常山UUG': 5, '桐乡情久': 80 };
  settleTempSeats(s);
  return {
    seatLost: !!s.seatLost,
    tempSeats: s.tempSeats,
    log: (s.tempSeatLog || [])[0],
    leagueLen: (s.leagueTeams || []).length,
    playerInLeague: (s.leagueTeams || []).includes(s.teamName)
  };
});

// 场景 C：另一支夺冠保留 + 玩家真垫底 → 玩家仍应被收回（钉 FIX-A 自我替换缺陷）
const resC = runInFreshDom(function() {
  const s = newState('常山UUG', 'x');
  initGroups(s);
  s.season = 1;
  s.titleHistory = [{ champ: '桐乡情久', event: '春季赛' }];
  s.annualPts = { '常山UUG': 5, '桐乡情久': 80 };
  settleTempSeats(s);
  return {
    seatLost: !!s.seatLost,
    tempSeats: s.tempSeats,
    tempSeatFixed: s.tempSeatFixed,
    log: (s.tempSeatLog || [])[0],
    leagueLen: (s.leagueTeams || []).length
  };
});

// A 组断言：垫底收回必须真的生效（钉 FIX-A）
T.check(resC.seatLost === true, '真垫底者必须被收回席位（常山UUG 5分垫底，桐乡情久夺冠保留）');
T.check(!/收回 (\S+) 临时席 → \1 顶上/.test(resC.log), '轮换日志不得自我替换：' + resC.log);
T.check(resC.log.includes('收回 常山UUG 临时席'), '轮换日志必须正确记录收回垫底队：' + resC.log);
T.check(resC.tempSeats.length === 2, '场景 C 临时席必须恒为 2 支');
T.check(resB.seatLost === true, '场景 B 玩家无保护真垫底必须被收回');
T.check(resB.playerInLeague === false, '场景 B 降级玩家不得残留在 s.leagueTeams 中');

// B 组断言：保留席与名录一致（钉 FIX-B）
T.check(resA.seatLost === false, '场景 A 玩家夺冠保留席不得被收回');
T.check(resA.tempSeats.includes('常山UUG'), '夺冠保留席必须仍占一个临时席');
T.check(sameSet(resA.aiNonFixed, resA.leagueNonFixed), 'AI 名录与联盟名录的非固定席集合必须相同（禁幽灵队）: AI=' + resA.aiNonFixed.join(',') + ' League=' + resA.leagueNonFixed.join(','));
T.check(resA.leagueLen === 18 && resA.aiLen === 18, '非降级态两个名录都必须 18 支: leagueLen=' + resA.leagueLen + ' aiLen=' + resA.aiLen);
T.check(resA.playerInAI === true && resA.playerInLeague === true, '留存战队必须同时在 AI_TEAMS 与 s.leagueTeams 中');

// C 组断言：保留席一季化与老档迁移（钉 FIX-C）
const resExpire = runInFreshDom(function() {
  const s = newState('常山UUG', 'x');
  initGroups(s);
  // 第 1 季：常山UUG 夺冠保留
  s.season = 1;
  s.titleHistory = [{ champ: '常山UUG', event: '春季赛', season: 1 }];
  s.annualPts = { '常山UUG': 90, '桐乡情久': 80 };
  settleTempSeats(s);
  const s1Fixed = (s.tempSeatFixed || []).slice();

  // 第 2 季：常山UUG 未夺冠且积分垫底（5分，池内其他队80分）
  s.season = 2;
  s.annualPts = { '常山UUG': 5 };
  (s.tempSeats || []).forEach(t => { if (t !== '常山UUG') s.annualPts[t] = 80; });
  settleTempSeats(s);

  return {
    s1Fixed,
    s2SeatLost: !!s.seatLost,
    s2TempSeats: s.tempSeats,
    s2Log: (s.tempSeatLog || [])[0]
  };
});
T.check(resExpire.s1Fixed.includes('常山UUG'), '第 1 季夺冠后该季结算必须享有保留席资格');
T.check(resExpire.s2SeatLost === true, '第 1 季夺冠保留只管一季，第 2 季未夺冠且垫底必须被收回席位');
T.check(resExpire.s2Log.includes('收回 常山UUG 临时席'), '第 2 季垫底收回日志必须指向常山UUG：' + resExpire.s2Log);

// 连续夺冠保护续期验证
const resRenew = runInFreshDom(function() {
  const s = newState('常山UUG', 'x');
  initGroups(s);
  s.season = 1;
  s.titleHistory = [{ champ: '常山UUG', event: '春季赛', season: 1 }];
  s.annualPts = { '常山UUG': 90, '桐乡情久': 80 };
  settleTempSeats(s);

  s.season = 2;
  s.titleHistory.push({ champ: '常山UUG', event: '春季赛', season: 2 });
  s.annualPts = { '常山UUG': 5, '桐乡情久': 80 }; // 虽然积分低但第 2 季连冠
  settleTempSeats(s);

  return { seatLost: !!s.seatLost, tempSeats: s.tempSeats };
});
T.check(resRenew.seatLost === false, '连续赛季夺冠必须续期保护，不得被垫底收回');

// 老档迁移验证（旧格式字符串数组无 expiry 时视为已到期）
const resLegacy = runInFreshDom(function() {
  const s = newState('常山UUG', 'x');
  initGroups(s);
  s.season = 2;
  s.tempSeatFixed = ['常山UUG']; // 老档遗留的永久数组，无 tempSeatFixedExpiry
  s.annualPts = { '常山UUG': 5, '桐乡情久': 80 };
  settleTempSeats(s);
  return { seatLost: !!s.seatLost };
});
T.check(resLegacy.seatLost === true, '老档无 expiry 保护记录的临时席视为已过期，垫底时应被收回');

// D 组断言：年档规模快照防漂移（钉 FIX-E）
const { dom: dDom } = makeDom();
const ERA_SIZE = { 2016: 12, 2017: 19, 2018: 12, 2019: 14, 2020: 15, 2021: 17, 2022: 16, 2023: 16, 2024: 16, 2025: 18, 2026: 18 };
Object.entries(ERA_SIZE).forEach(([y, n]) => {
  const act = vm.runInContext('teamsAtYear(' + y + ').length', dDom);
  T.check(act === n, y + ' 档规模漂移：期望 ' + n + ' 实为 ' + act);
});

T.report();
