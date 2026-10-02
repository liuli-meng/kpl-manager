// 诊断探针：逐日打印 编制费/储备费/工资/资金变化，并做账目闭合校验
const vm = require('vm');
const { makeDom, injectHelpers } = require('./../harness');
const { dom } = makeDom();
injectHelpers(dom);
vm.runInContext('this.Math=(function(a){var f=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};var M=Object.create(Math);M.random=f;return M;})(' + 20261002 + ')', dom);

const out = vm.runInContext(`
(function(){
  const res=[];
  S=newState('诊断','豪门');
  S.preseason=false;S.transferWindow=0;S._quietSave=true;
  fillRoster(S,'star','star');
  S.lineup=S.players.map(p=>p.id);
  S.players.forEach(p=>{p.popularity=99;p.wage=350;});
  S.sponsorLv=3;S.fans=600;S.fund=80000;
  res.push('起始：人数='+S.players.length+' 年薪合计='+weeklyWage(S)+' 帽='+S.wageCap+' 编制='+clubOpsCost(S)+' 储备费='+cashReserveFee(S)+' 商业日流水='+dailyCommercialIncome(S));
  const ACT=()=>{S.trained=true;S.marketRefreshed=true;};
  for(let d=1;d<=16;d++){
    ACT();
    const before=S.fund;
    const c=dailyCommercialIncome(S);
    const o=clubOpsCost(S), r=cashReserveFee(S);
    const annual=weeklyWage(S);
    const isPay=((S.day+1)%WAGE_EVERY===0);
    const w=isPay?Math.round(annual/ECON.payWeeks):0;
    const t=isPay&&annual>S.wageCap?Math.round((annual-S.wageCap)*0.6/ECON.payWeeks):0;
    nextDay(S);
    const delta=S.fund-before;
    res.push('day'+String(S.day).padStart(3)+' idle='+S.idleDays+' 商业+'+c+' 编制-'+(isPay?o:0)+' 储备-'+(isPay?r:0)+' 工资-'+(isPay?w:0)+' 奢侈税-'+(isPay?t:0)+' Δfund='+Math.round(delta)+' 人数='+S.players.length+' 年薪='+Math.round(annual)+' 帽='+S.wageCap);
  }
  return res.join('\\n');
})()
`, dom);
console.log(out);
