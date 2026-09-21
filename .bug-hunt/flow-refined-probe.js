// B-refined: 确认真实卡死路径（参数错误 / 完整赛季 / 读档 / startMatch 拦截）
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { makeDom, injectHelpers } = require(path.join(__dirname, '..', 'tests', 'harness.js'));

const findings = [];
function add(sev, id, title, steps, fn, how, evidence) {
  findings.push({ severity: sev, id, title, steps, fn, how, evidence: String(evidence).slice(0, 1200) });
}

function run(script) {
  const { dom } = makeDom();
  injectHelpers(dom);
  const toasts = [];
  try {
    const orig = dom.toast;
    dom.toast = (m) => { toasts.push(String(m)); try { if (typeof orig === 'function') orig(m); } catch (_) {} };
    const result = vm.runInContext('(function(){\n' + script + '\n})()', dom);
    return { result, toasts, ok: true };
  } catch (e) {
    return { result: null, toasts, ok: false, err: String(e && e.stack || e) };
  }
}

const LIB = `
function closeSeriesWin(win){
  if(!S.series)return false;
  S.series.mw=win?Math.ceil(S.series.max/2):1;
  S.series.ow=win?1:Math.ceil(S.series.max/2);
  finishSeries(!!win);
  return true;
}
function runLeagueQuick(){
  let g=0;
  while(!['champion','eliminated'].includes(S.phase)&&g++<220){
    if(S.preseason){S.preseason=false;S.transferWindow=0;continue;}
    if(S.phase==='r1'||S.phase==='r2'||S.phase==='r3'){
      if(S.matchIdx>=(S.schedule||[]).length){advancePhase(S);continue;}
      if(S.series&&S.series.stage==='regular'){closeSeriesWin(true);continue;}
      const m=S.schedule[S.matchIdx];
      if(!m){advancePhase(S);continue;}
      S.series={used:[],usedOpp:[],mw:0,ow:0,max:5,stage:'regular',mid:m.mid,logs:[],myName:S.teamName,opName:m.opp,side:'blue'};
      S.series.mw=3;S.series.ow=1;finishSeries(true);
    }else if(S.phase==='card'){
      if(S.series){closeSeriesWin(true);continue;}
      const myCard=S.card&&S.card.matches.find(x=>!x.r&&(x.a===S.teamName||x.b===S.teamName));
      if(!myCard){startCard();continue;}
      S.series={used:[],usedOpp:[],mw:0,ow:0,max:7,stage:'card',mid:'card_'+(S.card.idx||0),cardIdx:S.card.idx||0,logs:[],myName:S.teamName,opName:myCard.a===S.teamName?myCard.b:myCard.a,side:'blue'};
      S.series.mw=4;S.series.ow=1;finishSeries(true);
    }else if(S.phase==='playoff'){
      if(S.series){closeSeriesWin(true);continue;}
      startPlayoff();
      if(!S.series)break;
    }else break;
  }
  return {phase:S.phase,g,champ:S.playoff&&S.playoff.champ,split:S.split};
}
function prep(){
  S=newState('确认探针','⚔');
  fillRoster(S,'star');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  S.seedPower=teamPower(S);
  startSplit(S,'spring');
  S.preseason=false;S.transferWindow=0;
  return S;
}
function clubHtml(){
  try{ renderClub(); }catch(e){ return 'RENDER_ERR:'+e.message; }
  return (document.getElementById('page-club')||{}).innerHTML||'';
}
function na(){ const a=nextAction(S); return a?{type:a.type,label:a.label,fn:a.fn}:null; }
function simulateClick(html, re){
  // 从 HTML 提取 onclick 并 eval（模拟按钮）
  const m=(html||'').match(re);
  if(!m) return {hit:false};
  const code=m[1]||m[0];
  const toastsBefore=[];
  try{
    // extract handler body
    const om=code.match(/onclick="([^"]+)"/) || code.match(/onclick='([^']+)'/);
    const body=om?om[1]:code;
    const r=eval(body);
    return {hit:true, body, result:r};
  }catch(e){ return {hit:true, err:e.message}; }
}
`;

