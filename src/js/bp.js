
/* ================= KPL 选边系统（红蓝方） =================
 季后赛/卡位赛首局：常规赛排名更高者选边；常规赛首局：抛硬币
 第 2-6 局：败方选边（自由选蓝/红）；BO7 第 7 局巅峰对决：第 6 局败方选边
 蓝方=先ban先选一抢；红方=counter位后手克制（本局战力+2%） */
function groupOfTeam(s,n){
 // 检查所有可能的组（含季后赛阶段，phaseGroups 在 playoff 时为空）
 for(const g of ['S','A','B','G1','G2','G3']){if(s.groups[g]&&s.groups[g].includes(n))return g;}
 return 'G3';
}
function sidePriority(s,a,b){
 const order={S:0,A:1,B:2,G1:0,G2:1,G3:2};
 const gA=groupOfTeam(s,a),gB=groupOfTeam(s,b);
 if(order[gA]!==order[gB])return order[gA]<order[gB]?a:b;
 const tA=(s.tables[gA]||{})[a]||{pts:0,pw:0},tB=(s.tables[gB]||{})[b]||{pts:0,pw:0};
 if(tA.pts!==tB.pts)return tA.pts>tB.pts?a:b;
 return tA.pw>=tB.pw?a:b;
}
/* 首局选边：常规赛抛硬币；卡位/季后赛排名高者拥有选边权 */
function firstSide(s,stage,opName){
 if(stage==='regular'||!stage)return Math.random()<0.5?'blue':'red';
 const hi=sidePriority(s,s.teamName,opName);
 if(hi===s.teamName)return Math.random()<0.5?'blue':'red';
 return Math.random()<0.6?'red':'blue'; // AI 偏好红方 counter
}
function aiPickSide(s){return Math.random()<0.5?'red':'blue';}
/* 败方选边弹窗（玩家拥有选边权时） */
function showSideChoice(nextTitle){
 $('#app-modal-body').innerHTML=`
 <h2>败方选边</h2>
 <div class="hint" style="text-align:center;margin-bottom:14px">上一局落败，按 KPL 规则败方拥有下一局选边权（自由选蓝/红，非强制互换）</div>
 <div style="display:flex;gap:10px;justify-content:center">
 <button class="btn primary" style="flex:1" onclick="setSide('blue')">蓝方 · 先ban先选<br><small style="color:var(--dim)">第一轮主动权 · 一抢版本强势</small></button>
 <button class="btn gold" style="flex:1" onclick="setSide('red')">红方 · 后手counter<br><small style="color:var(--dim)">第二轮针对性选人 · 克制对方</small></button>
 </div>`;
 $('#app-modal').classList.add('on');
 window._sideNext=nextTitle||'';
}
function setSide(side){
 if(S.series)S.series.side=side;
 closeModal('app-modal');
 openBP(window._sideNext||'',playGame);
}

/* ================= BP 有效战力结算（BP 影响胜负的核心） =================
 有效战力 = 基础战力 × BP 修正，双方对称可对赌：
 · 我方 BAN：禁掉「对方池内英雄」每个 -2%（BAN 空气只 -0.5%）→ 最高 -8%
 · 对方 BAN：禁掉「我方首发池内英雄」每个 -1%（叠加我方被迫换人的熟练度损失）
 · 版本强势（）：我方由英雄加成内置；对方每选一个 +2% 补齐对称
 · 红方后手 counter +2%（蓝方优势=先手一抢，已体现在选人顺序）
 · 巅峰对决：盲选无 BAN，不吃任何修正 */
