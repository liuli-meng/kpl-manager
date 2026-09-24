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
function genDraftProspect(s,i,used,namePool){
 const name=poolName(namePool||DRAFT_NAMES.concat(KJIA_FILLER_NAMES),used);used.add(name);
 const pos=POS_ORDER[i%POS_ORDER.length];
 const kj=draftKjiaTier(s);
 let tier='camp';
 if(i<kj.n)tier='kjia';
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
 if(team===s.teamName)return (s.players||[]).filter(p=>!(p.kjia>0)).length; // 与 rosterFull 同口径
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
/* AI 预算：按「本场选秀」一次性摇定（原实现每次评估都 rnd(400,1600)，
   同一签位内同队的心理上限会随机跳变——先敢出 150、下一手又嫌 160 贵，逻辑不自洽）。 */
function draftAiFund(s,team){
 const d=s.draft;
 if(!d)return rnd(400,1600);
 d.aiFund=d.aiFund||{};
 if(d.aiFund[team]==null)d.aiFund[team]=rnd(400,1600);
 return d.aiFund[team];
}
/* 玩家/AI 同一口径的签位出价上限。
   原先只有 AI 走这套公式，玩家可用 s.fund 砸穿 25%/意愿 cap——统一后两边同一规则。 */
function draftTeamMaxBid(s,team,slot){
 if(!draftStillWant(s,team))return 0;
 const fund=team===s.teamName?(s.fund||0):draftAiFund(s,team);
 const need=POS_ORDER.reduce((t,pos)=>t+draftPosNeed(s,team,pos),0);
 const base=draftSlotPrice(slot);
 // 临时席位队更愿意砸钱抢签（保级/站稳脚跟）
 const tempBoost=(typeof isTempSeat==='function'&&isTempSeat(s,team))?1.25:1;
 return Math.min(Math.round(fund*0.25*tempBoost), Math.round((base+need*12)*tempBoost), Math.floor(fund));
}
function draftMaxAiBid(s,team,slot){return draftTeamMaxBid(s,team,slot);}
/* 旧档/异常档修复：竞拍价与领先者一旦被写成 NaN/null，整场竞拍再也不可能收敛
   （早期 `draftBidRaise` 误用 s.bid，NaN 会跟着存档落盘，JSON 里变 null 再读出）。
   读档时统一归一化，别指望坏值自己好。 */
function draftRepair(s,d){
 if(!d||typeof d!=='object')return null;
 d.pool=Array.isArray(d.pool)?d.pool:[];
 d.log=Array.isArray(d.log)?d.log:[];
 d.picks=Array.isArray(d.picks)?d.picks:[];
 d.passed=(d.passed&&typeof d.passed==='object')?d.passed:{};
 d.aiFund=(d.aiFund&&typeof d.aiFund==='object')?d.aiFund:{};
 d.order=(Array.isArray(d.order)&&d.order.length)?d.order:draftOrder(s);
 const slot=Number(d.slot);
 d.slot=(Number.isFinite(slot)&&slot>=0)?Math.floor(slot):0;
 const bid=Number(d.bid);
 d.bid=(Number.isFinite(bid)&&bid>0)?bid:draftSlotPrice(d.slot);
 if(typeof d.leader!=='string')d.leader=null;
 if(d.phase!=='auction'&&d.phase!=='pick'&&d.phase!=='done')d.phase=d.picks.length?'done':'auction';
 // 点名阶段但池子空了 = 死局（面板既没卡片也没放弃按钮，玩家卡在这一步）：直接收官
 if(d.phase==='pick'&&!d.pool.length)d.phase='done';
 /* 旧档可能 done 与 phase 不一致（老版本 draftPick 不落盘，存档停在半场）：
    「已收官但 phase 还停在点名/竞拍」会让面板显示成进行中、却一个按钮都不给 → 玩家以为选不了人。 */
 if(d.done&&d.phase!=='done')d.phase='done';
 d.done=!!d.done||d.phase==='done';
 return d;
}
function initDraft(s,force){
 if(!s||!s.preseason)return null;
 if(s.mode&&s.mode!=='manager')return null;
 if(!force&&s.draft&&s.draft.season===s.season&&s.draft.split===s.split)return draftRepair(s,s.draft);
 /* 名字必须走全局查重（rookieUsedNames）：原来只塞了 players+academy，
    会跟市场/自由市场/各队名册/联盟新星 def 撞名——撞名会让 ensureAiRosters 把同名的
    AI def 误判成「已被玩家签走」而剔除，球队出现幽灵空位。
    名字池也不能只给选秀专用的 44 个：全局查重下手池会很快耗尽，第 3 季起全池退化成
    combName 三字拼接（「阿川澜」这种一眼机器名）。并上其它人名词池后可用名翻几倍。 */
 const used=rookieUsedNames(s);
 const kj=draftKjiaTier(s);
 const namePool=shuffle([].concat(DRAFT_NAMES,KJIA_FILLER_NAMES,
  typeof ERA_GEN_NAMES!=='undefined'?ERA_GEN_NAMES:[],
  typeof ACADEMY_NAMES!=='undefined'?ACADEMY_NAMES:[],
  typeof ROOKIE_NAMES!=='undefined'?ROOKIE_NAMES:[]));
 const pool=[];
 for(let i=0;i<DRAFT_SIZE;i++)pool.push(genDraftProspect(s,i,used,namePool));
 const order=draftOrder(s);
 s.draft={
 season:s.season,split:s.split,pool,order,log:[],done:false,
 phase:'auction',slot:0,bid:draftSlotPrice(0),leader:null,passed:{},
 picks:[], // {slot,team,playerId}
 aiFund:{}, // 各队本场预算（摇一次，别每次评估都重掷）
 kjiaTier:kj
 };
 draftRepair(s,s.draft);
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
   // 全放弃：签位归当前最高价者。不能直接「顺位免费」给下一个队——那会作废领先者已出的价
   if(d.leader)draftWinSlot(s,d.leader,d.bid);
   else{
    const free=d.order.find(t=>!d.picks.some(p=>p.team===t));
    if(free)draftWinSlot(s,free,0);
    else{d.done=true;d.phase='done';}
   }
   break;
  }
  /* 只剩领先者还在场 → 成交。这条必须排在「轮到玩家就 break」之前：
     玩家叫价后领先的正是玩家本人，先 break 会让签位永不落定（玩家只能自己跟自己加价、或被迫放弃白送签位）。 */
  if(d.leader&&candidates.length===1&&candidates[0]===d.leader){draftWinSlot(s,d.leader,d.bid);break;}
  // 下一个要表态的队：领先者本人不用再表态（它已持最高价），跳过它看后面谁跟
  let next=null;
  for(const t of candidates){if(t===d.leader)continue;next=t;break;}
  if(!next)break;
  if(next===s.teamName)break; // 等玩家
  const max=draftTeamMaxBid(s,next,d.slot);
  // 首拍只需 >=起拍价；有领先者才 +STEP。旧版连首拍也要求 +10，大量 AI 第一轮弃拍
  const needBid=d.leader?d.bid+DRAFT_BID_STEP:d.bid;
  if(max>=needBid){
   d.bid=d.leader?d.bid+DRAFT_BID_STEP:d.bid;
   d.leader=next;
   d.log.push(next+' 叫价 '+d.bid+'万（第'+(d.slot+1)+'签）');
  }else{
   d.passed[next]=true;
  }
 }
}
function draftWinSlot(s,team,cost){
 const d=s.draft;
 if(!d)return;
 // 玩家大名单已满：这一签拍下来也用不上，别扣钱（原来先扣款再判满员，白花几十万）
 const playerFull=(team===s.teamName)&&!draftStillWant(s,team);
 if(cost>0&&!playerFull){
 if(team===s.teamName)s.fund=Math.max(0,(s.fund||0)-cost);
 else if(d.aiFund&&d.aiFund[team]!=null)d.aiFund[team]=Math.max(0,d.aiFund[team]-cost);
 else if(d.aiFund)d.aiFund[team]=Math.max(0,(draftAiFund(s,team)-cost));
 d.log.push(team+' 以 '+cost+'万拍得第'+(d.slot+1)+'签');
 }else if(cost>0){
 d.log.push(team+' 拍得第'+(d.slot+1)+'签，但大名单已满（不扣款）');
 }else{
 d.log.push(team+' 顺位获得第'+(d.slot+1)+'签（无人竞拍）');
 }
 if(team===s.teamName){
 if(playerFull){
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
 draftFinish(s);
 save();renderAll();
 return;
 }
 d.phase='auction';
 d.bid=draftSlotPrice(d.slot);
 d.leader=null;
 d.passed={};
 draftAiAuction(s);
}
/* 收官：记日志 + 落选者带齐字段进自由市场 + 清空池子。
   抽出来是因为「转会期结束时强制收官」也必须把池子处理掉，否则剩下的新秀直接蒸发。 */
function draftFinish(s){
 const d=s&&s.draft;
 if(!d)return;
 d.done=true;d.phase='done';
 if(!d.pool.length)d.log.push('新秀池已选空');
 logEvent(s,' 选秀大会收官：'+d.picks.filter(x=>x.playerId).length+' 人签约'+(d.pool.length?'（'+d.pool.length+' 人落选进自由市场）':''));
 (d.pool||[]).forEach(p=>{
 draftFaInit(p);
 try{(s.freeAgents=s.freeAgents||[]).push(p);}catch(e){}
 });
 d.pool=[];
}
function draftBidRaise(s){
 if(s===undefined)s=S;
 const d=s.draft;
 if(!d||d.done||d.phase!=='auction')return;
 // 当前价必须是 d.bid（选秀自己的竞拍价）；以前误写成 s.bid（转会报价字段，选秀里恒为 undefined）
 // → NaN 万叫价，连锁把领先者/成交价全污染。这里再兜一层，坏档也拉得回来。
 if(!Number.isFinite(d.bid))d.bid=draftSlotPrice(d.slot);
 if(!draftStillWant(s,s.teamName)){toast('大名单已满（'+ROSTER_MAX+' 人），无法再拍签位');return;}
 const max=draftTeamMaxBid(s,s.teamName,d.slot);
 const nxt=d.leader?d.bid+DRAFT_BID_STEP:d.bid;
 // 玩家与 AI 同一口径：超 cap 直接拒，不能拿整个 s.fund 砸穿预算/意愿上限
 if(nxt>max){
 if(nxt>(s.fund||0))toast('资金不足（需 '+nxt+'万，现有 '+Math.floor(s.fund||0)+'万）');
 else toast('按本队签位预算/意愿封顶，上限 '+max+' 万（需 '+nxt+'万）');
 return;
 }
 if(s.fund<nxt){toast('资金不足（需 '+nxt+'万）');return;}
 d.bid=nxt;
 d.leader=s.teamName;
 delete d.passed[s.teamName];
 d.log.push(s.teamName+' 叫价 '+nxt+'万（第'+(d.slot+1)+'签）');
 // 其余 AI 再应一轮（成交在 draftWinSlot 才扣款，叫价本身不动 fund）
 draftAiAuction(s);
 save();renderAll();
}
function draftBidPass(s){
 if(s===undefined)s=S;
 const d=s.draft;
 if(!d||d.done||d.phase!=='auction')return;
 if(d.passed[s.teamName])return; // 已放弃，重复点不重复记账
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
 // 与玩家手动点名同一闸门：名单满则这一签作废，禁止无限膨胀
 if(typeof canSign==='function'){
  const chk=canSign(s,best,{actor:'player',checkWindow:false,checkMode:false});
  if(!chk.ok){
   d.log.push(s.teamName+' 点名失败（'+(chk.reason||'名单受限')+'）');
   return null;
  }
 }else if(typeof rosterFull==='function'&&rosterFull(s)){
  d.log.push(s.teamName+' 大名单已满，点名作废');
  return null;
 }
 s.players.push(best);
 if(!s.lineup.includes(best.id)&&!s.players.some(x=>x.id!==best.id&&x.pos===best.pos&&s.lineup.includes(x.id)))s.lineup.push(best.id);
 }else{
 draftRegisterAiPick(s,team,best);
 }
 d.log.push(team+' 选中 '+best.name+'（'+POS[best.pos][0]+' · 总值'+overall(best)+'）');
 logEvent(s,' 选秀大会：'+team+' 点名 '+best.name+'（'+best.age+'岁 · '+POS[best.pos][0]+(((best.tags||[]).includes('K甲前三'))?' · K甲前三':'')+'）');
 return best;
}
/* AI 点名的新秀必须以 def 形式入册（extraDefs + aiRosterDefs），不能只 push 进 aiRosters 缓存：
   ① aiRosters 是读档即弃的派生缓存（serializeForSave 剥离）→ 存档往返后新秀人间蒸发；
   ② 每赛季轮换会整体重建 aiRosters（season.js）→ 新秀同样消失，这些签位等于白拍；
   ③ 直接 push 缓存数组不会刷新 aiPower，新秀连战力都不算。
   age0/ageFrom 交给 genSeasonPlayer：新秀年龄以「入盟赛季」为基准，不按全局赛季序号加龄。 */
