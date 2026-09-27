/* Confirm roster-full draft card UX: clickable sign CTA + silent pick burn */
const { launch, clearAndStart, shot } = require('../tests/playthrough/pw.js');

(async () => {
  const { browser, page } = await launch({ viewport: { width: 1280, height: 900 } });
  await clearAndStart(page);
  await page.waitForTimeout(300);
  await page.fill('#new-team-name', '满员点名');
  await page.click('#start-modal button:has-text("创建战队")');
  await page.waitForTimeout(400);

  await page.evaluate(() => {
    while (S.players.length < ROSTER_MAX) {
      S.players.push(genPlayer(genFreeAgentDef('mid', 'low', new Set(S.players.map((p) => p.name)))));
    }
    S.fund = 5000;
    if (!S.draft || S.draft.done) initDraft(S, true);
    const d = S.draft;
    d.phase = 'pick';
    d.done = false;
    d.slot = 0;
    d.order = [S.teamName].concat(d.order.filter((t) => t !== S.teamName));
    d.picks = [];
    d.log = [];
    goPage('market');
  });
  await page.waitForTimeout(350);

  const before = await page.evaluate(() => {
    const wraps = [...document.querySelectorAll('#page-market [onclick*="draftPick"]')];
    const signBtns = [...document.querySelectorAll('#page-market button')].filter((b) => /点名签约/.test(b.textContent));
    return {
      roster: S.players.length,
      max: ROSTER_MAX,
      wrapCount: wraps.length,
      signBtnCount: signBtns.length,
      firstWrapOnclick: wraps[0] && wraps[0].getAttribute('onclick'),
      firstWrapTitle: wraps[0] && wraps[0].getAttribute('title'),
      signBtnText: signBtns[0] && signBtns[0].textContent.trim(),
      signBtnOnclick: signBtns[0] && signBtns[0].getAttribute('onclick'),
      hint: [...document.querySelectorAll('#page-market .hint')].map((h) => h.textContent.trim()).filter((t) => /满|点名|放弃/.test(t)),
      log: S.draft.log.slice(-5),
    };
  });
  await shot(page, 'bug-full-roster-cards');

  // click first wrap like a user
  await page.locator('#page-market [onclick*="draftPick"]').first().click();
  await page.waitForTimeout(400);

  const after = await page.evaluate(() => {
    return {
      roster: S.players.length,
      toast: ((document.getElementById('toast') || {}).textContent || '').trim(),
      log: S.draft.log.slice(-8),
      picks: S.draft.picks.map((p) => ({ slot: p.slot, team: p.team, playerId: p.playerId })),
      phase: S.draft.phase,
      done: S.draft.done,
      slot: S.draft.slot,
    };
  });
  await shot(page, 'bug-full-roster-after-click');

  console.log(JSON.stringify({ before, after }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
