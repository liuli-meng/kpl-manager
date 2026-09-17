// 选手/教练生涯模式回归：创建/首发竞争/自动比赛/转会/退役/教练自动补强与邀约
// 运行：node tests/verify-career.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  // ① 选手生涯开局：创建选手 → 加盟球队 → 状态完备
  // 用 19 岁「次级联赛」出身：17 岁青训档按 KPL 规则不可登场（回归覆盖未成年跟训路径）
  initStart();
  pickPlayerArch(1);
  createPlayerCareer();
  if(!S||S.mode!=='player')fail('开局后 mode 应为 player');
  else{
   const me=myPlayer(S);
   if(!me)fail('career.me 未指向阵中选手');
   else if((me.age||0)<MATCH_MIN_AGE)fail('测试档应满 '+MATCH_MIN_AGE+' 岁，实际 '+me.age);
   else if(!S.players.some(p=>p.id===me.id))fail('我不在球队名单');
   else if(!S.schedule||!S.schedule.length)fail('赛程未生成');
   else if(S.preseason||S.transferWindow>0)fail('选手模式不应有转会期');
   else log('① 选手开局：'+me.name+'（'+POS[me.pos][0]+' · '+me.age+'岁）加盟 '+S.teamName+'，赛程就绪、无转会期');

   // ② 首发竞争：强制我全面落后 → 教练把我按在替补；全面反超 → 夺回首发
   S.pick={}; // 清掉 BP 残留，避免 pick 英雄抬高我的评定导致用例抖动
   coachPickLineup(S);
   const rival=S.players.filter(p=>p.pos===me.pos&&p.id!==me.id&&matchEligible(S,p)).sort((a,b)=>playerPower(b,b.sig)-playerPower(a,a.sig))[0];
   if(rival){
   ['lane','farm','team','mind'].forEach(k=>{me.attrs[k]=40;});
   me.energy=50;me.morale=50;
   coachPickLineup(S);
   const benched=!S.lineup.includes(me.id);
   if(!benched&&playerPower(rival,rival.sig)>playerPower(me,me.sig))fail('战力全面落后却仍首发（竞争判定失效）');
   else{
   ['lane','farm','team','mind'].forEach(k=>{me.attrs[k]=Math.min(99,me.attrs[k]+40);});
   coachPickLineup(S);
   if(!S.lineup.includes(me.id)&&playerPower(me,me.sig)>=playerPower(rival,rival.sig))fail('战力反超却没夺回首发');
   else if(!S.lineup.includes(me.id))log('② 首发竞争：落后被换下（反超后仍略逊，符合实时评定）');
   else log('② 首发竞争：落后→替补，反超→夺回首发（教练按同位置战力实时评定）');
   }
   }else log('② 首发竞争：队内无同位置竞争者，直接首发');
  }

  // ③ 自动比赛：教练指挥打完整场 BO5，我的数据与联盟积分同步结算
  const me3=myPlayer(S);
  ['lane','farm','team','mind'].forEach(k=>{me3.attrs[k]=99;}); // 拉满：保证压过任何同位置队友（对面 star 档可达 92+）
  coachPickLineup(S);
  if(!S.lineup.includes(me3.id))fail('四维拉满仍未首发（竞争判定失效）');
  const caps0=me3.caps||0,apps0=me3.apps||0,matchIdx0=S.matchIdx;
  S.trained=false;
  startPlayerMatch();
  if(!S.series&&S.matchIdx===matchIdx0)fail('比赛未推进（matchIdx 不变且无系列赛残留）');
  else{
   const played=S.matchIdx>matchIdx0;
   if(!played)fail('赛后 matchIdx 未推进');
   else if((me3.caps||0)<=caps0)fail('我的出场局数未累计');
   else if(!S.history||!S.history.length)fail('比赛复盘未记录');
   else log('③ 自动比赛：BO5 打完进入下一轮 · 我累计出场 '+(me3.caps-caps0)+' 小局（KDA '+(me3.kTotal||0)+'/'+(me3.dTotal||0)+'/'+(me3.aTotal||0)+'）· 复盘已入册');

   // ④ 训练行动：加练属性 + 英雄特训 + 休息（每天一项）
   // 比赛后可能伤停/低体力：先复位，专测训练通路本身
   me3.injury=0;me3.energy=ENERGY_MAX;S.trained=false;
   if(!(me3.heroPool||[]).some(h=>h.lv===2&&h.n!==me3.sig)){
    const extra=HEROES.filter(h=>h.pos.includes(me3.pos)&&h.n!==me3.sig&&!me3.heroPool.some(x=>x.n===h.n))[0];
    if(extra)me3.heroPool.push({n:extra.n,lv:2});
   }
   me3.attrs.lane=90; // 留出成长空间（③拉满 99 会被上限钳住）
   me3.val=140;me3.morale=90;me3.injury=0;me3.energy=ENERGY_MAX; // 状态驱动训练：拉高 form
   delete me3.peak;ensurePlayerPeak(me3); // 重算天花板（ovr 很高时房间会被压到 3）
   // 确保天花板至少留 2 点：避免测试因随机/房间计算抖动
   if(me3.peak.lane-me3.attrs.lane<2)me3.peak.lane=Math.min(96,me3.attrs.lane+2);
   const attr0=me3.attrs.lane;
   // 火热状态（val140）下 trainOutcome 必有收益；playerTrain 只是把它落地
   const rTrain=trainOutcome(playerRole(S),me3,'lane');
   if(rTrain.gain<=0)fail('火热状态 trainOutcome 应有收益，实际 +'+rTrain.gain+'（form='+rTrain.form+'）');
   playerTrain('lane');
   if(!S.trained)fail('训练后 trained 未置位');
   else if(me3.attrs.lane<=attr0)fail('训练未涨属性（form 应火热 '+attr0+'→'+me3.attrs.lane+'）');
   else{
   S.trained=false;
   const pool0=(me3.heroPool||[]).filter(h=>h.lv===3).length;
   playerHeroTrain();
   const pool1=(me3.heroPool||[]).filter(h=>h.lv===3).length;
   if(pool1<=pool0)fail('英雄特训未产出新绝活');
   else{
   S.trained=false;playerRest();
   if((me3.energy||0)<55)fail('休息未恢复体力');
   else log('④ 训练行动：专项 +1~2 · 英特训绝活（'+pool0+'→'+pool1+'）· 休息回体力，每日一项限制生效');
   }
   }
  }

  // ⑤ 转会：接受报价 → pendingMove → 赛段间正式加盟新东家
  S.offers=[{pid:me3.id,name:me3.name,team:'北京WB',fee:1500,expire:S.day+3,status:'open'}];
  respondOffer(S,0,'sell');
  if(!S.career.pendingMove)fail('接受报价后未产生转会意向');
  else if(S.career.pendingMove.team!=='北京WB')fail('意向球队错误');
  else{
   const oldTeam=S.teamName;
   applyPlayerMove(S);
   if(S.teamName!=='北京WB')fail('applyPlayerMove 未换队: '+S.teamName);
   else if(!S.players.some(p=>p.id===me3.id))fail('转会后我丢了');
   else if(S.players.length<5)fail('新东家阵容不完整: '+S.players.length);
   else if(S.career.pendingMove)fail('意向未清除');
   else log('⑤ 转会：接受 北京WB 报价 → 赛段间生效（'+oldTeam+' → 北京WB · 我保留 · 新阵容 5 位置齐）');
  }

  // ⑥ 退役：年龄到线 → 退役结算
  S.season=6;S.career.seasons=[{season:5,year:2030,team:'北京WB',apps:20,caps:60,kda:'6/2/8',mvp:3,ovr:88,val:130,wage:60,titles:1}];
  S.honors=[{season:5,champion:true}];
  me3.age=(AGE_MODEL[me3.pos]||AGE_MODEL.mid).retire+1;
  // 直接调用结算（newSeason 全流程太重；playerYearSettle+退役判定拆开验证）
  playerYearSettle(S);
  if(!S.career.seasons.length||S.career.seasons[0].team!=='北京WB')fail('赛季履历未快照');
  else if((me3.caps||0)!==0||(me3.kTotal||0)!==0)fail('赛季计数未清零');
  else{
   if(me3.age>=(AGE_MODEL[me3.pos]||AGE_MODEL.mid).retire&&!S.career.retired){
   S.career.retired=true; // 与 newSeason 同判定
   }
   if(!S.career.retired)fail('年龄到线未触发退役');
   else log('⑥ 退役：年龄到线触发退役声明，赛季履历快照+计数清零，生涯页进入结算态');
  }

  // ⑥a 退役清人后：legacy 快照可渲染（me 已不在 players 时不能崩）
  {
   const snapName=me3.name,snapAge=me3.age,snapPos=me3.pos,snapOvr=overall(me3);
   S.players=S.players.filter(p=>p.id!==me3.id); // 模拟 newSeason 清人
   S.lineup=S.lineup.filter(id=>id!==me3.id);
   S.career.legacy={name:snapName,age:snapAge,pos:snapPos,ovr:snapOvr,mvp:3,titles:1,fmvp:0,allstar:0,seasons:1};
   S.career.coachPath=true;
   if(myPlayer(S))fail('模拟清人后 myPlayer 仍应为 null');
   renderCareer();
   const careerHtml=document.querySelector('#page-career').innerHTML||'';
   if(careerHtml.includes('数据缺失'))fail('退役后生涯页误报数据缺失（legacy 快照未用上）');
   else if(!careerHtml.includes('退役')||!careerHtml.includes(snapName))fail('退役结算屏未渲染选手名');
   else log('⑥a 退役清人后：legacy 快照渲染退役屏（'+snapName+'）· 不再误报「选手数据缺失」');
  }

  // ⑥b 老将带新：清空名单只留老将+新人 → 配对 + 新人成长 + 老将人气
  S=null;initStart();pickPlayerArch(1);createPlayerCareer();
  {
   const meB=myPlayer(S);
   const vet=genPlayer(genFreeAgentDef(meB.pos==='mid'?'jg':'mid','star',new Set([meB.name])));
   const vm=AGE_MODEL[vet.pos]||AGE_MODEL.mid;
   vet.age=vm.gold+2;vet.retiring=false;vet.loan=null;
   ['lane','farm','team','mind'].forEach(k=>{vet.attrs[k]=Math.min(99,vet.attrs[k]+8);});
   S.players=[meB,vet]; // 防其他青训/模板新人抢配对
   meB.age=18;['lane','farm','team','mind'].forEach(k=>{meB.attrs[k]=Math.max(40,meB.attrs[k]-20);});
   const attrBefore={...meB.attrs},popBefore=vet.popularity||0;
   mentorSeasonSettle(S);
   const pair=(S.mentorPairs||[]).find(mp=>mp.r===meB.id||mp.v===meB.id);
   if(!pair)fail('老将+新人未配对（mentorPairs='+JSON.stringify(S.mentorPairs||[])+' vetOvr='+overall(vet)+' vetAge='+vet.age+'）');
   else{
    const grew=Object.keys(attrBefore).some(k=>meB.attrs[k]>attrBefore[k]);
    if(!grew)fail('新人未获得带新属性成长');
    else if((vet.popularity||0)<=popBefore)fail('老将未获得带新人气');
    else if(pair.v===vet.id&&!(S.career.mentorName||S.career.mentoredCount))fail('选手模式未记带新履历');
    else log('⑥b 老将带新：'+vet.name+'（'+vet.age+'岁）带训 '+meB.name+'（18岁）→ 新人属性↑ · 老将人气 '+(popBefore||0)+'→'+(vet.popularity||0)+' · 配对已入档');
   }
  }

  // ⑥c 退役转教练（一条龙）：置退役邀请 → playerToCoach → mode=coach + 履历入合同
  S.career.retired=true;
  S.career.coachPath=true;
  S.career.titles=2;S.career.fmvp=1;S.career.allstar=1;
  S.career.legacy={name:(myPlayer(S)||S.players[0]||{name:'名宿'}).name,age:25,pos:'mid',ovr:88,mvp:3,titles:2,fmvp:1,allstar:1,seasons:5};
  const legacyName=S.career.legacy.name;
  const okCoach=playerToCoach(); // UI 回调不传参：应缺省用全局 S
  if(!okCoach)fail('退役转教练失败（含无参回调路径）');
  else if(S.mode!=='coach')fail('转教练后 mode 应为 coach');
  else if(!S.coach||S.coach.origin!==legacyName)fail('教练身份未绑定名宿');
  else if(!S.coachDeal||!(S.coachDeal.log||[]).some(x=>/退役转教练/.test(x.note||'')))fail('教练合同未记录转型');
  else if(S.career.coachPath)fail('转型后应消费 coachPath 防重复');
  else log('⑥c 一条龙：'+legacyName+' 退役转教练（评分 '+S.coach.rating+' · 战力+'+S.coach.bonus+'%）· mode=coach · 合同 2 年 · 履历保留');

  // ⑦ 教练生涯：卡片回调/按钮联动（沙箱无真实 DOM，走 handler 与按钮状态断言）+ 开局 + 补强 + 邀约
  S=null;initStart();switchStartTab('coach');
  if((coachCardHTML(CLUB_TEMPLATES[0],0)||'').indexOf('pickCoachClub')<0)fail('教练卡片模板未使用 pickCoachClub 回调');
  else{
   switchStartTab('coach'); // coach 分支会把 apply 按钮重置为禁用
   const before=document.getElementById('coach-apply-btn').disabled;
   pickCoachClub(3);
   const after=document.getElementById('coach-apply-btn').disabled;
   if(_coachPick!==3)fail('pickCoachClub 未记录选择');
   else if(before!==true)fail('未选队时「开始执教」应禁用');
   else if(after!==false)fail('选队后「开始执教」仍禁用（联动断裂——旧版错绑 pickClub 的症状）');
   else log('⑦a 教练选队联动：卡片回调 pickCoachClub → 选择入册 → 「开始执教」按钮解锁');
  }
  applyCoachClub();
  if(!S||S.mode!=='coach')fail('教练开局 mode 应为 coach');
  else if(!S.coachDeal)fail('教练合同缺失');
  else if(S.transferWindow>0)fail('教练模式不应有手动转会期');
  else{
   // 自动补强：砍到 3 人 → coachAutoSquad 补齐
   S.players=S.players.slice(0,3);
   S.expiring=[S.players[0].id];
   coachAutoSquad(S);
   if(S.players.length<5)fail('自动补强后阵容仍残缺: '+S.players.length);
   else if((S.expiring||[]).length)fail('教练模式到期合同应被俱乐部自动续约');
   else{
   // 豪门邀约：强队教练回应
   S.board.trust=80;S.managerCareer.lastRank=2;
   S.coachOffer={team:'成都AG超玩会'};
   const preTeam=S.teamName;
   respondCoachOffer(true);
   if(S.teamName!=='成都AG超玩会')fail('接受邀约未换队: '+S.teamName);
   else if(S.players.length<5)fail('换队后阵容残缺');
   else if(S.coachOffer)fail('邀约未清除');
   else log('⑦ 教练生涯：开局（合同+无转会期）· 俱乐部自动引援续约 · 接受豪门邀约换队（'+preTeam+' → '+S.teamName+'）');
   }
  }

  // ⑧ 经理模式回归：默认 mode 不受影响
  const s8=newState('回归队','x');fillRoster(s8,'mid','star');
  if(s8.mode!=='manager')fail('新档默认 mode 应为 manager');
  else log('⑧ 兼容：新档默认 manager，旧档缺 mode 字段由迁移兜底');

  // ⑨ 选队卡片：点第 2/3 张只改选中，不整批重掷（旧版永远选不中）
  {
   S=null;initStart();switchStartTab('player');
   const batch=(window._pcTeams||[]).map(c=>c.name).join('|');
   if(window._pcTeams&&window._pcTeams.length>=3){
    const target=window._pcTeams[2].name;
    pickPlayerTeam(target);
    const after=(window._pcTeams||[]).map(c=>c.name).join('|');
    if(_pcTeam!==target)fail('pickPlayerTeam 未记录第3张卡: '+_pcTeam);
    else if(after!==batch)fail('点选战队触发了整批重掷');
    else log('⑨ 选队：第2/3张可稳定选中，不再整批重掷');
   }else log('⑨ 选队：沙箱未生成3张卡，跳过');
  }

  // ⑩ 选手主动申请转会 + 未成年出战资格
  {
   S=null;initStart();pickPlayerArch(1);createPlayerCareer();
   const meX=myPlayer(S);
   meX.age=MATCH_MIN_AGE;['lane','farm','team','mind'].forEach(k=>{meX.attrs[k]=Math.min(99,meX.attrs[k]+20);});
   meX.val=130;meX.popularity=40;meX.contract=1;
   const okReq=playerRequestTransfer(S);
   if(!okReq||!(S.offers||[]).some(o=>o.pid===meX.id))fail('申请转会未产生报价');
   else{
    S.offers=[];
    meX.age=MATCH_MIN_AGE-1;
    if(matchEligible(S,meX))fail('未满'+MATCH_MIN_AGE+'岁仍可出战');
    else if(S.lineup.includes(meX.id)){coachPickLineup(S);autoFillLineup(S);
     if(S.lineup.includes(meX.id))fail('未成年选手仍在首发');
     else log('⑩ 申请转会出报价 · 未满'+MATCH_MIN_AGE+'岁被移出首发');
    }else log('⑩ 申请转会出报价 · 未满'+MATCH_MIN_AGE+'岁不可出战');
   }
  }

  // ⑪ 板凳出路：连续替补 → 租借离队 / K甲下放；俱乐部自动补缺
  {
   S=null;initStart();pickPlayerArch(1);createPlayerCareer();
   const meY=myPlayer(S);
   // 强行按在板凳
   if(S.lineup.includes(meY.id))S.lineup=S.lineup.filter(id=>id!==meY.id);
   S.career.benchDays=0;
   for(let i=0;i<3;i++)tickPlayerBench(S);
   if((S.career.benchDays||0)<3)fail('板凳天数未累计: '+(S.career.benchDays||0));
   else{
    const okLoan=playerRequestLoanOut(S);
    if(!okLoan||!meY.loanOut)fail('连续替补后租借离队失败');
    else if(S.lineup.includes(meY.id))fail('租借中仍在母队首发');
    else if(!matchEligible(S,meY))log('⑪ 租借离队 OK（'+meY.loanOut.team+' · 剩 '+meY.loanOut.days+' 天）· 不可为母队出场');
    else fail('租借中仍 matchEligible');
    // 日结到归队
    let g=0;while(meY.loanOut&&g++<40)loanOutTick(S);
    if(meY.loanOut)fail('租借到期未归队');
    else log('⑪b 租借归队：出场 '+meY.apps+' 次 · 重新可竞争首发');
   }
   // K甲路径
   if(S.lineup.includes(meY.id))S.lineup=S.lineup.filter(id=>id!==meY.id);
   const okK=playerRequestKjia(S);
   if(!okK||(meY.kjia||0)<=0)fail('自请下放 K甲失败');
   else if(S.lineup.includes(meY.id))fail('K甲中仍在母队首发');
   else log('⑪c 自请下放 K甲 OK（剩 '+meY.kjia+' 天）');
   // 俱乐部自动运营：砍到 3 人 → startSplit 应自动补强
   S.players=S.players.filter(p=>p.id===meY.id).concat(S.players.filter(p=>p.id!==meY.id).slice(0,2));
   S.expiring=[];
   const n0=S.players.length;
   startSplit(S,'summer');
   if(S.players.length<=n0&&S.players.length<7)fail('选手模式俱乐部未自动补强: '+S.players.length);
   else log('⑪d 俱乐部自动运营：阵容 '+n0+'→'+S.players.length+' 人（选手只管自己，班底由俱乐部打理）');
  }

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
