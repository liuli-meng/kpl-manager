// 经营张力：赛段间董事会脉冲 + 现金流告急
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const ok=t=>res.push('[PASS] '+t);
  const _ra=renderAll,_sv=save;renderAll=function(){};save=function(){};

  // ① r1 分组落地：G1/S 强档 +3 / G2/A 中游 -1 / G3/B 弱档 -4
  S=newState('脉冲队','x');fillRoster(S,'mid');
  S.board={trust:60,kpi:null,warn:0,fired:false,firedSeason:0,log:[]};
  S.groups={G1:['脉冲队','甲','乙','丙','丁','戊'],G2:['a','b','c','d','e','f'],G3:['x','y','z','p','q','r']};
  boardMidSeasonPulse(S,'r1');
  const t1=S.board.trust;
  if(t1<=60)fail('① G1 强档应对信任 +3，实际 '+t1);
  else ok('① G1 强档开局信任 '+t1+'（+3）');

  S.board.trust=60;
  S.groups={G1:['甲','乙','丙','丁','戊','己'],G2:['a','b','c','d','e','f'],G3:['x','y','z','p','q','r','脉冲队']};
  boardMidSeasonPulse(S,'r1');
  const t2=S.board.trust;
  if(t2>=60)fail('① G3 弱档应对信任 -4，实际 '+t2);
  else ok('① G3 弱档开局信任 '+t2+'（-4）');

  S.board.trust=60;
  S.phase='r2';
  S.groups={S:['脉冲队','甲','乙','丙','丁','戊'],A:['a','b','c','d','e','f'],B:['x','y','z','p','q','r']};
  boardMidSeasonPulse(S,'r1');
  const t3=S.board.trust;
  if(t3<=60)fail('① S 组应对信任 +3，实际 '+t3);
  else ok('① S 组开局信任 '+t3+'（+3）');

  // ② 现金流告急：资金只够 1 周工资 → 信任掉；宽裕时不骚扰
  S=newState('现金队','x');fillRoster(S,'mid');
  S.board={trust:60,kpi:null,warn:0,fired:false,firedSeason:0,log:[]};
  S.fund=0;
  boardCashPulse(S);
  const t4=S.board.trust;
  if(t4>=60)fail('② 现金见底应对信任 -4，实际 '+t4);
  else ok('② 现金见底信任 '+t4+'（-4）');

  S.board.trust=60;S._cashWarnDay=0;S.day=10;
  S.fund=99999;
  boardCashPulse(S);
  const t5=S.board.trust;
  if(t5!==60)fail('② 宽裕时不应骚扰，实际 '+t5);
  else ok('② 资金宽裕时董事会不打扰（信任 60）');

  // ③ 选手生涯豁免
  S=newState('选手队','x');fillRoster(S,'mid');
  S.mode='player';
  S.board={trust:60,kpi:null,warn:0,fired:false,firedSeason:0,log:[]};
  S.fund=0;
  boardCashPulse(S);
  boardMidSeasonPulse(S,'r1');
  if(S.board.trust!==60)fail('③ 选手模式不应吃董事会脉冲，实际 '+S.board.trust);
  else ok('③ 选手生涯豁免董事会施压');

  renderAll=_ra;save=_sv;
  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; '));
  return res.join('\\n');
})()
`, dom);

console.log(out);
