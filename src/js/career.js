/* 选手/教练生涯引擎 + 年度回顾 + 退役名宿市场（season.js 机械拆出） */
/* ================= 选手生涯 / 教练生涯（引擎侧） ================= */
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
 me.kTotal=0;me.dTotal=0;me.aTotal=0;me.caps=0;me.mvp=0; // 本赛季计数清零（生涯履历已快照）
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
 s.coach={...COACH_POOL.find(c=>c.id===tmpl.coach)};
 s.lineup=[]; // 新东家首发由教练按战力重排（coachPickLineup）
 s.seedPower=teamPower(s)||300;
 logEvent(s,' 转会完成：'+me.name+' 正式加盟 '+tmpl.name+'（转会费 '+mv.fee+'万 · 年薪 '+me.wage+'万/周）——首发位置要重新证明');
}
function coachAutoSquad(s){ // 教练模式：俱乐部自动续约与引援（你只管排人用兵）
 (s.expiring||[]).slice().forEach(pid=>{
 const p=s.players.find(x=>x.id===pid);
 if(p&&!p.loan)p.contract=(p.contract||0)+1; // 俱乐部统一续约一年
 });
 s.expiring=[];
 let need=POS_ORDER.filter(pos=>!s.players.some(p=>p.pos===pos));
 const u=new Set(s.players.map(p=>p.name));
 let g=0;
 while((s.players.length<7||need.length)&&g++<10){
 const pos=need.length?need[0]:pick(POS_ORDER);
 const def=genFreeAgentDef(pos,s.players.length<6?'mid':'low',u);
 const p=genPlayer(def);
 p.contract=2;
 s.players.push(p);
 logEvent(s,' 俱乐部引援：签下自由球员 '+p.name+'（'+POS[pos][0]+' · 总值 '+overall(p)+'）');
 if(need.length&&s.players.some(x=>x.pos===need[0]))need.shift();
 }
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
 const byPos={};
 s.players.forEach(p=>{(byPos[p.pos]=byPos[p.pos]||[]).push(p);});
 const lineup=[];
 POS_ORDER.forEach(pos=>{
 const cand=byPos[pos];
 if(cand&&cand.length){cand.sort((a,b)=>playerPower(b)-playerPower(a));lineup.push(cand[0].id);}
 });
 if(lineup.length)s.lineup=lineup;
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

/* 选手退役去向：转教练（战力加成）或转型主播（人气收入），进入"退役名宿"市场 */
function retireToCoach(s,p){
 s.retiredCoaches=s.retiredCoaches||[];
 const isStar=p.mvp>=1||overall(p)>=88; // 名宿看生涯成就与实力，看出身
 if(Math.random()<0.6||!isStar){
 // 转教练：实力越强加成越高
 const bonus=isStar?rnd(5,8):rnd(3,5);
 const style=pick(['lane','farm','team','mind']);
 const coach={id:'rc'+Date.now()+'_'+rnd(100,999),name:p.name,rating:isStar?80:70,style,bonus,styleBonus:isStar?rnd(3,5):2,
 wage:isStar?rnd(120,180):rnd(80,110),cost:isStar?rnd(1200,1800):rnd(700,1000),
 skill:{n:'名宿执教',d:'全队战力+'+bonus+'% · 退役选手转型教练'},type:'coach',origin:p.name};
 s.retiredCoaches.push(coach);
 logEvent(s,''+p.name+'（'+p.age+'岁）退役转型主教练！执教能力已进入教练市场');
 }else{
 // 转型主播：给俱乐部带来人气收入（每日资金）
 const host={id:'rh'+Date.now()+'_'+rnd(100,999),name:p.name,rating:80,type:'host',
 income:rnd(40,90),cost:rnd(900,1400),popularity:(p.popularity||40)+rnd(10,25),
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
function fireHost(s,id){
 const h=(s.hosts||[]).find(x=>x.id===id);
 if(h&&!confirmDanger('解除主播 '+h.name+' 的合约？\n每日人气收入 '+h.income+'万 将停止。'))return;
 s.hosts=(s.hosts||[]).filter(x=>x.id!==id);
 save();renderAll();toast('已解除主播合约');
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
