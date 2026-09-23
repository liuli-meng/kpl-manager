// 怠政经济回归门禁：证明「什么都不干」不再是纯收益，且「动手」明确比挂机强
// 背景（实测）：改之前新档只点推进 60 天 = 1300→3509（+169.9%），其中签到补贴无条件白给 1600 万，
//   董事会信任恒 60、warn 恒 0——整个压力层对挂机是无感的。改之后要求增幅落进 ±10%。
// 运行：node tests/verify-idle.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

// 沙箱随机数种子化（与 sim-quick/fuzz 同一实现）：同一份代码永远同一批数据，不会随机红灯
const seed = n => vm.runInContext(
  'this.Math=(function(a){var f=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};var M=Object.create(Math);M.random=f;return M;})(' + n + ')', dom);

// 跑 n 天：act=false 纯挂机；act=true 每天做一次训练（含 13 万成本，与 train.js 同口径）
function run(days, act) {
  return vm.runInContext(`(function(){
    const s=newState('怠政门禁队','队');
    s.crest={sh:'shield',c1:'#123456',c2:'#000000',c3:'#ffffff',txt:'怠'};
    s.selfBuilt=true;s.preseason=false;s.transferWindow=0;
    fillRoster(s,'mid');
    const f0=s.fund,t0=(s.board||{}).trust;
    for(let d=0;d<${days};d++){
      if(${act ? 'true' : 'false'}){s.trained=true;s.fund-=20;}
      s._quietSave=true;
      nextDay(s);
    }
    return {gain:Math.round(s.fund-f0),pct:+(((s.fund-f0)/f0)*100).toFixed(1),fund:Math.round(s.fund),
      idle:s.idleDays,trust:(s.board||{}).trust,t0,
      evTitles:(s.eventLog||[]).map(e=>e.txt||'').filter(t=>/【(赞助商追责|主场退票|更衣室涣散|训练赛缺席|核心选手申请离队)】/.test(t)).length};
  })()`, dom);
}

const errors = [];
const check = (cond, msg) => { if (!cond) errors.push(msg); };

// ① 三档种子：60 天纯挂机增幅必须落在 ±10% 带内（用户定的"温和"档）
const IDLE = [999983, 12345, 777].map(sd => { seed(sd); return run(60, false); });
IDLE.forEach((r, i) => check(Math.abs(r.pct) <= 10, `①种子${[999983, 12345, 777][i]} 60天挂机增幅 ${r.pct}% 越出 ±10% 带`));
check(IDLE.every(r => r.idle === 60), `①idleDays 未累计到 60（实测 ${IDLE.map(r => r.idle).join('/')}）`);

// ② 压力层必须真的咬人：信任下降 ≥5，且怠政事件至少触发过一次
IDLE.forEach((r, i) => check(r.t0 - r.trust >= 5, `②种子${i} 挂机 60 天董事会信任只动了 ${r.t0 - r.trust}（应 ≥5）`));
check(IDLE.some(r => r.evTitles > 0), '②怠政事件池一次都没触发（idleDays>=7 且 20% 概率，60 天不可能全空）');

// ③ 动手必须比挂机强：同样 60 天，每天训练一次的净收益要显著更高
const ACTIVE = [999983, 12345, 777].map(sd => { seed(sd); return run(60, true); });
ACTIVE.forEach((r, i) => {
  check(r.gain - IDLE[i].gain >= 150, `③种子${[999983, 12345, 777][i]} 每天训练只比纯挂机多赚 ${r.gain - IDLE[i].gain} 万（应 ≥150）`);
  check(r.idle === 0, `③履约日仍被判挂机（idleDays=${r.idle}）`);
  check(r.trust >= r.t0, `③每天训练反而掉信任：${r.t0}→${r.trust}`);
});

// ④ idleMul 档位（赞助商曝光义务折扣）
const MUL = vm.runInContext('[0,2,3,5,6,11,12,30].map(d=>idleMul({idleDays:d}))', dom);
const WANT = [1, 1, 0.55, 0.55, 0.35, 0.35, 0.15, 0.15];
check(JSON.stringify(MUL) === JSON.stringify(WANT), `④idleMul 档位漂移：${MUL.join('/')} ≠ ${WANT.join('/')}`);

// ⑤ 签到补贴门禁：随机数钉死（不抽事件）+ 避开周结日，两次运行的资金差必须正好是 80 万
const SIGN = vm.runInContext(`(function(){
  const M=Object.create(Math);M.random=()=>0.99;const _Math=Math;globalThis.Math=M;
  const mk=()=>{const s=newState('签到队','队');s.crest={sh:'shield',c1:'#1',c2:'#2',c3:'#3',txt:'签'};
    s.preseason=false;s.transferWindow=0;fillRoster(s,'mid');
    s.day=(Math.floor(20/7)*7); // 对齐到周结日的前一天，下一次 nextDay 正好跨周结，两组同样跨
    return s;};
  const a=mk(),b=mk();
  a.trained=true;a.fund-=20;      // 履约组：当天练过
  const a0=a.fund,b0=b.fund;
  nextDay(a);nextDay(b);
  globalThis.Math=_Math;
  return {dA:Math.round(a.fund-a0),dB:Math.round(b.fund-b0)};
})()`, dom);
check(SIGN.dA - SIGN.dB === 80, `⑤签到履约差不是 80 万：履约 ${SIGN.dA} / 挂机 ${SIGN.dB} → 差 ${SIGN.dA - SIGN.dB}`);

// ⑥ 旧档兜底：删掉 idleDays 后 applySaveDefaults 必须补 0，且 nextDay 不抛错
const OLD = vm.runInContext(`(function(){
  const s=newState('旧档队','队');s.crest={sh:'shield',c1:'#1',c2:'#2',c3:'#3',txt:'旧'};
  s.preseason=false;s.transferWindow=0;fillRoster(s,'mid');
  delete s.idleDays;
  applySaveDefaults(s);
  const defaulted=s.idleDays;              // 兜底值必须在推进前读——推进一天它就变成 1 了
  let err=null;try{nextDay(s);}catch(e){err=e.message;}
  return {defaulted:defaulted,after:s.idleDays,err:err};
})()`, dom);
check(OLD.defaulted === 0, `⑥旧档 applySaveDefaults 未兜底 idleDays（得 ${OLD.defaulted}）`);
check(OLD.after === 1, `⑥旧档推进一天后 idleDays 应为 1，实得 ${OLD.after}`);
check(!OLD.err, `⑥旧档缺字段时 nextDay 抛错：${OLD.err}`);

if (errors.length) {
  console.log('[FAIL] 怠政经济门禁:\n  ' + errors.join('\n  '));
  console.log('  挂机 60 天增幅: ' + IDLE.map(r => r.pct + '%').join(' / ') + ' · 履约组净收益: ' + ACTIVE.map(r => r.gain).join(' / '));
  process.exitCode = 1;
} else {
  console.log('[PASS] 怠政经济门禁：60 天纯挂机增幅 ' + IDLE.map(r => r.pct + '%').join(' / ')
    + '（带内 ±10%）· 信任 ' + IDLE.map(r => r.t0 + '→' + r.trust).join(' / ')
    + ' · 每天训练净多赚 ' + ACTIVE.map((r, i) => (r.gain - IDLE[i].gain)).join(' / ') + ' 万 · 签到差 ' + (SIGN.dA - SIGN.dB) + ' 万');
}
