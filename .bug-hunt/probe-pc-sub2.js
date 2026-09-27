// Focused follow-up: feedback gaps, offer UI, real media, coach UI match path
const { launch, shot } = require('../tests/playthrough/pw.js');
const fs = require('fs');
const findings = [];
function record(id, severity, title, detail) {
  findings.push({ id, severity, title, detail: detail == null ? null : String(detail).slice(0, 1500) });
  console.log(`[${severity}] ${id} ${title}`);
  if (detail) console.log('   ', String(detail).slice(0, 400));
}

(async () => {
  const { browser, page } = await launch();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => { pageErrors.push(e.message); console.log('[pageerror]', e.message); });
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const t = m.text();
      if (!/favicon|sw\.js|net::ERR_/i.test(t)) { consoleErrors.push(t); console.log('[console.error]', t.slice(0, 200)); }
    }
  });
  page.on('dialog', async (d) => { console.log('[dialog]', d.type(), String(d.message()).slice(0, 160)); try { await d.accept(); } catch (e) {} });

  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__toasts = [];
    if (!window.__toastHooked) {
      window.__toastHooked = true;
      const orig = window.toast;
      window.toast = function (msg) { try { window.__toasts.push(String(msg)); } catch (e) {} return orig.apply(this, arguments); };
    }
    localStorage.setItem('km_tour', '1');
  });

  // ---- PLAYER: train/social/rest success feedback ----
  const playerFb = await page.evaluate(() => {
    switchStartTab('player');
    pickPlayerArch(1);
    pickPlayerPos('mid');
    if (!_pcTeam && window._pcTeams && window._pcTeams[0]) pickPlayerTeam(window._pcTeams[0].name);
    createPlayerCareer();
    try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
    goPage('career');
    const out = {};

    // train gain>0
    window.__toasts = [];
    const me = myPlayer(S);
    me.energy = 100; me.injury = 0; S.trained = false; delete me.peak;
    // force high form for gain
    me.val = 120; me.morale = 90;
    let r = playerTrainDay(S, 'lane');
    // use UI wrapper
    window.__toasts = [];
    S.trained = false; me.energy = 100; me.val = 120; me.morale = 90;
    playerTrain('lane');
    out.trainGain = { toasts: (window.__toasts || []).slice(), rHint: r && { ok: r.ok, gain: r.gain, note: r.note } };

    // social success
    window.__toasts = [];
    me.energy = 100; S.socialUsed = false;
    playerSocial(S, 'bond');
    out.social = { toasts: (window.__toasts || []).slice(), used: S.socialUsed };

    // rest success
    window.__toasts = [];
    S.trained = false;
    playerRest();
    out.rest = { toasts: (window.__toasts || []).slice() };

    // real media via maybeOpenMedia
    window.__toasts = [];
    S.career.media = null;
    let opened = false;
    for (let i = 0; i < 40 && !S.career.media; i++) {
      try { opened = maybeOpenMedia(S, 'title') || !!S.career.media; } catch (e) { opened = 'throw:' + e.message; }
    }
    const mediaBtns = [...document.querySelectorAll('#page-career button')].filter((b) => /playerRespondMedia/.test(b.getAttribute('onclick') || ''));
    window.__toasts = [];
    let mediaClick = null;
    if (mediaBtns[0]) {
      mediaBtns[0].click();
      mediaClick = { ui: true, toasts: (window.__toasts || []).slice(), mediaAfter: !!S.career.media, stats: S.career.stats && S.career.stats.media };
    } else if (S.career.media) {
      try { playerRespondMedia(S, 0); mediaClick = { ui: false, api: true, toasts: (window.__toasts || []).slice(), mediaAfter: !!S.career.media }; }
      catch (e) { mediaClick = { throw: e.message }; }
    } else mediaClick = { skip: 'no-media-opened', opened };
    out.mediaReal = { opened: !!S.career.media || opened, mediaClick, hasPanel: /媒体采访/.test((document.getElementById('page-career') || {}).innerText || '') };

    // gain<=0 toast wording
    window.__toasts = [];
    const me2 = myPlayer(S);
    me2.energy = 100; me2.injury = 0; me2.morale = 20; me2.val = 80; S.trained = false; delete me2.peak;
    // cap attrs to ceiling to force gain 0? or low form
    const r2 = playerTrainDay(S, 'mind');
    // UI path
    window.__toasts = [];
    S.trained = false; me2.energy = 100; me2.morale = 15; me2.val = 70; delete me2.peak;
    playerTrain('mind');
    out.trainZero = { toasts: (window.__toasts || []).slice(), r2: r2 && { ok: r2.ok, gain: r2.gain, note: r2.note } };

    return out;
  });
  console.log('PLAYER_FB', JSON.stringify(playerFb, null, 2));
  if ((playerFb.trainGain.toasts || []).length === 0) {
    record('P1-TRAIN-NO-TOAST', 'FAIL', '加练成功（gain>0）完全无 toast 反馈（点了像没反应）', JSON.stringify(playerFb.trainGain));
  }
  if ((playerFb.social.toasts || []).length === 0) {
    record('P1-SOCIAL-NO-TOAST', 'FAIL', '社交成功无 toast 反馈', JSON.stringify(playerFb.social));
  }
  if ((playerFb.rest.toasts || []).length === 0) {
    record('P2-REST-NO-TOAST', 'WARN', '休息成功无 toast（界面数字会变）', JSON.stringify(playerFb.rest));
  }
  if (playerFb.mediaReal && playerFb.mediaReal.mediaClick && playerFb.mediaReal.mediaClick.throw) {
    record('P0-MEDIA-THROW', 'FAIL', '真实媒体应答抛错', JSON.stringify(playerFb.mediaReal));
  }
  if (playerFb.mediaReal && playerFb.mediaReal.mediaClick && playerFb.mediaReal.mediaClick.toasts && playerFb.mediaReal.mediaClick.toasts.join('').includes('采访选项无效')) {
    record('P1-MEDIA-REAL-INVALID', 'FAIL', '真实媒体按钮点击报「采访选项无效」', JSON.stringify(playerFb.mediaReal));
  }
  if (playerFb.mediaReal && playerFb.mediaReal.mediaClick && playerFb.mediaReal.mediaClick.ui === true && (playerFb.mediaReal.mediaClick.toasts || []).length === 0 && playerFb.mediaReal.mediaClick.mediaAfter) {
    record('P2-MEDIA-NO-FEEDBACK', 'WARN', '媒体应答后无 toast（仅写日志）', JSON.stringify(playerFb.mediaReal.mediaClick));
  }

  // ---- COACH: offer UI on club page + accept toast + uiStartMatch ----
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
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
    goPage('club');
  });
  await page.waitForTimeout(200);

  const offerUi = await page.evaluate(() => {
    const out = {};
    const other = CLUB_TEMPLATES.find((c) => c.name !== S.teamName) || CLUB_TEMPLATES[1];
    S.coachOffer = { team: other.name };
    renderAll();
    goPage('club');
    const acceptBtn = [...document.querySelectorAll('#page-club button, button')].find((b) => /respondCoachOffer\(true\)/.test(b.getAttribute('onclick') || ''));
    const rejectBtn = [...document.querySelectorAll('#page-club button, button')].find((b) => /respondCoachOffer\(false\)/.test(b.getAttribute('onclick') || ''));
    out.buttons = {
      accept: acceptBtn ? { text: acceptBtn.textContent.trim(), on: acceptBtn.getAttribute('onclick') } : null,
      reject: rejectBtn ? { text: rejectBtn.textContent.trim(), on: rejectBtn.getAttribute('onclick') } : null,
    };
    // click accept via UI
    window.__toasts = [];
    const tb = S.teamName, cid = S.coach && S.coach.id;
    if (acceptBtn) { acceptBtn.click(); out.acceptClick = { via: 'ui', toasts: (window.__toasts || []).slice(), moved: S.teamName !== tb, newTeam: S.teamName, coachKept: (S.coach && S.coach.id) === cid, offerCleared: !S.coachOffer }; }
    else {
      try { respondCoachOffer(true); out.acceptClick = { via: 'api', toasts: (window.__toasts || []).slice(), moved: S.teamName !== tb, newTeam: S.teamName }; }
      catch (e) { out.acceptClick = { throw: e.message }; }
    }
    // reject toast
    S.coachOffer = { team: (CLUB_TEMPLATES.find((c) => c.name !== S.teamName) || {}).name };
    renderAll();
    window.__toasts = [];
    try {
      respondCoachOffer(false);
      out.reject = { toasts: (window.__toasts || []).slice(), offerCleared: !S.coachOffer, stayed: true };
    } catch (e) { out.reject = { throw: e.message }; }
    // bad name toast already known good; reconfirm via UI button if any
    S.coachOffer = { team: '不存在的战队XYZ' };
    renderAll(); goPage('club');
    const badAccept = [...document.querySelectorAll('button')].find((b) => /respondCoachOffer\(true\)/.test(b.getAttribute('onclick') || ''));
    window.__toasts = [];
    if (badAccept) { badAccept.click(); out.badNameUi = { toasts: (window.__toasts || []).slice(), team: S.teamName }; }
    return out;
  });
  console.log('OFFER_UI', JSON.stringify(offerUi, null, 2));
  if (!offerUi.buttons.accept || !offerUi.buttons.reject) {
    record('P1-OFFER-UI-MISSING', 'FAIL', '俱乐部页缺豪门邀约接受/拒绝按钮', JSON.stringify(offerUi.buttons));
  }
  if (offerUi.acceptClick && (offerUi.acceptClick.toasts || []).length === 0 && offerUi.acceptClick.moved) {
    record('P2-ACCEPT-NO-TOAST', 'WARN', '接受邀约换队成功但无 toast（仅日志）', JSON.stringify(offerUi.acceptClick));
  }
  if (offerUi.acceptClick && offerUi.acceptClick.moved === false) {
    record('P0-ACCEPT-NOOP', 'FAIL', '点接受邀约未换队', JSON.stringify(offerUi.acceptClick));
  }
  if (offerUi.reject && (offerUi.reject.toasts || []).length === 0) {
    record('P2-REJECT-NO-TOAST', 'WARN', '婉拒邀约无 toast', JSON.stringify(offerUi.reject));
  }
  if (offerUi.badNameUi && (offerUi.badNameUi.toasts || []).length === 0) {
    record('P1-BADNAME-UI-SILENT', 'FAIL', 'UI 点接受非法队名仍静默', JSON.stringify(offerUi.badNameUi));
  }

  // uiStartMatch UI path → BP
  const matchUi = await page.evaluate(() => {
    goPage('club');
    const btn = [...document.querySelectorAll('#page-club button')].find((b) => /uiStartMatch/.test(b.getAttribute('onclick') || ''));
    const out = { btn: btn ? btn.textContent.trim().slice(0, 40) : null };
    window.__toasts = [];
    try {
      if (btn) btn.click(); else uiStartMatch();
      out.afterClick = {
        hasSeries: !!S.series,
        modalOpen: !!(document.getElementById('app-modal') || document.querySelector('.modal.on')),
        toasts: (window.__toasts || []).slice(),
        modalText: ((document.getElementById('app-modal') || {}).innerText || '').slice(0, 200),
      };
    } catch (e) { out.afterClick = { throw: e.message }; }
    // try enter BP from modal
    window.__toasts = [];
    try {
      const bpBtn = [...document.querySelectorAll('button')].find((b) => /openBP|进入 BP|BP/.test((b.textContent || '') + (b.getAttribute('onclick') || '')));
      out.bpBtn = bpBtn ? { text: bpBtn.textContent.trim().slice(0, 40), on: bpBtn.getAttribute('onclick') } : null;
      if (bpBtn) {
        bpBtn.click();
        out.afterBp = {
          draft: !!(window._draft),
          modalText: ((document.getElementById('app-modal') || {}).innerText || '').slice(0, 250),
          toasts: (window.__toasts || []).slice(),
          hasPickButtons: [...document.querySelectorAll('button')].some((b) => /bpPick|bpBan|bpChoose|draftPick|bpConfirm/.test(b.getAttribute('onclick') || '')),
        };
      }
    } catch (e) { out.afterBp = { throw: e.message }; }
    return out;
  });
  console.log('MATCH_UI2', JSON.stringify(matchUi, null, 2));
  if (!matchUi.btn) record('P1-NO-UISTART', 'FAIL', '俱乐部页无 uiStartMatch 按钮', JSON.stringify(matchUi));
  if (matchUi.afterClick && matchUi.afterClick.throw) record('P0-UISTART-THROW', 'FAIL', 'uiStartMatch 抛错', JSON.stringify(matchUi.afterClick));
  if (matchUi.afterBp && matchUi.afterBp.throw) record('P0-BP-UI-THROW', 'FAIL', 'BP UI 抛错', JSON.stringify(matchUi.afterBp));
  if (matchUi.afterBp && matchUi.afterBp.hasPickButtons === false) {
    record('P1-BP-UI-EMPTY', 'FAIL', '进入 BP 后无征召/确认按钮', JSON.stringify(matchUi.afterBp));
  }

  await shot(page, 'pcsub-coach-bp');
  fs.writeFileSync('E:\\sex\\kpl-manager\\.bug-hunt\\pc-subagent-probe2.json', JSON.stringify({ findings, playerFb, offerUi, matchUi, pageErrors, consoleErrors }, null, 2), 'utf8');
  console.log('FINDINGS2', JSON.stringify(findings, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e.stack || e); process.exit(1); });
