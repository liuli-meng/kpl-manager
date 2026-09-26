const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();
const out = vm.runInContext(`
(function(){
  const R=[];
  const e=document.getElementById('pc-name'); e.value='扫描仔';
  _pcTeam=CLUB_TEMPLATES[0].name; window._pcTeams=[CLUB_TEMPLATES[0]];
  createPlayerCareer();
  R.push('sched='+(S.schedule||[]).length+' matchIdx='+S.matchIdx+' phase='+S.phase);
  for(let i=0;i<15;i++){
    try{
      const before=S.matchIdx+'/'+S.phase+'/'+S.day;
      if(S.matchIdx>=(S.schedule||[]).length){ advancePhase(S); }
      else {
        startMatch();
        R.push('startMatch series='+!!S.series+' idx='+S.matchIdx+' phase='+S.phase);
        if(S.series){ S.seriesAuto=true; autoPlayNext(); }
      }
      nextDay(S);
      R.push(i+': '+before+' -> '+S.matchIdx+'/'+S.phase+'/'+S.day+' series='+(S.series?'y':'n'));
    }catch(e){ R.push('THROW '+e.message); break; }
  }
  return R.join('\\n');
})()
`, dom);
console.log(out);
