// 回归探针：转会期结束后能否正常开赛（经理/教练/选手）
const vm = require('vm');
const { makeDom, injectHelpers } = require('./harness');

const { dom } = makeDom();
injectHelpers(dom);

const out = vm.runInContext(`
(function(){
  const res=[],errs=[];
  const log=t=>res.push(t);

  function prepManager(){
    S=newState('开赛探针','x');
    fillRoster(S,'mid','star');
    S.coach={...COACH_POOL.find(c=>c.id==='co12')};
    S.lineup=S.players.map(p=>p.id);
    S.seedPower=teamPower(S);
    initGroups(S);
    S.preseason=true;S.transferWindow=3;
    buildTransferMarket(S);refreshMarket(S);
  }
  function endWindow(){
    S.preseason=true;S.transferWindow=1;
    for(let i=0;i<5&&S.preseason;i++)nextDay(S);
    return {preseason:S.preseason,window:S.transferWindow,phase:S.phase,matchIdx:S.matchIdx,sched:(S.schedule||[]).length,series:!!S.series};
  }

  // ① 正常五位置
  prepManager();
  const a=endWindow();
  if(a.preseason)errs.push('① 窗耗尽仍 preseason window='+a.window);
  if(a.sched<1)errs.push('① 无赛程');
  let err=null;
  try{startMatch();}catch(e){err=e;}
  if(err)errs.push('① startMatch 抛错: '+err.message);
  else if(!S.series)errs.push('① startMatch 未建立 series');
  else log('① 经理转会期结束→开赛 OK phase='+S.phase+' series='+S.series.stage);

  // ② 空一个位置：窗耗尽应补签并开赛
  prepManager();
  const hole=S.players[S.players.length-1];
  S.players=S.players.filter(p=>p.id!==hole.id);
  S.lineup=S.lineup.filter(id=>id!==hole.id);
  const b=endWindow();
  if(b.preseason)errs.push('② 缺位未自动补/未开赛 window='+b.window+' roster='+S.players.length);
  else log('② 缺位自动补签后开赛 roster='+S.players.length+' window='+b.window);

  // ③ 常规赛打完 5 轮后 matchIdx 越界
  prepManager();endWindow();
  S.matchIdx=(S.schedule||[]).length;
  const c1=S.schedule[S.matchIdx];
  try{startMatch();}catch(e){err=e;}
  log('③ matchIdx 越界: m='+!!c1+' series='+!!S.series+' toast路径'+(err?('抛错'+err.message):'无抛错'));

  // ④ 残留 series + 新比赛
  prepManager();endWindow();
  S.series={used:[],usedOpp:[],mw:0,ow:0,max:5,stage:'regular',logs:[],myName:S.teamName,opName:S.schedule[0].opp,side:'blue'};
  try{startMatch();}catch(e){err=e;}
  log('④ 残留series 恢复: '+(S.series&&S.series.stage));

  // ⑤ 教练模式开局（无转会期）应能直接打
  S=newState('教练探针','x');
  fillRoster(S,'mid','star');
  S.mode='coach';
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  S.seedPower=teamPower(S);
  S.preseason=false;S.transferWindow=0;
  initGroups(S);
  try{startMatch();}catch(e){err=e;}
  if(err)errs.push('⑤ 教练开赛抛错: '+err.message);
  else if(!S.series)errs.push('⑤ 教练无 series');
  else log('⑤ 教练无转会期直接开赛 OK');

  // ⑥ 面板：转会期后应有比赛按钮
  prepManager();endWindow();
  let html='';
  try{html=clubLeaguePhasePanel();}catch(e){err=e;}
  if(err)errs.push('⑥ 面板抛错: '+err.message);
  else if(!html||!html.includes('uiStartMatch'))errs.push('⑥ 面板无开赛按钮 len='+html.length);
  else log('⑥ clubLeaguePhasePanel 含开赛按钮');

  // ⑦ 淘汰后赛历：playoff 缺失时 setupChallenger 应能补完并进挑杯
  prepManager();endWindow();
  S.phase='eliminated';
  S.playoff=null;
  try{setupChallenger(S);}catch(e){err=e;}
  if(err)errs.push('⑦ setupChallenger 抛错: '+err.message);
  else if(S.phase!=='challenger'&&!S.challenger)errs.push('⑦ 未进入挑杯 phase='+S.phase+' champ='+(S.playoff&&S.playoff.final&&S.playoff.final.r));
  else log('⑦ 淘汰+无playoff → 挑杯仍可开 phase='+S.phase+' champ='+(S.playoff&&S.playoff.final&&S.playoff.final.r));

  return (errs.length?errs.map(e=>'[FAIL] '+e).join('\\n')+'\\n':'') + res.map(r=>'[INFO] '+r).join('\\n') + (errs.length?'\\n共 '+errs.length+' 失败':'\\n全部通过');
})()
`, dom);

console.log(out);
if (/\[FAIL\]/.test(out)) process.exitCode = 1;
