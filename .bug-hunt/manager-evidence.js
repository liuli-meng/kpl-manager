const fs = require('fs');
const path = require('path');
const { launch, clearAndStart, shot } = require('../tests/playthrough/pw.js');

(async () => {
  const { browser, page } = await launch({ viewport: { width: 1280, height: 900 } });
  await clearAndStart(page);
  await page.waitForTimeout(300);
  await page.fill('#new-team-name', '封顶证据');
  await page.click('#start-modal button:has-text("创建战队")');
  await page.waitForTimeout(400);

  // ① 资金充足：真实叫价 + 点名
  await page.evaluate(() => {
    S.fund = 1315000;
    if (!S.draft || S.draft.done) initDraft(S, true);
    S.draft.phase = 'auction';
    S.draft.done = false;
    S.draft.slot = 0;
    S.draft.bid = 60;
    S.draft.leader = null;
    S.draft.passed = {};
    S.draft.order = [S.teamName].concat(S.draft.order.filter((t) => t !== S.teamName));
    goPage('market');
  });
  await page.waitForTimeout(300);

  const raises = [];
  for (let i = 0; i < 25; i++) {
    const st = await page.evaluate(() => {
      const d = S.draft;
      return {
        phase: d.phase,
        mePick: d.phase === 'pick' && d.order[d.slot] === S.teamName && !d.done,
        meAuction: d.phase === 'auction' && d.order[d.slot] === S.teamName && !d.done && !d.passed[S.teamName],
        bid: d.bid,
        leader: d.leader,
        max: draftTeamMaxBid(S, S.teamName, d.slot),
        fund: S.fund,
      };
    });
    if (st.mePick) break;
    if (st.meAuction) {
      await page.locator('#page-market button[onclick*="draftBidRaise"]').first().click();
      await page.waitForTimeout(200);
      raises.push(st);
    } else {
      await page.waitForTimeout(150);
    }
  }

  const pickBefore = await page.evaluate(() => ({
    players: S.players.length,
    phase: S.draft.phase,
    wraps: document.querySelectorAll('#page-market [onclick*="draftPick"]').length,
  }));
  await shot(page, 'evi-draft-before-pick');
  await page.locator('#page-market [onclick*="draftPick"]').first().click();
  await page.waitForTimeout(350);
  const pickAfter = await page.evaluate(() => {
    const last = S.players[S.players.length - 1];
    return {
      players: S.players.length,
      lastName: last && last.name,
      toast: ((document.getElementById('toast') || {}).textContent || '').trim(),
      phase: S.draft.phase,
    };
  });
  await shot(page, 'evi-draft-after-pick');

  // ② 超上限时叫价按钮仍可点
  await page.evaluate(() => {
    S.fund = 10;
    if (!S.draft || S.draft.done) initDraft(S, true);
    S.draft.phase = 'auction';
    S.draft.done = false;
    S.draft.slot = 0;
    S.draft.bid = 60;
    S.draft.leader = null;
    S.draft.passed = {};
    S.draft.order = [S.teamName].concat(S.draft.order.filter((t) => t !== S.teamName));
    goPage('market');
  });
  await page.waitForTimeout(250);
  const overCap = await page.evaluate(() => {
    const btn = document.querySelector('#page-market button[onclick*="draftBidRaise"]');
    const max = draftTeamMaxBid(S, S.teamName, S.draft.slot);
    const next = S.draft.leader ? S.draft.bid + 10 : S.draft.bid;
    return {
      max,
      next,
      overCap: next > max,
      btnDisabled: btn ? btn.disabled : null,
      btnText: btn && btn.textContent.trim(),
      btnClass: btn && btn.className,
    };
  });
  await shot(page, 'evi-overcap-button');

  // ③ 满员可点卡
  await page.evaluate(() => {
    S.fund = 5000;
    while (S.players.length < ROSTER_MAX) {
      S.players.push(genPlayer(genFreeAgentDef('mid', 'low', new Set(S.players.map((p) => p.name)))));
    }
    if (!S.draft || S.draft.done) initDraft(S, true);
    const d = S.draft;
    d.phase = 'pick';
    d.done = false;
    d.slot = 0;
    d.picks = [];
    d.order = [S.teamName].concat(d.order.filter((t) => t !== S.teamName));
    goPage('market');
  });
  await page.waitForTimeout(250);
  const fullCards = await page.evaluate(() => {
    const wraps = [...document.querySelectorAll('#page-market [onclick*="draftPick"]')];
    return {
      roster: S.players.length,
      max: ROSTER_MAX,
      wrapCount: wraps.length,
      signBtnCount: [...document.querySelectorAll('#page-market button')].filter((b) => /点名签约/.test(b.textContent)).length,
      hint: [...document.querySelectorAll('#page-market .hint')].map((h) => h.textContent.trim()).filter((t) => /大名单已满/.test(t)),
      title: wraps[0] && wraps[0].getAttribute('title'),
      onClick: wraps[0] && wraps[0].getAttribute('onclick'),
    };
  });
  await shot(page, 'evi-full-roster-cards');
  await page.locator('#page-market [onclick*="draftPick"]').first().click();
  await page.waitForTimeout(350);
  const fullAfter = await page.evaluate(() => ({
    roster: S.players.length,
    toast: ((document.getElementById('toast') || {}).textContent || '').trim(),
    slot: S.draft.slot,
    done: S.draft.done,
    picksLen: S.draft.picks.length,
    firstPick: S.draft.picks[0],
  }));

  const evidence = {
    draftBidOk: { raises: raises.length, pickBefore, pickAfter },
    overCapButton: overCap,
    fullRosterCards: { before: fullCards, after: fullAfter },
    ts: new Date().toISOString(),
  };
  const out = path.join(__dirname, 'manager-evidence.json');
  fs.writeFileSync(out, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  console.log('WROTE', out);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
