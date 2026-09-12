
/* ================= 游戏状态与存档 ================= */
/* 存储键名里的 v3 是历史遗留：键名不能跟着 SAVE_VERSION 走，否则旧档直接"消失"。
   结构升级靠 MIGRATIONS 迁移链在读取时完成（v3 档 → v4 档）。 */
const SAVE_KEY='esport_manager_save_v3';
const SAVE_VERSION=4; // 存档结构版本：结构变更时在 MIGRATIONS 追加迁移步骤并递增，旧档读入自动升级
const MIGRATIONS={
 // 3→4：董事会/信任度 + 开局剧本（旧档补默认值：中性信任度 60、执教生涯从零计、剧本按常规）
 3:(s)=>{
  s.board={trust:60,kpi:null,warn:0,fired:false,firedSeason:0,log:[]};
  s.managerCareer={years:0,titles:0,lastRank:null};
  s.scenario='normal';
  s.fans=8; // 老档给一个中性起始粉丝（新房由 initFans 按阵容人气算）
 },
};
let curSlot=parseInt(localStorage.getItem('esport_manager_curslot')||'1',10)||1;
function slotKey(){return SAVE_KEY+(curSlot>1?'_'+curSlot:'');}
function b64e(s){const bytes=new TextEncoder().encode(s);let bin='';bytes.forEach(b=>bin+=String.fromCharCode(b));return btoa(bin);}
function b64d(s){const bin=atob(s);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new TextDecoder().decode(bytes);}
let S=null; // 全局状态

/* ================= 预防性守卫（防误碰/空档/连点） =================
  UI 入口用：requireSave 挡未开局操作；confirmDanger 挡高代价点击；
  uiDebounce 挡连点重复触发。引擎层保持无 UI 依赖（门禁可直接驱动）。 */
function requireSave(what){
 if(!S||!S.players||!S.players.length){
 try{toast('尚未开局，'+(what||'该操作')+'不可用');}catch(_){}
 return false;
 }
 return true;
}
function confirmDanger(msg){
 try{return typeof confirm==='function'?!!confirm(msg):true;}catch(e){return true;}
}
const _uiArm=Object.create(null);
function uiDebounce(key,ms){
 const now=Date.now();
 const gap=ms||450;
 if(_uiArm[key]&&now-_uiArm[key]<gap)return true; // 连点中：应拦截
 _uiArm[key]=now;
 return false;
}

