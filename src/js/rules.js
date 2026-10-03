/* ================= KPL 联盟规则扩展 =================
 ① 临时席位：固定 16 + 临时 2；临时席为单赛季授权——K甲 该赛段冠军直授 1 席，另 1 席由资格赛决出；
   临时席位队夺 KPL 冠军 → 直接保留 + 取消该届资格赛（出处：K甲夏季赛赛事规则 §4.5.2）
 ② 转会窗分段：前 4 天「自由交易」可买断/直签；后 3 天「挂牌期」只挂牌/竞价/续约/租借
 ③ 直进青训营：开季俱乐部可直进 2 名新秀（对齐官方直进名额） */
const TEMP_SEAT_COUNT=2;
const TRANSFER_FREE_DAYS=4; // 7 天窗：前 4 自由交易，后 3 挂牌期
const YOUTH_DIRECT_ENTRY=2;
// 席位判定禁止用 TEAM_BRAND（队徽配色表，含升班马）或 AI_TEAMS.seed（根本没有 seed 字段）
// 真实 KPL：16 固定席永不降级；2 临时席 = K甲冠军（直授）+ 资格赛胜者
const TEMP_SEAT_TEAMS=['常山UUG','桐乡情久'];
const FIXED_SEAT_TEAMS=[
 '成都AG超玩会','重庆狼队','武汉eStarPro','北京WB','济南RW侠','广州TTG','杭州LGD.NBW','苏州KSG',
 '佛山DRG','南京Hero久竞','上海EDG.M','深圳DYG','北京JDG','长沙TES.A','上海RNG.M','西安WE'
];
function isFixedSeatTeam(n){return FIXED_SEAT_TEAMS.indexOf(n)>=0;}
function isTempSeatTeam(n){return TEMP_SEAT_TEAMS.indexOf(n)>=0;}
function transferPhase(s){ // 'free' | 'list' | null
 if(!s||!s.preseason||(s.transferWindow||0)<=0)return null;
 const total=(s.transferWindowStart||7);
 const used=total-(s.transferWindow||0);
 return used<TRANSFER_FREE_DAYS?'free':'list';
}
function transferPhaseLabel(s){
 const ph=transferPhase(s);
 if(ph==='free')return '自由交易期';
 if(ph==='list')return '挂牌期';
 return '';
}
function canFreeSign(s){ // 买断/自由市场直签是否开放
 return transferPhase(s)==='free';
}
function initTempSeats(s){
 if(!s)return;
 // 临时席初始化（升班马初始挂临时席；固定 16 队绝不进临时席）
 s.tempSeatFixed=s.tempSeatFixed||[];
 if(!s.tempSeats||!s.tempSeats.length){
  s.tempSeats=TEMP_SEAT_TEAMS.filter(n=>!isFixedSeatTeam(n));
 }
 while(s.tempSeats.length<TEMP_SEAT_COUNT){
  const incoming=KJIA_AI_TEAMS.find(n=>!AI_TEAMS.some(t=>t.name===n)&&s.tempSeats.indexOf(n)<0)
   ||('K甲·新军'+(typeof gameYear==='function'?gameYear(s):(s.season||1)));
  if(s.tempSeats.indexOf(incoming)<0)s.tempSeats.push(incoming); else break;
 }
 s.tempSeatLog=s.tempSeatLog||[];
}
function isTempSeat(s,team){
 return !!(s&&s.tempSeats&&s.tempSeats.includes(team));
}
/* 席位结算：K甲冠军直授 1 席 + 资格赛胜者 1 席；夺冠保留 + 取消资格赛（出处：GUIDE §4.3）
   签名：settleTempSeats(s, opts)，opts = { kglSplitResult, triggeredBy:'split'|'season' }
   _seatProtected / worst / worstPts / 积分垫底评选——已全部删除（GUIDE §3.3 + §6）。 */
