const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();
const out = vm.runInContext(`
(function(){
  const R=[];
  const e=document.getElementById('new-team-name'); e.value='扫描队';
  createTeam();
  R.push('after create team='+S.teamName+' page=club? ');
  // 手动 render 各页
  const pages=['club','market','lineup','league','train','biz'];
  for(const p of pages){
    try{
      goPage(p);
      renderPage(p);
      const html=(document.getElementById('page-'+p)||{}).innerHTML||'';
      const onclicks=(html.match(/onclick="([^"]+)"/g)||[]).length;
      R.push(p+': len='+html.length+' onclicks='+onclicks+' sample='+JSON.stringify((html.match(/onclick="([^"]+)"/g)||[]).slice(0,3)));
    }catch(e){ R.push(p+' THROW '+e.message); }
  }
  return R.join('\\n');
})()
`, dom);
console.log(out);