/* ========== R1: 卡位赛/季后赛按钮参数错误 ========== */
{
  const r = run(LIB + `
  const out={};
  prep();
  // 推进到 card：打完 r1/r2
  S.phase='r1';
  // 快速：直接 setupCard 造卡位
  initGroups(S);
  // 保证我队在 S 组前二以外会进卡位——直接伪造
  S.groups={S:[AI_TEAMS[0].name,AI_TEAMS[1].name,S.teamName,AI_TEAMS[2].name,AI_TEAMS[3].name,AI_TEAMS[4].name],
            A:AI_TEAMS.slice(5,11).map(t=>t.name),
            B:AI_TEAMS.slice(11,17).map(t=>t.name)};
  S.phase='r2';
  // tables 需要存在
  if(typeof initTables==='function')initTables(S);
  setupCard(S);
  out.phase=S.phase;
  out.card=!!S.card;
  out.myCard=S.card&&S.card.matches.find(m=>m.a===S.teamName||m.b===S.teamName);
  out.nextAction=na();
  const html=clubHtml();
  out.htmlHasBrokenBtn=/uiDoNextAction\\('startCard'\\)/.test(html);
  out.htmlHasGoodBtn=/uiDoNextAction\\(S\\)|onclick="startCard\\("/.test(html);
  out.htmlHasFallback=/赛段入口由 nextAction/.test(html);
  // 模拟点击坏按钮
  const before={series:!!S.series,phase:S.phase};
  let click=null;
  try{
    uiDoNextAction('startCard'); // 正是按钮写的调用
    click='returned';
  }catch(e){ click='throw:'+e.message; }
  out.click={before, click, afterSeries:!!S.series, phase:S.phase};
  out.nextActionAfter=na();
  // 正确调用对照
  let good=null;
  try{ uiDoNextAction(S); good={series:!!S.series, stage:S.series&&S.series.stage}; }
  catch(e){ good={err:e.message}; }
  out.goodCall=good;

  // playoff 面板
  prep();
  // 造完整 playoff
  if(typeof buildPlayoff==='function'){
    // 需要 card 结束
    S.phase='r3';
    try{ buildPlayoff(S); }catch(e){ out.poBuildErr=e.message; }
  }
  out.poPhase=S.phase;
  out.po=!!S.playoff;
  out.poAction=na();
  const html2=clubHtml();
  out.poBroken=/uiDoNextAction\\('startPlayoff'\\)/.test(html2);
  out.poFallback=/赛段入口由 nextAction/.test(html2);
  try{ uiDoNextAction('startPlayoff'); out.poClick={series:!!S.series}; }
  catch(e){ out.poClick={err:e.message, series:!!S.series}; }
  return out;
  `);
  const o = r.result || {};
  const ev = JSON.stringify({ o, toasts: r.toasts }, null, 1);
  if (!r.ok) {
    add('P0', 'R1-throws', '卡位赛按钮探针抛错', 'R1', 'uiDoNextAction', r.err);
  } else if (o.htmlHasBrokenBtn && !(o.click && o.click.afterSeries) && !(r.toasts || []).includes('当前没有可进行的比赛') === false) {
    // toast happened and series not created via broken call
    add('P0', 'R1-card-btn-dead', '卡位赛按钮 uiDoNextAction(\'startCard\') 参数错误导致点击无效',
      '联赛 r2 结束进入 card → 俱乐部页点「进行卡位赛」',
      'uiDoNextAction / clubCardPanel (ui.js:463)',
      "按钮写成 uiDoNextAction('startCard')，把字符串当 state 传入；nextAction('startCard') 因无 .players 返回 null → toast「当前没有可进行的比赛」，series 不会建立。兜底按钮条件 html.indexOf(act.fn)<0 && html.indexOf('uiDoNextAction')<0 因 HTML 已含这两个子串而不触发，玩家在卡位赛永久卡死。",
      ev);
  } else if (o.htmlHasBrokenBtn && o.click && o.click.afterSeries === false) {
    add('P0', 'R1-card-btn-dead', '卡位赛按钮参数错误',
      'card 阶段点按钮',
      'uiDoNextAction',
      '点击后未建 series',
      ev);
  } else if (o.htmlHasBrokenBtn) {
    // check if toast pattern
    if ((r.toasts || []).some(t => /没有可进行的比赛/.test(t))) {
      add('P0', 'R1-card-btn-dead', '卡位赛按钮 uiDoNextAction(\'startCard\') 参数错误导致点击无效',
        '联赛进入 card → 点「进行卡位赛」',
        'uiDoNextAction / clubCardPanel (ui.js:463)',
        '字符串当 state 传入 → nextAction 返回 null → toast 无比赛；兜底按钮被子串判断抑制，卡位赛卡死。',
        ev);
    } else {
      add('P1', 'R1-card-btn-suspect', '卡位赛按钮参数可疑', 'card 阶段', 'uiDoNextAction', 'HTML 含坏按钮', ev);
    }
  }
  if (o.poBroken && o.poClick && !o.poClick.series) {
    add('P0', 'R1-po-btn-dead', '季后赛按钮 uiDoNextAction(\'startPlayoff\') 参数错误导致点击无效',
      '季后赛面板点「进行下一场 / 快进 / 结算」',
      'uiDoNextAction / clubPlayoffPanel (ui.js:475-476)',
      "同 card：字符串当 state；结算路径（final.r 有值）也会因 nextAction(string)=null 而无法推进赛历，冠军页兜底若被抑制则赛历卡死。",
      ev);
  }
  // 静态确认
  const uiSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'ui.js'), 'utf8');
  if (/uiDoNextAction\('startCard'\)/.test(uiSrc) && /uiDoNextAction\('startPlayoff'\)/.test(uiSrc)) {
    // already recorded above
  }
}

