// 对照诊断：用真实球员薪资（不覆盖 wage）跑，与覆盖 wage=350 的场景对照
const vm = require('vm');
const { makeDom, injectHelpers } = require('./../harness');
const { dom } = makeDom();
injectHelpers(dom);
vm.runInContext('this.Math=(function(a){var f=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};var M=Object.create(Math);M.random=f;return M;})(' + 42 + ')', dom);

const out = vm.runInContext(`
(function(){
  const res=[];
  function scen(tag,setup){
    S=newState(tag,'豪门');S.preseason=false;S.transferWindow=0;S._quietSave=true;
    fillRoster(S,'star','star');S.lineup=S.players.map(p=>p.id);
    setup(S);
    const f0=S.fund;
    let opsSum=0,commSum=0,paySum=0,resSum=0,taxSum=0;
    for(let d=0;d<120;d++){
      S.trained=true;S.marketRefreshed=true;
      const pay=((S.day+1)%WAGE_EVERY===0);
      commSum+=dailyCommercialIncome(S);
      if(pay){opsSum+=clubOpsCost(S);paySum+=Math.round(weeklyWage(S)/ECON.payWeeks);resSum+=cashReserveFee(S);
        taxSum+=weeklyWage(S)>S.wageCap?Math.round((weeklyWage(S)-S.wageCap)*0.6/ECON.payWeeks):0;}
      nextDay(S);
    }
    const dlt=S.fund-f0;
    res.push(tag+'\\n   起始fund='+f0+' → '+Math.round(S.fund)+'（Δ'+Math.round(dlt)+'，×'+(S.fund/f0).toFixed(2)+'）'
      +'\\n   周均：商业+'+Math.round(commSum/120*7)+' 编制-'+Math.round(opsSum/120*7)
      +' 工资-'+Math.round(paySum/120*7)+' 储备-'+Math.round(resSum/120*7)+' 奢侈税-'+Math.round(taxSum/120*7)
      +'\\n   自然薪资：年薪合计='+Math.round(weeklyWage(S))+' 帽='+S.wageCap+' 编制(当前)='+clubOpsCost(S)
      +' 商业日流水(当前)='+dailyCommercialIncome(S)+' 人数='+S.players.length);
  }
  scen('A 真实薪资·sponsor3/fans400（复刻 verify-econ ⑤）',s=>{s.sponsorLv=3;s.fans=400;s.players.forEach(p=>{p.popularity=85;});s.fund=8000;});
  scen('B 真实薪资·sponsor3/fans600',s=>{s.sponsorLv=3;s.fans=600;s.players.forEach(p=>{p.popularity=99;});s.fund=80000;});
  scen('C 覆盖wage=350·sponsor3/fans600',s=>{s.sponsorLv=3;s.fans=600;s.players.forEach(p=>{p.popularity=99;p.wage=350;});s.fund=80000;});
  return res.join('\\n');
})()
`, dom);
console.log(out);
