// 经济滚雪球探针：强队连打 120 天，看资金膨胀速度（诊断用，非门禁）
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(
  `
(function(){
  let a=42;Math.random=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
  S=newState('豪门探针','金');
  S.preseason=false;S.transferWindow=0;
  fillRoster(S,'star','star');
  S.coach=Object.assign({},COACH_POOL.find(c=>c.id==='co12')||COACH_POOL[0]);
  S.sponsorLv=3;
  S.fans=400;
  S.players.forEach(p=>{p.popularity=85;});
  const f0=S.fund;
  const samples=[];
  for(let d=0;d<120;d++){
    S.trained=true;S.marketRefreshed=true;
    S._quietSave=true;
    nextDay(S);
    if(d%30===29)samples.push({day:d+1,fund:Math.round(S.fund),gain:Math.round(S.fund-f0)});
  }
  const annual=weeklyWage(S);
  const endorse=Math.round(S.players.reduce((t,p)=>t+(p.popularity||0)*ENDORSE_PER_POP,0)*fanMul(S,300));
  const daily=dailyCommercialIncome(S);
  return JSON.stringify({
    f0, samples,
    weeklyWage:Math.round(annual/52),
    weeklyEndorse:endorse,
    dailyCommercial:daily,
    weeklyCommercial:daily*7,
    ENDORSE_PER_POP,
    weeklyWageAnnual:annual
  },null,2);
})()
`,
  dom
);

console.log(out);
