/* 联赛核心：赛程/赛段/季后赛/日结/工资/王朝/最佳阵容/年度轮换/积分/赛历（season.js 机械拆出） */

/* ================= 比赛与联赛（KPL 2025 官方赛制） =================
 常规赛4阶段：第一轮(3组单循环BO5)→第二轮(S/A/B)→卡位赛(BO5含巅峰对决)→第三轮(S/A单循环BO5)
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
const gameYear=s=>{
 // 历代/生涯选了时代：从该时代元年起算（2017 档 season1=2017）；现役缺省 2026
 if(s&&s.era&&KPL_ERAS[s.era]&&KPL_ERAS[s.era].year){
  const y0=parseInt(KPL_ERAS[s.era].year,10);
  if(!isNaN(y0))return y0+((s.season||1)-1);
 }
 return 2025+(s.season||1); // 赛季序号=年份偏移：season1 = 2026年
};
const splitLabel=s=>gameYear(s)+' '+(SPLIT_NAME[s.split]||'春季赛');
function leaguePayout(s,place){
 const map={'冠军':830,'亚军':500,'四强':250,'八强':133}; // 联盟版权/商务分润（真实对齐 ÷6）：按成绩加权、非平均分配
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
function logEvent(s,txt){(s.eventLog=s.eventLog||[]).unshift({txt,t:Date.now(),level:logLevel(txt),cat:logCat(txt)});s.eventLog=s.eventLog.slice(0,200);} // 200：newSeason 的 AI 转会/青训日志很多，120 会把王朝反制等玩家向文案挤掉
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
 if(!s||!s.groups)return null; // 读档残缺/迁移中途：不能在渲染里炸成整页空白
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
 // L2b：常规赛对阵也发 mid 并登记进扁平表，与卡位/季后/杯赛同一套权威键（P2-7）
 s.schedule=opps.map((op,i)=>({round:i+1,opp:op,result:null,myScore:0,opScore:0,mid:'reg_'+(s.phase||'r1')+'_'+(i+1)}));
 s.matchIdx=0;
 try{(s.schedule||[]).forEach(m=>{if(m.mid)tagMatch(s,m,m.mid);});}catch(e){}
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
/* ===== 卡位赛（BO5 含巅峰对决）=====
   2026 春季赛公开报道口径：卡位赛在常规赛第二轮进行、BO5，胜者进第三轮 S 组、负者淘汰。
   旧版按 BO7 打（生死战给了 7 局），BO 数现收进 KPL.CARD 单点，为按年代切换赛制留好口子。 ===== */
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
 s.card.matches.forEach(m=>{if(!m.r){const r=simSeriesResult(s,m.a,m.b,KPL.CARD);m.r=r.win?m.a:m.b;}});
 s.card.idx=s.card.matches.length;
 finishCard(s);
 save();renderAll();
 return;
 }
 const playerIn=s.card.matches.some(m=>m.a===s.teamName||m.b===s.teamName);
 logEvent(s,' 卡位赛（BO5·含巅峰对决）即将开始！');
 if(!playerIn){
 s.card.matches.forEach(m=>{const r=simSeriesResult(s,m.a,m.b,KPL.CARD);m.r=r.win?m.a:m.b;});
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
 if(s.mode==='player'){ // 选手生涯：教练指挥，自动打卡位赛（走 finishSeries：结算弹窗 + 延后推进）
 tagMatch(s,m,'card_'+s.card.idx);
 playerPlayAndFinish(s,opName,KPL.CARD,{stage:'card',mid:'card_'+s.card.idx,cardIdx:s.card.idx,_match:m});
 return;
 }
 // 系列赛中断恢复（P2-7 校验身份）：mid 不属于当前卡位场次 = 僵尸系列赛——
 // 续打它会用旧比分把结果写进错误对阵，必须废弃重开
 if(s.series&&s.series.stage==='card'){
 if(!s.series.mid||s.series.mid==='card_'+s.card.idx){
 showPreMatch('卡位赛（BO5·含巅峰对决）vs '+opName+' · 第'+(s.series.mw+s.series.ow+1)+'局（'+s.series.mw+':'+s.series.ow+'）');
 return;
 }
 logEvent(s,'⚠ 赛程修复：废弃未同步的卡位赛残影（'+s.series.mid+'），本场重新开打');
 console.warn('stale card series discarded',s.series.mid,s.card.idx);
 s.series=null;
 }
 tagMatch(s,m,'card_'+s.card.idx);
 // L2：series 只留 mid（权威键），不再挂 cardMatch 对象引用——写结果一律 resolveSeriesMatch
 s.series={used:[],usedOpp:[],mw:0,ow:0,max:KPL.CARD,stage:'card',mid:'card_'+s.card.idx,cardIdx:s.card.idx,logs:[],myName:m.a===s.teamName?m.a:m.b,opName,side:firstSide(s,'card',opName)};s.seriesAuto=false;
 resetOppEnergy(s,opName);
 showPreMatch('卡位赛（BO5·含巅峰对决）vs '+opName+' · 第1局');
 }else{
 const r=simSeriesResult(s,m.a,m.b,KPL.CARD);
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
 if(!m.r){const r=simSeriesResult(s,m.a,m.b,KPL.CARD);m.r=r.win?m.a:m.b;}
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
/* 确保本赛季联赛冠军已产生（玩家止步/中途淘汰时季后赛可能尚未补完）。
   挑杯/EWC/年总赛历推进依赖春冠/春亚种子——这里 AI 补完季后赛，避免 advanceCalendar 卡死。 */
function ensureLeagueChampion(s){
 if(!s)return null;
 let p=s.playoff;
 if(p&&p.final&&p.final.r)return p;
 // 开档 G1/G2/G3 未重组为 S/A 时，先按战力排出 S/A，否则 buildPlayoff 直接退出
 if(!s.groups||!s.groups.S||!s.groups.S.length){
  const all=(s.leagueTeams&&s.leagueTeams.length?s.leagueTeams.slice():AI_TEAMS.map(t=>t.name))
   .filter(t=>t!==s.teamName)
   .concat(s.teamName?[s.teamName]:[]);
  const ranked=all.slice().sort((a,b)=>powerOf(s,b)-powerOf(s,a));
  s.groups={S:ranked.slice(0,6),A:ranked.slice(6,12),B:ranked.slice(12,18)};
 }
 if(!p||!p.wb){
  try{buildPlayoff(s);}catch(e){s._poError='buildPlayoff: '+(e&&e.message||e);console.warn('buildPlayoff fail',e);}
  p=s.playoff;
 }
 if(!p)return null;
 let guard=0;
 while(!(p.final&&p.final.r)&&guard++<25){
  try{playoffStep(s);}catch(e){s._poError='playoffStep: '+(e&&e.message||e);console.warn('playoffStep fail',e);break;}
  p=s.playoff;
  if(!p)break;
 }
 if(p&&p.final&&!p.final.r){
  // 极端残局（对阵树缺口）：按 S/A 排名直接指定冠军，保证赛历可推进。
  // 兜底本身是设计内的，但必须留痕——否则重建期真 bug（mid 找不到/引用失效）会伪装成一次正常收官。
  const ranks=[...sortGroup(s,'S'),...sortGroup(s,'A')];
  const champ=ranks[0]||s.teamName;
  const runner=ranks[1]||champ;
  p.final.a=p.final.a||champ;
  p.final.b=p.final.b||runner;
  p.final.r=p.final.r||champ;
  p.champ=p.final.r;
  s.champion=p.final.r===s.teamName;
  const ourFinal=p.final.a===s.teamName||p.final.b===s.teamName;
  if(s.champion||ourFinal){if(s.phase!=='eliminated')s.phase='champion';}
  else s.phase='eliminated';
  try{logEvent(s,' 季后赛残局补完：'+p.final.r+' 夺得 '+splitLabel(s)+' 冠军'+(s._poError?'（推进异常：'+s._poError+'）':''));}catch(e){}
 }
 return (p&&p.final&&p.final.r)?p:null;
}
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
 s.titleHistory=(s.titleHistory||[]).concat([{season:s.season,split:s.split||'spring',event:SPLIT_NAME[s.split]||'春季赛',champ:p.final.r}]).slice(-48); // 王朝统计（连冠反制用，一年两冠按时间序）
 s.champion=p.final.r===s.teamName;
 const ourFinal=p.final.a===s.teamName||p.final.b===s.teamName;
 // 玩家未进决赛=赛季止步；打进决赛无论冠亚都是「赛季结束」
 if(s.champion||ourFinal){if(s.phase!=='eliminated')s.phase='champion';}
 else s.phase='eliminated';
 if(s.champion||ourFinal)recordSeason(s); // 冠军/亚军均入册荣誉室
 if(s.champion){
 // 夺冠人气暴涨：全队商业价值提升（代言收入增加）
 s.players.forEach(p=>p.popularity=Math.min(99,(p.popularity||0)+5));
 logEvent(s,' 夺冠带来巨大曝光！全队选手人气+5，代言收入提升');
 registerChampCore(s,splitLabel(s)+' 总冠军'); // 冠军班底羁绊：记下夺冠首发
 }
 else if(p.final.r)registerAiChampCore(s,p.final.r); // AI 夺冠：记入 AI 冠军班底（按难度档加成）
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
 if(s.mode==='player'){ // 选手生涯：教练指挥，自动打季后赛系列赛（走 finishSeries：结算弹窗 + 延后推进）
 tagMatch(s,m,'po_'+slot);
 playerPlayAndFinish(s,opName,KPL.BO7,{stage:'po',mid:'po_'+slot,poSlot:slot,_match:m});
 return;
 }
 // 系列赛中断恢复（P2-7 校验身份）：poSlot 不属于当前场次 = 僵尸系列赛，废弃重开
 if(s.series&&s.series.stage==='po'){
 if(!s.series.poSlot||s.series.poSlot===slot){
 showPreMatch((slot==='总决赛'?'总决赛':'季后赛')+'（BO7·含巅峰对决）vs '+opName+' · 第'+(s.series.mw+s.series.ow+1)+'局（'+s.series.mw+':'+s.series.ow+'）');
 return;
 }
 logEvent(s,'⚠ 赛程修复：废弃未同步的季后赛残影（'+s.series.poSlot+'），本场重新开打');
 console.warn('stale po series discarded',s.series.poSlot,slot);
 s.series=null;
 }
 tagMatch(s,m,'po_'+slot);
 // L2：series 只留 mid，不再挂 poMatch 对象引用
 s.series={used:[],usedOpp:[],mw:0,ow:0,max:7,stage:'po',mid:'po_'+slot,poSlot:slot,logs:[],myName:m.a===s.teamName?m.a:m.b,opName,side:firstSide(s,'playoff',opName)};s.seriesAuto=false;
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
 s.day++;
 // 怠政判定必须排在清旗标之前：四个每日行动位 + 当天打过比赛，是「玩家这一天动没动手」的全部痕迹。
 // 放在 reset 之后就永远读到 false，等于把所有玩家都判成挂机。
 const acted=s.trained||s.marketRefreshed||s.academyTrained||s.socialUsed||((s._actedDay||0)>=s.day-1);
 s.idleDays=acted?0:((s.idleDays||0)+1);
 s.trained=false;s.marketRefreshed=false;s.academyTrained=false;s.socialUsed=false;
 kjiaTick(s); // K甲下放倒计时：到期归队并成长
 kjiaDayTick(s); // K甲联赛：二队每 2 天一轮，下放选手真实出战
 if(s.mode==='player'){
  tickPlayerBench(s); // 选手板凳计数（自请租借/K甲的门槛）
  if(typeof playerMediaDayTick==='function')playerMediaDayTick(s); // 偶发媒体邀约
 }
 loanOutTick(s); // 任何外租选手日结（选手自请 + 俱乐部外租共用）
 natCampTick(s); // 亚运集训日结：征召选手在国家队合练涨状态
 if(typeof clubRelTick==='function')clubRelTick(s); // 战队关系事件（媒体/股东/赞助/更衣室）
 s.fund+=dailyCommercialIncome(s); // 赞助商每日结算 + 门票/周边（两者都随粉丝上浮）
 if(s.hosts&&s.hosts.length)s.fund+=s.hosts.reduce((t,h)=>t+h.income,0); // 退役主播人气收入
 if(s.transferWindow>0){
 s.transferWindow--;
 aiBidTick(s); // AI 队对挂牌选手报价
 if(s.transferWindow===0){
 endTransferWindow(s);
 if(s.preseason){
 // 经理模式：窗耗尽前缺位自动补签，避免「五位置空、转会窗关、开赛卡死」
 if(s.mode!=='player'&&s.mode!=='coach'){
  try{ensureSeasonRoster(s);}catch(e){}
 }
 const missPos=POS_ORDER.filter(pos=>!(s.players||[]).some(p=>p.pos===pos&&!p.loan));
 if(missPos.length){
  s.transferWindow=3;
  logEvent(s,' 转会窗原定关闭，但 '+missPos.map(pos=>POS[pos][0]).join('、')+' 仍无人——自动延长 3 天，请尽快签约');
 }else{
  s.preseason=false;
  try{if(typeof draftForceFinish==='function')draftForceFinish(s);}catch(e){} // 同上：没打完的选秀必须收官
  logEvent(s,' 赛前转会期结束（天数用完），联赛正式开始！');
 }
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
 // 签到补贴改成「履约奖励」：只有当日做过经营动作才发。原来每 3 天无条件 +80 万，
 // 60 天纯挂机白拿 1600 万——那是"什么都不干也暴富"的头号来源（实测占挂机净收益 72%）
 if(s.day%3===0&&s.idleDays===0){s.fund+=80;toast('赞助补贴到账 +80万（当日有经营动作）');}
 // 随机事件：连续怠政满一周就不再抽"好事"——赞助商追加、粉丝应援、青训惊喜这些正期望事件
 // 需要一个还在运转的俱乐部做基本盘；顺带把纯挂机的收益方差压下来（门禁才能钉得住）
 if(Math.random()<0.65&&s.players.length&&s.idleDays<2){
 const ev=pick(EVENTS);
 const tp=pick(rosterAll(s)); // 公告文案与效果作用同一名选手
 const txt=ev.desc.replace('{p}',()=>tp.name);
 ev.fn(s,tp);
 logEvent(s,' 【'+ev.t+'】'+txt);
 }
 // 董事会压力：整周不决策不可能没有反馈。此前实测挂机 60 天 trust 恒 60、warn 恒 0，
 // KPI 系统对"什么都不干"完全无感。走 applyBoardTrust 单一出口（选手生涯自动豁免、上下限受钳）
 if(s.idleDays>0&&s.idleDays%5===0&&typeof applyBoardTrust==='function'){
  applyBoardTrust(s,-2,'连续 '+s.idleDays+' 天没有训练/转会/比赛动作');
 }
 // 怠政事件独立小池，只在 idleDays 达标时抽——正常玩永远碰不到，不污染既有 EVENTS 的期望
 if(s.idleDays>=10&&s.idleDays%10===0){ // 每满 10 天怠政必发一次，不搞骰子——后果要可预期，方差也要压得住（门禁才钉得稳）
  const ev=pick(IDLE_EVENTS);
  const tp=pick(rosterAll(s)); // 与 EVENTS 同一口径：文案里的 {p} 与效果作用同一名选手
  logEvent(s,' 【'+ev.t+'】'+(ev.desc||'').replace('{p}',()=>tp?tp.name:'队内核心'));
  ev.fn(s,tp);
 }
 if(s._quietSave)return; // 批量跳过（转会期 skip）：由外层统一 save，避免 30 次全量序列化
 save();
}
function payWage(s){
 try{scrubWages(s);}catch(e){}
 const wage=weeklyWage(s);
 // 选手代言收入：人气 × ENDORSE_PER_POP 万/周 × 粉丝系数（商业价值对冲工资帽压力）
 // 注意：×3 是旧千万级刻度残留——在现役「万」单位下会把基金刷爆（5 人人气 40 → 周入 600 万，远超周薪）
 const endorse=Math.round((s.players||[]).reduce((t,p)=>t+((p.popularity||0)*ENDORSE_PER_POP),0)*fanMul(s,300));
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
 if(typeof s.fund!=='number'||!isFinite(s.fund))s.fund=0; // 防 NaN 写入存档（JSON 会变 null）
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
 if(s.mode==='player'&&s.career&&t1.some(x=>x.p.id===s.career.me)){
 s.career.allstar=(s.career.allstar||0)+1;
 logEvent(s,' 你入选了赛季最佳阵容一阵——生涯履历再添一笔');
 }
 logEvent(s,' KPL 赛季最佳阵容揭晓：一阵——'+t1.map(x=>POS[x.p.pos][1]+' '+x.p.name+'（'+x.team+'）').join('、'));
 logEvent(s,' 二阵——'+t2.map(x=>POS[x.p.pos][1]+' '+x.p.name+'（'+x.team+'）').join('、'));
}
function newSeason(s){
 /* 年度轮换（仅在年度总决赛结束后调用）：年龄/合同/退役/工资帽结算 + 开启新赛季春季赛。
 夏季赛不经过此函数（年中不做年龄与合同结算），由 startSplit 直接开启。 */
 try{localStorage.setItem(slotKey()+'_auto',serializeForSave(s));}catch(e){} // 赛季轮转自动备份（roguelike 惯例）：误触重置/存档损坏可回滚上一年
 try{recordSeasonAwards(s);}catch(e){logEvent(s,' 最佳阵容结算异常：'+(e&&e.message)+'（不影响赛季轮换）');} // 上赛季最佳阵容入册（趁阵容还没跨季老化）；失败不得挡住 newSeason
 s.season++;s.day=1;s.trained=false;s.marketRefreshed=false;
 s.pick={}; // 清掉上赛季末的英雄选择残留（BP 确认后才会重新写入）
 s._poError=null; // 季后赛异常标记按赛季归零：干净走完的赛季必须保持为空（诊断用，勿静默）
 s.academyTrained=false;
 // 亚运会状态归零：仅当届有效（防 agDone 跨年残留导致下一届亚运年不触发）
 s.agDone=false;s.ag=null;s.natSquad=null;s.natCampIds=[];s.natAnnounced=false;s.natCampDay=0;
 s.players.forEach(p=>{p.natCamp=false;p.natFill=false;p.natCampForm=0;});
 // 年龄增长：黄金期属性成长，下滑期按位置衰减，达到位置退役年龄离队
 const retired=[];
 s.players.forEach(p=>{
 p.age=(p.age||0)+1;
 const m=AGE_MODEL[p.pos]||AGE_MODEL.mid;
 const key=pick(['lane','farm','team','mind']);
 if(p.age<=m.gold){
 // 黄金期：属性小幅上探，受个人天花板约束（不无限涨）
 if(typeof ensurePlayerPeak==='function'){
  const pk=ensurePlayerPeak(p);
  if(p.attrs[key]<(pk[key]!=null?pk[key]:99))p.attrs[key]=clamp(p.attrs[key]+1,55,99);
 }else p.attrs[key]=clamp(p.attrs[key]+1,55,99);
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
 if(s.mode==='player'){
 const me=myPlayer(s);
 if(me){
 if(me.contract<=0&&!s.career.pendingMove){ // 选手模式无转会期：俱乐部自动续约（薪资随身价上浮）
 me.contract=1;
 const nw=Math.max(me.wage,Math.round(me.wage*1.1)+1);
 if(nw>me.wage){me.wage=nw;logEvent(s,' 俱乐部与你续约 1 年：周薪涨至 '+me.wage+'万');}
 }
 if(me.age>=(AGE_MODEL[me.pos]||AGE_MODEL.mid).retire&&!s.career.retired){
 s.career.retired=true;
 const titles=s.career.titles||0;
 logEvent(s,' 退役声明：'+me.name+'（'+me.age+' 岁）宣布退役——'+s.career.seasons.length+' 个赛季 · '+titles+' 冠，职业生涯画上句号（生涯页可查看完整履历）');
 }
 }
 }
 // 赛季结算：表现溢价回归 + 黄金期后年龄贬值 + 续约涨薪（堵"身价只涨不跌"的无风险套利）
 s.players.forEach(p=>{
 const m=AGE_MODEL[p.pos]||AGE_MODEL.mid;
 p.val=clamp(Math.round((p.val||100)*0.7+30),70,150); // 表现溢价逐年回归：不持续打出表现就跌回（||100：未上过场的替补没有 val，避免算出 NaN）
 if(p.age>m.gold)p.val=clamp(p.val-(p.age-m.gold)*4,70,150); // 过黄金期：身价随年龄贬值
 if(p.age>=m.retire-1)p.val=clamp(p.val-8,70,150); // 临近退役：额外折价
 if(p.val>=120){ // 巅峰表现 → 续约涨薪（工资帽压力随成绩增长）
 if(typeof p.wage!=='number'||!isFinite(p.wage)||p.wage<0){try{p.wage=Math.max(2,Math.round(wageOf(overall(p))));}catch(e){p.wage=2;}}
 const nw=Math.min(Math.round(p.wage*1.15)+1,Math.round(wageOf(overall(p))*1.5));
 if(isFinite(nw)&&nw>p.wage){p.wage=nw;logEvent(s,' 赛季结算：'+p.name+' 续约涨薪至 '+nw+'万/周');}
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
 // 本人退役：不进名宿市场；写快照供退役结算屏（me 已从名单移除，不能再靠 myPlayer）
 if(s.mode==='player'&&s.career&&p.id===s.career.me){
 s.career.coachPath=true;
 s.career.legacy={name:p.name,age:p.age,pos:p.pos,ovr:overall(p),
 mvp:p.mvp||0,titles:s.career.titles||0,fmvp:s.career.fmvp||0,
 allstar:s.career.allstar||0,seasons:(s.career.seasons||[]).length};
 logEvent(s,' 教练组向你发出邀请：退役后可转型执教——生涯页可选择「退役转教练」开启执教生涯');
 }else{
 // 退役去向：转教练（按实力给战力加成）或 转型主播（俱乐部人气收入）
 retireToCoach(s,p);
 }
 });
 // 王朝反制②：连冠队伍工资帽成长减半（保住豪华阵容越来越难）
 const st=dynastyStreak(s,s.teamName);
 const capGrow=st>=2?3:6; // 正常 +6；王朝 +3（约一半）
 s.wageCap=(s.wageCap||150)+capGrow;
 // 王朝反制③：版本针对——力度随连冠次数加码
 if(st>=2){
 logEvent(s,' 联盟公平条款：'+s.teamName+' 已'+st+'连冠，新赛季工资帽成长减半（+'+capGrow+'万，正常 +6）');
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
 s.fund+=220; // 联盟赛季启动金（年度轮换只发一次）
 logEvent(s,' 联盟调整工资帽：本周薪上限 '+s.wageCap+'万 · 赛季启动金 +220万');
 s.annualPts={}; // 新一年：年度积分清零（春夏重新累计）
 s.yearStages=[]; // 成绩曲线同一年度清零（回顾已快照进 yearReviews）
 s._annualSettled=false; // 年结锁复位：不清则第2年起 boardSettle/履历/豪门邀约整段被跳过
 s._afterMatch=null; // 挂起推进是函数，本就不进存档；内存里也清干净
 if(s.mode==='coach'&&s.coachDeal){
 s.coachDeal.years=Math.max(0,(s.coachDeal.years||0)-1); // 执教合同年数递减
 if(s.coachDeal.years===0)s.coachDeal.log.unshift({year:gameYear(s),note:'合同到期，待续约或自由身'});
 }
 applySeasonPatch(s); // 赛季版本大改：两名英雄一增一削，持有者属性微调（自写 s.patch）
 dressingRoomCheck(s); // 更衣室年检：坐穿板凳的高战力替补不满/要求离队；队长离队自动摘袖标
 mentorSeasonSettle(s); // 老将带新：新人属性成长 + 老将人气（更衣室关系）
 boardApplyEffect(s); // 董事会：下赛季的干预（砍帽）或特权（追加预算）按月生效
 setBoardKpi(s); // 下发本赛季董事会目标（依据上一年年度积分排名）
 try{gcDefs(s);}catch(e){} // 年度轮换：清杯赛临时 def / 退役 def / 青训幽灵
 try{if(typeof settleTempSeats==='function')settleTempSeats(s);}catch(e){} // 临时席收回/顶上
 startSplit(s,'spring');
}

/* 开启一个联赛赛段（春季/夏季）：转会期 + 分组 + 赛程。
 年龄/合同/退役/工资帽结算只在年度轮换（newSeason）做，夏季赛年中直开（不老化）。 */
function startSplit(s,split){
 s.split=split;s.streak=0;s.upsetBoost=0;s.fumbleBoost=0;s.stage='regular';
 if(s.mode==='player'||s.mode==='coach'){ // 选手/教练：无转会期——俱乐部层面自动运转
 if(s.mode==='coach')coachAutoSquad(s); // 俱乐部自动引援与续约（教练只管用）
 if(s.mode==='player'){
 applyPlayerMove(s); // 赛段间转会：接受报价后在此正式加盟新队
 coachAutoSquad(s); // 俱乐部同样自动续约/补缺——选手只管自己，班底不能散架
 }
 try{autoFillLineup(s);}catch(e){} // 自动运营后立刻补齐首发空位（教练/选手退役空位不能拖到开赛）
 s.pick={};
 // 亚运征召必须与经理模式同规则：夏赛开打前宣布并自动换下集训选手，否则选手/教练档永远打满夏季赛
 if(split==='summer'&&isAsiadYear(s)&&!s.natAnnounced)announceNatCamp(s);
 aiTransferWindow(s); // AI 俱乐部生态照常演化
 s.aiRosters={};s.aiInj={};
 initGroups(s);
 initKjia(s);
 logEvent(s,' '+splitLabel(s)+' 开幕！'+(s.mode==='player'?'打出表现：首发、身价与报价都由数据说话':'带队出成绩：目标 '+SPLIT_NAME[split]+' 冠军'));
 save();renderAll();
 return;
 }
 if(split==='summer')s.fund+=133; // 夏季赛启动金（春季 220 万在年度轮换时发放）
 s.transferWindow=fmtOf(s).transferDays;s.transferWindowStart=s.transferWindow;s.preseason=true;s.windowSold=0; // 赛前转会期 7 天：前4自由交易+后3挂牌期
 s.reserveUsed=0; // 自留签每季刷新
 if(s.reserveSlots==null)s.reserveSlots=2;
 try{if(typeof initTempSeats==='function')initTempSeats(s);}catch(e){}
 try{if(typeof youthDirectEntry==='function')youthDirectEntry(s);}catch(e){}
 s.pick={};
 aiTransferWindow(s); // AI 转会期：退役结算/缺位补强/明星流转/新星出道/换帅（联盟生态推进）
 buildTransferMarket(s); // 构建转会市场（AI 队选手 + 非卖品）
 s.aiRosters={}; // 对手阵容重建
 s.aiInj={}; // 伤停清零
 initGroups(s);
 initKjia(s); // 二队 K甲联赛：每个赛段重开一届（独立赛程+积分榜，二队页可查）
 try{if(typeof initDraft==='function')initDraft(s);}catch(e){} // 选秀大会：新秀池 + 倒序点名
 if(split==='summer'&&isAsiadYear(s)&&!s.natAnnounced)announceNatCamp(s); // 亚运年夏季：先宣布国家队征召（集训缺席整季）
 logEvent(s,' '+splitLabel(s)+' 赛前转会期开启（7天）：可买断/挂牌/直签选手与教练，市场每日首刷免费（再刷 5 万/次）；结束转会期后联赛开打');
 logEvent(s,' '+splitLabel(s)+' 开始！18队 S/A/B 赛制，目标：'+SPLIT_NAME[split]+'总冠军（年度积分 +'+ANNUAL_PTS[split].p1+'）！');
 save();renderAll();
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
 if(s.mode==='player'&&s.career&&winner.id===s.career.me){s.career.fmvp=(s.career.fmvp||0)+1;logEvent(s,' 这是你的 FMVP——生涯荣誉室再添一笔');}
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
