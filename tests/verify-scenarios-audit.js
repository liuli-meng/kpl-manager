// 五剧本完整审计：效果 vs 描述 / 与 KPL 硬规则交叉 / 开局日志一致性
// 运行：node tests/verify-scenarios-audit.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let failN=0;
  const fail=m=>{res.push('[FAIL] '+m);failN++;};
  const warn=m=>res.push('[WARN] '+m);
  const ok=m=>res.push('[PASS] '+m);
  const info=m=>res.push('[INFO] '+m);

  const IDS=['normal','debt','exodus','cap','cursed'];
  const rows=[];

  // ---- 用 createTeam 真开局链路跑五档 ----
  IDS.forEach(id=>{
    _scenario=id;
    document.querySelector('#new-team-name').value='审计-'+id;
    createTeam();
    const s=S;
    const sc=scenarioById(id);
    const ww=weeklyWage(s);
    const positions=POS_ORDER.filter(pos=>s.players.some(p=>p.pos===pos));
    const missing=POS_ORDER.filter(pos=>!s.players.some(p=>p.pos===pos));
    const morales=s.players.map(p=>p.morale);
    const avgMor=Math.round(morales.reduce((a,b)=>a+b,0)/Math.max(1,morales.length));
    const attrsFloor=s.players.every(p=>['lane','farm','team','mind'].every(k=>p.attrs[k]>=40));
    const fundLogged=(s.eventLog||[]).some(e=>/初始资金1300万/.test(e.txt||''));
    const scLogged=(s.eventLog||[]).some(e=>e.txt&&e.txt.indexOf('「'+sc.name+'」')>=0);
    const fundActual=s.fund, cap=s.wageCap;

    rows.push({
      id, name:sc.name, hard:sc.hard,
      fund:fundActual, wageCap:cap, weeklyWage:ww,
      overCap:ww>cap, overBy:Math.max(0,ww-cap),
      roster:s.players.length, missing:missing.map(p=>POS[p][0]),
      avgMorale:avgMor, minMorale:Math.min.apply(null,morales),
      maxMorale:Math.max.apply(null,morales),
      attrsFloor, fundLogged, scLogged,
      scenario:s.scenario,
      topOvr:Math.max.apply(null,s.players.map(p=>overall(p))),
      seedPower:s.seedPower
    });

    // 描述 vs 实现断言
    if(s.scenario!==id)fail(id+': scenario 未写入 ('+s.scenario+')');
    if(!scLogged)fail(id+': 事件日志未记录剧本名');
    if(id==='normal'){
      if(fundActual!==ECON.budgetMid)fail('normal: 资金应 '+ECON.budgetMid+'，实际 '+fundActual);
      if(cap!==ECON.wageCapDefault)fail('normal: 帽应 '+ECON.wageCapDefault+'，实际 '+cap);
    }
    if(id==='debt'){
      if(fundActual!==2000)fail('debt: 资金应 2000，实际 '+fundActual);
      if(cap!==1400)fail('debt: 帽应 1400，实际 '+cap);
    }
    if(id==='cap'){
      if(cap!==1200)fail('cap: 帽应 1200，实际 '+cap);
      if(fundActual!==ECON.budgetMid)fail('cap: 资金应保持默认 '+ECON.budgetMid+'，实际 '+fundActual);
    }
    if(id==='exodus'){
      if(s.players.length!==4)fail('exodus: 应 4 人，实际 '+s.players.length);
      if(missing.length!==1)fail('exodus: 应恰好空 1 位，实际 '+JSON.stringify(missing));
      if(s.lineup.length!==4)fail('exodus: 首发应 4 人，实际 '+s.lineup.length);
    }
    if(id==='cursed'){
      // 描述写「初始士气 50」——必须检查
      if(!s.players.every(p=>p.morale===50)){
        fail('cursed: 描述写「初始士气 50」，但实现未设 morale=50（实际 min='+Math.min.apply(null,morales)+' avg='+avgMor+'）');
      }
      if(!attrsFloor)fail('cursed: 属性跌破下限 40');
    }
    // 日志硬编码「初始资金1300万」与 debt 档矛盾
    if(id==='debt'&&fundLogged)fail('debt: 开局日志仍写「初始资金1300万」，与实际 330 矛盾');
  });

  // ---- 输出对照表 ----
  info('===== 五剧本开局对照 =====');
  info('id | 名称 | 资金 | 帽 | 周薪 | 超帽 | 人数 | 空缺 | 士气avg/min/max | 战力种子 | 最高总值');
  rows.forEach(r=>{
    info([
      r.id,r.name,r.fund,r.wageCap,r.weeklyWage,
      r.overCap?('超'+r.overBy):'帽内',
      r.roster+(r.missing.length?('缺'+r.missing.join('/')):''),
      r.avgMorale+'/'+r.minMorale+'/'+r.maxMorale,
      r.seedPower,r.topOvr
    ].join(' | '));
  });

  // ---- 与 KPL 硬规则交叉 ----
  info('===== 与 KPL 五条硬规则交叉 =====');
  // ① 转会费封顶 1500：五档都应遵守（封顶是联盟规则，不因剧本改变）
  if(TRANSFER_CAP!==ECON.transferCap)fail('TRANSFER_CAP 不是 ECON.transferCap');
  else ok('① 转会费 1.2 亿封顶：五档共用，剧本不改（TRANSFER_CAP 全局）');

  // ② 大名单 ≤10：exodus 开局 4 人，转会期可补；满员后仍应拦截
  _scenario='exodus';document.querySelector('#new-team-name').value='x';createTeam();
  while(S.players.length<10){
    const pos=POS_ORDER.find(pp=>true);
    const u=new Set(S.players.map(p=>p.name));
    const cand=genPlayer(genFreeAgentDef(pos,'mid',u));
    S.players.push(cand);
  }
  if(S.players.length!==10)fail('无法预置满员: '+S.players.length);
  else{
    const victim=genPlayer(genFreeAgentDef('mid','mid',new Set()));
    S.market=[victim];
    const c0=S.players.length,f0=S.fund;
    const bought=buyPlayer(S,victim);
    if(bought||S.players.length!==c0)fail('② 大名单守卫在 exodus 满员后失效');
    else ok('② 大名单 ≤10：exodus 满员补人后买断仍被拦（守卫与剧本无冲突）');
  }

  // ③ 卖出半数：exodus 已少 1 人，半数应按当前名单
  _scenario='exodus';createTeam();
  const halfExodus=Math.floor(S.players.length/2); // 4→2
  S.windowSold=halfExodus;
  if(sellGuard(S))fail('③ 卖出半数：名单'+S.players.length+'人 sold='+halfExodus+' 仍放行');
  else{
    S.windowSold=halfExodus-1;
    if(!sellGuard(S))fail('③ 卖出半数：名单'+S.players.length+'人 sold='+(halfExodus-1)+' 被误拦');
    else ok('③ 卖出半数：exodus 名单 4 人 → 半数 '+halfExodus+'，sellGuard 按当前名单计算（与剧本一致）');
  }

  // ④ 顶薪 70：五档不改顶薪
  if(PLAYER_WAGE_MAX!==ECON.playerWageMax)fail('PLAYER_WAGE_MAX 不是 ECON.playerWageMax');
  else ok('④ 顶薪 70：五档共用，剧本不改工资上限');

  // ⑤ 奖金 70/30：五档不改分成
  const s5=newState('奖金队','x');fillRoster(s5,'mid','star');S=s5;
  const fBefore=S.fund;
  grantPrize(S,60);
  if(S.fund-fBefore!==18)fail('⑤ 奖金分成不是 30%: '+(S.fund-fBefore));
  else ok('⑤ 奖金 70/30：五档共用，剧本不改分成');

  // ---- 特殊交叉：debt/cap 开局即超帽 ----
  info('===== 开局超帽（工资帽剧本 vs 奢侈税规则） =====');
  ['debt','cap','normal'].forEach(id=>{
    const r=rows.find(x=>x.id===id);
    if(r.overCap)warn(id+': 开局周薪 '+r.weeklyWage+' > 帽 '+r.wageCap+'（超 '+r.overBy+'），发薪日将缴 60% 奢侈税 '+Math.round(r.overBy*0.6)+'万——若设计如此可接受，否则是初始值矛盾');
    else info(id+': 开局帽内（'+r.weeklyWage+'/'+r.wageCap+'）');
  });

  // ---- 执教原版 + 难剧本：是否会覆盖豪门预算 ----
  info('===== 剧本 × 执教原版交叉 =====');
  try{
    _scenario='debt';
    // 模拟：先建默认队，再手动 applyScenario 看是否覆盖
    const sB=newState('原版豪门','AG');fillRoster(sB,'star','star');
    sB.fund=5000;sB.wageCap=200; // 假豪门
    applyScenario(sB);
    if(sB.fund!==2000||sB.wageCap!==1400)fail('applyScenario 未覆盖豪门预算: fund='+sB.fund+' cap='+sB.wageCap);
    else warn('执教原版也会被难剧本覆盖预算（debt 将 5000/200 → 330/120）——若 UI 未提示，玩家可能误以为是 bug');
  }catch(e){fail('执教原版交叉异常: '+e.message);}

  // ---- 成就不串档（五档全测） ----
  info('===== 五档成就互斥 =====');
  IDS.forEach(id=>{
    const s=newState('成就队','x');fillRoster(s,'mid','star');
    s.scenario=id;s.honors=[{season:1,title:'x',champion:true}];
    checkAchievements(s);
    const unlocked=Object.keys(s.achieved).filter(k=>k.indexOf('sc_')===0);
    const expect=id==='normal'?[]:['sc_'+id];
    if(JSON.stringify(unlocked.sort())!==JSON.stringify(expect.sort())){
      fail('成就串档 '+id+': 解锁 '+JSON.stringify(unlocked)+' 期望 '+JSON.stringify(expect));
    }
  });
  ok('成就互斥：五档夺冠仅解锁对应 sc_*，normal 不解锁');

  return res.join('\\n')+(failN?'\\n\\n=== 共 '+failN+' 处矛盾/失败 ===':'\\n\\n=== 五剧本与硬规则交叉全部通过 ===');
})()
`, dom);

console.log(out);
if (/\[FAIL\]/.test(out)) process.exitCode = 1;
