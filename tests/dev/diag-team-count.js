const { makeDom, injectHelpers } = require('../harness');
const { dom } = makeDom();
injectHelpers(dom);
dom.console = console;
const vm = require('vm');

const code = `
function forceSeries(win){
  if(!S.series)return false;
  S.series.mw=win?Math.ceil(S.series.max/2):1;
  S.series.ow=win?1:Math.ceil(S.series.max/2);
  finishSeries(win);
  return true;
}
function playLeague(win){
  let g=0;
  while(!['champion','eliminated'].includes(S.phase)&&g++<400){
    if(S.preseason){S.preseason=false;S.transferWindow=0;continue;}
    if(S.phase==='r1'||S.phase==='r2'||S.phase==='r3'){
      if(S.matchIdx>=S.schedule.length){advancePhase(S);continue;}
      if(S.series&&S.series.stage==='regular'){forceSeries(win);continue;}
      startMatch();
      if(!S.series){continue;}
      forceSeries(win);
    }else if(S.phase==='card'){
      if(S.series){forceSeries(win);continue;}
      startCard();
      if(S.series){forceSeries(win);continue;}
      if(!['champion','eliminated'].includes(S.phase)&&!(S.card&&S.card.idx<S.card.matches.length))break;
    }else if(S.phase==='playoff'){
      if(S.series){forceSeries(win);continue;}
      startPlayoff();
      if(S.series){forceSeries(win);continue;}
      if(!S.playoff||!S.playoff.final||S.playoff.final.r)break;
    }else break;
  }
}
function playCups(win){
  let g=0;
  while(g++<220){
    if(S.phase==='asiad'){
      let a=0;
      while(S.phase==='asiad'&&!(S.ag&&S.ag.champ)&&a++<30)asiadStep(S);
      continue;
    }
    if(S.phase!=='challenger'&&S.phase!=='ewc'&&S.phase!=='annual')break;
    if(S.series){forceSeries(win);continue;}
    startCup(S);
    if(S.series){forceSeries(win);continue;}
    if(S.cup&&S.cup.matches){
      const cur=S.cup.matches[S.cup.idx];
      if(cur&&!cur.r){forceSeries(win);continue;}
      advanceCupStep(S);
      continue;
    }
    if(S.phase==='annual'&&S.annual){
      if(S.annual.stage==='groups'&&!S.annual.groupsDone){advanceAnnualStep(S);continue;}
      if(S.annual.stage==='po'&&S.annual.po){
        if(S.annual.po.final&&S.annual.po.final.r){advanceAnnualStep(S);break;}
        advanceAnnualStep(S);
        continue;
      }
    }
    break;
  }
}

installEra(null);
S = newState('UUG弱旅', '⚔️');
const tmpl = CLUB_TEMPLATES.find(c=>c.name==='常山UUG');
tmpl.players.forEach(pid=>{const def=PLAYER_POOL.find(d=>d.id===pid);if(def)S.players.push(genPlayer(def));});
S.coach={...COACH_POOL.find(c=>c.id===tmpl.coach)};
S.lineup=S.players.map(p=>p.id);
S.seedPower=teamPower(S);
initGroups(S);

// 春季赛
playLeague(false);
advanceCalendar(S);
playCups(false);
// 夏季赛
playLeague(false);
console.log('夏赛打完 leagueTeams:', S.leagueTeams.length, S.leagueTeams);
advanceCalendar(S);
console.log('夏赛后 advanceCalendar(EWC): phase=', S.phase, 'leagueTeams:', S.leagueTeams.length);
playCups(false);
console.log('EWC打完: phase=', S.phase, 'leagueTeams:', S.leagueTeams.length);
advanceCalendar(S); // 年总 setupAnnual
console.log('setupAnnual 之后: phase=', S.phase, 'leagueTeams:', S.leagueTeams.length, S.leagueTeams);
console.log('fired:', S.board && S.board.fired, 'seatLost:', S.seatLost);
`;

vm.runInContext(code, dom);
