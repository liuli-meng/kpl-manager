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
  /* 统一口径后的竞拍动作：能叫则叫，超 draftTeamMaxBid 则放弃（原先玩家可砸光 s.fund，
     现在玩家与 AI 同一 cap——测试侧必须按新规则跟价/弃权，而不是无脑 draftBidRaise）。 */
  function bidOrPass(s){
    const d=s.draft;
    const max=draftTeamMaxBid(s,s.teamName,d.slot);
    const nxt=d.leader?d.bid+DRAFT_BID_STEP:d.bid;
    if(nxt>max){draftBidPass(s);return 'pass';}
    draftBidRaise(s);
    return 'raise';
  }

  // ① 开局：竞拍阶段 + 池子
  const s1=mkS(0);
  const d1=initDraft(s1,true);
  if(!d1||!d1.pool||!d1.pool.length)fail('选秀池未生成');
  else if(d1.phase!=='auction'&&!d1.done)fail('应先进入竞拍阶段，实际 '+d1.phase);
  else if(d1.order[0]!==s1.teamName)fail('弱队应第一顺位');
  else if(d1.bid!==DRAFT_BID_TOP)fail('前8签应 '+DRAFT_BID_TOP+'万起拍，实际 '+d1.bid);
  else log('① 竞拍开局：池 '+d1.pool.length+' 人 · 第1签起拍 '+d1.bid+'万 · 弱队优先');

  // ② 竞拍真实收敛：玩家按统一上限跟价/弃权后必须落定（历史 bug：误用 s.bid → NaN，签位永不落定、玩家反被顺位抢签）
  // 测试变更：原先只 draftBidRaise 一路砸到底（可越过 25%/意愿 cap）；现在超 cap 走 bidOrPass 放弃，
  // 与引擎新规则（玩家 max==AI max）一致，不再弱化引擎上限。
  if(d1.phase!=='auction'||d1.order[0]!==s1.teamName)fail('开局应停在玩家竞拍（弱队第一顺位），实际 phase='+d1.phase+' order0='+d1.order[0]);
  else{
    let g=0,err='';
    while(d1.phase==='auction'&&g++<25){
      const f0=s1.fund;
      bidOrPass(s1);
      if(!Number.isFinite(d1.bid)){err='叫价把竞拍价写成 NaN';break;}
      if(!Number.isFinite(s1.fund)){err='叫价把资金写成 NaN';break;}
      if(d1.bid<DRAFT_BID_TOP){err='竞拍价跌破起拍价（'+d1.bid+'）';break;}
      if(d1.phase==='auction'&&d1.leader===s1.teamName&&d1.passed[s1.teamName]){err='玩家既领先又已放弃';break;}
      if(s1.fund>f0){err='叫价反而加钱';break;}
      if(d1.phase==='auction'&&s1.fund!==f0){err='叫价阶段改动了资金（只应在 draftWinSlot 扣款）';break;}
    }
    if(err)fail('竞拍叫价异常：'+err);
    else if(d1.phase==='auction')fail('竞拍不收敛：'+g+' 次叫价后仍在 auction（领先='+d1.leader+' 价='+d1.bid+'）');
    else if(d1.phase!=='pick'&&d1.phase!=='done'&&d1.phase!=='auction')fail('竞拍结束后 phase 异常：'+d1.phase);
    else if(d1.phase==='pick'&&d1.leader!==s1.teamName)fail('点名阶段领先者应是玩家，实际 '+d1.leader);
    else log('② 竞拍收敛：第1签 '+d1.bid+'万成交（leader='+d1.leader+'）· 资金 '+s1.fund+'（'+g+' 次动作）');
  }

  // ②b 点名（若 ② 里玩家被更高上限的 AI 击败，则本段跳过——收敛性已由 ② 断言）
  if(d1.phase==='pick'&&d1.leader===s1.teamName){
    const n0=s1.players.length;
    const winBid=d1.bid;
    const t=d1.pool[0];
    draftPick(s1,t.id);
    if(!s1.players.some(p=>p.id===t.id))fail('点名后未入队');
    else if(s1.players.length!==n0+1)fail('一队人数未+1');
    else if(!d1.picks.length||d1.picks[0].team!==s1.teamName)fail('成交/点名记录未归玩家');
    else log('②b 点名：'+t.name+' 入队 · 已签 '+d1.picks.filter(x=>x.playerId).length+' 人 · 花费 '+winBid+'万');
  }else log('②b 点名：本签非玩家成交，跳过');

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

  // ⑨ 点名/放弃必须落盘 + 刷新（曾经两者都没有 save/renderAll：点完画面纹丝不动、刷新即丢）
  for(const act of ['draftPick','draftSkip']){
    const s9=mkS(0);const d9=initDraft(s9,true);
    let g9=0;while(d9.phase==='auction'&&g9++<25)bidOrPass(s9);
    if(d9.phase!=='pick'){fail('⑨ 未进入点名阶段，无法验证 '+act);continue;}
    let nSave=0,nRender=0;
    const oSave=save,oRender=renderAll;
    save=function(){nSave++;return oSave.apply(null,arguments);};
    renderAll=function(){nRender++;return oRender.apply(null,arguments);};
    try{if(act==='draftPick')draftPick(s9,d9.pool[0].id);else draftSkip(s9);}
    finally{save=oSave;renderAll=oRender;}
    if(!nSave||!nRender)fail('⑨ '+act+' 未落盘/未刷新（save='+nSave+' render'+nRender+'）');
    else log('⑨ '+act+'：落盘 '+nSave+' 次 · 刷新 '+nRender+' 次');
  }

  // ⑩ 选秀池必须走全局查重（漏市场/自由市场/转会名单/新星 def 会撞名，撞名会把 AI def 误剔除）
  const s10=mkS(0);
  s10.extraDefs=[{id:'xd1',name:'青禾',pos:'mid'}];
  s10.market=[{id:'xd2',name:'白榆',pos:'ad'}];
  s10.transferList=[{id:'xd3',name:'赤霄',pos:'top'}];
  s10.freeAgents=[{id:'xd4',name:'玄同',pos:'sup'}];
  const d10=initDraft(s10,true);
  const names10=d10.pool.map(p=>p.name);
  const clash10=['青禾','白榆','赤霄','玄同'].filter(n=>names10.includes(n));
  if(clash10.length)fail('⑩ 选秀池与联盟现有人重名：'+clash10.join(','));
  else if(new Set(names10).size!==names10.length)fail('⑩ 池内重名');
  else log('⑩ 全局查重：池 '+names10.length+' 人，市场/自由市场/转会名单/新星 def 均不撞名');

  // ⑪ AI 点名的选手必须以 def 入册：读档（aiRosters 被剥离重建）后仍在名册，且年龄按入盟赛季算
  const s11=mkS(999);const d11=initDraft(s11,true);
  let g11=0;
  while(!d11.done&&g11++<60){if(d11.phase==='auction')draftBidPass(s11);else if(d11.phase==='pick')draftSkip(s11);}
  const ai11=d11.picks.filter(x=>x.team!==s11.teamName&&x.playerId)
    .filter(x=>((s11.aiRosters[x.team])||[]).some(p=>p.id===x.playerId)); // 阵容满而转自由市场的不算
  if(!ai11.length)fail('⑪ AI 点名后名册里找不到人');
  else{
    const s11b=JSON.parse(serializeForSave(s11));
    s11b.aiRosters={};
    AI_TEAMS.forEach(t=>ensureAiRosters(s11b,t.name));
    const lost11=ai11.filter(x=>!((s11b.aiRosters[x.team])||[]).some(p=>p.id===x.playerId));
    const ages11=ai11.slice(0,3).map(x=>{const q=(s11b.aiRosters[x.team]||[]).find(p=>p.id===x.playerId);return q?q.age:-1;});
    if(lost11.length)fail('⑪ 读档后 AI 新秀丢失 '+lost11.length+'/'+ai11.length+' 人（应 def 入册，不被 aiRosters 剥离带走）');
    else if(ages11.some(a=>a!==18))fail('⑪ 读档后新秀年龄应为 18（按入盟赛季算），实际 '+ages11.join(','));
    else log('⑪ AI 点名 '+ai11.length+' 人：读档重建后全部保留 · 年龄 '+ages11.join('/')+' · aiPower='+(s11b.aiPower[ai11[0].team]||0));
  }

  // ⑫ 落选者进自由市场：字段必须齐（缺 freeAgent 会被当转会谈判凭空要转会费，缺 signCost 面板显示 undefined）
  const s12=mkS(0);const d12=initDraft(s12,true);
  let g12=0;
  while(!d12.done&&g12++<200){if(d12.phase==='auction')draftBidPass(s12);else if(d12.phase==='pick')draftSkip(s12);}
  const fa12=s12.freeAgents||[];
  const bad12=fa12.filter(p=>p.freeAgent!==true||typeof p.signCost!=='number'||!Number.isFinite(p.signCost)||p.team);
  if(!fa12.length)fail('⑫ 落选者未进自由市场');
  else if(bad12.length)fail('⑫ 自由市场新秀字段不全 '+bad12.length+' 人（freeAgent/signCost/team）');
  else log('⑫ 落选者 '+fa12.length+' 人进自由市场：freeAgent/signCost/team 齐备');
  // ⑫b 谈判入口必须按「自由球员」处理（缺 freeAgent 会凭空要转会费）
  if(fa12.length){
    let negoErr='';
    try{S=s12;openNegotiation(s12,fa12[0].id);}catch(e){negoErr=e.message;}
    if(negoErr)fail('⑫b 自由市场新秀无法谈约: '+negoErr);
    else if(!window._nego)fail('⑫b 未进入谈判');
    else if(!window._nego.freeAgent)fail('⑫b 谈判按转会处理（应 freeAgent，转会费为 0）');
    else log('⑫b 谈判：识别为自由球员 · 转会费 '+window._nego.askFee+'万 · 期望年薪 '+window._nego.askWage+'万');
    window._nego=null;
  }

  // ⑭ AI 预算一场只摇一次（原来每次评估都重掷，同一签位内 AI 的心理上限会随机跳变）
  const s14=mkS(0);const d14=initDraft(s14,true);
  const ai14=d14.order.filter(t=>t!==s14.teamName)[0];
  const b14a=draftMaxAiBid(s14,ai14,0),b14b=draftMaxAiBid(s14,ai14,0);
  if(b14a!==b14b)fail('⑭ 同队同签位的出价上限不稳定（'+b14a+' vs '+b14b+'）');
  else if(draftMaxAiBid(s14,ai14,0)!==draftTeamMaxBid(s14,ai14,0))fail('⑭ draftMaxAiBid 应是 draftTeamMaxBid 的薄别名');
  else log('⑭ AI 预算稳定：同签位两次评估均为 '+b14a+'万 · 与 draftTeamMaxBid 同口径');

  // ⑲ 玩家与 AI 同一口径：玩家叫价也受 draftTeamMaxBid 封顶（原先玩家可砸光 s.fund，AI 不能）
  const s19=mkS(0);
  const d19=initDraft(s19,true);
  const max19=draftTeamMaxBid(s19,s19.teamName,d19.slot);
  // 造一个必须超过上限才能跟的价：已有 AI 领先且当前价已达 cap，下一手 nxt=max+10
  d19.leader=d19.order.filter(t=>t!==s19.teamName)[0];
  d19.bid=max19;
  d19.passed={};
  const fund19=s19.fund,bid19=d19.bid,leader19=d19.leader;
  draftBidRaise(s19);
  if(d19.bid!==bid19||d19.leader!==leader19)fail('⑲ 超过签位预算上限仍能叫价（max='+max19+'，bid '+bid19+'→'+d19.bid+'）');
  else if(s19.fund!==fund19)fail('⑲ 被拒叫价仍改动了资金（'+fund19+'→'+s19.fund+'）');
  else log('⑲ 统一上限：玩家超 cap叫价被拒（max='+max19+'万，与 AI 同一口径；不扣款、不改领先者）');

  // ⑮ 季前赛结束时没打完的选秀必须自动收官，一个新秀都不能凭空消失
  //   （历史 bug：面板只在 preseason 显示，转会期一结束剩下的签位再也点不到，
  //     池子既没进任何队也没进自由市场 —— 整场选秀蒸发）
  for(const path of ['endPreseason','nextDay']){
    const s15=mkS(0);const d15=initDraft(s15,true);
    if(d15.phase!=='auction'||d15.done){fail('⑮ 开局应停在玩家竞拍，无法验证 '+path);continue;}
    const poolIds=d15.pool.map(p=>p.id);
    if(path==='endPreseason')endPreseason(s15);
    else{s15.transferWindow=1;for(let i=0;i<3&&s15.preseason;i++)nextDay(s15);}
    if(s15.preseason)fail('⑮ '+path+' 未能结束季前赛');
    const picked=d15.picks.filter(x=>x.playerId).map(x=>x.playerId);
    const faIds=(s15.freeAgents||[]).map(p=>p.id);
    const rosterIds=[];Object.values(s15.aiRosters||{}).forEach(r=>(r||[]).forEach(p=>rosterIds.push(p.id)));
    // 每个新秀必须恰好有下落：被选中并入册 / 被选中但阵容无位转自由市场 / 落选进自由市场
    const missing=poolIds.filter(id=>!picked.includes(id)&&!faIds.includes(id)&&!rosterIds.includes(id));
    const dbl=poolIds.filter(id=>rosterIds.includes(id)&&faIds.includes(id));       // 既在名册又在市场 = 双挂
    const dangling=picked.filter(id=>!faIds.includes(id)&&!rosterIds.includes(id)); // 记为选中却两地无此人
    if(!d15.done||d15.pool.length)fail('⑮ '+path+' 后选秀未收官（phase='+d15.phase+' 池='+d15.pool.length+'）');
    else if(missing.length)fail('⑮ '+path+' 后 '+missing.length+'/'+poolIds.length+' 名新秀人间蒸发');
    else if(dbl.length)fail('⑮ '+path+' 后 '+dbl.length+' 人既在 AI 名册又在自由市场（双挂）');
    else if(dangling.length)fail('⑮ '+path+' 后 '+dangling.length+' 人被记为选中却无处可寻');
    else log('⑮ '+path+' 强制收官：'+d15.order.length+' 签走完 · 名册入册 '+poolIds.filter(id=>rosterIds.includes(id)).length+' 人 · 转/落自由市场 '+poolIds.filter(id=>faIds.includes(id)).length+' 人 · 无人蒸发/双挂');
  }

  // ⑬ 池空的点名阶段不能卡死：渲染时必须能自愈（要么给放弃按钮，要么直接收官）
  const s13=mkS(0);const d13=initDraft(s13,true);
  let g13=0;while(d13.phase==='auction'&&g13++<25)bidOrPass(s13);
  if(d13.phase==='pick'){
    d13.pool=[];
    let h13='';
    try{goPage('market');h13=document.querySelector('#page-market').innerHTML;}catch(e){fail('⑬ 池空渲染异常 '+e.message);}
    if(d13.phase==='pick'&&!d13.done&&h13.indexOf('放弃点名')<0)fail('⑬ 池空时既没放弃按钮也没收官 → 玩家卡死在点名阶段');
    else if(d13.done)log('⑬ 池空兜底：渲染期 draftRepair 直接收官（不再死等点名）');
    else{draftSkip(s13);if(d13.phase==='pick')fail('⑬ 点放弃后仍卡在点名');else log('⑬ 池空兜底：放弃按钮仍在，一点即继续');}
  }else log('⑬ 未进入点名阶段，跳过');
  // ⑬b 坏档（phase=pick 但池空）归一化为收官，而不是永远等待
  const s13b=mkS(0);const d13b=initDraft(s13b,true);
  d13b.phase='pick';d13b.pool=[];
  draftRepair(s13b,d13b);
  if(d13b.phase!=='done'||!d13b.done)fail('⑬b pick+空池 的坏档未归一化（phase='+d13b.phase+'）');
  else log('⑬b 坏档归一化：pick+空池 → 收官');

  // ⑯ 大名单满员时必须说清原因（原来只说「你已放弃或未轮到」，玩家会以为点了没反应/选不了人）
  const s16=mkS(0);
  while(s16.players.length<ROSTER_MAX){
    const pos=POS_ORDER[s16.players.length%5];
    const def=PLAYER_POOL.find(x=>x.pos===pos&&!s16.players.some(y=>y.id===x.id)&&!(s16.retiredDefs||[]).includes(x.id));
    if(!def)break;
    s16.players.push(genPlayer(def));
  }
  const d16=initDraft(s16,true);
  let h16='';
  try{S=s16;goPage('market');h16=document.querySelector('#page-market').innerHTML;}catch(e){fail('⑯ 满员渲染异常 '+e.message);}
  const fullOk=s16.players.length>=ROSTER_MAX;
  const hasReason=h16.indexOf('大名单已满')>=0||h16.indexOf('未能参与')>=0;
  if(!fullOk)fail('⑯ 未能构造满员名单（'+s16.players.length+'/'+ROSTER_MAX+'）');
  else if(!hasReason)fail('⑯ 满员时面板没说明原因（只给「你已放弃或未轮到」/直接显示收官）');
  else if(/<button[^>]*onclick="draftBid/.test(h16))fail('⑯ 满员时仍渲染了叫价/放弃按钮');
  else if(h16.indexOf('大名单 '+s16.players.length+'/'+ROSTER_MAX)<0)fail('⑯ 面板标题未显示大名单人数');
  else log('⑯ 满员（'+s16.players.length+'/'+ROSTER_MAX+'，phase='+d16.phase+'）：面板明示原因「大名单已满/未能参与」且不给叫价按钮');

  // ⑰ 点名阶段整张卡可点，且一次点击只触发一次 draftPick（内层按钮不能再挂 onclick，否则冒泡会调两次）
  const s17=mkS(0);const d17=initDraft(s17,true);
  let g17=0;while(d17.phase==='auction'&&g17++<25)bidOrPass(s17);
  if(d17.phase!=='pick')fail('⑰ 未能进入点名阶段');
  else{
    let h17='';
    try{S=s17;goPage('market');h17=document.querySelector('#page-market').innerHTML;}catch(e){fail('⑰ 渲染异常 '+e.message);}
    const wrap=(h17.match(/onclick="draftPick\\('/g)||[]).length;
    const btn=(h17.match(/<button[^>]*onclick="draftPick\\('/g)||[]).length;
    const prof=(h17.match(/showCareer\\(findPlayerCard/g)||[]).length;
    if(!wrap)fail('⑰ 池卡片外层没有 onclick（点卡片本体没反应 → 会被当成选不了人）');
    else if(btn)fail('⑰ 内层按钮也挂了 onclick：点击会冒泡触发两次 draftPick');
    else if(prof)fail('⑰ 选秀卡仍带「选手档案」按钮（会弹「选手已不在」并干扰点名）');
    else log('⑰ 点名阶段 '+wrap+' 张卡整卡可点（onclick 只在容器上，无档案按钮干扰）');
    // 选秀池 id 必须能被 findPlayerCard 找到（档案/其它入口共用）
    const pid17=d17.pool[0]&&d17.pool[0].id;
    if(pid17&&!findPlayerCard(pid17))fail('⑰ 选秀池选手 findPlayerCard 查不到（档案入口坏）');
    else log('⑰b findPlayerCard 能命中选秀池');
  }

  // ⑱ 老档 done/phase 不一致 → 归一化，否则面板显示进行中却一个按钮都不给
  const s18=mkS(0);const d18=initDraft(s18,true);
  d18.done=true;d18.phase='pick';
  draftRepair(s18,d18);
  const s18b=mkS(0);const d18b=initDraft(s18b,true);
  d18b.done=true;d18b.phase='auction';
  draftRepair(s18b,d18b);
  if(d18.phase!=='done')fail('⑱ done=true 但 phase='+d18.phase+' 未归一化为收官');
  else if(d18b.phase!=='done')fail('⑱ done=true + auction 未归一化（phase='+d18b.phase+'）');
  else log('⑱ 老档归一化：done=true 时 phase 一律收敛为 done');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);
console.log(out);
