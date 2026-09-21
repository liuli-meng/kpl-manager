// 年总替补轮换：大师组强制/名单/换人不限 vs 精英组不强制/中途仅1次
// 运行：node tests/verify-annual-sub.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  function mkInAnnual(group){
    S=newState('年总队','x');
    fillRoster(S,'mid','star');
    // 补替补
    const u=new Set(S.players.map(p=>p.name));
    for(let i=0;i<3;i++)S.players.push(genPlayer(genFreeAgentDef(pick(POS_ORDER),'low',u)));
    S.preseason=false;S.transferWindow=0;
    // 伪造年总状态与分组
    const all=[S.teamName,'A','B','C','D','E','F','G','H','I','J','K'];
    const masters=group==='masters'?all.slice(0,6):['A','B','C','D','E','F'];
    const elites=group==='masters'?all.slice(6,12):(group==='elites'?['A','B','C','D','E',S.teamName]:['A','B','C','D','E','F','G','H','I','J','K','L'].slice(0,12));
    if(group==='elites'&&!elites.includes(S.teamName))elites[5]=S.teamName;
    S.annual={stage:'arena',roundIdx:0,masters,elites,q:all.slice(0,12)};
    S.phase='annual';
    return S;
  }

  // ① 分组判定
  mkInAnnual('masters');
  if(annualGroupOf(S)!=='masters')fail('应识别为 masters，实际 '+annualGroupOf(S));
  else log('① 大师组识别 OK');
  mkInAnnual('elites');
  if(annualGroupOf(S)!=='elites')fail('应识别为 elites');
  else log('② 精英组识别 OK');

  // ③ 规则文本
  mkInAnnual('masters');
  const tM=annualSubRuleText(S);
  mkInAnnual('elites');
  const tE=annualSubRuleText(S);
  if(!/大师组/.test(tM)||!/7 人|全员出场|至少/.test(tM))fail('大师组文案异常: '+tM);
  else if(!/精英组/.test(tE)||!/1/.test(tE))fail('精英组文案异常: '+tE);
  else log('③ 规则文案：'+tM.slice(0,40)+'… / '+tE.slice(0,40)+'…');

  // ④ 大师组名单守卫：不足时不再拦死年总（返回 true + 紧急补人）
  mkInAnnual('masters');
  S.players=S.players.filter((p,i)=>i<5); // 只剩5健康
  S.lineup=S.players.map(p=>p.id);
  if(annualSubGuard(S)!==true)fail('大师组名单不足也应放行年总（防卡死），实际 '+annualSubGuard(S));
  else log('④ 大师组名单不足：警告但放行（不卡死年总）');
  mkInAnnual('masters');
  if(annualSubGuard(S)!==true)fail('大师组≥6人应放行');
  else log('⑤ 大师组名单充足：放行');

  // ⑥ 精英组名单不强制6人
  mkInAnnual('elites');
  S.players=S.players.filter((p,i)=>i<5);
  S.lineup=S.players.map(p=>p.id);
  if(annualSubGuard(S)!==true)fail('精英组不应因5人被拦');
  else log('⑥ 精英组5人可出战（无深度强制）');

  // ⑦ 大师组：名单未全员出场 → 惩罚日志
  mkInAnnual('masters');
  while(S.players.filter(p=>matchEligible(S,p)&&!p.loan).length<7){
    const u=new Set(S.players.map(p=>p.name));
    S.players.push(genPlayer(genFreeAgentDef(pick(POS_ORDER),'low',u)));
  }
  const nPool=annualRosterPool(S).length;
  const sr={used:[],mw:2,ow:0,stage:'cup',cupSlot:'arena_r1',opName:'X',logs:[]};
  annualMarkSeriesStart(S,sr);
  const logBase=(S.logs||[]).length+(S.eventLog||[]).length;
  annualSubSettle(S,sr);
  const allLogs=[
    ...(S.logs||[]),
    ...(S.eventLog||[]),
  ].map(x=>typeof x==='string'?x:(x&&(x.txt||x.text||x.msg))||'');
  const hit=allLogs.some(t=>/未全员出场|大师轮换/.test(t));
  const playedN=(sr._played||[]).length;
  if(playedN>=nPool)fail('首发5人不应覆盖'+nPool+'人名单 played='+playedN);
  else if(!hit)fail('应写入大师轮换处罚日志 played='+playedN+'/'+nPool+' logs='+allLogs.slice(-3).join('|'));
  else log('⑦ 大师组名单未全员出场：played='+playedN+'/'+nPool+' 已处罚');

  // ⑧ 模拟打满 BO5 自动轮换直至名单出场
  mkInAnnual('masters');
  while(S.players.filter(p=>matchEligible(S,p)&&!p.loan).length<7){
    const u=new Set(S.players.map(p=>p.name));
    S.players.push(genPlayer(genFreeAgentDef(pick(POS_ORDER),'low',u)));
  }
  const sr2={used:[],mw:0,ow:0,stage:'cup',cupSlot:'arena_r2',logs:[]};
  annualMarkSeriesStart(S,sr2);
  for(let g=0;g<5;g++){
    annualMarkPlayed(S,sr2);
    annualAutoRotate(S,sr2);
    // 模拟当局结束（比分随便）
    sr2.mw=Math.min(3,sr2.mw+(g%2===0?1:0));
  }
  annualMarkPlayed(S,sr2);
  const pool2=annualRosterPool(S);
  const played2=new Set(sr2._played||[]);
  const miss=pool2.filter(p=>!played2.has(p.id));
  if(miss.length)fail('BO5 自动轮换后仍缺出场: '+miss.map(p=>p.name).join(','));
  else log('⑧ 大师组 BO5 自动轮换：名单 '+pool2.length+' 人已全员出场');

  // ⑨ 精英组不强制
  mkInAnnual('elites');
  const sr3={used:[],mw:1,ow:0,stage:'cup',logs:[]};
  annualMarkSeriesStart(S,sr3);
  const m0=S.lineup.map(id=>S.players.find(p=>p.id===id).morale);
  annualSubSettle(S,sr3);
  const m1=S.lineup.map(id=>S.players.find(p=>p.id===id).morale);
  if(m1.some((v,i)=>v<m0[i]-1))fail('精英组未轮换不应扣士气');
  else log('⑨ 精英组未轮换：无惩罚');

  // ⑩ 换人上限
  if(annualSubRule('elites').maxSwaps!==1)fail('精英组 maxSwaps 应为1');
  else if(annualSubRule('masters').maxSwaps<10)fail('大师组换人应不限次');
  else log('⑩ 换人名额：精英组1次 / 大师组不限');

  // ⑪ 文案含「7 人」
  mkInAnnual('masters');
  const tMasterTxt=annualSubRuleText(S);
  if(!/7 人大名单|全员出场/.test(tMasterTxt))fail('大师组文案应对齐官方: '+tMasterTxt);
  else log('⑪ 文案对齐官方：'+tMasterTxt.slice(0,50)+'…');

  return {ok:!hadFail,lines:res};
})()
`,dom);

(out.lines||[]).forEach(l=>console.log(l));
if(!out.ok){console.error('年总替补轮换验证失败');process.exit(1);}
console.log('年总替补轮换验证通过');
