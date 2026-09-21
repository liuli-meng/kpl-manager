// B. 推进卡死场景沙箱探针 — 引擎 + UI 入口
// 运行: node .bug-hunt/flow-freeze-probe.js
// 覆盖: preseason / 联赛链 / 杯赛 / yearRoll / board.fired / startMatch 拦截 / 读档 migrate
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { makeDom, injectHelpers } = require(path.join(__dirname, '..', 'tests', 'harness.js'));

const findings = []; // {id, severity, title, steps, fn, how, evidence}
function P0(id, title, steps, fn, how, evidence) {
  findings.push({ id, severity: 'P0', title, steps, fn, how, evidence: String(evidence).slice(0, 800) });
}
function P1(id, title, steps, fn, how, evidence) {
  findings.push({ id, severity: 'P1', title, steps, fn, how, evidence: String(evidence).slice(0, 800) });
}
function INFO(id, title, evidence) {
  findings.push({ id, severity: 'INFO', title, steps: '', fn: '', how: '', evidence: String(evidence).slice(0, 800) });
}

function runSandbox(script, opts) {
  const { dom } = makeDom(opts);
  injectHelpers(dom);
  const logs = [];
  const errs = [];
  // 包一层 IIFE：vm.runInContext 顶层 return 非法
  const wrapped = '(function(){\n' + script + '\n})()';
  try {
    // capture toast
    const origToast = dom.toast;
    dom.toast = (m) => { logs.push('toast:' + m); try { if (typeof origToast === 'function') origToast(m); } catch (_) {} };
    const result = vm.runInContext(wrapped, dom);
    return { result, logs, errs, dom, ok: true };
  } catch (e) {
    return { result: null, logs, errs: [String(e && e.stack || e)], dom, ok: false };
  }
}

/* ========== 共用脚本片段：快速推进联赛 ========== */
const LIB = `
function closeSeriesWin(st, win){
  if(!st.series)return false;
  st.series.mw = win!=null?win:Math.ceil(st.series.max/2);
  st.series.ow = 1;
  finishSeries(win!=null?!!win:true);
  return true;
}
function runLeagueQuick(st){
  let g=0;
  while(!['champion','eliminated'].includes(st.phase)&&g++<220){
    if(st.preseason){st.preseason=false;st.transferWindow=0;continue;}
    if(st.phase==='r1'||st.phase==='r2'||st.phase==='r3'){
      if(st.matchIdx>=(st.schedule||[]).length){advancePhase(st);continue;}
      if(st.series&&st.series.stage==='regular'){closeSeriesWin(st,true);continue;}
      const m=st.schedule[st.matchIdx];
      if(!m){advancePhase(st);continue;}
      st.series={used:[],usedOpp:[],mw:0,ow:0,max:5,stage:'regular',logs:[],myName:st.teamName,opName:m.opp,side:'blue'};
      st.series.mw=3;st.series.ow=1;finishSeries(true);
    }else if(st.phase==='card'){
      if(st.series){closeSeriesWin(st,true);continue;}
      const myCard=st.card&&st.card.matches.find(x=>!x.r&&(x.a===st.teamName||x.b===st.teamName));
      if(!myCard){startCard();continue;}
      st.series={used:[],usedOpp:[],mw:0,ow:0,max:7,stage:'card',cardMatch:myCard,logs:[],myName:st.teamName,opName:myCard.a===st.teamName?myCard.b:myCard.a,side:'blue'};
      st.series.mw=4;st.series.ow=1;finishSeries(true);
    }else if(st.phase==='playoff'){
      if(st.series){closeSeriesWin(st,true);continue;}
      startPlayoff();
      if(!st.series)break;
    }else break;
  }
  return {phase:st.phase,g,series:!!st.series,champ:st.playoff&&st.playoff.champ};
}
function prepManager(){
  S=newState('推进探针','⚔');
  fillRoster(S,'star');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  S.seedPower=teamPower(S);
  startSplit(S,'spring');
  S.preseason=false;S.transferWindow=0;
  return S;
}
function panelHtml(){
  try{ renderClub(); }catch(e){ return 'RENDER_ERR:'+e.message; }
  return (document.getElementById('page-club')||{}).innerHTML||'';
}
function hasBtn(html, re){ return re.test(html||''); }
function na(S){ const a=nextAction(S); return a?{type:a.type,label:a.label,fn:a.fn}:null; }
`;

/* =========================================================
 * B1. preseason=true → uiEndPreseason → phase 可开赛
 * ========================================================= */
