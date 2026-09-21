// AG超玩会 playthrough smoke: start → transfer → skip → match
const { launch, clearAndStart, shot } = require('./pw.js');

(async () => {
  const errors = [];
  const { browser, page } = await launch();
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('[console.error] ' + msg.text());
  });
  // confirm() dialogs from endPreseason / skipTransferWindow
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
    await shot(page, 'ag-01-start-modal');

    // 2) switchStartTab('club'); pickClub(0); applyClub();
    const applyResult = await page.evaluate(() => {
      switchStartTab('club');
      pickClub(0);
      applyClub();
      return {
        teamName: S && S.teamName,
        fund: S && S.fund,
        wageCap: S && S.wageCap,
        lineupLen: S && S.lineup && S.lineup.length,
        lineupNames: (S.lineup || []).map((id) => {
          const p = S.players.find((x) => x.id === id);
          return p ? p.name : '?';
        }),
        coach: S && S.coach && S.coach.name,
        preseason: S && S.preseason,
        transferWindow: S && S.transferWindow,
        phase: S && S.phase,
        groups: S && S.groups && Object.keys(S.groups),
        marketLen: S && S.transferList && S.transferList.length,
        scheduleLen: S && S.schedule && S.schedule.length,
        modalOff: !document.getElementById('start-modal').classList.contains('on'),
      };
    });
    console.log('APPLY_CLUB', JSON.stringify(applyResult, null, 2));
    await page.waitForTimeout(500);
    await shot(page, 'ag-02-market-preseason');

    // 3) lineup + league pages
    await page.evaluate(() => goPage('lineup'));
    await page.waitForTimeout(400);
    await shot(page, 'ag-03-lineup');
    await page.evaluate(() => goPage('league'));
    await page.waitForTimeout(400);
    await shot(page, 'ag-04-league');

    const leagueInfo = await page.evaluate(() => {
      const g = S.groups || {};
      const groupKeys = Object.keys(g);
      const groupCounts = {};
      groupKeys.forEach((k) => {
        groupCounts[k] = (g[k] || []).length;
      });
      // also check standings DOM
      const pageLeague = document.getElementById('page-league');
      const text = pageLeague ? pageLeague.innerText.slice(0, 400) : '';
      return {
        groupKeys,
        groupCounts,
        hasS: !!g.S,
        hasA: !!g.A,
        hasB: !!g.B,
        allGrouped:
          groupKeys.length > 0 &&
          groupKeys.reduce((n, k) => n + (g[k] || []).length, 0) >= 18,
        leagueTextSample: text.replace(/\n+/g, ' | ').slice(0, 300),
      };
    });
    console.log('LEAGUE_INFO', JSON.stringify(leagueInfo, null, 2));

    // 4) skip transfer / start season
    const skipProbe = await page.evaluate(() => {
      return {
        hasUiSkipTransfer: typeof uiSkipTransfer,
        hasSkipTransferWindow: typeof skipTransferWindow,
        hasEndPreseason: typeof endPreseason,
        hasStartMatch: typeof startMatch,
        hasShowPreMatch: typeof showPreMatch,
      };
    });
    console.log('SKIP_PROBE', JSON.stringify(skipProbe));

    // Try uiSkipTransfer (uses confirm → dialog handler accepts)
    await page.evaluate(() => goPage('market'));
    await page.waitForTimeout(300);
    // Capture button texts on market page before skip
    const marketBtns = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#page-market button')).map(
        (b) => b.textContent.trim().replace(/\s+/g, ' ').slice(0, 60)
      );
    });
    console.log('MARKET_BTNS', JSON.stringify(marketBtns, null, 2));

    const skipResult = await page.evaluate(() => {
      const before = { preseason: S.preseason, tw: S.transferWindow };
      try {
        uiSkipTransfer(S);
      } catch (e) {
        return { before, error: String(e) };
      }
      return {
        before,
        after: {
          preseason: S.preseason,
          tw: S.transferWindow,
          phase: S.phase,
          matchIdx: S.matchIdx,
          scheduleLen: S.schedule && S.schedule.length,
          lineupLen: S.lineup && S.lineup.length,
        },
      };
    });
    console.log('SKIP_RESULT', JSON.stringify(skipResult, null, 2));
    await page.waitForTimeout(800);
    await shot(page, 'ag-05-after-skip');

    // 5) club page next-match panel
    await page.evaluate(() => goPage('club'));
    await page.waitForTimeout(500);
    await shot(page, 'ag-06-club-after-season');

    const clubInfo = await page.evaluate(() => {
      const club = document.getElementById('page-club');
      const text = club ? club.innerText.replace(/\n+/g, ' | ').slice(0, 500) : '';
      const next = S.schedule && S.schedule[S.matchIdx];
      return {
        text,
        nextMatch: next
          ? { opp: next.opp, round: next.round, stage: next.stage }
          : null,
        preseason: S.preseason,
        phase: S.phase,
      };
    });
    console.log('CLUB_INFO', JSON.stringify(clubInfo, null, 2));

    // 6) startMatch → prematch panel
    const matchResult = await page.evaluate(() => {
      try {
        startMatch();
        return {
          ok: true,
          hasSeries: !!S.series,
          seriesStage: S.series && S.series.stage,
          mw: S.series && S.series.mw,
          ow: S.series && S.series.ow,
          preMatchTitle: window._prepTitle || null,
          modalOn:
            document.getElementById('match-modal')
              ? document.getElementById('match-modal').classList.contains('on')
              : null,
          preMatchBodySample: (function () {
            const m =
              document.getElementById('pre-match') ||
              document.getElementById('prep-modal') ||
              document.getElementById('match-modal');
            return m ? m.innerText.replace(/\n+/g, ' | ').slice(0, 200) : null;
          })(),
        };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    });
    console.log('START_MATCH', JSON.stringify(matchResult, null, 2));
    await page.waitForTimeout(600);
    await shot(page, 'ag-07-prematch');

    // Detect which modal is open
    const modals = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.modal.on')).map((m) => m.id);
    });
    console.log('OPEN_MODALS', JSON.stringify(modals));

    console.log('CONSOLE_ERRORS', JSON.stringify(errors, null, 2));
  } catch (e) {
    console.error('SCRIPT_FAIL', e);
  } finally {
    await browser.close();
  }
})();
