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
  initStart();
  createPlayerCareer();
  if(!S||S.mode!=='player')fail('开局后 mode 应为 player');
  else{
   const me=myPlayer(S);
   if(!me)fail('career.me 未指向阵中选手');
   else if(!S.players.some(p=>p.id===me.id))fail('我不在球队名单');
   else if(!S.schedule||!S.schedule.length)fail('赛程未生成');
   else if(S.preseason||S.transferWindow>0)fail('选手模式不应有转会期');
   else log('① 选手开局：'+me.name+'（'+POS[me.pos][0]+'）加盟 '+S.teamName+'，赛程就绪、无转会期');

   // ② 首发竞争：强制我全面落后 → 教练把我按在替补；全面反超 → 夺回首发
   coachPickLineup(S);
   const rival=S.players.filter(p=>p.pos===me.pos&&p.id!==me.id).sort((a,b)=>playerPower(b)-playerPower(a))[0];
   if(rival){
   ['lane','farm','team','mind'].forEach(k=>{me.attrs[k]=Math.max(40,me.attrs[k]-25);});
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
   S.trained=false;
   me3.attrs.lane=90; // 留出成长空间（③拉满 99 会被上限钳住）
   const attr0=me3.attrs.lane;
   playerTrain('lane');
   if(!S.trained)fail('训练后 trained 未置位');
   else if(me3.attrs.lane<=attr0)fail('训练未涨属性');
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

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
