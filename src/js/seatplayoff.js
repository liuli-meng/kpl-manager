/* ================= KPL 临时席位资格赛 =================
   权威出处：K甲夏季赛赛事规则 §4.5.2 + 资格赛专门规则
   参赛：上届 KPL 2 支临时席位俱乐部 + K甲 刚结束赛段的亚军、季军（未过审顺延至殿军）
   分档：4晋1 胜败组淘汰 / 3晋1 单循环 / 2晋1 单场 BO7
   例外：若上届临时席位俱乐部夺得刚结束那届 KPL 冠军 → 取消本届资格赛（见 rules.js）
   出处：docs/GUIDE-席位与资格赛-改造指南-2026-10-03.md §4.2 */

/* ── 开关（GUIDE §8）──
   SEAT_SETTLE_PER_SPLIT: 权威指向 true（每赛季一次）
   SEAT_LOSS_GOES_TO_KJIA: 权威指向 true（回 K甲 参赛） */
const SEAT_SETTLE_PER_SPLIT=true;   // true → startSplit 处结算；false → newSeason 处（现状）
const SEAT_LOSS_GOES_TO_KJIA=true;  // true → 回 K甲 计积分；false → 复用 joblessGate/genJobOffers

/* 取 K甲 刚结束赛段的排名结果（供 settleTempSeats 调用）
   读 s.kjia.seatHistory[0]（kjia.js finishKjiaSplit 已留档） */
function lastKjiaSplitResult(s){
 const k=s&&s.kjia;
 if(!k)return {};
 // 优先从 seatHistory 取最新一条（已排好序）
 if(k.seatHistory&&k.seatHistory.length){
  const h=k.seatHistory[0];
  return {champion:h.champion,runnerUp:h.runnerUp,third:h.third,fourth:h.fourth};
 }
 // 兜底：直接从当前 kjia 状态取
 if(k.champ)return {champion:k.champ,runnerUp:k.runnerUp||null,third:k.third||null,fourth:k.fourth||null};
 return {};
}

/* 构建资格赛参赛方 + 分档
   kglResult: lastKjiaSplitResult(s) 返回值
   prevTempSeats: 上届 KPL 2 支临时席位俱乐部（s.tempSeats 在调用前的值）
   返回: { teams:[{name,src}], mode:'4to1Bracket'|'3to1RoundRobin'|'2to1Single', slots:1|2 } */
function buildSeatPlayoff(s,kglResult,prevTempSeats){
 const kglChamp=kglResult.champion;
 // K甲冠军直授 1 席 → 资格赛出 1 个名额（常态）
 // K甲冠亚军均未过审 → 资格赛出 2 个名额（本版简化：游戏中不模拟"过审"，视为全部过审）
 const slots=1; // 常态 1 个名额

 const teams=[];
 // 上届 2 支 KPL 临时席位俱乐部（排除 K甲冠军——它已直授）
 (prevTempSeats||[]).forEach(t=>{
  if(t!==kglChamp&&teams.every(x=>x.name!==t)){
   teams.push({name:t,src:'kplTemp'});
  }
 });
 // K甲 亚军、季军（未过审顺延至殿军——本版视为全过审，亚/季军直接参赛）
 if(kglResult.runnerUp&&teams.every(x=>x.name!==kglResult.runnerUp)){
  teams.push({name:kglResult.runnerUp,src:'kglRunnerUp'});
 }
 if(kglResult.third&&teams.every(x=>x.name!==kglResult.third)){
  teams.push({name:kglResult.third,src:'kglThird'});
 }
 // 补齐：若不足 2 队则从殿军顺延
 if(teams.length<2&&kglResult.fourth&&teams.every(x=>x.name!==kglResult.fourth)){
  teams.push({name:kglResult.fourth,src:'kglFourth'});
 }

 // 分档（GUIDE §2.2）
 let mode='4to1Bracket'; // 默认 4 晋 1
 if(teams.length<=2) mode='2to1Single';
 else if(teams.length===3) mode='3to1RoundRobin';
 // 4 队及以上 → 4 晋 1 胜败组淘汰

 return {teams:teams.slice(0,4),mode,slots};
}

/* 模拟一场 BO7（4 胜制）
   返回 {winner, loser, ws, ls}（ws/ls 为胜方/负方局数） */
