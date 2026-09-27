/* Edge probes: FAB dock open, low-fund bid, roster-full pick, deep dirty scan */
const { launch, clearAndStart, shot } = require('../tests/playthrough/pw.js');

(async () => {
  const { browser, page } = await launch({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console:' + m.text()); });

  await clearAndStart(page);
  await page.waitForTimeout(300);
  await page.fill('#new-team-name', '边界回归');
  await page.click('#start-modal button:has-text("创建战队")');
  await page.waitForTimeout(500);

  // A) FAB dock open then hit nav
  await page.click('#page-fab').catch(() => {});
  await page.waitForTimeout(250);
  const dockOpen = await page.evaluate(() => document.getElementById('page-dock').classList.contains('open'));
  await shot(page, 'edge-fab-dock-open');
  const hitWithDock = await page.evaluate(() => {
    const out = {};
    for (const p of ['hall', 'biz']) {
      const b = document.querySelector('#nav button[data-page="' + p + '"]');
      const r = b.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      out[p] = {
        hit: el && (el.id || el.tagName),
        isFab: !!(el && (el.id === 'page-fab' || (el.closest && el.closest('#page-fab')))),
        isNav: !!(el && (el === b || b.contains(el))),
      };
    }
    return out;
  });
  await page.click('#nav button[data-page="hall"]');
  await page.waitForTimeout(250);
  const afterHall = await page.evaluate(() => {
    const on = document.querySelector('section.page.on');
    return { on: on && on.id, dockOpen: document.getElementById('page-dock').classList.contains('open') };
  });

  // B) low fund cannot bid — still no NaN / dead UI
  await page.evaluate(() => {
    S.fund = 10;
    S.transferWindow = 3;
    S.preseason = true;
    if (!S.draft || S.draft.done) initDraft(S, true);
    goPage('market');
  });
  await page.waitForTimeout(300);
  const lowFund = await page.evaluate(() => {
    const d = S.draft;
    const btn = document.querySelector('#page-market button[onclick*="draftBidRaise"]');
    const hint = [...document.querySelectorAll('#page-market .hint')].map((h) => h.textContent).filter((t) => /上限|资金|叫价/.test(t)).slice(0, 5);
    const dirty = [];
    const root = document.querySelector('#page-market');
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const t = (n.textContent || '').trim();
      if (/undefined|NaN|\[object|Infinity|万万/.test(t)) dirty.push(t.slice(0, 80));
    }
    return { fund: S.fund, max: draftTeamMaxBid(S, S.teamName, d.slot), bid: d.bid, hasBtn: !!btn, btnText: btn && btn.textContent.trim(), hint, dirty };
  });
  const raiseOk = await page.locator('#page-market button[onclick*="draftBidRaise"]').first().click().then(() => 'clicked').catch((e) => e.message.split('\n')[0]);
  await page.waitForTimeout(250);
  const afterLowClick = await page.evaluate(() => {
    const d = S.draft;
    const t = (document.getElementById('toast') || {}).textContent || '';
    return { bid: d.bid, leader: d.leader, fund: S.fund, toast: t.slice(0, 160), phase: d.phase };
  });

  // C) roster-full then force player pick turn
  await page.evaluate(() => {
    S.fund = 200000;
    while (S.players.length < ROSTER_MAX) {
      S.players.push(genPlayer(genFreeAgentDef('mid', 'low', new Set(S.players.map((p) => p.name)))));
    }
    if (!S.draft || S.draft.done) initDraft(S, true);
    const d = S.draft;
    d.phase = 'pick';
    d.done = false;
    d.slot = 0;
    d.order = [S.teamName].concat(d.order.filter((t) => t !== S.teamName));
    goPage('market');
  });
  await page.waitForTimeout(300);
  const fullState = await page.evaluate(() => {
    const d = S.draft;
    const wrap = document.querySelector('#page-market [onclick*="draftPick"]');
    const skip = document.querySelector('#page-market button[onclick*="draftSkip"]');
    const hints = [...document.querySelectorAll('#page-market .hint')].map((h) => h.textContent).filter((t) => /满|点名|放弃/.test(t)).slice(0, 6);
    return { roster: S.players.length, max: ROSTER_MAX, hasWrap: !!wrap, hasSkip: !!skip, hints, phase: d.phase, me: d.order[d.slot] };
  });
  let fullClick;
  if (fullState.hasWrap) {
    const before = await page.evaluate(() => S.players.length);
    await page.locator('#page-market [onclick*="draftPick"]').first().click().catch(() => {});
    await page.waitForTimeout(300);
    fullClick = await page.evaluate((b) => ({
      before: b,
      after: S.players.length,
      toast: ((document.getElementById('toast') || {}).textContent || '').slice(0, 160),
      picks: S.draft.picks.length,
      slot: S.draft.slot,
    }), before);
    await shot(page, 'edge-full-pick');
  } else {
    fullClick = { noCard: true, skipBtn: fullState.hasSkip };
  }

  // D) deep dirty scan on all pages
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => {
    S.fund = 5000;
    goPage('club');
  });
  const deep = await page.evaluate(() => {
    const dirty = [];
    const pages = ['club', 'lineup', 'market', 'train', 'league', 'kjia', 'union', 'hall', 'biz'];
    for (const p of pages) {
      goPage(p);
      const root = document.getElementById('page-' + p);
      if (!root) continue;
      const html = root.innerHTML;
      const re = />([^<]{1,80})</g;
      let m;
      while ((m = re.exec(html))) {
        const t = m[1].trim();
        if (/\bundefined\b|\bNaN\b|\[object Object\]|Infinity|万万|%%|null\s*万|undefined\s*万/.test(t)) dirty.push(p + ':' + t.slice(0, 80));
      }
      root.querySelectorAll('[title],[placeholder],[aria-label]').forEach((el) => {
        [el.getAttribute('title'), el.getAttribute('placeholder'), el.getAttribute('aria-label')].filter(Boolean).forEach((v) => {
          if (/undefined|NaN|\[object/.test(v)) dirty.push(p + '@attr:' + v.slice(0, 60));
        });
      });
    }
    return [...new Set(dirty)].slice(0, 30);
  });

  // E) empty-label buttons
  const emptyBtn = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('#page-club button,#page-market button,#page-lineup button,#page-train button,#page-hall button,#page-biz button').forEach((b) => {
      const t = (b.textContent || '').trim();
      if (!t && !b.getAttribute('aria-label') && !b.getAttribute('title')) {
        bad.push(b.getAttribute('onclick') || b.outerHTML.slice(0, 80));
      }
    });
    return [...new Set(bad)].slice(0, 10);
  });

  // F) hall/biz content sanity
  const content = await page.evaluate(() => {
    goPage('hall');
    const hallText = (document.getElementById('page-hall').innerText || '').slice(0, 200);
    goPage('biz');
    const bizText = (document.getElementById('page-biz').innerText || '').slice(0, 200);
    return { hallText, bizText };
  });

  console.log(JSON.stringify({ dockOpen, hitWithDock, afterHall, lowFund, raiseOk, afterLowClick, fullState, fullClick, deep, emptyBtn, content, errs }, null, 2));
  await shot(page, 'edge-final');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
