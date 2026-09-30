/* 董事会与信任度（season.js 机械拆出） */
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
function boardKpiTarget(prevRank,s){ // 豪门保前4-5 / 争冠组保前10 / 其余保前14（中档不苛求必夺冠）
 if(prevRank)return prevRank<=4?5:prevRank<=8?10:14;
 // 首年没有历史名次：按分组档位定目标。
 // S/A/B=第一轮后重组分组；G1/G2/G3=开档抽签组（按真实战力蛇形）——两者都认，避免开档时全员「前12」。
 const inG=g=>(s&&s.groups&&s.groups[g]||[]).indexOf(s.teamName)>=0;
 if(inG('S')||inG('G1'))return 5;
 if(inG('A')||inG('G2'))return 10;
 return 14;
}
function setBoardKpi(s){
 s.board=s.board||{};
 s.managerCareer=s.managerCareer||{years:0,titles:0,lastRank:null};
 const prev=s.managerCareer.lastRank||null;
 const target=boardKpiTarget(prev,s);
 s.board.kpi={target,from:prev,label:target<=5?'争冠/保前'+target:(target<=10?'冲击前'+target:'保级并进前'+target)};
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
 // 冠军是硬成绩：大幅嘉奖 + 信任地板（旧版夺冠仍被赛中负反馈冲到 21）
 if(champs){
  delta+=10*champs;
  note+='；年内 '+champs+' 冠额外嘉奖';
  if(delta<8){delta=8;note+='（冠军赛季信任不倒扣）';}
 }
 // 亚军也记功：长期「差一口气」不应被当成失败
 const runners=(s.honors||[]).filter(h=>h.season===s.season&&!h.champion).length;
 if(!champs&&runners){delta+=3*runners;note+='；'+runners+' 亚记功';}
 if(delta>24)delta=24; // 单赛季上限：防信任度靠一次夺冠暴涨到满
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
 if(champs)s.board.warn=0; else s.board.warn=delta<0?((s.board.warn||0)+1):0; // 夺冠清零警告
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
 if(s.mode==='player')return; // 选手不管工资帽
 if(s.mode==='coach')return; // 教练无市场/卖人权，砍帽只会被自动续约抽干资金 → 只走信任/解约
 s.board=s.board||{};
 const t=s.board.trust==null?60:s.board.trust;
 if(t<=BOARD_WARN_TRUST){
  const cut=Math.max(1,Math.round((s.wageCap||150)*0.1));
  s.wageCap=Math.max(50,(s.wageCap||150)-cut);
  logEvent(s,' 董事会介入：对战绩不满，压缩工资帽 '+cut+'万（本赛季上限 '+s.wageCap+'万）——请用更低的成本打出成绩');
  try{if(typeof playMoment==='function'&&t<40)playMoment(2,'董事会警告','信任度 '+t+' · 工资帽已压缩','alert');}catch(e){}
 }else if(t>=BOARD_FAVOR_TRUST){
  s.fund+=130;
  logEvent(s,' 董事会放权：追加运营预算 +130万（信任度 '+t+'）');
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
/* ================= 战队关系事件（影响董事会信任 / 俱乐部氛围） =================
 与「赛季末 KPI 结算」并行的日常关系条：媒体、赞助商、股东、更衣室、球迷。
 选择题停在 s.clubChoice（俱乐部页待办），自动题直接改信任度。
 经理/教练模式生效；选手生涯不触发（选手不管董事会）。 */
const BOARD_TRUST_MIN=0,BOARD_TRUST_MAX=100;
function boardRelDelta(s,delta,note){
 if(!s||s.mode==='player')return 0;
 s.board=s.board||{trust:60,kpi:null,warn:0,fired:false,firedSeason:0,log:[]};
 const before=s.board.trust==null?60:s.board.trust;
 const d=clamp(Math.round(delta),-15,12);
 s.board.trust=clamp(before+d,BOARD_TRUST_MIN,BOARD_TRUST_MAX);
 if(note)logEvent(s,'【关系】'+note+'：信任度 '+(d>=0?'+':'')+d+'（当前 '+s.board.trust+'）');
 try{if(d>=5&&typeof playMoment==='function')playMoment(1,'俱乐部关系升温','信任度 '+s.board.trust,'gold');}catch(e){}
 return d;
}
function applyBoardTrust(s,delta,note){return boardRelDelta(s,delta,note);}

/* 赛段间董事会脉冲：排名/分组落地后立刻有反馈，不再等年终才咬人。
   经理/教练生效；选手生涯豁免。金额克制，避免打爆平衡门禁。 */
function boardMidSeasonPulse(s,stage){
 if(!s||s.board&&s.board.fired)return;
 if(s.mode==='player')return; // 选手不管董事会
 s.board=s.board||{trust:60,kpi:null,warn:0,fired:false,firedSeason:0,log:[]};
 // 赛段切换瞬间 phaseGroups 可能已改口（r2→card），不能只靠 myGroup
 const g=(typeof myGroup==='function'?myGroup(s):null)||['S','A','B','G1','G2','G3']
  .find(k=>s.groups&&s.groups[k]&&s.groups[k].includes(s.teamName))||null;
 let delta=0,note='';
 if(stage==='r1'){
  if(g==='B'||g==='G3'){delta=-4;note='第一轮落入 B 组，董事会对开局不满';}
  else if(g==='S'||g==='G1'){delta=3;note='第一轮闯进 S 组，管理层士气提振';}
  else{delta=-1;note='第一轮中游，董事会保持观望';}
 }else if(stage==='card'){
  if(g==='S'||g==='A'){delta=-2;note='进入卡位赛区，董事会要求必须保住席位';}
  else{delta=-5;note='卡位赛出局在即，董事会已经很不耐烦';}
 }else if(stage==='r3'){
  if(g==='S'){delta=2;note='挺进第三轮 S 组，信任度回暖';}
  else if(g==='A'){delta=0;note='第三轮 A 组，成绩及格但没有惊喜';}
  else return;
 }else if(stage==='playoff'){
  delta=3;note='闯进季后赛，董事会松了一口气';
 }else return;
 if(delta===0&&!note)return;
 boardRelDelta(s,delta,note);
 s.board.log=s.board.log||[];
 s.board.log.unshift({season:s.season,rank:myAnnualRank(s),target:s.board.kpi?s.board.kpi.target:null,delta,note,trust:s.board.trust,mid:true});
 s.board.log=s.board.log.slice(0,12);
}

/* 现金流告急：资金撑不过 3 周工资时董事会盯上运营，持续告急会掉信任。 */
function boardCashPulse(s){
 if(!s)return;
 if(s.mode==='player')return;
 if(s.board&&s.board.fired)return;
 // 当季已有冠军：现金流告警降噪，成绩优先于营运细账
 if((s.honors||[]).some(h=>h.season===s.season&&h.champion))return;
 const annual=weeklyWage(s);
 const weekly=Math.max(1,Math.round(annual/ECON.payWeeks));
 const runway=Math.floor((s.fund||0)/weekly);
 if(runway>=3)return; // 还撑得住，不骚扰
 if((s._cashWarnDay||0)>0&&(s.day||0)-s._cashWarnDay<7)return; // 同一告急窗口只说一次
 s._cashWarnDay=s.day||0;
 const delta=runway<=0?-4:-2;
 const note=runway<=0
  ?('现金流见底（仅够 '+Math.max(0,s.fund||0)+' 万 · 周薪 '+weekly+' 万），董事会盯紧运营')
  :('资金只够 '+runway+' 周工资（周薪 '+weekly+' 万），董事会要求开源节流');
 boardRelDelta(s,delta,note);
 try{if(typeof playMoment==='function')playMoment(2,'现金流告急',note,'alert');}catch(e){}
}
function clubRelChoices(s){
 return [
  {id:'gala',title:'股东答谢晚宴',text:'大股东邀请管理层出席晚宴，希望你亲自站台。缺席可能被解读为不重视俱乐部。',
   opts:[
    {l:'盛装出席',trust:4,fund:0,morale:0,note:'晚宴上重申争冠目标，股东很满意'},
    {l:'让助教代劳',trust:-2,fund:0,morale:2,note:'你留在基地盯训练，股东略感冷落，但队员看到你全勤备战'},
   ]},
  {id:'sponsor',title:'赞助商点名上场',text:'主赞助商希望某位人气选手多出场，暗示商务合作续签看曝光。',
   opts:[
    {l:'商务优先，调整首发',trust:5,fund:40,morale:-4,note:'赞助商满意，加签曝光合约；部分队员对轮换不满'},
    {l:'竞技优先，婉拒商务',trust:2,fund:0,morale:5,note:'更衣室为你点赞；赞助商表示理解但期待成绩'},
   ]},
  {id:'fans',title:'球迷围堵主场',text:'连续失利后，极端球迷在主场外拉横幅，俱乐部形象承压。',
   opts:[
    {l:'公开道歉+开放日',trust:3,fund:-20,morale:4,note:'你亲自见面球迷，俱乐部口碑回暖'},
    {l:'强硬回应：成绩说话',trust:-4,fund:0,morale:-3,note:'管理层认为公关失分，队内也有些寒心'},
   ]},
  {id:'media',title:'名嘴公开质疑',text:'头部解说连发三条微博质疑你的战术，话题冲上热搜。',
   opts:[
    {l:'赛后用胜利回击',trust:1,fund:0,morale:6,note:'更衣室憋了一口气，下一场格外拼'},
    {l:'发布会长文回应',trust:3,fund:-10,morale:0,note:'公关处理得体，管理层松了口气'},
   ]},
  {id:'board_drill',title:'董事会要求加练',text:'董事认为近期训练量不足，要求加开夜训。',
   opts:[
    {l:'执行夜训',trust:4,fund:0,morale:-6,note:'管理层满意；队员疲惫，士气下滑'},
    {l:'科学调控，拒绝硬灌',trust:-2,fund:0,morale:5,note:'你坚持训练计划，队员感激，董事会不置可否'},
   ]},
  {id:'leak',title:'更衣室录音外泄',text:'一段更衣室争执录音在网上流传，俱乐部内部气氛紧张。',
   opts:[
    {l:'内部处理，冷处理媒体',trust:-1,fund:0,morale:-2,note:'事情压下去了，但信任有些裂痕'},
    {l:'公开调查+队内会议',trust:3,fund:-15,morale:3,note:'流程干净，队员觉得被尊重'},
   ]},
 ];
}
function clubRelAutoEvent(s){
 if(!s||s.mode==='player'||s.board&&s.board.fired)return null;
 const streak=s.streak||0;
 const trust=s.board&&s.board.trust!=null?s.board.trust:60;
 const pool=[];
 if(streak>=3)pool.push({id:'press',note:'连胜登上头条，赞助商与股东一致好评',trust:3});
 if(streak<=-3)pool.push({id:'slump',note:'连败引发管理层警觉，内部会议气氛凝重',trust:-4});
 if((s.fans||0)>=20)pool.push({id:'fanlove',note:'粉丝规模突破里程碑，俱乐部品牌价值上升',trust:2});
 if((s.fund||0)<200)pool.push({id:'cash',note:'俱乐部现金流吃紧，董事会关注运营',trust:-3});
 if((s.honors||[]).some(h=>h.season===s.season&&h.champion))pool.push({id:'parade',note:'夺冠游行反响热烈，俱乐部声望大涨',trust:5});
 if(trust>=85)pool.push({id:'favor',note:'管理层对你高度满意，放权信号明显',trust:1});
 if(trust<=30)pool.push({id:'heat',note:'董事会私下召开专题会，关注你的帅位',trust:-2});
 if(!pool.length){
  pool.push(
   {id:'day_ok',note:'例行管理层沟通顺畅',trust:1},
   {id:'day_noise',note:'媒体小作文扰动，公关连夜灭火',trust:-1},
   {id:'day_sponsor',note:'区域赞助商到访基地，留下好印象',trust:2},
   {id:'day_ops',note:'主场票务投诉增多，运营压力转嫁到你头上',trust:-2},
  );
 }
 return pick(pool);
}
function clubRelTick(s){
 if(!s||s.mode==='player')return;
 if(s.board&&s.board.fired)return;
 if(s.clubChoice)return; // 有未决关系事件：先处理
 // 日常自动：约 18% 概率；低信任时更频繁（压力更大）
 const t=s.board&&s.board.trust!=null?s.board.trust:60;
 const p=t<40?0.28:t>75?0.12:0.18;
 if(Math.random()>=p)return;
 // 40% 出选择题，60% 自动关系事件
 if(Math.random()<0.4){
  const c=pick(clubRelChoices(s));
  s.clubChoice={id:c.id,title:c.title,text:c.text,opts:c.opts.map(o=>({l:o.l,trust:o.trust,fund:o.fund||0,morale:o.morale||0,note:o.note}))};
  logEvent(s,'【关系】'+c.title+'——俱乐部页待你表态：'+c.text);
  try{if(typeof playMoment==='function')playMoment(1,'俱乐部关系事件',c.title,null);}catch(e){}
 }else{
  const ev=clubRelAutoEvent(s);
  if(ev)boardRelDelta(s,ev.trust,ev.note);
 }
}
function applyClubChoice(s,idx){
 s=s||S;
 if(!s||!s.clubChoice){toast('当前没有待处理的俱乐部关系事件');return false;}
 const c=s.clubChoice;
 const opt=(c.opts||[])[idx];
 if(!opt){toast('选项无效');return false;}
 s.fund=Math.max(0,(s.fund||0)+(opt.fund||0));
 if(opt.morale)(s.players||[]).forEach(p=>{p.morale=clamp((p.morale||50)+(opt.morale||0),20,100);});
 boardRelDelta(s,opt.trust||0, (c.title||'关系事件')+'：你选择「'+opt.l+'」——'+(opt.note||''));
 s.clubChoice=null;
 save();renderAll();
 return true;
}
