// Engine-side probes for manager-mode nextAction / scenario / dead handlers
// Run: node tests/playthrough/manager-engine-probe.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeDom } = require('../harness');

const { dom } = makeDom();
// inject test helpers + expose sandbox self-ref for typeof checks
vm.runInContext(`
this.__typeof=function(name){try{return typeof eval(name);}catch(e){return 'throw:'+e.message;};};
`, dom);

const bugs = [];
const notes = [];
const fail = (sev, title, detail) => { bugs.push({ sev, title, detail }); console.log(`[${sev}] ${title}`, detail || ''); };
const pass = (t) => console.log('[PASS]', t);
const note = (t) => { notes.push(t); console.log('[note]', t); };

// ---- static: uiDoNextAction misuse in src ----
try {
  const ui = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'js', 'ui.js'), 'utf8');
  const bad = [...ui.matchAll(/uiDoNextAction\(\s*'([^']+)'\s*\)/g)].map(m => m[0]);
  const good = [...ui.matchAll(/uiDoNextAction\(\s*S\s*\)/g)].map(m => m[0]);
  const badTypes = bad.map(s => (s.match(/'([^']+)'/) || [])[1]);
  if (bad.length) {
    fail('P0', 'ui.js: uiDoNextAction(字符串) 错误绑定 — nextAction(字符串) 恒 null，按钮点击无效',
      `bad=${bad.join(', ')} correct=${good.length} 处 uiDoNextAction(S)。影响：卡位赛/季后赛俱乐部面板按钮。`);
  } else pass('ui.js 无 uiDoNextAction(字符串) 绑定');

  // runtime confirm of the semantic
  const r = vm.runInContext(`
  (function(){
    S=newState('绑定探针','B');
    const used=new Set();
    POS_ORDER.forEach((pos,i)=>S.players.push(genPlayer(genFreeAgentDef(pos,i===0?'star':'mid',used))));
    S.lineup=S.players.map(p=>p.id);
    S.coach={...COACH_POOL.find(x=>x.id==='co12')};
    initGroups(S); S.preseason=false; S.phase='card';
    S.teamName='绑定探针';
    S.card={idx:0,matches:[{a:S.teamName,b:'X',r:null}]};
    const a1=nextAction(S);
    const a2=nextAction('startCard');
    const a3=nextAction('startPlayoff');
    return {a1,a2,a3,sameNull:a2===null&&a3===null};
  })()
  `, dom);
  if (r.a1 && r.a2 === null) {
    fail('P0', 'runtime: nextAction(S) 有值，但 nextAction("startCard"/"startPlayoff")=null — 按钮死链确认',
      JSON.stringify(r));
  } else note('runtime nextAction mismatch probe: ' + JSON.stringify(r));

  // fallback suppression: html containing uiDoNextAction from dead button blocks safety net
  const fb = ui.includes(`html.indexOf('uiDoNextAction')<0`);
  if (fb && bad.length) {
    fail('P0', 'clubPhasePanel 兜底被死按钮抑制：html 已含 "uiDoNextAction" 字符串，安全网不渲染',
      'ui.js clubPhasePanel: if(act&&html.indexOf(act.fn)<0&&html.indexOf(\'uiDoNextAction\')<0)');
  }
} catch (e) {
  fail('P1', 'uiDoNextAction 静态扫描失败', e.message);
}

// ---- function existence (outside nested vm misuse) ----
const MUST = [
  'uiEndPreseason','uiStartMatch','uiStartCup','uiFinishAnnual','uiAsiadStep','uiAdvanceCalendar','uiDoNextAction',
  'endPreseason','autoPlayNext','bpAuto','bpConfirm','startMatch','startCard','startPlayoff','startCup',
  'buyPlayer','signFreeAgent','listPlayer','delistPlayer','openNegotiation','openRenewNego','renewPlayer','releasePlayer',
  'endTransferWindow','skipTransferWindow','refreshMarket','openSellNego','acceptBid','rejectBid',
  'setTactic','doTrain','doHeroTrain','recruitRookie','trainRookie','promoteRookie','sendKjia','recallKjia',
  'upgradeSponsor','toggleSimpleMode','toggleHighContrast','renderHall','renderUnion','renderKjia','renderBiz',
  'renderTrain','renderLineup','renderMarket','renderClub','goPage','nextDay','advanceCalendar','uiNextDay',
  'createTeam','pickScenario','applyScenario','applyClub','applyCoachClub','applyEraClub','gotoEraStart',
  'nextAction','fillRoster','swapPlayer','setCaptain','initStart','switchStartTab','pickClub','pickCoachClub',
];
MUST.forEach(fn => {
  const t = vm.runInContext(`__typeof(${JSON.stringify(fn)})`, dom);
  if (t !== 'function') fail('P0', '关键函数缺失/不可见: ' + fn, t);
});
pass('function existence scan done (' + MUST.length + ' fns)');

// ---- scenario apply + endPreseason (exodus needs fill) ----
const scen = vm.runInContext(`
(function(){
  const R=[];
  const ids=SCENARIOS.map(s=>s.id);
  ['normal','debt','exodus','cap','cursed'].forEach(id=>{
    if(!ids.includes(id))R.push({sev:'P0',t:'SCENARIOS 缺少 '+id,d:ids.join(',')});
  });
  SCENARIOS.forEach(s=>{
    if(!s.name||!s.desc)R.push({sev:'P1',t:'剧本字段不全 '+s.id,d:JSON.stringify({n:s.name,d:s.desc})});
  });

  function boot(id){
    S=newState('探针'+id,'探');
    const used=new Set();
    POS_ORDER.forEach((pos,i)=>{
      const band=i===0?'star':'mid';
      S.players.push(genPlayer(genFreeAgentDef(pos,band,used)));
    });
    const byPos={}; S.players.forEach(p=>{(byPos[p.pos]=byPos[p.pos]||[]).push(p);});
    const lineup=[];
    POS_ORDER.forEach(pos=>{const c=byPos[pos]; if(c&&c.length){c.sort((a,b)=>playerPower(b)-playerPower(a)); lineup.push(c[0].id);}});
    S.lineup=lineup;
    _scenario=id;
    applyScenario(S);
    S.coach={...COACH_POOL.find(c=>c.id==='co12')};
    S.seedPower=teamPower(S)||280;
    initGroups(S);
    S.preseason=true; S.transferWindow=fmtOf(S).transferDays;
    setBoardKpi(S); initFans(S); initKjia(S);
    buildTransferMarket(S); refreshMarket(S,{seed:true});
    return S;
  }

  ['normal','debt','exodus','cap','cursed'].forEach(id=>{
    boot(id);
    if(S.scenario!==id)R.push({sev:'P0',t:'scenario 未写入 '+id,d:S.scenario});
    if(id==='debt'&&(S.fund!==330||S.wageCap!==120))R.push({sev:'P0',t:'debt 效果错误',d:'fund='+S.fund+' cap='+S.wageCap});
    if(id==='cap'&&S.wageCap!==90)R.push({sev:'P0',t:'cap 效果错误',d:String(S.wageCap)});
    if(id==='exodus'){
      const hole=POS_ORDER.filter(pos=>!S.players.some(p=>p.pos===pos));
      if(S.players.length!==4||hole.length!==1)R.push({sev:'P0',t:'exodus 效果错误',d:'n='+S.players.length+' hole='+JSON.stringify(hole)});
      // Fill hole like a player would
      hole.forEach(pos=>{
        const fa=(S.freeAgents||[]).find(p=>p.pos===pos)||(S.market||[]).find(p=>p.pos===pos)||
          genPlayer(genFreeAgentDef(pos,'low'));
        try{
          if(fa.freeAgent||fa.signCost!=null)signFreeAgent(S,fa.id);
          else if((S.market||[]).some(x=>x.id===fa.id))buyPlayer(S,fa);
          else {S.players.push(fa);}
        }catch(e){S.players.push(fa);}
      });
      autoFillLineup(S);
      const still=POS_ORDER.filter(pos=>!S.players.some(p=>p.pos===pos));
      if(still.length)R.push({sev:'P1',t:'exodus 补位后仍空缺',d:JSON.stringify(still)+' freeAgents='+(S.freeAgents||[]).map(p=>p.pos).join(',')});
    }
    if(id==='cursed'&&!S.players.every(p=>p.morale===50))R.push({sev:'P0',t:'cursed 士气未统一',d:JSON.stringify(S.players.map(p=>p.morale))});

    const act=nextAction(S);
    if(!act||act.fn!=='uiEndPreseason')R.push({sev:'P0',t:'preseason nextAction 错误 '+id,d:JSON.stringify(act)});

    try{
      autoFillLineup(S);
      endPreseason(S);
      if(S.preseason!==false){
        const miss=POS_ORDER.filter(pos=>!S.players.some(p=>p.pos===pos&&!p.loan));
        R.push({sev: miss.length?'P1':'P0', t:'endPreseason 后仍 preseason '+id, d:'miss='+JSON.stringify(miss)+' fund='+S.fund});
      } else {
        const act2=nextAction(S);
        if(!act2||act2.fn!=='uiStartMatch')R.push({sev:'P0',t:'开赛后 nextAction 不是 uiStartMatch '+id,d:JSON.stringify(act2)});
        else R.push({sev:'PASS',t:'flow ok '+id,d:'phase='+S.phase+' sched='+(S.schedule||[]).length});
      }
    }catch(e){R.push({sev:'P0',t:'endPreseason 抛错 '+id,d:e.message});}
  });

  // market ops on normal
  try{
    S=boot('normal');
    const p=S.players[S.players.length-1];
    if(S.lineup.includes(p.id))swapPlayer(p.id);
    listPlayer(S,p.id);
    if(!(S.listed||[]).some(x=>x.id===p.id))R.push({sev:'P1',t:'listPlayer 未写入 listed',d:p.name});
    const r=S.players.find(x=>!x.loan); r.contract=0;
    renewPlayer(S,r.id,2);
    if(r.contract<1)R.push({sev:'P1',t:'renewPlayer 未写入 contract',d:String(r.contract)});
    S.expiring=[S.players[0].id]; S.players[0].contract=0;
    endTransferWindow(S);
    if(S.players[0].contract<1)R.push({sev:'P1',t:'endTransferWindow 未自动续约',d:''});
    // buy / fa
    const mk=(S.market||[])[0];
    if(mk){const n0=S.players.length; buyPlayer(S,mk); if(S.players.length<=n0)R.push({sev:'P1',t:'buyPlayer 未入队',d:mk.name+' fund='+S.fund});}
    const fa=(S.freeAgents||[])[0];
    if(fa){const n1=S.players.length; try{signFreeAgent(S,fa.id); if(S.players.length<=n1)R.push({sev:'P1',t:'signFreeAgent 未入队',d:fa.name});}catch(e){R.push({sev:'P1',t:'signFreeAgent 抛错',d:e.message});}}
  }catch(e){R.push({sev:'P0',t:'market ops 抛错',d:e.message});}

  // render all pages
  try{
    S=boot('normal');
    ['club','lineup','market','train','league','kjia','union','hall','biz'].forEach(pg=>{
      try{goPage(pg); R.push({sev:'PASS',t:'render '+pg,d:''});}
      catch(e){R.push({sev:'P0',t:'render '+pg+' 抛错',d:e.message});}
    });
  }catch(e){R.push({sev:'P0',t:'render 探针抛错',d:e.message});}

  return R;
})()
`, dom);

scen.forEach(r => {
  if (r.sev === 'PASS') pass(r.t + (r.d ? ' ' + r.d : ''));
  else fail(r.sev, r.t, r.d);
});

console.log('--- engine probe bugs ---');
bugs.forEach(b => console.log(b.sev, b.title, String(b.detail).slice(0, 200)));
console.log('P0', bugs.filter(b => b.sev === 'P0').length, 'P1', bugs.filter(b => b.sev === 'P1').length);
// persist for report merge
fs.mkdirSync(path.join(__dirname, '..', '..', '.bug-hunt'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', '..', '.bug-hunt', 'engine-probe.json'), JSON.stringify({ bugs, notes }, null, 2));
if (bugs.some(b => b.sev === 'P0')) process.exitCode = 1;
