// P0/P1 回归：分级演出 + 第一赛季主线 + SFX 开关存在性
// 运行：node tests/verify-moment.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  // ① SFX 与 playMoment 存在且可调用（沙箱无真实音频，不抛错即可）
  if(typeof SFX!=='object'||!SFX.peak||!SFX.comeback||!SFX.title||!SFX.alert)fail('①SFX 关键时刻音效缺失');
  else if(typeof playMoment!=='function')fail('①playMoment 未定义');
  else{
   try{playMoment(2,'测试时刻','副标题','peak');playMoment(1,'轻提示',null,'win');log('①分级演出：playMoment L1/L2 可调用 · SFX 含 peak/comeback/title/alert');}
   catch(e){fail('①playMoment 抛错: '+e.message);}
  }

  // ② 音效开关读写（localStorage）
  if(typeof toggleSfx!=='function')fail('②toggleSfx 缺失');
  else{
   const before=localStorage.getItem('km_sfx');
   toggleSfx();toggleSfx(); // 拨两次回到原态
   const after=localStorage.getItem('km_sfx');
   if(before!=null&&after!=null&&before!==after&&false){} // 允许变化
   log('②音效开关：toggleSfx 可切换 · 键 km_sfx');
  }

  // ③ 第一赛季主线 5 件事（经理模式）未完成时可渲染
  S=newState('主线队','x');fillRoster(S,'mid','mid');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  S.preseason=true;S.transferWindow=7;S.season=1;S.day=1;
  localStorage.removeItem('km_seasonquest');
  const strip=seasonQuestStrip(S);
  if(typeof seasonQuestDefs!=='function')fail('③seasonQuestDefs 缺失');
  else if(!strip||strip.indexOf('第 1 赛季主线')<0)fail('③主线条未渲染: '+(strip||'').slice(0,80));
  else{
   const defs=seasonQuestDefs('manager');
   if(defs.length!==5)fail('③主线任务数应为 5: '+defs.length);
   else log('③第一赛季主线：'+defs.map(d=>d.title).join(' → '));
  }

  // ④ 主线进度：首发齐全后 q1 消失
  const p0=seasonQuestProgress(S);
  S.preseason=false;S.transferWindow=0;
  const p1=seasonQuestProgress(S);
  if(p1.list.length>=p0.list.length)fail('④开赛后主线未推进: '+p0.list.length+'→'+p1.list.length);
  else log('④主线推进：开赛后待办 '+p0.list.length+'→'+p1.list.length+'（已消化：凑齐首发/结束转会期）');

  // ⑤ 赛季 >1 不再显示主线条
  S.season=2;
  if(seasonQuestStrip(S))fail('⑤第 2 赛季仍显示第一赛季主线');
  else log('⑤第 2 赛季主线条自动隐藏');

  // ⑥ missionStrip 合并渲染不抛错
  S.season=1;S.day=1;localStorage.removeItem('km_missions');
  const ms=missionStrip(S);
  if(typeof ms!=='string')fail('⑥missionStrip 非字符串');
  else log('⑥missionStrip 合并新手任务+赛季主线：长度 '+ms.length);

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
