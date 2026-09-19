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

  // ④ 首进自动弹引导：默认「3 步上手」（quick），含欢迎页与任务步骤
  localStorage.removeItem('km_tour');
  localStorage.removeItem('km_missions');
  goPage('club');
  const t1=$('#app-modal-body').innerHTML||'';
  if(!t1.includes('3 步上手')||!t1.includes('tourNext'))fail('首进未自动弹 3 步上手引导');
  else if(_tour.mode!=='quick')fail('首进应为 quick 模式，实际 '+_tour.mode);
  else log('④ 首进引导：goPage 自动弹出「3 步上手」（目标驱动）');

  // ⑤ 步进：quick 步数 = 1欢迎 + 3任务 + 1收尾；走完置 km_tour 且 _tour 关闭
  const stepsN=quickSteps().length;
  if(stepsN!==5)fail('quick 步数应为 5，实际 '+stepsN);
  for(let i=0;i<stepsN-1;i++)tourNext();
  const lastBody=$('#app-modal-body').innerHTML||'';
  if(!lastBody.includes('tourFinish'))fail('最后一步应出现收尾按钮');
  tourFinish();
  if(localStorage.getItem('km_tour')!=='1')fail('完成后未写 km_tour 标记');
  else if(_tour.on)fail('完成后 _tour.on 应为 false');
  else log('⑤ 步进闭环：quick '+stepsN+' 步走完 → km_tour 置位 + 引导收起');

  // ⑥ 完成后不再自动弹：goPage 不触发引导
  const before=$('#app-modal-body').innerHTML||'';
  goPage('league');
  if(($('#app-modal-body').innerHTML||'')!==before)fail('完成后 goPage 仍改写弹窗（引导未正确关闭）');
  else log('⑥ 不再骚扰：完成后 goPage 不再弹引导');

  // ⑦ 跳过路径 + 完整引导重放：tourSkip 置标记；startTour 走页码 tour
  localStorage.removeItem('km_tour');
  goPage('club');tourSkip();
  if(localStorage.getItem('km_tour')!=='1')fail('跳过未置 km_tour 标记');
  startTour();
  if(_tour.mode!=='full')fail('startTour 应进入 full 模式');
  if(!($('#app-modal-body').innerHTML||'').includes('欢迎来到'))fail('startTour 重放失败');
  else{tourSkip();log('⑦ 跳过与重放：tourSkip 置标记 · startTour 可从「管理」重放完整引导');}

  // ⑧ 三身份完整 tour 步数 = 可见页数 + 首尾两页；quick 固定 5 步
  S.mode='player';const nP=tourSteps().length;const qP=quickSteps().length;
  S.mode='coach';const nC=tourSteps().length;
  S.mode='manager';const nM=tourSteps().length;const qM=quickSteps().length;
  if(nP!==MODE_PAGES.player.length+2||nC!==MODE_PAGES.coach.length+2||nM!==MODE_PAGES.manager.length+2)
    fail('完整 tour 步数与身份页签不匹配: '+nP+'/'+nC+'/'+nM);
  else if(qP!==5||qM!==5)fail('quick 步数应恒为 5，实际 '+qP+'/'+qM);
  else log('⑧ 身份适配：完整 tour 选手 '+nP+' 步 · 教练 '+nC+' 步 · 经理 '+nM+' 步 · quick 均为 5 步');

  // ⑨ 前 3 日任务条：day<=3 且未完成时 club/career 出现 mission-strip
  localStorage.removeItem('km_missions');
  localStorage.removeItem('km_seasonquest');
  S.day=1;S.trained=false;S.season=1;
  const strip=missionStrip(S);
  if(!strip.includes('新手任务')||!strip.includes('mission-strip'))fail('missionStrip 未渲染');
  else{
    S.day=5;
    const late=missionStrip(S);
    if(late.includes('新手任务'))fail('day>3 不应再显示新手任务');
    else{
      S.day=1;S.trained=true;markMissionSeen('done_m1');
      const after=missionStrip(S);
      if(after.includes('完成一次训练'))fail('已完成的 m1 不应再出现');
      else log('⑨ 任务条：前 3 日显示新手任务 · 完成即消失 · day>3 隐藏新手任务（赛季主线可独立显示）');
    }
  }

  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
