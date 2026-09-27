// 时代赛制：2017 档必须关掉全局 BP（真实 2019 才引入），现役默认开启
const fs = require('fs');
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const ok=t=>res.push('[PASS] '+t);
  const _ra=renderAll,_sv=save;renderAll=function(){};save=function(){};

  installEra('2017');
  const s1=newState('2017队','x');
  const f1=fmtOf(s1);
  installEra(null);
  const s2=newState('现役队','x');
  const f2=fmtOf(s2);

  if(f1.globalBp!==false)fail('① 2017 档 globalBp='+f1.globalBp+'，应为 false');
  else ok('① 2017 档关闭全局 BP（每局独立 BAN/PICK）');
  if(f2.globalBp!==true)fail('② 还原现役 globalBp='+f2.globalBp+'，应为 true');
  else ok('② 现役默认开启全局 BP');

  installEra('2019');
  const s3=newState('2019队','x');
  const f3=fmtOf(s3);
  installEra(null);
  if(f3.globalBp!==true)fail('③ 2019 档 globalBp='+f3.globalBp+'，应为 true');
  else ok('③ 2019 档开启全局 BP（引入年）');

  renderAll=_ra;save=_sv;
  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; '));
  return res.join('\\n');
})()
`, dom);

console.log(out);

// ④ 静态：match.js 峰值门槛不得写死 max>=7
const mj = fs.readFileSync('src/js/match.js', 'utf8');
const hard = mj.split(/\r?\n/).filter(l => /max>=7/.test(l));
if (hard.length) {
  console.error('[FAIL] ④ match.js 仍有写死 max>=7：' + hard.map(l => l.trim().slice(0, 60)).join(' | '));
  process.exitCode = 1;
} else {
  console.log('[PASS] ④ 巅峰对决门槛走 fmtOf(S).peakBoMin，无写死 max>=7');
}