function draftRegisterAiPick(s,team,p){
 try{
  const map=aiRosterDefMap(s);
  map[team]=map[team]||[];
  /* 名册硬上限 9 人（AI 队，玩家是 ROSTER_MAX=10）：注意真实名册 ≠ def 数量——
     ensureAiRosters 会给「无人可用的位置」补青训递补（ac_），伤停时还会再补一个，
     所以只看 def 数量控不住名册人数。这里按「注册后真实名册会有多大」先判一次。 */
  const cur=ensureAiRosters(s,team)||[];
  const wouldGrow=cur.some(x=>x.pos===p.pos)?0:1; // 该位置已有人 → 注册后人数不变
  if(cur.length+wouldGrow>9){
   (s.freeAgents=s.freeAgents||[]).push(draftFaInit(p));
   d_logDraftOut(s,team,p);
   return;
  }
  /* 阵容容量：新秀进册若把该队 def 顶到上限之上，只有「比同位置最弱者更强」才顶替它上场，
     否则新秀打不上球——直接进自由市场（不出幽灵注册，也不让 20 年档攒出几百个挂名 def）。 */
  const CAP=6; // def 注册上限（首发 5 + 1 个轮换/新秀位）；真实名册另由上面的 9 人硬上限兜住
  if(map[team].length>=CAP){
   const own=map[team].map(id=>defOf(s,id)).filter(d=>d&&d.pos===p.pos);
   const worst=own.map(d=>({d,o:overall(genSeasonPlayer(s,d))})).sort((a,b)=>a.o-b.o)[0];
   if(!worst||overall(p)<=worst.o){
    (s.freeAgents=s.freeAgents||[]).push(draftFaInit(p));
    d_logDraftOut(s,team,p);
    return;
   }
   map[team]=map[team].filter(id=>id!==worst.d.id);
   aiDetachDef(s,worst.d.id); // 全局除名（含青训营与各队缓存），避免同一人挂两队
   logEvent(s,' 选秀连锁：'+team+' 用新秀 '+p.name+' 顶替 '+worst.d.name+'（'+POS[worst.d.pos][0]+'）');
  }
  const attrs=p.attrs||{};
  const def={id:p.id,name:p.name,pos:p.pos,team:null,tags:p.tags||['选秀'],
   base:[attrs.lane||70,attrs.farm||70,attrs.team||70,attrs.mind||70],
   skill:p.skill,sig:p.sig,career:p.career||'',age0:18,ageFrom:s.season||1};
  (s.extraDefs=s.extraDefs||[]).push(def);
  map[team].push(def.id);
  s.aiRosters=s.aiRosters||{};
  delete s.aiRosters[team]; // 缓存失效 → 按新 def 重建，aiPower 同步刷新
  ensureAiRosters(s,team);
 }catch(e){}
}
function d_logDraftOut(s,team,p){
 const d=s.draft;
 if(d)d.log.push(team+' 阵容已满，'+p.name+' 未被注册（转自由市场）');
 logEvent(s,' 选秀大会：'+team+' 选中 '+p.name+' 但阵容无位，转入自由市场');
}
/* 落选/未注册新秀进自由市场时的字段初始化，口径对齐 buildTransferMarket 的「无球可打替补」：
   缺 freeAgent 标志 → openNegotiation 按「转会」处理，凭空要一笔转会费；
   缺 signCost → 自由球员面板直接显示「undefined万」。 */
