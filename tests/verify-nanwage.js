// 周薪 NaN / 杯赛残缺面板 守卫回归
// 运行：node tests/verify-nanwage.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  // ① weeklyWage：undefined/NaN 不传染
  S=newState('NaN队','x');
  fillRoster(S,'mid','star');
  S.players[0].wage=undefined;
  S.players[1].wage=NaN;
  const ww=weeklyWage(S);
  if(typeof ww!=='number'||!isFinite(ww)||isNaN(ww))fail('weeklyWage 被 NaN 传染: '+ww);
  else log('① weeklyWage 抗 NaN：'+ww+'（注入 undefined/NaN 后仍有限）');

  // ② scrubWages：读档清洗
  scrubWages(S);
  if(S.players.some(p=>typeof p.wage!=='number'||!isFinite(p.wage)||p.wage<0))fail('scrubWages 未洗净');
  else log('② scrubWages：全员工资恢复有限值（'+S.players.map(p=>p.wage).join('/')+'）');

  // ③ fund NaN 兜底
  S.fund=NaN;
  S.v=SAVE_VERSION;
  const round=JSON.parse(JSON.stringify(S)); // JSON 会把 NaN 变 null
  S=round;migrateSave();
  if(typeof S.fund!=='number'||!isFinite(S.fund))fail('migrate 未修 fund: '+S.fund);
  else log('③ migrate：fund NaN/null → '+S.fund);

  // ④ 残缺杯赛面板不抛
  S=newState('面板队','x');fillRoster(S,'mid');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  S.seedPower=teamPower(S);initGroups(S);
  S.challenger={stage:'po',po:null,final:null,champ:null};
  S.playoff={}; // 缺 wb/lb/final
  S.ewc={};S.ag=null;S.annual={stage:'arena'};
  S.card={};
  let err=null;
  try{
    clubChallengerPanel();
    clubPlayoffPanel();
    clubEwcPanel();
    clubAsiadPanel();
    clubAnnualPanel();
    clubCardPanel();
  }catch(e){err=e;}
  if(err)fail('残缺杯赛数据导致面板抛错: '+err.message);
  else log('④ 杯赛残缺数据：六个面板均不抛 TypeError');

  // ⑤ 导出包装：serialize + JSON 往返后仍可 applyImport
  const _ra=renderAll,_sv=save;renderAll=function(){};save=function(){};
  S=newState('导出队','导');fillRoster(S,'mid');
  S.players[0].wage=NaN;
  try{scrubWages(S);}catch(e){}
  const wrap={kplSave:true,v:SAVE_VERSION,exported:'2026-01-01',team:S.teamName,season:S.season,data:JSON.parse(serializeForSave(S))};
  S=newState('空','空');S.fund=1;
  applyImport(wrap,'导出往返');
  if(S.teamName!=='导出队')fail('导出包装往返失败: '+S.teamName);
  else if(S.players.some(p=>typeof p.wage!=='number'||!isFinite(p.wage)))fail('导出往返后仍有 NaN 工资');
  else log('⑤ 导出包装往返：'+S.teamName+' · 工资有限 · 可再导入');
  renderAll=_ra;save=_sv;

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
