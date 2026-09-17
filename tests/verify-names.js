// 名字生成回归：池尽不产占位名 / 自建开局阵容不再恒定 / 时代安装仍确定性
// 背景：ACADEMY_NAMES 只有 36 个（ERA_GEN_NAMES 48 个），四个生成器各自「自增序号兜底」，
//   池尽后玩家会看到「新人47」「新星12」「青训3」这类占位名：
//     genFreeAgentDef（players.js）· genStarDef / genAcademyDef（transfer.js）· genEraDef（data.js）
//   统一改为 combName()：两字组合(20×20) → 三字组合，且固定顺序扫描不引入随机
//   ——genEraDef 要求"重复安装产出完全相同的 def"，随机化会破坏该不变量，故扫描必须确定性。
// 运行：node tests/verify-names.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const log=t=>res.push('[PASS] '+t);
  const PLACE=/^(新人|新援|新星|青训|选手)\\d+$/;

  S=newState('探针队','x');
  // ① 池尽兜底：把 36 个学院名全部占满，各生成器都不该吐占位名
  const full=new Set(ACADEMY_NAMES);
  PLAYER_POOL.forEach(d=>full.add(d.name));
  const got={
    genFreeAgentDef:genFreeAgentDef('mid','mid',full).name,
    genStarDef:genStarDef(S,full).name,
    genAcademyDef:genAcademyDef('mid',full,1).name,
    genAiRookieDef:genAiRookieDef(S,'重庆狼队').name,
    genEraDef:genEraDef('2017','探针队','top',new Set(ACADEMY_NAMES.concat(ERA_GEN_NAMES))).name,
  };
  const bad=Object.entries(got).filter(([k,v])=>PLACE.test(v)||!v);
  if(bad.length)fail('池尽仍产出占位名: '+JSON.stringify(bad));
  else log('① 池尽兜底：五个生成器全部产出正常名字 '+JSON.stringify(got));

  // ② combName 唯一性：配合 used 集合连续取 500 个不重复
  const u2=new Set(),names=[];
  for(let i=0;i<500;i++){const n=combName(u2);names.push(n);u2.add(n);}
  const dup=names.length-new Set(names).size;
  if(dup)fail('combName 重复 '+dup+' 个');
  else log('② combName 唯一性：500 次无重复（两字 400 + 三字组合）');
  if(names.some(n=>!n||n.length<2))fail('combName 产出空名/过短名');
  else log('② combName 产出长度合法（2~3 字）');

  // ③ 自建开局：阵容名字不再恒定（原为固定 弈秋/观澜/听松/照夜/惊蛰）
  const rosters=[];
  document.querySelector('#new-team-name').value='探针队';
  for(let k=0;k<6;k++){
    createTeam();
    const ns=S.players.map(p=>p.name);
    if(new Set(ns).size!==ns.length)fail('第'+(k+1)+'次自建开局队内重名: '+ns.join('/'));
    if(ns.some(n=>PLACE.test(n)))fail('第'+(k+1)+'次自建开局含占位名: '+ns.join('/'));
    rosters.push(ns.join('/'));
  }
  const uniq=new Set(rosters);
  if(uniq.size<2)fail('自建开局阵容名字恒定不变: '+rosters[0]);
  else log('③ 自建开局 6 次得 '+uniq.size+' 种不同阵容（旧版恒为「弈秋/观澜/听松/照夜/惊蛰」）');

  // ④ 时代安装确定性：重复安装必须产出完全相同的 def（name/base 都不能漂）
  const snap=()=>{const m={};PLAYER_POOL.forEach(d=>{m[d.id]=d.name+'|'+d.base.join(',');});return m;};
  installEra('2017');const a=snap();
  installEra(null);installEra('2017');const b=snap();
  const ids=Object.keys(a);
  if(ids.length!==Object.keys(b).length)fail('重复安装时代 def 数量不一致');
  const drift=ids.filter(id=>a[id]!==b[id]);
  if(drift.length)fail('时代 def 不确定（重装后漂移）: '+drift.slice(0,3).join(','));
  else log('④ 时代安装确定性：'+ids.length+' 个 def 重装后 name/base 完全一致');

  // ⑤ 时代联盟无重名、无占位名
  const allNames=[];Object.keys(AI_ROSTERS).forEach(tn=>(AI_ROSTERS[tn].p||[]).forEach(pid=>{const d=PLAYER_POOL.find(x=>x.id===pid);if(d)allNames.push(d.name);}));
  const dupN=allNames.length-new Set(allNames).size;
  if(dupN)fail('时代联盟重名 '+dupN+' 例');
  else if(allNames.some(n=>PLACE.test(n)))fail('时代联盟含占位名');
  else log('⑤ 时代联盟 '+allNames.length+' 人无重名、无占位名');

  // ⑥ 挑战者杯（14 队 ×5=70 人，名字池只有 41）：旧写法 CHALLENGER_NAMES[i%len] + 序号兜底，
  //    每届固定产出「挑战者42…70」共 29 个占位名——本条回归专防它回来
  S=newState('探针队','x');S.extraDefs=[];
  const chNames=[];let ni=0;
  CHALLENGER_TEAMS.forEach(([tn,band])=>{for(let k=0;k<5;k++){const d=genChallengerDef(S,ni++,tn,band);S.extraDefs.push(d);chNames.push(d.name);}});
  const chPlace=chNames.filter(n=>PLACE.test(n));
  const chDup=chNames.length-new Set(chNames).size;
  if(chNames.length!==CHALLENGER_TEAMS.length*5)fail('挑战者生成人数异常: '+chNames.length);
  else if(chPlace.length)fail('挑战者含占位名 '+chPlace.length+' 个: '+chPlace.slice(0,3).join('/'));
  else if(chDup)fail('挑战者重名 '+chDup+' 例（应 70 人全不同）');
  else log('⑥ 挑战者杯 '+chNames.length+' 人（池仅 '+CHALLENGER_NAMES.length+'）无占位名、无重名');

  installEra(null);
  if(hadFail)throw new Error(res.filter(r=>r.indexOf('FAIL')>=0).join(' ; ')||'未通过');
  return res.join('\\n');
})()
`, dom);

console.log(out);
