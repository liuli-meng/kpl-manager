// 门禁：不强制胜负的多赛季自然模拟门禁（验证自然胜负下长程演进、AI与青训同源上探、席位与资金不变量）
const vm = require('vm');
const { makeDom, injectHelpers, makeTester } = require('./harness');

const T = makeTester('多赛季自然演化门禁');
const { dom } = makeDom();
injectHelpers(dom);

// 固定种子确保 CI 确定性
vm.runInContext('this.Math=(function(a){var f=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};var M=Object.create(Math);M.random=f;return M;})(424243)', dom);

const HEADLESS = `
function playNaturalLeague(){
  let g = 0;
  while(!['champion','eliminated'].includes(S.phase) && g++ < 500){
    if(S.preseason){ endPreseason(S); if(S.preseason){ S.preseason=false; S.transferWindow=0; } }
    if(S.phase==='r1' || S.phase==='r2' || S.phase==='r3'){
      if(S.matchIdx >= (S.schedule||[]).length){ advancePhase(S); continue; }
      startMatch();
      if(!S.series){ continue; }
      S.seriesAuto = true;
      autoPlayNext();
      nextDay(S);
    }else if(S.phase==='card'){
      if(S.card && S.card.idx < S.card.matches.length){
        startCard();
        if(S.series){ S.seriesAuto = true; autoPlayNext(); }
        nextDay(S);
      }else break;
    }else if(S.phase==='playoff'){
      if(S.playoff && S.playoff.final && !S.playoff.final.r){
        startPlayoff();
        if(S.series){ S.seriesAuto = true; autoPlayNext(); }
        nextDay(S);
      }else break;
    }else break;
  }
}
function playNaturalCups(){
  let g = 0;
  while(g++ < 200){
    if(S.phase==='asiad'){
      let a=0;
      while(S.phase==='asiad' && !(S.ag&&S.ag.champ) && a++<30) asiadStep(S);
      continue;
    }
    if(S.phase==='challenger' || S.phase==='ewc' || S.phase==='annual'){
      advanceCupStep(S);
      continue;
    }
    break;
  }
}
function runNaturalMultiSeason(totalSeasons){
  S = newState('多赛季自然演进队', '⚔️');
  fillRoster(S, 'mid', 'star');
  S.coach = {...COACH_POOL.find(c=>c.id==='co12')};
  S.lineup = S.players.map(p=>p.id);
  S.seedPower = teamPower(S);
  initGroups(S);
  S.preseason = false; S.transferWindow = 0;

  const records = [];
  const minFunds = [];

  for(let sn=1; sn<=totalSeasons; sn++){
    // 赛季内正常推演
    playNaturalLeague();
    playNaturalCups();
    minFunds.push(S.fund);

    // 记录本赛季底子与联盟结构
    const usedNames = new Set(S.players.map(p=>p.name));
    const star = genStarDef(S, usedNames, 'mid');
    const acad = genAcademyDef('mid', usedNames, S.season);
    const starAvg = star.base.reduce((a,b)=>a+b,0)/star.base.length;
    const acadAvg = acad.base.reduce((a,b)=>a+b,0)/acad.base.length;

    records.push({
      season: S.season,
      fund: S.fund,
      teamPower: teamPower(S),
      leagueCount: (S.leagueTeams||[]).length,
      fixedCount: (FIXED_SEAT_TEAMS||[]).length,
      tempCount: (S.tempSeats||[]).length,
      starAvg,
      acadAvg
    });

    if(sn < totalSeasons){
      // 推进至下一赛季
      if(typeof newSeason === 'function') newSeason(S);
      else { S.season++; S.phase = 'r1'; }
    }
  }

  return { records, minFunds };
}
`;

const res = JSON.parse(vm.runInContext(HEADLESS + 'JSON.stringify(runNaturalMultiSeason(6))', dom));
const { records, minFunds } = res;

T.check(records.length === 6, '必须成功自然推演 6 个赛季：实跑 ' + records.length);
T.check(records.every(r => r.leagueCount === 18), '每个赛季联盟必须维持 18 支战队：实测 ' + records.map(r=>r.leagueCount).join(','));
T.check(records.every(r => r.tempCount === 2), '每个赛季临时席位必须恒为 2 支：实测 ' + records.map(r=>r.tempCount).join(','));
T.check(minFunds.every(f => typeof f === 'number' && isFinite(f) && f >= 0), '全赛季资金不变量成立（永不持久为负数）：' + minFunds.join(','));

// 验证 AI 同源发展模型：S5/S6 新生代底子必须高于 S1/S2（随时代自然上探，不硬触顶）
const s1 = records[0], s6 = records[5];
T.check(s6.starAvg > s1.starAvg, 'S6 新星底子必须随时代演化上探（S6:' + s6.starAvg.toFixed(1) + ' > S1:' + s1.starAvg.toFixed(1) + '）');
T.check(s6.acadAvg > s1.acadAvg, 'S6 青训底子必须随时代演化上探（S6:' + s6.acadAvg.toFixed(1) + ' > S1:' + s1.acadAvg.toFixed(1) + '）');

T.report();