function newState(teamName,icon){
 return {
 teamName,icon,crest:null,v:SAVE_VERSION,season:1,day:1,fund:1300,sponsorLv:0,moneyScaled:true,econReal:true,
 honors:[], // 历史荣誉（多赛季）
 stage:'regular',phase:'r1',matchIdx:0,wageCap:150,streak:0,transferWindow:0,preseason:false, // 工资帽/连胜手感/转会窗/赛前转会期
 players:[],lineup:[],market:[],
 schedule:[],groups:{},tables:{},aiPower:{},card:null,playoff:null,eliminated:[],
 eventLog:[],trained:false,marketRefreshed:false,academyTrained:false,champion:false,
 academy:[],history:[],transferList:[],listed:[],bids:[],
 pick:{}, // 当前 BP 选定的英雄 {top:'花木兰',...}
 series:null, // 当前系列赛 {used:[],mw,ow,max,stage,oppName,logs,myName,opName,idx}
 coach:null,coachMarket:[],assistants:[], // 主教练 + 教练市场 + 助教组（上限2）
 aiRosterDefs:null,extraDefs:[],retiredDefs:[], // AI 转会生态：AI 队在册 def 映射 / 新星 def / 已退役 def
 split:'spring',annualPts:{}, // 年度赛历：春/夏双赛段 + 年度积分（春夏累计，前12进年总）
 ewc:null,annual:null, // EWC 电竞世界杯 / KPL 年度总决赛 赛段状态
 challenger:null, // 挑战者杯（春→挑杯→EWC→夏→年总）
 fmvpHonor:[],cardLosers:[], // 历届 FMVP / 卡位赛败者（年度积分名次判定用）
 achieved:{},selfBuilt:false,maxSale:0, // 成就（id→解锁年份）/ 自建开局标记 / 单笔出售纪录
 // 董事会：信任度 0-100 / 本赛季 KPI / 连续未达成次数 / 下课标记 / 每季结算记录
 board:{trust:60,kpi:null,warn:0,fired:false,firedSeason:0,log:[]},
 // 执教生涯（下课结算页与 KPI 依据）：年数 / 冠军数 / 上年年度积分排名
 managerCareer:{years:0,titles:0,lastRank:null},
 scenario:'normal', // 开局剧本（难度档）：normal/debt/exodus/cap/cursed —— 见 data.js SCENARIOS
 mode:'manager', // 游戏身份：manager=经理（全权经营）/ player=选手生涯（扮演一名选手）/ coach=教练生涯（只管竞技）
 career:null, // 选手生涯数据（mode=player）：{me:选手id,seasons:[],titles:0,fmvp:0,allstar:0,nat:0,retired:false,pendingMove:null}
 coachDeal:null, // 教练执教履历（mode=coach）：{years:0,honors:[],log:[]}
 fans:0, // 粉丝数（万）：由成绩与选手人气驱动，反过来放大赞助单价/门票/代言并作为赞助升级门槛
 captain:null, // 队长（选手 id）：全队战力小幅加成 + 士气激励，离队自动摘除
 kjia:null, // K甲联赛（二队）：独立赛程/积分榜/二队班底，每赛段重开——见 season.js「K甲联赛」
 offers:[], // 赛中转会报价（表现火热选手被挖角）：留人/放人/抬价三选——见 transfer.js
 transfers:[], // 转会台账（买入/卖出/放走）：年度回顾·转会记录数据源
 yearReviews:[], // 年度回顾（每年一份快照）：成绩曲线/转会记录/董事会评价/关键战役
 yearStages:[], // 本年度各赛段名次（成绩曲线数据源，年度轮换清零）
 };
}
function rosterAll(s){return s.players;}
function rosterLineup(s){const set=new Set(s.lineup);return s.players.filter(p=>set.has(p.id));}
function rosterBench(s){const set=new Set(s.lineup);return s.players.filter(p=>!set.has(p.id));}
function myPlayer(s){return (s&&s.mode==='player'&&s.career)?s.players.find(p=>p.id===s.career.me)||null:null;} // 选手生涯：我扮演的选手
/* 夺冠阵容快照：冠军/亚军入册时记录当时的首发名单（荣誉室可回看"这冠是谁打下来的"） */
function titleRoster(s){
 try{return rosterLineup(s).map(p=>p.name).join('、')||'—';}catch(e){return '';}
}
function moraleAll(s,v){s.players.forEach(p=>p.morale=clamp(p.morale+v,20,100));}
/* 选手当前选用英雄（未 BP 时默认招牌） */
function pickedHero(s,p){return (s.pick&&s.pick[p.pos])||p.sig;}
function heroOf(heroId){return HERO_BY_NAME[heroId]||null;} // Map 索引（data.js 建），原线性 find 是最热查询
function heroAtPos(heroId,pos){const h=heroOf(heroId);return h&&h.pos.includes(pos)?h:null;}
/* 当前战术权重：玩家在战术板选了战术就用它的权重（四维总和恒 1），否则用标准权重。
 S.tacticW 只由战术板写入——平衡门禁的模拟不设置，战力体系对门禁保持原样。 */
