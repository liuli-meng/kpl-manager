// 视觉抽查：联赛积分榜（名次徽章）+ 赛果比分台 + 赛程 VS
const { launch, clearAndStart, shot, call } = require('../tests/playthrough/pw.js');

function fillRosterInGame() {
  return `
    const used=new Set();
    POS_ORDER.forEach((pos,i)=>S.players.push(genPlayer(genFreeAgentDef(pos,'mid',used))));
    S.lineup=S.players.map(p=>p.id);
    S.coach={...COACH_POOL.find(c=>c.id==='co12')};
  `;
}

(async () => {
  const { browser, page } = await launch({ viewport: { width: 1280, height: 900 } });
  await clearAndStart(page);

  await call(page, `
    try{
      localStorage.clear();
      S=newState('视觉抽查队','焰');
      ${fillRosterInGame()}
      S.seedPower=400;
      S.fund=8000;S.wageCap=2000;
      initGroups(S);
      S.tables=S.tables||{};
      ['G1','G2','G3'].forEach(g=>{
        S.tables[g]={};
        (S.groups[g]||[]).forEach((t,i)=>{S.tables[g][t]={w:6-i,l:i,pts:6-i,pw:10-i*2};});
      });
      S.annualPts=S.annualPts||{};
      S.leagueTeams=[].concat(S.groups.G1||[],S.groups.G2||[],S.groups.G3||[]);
      S.leagueTeams.forEach((t,i)=>{S.annualPts[t]=Math.max(0,120-i*8);});
      S.matchIdx=0;
      S.schedule=[
        {opp:'重庆狼队',r:'W',myScore:3,opScore:1,result:'W',mid:'reg_r1_0'},
        {opp:'武汉eStarPro',r:null,myScore:null,opScore:null,result:null,mid:'reg_r1_1'}
      ];
      S.phase='r1';S.stage='regular';S.day=12;S.season=1;
      goPage('league');
      renderAll();
      save();
      return 'ok';
    }catch(e){return String(e&&e.stack||e)}
  `);

  await page.waitForTimeout(400);
  await shot(page, 'visual-league-rank');
  await call(page, `goPage('league');renderAll();`);
  await page.waitForTimeout(200);
  await shot(page, 'visual-league-full');

  await call(page, `goPage('club');renderAll();`);
  await page.waitForTimeout(200);
  await shot(page, 'visual-club');

  const rb = await call(page, `
    try{
      const r={win:true,logs:['第1局 我方 10-4 击败 重庆狼队 ｜ MVP：弈秋（8/1/9）','第2局 我方 9-7 击败 重庆狼队'],opName:'重庆狼队',stageTxt:'常规赛·第一轮',score:'3:1',mvps:['弈秋（8/1/9）']};
      showMatchModal(r,'视觉抽查队 vs 重庆狼队');
      const band=document.querySelector('.result-band');
      return {has:!!band, cls:band?band.className:'', text:band?band.innerText.slice(0,80):''};
    }catch(e){return String(e&&e.stack||e)}
  `);
  console.log('result-band DOM:', JSON.stringify(rb));
  await page.waitForTimeout(300);
  await shot(page, 'visual-match-result');

  await browser.close();
  console.log('DONE visual shots');
})().catch(e => { console.error(e); process.exit(1); });