function bpEffective(v){
 const myLs=rosterLineup(S);
 let my=teamPower(S,v.myPicks||null);
 // 对方战力：有真实阵容时实时结算（与玩家同刻度、含体力衰减），否则退回静态值
 let op=(v.opRoster&&v.opRoster.length)?aiRosterPower(v.opRoster,S,v.opName):powerOf(S,v.opName);
 const notes=[];
 if(!v.isPeak){
 let banCut=0;
 (v.myBans||[]).forEach(h=>{
 const real=(v.opRoster||[]).some(p=>(p.heroPool||[]).some(x=>x.n===h))&&!(v.usedOpp||[]).includes(h); // 对方本系列赛已用：BAN不到，只算池外价
 banCut+=real?0.02:0.005;
 });
 if(banCut){op*=1-banCut;notes.push('我方 BAN×'+(v.myBans||[]).length+' 对方-'+Math.round(banCut*100)+'%');}
 let myCut=0;
 (v.oppBans||[]).forEach(h=>{
 const real=myLs.some(p=>(p.heroPool||[]).some(x=>x.n===h))&&!(v.used||[]).includes(h);
 myCut+=real?0.01:0.002;
 });
 if(myCut){my*=1-myCut;notes.push('对方 BAN×'+(v.oppBans||[]).length+' 我方-'+Math.round(myCut*100)+'%');}
 const hot=Object.values(v.oppPicks||{}).filter(h=>heroOf(h)&&heroOf(h).hot).length;
 if(hot){op*=1+hot*0.02;notes.push('对方×'+hot+' +'+(hot*2)+'%');}
 if(v.side==='red'){my*=1.02;notes.push('红方counter+2%');}
 else{op*=1.02;notes.push('对方counter+2%');}
 // 王朝反制①：对阵连冠队伍，研究方有效战力 +2%/连冠季（上限+6%）
 const mySt=dynastyStreak(S,S.teamName),opSt=dynastyStreak(S,v.opName);
 if(mySt){op*=1+mySt*0.02;notes.push('对手研究我方'+mySt+'连冠 +'+(mySt*2)+'%');}
 if(opSt){my*=1+opSt*0.02;notes.push('我方研究对方'+opSt+'连冠 +'+(opSt*2)+'%');}
 }
 return {my:Math.round(my),op:Math.round(op),notes};
}
/* BP 台实时结算：我方未选位置按当前可选最优估算，对方按其池内最优可用估算 */
function bpEffPreview(d){
 const myPicks={...d.myPicks};
 myOpenPositions(d).forEach(pos=>{
 const best=bestHeroFor(d,pos,myCandidates(d,pos));
 if(best)myPicks[pos]=best;
 });
 const taken=takenSet(d),oppPicks={...d.oppPicks};
 (d.oppRoster||[]).forEach(p=>{
 if(p.injury>0)return; // 伤员不计入对方可选估算
 if(oppPicks[p.pos])return;
 let best=null,bp=-1;
 (p.heroPool||[]).forEach(x=>{
 const h=heroOf(x.n);
 if(h&&h.pos.includes(p.pos)&&!taken.has(x.n)&&!(d.usedOpp||[]).includes(x.n)){const pw=playerPower(p,x.n);if(pw>bp){bp=pw;best=x.n;}}
 });
 if(best)oppPicks[p.pos]=best;
 });
 return bpEffective({myPicks,myBans:d.myBans,oppPicks,oppBans:d.oppBans,side:d.sr.side,isPeak:d.isPeak,opName:d.sr.opName,opRoster:d.oppRoster,used:d.used,usedOpp:d.usedOpp});
}

/* ================= KPL 官方 BP 引擎（两段式征召 · 逐手交互） =================
 官方每局流程（蓝方视角，红方镜像）：
 ① 第一轮 BAN：蓝1 → 红1 → 蓝1 → 红1（各2个）
 ② 第一轮 PICK：蓝1 → 红2 → 蓝2 → 红1（各3人）
 ③ 第二轮 BAN：红1 → 蓝1 → 红1 → 蓝1（再各2个，共4个）
 ④ 第二轮 PICK：红1 → 蓝2 → 红1（各2人，满5人）
 系列赛全局 BP：己方本系列赛用过的英雄不能再选；
 BO7 打至 3:3 进入第 7 局「巅峰对决」：无 BAN、双方盲选、不受全局 BP 限制。 */
function kplDraftSteps(){
 return [ // {s:蓝/红, t:ban/pick, n:连选手数} —— 共 8 ban + 10 pick = 18 手
 {s:'B',t:'ban',n:1},{s:'R',t:'ban',n:1},{s:'B',t:'ban',n:1},{s:'R',t:'ban',n:1},
 {s:'B',t:'pick',n:1},{s:'R',t:'pick',n:2},{s:'B',t:'pick',n:2},{s:'R',t:'pick',n:1},
 {s:'R',t:'ban',n:1},{s:'B',t:'ban',n:1},{s:'R',t:'ban',n:1},{s:'B',t:'ban',n:1},
 {s:'R',t:'pick',n:1},{s:'B',t:'pick',n:2},{s:'R',t:'pick',n:1},
 ];
}
function expandSteps(sr,isPeak){
 if(isPeak)return [{side:'M',type:'pick'},{side:'M',type:'pick'},{side:'M',type:'pick'},{side:'M',type:'pick'},{side:'M',type:'pick'}];
 const myIsBlue=(sr.side!=='red');
 const steps=[];
 kplDraftSteps().forEach(st=>{
 const mine=(st.s==='B')===myIsBlue;
 for(let i=0;i<st.n;i++)steps.push({side:mine?'M':'O',type:st.t});
 });
 return steps; // 18 手，side: M=我方 O=对方
}
/* 首发缺位时从替补席同位置自动递补（退役/转会后防呆）；伤停/国家队集训必须休息：
 无健康替补时位置空缺，由 lineupNoGo 在开赛入口统一拦截（签替补/提拔青训是玩家决策） */
