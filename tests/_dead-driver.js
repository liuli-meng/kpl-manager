const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();
const out = vm.runInContext(`
(function(){
  const R=[];
  try{
    const e=document.getElementById('new-team-name'); e.value='扫描队';
    createTeam();
    R.push('start ok mode='+S.mode+' season='+S.season+' phase='+S.phase+' day='+S.day+' pre='+S.preseason);
  }catch(e){ return 'START THROW '+e.stack; }
  for(let i=0;i<25;i++){
    try{
      renderAll();
      const html=(document.getElementById('page-club')||{}).innerHTML||'';
      const onclicks=(html.match(/onclick="([^"]+)"/g)||[]).map(x=>x.slice(8,-1));
      const adv=onclicks.filter(c=>/uiNextDay|uiDoNextAction|uiStartMatch|uiEndPreseason|uiSkipTransfer|startCard|startPlayoff|uiFinishAnnual|closeMatchContinue|openBP|playGame|bpConfirm/.test(c));
      R.push(i+' phase='+S.phase+' day='+S.day+' advN='+adv.length+' sample='+JSON.stringify(adv.slice(0,4)));
      if(!adv.length){ R.push('NO ADV. onclicks='+JSON.stringify(onclicks.slice(0,15))); break; }
      let moved=false, used='';
      for(const c of adv){
        const b=S.day+':'+S.phase+':'+S.matchIdx+':'+(S.series?1:0);
        try{ vm.runInContext('try{'+c+'}catch(e){toast(String(e&&e.message||e))}', dom); }catch(e){}
        const a=S.day+':'+S.phase+':'+S.matchIdx+':'+(S.series?1:0);
        if(a!==b){moved=true;used=c;break;}
      }
      if(!moved){ R.push('all adv no-op'); break; }
      R.push('  moved via '+used);
    }catch(e){ R.push('THROW '+e.message); break; }
  }
  R.push('end season='+S.season+' phase='+S.phase+' day='+S.day+' idx='+S.matchIdx);
  return R.join('\\n');
})()
`, dom);
console.log(out);