function b1() {
  const r = runSandbox(LIB + `
  const out={};
  // 正常：五位置齐全
  S=newState('B1正常','x');
  fillRoster(S,'mid');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  S.seedPower=teamPower(S);
  initGroups(S);
  S.preseason=true;S.transferWindow=5;
  buildTransferMarket(S);refreshMarket(S);
  const a1=na(S);
  out.normalAction=a1;
  out.uiEndPreseasonDefined=typeof uiEndPreseason;
  out.endPreseasonDefined=typeof endPreseason;
  // 引擎直调（confirm 在沙箱恒 true）
  endPreseason(S);
  out.afterEnd={preseason:S.preseason,phase:S.phase,sched:(S.schedule||[]).length,window:S.transferWindow};
  out.actionAfter=na(S);
  try{ startMatch(); out.seriesAfterStart=!!S.series; }catch(e){ out.startErr=e.message; }
  const html=panelHtml();
  out.hasEndBtn=hasBtn(html,/uiEndPreseason/);
  out.hasStartBtn=hasBtn(html,/uiStartMatch|uiDoNextAction|startMatch/);

  // 缺位置：应 toast 拦截，preseason 仍 true，且 UI 有按钮可去转会
  S=newState('B1缺位','x');
  fillRoster(S,'mid');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  // 移除一个位置
  const gone=S.players.find(p=>p.pos==='farm')||S.players[0];
  S.players=S.players.filter(p=>p.id!==gone.id);
  S.lineup=S.lineup.filter(id=>id!==gone.id);
  S.preseason=true;S.transferWindow=3;
  const missPos=POS_ORDER.filter(pos=>!S.players.some(p=>p.pos===pos&&!p.loan));
  out.missPos=missPos;
  const toasts=[];
  const orig=toast; toast=m=>{toasts.push(m);};
  endPreseason(S);
  toast=orig;
  out.missToasts=toasts;
  out.missPreseasonStill=S.preseason;
  out.missAction=na(S);
  const html2=panelHtml();
  out.missHasEndBtn=hasBtn(html2,/uiEndPreseason/);
  out.missHasMarket=hasBtn(html2,/goPage\\('market'\\)/);

  // window 耗尽自动开赛
  S=newState('B1耗尽','x');
  fillRoster(S,'mid');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  S.seedPower=teamPower(S);
  initGroups(S);
  S.preseason=true;S.transferWindow=1;
  buildTransferMarket(S);refreshMarket(S);
  nextDay(S);
  out.afterNextDay={preseason:S.preseason,phase:S.phase,window:S.transferWindow,sched:(S.schedule||[]).length};
  out.afterNextDayAction=na(S);
  return out;
  `);
  const o = r.result || {};
  if (!r.ok) {
    P0('B1-throws', 'preseason 探针抛错', 'B1 沙箱', 'uiEndPreseason/endPreseason', '脚本异常导致无法验证', r.errs.join('\n'));
    return;
  }
  INFO('B1-normal', 'preseason 正常结束', JSON.stringify({
    normalAction: o.normalAction, afterEnd: o.afterEnd, actionAfter: o.actionAfter,
    seriesAfterStart: o.seriesAfterStart, startErr: o.startErr,
    uiEndPreseasonDefined: o.uiEndPreseasonDefined,
  }));
  if (o.uiEndPreseasonDefined !== 'function') {
    P0('B1-missing-fn', 'uiEndPreseason 未定义', 'preseason=true 点结束转会期', 'uiEndPreseason', 'onclick 绑定的函数不存在，按钮点击无效果/报错', o.uiEndPreseasonDefined);
  }
  if (!o.afterEnd || o.afterEnd.preseason !== false) {
    P0('B1-cannot-end', 'preseason 无法结束/phase 无法开赛', 'newState → fillRoster → endPreseason', 'endPreseason', 'endPreseason 后 preseason 仍 true，联赛无法开始', JSON.stringify(o.afterEnd));
  } else if (!o.actionAfter || !/startMatch|startPlayerMatch/.test(o.actionAfter.type || '')) {
    P0('B1-no-match-btn', '结束后 nextAction 无开赛入口', 'endPreseason 后', 'nextAction', 'phase 已开但 nextAction 不返回 startMatch，UI 无开赛按钮', JSON.stringify(o.actionAfter));
  }
  if (o.missPreseasonStill === false && o.missPos && o.missPos.length) {
    P0('B1-miss-pass', '缺位置仍被 endPreseason 放行', '删掉 farm 后 endPreseason', 'endPreseason', '缺位置校验失效，联赛在无首发时开始', JSON.stringify({ missPos: o.missPos, toasts: o.missToasts, after: o.missPreseasonStill }));
  }
  if (o.missPreseasonStill !== false && !(o.missToasts || []).length) {
    P0('B1-miss-silent', '缺位置拦截时无说明文案', '删掉 farm 后 endPreseason', 'endPreseason', '既没开赛也没 toast，玩家不知如何解除', JSON.stringify(o));
  }
  if (!o.missHasEndBtn && o.missPreseasonStill !== false) {
    // still preseason but no end button — check if panel has market
    if (!o.missHasMarket) {
      P0('B1-miss-no-ui', '缺位时 UI 无任何解除入口', 'preseason + 缺位置', 'clubLeaguePhasePanel', '俱乐部页既无结束转会期也无跳转市场，玩家卡在转会期', JSON.stringify({ missHasEndBtn: o.missHasEndBtn, missHasMarket: o.missHasMarket }));
    }
  }
  INFO('B1-exhaust', 'window 耗尽自动开赛', JSON.stringify(o.afterNextDay));
  if (o.afterNextDay && o.afterNextDay.preseason === true && o.afterNextDay.window === 0) {
    P0('B1-stuck-window', '转会窗耗尽仍停在 preseason', 'transferWindow=1 → nextDay', 'nextDay/endTransferWindow', 'window=0 且 preseason=true，永远无法开赛', JSON.stringify(o.afterNextDay));
  }
}

/* =========================================================
 * B2. 联赛 r1/r2/r3 → card → playoff → champion/eliminated → advanceCalendar
 * ========================================================= */