function natBusy(s,p){return !!(p&&(p.injury>0||(typeof natCamping==='function'&&natCamping(s,p))));}
/* 当前首发里无法出战的位置（无人/伤停/集训）——openBP 与 autoPlayNext 共用同一判定 */
function lineupNoGo(s){
 return POS_ORDER.filter(pos=>{
 const p=rosterLineup(s).find(x=>x.pos===pos);
 return !p||natBusy(s,p);
 });
}
function noGoDetail(s,noGo){
 return noGo.map(pos=>{
 const p=rosterLineup(s).find(x=>x.pos===pos);
 return POS[pos][0]+(p?(p.natCamp?'（'+p.name+' 国家队集训）':'（'+p.name+' 伤停'+p.injury+'天）'):'（无人）');
 }).join('、');
}
function autoFillLineup(s){
 POS_ORDER.forEach(pos=>{
 const cur=s.lineup.map(id=>s.players.find(p=>p.id===id)).filter(Boolean);
 const inPos=cur.find(p=>p.pos===pos);
 if(inPos&&natBusy(s,inPos)){ // 伤员/集训自动下场
 const cands=s.players.filter(p=>!s.lineup.includes(p.id)&&p.pos===pos&&!natBusy(s,p))
 .sort((a,b)=>playerPower(b,b.sig)-playerPower(a,a.sig)); // 替补择优上场
 const fit=cands[0];
 if(fit){
 s.lineup[s.lineup.indexOf(inPos.id)]=fit.id;
 logEvent(s,' '+inPos.name+(inPos.natCamp?' 国家队集训中，缺席夏季赛；':' 伤停（还剩'+inPos.injury+'天），')+fit.name+' 顶替首发（'+POS[pos][0]+'）');
 return;
 }
 if(inPos.natCamp){ // 集训缺席且无替补：强制下场留空位（开赛拦截——签替补是正式策略，不再凭空借调青训）
 s.lineup.splice(s.lineup.indexOf(inPos.id),1);
 logEvent(s,' '+inPos.name+' 国家队集训中且无替补可顶——'+POS[pos][0]+'空缺！转会市场签一名替补，否则该位置无法出战');
 return;
 }
 // 伤停无替补：留在首发（伤员自动下场后会无人可换），留给 openBP 拦截
 }
 if(!cur.some(p=>p.pos===pos)){
 const cands=s.players.filter(p=>!s.lineup.includes(p.id)&&p.pos===pos&&!natBusy(s,p))
 .sort((a,b)=>playerPower(b,b.sig)-playerPower(a,a.sig));
 const bench=cands[0];
 if(bench){s.lineup.push(bench.id);logEvent(s,' '+bench.name+' 递补进入首发（'+POS[pos][0]+'）');}
 }
 });
}
/* 系列赛开始：对手阵容体力回满（体力衰减只在系列赛内逐局累积，跨系列赛恢复；AI 互比用构建值）
 伤病对称：AI 也会伤停（以缺阵系列赛数计），伤员由本队青训递补顶替——追打伤停队是合法战术 */
