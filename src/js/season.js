
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
 if(/成就解锁|冠军|王朝|捧杯|FMVP|名人堂|亚运/.test(txt))return 'gold';
 // "败/负"必须带语境词：裸匹配会把「S/A/B → 卡位赛 → 双败季后赛」这类赛制说明判成败绩
 if(/惜败|落败|战败|不敌|淘汰|无缘|拖欠工资|负 /.test(txt))return 'lose';
 if(/胜 |击败|获胜|晋级/.test(txt))return 'win'; // 不写"卡位"：赛制说明里的"卡位赛"会被误染成胜绩色
 if(/赞助|奖金|分润|收入|涨薪|代言|曝光|返还|找回/.test(txt))return 'gold';
 return 'info';
}
/* 事件分类：互斥分区（荣誉成就 > 比赛战报 > 转会财政 > 其他动态）
 每条日志只归一类，四类合计=全部——不会出现"点财政看到的全是比赛战报"这种重叠。
 旧版在渲染层拿正则猜分类、且用 level==='gold' 当荣誉门槛，而 gold 在 logLevel 里
 同时表示"收入"，于是「成就解锁」永远进不了荣誉；回归用例见 tests/verify-logcat.js */
const LOG_CATS=[
 {k:'honor',n:'荣誉成就',re:/总冠军|夺冠|捧杯|FMVP|王朝|名人堂|成就解锁|亚运|征召|荣耀|卫冕/},
 {k:'match',n:'比赛战报',re:/常规赛|季后赛|卡位赛|挑战者杯|电竞世界杯|EWC|年度总决赛|圣龙杯|联赛战报|连胜|连败|伤停|受伤/},
 {k:'fund', n:'转会财政',re:/赞助|奖金|分润|收入|资金|薪|代言|转会|签约|签下|挂牌|特惠|预算|工资帽/},
];
function logCat(txt){
 const t=String(txt==null?'':txt);
 if(/赛制|版本更新|经济体系升级/.test(t))return 'other'; // 说明性文案：既不是比赛也不是账目
 for(const c of LOG_CATS){if(c.re.test(t))return c.k;}
 return 'other';
}
function logEvent(s,txt){s.eventLog.unshift({txt,t:Date.now(),level:logLevel(txt),cat:logCat(txt)});s.eventLog=s.eventLog.slice(0,120);}
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
 awardSplitFans(s,s.champion,p.final.a===s.teamName||p.final.b===s.teamName); // 粉丝随赛段成绩增长
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
 kjiaTick(s); // K甲下放倒计时：到期归队并成长
 kjiaDayTick(s); // K甲联赛：二队每 2 天一轮，下放选手真实出战
 s.fund+=dailyCommercialIncome(s); // 赞助商每日结算 + 门票/周边（两者都随粉丝上浮）
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
 }else{
 inSeasonOfferTick(s); // 赛中转会报价：表现火热的选手被挖角（留人/放人/抬价，俱乐部页答复）
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
 // 选手代言收入：人气 × 0.3万/周 × 粉丝系数（商业价值对冲工资帽压力）
 const endorse=Math.round(s.players.reduce((t,p)=>t+((p.popularity||0)*3),0)*fanMul(s,300));
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
 try{localStorage.setItem(slotKey()+'_auto',JSON.stringify(s));}catch(e){} // 赛季轮转自动备份（roguelike 惯例）：误触重置/存档损坏可回滚上一年
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
 s.yearStages=[]; // 成绩曲线同一年度清零（回顾已快照进 yearReviews）
 applySeasonPatch(s); // 赛季版本大改：两名英雄一增一削，持有者属性微调（自写 s.patch）
 dressingRoomCheck(s); // 更衣室年检：坐穿板凳的高战力替补不满/要求离队；队长离队自动摘袖标
 boardApplyEffect(s); // 董事会：下赛季的干预（砍帽）或特权（追加预算）按月生效
 setBoardKpi(s); // 下发本赛季董事会目标（依据上一年年度积分排名）
 startSplit(s,'spring');
}
/* ================= 董事会与信任度（单机经营的压力与终局） =================
 赛季末按「年度积分排名」结算 KPI：达成 → 信任度上升，未达成 → 下降；归零即下课（终局）。
 设计约束：下课**不阻塞** nextDay/startMatch 等底层推进函数——平衡门禁（sim/sim-quick/fuzz）
 直接调用这些函数，硬守卫会让门禁失去校准意义；终局在 UI 层实现（解雇结算页 + 操作按钮禁用）。 */
