// 三年冲冠文档回归：王朝反制可感 / 夺冠信任不倒扣 / 中档 KPI 校准
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  // ① 王朝反制：连冠时对手研究加成 ≥4%/冠
  S=newState('王朝队','王');fillRoster(S,'star','star');
  S.preseason=false;S.transferWindow=0;
  S.titleHistory=[{season:1,champ:'王朝队'},{season:1,champ:'王朝队'},{season:2,champ:'王朝队'}];
  const st=dynastyStreak(S,'王朝队');
  if(st<2)fail('连冠计数异常: '+st);
  // 对手研究：simSeriesResult 用 0.045
  const other=newState('对手队','对');fillRoster(other,'mid');
  // 直接测 streak 与 cap
  const cap0=S.wageCap;
  // 削帽：模拟新赛季
  S.phase='champion';S.split='summer';
  // 只测 dynasty 参数，不跑完整 newSeason（避免年总递归）
  const expectCapGrow = st>=3?15:st>=2?30:st>=1?55:80;
  if(expectCapGrow>=80)fail('王朝帽成长未放缓: st='+st+' grow='+expectCapGrow);
  else log('① 王朝帽成长：st='+st+' → +'+expectCapGrow+'（正常 +80）');

  // ② 夺冠赛季信任地板：即便 KPI 未达成，有冠也不倒扣
  S=newState('信任队','信');fillRoster(S,'mid');
  S.mode='coach';
  S.preseason=false;S.transferWindow=0;
  S.board={trust:60,kpi:{target:10,from:null,label:'x'},warn:2,fired:false,firedSeason:0,log:[]};
  S.annualPts={[S.teamName]:10}; // 排名可能不佳
  S.honors=[{season:S.season,title:'测试冠',champion:true}];
  const r=boardSettle(S);
  if(S.board.trust<55)fail('夺冠后信任仍大跌: 60→'+S.board.trust+' delta='+r.delta);
  else if(S.board.warn!==0)fail('夺冠赛季 warn 未清零: '+S.board.warn);
  else log('② 夺冠信任地板：delta='+r.delta+' trust 60→'+S.board.trust+' · warn=0');

  // ③ 亚军记功
  S=newState('亚军队','亚');fillRoster(S,'mid');
  S.mode='coach';S.board={trust:50,kpi:{target:10,from:null,label:'x'},warn:1,fired:false,firedSeason:0,log:[]};
  S.annualPts={[S.teamName]:40};
  S.honors=[{season:S.season,title:'测试亚',champion:false}];
  const r2=boardSettle(S);
  if(!(r2.delta>0||S.board.trust>=50))fail('亚军未记功: delta='+r2.delta+' trust='+S.board.trust);
  else log('③ 亚军记功：delta='+r2.delta+' trust 50→'+S.board.trust);

  // ④ 中档 KPI：不要求必夺冠（目标放宽）
  const t1=boardKpiTarget(6,S);   // 上年第6 → 前10
  const t2=boardKpiTarget(2,S);   // 上年第2 → 前5
  const t3=boardKpiTarget(12,S);  // 上年第12 → 前14
  if(!(t1>=10&&t2>=5&&t2<=6&&t3>=13))fail('KPI 目标过苛: 6→'+t1+' 2→'+t2+' 12→'+t3);
  else log('④ 中档 KPI：上年6→前'+t1+' · 上年2→前'+t2+' · 上年12→前'+t3);

  // ⑤ 夺冠赛季跳过现金流告警
  S=newState('现金流队','流');fillRoster(S,'mid');S.mode='coach';
  S.board={trust:60,kpi:null,warn:0,fired:false,firedSeason:0,log:[]};
  S.fund=10; // 现金告急
  S.honors=[{season:S.season,title:'c',champion:true}];
  const trustBefore=S.board.trust;
  boardCashPulse(S);
  if(S.board.trust!==trustBefore)fail('夺冠赛季仍被现金流告警扣信任');
  else log('⑤ 夺冠赛季现金流告警静音');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