function simBo7(pwA,pwB,nameA,nameB){
 let mw=0,ow=0;
 for(let i=1;i<=7&&mw<4&&ow<4;i++){
  if(Math.random()<winChance(pwA,pwB))mw++;else ow++;
 }
 return mw>ow
  ?{winner:nameA,loser:nameB,ws:mw,ls:ow}
  :{winner:nameB,loser:nameA,ws:ow,ls:mw};
}

/* 取资格赛参赛队伍的战力（玩家一队用 teamPower，K甲队用 kjiaAiPower，KPL AI 队用 AI_TEAMS 战力）*/
function seatPlayoffPower(s,name){
 // 玩家一队：使用真实阵容战力
 if(s&&s.teamName===name){
  if(typeof teamPower==='function'){
   const tp=teamPower(s);
   if(tp>0)return Math.round(tp);
  }
  return 430;
 }
 // 玩家二队
 if(typeof kjiaMyName==='function'&&name===kjiaMyName(s))return kjiaTeamPower(s);
 // K甲 AI 队
 if(typeof KJIA_AI_DEFS!=='undefined'&&KJIA_AI_DEFS.some(d=>d.name===name))return kjiaAiPower(s,name);
 // KPL AI 队伍
 if(typeof AI_TEAMS!=='undefined'){
  const t=AI_TEAMS.find(x=>x.name===name);
  if(t)return t.power||450;
 }
 return 400; // 兜底
}

/* 模拟资格赛（完整流程）
   po: buildSeatPlayoff 返回的结构
   返回: { winner:[胜者名], rounds:[{desc}], done:true } */
function simSeatPlayoff(s,po){
 if(!po||!po.teams||po.teams.length<2)return {winner:[],rounds:[],done:true};
 const rounds=[];
 const pw={};
 po.teams.forEach(t=>{pw[t.name]=seatPlayoffPower(s,t.name);});

 if(po.mode==='2to1Single'){
  // 2 晋 1 单场 BO7
  const a=po.teams[0].name,b=po.teams[1].name;
  const r=simBo7(pw[a],pw[b],a,b);
  rounds.push({desc:a+' vs '+b+' → '+r.winner+' 胜（'+r.ws+':'+r.ls+'）'});
  return {winner:[r.winner],rounds,done:true};
 }

 if(po.mode==='3to1RoundRobin'){
  // 3 晋 1 单循环积分赛 BO7（GUIDE §2.2）
  const names=po.teams.map(t=>t.name);
  const pts={};names.forEach(n=>pts[n]=0);
  for(let i=0;i<names.length;i++){
   for(let j=i+1;j<names.length;j++){
    const r=simBo7(pw[names[i]],pw[names[j]],names[i],names[j]);
    pts[r.winner]++;
    rounds.push({desc:names[i]+' vs '+names[j]+' → '+r.winner+' 胜（'+r.ws+':'+r.ls+'）'});
   }
  }
  const ranked=names.sort((a,b)=>pts[b]-pts[a]);
  return {winner:[ranked[0]],rounds,done:true};
 }

 // 4to1Bracket: 4 晋 1 胜败组淘汰赛（双败 BO7）
 const [t1,t2,t3,t4]=po.teams.map(t=>t.name);
 // 胜者组半决赛
 const wb1=simBo7(pw[t1],pw[t4],t1,t4); // 1 vs 4
 rounds.push({desc:'胜者组：'+t1+' vs '+t4+' → '+wb1.winner+' 胜（'+wb1.ws+':'+wb1.ls+'）'});
 const wb2=simBo7(pw[t2],pw[t3],t2,t3); // 2 vs 3
 rounds.push({desc:'胜者组：'+t2+' vs '+t3+' → '+wb2.winner+' 胜（'+wb2.ws+':'+wb2.ls+'）'});
 // 败者组第一轮
 const lb1=simBo7(pw[wb1.loser],pw[wb2.loser],wb1.loser,wb2.loser);
 rounds.push({desc:'败者组：'+wb1.loser+' vs '+wb2.loser+' → '+lb1.winner+' 胜（'+lb1.ws+':'+lb1.ls+'）'});
 // 胜者组决赛
 const wf=simBo7(pw[wb1.winner],pw[wb2.winner],wb1.winner,wb2.winner);
 rounds.push({desc:'胜者组决赛：'+wb1.winner+' vs '+wb2.winner+' → '+wf.winner+' 胜（'+wf.ws+':'+wf.ls+'）'});
 // 败者组第二轮（胜者组决赛负者 vs 败者组第一轮胜者）
 const lb2=simBo7(pw[wf.loser],pw[lb1.winner],wf.loser,lb1.winner);
 rounds.push({desc:'败者组决赛：'+wf.loser+' vs '+lb1.winner+' → '+lb2.winner+' 胜（'+lb2.ws+':'+lb2.ls+'）'});
 // 总决赛（胜者组冠军 vs 败者组冠军）
 const final=simBo7(pw[wf.winner],pw[lb2.winner],wf.winner,lb2.winner);
 rounds.push({desc:'资格赛总决赛：'+wf.winner+' vs '+lb2.winner+' → '+final.winner+' 胜（'+final.ws+':'+final.ls+'）'});

 return {winner:[final.winner],rounds,done:true};
}