const BOARD_WARN_TRUST=24; // 低于此值：董事会介入干预（下赛季工资帽削减）
const BOARD_FAVOR_TRUST=80; // 高于此值：董事会放权（下赛季追加预算）
function myAnnualRank(s){ // 本队年度积分排名（从 1 起）；本队不在名录时返回 null
 // 注意与 annualRank 区分：那个返回排序后的队名数组（年总分组用），这里只取本队名次。
 // 分母取"联盟全队"而非"有积分的队"：年度积分只发给打进季后赛/杯赛的队伍，弱队可能一分未得——
 // 旧写法要求 pts[me]!=null，结果弱队被当成"缺少数据、不评价"，董事会恰好在最该施压的弱队上失效。
 const pts=s.annualPts||{},me=s.teamName;
 const all=[...new Set([...(s.leagueTeams||[]),...Object.keys(pts),me])];
 const list=all.sort((a,b)=>(pts[b]||0)-(pts[a]||0)||powerOf(s,b)-powerOf(s,a));
 const i=list.indexOf(me);
 return i<0?null:i+1;
}
function boardKpiTarget(prevRank,s){ // 豪门保前4 / 争冠组保前8 / 其余保前12（进年总线）
 if(prevRank)return prevRank<=4?4:prevRank<=8?8:12;
 // 首年没有历史名次：按分组档位定目标（S组=争冠区→前4，A组→前8，B组=重建中→前12）
 const inG=g=>(s&&s.groups&&s.groups[g]||[]).indexOf(s.teamName)>=0;
 if(inG('S'))return 4;
 if(inG('A'))return 8;
 return 12;
}
function setBoardKpi(s){
 s.board=s.board||{};
 s.managerCareer=s.managerCareer||{years:0,titles:0,lastRank:null};
 const prev=s.managerCareer.lastRank||null;
 const target=boardKpiTarget(prev,s);
 s.board.kpi={target,from:prev,label:'赛季末年度积分进前 '+target};
 return s.board.kpi;
}
function boardSettle(s){
 /* 赛季末结算（在 newSeason 之前调用：此时 s.season 仍是刚结束的那一年） */
 s.board=s.board||{};
 s.managerCareer=s.managerCareer||{years:0,titles:0,lastRank:null};
 const kpi=s.board.kpi, rank=myAnnualRank(s);
 const champs=(s.honors||[]).filter(h=>h.season===s.season&&h.champion).length;
 let delta=0,note='';
 if(kpi&&rank){
  if(rank<=kpi.target){delta+=12;note='达成董事会目标（年度积分第 '+rank+' 名，目标前 '+kpi.target+'）';}
  else{
   const over=rank-kpi.target;
   delta-=Math.min(30,Math.max(8,Math.round(over*1.5))); // 差得越多扣得越狠，下限 -30
   note='未达成董事会目标（年度积分第 '+rank+' 名，目标前 '+kpi.target+'）';
  }
 }else{
  note='本赛季缺少完整积分数据，董事会未作评价';
 }
 if(champs){delta+=6*champs;note+='；年内 '+champs+' 冠额外嘉奖';} // 拿冠军永远算成绩
 if(delta>20)delta=20; // 单赛季上限：防信任度靠一次夺冠暴涨到满
 const before=s.board.trust==null?60:s.board.trust;
 s.board.trust=clamp(before+delta,0,100);
 s.board.log=s.board.log||[];
 s.board.log.unshift({season:s.season,rank,target:kpi?kpi.target:null,delta,note,trust:s.board.trust});
 s.board.log=s.board.log.slice(0,12);
 s.managerCareer.years=(s.managerCareer.years||0)+1;
 s.managerCareer.titles=(s.managerCareer.titles||0)+champs;
 s.managerCareer.lastRank=rank;
 logEvent(s,'【董事会】'+note+'：信任度 '+(delta>=0?'+':'')+delta+'（当前 '+s.board.trust+'）');
 // 连续未达成累计警告；信任耗尽的赛季必须有一个"保级期"，故要求 warn 达标才解约
 s.board.warn=delta<0?((s.board.warn||0)+1):0;
 if(!s.board.fired&&(s.board.trust<=0||(s.board.warn>=3&&s.board.trust<=BOARD_WARN_TRUST))){
  s.board.fired=true;
  s.board.firedSeason=s.season;
  logEvent(s,'【董事会】信任度耗尽——'+s.teamName+' 董事会宣布与你解约，执教生涯结束（第 '+s.season+' 赛季）');
 }
 return {rank,delta,note};
}
function boardApplyEffect(s){
 /* 下赛季生效的董事会态度：低信任砍帽（干预）、高信任追加预算（放权）。金额刻意保守，
    避免撼动平衡门禁的校准区间（门禁不模拟下课，但会吃到这里的经济效果） */
 s.board=s.board||{};
 const t=s.board.trust==null?60:s.board.trust;
 if(t<=BOARD_WARN_TRUST){
  const cut=Math.max(5,Math.round((s.wageCap||900)*0.1));
  s.wageCap=Math.max(300,(s.wageCap||900)-cut);
  logEvent(s,' 董事会介入：对战绩不满，压缩工资帽 '+cut+'万（本赛季上限 '+s.wageCap+'万/周）——请用更低的成本打出成绩');
 }else if(t>=BOARD_FAVOR_TRUST){
  s.fund+=800;
  logEvent(s,' 董事会放权：追加运营预算 +800万（信任度 '+t+'）');
 }
}
function boardTierText(s){ // 面板用一句人话概括董事会态度
 const t=(s.board&&s.board.trust!=null)?s.board.trust:60;
 if(s.board&&s.board.fired)return '已解约';
 if(t>=BOARD_FAVOR_TRUST)return '高度信任';
 if(t>=60)return '满意';
 if(t>=40)return '观望';
 if(t>=BOARD_WARN_TRUST)return '不满';
 return '最后通牒';
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
 initKjia(s); // 二队 K甲联赛：每个赛段重开一届（独立赛程+积分榜，二队页可查）
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
 autoFillLineup(s); // 集训选手立刻换下首发（同位置替补择优顶上；无替补则位置空缺）
 if(mine.length){
 const names=mine.map(p=>p.name+'（'+POS[p.pos][0]+'）').join('、');
 logEvent(s,' 国家队征召：'+names+' 入选中国代表队！夏赛期间集训+出征名古屋亚运会，缺席俱乐部整个夏季赛');
 const empty=POS_ORDER.filter(pos=>!s.lineup.some(id=>{const p=s.players.find(x=>x.id===id);return p&&p.pos===pos;}));
 if(empty.length)logEvent(s,' 警告：'+empty.map(pos=>POS[pos][0]).join('、')+'没有替补可顶——转会市场签替补 / 训练页提拔青训，否则该位置整段夏季赛无法出战');
 }else{
 logEvent(s,' '+gameYear(s)+' 亚运年：中国代表队集结完毕（本队无选手入选，不受影响）');
 }
}
/* 旧版「青训临时借调」机制已移除（2026-09：顶位一律用队内替补，没有就签人——买替补成为正式策略）。
 旧档中残留的 natFill 选手由 finishAsianGames 收官清理与禁售守卫兼容处理。 */

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
/* ================= 粉丝与商业（成绩 → 粉丝 → 收入 的正循环） =================
 粉丝由成绩驱动（赛段名次/冠军/选手人气），再反过来放大赞助单价、门票流水与代言收入，
 并作为赞助商升级门槛——把原先互不相干的三条线（选手人气 / 赞助商 / 代言）缝成一个环。
 系数刻意保守且封顶；平衡门禁不跑转会，经济改动对门禁几乎无影响。 */
