// 本机偏好回归：简化模式确认跳过 / 高对比开关 / 双开锁心跳 / 赛前优化首发 / 面板渲染
// 运行：node tests/verify-prefs.js
const vm = require('vm');
const { makeDom, makeTester } = require('./harness');
const { dom } = makeDom();
const t = makeTester('本机偏好');

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  const _confirm=confirm;
  const setConfirm=v=>{confirm=v;};

  // ① 默认关闭：simpleMode/highContrast 为 false，confirmSoft 仍走 confirm
  localStorage.removeItem('km_prefs');
  if(simpleMode()||highContrast())fail('默认偏好应全关');
  else log('① 默认关闭：simple/hc 均为 false');
  setConfirm(()=>false);
  if(confirmSoft('例行？'))fail('默认关时 confirmSoft 应弹确认且可取消');
  else log('①b confirmSoft 默认走 confirm，取消返回 false');

  // ② 简化模式：confirmSoft 跳过；confirmDanger 仍弹
  setUiPref('simple',true);
  if(!simpleMode())fail('setUiPref simple 未生效');
  setConfirm(()=>false);
  if(!confirmSoft('例行？'))fail('简化模式下 confirmSoft 应直接 true');
  else log('② 简化模式：confirmSoft 跳过确认');
  if(confirmDanger('高代价？'))fail('简化模式下 confirmDanger 仍应弹并可取消');
  else log('②b 高代价 confirmDanger 仍拦截');

  // ③ 落盘与往返：偏好只进 localStorage，不进存档对象
  const raw=localStorage.getItem('km_prefs');
  if(!raw||!JSON.parse(raw).simple)fail('km_prefs 未写入');
  else log('③ 偏好落盘 km_prefs（不进 SAVE_KEY）');
  setUiPref('hc',true);
  if(!highContrast())fail('hc 未生效');
  else log('③b 高对比开关生效');

  // ④ 双开锁：_touchTabLock 写入 id+时间戳；save 不抛错
  S=newState('偏好队','偏');fillRoster(S,'mid');
  S.lineup=S.players.map(p=>p.id);
  _touchTabLock();
  const lock=JSON.parse(localStorage.getItem('km_tab_lock'));
  if(!lock||!lock.id||lock.id!==_tabId)fail('双开锁 id 应等于本 tab');
  else log('④ 双开锁心跳：id='+lock.id);
  if(!save())fail('save() 应成功');
  const lock2=JSON.parse(localStorage.getItem('km_tab_lock'));
  if(!lock2||lock2.id!==_tabId||!lock2.t)fail('save 后锁未刷新');
  else log('④b save() 刷新锁时间戳');

  // ⑤ initTabGuard：BroadcastChannel 缺失时不抛错
  try{initTabGuard();log('⑤ initTabGuard 在沙箱可跑（无 BroadcastChannel 也不炸）');}
  catch(e){fail('initTabGuard 抛错: '+e.message);}

  // ⑥ optimizeLineup：非简化模式不动；简化模式把更高战力换进首发
  setUiPref('simple',false);
  S=newState('优化队','优');
  const used=new Set();
  POS_ORDER.forEach((pos,i)=>{
    S.players.push(genPlayer(genFreeAgentDef(pos,i===0?'low':'star',used)));
  });
  S.lineup=S.players.map(p=>p.id);
  const weakId=S.players[0].id;
  const pow0=playerPower(S.players[0],S.players[0].sig);
  // 同位置再造一个更强替补
  const strongDef=genFreeAgentDef('top','top',used);
  const strong=genPlayer(strongDef);
  // 强行把 top 拉到明显高于弱首发
  strong.attrs={lane:95,farm:95,team:95,mind:95};
  S.players.push(strong);
  const before=S.lineup.slice();
  optimizeLineup(S);
  if(S.lineup.join()!==before.join())fail('非简化模式 optimizeLineup 不应改动首发');
  else log('⑥ 非简化模式：首发不变');
  setUiPref('simple',true);
  optimizeLineup(S);
  if(!S.lineup.includes(strong.id)||S.lineup.includes(weakId))fail('简化模式未把更强 top 换进首发: '+S.lineup.join());
  else log('⑥b 简化模式：更强 top 已换入首发');

  // ⑦ renderBiz 面板：含本机偏好标题与两个 toggle 回调
  renderBiz();
  const pageHtml=document.getElementById('page-biz').innerHTML;
  if(!pageHtml||pageHtml.indexOf('本机偏好')<0)fail('经营页未渲染本机偏好面板');
  else if(pageHtml.indexOf('toggleSimpleMode')<0||pageHtml.indexOf('toggleHighContrast')<0)fail('偏好开关回调缺失');
  else log('⑦ 经营页本机偏好面板渲染 OK（含两个开关）');

  // 清理：恢复默认
  localStorage.removeItem('km_prefs');
  applyUiPrefs();
  setConfirm(_confirm);
  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