/* ========== R2: 完整春季→挑杯→EWC→夏季 正常路径 ========== */
{
  const r = run(LIB + `
  const out={trace:[]};
  const log=t=>out.trace.push(t+' | phase='+S.phase+' split='+S.split+' action='+JSON.stringify(na()));
  prep();
  log('start');
  out.league=runLeagueQuick();
  log('league-end');
  const htmlEnd=clubHtml();
  out.endHasAdvance=/uiAdvanceCalendar/.test(htmlEnd);
  out.endAction=na();
  try{ advanceCalendar(S); out.adv1Err=null; }catch(e){ out.adv1Err=e.message; }
  log('after-adv1');
  out.chPhase=S.phase;
  out.ch=!!S.challenger;
  out.chAction=na();
  const htmlCh=clubHtml();
  out.chHasBtn=/uiStartCup/.test(htmlCh);
  // 打完挑战者杯（快进）
  let g=0;
  while(S.phase==='challenger'&&!(S.challenger&&S.challenger.champ)&&g++<80){
    if(S.series){closeSeriesWin(true);continue;}
    try{ startCup(S); }catch(e){ out.chStepErr=e.message; break; }
    if(S.phase!=='challenger')break;
  }
  log('after-ch');
  out.ewcPhase=S.phase;
  out.ewc=!!S.ewc;
  out.ewcAction=na();
  const htmlEwc=clubHtml();
  out.ewcHasBtn=/uiStartCup/.test(htmlEwc);
  out.ewcPanelEmpty=(htmlEwc.indexOf('EWC')<0 && htmlEwc.indexOf('ewc')<0);
  // 打完 EWC
  g=0;
  while(S.phase==='ewc'&&!(S.ewc&&S.ewc.champ)&&g++<40){
    if(S.series){closeSeriesWin(true);continue;}
    try{ startCup(S); }catch(e){ out.ewcStepErr=e.message; break; }
  }
  log('after-ewc');
  out.afterEwc={phase:S.phase,split:S.split,preseason:S.preseason,action:na()};
  out.afterEwcHasBtn=/uiStartCup|uiEndPreseason|uiStartMatch|uiDoNextAction|uiAdvanceCalendar/.test(clubHtml());
  return out;
  `);
  const o = r.result || {};
  if (!r.ok) {
    add('P0', 'R2-throws', '完整春季链路抛错', 'spring→challenger→ewc', 'multiple', r.err);
  } else {
    // check each stage for freeze
    if (o.chPhase === 'challenger' && !o.chAction && !o.chHasBtn) {
      add('P0', 'R2-ch-stuck', '挑战者杯阶段无按钮', '春季赛结束后 advanceCalendar', 'nextAction/clubChallengerPanel', 'phase=challenger 无入口', JSON.stringify(o));
    }
    if (o.ewcPhase === 'ewc' && !o.ewcAction && !o.ewcHasBtn) {
      add('P0', 'R2-ewc-stuck', 'EWC 阶段无按钮', '挑战者杯打完后', 'nextAction/clubEwcPanel', 'phase=ewc 且 S.ewc 存在仍无按钮，或结构丢失', JSON.stringify({ ewc: o.ewc, action: o.ewcAction, hasBtn: o.ewcHasBtn, panelEmpty: o.ewcPanelEmpty }));
    }
    if (o.chStepErr || o.ewcStepErr) {
      add('P0', 'R2-cup-throw', '杯赛推进抛错', 'startCup 快进', 'startCup/challengerStep/ewcStep', o.chStepErr || o.ewcStepErr, JSON.stringify(o));
    }
    if (o.afterEwc && o.afterEwc.phase === 'ewc' && !(o.afterEwc.action) && !o.afterEwcHasBtn) {
      add('P0', 'R2-ewc-end-stuck', 'EWC 打完后卡在 ewc', 'finishEWC', 'finishEWC/startSplit', JSON.stringify(o.afterEwc));
    }
    // INFO
    add('INFO', 'R2-path', '完整春季链路', 'spring league→challenger→ewc', '', JSON.stringify({
      league: o.league, endAction: o.endAction, ch: { phase: o.chPhase, has: o.ch, action: o.chAction, btn: o.chHasBtn },
      ewc: { phase: o.ewcPhase, has: o.ewc, action: o.ewcAction, btn: o.ewcHasBtn },
      afterEwc: o.afterEwc, afterEwcBtn: o.afterEwcHasBtn,
      chErr: o.chStepErr, ewcErr: o.ewcStepErr, adv1Err: o.adv1Err,
    }, null, 0));
  }
}