function b2() {
  const r = runSandbox(LIB + `
  const out={steps:[]};
  prepManager();
  const log=(t)=>out.steps.push(t+' phase='+S.phase+' idx='+S.matchIdx+' series='+!!S.series+' card='+(!!S.card)+' po='+(S.playoff?JSON.stringify({champ:S.playoff.champ,final:S.playoff.final&&S.playoff.final.r}):null));

  // r1 action
  out.r1Action=na(S); log('r1');
  // 打完 r1
  if(S.phase==='r1'){
    const m=S.schedule[S.matchIdx];
    S.series={used:[],usedOpp:[],mw:0,ow:0,max:5,stage:'regular',mid:m&&m.mid,logs:[],myName:S.teamName,opName:m.opp,side:'blue'};
    S.series.mw=3;S.series.ow=1;finishSeries(true);
  }
  log('after-r1-match');
  out.r1AfterAction=na(S);
  const htmlR1=panelHtml();
  out.r1HasBtn=hasBtn(htmlR1,/uiStartMatch|uiDoNextAction|startMatch/);

  // 快进全联赛
  const league=runLeagueQuick(S);
  out.league=league; log('league-end');
  out.endPhaseAction=na(S);
  const htmlEnd=panelHtml();
  out.endHasAdvance=hasBtn(htmlEnd,/uiAdvanceCalendar|uiDoNextAction/);
  out.endHasChampText=/总冠军|冠军|淘汰|出局|年度/.test(htmlEnd);

  // advanceCalendar
  try{ advanceCalendar(S); out.advErr=null; }catch(e){ out.advErr=e.message; }
  out.afterAdv={phase:S.phase,split:S.split,preseason:S.preseason}; log('after-adv');
  out.afterAdvAction=na(S);
  const htmlAdv=panelHtml();
  out.afterAdvHasBtn=hasBtn(htmlAdv,/uiStartCup|uiAdvanceCalendar|uiEndPreseason|uiDoNextAction|startCard|startPlayoff/);
  return out;
  `);
  const o = r.result || {};
  if (!r.ok) {
    P0('B2-throws', '联赛推进链沙箱抛错', 'r1→card→playoff→champion', 'finishSeries/advanceCalendar', r.errs.join('\n'));
    return;
  }
  INFO('B2-path', '联赛推进路径', JSON.stringify({ steps: o.steps, league: o.league, r1Action: o.r1Action, endPhaseAction: o.endPhaseAction, afterAdv: o.afterAdv, afterAdvAction: o.afterAdvAction, advErr: o.advErr }));
  if (o.advErr) {
    P0('B2-advance-throw', 'advanceCalendar 抛错', '联赛打完 champion/eliminated 后', 'advanceCalendar', '结算后推进赛历抛异常', o.advErr);
  }
  if (!o.endPhaseAction) {
    P0('B2-no-end-action', 'champion/eliminated 后 nextAction 为空', '联赛收官', 'nextAction', '无「推进赛历」按钮，卡在结算页', JSON.stringify({ endPhaseAction: o.endPhaseAction, hasBtn: o.endHasAdvance }));
  }
  if (!o.endHasAdvance && !o.endHasChampText) {
    P0('B2-blank-end', '联赛收官面板无按钮也无结算说明', '联赛 champion/eliminated', 'clubResultPanel/clubLeaguePhasePanel', 'UI 完全无字无按钮', JSON.stringify(o.endHasAdvance));
  }
  if (o.afterAdv && !['challenger', 'ewc', 'asiad', 'annual', 'summer', 'r1', 'preseason', 'champion', 'eliminated'].includes(o.afterAdv.phase)) {
    // unknown phase might be stuck
    if (!o.afterAdvAction && !o.afterAdvHasBtn) {
      P0('B2-unknown-phase', 'advanceCalendar 后 phase 未知且无按钮', 'advanceCalendar', 'advanceCalendar/nextAction', 'phase=' + o.afterAdv.phase + ' 且 nextAction=null、面板无入口', JSON.stringify(o.afterAdv));
    }
  }
  if (o.afterAdv && o.afterAdv.phase && !o.afterAdvAction && !o.afterAdvHasBtn && !['champion', 'eliminated'].includes(o.afterAdv.phase)) {
    // champion again is ok only if there is advance button
    if (!(o.afterAdvHasBtn || o.endHasAdvance)) {
      P0('B2-after-adv-stuck', 'advanceCalendar 后无任何推进入口', 'advanceCalendar 后 renderClub', 'nextAction', 'phase=' + o.afterAdv.phase + ' nextAction=null 面板无按钮', JSON.stringify({ afterAdv: o.afterAdv, afterAdvAction: o.afterAdvAction, afterAdvHasBtn: o.afterAdvHasBtn }));
    }
  }
}

/* =========================================================
 * B3. 挑战者杯/EWC/亚运/年总：nextAction 每阶段有按钮；读档 _afterMatch 丢失
 * ========================================================= */
