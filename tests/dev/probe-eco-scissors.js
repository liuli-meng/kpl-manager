// 独立复算探针（非门禁）：ECO-01 商业流水 vs 俱乐部硬支出剪刀差
// 运行：node tests/dev/probe-eco-scissors.js
// 口径说明：从真实 nextDayStep 逐日跑，直接读取 s.fund 前后差与 dailyCommercialIncome(s)，
// 不手写公式，避免用「我以为的公式」去验证「代码里的公式」。
const vm = require('vm');
const { makeDom, injectHelpers } = require('./../harness');
const { dom } = makeDom();
injectHelpers(dom);

// 固定种子，保证可复现
vm.runInContext('this.Math=(function(a){var f=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};var M=Object.create(Math);M.random=f;return M;})(' + 20261002 + ')', dom);

const out = vm.runInContext(`
(function(){
  const res=[];
  const WAGE_EVERY_N=(typeof WAGE_EVERY!=='undefined'?WAGE_EVERY:7);
  const PAY_WEEKS=(typeof ECON!=='undefined'&&ECON.payWeeks)?ECON.payWeeks:9;

  function build(tag,rosterN,wageEach,sponsorLv,fans,fund){
    S=newState(tag,'豪门');
    S.preseason=false;S.transferWindow=0;S._quietSave=true;
    fillRoster(S,'star','star');
    // 补到指定人数（大名单硬顶 12 内）
    let g=0;
    while(S.players.length<rosterN&&g++<40){
      S.players.push(genPlayer(genFreeAgentDef(POS_ORDER[S.players.length%5],'star',new Set(S.players.map(p=>p.name)+g))));
    }
    S.lineup=S.players.slice(0,5).map(p=>p.id);
    S.players.forEach(p=>{p.popularity=99;p.wage=wageEach;});
    S.sponsorLv=sponsorLv;S.fans=fans;S.fund=fund;
    return S;
  }

  function run(s,days){
    const rows=[];
    let comm=0,endorse=0,ops=0,reserve=0,tax=0,wage=0,inflowOther=0;
    for(let d=0;d<days;d++){
      const before=S.fund;
      const c=dailyCommercialIncome(S);
      const annual=weeklyWage(S);
      const isPay=((S.day+1)%WAGE_EVERY_N===0);
      const o=clubOpsCost(S),r=cashReserveFee(S);
      const t=annual>S.wageCap?Math.round((annual-S.wageCap)*0.6/PAY_WEEKS):0;
      const w=isPay?Math.max(0,Math.round(annual/PAY_WEEKS)):0;
      const eRaw=(S.players||[]).reduce((x,p)=>x+((p.popularity||0)*ENDORSE_PER_POP),0)*fanMul(S,300);
      const e=isPay?Math.round(eRaw*idleMul(S)):0;
      S.trained=true;S.marketRefreshed=true;
      nextDay(S);
      const delta=S.fund-before;
      comm+=c;
      if(isPay){ops+=o;reserve+=r;tax+=t;wage+=w;endorse+=e;}
      // 其它日进项（履约补贴/事件/主播）反推，让账目闭合
      inflowOther+=(delta - c + (isPay?(w+o+r+t-e):0));
    }
    const perWeek=days/7;
    return {commPerWeek:Math.round(comm/perWeek),opsPerWeek:Math.round(ops/perWeek),
      wagePerWeek:Math.round(wage/perWeek),reservePerWeek:Math.round(reserve/perWeek),
      taxPerWeek:Math.round(tax/perWeek),endorsePerWeek:Math.round(endorse/perWeek),
      otherPerWeek:Math.round(inflowOther/perWeek),annual:Math.round(weeklyWage(S)),cap:S.wageCap};
  }

  const DAYS=70;
  const cases=[
    ['弱旅开局（无赞助/少粉/低薪）',5,20,0,10,8000],
    ['中游队',7,120,1,80,20000],
    ['顶配豪门（12人顶薪）',12,350,3,600,80000],
    ['顶配豪门（7人顶薪·引擎自然编制）',7,350,3,600,80000]
  ];
  const rowsOut=[];
  cases.forEach(([tag,n,wage,sp,fans,fund])=>{
    build(tag,n,wage,sp,fans,fund);
    const r=run(S,DAYS);
    const hard=r.wagePerWeek+r.opsPerWeek+r.reservePerWeek+r.taxPerWeek;
    const ratio=hard>0?(r.commPerWeek/hard):Infinity;
    rowsOut.push({tag,...r,hardPerWeek:hard,ratio:Number(ratio.toFixed(2))});
  });
  return JSON.stringify(rowsOut,null,1);
})()
`, dom);

const rows = JSON.parse(out);
console.log('ECO-01 剪刀差复算（70 天实跑 · 固定种子 20261002 · 单位：万）\n');
console.log('场景'.padEnd(34) + '商业流水/周  硬支出/周  其中工资  编制  储备费  奢侈税  剪刀差');
for (const r of rows) {
  console.log(
    r.tag.padEnd(30) +
    String(r.commPerWeek).padStart(10) +
    String(r.hardPerWeek).padStart(11) +
    String(r.wagePerWeek).padStart(8) +
    String(r.opsPerWeek).padStart(6) +
    String(r.reservePerWeek).padStart(8) +
    String(r.taxPerWeek).padStart(8) +
    (isFinite(r.ratio) ? String(r.ratio).padStart(8) + 'x' : '      ∞')
  );
}
console.log('\n附：年薪合计 与 工资帽');
for (const r of rows) console.log('  ' + r.tag.padEnd(32) + '年薪 ' + r.annual + '万 / 帽 ' + r.cap + '万');
