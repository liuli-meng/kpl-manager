/* ================= KPL 联盟规则扩展 =================
 ① 临时席位：固定 16 + 临时 2；临时席年度垫底可被收回，由 K甲/资格赛队伍顶上（只升不降）
 ② 转会窗分段：前 4 天「自由交易」可买断/直签；后 3 天「挂牌期」只挂牌/竞价/续约/租借
 ③ 直进青训营：开季俱乐部可直进 2 名新秀（对齐官方直进名额） */
const TEMP_SEAT_COUNT=2;
const TRANSFER_FREE_DAYS=4; // 7 天窗：前 4 自由交易，后 3 挂牌期
const YOUTH_DIRECT_ENTRY=2;
// 席位判定禁止用 TEAM_BRAND（队徽配色表，含升班马）或 AI_TEAMS.seed（根本没有 seed 字段）
// 真实 KPL：16 固定席永不降级；2 临时席 = K甲升班马，年度垫底可被收回
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
 // 升班马挂临时席（含玩家执教升班马——真实 KPL 席位可收回）；固定 16 队绝不进临时席
 s.tempSeatFixed=s.tempSeatFixed||[];
 s.tempSeats=TEMP_SEAT_TEAMS.filter(n=>s.tempSeatFixed.indexOf(n)<0);
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
/* 年度轮换时结算临时席：垫底临时席收回（含玩家升班马）→ K甲冠军顶上；
   夺冠不转正固定席——只是下赛季保留席位、免打席位赛（仍可能在之后年度被收回） */
function settleTempSeats(s){
 if(!s)return;
 initTempSeats(s);
 if(!s.tempSeats||!s.tempSeats.length)return;
 s.tempSeatFixed=s.tempSeatFixed||[];
 (s.titleHistory||[]).forEach(t=>{
  if(t&&t.champ&&isTempSeat(s,t.champ)&&s.tempSeatFixed.indexOf(t.champ)<0&&!isFixedSeatTeam(t.champ)){
   // 夺冠≠转正固定席：下赛季保留席位、免打席位赛（非永久固定）
   s.tempSeatFixed.push(t.champ);
   try{logEvent(s,' '+t.champ+' 夺得'+(t.event||'冠军')+'——下赛季保留 KPL 席位，免打席位赛（非固定席）');}catch(e){}
  }
 });
 s.tempSeats=s.tempSeats.filter(t=>!isFixedSeatTeam(t)&&s.tempSeatFixed.indexOf(t)<0);
 if(s.tempSeats.length<TEMP_SEAT_COUNT){
  TEMP_SEAT_TEAMS.forEach(n=>{
   if(s.tempSeats.length<TEMP_SEAT_COUNT&&s.tempSeats.indexOf(n)<0&&s.tempSeatFixed.indexOf(n)<0)s.tempSeats.push(n);
  });
 }
 const pts=s.annualPts||{};
 let worst=null,worstPts=Infinity;
 s.tempSeats.forEach(t=>{
  const p=pts[t]||0;
  if(p<worstPts){worstPts=p;worst=t;}
 });
 if(!worst||!s.tempSeats.length)return;
 if(s.tempSeatFixed.indexOf(worst)>=0)return;
 let incoming=null;
 try{
  const k=s.kjia;
  if(k&&k.champ&&k.champ!==kjiaMyName(s)&&!AI_TEAMS.some(t=>t.name===k.champ)){
   incoming=k.champ;
  }else if(k&&k.champ){
   const rank=kjiaRank(s)||[];
   incoming=rank.find(n=>n!==k.champ&&n!==kjiaMyName(s))||null;
  }
 }catch(e){}
 if(!incoming){
  incoming=KJIA_AI_TEAMS.find(n=>!AI_TEAMS.some(t=>t.name===n))||('K甲·新军'+gameYear(s));
 }
 s.tempSeats=s.tempSeats.filter(t=>t!==worst);
 if(incoming&&incoming!==s.teamName&&!isFixedSeatTeam(incoming)&&s.tempSeats.indexOf(incoming)<0&&s.tempSeatFixed.indexOf(incoming)<0)s.tempSeats.push(incoming);
 s.tempSeatLog=s.tempSeatLog||[];
 s.tempSeatLog.unshift(gameYear(s)+'：收回 '+worst+' 临时席 → '+incoming+' 顶上');
 s.tempSeatLog=s.tempSeatLog.slice(0,8);
 try{
  logEvent(s,' 临时席变动：'+worst+' 席位收回，'+incoming+' 获得下赛季 KPL 临时席位（固定席位不降级）');
 }catch(e){}
 if(worst===s.teamName){
  try{
   s.seatLost=true;
   logEvent(s,' 你的俱乐部临时席位被收回——降入 K甲。固定席位球队不会降级，升班马需用成绩保住席位');
  }catch(e){}
 }
 try{
  if(s.kjia&&s.kjia.champ===kjiaMyName(s)){
   logEvent(s,' 二队 K甲夺冠——俱乐部斩获临时席位资格赛话语权（关注度+）');
   addFans(s,1,'K甲夺冠·席位资格');
  }
 }catch(e){}
}
function tempSeatsPanelHtml(){
 const s=S;
 if(!s||!s.tempSeats||!s.tempSeats.length)return '';
 const atRisk=isTempSeat(s,s.teamName);
 let html=`<div class="panel"><h3>临时席位 <span class="tag">固定 16 + 临时 ${TEMP_SEAT_COUNT} · 只升不降</span></h3>
 <div class="hint" style="margin-bottom:8px"><b>升班马（常山UUG、桐乡情久）挂临时席</b>，年度成绩垫底会被收回，由 K甲/资格赛队伍顶上。老牌豪门（AG/狼队/eStar 等）是固定席，永不降级。${atRisk?'<b class="red">你执教的是升班马临时席——年度垫底有收回风险；夺冠可保留下赛季席位（免打席位赛，非固定席）。</b>':'你执教的俱乐部是固定席。'}</div>
 <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">${s.tempSeats.map(t=>`<span class="tag" style="border-color:var(--gold)">${crest(null,t,14)} ${t} · 临时${t===s.teamName?'（你）':''}</span>`).join('')}</div>`;
 if((s.tempSeatFixed||[]).length){
  html+=`<div class="hint">夺冠保留下赛季席位（免打席位赛）：${s.tempSeatFixed.map(t=>_escTxt(t)).join('、')}</div>`;
 }
 if((s.tempSeatLog||[]).length){
  html+=`<div class="hint">近年变动：${s.tempSeatLog.slice(0,4).map(l=>_escTxt(l)).join('<br>')}</div>`;
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
 if(!s||!s.preseason)return '';
 return '已进入挂牌期（后 '+TRANSFER_FREE_DAYS+' 天）——只能挂牌/竞价/续约/租借，不能买断直签';
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
  if(typeof rosterFull==='function'&&rosterFull(s))
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
