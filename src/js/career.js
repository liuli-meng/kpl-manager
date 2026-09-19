/* 选手/教练生涯引擎 + 年度回顾 + 退役名宿市场（season.js 机械拆出） */
/* ================= 选手生涯 / 教练生涯（引擎侧） ================= */
/* 选手主动申请转会：不再只能干等「身价≥112% 被动报价」——
 总值/身价/人气决定是否有人接盘；合同最后一年更主动，豪门更爱挖即战力。 */
function playerRequestTransfer(s){
 s=s||S;
 if(!s||s.mode!=='player')return false;
 const me=myPlayer(s);
 if(!me)return false;
 if(s.career&&s.career.retired){toast('职业生涯已退役');return false;}
 if(s.career&&s.career.pendingMove){toast('已有转会意向（'+s.career.pendingMove.team+'），先打完当前赛段');return false;}
 s.offers=s.offers||[];
 if(s.offers.some(o=>o.pid===me.id)){toast('已有俱乐部在谈，先处理现有报价');return false;}
 if(typeof natCamping==='function'&&natCamping(s,me)){toast('国家队集训期间不能申请转会');return false;}
 if(me.loanOut){toast('你已在外租借（剩 '+me.loanOut.days+' 天），归队后再申请');return false;}
 if(me.kjia>0){toast('正在 K甲锻炼，归队后再申请');return false;}
 // 接盘意愿：总值是硬门槛，身价/人气/合同年加成；表现低迷很难有人要
 const ovr=overall(me),val=me.val||100,pop=me.popularity||0;
 const lastYear=(me.contract||0)<=1;
 const score=ovr+(val-100)*0.35+pop*0.15+(lastYear?6:0);
 if(score<78){toast('暂时没有俱乐部愿意接盘（总值/表现再打高一点，或进入合同年）');return false;}
 const fee=capFee(buyoutPrice(me)*(0.9+Math.random()*0.35));
 const pool=AI_TEAMS.filter(t=>t.name!==s.teamName);
 if(!pool.length)return false;
 // 强队更爱挖高总值；弱队捡漏合同年
 const pref=pool.slice().sort((a,b)=>(b.power||0)-(a.power||0));
 const idx=ovr>=86?rnd(0,Math.min(3,pref.length-1)):rnd(0,pref.length-1);
 const buyer=pref[idx]||pick(pool);
 s.offers.push({pid:me.id,name:me.name,team:buyer.name,fee,expire:s.day+OFFER_TTL,status:'open'});
 logEvent(s,' 经纪人官宣申请转会：'+buyer.name+' 迅速报价 '+fee+'万（生涯页 '+OFFER_TTL+' 天内答复）');
 save();renderAll();
 toast(buyer.name+' 对你报价 '+fee+'万！去「生涯」页答复');
 return true;
}
function playerYearSettle(s){ // 选手模式年度结算：本赛季个人数据入册生涯履历
 const me=myPlayer(s);
 if(!me||!s.career)return;
 const rec={season:s.season,year:gameYear(s),team:s.teamName,apps:me.apps||0,caps:me.caps||0,
 kda:me.caps?[me.kTotal,me.dTotal,me.aTotal].map(x=>Math.round(x/me.caps*10)/10).join('/'):null,
 mvp:me.mvp||0,ovr:overall(me),val:me.val||100,wage:me.wage,
 titles:(s.honors||[]).filter(h=>h.season===s.season&&h.champion).length};
 s.career.seasons.unshift(rec);
 s.career.seasons=s.career.seasons.slice(0,15);
 s.career.titles+=rec.titles;
 me.kTotal=0;me.dTotal=0;me.aTotal=0;me.caps=0;me.mvp=0;me.apps=0; // 本赛季计数清零（生涯履历已快照）
 logEvent(s,'【赛季结算】'+rec.year+'：'+rec.team+' · 出场 '+rec.apps+' 次'+(rec.kda?' · 场均 '+rec.kda:'')+' · 总值 '+rec.ovr+' · '+(rec.titles?rec.titles+' 冠':'无冠'));
}
function applyPlayerMove(s){ // 选手赛段间转会：把 pendingMove 落地为新东家阵容
 const mv=s.career&&s.career.pendingMove;
 if(!mv)return;
 const me=myPlayer(s);
 s.career.pendingMove=null;
 if(!me)return;
 const tmpl=CLUB_TEMPLATES.find(c=>c.name===mv.team);
 if(!tmpl){logEvent(s,' 转会取消：'+mv.team+' 注册资格有变');return;}
 s.teamName=tmpl.name;s.icon=tmpl.icon;
 s.players=[me];
 tmpl.players.forEach(pid=>{const def=PLAYER_POOL.find(d=>d.id===pid);if(def)s.players.push(genPlayer(def));});
 me.team=tmpl.name;
 me.wage=Math.max(me.wage,Math.max(5,Math.round(mv.fee/50))); // 报价越高，薪资待遇越好
 me.contract=2;me.morale=clamp(me.morale+8,20,100);me.val=clamp((me.val||100)+4,70,150);
 me.loanOut=null;me.kjia=0; // 转会落地：结束租借/K甲状态，直接进新东家竞争
 if(s.career){s.career.benchDays=0;}
 s.coach={...COACH_POOL.find(c=>c.id===tmpl.coach)};
 s.lineup=buildBestLineup(s); // 统一可出场过滤排满首发
 s.pick={};
 s.seedPower=teamPower(s)||300;
 logEvent(s,' 转会完成：'+me.name+' 正式加盟 '+tmpl.name+'（转会费 '+mv.fee+'万 · 年薪 '+me.wage+'万/周）——首发位置要重新证明');
}
/* 选手板凳计数：健康可出场却连续坐板凳 → 可申请租借/K甲练级（生涯页出路面板） */
function tickPlayerBench(s){
 if(!s||s.mode!=='player'||!s.career)return;
 const me=myPlayer(s);
 if(!me)return;
 const eligible=matchEligible(s,me); // matchEligible 已含 伤停/外租/K甲/集训/未成年，勿再手拼旗标
 const benched=eligible&&!s.lineup.includes(me.id);
 if(benched){
 const was=s.career.benchDays||0;
 s.career.benchDays=was+1;
 if(was===0)logEvent(s,' 你连续坐上替补席——经纪人建议：加练反超首发，或申请租借/K甲寻找出场时间');
 else if(was===9)logEvent(s,' 板凳已坐 10 天：士气承压，认真考虑租借离队或下放 K甲吧');
 if(s.career.benchDays>=3){
  const d=(typeof benchMoraleDelta==='function')?benchMoraleDelta(s.career.role||playerRole(s),1):1;
  me.morale=clamp(me.morale-d,20,100);
 }
 }else if(s.career.benchDays){
 s.career.benchDays=0;
 }
}
/* 选手自请租借：去缺人的 AI 队打 21 天主力（有球可打 + 归队带成长），母队自动补位 */
function playerRequestLoanOut(s){
 s=s||S;
 if(!s||s.mode!=='player')return false;
 const me=myPlayer(s);
 if(!me)return false;
 if(s.career&&s.career.retired){toast('职业生涯已退役');return false;}
 if(s.career&&s.career.pendingMove){toast('已有转会意向，先处理完再说');return false;}
 if(me.loanOut){toast('你已在外租借（剩 '+me.loanOut.days+' 天）');return false;}
 if((me.kjia||0)>0){toast('正在 K甲锻炼，归队后再申请租借');return false;}
 if(me.injury>0){toast('伤停中，先养伤');return false;}
 if(typeof natCamping==='function'&&natCamping(s,me)){toast('国家队集训期间不能租借');return false;}
 if(s.lineup.includes(me.id)){toast('你目前是首发——先让教练把你换下，再申请租借');return false;}
 if((s.career.benchDays||0)<3){toast('刚坐上板凳，再观察几天（连续替补 3 天后经纪人会出手）');return false;}
 // 找缺同位置的 AI 队（优先弱旅：更愿意给出场）
 const map=aiRosterDefMap(s);
 const cands=Object.keys(map).filter(tn=>tn!==s.teamName).map(tn=>{
 const roster=ensureAiRosters(s,tn)||[];
 const has=roster.some(p=>p.pos===me.pos);
 const pow=(s.aiPower&&s.aiPower[tn])||400;
 return {tn,has,pow,need:!has||pow<460};
 }).filter(x=>x.need).sort((a,b)=>a.pow-b.pow);
 const dest=cands[0]?cands[0].tn:pick(AI_TEAMS.filter(t=>t.name!==s.teamName).map(t=>t.name));
 if(!dest){toast('暂时没有俱乐部愿意接手租借');return false;}
 if(!confirm('申请租借离队？\n将租借至 '+dest+' '+LOAN_DAYS+' 天寻求出场，母队会补同位置替补；归队时按表现带回成长。'))return false;
 me.loanOut={team:dest,days:LOAN_DAYS,gain:0};
 const li=s.lineup.indexOf(me.id);
 if(li>=0)s.lineup.splice(li,1);
 s.career.benchDays=0;
 s.career.loanStint=(s.career.loanStint||0)+1;
 autoFillLineup(s);
 logEvent(s,' 租借达成：'+me.name+' 租借至 '+dest+' '+LOAN_DAYS+' 天——争取出场时间，归队后回 '+s.teamName);
 save();renderAll();
 toast('已租借至 '+dest+'！'+LOAN_DAYS+' 天后归队');
 return true;
}
/* 选手自请下放 K甲：二队真实出战练级（复用 sendKjia，身份换成「我」） */
function playerRequestKjia(s){
 s=s||S;
 if(!s||s.mode!=='player')return false;
 const me=myPlayer(s);
 if(!me)return false;
 if(s.career&&s.career.retired){toast('职业生涯已退役');return false;}
 if(s.career&&s.career.pendingMove){toast('已有转会意向，先处理完再说');return false;}
 if(me.loanOut){toast('你已在外租借');return false;}
 if((me.kjia||0)>0){toast('已在 K甲锻炼');return false;}
 if(me.injury>0){toast('伤停中，先养伤');return false;}
 if(typeof natCamping==='function'&&natCamping(s,me)){toast('国家队集训期间不能下放');return false;}
 if(s.lineup.includes(me.id)){toast('你目前是首发——先让教练把你换下，再申请下放');return false;}
 if(!confirm('申请下放 K甲？\n加入二队征战次级联赛 '+KJIA_DAYS+' 天，真实出战积累数据，归队时带属性成长。'))return false;
 sendKjia(s,me.id);
 s.career.benchDays=0;
 s.career.kjiaStint=(s.career.kjiaStint||0)+1;
 save();renderAll();
 return true;
}
/* 租借日结：任何 loanOut 选手（选手自请 / 俱乐部外租）——出场表现→成长，到期归队争首发 */
function loanOutTick(s){
 if(!s)return;
 (s.players||[]).slice().forEach(p=>{
 if(!p||!p.loanOut)return;
 p.loanOut.days--;
 // 每 3 天一场：有球可打（模拟租借队首发）
 if(p.loanOut.days%3===0||p.loanOut.days>=LOAN_DAYS-1){
 p.apps=(p.apps||0)+1;
 p.caps=(p.caps||0)+1;
 const k=rnd(2,8),d=rnd(1,5),a=rnd(2,9);
 p.kTotal=(p.kTotal||0)+k;p.dTotal=(p.dTotal||0)+d;p.aTotal=(p.aTotal||0)+a;
 p.energy=clamp(p.energy-8,0,ENERGY_MAX);
 p.val=clamp((p.val||100)+rnd(0,2),70,150);
 if(Math.random()<0.35){
 const key=pick(['lane','farm','team','mind']);
 p.attrs[key]=clamp(p.attrs[key]+1,40,99);
 p.loanOut.gain=(p.loanOut.gain||0)+1;
 }
 logEvent(s,' 租借出场：'+p.name+' 代表 '+p.loanOut.team+' 出战（'+k+'/'+d+'/'+a+'）');
 }
 if(p.loanOut.days<=0){
 const team=p.loanOut.team,gain=p.loanOut.gain||0;
 p.loanOut=null;
 p.morale=clamp(p.morale+6,20,100);
 if(gain){
 const key=pick(['lane','farm','team','mind']);
 p.attrs[key]=clamp(p.attrs[key]+rnd(1,2),40,99);
 }
 logEvent(s,' 租借归队：'+p.name+' 结束 '+team+' 租借回到 '+s.teamName+'（出场时间换回成长 +'+gain+(gain?'+归队奖励':'')+'）——重新竞争首发');
 if(s.mode==='player')coachPickLineup(s);
 autoFillLineup(s);
 }
 });
}
/* 俱乐部外租（教练/经理）：板凳上有潜力但没出场的选手，租去缺人的队打主力练级。
 与选手自请租借同一套 loanOut 状态/日结——三个身份共用同一世界规则，只是发起人不同。 */