function settleTempSeats(s,opts){
 if(!s)return;
 initTempSeats(s);
 if(!s.tempSeats||!s.tempSeats.length)return;
 opts=opts||{};

 const curSeason=s.season||1;
 s.tempSeatFixedExpiry=s.tempSeatFixedExpiry||{};

 // ① 清理过期保留（一季化；老档无 expiry 视为已过期）
 s.tempSeatFixed=(s.tempSeatFixed||[]).filter(t=>(s.tempSeatFixedExpiry[t]||0)>=curSeason);

 // ② 夺冠判定：刚结束那届 KPL 冠军是临时席队 → 保留席位 + 取消资格赛
 const champTeams=[];
 (s.titleHistory||[]).forEach(t=>{
  if(!t||!t.champ)return;
  if(t.season!=null&&t.season!==curSeason)return;
  if(isTempSeat(s,t.champ)&&!isFixedSeatTeam(t.champ)){
   if(champTeams.indexOf(t.champ)<0)champTeams.push(t.champ);
   s.tempSeatFixedExpiry[t.champ]=curSeason;
   if(s.tempSeatFixed.indexOf(t.champ)<0)s.tempSeatFixed.push(t.champ);
   try{logEvent(s,' '+t.champ+' 夺得'+(t.event||'冠军')+'——直接保留下赛季 KPL 临时席位（取消本届资格赛）');}catch(e){}
  }
 });

 // 保留席仍占一个临时席，只排除它参与轮换；不得踢出池子
 s.tempSeats=s.tempSeats.filter(t=>!isFixedSeatTeam(t));

 // ③ 取 K甲 刚结束赛段的结果
 const kglResult=opts.kglSplitResult||(typeof lastKjiaSplitResult==='function'?lastKjiaSplitResult(s):{});
 const kglChamp=kglResult.champion||null;
 const prevTempSeats=(s.tempSeats||[]).slice(); // 资格赛前的临时席快照

 // ④ 决定 2 个席位的归属
 let awards=[];
 if(champTeams.length){
  // 例外：夺冠保留 → 资格赛取消（GUIDE §2.3）
  awards=champTeams.slice(0,TEMP_SEAT_COUNT);
  if(kglChamp&&awards.length<TEMP_SEAT_COUNT&&awards.indexOf(kglChamp)<0){
   awards.push(kglChamp);
  }
  if(typeof cancelSeatPlayoff==='function')cancelSeatPlayoff(s);
 }else{
  // 常态：K甲冠军直授 + 资格赛 1 席
  if(kglChamp&&awards.indexOf(kglChamp)<0)awards.push(kglChamp);
  if(typeof runSeatPlayoff==='function'){
   const po=runSeatPlayoff(s,kglResult,prevTempSeats);
   (po.winner||[]).forEach(n=>{if(awards.length<TEMP_SEAT_COUNT&&awards.indexOf(n)<0)awards.push(n);});
  }
 }

 // ⑤ 到期：上届临时席里未获授予的俱乐部失去参赛资格
 const expired=prevTempSeats.filter(t=>awards.indexOf(t)<0);
 s.tempSeats=awards.slice(0,TEMP_SEAT_COUNT);

 // 兜底补齐（防御性：不足 2 席时从 K甲 顺延，别让联盟少队）
 const fallback=[kglResult.runnerUp,kglResult.third,kglResult.fourth].filter(Boolean);
 while(s.tempSeats.length<TEMP_SEAT_COUNT){
  const extra=fallback.find(n=>s.tempSeats.indexOf(n)<0&&!isFixedSeatTeam(n))
   ||(typeof KJIA_AI_TEAMS!=='undefined'?KJIA_AI_TEAMS:[]).find(n=>
    !AI_TEAMS.some(t=>t.name===n)&&s.tempSeats.indexOf(n)<0)
   ||('K甲·新军'+(typeof gameYear==='function'?gameYear(s):curSeason));
  if(s.tempSeats.indexOf(extra)<0)s.tempSeats.push(extra); else break;
 }

 // ⑥ 玩家席位判定
 if(expired.indexOf(s.teamName)>=0&&awards.indexOf(s.teamName)<0){
  s.seatLost=true;
  s.seatLostReason=(s.seatPlayoff&&!s.seatPlayoff.cancelled)?'tempSeatPlayoffLost':'tempSeatExpired';
  try{logEvent(s,' 你的临时席位未获授予——按规则回到 K甲 参赛，日后可通过 K甲 冠军或资格赛重回 KPL');}catch(e){}
 }

 // ⑦ 席位变动日志
 s.tempSeatLog=s.tempSeatLog||[];
 const yr=typeof gameYear==='function'?gameYear(s):curSeason;
 expired.forEach(t=>{
  const rep=s.tempSeats.find(n=>prevTempSeats.indexOf(n)<0)||'(待定)';
  s.tempSeatLog.unshift(yr+'：'+t+' 席位到期 → '+rep+' 获得下赛季 KPL 临时席位');
 });
 s.tempSeatLog=s.tempSeatLog.slice(0,8);
 if(expired.length){
  try{logEvent(s,' 临时席变动：'+expired.join('、')+' 未获授予，'+s.tempSeats.join('、')+' 获得下赛季 KPL 临时席位');}catch(e){}
 }

 // ⑧ 二队 K甲夺冠额外关注度（保留原有逻辑）
 try{
  if(s.kjia&&s.kjia.champ===kjiaMyName(s)){
   logEvent(s,' 二队 K甲夺冠——俱乐部斩获临时席位资格赛话语权（关注度+）');
   addFans(s,1,'K甲夺冠·席位资格');
  }
 }catch(e){}

 // ⑨ 真实写回联盟状态：以 newSeats 为唯一样本源
 const newSeats=[...FIXED_SEAT_TEAMS];
 s.tempSeats.forEach(t=>{if(newSeats.indexOf(t)<0)newSeats.push(t);});
 const newSeatSet=new Set(newSeats);

 // 1) AI_TEAMS 写回
 if(typeof AI_TEAMS!=='undefined'&&Array.isArray(AI_TEAMS)){
  for(let i=AI_TEAMS.length-1;i>=0;i--){
   if(!newSeatSet.has(AI_TEAMS[i].name)){
    AI_TEAMS.splice(i,1);
   }
  }
  newSeats.forEach(nm=>{
   if(!AI_TEAMS.some(t=>t.name===nm)){
    AI_TEAMS.push({
     name:nm,
     icon:(typeof KPL_YEAR_ICON!=='undefined'&&KPL_YEAR_ICON[nm])||'⭐',
     budget:550,cap:95,coach:'co4',
     desc:nm+' · K甲晋级队伍'
    });
   }
  });
 }

 // 2) AI_ROSTERS 写回
 if(typeof AI_ROSTERS!=='undefined'&&AI_ROSTERS){
  Object.keys(AI_ROSTERS).forEach(k=>{
   if(!newSeatSet.has(k))delete AI_ROSTERS[k];
  });
  newSeats.forEach(nm=>{
   if(!AI_ROSTERS[nm]){
    const tplKey=Object.keys(AI_ROSTERS)[0];
    // 尝试复用已退出队伍的阵容，否则克隆首个已有阵容
    const donor=expired.find(w=>AI_ROSTERS[w]);
    AI_ROSTERS[nm]=donor
     ?JSON.parse(JSON.stringify(AI_ROSTERS[donor]))
     :(tplKey?JSON.parse(JSON.stringify(AI_ROSTERS[tplKey])):{p:['top19','jg10','mid18','ad18','sup19'],u:[]});
   }
  });
  expired.forEach(w=>{if(!newSeatSet.has(w))delete AI_ROSTERS[w];});
 }

 // 3) s.leagueTeams 写回
 s.leagueTeams=newSeats.slice();
 if(s.seatLost){
  s.leagueTeams=s.leagueTeams.filter(t=>t!==s.teamName);
 }
}
function tempSeatsPanelHtml(){
 const s=S;
 if(!s||!s.tempSeats||!s.tempSeats.length)return '';
 const atRisk=isTempSeat(s,s.teamName);
 let html=`<div class="panel"><h3>临时席位 <span class="tag">固定 16 + 临时 ${TEMP_SEAT_COUNT}</span></h3>
 <div class="hint" style="margin-bottom:8px"><b>临时席位为单赛季授权</b>：K甲 该赛段冠军直授 1 席，另 1 席由资格赛（上届 2 支 KPL 临时席位俱乐部 + K甲 亚/季军）决出。老牌豪门（AG/狼队/eStar 等）是固定席，永不降级。${atRisk?'<b class="red">你执教的是临时席——夺冠可直接保留（并取消该届资格赛）；未获授予者回 K甲 参赛。</b>':'你执教的俱乐部是固定席。'}</div>
 <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">${s.tempSeats.map(t=>`<span class="tag" style="border-color:var(--gold)">${crest(null,t,14)} ${t} · 临时${t===s.teamName?'（你）':''}</span>`).join('')}</div>`;
 if((s.tempSeatFixed||[]).length){
  html+=`<div class="hint">夺冠保留下赛季席位：${s.tempSeatFixed.map(t=>_escTxt(t)).join('、')}</div>`;
 }
 if((s.tempSeatLog||[]).length){
  html+=`<div class="hint">近年变动：${s.tempSeatLog.slice(0,4).map(l=>_escTxt(l)).join('<br>')}</div>`;
 }
 // 资格赛面板（若有）
 if(typeof seatPlayoffPanelHtml==='function'){
  const poHtml=seatPlayoffPanelHtml();
  if(poHtml)html+=poHtml;
 }
 html+=`</div>`;
 return html;
}
/* 直进青训营：开季补 2 名（若营未满） */
function youthDirectEntry(s){
 if(!s||s.mode!=='manager')return;
 if(s._youthDirectSeason===s.season&&s._youthDirectSplit===s.split)return;
 s.academy=s.academy||[];
 let n=0;
 while(n<YOUTH_DIRECT_ENTRY&&s.academy.length<6){
 try{
 const r=genRookie(s);
 s.academy.push(r);
 n++;
 }catch(e){break;}
 }
 if(n){
 s._youthDirectSeason=s.season;s._youthDirectSplit=s.split;
 try{logEvent(s,' 青训营直进 '+n+' 名新秀（官方直进名额 '+YOUTH_DIRECT_ENTRY+'）——培养后可用自留签晋升');}catch(e){}
 }
}
/* 转会窗分段：买入类操作在挂牌期拦截 */
function freeSignBlockedReason(s){
 if(canFreeSign(s))return '';
 // 仅挂牌期拦截买断直签。非窗期保持放行（历史上如此）——误导文案在 UI 层改，不在此新增闸门
 if(s&&s.preseason)return '已进入挂牌期（后 '+TRANSFER_FREE_DAYS+' 天）——只能挂牌/竞价/续约/租借，不能买断直签';
 return '';
}
/* 身份限制：经理才做买断/出售生意；教练=俱乐部代管（应急租借/引援申请）；选手不碰转会 */
function transferOpsBlockedReason(s){
 if(!s||!s.players)return '尚未开局';
 if(s.mode==='coach')return '教练生涯：买断/出售由俱乐部打理——请用转会页「应急租借 / 引援申请」';
 if(s.mode==='player')return '选手生涯：不操作俱乐部买卖（由经纪与俱乐部处理）';
 return '';
}
/* ================= 规则中心：签约/放行/不变量巡检 =================
   canSign / canRelease：玩家 UI 与 AI 行程共用同一闸门。
   auditSave：业务不变量（双挂/名单/状态旗）——读档后与赛季末自动跑，
   与 migrate 的「字段修复」互补，不替代它。 */
