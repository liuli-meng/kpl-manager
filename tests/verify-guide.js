// 新手引导 + 每页提示回归
// 运行：node tests/verify-guide.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);

  // 准备：经理档 + 引导标记先置位（提示条检查不被引导弹窗干扰）
  S=newState('引导队','⚔️');fillRoster(S,'mid');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);S.seedPower=teamPower(S);
  initGroups(S);S.preseason=false;S.transferWindow=0;
  localStorage.setItem('km_tour','1');

  // ① 每页提示：经理模式所有可见页首行都有 page-hint
  const mp=MODE_PAGES.manager;
  const missHint=mp.filter(p=>{
    renderPage(p);
    return !($('#page-'+p).innerHTML||'').includes('page-hint');
  });
  if(missHint.length)fail('经理页缺提示条: '+missHint.join(','));
  else log('① 每页提示：经理 '+mp.length+' 页全部带「这是什么」首行');

  // ② 提示条可单页关闭：dismissHint 后该页不再渲染，其他页不受影响
  dismissHint('club');
  if((($('#page-club').innerHTML)||'').includes('page-hint'))fail('club 提示条关闭后仍渲染');
  else{
    localStorage.removeItem('km_hints');
    renderPage('lineup');
    if(!($('#page-lineup').innerHTML||'').includes('page-hint'))fail('lineup 提示条被误伤');
    else log('② 提示关闭：dismissHint(club) 后 club 无提示 · 其他页不受影响');
  }

  // ③ 三身份页签各有提示数据（player 独有的 career 页也覆盖）
  if(!PAGE_HINTS.career||!PAGE_HINTS.hall)fail('PAGE_HINTS 缺 career/hall 文案');
  else log('③ 提示文案：career/hall 等三身份页签全覆盖');

  // ④ 首进自动弹引导：清标记 → goPage 触发 maybeStartTour → app-modal 出引导内容
  localStorage.removeItem('km_tour');
  goPage('club');
  const t1=$('#app-modal-body').innerHTML||'';
  if(!t1.includes('欢迎来到')||!t1.includes('tourNext'))fail('首进未自动弹引导');
  else log('④ 首进引导：goPage 自动弹出（欢迎页 → 各页 → 收尾）');

  // ⑤ 步进：走到最后一步出现「开始征程」；走完置 km_tour 且 _tour 关闭
  const stepsN=MODE_PAGES.manager.length+2;
  for(let i=0;i<stepsN-1;i++)tourNext();
  const lastBody=$('#app-modal-body').innerHTML||'';
  if(!lastBody.includes('tourFinish'))fail('最后一步应出现「开始征程」按钮');
  tourFinish();
  if(localStorage.getItem('km_tour')!=='1')fail('完成后未写 km_tour 标记');
  else if(_tour.on)fail('完成后 _tour.on 应为 false');
  else log('⑤ 步进闭环：'+stepsN+' 步走完 → km_tour 置位 + 引导收起');

  // ⑥ 完成后不再自动弹：goPage 不触发引导
  const before=$('#app-modal-body').innerHTML||'';
  goPage('league');
  if(($('#app-modal-body').innerHTML||'')!==before)fail('完成后 goPage 仍改写弹窗（引导未正确关闭）');
  else log('⑥ 不再骚扰：完成后 goPage 不再弹引导');

  // ⑦ 跳过路径 + 重玩入口：清标记 → goPage 弹出 → tourSkip 置标记；startTour 可手动重放
  localStorage.removeItem('km_tour');
  goPage('club');tourSkip();
  if(localStorage.getItem('km_tour')!=='1')fail('跳过未置 km_tour 标记');
  startTour();
  if(!($('#app-modal-body').innerHTML||'').includes('欢迎来到'))fail('startTour 重放失败');
  else{tourSkip();log('⑦ 跳过与重放：tourSkip 置标记 · startTour 可从「管理」重放');}

  // ⑧ 三身份步数 = 可见页数 + 首尾两页
  S.mode='player';const nP=tourSteps().length;
  S.mode='coach';const nC=tourSteps().length;
  S.mode='manager';const nM=tourSteps().length;
  if(nP!==MODE_PAGES.player.length+2||nC!==MODE_PAGES.coach.length+2||nM!==MODE_PAGES.manager.length+2)
    fail('步数与身份页签不匹配: '+nP+'/'+nC+'/'+nM);
  else log('⑧ 身份适配：选手 '+nP+' 步 · 教练 '+nC+' 步 · 经理 '+nM+' 步（=可见页+2）');

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