function resetOppEnergy(s,opName){
 ensureAiRosters(s,opName);
 const r=s.aiRosters[opName]||[];
 r.forEach(p=>{p.energy=ENERGY_MAX;});
 if(!s.aiInj)s.aiInj={};
 const inj=s.aiInj[opName]=s.aiInj[opName]||{};
 r.forEach(p=>{
 if(p.id.startsWith('ac_'))return; // 递补青训不再受伤
 if(inj[p.id]>0){
 inj[p.id]--;
 }else if(Math.random()<0.06){
 inj[p.id]=rnd(1,2); // 缺席 1-2 个系列赛
 logEvent(s,' 对方 '+p.name+' 赛前训练受伤，将缺阵 '+inj[p.id]+' 个系列赛');
 }
 });
 POS_ORDER.forEach(pos=>{
 const real=r.filter(p=>p.pos===pos&&!p.id.startsWith('ac_'));
 const sick=real.some(p=>inj[p.id]>0);
 const fill=r.find(p=>p.pos===pos&&p.id.startsWith('ac_'));
 if(sick&&!fill){
 const usedNames=rookieUsedNames(s); // 全局查重：避免与玩家/其他 AI 队青训重名
 r.forEach(x=>usedNames.add(x.name));
 const f=genPlayer(genAcademyDef(pos,usedNames,s.season));
 r.push(f);
 const who=real.find(p=>inj[p.id]>0);
 logEvent(s,' '+opName+' 青训 '+f.name+' 顶替伤停的 '+who.name+'（'+POS[pos][0]+'）');
 }else if(real.length&&!sick&&fill){
 r.splice(r.indexOf(fill),1); // 伤愈且有健康主力在位：递补退场
 // 注意：real 为空（该位置真实选手被玩家买走/租走）时不能删递补——他是顶空缺的，不是顶伤员的
 }
 });
 s.aiPower[opName]=aiRosterPower(r,s,opName);
}
function openBP(title,onConfirm){
 autoFillLineup(S);
 const ls=rosterLineup(S);
 const noGo=lineupNoGo(S);
 if(noGo.length){
 const detail=noGoDetail(S,noGo);
 toast(' '+detail+' 无法出战：签约替补顶位（转会市场）/ 青训晋升 / 休息等伤愈');
 return;
 }
 const sr=S.series;
 const isPeak=sr&&sr.max>=7&&sr.mw+sr.ow===sr.max-1; // 巅峰对决：BO7 3:3 / BO9 4:4
 window._draft={
 onConfirm,sr,ls,title,isPeak,
 used:(sr&&!isPeak&&sr.used)?sr.used.slice():[],
 usedOpp:(sr&&!isPeak&&sr.usedOpp)?sr.usedOpp.slice():[],
 steps:expandSteps(sr,isPeak),idx:0,
 myBans:[],oppBans:[],myPicks:{},oppPicks:{},curPos:null,
 oppRoster:isPeak?[]:(ensureAiRosters(S,sr.opName)||[]),
 };
 renderBP();
}
/* 当前是否轮到我方（自动处理对方所有连续手） */
function draftAction(d){
 while(d.idx<d.steps.length&&d.steps[d.idx].side==='O'){
 aiDraftStep(d);d.idx++;
 }
 if(d.idx>=d.steps.length)return {type:'done'};
 const st=d.steps[d.idx];
 return {type:st.type,side:'M'};
}
/* ---------- 可选英雄/禁用候选 ---------- */
function takenSet(d){
 return new Set([...d.used,...d.myBans,...d.oppBans,...Object.values(d.myPicks),...Object.values(d.oppPicks)]);
}
function myCandidates(d,pos){
 const p=(d.ls||[]).find(x=>x.pos===pos);
 if(!p)return [];
 const taken=takenSet(d);
 const cand=p.heroPool.filter(h=>heroOf(h.n)&&heroOf(h.n).pos.includes(pos)&&!taken.has(h.n));
 if(cand.length)return cand;
 // 职业选手兜底：池内英雄全被 BAN/选完时，可临时拿出该位置任意英雄（生疏-8%，赛后进池）
 return HEROES.filter(h=>h.pos.includes(pos)&&!taken.has(h.n)).map(h=>({n:h.n,lv:0}));
}
/* 临时掏的英雄写入选手英雄池（生疏），保证战力结算与展示一致 */
function ensureHeroInPool(p,hero){
 if(p&&!p.heroPool.some(x=>x.n===hero))p.heroPool.push({n:hero,lv:0});
}
function banCandidates(d){
 const taken=takenSet(d);
 return HEROES.map(h=>h.n).filter(n=>!taken.has(n));
}
function myOpenPositions(d){
 return POS_ORDER.filter(pos=>!(pos in d.myPicks)&&d.ls.some(x=>x.pos===pos));
}
function bestHeroFor(d,pos,avail){
 const p=(d.ls||[]).find(x=>x.pos===pos);
 if(!p||!avail.length)return null;
 let best=avail[0].n,bp=-1;
 avail.forEach(h=>{const pw=playerPower(p,h.n)+(heroOf(h.n)&&heroOf(h.n).hot?1.5:0);if(pw>bp){bp=pw;best=h.n;}});
 return best;
}
/* 威胁值：某英雄对某方阵容的威胁 = 该方能玩此英雄的选手最高战力
 我方 BAN 时看 'opp'（禁掉对面的强点）；对方 AI BAN 时看 'me' */
