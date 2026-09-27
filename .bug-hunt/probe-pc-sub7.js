// Round 7: confirm promoteKjiaPlayer permission bypass (arg-order) + player kjia residual copy
const { launch } = require('../tests/playthrough/pw.js');
const fs = require('fs');

(async () => {
  const { browser, page } = await launch();
  const pageErrors = [];
  page.on('pageerror', (e) => { pageErrors.push(e.message); console.log('[pageerror]', e.message); });
  page.on('dialog', async (d) => { try { await d.accept(); } catch (e) {} });

  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  const coachBypass = await page.evaluate(() => {
    window.__toasts = [];
    if (!window.__toastHooked) {
      window.__toastHooked = true;
      const orig = window.toast;
      window.toast = function (msg) { try { window.__toasts.push(String(msg)); } catch (e) {} return orig.apply(this, arguments); };
    }
    localStorage.setItem('km_tour', '1');
    switchStartTab('coach');
    pickCoachClub(0);
    applyCoachClub();
    try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}

    const out = { mode: S.mode, canOperatePromote: canOperate('promoteRookie', S), blockReason: blockReason('promoteRookie', S) };
    const squad0 = (S.kjia && S.kjia.squad && S.kjia.squad[0]) || null;
    out.squad0 = squad0 ? { id: squad0.id, name: squad0.name } : null;
    out.playersBefore = S.players.length;
    out.squadBefore = (S.kjia && S.kjia.squad || []).length;

    // A) single-arg form (what UI uses): promoteKjiaPlayer(id)
    window.__toasts = [];
    if (squad0) {
      try { promoteKjiaPlayer(squad0.id); out.singleArg = { ok: true, toasts: (window.__toasts || []).slice() }; }
      catch (e) { out.singleArg = { throw: e.message }; }
    }
    out.afterSingle = { players: S.players.length, squad: (S.kjia && S.kjia.squad || []).length };

    // B) two-arg form: promoteKjiaPlayer(S, id)
    window.__toasts = [];
    const squad1 = (S.kjia && S.kjia.squad && S.kjia.squad[0]) || null;
    if (squad1) {
      try { promoteKjiaPlayer(S, squad1.id); out.twoArg = { ok: true, toasts: (window.__toasts || []).slice() }; }
      catch (e) { out.twoArg = { throw: e.message }; }
    }
    out.afterTwo = { players: S.players.length, squad: (S.kjia && S.kjia.squad || []).length };

    // C) denyIfBlocked directly
    window.__toasts = [];
    out.denyDirect = denyIfBlocked('promoteRookie', S);

    return out;
  });
  console.log('COACH_BYPASS', JSON.stringify(coachBypass, null, 2));

  // player residual copy on kjia
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(350);
  const playerCopy = await page.evaluate(() => {
    window.__toasts = [];
    if (!window.__toastHooked) {
      window.__toastHooked = true;
      const orig = window.toast;
      window.toast = function (msg) { try { window.__toasts.push(String(msg)); } catch (e) {} return orig.apply(this, arguments); };
    }
    localStorage.setItem('km_tour', '1');
    switchStartTab('player');
    pickPlayerArch(1);
    pickPlayerPos('ad');
    if (!_pcTeam && window._pcTeams && window._pcTeams[0]) pickPlayerTeam(window._pcTeams[0].name);
    createPlayerCareer();
    try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
    goPage('kjia');
    const el = document.getElementById('page-kjia');
    const text = (el && el.innerText) || '';
    const html = (el && el.innerHTML) || '';
    const idx = text.indexOf('提拔');
    return {
      hasPromoteWord: /提拔/.test(text),
      context: idx >= 0 ? text.slice(Math.max(0, idx - 40), idx + 40) : null,
      hasRecallWord: /召回/.test(text),
      hasLineupRef: /阵容页/.test(text),
      hasPromoteBtn: /promoteKjiaPlayer/.test(html),
      hasRecallBtn: /recallKjia/.test(html),
      hint: typeof pageHint === 'function' ? pageHint('kjia').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null,
    };
  });
  console.log('PLAYER_COPY', JSON.stringify(playerCopy, null, 2));

  fs.writeFileSync('E:\\sex\\kpl-manager\\.bug-hunt\\pc-subagent-probe7.json', JSON.stringify({ coachBypass, playerCopy, pageErrors }, null, 2), 'utf8');
  await browser.close();
})().catch((e) => { console.error('FATAL', e.stack || e); process.exit(1); });
