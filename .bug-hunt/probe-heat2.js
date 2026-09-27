const { launch, clearAndStart } = require('../tests/playthrough/pw.js');
(async () => {
  const { browser, page } = await launch();
  await clearAndStart(page);
  await page.evaluate(() => {
    document.getElementById('new-team-name').value = '热度实测';
    createTeam();
    S.fund = 8000;
    initDraft(S, true);
  });
  const r = await page.evaluate(() => {
    const s = S, d = s.draft;
    const teams = d.order.slice();
    const funds = teams.map(t => ({ t, max: draftTeamMaxBid(s, t, 0), soft: typeof draftAiBidCap === 'function' ? draftAiBidCap(s, t, 0) : null }));
    // 玩家 pass，看 AI 竞拍多少队还在场
    let raises = 0;
    for (let i = 0; i < 80 && d.phase === 'auction' && !d.done; i++) {
      if (!d.passed[s.teamName]) draftBidPass(s);
      else break;
      raises++;
      if (d.phase !== 'auction') break;
    }
    const aliveAfter = d.order.filter(t => !d.passed[t] && draftStillWant(s, t)).length;
    return {
      phase: d.phase, bid: d.bid, leader: d.leader, slot: d.slot,
      aliveAfterFirstPass: aliveAfter,
      sampleFunds: funds.slice(0, 6),
      log: (d.log || []).slice(0, 12),
      picks: d.picks.filter(x => x.playerId).length,
    };
  });
  console.log(JSON.stringify(r, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
