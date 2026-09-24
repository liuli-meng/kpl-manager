// 状态门面 / 权限 / 导入 schema / 崩溃快照 门禁
const vm = require('vm');
const { makeDom, makeTester } = require('./harness');

function run() {
  const t = makeTester('statestore');
  const { dom } = makeDom();

  const out = vm.runInContext(`
(function(){
  const res=[];const fail=m=>res.push('[FAIL] '+m);const ok=m=>res.push('[OK] '+m);

  // 1) StateStore 基础
  try{
    if(typeof StateStore!=='undefined'&&typeof getState==='function'&&typeof setState==='function'&&typeof patchState==='function'){
      ok('stateStore exports');
      S=newState('测试队','T');
      setState(S,{who:'test'});
      patchState({fund:999},{who:'test-patch',note:'fund'});
      if(S.fund!==999)fail('patchState 未写入 fund');
      else ok('patchState writes S');
      if(getState()!==S)fail('getState 不是 S');
      else ok('getState');
    }else fail('stateStore missing');
  }catch(e){fail('stateStore throw '+e.message);}

  // 2) 崩溃快照
  try{
    if(typeof writeCrashSnapshot==='function'){
      S=newState('快照队','X');S.season=3;S.phase='r1';
      writeCrashSnapshot('unit-test', new Error('boom'));
      const snap=StateStore.readCrashSnapshot();
      if(!snap||snap.tag!=='unit-test')fail('crash snapshot missing');
      else if(!snap.msg||snap.msg.indexOf('boom')<0)fail('crash snapshot msg');
      else ok('crash snapshot');
      StateStore.clearCrashSnapshot();
    }else fail('writeCrashSnapshot missing');
  }catch(e){fail('crash throw '+e.message);}

  // 3) 权限矩阵
  try{
    if(typeof canOperate!=='function'||typeof blockReason!=='function')fail('permission missing');
    else{
      const mgr=newState('经理','M');mgr.mode='manager';
      const co=newState('教练','C');co.mode='coach';
      const pl=newState('选手','P');pl.mode='player';
      const checks=[
        [canOperate('buyPlayer',mgr),true,'mgr buy'],
        [canOperate('buyPlayer',co),false,'coach buy'],
        [canOperate('buyPlayer',pl),false,'player buy'],
        [canOperate('manageLineup',mgr),true,'mgr lineup'],
        [canOperate('manageLineup',co),true,'coach lineup'],
        [canOperate('manageLineup',pl),false,'player lineup'],
        [canOperate('playerTrain',pl),true,'player train'],
        [canOperate('startMatch',co),true,'coach startMatch'],
        [canOperate('startMatch',pl),false,'player startMatch'],
        [canOperate('draft',mgr),true,'mgr draft'],
        [canOperate('draft',co),false,'coach draft'],
      ];
      checks.forEach(c=>{if(c[0]!==c[1])fail(c[2]+' expect '+c[1]);});
      if(!blockReason('buyPlayer',pl))fail('blockReason empty');
      else ok('permission matrix');
    }
  }catch(e){fail('permission throw '+e.message);}

  // 4) sanitizeImport schema
  try{
    if(typeof sanitizeImport!=='function')fail('sanitizeImport missing');
    else{
      const dirty={teamName:'导入队',players:'nope',lineup:123,fund:NaN,
        __proto__:{x:1}, evil:function(){return 1;},
        players2:[{id:'p1',name:'甲'},{id:'',name:'乙'},null,'str', {id:'p2',fn:function(){}}]};
      // 用真实 players 数组
      const o={teamName:'T',players:[{id:'p1',name:'甲',fn:()=>1},{id:'',name:'乙'},null,{id:'p2',name:'丙'}],lineup:'bad',fund:NaN,keep:'ok'};
      sanitizeImport(o);
      if(!Array.isArray(o.players))fail('players not array after');
      else if(o.players.length!==2)fail('players filter expect 2 got '+o.players.length);
      else if(o.players.some(p=>p.fn))fail('fn field survived');
      else if(!Array.isArray(o.lineup))fail('lineup not coerced');
      else if(o.fund!=null&&typeof o.fund==='number'&&!isFinite(o.fund))fail('NaN fund survived');
      else ok('sanitizeImport schema');
    }
  }catch(e){fail('sanitize throw '+e.message);}

  // 5) 静态表冻结 + 可变池未冻结
  try{
    if(typeof ECON==='object'&&Object.isFrozen(ECON))ok('ECON frozen');
    else fail('ECON not frozen');
    if(typeof PLAYER_POOL==='object'&&!Object.isFrozen(PLAYER_POOL))ok('PLAYER_POOL mutable');
    else fail('PLAYER_POOL should stay mutable for installEra');
  }catch(e){fail('freeze throw '+e.message);}

  // 6) gameLog
  try{
    if(typeof gameLog!=='undefined'){
      gameLog.warn('unit','hello',{a:1});
      const dump=gameLog.dump();
      if(!dump.length)fail('gameLog empty after warn');
      else ok('gameLog');
    }else fail('gameLog missing');
  }catch(e){fail('gameLog throw '+e.message);}

  return res.join('\\n');
})()
`, dom);

  String(out).split('\n').forEach(line => {
    if (line.startsWith('[FAIL]')) t.check(false, line.slice(7));
    else if (line.startsWith('[OK]')) console.log('  ' + line);
  });

  if (t.errors.length) {
    t.errors.forEach(e => console.error('  ' + e));
    console.error('statestore: FAIL (' + t.errors.length + ')');
    process.exitCode = 1;
  } else {
    console.log('statestore: PASS');
  }
}

run();
