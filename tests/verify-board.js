// 董事会/信任度回归：KPI 下发与结算 / 下课触发条件 / 干预与特权 / 旧档迁移 / UI 终局守卫
// 设计要点：下课是"软终局"——只在 UI 入口拦截，不阻塞 nextDay/startMatch 等底层推进，
//   否则平衡门禁（sim/sim-quick/fuzz 直接调这些函数）会失去校准意义。用例 ⑨ 专门守这条。
// 运行：node tests/verify-board.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  const mkBoard=o=>Object.assign({trust:60,kpi:null,warn:0,fired:false,firedSeason:0,log:[]},o||{});

  S=newState('探针队','⚔️');
  fillRoster(S);

  // ① 首年 KPI：按分组档位下发（S组→前4 / A组→前8 / B组→前12）
  const kpiOf=g=>{S.groups={S:[],A:[],B:[]};S.groups[g]=['探针队'];S.managerCareer={years:0,titles:0,lastRank:null};setBoardKpi(S);return S.board.kpi.target;};
  const kS=kpiOf('S'),kA=kpiOf('A'),kB=kpiOf('B');
  if(kS!==4||kA!==8||kB!==12)fail('首年 KPI 未按分组档位下发: S='+kS+' A='+kA+' B='+kB);
  else log('① 首年 KPI：S组→前'+kS+' / A组→前'+kA+' / B组→前'+kB);

  // ② 有历史名次时按名次定目标
  S.managerCareer={years:1,titles:0,lastRank:3};setBoardKpi(S);
  const tTop=S.board.kpi.target;
  S.managerCareer={years:1,titles:0,lastRank:15};setBoardKpi(S);
  const tLow=S.board.kpi.target;
  if(tTop!==4||tLow!==12)fail('有历史名次时目标错误: 第3名→'+tTop+' 第15名→'+tLow);
  else log('② 依上季名次定目标：第3名→前'+tTop+' · 第15名→前'+tLow);

  // ③ 达成 KPI → 信任度上升且封顶 100
  S.managerCareer={years:0,titles:0,lastRank:null};S.honors=[];
  S.board=mkBoard({trust:50,kpi:{target:12,from:null}});
  S.annualPts={'探针队':100,'甲':90,'乙':80};
  let r=boardSettle(S);
  if(r.rank!==1||r.delta<=0||S.board.trust!==50+Math.min(r.delta,20))fail('达成后信任度未上升: rank='+r.rank+' delta='+r.delta+' trust='+S.board.trust);
  else log('③ 达成目标：年度积分第 '+r.rank+' 名 → 信任度 +'+r.delta+'（'+S.board.trust+'）');
  S.board=mkBoard({trust:95,kpi:{target:12,from:null}});
  S.honors=[];boardSettle(S);
  if(S.board.trust>100)fail('信任度越界 >100: '+S.board.trust);
  else log('③ 信任度封顶：95 → '+S.board.trust+'（不超过 100）');

  // ④ 未达成 → 信任度下降且不越界
  S.board=mkBoard({trust:50,kpi:{target:4,from:3}});S.honors=[];
  S.annualPts={'甲':100,'乙':95,'丙':90,'丁':85,'戊':80,'探针队':10};
  r=boardSettle(S);
  if(r.rank<=4||r.delta>=0)fail('未达成判定错误: rank='+r.rank+' delta='+r.delta);
  else log('④ 未达成：第 '+r.rank+' 名（目标前 4）→ 信任度 '+r.delta+'（'+S.board.trust+'）· 警告 '+S.board.warn+' 次');
  // 下限：低信任 + 小幅未达成 → 扣至贴近 0，且不得为负（此场景不触发解约，专测边界）
  S.board=mkBoard({trust:10,kpi:{target:4,from:3}});S.honors=[];
  S.annualPts={'甲':100,'乙':95,'丙':90,'丁':85,'探针队':80};
  const rFloor=boardSettle(S);
  if(rFloor.rank!==5||rFloor.delta>=0)fail('下限场景构造错误: rank='+rFloor.rank+' delta='+rFloor.delta);
  else if(S.board.trust!==2||S.board.trust<0)fail('信任度下限异常: 10'+rFloor.delta+'='+S.board.trust+'（应为 2）');
  else log('④ 信任度下限：10 '+rFloor.delta+' = '+S.board.trust+'（不低于 0，且此场景未解约）');

  // ⑤ 下课：信任度归零必须解约
  S.board=mkBoard({trust:5,kpi:{target:4,from:3}});S.honors=[];
  S.annualPts={'甲':100,'乙':95,'丙':90,'丁':85,'戊':80,'探针队':10};
  boardSettle(S);
  if(S.board.trust!==0)fail('信任度应归零，实际 '+S.board.trust);
  if(!S.board.fired)fail('信任度归零却未解约（终局缺失）');
  else log('⑤ 信任度归零 → 解约（fired=true，解约赛季 '+S.board.firedSeason+'）');

  // ⑥ 连续未达成 + 低信任 → 解约（warn 累计）
  S.board=mkBoard({trust:20,kpi:{target:4,from:3},warn:2});S.honors=[];
  S.annualPts={'甲':100,'乙':95,'丙':90,'丁':85,'戊':80,'探针队':10};
  boardSettle(S);
  if(S.board.warn<3||S.board.trust>24)fail('warn 累计异常: warn='+S.board.warn+' trust='+S.board.trust);
  if(!S.board.fired)fail('连续 3 季未达成且信任≤24 却未解约');
  else log('⑥ 连续未达成 '+S.board.warn+' 季 + 信任 '+S.board.trust+' → 解约');

  // ⑦ 正常未达标不该误触发解约
  S.board=mkBoard({trust:50,kpi:{target:4,from:3}});S.honors=[];
  S.annualPts={'甲':100,'乙':95,'丙':90,'丁':85,'戊':80,'探针队':10};
  boardSettle(S);
  if(S.board.fired)fail('仅一季未达成即被解约（过于严苛）');
  else log('⑦ 单季未达成：信任度 '+S.board.trust+' · 警告 '+S.board.warn+' 次，未解约');

  // ⑧ 董事会态度：低信任砍帽 / 高信任追加预算
  S.wageCap=900;S.fund=8000;S.board=mkBoard({trust:20});boardApplyEffect(S);
  const capLow=S.wageCap,fundLow=S.fund;
  S.wageCap=900;S.fund=8000;S.board=mkBoard({trust:85});boardApplyEffect(S);
  if(!(capLow<900))fail('低信任未压缩工资帽: '+capLow);
  else if(!(S.fund>8000))fail('高信任未追加预算: '+S.fund);
  else log('⑧ 干预：信任20 → 工资帽 900→'+capLow+'；放权：信任85 → 资金 +'+(S.fund-8000)+'万');

  // ⑨ 软终局：解约后 UI 入口不推进，但底层引擎仍可用（平衡门禁依赖后者）
  S=newState('探针队','⚔️');fillRoster(S);
  S.board=mkBoard({fired:true});S.preseason=false;S.day=5;S.phase='r1';S.matchIdx=0;
  uiNextDay(S);uiStartMatch();uiStartCup(S);
  const dayAfter=S.day,seriesAfter=!!S.series;
  if(dayAfter!==5||seriesAfter)fail('解约后 UI 入口仍能推进游戏（软终局失效）: day='+dayAfter+' series='+seriesAfter);
  else if(!boardLocked())fail('boardLocked 未识别解约状态');
  else log('⑨ 软终局：解约后 uiNextDay/uiStartMatch/uiStartCup 全部拦截（day 保持 5，未开赛）');
  S.board=mkBoard({fired:false});S.preseason=false;
  const before=S.day;nextDay(S);
  if(S.day===before)fail('底层 nextDay 被误伤（平衡门禁会因此失效）');
  else log('⑨ 底层 nextDay 未受影响（平衡门禁仍能直接驱动引擎）');

  // ⑩ 面板渲染：解约态与在职态都能渲染
  S.board=mkBoard({fired:true,firedSeason:3});S.managerCareer={years:3,titles:1,lastRank:5};
  renderClub();
  const hFired=document.querySelector('#page-club').innerHTML;
  S.board=mkBoard({trust:42,kpi:{target:8,from:5}});
  renderClub();
  const hOk=document.querySelector('#page-club').innerHTML;
  if(!hFired.includes('已解约'))fail('解约态未渲染解约面板');
  else if(!hOk.includes('信任度 42'))fail('在职态未渲染信任度');
  else if(!hOk.includes('进前 8'))fail('在职态未渲染本赛季目标');
  else log('⑩ 面板渲染：解约态显示结算入口，在职态显示信任度 42 与目标「进前 8」');

  // ⑪ 旧档迁移：v3 存档读入补出 board/managerCareer 默认值
  const legacy={v:3,teamName:'旧档队',icon:'x',season:4,fund:8000,wageCap:900,players:[],market:[],lineup:[],
    coachMarket:[],retiredCoaches:[],assistants:[],hosts:[],freeAgents:[],transferList:[],listed:[],bids:[],annualPts:{}};
  S=legacy;migrateSave();
  if(!S.board||S.board.trust!==60)fail('v3 旧档未补出 board 默认值: '+JSON.stringify(S.board));
  else if(!S.managerCareer||S.managerCareer.years!==0)fail('v3 旧档未补出 managerCareer');
  else if(S.v!==SAVE_VERSION)fail('迁移后版本号未推进: '+S.v);
  else log('⑪ 旧档迁移：v3 → v'+S.v+'，board 信任度默认 60、执教生涯从零计');

  // ⑫ 命名区分：annualRank（队名数组，年总分组用）不能被名次函数覆盖
  S=newState('探针队','⚔️');S.annualPts={'探针队':100,'甲':50};
  const arr=annualRank(S),num=myAnnualRank(S);
  if(!Array.isArray(arr))fail('annualRank 应返回队名数组（年总分组用），现为 '+typeof arr);
  else if(typeof num!=='number')fail('myAnnualRank 应返回数字名次');
  else log('⑫ 语义区分：annualRank→数组['+arr.join(',')+'] · myAnnualRank→第 '+num+' 名');

  // ⑬ 弱队一分未得也必须被评价（回归：旧写法要求 pts[me] 存在，弱队因此被判"缺数据不评价"，
  //    董事会恰好在最该施压的弱队身上静默失效——这条用例专防它回来）
  S=newState('探针队','⚔️');S.leagueTeams=['探针队','甲','乙','丙','丁','戊','己','庚'];
  S.annualPts={'甲':100,'乙':90}; // 本队一分未得（未进季后赛）
  S.board=mkBoard({trust:60,kpi:{target:4,from:2}});S.honors=[];
  const rWeak=boardSettle(S);
  if(rWeak.rank==null)fail('弱队无积分时取不到名次（董事会静默失效）');
  else if(rWeak.delta>=0)fail('弱队无积分却未判未达标: delta='+rWeak.delta);
  else log('⑬ 弱队一分未得：仍取到名次（第 '+rWeak.rank+'/'+S.leagueTeams.length+'）并判未达标 Δ'+rWeak.delta);

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
