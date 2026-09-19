// 挂机资金分解探针（只读诊断，不进 test 链）：60 天「只点推进」谁在给钱
// 用法：node tests/probe-idle-econ.js [seed]
const vm = require('vm');
const { makeDom, injectHelpers } = require('./harness');

function run(seed, killEvents) {
  const { dom } = makeDom();
  injectHelpers(dom);
  vm.runInContext('this.Math=(function(a){var f=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};var M=Object.create(Math);M.random=f;return M;})(' + seed + ')', dom);
  if (killEvents) vm.runInContext('EVENTS.length=0;EVENTS.push({t:"空",desc:"无",good:true,fn:function(){}});', dom);
  return vm.runInContext(`(function(){
    const s=newState('基线队','队');
    s.crest={sh:'shield',c1:'#123456',c2:'#000000',c3:'#ffffff',txt:'基'};
    s.selfBuilt=true; s.preseason=false; s.transferWindow=0;   // 跳过转会期，直接进"日常空转"
    fillRoster(s,'mid');
    const acc={commercial:0,signin:0};
    const f0=s.fund;
    for(let d=0;d<60;d++){
      const before=s.fund;
      acc.commercial+=dailyCommercialIncome(s);
      if((s.day+1)%3===0)acc.signin+=80;
      nextDay(s);
      s._quietSave=true;
    }
    return {fund0:f0,fund1:s.fund,delta:s.fund-f0,acc,days:s.day,fans:s.fans,
      trust:s.board?s.board.trust:null,warn:s.board?s.board.warn:null,
      morale:Math.round(s.players.reduce((t,p)=>t+(p.morale||0),0)/s.players.length),
      power:teamPower(s),log:(s.eventLog||[]).length};
  })()`, dom);
}
const SEED = parseInt(process.argv[2], 10) || 999983;
const a = run(SEED, false), b = run(SEED, true);
const pct = (x, d) => ((x / d) * 100).toFixed(1) + '%';
console.log('种子', SEED);
console.log('完整挂机   资金 %d → %d  Δ=%+d（%s/天）', a.fund0, a.fund1, a.delta, (a.delta / 60).toFixed(1));
console.log('清空事件池 资金 %d → %d  Δ=%+d', b.fund0, b.fund1, b.delta);
console.log('\n贡献拆解（以清空事件池为基线）：');
console.log('  随机事件净贡献 %+.0f 万  占完整挂机 %s', a.delta - b.delta, pct(a.delta - b.delta, a.delta));
console.log('  签到补贴(每3天80万) %+.0f 万  占 %s', b.acc.signin, pct(b.acc.signin, b.delta));
console.log('  每日商业流水 %+.0f 万  占 %s', b.acc.commercial, pct(b.acc.commercial, b.delta));
console.log('  其余(周薪/代言/奢侈税/分润) %+d 万', b.delta - b.acc.signin - b.acc.commercial);
console.log('\n末态对比  粉丝 %s→%s | 信任 %s→%s | warn %s→%s | 士气 %s→%s | 事件日志 %s→%s',
  a.fans, b.fans, a.trust, b.trust, a.warn, b.warn, a.morale, b.morale, a.log, b.log);