function initFans(s){ // 开档粉丝 = 底子 + 阵容人气（豪门起点高，自建从零起步）
 const pop=(s.players||[]).reduce((t,p)=>t+(p.popularity||0),0);
 s.fans=Math.round((s.selfBuilt?6:10)+pop/12);
 return s.fans;
}
const FAN_MILESTONES=[20,80,200]; // 与赞助商升级门槛对齐：突破即可洽谈更高级赞助
function addFans(s,n,why){
 if(!n)return s.fans||0;
 const before=s.fans==null?0:s.fans;
 const after=Math.max(0,Math.round((before+n)*10)/10);
 s.fans=after;
 if(why&&Math.abs(after-before)>=0.5)logEvent(s,' 粉丝 '+(after>=before?'+':'')+(Math.round((after-before)*10)/10)+'万（'+why+' · 当前 '+after+'万）');
 FAN_MILESTONES.forEach(m=>{
  if(before<m&&after>=m){
   const tier=SPONSORS.filter(x=>x.fans===m).map(x=>x.name).join('/');
   if(tier)logEvent(s,' 粉丝突破 '+m+' 万！可以洽谈「'+tier+'」级别的赞助商了');
  }
 });
 return after;
}
const FAN_CAP=600; // 粉丝计效上限（万）：所有商业系数共用同一个帽子，避免极端值把日流水顶穿
const fanEff=s=>Math.min(s.fans||0,FAN_CAP);
const fanMul=(s,div)=>1+fanEff(s)/div; // 粉丝加成
/* 每日商业流水：赞助单价（粉丝加成）+ 门票/周边（同样走封顶）。抽成纯函数便于精确断言 */
function dailyCommercialIncome(s){
 return Math.round(SPONSORS[s.sponsorLv].income*fanMul(s,500))+Math.round(fanEff(s)*0.08);
}
/* 赛段收官结算粉丝：阵容人气是基本盘，夺冠/亚军额外加成 */
function awardSplitFans(s,isChamp,isRunner){
 const pop=(s.players||[]).reduce((t,p)=>t+(p.popularity||0),0);
 let gain=pop/60;
 gain+=isChamp?8:(isRunner?5:(s.phase==='eliminated'?0:2));
 return addFans(s,Math.round(gain*10)/10,'赛段收官·'+splitLabel(s));
}
/* ================= 更衣室（出场时间 / 队长） =================
 替补不是摆设：长期坐板凳的高战力选手会不满，积累到一定程度公开要求离队。
 依据只有"出场差距"（apps 由 finishSeries 统计），规则简单可预期，玩家能据此主动轮换。 */
