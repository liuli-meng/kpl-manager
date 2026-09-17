// Coach career playthrough: start modal → switchStartTab('coach') → pickCoachClub → applyCoachClub → verify nav/pages
const { launch, clearAndStart, shot } = require('./pw.js');

(async () => {
  const errors = [];
  const findings = [];
  const { browser, page } = await launch();
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('[console.error] ' + msg.text());
  });
  page.on('dialog', async (d) => {
    console.log('[dialog]', d.type(), d.message().slice(0, 120));
    await d.accept();
  });

  try {
    // 1) clear localStorage + reload, wait start modal
    await clearAndStart(page);
    await page.waitForTimeout(600);
    const startVisible = await page.evaluate(() => {
      const m = document.getElementById('start-modal');
      return !!(m && m.classList.contains('on'));
    });
    console.log('start modal visible:', startVisible);
    await shot(page, 'coach-01-start-modal');

    // 2) switchStartTab('coach'); inspect coach card; pick club
    const tabInfo = await page.evaluate(() => {
      switchStartTab('coach');
      const grid = document.getElementById('coach-clubs');
      const cards = grid ? [...grid.children].map((c) => ({
        ci: c.getAttribute('data-ci'),
        onclick: c.getAttribute('onclick'),
        text: (c.innerText || '').replace(/\s+/g, ' ').slice(0, 80),
      })) : [];
      const btn = document.getElementById('coach-apply-btn');
      const firstCardHTML = (grid && grid.children[0]) ? grid.children[0].outerHTML.slice(0, 300) : '';
      return {
        tabCoachVisible: !!document.getElementById('tab-coach-body') &&
          document.getElementById('tab-coach-body').style.display !== 'none',
        cardCount: cards.length,
        cards: cards.slice(0, 4),
        firstCardUsesPickCoachClub: firstCardHTML.includes('pickCoachClub'),
        applyBtnDisabled: btn ? btn.disabled : null,
        applyBtnText: btn ? btn.innerText : null,
        hasMarketTab: !!document.getElementById('tab-market'),
        hasBizTab: !!document.getElementById('tab-biz'),
      };
    });
    console.log('TAB_INFO', JSON.stringify(tabInfo, null, 2));
    await shot(page, 'coach-02-coach-tab');

    // pick club 0 via real onclick path, then apply
    const applyResult = await page.evaluate(() => {
      pickCoachClub(0);
      const btn = document.getElementById('coach-apply-btn');
      const afterPick = {
        tip: (document.getElementById('coach-pick-tip') || {}).textContent,
        applyBtnDisabled: btn ? btn.disabled : null,
      };
      applyCoachClub();
      const navBtns = [...document.querySelectorAll('#nav button')].map((b) => ({
        page: b.dataset.page,
        display: b.style.display,
        text: b.innerText.trim(),
        visible: b.style.display !== 'none',
      }));
      return {
        afterPick,
        mode: S && S.mode,
        teamName: S && S.teamName,
        fund: S && S.fund,
        wageCap: S && S.wageCap,
        lineupLen: S && S.lineup && S.lineup.length,
        lineupNames: (S.lineup || []).map((id) => {
          const p = S.players.find((x) => x.id === id);
          return p ? p.name : '?';
        }),
        coach: S && S.coach && S.coach.name,
        coachDeal: S && S.coachDeal,
        preseason: S && S.preseason,
        transferWindow: S && S.transferWindow,
        phase: S && S.phase,
        era: S && S.era,
        eventLogHead: (S && S.eventLog ? S.eventLog.slice(0, 3).map((e) => e.text || e) : null),
        modalOff: !document.getElementById('start-modal').classList.contains('on'),
        navBtns,
        navVisiblePages: navBtns.filter((b) => b.visible).map((b) => b.page),
        navHiddenPages: navBtns.filter((b) => !b.visible).map((b) => b.page),
        marketBtnExists: !!document.querySelector('#nav button[data-page="market"]'),
        marketBtnVisible: (() => {
          const b = document.querySelector('#nav button[data-page="market"]');
          return b ? b.style.display !== 'none' : null;
        })(),
        bizBtnVisible: (() => {
          const b = document.querySelector('#nav button[data-page="biz"]');
          return b ? b.style.display !== 'none' : null;
        })(),
        currentPage: (document.querySelector('nav button.on') || {}).dataset?.page,
        currentSectionOn: [...document.querySelectorAll('section.page.on')].map((p) => p.id),
      };
    });
    console.log('APPLY_COACH', JSON.stringify(applyResult, null, 2));
    await page.waitForTimeout(500);
    await shot(page, 'coach-03-club-after-apply');

    // Verify S.mode and coachDeal programmatically
    const verify = await page.evaluate(() => {
      const expected = MODE_PAGES.coach || [];
      const navVisible = [...document.querySelectorAll('#nav button')]
        .filter((b) => b.style.display !== 'none')
        .map((b) => b.dataset.page);
      const marketSection = document.getElementById('page-market');
      const marketNav = document.querySelector('#nav button[data-page="market"]');
      // try goPage('market') — should ideally be blocked or empty for coach
      let marketGo = null;
      try {
        goPage('market');
        marketGo = {
          currentAfter: (document.querySelector('nav button.on') || {}).dataset?.page,
          sectionOn: [...document.querySelectorAll('section.page.on')].map((p) => p.id),
          marketHasContent: marketSection ? (marketSection.innerHTML || '').length > 200 : false,
        };
      } catch (e) {
        marketGo = { error: e.message };
      }
      // restore club
      try { goPage('club'); } catch (e) {}
      return {
        modeOk: S && S.mode === 'coach',
        coachDealOk: !!(S && S.coachDeal && Array.isArray(S.coachDeal.honors) && Array.isArray(S.coachDeal.log) && S.coachDeal.years >= 1),
        coachDeal: S && S.coachDeal,
        expectedPages: expected,
        navMatchesExpected: JSON.stringify(navVisible.sort()) === JSON.stringify(expected.slice().sort()),
        navVisible,
        marketNavAbsentOrHidden: !marketNav || marketNav.style.display === 'none',
        bizNavAbsentOrHidden: !document.querySelector('#nav button[data-page="biz"]') ||
          document.querySelector('#nav button[data-page="biz"]').style.display === 'none',
        transferAutoNote: {
          transferWindow: S && S.transferWindow,
          preseason: S && S.preseason,
          eventLog: (S && S.eventLog ? S.eventLog.slice(0, 5).map((e) => (e && (e.text || e.note)) || String(e)) : null),
        },
        marketGo,
      };
    });
    console.log('VERIFY', JSON.stringify(verify, null, 2));

    // 4) screenshots: club, lineup, train, league
    await page.evaluate(() => goPage('club'));
    await page.waitForTimeout(400);
    await shot(page, 'coach-04-club');

    await page.evaluate(() => goPage('lineup'));
    await page.waitForTimeout(400);
    await shot(page, 'coach-05-lineup');

    await page.evaluate(() => goPage('train'));
    await page.waitForTimeout(400);
    await shot(page, 'coach-06-train');

    await page.evaluate(() => goPage('league'));
    await page.waitForTimeout(400);
    await shot(page, 'coach-07-league');

    // extra: hall (has coachDeal UI)
    await page.evaluate(() => goPage('hall'));
    await page.waitForTimeout(400);
    await shot(page, 'coach-08-hall');

    // page content sanity: does lineup/train/league render something?
    const pageRender = await page.evaluate(() => {
      const len = (id) => {
        const el = document.getElementById(id);
        return el ? (el.innerText || '').length : -1;
      };
      return {
        clubLen: len('page-club'),
        lineupLen: len('page-lineup'),
        trainLen: len('page-train'),
        leagueLen: len('page-league'),
        hallLen: len('page-hall'),
      };
    });
    console.log('PAGE_RENDER', JSON.stringify(pageRender, null, 2));

    console.log('ERRORS', JSON.stringify(errors, null, 2));
    console.log('DONE coach playthrough');
  } catch (e) {
    console.error('FATAL', e && e.stack || e);
    findings.push('FATAL: ' + (e && e.message || e));
  } finally {
    await browser.close();
  }
})();
