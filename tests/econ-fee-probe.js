const { makeDom } = require('./harness');
const vm = require('vm');
const { dom } = makeDom();
const out = vm.runInContext(`
(function(){
  S=newState('扣费探针','扣');
  fillRoster(S,'star','star');
  S.coach=Object.assign({},COACH_POOL.find(c=>c.id==='co12')||COACH_POOL[0]);
  S.preseason=false;S.transferWindow=0;
  S.sponsorLv=0; S.fans=0;
  const samples=[];
  for(let d=0; d<21; d++){
    S.trained=true;S.marketRefreshed=true;S._quietSave=true;
    const before=S.fund;
    nextDay(S);
    samples.push({day:S.day, delta:Math.round(S.fund-before), fund:Math.round(S.fund), mod:S.day%7});
  }
  return JSON.stringify({
    payWeeks:ECON.payWeeks,
    wageEvery:WAGE_EVERY,
    annualWage:weeklyWage(S),
    weeklyPay:Math.round(weeklyWage(S)/ECON.payWeeks),
    coachWage:S.coach&&S.coach.wage,
    weeklyWageFnIsAnnual: true,
    samples
  },null,2);
})()
`, dom);
console.log(out);