function threatOf(d,h,side){
 if(side==='opp'&&(d.usedOpp||[]).includes(h))return null; // 对方本系列赛已用：本局选不了，无威胁
 if(side!=='opp'&&(d.used||[]).includes(h))return null; // 我方已用同理
 const roster=side==='opp'?(d.oppRoster||[]):d.ls;
 let bp=null;
 roster.forEach(p=>{
 if(p.injury>0)return; // 伤员无法出战，不构成威胁
 if((p.heroPool||[]).some(x=>x.n===h)&&heroOf(h)&&heroOf(h).pos.includes(p.pos)){
 const pw=playerPower(p,h);if(bp==null||pw>bp)bp=pw;
 }
 });
 return bp;
}
/* 我方 BAN 推荐：对方已用的英雄本局选不了，BAN 它=浪费（结算只按池外 -0.5% 计），排到最后 */
function banScore(d,h){
 const oppUsed=(d.usedOpp||[]).includes(h);
 return (threatOf(d,h,'opp')||0)+((heroOf(h).hot&&!oppUsed)?2:0)+(oppUsed?-1:0);
}
function bestBanFor(d){
 let best=null,bs=-1;
 banCandidates(d).forEach(h=>{const v=banScore(d,h);if(v>bs){bs=v;best=h;}});
 return best;
}
/* ---------- AI 逐手决策 ---------- */
function aiDraftStep(d){
 const st=d.steps[d.idx];
 if(st.type==='ban'){
 // 对方 AI 禁用：禁掉我方阵容威胁最大的英雄（跳过自己本系列赛已用的——本局也选不了）
 const avail=banCandidates(d).filter(h=>!((d.usedOpp||[]).includes(h)));
 let best=null,bs=-1;
 avail.forEach(h=>{
 const th=threatOf(d,h,'me')||0;
 const score=th+(heroOf(h).hot?2:0)+(Math.random()*1.5);
 if(score>bs){bs=score;best=h;}
 });
 if(best)d.oppBans.push(best);
 return;
 }
 // AI 选人：挑剩余位置中（选手×英雄）战力最高的一手，稍带保护招牌倾向；伤员跳过
 let bestPos=null,bestHero=null,bs=-1;
 POS_ORDER.forEach(pos=>{
 if(pos in d.oppPicks)return;
 const p=(d.oppRoster||[]).find(x=>x.pos===pos&&x.injury<=0);
 if(!p)return;
 const taken=takenSet(d),oppUsed=d.usedOpp||[]; // 全局BP：对方本系列赛己方用过的也不能再选
 let cand=(p.heroPool||[]).filter(h=>heroOf(h.n)&&heroOf(h.n).pos.includes(pos)&&!taken.has(h.n)&&!oppUsed.includes(h.n));
 if(!cand.length)cand=HEROES.filter(h=>h.pos.includes(pos)&&!taken.has(h.n)&&!oppUsed.includes(h.n)).map(h=>({n:h.n,lv:0})); // 兜底：临时掏
 cand.forEach(h=>{
 const pw=playerPower(p,h.n);
 let score=pw+(heroOf(h.n).hot?1.2:0)+(h.n===p.sig?0.8:0)+Math.random();
 if(score>bs){bs=score;bestPos=pos;bestHero=h.n;}
 });
 });
 if(bestPos){d.oppPicks[bestPos]=bestHero;ensureHeroInPool((d.oppRoster||[]).find(x=>x.pos===bestPos&&x.injury<=0),bestHero);}
}
/* ---------- 我方操作入口 ---------- */
function bpBanPick(hero){
 const d=window._draft;if(!d)return;
 if(d.myBans.includes(hero)){toast('已禁用该英雄');return;}
 d.myBans.push(hero);d.idx++;d.curPos=null;renderBP();
}
function bpChoosePos(pos){const d=window._draft;if(!d)return;d.curPos=pos;renderBP();}
function bpBackToPos(){const d=window._draft;if(!d)return;d.curPos=null;renderBP();}
function bpBackFromSwap(){const d=window._draft;if(!d)return;d.swap=false;renderBP();}
function bpPickHero(hero){
 const d=window._draft;if(!d)return;
 const pos=d.curPos;if(!pos){toast('请先选择要出战的位置');return;}
 if(!myCandidates(d,pos).some(h=>h.n===hero)){toast('「'+hero+'」不可选');return;}
 const pl=(d.ls||[]).find(x=>x.pos===pos);
 if(pl&&!pl.heroPool.some(x=>x.n===hero))ensureHeroInPool(pl,hero); // 临时掏，生疏-8%
 d.myPicks[pos]=hero;d.idx++;d.curPos=null;renderBP();
}
/* ---------- 推荐与自动 ---------- */
function bpSuggest(){
 const d=window._draft;if(!d)return;
 let guard=0;
 while(guard++<40){
 const act=draftAction(d);
 if(act.type==='done')break;
 if(act.type==='ban'){
 const best=bestBanFor(d);
 if(best)d.myBans.push(best);
 d.idx++;
 }else{
 let bestPos=null,bestHero=null,bs=-1;
 myOpenPositions(d).forEach(pos=>{
 const avail=myCandidates(d,pos),best=bestHeroFor(d,pos,avail);
 if(best){const p=(d.ls||[]).find(x=>x.pos===pos);const pw=playerPower(p,best);if(pw>bs){bs=pw;bestPos=pos;bestHero=best;}}
 });
 if(bestPos){d.myPicks[bestPos]=bestHero;ensureHeroInPool((d.ls||[]).find(x=>x.pos===bestPos),bestHero);}
 d.idx++;
 }
 }
 renderBP();
}
function bpAuto(){bpSuggest();bpConfirm();}
function bpAutoAll(){
 if(!confirm('开启后本系列赛剩余局次将自动 BP 并直接开赛，不再弹 BP 界面（想手动参与就别开）。确定开启？'))return;
 S.seriesAuto=true;
 closeModal('app-modal');
 autoPlayNext();
}
/* 无 UI 自动跑完一整局 BP（系列赛自动模式） */
function autoPlayNext(){
 const sr=S.series;
 if(!sr)return;
 const isPeak=sr.max>=7&&sr.mw+sr.ow===sr.max-1;
 autoFillLineup(S); // 伤员自动换下/缺位递补
 const noGo=lineupNoGo(S);
 if(noGo.length){
 toast(' '+noGoDetail(S,noGo)+' 无法出战（伤停/无人/集训）——自动BP暂停，请补齐阵容');
 S.seriesAuto=false;
 openBP('伤停 · 请补齐阵容后继续',playGame);
 return;
 }
 const ls=rosterLineup(S);
 if(!ls.length){toast('没有可用阵容');S.seriesAuto=false;return;}
 const d={sr,ls,isPeak,
 used:(sr&&!isPeak&&sr.used)?sr.used.slice():[],
 usedOpp:(sr&&!isPeak&&sr.usedOpp)?sr.usedOpp.slice():[],
 steps:expandSteps(sr,isPeak),idx:0,
 myBans:[],oppBans:[],myPicks:{},oppPicks:{},curPos:null,
 oppRoster:isPeak?[]:(ensureAiRosters(S,sr.opName)||[])};
 let guard=0;
 while(guard++<40){
 const act=draftAction(d);
 if(act.type==='done')break;
 if(act.type==='ban'){
 const best=bestBanFor(d);
 if(best)d.myBans.push(best);
 d.idx++;
 }else{
 let bestPos=null,bestHero=null,bs=-1;
 myOpenPositions(d).forEach(pos=>{
 const avail=myCandidates(d,pos),best=bestHeroFor(d,pos,avail);
 if(best){const p=ls.find(x=>x.pos===pos);const pw=playerPower(p,best);if(pw>bs){bs=pw;bestPos=pos;bestHero=best;}}
 });
 if(bestPos){d.myPicks[bestPos]=bestHero;ensureHeroInPool(ls.find(x=>x.pos===bestPos),bestHero);}
 d.idx++;
 }
 }
 if(POS_ORDER.some(pos=>!d.myPicks[pos])){
 toast('有选手英雄池耗尽，自动BP暂停，请去阵容页换人');
 S.seriesAuto=false;
 openBP('英雄池耗尽 · 请换替补后继续',playGame);
 return;
 }
 sr.myBans=d.myBans;sr.oppBans=d.oppBans;sr.oppPicks={...d.oppPicks};
 applyBp({...d.myPicks});
 playGame();
}
function applyBp(sels){
 S.pick=sels;
 if(S.series){
 const sr=S.series;
 sr.used=sr.used||[];
 POS_ORDER.forEach(pos=>{const h=sels[pos];if(h&&!sr.used.includes(h))sr.used.push(h);});
 // 全局 BP 分队记账：对方本局所选英雄同样入册——己方用过的本系列赛不能再选，按队分开算
 sr.usedOpp=sr.usedOpp||[];
 POS_ORDER.forEach(pos=>{const h=(sr.oppPicks||{})[pos];if(h&&!sr.usedOpp.includes(h))sr.usedOpp.push(h);});
 }
}
/* ---------- BP 内换替补（不打断 BP 进度，已选英雄保留给该位置） ---------- */
function bpOpenSwap(){const d=window._draft;if(!d)return;d.swap=true;renderBP();}
function bpSwapIn(pid){
 const d=window._draft;if(!d)return;
 const p=S.players.find(x=>x.id===pid);
 if(p.injury>0){toast(p.name+' 伤停中（还剩'+p.injury+'天），无法登场');return;}
 const cur=rosterLineup(S).find(x=>x.pos===p.pos);
 if(!cur){toast('该位置没有首发');return;}
 S.lineup[S.lineup.indexOf(cur.id)]=p.id;
 if(S.pick&&S.pick[p.pos])ensureHeroInPool(p,S.pick[p.pos]); // 上局英雄残留：新选手临时掏
 if(d.myPicks[p.pos])ensureHeroInPool(p,d.myPicks[p.pos]); // 本局已选英雄：保留，新选手接手
 d.ls=rosterLineup(S);d.swap=false;
 save();toast(p.name+' 替补登场（'+POS[p.pos][0]+'）');
 renderBP();
}
function bpConfirm(){
 const d=window._draft;if(!d){toast('未找到BP状态');return;}
 if(d.stage!=='done')bpSuggest();
 const sels={...d.myPicks};
 if(POS_ORDER.some(pos=>!sels[pos])){toast('还有位置没选英雄');return;}
 const sr=d.sr;
 if(sr){sr.myBans=(d.myBans||[]).slice(0,4);sr.oppBans=(d.oppBans||[]).slice(0,4);sr.oppPicks={...d.oppPicks};}
 applyBp(sels);
 save();closeModal('app-modal');
 window._draft=null;
 if(d.onConfirm)d.onConfirm();
}