function b3() {
  const r = runSandbox(LIB + `
  const out={cups:{}};
  function toPhase(phase, setup){
    prepManager();
    if(setup)setup(S);
    S.phase=phase;
    // 确保基础结构
    if(phase==='challenger'&&!S.challenger){ try{ if(typeof setupChallenger==='function')setupChallenger(S); }catch(e){} }
    if(phase==='ewc'&&!S.ewc){ try{ if(typeof setupEwc==='function')setupEwc(S); }catch(e){} }
    if(phase==='asiad'&&!S.ag){ try{ if(typeof setupAsiad==='function')setupAsiad(S); }catch(e){} }
    if(phase==='annual'&&!S.annual){ try{ setupAnnual(S); }catch(e){ out.cups[phase+'_setupErr']=e.message; } }
    const act=na(S);
    const html=panelHtml();
    let engineOk=null, engineErr=null;
    try{
      if(phase==='challenger'||phase==='ewc'||phase==='annual') startCup(S);
      else if(phase==='asiad') asiadStep(S);
    }catch(e){ engineErr=e.message; }
    return {
      action: act,
      hasBtn: hasBtn(html,/uiStartCup|uiAsiadStep|uiDoNextAction|uiFinishAnnual|uiAdvanceCalendar/),
      engineErr,
      after: {phase:S.phase, series:!!S.series,
        ch:S.challenger&&{champ:S.challenger.champ},
        ewc:S.ewc&&{champ:S.ewc.champ},
        ag:S.ag&&{champ:S.ag.champ},
        annual:S.annual&&{stage:S.annual.stage,poChamp:S.annual.po&&S.annual.po.champ,finalR:S.annual.po&&S.annual.po.final&&S.annual.po.final.r}
      },
      yearRoll: typeof yearRollPending==='function'?yearRollPending(S):null,
    };
  }

  // 挑战者杯 — 结构可能在春季后 setup
  out.cups.challenger = toPhase('challenger');
  out.cups.ewc = toPhase('ewc');
  out.cups.asiad = toPhase('asiad');
  out.cups.annual = toPhase('annual');

  // 强制打到年总决赛结束 → yearRollPending
  prepManager();
  S.annualPts=S.annualPts||{};
  S.annualPts[S.teamName]=999;
  try{ setupAnnual(S); }catch(e){ out.annualSetupErr=e.message; }
  S.phase='annual';
  // 推到 po
  let g=0;
  while(S.annual&&S.annual.stage!=='po'&&g++<40){
    try{ startCup(S); }catch(e){ out.annualPushErr=e.message; break; }
  }
  // 强制决赛已打完
  if(S.annual&&S.annual.po){
    const p=S.annual.po;
    if(!p.final.a||!p.final.b){ p.final.a=S.teamName; p.final.b=AI_TEAMS[0].name; }
    p.final.r=S.teamName;
    // 若 champ 未写
  }
  out.yearRollBefore=typeof yearRollPending==='function'?yearRollPending(S):null;
  out.actionYearRoll=na(S);
  const htmlYR=panelHtml();
  out.hasYearRollBtn=hasBtn(htmlYR,/uiFinishAnnual/);
  // 连点 finishAnnual
  let e1=null,e2=null,e3=null;
  const phaseBefore=S.phase, seasonBefore=S.season;
  try{ uiFinishAnnual(S); }catch(e){ e1=e.message; }
  const after1={phase:S.phase,season:S.season,preseason:S.preseason,yearRoll:yearRollPending(S)};
  try{ uiFinishAnnual(S); }catch(e){ e2=e.message; }
  const after2={phase:S.phase,season:S.season,preseason:S.preseason,yearRoll:yearRollPending(S)};
  try{ finishAnnual(S,true); finishAnnual(S,true); finishAnnual(S,true); }catch(e){ e3=e.message; }
  const after3={phase:S.phase,season:S.season,preseason:S.preseason,yearRoll:yearRollPending(S)};
  out.yearRollClicks={phaseBefore,seasonBefore,after1,after2,after3,e1,e2,e3};

  // 读档丢 _afterMatch：模拟 playoff 决赛已打完但 champ 未结算
  prepManager();
  S.phase='playoff';
  S.playoff={wb:[],lb:[],final:{a:S.teamName,b:AI_TEAMS[0].name,r:S.teamName},champ:null};
  S._afterMatch=null;
  out.afterLoadAction=na(S);
  const htmlPo=panelHtml();
  out.afterLoadHasBtn=hasBtn(htmlPo,/startPlayoff|uiDoNextAction|uiAdvanceCalendar/);
  try{ startPlayoff(); out.afterLoadPlayoffErr=null; }catch(e){ out.afterLoadPlayoffErr=e.message; }
  out.afterLoadPlayoff={phase:S.phase,champ:S.playoff&&S.playoff.champ,action:na(S)};

  // 读档杯赛 mid 丢失：challenger 无 challenger 对象
  prepManager();
  S.phase='challenger';
  S.challenger=null;
  out.cupNullAction=na(S);
  try{ startCup(S); out.cupNullErr=null; }catch(e){ out.cupNullErr=e.message; }
  out.cupNullAfter={phase:S.phase, action:na(S)};
  const htmlCn=panelHtml();
  out.cupNullHasBtn=hasBtn(htmlCn,/uiStartCup|uiAdvanceCalendar|uiDoNextAction/);
  return out;
  `);
  const o = r.result || {};
  if (!r.ok) {
    P0('B3-throws', '杯赛/年总探针抛错', 'B3 沙箱', 'startCup/yearRollPending', r.errs.join('\n'));
    return;
  }
  const cups = o.cups || {};
  ['challenger', 'ewc', 'asiad', 'annual'].forEach(ph => {
    const c = cups[ph];
    if (!c) {
      P0('B3-' + ph + '-missing', ph + ' 阶段探针无结果', 'S.phase=' + ph, 'nextAction/startCup', '探针未返回', 'null');
      return;
    }
    INFO('B3-' + ph, ph + ' 入口', JSON.stringify(c));
    if (!c.action && !c.hasBtn) {
      P0('B3-' + ph + '-no-btn', ph + ' 阶段无任何推进按钮', 'S.phase=' + ph + ' renderClub + nextAction', 'nextAction/startCup', 'nextAction=null 且面板无 uiStartCup/uiAsiadStep，玩家卡死', JSON.stringify(c));
    }
    if (c.engineErr) {
      P0('B3-' + ph + '-engine-throw', ph + ' startCup/asiadStep 抛错', 'S.phase=' + ph + ' 调引擎', ph === 'asiad' ? 'asiadStep' : 'startCup', '引擎边界调用抛未捕获异常', c.engineErr);
    }
  });
  INFO('B3-yearRoll', 'yearRoll 连点安全', JSON.stringify(o.yearRollClicks));
  if (!o.hasYearRollBtn && o.yearRollBefore) {
    P0('B3-yearroll-no-btn', 'yearRollPending 时无「进入新赛季」按钮', '年总决赛打完 yearRollPending=true', 'nextAction/clubAnnualPanel', 'UI 无 uiFinishAnnual 入口，卡在年总', JSON.stringify({ yearRollBefore: o.yearRollBefore, actionYearRoll: o.actionYearRoll, hasBtn: o.hasYearRollBtn }));
  }
  const yc = o.yearRollClicks || {};
  if (yc.e1 || yc.e2 || yc.e3) {
    P0('B3-yearroll-throw', 'finishAnnual 连点抛异常', 'yearRollPending → uiFinishAnnual ×3', 'finishAnnual/uiFinishAnnual', '反复点击不安全', JSON.stringify(yc));
  }
  // 二次点击 season 不应继续+1（防二次老化）
  if (yc.after2 && yc.after3 && yc.after2.season != null && yc.after3.season != null && yc.after3.season > yc.after2.season + 0) {
    // after3 is after multiple finishAnnual — if season increased more than once from after1
    if (yc.after1 && yc.after3.season > yc.after1.season + 1) {
      P0('B3-yearroll-double-age', 'finishAnnual 反复点击导致赛季多次老化', 'uiFinishAnnual 连点', 'finishAnnual', '防重复结算失效，赛季被多次推进', JSON.stringify(yc));
    }
  }
  INFO('B3-afterLoad-po', '读档 playoff 决赛已打完', JSON.stringify({ action: o.afterLoadAction, hasBtn: o.afterLoadHasBtn, after: o.afterLoadPlayoff, err: o.afterLoadPlayoffErr }));
  if (!o.afterLoadAction && !o.afterLoadHasBtn) {
    P0('B3-afterload-po-stuck', '读档后季后赛决赛已打完但无恢复入口', 'playoff.final.r 有值 champ=null，_afterMatch=null', 'nextAction/startPlayoff/closeMatchContinue', 'nextAction 返回 null 且面板无按钮，_afterMatch 丢失后卡死', JSON.stringify({ action: o.afterLoadAction, hasBtn: o.afterLoadHasBtn, htmlHint: 'panel scan' }));
  }
  INFO('B3-cup-null', '读档 challenger 对象丢失', JSON.stringify({ action: o.cupNullAction, err: o.cupNullErr, after: o.cupNullAfter, hasBtn: o.cupNullHasBtn }));
  if (o.cupNullErr) {
    P0('B3-cup-null-throw', 'challenger 对象丢失后 startCup 抛错', 'phase=challenger 且 S.challenger=null', 'startCup/challengerStep', '读档缺杯赛结构时点击按钮直接抛异常', o.cupNullErr);
  }
  if (!o.cupNullAction && !o.cupNullHasBtn) {
    P0('B3-cup-null-stuck', '杯赛结构丢失后无恢复入口', 'phase=challenger 且 challenger=null', 'nextAction', '无按钮无说明，永久卡死', JSON.stringify(o.cupNullAfter));
  }
}