/* ========== R3: 读档正确 SAVE_KEY + 缺字段 + _afterMatch ========== */
{
  const r = run(LIB + `
  const out={cases:[]};
  const KEY='esport_manager_save_v3';
  function tryLoad(tag, obj){
    const rec={tag};
    try{
      const raw=typeof obj==='string'?obj:JSON.stringify(obj);
      localStorage.setItem(KEY, raw);
      let err=null;
      try{ rec.loaded=load(); }catch(e){ err=e.message; rec.loaded=false; }
      rec.loadErr=err;
      rec.S=S?{team:S.teamName,phase:S.phase,n:(S.players||[]).length,v:S.v,_migErr:S._migErr||null,preseason:S.preseason,fund:S.fund,ewc:S.ewc?1:0,ch:S.challenger?1:0,annual:S.annual?1:0,board:S.board?1:0,eventLog:Array.isArray(S.eventLog),sched:(S.schedule||[]).length}:null;
      let renderErr=null, clubErr=null, naVal=null, htmlLen=0, hasBtn=false;
      try{ renderAll(); }catch(e){ renderErr=e.message; }
      try{
        const h=clubHtml();
        htmlLen=(h||'').length;
        clubErr=h&&h.indexOf('RENDER_ERR:')===0?h:null;
        hasBtn=/uiStartCup|uiStartMatch|uiEndPreseason|uiAdvanceCalendar|uiDoNextAction|uiFinishAnnual|resetGame|uiNextDay/.test(h||'');
        naVal=na();
      }catch(e){ clubErr=e.message; }
      rec.renderErr=renderErr; rec.clubErr=clubErr; rec.action=naVal; rec.htmlLen=htmlLen; rec.hasBtn=hasBtn;
      // 引擎是否可调
      rec.startCupErr=null;
      if(S&&S.phase==='challenger'){ try{ startCup(S); }catch(e){ rec.startCupErr=e.message; } }
      if(S&&S.phase==='ewc'){ try{ startCup(S); }catch(e){ rec.startCupErr=e.message; } }
      if(S&&S.phase==='annual'){ try{ startCup(S); }catch(e){ rec.startCupErr=e.message; } }
    }catch(e){ rec.outer=e.message; }
    out.cases.push(rec);
    return rec;
  }

  // ① 正常新档 save→load 往返
  prep();
  save();
  tryLoad('roundtrip', null); // 读刚才 save 的
  // ② 残缺最小档
  tryLoad('minimal', {v:3,teamName:'残缺',players:[],phase:'r1',mode:'manager',fund:100,moneyScaled:true,econReal:true});
  // ③ phase=ewc 但 ewc=null（结构丢失）
  prep(); runLeagueQuick(); advanceCalendar(S);
  // 若在 challenger，打到 ewc
  let g=0;
  while(S.phase==='challenger'&&g++<50){ if(S.series){closeSeriesWin(true);continue;} try{startCup(S);}catch(e){break;} }
  const snapEwc=JSON.parse(JSON.stringify(S));
  snapEwc.ewc=null; snapEwc._afterMatch=null;
  tryLoad('ewc-null', snapEwc);
  // ④ phase=challenger 但 challenger=null
  const snapCh=JSON.parse(JSON.stringify(S.phase==='challenger'?S:(function(){prep();return S;})()));
  // rebuild challenger snap from a fresh spring end
  prep(); runLeagueQuick(); advanceCalendar(S);
  const snapCh2=JSON.parse(JSON.stringify(S));
  snapCh2.challenger=null; snapCh2._afterMatch=null;
  tryLoad('ch-null', snapCh2);
  // ⑤ playoff 决赛已打完 champ=null（_afterMatch 丢失）— 完整结构
  prep();
  S.phase='playoff';
  S.playoff={
    wb:[{a:S.teamName,b:AI_TEAMS[0].name,r:S.teamName},{a:AI_TEAMS[1].name,b:AI_TEAMS[2].name,r:AI_TEAMS[1].name}],
    lb:[{a:AI_TEAMS[0].name,b:AI_TEAMS[2].name,r:AI_TEAMS[0].name},{a:null,b:null,r:null}],
    lb2:[{a:null,b:null,r:null},{a:null,b:null,r:null}],
    lb3:[{a:null,b:null,r:null},{a:null,b:null,r:null}],
    lb4:{a:null,b:null,r:null},
    wf:{a:S.teamName,b:AI_TEAMS[1].name,r:S.teamName},
    lbf:{a:AI_TEAMS[1].name,b:null,r:null},
    final:{a:S.teamName,b:null,r:null},
    champ:null
  };
  // 真正「决赛已打完」状态
  S.playoff.final={a:S.teamName,b:AI_TEAMS[0].name,r:S.teamName};
  S.playoff.lbf={a:AI_TEAMS[1].name,b:AI_TEAMS[0].name,r:AI_TEAMS[0].name};
  S._afterMatch=null;
  const snapPo=JSON.parse(JSON.stringify(S));
  tryLoad('po-final-done', snapPo);
  // ⑥ 年总打完未轮换
  prep();
  S.annualPts={[S.teamName]:999};
  AI_TEAMS.forEach((t,i)=>{S.annualPts[t.name]=100-i;});
  try{ setupAnnual(S); }catch(e){ out.annualSetupErr=e.message; }
  S.phase='annual';
  if(S.annual){
    S.annual.stage='po';
    S.annual.po={wb1:[],wb2:[],lb1:[],lb2:[],wf:{},lbs:{},lbf:{},final:{a:S.teamName,b:AI_TEAMS[0].name,r:S.teamName},champ:null};
  }
  const snapYr=JSON.parse(JSON.stringify(S));
  snapYr._afterMatch=null;
  tryLoad('yearroll-left', snapYr);
  // ⑦ 坏 JSON
  tryLoad('bad-json', 'not-json');
  // ⑧ 旧 v2
  tryLoad('v2', {v:2,teamName:'旧档',mode:'manager',season:3,day:40,fund:9999,wageCap:150,
    players:[{id:'p1',name:'旧将',pos:'farm',base:[70,70,70,70],attrs:{lane:70,farm:70,team:70,mind:70},energy:80,morale:70,age:20,wage:5,val:20,heroPool:[],skill:null}],
    lineup:['p1'],phase:'r2',matchIdx:0,schedule:[{opp:'AG',round:1}],tables:{},transferWindow:0,preseason:false});
  return out;
  `);
  const o = r.result || {};
  if (!r.ok) {
    add('P0', 'R3-throws', '读档探针抛错', 'R3', 'load/migrateSave', r.err);
  } else {
    (o.cases || []).forEach(c => {
      const stuck = c.S && !c.renderErr && !c.clubErr && !c.hasBtn && !c.action;
      const crash = c.loadErr || c.renderErr || (c.clubErr && /RENDER_ERR|Cannot/.test(c.clubErr));
      if (crash) {
        add('P0', 'R3-crash-' + c.tag, '残缺/异常档读档后 UI 崩溃或无法操作',
          'localStorage[' + 'esport_manager_save_v3' + ']=' + c.tag + ' → load() → renderAll/renderClub',
          'load/migrateSave/renderClub',
          '读档后渲染抛错或 load 抛错',
          JSON.stringify(c));
      } else if (stuck) {
        add('P0', 'R3-stuck-' + c.tag, '读档后无任何推进按钮（卡死）',
          c.tag + ' load 后 renderClub',
          'nextAction/clubPhasePanel',
          'phase=' + (c.S && c.S.phase) + ' 但 nextAction=null 且面板无按钮',
          JSON.stringify(c));
      } else if (c.startCupErr) {
        add('P0', 'R3-engine-' + c.tag, '读档后杯赛引擎调用抛错',
          c.tag + ' startCup',
          'startCup',
          c.startCupErr,
          JSON.stringify(c));
      } else {
        add('INFO', 'R3-' + c.tag, '读档结果', c.tag, '', JSON.stringify(c));
      }
    });
  }
}

