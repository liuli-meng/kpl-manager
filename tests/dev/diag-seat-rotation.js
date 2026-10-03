const { makeDom } = require('../harness');
const vm = require('vm');
const { dom } = makeDom();
const q = (c) => vm.runInContext(c, dom);
const which = process.argv[2] || 'A';
const SCEN = {
  // A 玩家夺冠保留席（成绩最好）
  A: `(function(){ const s=newState('常山UUG','x'); initGroups(s); s.season=1;
    s.titleHistory=[{champ:s.teamName,event:'春季赛'}]; s.annualPts={'常山UUG':90,'桐乡情久':80};
    settleTempSeats(s); const f=FIXED_SEAT_TEAMS;
    return {seatLost:!!s.seatLost, tempSeats:s.tempSeats, log:(s.tempSeatLog||[])[0],
      leagueLen:(s.leagueTeams||[]).length, aiLen:AI_TEAMS.length,
      playerInLeague:(s.leagueTeams||[]).includes(s.teamName),
      playerInAI:AI_TEAMS.some(t=>t.name===s.teamName),
      aiNonFixed:AI_TEAMS.map(t=>t.name).filter(n=>!f.includes(n)).sort(),
      leagueNonFixed:(s.leagueTeams||[]).filter(n=>!f.includes(n)).sort()}; })()`,
  // B 玩家真垫底（无保护）→ 应被收回
  B: `(function(){ const s=newState('常山UUG','x'); initGroups(s); s.season=1;
    s.annualPts={'常山UUG':5,'桐乡情久':80}; settleTempSeats(s);
    return {seatLost:!!s.seatLost, tempSeats:s.tempSeats, log:(s.tempSeatLog||[])[0],
      leagueLen:(s.leagueTeams||[]).length, playerInLeague:(s.leagueTeams||[]).includes(s.teamName)}; })()`,
  // C 另一支夺冠保留 + 玩家真垫底 → 玩家仍应被收回
  C: `(function(){ const s=newState('常山UUG','x'); initGroups(s); s.season=1;
    s.titleHistory=[{champ:'桐乡情久',event:'春季赛'}]; s.annualPts={'常山UUG':5,'桐乡情久':80};
    settleTempSeats(s);
    return {seatLost:!!s.seatLost, tempSeats:s.tempSeats, tempSeatFixed:s.tempSeatFixed,
      log:(s.tempSeatLog||[])[0], leagueLen:(s.leagueTeams||[]).length}; })()`,
  D: `(function(){ const o={}; [2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026].forEach(y=>{o[y]=teamsAtYear(y).length;}); return o; })()`
};
console.log(which, JSON.stringify(q(SCEN[which]), null, 1));
