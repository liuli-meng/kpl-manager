// Round 4: manager draft auction + FAB overlap + toast confirm summary
const { launch, shot } = require('../tests/playthrough/pw.js');
const fs = require('fs');
const findings = [];
function record(id, severity, title, detail) {
  findings.push({ id, severity, title, detail: detail == null ? null : String(detail).slice(0, 1500) });
  console.log(`[${severity}] ${id} ${title}`);
  if (detail) console.log('   ', String(detail).slice(0, 350));
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

  await page.evaluate(() => { localStorage.clear(); });
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

  // manager start via real UI (applyClub)
  const boot = await page.evaluate(() => {
    try { switchStartTab('self'); } catch (e) {}
    try { pickClub(0); } catch (e) {}
    try { applyClub(); } catch (e) { return { throw: e.message }; }
    try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
    return {
      mode: S && S.mode,
      team: S && S.teamName,
      fund: S && S.fund,
      phase: S && S.phase,
      preseason: S && S.preseason,
    };
  });
  await page.waitForTimeout(300);
  console.log('MANAGER_BOOT', JSON.stringify(boot));
  if (!boot.team) record('P1-MANAGER-BOOT', 'WARN', '经理开局状态异常', JSON.stringify(boot));

  // initDraft
  const draft = await page.evaluate(() => {
    window.__toasts = [];
    if (!S) return { r: 'no-S' };
    let r = null;
    try { initDraft(S); r = 'ok'; } catch (e) { r = 'throw:' + e.message; }
    const d = S.draft;
    const text = (document.getElementById('app-modal') || {}).innerText || '';
    const pageText = (document.getElementById('page-club') || {}).innerText || '';
    const btns = [...document.querySelectorAll('button')].filter((b) => /draft|Bid|Pick|Skip|Reserve/i.test(b.getAttribute('onclick') || '')).map((b) => ({
      text: b.textContent.trim().slice(0, 36),
      on: b.getAttribute('onclick'),
      disabled: !!b.disabled,
    }));
    return {
      r,
      hasDraft: !!d,
      phase: d && d.phase,
      slot: d && d.slot,
      bid: d && d.bid,
      leader: d && d.leader,
      poolLen: d && d.pool && d.pool.length,
      picks: d && d.picks && d.picks.length,
      toasts: (window.__toasts || []).slice(),
      btnCount: btns.length,
      btns: btns.slice(0, 20),
      modalOpen: !!(document.getElementById('app-modal') && document.getElementById('app-modal').classList.contains('on')),
      modalText: text.slice(0, 350),
      clubHasDraft: /选秀|竞拍|签位/.test(pageText),
    };
  });
  console.log('DRAFT_INIT', JSON.stringify(draft, null, 2));
  if (String(draft.r).startsWith('throw')) record('P0-DRAFT-INIT-THROW', 'FAIL', 'initDraft 抛错: ' + draft.r, JSON.stringify(draft));
  if (draft.hasDraft && draft.btnCount === 0 && !draft.clubHasDraft) {
    record('P1-DRAFT-NO-UI', 'FAIL', 'initDraft 后无竞拍/点名按钮且俱乐部页无选秀面板', JSON.stringify(draft));
  }

  // interact: bid raise / pass / pick
  const interact = await page.evaluate(() => {
    const out = [];
    if (!S) return { out: [{ act: 'skip', reason: 'no-S' }], uiBtns: [], final: null };
    const d0 = S.draft;
    const snap = () => ({ phase: S.draft && S.draft.phase, slot: S.draft && S.draft.slot, bid: S.draft && S.draft.bid, leader: S.draft && S.draft.leader, picks: S.draft && S.draft.picks && S.draft.picks.length });
    // try bid
    window.__toasts = [];
    const before = snap();
    try {
      if (typeof draftBidRaise === 'function') { draftBidRaise(S); out.push({ act: 'bidRaise', before, after: snap(), toasts: (window.__toasts || []).slice() }); }
    } catch (e) { out.push({ act: 'bidRaise', throw: e.message }); }
    window.__toasts = [];
    try {
      if (typeof draftBidPass === 'function') { draftBidPass(S); out.push({ act: 'bidPass', before: snap(), after: snap(), toasts: (window.__toasts || []).slice() }); }
    } catch (e) { out.push({ act: 'bidPass', throw: e.message }); }
    window.__toasts = [];
    try {
      if (S.draft && S.draft.pool && S.draft.pool[0]) { draftPick(S, S.draft.pool[0].id); out.push({ act: 'pick', before: snap(), after: snap(), toasts: (window.__toasts || []).slice() }); }
    } catch (e) { out.push({ act: 'pick', throw: e.message }); }
    // UI buttons if any
    const uiBtns = [...document.querySelectorAll('button')].filter((b) => /draftBidRaise|draftBidPass|draftPick|draftSkip/.test(b.getAttribute('onclick') || '')).map((b) => ({
      text: b.textContent.trim().slice(0, 30),
      on: b.getAttribute('onclick'),
      disabled: !!b.disabled,
    }));
    return { out, uiBtns, final: snap() };
  });
  console.log('DRAFT_INTERACT', JSON.stringify(interact, null, 2));
  for (const a of interact.out) {
    if (a.throw) record('P0-DRAFT-ACT-THROW', 'FAIL', a.act + ' 抛错: ' + a.throw, JSON.stringify(a));
    else if (a.before && a.after && JSON.stringify(a.before) === JSON.stringify(a.after) && !(a.toasts || []).length) {
      record('P2-DRAFT-ACT-NOOP', 'WARN', a.act + ' 无状态变化且无 toast', JSON.stringify(a));
    }
  }

  await shot(page, 'pcsub-draft-mgr');

  // ---- FAB overlap check (player + coach) ----
  const fabCheck = await page.evaluate(() => {
    const fab = document.getElementById('page-fab');
    const dock = document.getElementById('page-dock');
    if (!fab) return { fabExists: false };
    const fr = fab.getBoundingClientRect();
    // any fixed bottom buttons overlapping fab?
    const overlap = [];
    document.querySelectorAll('button').forEach((b) => {
      if (b === fab || b.closest('#page-dock')) return;
      const r = b.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const hit = !(r.right < fr.left || r.left > fr.right || r.bottom < fr.top || r.top > fr.bottom);
      if (hit) overlap.push({ text: b.textContent.trim().slice(0, 24), on: b.getAttribute('onclick'), rect: { t: Math.round(r.top), l: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) } });
    });
    return {
      fabExists: true,
      fabRect: { t: Math.round(fr.top), l: Math.round(fr.left), w: Math.round(fr.width), h: Math.round(fr.height) },
      dockExists: !!dock,
      overlapCount: overlap.length,
      overlap: overlap.slice(0, 8),
      bodyOverflow: getComputedStyle(document.body).overflow,
    };
  });
  console.log('FAB_MGR', JSON.stringify(fabCheck, null, 2));

  // player FAB
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  const playerFab = await page.evaluate(() => {
    window.__toasts = [];
    if (!window.__toastHooked) {
      window.__toastHooked = true;
      const orig = window.toast;
      window.toast = function (msg) { try { window.__toasts.push(String(msg)); } catch (e) {} return orig.apply(this, arguments); };
    }
    localStorage.setItem('km_tour', '1');
    switchStartTab('player');
    pickPlayerArch(1);
    pickPlayerPos('top');
    if (!_pcTeam && window._pcTeams && window._pcTeams[0]) pickPlayerTeam(window._pcTeams[0].name);
    createPlayerCareer();
    try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
    const fab = document.getElementById('page-fab');
    const fr = fab.getBoundingClientRect();
    const overlap = [];
    document.querySelectorAll('button').forEach((b) => {
      if (b === fab || b.closest('#page-dock')) return;
      const r = b.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const hit = !(r.right < fr.left || r.left > fr.right || r.bottom < fr.top || r.top > fr.bottom);
      if (hit) overlap.push({ text: b.textContent.trim().slice(0, 24), on: b.getAttribute('onclick') });
    });
    fab.click();
    const dock = document.getElementById('page-dock');
    return {
      mode: S.mode,
      fabRect: { t: Math.round(fr.top), l: Math.round(fr.left), w: Math.round(fr.width), h: Math.round(fr.height) },
      overlapCount: overlap.length,
      overlap: overlap.slice(0, 6),
      dockOpen: dock.classList.contains('open'),
      dockBtns: dock.querySelectorAll('button').length,
    };
  });
  console.log('FAB_PLAYER', JSON.stringify(playerFab, null, 2));
  if (playerFab.overlapCount > 0) record('P2-FAB-OVERLAP', 'WARN', '底栏 FAB 与其它按钮重叠', JSON.stringify(playerFab));

  // ---- train/social toast source confirm (code-level evidence) ----
  const toastSrc = await page.evaluate(() => {
    // re-check on player
    goPage('career');
    const me = myPlayer(S);
    me.energy = 100; me.injury = 0; S.trained = false; S.socialUsed = false; me.val = 120; me.morale = 90; delete me.peak;
    window.__toasts = [];
    playerTrain('lane');
    const trainToasts = (window.__toasts || []).slice();
    window.__toasts = [];
    playerSocial(S, 'bond');
    const socialToasts = (window.__toasts || []).slice();
    window.__toasts = [];
    playerRest();
    const restToasts = (window.__toasts || []).slice();
    window.__toasts = [];
    playerHeroTrain();
    const heroToasts = (window.__toasts || []).slice();
    return { trainToasts, socialToasts, restToasts, heroToasts, trained: S.trained, socialUsed: S.socialUsed };
  });
  console.log('TOAST_SRC', JSON.stringify(toastSrc, null, 2));
  if ((toastSrc.trainToasts || []).length === 0) record('P1-TRAIN-SUCCESS-NO-TOAST', 'FAIL', 'playerTrain 成功路径确认无 toast（gain>0）', JSON.stringify(toastSrc));
  if ((toastSrc.socialToasts || []).length === 0) record('P1-SOCIAL-SUCCESS-NO-TOAST', 'FAIL', 'playerSocial 成功路径确认无 toast', JSON.stringify(toastSrc));
  if ((toastSrc.heroToasts || []).length === 0) record('P2-HERO-NO-TOAST', 'WARN', 'playerHeroTrain 成功无 toast', JSON.stringify(toastSrc));

  fs.writeFileSync('E:\\sex\\kpl-manager\\.bug-hunt\\pc-subagent-probe4.json', JSON.stringify({ findings, boot, draft, interact, fabCheck, playerFab, toastSrc, pageErrors, consoleErrors }, null, 2), 'utf8');
  console.log('FINDINGS4', JSON.stringify(findings, null, 2));
  console.log('PAGE_ERRORS', JSON.stringify(pageErrors));
  console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors));
  await browser.close();
})().catch((e) => { console.error('FATAL', e.stack || e); process.exit(1); });
