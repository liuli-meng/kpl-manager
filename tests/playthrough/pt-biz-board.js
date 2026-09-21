// Playtest: 经营/董事会/粉丝 — createTeam 商业帝国 → biz 全览 → 赞助升级门禁 → nextDay
const { launch, clearAndStart, shot } = require('./pw.js');

const TEAM = '商业帝国';

(async () => {
  const issues = [];
  const notes = [];
  const shots = [];
  const { browser, page } = await launch();

  try {
    // 1) Fresh boot + create team
    await clearAndStart(page);
    await page.waitForTimeout(700);
    shots.push(await shot(page, 'pt_biz_boot'));

    const createResult = await page.evaluate((name) => {
      const el = document.getElementById('new-team-name');
      if (!el) return { ok: false, reason: 'no #new-team-name' };
      el.value = name;
      if (typeof createTeam !== 'function') return { ok: false, reason: 'no createTeam' };
      try {
        createTeam();
        return { ok: true, team: S && S.teamName, day: S && S.day, preseason: S && S.preseason, transferWindow: S && S.transferWindow };
      } catch (e) {
        return { ok: false, reason: String(e && e.message || e) };
      }
    }, TEAM);
    if (!createResult.ok) issues.push('createTeam failed: ' + createResult.reason);
    await page.waitForTimeout(500);
    shots.push(await shot(page, 'pt_biz_after_create'));

    // 2) goPage('biz') + full screenshot + panel dump
    const navBiz = await page.evaluate(() => {
      try {
        if (typeof goPage !== 'function') return { ok: false, reason: 'no goPage' };
        goPage('biz');
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: String(e && e.message || e) };
      }
    });
    if (!navBiz.ok) issues.push('goPage(biz) failed: ' + navBiz.reason);
    await page.waitForTimeout(400);
    // full page screenshot for panel layout
    const fullBiz = 'E:/sex/gui-test-screenshots/pt_biz_full.png';
    await page.screenshot({ path: fullBiz, fullPage: true });
    shots.push(fullBiz);
    console.log('SHOT', fullBiz);
    shots.push(await shot(page, 'pt_biz_viewport'));

    const bizDump = await page.evaluate(() => {
      // S is top-level let — not on window; bare reference works in page context
      if (typeof S === 'undefined' || !S) return { ok: false, reason: 'no S' };
      const sec = document.getElementById('page-biz');
      const panels = Array.from((sec || document).querySelectorAll('.panel')).map(p => {
        const h = p.querySelector('h3');
        return {
          heading: (h ? h.innerText : '(no h3)').replace(/\s+/g, ' ').trim(),
          textLen: (p.innerText || '').trim().length,
        };
      });
      // club-page board panel (trust lives there, not on biz)
      const clubSec = document.getElementById('page-club');
      let boardHeading = null;
      let boardSnippet = null;
      if (clubSec) {
        const bh = Array.from(clubSec.querySelectorAll('h3')).find(h => /董事会/.test(h.innerText));
        if (bh) {
          boardHeading = bh.innerText.replace(/\s+/g, ' ').trim();
          const panel = bh.closest('.panel') || bh.parentElement;
          boardSnippet = (panel ? panel.innerText : '').replace(/\s+/g, ' ').trim().slice(0, 280);
        }
      }
      const sponsorBtn = Array.from((sec || document).querySelectorAll('button')).find(b => /升级|赞助/.test(b.innerText));
      return {
        ok: true,
        teamName: S.teamName,
        day: S.day,
        season: S.season,
        preseason: !!S.preseason,
        transferWindow: S.transferWindow,
        fund: S.fund,
        fans: Math.round(S.fans || 0),
        boardTrust: S.board ? S.board.trust : null,
        boardKpi: S.board && S.board.kpi ? S.board.kpi : null,
        boardWarn: S.board ? S.board.warn : null,
        sponsorLv: S.sponsorLv,
        sponsorName: (typeof SPONSORS !== 'undefined' ? SPONSORS[S.sponsorLv]?.name : null),
        sponsorIncome: (typeof SPONSORS !== 'undefined' ? SPONSORS[S.sponsorLv]?.income : null),
        wageCap: S.wageCap,
        weeklyWage: (typeof weeklyWage === 'function' ? weeklyWage(S) : null),
        honors: (S.honors || []).length,
        panels,
        boardHeading,
        boardSnippet,
        sponsorBtn: sponsorBtn ? {
          text: sponsorBtn.innerText.replace(/\s+/g, ' ').trim(),
          disabled: sponsorBtn.disabled,
          onclick: sponsorBtn.getAttribute('onclick') || '',
        } : null,
        bizTextPreview: (sec ? sec.innerText : '').replace(/\s+/g, ' ').trim().slice(0, 500),
      };
    });
    if (!bizDump.ok) issues.push('biz dump failed: ' + bizDump.reason);

    // 3) Try sponsor upgrade (UI click + direct API) and capture gate messages
    const upgradeAttempt = await page.evaluate(() => {
      if (typeof S === 'undefined' || !S) return { ok: false, reason: 'no S' };
      const before = { fund: S.fund, sponsorLv: S.sponsorLv, fans: Math.round(S.fans || 0) };
      const out = { before, hasFn: typeof upgradeSponsor === 'function', toast: '', events: [], after: null, gated: false };

      // capture toast
      const readToast = () => {
        const t = document.querySelector('.toast, #toast, [class*="toast"]');
        return t ? (t.innerText || '').trim() : '';
      };

      // 3a) UI button path
      const sec = document.getElementById('page-biz');
      const btn = sec && Array.from(sec.querySelectorAll('button')).find(b => /升级/.test(b.innerText));
      out.uiButton = btn ? { text: btn.innerText.trim(), disabled: btn.disabled } : null;
      if (btn && !btn.disabled) {
        try { btn.click(); } catch (e) { out.uiClickErr = String(e && e.message || e); }
      } else if (btn && btn.disabled) {
        out.gated = true;
        out.gateReason = 'UI upgrade button disabled';
      } else {
        out.uiButton = null;
      }

      // 3b) always call upgradeSponsor() to force gate toast even if button disabled
      try {
        if (typeof upgradeSponsor === 'function') {
          upgradeSponsor();
          out.calledApi = true;
        }
      } catch (e) {
        out.apiErr = String(e && e.message || e);
      }

      out.toast = readToast();
      out.after = { fund: S.fund, sponsorLv: S.sponsorLv, fans: Math.round(S.fans || 0) };
      out.upgraded = out.after.sponsorLv > before.sponsorLv;
      // last few events
      out.recentLogs = (S.logs || S.eventLog || []).slice(0, 5).map(l => (typeof l === 'string' ? l : (l.text || l.t || JSON.stringify(l))));
      return out;
    });
    await page.waitForTimeout(200);
    shots.push(await shot(page, 'pt_biz_after_upgrade_try'));

    // 4) Advance several days (preseason)
    const days = 3;
    const daySnapshots = [];
    for (let i = 0; i < days; i++) {
      const snap = await page.evaluate((step) => {
        if (typeof S === 'undefined' || !S) return { ok: false, reason: 'no S' };
        const before = {
          day: S.day, fund: S.fund, fans: Math.round(S.fans || 0),
          transferWindow: S.transferWindow, preseason: !!S.preseason,
          sponsorLv: S.sponsorLv,
        };
        let err = null;
        try {
          if (typeof nextDay !== 'function') return { ok: false, reason: 'no nextDay' };
          nextDay(S);
          // re-render like uiNextDay does
          if (typeof renderAll === 'function') renderAll();
        } catch (e) {
          err = String(e && e.message || e);
        }
        const after = {
          day: S.day, fund: S.fund, fans: Math.round(S.fans || 0),
          transferWindow: S.transferWindow, preseason: !!S.preseason,
          sponsorLv: S.sponsorLv,
          boardTrust: S.board ? S.board.trust : null,
        };
        // stay on biz for screenshot
        if (typeof goPage === 'function') { try { goPage('biz'); } catch (_) {} }
        return { ok: !err, step, before, after, err };
      }, i + 1);
      daySnapshots.push(snap);
      await page.waitForTimeout(250);
      shots.push(await shot(page, `pt_biz_day${i + 1}`));
      if (!snap.ok) issues.push(`nextDay step ${i + 1}: ${snap.err || snap.reason}`);
    }

    // re-screenshot biz after days
    await page.waitForTimeout(300);
    const fullBiz2 = 'E:/sex/gui-test-screenshots/pt_biz_after_days_full.png';
    await page.screenshot({ path: fullBiz2, fullPage: true });
    shots.push(fullBiz2);
    console.log('SHOT', fullBiz2);

    const afterDaysDump = await page.evaluate(() => {
      const sec = document.getElementById('page-biz');
      const panels = Array.from((sec || document).querySelectorAll('.panel')).map(p => {
        const h = p.querySelector('h3');
        return (h ? h.innerText : '(no h3)').replace(/\s+/g, ' ').trim();
      });
      const sponsorBtn = Array.from((sec || document).querySelectorAll('button')).find(b => /升级|赞助/.test(b.innerText));
      if (typeof S === 'undefined' || !S) return { ok: false, reason: 'no S', panels };
      return {
        ok: true,
        teamName: S.teamName,
        day: S.day,
        preseason: !!S.preseason,
        transferWindow: S.transferWindow,
        fund: S.fund,
        fans: Math.round(S.fans || 0),
        boardTrust: S.board ? S.board.trust : null,
        sponsorLv: S.sponsorLv,
        sponsorName: (typeof SPONSORS !== 'undefined' ? SPONSORS[S.sponsorLv]?.name : null),
        sponsorBtn: sponsorBtn ? { text: sponsorBtn.innerText.trim(), disabled: sponsorBtn.disabled } : null,
        panels,
        lastLogs: (S.logs || []).slice(0, 8).map(l => (typeof l === 'string' ? l : (l.t || l.text || ''))),
      };
    });

    // 5) close (browser.close in finally)

    const result = {
      issues,
      notes,
      createResult,
      bizDump,
      upgradeAttempt,
      daySnapshots,
      afterDaysDump,
      shots,
    };
    console.log('===PLAYTEST_RESULT===');
    console.log(JSON.stringify(result, null, 2));
    console.log('===END===');
  } catch (e) {
    console.error('[fatal]', e);
    issues.push('fatal: ' + (e && e.message || e));
    console.log('===PLAYTEST_RESULT===');
    console.log(JSON.stringify({ issues, shots }, null, 2));
    console.log('===END===');
  } finally {
    await browser.close();
  }
})();
