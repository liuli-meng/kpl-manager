// 终点验证：顶配豪门 200 天资金走向 + UI 周支出预估口径核对
const vm = require('vm');
const { makeDom, injectHelpers } = require('./../harness');
const { dom } = makeDom();
injectHelpers(dom);
vm.runInContext('this.Math=(function(a){var f=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};var M=Object.create(Math);M.random=f;return M;})(' + 42 + ')', dom);

console.log('ECON_SOFT_CAP 相关常量：');
console.log(vm.runInContext('[ECON_SOFT_CAP,ECON_COMMERCIAL_MAX_CUT,ECON_RESERVE_FEE_RATE,ECON_RESERVE_FEE_MAX].join(" / ")', dom));

const out = vm.runInContext(`
(function(){
  const res=[];
  function build(n,wage,sp,fans,fund){
    S=newState('豪门','豪门');S.preseason=false;S.transferWindow=0;S._quietSave=true;
    fillRoster(S,'star','star');
    let g=0;
    while(S.players.length<n&&g++<40)S.players.push(genPlayer(genFreeAgentDef(POS_ORDER[S.players.length%5],'star',new Set(S.players.map(p=>p.name)+g))));
    S.lineup=S.players.slice(0,5).map(p=>p.id);
    if(wage!=null)S.players.forEach(p=>p.wage=wage);
    S.players.forEach(p=>p.popularity=99);
    S.sponsorLv=sp;S.fans=fans;S.fund=fund;
  }
  // A. 不做任何经营动作（纯挂机）200 天
  build(12,350,3,600,80000);
  const a0=S.fund;
  for(let d=0;d<200;d++){S._quietSave=true;nextDay(S);}
  res.push('A 顶配豪门·纯挂机200天：'+Math.round(a0)+' → '+Math.round(S.fund)+'（Δ'+Math.round(S.fund-a0)+'）');

  // B. 每日有经营动作
  build(12,350,3,600,80000);
  const b0=S.fund;
  for(let d=0;d<200;d++){S.trained=true;S.marketRefreshed=true;S._quietSave=true;nextDay(S);}
  res.push('B 顶配豪门·每日经营200天：'+Math.round(b0)+' → '+Math.round(S.fund)+'（Δ'+Math.round(S.fund-b0)+'）');

  // C. UI 周支出预估口径：hdWeekCost 的构成
  build(12,350,3,600,80000);
  const hdWage=weeklyWage(S);
  const uiWeekCost=Math.round(hdWage/ECON.payWeeks)+clubOpsCost(S);
  const realRegularWeeklyBurn=clubOpsCost(S)+Math.round(hdWage/ECON.payWeeks);
  const realTotalWeeklyBurn=realRegularWeeklyBurn+cashReserveFee(S);
  res.push('C UI 显示「周支出」= 工资周结'+Math.round(hdWage/ECON.payWeeks)+' + 编制'+clubOpsCost(S)+' = '+uiWeekCost
    +'万  |  实际每周常规硬支出 = 编制'+clubOpsCost(S)+' + 工资'+Math.round(hdWage/ECON.payWeeks)+' = '+realRegularWeeklyBurn
    +'万（常规支出对齐：'+(realRegularWeeklyBurn/uiWeekCost).toFixed(2)+'x；加超额储备费 '+cashReserveFee(S)+'万后总支出 '+realTotalWeeklyBurn+'万）');
  return res.join('\\n');
})()
`, dom);
console.log('\n' + out);