/* ================= BP 台 UI（赛事转播观感） ================= */
function bpSlot(cls,txt,sub){return `<div class="bp-slot ${cls}">${(cls.includes('filled')&&txt&&txt!=='—'&&txt!=='？？？')?heroIcon(txt,19):''}<b>${txt||'&nbsp;'}</b><small>${sub||'&nbsp;'}</small></div>`;}
function bpSideColumn(d,mine){
 const sr=d.sr;
 const myBlue=(sr.side!=='red');
 const isBlue=mine?myBlue:!myBlue;
 const name=mine?(S.teamName):(sr.opName);
 const bans=mine?d.myBans:d.oppBans;
 const picks=d.oppPicks;
 const order=mine?POS_ORDER:['top','jg','mid','ad','sup'];
 let pickSlots='';
 if(d.isPeak&&mine){
 pickSlots=order.map(pos=>bpSlot('pick'+(d.myPicks[pos]?' filled':''),d.myPicks[pos]||'',POS[pos][0])).join('');
 }else if(d.isPeak){
 pickSlots=order.map(()=>bpSlot('pick blind','？？？','盲选')).join('');
 }else{
 pickSlots=order.map(pos=>{
 const p=(mine?d.ls:d.oppRoster||[]).find(x=>x.pos===pos&&(mine||x.injury<=0)); // 对方位显示健康选手（青训递补）
 const hero=mine?d.myPicks[pos]:picks[pos];
 return bpSlot('pick'+(hero?' filled':''),hero||'',(p?p.name:POS[pos][0]));
 }).join('');
 }
 const banSlots=[0,1,2,3].map(i=>bpSlot('ban'+(bans[i]?' filled red':''),d.isPeak?'—':(bans[i]||''),'BAN')).join('');
 return `<div class="bp-col ${isBlue?'blue':'red'}">
 <div class="bp-col-hd"><span class="side-dot"></span>${name}<small>${isBlue?'蓝方':'红方'}</small></div>
 <div class="bp-bans">${banSlots}</div>
 <div class="bp-picks">${pickSlots}</div>
 </div>`;
}
function phaseLabel(d){
 if(d.isPeak)return '巅峰对决 · 盲选（无BAN · 不受全局BP限制）';
 if(d.idx<4)return '第一轮 BAN';
 if(d.idx<10)return '第一轮 PICK';
 if(d.idx<14)return '第二轮 BAN';
 if(d.idx<18)return '第二轮 PICK';
 return 'BP 完成';
}
function renderBP(){
 const d=window._draft;
 if(!d){toast('BP状态丢失');return;}
 const act=draftAction(d);
 const sr=d.sr;
 const sideTxt=(sr&&sr.side==='red')?'我方红方 · 第二轮后手 counter':'我方蓝方 · 第一轮先ban先选';
 let board;
 if(d.isPeak){
 board=`<div class="bp-board"><div class="bp-center"><div class="bp-phase">盲选模式 · 双方互相不可见 · 英雄池全解锁</div></div>
 <div style="display:flex;gap:8px;justify-content:center">${bpSideColumn(d,true)}</div></div>`;
 }else{
 board=`<div class="bp-board">
 ${bpSideColumn(d,true)}
 <div class="bp-center"><div class="bp-phase">${phaseLabel(d)}</div>
 <div class="bp-stepnum">${Math.min(d.idx+1,18)} / ${d.isPeak?5:18} 手</div><div class="bp-stepbar"><i style="width:${Math.min(100,Math.round((d.idx)/(d.isPeak?5:18)*100))}%"></i></div>
 ${(d.used.length||d.usedOpp.length)?`<div class="bp-used" style="cursor:help" title="我方已用：${d.used.join('、')||'无'}
对方已用：${d.usedOpp.join('、')||'无'}">全局BP已用 · 我方 ${d.used.length} 个 ｜ 对方 ${d.usedOpp.length} 个 · 悬停看明细</div>`:''}
 </div>
 ${bpSideColumn(d,false)}
 </div>`;
 }
 board=`<div class="hint" style="text-align:center;margin-bottom:8px">${d.title||''}　·　${d.isPeak?'盲选':sideTxt}</div>`+board;
 // 实时结算：BP 每一步对有效战力/胜率的影响
 const v=bpEffPreview(d);
 const wr=Math.round(winChance(v.my,v.op)*100);
 const est=!d.isPeak&&(Object.keys(d.myPicks).length<5||Object.keys(d.oppPicks).length<5);
 const verdict=`<div style="display:flex;gap:8px;margin:10px 0 0;align-items:stretch">
 <div style="flex:1;background:var(--surface2);border:1px solid var(--line);border-radius:10px;padding:6px 10px;text-align:center">
 <div style="font-size:11px;color:var(--dim)">我方有效战力</div>
 <div style="font-size:18px;font-weight:800;color:var(--cyan)">${v.my}</div></div>
 <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;min-width:92px">
 <div style="font-size:11px;color:var(--dim)">预测胜率</div>
 <div style="font-size:17px;font-weight:800;color:${wr>=55?'var(--green)':wr>=45?'var(--gold)':'var(--red)'}">${wr}%</div>
 <div style="font-size:10px;color:var(--dim)">BP 结算${est?'·含预估':''}</div></div>
 <div style="flex:1;background:var(--surface2);border:1px solid var(--line);border-radius:10px;padding:6px 10px;text-align:center">
 <div style="font-size:11px;color:var(--dim)">${sr.opName} 有效战力</div>
 <div style="font-size:18px;font-weight:800;color:var(--red)">${v.op}</div></div>
 </div>
 ${v.notes.length?`<div class="hint" style="font-size:11px;margin-top:4px;text-align:center"> ${v.notes.join('　')}</div>`:''}`;
 // 操作区
 let action='';
 if(d.swap){
 const bn=rosterBench(S);
 action=`<div class="hint" style="margin:10px 0 6px;color:var(--cyan)">换替补：点击替补换下同位置首发（BP 进度保留，已选英雄由新选手接手）</div>
 ${POS_ORDER.map(pos=>{
 const cur=d.ls.find(x=>x.pos===pos);
 const cands=bn.filter(x=>x.pos===pos&&x.injury<=0); // 伤员不可登场
 return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;flex-wrap:wrap">
 <span class="tag" style="min-width:58px;text-align:center">${POS[pos][1]} ${cur?cur.name:'空缺'}</span>
 ${cands.length?cands.map(p=>`<button class="btn sm" onclick="bpSwapIn('${p.id}')">${p.name} · 战力${playerPower(p)}</button>`).join(''):'<span class="dim" style="font-size:11px">该位置无替补</span>'}
 </div>`;
 }).join('')}
 <div class="center mt8"><button class="btn" onclick="bpBackFromSwap()">← 返回 BP</button></div>`;
 }else if(act.type==='ban'){
 const avail=banCandidates(d);
 const bestBan=bestBanFor(d);
 action=`<div class="hint" style="margin:10px 0 6px;color:var(--cyan)">轮到我方 BAN · 第 ${d.myBans.length+1}/4 个（BAN 对方池内英雄每个 -2% 战力 · 为推荐 · 别浪费在对方已用的英雄上）</div>
 <div class="bp-hero-grid">${avail.map(h=>{
 const th=threatOf(d,h,'opp');
 const oppUsed=(d.usedOpp||[]).includes(h);
 const real=!oppUsed&&(d.oppRoster||[]).some(p=>(p.heroPool||[]).some(x=>x.n===h));
 return `<button class="bp-hero ${h===bestBan?'rec':''}" ${oppUsed?'style="opacity:.4"':''} onclick="bpBanPick('${h}')">${h===bestBan?' ':''}${heroIcon(h,16)} ${h}<small>${oppUsed?'对方已用 · 本局选不了':(real?('对方威胁 '+(th==null?'—':Math.round(th))):('池外 · 仅-0.5%'))}</small></button>`;
 }).join('')}</div>`;
 }else if(act.type==='pick'){
 const open=myOpenPositions(d);
 if(!d.curPos){
 action=`<div class="hint" style="margin:10px 0 6px;color:var(--cyan)">轮到我方 PICK · 第 ${Object.keys(d.myPicks).length+1}/5 人：先点选要选人的位置</div>
 <div class="bp-hero-grid">${open.map(pos=>`<button class="bp-hero pos" onclick="bpChoosePos('${pos}')">${POS[pos][1]} ${POS[pos][0]}<small>${(d.ls.find(x=>x.pos===pos)||{}).name||''}</small></button>`).join('')}</div>`;
 }else{
 const pos=d.curPos,p=(d.ls||[]).find(x=>x.pos===pos);
 const avail=myCandidates(d,pos),best=bestHeroFor(d,pos,avail);
 if(!avail.length){
 action=`<div class="hint" style="color:var(--red);margin:10px 0">${p?p.name:''} 的英雄池已被禁完/用完！<button class="btn sm danger" onclick="bpOpenSwap()">换替补登场</button></div>`;
 }else{
 action=`<div class="hint" style="margin:10px 0 6px;color:var(--cyan)">为 <b>${POS[pos][1]} ${p?p.name:''}</b> 选英雄（推荐已标 · <button class="btn sm" style="display:inline;padding:1px 8px" onclick="bpBackToPos()">← 重选位置</button>）</div>
 <div class="bp-hero-grid">${avail.map(h=>{
 const hd=heroOf(h.n),lv=HERO_LV[h.lv],rec=best===h.n;
 return `<button class="bp-hero ${rec?'rec':''}" onclick="bpPickHero('${h.n}')">${rec?' ':''}${heroIcon(h.n,16)} ${h.n}${hd&&hd.hot?'':''}<small>${lv.n}${lv.b>0?'+'+Math.round(lv.b*100)+'%':lv.b<0?Math.round(lv.b*100)+'%':''} · ${TYPE_NAME[hd?hd.t:'team']}</small></button>`;
 }).join('')}</div>`;
 }
 }
 }else{
 action=`<div class="hint" style="margin:10px 0;text-align:center;color:var(--green)">BP 完成，可以确定出战</div>`;
 }
 const html=`<h2>${d.isPeak?'巅峰对决 · 盲选':'BP · 两段式征召'} <span class="tag">${d.isPeak?'第7局':'全局BP · 绝活+8%'}</span></h2>
 ${board}${verdict}${action}
 <div class="center mt16" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
 <button class="btn" onclick="closeModal('app-modal')">取消</button>
 <button class="btn" onclick="bpOpenSwap()">换替补</button>
 <button class="btn" onclick="bpSuggest()">一键推荐</button>
 <button class="btn" onclick="bpAuto()">自动本局</button>
 <button class="btn" onclick="bpAutoAll()">本系列赛自动</button>
 <button class="btn primary" onclick="bpConfirm()" ${act.type!=='done'?'disabled':''}>确定出战</button>
 </div>`;
 $('#app-modal-body').innerHTML=html;
 $('#app-modal').classList.add('wide');
 $('#app-modal').classList.add('on');
}