function clubLoanOutPlayer(s,pid){
 s=s||S;
 if(!s||s.mode==='player'){toast('选手生涯请在「生涯」页自行申请租借');return false;}
 const p=(s.players||[]).find(x=>x.id===pid);
 if(!p)return false;
 if(s.lineup.includes(pid)){toast(p.name+' 是首发——先换下再外租');return false;}
 if(p.loan){toast(p.name+' 是租入选手，不能外租');return false;}
 if(p.loanOut){toast(p.name+' 已在外租借');return false;}
 if((p.kjia||0)>0){toast(p.name+' 正在 K甲，归队后再外租');return false;}
 if(p.injury>0){toast(p.name+' 伤停中，不能外租');return false;}
 if(typeof natCamping==='function'&&natCamping(s,p)){toast(p.name+' 国家队集训中，不能外租');return false;}
 if((s.listed||[]).some(x=>x.id===pid)){toast(p.name+' 挂牌中，请先撤牌');return false;}
 if((p.age||0)<MATCH_MIN_AGE){toast(p.name+' 未满 '+MATCH_MIN_AGE+' 岁，先在青训/一队跟训');return false;}
 const map=aiRosterDefMap(s);
 const cands=Object.keys(map).filter(tn=>tn!==s.teamName).map(tn=>{
 const roster=ensureAiRosters(s,tn)||[];
 const has=roster.some(x=>x.pos===p.pos);
 const pow=(s.aiPower&&s.aiPower[tn])||400;
 return {tn,has,pow,need:!has||pow<470};
 }).filter(x=>x.need).sort((a,b)=>a.pow-b.pow);
 const dest=cands[0]?cands[0].tn:pick(AI_TEAMS.filter(t=>t.name!==s.teamName).map(t=>t.name));
 if(!dest){toast('暂无俱乐部愿意接手租借');return false;}
 const fee=Math.round(loanRent(p)); // 租入方付租金：俱乐部小赚，选手换出场
 if(!confirm('将 '+p.name+' 外租至 '+dest+' '+LOAN_DAYS+' 天？\n租金 +'+fee+'万；选手在那边打主力练级，归队时带回成长。'))return false;
 s.fund+=fee;
 p.loanOut={team:dest,days:LOAN_DAYS,gain:0};
 const li=s.lineup.indexOf(pid);
 if(li>=0)s.lineup.splice(li,1);
 autoFillLineup(s);
 logEvent(s,' 外租练级：'+p.name+' 租借至 '+dest+' '+LOAN_DAYS+' 天（租金 +'+fee+'万）——教练组认为他需要出场时间');
 save();renderAll();
 toast(p.name+' 已外租 '+dest);
 return true;
}
function coachAutoSquad(s){ // 教练/选手模式：俱乐部自动续约与引援（你只管竞技）
 (s.expiring||[]).slice().forEach(pid=>{
 const p=s.players.find(x=>x.id===pid);
 if(!p||p.loan)return;
 if(s.mode==='player'&&s.career&&pid===s.career.me)return; // 你本人的合同由选手分支单独谈/续
 p.contract=(p.contract||0)+1; // 俱乐部统一续约一年
 });
 s.expiring=[];
 // 教练引援申请队列：优先消化（伤停应急/教练点名），再走自动补位
 if(s.mode==='coach'&&Array.isArray(s.coachRecs)&&s.coachRecs.length){
  const rest=[];
  s.coachRecs.forEach(rec=>{
   try{
    if(rec.type==='loan'&&rec.pid){
     const cands=loanCandidates(s);
     const hit=cands.find(c=>c.p.id===rec.pid)||cands.find(c=>c.p.pos===rec.pos);
     if(hit&&loanCap(s)>(s.players||[]).filter(p=>p.loan).length){
      loanPlayer(s,hit.from,hit.p.id);
      return; // 成功租借
     }
    }
    if(rec.type==='sign'&&rec.pid){
     const fa=(s.freeAgents||[]).find(p=>p.id===rec.pid);
     if(fa&&s.fund>(fa.signCost||0)&&!rosterFull(s)){
      const cost=Math.max(0,Math.round(fa.signCost||valueOf(overall(fa))));
      if(s.fund>=cost){
       s.fund-=cost;fa.acqCost=cost;fa.contract=2;fa.loan=null;
       delete fa.freeAgent;delete fa.signCost;
       s.players.push(fa);
       s.freeAgents=s.freeAgents.filter(x=>x.id!==fa.id);
       s.aiRosters={};
       logEvent(s,' 俱乐部采纳教练申请：签下自由球员 '+fa.name+'（'+POS[fa.pos][0]+' · 总值 '+overall(fa)+' · '+cost+'万）');
       return;
      }
     }
    }
    if(rec.type==='gap'&&rec.pos){
     // 纯缺位申请：自动签该位置自由人/新援
     const need=rec.pos;
     if(s.players.some(p=>p.pos===need&&matchEligible(s,p)))return;
     const fa=(s.freeAgents||[]).filter(p=>p.pos===need).sort((a,b)=>overall(b)-overall(a))[0];
     if(fa&&s.fund>=(fa.signCost||80)&&!rosterFull(s)){
      const cost=Math.max(0,Math.round(fa.signCost||80));
      s.fund-=cost;fa.acqCost=cost;fa.contract=2;
      delete fa.freeAgent;delete fa.signCost;
      s.players.push(fa);
      s.freeAgents=s.freeAgents.filter(x=>x.id!==fa.id);
      s.aiRosters={};
      logEvent(s,' 俱乐部采纳教练申请：紧急签下 '+POS[need][0]+' '+fa.name+'（总值 '+overall(fa)+'）');
      return;
     }
    }
   }catch(e){}
   rest.push(rec);
  });
  s.coachRecs=rest.slice(0,8);
 }
 // 缺位判定看「现在能不能打」：伤停/集训/租借/未成年/K甲不算可用首发
 const playable=p=>p&&!playerStatus(p,s).loan&&matchEligible(s,p); // 只补 matchEligible 不管的「租入」
 let need=POS_ORDER.filter(pos=>!s.players.some(p=>p.pos===pos&&playable(p)));
 // 教练模式：缺位优先尝试应急租借（自动），资金不足再自由签
 if(s.mode==='coach'&&need.length&&(s.fund||0)>=80){
  need.slice().forEach(pos=>{
   const healthy=s.players.some(p=>p.pos===pos&&playable(p));
   if(healthy)return;
   try{
    const cands=(loanCandidates(s)||[]).filter(c=>c.p.pos===pos);
    if(cands.length&&s.fund>=cands[0].rent&&loanCap(s)>(s.players||[]).filter(p=>p.loan).length){
     loanPlayer(s,cands[0].from,cands[0].p.id);
     need=need.filter(x=>x!==pos);
    }
   }catch(e){}
  });
 }
 const u=new Set(s.players.map(p=>p.name));
 let g=0;
 while((s.players.length<7||need.length)&&g++<10){
 const pos=need.length?need[0]:pick(POS_ORDER);
 const def=genFreeAgentDef(pos,s.players.length<6?'mid':'low',u);
 const p=genPlayer(def);
 p.contract=2;
 s.players.push(p);
 u.add(p.name);
 logEvent(s,(s.mode==='player'?' 俱乐部运作：':s.mode==='coach'?'俱乐部响应教练：':' 俱乐部引援：')+'签下自由球员 '+p.name+'（'+POS[pos][0]+' · 总值 '+overall(p)+'）');
 if(need.length&&s.players.some(x=>x.pos===need[0]&&playable(x)))need.shift();
 }
 s.lineup=buildBestLineup(s);
}
/* 教练引援建议：按缺位/最弱位置给出租借或直签候选（UI 展示 + 可一键申请） */
function coachAdvice(s){
 if(!s||s.mode!=='coach')return {gaps:[],weak:[],loans:[],signs:[]};
 const gaps=injuryGapPositions(s);
 const healthyPos=pos=>(s.players||[]).filter(p=>p.pos===pos&&matchEligible(s,p));
 const weak=POS_ORDER.map(pos=>{
  const list=healthyPos(pos);
  const best=list.length?Math.max.apply(null,list.map(p=>overall(p))):0;
  return {pos,best,cnt:list.length};
 }).filter(x=>x.cnt===0||x.best<78).sort((a,b)=>(a.cnt-b.cnt)||(a.best-b.best));
 const loans=(loanCandidates(s)||[]).slice(0,8).map(c=>({
  id:c.p.id,pos:c.p.pos,name:c.p.name,from:c.from,ovr:overall(c.p),rent:c.rent,
  gap:gaps.includes(c.p.pos),age:c.p.age
 }));
 const signs=(s.freeAgents||[]).slice().sort((a,b)=>{
  const ag=gaps.includes(a.pos)?1:0,bg=gaps.includes(b.pos)?1:0;
  if(ag!==bg)return bg-ag;
  return overall(b)-overall(a);
 }).slice(0,6).map(p=>({
  id:p.id,pos:p.pos,name:p.name,ovr:overall(p),cost:Math.round(p.signCost||valueOf(overall(p))),
  gap:gaps.includes(p.pos),age:p.age
 }));
 return {gaps,weak:weak.slice(0,4),loans,signs};
}
function coachRequest(s,type,pid,pos){
 s=s||S;
 if(!s||s.mode!=='coach'){toast('仅教练模式可用');return;}
 s.coachRecs=s.coachRecs||[];
 if(type==='loan'){
  const hit=(loanCandidates(s)||[]).find(c=>c.p.id===pid);
  if(!hit){toast('该选手暂不可租');return;}
  if(s.coachRecs.some(r=>r.pid===pid&&r.type==='loan')){toast('已提交过该租借申请');return;}
  s.coachRecs.unshift({type:'loan',pid,pos:hit.p.pos,name:hit.p.name});
  logEvent(s,' 教练申请：租借 '+hit.p.name+'（'+POS[hit.p.pos][0]+' · '+hit.from+'）应急补位——俱乐部将尽快办理');
  // 有缺位/伤停时立刻尝试执行，不等赛季轮换
  if(injuryGapPositions(s).length||s.transferWindow===0){
   const rest=s.coachRecs.slice();
   s.coachRecs=[{type:'loan',pid,pos:hit.p.pos}];
   coachAutoSquad(s);
   if(s.players.some(p=>p.id===pid)){
    toast(hit.p.name+' 租借加盟！');
    s.coachRecs=s.coachRecs.filter(r=>!(r.pid===pid&&r.type==='loan'));
    save();renderAll();return;
   }
   s.coachRecs=rest.filter(r=>!(r.pid===pid&&r.type==='loan'));
   toast('已登记租借申请（资金/名额不足时俱乐部会在条件具备后办理）');
  }else toast('租借申请已提交，俱乐部办理中');
 }else if(type==='sign'){
  const fa=(s.freeAgents||[]).find(p=>p.id===pid);
  if(!fa){toast('该自由球员已不在名单');return;}
  if(s.coachRecs.some(r=>r.pid===pid&&r.type==='sign')){toast('已提交过该引援申请');return;}
  s.coachRecs.unshift({type:'sign',pid,pos:fa.pos,name:fa.name});
  coachAutoSquad(s); // 立刻尝试：资金够就签
  if(s.players.some(p=>p.id===pid))toast(fa.name+' 已加盟！');
  else toast('引援申请已提交（俱乐部将在资金/名单允许时办理）');
 }else if(type==='gap'){
  if(!pos)return;
  s.coachRecs.unshift({type:'gap',pos});
  coachAutoSquad(s);
  toast('已申请俱乐部补强 '+POS[pos][0]);
 }
 try{if(typeof playMoment==='function')playMoment(1,'教练申请已登记',null,null);}catch(e){}
 save();renderAll();
}
function coachPoach(s){ // 执教出色 → 豪门邀约（俱乐部页回应；接受=换队执教，履历入册）
 if(s.board&&s.board.fired)return;
 const rank=s.managerCareer?s.managerCareer.lastRank:null;
 const trust=s.board?s.board.trust:60;
 if(rank&&rank<=4&&trust>=70&&Math.random()<0.45){
 const pool=CLUB_TEMPLATES.filter(c=>c.name!==s.teamName&&c.seed>=440);
 const t=pool.length?pick(pool):null;
 if(t){s.coachOffer={team:t.name};logEvent(s,' 豪门邀约：'+t.name+' 向你发出执教邀请——俱乐部页可回应（接受=换队，婉拒=留任）');}
 }
}
/* 一条龙生涯：选手退役后转型执教（同档延续，履历写入教练合同）。
 能力按生涯荣誉折算评分/加成；班底仍为现俱乐部，信任度小幅回正。
 UI 回调 onclick="playerToCoach()" 不传参——缺省用全局 S。 */