const AI_ROSTER_MAX=5; // AI 队 def 名册上限（一队五位置）
function canSign(s,p,opts){
 if(!s||!p)return {ok:false,reason:'无效选手'};
 const o=opts||{};
 const actor=o.actor||'player';
 const name=p.name||'选手';
 const pid=p.id;
 const pos=p.pos;
 if(actor==='player'){
  if(typeof transferOpsBlockedReason==='function'){
   const mb=transferOpsBlockedReason(s);
   if(mb)return {ok:false,reason:mb};
  }
  if(typeof freeSignBlockedReason==='function'&&o.checkWindow!==false){
   const fb=freeSignBlockedReason(s);
   if(fb)return {ok:false,reason:fb};
  }
  if((s.players||[]).some(x=>x.id===pid))return {ok:false,reason:name+' 已在名单中'};
  // 与 rosterGuard 同口径：软上限 10 可宽限到硬上限 12（先签后卖），硬顶才拒
  if(typeof rosterHardMax==='function'&&typeof rosterCount==='function'&&rosterCount(s)>=rosterHardMax())
   return {ok:false,reason:'KPL 大名单上限 '+rosterHardMax()+' 人（含先签后卖宽限）'};
  else if(typeof rosterFull==='function'&&typeof rosterHardMax!=='function'&&rosterFull(s))
   return {ok:false,reason:'KPL 大名单上限 '+(typeof ROSTER_MAX!=='undefined'?ROSTER_MAX:10)+' 人'};
  const pst=(typeof playerStatus==='function')?playerStatus(p,s):null;
  if(pst&&pst.loanOut)return {ok:false,reason:name+' 租借在外，不能直接签约'};
  if(pst&&pst.kjia)return {ok:false,reason:name+' 正在 K甲锻炼'};
  return {ok:true,reason:''};
 }
 // AI / 俱乐部侧：按 def 名册与位置名额
 const team=o.team||s.teamName;
 const map=(typeof aiRosterDefMap==='function')?aiRosterDefMap(s):null;
 if(!map||!map[team])return {ok:true,reason:''}; // 无名册数据时不硬拦（时代/杯赛临时队）
 const arr=map[team];
 if(o.allowReplace!==true&&arr.length>=AI_ROSTER_MAX)
  return {ok:false,reason:team+' 名册已满（'+AI_ROSTER_MAX+'人）'};
 if(o.allowReplace!==true&&pos&&arr.some(id=>{
  const d=(typeof defOf==='function')?defOf(s,id):null;
  return d&&d.pos===pos;
 }))return {ok:false,reason:team+' 已有'+(POS&&POS[pos]?POS[pos][0]:pos)};
 if(pid&&arr.indexOf(pid)>=0&&o.allowReplace!==true)
  return {ok:false,reason:name+' 已在 '+team+' 名册'};
 return {ok:true,reason:''};
}
function canRelease(s,p,opts){
 if(!s||!p)return {ok:false,reason:'无效选手'};
 const o=opts||{};
 const name=p.name||'选手';
 if(typeof natCamping==='function'&&natCamping(s,p))
  return {ok:false,reason:name+' 国家队集训中，不能离队/出售'};
 if(p.loanOut)return {ok:false,reason:name+' 已在外租借'};
 if((p.kjia||0)>0)return {ok:false,reason:name+' K甲锻炼中，不能出售'};
 if(o.asSale&&p.loan)return {ok:false,reason:name+' 是租借选手，不能出售'};
 return {ok:true,reason:''};
}
/* 业务不变量巡检：发现问题能安全修的修掉，修不了的记入 issues */
function nLabel(p){return (p&&p.name)||'选手';}
function auditSave(s,opts){
 const silent=!!(opts&&opts.silent);
 const issues=[],repairs=[];
 if(!s)return {ok:true,issues,repairs};
 const players=s.players||[];
 const byId={};
 players.forEach(p=>{if(p&&p.id)byId[p.id]=p;});

 // ① 玩家名单 vs AI 名册双挂：玩家侧优先，AI 侧除名
 if(typeof aiRosterDefMap==='function'&&typeof aiDetachDef==='function'){
  const map=aiRosterDefMap(s);
  Object.keys(map).forEach(tn=>{
   if(tn===s.teamName)return;
   (map[tn]||[]).slice().forEach(pid=>{
    if(byId[pid]){
     issues.push('双挂：'+(byId[pid].name||pid)+' 同时在玩家名单与 '+tn+' AI 名册');
     aiDetachDef(s,pid);
     repairs.push('从 '+tn+' AI 名册移除 '+(byId[pid].name||pid));
    }
   });
  });
  // ② 同一 def 挂两支 AI 队：保留先出现的队
  const seen={};
  Object.keys(map).forEach(tn=>{
   map[tn]=(map[tn]||[]).filter(pid=>{
    if(seen[pid]&&seen[pid]!==tn){
     issues.push('AI 双挂：def '+pid+' 同时在 '+seen[pid]+' 与 '+tn);
     return false;
    }
    if(!seen[pid])seen[pid]=tn;
    return true;
   });
  });
  // ③ AI 名册超编：截断到 5（保留原有顺序）
  Object.keys(map).forEach(tn=>{
   if((map[tn]||[]).length>AI_ROSTER_MAX){
    issues.push('AI 超编：'+tn+' 名册 '+map[tn].length+' > '+AI_ROSTER_MAX);
    map[tn]=map[tn].slice(0,AI_ROSTER_MAX);
    repairs.push('截断 '+tn+' 名册至 '+AI_ROSTER_MAX);
   }
  });
 }

 // ④ 首发幽灵：lineup 引用不在 players
 const lineIds=new Set((s.lineup||[]).map(id=>id));
 (s.lineup||[]).slice().forEach(id=>{
  if(!byId[id]){
   issues.push('首发幽灵：'+id+' 不在名单');
   s.lineup=s.lineup.filter(x=>x!==id);
   if(s.pick){
    players.forEach(p=>{if(p.id===id&&s.pick[p.pos]!=null)delete s.pick[p.pos];});
   }
   repairs.push('从首发移除幽灵 '+id);
  }
 });
 // ⑤ 玩家名单超编：收敛到 ROSTER_MAX（保留总值更高者，其余回自由市场）
 const maxR=(typeof ROSTER_MAX!=='undefined')?ROSTER_MAX:10;
 if(players.length>maxR){
  issues.push('玩家名单超编：'+players.length+' > '+maxR);
  const ranked=players.slice().sort((a,b)=>{
   const oa=(typeof overall==='function')?overall(a):0;
   const ob=(typeof overall==='function')?overall(b):0;
   if(ob!==oa)return ob-oa;
   return (b.age||0)-(a.age||0); // 同总值留更年轻的
  });
  const keep=ranked.slice(0,maxR);
  const drop=ranked.slice(maxR);
  const keepIds=new Set(keep.map(p=>p.id));
  s.players=players.filter(p=>keepIds.has(p.id));
  s.lineup=(s.lineup||[]).filter(id=>keepIds.has(id));
  drop.forEach(p=>{
   s.freeAgents=s.freeAgents||[];
   if(!s.freeAgents.some(x=>x.id===p.id)){
    if(!(s.freeAgents||[]).some(x=>x.id===p.id))s.freeAgents.push({...p,team:null,willingness:Math.max(p.willingness||50,55),loanOut:null,kjia:0});
   }
   repairs.push(nLabel(p)+' 因名单超编转入自由市场');
  });
  try{logEvent(s,' 名单超编收敛：保留总值前 '+maxR+' 人，'+drop.length+' 人转入自由市场');}catch(e){}
 }
 // ⑥ 状态旗冲突：读 playerStatus 单一出口，不在本文件裸拼旗标
 players.forEach(p=>{
  if(!p)return;
  const n=p.name||p.id;
  const st=(typeof playerStatus==='function')?playerStatus(p,s):null;
  if(st&&st.loan&&st.loanOut){
   issues.push('状态冲突：'+n+' 同时 loan 与 loanOut');
   p.loanOut=null;repairs.push(n+' 清除 loanOut（保留 loan）');
  }
  if(st&&st.loanOut&&st.kjia){
   issues.push('状态冲突：'+n+' 同时租借与 K甲');
   p.kjia=0;repairs.push(n+' 清除 kjia（保留 loanOut）');
  }
  const listed=(s.listed||[]).some(x=>x.id===p.id);
  const busy=!!(st&&st.busy);
  if(listed&&busy){
   issues.push('挂牌冲突：'+n+' 挂牌但不在队可售状态');
   s.listed=s.listed.filter(x=>x.id!==p.id);
   s.bids=(s.bids||[]).filter(x=>x.id!==p.id);
   repairs.push(n+' 撤牌（不可售状态）');
  }
  const w=p.wage;
  if(typeof w!=='number'||!isFinite(w)||w<0){
   issues.push('工资非法：'+n+' wage='+w);
   repairs.push(n+' 工资待 scrubWages 重估');
  }
 });
 // ⑦ captain 指向幽灵
 if(s.captain&&!byId[s.captain]){
  issues.push('队长幽灵：captain='+s.captain);
  s.captain=null;repairs.push('清空队长');
 }
 // ⑧ offers 指向不存在的选手
 (s.offers||[]).slice().forEach(o=>{
  if(o&&o.pid&&!byId[o.pid]&&!(s.market||[]).some(x=>x.id===o.pid)){
   issues.push('报价幽灵：pid='+o.pid);
   s.offers=s.offers.filter(x=>x!==o);
   repairs.push('清除幽灵报价 '+o.pid);
  }
 });
 // ⑨ fund 非法
 if(typeof s.fund!=='number'||!isFinite(s.fund)){
  issues.push('资金非法：fund='+s.fund);
  s.fund=0;repairs.push('fund 归零');
 }
 const report={ok:!issues.length,issues,repairs};
 s._lastAudit=report;
 if(!silent&&issues.length){
  try{
   logEvent(s,' 存档巡检：发现 '+issues.length+' 项不一致'+(repairs.length?'，已自动修复 '+repairs.length+' 项':'')+'（详情见控制台）');
  }catch(e){}
  try{console.warn('[auditSave]',issues,repairs);}catch(e){}
 }
 return report;
}