function tacticWeights(){
 const t=(typeof S!=='undefined'&&S&&S.tacticW)?S.tacticW:null;
 return t||BASE_W;
}
function playerPower(p,heroId){
 const a=p.attrs;
 const w=tacticWeights();
 let pow=a.lane*w.lane+a.farm*w.farm+a.team*w.team+a.mind*w.mind;
 const sk=p.skill;
 if(sk.t==='lane')pow+=a.lane*0.12*w.lane;
 if(sk.t==='farm')pow+=a.farm*0.12*w.farm;
 if(sk.t==='team')pow+=a.team*0.12*w.team;
 if(sk.t==='mind')pow+=a.mind*0.12*w.mind;
 // 英雄加成：按熟练度（绝活+8% / 熟练+4% / 一般0% / 生疏-8%），版本热门再 +2%
 const h=heroId?heroAtPos(heroId,p.pos):null;
 if(h){
 pow*=1+HERO_LV[heroLv(p,heroId)].b;
 if(h.hot)pow*=1.02;
 }
 // 带伤：按伤情剩几天打折（10% ~ 30%），随恢复逐渐回稳
 if(p.injury>0)pow*=1-0.1*Math.min(p.injury,3);
 // 体力：低于 60 开始衰减（0 体力约 -24%）；每小局 -8、每日自然恢复 +10、休息 +55
 const eng=(p.energy==null)?100:p.energy;
 if(eng<60)pow*=1-(60-eng)*0.004;
 return Math.round(pow);
}
/* AI 队战力：与 teamPower 同刻度（五位置最强者求和 × 士气系数）。
 体力由 playerPower 实时读取：构建时=满体力（联赛模拟用），系列赛中用实时值（逐局衰减）。
 AI 教练班底：持久化在 s.aiCoaches（队名→教练），初始按原版俱乐部模板落位
 （豪门名帅/草根平淡），每个赛季转会期 AI 队会从名宿市场挖角更好的教练（与玩家抢人）；
 无记录的队按职业队平均班底 +6% 折算（旧版 AI_STAFF 等价值，旧档懒初始化兼容）。 */
function aiCoachState(s){
 if(!s.aiCoaches){
 s.aiCoaches={};
 (typeof CLUB_TEMPLATES!=='undefined'?CLUB_TEMPLATES:[]).forEach(t=>{
 const c=COACH_POOL.find(x=>x.id===t.coach);
 if(c)s.aiCoaches[t.name]={id:c.id,name:c.name,rating:c.rating,bonus:c.bonus,styleBonus:c.styleBonus,style:c.style};
 });
 }
 return s.aiCoaches;
}
function aiCoachBonus(s,tn){return (s&&s.aiCoaches&&s.aiCoaches[tn])?s.aiCoaches[tn].bonus:6;}
function aiRosterPower(roster,s,tn){
 if(!roster||!roster.length)return 0;
 const best={};
 roster.forEach(p=>{
 if(p.injury>0)return; // 伤停必须休息：不计入战力（青训递补顶替出战）
 const v=playerPower(p,p.sig);
 if(best[p.pos]==null||v>best[p.pos])best[p.pos]=v;
 });
 let sum=0,cnt=0,mSum=0;
 POS_ORDER.forEach(pos=>{if(best[pos]!=null){sum+=best[pos];cnt++;}});
 if(!cnt)return 0;
 roster.forEach(p=>mSum+=(p.morale||80));
 const morale=clamp(mSum/roster.length/100,0.82,1.1);
 return Math.round(sum*morale*(1+aiCoachBonus(s,tn)/100));
}
/* picks 可选：BP 进行中实时结算用（未选位置回退招牌）；缺省走 S.pick */
function teamPower(s,picks){
 const ls=rosterLineup(s);
 if(!ls.length)return 0;
 const ph=p=>(picks&&picks[p.pos])||pickedHero(s,p);
 let pow=ls.reduce((t,p)=>t+playerPower(p,ph(p)),0);
 const mAvg=ls.reduce((t,p)=>t+p.morale,0)/ls.length;
 pow*=clamp(mAvg/100,0.82,1.1);
 activeBonds(s).forEach(b=>pow*=1+b.bonus/100);
 // 主教练加成：全队战力% + 侧重属性额外加成
 if(s.coach){
 const c=s.coach;
 const w={lane:0.25,farm:0.25,team:0.3,mind:0.2}[c.style];
 const attrSum=ls.reduce((t,p)=>t+p.attrs[c.style],0);
 pow+=attrSum*c.styleBonus/100*w;
 pow*=1+c.bonus/100;
 }
 // 助教组（上限2人）：与主教练加成叠加，幅度较小
 if(s.assistants&&s.assistants.length){
 s.assistants.forEach(a=>{
 const w={lane:0.25,farm:0.25,team:0.3,mind:0.2}[a.style]; const attrSum=ls.reduce((t,p)=>t+p.attrs[a.style],0);
 pow+=attrSum*a.styleBonus/100*w;
 pow*=1+a.bonus/100;
 });
 }
 // 连胜/连败手感：±2%/场，上限 ±10%
 if(s.streak)pow*=1+clamp(s.streak,-5,5)*0.02;
 // 队长加成：队长在首发阵中，全队战力 +2%（队长被卖/退役/换下则不生效）
 if(s.captain&&ls.some(p=>p.id===s.captain))pow*=1.02;
 return Math.round(pow);
}
function activeBonds(s){
 const ls=rosterLineup(s),cnt={};
 ls.forEach(p=>{if(p.team)cnt[p.team]=(cnt[p.team]||0)+1;});
 const act=[];
 for(const t in cnt){
 const def=TEAM_BONDS[t];
 if(!def)continue;
 if(cnt[t]>=def.full)act.push({bonus:def.bonusFull,desc:def.descFull});
 else if(cnt[t]>=def.min)act.push({bonus:def.bonusMin,desc:def.descMin});
 }
 return act;
}
function weeklyWage(s){
 // 租借选手租金已一次性支付，工资由原俱乐部承担，不计入本队周薪
 let sum=s.players.reduce((t,p)=>t+(p.loan?0:p.wage),0);
 if(s.coach)sum+=s.coach.wage;
 (s.assistants||[]).forEach(a=>sum+=a.wage);
 return sum;
}
/* 存档序列化：剔除可重建/仅运行期字段。
  aiRosters 读档时 migrateSave 统一清空重建，写进去纯属白占 localStorage；
  _achAt/_asCache 等是节流缓存。导出/备份同样走这里。 */
