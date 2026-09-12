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
 if(s.mode==='player')return; // 选手不管工资帽
 s.board=s.board||{};
 const t=s.board.trust==null?60:s.board.trust;
 if(t<=BOARD_WARN_TRUST){
  const cut=Math.max(1,Math.round((s.wageCap||150)*0.1));
  s.wageCap=Math.max(50,(s.wageCap||150)-cut);
  logEvent(s,' 董事会介入：对战绩不满，压缩工资帽 '+cut+'万（本赛季上限 '+s.wageCap+'万/周）——请用更低的成本打出成绩');
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
