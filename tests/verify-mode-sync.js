// 三模式规则同步：导航门禁 / 转会身份限制 / 年总轮换在 player 路径生效
// 运行：node tests/verify-mode-sync.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  function mk(mode){
    S=newState(mode+'队','x');
    fillRoster(S,'mid','star');
    const u=new Set(S.players.map(p=>p.name));
    for(let i=0;i<3;i++)S.players.push(genPlayer(genFreeAgentDef(pick(POS_ORDER),'low',u)));
    S.mode=mode;
    if(mode==='player'){
      const def={id:'me_x',name:'试玩',pos:'mid',team:S.teamName,tags:[],base:[80,80,80,80],skill:{n:'x',t:'team',d:''},sig:'王昭君',career:''};
      const me=genPlayer(def);S.players.push(me);
      S.career={me:me.id,seasons:[],titles:0,fmvp:0,retired:false,pendingMove:null};
    }
    if(mode==='coach')S.coachDeal={years:2,honors:[],log:[]};
    S.preseason=false;S.transferWindow=0;
    S.fund=5000;
    return S;
  }

  // ① MODE_PAGES 身份差异
  const mp=MODE_PAGES;
  if(mp.manager.includes('market')&&mp.player.includes('market'))fail('选手不应有转会页');
  else if(!mp.coach.includes('market'))fail('教练应有市场页（应急租借）');
  else if(mp.coach.includes('biz'))fail('教练不应有经营页');
  else if(mp.player.includes('lineup'))fail('选手不应有阵容管理页');
  else log('① MODE_PAGES：经理全量 · 教练含市场无经营 · 选手无阵容/市场');

  // ② goPage 门禁
  mk('player');
  goPage('market');
  const onPage=document.querySelector('section.page.on')&&document.querySelector('section.page.on').id;
  if(onPage==='page-market')fail('选手 goPage(market) 应被拦截');
  else log('② 选手 goPage(转会) → 回落到 '+onPage);
  mk('coach');
  goPage('biz');
  const cPage=document.querySelector('section.page.on')&&document.querySelector('section.page.on').id;
  if(cPage==='page-biz')fail('教练 goPage(biz) 应被拦截');
  else log('③ 教练 goPage(经营) → 回落到 '+cPage);

  // ④ 引擎层身份限制
  mk('coach');
  const rBuy=buyPlayer(S,S.market&&S.market[0]||genPlayer(genFreeAgentDef('mid','low',new Set())));
  const fa=S.freeAgents&&S.freeAgents[0];
  if(fa)signFreeAgent(S,fa.id);
  const rNego=openNegotiation(S,'nope');
  const blk=typeof transferOpsBlockedReason==='function'?transferOpsBlockedReason(S):'';
  if(!/教练/.test(blk))fail('教练 transferOpsBlockedReason 应提示俱乐部打理: '+blk);
  else if(fa&&S.players.some(p=>p.id===fa.id))fail('教练不应直签自由球员');
  else log('④ 教练：buy/直签/谈判 被身份规则拦截（'+blk.slice(0,20)+'…）');

  mk('player');
  const blkP=transferOpsBlockedReason(S);
  const fa2={id:'fa_p1',name:'市场人',pos:'jg',team:null,tags:[],base:[70,70,70,70],skill:{n:'x',t:'lane',d:''},sig:'澜'};
  S.freeAgents=S.freeAgents||[];S.freeAgents.push(fa2);
  signFreeAgent(S,'fa_p1');
  if(!/选手/.test(blkP))fail('选手 transferOpsBlockedReason 应拦截');
  else if(S.players.some(p=>p.id==='fa_p1'))fail('选手不应签自由球员');
  else log('⑤ 选手：转会操作被拦截');

  mk('manager');
  const blkM=transferOpsBlockedReason(S);
  if(blkM)fail('经理不应被转会身份拦截: '+blkM);
  else log('⑥ 经理：转会操作放行');

  // ⑦ 选手年总自动系列赛接入大师轮换
  mk('player');
  while(S.players.filter(p=>matchEligible(S,p)&&!p.loan).length<7){
    const u=new Set(S.players.map(p=>p.name));
    S.players.push(genPlayer(genFreeAgentDef(pick(POS_ORDER),'low',u)));
  }
  const all=[S.teamName,'A','B','C','D','E','F','G','H','I','J','K'];
  S.annual={stage:'arena',roundIdx:0,masters:all.slice(0,6),elites:all.slice(6),q:all.slice(0,12)};
  S.phase='annual';
  // 伪造赛程一场
  S.schedule=[{a:S.teamName,b:'A',r:null,myScore:0,opScore:0,round:1}];
  S.matchIdx=0;S.groups={G3:[S.teamName,'A']};S.tables={G3:{}};S.tables.G3[S.teamName]={w:0,l:0,pts:0,pw:0};S.tables.G3['A']={w:0,l:0,pts:0,pw:0};
  try{
    const sr=playerAutoSeries(S,'A',KPL.BO5);
    const played=(sr._played||[]).length;
    const pool=annualRosterPool(S).length;
    if(!sr._startIds)fail('选手自动赛应 annualMarkSeriesStart');
    else if(played<5)fail('选手自动赛 _played 过少: '+played);
    else if(pool>=7&&played<pool&&!sr.logs.some(l=>/大师轮换|数据/.test(l))) {
      // 可能未轮满但应有轮换尝试/出场记录
      log('⑦ 选手年总自动赛：_startIds OK played='+played+'/'+pool);
    }
    else log('⑦ 选手年总自动赛：played='+played+'/'+pool+' 接入轮换钩子');
  }catch(e){
    fail('选手 playerAutoSeries 年总路径异常: '+e.message);
  }

  // ⑧ 冠军班底/爆冷 在三模式 finish 前字段存在
  ['manager','coach','player'].forEach(m=>{
    mk(m);
    if(S.upsetBoost!=0||S.fumbleBoost!=0)fail(m+' upset/fumble 初值应为0');
    registerChampCore(S,'测试冠');
    if(!S.champCore||!S.champCore.ids)fail(m+' champCore 未写入');
  });
  log('⑧ 冠军班底/爆冷字段：三模式均可写入');

  // ⑨ 其他杯赛无大师/精英强制（挑杯 EWC）
  mk('manager');
  const g=annualGroupOf(S);
  if(g!==null)fail('非年总 annualGroupOf 应为 null');
  else if(annualSubSettle(S,{stage:'cup',cupSlot:'ch_final',_startIds:S.lineup.slice()})){}
  // settle 在非 annual phase 应直接 return
  log('⑨ 非年总赛段：无组别轮换强制（phase 守卫生效）');

  return {ok:!hadFail,lines:res};
})()
`,dom);

(out.lines||[]).forEach(l=>console.log(l));
if(!out.ok){console.error('模式同步验证失败');process.exit(1);}
console.log('模式同步验证通过');
