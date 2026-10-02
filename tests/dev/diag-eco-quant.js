// 定量对账：把「实扣」与「按周口径」并列，量化 7 倍放大
const vm = require('vm');
const { makeDom, injectHelpers } = require('./../harness');
const { dom } = makeDom();
injectHelpers(dom);
vm.runInContext('this.Math=(function(a){var f=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};var M=Object.create(Math);M.random=f;return M;})(' + 42 + ')', dom);

const out = vm.runInContext(`
(function(){
  const res=[];
  function mk(tag,rosterN,wageEach,sp,fans,fund){
    S=newState(tag,'豪门');S.preseason=false;S.transferWindow=0;S._quietSave=true;
    fillRoster(S,'star','star');
    let g=0;
    while(S.players.length<rosterN&&g++<40)S.players.push(genPlayer(genFreeAgentDef(POS_ORDER[S.players.length%5],'star',new Set(S.players.map(p=>p.name)+g))));
    S.lineup=S.players.slice(0,5).map(p=>p.id);
    if(wageEach!=null)S.players.forEach(p=>p.wage=wageEach);
    S.players.forEach(p=>p.popularity=99);
    S.sponsorLv=sp;S.fans=fans;S.fund=fund;
    return S;
  }
  // 一天：只扣编制费（发薪日发生在 day%7===0）
  function oneDay(){
    S.trained=true;S.marketRefreshed=true;
    const before=S.fund;const c=dailyCommercialIncome(S);
    nextDay(S);
    return {c,delta:S.fund-before,pay:(S.day%7===0)};
  }
  function measure(build,days){
    build();
    let ops=0,comm=0;
    for(let d=0;d<days;d++){const o=clubOpsCost(S);const r=oneDay();if(r.pay)ops+=o;comm+=r.c;}
    const weeks=days/7;
    return {opsPerWeek:Math.round(ops/weeks),commPerWeek:Math.round(comm/weeks)};
  }

  const cases=[
    ['弱旅开局(5人·无赞助·10粉)',5,20,0,10,8000],
    ['中游(7人·120万薪·sp1·80粉)',7,120,1,80,20000],
    ['顶配豪门(12人·350万薪·sp3·600粉)',12,350,3,600,80000],
    ['顶配豪门(7人·350万薪·sp3·600粉)',7,350,3,600,80000],
    ['引擎自然薪资(5人·sp3·400粉·fund8000)',5,null,3,400,8000]
  ];
  const rows=[];
  cases.forEach(([tag,n,w,sp,fans,fund])=>{
    const build=()=>mk(tag,n,w,sp,fans,fund);
    const natural=measure(build,56);
    build();
    const opsDay=clubOpsCost(S), commDay=dailyCommercialIncome(S);
    const hardWeekly=natural.opsPerWeek+Math.round(weeklyWage(S)/ECON.payWeeks)+cashReserveFee(S);
    rows.push({tag,opsDay,commDay,annual:Math.round(weeklyWage(S)),
      opsWeekCharged:natural.opsPerWeek, opsWeekIntended:opsDay,
      commWeek:natural.commPerWeek, hardWeekly,
      ratioCharged:Number((natural.commPerWeek/natural.opsPerWeek).toFixed(2)),
      ratioIntended:Number((commDay/opsDay).toFixed(2))});
  });
  return JSON.stringify(rows,null,1);
})()
`, dom);
const rows = JSON.parse(out);
console.log('ECO-01 定量对账（万；「按日实扣×7」vs「函数值当周口径」）\n');
console.log('场景'.padEnd(36)+'日编制  日流水  实扣周编制  当周口径  实扣比  当周比');
for (const r of rows) {
  console.log(r.tag.padEnd(32)
    + String(r.opsDay).padStart(7)
    + String(r.commDay).padStart(7)
    + String(r.opsWeekCharged).padStart(11)
    + String(r.opsWeekIntended).padStart(9)
    + String(r.ratioCharged).padStart(8)
    + String(r.ratioIntended).padStart(8));
}
console.log('\n年薪合计：');
for (const r of rows) console.log('  '+r.tag.padEnd(34)+r.annual+'万/年 · 周结'+Math.round(r.annual/9)+'万');