/* ========== R4: startMatch 空名单 / 伤停 openBP ========== */
{
  const r = run(LIB + `
  const out={};
  // 空名单
  prep();
  S.players=[]; S.lineup=[];
  S.preseason=false;
  try{ startMatch(); out.emptyStart={err:null, series:!!S.series, stage:S.series&&S.series.stage}; }
  catch(e){ out.emptyStart={err:e.message, series:!!S.series}; }
  // openBP 此时
  const t1=[];
  const o1=toast; toast=m=>t1.push(String(m));
  try{ openBP('空', ()=>{}); out.emptyOpenBP={err:null}; }catch(e){ out.emptyOpenBP={err:e.message}; }
  toast=o1;
  out.emptyToasts=t1;

  // 全伤停无替补
  prep();
  S.preseason=false;
  // 删掉替补，只留 5 首发并全部伤停
  const starterIds=new Set(S.lineup);
  S.players=S.players.filter(p=>starterIds.has(p.id));
  S.players.forEach(p=>{p.injury=5;});
  autoFillLineup(S);
  out.injNoGo=lineupNoGo(S);
  out.injLineup=S.lineup.map(id=>{const p=S.players.find(x=>x.id===id);return p?p.name+':inj'+p.injury:'?';});
  try{ startMatch(); out.injStart={err:null, series:!!S.series}; }catch(e){ out.injStart={err:e.message}; }
  const t2=[]; toast=m=>t2.push(String(m));
  try{ openBP('伤', ()=>{}); out.injOpenBP={err:null}; }catch(e){ out.injOpenBP={err:e.message}; }
  toast=o1;
  out.injToasts=t2;
  // 赛前面板是否说明
  let prepHtml='';
  try{
    if(S.series && typeof renderPreMatch==='function'){ renderPreMatch(); prepHtml=(document.getElementById('app-modal-body')||{}).innerHTML||''; }
  }catch(e){ prepHtml='err:'+e.message; }
  out.prepHasWhy=/无法出战|伤停|集训|空缺|无人|替补|签约/.test(prepHtml+' '+t2.join(' ')+' '+clubHtml());
  return out;
  `);
  const o = r.result || {};
  if (!r.ok) {
    add('P0', 'R4-throws', 'startMatch 拦截探针抛错', 'R4', 'startMatch/openBP', r.err);
  } else {
    if (o.emptyStart && o.emptyStart.series && !o.emptyStart.err) {
      // startMatch built series with empty roster
      if (o.emptyOpenBP && o.emptyOpenBP.err) {
        add('P0', 'R4-empty-openbp-throw', '空名单 startMatch 后 openBP 抛错',
          'S.players=[] → startMatch() → 赛前准备点开赛/openBP',
          'startMatch / openBP (bp.js:243)',
          'startMatch 不校验名单就建 series；openBP 在 noGo 判定后仍读 S.series.opName 等，空名单时 series 虽建了但后续 BP/选手遍历易炸。openBP 抛错=' + o.emptyOpenBP.err,
          JSON.stringify(o));
      } else if (!(o.emptyToasts || []).length) {
        add('P0', 'R4-empty-silent', '空名单开赛无拦截说明',
          'players=[] startMatch', 'startMatch', '直接建 series 且无 toast',
          JSON.stringify(o));
      } else {
        add('INFO', 'R4-empty', '空名单 startMatch', '', '', JSON.stringify(o));
      }
    }
    if (o.injOpenBP && o.injOpenBP.err) {
      add('P0', 'R4-inj-openbp-throw', '全伤停时 openBP 抛错（拦截路径自身崩溃）',
        '五位置全伤停且无替补 → startMatch → openBP',
        'openBP (bp.js:243-261)',
        '本应 toast「无法出战：签约替补…」却抛错：' + o.injOpenBP.err + '。若 noGo 为空（伤员被留在首发且 lineupNoGo 漏判）会走到 sr.opName，series 异常时 null 引用。',
        JSON.stringify({ o, toasts: o.injToasts, noGo: o.injNoGo }));
    } else if (!(o.injToasts || []).length && !o.prepHasWhy) {
      add('P0', 'R4-inj-silent', '伤停拦截无说明', '全伤停 openBP/startMatch', 'openBP', '无 toast 无面板文案', JSON.stringify(o));
    } else {
      add('INFO', 'R4-inj', '伤停拦截', '', '', JSON.stringify({ noGo: o.injNoGo, toasts: o.injToasts, openBP: o.injOpenBP, start: o.injStart, prepHasWhy: o.prepHasWhy }));
    }
  }
}