const DRESS_OVR_MIN=74; // 战力低于此值的替补没资格抱怨（板凳深度本来就是他的位置）
function dressingRoomCheck(s){
 const ls=rosterLineup(s);
 if(!ls.length)return 0;
 const ref=ls.reduce((t,p)=>t+(p.apps||0),0)/ls.length; // 首发场均出场：替补的参照基准
 let unhappy=0;
 (s.players||[]).filter(p=>!s.lineup.includes(p.id)).forEach(p=>{
 if(p.retiring||p.loan||p.kjia>0)return; // 下放 K甲的选手在次级联赛有球可打，不按"坐板凳"记不满
 const ovr=overall(p);
 if(ovr<DRESS_OVR_MIN)return;
 const gap=ref-(p.apps||0);
 if(ref>=3&&gap>=ref*0.6){ // 首发打满而他把板凳坐穿
 p.morale=clamp(p.morale-6,20,100);
 p.willingness=clamp((p.willingness==null?70:p.willingness)-8,0,100);
 unhappy++;
 logEvent(s,' 更衣室：'+p.name+'（战力 '+Math.round(ovr)+'）对出场时间公开不满（出场 '+(p.apps||0)+' 次 / 首发场均 '+ref.toFixed(1)+'）');
 if(p.willingness<=25&&!p.transferRequest){
 p.transferRequest=true;
 logEvent(s,' 转会风向：'+p.name+' 经纪人放话希望离队寻求出场——市场上他更容易被谈走');
 }
 }
 });
 // 队长离队自动摘除（被卖/退役/租借出去都会走到这）
 if(s.captain&&!(s.players||[]).some(p=>p.id===s.captain)){
 logEvent(s,' 队长袖标空缺：原队长已不在阵中，可在阵容页重新任命');
 s.captain=null;
 }
 return unhappy;
}
/* ================= 战术板 / 版本大改 / K甲下放 =================
 战术克制：双方各带一个战术倾向，克制方 ±3%（只在比赛模拟处生效，见 match.js）。
 AI 的战术按系列赛懒生成并缓存——同一场系列赛里对手战术不会变。 */
function seriesTacticEdge(s,sr){
 if(!s.tactic||s.tactic==='balanced')return 0;
 const mine=tacticById(s.tactic);
 if(!sr._opTactic)sr._opTactic=tacticById(pick(TACTICS).id).id;
 const theirs=tacticById(sr._opTactic);
 sr._myTactic=mine.id;
 return theirs.beats===mine.id?-0.03:(mine.beats===theirs.id?0.03:0);
}
/* 赛季版本大改：两名英雄一加强一削弱，持有者属性微调（影响招牌价值与 BP 优先级）。
 upN/downN 可显式指定英雄名（测试与"策划指定版本"用），缺省随机抽取 */
