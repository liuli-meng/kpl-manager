// 控制台错误扫雷: createTeam + rapid goPage×3 + renderAll + saveMgmt + tour
// Run: node tests/playthrough/console-minefield.js
const { launch, clearAndStart, shot } = require('./pw.js');

const PAGES = ['career', 'club', 'lineup', 'market', 'train', 'league', 'kjia', 'union', 'hall', 'biz'];
const GLOBALS = [
  'createTeam', 'applyClub', 'startMatch', 'bpAuto', 'nextDay',
  'save', 'load', 'finishSeries',
  'renderAll', 'openSaveMgmt', 'closeModal', 'startTour', 'skipTour', 'goPage',
];

(async () => {
  const errors = [];
  const warnings = [];
  const notes = [];
  let browser, page;

  try {
    ({ browser, page } = await launch());
    // helper already attaches pageerror/console listeners that print;
    // also collect into our array for the report.
    page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push('[console.error] ' + msg.text());
    });
    page.on('dialog', async (d) => {
      notes.push('[dialog] ' + d.type() + ' ' + String(d.message()).slice(0, 120));
      try { await d.accept(); } catch (_) {}
    });

    // ---- 1) Fresh start + createTeam '扫雷' ----
    await clearAndStart(page);
    await page.waitForTimeout(600);

    const createResult = await page.evaluate(() => {
      const el = document.getElementById('new-team-name');
      if (!el) return { ok: false, reason: 'no #new-team-name' };
      el.value = '扫雷';
      if (typeof createTeam !== 'function') return { ok: false, reason: 'no createTeam' };
      try {
        createTeam();
        return {
          ok: true,
          teamName: window.S && S.teamName,
          players: window.S && S.players && S.players.length,
          preseason: window.S && S.preseason,
        };
      } catch (e) {
        return { ok: false, reason: String((e && e.message) || e) };
      }
    });
    notes.push('createTeam: ' + JSON.stringify(createResult));
    await page.waitForTimeout(500);
    await shot(page, 'cf-01-after-create');

    // ---- 2) Rapid goPage through ALL pages ×3 ----
    const navErrors = [];
    for (let pass = 1; pass <= 3; pass++) {
      for (const p of PAGES) {
        const r = await page.evaluate((name) => {
          try {
            if (typeof goPage !== 'function') return { ok: false, reason: 'no goPage' };
            goPage(name);
            return { ok: true, page: name };
          } catch (e) {
            return { ok: false, reason: String((e && e.message) || e), page: name };
          }
        }, p);
        if (!r.ok) navErrors.push(`pass${pass}/${p}: ${r.reason}`);
      }
      // tiny settle so renders finish between passes
      await page.waitForTimeout(80);
    }
    notes.push('navErrors: ' + JSON.stringify(navErrors));
    await page.waitForTimeout(300);
    await shot(page, 'cf-02-after-nav-x3');

    // ---- 3) renderAll() ----
    const renderResult = await page.evaluate(() => {
      try {
        if (typeof renderAll !== 'function') return { ok: false, reason: 'no renderAll' };
        renderAll();
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: String((e && e.message) || e) };
      }
    });
    notes.push('renderAll: ' + JSON.stringify(renderResult));
    await page.waitForTimeout(200);

    // ---- 4) openSaveMgmt() then closeModal('app-modal') ----
    const saveMgmtResult = await page.evaluate(() => {
      try {
        if (typeof openSaveMgmt !== 'function') return { ok: false, reason: 'no openSaveMgmt' };
        openSaveMgmt();
        const m = document.getElementById('app-modal');
        const modalOn = !!(m && m.classList.contains('on'));
        return { ok: true, modalOn };
      } catch (e) {
        return { ok: false, reason: String((e && e.message) || e) };
      }
    });
    notes.push('openSaveMgmt: ' + JSON.stringify(saveMgmtResult));
    await page.waitForTimeout(200);
    await shot(page, 'cf-03-save-mgmt');

    const closeModalResult = await page.evaluate(() => {
      try {
        if (typeof closeModal !== 'function') return { ok: false, reason: 'no closeModal' };
        closeModal('app-modal');
        const m = document.getElementById('app-modal');
        const stillOn = !!(m && m.classList.contains('on'));
        return { ok: true, stillOn };
      } catch (e) {
        return { ok: false, reason: String((e && e.message) || e) };
      }
    });
    notes.push('closeModal: ' + JSON.stringify(closeModalResult));
    await page.waitForTimeout(150);

    // ---- 5) startTour if exists, then skip ----
    const tourResult = await page.evaluate(() => {
      const out = { hasStartTour: typeof startTour, hasSkipTour: typeof skipTour };
      try {
        if (typeof startTour === 'function') {
          startTour();
          out.started = true;
        } else {
          out.started = false;
          out.reason = 'no startTour';
        }
      } catch (e) {
        out.err = String((e && e.message) || e);
      }
      return out;
    });
    notes.push('startTour: ' + JSON.stringify(tourResult));
    await page.waitForTimeout(250);
    await shot(page, 'cf-04-tour');

    const skipTourResult = await page.evaluate(() => {
      // try common skip paths
      const out = { tried: [] };
      try {
        if (typeof skipTour === 'function') {
          skipTour();
          out.tried.push('skipTour');
        }
      } catch (e) { out.skipTourErr = String((e && e.message) || e); }
      try {
        // fallback: click any skip/跳过 button inside tour
        const btn = Array.from(document.querySelectorAll('button')).find((b) =>
          /跳过|skip/i.test(b.textContent || '')
        );
        if (btn) { btn.click(); out.tried.push('click-skip-btn'); }
      } catch (e) { out.clickErr = String((e && e.message) || e); }
      // force-clear tour flag if present
      try {
        if (window._tour) { window._tour.on = false; out.tried.push('clear-_tour'); }
      } catch (_) {}
      return out;
    });
    notes.push('skipTour: ' + JSON.stringify(skipTourResult));
    await page.waitForTimeout(200);

    // ---- 6) typeof of key globals ----
    const globalTypes = await page.evaluate((names) => {
      const o = {};
      for (const n of names) o[n] = typeof window[n];
      return o;
    }, GLOBALS);

    // ---- 7) Collect final errors (deduped) ----
    // Give any late async errors a moment
    await page.waitForTimeout(300);

    // ---- SUMMARY ----
    const missingGlobals = Object.entries(globalTypes)
      .filter(([, t]) => t === 'undefined')
      .map(([n]) => n);

    console.log('===MINEFIELD_REPORT===');
    console.log(JSON.stringify({
      createResult,
      navErrors,
      renderResult,
      saveMgmtResult,
      closeModalResult,
      tourResult,
      skipTourResult,
      globalTypes,
      missingGlobals,
      pageErrors: errors.filter((e) => e.startsWith('[pageerror]')),
      consoleErrors: errors.filter((e) => e.startsWith('[console.error]')),
      allErrors: errors,
      notes,
      errorCount: errors.length,
    }, null, 2));
    console.log('===END===');
  } catch (e) {
    console.error('SCRIPT_FAIL', e);
    console.log('===MINEFIELD_REPORT===');
    console.log(JSON.stringify({ fatal: String(e && e.message || e), errors, notes }, null, 2));
    console.log('===END===');
  } finally {
    if (browser) await browser.close();
  }
})();
