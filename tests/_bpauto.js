const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();
const out = vm.runInContext(`
(function(){
  const R=[];
  const e=document.getElementById('new-team-name'); e.value='扫描队';
  createTeam();
  uiEndPreseason(S);
  // 打一场进 BP
  startMatch();
  R.push('series='+!!S.series+' phase='+S.phase);
  if(!S.series) return R.join('\\n');
  try{ openBP('T', playGame); }catch(e){ R.push('openBP '+e.message); }
  R.push('draft='+!!window._draft+' idx='+(window._draft&&window._draft.idx)+' picks='+JSON.stringify(window._draft&&window._draft.myPicks));
  try{ const r=bpAutoAll(); R.push('bpAutoAll ret='+r); }catch(e){ R.push('bpAutoAll THROW '+e.message); }
  R.push('after series mw='+(S.series&&S.series.mw)+' ow='+(S.series&&S.series.ow)+' draft='+(window._draft?'y':'n'));
  try{ bpConfirm(); }catch(e){ R.push('bpConfirm THROW '+e.message); }
  R.push('afterConfirm series='+(S.series?S.series.mw+':'+S.series.ow:'null')+' modal='+(document.getElementById('app-modal').classList.contains('on')?'on':'off'));
  return R.join('\\n');
})()
`, dom);
console.log(out);