/* =========================================================
 * B5. board.fired 软终局
 * ========================================================= */
function b5() {
  const r = runSandbox(LIB + `
  const out={};
  prepManager();
  S.board=S.board||{trust:60,warn:0,fired:false,log:[],kpi:null};
  S.board.fired=true;
  S.board.firedSeason=S.season;
  out.action=na(S);
  out.uiGuardType=typeof uiGuard;
  out.boardLocked=typeof boardLocked==='function'?boardLocked():null;
  // UI 入口应被拦
  const toasts=[];
  const orig=toast; toast=m=>{toasts.push(m);};
  try{ uiStartMatch(); }catch(e){ out.uiStartMatchErr=e.message; }
  try{ uiNextDay(S); }catch(e){ out.uiNextDayErr=e.message; }
  try{ uiStartCup(S); }catch(e){ out.uiStartCupErr=e.message; }
  try{ uiEndPreseason(S); }catch(e){ out.uiEndPreseasonErr=e.message; }
  try{ uiAdvanceCalendar(S); }catch(e){ out.uiAdvErr=e.message; }
  toast=orig;
  out.toasts=toasts;
  // 引擎层不硬拦（设计如此）— 记录是否可调
  try{ startMatch(); out.engineStartMatch='ok series='+!!S.series; }catch(e){ out.engineStartMatch='throw '+e.message; }
  const html=panelHtml();
  out.htmlHasFired=/解约|已解约|重新开始|resetGame/.test(html);
  out.htmlHasReset=hasBtn(html,/resetGame/);
  out.htmlHasBoardPanel=/董事会/.test(html);
  out.nextActionNull = out.action===null;
  // 即使 action null，UI 必须有结算说明
  out.actionBlocked = out.action===null;
  return out;
  `);
  const o = r.result || {};
  if (!r.ok) {
    P0('B5-throws', 'board.fired 探针抛错', 'B5', 'uiGuard', r.errs.join('\n'));
    return;
  }
  INFO('B5', 'board.fired 软终局 UI', JSON.stringify(o));
  if (o.action !== null) {
    P1('B5-action-still', 'fired 后 nextAction 仍返回动作', 'board.fired=true', 'nextAction', 'UI 层 nextAction 未拦截', JSON.stringify(o.action));
  }
  if (!o.htmlHasFired || !o.htmlHasReset) {
    P0('B5-no-exit-ui', 'board.fired 后 UI 无结算/重开说明', 'board.fired=true renderClub', 'clubBoardPanel', '完全死局无字：既不能比赛也无「结束执教·重新开始」', JSON.stringify({ htmlHasFired: o.htmlHasFired, htmlHasReset: o.htmlHasReset, htmlHasBoardPanel: o.htmlHasBoardPanel }));
  }
  if (!(o.toasts || []).length && !o.htmlHasFired) {
    P0('B5-silent-block', 'fired 拦截时无 toast 也无面板说明', 'uiStartMatch 等', 'uiGuard', '点击无反馈', JSON.stringify(o.toasts));
  }
}

/* =========================================================
 * B6. 名单不足/伤停/集训 startMatch 拦截
 * ========================================================= */
