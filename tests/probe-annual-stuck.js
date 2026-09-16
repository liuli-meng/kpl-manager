// 年总卡死探针：擂台/突围/淘汰入口、读档后 cupMatch 引用、无待赛按钮
const vm = require('vm');
const { makeDom, injectHelpers } = require('./harness');

const { dom } = makeDom();
injectHelpers(dom);

const out = vm.runInContext(`
(function(){
  const res=[],errs=[];
  const log=t=>res.push(t);
  const fail=m=>errs.push(m);

  function closeSeries(){
    if(!S.series)return false;
    S.series.mw=Math.ceil(S.series.max/2);
    S.series.ow=1;
    finishSeries(true);
    return true;
  }
  function runLeagueQuick(){
    let g=0;
    while(!['champion','eliminated'].includes(S.phase)&&g++<220){
      if(S.preseason){S.preseason=false;S.transferWindow=0;continue;}
      if(S.phase==='r1'||S.phase==='r2'||S.phase==='r3'){
        if(S.matchIdx>=(S.schedule||[]).length){advancePhase(S);continue;}
        if(S.series&&S.series.stage==='regular'){closeSeries();continue;}
        const m=S.schedule[S.matchIdx];
        S.series={used:[],usedOpp:[],mw:0,ow:0,max:5,stage:'regular',logs:[],myName:S.teamName,opName:m.opp,side:'blue'};
        S.series.mw=3;S.series.ow=1;finishSeries(true);
      }else if(S.phase==='card'){
        if(S.series){closeSeries();continue;}
        const myCard=S.card&&S.card.matches.find(x=>!x.r&&(x.a===S.teamName||x.b===S.teamName));
        if(!myCard){startCard();continue;}
        S.series={used:[],usedOpp:[],mw:0,ow:0,max:7,stage:'card',cardMatch:myCard,logs:[],myName:S.teamName,opName:myCard.a===S.teamName?myCard.b:myCard.a,side:'blue'};
        S.series.mw=4;S.series.ow=1;finishSeries(true);
      }else if(S.phase==='playoff'){
        if(S.series){closeSeries();continue;}
        startPlayoff();
        if(!S.series)break;
      }else break;
    }
  }
  function clubHtml(){
    renderClub();
    return document.getElementById('page-club').innerHTML||'';
  }
  function prepToAnnual(){
    S=newState('年总探针','⚔');
    fillRoster(S,'star');
    S.coach={...COACH_POOL.find(c=>c.id==='co12')};
    S.lineup=S.players.map(p=>p.id);
    S.seedPower=teamPower(S);
    startSplit(S,'spring');
    S.preseason=false;S.transferWindow=0;
    runLeagueQuick();
    advanceCalendar(S);
    // 挑杯+EWC 快进（玩家未打也能 AI 补完；玩家晋级则直接 force 掉）
    let g=0;
    while((S.phase==='challenger'||S.phase==='ewc')&&g++<120){
      if(S.series){closeSeries();continue;}
      if(S.phase==='challenger'&&S.challenger&&!S.challenger.champ){startCup(S);if(S.series){closeSeries();continue;}}
      else if(S.phase==='ewc'&&S.ewc&&!S.ewc.champ){startCup(S);if(S.series){closeSeries();continue;}}
      else break;
      if(S.phase==='summer'||S.preseason)break;
    }
    if(S.preseason){S.preseason=false;S.transferWindow=0;}
    if(S.split==='summer'){
      runLeagueQuick();
      advanceCalendar(S);
      let a=0;
      while(S.phase==='asiad'&&!(S.ag&&S.ag.champ)&&a++<20)asiadStep(S);
    }
    if(S.phase!=='annual'){
      // 未晋级年总：强制塞进前12再 setup
      S.annualPts[S.teamName]=999;
      setupAnnual(S);
    }
    return {phase:S.phase,stage:S.annual&&S.annual.stage,rank:Object.keys(S.annualPts||{}).sort((a,b)=>(S.annualPts[b]||0)-(S.annualPts[a]||0)).indexOf(S.teamName)};
  }

  // ① 年总开幕：擂台赛必须有可点按钮
  const prep=prepToAnnual();
  log('① 开幕 phase='+prep.phase+' stage='+(S.annual&&S.annual.stage)+' rank='+(prep.rank+1));
  if(prep.phase!=='annual')fail('① 未进入年总 phase='+prep.phase);
  else{
    const html=clubHtml();
    if(html.indexOf('uiStartCup')<0)fail('① 年总擂台开幕无 uiStartCup 按钮');
    else log('① 擂台开幕按钮 OK');
  }

  // ② 读档/断引用后：仅凭 cupSlot 也能把结果写回 bracket
  if(S.phase==='annual'&&S.annual&&S.annual.stage==='arena'){
    startCup(S);
    if(!S.series)fail('② startCup 未建立 series');
    else if(S.series.stage!=='cup')fail('② series.stage='+S.series.stage);
    else{
      // 模拟读档：JSON 往返切断引用
      const raw=serializeForSave(S);
      S=JSON.parse(raw);
      migrateSave();
      const sr=S.series;
      // 主动清掉缓存引用，强制走 cupSlot 解析
      delete sr.cupMatch;
      const real=(S.annual.rounds[S.annual.roundIdx]||[]).find(m=>m.a===S.teamName||m.b===S.teamName);
      const resolved=resolveSeriesMatch(S);
      if(!resolved||resolved!==real)fail('② resolveSeriesMatch 未按 cupSlot 找回真对象 slot='+sr.cupSlot);
      else log('② cupSlot 解析回 bracket OK');
      sr.mw=Math.ceil(sr.max/2);sr.ow=1;
      finishSeries(true);
      const anyR=(S.annual.rounds||[]).flat().some(m=>(m.a===S.teamName||m.b===S.teamName)&&!!m.r);
      if(!anyR)fail('② finishSeries 后 bracket 中玩家场次无 r（结果写丢）');
      else log('② finishSeries 结果写回 bracket OK');
    }
  }

  // ③ 擂台赛 myNext 已有 r 但仍停在本轮：按钮应推进而非重开
  prepToAnnual();
  // 手工把本轮玩家场次记 r，但不推进 roundIdx（模拟异常残留）
  const a0=S.annual;
  const rd0=a0.rounds[a0.roundIdx];
  const my0=rd0.find(m=>m.a===S.teamName||m.b===S.teamName);
  if(my0){
    my0.r=S.teamName; my0.ms=3; my0.es=0;
    a0.rounds.forEach(m=>{if(m!==my0&&!m.r){const r=simSeriesResult(S,m.a,m.b,KPL.BO5);m.r=r.win?m.a:m.b;m.ms=r.mw;m.es=r.ow;}});
    // 刻意不 ++roundIdx
    const html=clubHtml();
    let okBtn=html.indexOf('uiStartCup')>=0;
    let advanced=false;
    try{startCup(S); advanced=(S.annual.stage!=='arena')||(S.annual.roundIdx>a0.roundIdx);}catch(e){fail('③ startCup 抛错: '+e.message);}
    if(!okBtn&&!advanced)fail('③ 本轮已赛但卡住：无按钮且 startCup 未推进 stage='+S.annual.stage+' idx='+S.annual.roundIdx);
    else log('③ 本轮已赛残留：btn='+okBtn+' advanced='+advanced+' stage='+S.annual.stage+' idx='+S.annual.roundIdx);
  }

  // ④ 玩家不在当前轮（构造：从 rounds 抹掉本队名）
  prepToAnnual();
  S.annual.rounds.forEach(rd=>rd.forEach(m=>{
    if(m.a===S.teamName)m.a='幽灵队A';
    if(m.b===S.teamName)m.b='幽灵队B';
  }));
  const html4=clubHtml();
  if(html4.indexOf('uiStartCup')<0)fail('④ 本轮无我队对阵时 UI 无任何推进按钮（显示「本轮赛程进行中」卡死）');
  else log('④ 无我队对阵仍有推进按钮 OK');
  let e4=null;
  try{startCup(S);}catch(e){e4=e;}
  if(e4)fail('④ startCup 抛错: '+e4.message);
  else if(S.annual.stage==='arena'&&S.annual.roundIdx===0&&!(S.annual.rounds[0]||[]).every(m=>m.r))
    fail('④ 无我队对阵时 startCup 既未补完本轮也未 finishArena');
  else log('④ 无我队对阵 startCup 可推进 stage='+S.annual.stage+' idx='+S.annual.roundIdx);

  // ⑤ 残留 series（常规赛）时点年总按钮
  prepToAnnual();
  S.series={used:[],usedOpp:[],mw:1,ow:0,max:5,stage:'regular',logs:[],myName:S.teamName,opName:'成都AG超玩会',side:'blue'};
  try{startCup(S);log('⑤ 残留regular series 后 startCup stage='+(S.series&&S.series.stage)+' cupSlot='+(S.series&&S.series.cupSlot));}
  catch(e){fail('⑤ 残留 series 时 startCup 抛错: '+e.message);}

  // ⑥ 突围赛/淘汰赛按钮存在性（推进到 breakthrough / po）+ 每轮擂台赛后按钮仍在
  prepToAnnual();
  let g6=0;
  let arenaBtnOk=true;
  while(S.phase==='annual'&&S.annual.stage==='arena'&&g6++<20){
    const h0=clubHtml();
    if(h0.indexOf('uiStartCup')<0){arenaBtnOk=false;fail('⑥ 擂台第'+(S.annual.roundIdx+1)+'轮无按钮');}
    if(S.series){closeSeries();continue;}
    startCup(S);
    if(S.series){closeSeries();continue;}
  }
  if(arenaBtnOk)log('⑥ 擂台全程每轮均有 uiStartCup OK');
  if(S.annual.stage==='breakthrough'){
    const h=clubHtml();
    if(h.indexOf('uiStartCup')<0)fail('⑥ 突围赛面板无按钮');
    else log('⑥ 突围赛按钮 OK');
  }else log('⑥ 已越过突围 stage='+S.annual.stage);
  if(S.phase==='annual'&&S.annual.stage==='po'){
    const h=clubHtml();
    if(h.indexOf('uiStartCup')<0)fail('⑥ 淘汰赛面板无按钮');
    else log('⑥ 淘汰赛按钮 OK');
  }

  return (errs.length?errs.map(e=>'[FAIL] '+e).join('\\n')+'\\n':'') + res.map(r=>'[INFO] '+r).join('\\n') + (errs.length?'\\n共 '+errs.length+' 失败':'\\n全部通过');
})()
`, dom);

console.log(out);
if (/\[FAIL\]/.test(out)) process.exitCode = 1;