function playerToCoach(s){
 s=s||S;
 if(!s||s.mode!=='player'||!s.career||!s.career.retired||!s.career.coachPath||!s.career.legacy){
 toast('暂无执教邀请（需先退役并收到教练组邀请）');
 return false;
 }
 const L=s.career.legacy;
 if(!confirmDanger('确认「'+L.name+'」退役转教练？\n身份切换为教练模式，选手生涯不可继续（履历会写入教练合同）。'))return false;
 const style=pick(['lane','farm','team','mind']);
 const titles=L.titles||0,fmvp=L.fmvp||0,allstar=L.allstar||0,mvp=L.mvp||0;
 const rating=clamp(Math.round(58+titles*4+fmvp*3+allstar*2+mvp*0.5+(L.ovr-70)*0.3),60,92);
 const bonus=clamp(Math.round(3+titles*1.5+fmvp*1.5+allstar),3,12);
 const styleBonus=clamp(Math.round(2+allstar+titles*0.5),2,7);
 const wage=Math.round(rating*1.8);
 // 选手身份退役：mode 切到 coach，履历保留在 career（供教练页展示「名宿出身」）
 s.mode='coach';
 s.coach={id:'pc_'+Date.now().toString(36),name:L.name,rating,style,bonus,styleBonus,wage,
 skill:{n:'名宿执教',d:'全队战力+'+bonus+'% · 由选手生涯转型'},type:'coach',origin:L.name};
 s.coachDeal={years:2,honors:[],log:[{year:gameYear(s),note:'选手退役转教练：'+L.name+'（'+L.age+'岁 · '+titles+'冠）'}]};
 s.board=s.board||{trust:60,kpi:null,warn:0,fired:false,firedSeason:0,log:[]};
 s.board.trust=clamp((s.board.trust||60)+8,0,100); // 名宿回归：管理层好感回升
 s.board.fired=false;
 s.transferWindow=0;s.preseason=false; // 与教练开局一致：无手动转会期
 s.career.coachPath=false; // 邀请已消费（防重复点）
 // 退役后名单缺位：补齐至可开赛（不止「全空」才补——少一个位置也会卡首发出场）
 if((s.players||[]).length<5||POS_ORDER.some(pos=>!s.players.some(p=>p.pos===pos)))coachAutoSquad(s);
 s.lineup=buildBestLineup(s);
 s.seedPower=teamPower(s)||s.seedPower||300;
 if(!s.board.kpi)setBoardKpi(s); // 中途转型：补发本赛季 KPI，避免董事会面板空目标
 logEvent(s,' 退役转教练：'+L.name+' 出任 '+s.teamName+' 主教练（评分 '+rating+' · 全队战力+'+bonus+'%）——执教合同 2 年，用另一种方式留在赛场');
 save();applyModeNav();goPage('club');
 toast(' 转型执教成功：欢迎回来，'+L.name+' 主教练！');
 return true;
}
/* ================= 年度回顾（赛季回顾页数据源） =================
 年度轮换前调用（finishAnnual 内）：把刚结束这一年的 成绩曲线（各赛段名次）、
 转会台账、董事会评价、关键战役（复盘里的巅峰对决/总决赛/突围赛）、成就与经营快照
 定格成一份回顾，压入 s.yearReviews（俱乐部页提示查看，经营页可回看历届）。 */