function b6() {
  const r = runSandbox(LIB + `
  const out={cases:[]};
  function caseRoster(tag, mutate){
    prepManager();
    S.preseason=false;S.transferWindow=0;
    if(mutate)mutate(S);
    autoFillLineup(S);
    const noGo = (typeof lineupNoGo==='function')?lineupNoGo(S):null;
    const toasts=[];
    const orig=toast; toast=m=>{toasts.push(String(m));};
    let err=null, series=null;
    try{ startMatch(); series=!!S.series; }catch(e){ err=e.message; }
    // openBP 拦截路径
    let bpToasts=toasts.slice();
    try{
      if(typeof openBP==='function'){
        // startMatch 会 showPreMatch → 可能不经过 openBP 拦截
      }
    }catch(e){}
    toast=orig;
    // 阵容页/赛前面板文案
    let prepHtml='';
    try{
      if(typeof renderPreMatch==='function'&&S.series){ renderPreMatch(); prepHtml=(document.getElementById('app-modal-body')||{}).innerHTML||''; }
    }catch(e){ prepHtml='prepErr:'+e.message; }
    let lineupHtml='';
    try{ goPage('lineup'); lineupHtml=(document.getElementById('page-lineup')||{}).innerHTML||''; }catch(e){ lineupHtml='lineupErr:'+e.message; }
    const html=panelHtml();
    out.cases.push({
      tag, err, series, toasts: bpToasts, noGo,
      hasExplain: /无法出战|伤停|集训|空缺|无人|未满|替补|签约|青训|休息/.test(bpToasts.join(' ')+' '+prepHtml+' '+lineupHtml+' '+html),
      prepHasBlock: /无法出战|伤停|集训|空缺|无人/.test(prepHtml),
      lineupHasWhy: /伤停|集训|K甲|租借|未满|国家队/.test(lineupHtml),
      sampleToast: bpToasts.slice(0,3),
    });
  }
  // ① 伤停全部 farm
  caseRoster('injury-farm', S=>{
    S.players.filter(p=>p.pos==='farm').forEach(p=>{p.injury=5;});
  });
  // ② 集训全部
  caseRoster('natcamp-all', S=>{
    S.players.forEach(p=>{p.natCamp=true;});
  });
  // ③ 名单只剩 2 人
  caseRoster('roster-2', S=>{
    S.players=S.players.slice(0,2);
    S.lineup=S.players.map(p=>p.id);
  });
  // ④ 清空 lineup 但 players 在
  caseRoster('lineup-empty', S=>{
    S.lineup=[];
  });
  // ⑤ 空 roster
  caseRoster('roster-0', S=>{
    S.players=[]; S.lineup=[];
  });
  // openBP 直接调用
  prepManager();
  S.players.filter(p=>p.pos==='farm').forEach(p=>{p.injury=9;});
  autoFillLineup(S);
  const toasts2=[];
  const orig2=toast; toast=m=>{toasts2.push(String(m));};
  try{ openBP('测试拦截',()=>{}); out.openBPErr=null; }catch(e){ out.openBPErr=e.message; }
  toast=orig2;
  out.openBPToasts=toasts2;
  out.openBPNoGo = typeof lineupNoGo==='function'?lineupNoGo(S):null;
  return out;
  `);
  const o = r.result || {};
  if (!r.ok) {
    P0('B6-throws', 'startMatch 拦截探针抛错', 'B6', 'startMatch/openBP', r.errs.join('\n'));
    return;
  }
  INFO('B6', 'startMatch 拦截说明', JSON.stringify(o));
  (o.cases || []).forEach(c => {
    if (c.series && c.tag === 'roster-0') {
      P0('B6-empty-started', '空名单仍能 startMatch 建 series', 'S.players=[] startMatch', 'startMatch', '无阵容直接开赛，后续 BP/结算必炸', JSON.stringify(c));
    }
    if (!c.series && !c.err && !(c.toasts || []).length && !c.hasExplain) {
      P0('B6-silent-block-' + c.tag, '阵容问题拦截时无任何可读说明', c.tag + ' startMatch', 'startMatch/openBP/autoFillLineup', '既没开赛也没 toast/面板文案，玩家不知如何解除', JSON.stringify(c));
    }
    if (!c.hasExplain && (c.toasts || []).length === 0 && c.series) {
      // started but no explain — ok if series built
    }
  });
  if (o.openBPErr) {
    P1('B6-openBP-throw', 'openBP 对伤停阵容抛错', 'farm 全伤停 openBP', 'openBP', '拦截路径本身抛异常', o.openBPErr);
  }
  if (!(o.openBPToasts || []).length && !o.openBPNoGo) {
    // might be fine if noGo empty because autoFill left injured in lineup
    INFO('B6-openBP', 'openBP 无拦截', JSON.stringify({ noGo: o.openBPNoGo, toasts: o.openBPToasts }));
  }
}

/* =========================================================
 * B7. 序列化/读档：缺字段旧档 migrate
 * ========================================================= */
