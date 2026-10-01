// 发薪节奏与经济刻度对齐门禁：验证单年发薪周数与名义年薪结算比例
// 杜绝魔数漂移：验证单年 payWage 调用次数 ∈ [9, 13]、单年工资支出/名义年薪 ∈ [0.75, 1.05]
// 运行：node tests/verify-paycadence.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeDom, injectHelpers } = require('./harness');

const { dom } = makeDom();
injectHelpers(dom);

// 提取 headless 模拟器运行辅助
const simCode = fs.readFileSync(path.join(__dirname, 'sim-yearend.js'), 'utf8');
const headlessMatch = simCode.match(/const HEADLESS = `([\s\S]*?)`;/);
if (!headlessMatch) throw new Error('HEADLESS definition not found in sim-yearend.js');
vm.runInContext(headlessMatch[1], dom);

const errors = [];
const check = (cond, msg) => { if (!cond) errors.push(msg); };

// ① ECON 常量声明门禁：payWeeks 必须显式声明且为 12
const payWeeksVal = vm.runInContext('ECON.payWeeks', dom);
check(payWeeksVal === 12, `① ECON.payWeeks 应为 12，实测 ${payWeeksVal}`);

// ② 跑单年自然赛历：转会窗 7 天真实推进 + 联赛 + 杯赛全流程
const CADENCE_TEST = vm.runInContext(`
(function(){
  const SEEDS = [999983, 12345, 777];
  return SEEDS.map(sd => {
    // 种子化随机数
    this.Math = (function(a){
      var f = function(){
        a |= 0; a = a + 0x6D2B79F5 | 0;
        var t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
      var M = Object.create(Math); M.random = f; return M;
    })(sd);

    const s = newState('发薪节奏队_' + sd, '⚔️');
    fillRoster(s, 'mid');
    s.coach = {...COACH_POOL[0]};
    initGroups(s);
    S = s;

    let payCount = 0;
    let wageSpent = 0;
    const initialNominal = weeklyWage(s);
    const origPayWage = payWage;

    payWage = function(st) {
      payCount++;
      const w = Math.max(0, Math.round(weeklyWage(st) / ECON.payWeeks));
      wageSpent += w;
      return origPayWage(st);
    };

    function playSplit(win) {
      let g = 0;
      while (!['champion', 'eliminated'].includes(S.phase) && g++ < 400) {
        if (S.preseason) {
          nextDay(S);
          continue;
        }
        if (S.phase === 'r1' || S.phase === 'r2' || S.phase === 'r3') {
          if (S.matchIdx >= S.schedule.length) { advancePhase(S); continue; }
          startMatch();
          if (!S.series) { continue; }
          forceSeries(win);
        } else if (S.phase === 'card') {
          if (S.series) { forceSeries(win); continue; }
          startCard();
          if (S.series) { forceSeries(win); continue; }
          if (!['champion', 'eliminated'].includes(S.phase) && !(S.card && S.card.idx < S.card.matches.length)) break;
        } else if (S.phase === 'playoff') {
          if (S.series) { forceSeries(win); continue; }
          startPlayoff();
          if (S.series) { forceSeries(win); continue; }
          if (!S.playoff || !S.playoff.final || S.playoff.final.r) break;
        } else break;
      }
    }

    // 春季赛
    playSplit(true);
    advanceCalendar(S);
    playCups(true);

    // 夏季赛与后续杯赛
    if (S.split === 'summer') {
      playSplit(true);
      advanceCalendar(S);
      playCups(true);
    }

    const ratio = +(wageSpent / initialNominal).toFixed(3);
    return {
      seed: sd,
      payCount,
      wageSpent,
      initialNominal,
      ratio,
      endSeason: S.season
    };
  });
})()
`, dom);

CADENCE_TEST.forEach(r => {
  check(r.payCount >= 9 && r.payCount <= 13,
    `② [种子 ${r.seed}] 单年 payWage 调用次数 (${r.payCount}) 越出 [9, 13] 预期区间`);
  check(r.ratio >= 0.75 && r.ratio <= 1.05,
    `② [种子 ${r.seed}] 单年工资支出/名义年薪比例 (${r.ratio}) 越出 [0.75, 1.05] 预期区间（实付 ${r.wageSpent}万 / 名义 ${r.initialNominal}万）`);
});

if (errors.length) {
  console.log('[FAIL] 发薪节奏门禁:\n  ' + errors.join('\n  '));
  process.exitCode = 1;
} else {
  console.log('[PASS] 发薪节奏门禁：单年发薪次数 '
    + CADENCE_TEST.map(r => r.payCount + '次').join(' / ')
    + ' ∈ [9, 13] · 实付/名义年薪比 '
    + CADENCE_TEST.map(r => (r.ratio * 100).toFixed(1) + '%').join(' / ')
    + ' ∈ [75%, 105%] · ECON.payWeeks=12');
}
