// 联赛/赛程 playtest: applyClub AG → league dump → start season → verify matches
const { launch, clearAndStart, shot } = require('./pw.js');

(async () => {
  const errors = [];
  const report = { steps: [], issues: [] };
  const { browser, page } = await launch();
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('[console.error] ' + msg.text());
  });
  page.on('dialog', async (d) => {
    console.log('[dialog]', d.type(), d.message().slice(0, 140));
    await d.accept();
  });

  try {
    // ---- 0) clear + reload ----
    await clearAndStart(page);
    await page.waitForTimeout(600);
    const startVisible = await page.evaluate(() => {
      const m = document.getElementById('start-modal');
      return !!(m && m.classList.contains('on'));
    });
    report.steps.push({ step: 'boot', startVisible });
    await shot(page, 'league-01-start');

    // ---- 1) applyClub AG超玩会 ----
    const apply = await page.evaluate(() => {
      switchStartTab('club');
      // AG is usually index 0 in CLUB_TEMPLATES; find by name if not
      let idx = 0;
      try {
        const names = (typeof CLUB_TEMPLATES !== 'undefined' ? CLUB_TEMPLATES : []).map((t) => t.name);
        const ag = names.findIndex((n) => /AG|超玩/i.test(n || ''));
        if (ag >= 0) idx = ag;
      } catch (e) {}
      pickClub(idx);
      applyClub();
      return {
        teamName: S && S.teamName,
        preseason: S && S.preseason,
        transferWindow: S && S.transferWindow,
        phase: S && S.phase,
        groups: S && S.groups && Object.keys(S.groups),
        groupCounts: S && S.groups
          ? Object.fromEntries(Object.keys(S.groups).map((k) => [k, (S.groups[k] || []).length]))
          : null,
        scheduleLen: S && S.schedule && S.schedule.length,
        lineupLen: S && S.lineup && S.lineup.length,
        modalOff: !document.getElementById('start-modal').classList.contains('on'),
      };
    });
    console.log('APPLY', JSON.stringify(apply, null, 2));
    report.steps.push({ step: 'applyClub', apply });
    if (!apply.teamName) report.issues.push('applyClub did not set teamName');
    await page.waitForTimeout(500);

    // close tour/guide if present
    await page.evaluate(() => {
      try {
        if (typeof tourSkip === 'function') tourSkip();
      } catch (e) {}
      try {
        const m = document.getElementById('app-modal');
        if (m) m.classList.remove('on');
      } catch (e) {}
    });

    // ---- 2) goPage('league') screenshot + dump ----
    await page.evaluate(() => goPage('league'));
    await page.waitForTimeout(400);
    await shot(page, 'league-02-before-start');

    const before = await page.evaluate(() => {
      const g = S.groups || {};
      const groupKeys = Object.keys(g);
      const groupStructure = {};
      groupKeys.forEach((k) => {
        groupStructure[k] = {
          count: (g[k] || []).length,
          teams: (g[k] || []).slice(),
          tableRows: Object.keys((S.tables && S.tables[k]) || {}).length,
          tableSample: Object.entries(((S.tables && S.tables[k]) || {})).slice(0, 3).map(([n, t]) => ({
            name: n,
            w: t.w,
            l: t.l,
            pts: t.pts,
            pw: t.pw,
          })),
        };
      });
      const pageEl = document.getElementById('page-league');
      const text = pageEl ? pageEl.innerText.replace(/\n+/g, ' | ').slice(0, 600) : '';
      const schedule = S.schedule || [];
      return {
        preseason: S.preseason,
        transferWindow: S.transferWindow,
        phase: S.phase,
        matchIdx: S.matchIdx,
        scheduleLen: schedule.length,
        scheduleSample: schedule.slice(0, 5).map((m) => ({
          round: m.round,
          opp: m.opp,
          result: m.result,
          myScore: m.myScore,
          opScore: m.opScore,
        })),
        aiScheduleGroups: S.aiSchedule ? Object.keys(S.aiSchedule) : [],
        aiScheduleWithResult: S.aiSchedule
          ? Object.values(S.aiSchedule).reduce(
              (n, arr) => n + (arr || []).filter((m) => m.r).length,
              0
            )
          : 0,
        groupStructure,
        leagueTextSample: text,
      };
    });
    console.log('LEAGUE_BEFORE', JSON.stringify(before, null, 2));
    report.steps.push({ step: 'league-before', before });

    // ---- 3) if season not started, start via endPreseason (evaluate) ----
    let startResult = null;
    if (before.preseason) {
      startResult = await page.evaluate(() => {
        const left = S.transferWindow;
        const hasEnd = typeof endPreseason;
        const hasSkip = typeof skipTransferWindow;
        try {
          endPreseason(S);
        } catch (e) {
          return { ok: false, left, hasEnd, hasSkip, error: String(e) };
        }
        return {
          ok: true,
          left,
          hasEnd,
          hasSkip,
          after: {
            preseason: S.preseason,
            transferWindow: S.transferWindow,
            phase: S.phase,
            matchIdx: S.matchIdx,
            scheduleLen: (S.schedule || []).length,
            scheduleSample: (S.schedule || []).slice(0, 5).map((m) => ({
              round: m.round,
              opp: m.opp,
              result: m.result,
            })),
            lineupLen: (S.lineup || []).length,
          },
        };
      });
      console.log('START_SEASON', JSON.stringify(startResult, null, 2));
      report.steps.push({ step: 'start-season', startResult });
      if (!startResult.ok) report.issues.push('endPreseason failed: ' + startResult.error);
      else if (startResult.after.preseason) report.issues.push('preseason still true after endPreseason');
    } else {
      report.steps.push({ step: 'start-season', skipped: 'season already started' });
    }
    await page.waitForTimeout(600);

    // ---- 4) league again after start ----
    await page.evaluate(() => {
      try {
        if (typeof tourSkip === 'function') tourSkip();
      } catch (e) {}
      const m = document.getElementById('app-modal');
      if (m) m.classList.remove('on');
      goPage('league');
    });
    await page.waitForTimeout(400);
    await shot(page, 'league-03-after-start');

    const after = await page.evaluate(() => {
      const g = S.groups || {};
      const groupKeys = Object.keys(g);
      const groupStructure = {};
      groupKeys.forEach((k) => {
        const table = (S.tables && S.tables[k]) || {};
        groupStructure[k] = {
          count: (g[k] || []).length,
          tableRows: Object.keys(table).length,
          tableSample: Object.entries(table).slice(0, 3).map(([n, t]) => ({
            name: n,
            w: t.w,
            l: t.l,
            pts: t.pts,
            pw: t.pw,
          })),
        };
      });
      const schedule = S.schedule || [];
      const withResult = schedule.filter((m) => m.result);
      const aiResults = S.aiSchedule
        ? Object.values(S.aiSchedule).reduce((n, arr) => n + (arr || []).filter((m) => m.r).length, 0)
        : 0;
      const pageEl = document.getElementById('page-league');
      // 注意：本队赛程面板排在页头说明与积分榜之后，700 字的窗口里根本没有它（v5.1 版式改过顺序），
      // 面板存在性必须看全文，只有"取样打印"才需要截断
      const fullText = pageEl ? pageEl.innerText.replace(/\n+/g, ' | ') : '';
      const text = fullText.slice(0, 700);
      const schedulePanel = fullText.includes('本队赛程');
      const matchEls = pageEl ? pageEl.querySelectorAll('.match').length : 0;
      return {
        preseason: S.preseason,
        phase: S.phase,
        matchIdx: S.matchIdx,
        scheduleLen: schedule.length,
        scheduleWithResult: withResult.length,
        scheduleSample: schedule.slice(0, 8).map((m) => ({
          round: m.round,
          opp: m.opp,
          result: m.result,
          myScore: m.myScore,
          opScore: m.opScore,
          isNext: m === schedule[S.matchIdx],
        })),
        aiResults,
        groupStructure,
        hasSchedulePanel: schedulePanel,
        matchDomCount: matchEls,
        leagueTextSample: text,
      };
    });
    console.log('LEAGUE_AFTER', JSON.stringify(after, null, 2));
    report.steps.push({ step: 'league-after', after });

    // sanity checks
    if (after.preseason) report.issues.push('season still preseason after start');
    if (!after.scheduleLen) report.issues.push('schedule empty after season start');
    if (!after.hasSchedulePanel) report.issues.push('league page missing 本队赛程 panel');
    if (!after.matchDomCount) report.issues.push('league page has 0 .match elements after start');

    report.errors = errors;
    report.pass =
      report.issues.length === 0 &&
      errors.length === 0 &&
      !!after.scheduleLen &&
      after.preseason === false;
    console.log('REPORT', JSON.stringify(report, null, 2));
  } catch (e) {
    report.fatal = String(e && e.stack ? e.stack : e);
    report.errors = errors;
    report.pass = false;
    console.log('FATAL', report.fatal);
    try {
      await shot(page, 'league-99-fatal');
    } catch (_) {}
  } finally {
    await browser.close();
  }
})();
