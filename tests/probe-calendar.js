// 赛季状态机探针：stepCalendar/pumpCalendar
const vm = require('vm');
const { makeDom, injectHelpers } = require('./harness');
const { dom } = makeDom();
injectHelpers(dom);
const out = vm.runInContext(`
(function(){
  const res=[],errs=[];
  const log=t=>res.push(t);
  const fail=m=>errs.push(m);
  S=newState('状态机','x');
  fillRoster(S,'star');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  S.seedPower=teamPower(S);
  startSplit(S,'spring');
  // 转会期：nextAction 应是 endPreseason
  const a0=nextAction(S);
  if(!a0||a0.type!=='endPreseason')fail('转会期 nextAction='+JSON.stringify(a0));
  else{
    const r=stepCalendar(S,null);
    if(!r.ok)fail('stepCalendar endPreseason 失败');
    else log('① 转会期 step '+r.action+' → phase='+r.after+' next='+(r.next&&r.next.type));
  }
  if(S.preseason)fail('转会期未结束');
  // 应进入 startMatch
  const a1=nextAction(S);
  if(!a1||a1.type!=='startMatch')fail('开赛后 nextAction='+JSON.stringify(a1));
  else{
    const r=stepCalendar(S,null);
    if(!S.series)fail('startMatch 未开 series');
    else log('② startMatch series='+S.series.stage+' mid='+S.series.mid);
    // 收掉本场
    S.series.mw=3;S.series.ow=1;finishSeries(true);
  }
  // pump 到季后赛/收官，series 出现就收
  const p=pumpCalendar(S,80);
  log('③ pump steps='+p.steps.length+' phase='+p.phase+' next='+(p.next&&p.next.type));
  let g=0;
  while(!['champion','eliminated'].includes(S.phase)&&g++<100){
    if(S.series){S.series.mw=Math.ceil(S.series.max/2);S.series.ow=1;finishSeries(true);continue;}
    const r=stepCalendar(S,null);
    if(!r.ok)break;
  }
  if(!['champion','eliminated'].includes(S.phase))fail('未能推到收官 phase='+S.phase);
  else log('④ 收官 phase='+S.phase+' next='+(nextAction(S)&&nextAction(S).type));
  return (errs.length?errs.map(e=>'[FAIL] '+e).join('\\n')+'\\n':'') + res.map(r=>'[INFO] '+r).join('\\n') + (errs.length?'\\n共 '+errs.length+' 失败':'\\n全部通过');
})()
`, dom);
console.log(out);
if (/\[FAIL\]/.test(out)) process.exitCode = 1;
