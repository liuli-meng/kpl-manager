// Round 6: media UI after renderAll + coach/player kjia promote button absence + hint copy
const { launch, shot } = require('../tests/playthrough/pw.js');
const fs = require('fs');

(async () => {
  const { browser, page } = await launch();
  const pageErrors = [];
  page.on('pageerror', (e) => { pageErrors.push(e.message); console.log('[pageerror]', e.message); });
  page.on('dialog', async (d) => { try { await d.accept(); } catch (e) {} });

  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  const mediaUi = await page.evaluate(() => {
    window.__toasts = [];
    if (!window.__toastHooked) {
      window.__toastHooked = true;
      const orig = window.toast;
      window.toast = function (msg) { try { window.__toasts.push(String(msg)); } catch (e) {} return orig.apply(this, arguments); };
    }
    localStorage.setItem('km_tour', '1');
    switchStartTab('player');
    pickPlayerArch(1);
    pickPlayerPos('mid');
    if (!_pcTeam && window._pcTeams && window._pcTeams[0]) pickPlayerTeam(window._pcTeams[0].name);
    createPlayerCareer();
    try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
    goPage('career');
    const opened = maybeOpenMedia(S, 'title');
    renderAll(); // must re-render to show panel
    goPage('career');
    const text = (document.getElementById('page-career') || {}).innerText || '';
    const hasPanel = /媒体采访/.test(text);
    const btns = [...document.querySelectorAll('#page-career button')].filter((b) => /playerRespondMedia/.test(b.getAttribute('onclick') || ''));
    window.__toasts = [];
    let clickR = null;
    if (btns[0]) {
      const before = { media: !!S.career.media, stats: S.career.stats && S.career.stats.media };
      btns[0].click();
      clickR = { via: 'ui', toasts: (window.__toasts || []).slice(), before, after: { media: !!S.career.media, stats: S.career.stats && S.career.stats.media } };
    } else clickR = { via: 'none' };
    return { opened, hasPanel, btnCount: btns.length, btnTexts: btns.map((b) => b.textContent.trim().slice(0, 20)), clickR, mediaId: S.career && S.career.media && S.career.media.id };
  });
  console.log('MEDIA_UI2', JSON.stringify(mediaUi, null, 2));
  await shot(page, 'pcsub-media-ui');

  // coach kjia: promote buttons?
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(350);
  const coachKjia = await page.evaluate(() => {
    window.__toasts = [];
    if (!window.__toastHooked) {
      window.__toastHooked = true;
      const orig = window.toast;
      window.toast = function (msg) { try { window.__toasts.push(String(msg)); } catch (e) {} return orig.apply(this, arguments); };
    }
    localStorage.setItem('km_tour', '1');
    switchStartTab('coach');
    pickCoachClub(1);
    applyCoachClub();
    try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
    goPage('kjia');
    const text = (document.getElementById('page-kjia') || {}).innerText || '';
    const btns = [...document.querySelectorAll('#page-kjia button')].map((b) => ({
      text: b.textContent.trim().slice(0, 28),
      on: b.getAttribute('onclick'),
      disabled: !!b.disabled,
    }));
    const promote = btns.filter((b) => /promoteKjiaPlayer/.test(b.on || ''));
    const recall = btns.filter((b) => /recallKjia/.test(b.on || ''));
    // force call
    window.__toasts = [];
    let force = null;
    if (S.kjia && S.kjia.squad && S.kjia.squad[0]) {
      try { promoteKjiaPlayer(S.kjia.squad[0].id); force = { called: true, toasts: (window.__toasts || []).slice(), players: S.players.length }; }
      catch (e) { force = { throw: e.message }; }
    } else force = { skip: 'no-squad' };
    return {
      hint: typeof pageHint === 'function' ? pageHint('kjia').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null,
      hasPromoteCopy: /提拔/.test(text),
      hasLineupCopy: /阵容页/.test(text),
      promoteCount: promote.length,
      recallCount: recall.length,
      promote,
      force,
      squad: (S.kjia && S.kjia.squad || []).length,
      textHead: text.slice(0, 280),
    };
  });
  console.log('COACH_KJIA', JSON.stringify(coachKjia, null, 2));
  await shot(page, 'pcsub-coach-kjia');

  // player kjia hint (mode-aware?)
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(350);
  const playerKjia = await page.evaluate(() => {
    window.__toasts = [];
    if (!window.__toastHooked) {
      window.__toastHooked = true;
      const orig = window.toast;
      window.toast = function (msg) { try { window.__toasts.push(String(msg)); } catch (e) {} return orig.apply(this, arguments); };
    }
    localStorage.setItem('km_tour', '1');
    switchStartTab('player');
    pickPlayerArch(1);
    pickPlayerPos('mid');
    if (!_pcTeam && window._pcTeams && window._pcTeams[0]) pickPlayerTeam(window._pcTeams[0].name);
    createPlayerCareer();
    try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
    goPage('kjia');
    const text = (document.getElementById('page-kjia') || {}).innerText || '';
    const hint = typeof pageHint === 'function' ? pageHint('kjia').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null;
    return {
      hint,
      hasPromoteCopy: /提拔/.test(text) || /提拔/.test(hint || ''),
      hasLineupCopy: /阵容页/.test(text),
      hasSelfPath: /生涯/.test(text) && /租借|K甲|下放/.test(text),
    };
  });
  console.log('PLAYER_KJIA', JSON.stringify(playerKjia, null, 2));

  fs.writeFileSync('E:\\sex\\kpl-manager\\.bug-hunt\\pc-subagent-probe6.json', JSON.stringify({ mediaUi, coachKjia, playerKjia, pageErrors }, null, 2), 'utf8');
  await browser.close();
})().catch((e) => { console.error('FATAL', e.stack || e); process.exit(1); });