function applySeasonPatch(s,upN,downN){
 const cand=HEROES.filter(h=>h.pos&&h.pos.length);
 const up=(upN&&HEROES.find(h=>h.n===upN))||pick(cand);
 let down=(downN&&HEROES.find(h=>h.n===downN))||pick(cand),g=0;
 while(down.n===up.n&&g++<10)down=pick(cand);
 (s.players||[]).forEach(p=>{
 const hold=(p.sig===up.n)||(p.heroPool||[]).some(x=>x.n===up.n);
 const hurt=(p.sig===down.n)||(p.heroPool||[]).some(x=>x.n===down.n);
 if(hold){const k=pick(['lane','farm','team','mind']);p.attrs[k]=clamp(p.attrs[k]+2,40,99);}
 if(hurt){const k=pick(['lane','farm','team','mind']);p.attrs[k]=clamp(p.attrs[k]-2,40,99);}
 });
 logEvent(s,' 版本公告 '+gameYear(s)+' 赛季：「'+up.n+'」加强、「'+down.n+'」削弱——绝活选手的战力随之浮动，BP 优先级变了');
 s.patch={up:up.n,down:down.n,season:s.season};
 return s.patch;
}
/* ================= K甲联赛（二队 · 次级联赛完整版） =================
 二队常驻 K甲：8 队单循环 7 轮，每 2 天一轮，与 KPL 赛段并行推进（每赛段重新开赛）。
 下放（sendKjia）的选手进入二队阵容真实出战——每场生成 KDA/MVP 累计进
 p.kjiaStats / p.kjiaLog，「二队」页可查积分榜、赛程与表现数据。
 成长两条路：场上好表现小概率即时 +1；归队时 kjiaTick 结算 +2~4×2——都计入
 p.kjiaGain（成就「练级成功」依据）。平衡门禁的模拟不下放选手，本系统不触碰门禁校准区间。 */
