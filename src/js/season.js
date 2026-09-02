
/* ================= 比赛与联赛（KPL 2025 官方赛制） =================
 常规赛4阶段：第一轮(3组单循环BO5)→第二轮(S/A/B)→卡位赛(BO7含巅峰对决)→第三轮(S/A单循环BO5)
 季后赛：S组6队(前4进胜者组)+A组前4 → 10队 BO7 双败淘汰，总决赛第7局巅峰对决
 常规赛胜者积1分；2026起奖金按胜小局数结算 */
const PHASE_NAME={r1:'常规赛·第一轮',r2:'常规赛·第二轮',card:'卡位赛',r3:'常规赛·第三轮',playoff:'季后赛',champion:'赛季结束',eliminated:'赛季结束',challenger:'挑战者杯',ewc:'EWC 电竞世界杯',asiad:'亚运会',annual:'KPL 年度总决赛'};
const isAsiadYear=s=>gameYear(s)%4===2; // 亚运会四年一届（2026 名古屋 / 2030 / 2034…），夏赛后、年总前举行
/* ================= 年度赛历（春季赛 → EWC 电竞世界杯 → 夏季赛 → KPL 年度总决赛） =================
 真实 KPL 年历建模：一年两个联赛赛段（春/夏，赛制相同），夏季赛前穿插 EWC 国际杯赛
 （春季冠亚军分别以 KPL冠军 / 英雄亚冠ACL 身份直邀 8 强），年末年度积分前 12 打年总
 （擂台赛→突围赛→淘汰赛，冠军捧圣龙杯）。年度积分（官方规则）：
 春：冠军100/亚80/3-4名60/5-6名40/7-8名20/9-10名10/11-12名5；夏：120/100/80/50/30/20/10 */
const SPLIT_NAME={spring:'春季赛',summer:'夏季赛'};
const ANNUAL_PTS={spring:{p1:100,p2:80,p34:60,p56:40,p78:20,p910:10,p1112:5,p1318:0},
 summer:{p1:120,p2:100,p34:80,p56:50,p78:30,p910:20,p1112:10,p1318:0}};
