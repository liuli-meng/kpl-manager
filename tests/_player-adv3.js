const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();
const out = vm.runInContext(`
(function(){
  const R=[];
  const e=document.getElementById('pc-name'); e.value='扫描仔';
  _pcTeam=CLUB_TEMPLATES[0].name; window._pcTeams=[CLUB_TEMPLATES[0]];
  createPlayerCareer();
  const s0=S.season;
  for(let i=0;i<120;i++){
    try{
      if(S.season-s0>=1){ R.push('DONE season='+S.season+' phase='+S.phase); break; }
      if(S.phase==='champion'||S.phase==='eliminated'){
        try{ if(typeof newSeason==='function')newSeason(S); }catch(e){ R.push('newSeason '+e.message); }
        R.push('roll -> season='+S.season+' phase='+S.phase);
        continue;
      }
      if(S.preseason){ endPreseason(S); continue; }
      if(['r1','r2','r3','card','playoff'].includes(S.phase)){
        startPlayerMatch();
        if(S.series){ S.seriesAuto=true; autoPlayNext(); }
        nextDay(S);
        continue;
      }
      nextDay(S);
    }catch(e){ R.push('THROW i='+i+' '+e.message); break; }
  }
  R.push('end season='+S.season+' phase='+S.phase+' day='+S.day);
  return R.join('\\n');
})()
`, dom);
console.log(out);
