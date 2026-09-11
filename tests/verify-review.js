// 年度回顾回归：成绩曲线埋点 / 转会台账 / 快照生成 / 面板渲染 / 年度轮换清账
// 驱动一整年（强队 3:1 稳赢，复用 verify-annual 的快进法），验证 finishAnnual 生成的回顾快照
// 运行：node tests/verify-review.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  // ===== 开局：自建强队直接开打 =====
  S=newState('回顾队','⚔️');
  fillRoster(S,'star','star');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  S.seedPower=teamPower(S);
  startSplit(S,'spring');
  S.preseason=false;S.transferWindow=0;S.day=10;
  const closeSeries=()=>{if(S.series){S.series.mw=Math.ceil(S.series.max/2);S.series.ow=1;finishSeries(true);return true;}return false;};
  const runLeague=()=>{let g=0;
   while(!['champion','eliminated'].includes(S.phase)&&g++<200){
   if(S.preseason){S.preseason=false;S.transferWindow=0;continue;}
   if(S.phase==='r1'||S.phase==='r2'||S.phase==='r3'){
   if(S.matchIdx>=S.schedule.length){advancePhase(S);continue;}
   if(S.series&&S.series.stage==='regular'){closeSeries();continue;}
   const m=S.schedule[S.matchIdx];
   S.series={used:[],usedOpp:[],mw:0,ow:0,max:5,stage:'regular',logs:[],myName:S.teamName,opName:m.opp,side:'blue'};
   S.series.mw=3;S.series.ow=1;finishSeries(true);
   }else if(S.phase==='card'){
   if(S.series){closeSeries();continue;}
   const myCard=S.card&&S.card.matches.find(x=>!x.r&&(x.a===S.teamName||x.b===x.b||x.a===S.teamName||x.b===S.teamName));
   if(!myCard){startCard();continue;}
   S.series={used:[],usedOpp:[],mw:0,ow:0,max:7,stage:'card',cardMatch:myCard,logs:[],myName:S.teamName,opName:myCard.a===S.teamName?myCard.b:myCard.a,side:'blue'};
   S.series.mw=4;S.series.ow=1;finishSeries(true);
   }else if(S.phase==='playoff'){
   if(S.series){closeSeries();continue;}
   startPlayoff();if(!S.series)break;}
   else break;
   }
  };
  runLeague();
  if(S.phase!=='champion'&&S.phase!=='eliminated')fail('春季赛未收官: '+S.phase);

  // ① 成绩曲线埋点：春季赛名次已入档（强队 3:1 稳赢 → 冠军）
  const stagesAfterSpring=(S.yearStages||[]).slice();
  const springRow=stagesAfterSpring.find(x=>x.ev==='春季赛');
  if(!springRow)fail('春季赛名次未入成绩曲线');
  else if(springRow.place!=='冠军')fail('3:1 全胜的春季赛名次应为冠军: '+springRow.place);
  else log('① 成绩曲线埋点：春季赛 →「'+springRow.place+'」已入档（awardAnnualPts 钩子）');

  // ② 转会台账：真实买入（市场签约）与卖出（completeSale 单点）
  buildTransferMarket(S);refreshMarket(S);
  S.fund+=2000;
  const mp=S.market[0];
  const fundBefore=S.fund,cntBefore=S.players.length;
  buyPlayer(S,mp);
  const inRec=(S.transfers||[])[0];
  if(!inRec||inRec.dir!=='in'||inRec.name!==mp.name)fail('市场签约未入台账: '+JSON.stringify(inRec||{}));
  else if(S.players.length!==cntBefore+1)fail('买入后名单异常');
  else{
   const sellP=S.players.find(p=>!S.lineup.includes(p.id));
   completeSale(S,sellP,1234,'测试买家');
   const outRec=(S.transfers||[])[0];
   if(!outRec||outRec.dir!=='out'||outRec.fee!==1234||outRec.team!=='测试买家')fail('卖出未入台账: '+JSON.stringify(outRec||{}));
   else log('② 转会台账：签入 '+inRec.name+'（'+inRec.fee+'万）/ 售出 '+outRec.name+'（+1234万 → 测试买家）均入册');
  }

  // ③ 全年快进：挑杯 → EWC → 夏赛 → 年总 → 年度轮换（回顾在轮换前定格）
  advanceCalendar(S); // → 挑战者杯
  if(S.phase!=='challenger')fail('未进挑战者杯: '+S.phase);
  let g1=0;
  while(S.phase==='challenger'&&g1++<80){
   if(S.series){closeSeries();continue;}
   const c=S.challenger;
   const mySingle=[...c.r1,...(c.r2||[])].some(m=>!m.r&&(m.a===S.teamName||m.b===S.teamName));
   const myPo=c.po&&!c.final&&[...c.po.wb1,...c.po.lb1,...c.po.wb2,...c.po.lb2,c.po.wf,c.po.lbs,c.po.lbf].some(m=>!m.r&&(m.a===S.teamName||m.b===S.teamName));
   const myFinal=c.final&&!c.final.r&&(c.final.a===S.teamName||c.final.b===S.teamName);
   if(!mySingle&&!myPo&&!myFinal){if(!c.champ)startCup(S);if(!S.series)break;continue;}
   startCup(S);
   if(!S.series&&!c.champ)break;
  }
  let g2=0;
  while(S.phase==='ewc'&&g2++<40){
   if(S.series){closeSeries();continue;}
   const myPending=[...S.ewc.qf,...S.ewc.sf,S.ewc.final].some(m=>!m.r&&(m.a===S.teamName||m.b===S.teamName));
   if(!myPending)break;
   startCup(S);
   if(!S.series&&!S.ewc.champ)break;
  }
  if(S.split!=='summer')fail('EWC 后未进夏季赛');
  runLeague();
  advanceCalendar(S); // → 亚运年先打亚运会 → 年度总决赛
  let ag=0;
  while(S.phase==='asiad'&&ag++<20)asiadStep(S); // 2026 亚运年：AI 代打（国家队教练席不在玩家手里）
  if(S.phase!=='annual')fail('亚运后未进年总: '+S.phase);
  let g3=0;
  while(S.phase==='annual'&&g3++<120){
   if(S.series){closeSeries();continue;}
   const a=S.annual;
   if(a.stage==='arena'&&a.roundIdx<6){startCup(S);if(!S.series)break;continue;}
   if(!S.series&&!a.po)break;
   startCup(S);
   if(!S.series&&a.stage==='po'&&a.po.champ)break;
   if(!S.series&&a.stage==='breakthrough'&&a.brk.every(m=>m.r))continue;
   if(!S.series)break;
  }
  if(S.phase!=='r1'||S.season!==2)fail('年度轮换未完成: phase='+S.phase+' season='+S.season);

  // ④ 回顾快照：五个赛段齐全 + 董事会评价 + 转会台账 + 年度轮换清账
  const r=(S.yearReviews||[])[0];
  if(!r)fail('年度回顾未生成');
  else{
   const evs=r.stages.map(x=>x.ev);
   const need=['春季赛','挑战者杯','EWC电竞世界杯','夏季赛','KPL年度总决赛'];
   const missing=need.filter(e=>!evs.includes(e));
   if(missing.length)fail('成绩曲线缺赛段: '+missing.join('/'));
   else if(!r.board)fail('回顾缺董事会评价');
   else if(r.year!==2026)fail('回顾年份异常: '+r.year);
   else if(!r.transfers.length)fail('回顾缺转会记录');
   else if(S.yearStages.length!==0)fail('年度轮换未清空 yearStages: '+S.yearStages.length);
   else if(S._reviewNew!==2026)fail('俱乐部页提示未设置');
   else log('④ 回顾快照：2026 年五赛段齐全（'+evs.join('→')+'）· 董事会「'+r.board.note+'」· '+r.transfers.length+' 笔转会 · _reviewNew 提示就位 · yearStages 已清账');
  }

  // ⑤ 关键战役：给一份当年带 peak 标记的复盘，回顾应收录（年度轮换后 gameYear 已是下一年）
  const y2=gameYear(S);
  S.history.unshift({yr:y2,opp:'测试对手',stage:'总决赛',score:'4:3',win:true,peak:true});
  S.yearStages.push({ev:'春季赛',place:'冠军'}); // 补造数据后重建快照验证过滤
  const r2=buildYearReview(S);
  if(!r2.keys.some(k=>k.opp==='测试对手'&&k.peak))fail('关键战役未收录（yr 过滤或 peak 判定失效）');
  else if((S.yearReviews||[])[0]!==r2)fail('重建快照未置顶');
  else log('⑤ 关键战役：带 peak 标记的当年复盘被收录（按 yr 过滤，' +r2.keys.length+' 场）');

  // ⑥ 渲染：俱乐部提示条 / 回顾弹窗 / 经营页归档
  S._reviewNew=y2;
  let rErr='';
  try{
   goPage('club');
   const club=document.querySelector('#page-club').innerHTML;
   if(!club.includes('年度回顾'))fail('俱乐部页缺少回顾提示条');
   showYearReview(0);
   const modal=document.querySelector('#app-modal-body').innerHTML;
   ['成绩曲线','转会记录','董事会评价','关键战役','本年度成就','经营快照'].forEach(t=>{if(!modal.includes(t))fail('回顾弹窗缺区块: '+t);});
   if(S._reviewNew!==null)fail('查看后提示未清除');
   goPage('biz');
   const biz=document.querySelector('#page-biz').innerHTML;
   if(!biz.includes('年度回顾'))fail('经营页缺少回顾归档面板');
   if(!biz.includes('showYearReview(0)'))fail('经营页归档没有入口');
  }catch(e){rErr=e.message;}
  if(rErr)fail('渲染异常: '+rErr);
  else log('⑥ 渲染：俱乐部提示条 → 回顾弹窗（六区块）→ 经营页归档入口，查看后提示已清除');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