function b7() {
  const r = runSandbox(LIB + `
  const out={cases:[]};
  function tryLoad(tag, raw){
    const rec={tag};
    try{
      localStorage.setItem('esport_manager_save', raw);
      // also try slot keys
      try{ localStorage.setItem('esport_manager_save_2', raw); }catch(e){}
      rec.saveFn = typeof save;
      rec.loadFn = typeof load;
      let err=null;
      try{
        if(typeof load==='function'){ load(); }
        else if(typeof loadGame==='function'){ loadGame(); }
        else { rec.noLoadFn=true; }
      }catch(e){ err=e.message; }
      rec.loadErr=err;
      rec.S = S?{
        teamName:S.teamName, phase:S.phase, players:(S.players||[]).length,
        preseason:S.preseason, v:S.v, _migErr:S._migErr,
        eventLog:Array.isArray(S.eventLog), fund:S.fund, schedule:(S.schedule||[]).length,
        board:!!S.board, series:!!S.series,
      }:null;
      // 渲染是否炸
      let renderErr=null;
      try{ renderAll(); }catch(e){ renderErr=e.message; }
      rec.renderErr=renderErr;
      let clubErr=null;
      try{ const h=panelHtml(); clubErr = h.startsWith('RENDER_ERR:')?h:null; rec.clubHasContent=(h||'').length>50; }catch(e){ clubErr=e.message; }
      rec.clubErr=clubErr;
      rec.action=S?na(S):null;
    }catch(e){ rec.outerErr=e.message; }
    out.cases.push(rec);
    return rec;
  }

  // ① 极简残缺档
  tryLoad('minimal', JSON.stringify({v:3, teamName:'残缺', players:[], phase:'r1', mode:'manager'}));

  // ② 缺 players/phase 的半档
  tryLoad('no-players', JSON.stringify({v:3, teamName:'无选手', mode:'manager', season:1, day:1, fund:100, teamPower:10}));

  // ③ 旧版本号（触发迁移链）
  const old = {v:2, teamName:'旧档', mode:'manager', season:3, day:40, fund:9999, wageCap:150,
    players:[{id:'p1',name:'旧将',pos:'farm',base:[70,70,70,70],attrs:{lane:70,farm:70,team:70,mind:70},energy:80,morale:70,age:20,wage:5,val:20,heroPool:[],skill:null}],
    lineup:['p1'], phase:'r2', matchIdx:0, schedule:[{opp:'AG',round:1}], tables:{}, transferWindow:0, preseason:false,
  };
  tryLoad('v2-old', JSON.stringify(old));

  // ④ 月份刻度未迁移（fund 极大，moneyScaled/econReal 缺失）
  tryLoad('money-old', JSON.stringify({v:3, teamName:'刻度档', mode:'manager', season:1, day:1,
    fund:99999999, wageCap:1500, players:[{id:'p1',name:'甲',pos:'farm',base:[70,70,70,70],energy:80,morale:70,age:20,wage:5000,val:20000}],
    lineup:['p1'], phase:'r1', schedule:[], tables:{}, moneyScaled:false, econReal:false, transferWindow:0, preseason:true, transferList:[],
  }));

  // ⑤ series 残留但无 mid / 无 side
  tryLoad('series-stale', JSON.stringify({v:3, teamName:'残影', mode:'manager', season:1, day:10, fund:100,
    players:[{id:'p1',name:'甲',pos:'farm',base:[70,70,70,70],energy:80,morale:70,age:20,wage:5,val:20}],
    lineup:['p1'], phase:'r1', matchIdx:0, schedule:[{opp:'AG',round:1,mid:null}], tables:{},
    series:{used:[],usedOpp:[],mw:2,ow:1,max:5,stage:'regular',logs:[],myName:'残影',opName:'狼队'},
    transferWindow:0, preseason:false,
  }));

  // ⑥ 年总已打完未轮换（yearRollPending 恢复）
  tryLoad('yearroll-left', JSON.stringify({v:3, teamName:'年总档', mode:'manager', season:4, day:200, fund:100,
    players:[{id:'p1',name:'甲',pos:'farm',base:[80,80,80,80],energy:80,morale:70,age:20,wage:5,val:20}],
    lineup:['p1'], phase:'annual', split:'summer',
    annual:{stage:'po', arena:{}, brk:[], po:{wb1:[],wb2:[],lb1:[],lb2:[],wf:{},lbs:{},lbf:{},final:{a:'年总档',b:'AG',r:'年总档'},champ:null}},
    annualPts:{}, transferWindow:0, preseason:false, schedule:[], tables:{},
  }));

  // ⑦ 完全空对象
  tryLoad('empty-obj', '{}');

  // ⑧ 非 JSON
  tryLoad('bad-json', 'not-json{');

  // ⑨ 非法 phase / 缺 eventLog / 缺 board
  tryLoad('weird-phase', JSON.stringify({v:3, teamName:'怪相位', mode:'manager', season:1, day:1, fund:50,
    players:[{id:'p1',name:'甲',pos:'farm',base:[70,70,70,70],energy:80,morale:70,age:20,wage:5,val:20}],
    lineup:['p1'], phase:'???', schedule:[], tables:{}, transferWindow:0, preseason:false,
  }));

  return out;
  `);
  const o = r.result || {};
  if (!r.ok) {
    P0('B7-throws', '读档探针抛错', 'B7', 'load/migrateSave', r.errs.join('\n'));
    return;
  }
  INFO('B7', '缺字段旧档 migrate', JSON.stringify(o.cases));
  (o.cases || []).forEach(c => {
    if (c.loadErr && /is not a function|Cannot read|undefined|null/.test(c.loadErr)) {
      P0('B7-load-throw-' + c.tag, '残缺档 load/migrate 炸 UI', 'localStorage 写入 ' + c.tag + ' 后 load()', 'load/migrateSave/applySaveDefaults', '读档抛错，玩家打开即崩', c.loadErr + ' | S=' + JSON.stringify(c.S));
    }
    if (c.renderErr) {
      P0('B7-render-throw-' + c.tag, '残缺档 renderAll 抛错', c.tag + ' load 后 renderAll', 'renderAll/renderClub', '读档成功但 UI 渲染炸', c.renderErr + ' | S=' + JSON.stringify(c.S));
    }
    if (c.clubErr && /RENDER_ERR|Cannot read/.test(c.clubErr)) {
      P0('B7-club-throw-' + c.tag, '残缺档俱乐部页渲染炸', c.tag + ' renderClub', 'clubLeaguePhasePanel/renderClub', '进俱乐部页白屏/报错', c.clubErr);
    }
  });
}

