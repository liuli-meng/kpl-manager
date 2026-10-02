// 正确口径复算：编制费每周只在发薪日扣一次（已由调用计数验证）
// 手法：不自己累加 clubOpsCost，而是从真实资金变化里分解；同时用调用计数交叉校验
const vm = require('vm');
const { makeDom, injectHelpers } = require('./../harness');
const { dom } = makeDom();
injectHelpers(dom);
vm.runInContext('this.Math=(function(a){var f=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};var M=Object.create(Math);M.random=f;return M;})(' + 20261002 + ')', dom);

const out = vm.runInContext(`
(function(){
  const W=7;
  function build(tag,n,wage,sp,fans,fund){
    S=newState(tag,'豪门');S.preseason=false;S.transferWindow=0;S._quietSave=true;
    fillRoster(S,'star','star');
    let g=0;
    while(S.players.length<n&&g++<40)S.players.push(genPlayer(genFreeAgentDef(POS_ORDER[S.players.length%5],'star',new Set(S.players.map(p=>p.name)+g))));
    S.lineup=S.players.slice(0,5).map(p=>p.id);
    if(wage!=null)S.players.forEach(p=>p.wage=wage);
    S.players.forEach(p=>p.popularity=99);
    S.sponsorLv=sp;S.fans=fans;S.fund=fund;
  }
  // 真实资金变化分解：非发薪日只有商业流水+小额补贴；发薪日额外收 编制/工资/储备/奢侈税/代言
  function run(days){
    let comm=0,pay=0,opsOnPay=0,resOnPay=0,taxOnPay=0,endorse=0,other=0;
    const seen=new Set();
    for(let d=0;d<days;d++){
      S.trained=true;S.marketRefreshed=true;
      const before=S.fund;
      const c=dailyCommercialIncome(S);
      const isPay=((S.day+1)%W===0);
      const annual=weeklyWage(S);
      const w=isPay?Math.round(annual/ECON.payWeeks):0;
      const o=isPay?clubOpsCost(S):0;
      const r=isPay?cashReserveFee(S):0;
      const t=(isPay&&annual>S.wageCap)?Math.round((annual-S.wageCap)*0.6/ECON.payWeeks):0;
      const e=isPay?Math.round(S.players.reduce((x,p)=>x+((p.popularity||0)*ENDORSE_PER_POP),0)*fanMul(S,300)*idleMul(S)):0;
      nextDay(S);
      const delta=S.fund-before;
      comm+=c;
      if(isPay){pay+=w;opsOnPay+=o;resOnPay+=r;taxOnPay+=t;endorse+=e;}
      else other+=(delta-c);
    }
    const perWeek=days/W;
    return {commPerWeek:Math.round(comm/perWeek),endorsePerWeek:Math.round(endorse/perWeek),
      wagePerWeek:Math.round(pay/perWeek),opsPerWeek:Math.round(opsOnPay/perWeek),
      reservePerWeek:Math.round(resOnPay/perWeek),taxPerWeek:Math.round(taxOnPay/perWeek),
      otherPerWeek:Math.round(other/perWeek)};
  }
  const cases=[
    ['弱旅开局(5人·无赞助·10粉·fund8000)',5,20,0,10,8000],
    ['中游(7人·120万薪·sp1·80粉·fund20000)',7,120,1,80,20000],
    ['顶配豪门(12人·350万薪·sp3·600粉·fund80000)',12,350,3,600,80000],
    ['顶配豪门(7人·350万薪·sp3·600粉·fund80000)',7,350,3,600,80000],
    ['引擎自然薪资(5人·sp3·400粉·fund8000)',5,null,3,400,8000]
  ];
  const rows=[];
  cases.forEach(([tag,n,w,sp,fans,fund])=>{
    build(tag,n,w,sp,fans,fund);
    const r=run(140);
    const hard=r.wagePerWeek+r.opsPerWeek+r.reservePerWeek+r.taxPerWeek;
    const income=r.commPerWeek+r.endorsePerWeek+Math.max(0,r.otherPerWeek);
    rows.push({tag,...r,hard,income,
      ratioIncome:(r.commPerWeek+r.endorsePerWeek)>0?Number(((r.commPerWeek+r.endorsePerWeek)/hard).toFixed(2)):null,
      ratioComm:hard>0?Number((r.commPerWeek/hard).toFixed(2)):null,
      net:income-hard});
  });
  return JSON.stringify(rows,null,1);
})()
`, dom);

const rows = JSON.parse(out);
console.log('ECO-01 正确口径复算（140 天实跑 · 编制费每周仅发薪日扣 1 次）\n');
console.log('场景'.padEnd(38)+'商业/周 代言/周 补贴/周 | 工资 编制 储备 奢侈税 = 硬支出 | 剪刀差 净额');
for (const r of rows) {
  console.log(
    r.tag.padEnd(34)
    + String(r.commPerWeek).padStart(6) + String(r.endorsePerWeek).padStart(7) + String(Math.max(0,r.otherPerWeek)).padStart(7) + ' |'
    + String(r.wagePerWeek).padStart(6) + String(r.opsPerWeek).padStart(6) + String(r.reservePerWeek).padStart(6) + String(r.taxPerWeek).padStart(7) + ' =' + String(r.hard).padStart(7) + ' |'
    + String(r.ratioIncome).padStart(7) + String(r.net).padStart(8));
}