const KJIA_DAYS=30;
const KJIA_AI_TEAMS=['K甲·苍穹','K甲·星火','K甲·沧澜','K甲·曜石','K甲·铁鳞','K甲·游隼','K甲·雾嶂'];
const KJIA_EVERY=2; // 每 2 天一轮（7 轮=14 天，转会期 7 天内先打 3 轮）
const KJIA_FILLER_NAMES=['冷峤','照野','束禾','闻鹿','栖迟','枕流','叩舷','扫雪','拾星','衔山','汲露','司南','执桨','引笛','泊岸','拓海','听澜','折桨','纵马','悬旌','负剑','摘星','衔烛','趁风'];
function kjiaMyName(s){return s.teamName+'二队';}
function kjiaSquad(s){ // 二队阵容 = K甲班底 + 下放选手（同一位置取战力高者出场，结算在 kjiaTeamPower）
 return ((s.kjia&&s.kjia.squad)||[]).concat((s.players||[]).filter(p=>p.kjia>0));
}
function kjiaTeamPower(s){ // 与 aiRosterPower 同刻度：五位置最强者求和 × 士气系数；次级联赛体系折算 ×0.9（无教练组）
 const r=kjiaSquad(s);
 if(!r.length)return 0;
 const best={};
 r.forEach(p=>{const v=playerPower(p,p.sig);if(best[p.pos]==null||v>best[p.pos])best[p.pos]=v;});
 let sum=0;POS_ORDER.forEach(pos=>{if(best[pos]!=null)sum+=best[pos];});
 const morale=clamp(r.reduce((t,p)=>t+(p.morale||80),0)/r.length/100,0.82,1.1);
 return Math.round(sum*morale*0.9);
}
function kjiaFiller(s,pos,used){ // 二队 K甲班底：低总值的常驻注册选手（下放的一队选手来了就顶替出场）
 const name=poolName(KJIA_FILLER_NAMES,used);used.add(name);
 const base=[0,1,2,3].map(()=>rnd(62,74));
 return genPlayer({id:'kjf_'+gameYear(s)+'_'+pos+'_'+Math.random().toString(36).slice(2,7),name,pos,team:kjiaMyName(s),tags:['K甲'],
 base,skill:{n:'次级联赛',t:pick(['lane','farm','team','mind']),d:'K甲班底选手，等一个上调一队的机会'},
 sig:pick(HEROES.filter(h=>h.pos[0]===pos)).n,career:kjiaMyName(s)+' 班底选手，常年在次级联赛征战。'});
}
function initKjia(s){ // 每个赛段（春/夏）重开一届 K甲
 const my=kjiaMyName(s);
 const teams=[...KJIA_AI_TEAMS,my];
 const powers={};
 KJIA_AI_TEAMS.forEach((t,i)=>{powers[t]=i<3?rnd(360,392):rnd(328,388);}); // 苍穹/星火/沧澜为K甲豪门（与挑战者杯赛道强度对齐）
 // 舍转法单循环：8 队 7 轮 × 4 场（与 buildGroupSchedule 同一算法）
 const rounds=[];
 const arr=teams.slice(1);
 for(let r=0;r<teams.length-1;r++){
 const ring=[teams[0],...arr],pairs=[];
 for(let i=0;i<teams.length/2;i++){const a=ring[i],b=ring[teams.length-1-i];if(a&&b)pairs.push({a,b,r:null,ms:0,es:0});}
 rounds.push(pairs);
 arr.unshift(arr.pop());
 }
 const tables={};teams.forEach(t=>tables[t]={w:0,l:0,pts:0,pw:0});
 const used=new Set((s.players||[]).map(p=>p.name));
 const squad=POS_ORDER.map(pos=>kjiaFiller(s,pos,used));
 s.kjia={teams,powers,rounds,rd:0,day:0,tables,results:[],squad,champ:null,my};
 return s.kjia;
}
function kjiaRank(s){ // K甲积分榜名次（冠军=榜首）
 const k=s.kjia;if(!k)return [];
 return Object.keys(k.tables).sort((a,b)=>k.tables[b].pts-k.tables[a].pts||k.tables[b].pw-k.tables[a].pw);
}
function kjiaPerform(s,demoted,won,m,round){ // 二队每场为下放选手结算 KDA/MVP/即时成长
 if(!demoted.length)return;
 const my=kjiaMyName(s);
 const opp=m.a===my?m.b:m.a;
 const myScore=m.a===my?m.ms:m.es,opScore=m.a===my?m.es:m.ms;
 let mvp=null,bs=-1;
 const rows=demoted.map(p=>{
 const k=rnd(1,9)+(won?1:0),d=rnd(0,5),a=rnd(0,10);
 const score=k*3+a*2-d*1.5+(won?6:2)+playerPower(p,p.sig)*0.5+rnd(0,3);
 const st=p.kjiaStats=p.kjiaStats||{apps:0,k:0,d:0,a:0,mvp:0,wins:0};
 st.apps++;st.k+=k;st.d+=d;st.a+=a;if(won)st.wins++;
 if(won&&Math.random()<0.3){const key=pick(['lane','farm','team','mind']);p.attrs[key]=clamp(p.attrs[key]+1,40,99);p.kjiaGain=(p.kjiaGain||0)+1;}
 if(score>bs){bs=score;mvp=p;}
 return {p,k,d,a};
 });
 if(mvp)mvp.kjiaStats.mvp++;
 rows.forEach(({p,k,d,a})=>{
 p.kjiaLog=p.kjiaLog||[];
 p.kjiaLog.unshift('第'+round+'轮 vs '+opp+' '+(won?'胜':'负')+' '+myScore+':'+opScore+' · '+k+'/'+d+'/'+a+(p===mvp?' · 单局MVP':''));
 p.kjiaLog=p.kjiaLog.slice(0,6);
 });
}
function kjiaNextRound(s){
 const k=s.kjia;
 const rd=k.rounds[k.rd];
 const my=k.my;
 const demoted=(s.players||[]).filter(p=>p.kjia>0);
 rd.forEach(m=>{
 const pwA=m.a===my?kjiaTeamPower(s):k.powers[m.a];
 const pwB=m.b===my?kjiaTeamPower(s):k.powers[m.b];
 let mw=0,ow=0;
 for(let i=1;i<=5&&mw<3&&ow<3;i++){if(Math.random()<winChance(pwA,pwB))mw++;else ow++;}
 m.ms=mw;m.es=ow;m.r=mw>ow?m.a:m.b;
 const ta=k.tables[m.a],tb=k.tables[m.b];
 if(m.r===m.a){ta.w++;ta.pts++;tb.l++;}else{tb.w++;tb.pts++;ta.l++;}
 ta.pw+=mw;tb.pw+=ow;
 if(m.a===my||m.b===my)kjiaPerform(s,demoted,m.r===my,m,k.rd+1);
 });
 const rep=rd.map(m=>m.a+' '+m.ms+':'+m.es+' '+m.b).join('；');
 k.results.unshift({round:k.rd+1,txt:rep});k.results=k.results.slice(0,10);
 logEvent(s,' K甲联赛（第'+(k.rd+1)+'轮）：'+rep);
 k.rd++;
 if(k.rd>=k.rounds.length)finishKjiaSplit(s);
}
function kjiaDayTick(s){ // 挂在 nextDay：日历推进 K甲轮次（旧档懒初始化，读档即有联赛）
 if(!s.kjia)initKjia(s);
 if(s.kjia.rd>=s.kjia.rounds.length)return; // 本赛段已收官，等下个赛段重开
 s.kjia.day++;
 if(s.kjia.day%KJIA_EVERY===0)kjiaNextRound(s);
}
function finishKjiaSplit(s){
 const k=s.kjia;if(!k||k.champ)return;
 const rank=kjiaRank(s);
 k.champ=rank[0];
 const myRank=rank.indexOf(k.my)+1;
 logEvent(s,' K甲联赛收官：'+k.champ+' 夺得本赛段冠军（'+k.my+' 名次：第'+myRank+'）');
 if(k.champ===k.my){
 s.fund+=80;addFans(s,2,'二队 K甲夺冠');
 (s.players||[]).filter(p=>p.kjia>0).forEach(p=>{p.morale=clamp(p.morale+5,20,100);});
 logEvent(s,' 二队 K甲夺冠！次级联赛奖金 +80万、关注度上涨（粉丝+2万）——下放练级的价值兑现了');
 }
}
function sendKjia(s,id){
 const p=(s.players||[]).find(x=>x.id===id);
 if(!p){toast('选手不在阵中');return;}
 if(p.kjia){toast(p.name+' 已在 K甲锻炼（剩余 '+p.kjia+' 天）');return;}
 if(p.injury>0){toast(p.name+' 正在伤停，无法下放');return;}
 if(p.loan){toast(p.name+' 是租借选手，不能下放 K甲');return;}
 if((s.listed||[]).some(x=>x.id===id)){toast(p.name+' 挂牌中（已有报价会一并作废），请先撤牌再下放');return;}
 s.players=s.players.filter(x=>x.id!==id||true); // 保留在册（仅离开首发）
 if(s.captain===id){s.captain=null;logEvent(s,' 队长 '+p.name+' 下放 K甲，袖标摘除');}
 const li=(s.lineup||[]).indexOf(id);
 if(li>=0)s.lineup.splice(li,1);
 p.kjia=KJIA_DAYS;
 logEvent(s,' 下放 K甲：'+p.name+'（'+POS[p.pos][0]+'）加入二队征战 K甲联赛 '+KJIA_DAYS+' 天——真实出战积累表现数据，「二队」页可查，归队时带成长回来');
 save();renderAll();
}
function kjiaTick(s){ // 每天结算一次；到期归队并成长
 (s.players||[]).forEach(p=>{
 if(!p.kjia)return;
 p.kjia--;
 if(p.kjia>0)return;
 p.kjia=0;
 const keys=['lane','farm','team','mind'];
 let gain=0;
 for(let i=0;i<2;i++){const k=keys.splice(Math.floor(Math.random()*keys.length),1)[0];const d=rnd(2,4);p.attrs[k]=clamp(p.attrs[k]+d,40,99);gain+=d;}
 p.kjiaGain=(p.kjiaGain||0)+gain; // 成就「练级成功」依据（含 K甲场上的即时成长）
 const st=p.kjiaStats;
 logEvent(s,' K甲归队：'+p.name+' 锻炼归来，属性成长 +'+gain+'（K甲累计出场 '+(st?st.apps:0)+' 场'+(st?' · 场均 '+Math.round(st.k/st.apps*10)/10+'/'+Math.round(st.d/st.apps*10)/10+'/'+Math.round(st.a/st.apps*10)/10:'')+'）');
 });
}
const PLACEMENT_TXT={p1:'冠军',p2:'亚军',p34:'四强',p56:'5-6名',p78:'7-8名',p910:'9-10名',p1112:'11-12名',p1318:'13-18名'};
function awardAnnualPts(s){
 const pts=ANNUAL_PTS[s.split]||ANNUAL_PTS.spring;
 const place=leaguePlacements(s);
 Object.keys(place).forEach(t=>{s.annualPts[t]=(s.annualPts[t]||0)+(pts[place[t]]||0);});
 s.yearStages=s.yearStages||[];
 s.yearStages.push({ev:s.split==='spring'?'春季赛':'夏季赛',place:PLACEMENT_TXT[place[s.teamName]||'p1318']}); // 成绩曲线
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
 Object.values(s.challDefMap||{}).forEach(arr=>arr.forEach(id=>{const d=defOf(s,id);if(d)used.add(d.name);}));
 (s.players||[]).forEach(p=>used.add(p.name));
 // 挑战者池只有 41 个名字，却要给 14 队 ×5=70 人命名——从前两名开始就撞名。
 // 旧写法 `CHALLENGER_NAMES[i%length]` + 序号兜底，导致每届固定出现「挑战者42…70」；
  // 现改为 poolName：优先用赛道人名池，池尽走 combName 组合名（不出现占位名）
 const name=poolName(CHALLENGER_NAMES,used);
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
 // 成绩曲线：挑杯名次入档（冠军/亚军/四强/八强/16强/32强）
 s.yearStages=s.yearStages||[];
 const chPlace=c.champ===s.teamName?'冠军':runner===s.teamName?'亚军'
 :(c.po.lbf.r&&loserOf(c.po.lbf)===s.teamName)?'四强'
 :((c.po.lbs.r&&loserOf(c.po.lbs)===s.teamName)||c.po.lb2.concat(c.po.lb1).some(m=>m.r&&loserOf(m)===s.teamName))?'八强'
 :(c.r2||[]).some(m=>m.r&&loserOf(m)===s.teamName)?'16强'
 :c.r1.some(m=>m.r&&loserOf(m)===s.teamName)?'32强':'参赛';
 s.yearStages.push({ev:'挑战者杯',place:chPlace});
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
 // 成绩曲线：EWC 名次入档
 s.yearStages=s.yearStages||[];
 s.yearStages.push({ev:'EWC电竞世界杯',place:e.champ===s.teamName?'冠军':runner===s.teamName?'亚军'
 :e.sf.some(m=>m.r&&loserOf(m)===s.teamName)?'四强'
 :e.qf.some(m=>m.r&&loserOf(m)===s.teamName)?'八强':'未晋级'});
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
 // 韩国固定在下半区 QF4（与中国的 QF1 隔开：两队最强，只能在决赛相遇）；抽签池排除韩国防重复参赛
 const others=shuffle(AG_NATIONS.filter(([n])=>n!=='韩国').map(([n])=>n).slice());
 s.ag={squad:squad.map(p=>({name:p.name,pos:p.pos,mine:ownedIds.has(p.id),ovr:overall(p)})),
 myPow,qf:[{a:'中国代表队',b:others[0],r:null},{a:others[2],b:others[3],r:null},{a:others[4],b:others[5],r:null},{a:'韩国',b:others[1],r:null}],
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
 // MVP：冠军队内战力最高者；中国队夺冠时从「实际出征名单」（锁定快照）里评——不能用当下重选，
 // 否则夏窗后的联盟变化可能评出一个没入选国家队的选手
 if(a.champ==='中国代表队'){
 const best=a.squad.slice().sort((x,y)=>y.ovr-x.ovr)[0];
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
 if(a.squad.some(x=>x.mine)){ // 成绩曲线：本队有选手出征才记亚运
 s.yearStages=s.yearStages||[];
 s.yearStages.push({ev:'亚运会',place:a.medal==='金牌'?'金牌':a.medal==='银牌'?'银牌':a.medal==='铜牌'?'铜牌':'无奖牌'});
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
 addFans(s,p.champ===s.teamName?25:(runner===s.teamName?12:6),'KPL 年度总决赛'); // 年总是全年最大的曝光
 }
 // 成绩曲线：年总名次入档
 s.yearStages=s.yearStages||[];
 if(p&&p.final.r){
 const loserOf=m=>m.r===m.a?m.b:m.a; // 块内局部（冠军结算分支的同名工具）
 const myPlace=p.champ===s.teamName?'冠军':loserOf(p.final)===s.teamName?'亚军'
 :[p.lbf,p.lbs].some(m=>m.r&&loserOf(m)===s.teamName)?'四强'
 :p.lb2.concat(p.lb1).some(m=>m.r&&loserOf(m)===s.teamName)?'八强':'参赛';
 s.yearStages.push({ev:'KPL年度总决赛',place:myPlace});
 }else s.yearStages.push({ev:'KPL年度总决赛',place:'未晋级'});
 boardSettle(s); // 董事会结算：按本赛季年度积分排名评价（必须在 newSeason 前——此时 s.season 仍是刚结束那年）
 buildYearReview(s); // 年度回顾快照：成绩曲线/转会记录/董事会评价/关键战役（必须在 newSeason 前）
 newSeason(s); // 年度轮换：年龄/合同/退役结算 → 下一年春季赛
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
 recordTransfer(s,'in',p,p.signCost,'自由球员','自由市场直签'); // 年度回顾·转会台账
 logEvent(s,' 自由市场签下 '+p.name+'（无球可打选手 · 签约费 '+p.signCost+'万）');
 save();renderAll();toast(p.name+' 加盟！');
}