/* =========================================================
 * B4b. yearRoll 按钮反复点击 + nextAction 兜底（合并进 B3）
 * 额外：边界调用 nextAction/startCup/startMatch/finishSeries/advanceCalendar
 * ========================================================= */
function bBoundary() {
  const r = runSandbox(LIB + `
  const out={calls:[]};
  function tryCall(tag, fn){
    const rec={tag};
    try{ rec.result = fn(); rec.err=null; }
    catch(e){ rec.err=e.message; rec.stack=String(e.stack||'').split('\\n').slice(0,3).join(' | '); }
    out.calls.push(rec);
  }
  // 空 S
  tryCall('nextAction(null)', ()=>nextAction(null));
  tryCall('nextAction({})', ()=>nextAction({}));
  S=null;
  tryCall('startCup(null)', ()=>startCup(null));
  tryCall('startMatch-S-null', ()=>{ try{ startMatch(); return 'ok'; }catch(e){ throw e; } });
  tryCall('finishSeries-S-null', ()=>finishSeries(true));
  tryCall('advanceCalendar(null)', ()=>advanceCalendar(null));
  tryCall('finishSeries-no-series', ()=>{ prepManager(); finishSeries(true); return {series:!!S.series}; });
  tryCall('finishSeries-double', ()=>{ prepManager(); S.preseason=false; initGroups(S);
    const m=S.schedule[S.matchIdx];
    if(m){ S.series={used:[],usedOpp:[],mw:3,ow:0,max:5,stage:'regular',mid:m.mid,logs:[],myName:S.teamName,opName:m.opp,side:'blue'}; }
    finishSeries(true); finishSeries(true); finishSeries(true); return {phase:S.phase,matchIdx:S.matchIdx,series:!!S.series};
  });
  tryCall('startCup-annual-empty', ()=>{ prepManager(); S.phase='annual'; S.annual=null; startCup(S); return {phase:S.phase}; });
  tryCall('startCup-ewc-empty', ()=>{ prepManager(); S.phase='ewc'; S.ewc=null; startCup(S); return {phase:S.phase}; });
  tryCall('startCup-challenger-empty', ()=>{ prepManager(); S.phase='challenger'; S.challenger=null; startCup(S); return {phase:S.phase}; });
  tryCall('asiadStep-empty', ()=>{ prepManager(); S.phase='asiad'; S.ag=null; asiadStep(S); return {phase:S.phase}; });
  tryCall('advanceCalendar-champion', ()=>{ prepManager(); S.phase='champion'; advanceCalendar(S); return {phase:S.phase,split:S.split}; });
  tryCall('advanceCalendar-eliminated', ()=>{ prepManager(); S.phase='eliminated'; advanceCalendar(S); return {phase:S.phase,split:S.split}; });
  tryCall('advanceCalendar-annual-done', ()=>{ prepManager(); S.phase='annual'; S.annual={stage:'po',po:{final:{a:S.teamName,b:'AG',r:S.teamName},champ:S.teamName}}; advanceCalendar(S); return {phase:S.phase,season:S.season}; });
  tryCall('startCard-empty', ()=>{ prepManager(); S.phase='card'; S.card=null; startCard(); return {phase:S.phase,series:!!S.series}; });
  tryCall('startPlayoff-empty', ()=>{ prepManager(); S.phase='playoff'; S.playoff=null; startPlayoff(); return {phase:S.phase,series:!!S.series}; });
  tryCall('startMatch-preseason', ()=>{ prepManager(); S.preseason=true; startMatch(); return {series:!!S.series}; });
  tryCall('uiDoNextAction-null-action', ()=>{ prepManager(); S.phase='r1'; S.schedule=[]; S.matchIdx=0; uiDoNextAction(S); return {phase:S.phase}; });
  tryCall('closeMatchContinue-no-after', ()=>{ prepManager(); S._afterMatch=null; closeMatchContinue(); return {phase:S.phase, day:S.day}; });
  return out;
  `);
  const o = r.result || {};
  if (!r.ok) {
    P0('B-bound-throws', '边界调用探针整体抛错', 'boundary', 'multiple', r.errs.join('\n'));
    return;
  }
  INFO('B-boundary', '边界调用结果', JSON.stringify(o.calls));
  (o.calls || []).forEach(c => {
    if (c.err) {
      P0('B-bound-' + c.tag, '边界调用抛未捕获异常', c.tag, c.tag.split('-')[0], '边界/空状态调用直接 throw', c.err + ' ' + (c.stack || ''));
    }
  });
}

/* ========== run all ========== */
console.log('=== flow freeze sandbox probe ===');
b1();
b2();
b3();
b5();
b6();
b7();
bBoundary();

const p0 = findings.filter(f => f.severity === 'P0');
const p1 = findings.filter(f => f.severity === 'P1');
const info = findings.filter(f => f.severity === 'INFO');

const summary = {
  p0Count: p0.length,
  p1Count: p1.length,
  infoCount: info.length,
  p0: p0.map(f => ({ id: f.id, title: f.title })),
  p1: p1.map(f => ({ id: f.id, title: f.title })),
};

const outPath = path.join(__dirname, 'flow-freeze-result.json');
fs.writeFileSync(outPath, JSON.stringify({ summary, findings }, null, 2), 'utf8');

console.log('P0:', p0.length);
p0.forEach(f => console.log('  [P0]', f.id, '-', f.title));
console.log('P1:', p1.length);
p1.forEach(f => console.log('  [P1]', f.id, '-', f.title));
console.log('INFO:', info.length, '(详见', outPath + ')');
console.log('Result:', outPath);

if (p0.length) process.exitCode = 3;
