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

  // ② 玩家叫价 → 拍得签位 → 点名
  if(d1.phase==='pick'||d1.done){/* AI 已推进到我方点名或结束 */}
  else{
    // 强制我方叫价直到成交（AI 可能继续加）
    let g=0;
    while(d1.phase==='auction'&&g++<20){
      if(d1.leader===s1.teamName){
        // 等 AI 应价；若 AI 全 pass 则成交
        const alive=d1.order.filter(t=>!d1.passed[t]&&draftStillWant(s1,t));
        if(alive.length===1&&alive[0]===s1.teamName)break;
      }
      draftBidRaise(s1);
      if(d1.phase!=='auction')break;
    }
  }
  // 无论如何推进到可测点名：若仍在 auction 且我方是 leader 且仅剩自己，应已 win
  if(d1.phase==='auction'){
    // 手动成交给玩家以便测点名
    draftWinSlot(s1,s1.teamName,d1.bid);
  }
  if(d1.phase!=='pick')fail('拍得签后应进入点名，实际 '+d1.phase);
  else if(!d1.pool.length)fail('点名时池已空');
  else{
    const n0=s1.players.length;
    const t=d1.pool[0];
    draftPick(s1,t.id);
    if(!s1.players.some(p=>p.id===t.id))fail('点名后未入队');
    else if(s1.players.length!==n0+1)fail('一队人数未+1');
    else log('② 竞拍+点名：'+t.name+' 入队 · 已签 '+d1.picks.filter(x=>x.playerId).length+' 人');
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
  else log('⑥ 面板：含选秀大会（竞拍/点名）');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