function buildYearReview(s){
 const year=gameYear(s);
 const boardEntry=((s.board&&s.board.log)||[]).find(b=>b.season===s.season)||null;
 const stages=(s.yearStages||[]).slice();
 const honors=(s.honors||[]).filter(h=>h.season===s.season).map(h=>({title:h.title,champion:h.champion}));
 const keys=(s.history||[]).filter(h=>h.yr===year&&(h.peak||/总决赛|突围|擂台/.test(h.stage)))
 .slice(0,6).map(h=>({opp:h.opp,stage:h.stage,score:h.score,win:h.win,peak:h.peak}));
 const transfers=(s.transfers||[]).filter(t=>t.yr===year);
 const achieved=Object.keys(s.achieved||{}).filter(id=>s.achieved[id]===year)
 .map(id=>{const a=ACHIEVEMENTS.find(x=>x.id===id);return a?a.name:id;});
 s.yearReviews=s.yearReviews||[];
 const review={year,season:s.season,team:s.teamName,stages,honors,transfers,keys,achieved,
 board:boardEntry?{rank:boardEntry.rank,target:boardEntry.target,delta:boardEntry.delta,note:boardEntry.note,trust:boardEntry.trust}:null,
 annualPts:(s.annualPts||{})[s.teamName]||0,annualRank:myAnnualRank(s),
 fund:s.fund,fans:Math.round(s.fans||0)};
 s.yearReviews.unshift(review);
 s.yearReviews=s.yearReviews.slice(0,10);
 s._reviewNew=year; // 俱乐部页提示条：查看后清除
 logEvent(s,' 年度回顾已生成：'+year+' 赛季总结（成绩曲线/转会记录/董事会评价/关键战役）——俱乐部页可查看');
 return review;
}