/* ========== R5: yearRoll 连点 + board.fired + 静态 uiDoNextAction 参数表 ========== */
{
  const r = run(LIB + `
  const out={};
  // yearRoll
  prep();
  S.annualPts={[S.teamName]:999};
  AI_TEAMS.forEach((t,i)=>{S.annualPts[t.name]=50-i;});
  try{ setupAnnual(S); }catch(e){ out.setupErr=e.message; }
  S.phase='annual';
  if(S.annual){
    S.annual.stage='po';
    S.annual.po={wb1:[{a:S.teamName,b:'X',r:S.teamName}],wb2:[],lb1:[],lb2:[],wf:{a:S.teamName,b:'Y',r:S.teamName},lbs:{},lbf:{},final:{a:S.teamName,b:AI_TEAMS[0].name,r:S.teamName},champ:null};
  }
  out.yrPending=yearRollPending(S);
  out.yrAction=na();
  const html=clubHtml();
  out.yrHasBtn=/uiFinishAnnual/.test(html);
  const s0=S.season, p0=S.phase;
  const errs=[];
  try{ uiFinishAnnual(S); }catch(e){ errs.push('c1:'+e.message); }
  const a1={phase:S.phase,season:S.season,yr:yearRollPending(S),preseason:S.preseason};
  try{ uiFinishAnnual(S); }catch(e){ errs.push('c2:'+e.message); }
  const a2={phase:S.phase,season:S.season,yr:yearRollPending(S)};
  try{ uiFinishAnnual(S); uiFinishAnnual(S); }catch(e){ errs.push('c3:'+e.message); }
  const a3={phase:S.phase,season:S.season,yr:yearRollPending(S)};
  out.yearRoll={s0,p0,a1,a2,a3,errs};

  // board.fired
  prep();
  S.board={trust:0,warn:3,fired:true,firedSeason:S.season,log:[],kpi:null};
  out.firedAction=na();
  const htmlF=clubHtml();
  out.firedHasExplain=/解约/.test(htmlF);
  out.firedHasReset=/resetGame/.test(htmlF);
  const tf=[]; const of=toast; toast=m=>tf.push(String(m));
  try{ uiStartMatch(); }catch(e){ out.firedUiErr=e.message; }
  toast=of;
  out.firedToasts=tf;
  return out;
  `);
  const o = r.result || {};
  if (!r.ok) {
    add('P0', 'R5-throws', 'yearRoll/fired 探针抛错', 'R5', '', r.err);
  } else {
    add('INFO', 'R5-yearRoll', 'yearRoll 连点', '', '', JSON.stringify({ pending: o.yrPending, action: o.yrAction, hasBtn: o.yrHasBtn, clicks: o.yearRoll, setupErr: o.setupErr }));
    if (o.yrPending && !o.yrHasBtn && !o.yrAction) {
      add('P0', 'R5-yearroll-no-btn', 'yearRollPending 无「进入新赛季」按钮', '年总决赛打完', 'nextAction/clubAnnualPanel', '卡死', JSON.stringify(o));
    }
    if (o.yearRoll && o.yearRoll.errs && o.yearRoll.errs.length) {
      add('P0', 'R5-yearroll-throw', 'uiFinishAnnual 连点抛错', 'yearRoll 连点', 'uiFinishAnnual/finishAnnual', o.yearRoll.errs.join(';'), JSON.stringify(o.yearRoll));
    }
    if (o.yearRoll && o.yearRoll.a3 && o.yearRoll.a1 && o.yearRoll.a3.season > o.yearRoll.a1.season + 1) {
      add('P0', 'R5-yearroll-double', 'finishAnnual 反复点击赛季多次老化', '连点', 'finishAnnual', 'season ' + o.yearRoll.a1.season + '→' + o.yearRoll.a3.season, JSON.stringify(o.yearRoll));
    }
    add('INFO', 'R5-fired', 'board.fired UI', '', '', JSON.stringify({ action: o.firedAction, explain: o.firedHasExplain, reset: o.firedHasReset, toasts: o.firedToasts }));
    if (!o.firedHasExplain || !o.firedHasReset) {
      add('P0', 'R5-fired-no-ui', 'board.fired 后 UI 无说明/重开', 'fired=true renderClub', 'clubBoardPanel', '死局无字', JSON.stringify(o));
    }
  }
}