const gameYear=s=>2025+(s.season||1); // 赛季序号=年份偏移：season1 = 2026年
const splitLabel=s=>gameYear(s)+' '+(SPLIT_NAME[s.split]||'春季赛');
function leaguePayout(s,place){
 const map={'冠军':5000,'亚军':3000,'四强':1500,'八强':800};
 const amt=map[place];
 if(amt){s.fund+=amt;logEvent(s,' 联盟分润（'+place+'）：'+amt+'万');}
}
function logLevel(txt){
 if(/冠军|王朝|夺得总冠军/.test(txt))return 'gold';
 if(/惜败|败|负|拖欠工资|淘汰|无缘/.test(txt))return 'lose';
 if(/胜|击败|获胜|晋级|卡位/.test(txt))return 'win';
 if(/赞助|奖金|分润|收入|涨薪|代言|曝光|返还|找回/.test(txt))return 'gold';
 return 'info';
}
function logEvent(s,txt){s.eventLog.unshift({txt,t:Date.now(),level:logLevel(txt)});s.eventLog=s.eventLog.slice(0,120);}
function shuffle(arr){for(let i=arr.length-1;i>0;i--){const j=rnd(0,i);[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}
function powerOf(s,name){
 if(name===s.teamName)return teamPower(s);
 ensureAiRosters(s,name); // 懒建真实阵容并写入 aiPower（与玩家同刻度）
 return s.aiPower[name]||450;
}
function phaseGroups(s){
 if(s.phase==='r1')return ['G1','G2','G3'];
 if(s.phase==='r2')return ['S','A','B'];
 if(s.phase==='r3')return ['S','A'];
 return [];
}
function myGroup(s){
 for(const g of phaseGroups(s)){if(s.groups[g]&&s.groups[g].includes(s.teamName))return g;}
 return null;
}
function sortGroup(s,g){
 const table=s.tables[g]||{};
 return (s.groups[g]||[]).slice().sort((a,b)=>{
 const ta=table[a]||{pts:0,pw:0},tb=table[b]||{pts:0,pw:0};
 if(ta.pts!==tb.pts)return tb.pts-ta.pts;
 return tb.pw-ta.pw;
 });
}
/* 初始化分组：玩家新队进 G3（第一轮抽签组），其余按战力蛇形分 G1/G2/G3 */
function initGroups(s){
 // 玩家执教的俱乐部从 AI 池移除（如选 AG 则 AI 中没有 AG）
 let aiList=AI_TEAMS.filter(t=>t.name!==s.teamName);
 // 自建队不在 AI 名单中：自动顶替最弱队席位（KPL 18 队固定）
 if(aiList.length>17)aiList=aiList.filter(t=>t.name!=='常山UUG');
 // 分组按真实阵容战力（与玩家 teamPower 同刻度），豪门进 G1、弱旅进 G3
 const all=aiList.map(t=>{
 const r=ensureAiRosters(s,t.name);
 return {name:t.name,power:r.length?aiRosterPower(r,s,t.name):t.power};
 });
 all.push({name:s.teamName,power:s.seedPower||teamPower(s)}); // 玩家种子=开局真实战力
 all.sort((a,b)=>b.power-a.power);
 s.leagueTeams=all.map(x=>x.name); // 联盟 18 队注册名录（联盟页/榜单用）
 const g1=all.slice(0,6).map(x=>x.name);
 const g2=all.slice(6,12).map(x=>x.name);
 const g3=all.slice(12,18).map(x=>x.name);
 s.groups={G1:g1,G2:g2,G3:g3};
 s.phase='r1';
 s.aiPower={};
 aiList.forEach(t=>{
 const r=s.aiRosters[t.name];
 s.aiPower[t.name]=r&&r.length?aiRosterPower(r,s,t.name):t.power;
 });
 initTables(s);
 genRoundSchedule(s);
 s.card=null;s.playoff=null;s.eliminated=[];
}
function initTables(s){
 s.tables={};
 phaseGroups(s).forEach(g=>{
 s.tables[g]={};
 s.groups[g].forEach(n=>{s.tables[g][n]={w:0,l:0,pts:0,pw:0};});
 });
}
/* 生成玩家所在组单循环赛程（5场） */
function genRoundSchedule(s){
 const g=myGroup(s);
 const opps=(s.groups[g]||[]).filter(n=>n!==s.teamName);
 shuffle(opps);
 s.schedule=opps.map((op,i)=>({round:i+1,opp:op,result:null,myScore:0,opScore:0}));
 s.matchIdx=0;
 buildGroupSchedule(s);
}
/* 全联盟赛程：每组单循环（6队→5轮×3场），玩家的场次留给真人打，其余由 AI 逐轮模拟 */
function buildGroupSchedule(s){
 s.aiSchedule={};
 phaseGroups(s).forEach(g=>{
 const teams=(s.groups[g]||[]).slice();
 // 舍转法：固定首队，其余轮转，生成 5 轮 × 3 场
 const n=teams.length,rounds=[];
 const arr=teams.slice(1);
 for(let r=0;r<n-1;r++){
 const pairs=[];
 const ring=[teams[0],...arr];
 for(let i=0;i<n/2;i++){
 const a=ring[i],b=ring[n-1-i];
 if(a&&b)pairs.push([a,b]);
 }
 rounds.push(pairs);
 arr.unshift(arr.pop());
 }
 s.aiSchedule[g]=[];
 rounds.forEach((pairs,ri)=>{
 pairs.forEach(([a,b])=>{
 if(a===s.teamName||b===s.teamName)return; // 玩家场次不模拟
 s.aiSchedule[g].push({round:ri+1,a,b,r:null});
 });
 });
 });
}
/* 模拟玩家已打到的轮次为止、所有组内尚未进行的 AI 场次，并更新积分表 */
function simulateAiRound(s,upToRound){
 if(!s.aiSchedule||!phaseGroups(s).some(g=>s.aiSchedule[g]))buildGroupSchedule(s); // 老存档懒构建
 const reports=[];
 phaseGroups(s).forEach(g=>{
 (s.aiSchedule[g]||[]).forEach(m=>{
 if(m.round>upToRound||m.r)return;
 const r=simSeriesResult(s,m.a,m.b,KPL.BO5);
 m.r={w:r.win?m.a:m.b,mw:r.mw,ow:r.ow};
 const ta=(s.tables[g]||{})[m.a],tb=(s.tables[g]||{})[m.b];
 if(!ta||!tb)return;
 if(r.win){ta.w++;ta.pts++;tb.l++;}
 else{tb.w++;tb.pts++;ta.l++;}
 ta.pw+=r.mw;tb.pw+=r.ow;
 if(m.round===upToRound)reports.push(g+'组：'+m.a+' '+r.mw+':'+r.ow+' '+m.b);
 });
 });
 if(reports.length)logEvent(s,' 联赛战报（第'+upToRound+'轮）：'+reports.slice(0,6).join('；'));
}
/* AI 系列赛（BO5/BO7 模拟，返回局数） */
function simSeriesResult(s,a,b,bo){
 let mw=0,ow=0;
 const need=Math.ceil(bo/2);
 const aEff=powerOf(s,a)*(1+dynastyStreak(s,b)*0.02); // 王朝反制①：对方连冠 → 我方研究加成
 const bEff=powerOf(s,b)*(1+dynastyStreak(s,a)*0.02);
 for(let i=1;i<=bo&&mw<need&&ow<need;i++){
 const w=Math.random()<winChance(aEff,bEff);
 if(w)mw++;else ow++;
 }
 return {win:mw>ow,mw,ow};
}
/* ===== 阶段推进 ===== */
function advancePhase(s){
 simulateAiRound(s,99); // 兜底补完本阶段未模拟的 AI 场次
 if(s.phase==='r1'){
 const sTeams=[],aTeams=[],bTeams=[];
 ['G1','G2','G3'].forEach(grp=>{
 const rank=sortGroup(s,grp);
 sTeams.push(rank[0],rank[1]);
 aTeams.push(rank[2],rank[3]);
 bTeams.push(rank[4],rank[5]);
 });
 s.groups={S:sTeams,A:aTeams,B:bTeams};
 s.phase='r2';
 initTables(s);
 genRoundSchedule(s);
 const g=myGroup(s);
 logEvent(s,' 第一轮结束！'+s.teamName+' 进入'+(g==='S'?'S组':g==='A'?'A组':'B组')+'（第二轮）');
 }else if(s.phase==='r2'){
 s.phase='card';
 setupCard(s);
 }else if(s.phase==='r3'){
 buildPlayoff(s);
 }
 save();renderAll();
}
/* ===== 卡位赛（BO7 含巅峰对决） ===== */
function setupCard(s){
 const sRank=sortGroup(s,'S'),aRank=sortGroup(s,'A'),bRank=sortGroup(s,'B');
 s.card={matches:[
 {a:sRank[4],b:aRank[1],r:null,winTo:'S'}, // S5 vs A2
 {a:sRank[5],b:aRank[0],r:null,winTo:'S'}, // S6 vs A1
 {a:aRank[4],b:bRank[1],r:null,winTo:'A'}, // A5 vs B2
 {a:aRank[5],b:bRank[0],r:null,winTo:'A'}, // A6 vs B1
 ],idx:0};
 s.eliminated=[...(s.eliminated||[]),...bRank.slice(2)]; // B3-B6 淘汰
 const myR=bRank.indexOf(s.teamName);
 if(myGroup(s)==='B'&&myR>=2){
 s.phase='eliminated';
 logEvent(s,' 第二轮 B 组排名 3-6，无缘本赛季后续比赛');
 // 联盟照常打完本赛季：补完卡位赛与季后赛，产生冠军（王朝统计/连冠反制需要）
 s.card.matches.forEach(m=>{if(!m.r){const r=simSeriesResult(s,m.a,m.b,KPL.BO7);m.r=r.win?m.a:m.b;}});
 s.card.idx=s.card.matches.length;
 finishCard(s);
 save();renderAll();
 return;
 }
 const playerIn=s.card.matches.some(m=>m.a===s.teamName||m.b===s.teamName);
 logEvent(s,' 卡位赛（BO7·含巅峰对决）即将开始！');
 if(!playerIn){
 s.card.matches.forEach(m=>{const r=simSeriesResult(s,m.a,m.b,KPL.BO7);m.r=r.win?m.a:m.b;});
 s.card.idx=s.card.matches.length;
 finishCard(s);
 return;
 }
 save();renderAll();
}
function playCardNext(s){
 const m=s.card.matches[s.card.idx];
 if(!m){finishCard(s);return;}
 if(m.a===s.teamName||m.b===s.teamName){
 const opName=m.a===s.teamName?m.b:m.a;
 // 系列赛中断恢复：不重置比分
 if(s.series&&s.series.stage==='card'){
 showPreMatch('卡位赛（BO7·含巅峰对决）vs '+opName+' · 第'+(s.series.mw+s.series.ow+1)+'局（'+s.series.mw+':'+s.series.ow+'）');
 return;
 }
 s.series={used:[],usedOpp:[],mw:0,ow:0,max:7,stage:'card',cardMatch:m,logs:[],myName:m.a===s.teamName?m.a:m.b,opName,side:firstSide(s,'card',opName)};s.seriesAuto=false;
 resetOppEnergy(s,opName);
 showPreMatch('卡位赛（BO7·含巅峰对决）vs '+opName+' · 第1局');
 }else{
 const r=simSeriesResult(s,m.a,m.b,KPL.BO7);
 m.r=r.win?m.a:m.b;
 logEvent(s,' 卡位赛：'+m.a+' vs '+m.b+'，'+m.r+' 晋级');
 s.card.idx++;
 save();renderAll();
 playCardNext(s);
 }
}
function finishCard(s){
 const sRank=sortGroup(s,'S'),aRank=sortGroup(s,'A');
 const sNew=[sRank[0],sRank[1],sRank[2],sRank[3]];
 const aNew=[aRank[2],aRank[3]];
 (s.card.matches||[]).forEach(m=>{
 if(!m.r){const r=simSeriesResult(s,m.a,m.b,KPL.BO7);m.r=r.win?m.a:m.b;}
 if(m.winTo==='S'){sNew.push(m.r);aNew.push(m.r===m.a?m.b:m.a);}
 else aNew.push(m.r);
 });
 s.cardLosers=(s.card.matches||[]).map(m=>m.r===m.a?m.b:m.a); // 卡位赛败者：年度积分按 11-12 名档计
 s.groups={S:sNew,A:aNew};
 const alive=new Set([...sNew,...aNew]);
 s.eliminated=AI_TEAMS.map(t=>t.name).filter(n=>!alive.has(n));
 if(!alive.has(s.teamName)){
 s.phase='eliminated';
 logEvent(s,' 卡位赛未能突围，本赛季止步');
 buildPlayoff(s); // 联盟照常打完季后赛，产生本赛季冠军（王朝统计/连冠反制需要）
 save();renderAll();
 return;
 }
 s.phase='r3';
 initTables(s);
 genRoundSchedule(s);
 logEvent(s,' 卡位赛结束！'+s.teamName+' 进入第三轮'+(myGroup(s)==='S'?'S组':'A组'));
 save();renderAll();
}
/* ===== 季后赛（10队双败淘汰 BO7） ===== */
function buildPlayoff(s){
 // 旧版残留的 simulateGroupAI 调用已删：r3 的 AI 场次由 simulateAiRound 逐轮模拟 + advancePhase 兜底补完，此处重跑会重复计分（且该函数在重构时已丢失导致进季后赛必崩）
 const sRank=sortGroup(s,'S'),aRank=sortGroup(s,'A');
 if(!sRank.length){s.phase='eliminated';save();renderAll();return;}
 s.playoff={
 wb:[{a:sRank[0],b:sRank[3],r:null},{a:sRank[1],b:sRank[2],r:null}], // 胜者组R1: S1vS4,S2vS3
 lb:[{a:aRank[0],b:aRank[3],r:null},{a:aRank[1],b:aRank[2],r:null}], // 败者组R1: A1vA4,A2vA3
 lb2:[{a:sRank[4],b:null,r:null},{a:sRank[5],b:null,r:null}], // S5/S6 直进败者组R2
 lb3:[{a:null,b:null,r:null},{a:null,b:null,r:null}], // 败者组R3: 胜者组R1败者 vs 败者组R2胜者
 wf:{a:null,b:null,r:null}, // 胜者组决赛
 lb4:{a:null,b:null,r:null}, // 败者组半决赛: lb3两胜者
 lbf:{a:null,b:null,r:null}, // 败者组决赛: wf败者 vs lb4胜者
 final:{a:null,b:null,r:null},champ:null
 };
 s.phase=(s.phase==='eliminated')?s.phase:'playoff'; // 玩家已出局时保留"止步"状态
 const inPlayoff=s.groups.S.includes(s.teamName)||aRank.slice(0,4).includes(s.teamName);
 logEvent(s,' 季后赛开启！10强 BO7 双败淘汰');
 if(!inPlayoff){
 logEvent(s,' 未能晋级季后赛，本赛季止步');
 let guard=0;
 while(!s.playoff.final.r&&guard<20){playoffStep(s);guard++;}
 return;
 }
 save();renderAll();
}
function playoffStep(s){
 const p=s.playoff;
 if(!p)return;
 for(let i=0;i<2;i++){const m=p.wb[i];if(m.r===null&&m.a&&m.b){playPoMatch(s,m,'wb'+(i+1));return;}}
 for(let i=0;i<2;i++){const m=p.lb[i];if(m.r===null&&m.a&&m.b){playPoMatch(s,m,'lb'+(i+1));return;}}
 for(let i=0;i<2;i++){
 const m=p.lb2[i];
 if(m.b===null&&p.lb[i].r)m.b=p.lb[i].r;
 if(m.r===null&&m.a&&m.b){playPoMatch(s,m,'lb2_'+(i+1));return;}
 }
 if(p.wf.a===null){p.wf.a=p.wb[0].r;p.wf.b=p.wb[1].r;}
 if(p.wf.r===null&&p.wf.a&&p.wf.b){playPoMatch(s,p.wf,'胜者组决赛');return;}
 for(let i=0;i<2;i++){
 const m=p.lb3[i];
 if(m.a===null)m.a=p.wb[i].r===p.wb[i].a?p.wb[i].b:p.wb[i].a;
 if(m.b===null&&p.lb2[i].r)m.b=p.lb2[i].r;
 if(m.r===null&&m.a&&m.b){playPoMatch(s,m,'lb3_'+(i+1));return;}
 }
 if(p.lb4.a===null){p.lb4.a=p.lb3[0].r;p.lb4.b=p.lb3[1].r;}
 if(p.lb4.r===null&&p.lb4.a&&p.lb4.b){playPoMatch(s,p.lb4,'败者组半决赛');return;}
 // 败者组决赛：胜者组决赛败者 vs 败者组半决赛胜者（双败制关键）
 if(p.lbf.a===null){p.lbf.a=p.wf.r===p.wf.a?p.wf.b:p.wf.a;p.lbf.b=p.lb4.r;}
 if(p.lbf.r===null&&p.lbf.a&&p.lbf.b){playPoMatch(s,p.lbf,'败者组决赛');return;}
 if(p.final.a===null){p.final.a=p.wf.r;p.final.b=p.lbf.r;}
 if(p.final.r===null&&p.final.a&&p.final.b){playPoMatch(s,p.final,'总决赛');return;}
 if(p.final.r){
 p.champ=p.final.r;
 s.titleHistory=(s.titleHistory||[]).concat([{season:s.season,split:s.split||'spring',event:SPLIT_NAME[s.split]||'春季赛',champ:p.final.r}]).slice(-16); // 王朝统计（连冠反制用，一年两冠按时间序）
 if(s.phase!=='eliminated')s.phase='champion'; // 玩家提前出局时：补完的联盟赛季不覆盖"止步"状态
 s.champion=p.final.r===s.teamName;
 if(s.champion||p.final.a===s.teamName||p.final.b===s.teamName)recordSeason(s); // 冠军/亚军均入册荣誉室
 if(s.champion){
 // 夺冠人气暴涨：全队商业价值提升（代言收入增加）
 s.players.forEach(p=>p.popularity=Math.min(99,(p.popularity||0)+5));
 logEvent(s,' 夺冠带来巨大曝光！全队选手人气+5，代言收入提升');
 }
 leaguePayout(s,s.champion?'冠军':'亚军');
 logEvent(s,splitLabel(s)+'总冠军：'+p.final.r+'！'+(s.champion?'你就是冠军！':''));
 // ===== 年度赛历衔接：年度积分 + FMVP，等待进入下一赛段（EWC/年总） =====
 awardAnnualPts(s);
 awardFMVP(s,p.final.r,splitLabel(s));
 save();renderAll();
 }
}
function playPoMatch(s,m,slot){
 if(m.a===s.teamName||m.b===s.teamName){
 const opName=m.a===s.teamName?m.b:m.a;
 // 系列赛中断恢复：不重置比分
 if(s.series&&s.series.stage==='po'){
 showPreMatch((slot==='总决赛'?'总决赛':'季后赛')+'（BO7·含巅峰对决）vs '+opName+' · 第'+(s.series.mw+s.series.ow+1)+'局（'+s.series.mw+':'+s.series.ow+'）');
 return;
 }
 s.series={used:[],usedOpp:[],mw:0,ow:0,max:7,stage:'po',poSlot:slot,poMatch:m,logs:[],myName:m.a===s.teamName?m.a:m.b,opName,side:firstSide(s,'playoff',opName)};s.seriesAuto=false;
 resetOppEnergy(s,opName);
 showPreMatch((slot==='总决赛'?'总决赛':'季后赛')+'（BO7·含巅峰对决）vs '+opName+' · 第1局');
 return;
 }
 const r=simSeriesResult(s,m.a,m.b,KPL.BO7);
 m.r=r.win?m.a:m.b;
 logEvent(s,' 季后赛（'+slot+'）：'+m.a+' '+(r.win?'胜':'负')+' '+m.b+'，'+m.r+' 晋级');
 save();renderAll();
 playoffStep(s);
}
/* 注意：startPlayoff 定义在 match.js（带转会期拦截），此处不得重复定义，
 否则按加载顺序后者会覆盖、容易造成两处逻辑不一致 */
/* 联盟分润 leaguePayout 定义在文件头部（年度赛历常量区），此处不重复 */
/* 季后赛出局名次判定：只在真正出局的轮次返回名次（用于结算联盟分润）。
 胜者组 R1 / 胜者组决赛失利只是掉入败者组，队伍仍存活——返回 null（leaguePayout 对 null 不结算），
 否则会出现「输一场就领分润、之后真出局再领一次」的重复发放。 */
function poPlace(slot,isFinal){
 if(isFinal)return '亚军';
 if(/^wb[12]$|^wf$/.test(slot))return null;
 if(/^lb[12]$|^lb2_/.test(slot))return '八强';
 return '四强';
}
function nextDay(s){
 s.day++;s.trained=false;s.marketRefreshed=false;s.academyTrained=false;
 s.fund+=SPONSORS[s.sponsorLv].income; // 赞助商每日结算
 if(s.hosts&&s.hosts.length)s.fund+=s.hosts.reduce((t,h)=>t+h.income,0); // 退役主播人气收入
 if(s.transferWindow>0){
 s.transferWindow--;
 aiBidTick(s); // AI 队对挂牌选手报价
 if(s.transferWindow===0){
 endTransferWindow(s);
 if(s.preseason){
 s.preseason=false;
 logEvent(s,' 赛前转会期结束（天数用完），联赛正式开始！');
 }else{
 logEvent(s,' 转会窗关闭，未成交的挂牌选手自动撤牌');
 }
 }
 }
 if(s.day%WAGE_EVERY===0)payWage(s);
 s.players.forEach(p=>{p.injury=Math.max(0,p.injury-1);p.energy=clamp(p.energy+10,0,ENERGY_MAX);}); // 伤情恢复 + 体力自然回复
 tickLoans(s); // 租借倒计时：到期自动归队
 if(s.day%3===0){s.fund+=80;toast('签到奖励：赞助补贴 +80万');}
 if(Math.random()<0.65&&s.players.length){ // 名单被卖空时跳过随机事件（事件需要选手参与）
 const ev=pick(EVENTS);
 const tp=pick(rosterAll(s)); // 公告文案与效果作用同一名选手
 const txt=ev.desc.replace('{p}',()=>tp.name);
 ev.fn(s,tp);
 logEvent(s,' 【'+ev.t+'】'+txt);
 }
 save();
}
function payWage(s){
 const wage=weeklyWage(s);
 // 选手代言收入：人气 × 0.3万/周（商业价值对冲工资帽压力）
 const endorse=Math.round(s.players.reduce((t,p)=>t+((p.popularity||0)*3),0));
 s.fund-=wage;
 s.fund+=endorse;
 let tax=0;
 if(wage>s.wageCap){
 // KPL 工资帽：超帽部分缴纳 60% 奢侈税
 tax=Math.round((wage-s.wageCap)*0.6);
 s.fund-=tax;
 logEvent(s,' 周薪 '+wage+'万（工资帽 '+s.wageCap+'万，超帽缴纳奢侈税 '+tax+'万）');
 }else{
 logEvent(s,' 发放周薪 '+wage+'万（工资帽内 '+s.wageCap+'万）');
 }
 if(endorse>0)logEvent(s,' 选手代言收入 '+endorse+'万（人气变现）');
 if(s.fund<0){
 s.fund=Math.max(0,s.fund);
 s.players.forEach(p=>p.morale=clamp(p.morale-15,20,100));
 logEvent(s,' 资金不足！拖欠工资导致全员士气大降');
 }else{
 s.players.forEach(p=>p.morale=clamp(p.morale+3,20,100));
 }
}
/* ================= 王朝反制（连冠≥2 触发） =================
 现实中反制王朝的三板斧：对手研究录像（BP 吃亏）、版本针对体系、联盟财政条款。
 ①对阵连冠队伍，研究方有效战力 +2%/连冠季（上限+6%，AI 互赛同规则）
 ②连冠队伍工资帽成长减半 ③新赛季版本针对：核心选手属性/士气/状态受挫 */
function dynastyStreak(s,teamName){
 // 一年有春/夏两个冠军，按时间顺序（追加序）数连续夺冠次数
 const hist=s.titleHistory||[];
 let streak=0;
 for(let i=hist.length-1;i>=0;i--){
 if(hist[i].champ===teamName)streak++;else break;
 }
 return Math.min(streak,3);
}
/* ================= 赛季最佳阵容（一阵/二阵） =================
 按位置评选：排序分=招牌战力×状态系数（权重减半：火热可越级入选，但不虚高 20 分）；
 展示的「评分」用 OVR 总值（1-99，与全游戏刻度一致），表现另用状态标签表达；
 新赛季开启时入册 s.awards（历届），联盟页实时展示当期评选 */
function allStarScore(p){return playerPower(p,p.sig)*(1+((p.val||100)-100)/250);}
function allStarTeams(s){
 const pool=s.players.map(p=>({p,team:s.teamName}));
 (s.leagueTeams||[]).forEach(n=>{
 if(n===s.teamName)return;
 (ensureAiRosters(s,n)||[]).forEach(p=>pool.push({p,team:n}));
 });
 const t1=[],t2=[];
 POS_ORDER.forEach(pos=>{
 const two=pool.filter(x=>x.p.pos===pos).sort((a,b)=>allStarScore(b.p)-allStarScore(a.p)).slice(0,2);
 if(two[0])t1.push({p:two[0].p,team:two[0].team});
 if(two[1])t2.push({p:two[1].p,team:two[1].team});
 });
 return {t1,t2};
}
/* 赛季收官：最佳阵容入册 + 公告（newSeason 顶部调用，用刚结束赛季的阵容快照） */
function recordSeasonAwards(s){
 s.awards=s.awards||[];
 if(s.awards.some(a=>a.season===s.season))return;
 const {t1,t2}=allStarTeams(s);
 s.awards.unshift({season:s.season,
 first:t1.map(x=>({pos:x.p.pos,name:x.p.name,team:x.team,ovr:overall(x.p)})),
 second:t2.map(x=>({pos:x.p.pos,name:x.p.name,team:x.team,ovr:overall(x.p)}))});
 s.awards=s.awards.slice(0,10);
 logEvent(s,' KPL 赛季最佳阵容揭晓：一阵——'+t1.map(x=>POS[x.p.pos][1]+' '+x.p.name+'（'+x.team+'）').join('、'));
 logEvent(s,' 二阵——'+t2.map(x=>POS[x.p.pos][1]+' '+x.p.name+'（'+x.team+'）').join('、'));
}
function newSeason(s){
 /* 年度轮换（仅在年度总决赛结束后调用）：年龄/合同/退役/工资帽结算 + 开启新赛季春季赛。
 夏季赛不经过此函数（年中不做年龄与合同结算），由 startSplit 直接开启。 */
 recordSeasonAwards(s); // 上赛季最佳阵容入册（趁阵容还没跨季老化）
 s.season++;s.day=1;s.trained=false;s.marketRefreshed=false;
 s.pick={}; // 清掉上赛季末的英雄选择残留（BP 确认后才会重新写入）
 s.academyTrained=false;
 // 亚运会状态归零：仅当届有效（防 agDone 跨年残留导致下一届亚运年不触发）
 s.agDone=false;s.ag=null;s.natSquad=null;s.natCampIds=[];s.natAnnounced=false;
 s.players.forEach(p=>{p.natCamp=false;p.natFill=false;});
 // 年龄增长：黄金期属性成长，下滑期按位置衰减，达到位置退役年龄离队
 const retired=[];
 s.players.forEach(p=>{
 p.age=(p.age||0)+1;
 const m=AGE_MODEL[p.pos]||AGE_MODEL.mid;
 const key=pick(['lane','farm','team','mind']);
 if(p.age<=m.gold){
 // 黄金期（19-22 反应手速巅峰）：随机属性+1
 p.attrs[key]=clamp(p.attrs[key]+1,55,99);
 }else if(p.age<m.retire){
 // 下滑期：按位置衰减（野射下滑快，辅助缓）
 p.attrs[key]=clamp(p.attrs[key]-rnd(1,m.decay),40,99);
 }
 if(p.age>=m.retire)retired.push(p);
 else p.retiring=p.age>=m.retire-1;
 p.energy=ENERGY_MAX;p.morale=clamp(p.morale+15,20,100);p.injury=0;
 if(!p.loan)p.contract=(p.contract||2)-1; // 合同年限递减（租借选手不参与续约）
 });
 // 合同到期名单：转会期需玩家处理续约/放走
 s.expiring=(s.players||[]).filter(p=>!p.loan&&(p.contract||0)<=0).map(p=>p.id);
 if(s.expiring.length)logEvent(s,' '+s.expiring.length+' 名选手合同到期，转会期内需处理续约（不处理将自动续约 1 年）');
 // 赛季结算：表现溢价回归 + 黄金期后年龄贬值 + 续约涨薪（堵"身价只涨不跌"的无风险套利）
 s.players.forEach(p=>{
 const m=AGE_MODEL[p.pos]||AGE_MODEL.mid;
 p.val=clamp(Math.round((p.val||100)*0.7+30),70,150); // 表现溢价逐年回归：不持续打出表现就跌回（||100：未上过场的替补没有 val，避免算出 NaN）
 if(p.age>m.gold)p.val=clamp(p.val-(p.age-m.gold)*4,70,150); // 过黄金期：身价随年龄贬值
 if(p.age>=m.retire-1)p.val=clamp(p.val-8,70,150); // 临近退役：额外折价
 if(p.val>=120){ // 巅峰表现 → 续约涨薪（工资帽压力随成绩增长）
 const nw=Math.min(Math.round(p.wage*1.15)+1,Math.round(wageOf(overall(p))*1.5));
 if(nw>p.wage){p.wage=nw;logEvent(s,' 赛季结算：'+p.name+' 续约涨薪至 '+nw+'万/周');}
 }
 });
 // 青训新秀同步长一岁：满 18 岁才有晋升一线队资格（KPL 注册规则）；每年自然成长（潜力越高长得越快）
 (s.academy||[]).forEach(r=>{
 r.age=(r.age||16)+1;
 const bonus=r.potential>=4?2:1;
 const keys=['lane','farm','team','mind'];
 for(let i=0;i<2;i++){
 const k=keys.splice(Math.floor(Math.random()*keys.length),1)[0];
 r.attrs[k]=clamp(r.attrs[k]+bonus,40,95);
 }
 });
 retired.forEach(p=>{
 s.players=s.players.filter(x=>x.id!==p.id);
 const li=s.lineup.indexOf(p.id);
 if(li>=0){s.lineup.splice(li,1);if(s.pick)delete s.pick[p.pos];}
 // 退役去向：转教练（按实力给战力加成）或 转型主播（俱乐部人气收入）
 retireToCoach(s,p);
 });
 s.fund+=1300;
 // 王朝反制②：连冠队伍工资帽成长减半（保住豪华阵容越来越难）
 const st=dynastyStreak(s,s.teamName);
 s.wageCap=(s.wageCap||90)+(st>=2?7:15); // KPL 联盟每赛季调整工资帽
 // 王朝反制③：版本针对——力度随连冠次数加码
 if(st>=2){
 logEvent(s,' 联盟公平条款：'+s.teamName+' 已'+st+'连冠，新赛季工资帽成长减半（+'+(st>=2?7:15)+'万）');
 const core=s.players.slice().sort((a,b)=>overall(b)-overall(a))[0];
 if(core){
 const key=pick(['lane','farm','team','mind']);
 core.attrs[key]=clamp(core.attrs[key]-st,40,99);
 core.morale=clamp(core.morale-5*st,20,100);
 core.val=clamp((core.val||100)-10,70,150);
 logEvent(s,' 版本针对：全联盟都在研究你——新版本削弱了核心 '+core.name+' 的招牌体系（属性-'+st+' · 士气-'+5*st+'%点 · 状态-10%）');
 }
 }
 // 租借选手：新赛季开始前一律归队（租借不跨赛季）
 (s.players||[]).filter(p=>p.loan).forEach(p=>{
 aiAttachDef(s,p.id,p.loan.from);
 logEvent(s,' 租借到期：'+p.name+' 返回 '+(p.loan.from||'原队')+'（新赛季阵容注册）');
 });
 if((s.players||[]).some(p=>p.loan)){
 s.players=s.players.filter(p=>!p.loan);
 s.lineup=s.lineup.filter(id=>s.players.some(p=>p.id===id));
 s.aiRosters={};
 }
 s.fund+=1300;
 logEvent(s,' 联盟调整工资帽：本周薪上限 '+s.wageCap+'万');
 s.annualPts={}; // 新一年：年度积分清零（春夏重新累计）
 startSplit(s,'spring');
}
/* 开启一个联赛赛段（春季/夏季）：转会期 + 分组 + 赛程。
 年龄/合同/退役/工资帽结算只在年度轮换（newSeason）做，夏季赛年中直开（不老化）。 */
function startSplit(s,split){
 s.split=split;s.streak=0;s.stage='regular';
 if(split==='summer')s.fund+=800; // 夏季赛启动金（春季 130 万在年度轮换时发放）
 s.transferWindow=7;s.preseason=true; // 赛前转会期 7 天：自由组队，结束/到期后联赛才开打
 s.pick={};
 aiTransferWindow(s); // AI 转会期：退役结算/缺位补强/明星流转/新星出道/换帅（联盟生态推进）
 buildTransferMarket(s); // 构建转会市场（AI 队选手 + 非卖品）
 s.aiRosters={}; // 对手阵容重建
 s.aiInj={}; // 伤停清零
 initGroups(s);
 if(split==='summer'&&isAsiadYear(s)&&!s.natAnnounced)announceNatCamp(s); // 亚运年夏季：先宣布国家队征召（集训缺席整季）
 logEvent(s,' '+splitLabel(s)+' 赛前转会期开启（7天）：可买断/挂牌/直签选手与教练，市场刷新免费；结束转会期后联赛开打');
 logEvent(s,' '+splitLabel(s)+' 开始！18队 S/A/B 赛制，目标：'+SPLIT_NAME[split]+'总冠军（年度积分 +'+ANNUAL_PTS[split].p1+'）！');
 save();renderAll();
}
/* ================= 亚运会·国家队征召（亚运年夏季赛前宣布） =================
 真实逻辑：名单在夏赛开打前公布，入选选手整个夏季赛在国家队集训/出征，缺席俱乐部比赛。
 俱乐部损失核心战力，但可用替补/转会/青训顶位；亚运结束后选手归队并带回奖牌加成。 */
function natCamping(s,p){return !!(p&&p.natCamp&&!s.agDone&&s.split==='summer');}
function announceNatCamp(s){
 s.natAnnounced=true;
 const squad=agSelectSquad(s); // 全联盟各位置总值最高（实时阵容）
 const owned=new Set(s.players.map(p=>p.id));
 const mine=squad.filter(p=>owned.has(p.id));
 s.natSquad=squad.map(p=>({name:p.name,pos:p.pos,mine:owned.has(p.id),ovr:overall(p)}));
 s.natCampIds=mine.map(p=>p.id);
 mine.forEach(p=>{p.natCamp=true;});
 autoFillLineup(s); // 集训选手立刻换下首发（缺位由替补/借调顶上）
 if(mine.length){
 const names=mine.map(p=>p.name+'（'+POS[p.pos][0]+'）').join('、');
 logEvent(s,' 国家队征召：'+names+' 入选中国代表队！夏赛期间集训+出征名古屋亚运会，缺席俱乐部整个夏季赛（可买替补/提拔青训顶位）');
 }else{
 logEvent(s,' '+gameYear(s)+' 亚运年：中国代表队集结完毕（本队无选手入选，不受影响）');
 }
}
function promoteNatFill(s,pos){
 if(typeof genAcademyDef!=='function'||typeof genSeasonPlayer!=='function')return null;
 const used=new Set();
 s.players.forEach(p=>used.add(p.name));
 (s.academy||[]).forEach(r=>used.add(r.name));
 const def=genAcademyDef(pos,used,s.season);
 const p=genSeasonPlayer(s,def);
 p.natFill=true;p.natCamp=false;p.contract=1;
 s.players.push(p);
 return p;
}

/* ================= 年度积分结算（官方名次档） =================
 春：冠军100/亚80/3-4名60/5-6名40/7-8名20/9-10名10/11-12名5；夏：120/100/80/50/30/20/10。
 名次按季后赛出局轮次换算：总决赛败者=亚军；败者组决赛/半决赛败者=四强；
 败者组第三轮败者=5-6名；第二轮败者=7-8名；首轮败者=9-10名；未进季后赛按组内名次归档。 */
function leaguePlacements(s){
 const place={};
 const p=s.playoff;
 if(!p||!p.final.r)return place;
 const loserOf=m=>m.r===m.a?m.b:m.a;
 place[p.final.r]='p1';place[loserOf(p.final)]='p2';
 place[loserOf(p.lbf)]='p34';place[loserOf(p.lb4)]='p34';
 [p.lb3[0],p.lb3[1]].forEach(m=>place[loserOf(m)]='p56');
 [p.lb2[0],p.lb2[1]].forEach(m=>place[loserOf(m)]='p78');
 [p.lb[0],p.lb[1]].forEach(m=>place[loserOf(m)]='p910');
 (s.groups.A||[]).slice(4).forEach(n=>place[n]='p1112'); // 第三轮 A组第5/6名
 (s.cardLosers||[]).forEach(n=>place[n]='p1112'); // 卡位赛败者
 (s.eliminated||[]).forEach(n=>{if(!place[n])place[n]='p1318';}); // B组3-6名
 return place;
}
function awardAnnualPts(s){
 const pts=ANNUAL_PTS[s.split]||ANNUAL_PTS.spring;
 const place=leaguePlacements(s);
 Object.keys(place).forEach(t=>{s.annualPts[t]=(s.annualPts[t]||0)+(pts[place[t]]||0);});
 logEvent(s,' 年度积分入账：'+s.teamName+' 目前累计 '+(s.annualPts[s.teamName]||0)+' 分（'+(s.split==='spring'?'春':'夏')+'季赛·前12进年总）');
}
/* ===== FMVP：冠军队总决赛最有价值选手（人气+10 · 身价+8，记入荣誉室） ===== */
function awardFMVP(s,champ,event){
 try{
 s.fmvpHonor=s.fmvpHonor||[];
 let winner=null;
 if(champ===s.teamName){
 const cnt={};(s._lastMvps||[]).forEach(id=>cnt[id]=(cnt[id]||0)+1); // 总决赛各局 MVP 票数优先
 winner=s.players.slice().sort((a,b)=>(cnt[b.id]||0)-(cnt[a.id]||0)||overall(b)-overall(a))[0];
 }else{
 const r=ensureAiRosters(s,champ)||[];
 winner=r.slice().sort((a,b)=>overall(b)-overall(a))[0];
 }
 if(!winner)return;
 s.fmvpHonor.unshift({year:gameYear(s),event,name:winner.name,team:champ});
 s.fmvpHonor=s.fmvpHonor.slice(0,12);
 if(champ===s.teamName){
 winner.popularity=Math.min(99,(winner.popularity||0)+10);
 winner.val=clamp((winner.val||100)+8,70,150);
 logEvent(s,' FMVP：'+winner.name+' 当选 '+event+' 总决赛最有价值选手——FMVP 专属皮肤安排！（人气+10 · 身价+8）');
 }else logEvent(s,' FMVP：'+champ+' 的 '+winner.name+' 当选 '+event+' 总决赛最有价值选手');
 }catch(e){}
}
/* ===== 年度赛历推进（赛季结束按钮统一入口）：春→EWC→夏→年总→下一年 ===== */
function calendarNextLabel(s){
 if(s.split==='spring')return ' 前往挑战者杯（32队 · KPL全员）';
 if(isAsiadYear(s)&&!s.agDone)return ' 出征亚运会（中国代表队征召）';
 return annualRank(s).slice(0,12).includes(s.teamName)?' 前往 KPL 年度总决赛':' 年度收官 · 开启新赛季';
}
function advanceCalendar(s){
 if(s.split==='spring'){setupChallenger(s);return;} // 春 → 挑战者杯 → EWC → 夏 → 年总
 if(isAsiadYear(s)&&!s.agDone){setupAsianGames(s);return;} // 亚运年：夏 → 亚运会 → 年总
 setupAnnual(s); // 内部判定是否晋级（未晋级自动补完 AI 赛程并年度轮换）
}
/* ================= 挑战者杯（2026 KPL 春季赛后最高关注度杯赛） =================
 真实赛制简化建模：32 队（18 KPL 全员 + 14 挑战者：K甲/全国大赛/青训/高校/职工/主播/全球七大赛道）
 → 单败淘汰 32→16（BO5）→16→8（BO7），春季赛冠军/亚军为一二号种子分半区
 → 8 强双败淘汰（BO7）→ 决赛 BO9（第9局巅峰对决）
 「挑战者的祝福」：低赛道队伍 vs KPL 时战力 +5%（ensureAiRosters 统一结算，玩家对局同样生效）
 年总积分：冠军85 / 亚军60 / 第3名40 / 第4名20 / 5-6名10；冠军 300 万奖金 + FMVP。 */
const CHALLENGER_TEAMS=[['K甲·苍穹','K甲'],['K甲·星火','K甲'],['K甲·沧澜','K甲'],
 ['全国大赛·破晓','全国大赛'],['青训·晨曦','青训'],['高校·逐梦','高校'],['职工·匠心','职工'],
 ['主播·不夜城','主播'],['主播·山海','主播'],['主播·云隐','主播'],['主播·听风','主播'],
 ['全球·NOVA Esports','全球'],['全球·Gen.G Esports','全球'],['全球·Twisted Minds','全球']];
const CHALLENGER_NAMES=['梓墨','暖阳','清融','一诺','无畏','飞牛','百兽','小胖','九尾','梦岚','小义','今屿','星痕','向鱼','妖刀','帆帆','阿豆','坦然','花海','易峥','子阳','柠栀','江城','星宇','小落','奕星','凌云','破军','惊鸿','破晓','远航','守望','砺锋','青锋','北辰','南屿','苍穹','逐梦','晨曦','听风','云起'];
function genChallengerDef(s,i,teamName,band){
 const used=new Set();
 (s.extraDefs||[]).forEach(d=>used.add(d.name));
 Object.values(s.aiRosterDefs||{}).forEach(arr=>arr.forEach(id=>{const d=defOf(s,id);if(d)used.add(d.name);}));
 (s.players||[]).forEach(p=>used.add(p.name));
 let name=CHALLENGER_NAMES[i%CHALLENGER_NAMES.length];
 if(used.has(name))name='挑战者'+(i+1);
 used.add(name);
 const pos=POS_ORDER[i%5];
 // 赛道强度：K甲≈75 / 全球≈78 / 主播≈68 / 次级（全国/青训/高校/职工）≈65
 const baseLv=band==='K甲'?75:band==='全球'?78:band==='主播'?68:65;
 const b=v=>clamp(v+rnd(-5,5),55,86);
 return {id:'ch'+gameYear(s)+'_'+i,name,pos,team:teamName,tags:['特权'],
 base:[b(baseLv),b(baseLv-1),b(baseLv),b(baseLv-1)],
 skill:{n:'挑战者祝福',t:pick(['lane','farm','team','mind']),d:'低赛道挑战 KPL 时的体系优势'},
 sig:pick(HEROES.filter(h=>h.pos[0]===pos)).n,career:'挑战者杯'+band+'赛道选手，'+(band==='K甲'?'K甲职业队':'来自'+band+'赛道')+'。'};
}
function setupChallenger(s){
 const p=s.playoff;
 const champ=p.final.r,runner=p.final.r===p.final.a?p.final.b:p.final.a;
 // 挑战者队选手 def（挂 s.challDefMap；ensureAiRosters 兜底，BP/体力/战力全流程可用）
 s.challDefMap={};
 let ni=0;
 CHALLENGER_TEAMS.forEach(([tn,band])=>{
 const ids=[];
 for(let k=0;k<5;k++){const def=genChallengerDef(s,ni++,tn,band);(s.extraDefs=s.extraDefs||[]).push(def);ids.push(def.id);}
 s.challDefMap[tn]=ids;
 });
 // 32 队：18 KPL（当前联盟 18 队名录，含玩家）+ 14 挑战者；春冠/春亚为一二号种子，分列左右半区（32→16 不提前相遇）
 const league18=(s.leagueTeams&&s.leagueTeams.length)?s.leagueTeams.slice():AI_TEAMS.map(t=>t.name);
 const chPool=CHALLENGER_TEAMS.map(x=>x[0]);
 const rest=shuffle([...league18,...chPool].filter(t=>t!==champ&&t!==runner)); // 30 队（玩家=春冠时不重复计入）
 const teams=[champ,...rest.slice(0,15),runner,...rest.slice(15)]; // 32 队，种子分列 idx0/idx16 两个半区
 s.challenger={stage:'single',r1:[],r2:null,po:null,final:null,champ:null,teams};
 for(let i=0;i<16;i++)s.challenger.r1.push({a:teams[i],b:teams[31-i],r:null}); // 单败首轮 BO5
 s.phase='challenger';
 logEvent(s,' '+gameYear(s)+' 挑战者杯开幕（32队·八大赛道）！'+champ+'（1号种子）与 '+runner+'（2号种子）分列两半区');
 const myIn=teams.includes(s.teamName);
 if(!myIn){simCup('challenger',s);finishChallenger(s);return;}
 save();renderAll();
}
function challengerStep(s){
 const c=s.challenger;if(!c)return;
 const P=(m,slot,label,bo)=>playCupMatch(s,m,slot,label,bo);
 if(c.stage==='single'){
 for(let i=0;i<16;i++){const m=c.r1[i];if(!m.r){P(m,'ch_r1_'+(i+1),'挑战者杯·32强',KPL.BO5);return;}}
 if(!c.r2){c.r2=[];for(let i=0;i<8;i++)c.r2.push({a:c.r1[i*2].r,b:c.r1[i*2+1].r,r:null});}
 for(let i=0;i<8;i++){const m=c.r2[i];if(!m.r){P(m,'ch_r2_'+(i+1),'挑战者杯·16强',KPL.BO7);return;}}
 c.stage='po';
 c.po=buildCup8(shuffle(c.r2.map(m=>m.r)));
 logEvent(s,' 挑战者杯 8 强双败开启（BO7）：'+c.r2.map(m=>m.r).join('、'));
 save();renderAll();
 return;
 }
 challengerPoStep(s);
}
function challengerPoStep(s){
 const c=s.challenger;const p=c.po;if(!p)return;
 const loserOf=m=>m.r===m.a?m.b:m.a;
 const P=(m,slot,label,bo)=>playCupMatch(s,m,slot,label,bo);
 for(let i=0;i<4;i++)if(!p.wb1[i].r){P(p.wb1[i],'chpo_wb1_'+(i+1),'挑杯·胜者组首轮',KPL.BO7);return;}
 for(let i=0;i<2;i++){const m=p.lb1[i];if(m.a===null)m.a=loserOf(p.wb1[i*2]);if(m.b===null)m.b=loserOf(p.wb1[i*2+1]);if(!m.r){P(m,'chpo_lb1_'+(i+1),'挑杯·败者组首轮',KPL.BO7);return;}}
 for(let i=0;i<2;i++){const m=p.wb2[i];if(m.a===null)m.a=p.wb1[i*2].r;if(m.b===null)m.b=p.wb1[i*2+1].r;if(!m.r){P(m,'chpo_wb2_'+(i+1),'挑杯·胜者组半决赛',KPL.BO7);return;}}
 for(let i=0;i<2;i++){const m=p.lb2[i];if(m.a===null)m.a=p.lb1[i].r;if(m.b===null)m.b=loserOf(p.wb2[i]);if(!m.r){P(m,'chpo_lb2_'+(i+1),'挑杯·败者组第二轮',KPL.BO7);return;}}
 if(p.wf.a===null){p.wf.a=p.wb2[0].r;p.wf.b=p.wb2[1].r;}
 if(!p.wf.r){P(p.wf,'chpo_wf','挑杯·胜者组决赛',KPL.BO7);return;}
 if(p.lbs.a===null){p.lbs.a=p.lb2[0].r;p.lbs.b=p.lb2[1].r;}
 if(!p.lbs.r){P(p.lbs,'chpo_lbs','挑杯·败者组半决赛',KPL.BO7);return;}
 if(p.lbf.a===null){p.lbf.a=loserOf(p.wf);p.lbf.b=p.lbs.r;}
 if(!p.lbf.r){P(p.lbf,'chpo_lbf','挑杯·败者组决赛',KPL.BO7);return;}
 // 决赛 BO9（第9局巅峰对决）
 if(!c.final)c.final={a:null,b:null,r:null};
 if(c.final.a===null)c.final.a=p.wf.r;
 if(c.final.b===null)c.final.b=p.lbf.r;
 if(!c.final.r){P(c.final,'ch_final','挑战者杯·总决赛',9);return;}
 finishChallenger(s);
}
function finishChallenger(s){
 const c=s.challenger;if(!c||!c.final||!c.final.r||c.champ)return; // c.champ 防双入口重复结算
 c.champ=c.final.r;
 const loserOf=m=>m.r===m.a?m.b:m.a;
 const runner=loserOf(c.final);
 s.titleHistory=(s.titleHistory||[]).concat([{season:s.season,split:s.split,event:'挑战者杯',champ:c.champ}]).slice(-16);
 logEvent(s,' 挑战者杯落幕：'+c.champ+' 问鼎！（BO9 巅峰对决）'+(c.champ===s.teamName?'挑战者，皆王者！':''));
 // 年总积分：冠军85 / 亚军60 / 第3名40 / 第4名20 / 5-6名10
 const pts={};pts[c.champ]=85;pts[runner]=60;
 if(c.po.lbf.r)pts[loserOf(c.po.lbf)]=40;
 if(c.po.lbs.r)pts[loserOf(c.po.lbs)]=20;
 Object.keys(pts).forEach(t=>{s.annualPts[t]=(s.annualPts[t]||0)+(pts[t]||0);});
 logEvent(s,' 挑战者杯积分入账：'+s.teamName+' 年总积分累计 '+(s.annualPts[s.teamName]||0)+' 分');
 // 奖金（总池 1000 万）：冠军300 / 亚军150 / 四强80 / 8强40（游戏内×10 同经济刻度）
 let prize=0;
 if(c.champ===s.teamName)prize=3000;
 else if(runner===s.teamName)prize=1500;
 else if(c.po.lbf.r&&loserOf(c.po.lbf)===s.teamName)prize=800;
 else if(c.po.lbs.r&&loserOf(c.po.lbs)===s.teamName)prize=400;
 else if((c.po.lb2||[]).some(m=>m.r&&loserOf(m)===s.teamName)||(c.po.lb1||[]).some(m=>m.r&&loserOf(m)===s.teamName))prize=400;
 if(prize){s.fund+=prize;logEvent(s,' 挑战者杯奖金：+'+prize+'万');}
 if(c.champ===s.teamName||runner===s.teamName){
 s.honors=s.honors||[];
 s.honors.push({season:s.season,title:gameYear(s)+' 挑战者杯 '+(c.champ===s.teamName?'冠军':'亚军'),champion:c.champ===s.teamName,roster:titleRoster(s)});
 s.honors=s.honors.slice(-20);
 }
 awardFMVP(s,c.champ,gameYear(s)+' 挑战者杯');
 setupEWC(s); // 挑杯收官 → EWC 电竞世界杯（夏季休赛）
}
/* ================= EWC 电竞世界杯（年中国际杯赛） =================
 真实赛制简化建模：春季赛冠军（KPL直邀）+ 亚军（英雄亚冠ACL直邀）+ 6 支海外强队
 → 8 强 BO7 单败淘汰（小组赛/突围赛合并简化）。冠军奖金 540 万（75万美元），另评 FMVP。 */
const EWC_OVERSEAS=['NOVA Esports','Blacklist International','Twisted Minds','Alpha7 Esports','Team Vitality','Gen.G Esports','Nongshim RedForce','PAWS Gaming','BOOM Esports','KAGENDRA'];
const EWC_NAMES=['Niap','Dani','Fury','Cr7','Vilao1','Freaks','ABH','0ne','Vento','Xuan','Cy','Wendy','Muci','Weipit','Switch','Flukeyo','Shy','Miggie','Karlll','Tatsurii','Chammy1','Juschie','Dragon','Ihanss','Wiraww','Senkoo','Tufzzz','Zhanq','Wawa','Ray','Inua','Nighty','Clean','Snow','Myosotis','Keke','Daodao','Ran','Zoe','Sheng','Haku','Illusion','Musangking','Zhihong','Dian','Niel','Zaan','Guilv','Tianx','Fenrir'];
function genEwcDef(s,i,teamName){
 const used=new Set();
 (s.extraDefs||[]).forEach(d=>used.add(d.name));
 Object.values(s.aiRosterDefs||{}).forEach(arr=>arr.forEach(id=>{const d=defOf(s,id);if(d)used.add(d.name);}));
 (s.players||[]).forEach(p=>used.add(p.name));
 let name=EWC_NAMES[i];
 if(!name||used.has(name))name='外援'+(i+1);
 const pos=POS_ORDER[i%5];
 const b=v=>clamp(v+rnd(-4,4),68,88);
 return {id:'ewc'+gameYear(s)+'_'+i,name,pos,team:teamName,tags:['国际'],
 base:[b(80),b(78),b(80),b(79)],skill:{n:'海外劲旅',t:pick(['lane','farm','team','mind']),d:'国际赛场淬炼的体系战力'},
 sig:pick(HEROES.filter(h=>h.pos[0]===pos)).n,career:gameYear(s)+' EWC 电竞世界杯海外参赛队选手。'};
}
function setupEWC(s){
 const p=s.playoff;
 const champ=p.final.r,runner=p.final.r===p.final.a?p.final.b:p.final.a;
 const overs=shuffle(EWC_OVERSEAS.slice()).slice(0,6);
 // 海外队选手 def（挂 s.ewcDefMap，供 ensureAiRosters 构建真实阵容：BP 情报/体力/战力全流程可用）
 s.ewcDefMap={};
 let ni=0;
 overs.forEach(tn=>{
 const ids=[];
 for(let k=0;k<5;k++){const def=genEwcDef(s,ni++,tn);(s.extraDefs=s.extraDefs||[]).push(def);ids.push(def.id);}
 s.ewcDefMap[tn]=ids;
 });
 const teams=shuffle([champ,runner,...overs]);
 s.ewc={teams,qf:[0,1,2,3].map(i=>({a:teams[i*2],b:teams[i*2+1],r:null})),
 sf:[{a:null,b:null,r:null},{a:null,b:null,r:null}],final:{a:null,b:null,r:null},champ:null};
 s.phase='ewc';
 const myIn=teams.includes(s.teamName);
 logEvent(s,' '+gameYear(s)+' EWC 电竞世界杯（利雅得）开幕！'+champ+'（KPL直邀）与 '+runner+'（英雄亚冠ACL）代表 KPL 出战');
 if(myIn)logEvent(s,' 你队以「'+(champ===s.teamName?'KPL 春季赛冠军':'英雄亚冠 ACL')+'」身份直邀 8 强淘汰赛！');
 if(!myIn){simCup('ewc',s);return;} // 玩家未晋级：AI 自动补完（内部收尾进夏季赛）
 save();renderAll();
}
function ewcStep(s){
 const e=s.ewc;if(!e)return;
 for(let i=0;i<4;i++){const m=e.qf[i];if(!m.r){playCupMatch(s,m,'ewc_qf'+(i+1),'EWC·四分之一决赛',KPL.BO7);return;}}
 for(let i=0;i<2;i++){const m=e.sf[i];if(m.a===null)m.a=e.qf[i*2].r;if(m.b===null)m.b=e.qf[i*2+1].r;if(!m.r){playCupMatch(s,m,'ewc_sf'+(i+1),'EWC·半决赛',KPL.BO7);return;}}
 if(e.final.a===null)e.final.a=e.sf[0].r;
 if(e.final.b===null)e.final.b=e.sf[1].r;
 if(!e.final.r){playCupMatch(s,e.final,'ewc_final','EWC·总决赛',KPL.BO7);return;}
 finishEWC(s);
}
function finishEWC(s){
 const e=s.ewc;if(!e||!e.final.r||e.champ)return; // e.champ：防重复收尾（AI 补完与正常路径可能双入口）
 e.champ=e.final.r;
 const loserOf=m=>m.r===m.a?m.b:m.a;
 const runner=loserOf(e.final);
 s.titleHistory=(s.titleHistory||[]).concat([{season:s.season,split:s.split,event:'EWC',champ:e.champ}]).slice(-16);
 logEvent(s,' EWC 总决赛落幕：'+e.champ+' 捧杯！'+(e.champ===s.teamName?'中国赛区的世界之巅！':''));
 let prize=0; // 奖金（万美元折算）：冠军54万$≈540万 / 亚军33万$≈330万 / 四强14.5万$≈145万 / 八强9.3万$≈93万
 if(e.champ===s.teamName)prize=5400;
 else if(runner===s.teamName)prize=3300;
 else if(e.sf.some(m=>m.r&&loserOf(m)===s.teamName))prize=1450;
 else if(e.qf.some(m=>m.r&&loserOf(m)===s.teamName))prize=930;
 if(prize){s.fund+=prize;logEvent(s,' EWC 赛事奖金（美元折算）：+'+prize+'万');}
 if(e.champ===s.teamName||runner===s.teamName){
 s.honors=s.honors||[];
 s.honors.push({season:s.season,title:gameYear(s)+' EWC 电竞世界杯 '+(e.champ===s.teamName?'冠军':'亚军'),champion:e.champ===s.teamName,roster:titleRoster(s)});
 s.honors=s.honors.slice(-20);
 }
 awardFMVP(s,e.champ,gameYear(s)+' EWC 电竞世界杯');
 s.ewcDone=true;
 startSplit(s,'summer'); // EWC 收官 → 夏季赛转会期（年中不老化）
}
/* ================= 亚运会（四年一届 · 国家队征召） =================
 真实建模简化：中国代表队由 KPL 联盟各位置当赛季总值最高者组成（含玩家队选手），
 韩国为最强对手，8 队 BO7 单败淘汰。玩家不直接操控国家队（教练席不在你手里），
 但麾下入选选手会带回来奖牌加成：人气/身价/士气 + 协会奖金，代价是年总体力下滑。 */
const AG_NATIONS=[['韩国',470],['中国台北',432],['越南',427],['泰国',416],['日本',400],['沙特阿拉伯',385],['印度',365]];
const AG_CITY='名古屋';
function agSelectSquad(s){
 const pool=[];
 (s.players||[]).forEach(p=>{if(!p.loan&&!p.retiring)pool.push(p);});
 AI_TEAMS.forEach(t=>ensureAiRosters(s,t.name).forEach(p=>pool.push(p)));
 return POS_ORDER.map(pos=>pool.filter(p=>p.pos===pos).sort((a,b)=>overall(b)-overall(a))[0]).filter(Boolean);
}
function setupAsianGames(s){
 // 名单以夏初宣布的 natSquad 为准（征召后中途转会不换人）；残缺时按当前最强兜底补位
 const ownedIds=new Set((s.players||[]).map(p=>p.id));
 let squad=[];
 const nat=(s.natSquad||[]).map(x=>x.name);
 if(nat.length){
 squad=nat.map(n=>{
 const own=(s.players||[]).find(p=>p.name===n);
 if(own&&!own.retiring)return own;
 for(const t of AI_TEAMS){const q=ensureAiRosters(s,t.name).find(p=>p.name===n);if(q)return q;}
 return null;
 }).filter(Boolean);
 }
 if(squad.length<5)squad=agSelectSquad(s); // 兜底：名单残缺（退役/异常）按当前最强补
 const myPow=Math.round(squad.reduce((m,p)=>m+playerPower(p),0));
 s.aiPower=s.aiPower||{};
 s.aiPower['中国代表队']=myPow;
 AG_NATIONS.forEach(([n,pw])=>{s.aiPower[n]=pw+(gameYear(s)-2026)*3;}); // 海外对手逐年小幅变强
 const others=shuffle(AG_NATIONS.map(([n])=>n).slice());
 s.ag={squad:squad.map(p=>({name:p.name,pos:p.pos,mine:ownedIds.has(p.id),ovr:overall(p)})),
 myPow,qf:[{a:'中国代表队',b:others[0],r:null},{a:'韩国',b:others[1],r:null},{a:others[2],b:others[3],r:null},{a:others[4],b:others[5],r:null}],
 sf:[{a:null,b:null,r:null},{a:null,b:null,r:null}],final:{a:null,b:null,r:null},champ:null,mvp:null,medal:null};
 s.phase='asiad';
 const mineCnt=s.ag.squad.filter(x=>x.mine).length;
 logEvent(s,' '+gameYear(s)+' '+AG_CITY+'亚运会开幕！中国代表队由 KPL 各位置当季最强组成（战力 '+myPow+'）');
 logEvent(s,' 中国代表队名单：'+s.ag.squad.map(x=>POS[x.pos][1]+' '+x.name+(x.mine?'（本队）':'')).join('、')+' —— 最强对手：韩国');
 if(mineCnt)logEvent(s,' 你队有 '+mineCnt+' 名选手被征召！赛程由国家队教练组指挥，成绩将以奖牌加成形式回流俱乐部');
 save();renderAll();
}
function asiadStep(s){
 const a=s.ag;if(!a||a.champ)return;
 const done=[];
 const play=m=>{const r=simSeriesResult(s,m.a,m.b,7);m.r=r.win?m.a:m.b;m.ms=r.mw;m.es=r.ow;done.push(m);};
 if(a.qf.some(m=>!m.r)){a.qf.forEach(m=>{if(!m.r)play(m);});}
 else if(a.sf.some(m=>!m.r)){a.sf.forEach((m,i)=>{if(m.a===null)m.a=a.qf[i*2].r;if(m.b===null)m.b=a.qf[i*2+1].r;if(!m.r)play(m);});}
 else if(!a.final.r){
 if(a.final.a===null)a.final.a=a.sf[0].r;
 if(a.final.b===null)a.final.b=a.sf[1].r;
 play(a.final);
 }else{finishAsianGames(s);return;}
 done.forEach(m=>logEvent(s,' 亚运会淘汰赛（BO7）：'+m.a+' '+(m.ms||0)+':'+(m.es||0)+' '+m.b+'，'+m.r+' 晋级'));
 if(a.final.r)finishAsianGames(s);
 else{save();renderAll();}
}
function finishAsianGames(s){
 const a=s.ag;if(!a||a.champ)return;
 a.champ=a.final.r;
 const loserOf=m=>m.r===m.a?m.b:m.a;
 const runner=loserOf(a.final);
 const bronzes=a.sf.map(loserOf).filter(Boolean);
 a.medal=a.champ==='中国代表队'?'金牌':runner==='中国代表队'?'银牌':bronzes.includes('中国代表队')?'铜牌':'无';
 s.titleHistory=(s.titleHistory||[]).concat([{season:s.season,split:null,event:'亚运会',champ:a.champ}]).slice(-16);
 logEvent(s,' '+gameYear(s)+' 亚运会王者荣耀项目落幕：'+a.champ+' 金牌 · '+(runner==='中国代表队'?'中国队':'韩国等队')+' 银牌');
 if(a.champ==='中国代表队')logEvent(s,' 中国代表队登顶亚洲之巅——国旗升起时刻，整个 KPL 都在看！');
 else if(a.medal==='无')logEvent(s,' 中国队无缘领奖台，舆论哗然');
 // MVP：冠军队内战力最高者；中国队夺冠时从征召名单里定
 if(a.champ==='中国代表队'){
 const best=agSelectSquad(s).slice().sort((x,y)=>overall(y)-overall(x))[0];
 if(best){a.mvp=best.name;logEvent(s,' 亚运会 MVP：'+best.name+'（'+POS[best.pos][0]+'）当选');}
 }
 // 奖牌回流俱乐部：本队入选选手按奖牌档位获得人气/身价/士气，协会发奖金；代价是年总体力下滑
 const mine=a.squad.filter(x=>x.mine);
 const add={'金牌':[8,6],'银牌':[5,4],'铜牌':[3,2],'无':[1,0]}[a.medal];
 const prizeBase={'金牌':400,'银牌':200,'铜牌':100,'无':50}[a.medal];
 mine.forEach(x=>{
 const p=(s.players||[]).find(y=>y.name===x.name);
 if(!p)return;
 p.popularity=Math.min(99,(p.popularity||0)+add[0]);
 p.val=clamp((p.val||100)+add[1],70,150);
 p.morale=clamp(p.morale+5,20,100);
 p.energy=clamp((p.energy==null?100:p.energy)-15,30,100); // 国家队征召消耗：年总开局体力不满
 });
 if(mine.length){
 const prize=Math.round(prizeBase*mine.length/5);
 if(prize){s.fund+=prize;logEvent(s,' 协会发放亚运会奖金：+'+prize+'万（'+mine.length+' 名选手入选 · '+a.medal+'档）');}
 logEvent(s,' 亚运会加成：'+mine.map(x=>x.name).join('、')+' 人气+'+add[0]+' · 身价+'+add[1]+'（征召消耗体力，年总开局体力不满）');
 if(a.mvp&&mine.some(x=>x.name===a.mvp)){
 const p=(s.players||[]).find(y=>y.name===a.mvp);
 if(p){p.popularity=Math.min(99,(p.popularity||0)+10);p.val=clamp((p.val||100)+5,70,150);
 logEvent(s,' 亚运会 MVP 是你的 '+a.mvp+'！专属冠军皮肤安排（人气+10 · 身价+5）');}
 }
 }
 s.agDone=true;
 // 集训归队：清除征召标记 + 撤掉青训临时借调（亚运后恢复完整阵容打年总）
 s.players.forEach(p=>{p.natCamp=false;});
 s.natCampIds=[];
 const fills=s.players.filter(p=>p.natFill);
 if(fills.length){
 fills.forEach(p=>{const li=s.lineup.indexOf(p.id);if(li>=0)s.lineup.splice(li,1);});
 s.players=s.players.filter(p=>!p.natFill);
 logEvent(s,' 集训借调青训归位：'+fills.map(p=>p.name).join('、')+' 返回青训营，征召选手全员归队备战年总');
 }
 setupAnnual(s);
}
/* ================= KPL 年度总决赛（年末最高规格） =================
 年度积分前 12 入围：擂台赛（大师组=积分前6 × 精英组=后6，组外单循环 BO5，每队6场）
 → 突围赛（大师5/6+精英2-5，6队 BO7 单败，3队晋级；精英第6名直接出局）
 → 淘汰赛（8队 BO7 双败），冠军捧圣龙杯 + 2000万级奖金池（游戏内取 800 万冠军奖）。 */
function annualRank(s){
 return Object.keys(s.annualPts||{}).sort((a,b)=>(s.annualPts[b]||0)-(s.annualPts[a]||0)||powerOf(s,b)-powerOf(s,a));
}
function setupAnnual(s){
 const all=annualRank(s);
 const q=all.slice(0,12);
 s.annual={stage:'arena',roundIdx:0,masters:q.slice(0,6),elites:q.slice(6,12),q};
 // 擂台赛：6×6 组外单循环（大师组×精英组轮转配对，每队 6 场 BO5）
 s.annual.rounds=[];
 for(let r=0;r<6;r++){
 const ms=[];
 for(let i=0;i<6;i++)ms.push({a:s.annual.masters[i],b:s.annual.elites[(i+r)%6],r:null});
 s.annual.rounds.push(ms);
 }
 s.phase='annual';
 const myRank=all.indexOf(s.teamName);
 if(myRank<0||myRank>=12){
 logEvent(s,' 年度积分 '+(s.annualPts[s.teamName]||0)+' 分（第'+(myRank+1)+'），无缘年度总决赛（前12）——春夏赛季继续攒分');
 simCup('annual',s); // AI 自动补完全部年总赛程（内部收尾走年度轮换）
 return;
 }
 logEvent(s,' '+gameYear(s)+' KPL 年度总决赛开幕！你队以年度积分 '+s.annualPts[s.teamName]+' 分（第'+(myRank+1)+'名）进入'+(myRank<6?'大师组':'精英组'));
 save();renderAll();
}
function arenaStandings(s){
 const M={},E={};
 s.annual.masters.forEach(t=>M[t]={pts:0,pw:0});
 s.annual.elites.forEach(t=>E[t]={pts:0,pw:0});
 s.annual.rounds.flat().forEach(m=>{
 if(!m.r)return;
 const aWin=m.r===m.a,ms=m.ms==null?4:m.ms,es=m.es==null?0:m.es;
 const wT=aWin?M:E,lT=aWin?E:M;
 wT[m.r].pts++;wT[m.r].pw+=aWin?ms:es;
 lT[aWin?m.b:m.a].pw+=aWin?es:ms;
 });
 return {M,E};
}
function annualStep(s){ // 年总推进分派（finishSeries cup 分支 / AI 场次递归入口）
 const a=s.annual;if(!a)return;
 if(a.stage==='arena')annualArenaNext(s);
 else if(a.stage==='breakthrough')annualBrkNext(s);
 else if(a.stage==='po')annualPoStep(s);
}
function startAnnualArena(s){
 const a=s.annual;
 const rd=a.rounds[a.roundIdx];
 if(!rd){finishArena(s);return;}
 const my=rd.find(m=>m.a===s.teamName||m.b===s.teamName);
 if(!my){finishArena(s);return;}
 playCupMatch(s,my,'arena_r'+(a.roundIdx+1),'年总·擂台赛 第'+(a.roundIdx+1)+'轮',KPL.BO5);
}
function annualArenaNext(s){
 const a=s.annual;
 const rd=a.rounds[a.roundIdx];
 if(!rd){finishArena(s);return;}
 // 本轮 AI 场次补完（玩家场次已由 finishSeries 写入 m.r/ms/es）
 rd.forEach(m=>{
 if(m.r)return;
 const r=simSeriesResult(s,m.a,m.b,KPL.BO5);
 m.r=r.win?m.a:m.b;m.ms=r.mw;m.es=r.ow;
 });
 const rep=rd.filter(m=>!(m.a===s.teamName||m.b===s.teamName)).slice(0,3).map(m=>m.a+' '+m.ms+':'+m.es+' '+m.b).join('；');
 if(rep)logEvent(s,' 擂台赛第'+(a.roundIdx+1)+'轮：'+rep);
 a.roundIdx++;
 if(a.roundIdx>=6)finishArena(s);
}
function finishArena(s){
 const st=arenaStandings(s);
 const rankOf=(tbl,teams)=>teams.slice().sort((x,y)=>tbl[y].pts-tbl[x].pts||tbl[y].pw-tbl[x].pw);
 const mRank=rankOf(st.M,s.annual.masters),eRank=rankOf(st.E,s.annual.elites);
 s.annual.mRank=mRank;s.annual.eRank=eRank;
 logEvent(s,' 擂台赛收官！大师组前四直进淘汰赛：'+mRank.slice(0,4).join('、')+'；精英组第1名 '+eRank[0]+' 直进淘汰赛');
 s.annual.stage='breakthrough';
 // 突围赛：大师5/6 与 精英2-5 六队 BO7 单败（高顺位种子错开：M5vE5、M6vE4、E2vE3）
 s.annual.brk=[{a:mRank[4],b:eRank[4],r:null},{a:mRank[5],b:eRank[3],r:null},{a:eRank[1],b:eRank[2],r:null}];
 logEvent(s,' 突围赛对阵：'+s.annual.brk.map(m=>m.a+' vs '+m.b).join('；')+'（胜者进淘汰赛 · 精英组第6名 '+eRank[5]+' 遗憾出局）');
 const myBrk=s.annual.brk.some(m=>m.a===s.teamName||m.b===s.teamName);
 if(!myBrk){let g=0;while(s.annual.stage==='breakthrough'&&g++<10)annualBrkNext(s);}
 save();renderAll();
}
function annualBrkNext(s){
 const a=s.annual;if(!a.brk)return;
 for(let i=0;i<3;i++){const m=a.brk[i];if(!m.r){playCupMatch(s,m,'brk'+(i+1),'年总·突围赛',KPL.BO7);return;}}
 finishBreakthrough(s);
}
function finishBreakthrough(s){
 const winners=s.annual.brk.map(m=>m.r);
 const eight=shuffle([s.annual.mRank[0],s.annual.mRank[1],s.annual.mRank[2],s.annual.mRank[3],s.annual.eRank[0],...winners]);
 s.annual.stage='po';
 s.annual.po=buildCup8(eight); // 8 队 BO7 双败
 logEvent(s,' 年度总决赛·淘汰赛开启！8 强 BO7 双败：'+eight.join('、'));
 if(!eight.includes(s.teamName)){
 let g=0;while(s.annual.po&&!s.annual.po.champ&&g++<30)annualPoStep(s); // 内部终局时自动 finishAnnual→年度轮换
 return;
 }
 save();renderAll();
}
/* 8 队双败淘汰 bracket（BO7，种子 1v8/4v5/2v7/3v6 落位）——年总淘汰赛 / 挑战者杯 8 强共用 */
function buildCup8(teams){
 return {
 wb1:[{a:teams[0],b:teams[7],r:null},{a:teams[3],b:teams[4],r:null},{a:teams[1],b:teams[6],r:null},{a:teams[2],b:teams[5],r:null}],
 wb2:[{a:null,b:null,r:null},{a:null,b:null,r:null}],wf:{a:null,b:null,r:null},
 lb1:[{a:null,b:null,r:null},{a:null,b:null,r:null}],lb2:[{a:null,b:null,r:null},{a:null,b:null,r:null}],
 lbs:{a:null,b:null,r:null},lbf:{a:null,b:null,r:null},final:{a:null,b:null,r:null},champ:null};
}
function annualPoStep(s){
 const p=s.annual.po;if(!p)return;
 const loserOf=m=>m.r===m.a?m.b:m.a;
 const P=(m,slot,label)=>playCupMatch(s,m,slot,label,KPL.BO7);
 for(let i=0;i<4;i++)if(!p.wb1[i].r){P(p.wb1[i],'apo_wb1_'+(i+1),'年总·胜者组首轮');return;}
 for(let i=0;i<2;i++){const m=p.lb1[i];if(m.a===null)m.a=loserOf(p.wb1[i*2]);if(m.b===null)m.b=loserOf(p.wb1[i*2+1]);if(!m.r){P(m,'apo_lb1_'+(i+1),'年总·败者组首轮');return;}}
 for(let i=0;i<2;i++){const m=p.wb2[i];if(m.a===null)m.a=p.wb1[i*2].r;if(m.b===null)m.b=p.wb1[i*2+1].r;if(!m.r){P(m,'apo_wb2_'+(i+1),'年总·胜者组半决赛');return;}}
 for(let i=0;i<2;i++){const m=p.lb2[i];if(m.a===null)m.a=p.lb1[i].r;if(m.b===null)m.b=loserOf(p.wb2[i]);if(!m.r){P(m,'apo_lb2_'+(i+1),'年总·败者组第二轮');return;}}
 if(p.wf.a===null){p.wf.a=p.wb2[0].r;p.wf.b=p.wb2[1].r;}
 if(!p.wf.r){P(p.wf,'apo_wf','年总·胜者组决赛');return;}
 if(p.lbs.a===null){p.lbs.a=p.lb2[0].r;p.lbs.b=p.lb2[1].r;}
 if(!p.lbs.r){P(p.lbs,'apo_lbs','年总·败者组半决赛');return;}
 if(p.lbf.a===null){p.lbf.a=loserOf(p.wf);p.lbf.b=p.lbs.r;}
 if(!p.lbf.r){P(p.lbf,'apo_lbf','年总·败者组决赛');return;}
 if(p.final.a===null){p.final.a=p.wf.r;p.final.b=p.lbf.r;}
 if(!p.final.r){P(p.final,'apo_final','年总·总决赛');return;}
 finishAnnual(s,true);
}
function finishAnnual(s,silent){
 const p=s.annual&&s.annual.po;
 if(p&&p.final.r&&!p.champ){
 p.champ=p.final.r;
 const loserOf=m=>m.r===m.a?m.b:m.a;
 const runner=loserOf(p.final);
 s.titleHistory=(s.titleHistory||[]).concat([{season:s.season,split:s.split,event:'年总',champ:p.champ}]).slice(-16);
 logEvent(s,' '+gameYear(s)+' KPL 年度总决赛落幕：'+p.champ+' 捧起圣龙杯！'+(p.champ===s.teamName?'年度至尊荣耀！':''));
 let prize=0; // 年总奖金（真实 2000 万级冠军奖，游戏内取 800 万）
 if(p.champ===s.teamName)prize=8000;
 else if(runner===s.teamName)prize=4000;
 else if([p.lbf,p.lbs].some(m=>m.r&&loserOf(m)===s.teamName))prize=2500;
 else if(p.lb2.concat(p.lb1).some(m=>m.r&&loserOf(m)===s.teamName))prize=1200;
 if(prize){s.fund+=prize;logEvent(s,' 年度总决赛奖金：+'+prize+'万');}
 if(p.champ===s.teamName||runner===s.teamName){
 s.honors=s.honors||[];
 s.honors.push({season:s.season,title:gameYear(s)+' KPL年度总决赛 '+(p.champ===s.teamName?'冠军':'亚军'),champion:p.champ===s.teamName,roster:titleRoster(s)});
 s.honors=s.honors.slice(-20);
 }
 awardFMVP(s,p.champ,gameYear(s)+' KPL 年度总决赛');
 s.champion=p.champ===s.teamName;
 }
 newSeason(s); // 年度轮换：年龄/合同/退役结算 → 下一年春季赛
}
/* ================= 杯赛通用流程（EWC / 挑战者杯 / 年总共用） ================= */
const BO_TXT=bo=>bo===5?'BO5 全局BP':bo===9?'BO9·第9局巅峰对决':'BO7·含巅峰对决';
function playCupMatch(s,m,slot,label,bo){
 if(m.a===s.teamName||m.b===s.teamName){
 const opName=m.a===s.teamName?m.b:m.a;
 if(s.series&&s.series.stage==='cup'&&s.series.cupSlot===slot){
 showPreMatch(label+'（'+BO_TXT(bo)+'）vs '+opName+' · 第'+(s.series.mw+s.series.ow+1)+'局（'+s.series.mw+':'+s.series.ow+'）');
 return;
 }
 s.series={used:[],usedOpp:[],mw:0,ow:0,max:bo,stage:'cup',cupSlot:slot,cupMatch:m,cupLabel:label,logs:[],myName:m.a===s.teamName?m.a:m.b,opName,side:firstSide(s,'playoff',opName)};s.seriesAuto=false;
 resetOppEnergy(s,opName);
 showPreMatch(label+'（'+BO_TXT(bo)+'）vs '+opName+' · 第1局');
 return;
 }
 const r=simSeriesResult(s,m.a,m.b,bo);
 m.r=r.win?m.a:m.b;m.ms=r.mw;m.es=r.ow;
 logEvent(s,' '+label+'：'+m.a+' '+(r.win?'胜':'负')+' '+m.b+'，'+m.r+' 晋级');
 save();renderAll();
 if(s.phase==='ewc')ewcStep(s);
 else if(s.phase==='challenger')challengerStep(s);
 else annualStep(s); // 年总各阶段推进（擂台 AI 场次不走此路径，突围/淘汰赛走此分派）
}
function simCup(kind,s){ // 玩家未晋级：AI 自动补完杯赛
 let guard=0;
 if(kind==='ewc'){while(s.ewc&&!s.ewc.champ&&guard++<20)ewcStep(s);}
 else if(kind==='challenger'){while(s.challenger&&!s.challenger.champ&&guard++<60)challengerStep(s);}
 else{while(s.annual&&(s.annual.stage!=='po'||!s.annual.po.champ)&&guard++<80)annualStep(s);}
}
function startCup(s){ // 杯赛 UI 入口（进行下一场 / 快进）
 if(s.phase==='ewc'){ewcStep(s);return;}
 if(s.phase==='challenger'){challengerStep(s);return;}
 if(s.phase==='annual'){
 const a=s.annual;
 if(a.stage==='arena')startAnnualArena(s);
 else if(a.stage==='breakthrough')annualBrkNext(s);
 else annualPoStep(s);
 }
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
 logEvent(s,' 自由市场签下 '+p.name+'（无球可打选手 · 签约费 '+p.signCost+'万）');
 save();renderAll();toast(p.name+' 加盟！');
}
