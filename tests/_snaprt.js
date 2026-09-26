const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();
const out = vm.runInContext(`
(function(){
  const R=[];
  const e=document.getElementById('new-team-name'); e.value='扫描队';
  createTeam();
  const before={season:S.season,phase:S.phase,day:S.day,fund:S.fund,n:S.players.length};
  const snap=serializeForSave(S);
  S=JSON.parse(snap);
  try{migrateSave();}catch(e){R.push('migrateThrow '+e.message);}
  const after={season:S.season,phase:S.phase,day:S.day,fund:S.fund,n:S.players.length};
  R.push('before '+JSON.stringify(before));
  R.push('after  '+JSON.stringify(after));
  // 再推进一步
  try{ uiEndPreseason(S); }catch(e){ R.push('endPre '+e.message); }
  R.push('afterEndPre season='+S.season+' phase='+S.phase+' pre='+S.preseason+' tw='+S.transferWindow);
  return R.join('\\n');
})()
`, dom);
console.log(out);
