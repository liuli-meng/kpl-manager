// 确认：卡位赛/季后赛坏按钮点击行为
const path = require('path');
const vm = require('vm');
const { makeDom, injectHelpers } = require(path.join(__dirname, '..', 'tests', 'harness.js'));
const { dom } = makeDom();
injectHelpers(dom);
const script = `
(function(){
  S=newState('btn','x');
  fillRoster(S,'star');
  S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup=S.players.map(p=>p.id);
  S.seedPower=teamPower(S);
  startSplit(S,'spring');
  S.preseason=false;S.transferWindow=0;
  function closeSeriesWin(win){
    if(!S.series)return false;
    S.series.mw=win?Math.ceil(S.series.max/2):1;
    S.series.ow=win?1:Math.ceil(S.series.max/2);
    finishSeries(!!win);
    return true;
  }
  function stepRegular(){
    if(S.matchIdx>=(S.schedule||[]).length){advancePhase(S);return;}
    if(S.series&&S.series.stage==='regular'){closeSeriesWin(true);return;}
    const m=S.schedule[S.matchIdx];
    if(!m){advancePhase(S);return;}
    S.series={used:[],usedOpp:[],mw:0,ow:0,max:5,stage:'regular',mid:m.mid,logs:[],myName:S.teamName,opName:m.opp,side:'blue'};
    S.series.mw=3;S.series.ow=1;finishSeries(true);
  }
  let g=0;
  while(!['card','playoff','champion','eliminated'].includes(S.phase)&&g++<100){
    if(S.preseason){S.preseason=false;S.transferWindow=0;continue;}
    if(S.phase==='r1'||S.phase==='r2'||S.phase==='r3'){ stepRegular(); }
    else break;
  }
  const naturalPhase=S.phase;
  // 保证 card 状态可测
  if(S.phase!=='card'){
    S.phase='card';
    S.card={matches:[{a:S.teamName,b:AI_TEAMS[0].name,r:null,winTo:'S'},{a:AI_TEAMS[1].name,b:AI_TEAMS[2].name,r:null,winTo:'S'}],idx:0};
  }
  renderClub();
  const h=(document.getElementById('page-club')||{}).innerHTML||'';
  const toasts=[];
  const old=toast; toast=m=>toasts.push(String(m));
  uiDoNextAction('startCard'); // 坏按钮正文
  const afterBad={series:!!S.series, stage:S.series&&S.series.stage, toasts:toasts.slice()};
  toasts.length=0;
  // 正确调用（若坏按钮已把玩家卡住，这条对照应能开赛）
  try{ uiDoNextAction(S); }catch(e){ toasts.push('good-throw:'+e.message); }
  toast=old;
  return {
    naturalPhase,
    forcedPhase:S.phase,
    card:!!S.card,
    myCard:!!(S.card&&S.card.matches.find(m=>m.a===S.teamName||m.b===S.teamName)),
    brokenInHtml:h.includes("uiDoNextAction('startCard')"),
    fallbackInHtml:h.includes('赛段入口由 nextAction'),
    hasAnyDoNext:h.includes('uiDoNextAction'),
    afterBad,
    afterGood:{series:!!S.series, stage:S.series&&S.series.stage, toasts},
    nextAction:nextAction(S),
  };
})()
`;
const r = vm.runInContext(script, dom);
console.log(JSON.stringify(r, null, 2));
