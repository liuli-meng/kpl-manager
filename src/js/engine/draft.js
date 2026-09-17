/* ================= KPL 选秀大会（对齐官方口径 + 竞拍签位） =================
 流程（贴近真实）：
  ① 竞拍签位：前 8 签 60 万起拍、后 8 签 50 万起拍；弱队先叫价；价高者得该签并立即点名
  ② 点名：第一轮不能选自家青训；自家苗子走训练页「自留签」（每季 2 个名额）
  ③ 池子：官方新秀训练营 + K甲/次级突出者——K甲前三档强度挂钩你二队本届名次
 落选进自由市场。合同 DRAFT_CONTRACT 年 · 周薪 DRAFT_WAGE 万。 */
const DRAFT_SIZE=20;
const DRAFT_WAGE=3;
const DRAFT_CONTRACT=3;
const DRAFT_BID_TOP=60;   // 前 8 签起拍
const DRAFT_BID_REST=50;  // 后 8 签起拍
const DRAFT_BID_STEP=10;
const DRAFT_NAMES=['青禾','白榆','赤霄','玄同','临渊','望舒','既明','南声','未晞','朝雨','汀兰','疏影','照野','枕流','拾星','衔山','听澜','拓海','折桨','纵马'];
function draftOrder(s){
 const names=[...(s.leagueTeams&&s.leagueTeams.length?s.leagueTeams:AI_TEAMS.map(t=>t.name))];
 if(!names.includes(s.teamName))names.push(s.teamName);
 const pts=s.annualPts||{};
 const pw=n=>{
 if(n===s.teamName)return teamPower(s)||0;
 const t=AI_TEAMS.find(x=>x.name===n);
 return t?(t.seed||400):400;
 };
 return names.sort((a,b)=>{
 const pa=pts[a]||0,pb=pts[b]||0;
 if(pa!==pb)return pa-pb;
 return pw(a)-pw(b);
 });
}
/* 本届 K甲（二队）名次 → 选秀池里「K甲前三」档的数量与底子 */
function draftKjiaTier(s){
 try{
 const k=s.kjia;
 if(!k||!k.rounds)return {n:3,base:80};
 const rank=kjiaRank(s);
 const my=kjiaMyName(s);
 const i=rank.indexOf(my);
 if(k.champ===my)return {n:5,base:84}; // 二队夺冠：更多次级尖子
 if(i>=0&&i<3)return {n:4,base:82};
 if(i>=0&&i<6)return {n:3,base:80};
 return {n:2,base:78};
 }catch(e){return {n:3,base:80};}
}
function genDraftProspect(s,i,used,tierHint){
 const name=poolName(DRAFT_NAMES.concat(KJIA_FILLER_NAMES),used);used.add(name);
 const pos=POS_ORDER[i%POS_ORDER.length];
 const kj=draftKjiaTier(s);
 let tier='camp';
 if(tierHint)tier=tierHint;
 else if(i<kj.n)tier='kjia';
 else if(i%5===4)tier='hot';
 const base=tier==='kjia'?rnd(kj.base,kj.base+6):(tier==='hot'?rnd(78,85):rnd(70,79));
 const tags=['选秀'];
 if(tier==='kjia')tags.push('K甲前三');
 if(tier==='hot')tags.push('热门新秀');
 if(tier==='camp')tags.push('训练营');
 const p=genPlayer({
 id:'drf_'+gameYear(s)+'_'+i+'_'+Math.random().toString(36).slice(2,6),
 name,pos,team:null,tags,
 base:[base,base,base,base],
 skill:{
 n:tier==='kjia'?'次级联赛尖子':(tier==='hot'?'选秀热门':'训练营结业'),
 t:pick(['lane','farm','team','mind']),
 d:tier==='kjia'?'K甲/次级联赛尖子，强度随二队本届名次浮动':(tier==='hot'?'训练营冲榜赛头名，天赋出众':'官方新秀训练营结业，等待俱乐部点名')
 },
 sig:pick(HEROES.filter(h=>h.pos[0]===pos)).n,
 career:tier==='kjia'?'次级联赛（K甲）突出选手，进入选秀大会。':'官方 KPL 新秀训练营结业，参加选秀大会。'
 });
 p.age=18;p.wage=DRAFT_WAGE;p.contract=DRAFT_CONTRACT;
 p.val=tier==='kjia'?115:(tier==='hot'?110:95);
 if(i%3===0&&AI_TEAMS.length){
 const src=pick(AI_TEAMS).name;
 p.fromClub=src;
 tags.push('青训出身');p.tags=tags;
 }
 return p;
}
function draftBlockedFor(s,team,p){
 return !!(p&&p.fromClub&&p.fromClub===team);
}
function draftTeamRosterCount(s,team){
 if(team===s.teamName)return (s.players||[]).length;
 try{return (ensureAiRosters(s,team)||[]).length;}catch(e){return 6;}
}
function draftPosNeed(s,team,pos){
 if(team===s.teamName){
 const inLine=(s.lineup||[]).some(id=>{const p=s.players.find(x=>x.id===id);return p&&p.pos===pos;});
 const bench=(s.players||[]).filter(p=>p.pos===pos&&!s.lineup.includes(p.id)).length;
 return (inLine?0:3)+Math.max(0,2-bench);
 }
 try{
 const r=ensureAiRosters(s,team)||[];
 return Math.max(0,2-r.filter(p=>p.pos===pos).length);
 }catch(e){return 1;}
}
function draftScore(p,team,s){
 let sc=overall(p)+draftPosNeed(s,team,p.pos)*8;
 if((p.tags||[]).includes('热门新秀'))sc+=6;
 if((p.tags||[]).includes('K甲前三'))sc+=10;
 if(draftBlockedFor(s,team,p))sc=-999;
 return sc;
}
function draftStillWant(s,team){
 return draftTeamRosterCount(s,team)<ROSTER_MAX;
}
/* ---------- 竞拍 ---------- */
function draftSlotPrice(slot){return slot<8?DRAFT_BID_TOP:DRAFT_BID_REST;}
function draftMaxAiBid(s,team,slot){
 if(!draftStillWant(s,team))return 0;
 const fund=team===s.teamName?(s.fund||0):rnd(400,1600);
 const need=POS_ORDER.reduce((t,pos)=>t+draftPosNeed(s,team,pos),0);
 const base=draftSlotPrice(slot);
 // 临时席位队更愿意砸钱抢签（保级/站稳脚跟）
 const tempBoost=(typeof isTempSeat==='function'&&isTempSeat(s,team))?1.25:1;
 return Math.min(Math.round(fund*0.25*tempBoost), Math.round((base+need*12)*tempBoost));
}
function initDraft(s,force){
 if(!s||!s.preseason)return null;
 if(s.mode&&s.mode!=='manager')return null;
 if(!force&&s.draft&&s.draft.season===s.season&&s.draft.split===s.split)return s.draft;
 const used=new Set((s.players||[]).map(p=>p.name));
 (s.academy||[]).forEach(p=>p&&p.name&&used.add(p.name));
 const kj=draftKjiaTier(s);
 const pool=[];
 for(let i=0;i<DRAFT_SIZE;i++)pool.push(genDraftProspect(s,i,used));
 const order=draftOrder(s);
 s.draft={
 season:s.season,split:s.split,pool,order,log:[],done:false,
 phase:'auction',slot:0,bid:draftSlotPrice(0),leader:null,passed:{},
 picks:[], // {slot,team,playerId}
 kjiaTier:kj
 };
 draftAiAuction(s);
 return s.draft;
}
function draftAiAuction(s){ // AI 叫价直到轮到玩家或签位落定
 const d=s.draft;
 if(!d||d.done||d.phase!=='auction')return;
 let guard=0;
 while(d.phase==='auction'&&guard++<80){
 if(!d.pool.length){d.phase='done';d.done=true;break;}
 // 候选：还没 pass、仍想要人的队；弱队优先叫价
 const candidates=d.order.filter(t=>!d.passed[t]&&draftStillWant(s,t));
 if(!candidates.length){
 // 全放弃：签位免费给倒序里第一个还没选过的队
 const free=d.order.find(t=>!d.picks.some(p=>p.team===t));
 if(free){
 draftWinSlot(s,free,0);
 }else{d.done=true;d.phase='done';}
 break;
 }
 // 当前应叫价的队：按倒序找下一个未 pass
 let next=null;
 for(const t of d.order){
 if(!d.passed[t]&&draftStillWant(s,t)){next=t;break;}
 }
 if(!next){d.done=true;d.phase='done';break;}
 if(next===s.teamName)break; // 等玩家
 const max=draftMaxAiBid(s,next,d.slot);
 if(max>=d.bid+DRAFT_BID_STEP&&(d.leader!==next)){
 d.bid=d.leader?d.bid+DRAFT_BID_STEP:d.bid;
 d.leader=next;
 d.log.push(next+' 叫价 '+d.bid+'万（第'+(d.slot+1)+'签）');
 }else{
 d.passed[next]=true;
 }
 // 若仅剩 leader 未 pass 且已有叫价 → 成交
 const alive=d.order.filter(t=>!d.passed[t]&&draftStillWant(s,t));
 if(d.leader&&alive.length===1&&alive[0]===d.leader){
 draftWinSlot(s,d.leader,d.bid);
 break;
 }
 if(alive.length===0&&d.leader){
 draftWinSlot(s,d.leader,d.bid);
 break;
 }
 }
}
function draftWinSlot(s,team,cost){
 const d=s.draft;
 if(!d)return;
 if(cost>0){
 if(team===s.teamName)s.fund=Math.max(0,(s.fund||0)-cost);
 d.log.push(team+' 以 '+cost+'万拍得第'+(d.slot+1)+'签');
 }else{
 d.log.push(team+' 顺位获得第'+(d.slot+1)+'签（无人竞拍）');
 }
 if(team===s.teamName){
 if(!draftStillWant(s,team)){
 d.picks.push({slot:d.slot,team,playerId:null});
 d.slot++;
 draftNextSlot(s);
 return;
 }
 d.phase='pick';
 return;
 }
 const p=draftAiPick(s,team);
 d.picks.push({slot:d.slot,team,playerId:p?p.id:null});
 d.slot++;
 draftNextSlot(s);
}
function draftNextSlot(s){
 const d=s.draft;
 if(!d)return;
 if(d.slot>=d.order.length||!d.pool.length){
 d.done=true;d.phase='done';
 if(!d.pool.length)d.log.push('新秀池已选空');
 logEvent(s,' 选秀大会收官：'+d.picks.filter(x=>x.playerId).length+' 人签约'+(d.pool.length?'（'+d.pool.length+' 人落选进自由市场）':''));
 (d.pool||[]).forEach(p=>{
 p.wage=Math.max(2,DRAFT_WAGE-1);
 try{(s.freeAgents=s.freeAgents||[]).push(p);}catch(e){}
 });
 d.pool=[];
 save();renderAll();
 return;
 }
 d.phase='auction';
 d.bid=draftSlotPrice(d.slot);
 d.leader=null;
 d.passed={};
 draftAiAuction(s);
}
function draftBidRaise(s){
 if(s===undefined)s=S;
 const d=s.draft;
 if(!d||d.done||d.phase!=='auction')return;
 const nxt=d.leader?s.bid+DRAFT_BID_STEP:d.bid;
 if(s.fund<nxt){toast('资金不足（需 '+nxt+'万）');return;}
 d.bid=nxt;
 d.leader=s.teamName;
 delete d.passed[s.teamName];
 d.log.push(s.teamName+' 叫价 '+nxt+'万（第'+(d.slot+1)+'签）');
 // 其余 AI 再应一轮
 draftAiAuction(s);
 save();renderAll();
}
function draftBidPass(s){
 if(s===undefined)s=S;
 const d=s.draft;
 if(!d||d.done||d.phase!=='auction')return;
 d.passed[s.teamName]=true;
 d.log.push(s.teamName+' 放弃第'+(d.slot+1)+'签竞拍');
 draftAiAuction(s);
 save();renderAll();
}
/* ---------- 点名 ---------- */
function draftAiPick(s,team){
 const d=s.draft;
 if(!d||!d.pool.length)return null;
 if(!draftStillWant(s,team)){d.log.push(team+' 大名单已满');return null;}
 let best=null,bs=-1e9;
 d.pool.forEach(p=>{
 const sc=draftScore(p,team,s);
 if(sc>bs){bs=sc;best=p;}
 });
 if(!best||bs<-900){d.log.push(team+' 无合适新秀，放弃点名');return null;}
 d.pool=d.pool.filter(x=>x.id!==best.id);
 best.team=team;
 if(team===s.teamName){
 s.players.push(best);
 if(!s.lineup.includes(best.id)&&!s.players.some(x=>x.id!==best.id&&x.pos===best.pos&&s.lineup.includes(x.id)))s.lineup.push(best.id);
 }else{
 try{const r=ensureAiRosters(s,team)||[];if(r.length<8)r.push(best);}catch(e){}
 }
 d.log.push(team+' 选中 '+best.name+'（'+POS[best.pos][0]+' · 总值'+overall(best)+'）');
 logEvent(s,' 选秀大会：'+team+' 点名 '+best.name+'（'+best.age+'岁 · '+POS[best.pos][0]+(((best.tags||[]).includes('K甲前三'))?' · K甲前三':'')+'）');
 return best;
}
function draftPick(s,id){
 if(id===undefined){id=s;s=S;}
 s=s||S;
 const d=s.draft;
 if(!d||d.done||d.phase!=='pick'){toast('当前不在点名阶段');return;}
 if(!rosterGuard(s)){draftNextSlot(s);return;}
 const p=d.pool.find(x=>x.id===id);
 if(!p){toast('该新秀已不在池中');return;}
 if(draftBlockedFor(s,s.teamName,p)){
 toast(p.name+' 是本队青训出身——第一轮不能选自家，请用训练页「自留签」');
 return;
 }
 d.pool=d.pool.filter(x=>x.id!==id);
 p.team=s.teamName;
 s.players.push(p);
 if(!s.lineup.includes(p.id)&&!s.players.some(x=>x.id!==p.id&&x.pos===p.pos&&s.lineup.includes(x.id)))s.lineup.push(p.id);
 d.picks.push({slot:d.slot,team:s.teamName,playerId:p.id});
 d.log.push(s.teamName+' 选中 '+p.name+'（'+POS[p.pos][0]+' · 总值'+overall(p)+'）');
 logEvent(s,' 选秀大会：你选中 '+p.name+'（'+p.age+'岁 · '+POS[p.pos][0]+' · 总值'+overall(p)+'）');
 toast(' 选秀签下 '+p.name+'！');
 d.slot++;
 draftNextSlot(s);
}
function draftSkip(s){
 if(s===undefined)s=S;
 const d=s.draft;
 if(!d||d.done||d.phase!=='pick')return;
 d.picks.push({slot:d.slot,team:s.teamName,playerId:null});
 d.log.push(s.teamName+' 放弃点名');
 d.slot++;
 draftNextSlot(s);
}
/* ---------- 自留签 ---------- */
function reserveLeft(s){
 const max=(s&&s.reserveSlots!=null)?s.reserveSlots:2;
 const used=(s&&s.reserveUsed)||0;
 return Math.max(0,max-used);
}
function useReserveSlot(s){
 if(reserveLeft(s)<=0)return false;
 s.reserveUsed=(s.reserveUsed||0)+1;
 return true;
}
/* ---------- 面板 ---------- */
function draftPanelHtml(){
 const s=S;
 if(!s.preseason||(s.transferWindow||0)<=0)return '';
 if(s.mode&&s.mode!=='manager')return '';
 const d=s.draft||initDraft(s);
 if(!d)return '';
 const kj=d.kjiaTier||draftKjiaTier(s);
 const taken=d.picks.filter(x=>x.playerId).length;
 const meAuction=d.phase==='auction'&&!d.done&&!d.passed[s.teamName]&&draftStillWant(s,s.teamName);
 const mePick=d.phase==='pick'&&!d.done;
 const alive=d.order.filter(t=>!d.passed[t]&&draftStillWant(s,t));
 let html=`<div class="panel ${foldCls('mdraft')}" data-fold="mdraft"><h3>KPL 选秀大会 <span class="tag">${d.done?'已收官':(d.phase==='auction'?'竞拍签位':'点名')} · 已签 ${taken} · 第${Math.min(d.slot+1,d.order.length)}签 · 自留签剩 ${reserveLeft(s)}</span></h3>
 <div class="hint" style="margin-bottom:8px">流程：先<strong>竞拍签位</strong>（前8签 ${DRAFT_BID_TOP}万起 / 后8签 ${DRAFT_BID_REST}万起，加价 ${DRAFT_BID_STEP} 万），拍到再<strong>点名</strong>。池子=训练营+K甲突出者（本届二队名次影响 K甲前三档：${kj.n}人 · 底子${kj.base}+）。<strong>不能选自家青训</strong>；自家苗子用训练页自留签（每季2个）。</div>`;
 if(!d.done&&d.phase==='auction'){
 html+=`<div class="match" style="border-color:var(--gold);margin-bottom:8px">
 <div class="vs"><div class="tname">第${d.slot+1}签</div><div class="power">起拍 ${draftSlotPrice(d.slot)}万</div></div>
 <div class="score" style="font-size:14px">当前 <b class="gold">${d.bid}</b>万${d.leader?' · '+d.leader:''}</div>
 <div class="vs" style="justify-content:flex-end"><div class="power">未放弃 ${alive.length} 队</div></div>
 </div>`;
 if(meAuction){
 html+=`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
 <button class="btn gold" onclick="draftBidRaise()"> 叫价 ${d.leader?s.bid+DRAFT_BID_STEP:s.bid}万</button>
 <button class="btn sm" onclick="draftBidPass()">放弃本签竞拍</button>
 </div>`;
 }else if(d.phase==='auction'){
 html+=`<div class="hint" style="margin-bottom:8px">等待其他队叫价…（你已放弃或未轮到）</div>`;
 }
 }
 if(d.phase==='pick'&&!d.done&&mePick){
 html+=`<div class="hint" style="margin-bottom:8px"><b class="gold">轮到你点名</b>（第${d.slot+1}签）</div>`;
 }
 if(d.pool.length&&(d.phase==='pick'||mePick||d.done===false)){
 const interactive=mePick;
 html+=`<div class="grid g4">${d.pool.map(p=>{
 const blocked=interactive&&draftBlockedFor(s,s.teamName,p);
 return pcard(p,interactive
 ?(blocked?`<div class="hint mt8">本队青训 · 不可选</div>`
 :`<button class="btn sm primary mt8" style="width:100%" onclick="draftPick('${p.id}')"> 点名签约</button>`)
 :'');
 }).join('')}</div>`;
 if(interactive)html+=`<button class="btn sm mt8" onclick="draftSkip()">放弃点名</button>`;
 }
 if((d.log||[]).length){
 html+=`<div class="hint" style="margin-top:10px">大会记录：${d.log.slice(-10).map(l=>_escTxt(l)).join('<br>')}</div>`;
 }
 html+=`</div>`;
 return html;
}
