// 选秀大会回归：竞拍签位 / 点名 / 自家青训拦截 / 自留签 / K甲挂钩 / 面板
// 运行：node tests/verify-draft.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  function mkS(ptsMe){
    const s=newState('选秀队','⚔️');
    fillRoster(s,'mid');
    s.coach={...COACH_POOL.find(c=>c.id==='co12')};
    s.preseason=true;s.transferWindow=7;s.fund=2000;
    s.annualPts={};
    AI_TEAMS.forEach(t=>{s.annualPts[t.name]=150;});
    s.annualPts[s.teamName]=ptsMe||0; // 0=第一顺位弱队
    S=s;
    return s;
  }

  // ① 开局：竞拍阶段 + 池子
  const s1=mkS(0);
  const d1=initDraft(s1,true);
  if(!d1||!d1.pool||!d1.pool.length)fail('选秀池未生成');
  else if(d1.phase!=='auction'&&!d1.done)fail('应先进入竞拍阶段，实际 '+d1.phase);
  else if(d1.order[0]!==s1.teamName)fail('弱队应第一顺位');
  else if(d1.bid!==DRAFT_BID_TOP)fail('前8签应 '+DRAFT_BID_TOP+'万起拍，实际 '+d1.bid);
  else log('① 竞拍开局：池 '+d1.pool.length+' 人 · 第1签起拍 '+d1.bid+'万 · 弱队优先');

  // ② 竞拍真实收敛：玩家一路叫价必须能落定（历史 bug：误用 s.bid → NaN，签位永不落定、玩家反被顺位抢签）
  if(d1.phase!=='auction'||d1.order[0]!==s1.teamName)fail('开局应停在玩家竞拍（弱队第一顺位），实际 phase='+d1.phase+' order0='+d1.order[0]);
  else{
    let g=0,err='';
    while(d1.phase==='auction'&&g++<25){
      const f0=s1.fund;
      draftBidRaise(s1);
      if(!Number.isFinite(d1.bid)){err='叫价把竞拍价写成 NaN';break;}
      if(!Number.isFinite(s1.fund)){err='叫价把资金写成 NaN';break;}
      if(d1.bid<DRAFT_BID_TOP){err='竞拍价跌破起拍价（'+d1.bid+'）';break;}
      if(d1.phase==='auction'&&d1.leader===s1.teamName&&d1.passed[s1.teamName]){err='玩家既领先又已放弃';break;}
      if(s1.fund>f0){err='叫价反而加钱';break;}
    }
    if(err)fail('竞拍叫价异常：'+err);
    else if(d1.phase==='auction')fail('竞拍不收敛：'+g+' 次叫价后仍在 auction（领先='+d1.leader+' 价='+d1.bid+'）');
    else if(d1.phase!=='pick')fail('玩家拍得签后应进入点名，实际 '+d1.phase);
    else if(d1.leader!==s1.teamName)fail('点名阶段领先者应是玩家，实际 '+d1.leader);
    else log('② 竞拍收敛：第1签 '+d1.bid+'万成交给玩家 · 资金 '+s1.fund+'（'+g+' 次叫价）');
  }

  // ②b 点名
  if(d1.phase==='pick'){
    const n0=s1.players.length;
    const winBid=d1.bid;
    const t=d1.pool[0];
    draftPick(s1,t.id);
    if(!s1.players.some(p=>p.id===t.id))fail('点名后未入队');
    else if(s1.players.length!==n0+1)fail('一队人数未+1');
    else if(!d1.picks.length||d1.picks[0].team!==s1.teamName)fail('成交/点名记录未归玩家');
    else log('②b 点名：'+t.name+' 入队 · 已签 '+d1.picks.filter(x=>x.playerId).length+' 人 · 花费 '+winBid+'万');
  }

  // ③ 自家青训不可选
  const s3=mkS(0);
  const d3=initDraft(s3,true);
  const own=genDraftProspect(s3,99,new Set());
  own.fromClub=s3.teamName;
  own.id='drf_own_x';
  own.tags=(own.tags||[]).concat('青训出身');
  if(d3.phase!=='pick'){
    if(d3.phase==='auction')draftWinSlot(s3,s3.teamName,0);
  }
  d3.pool.unshift(own);
  const before3=s3.players.length;
  draftPick(s3,own.id);
  if(s3.players.some(p=>p.id===own.id))fail('仍可选自家青训');
  else if(s3.players.length!==before3)fail('拦截后名单不应变化');
  else log('③ 自家青训拦截 OK');

  // ④ 自留签：晋升消耗，用完拦截
  const s4=mkS(0);
  s4.academy=[];
  const mkRookie=()=>{
    const r=genPlayer(genFreeAgentDef('mid','mid',new Set((s4.players||[]).map(p=>p.name))));
    r.isRookie=true;r.tags=['青训'];r.age=18;
    r.attrs={lane:80,farm:80,team:80,mind:80};
    s4.academy.push(r);
    return r;
  };
  const r1=mkRookie(),r2=mkRookie(),r3=mkRookie();
  if(reserveLeft(s4)!==2)fail('开局自留签应为2，实际 '+reserveLeft(s4));
  else{
    promoteRookie(s4,r1.id);
    promoteRookie(s4,r2.id);
    const left=reserveLeft(s4);
    const nBefore=s4.players.length;
    promoteRookie(s4,r3.id);
    if(left!==0)fail('两次晋升后自留签应为0，实际 '+left);
    else if(s4.players.some(p=>p.id===r3.id))fail('自留签用完仍可晋升');
    else if(s4.players.length!==nBefore)fail('拦截后名单不应变化');
    else log('④ 自留签×2：前两个晋升成功，第三个被拦');
  }

  // ⑤ K甲挂钩：夺冠时 K甲前三档更多
  const s5=mkS(0);
  initKjia(s5);
  s5.kjia.champ=kjiaMyName(s5);
  const kj=draftKjiaTier(s5);
  if(kj.n<4)fail('二队夺冠后 K甲前三档应≥4，实际 '+kj.n);
  else log('⑤ K甲挂钩：二队夺冠 → K甲前三 '+kj.n+' 人 · 底子 '+kj.base);

  // ⑥ 面板
  const s6=mkS(0);
  initDraft(s6,true);
  let rErr='';let html='';
  try{goPage('market');html=document.querySelector('#page-market').innerHTML;}catch(e){rErr=e.message;}
  if(rErr)fail('转会页渲染异常: '+rErr);
  else if(!html.includes('选秀大会'))fail('缺选秀面板');
  else if(!html.includes('竞拍')&&!html.includes('点名'))fail('面板缺竞拍/点名提示');
  else if(/NaN/.test(html))fail('选秀面板出现 NaN（竞拍价/叫价文案坏了）');
  else log('⑥ 面板：含选秀大会（竞拍/点名）· 无 NaN');

  // ⑦ 全场放弃竞拍 → 签位必须归当前最高价者（不能「顺位免费」白送给别的队）
  const s7=mkS(0);
  const d7=initDraft(s7,true);
  const lead7=d7.order.filter(t=>t!==s7.teamName)[0];
  d7.order.filter(t=>t!==s7.teamName).slice(1).forEach(t=>{d7.passed[t]=true;});
  d7.passed[s7.teamName]=true;
  d7.leader=lead7;d7.bid=120;
  draftAiAuction(s7);
  const rec7=d7.picks[0];
  if(!rec7||rec7.team!==lead7)fail('全场放弃后签位应归领先者 '+lead7+'，实际 '+(rec7?rec7.team:'无'));
  else log('⑦ 全场放弃：第1签归领先者 '+lead7+'（'+d7.bid+'万，未白送）');

  // ⑧ 坏档修复：竞拍价被写成 NaN（老 bug 落盘后的产物）→ 归一化后仍可正常叫价
  const s8=mkS(0);
  const d8=initDraft(s8,true);
  d8.bid=NaN;d8.leader=null;
  draftRepair(s8,d8);
  if(!Number.isFinite(d8.bid)||d8.bid<DRAFT_BID_TOP)fail('draftRepair 未修好 NaN 竞拍价（'+d8.bid+'）');
  else{
    d8.leader=d8.order.filter(t=>t!==s8.teamName)[0];
    draftBidRaise(s8);
    if(!Number.isFinite(d8.bid)||!Number.isFinite(s8.fund))fail('坏档叫价仍会污染数值');
    else log('⑧ 坏档修复：NaN 竞拍价 → '+d8.bid+'万，叫价后 bid/资金均为有限数');
  }

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