/* ========== R6: 静态扫 uiDoNextAction / startCard / startPlayoff 参数 ========== */
{
  const uiSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'ui.js'), 'utf8');
  const badCalls = [];
  const re = /uiDoNextAction\(([^)]*)\)/g;
  let m;
  const lines = uiSrc.split(/\r?\n/);
  lines.forEach((ln, i) => {
    const re2 = /uiDoNextAction\(([^)]*)\)/g;
    let mm;
    while ((mm = re2.exec(ln))) {
      const arg = mm[1].trim();
      // 合法：uiDoNextAction(S) / uiDoNextAction(s) / uiDoNextAction(s||S)
      const okArg = /^(S|s|s\s*\|\|\s*S)$/.test(arg);
      if (!okArg) badCalls.push({ line: i + 1, arg, snippet: ln.trim().slice(0, 140) });
    }
  });
  if (badCalls.length) {
    add('P0', 'R6-uDoNext-bad-args', 'uiDoNextAction 被传入非 state 参数（onclick 完整性/推进卡死根因）',
      'src/js/ui.js clubCardPanel / clubPlayoffPanel 模板字符串',
      'uiDoNextAction',
      'onclick 把动作名字符串当第一参数：uiDoNextAction(\'startCard\') / (\'startPlayoff\')。函数签名是 uiDoNextAction(s) 期望全局状态 S；传字符串后 nextAction(s) 因 !s.players 返回 null，按钮只弹「当前没有可进行的比赛」。兜底逻辑 html.indexOf(act.fn)<0 && html.indexOf(\'uiDoNextAction\')<0 被已渲染的坏按钮子串命中而抑制，卡位赛/季后赛无可用入口。',
      JSON.stringify(badCalls, null, 1));
  }
  // 对照：合法调用统计
  let good = 0;
  lines.forEach(ln => {
    const re3 = /uiDoNextAction\((S|s|s\s*\|\|\s*S)\)/g;
    while (re3.exec(ln)) good++;
  });
  add('INFO', 'R6-args-stats', 'uiDoNextAction 参数统计', '', '', JSON.stringify({ bad: badCalls.length, good }));
}

/* output */
const p0 = findings.filter(f => f.severity === 'P0');
const p1 = findings.filter(f => f.severity === 'P1');
const info = findings.filter(f => f.severity === 'INFO');
const outPath = path.join(__dirname, 'flow-refined-result.json');
fs.writeFileSync(outPath, JSON.stringify({ p0, p1, info, all: findings }, null, 2), 'utf8');
console.log('=== refined flow probe ===');
console.log('P0:', p0.length);
p0.forEach(f => console.log(' [P0]', f.id, '-', f.title));
console.log('P1:', p1.length);
p1.forEach(f => console.log(' [P1]', f.id, '-', f.title));
console.log('INFO:', info.length);
info.forEach(f => console.log(' [INFO]', f.id, '-', f.title));
console.log('Result:', outPath);
if (p0.length) process.exitCode = 3;