function serializeForSave(s){
 if(!s)return 'null';
 const cache=s.aiRosters;
 s.aiRosters={};
 try{return JSON.stringify(s);}
 finally{if(cache)s.aiRosters=cache;}
}
function save(){
 if(!S)return false;
 try{checkAchievements(S);}catch(e){}
 try{localStorage.setItem(slotKey(),serializeForSave(S));return true;}
 catch(e){console.warn('save fail',e);try{toast(' 存档失败：'+(e.message||'存储不可用'));}catch(_){}return false;}
}
/* 赛制形态校验：当前阶段的分组结构是否存在且匹配。
 r2 起分组是 {S,A,B}/{S,A}，没有 G1 是正常的——不能用「无 G1」当旧档特征，
 否则打进 S 组后每次读档都会被误判成旧档、整体回滚到第一轮分组赛。 */
function seasonShapeOk(s){
 if(!s.groups||!Object.keys(s.groups).length)return false;
 if(s.phase==='r1')return !!s.groups.G1;
 if(s.phase==='r2'||s.phase==='card')return !!(s.groups.S&&s.groups.A&&s.groups.B);
 if(['r3','playoff','champion','eliminated'].includes(s.phase))return !!(s.groups.S&&s.groups.A);
 return true; // 未知阶段不强判
}
function migrateSave(){
 if(!S)return;
 S.era=(S.era&&KPL_ERAS[S.era])?S.era:null; // 历代联盟时代标记（读档时已在 load() 重装）
 // 存档版本迁移：无 v 字段的旧档视为 v3；逐级执行 MIGRATIONS 到当前版本
 if(S.v==null)S.v=3;
 while(S.v<SAVE_VERSION){
 const step=MIGRATIONS[S.v];
 try{if(step)step(S);}catch(e){console.warn('migrate '+S.v+' fail',e);}
 S.v++;
 }
 // 兜底：迁移步骤失败或存档被外部编辑过时，保证董事会字段可用（面板渲染不会崩）
 S.board=S.board||{trust:60,kpi:null,warn:0,fired:false,firedSeason:0,log:[]};
 S.managerCareer=S.managerCareer||{years:0,titles:0,lastRank:null};
 S.scenario=S.scenario||'normal'; // 缺剧本字段（旧档/中间版本）按常规档
 S.mode=S.mode||'manager'; // 旧档统一为经理模式
 if(S.mode==='player'&&!S.career)S.career={me:null,seasons:[],titles:0,fmvp:0,allstar:0,nat:0,retired:false,pendingMove:null};
 if(S.mode==='coach'&&!S.coachDeal)S.coachDeal={years:0,honors:[],log:[]};
 S.mentorPairs=S.mentorPairs||[]; // 老将带新配对（旧档兜底）
 S.fans=S.fans==null?8:S.fans; // 缺粉丝字段按中性起始值
 S.captain=S.captain==null?null:S.captain; // 队长字段兜底（旧档统一为 null）
 if(S.kjia===undefined)S.kjia=null; // K甲联赛状态（旧档缺字段；nextDay/renderKjia 会懒初始化）
 S.offers=S.offers||[]; // 赛中转会报价（旧档缺字段兜底）
 S.transfers=S.transfers||[]; // 转会台账（旧档缺字段兜底）
 S.yearReviews=S.yearReviews||[]; // 年度回顾（旧档缺字段兜底）
 S.yearStages=S.yearStages||[]; // 成绩曲线（旧档缺字段兜底）
 S.aiRosters={}; // 名册更新后重建对手阵容
 // 修复旧版 0:0 模拟（KPL.BO5 未定义）造成的错误积分：回滚后按新逻辑重算
 if(typeof phaseGroups==='function'&&S.tables&&S.aiSchedule){
 phaseGroups(S).forEach(g=>{
 (S.aiSchedule[g]||[]).forEach(m=>{
 if(!(m.r&&m.r.mw===0&&m.r.ow===0))return;
 const ta=(S.tables[g]||{})[m.a],tb=(S.tables[g]||{})[m.b];
 if(ta&&tb){tb.w=Math.max(0,tb.w-1);tb.pts=Math.max(0,tb.pts-1);ta.l=Math.max(0,ta.l-1);}
 const r=simSeriesResult(S,m.a,m.b,KPL.BO5);
 m.r={w:r.win?m.a:m.b,mw:r.mw,ow:r.ow};
 if(ta&&tb){
 if(r.win){ta.w++;ta.pts++;tb.l++;}
 else{tb.w++;tb.pts++;ta.l++;}
 ta.pw+=r.mw;tb.pw+=r.ow;
 }
 });
 });
 }
 S.series=S.series||null;
 if(S.series&&!S.series.side)S.series.side='blue';
 S.pick=S.pick||{};
 S.coach=S.coach||null;
 if(S.crest===undefined)S.crest=null; // 自建/改队徽的品牌（外形+配色+缩写），无则用俱乐部原版/哈希
 S.coachMarket=S.coachMarket||[];
 S.honors=S.honors||[];
 if(!S.wageCap)S.wageCap=90;
 if(!S.seedPower)S.seedPower=280;
 if(!S.streak)S.streak=0;
 if(S.preseason==null)S.preseason=false; // 旧档迁移：默认已过转会期
 if(!S.transferWindow)S.transferWindow=0;
 S.transferList=S.transferList||[];
 // 旧档非卖品意愿=100 → 动态化（85-100 初始区间）
 (S.transferList||[]).forEach(p=>{if(p.untouchable&&p.willingness===100)p.willingness=rnd(85,100);});
 S.listed=S.listed||[];
 S.bids=S.bids||[];
 S.history=S.history||[];
 S.academy=S.academy||[];
 S.retiredCoaches=S.retiredCoaches||[];
 S.hosts=S.hosts||[];
 S.freeAgents=S.freeAgents||[];
 S.extraDefs=S.extraDefs||[]; // AI 转会生态：新星 def（aiRosterDefs 懒初始化自 AI_ROSTERS）
 S.retiredDefs=S.retiredDefs||[];
 S.aiInj=S.aiInj||{}; // AI 伤停表（def id → 缺阵系列赛数）
 S.assistants=S.assistants||[]; // 助教组（旧档迁移）
 // 年度赛历迁移：旧档默认处于春季赛（春夏/EWC/年总为新引入赛段）
 S.split=S.split||'spring';
 S.annualPts=S.annualPts||{};
 if(S.ewc===undefined)S.ewc=null;
 if(S.annual===undefined)S.annual=null;
 S.fmvpHonor=S.fmvpHonor||[];
 S.cardLosers=S.cardLosers||[];
 S.achieved=S.achieved||{}; // 成就（id→解锁年份）
 if(S.selfBuilt==null)S.selfBuilt=false; // 旧档无法追溯开局方式：不补发「白手起家」
 if(S.maxSale==null)S.maxSale=0;
 if(S.challenger===undefined)S.challenger=null; // 挑战者杯赛段
 // 经济扩倍迁移（2026-09 身价体系 ×10）：旧档货币字段统一放大，保证与新的千万级身价同刻度
 if(!S.moneyScaled){
 const mul=x=>(typeof x==='number')?Math.round(x*10):x;
 S.fund=mul(S.fund);S.wageCap=mul(S.wageCap);
 const scaleList=arr=>{if(Array.isArray(arr))arr.forEach(o=>{if(o&&typeof o==='object'){o.wage=mul(o.wage);o.cost=mul(o.cost);o.income=mul(o.income);o.acqCost=mul(o.acqCost);o.signCost=mul(o.signCost);}});};
 scaleList(S.players);scaleList(S.coachMarket);scaleList(S.retiredCoaches);scaleList(S.assistants);
 scaleList(S.market);scaleList(S.freeAgents);scaleList(S.transferList);scaleList(S.hosts);
 if(S.coach){S.coach.wage=mul(S.coach.wage);S.coach.cost=mul(S.coach.cost);}
 (S.listed||[]).forEach(x=>x.price=mul(x.price));
 (S.bids||[]).forEach(x=>x.bid=mul(x.bid));
 S.moneyScaled=true;
 try{logEvent(S,' 经济体系升级：全联盟身价/工资/资金 ×10（顶星身价千万级）');}catch(e){}
 }
 // 真实经济对齐迁移（2026-09 KPL 硬规则）：全联盟货币 ÷6，转会费封顶 1500 万、名单 ≤10、个人顶薪 70
 if(!S.econReal){
 const div=x=>(typeof x==='number')?Math.max(1,Math.round(x/6)):x;
 S.fund=div(S.fund);S.wageCap=div(S.wageCap);
 const dList=arr=>{if(Array.isArray(arr))arr.forEach(o=>{if(o&&typeof o==='object'){o.wage=div(o.wage);o.cost=div(o.cost);o.income=div(o.income);o.acqCost=div(o.acqCost);o.signCost=div(o.signCost);}});};
 dList(S.players);dList(S.coachMarket);dList(S.retiredCoaches);dList(S.assistants);
 dList(S.market);dList(S.freeAgents);dList(S.transferList);dList(S.hosts);
 if(S.coach){S.coach.wage=div(S.coach.wage);S.coach.cost=div(S.coach.cost);}
 (S.listed||[]).forEach(x=>x.price=div(x.price));
 (S.bids||[]).forEach(x=>x.bid=div(x.bid));
 S.econReal=true;
 try{logEvent(S,' 联盟硬规则落地：转会费封顶 1500 万 · 大名单 ≤10 人 · 个人顶薪 70 万/周 · 奖金 70% 归选手（全联盟货币同步缩放）');}catch(e){}
 }
 // 总值化迁移：教练/名宿旧档 rarity → rating 评分（选手总值实时计算，无需迁移）
 const R2RATE={SSR:90,SR:80,R:70};
 [S.coach].concat(S.coachMarket||[],S.retiredCoaches||[]).forEach(c=>{
 if(c&&c.rating==null&&c.rarity)c.rating=R2RATE[c.rarity]||80;
 });
 // 旧赛制存档（无 groups）→ 重置为 KPL 2025 新赛制（保留队伍/资金/教练）
 if(!S.phase)S.phase='r1';
 if(!seasonShapeOk(S)){
 S.phase='r1';S.matchIdx=0;
 S.groups={};S.tables={};S.aiPower={};S.card=null;S.playoff=null;S.eliminated=[];
 S.stage='regular';S.champion=false;
 }
 S.players.forEach(p=>{
 if(p.injury==null)p.injury=0;
 if(p.mvp==null)p.mvp=0;
 if(p.contract==null)p.contract=2; // 合同年限（旧档补 2 年）
 if(p.retiring==null)p.retiring=false;
 if(p.age==null)p.age=ageByPos(p.pos,false);
 if(!p.sig)p.sig=(HEROES.find(h=>h.pos[0]===p.pos)||{}).n||null;
 if(!p.career){const def=PLAYER_POOL.find(d=>d.id===p.id);if(def)p.career=def.career||'';}
 // 英雄池：字符串→对象；补全本职+摇摆位英雄，并清掉异位置英雄（旧档的储备/错位英雄统一洗掉）
 if(!p.heroPool||typeof p.heroPool[0]==='string'){
 const old=(p.heroPool||[]).map(h=>typeof h==='string'?h:h.n);
 p.heroPool=old.map(n=>({n,lv:n===p.sig?3:2}));
 }
 if(p.sig&&!p.heroPool.some(x=>x.n===p.sig))p.heroPool.unshift({n:p.sig,lv:3});
 HEROES.filter(h=>h.pos.includes(p.pos)).forEach(h=>{if(!p.heroPool.some(x=>x.n===h.n))p.heroPool.push({n:h.n,lv:2});});
 p.heroPool=p.heroPool.filter(x=>{const h=heroOf(x.n);return h&&h.pos.includes(p.pos);});
 });
 // 其余选手集合同样按位置清洗英雄池（错位英雄数据修正后的存量清洗，如蒙犽误标中路）
 const scrubPoolPos=p=>{if(p&&Array.isArray(p.heroPool))p.heroPool=p.heroPool.filter(x=>{const h=heroOf(x.n);return h&&h.pos.includes(p.pos);});};
 [S.market,S.transferList,S.freeAgents,S.academy].forEach(list=>{if(Array.isArray(list))list.forEach(scrubPoolPos);});
 Object.values(S.aiRosters||{}).forEach(r=>{if(Array.isArray(r))r.forEach(scrubPoolPos);});
 // 青训新秀改名：清掉「清扬_2」式自增后缀（老档一次性清洗，新名走电竞 ID 字库）
 const renameRookie=p=>{
 if(p&&p.name&&/^.+_\d+$/.test(p.name)&&(p.isRookie||(p.tags||[]).includes('青训')))p.name=genRookieName(S);
 };
 (S.players||[]).forEach(renameRookie);
 (S.academy||[]).forEach(renameRookie);
 // 青训选手补合同字段（晋升时重置为 2）
 (S.academy||[]).forEach(r=>{if(r.contract==null)r.contract=2;});
}
function ensureSeason(s){
 // 启动/读档后确保赛制状态完整（新档 initGroups 在 createTeam 调用）
 // 与 migrateSave 同一判定：按阶段形态校验，S/A/B 阶段没有 G1 属于正常，绝不能因此重建
 if(!seasonShapeOk(s)){
 s.stage='regular';
 initGroups(s);
 logEvent(s,' 赛制升级为 KPL 2025 官方赛制（18队 · S/A/B 三组）');
 save();
 }
}
function load(){
 try{const d=localStorage.getItem(slotKey());if(d){S=JSON.parse(d);
 // 时代联盟按档重装：era 档装该时代；现代档也必须还原默认联盟（否则上一档的时代数据残留错装）
 if(typeof installEra==='function')installEra((S.era&&KPL_ERAS[S.era])?S.era:null);
 migrateSave();return true;}}
 catch(e){console.warn('load fail',e);try{toast(' 存档读取失败，已重新开局');}catch(_){}}
 return false;
}

