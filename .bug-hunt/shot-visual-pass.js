// 视觉抽查：联赛积分榜（名次徽章）+ 赛果比分台 + BP 中轴
const { launch, clearAndStart, shot, call } = require('../tests/playthrough/pw.js');

(async () => {
  const { browser, page } = await launch({ viewport: { width: 1280, height: 900 } });
  await clearAndStart(page);

  // 开一局经理档并推进到有积分表的状态
  await call(page, `
    try{
      localStorage.clear();
      S=newState('视觉抽查队','焰');
      fillRoster(S,'mid');
      S.coach={...COACH_POOL.find(c=>c.id==='co12')};
      S.lineup=S.players.map(p=>p.id);
      S.seedPower=400;
      S.fund=8000;S.wageCap=2000;
      initGroups(S);
      // 造一点积分，让名次徽章可见
      ['G1','G2','G3'].forEach(g=>{
        S.tables=S.tables||{};S.tables[g]={};
        (S.groups[g]||[]).forEach((t,i)=>{
          S.tables[g][t]={w:6-i,l:i,pts:6-i,pw:10-i*2};
        });
      });
      S.annualPts=S.annualPts||{};
      S.leagueTeams=(S.groups.G1||[]).concat(S.groups.G2||[],S.groups.G3||[]);
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
    }catch(e){return String(e&&e.stack||e)}
  `);

  await page.waitForTimeout(400);
  await shot(page, 'visual-league-rank');
  await call(page, `goPage('league');renderAll();`);
  await page.waitForTimeout(200);
  await shot(page, 'visual-league-full');

  // 俱乐部页（比分台/赛程）
  await call(page, `goPage('club');renderAll();`);
  await page.waitForTimeout(200);
  await shot(page, 'visual-club');

  // 赛果弹窗：用 match modal 结构
  await call(page, `
    try{
      const r={win:true,logs:['第1局 我方 10-4 击败 重庆狼队 ｜ MVP：弈秋（8/1/9）','第2局 我方 9-7 击败 重庆狼队'],opName:'重庆狼队',stageTxt:'常规赛·第一轮',score:'3:1',mvps:['弈秋（8/1/9）']};
      showMatchModal(r,'视觉抽查队 vs 重庆狼队');
    }catch(e){return String(e&&e.stack||e)}
  `);
  await page.waitForTimeout(300);
  await shot(page, 'visual-match-result');

  await browser.close();
  console.log('DONE visual shots');
})().catch(e => { console.error(e); process.exit(1); });
