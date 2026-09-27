const { launch, clearAndStart, shot } = require('../tests/playthrough/pw.js');
(async () => {
  const { browser, page } = await launch({ viewport: { width: 390, height: 844 } });
  await clearAndStart(page);
  await page.evaluate(() => {
    document.getElementById('new-team-name').value = '封顶回归';
    createTeam();
    S.fund = 1315000;
    S.lineup = S.players.slice(0, 5).map(p => p.id);
    initDraft(S, true);
    goPage('market');
  });
  const r = await page.evaluate(() => {
    const toasts = [];
    const o = window.toast;
    window.toast = m => { toasts.push(String(m)); try { o(m); } catch (_) {} };
    let raises = 0, picked = null;
    for (let i = 0; i < 40; i++) {
      if (S.draft.done) break;
      if (S.draft.phase === 'pick') {
        const wrap = document.querySelector('#page-market [onclick*="draftPick"]');
        if (wrap) {
          const before = S.players.length;
          wrap.click();
          picked = {
            before,
            after: S.players.length,
            name: S.players[S.players.length - 1] && S.players[S.players.length - 1].name,
            toast: (document.querySelector('#toast') || {}).textContent
          };
          break;
        }
        if (S.draft.pool[0]) draftPick(S, S.draft.pool[0].id);
        picked = { method: 'direct', after: S.players.length };
        break;
      }
      const max = draftTeamMaxBid(S, S.teamName, S.draft.slot);
      const need = S.draft.leader ? S.draft.bid + 10 : S.draft.bid;
      if (need > max) { draftBidPass(S); continue; }
      draftBidRaise(S);
      raises++;
    }
    window.toast = o;
    return {
      raises, picked, toasts: toasts.slice(-8),
      phase: S.draft.phase, slot: S.draft.slot, pool: S.draft.pool.length,
      picks: S.draft.picks.filter(x => x.playerId).length,
      fund: S.fund, roster: S.players.length,
      hint: [...document.querySelectorAll('#page-market .hint')].map(h => h.textContent).filter(t => /签位预算|叫价|点名|封顶/.test(t)).slice(0, 5)
    };
  });
  console.log(JSON.stringify(r, null, 2));
  await shot(page, 'fixed-draft-picked');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
