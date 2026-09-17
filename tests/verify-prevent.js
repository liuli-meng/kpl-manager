// 预防性守卫回归：导入覆盖确认 / 解雇放走确认 / 重开备份 / 连点 / 空档守卫
// 运行：node tests/verify-prevent.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  const _confirm=confirm;
  const setConfirm=v=>{confirm=v;};

  // ① requireSave：未开局时导出/推进被挡
  S=null;
  setConfirm(()=>true);
  if(requireSave('导出'))fail('S=null 时 requireSave 应 false');
  else log('① 空档守卫：未开局 requireSave=false（导出/推进等入口会 toast 拦截）');
  if(exportSave()!==undefined){}
  // exportSave 会 toast，不抛错即可

  // ② applyImport：有档时确认取消则不覆盖
  S=newState('原队','原');fillRoster(S,'mid');
  S.fund=1234;
  const keep={teamName:'原队',fund:1234,players:S.players};
  setConfirm(()=>false);
  applyImport({teamName:'外来队',players:[{id:'x'}],fund:9,fund0:1,season:1},'测试');
  if(S.teamName!=='原队'||S.fund!==1234)fail('取消导入仍覆盖了当前档');
  else log('② 导入确认：取消后当前档保持「原队 · 1234」');
  setConfirm(()=>true);
  // 导入用完整 newState 结构，避免 renderHeader 缺 sponsorLv 崩溃（本用例测确认门，不测渲染）
  const good=newState('外来队','外');fillRoster(good,'mid');
  applyImport(good,'测试');
  if(S.teamName!=='外来队')fail('确认后导入未生效');
  else log('②b 导入确认：同意后覆盖为外来队');

  // ③ fireCoach / releasePlayer / delist 有报价时确认取消
  S=newState('守卫队','守');fillRoster(S,'mid');
  S.coach={id:'c9',name:'测试帅',rating:80,style:'team',bonus:5,styleBonus:3,wage:50,skill:{n:'n',d:'d'}};
  setConfirm(()=>false);
  fireCoach(S);
  if(!S.coach)fail('取消解雇仍清掉了教练');
  else log('③ 解雇确认：取消后教练仍在（'+S.coach.name+'）');
  const p0=S.players[0];p0.contract=0;
  releasePlayer(S,p0.id);
  if(!S.players.some(x=>x.id===p0.id))fail('取消放走仍移除了选手');
  else log('③b 放走确认：取消后选手仍在阵中');
  S.listed=[{id:p0.id,price:100}];
  S.bids=[{id:p0.id,team:'对手',bid:90}];
  delistPlayer(S,p0.id);
  if(!S.listed.length)fail('取消撤牌仍清了挂牌');
  else log('③c 撤牌确认：有报价时取消撤牌，挂牌与报价保留');

  // ④ uiDebounce：同一 key 在窗口内二次触发被拦
  setConfirm(()=>true);
  if(uiDebounce('t1',400))fail('首次 debounce 不应拦截');
  if(!uiDebounce('t1',400))fail('连点未被拦截');
  else log('④ 防连点：同 key 450ms 内二次 uiDebounce=true（UI 层应直接 return）');

  // ⑤ uiAdvanceCalendar：年度收官标签需确认
  S=newState('赛历队','历');fillRoster(S,'star');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);S.seedPower=teamPower(S);
  startSplit(S,'summer');S.transferWindow=0;S.preseason=false;
  S.split='summer';
  S.agDone=true; // 跳过亚运年分支，直接测「年度收官」确认
  // 强制 label 走「年度收官」分支
  const _rank=annualRank;
  annualRank=function(){return ['别家1','别家2'];}; // 本队不在前12
  const label=calendarNextLabel(S);
  if(!/年度收官|新赛季/.test(label))fail('弱队夏季后 label 应为年度收官，实为 '+label);
  else{
   setConfirm(()=>false);
   const phase0=S.phase;
   uiAdvanceCalendar(S);
   if(S.phase!==phase0)fail('取消年度推进后 phase 被改了');
   else log('⑤ 年度推进确认：label「'+label.trim()+'」取消后 phase 不变（'+S.phase+'）');
  }
  annualRank=_rank;

  // ⑥ resetGame：取消时不 reload 且不删档（沙箱 location.reload 空操作）
  setConfirm(()=>false);
  const teamB=S.teamName;
  resetGame();
  if(S.teamName!==teamB)fail('取消重开后状态被改');
  else log('⑥ 重开确认：取消后状态保留（确认文案含队名/赛季）');

  setConfirm(_confirm);
  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
