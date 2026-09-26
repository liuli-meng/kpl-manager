const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();
const out = vm.runInContext(`
(function(){
  const R=[];
  try{
    const e=document.getElementById('pc-name'); e.value='扫描仔';
    _pcTeam=CLUB_TEMPLATES[0].name; window._pcTeams=[CLUB_TEMPLATES[0]];
    createPlayerCareer();
  }catch(e){ return 'createPlayerCareer THROW '+e.message; }
  R.push('mode='+S.mode+' season='+S.season+' phase='+S.phase+' day='+S.day+' preseason='+S.preseason+' tw='+S.transferWindow);
  R.push('team='+S.teamName+' players='+(S.players||[]).length+' me='+S.career.me);
  // 强制推进 30 次 nextDay / startMatch
  for(let i=0;i<40;i++){
    try{
      if(S.preseason){ endPreseason(S); continue; }
      if(S.phase==='r1'||S.phase==='r2'||S.phase==='r3'){
        if(S.matchIdx>=(S.schedule||[]).length){ advancePhase(S); continue; }
        startMatch();
        if(S.series){ S.seriesAuto=true; autoPlayNext(); }
        nextDay(S);
        continue;
      }
      if(S.phase==='playoff'){
        startPlayoff();
        if(S.series){ S.seriesAuto=true; autoPlayNext(); }
        nextDay(S);
        continue;
      }
      if(S.phase==='champion'||S.phase==='eliminated'){
        R.push('reached '+S.phase+' at i='+i+' season='+S.season);
        break;
      }
      nextDay(S);
    }catch(e){ R.push('THROW i='+i+' '+e.message); break; }
  }
  R.push('end season='+S.season+' phase='+S.phase+' day='+S.day);
  return R.join('\\n');
})()
`, dom);
console.log(out);