/* ================= 选手年龄体系（真实 KPL 生命周期） =================
 出道18-19（青训17跟训）→ 黄金期 → 下滑期 → 退役
 打野/射手寿命最短（24退役）· 对抗/中路中等（26退役）· 辅助最长（31退役，27-28仍可首发） */
const AGE_MODEL={
 jg:{gold:21,decline:22,retire:24,decay:2}, // 打野：吃手速反应，23岁后难首发，24退役
 ad:{gold:21,decline:22,retire:24,decay:2}, // 射手（发育路）：同上
 top:{gold:22,decline:23,retire:26,decay:1},// 对抗路：操作+意识，24-25下滑，26+极少首发
 mid:{gold:22,decline:23,retire:26,decay:1},// 中路：同上
 sup:{gold:24,decline:25,retire:31,decay:1},// 游走：靠大局观指挥，寿命最长，27-28仍有首发
};
function ageByPos(pos,isRookie){
 if(isRookie)return rnd(16,17); // 青训跟训
 if(pos==='sup')return rnd(19,22); // 辅助出道/在位年限更久
 if(pos==='jg'||pos==='ad')return rnd(18,20); // 野射出道早
 return rnd(18,21);
}
/* 年龄阶段标签 */
function ageStage(p){
 const m=AGE_MODEL[p.pos]||AGE_MODEL.mid;
 if(p.age>=m.retire)return '已退役';
 if(p.age>=m.retire-1)return '即将退役';
 if(p.age>m.gold)return '下滑期';
 return '黄金期';
}
/* 选手生成（含位置化年龄） */
