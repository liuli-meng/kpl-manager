// Phase2：phase 枚举守卫 / nextDayStep 分层 / Command 入口 / aiCoach 剥离
const vm = require('vm');
const { makeDom, makeTester } = require('./harness');

function run() {
  const t = makeTester('phase2');
  const { dom } = makeDom();
  const out = vm.runInContext(`
(function(){
  const res=[];const fail=m=>res.push('[FAIL] '+m);const ok=m=>res.push('[OK] '+m);

  // 1) PHASES / setPhase 守卫
  try{
    if(typeof PHASES!=='object'||typeof setPhase!=='function')fail('phases missing');
    else{
      if(PHASES.R1!=='r1'||PHASES.PLAYOFF!=='playoff')fail('PHASES values');
      const s=newState('守卫队','G');s.phase='r1';
      let r=setPhase(s,'r2',{who:'t'});
      if(!r.ok)fail('r1->r2 应合法');
      else ok('r1->r2');
      r=setPhase(s,'annual',{who:'t'}); // r2 不能直接跳年总
      if(r.ok)fail('r2->annual 应拒绝');
      else if(r.reason!=='illegal-transition')fail('reason='+r.reason);
      else ok('illegal blocked');
      // force 放行（迁移钩子）
      r=setPhase(s,'annual',{who:'t',force:true});
      if(!r.ok||s.phase!=='annual')fail('force 应放行');
      else ok('force ok');
      // 同值幂等
      r=setPhase(s,'annual',{who:'t'});
      if(!r.ok)fail('同值应幂等');
      else ok('idempotent');
    }
  }catch(e){fail('phase throw '+e.message);}

  // 2) nextDayStep 与 nextDay 分层
  try{
    if(typeof nextDayStep!=='function'||typeof nextDay!=='function')fail('nextDay split missing');
    else{
      S=newState('日结队','D');
      fillRoster(S,'mid');S.coach={...COACH_POOL.find(c=>c.id==='co12')};
      S.lineup=S.players.map(p=>p.id);S.seedPower=teamPower(S);
      startSplit(S,'spring');S.preseason=false;S.transferWindow=0;
      const day0=S.day,fund0=S.fund;
      S._quietSave=true;
      nextDay(S); // quiet：不应 save（沙箱 save 不炸即可）
      if(S.day!==day0+1)fail('nextDay 未推进 day');
      else ok('nextDay advances day');
      delete S._quietSave;
      const r=Commands.nextDay(S);
      if(!r||!r.ok)fail('Commands.nextDay 失败 '+JSON.stringify(r));
      else if(S.day!==day0+2)fail('Command day='+S.day);
      else ok('Commands.nextDay');
    }
  }catch(e){fail('nextDay throw '+e.message);}

  // 3) Commands.advancePhase 守卫
  try{
    S=newState('推进队','A');fillRoster(S,'mid');
    S.coach={...COACH_POOL.find(c=>c.id==='co12')};
    S.lineup=S.players.map(p=>p.id);S.seedPower=teamPower(S);
    startSplit(S,'spring');S.preseason=false;S.transferWindow=0;
    // 非常规赛轮次应 skip
    S.phase='playoff';
    const r=Commands.advancePhase(S);
    if(r.ok)fail('playoff 不应 advancePhase');
    else if(r.reason.indexOf('not-in-round')<0)fail('reason='+r.reason);
    else ok('advancePhase guarded');
  }catch(e){fail('cmd throw '+e.message);}

  // 4) aiCoach 剥离：函数存在且不在 match.js 重复（静态审计另有；这里查可调用）
  try{
    if(typeof coachPickLineup!=='function'||typeof playerAutoSeries!=='function')fail('aiCoach missing');
    else ok('aiCoach present');
  }catch(e){fail('aiCoach throw '+e.message);}

  return res.join('\\n');
})()
`, dom);

  String(out).split('\n').forEach(line => {
    if (line.startsWith('[FAIL]')) t.check(false, line.slice(7));
    else if (line.startsWith('[OK]')) console.log('  ' + line);
  });
  if (t.errors.length) {
    t.errors.forEach(e => console.error('  ' + e));
    console.error('phase2: FAIL (' + t.errors.length + ')');
    process.exitCode = 1;
  } else {
    console.log('phase2: PASS');
  }
}
run();
