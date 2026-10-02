// 史实跨年名单回归：升降级 / 更名 / 玩家本队保护
// 运行：node tests/verify-era-history.js
const vm = require('vm');
const { makeDom } = require('./harness');
const { dom } = makeDom();

const out = vm.runInContext(`
(function(){
  const res=[];let hadFail=false;
  const fail=m=>{res.push('[FAIL] '+m);hadFail=true;};
  const ok=t=>res.push('[PASS] '+t);

  if(typeof KPL_YEAR_CHANGES!=='object'||typeof applyHistoricalLeague!=='function'){
    fail('KPL_YEAR_CHANGES/applyHistoricalLeague 未导出');
    return res.join('\\n');
  }

  // ① 2017→2018：创始老班底离开、Hero/RW 进盟、AG 降级（AI 队）
  installEra('2017');
  S=newState('测试队','x');fillRoster(S,'mid','star');
  S.era='2017';S.season=1;
  const names0=AI_TEAMS.map(t=>t.name);
  if(!names0.includes('AS仙阁'))fail('2017 档应含 AS仙阁');
  else if(!names0.includes('QGhappy'))fail('2017 档应含 QGhappy');
  else{
    S.season=2; // gameYear=2018
    const notes=applyHistoricalLeague(S)||[];
    const names1=AI_TEAMS.map(t=>t.name);
    if(names1.includes('AS仙阁'))fail('2018 后 AS仙阁 应离开');
    else if(!names1.includes('南京Hero久竞'))fail('2018 应升入 Hero');
    else if(!names1.includes('济南RW侠'))fail('2018 应升入 RW侠');
    else if(names1.includes('SC'))fail('2018 创始老队 SC 应离开');
    else ok('① 2018 名单：仙阁/SC 离开 · Hero/RW 进盟（'+notes.length+' 条日志）');
  }

  // ② 玩家本队不豁免：玩家=AG（2017 档里的队名就是简名 AG超玩会）时 2018 同样降级（seatLost），
  //    2019 按史实以「成都AG超玩会」重返并解除。这里刻意**不再往 AI_TEAMS 里塞全名**：
  //    旧用例塞的是 '成都AG超玩会'，而 2017 档联盟里根本没有这个名字 —— 它刚好与当时
  //    2018 out 表里那个写错的字符串吻合，于是用例掩盖了「out 空转、幽灵队留到 2020」
  //    的真实缺陷（2020-2026 七个年档都多出一支同名队）。
  installEra('2017');
  S=newState('AG超玩会','焰');fillRoster(S,'mid','star');
  S.era='2017';S.season=1;S.teamName='AG超玩会';
  if(!AI_TEAMS.some(t=>t.name==='AG超玩会'))fail('前提：2017 档联盟应含 AG超玩会（简名）');
  else{
   S.season=2; // gameYear=2018
   applyHistoricalLeague(S);
   if(AI_TEAMS.some(t=>t.name==='AG超玩会'))fail('史实降级不应豁免玩家本队 AG');
   else if(!S.seatLost)fail('玩家 AG 史实降级应 seatLost');
   else if(S.histReturnYear!==2019)fail('玩家 AG 的回归年应识别为 2019（更名后重返，实得 '+(S.histReturnYear==null?'null':S.histReturnYear)+'）');
   else{
    S.season=3; // 2019 以「成都AG超玩会」重返
    applyHistoricalLeague(S);
    if(!AI_TEAMS.some(t=>t.name==='成都AG超玩会'))fail('2019 AG 应按史实以成都AG超玩会重返名单');
    else if(S.seatLost)fail('AG 重返后应解除 seatLost');
    else if(S.teamName!=='成都AG超玩会')fail('AG 重返后玩家队名应随更名更新（实得 '+S.teamName+'）');
    else ok('② 玩家 AG：2018 降级 seatLost · 2019 更名「成都AG超玩会」重返并解除');
   }
  }

  // ③ 2022 更名：QGhappy → 重庆狼队（AI）
  installEra('2017');
  S=newState('测试队','x');fillRoster(S,'mid','star');
  S.era='2017';S.season=1;
  S.season=6; // 2017+5=2022
  applyHistoricalLeague(S);
  // 中间年也可能改名单；只验更名结果
  const hasWolf=AI_TEAMS.some(t=>t.name==='重庆狼队');
  const hasQG=AI_TEAMS.some(t=>t.name==='QGhappy');
  if(!hasWolf&&hasQG)fail('2022 应把 QGhappy 更名为重庆狼队');
  else if(!hasWolf&&!hasQG)fail('2022 更名后两名字都不在（丢队）');
  else ok('③ 2022 更名：QGhappy→重庆狼队（现狼队='+hasWolf+' QG残留='+hasQG+'）');

  // ④ 无表年份静默：2030 不抛错
  S.season=14; // 2017+13=2030
  try{
    const n=applyHistoricalLeague(S);
    ok('④ 无表年份 2030 静默跳过（notes='+(n&&n.length)+'）');
  }catch(e){fail('④ 2030 applyHistoricalLeague 抛错: '+e.message);}

  // ⑤ 2025 新军：情久/UUG 在名单
  installEra(null);
  S=newState('测试队','x');fillRoster(S,'mid','star');
  S.era=null;S.season=1;
  // 现役起 2026，往前推到 2025 需要 era 年；直接压 season 使 gameYear=2025 不可行（无 era 从 2026 起）
  // 改为：装 2017 后把 year 推到 2025
  installEra('2017');
  S=newState('测试队','x');fillRoster(S,'mid','star');
  S.era='2017';S.season=9; // 2017+8=2025
  applyHistoricalLeague(S);
  const hasQJ=AI_TEAMS.some(t=>t.name==='桐乡情久');
  const hasUUG=AI_TEAMS.some(t=>t.name==='常山UUG');
  if(!hasQJ||!hasUUG)fail('2025 应升入 情久/UUG（qj='+hasQJ+' uug='+hasUUG+'）');
  else ok('⑤ 2025 新军：桐乡情久 / 常山UUG 已入盟');

  installEra(null); // 还原，避免污染后续用例
  return res.join('\\n')+(hadFail?'\\n[FAIL]':'\\n[PASS]');
})()
`, dom);

console.log(out);
if (String(out).includes('[FAIL]')) process.exit(1);