function draftFaInit(p){
 p.team=null;
 p.wage=Math.max(2,DRAFT_WAGE-1);
 p.freeAgent=true;
 p.signCost=Math.round(valueOf(overall(p))*0.58);
 p.willingness=rnd(70,100);
 return p;
}
function draftPick(s,id){
 if(id===undefined){id=s;s=S;}
 s=s||S;
 const d=s.draft;
 if(!d||d.done||d.phase!=='pick'){toast('当前不在点名阶段');return;}
 if(!rosterGuard(s)){ // 大名单已满：这一签作废（不能再走 draftNextSlot 原地重拍，否则签位卡在同一步）
  d.picks.push({slot:d.slot,team:s.teamName,playerId:null});
  d.log.push(s.teamName+' 大名单已满，第'+(d.slot+1)+'签作废');
  d.slot++;
  draftNextSlot(s);
  if(!d.done){save();renderAll();}
  return;
 }
 const p=d.pool.find(x=>x.id===id);
 if(!p){toast('该新秀已不在池中');return;}
 if(typeof canSign==='function'){
  const chk=canSign(s,p,{actor:'player',checkWindow:false,checkMode:false});
  if(!chk.ok){toast(chk.reason||('不能点名 '+p.name));return;}
 }
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
 if(!d.done){save();renderAll();} // 以前这里既不复盘也不刷新：点完「点名签约」画面纹丝不动、还没落盘
}
function draftSkip(s){
 if(s===undefined)s=S;
 const d=s.draft;
 if(!d||d.done||d.phase!=='pick')return;
 d.picks.push({slot:d.slot,team:s.teamName,playerId:null});
 d.log.push(s.teamName+' 放弃点名');
 d.slot++;
 draftNextSlot(s);
 if(!d.done){save();renderAll();}
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
/* 季前赛结束（手动「结束转会期」/ 天数用尽自动开赛）时把没打完的选秀强制收官。
   不这么做的话：选秀面板只在 preseason 显示，转会期一结束剩下的签位再也点不到，
   池子里的新秀既没被任何队选中、也没进自由市场 —— 整场选秀（20 人）人间蒸发。
   玩家只要没在 7 天窗口里点完 18 签就会白丢，属于静默数据丢失。
   规则：玩家未表态的签位一律视为放弃，其余按 AI 正常竞拍/点名走完。 */
function draftForceFinish(s){
 const d=s&&s.draft;
 if(!d||d.done)return;
 draftRepair(s,d);
 if(d.done)return;
 const before=d.picks.filter(x=>x.playerId).length;
 let g=0;
 while(!d.done&&g++<60){
  /* 每轮都要重新表态：draftNextSlot 会把 d.passed 清空（新签位重新开始竞拍），
     不重设的话玩家又变成「未放弃」，draftAiAuction 会停在等玩家那一步，
     整个池子就会被下面的兜底当成落选者一次性倒进自由市场（实测只剩 1 人被 AI 选中）。 */
  d.passed[s.teamName]=true;
  if(d.phase==='pick'){                  // 卡在「轮到你点名」也要放掉
   d.picks.push({slot:d.slot,team:s.teamName,playerId:null});
   d.log.push(s.teamName+' 放弃点名（转会期结束）');
   d.slot++;
   draftNextSlot(s);
  }else if(d.phase==='auction'){
   draftAiAuction(s);
  }else break;
 }
 if(!d.done)draftFinish(s);               // 兜底：留下半场选秀等于半个池子蒸发
 logEvent(s,' 转会期结束：选秀大会自动收官（共 '+d.picks.filter(x=>x.playerId).length+' 人签约 · 你未点完的签位视为放弃，此前已签 '+before+' 人）');
}
/* ---------- 面板 ---------- */
function draftPanelHtml(){
 const s=S;
 if(!s.preseason||(s.transferWindow||0)<=0)return '';
 if(s.mode&&s.mode!=='manager')return '';
 // 渲染期只修不建：initDraft(s) 在 season/split 不匹配时会重建整场选秀，
 // 在 render 里重建会吞掉进行中的竞拍；坏值交给 draftRepair 归一化即可。
 const d=draftRepair(s,s.draft)||initDraft(s);
 if(!d)return '';
 const kj=d.kjiaTier||draftKjiaTier(s);
 const taken=d.picks.filter(x=>x.playerId).length;
 const rosterCount=s=>(s.players||[]).filter(p=>!(p.kjia>0)).length;
  const rosterNow=rosterCount(s); // 与 rosterFull 同口径：K甲下放不占一线名额（显示 s.players.length 会把下放算成第 10 人）
 const myFull=!draftStillWant(s,s.teamName);   // 大名单满 → 既不能拍签也不能点名，界面必须说清楚
 const meAuction=d.phase==='auction'&&!d.done&&!d.passed[s.teamName]&&!myFull;
 const mePick=d.phase==='pick'&&!d.done;
 const alive=d.order.filter(t=>!d.passed[t]&&draftStillWant(s,t));
 let html=`<div class="panel ${foldCls('mdraft')}" data-fold="mdraft"><h3>KPL 选秀大会 <span class="tag">${d.done?'已收官':(d.phase==='auction'?'竞拍签位':'点名')} · 已签 ${taken} · 第${Math.min(d.slot+1,d.order.length)}签 · 大名单 ${rosterNow}/${ROSTER_MAX} · 自留签剩 ${reserveLeft(s)}</span></h3>
 <div class="hint" style="margin-bottom:8px">流程：先<strong>竞拍签位</strong>（前8签 ${DRAFT_BID_TOP}万起 / 第9签起 ${DRAFT_BID_REST}万起，加价 ${DRAFT_BID_STEP} 万；叫价受<strong>本队签位预算上限</strong>约束，玩家与 AI 同一口径），拍到再<strong>点名</strong>。池子=训练营+K甲突出者（本届二队名次影响 K甲前三档：${kj.n}人 · 底子${kj.base}+）。<strong>不能选自家青训</strong>；自家苗子用训练页自留签（每季2个）；大名单上限 ${ROSTER_MAX} 人。</div>`;
 if(!d.done&&d.phase==='auction'){
 html+=`<div class="match" style="border-color:var(--gold);margin-bottom:8px">
 <div class="vs"><div class="tname">第${d.slot+1}签</div><div class="power">起拍 ${draftSlotPrice(d.slot)}万</div></div>
 <div class="score" style="font-size:14px">当前 <b class="gold">${d.bid}</b>万${d.leader?' · '+d.leader:''}</div>
 <div class="vs" style="justify-content:flex-end"><div class="power">共 ${d.order.length} 签 · 未放弃 ${alive.length} 队</div></div>
 </div>`;
 if(meAuction){
 html+=`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
 <button class="btn gold" onclick="draftBidRaise()"> 叫价 ${d.leader?d.bid+DRAFT_BID_STEP:d.bid}万</button>
 <button class="btn sm" onclick="draftBidPass()">放弃本签竞拍</button>
 </div>`;
 }else if(d.phase==='auction'){
 html+= myFull
 /* 满员是最容易被当成「点了没反应」的状态：原本文案只说「你已放弃或未轮到」，
    玩家看不出真正原因，也没有任何可做的动作。这里直说要先腾位置。 */
 ?`<div class="hint" style="margin-bottom:8px;color:var(--red)">大名单已满（${rosterNow}/${ROSTER_MAX}）：无法再拍签。先去转会页卖掉或放走选手腾出位置，否则本届剩余签位全部由 AI 分配。</div>`
 :`<div class="hint" style="margin-bottom:8px">等待其他队叫价…（你已放弃或未轮到）</div>`;
 }
 }
 if(d.phase==='pick'&&!d.done&&mePick){
 html+=`<div class="hint" style="margin-bottom:8px"><b class="gold">轮到你点名</b>（第${d.slot+1}签）${d.pool.length?'':'——池子已空，只能放弃本签'}${myFull?`　<b class="red">但大名单已满（${rosterNow}/${ROSTER_MAX}），只能放弃本签</b>`:''}</div>`;
 }
 /* 大名单满员时整场选秀会被 AI 一口气跑完（玩家不是候选，竞拍不会停下来等），
    面板直接显示「已收官」——玩家看不到任何可点的东西，只能得出「选不了人」的结论。
    这里必须把原因写在脸上。 */
 if(d.done&&myFull&&!d.picks.some(x=>x.team===s.teamName&&x.playerId)){
 html+=`<div class="hint" style="color:var(--red);margin-bottom:8px">本届选秀你未能参与：开始时大名单已满（${rosterNow}/${ROSTER_MAX}）。想选新秀请先在转会页卖掉或放走选手腾位置，下届选秀即可参与。</div>`;
 }
 if(d.pool.length&&(d.phase==='pick'||mePick||d.done===false)){
 const interactive=mePick;
 if(interactive){
 html+=`<div class="grid g4">${d.pool.map(p=>{
 const blocked=interactive&&draftBlockedFor(s,s.teamName,p);
 const card=pcard(p,interactive
 ?(blocked?`<div class="hint mt8">本队青训 · 不可选</div>`
 :`<button class="btn sm primary mt8" style="width:100%"> 点名签约</button>`)
 :'');
 /* 整张卡可点：只把小按钮做成热区时，玩家点卡片本体没反应，会被当成「选不了人」。
    onclick 只挂在外层容器上（内层按钮靠冒泡触发，避免一次点击调用两次 draftPick）。 */
 return (interactive&&!blocked)
 ?`<div onclick="draftPick('${p.id}')" style="cursor:pointer" title="点击签约">${card}</div>`
 :card;
 }).join('')}</div>`;
 }else{
 /* 非本队点名回合（竞拍中 / 你已放弃 / 已收官）：新秀卡只能看不能点，可原来是 20 张完整
    pcard 实测 40.7 KB——约占转会页的 1/3，而它承载的信息只有「名字/位置/总值/档级」。
    这里压成紧凑行（约 3 KB），信息一条不少；轮到自己点名时仍走上面的完整卡片路径，
    「整卡可点」和满员提示（0aeaf0b）都不受影响。 */
 const src=p=>{const t=(p.tags||[]).filter(x=>x!=='选秀'&&x!=='青训出身');return t.join('/')||'训练营';};
 html+=`<div class="hint" style="margin-bottom:6px">新秀池 ${d.pool.length} 人 · 轮到你点名时自动展开为可点卡片</div>
 <div style="max-height:220px;overflow-y:auto">${d.pool.map(p=>`<div class="match" style="margin-bottom:4px;padding:5px 8px">
 <div class="vs"><span class="tname" style="font-size:12px">${p.name} <span style="color:var(--dim);font-size:10px">(${POS[p.pos][0]} · ${p.age||18}岁${p.fromClub?' · '+p.fromClub+'青训':''})</span></span></div>
 <div class="power" style="font-size:10px">${src(p)}</div>
 <div class="score" style="font-size:12px;min-width:0">总值 ${overall(p)}</div>
 </div>`).join('')}</div>`;
 }
 }
 // 放弃按钮必须独立于「池里有人」：池子空时原来连按钮都不渲染 → 玩家卡死在点名阶段
 if(mePick)html+=`<button class="btn sm mt8" onclick="draftSkip()">放弃点名</button>`;
 if((d.log||[]).length){
 html+=`<div class="hint" style="margin-top:10px">大会记录：${d.log.slice(-10).map(l=>_escTxt(l)).join('<br>')}</div>`;
 }
 html+=`</div>`;
 return html;
}