/* 名宿教练定价（评分/加成 → 周薪与签约费）：三处创建"名宿/回流旧帅"的对象都走这里。
   漏一个字段的后果不是显示难看，而是 signRetired/hireAssistant 里 `s.fund-=r.cost` 把资金
   算成 NaN、`weeklyWage` 丢一个工资项——转会页那一行 "undefined万" 只是最先露出来的表象。 */
function legendPrice(rating,bonus){
 const star=(rating||70)>=80||(bonus||0)>=6;
 return star?{wage:rnd(20,30),cost:rnd(200,300)}:{wage:rnd(13,18),cost:rnd(117,167)};
}
/* 选手退役去向：转教练（战力加成）或转型主播（人气收入），进入"退役名宿"市场 */
function retireToCoach(s,p){
 s.retiredCoaches=s.retiredCoaches||[];
 const isStar=p.mvp>=1||overall(p)>=88; // 名宿看生涯成就与实力，看出身
 if(Math.random()<0.6||!isStar){
 // 转教练：实力越强加成越高
 const bonus=isStar?rnd(5,8):rnd(3,5);
 const style=pick(['lane','farm','team','mind']);
 const price=legendPrice(isStar?80:70,bonus);
 const coach={id:'rc'+Date.now()+'_'+rnd(100,999),name:p.name,rating:isStar?80:70,style,bonus,styleBonus:isStar?rnd(3,5):2,
 wage:price.wage,cost:price.cost,
 skill:{n:'名宿执教',d:'全队战力+'+bonus+'% · 退役选手转型教练'},type:'coach',origin:p.name};
 s.retiredCoaches.push(coach);
 logEvent(s,''+p.name+'（'+p.age+'岁）退役转型主教练！执教能力已进入教练市场');
 }else{
 // 转型主播：给俱乐部带来人气收入（每日资金）
 const host={id:'rh'+Date.now()+'_'+rnd(100,999),name:p.name,rating:80,type:'host',
 income:rnd(7,15),cost:rnd(150,233),popularity:(p.popularity||40)+rnd(10,25),
 skill:{n:'转型主播',d:'每日为俱乐部带来 '+0+'万 人气收入'},origin:p.name};
 host.skill={n:'转型主播',d:'每日为俱乐部带来 '+host.income+'万 人气收入（热度 '+(p.popularity||40)+'）'};
 s.retiredCoaches.push(host);
 logEvent(s,' '+p.name+'（'+p.age+'岁）退役转型人气主播！每日可为俱乐部带来 '+host.income+'万 收入');
 }
}
/* 签约退役名宿（教练 or 主播） */
function signRetired(s,id){
 const r=(s.retiredCoaches||[]).find(x=>x.id===id);
 if(!r)return;
 if(s.fund<r.cost){toast('资金不足（签约费 '+r.cost+'万）');return;}
 s.fund-=r.cost;
 s.retiredCoaches=s.retiredCoaches.filter(x=>x.id!==id);
 if(r.type==='coach'){
 // 教练：替换当前主教练（旧教练解约）
 if(s.coach)logEvent(s,' 换帅！'+s.coach.name+' 离任，'+r.name+' 出任主教练');
 else logEvent(s,' 签约退役名宿 '+r.name+' 出任主教练');
 s.coach={...r};
 toast(r.name+' 执教！全队战力+'+r.bonus+'%');
 }else{
 // 主播：加入主播席，每日提供人气收入
 s.hosts=[...(s.hosts||[]).filter(h=>h.id!==id),r];
 logEvent(s,' 签约退役主播 '+r.name+'，每日人气收入 '+r.income+'万');
 toast(r.name+' 入驻直播平台！');
 }
 save();renderAll();
}
/* 聘助教（上限2名，加成与主教练叠加）：助教池直聘，或退役名宿教练 6 折转任 */
function hireAssistant(s,id){
 if((s.assistants||[]).length>=2){toast('助教席已满（上限2人），请先解约一名');return;}
 let a=ASSISTANT_POOL.find(x=>x.id===id);
 let cost;
 if(a){
 if((s.assistants||[]).some(x=>x.id===a.id)){toast('已聘任该助教');return;}
 cost=a.cost;
 }else{
 const r=(s.retiredCoaches||[]).find(x=>x.id===id);
 if(!r||r.type!=='coach'){toast('该名宿不能转任助教');return;}
 a={...r,type:'assistant'};
 cost=Math.round(r.cost*0.6); // 名宿转任助教：6 折签约
 s.retiredCoaches=s.retiredCoaches.filter(x=>x.id!==id);
 }
 if(s.fund<cost){toast('资金不足（签约费 '+cost+'万）');return;}
 s.fund-=cost;
 s.assistants=[...(s.assistants||[]),{...a,acqCost:cost}];
 logEvent(s,' 聘任助教 '+a.name+'（'+COACH_STYLE[a.style]+'型 · 全队战力+'+a.bonus+'% · 签约费 '+cost+'万）');
 save();renderAll();toast(a.name+' 加入教练组！');
}
function fireAssistant(s,id){
 const a=(s.assistants||[]).find(x=>x.id===id);
 if(!a)return;
 if(!confirmDanger('与助教 '+a.name+' 解约？\n其全队加成将立即失效。'))return;
 s.assistants=s.assistants.filter(x=>x.id!==id);
 logEvent(s,' 助教 '+a.name+' 与俱乐部解约');
 save();renderAll();
}
/* 签约自由球员（无球可打流向市场的选手） */
function signFreeAgent(s,id){
 const p=(s.freeAgents||[]).find(x=>x.id===id);
 if(!p)return;
 if(s.players.some(x=>x.id===p.id)){toast('已拥有该选手');return;}
 if(s.fund<p.signCost){toast('资金不足（签约费 '+p.signCost+'万）');return;}
 if(weeklyWage(s)+p.wage>s.wageCap){
 const {over,tax}=overCapTax(s,p.wage);
 if(!confirm(' 超帽签约：签下 '+p.name+' 后周薪 '+(weeklyWage(s)+p.wage)+'万（帽 '+s.wageCap+'万），超出 '+over+'万/周 需每周缴纳 60% 奢侈税（'+tax+'万/周）。\n多花钱可以，确定签下？'))return;
 }
 s.fund-=p.signCost;
 p.acqCost=p.signCost; // 买入价锚定（转售保护用）
 if(p.contract==null)p.contract=2; // 签约即给合同年限
 s.freeAgents=s.freeAgents.filter(x=>x.id!==id);
 s.players.push(p);
 recordTransfer(s,'in',p,p.signCost,'自由球员','自由市场直签'); // 年度回顾·转会台账
 logEvent(s,' 自由市场签下 '+p.name+'（无球可打选手 · 签约费 '+p.signCost+'万）');
 save();renderAll();toast(p.name+' 加盟！');
}