/* 执行完整资格赛并写入状态
   返回: { winner:[], cancelled:false } 或 { winner:[], cancelled:true } */
function runSeatPlayoff(s,kglResult,prevTempSeats){
 const po=buildSeatPlayoff(s,kglResult,prevTempSeats);
 if(!po.teams.length){
  s.seatPlayoff={cancelled:true,reason:'无合格参赛方',done:true};
  return {winner:[],cancelled:true};
 }
 const result=simSeatPlayoff(s,po);
 s.seatPlayoff={
  year:typeof gameYear==='function'?gameYear(s):(s.season||1),
  split:s.split||'spring',
  teams:po.teams,
  mode:po.mode,
  rounds:result.rounds,
  winner:result.winner[0]||null,
  done:true,
  cancelled:false
 };
 // 日志
 try{
  const modeLabel=po.mode==='4to1Bracket'?'4晋1胜败组淘汰赛':(po.mode==='3to1RoundRobin'?'3晋1单循环积分赛':'2晋1单场BO7');
  logEvent(s,' KPL 临时席位资格赛（'+modeLabel+'）：'+po.teams.map(t=>t.name).join(' / ')+' → '+result.winner[0]+' 获得临时席位');
  result.rounds.forEach(r=>{logEvent(s,' 资格赛：'+r.desc);});
 }catch(e){}
 return {winner:result.winner,cancelled:false};
}

/* 取消资格赛（夺冠例外场景） */
function cancelSeatPlayoff(s){
 s.seatPlayoff={cancelled:true,reason:'临时席位俱乐部夺冠，取消本届资格赛',done:true,
  year:typeof gameYear==='function'?gameYear(s):(s.season||1),split:s.split||'spring'};
 try{logEvent(s,' KPL 临时席位资格赛——本届取消（临时席位俱乐部夺冠，直接保留席位）');}catch(e){}
}

/* 资格赛面板 HTML（照 tempSeatsPanelHtml 风格） */
function seatPlayoffPanelHtml(){
 const s=typeof S!=='undefined'?S:null;
 if(!s||!s.seatPlayoff)return '';
 const po=s.seatPlayoff;
 let html='<div class="panel"><h3>临时席位资格赛 <span class="tag">'+(po.cancelled?'已取消':'已结束')+'</span></h3>';
 if(po.cancelled){
  html+='<div class="hint">'+_escTxt(po.reason||'本届资格赛取消')+'</div>';
 }else{
  const modeLabel=po.mode==='4to1Bracket'?'4晋1 胜败组淘汰赛 BO7':(po.mode==='3to1RoundRobin'?'3晋1 单循环积分赛 BO7':'2晋1 单场 BO7');
  html+='<div class="hint">赛制：'+modeLabel+'</div>';
  html+='<div class="hint">参赛：'+(po.teams||[]).map(t=>_escTxt(t.name)+' <small>('+_escTxt(t.src)+')</small>').join('、')+'</div>';
  if(po.rounds&&po.rounds.length){
   html+='<div class="hint" style="margin-top:4px">对阵：<br>'+po.rounds.map(r=>_escTxt(r.desc)).join('<br>')+'</div>';
  }
  if(po.winner)html+='<div class="hint"><b>胜者：'+_escTxt(po.winner)+'</b> 获得下赛季 KPL 临时席位</div>';
 }
 html+='</div>';
 return html;
}
