// Round 3: correct BP UI chain + draft auction FAB + train/social toast confirm
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
  page.on('pageerror', (e) => { pageErrors.push(e.message); console.log('[pageerror]', e.message); });
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
    switchStartTab('coach');
    pickCoachClub(0);
    applyCoachClub();
    try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
    goPage('club');
  });
  await page.waitForTimeout(200);

  // ---- BP full UI chain ----
  const bp = await page.evaluate(() => {
    const out = {};
    const startBtn = [...document.querySelectorAll('#page-club button')].find((b) => /uiStartMatch/.test(b.getAttribute('onclick') || ''));
    window.__toasts = [];
    if (startBtn) startBtn.click();
    out.step1_modal = {
      open: !!(document.getElementById('app-modal') && document.getElementById('app-modal').classList.contains('on')) || !!document.querySelector('.modal.on'),
      text: ((document.getElementById('app-modal') || {}).innerText || '').slice(0, 300),
    };
    // find 进入 BP button in modal
    const modalBtns = [...document.querySelectorAll('#app-modal button, .modal.on button, button')].map((b) => ({
      text: (b.textContent || '').trim().slice(0, 50),
      on: b.getAttribute('onclick'),
      disabled: !!b.disabled,
    }));
    out.modalButtons = modalBtns.filter((b) => b.on && /openBP|playGame|bpConfirm|closeModal/.test(b.on)).slice(0, 20);
    const enterBp = [...document.querySelectorAll('button')].find((b) => /进入 BP|openBP/.test((b.textContent || '') + (b.getAttribute('onclick') || '')));
    out.enterBp = enterBp ? { text: enterBp.textContent.trim().slice(0, 40), on: enterBp.getAttribute('onclick') } : null;
    window.__toasts = [];
    if (enterBp) {
      enterBp.click();
      out.step2_bp = {
        hasDraft: !!window._draft,
        draftPhase: window._draft && window._draft.phase,
        modalText: ((document.getElementById('app-modal') || {}).innerText || '').slice(0, 350),
        toasts: (window.__toasts || []).slice(),
      };
      const bpBtns = [...document.querySelectorAll('#app-modal button, .modal.on button, button')].map((b) => ({
        text: (b.textContent || '').trim().slice(0, 36),
        on: b.getAttribute('onclick'),
        disabled: !!b.disabled,
      })).filter((b) => b.on && /bp|draft|pick|ban|Confirm|hero/i.test(b.on + b.text));
      out.step2_bp.buttons = bpBtns.slice(0, 25);
      out.step2_bp.hasConfirm = bpBtns.some((b) => /bpConfirm/.test(b.on || ''));
      out.step2_bp.hasPick = bpBtns.some((b) => /bpPick|bpBan|bpChoose|draftAction|bpHero|pickHero/.test(b.on || ''));
    }
    return out;
  });
  console.log('BP_CHAIN_UI', JSON.stringify(bp, null, 2));
  if (!bp.enterBp) record('P1-BP-ENTER-MISSING', 'FAIL', '赛前准备 modal 无「进入 BP」按钮', JSON.stringify(bp.step1_modal));
  if (bp.step2_bp && bp.step2_bp.hasDraft === false) record('P0-BP-NOT-OPEN', 'FAIL', '点进入 BP 后 window._draft 未建立', JSON.stringify(bp.step2_bp));
  if (bp.step2_bp && bp.step2_bp.hasConfirm === false) record('P1-BP-NO-CONFIRM', 'FAIL', 'BP 界面无确认按钮', JSON.stringify(bp.step2_bp));

  // try confirm BP if present
  const bpDone = await page.evaluate(() => {
    window.__toasts = [];
    try {
      if (typeof bpAutoAll === 'function') bpAutoAll();
      if (typeof bpConfirm === 'function') bpConfirm();
      return { ok: true, hasSeries: !!S.series, history: (S.history || []).length, toasts: (window.__toasts || []).slice() };
    } catch (e) { return { throw: e.message }; }
  });
  console.log('BP_DONE', JSON.stringify(bpDone));
  if (bpDone.throw) record('P0-BP-CONFIRM-THROW', 'FAIL', 'BP 确认抛错', JSON.stringify(bpDone));

  await shot(page, 'pcsub-bp-full');

  // ---- Draft auction (manager mode has draft; coach/player should be gated) ----
  const draftGate = await page.evaluate(() => {
    window.__toasts = [];
    let r = null;
    try { draftStart && draftStart(S); r = 'called'; } catch (e) { r = 'throw:' + e.message; }
    return {
      mode: S.mode,
      r,
      toasts: (window.__toasts || []).slice(),
      hasDraft: !!S.draft,
      canOperate: typeof canOperate === 'function' ? canOperate('draft', S) : 'no-fn',
    };
  });
  console.log('DRAFT_GATE_COACH', JSON.stringify(draftGate));
  if (draftGate.mode === 'coach' && draftGate.hasDraft && !draftGate.r.startsWith('throw')) {
    // coach shouldn't open draft
    if (draftGate.canOperate === false) {
      // engine should have blocked
      if (draftGate.hasDraft) record('P1-COACH-DRAFT-LEAK', 'FAIL', '教练可开启选秀大会', JSON.stringify(draftGate));
    }
  }

  // manager draft auction UI (control group) — only if easy
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  const draftUi = await page.evaluate(() => {
    window.__toasts = [];
    if (!window.__toastHooked) {
      window.__toastHooked = true;
      const orig = window.toast;
      window.toast = function (msg) { try { window.__toasts.push(String(msg)); } catch (e) {} return orig.apply(this, arguments); };
    }
    localStorage.setItem('km_tour', '1');
    // stay manager
    try { initStart(); } catch (e) {}
    // pick club 0 and start if buttons exist
    const startBtn = document.querySelector('[onclick*="startGame"], #start-btn, [onclick*="beginGame"]');
    // try pickClub + start
    try {
      if (typeof pickClub === 'function') pickClub(0);
      const apply = document.querySelector('#start-modal button.primary, #start-modal .btn.primary');
      if (apply && /开始|执教|进入/.test(apply.textContent)) apply.click();
    } catch (e) {}
    return {
      mode: (typeof S !== 'undefined' && S) ? S.mode : null,
      team: (typeof S !== 'undefined' && S) ? S.teamName : null,
      startBtnText: startBtn ? startBtn.textContent.trim() : null,
    };
  });
  await page.waitForTimeout(300);
  // force open draft if available
  const draftOpen = await page.evaluate(() => {
    window.__toasts = [];
    let r = null;
    try {
      if (typeof draftStart === 'function') { draftStart(S); r = 'ok'; }
      else if (typeof openDraft === 'function') { openDraft(S); r = 'ok-open'; }
      else r = 'no-fn';
    } catch (e) { r = 'throw:' + e.message; }
    const text = (document.getElementById('app-modal') || document.getElementById('page-market') || {}).innerText || '';
    const btns = [...document.querySelectorAll('button')].filter((b) => /draft|bid|竞拍|叫价|点名|签位/.test((b.textContent || '') + (b.getAttribute('onclick') || ''))).map((b) => ({
      text: b.textContent.trim().slice(0, 30),
      on: b.getAttribute('onclick'),
      disabled: !!b.disabled,
    }));
    return {
      r,
      hasDraft: !!(S && S.draft),
      phase: S && S.draft && S.draft.phase,
      slot: S && S.draft && S.draft.slot,
      bid: S && S.draft && S.draft.bid,
      leader: S && S.draft && S.draft.leader,
      toasts: (window.__toasts || []).slice(),
      btnCount: btns.length,
      btns: btns.slice(0, 15),
      modalText: ((document.getElementById('app-modal') || {}).innerText || '').slice(0, 300),
    };
  });
  console.log('DRAFT_UI', JSON.stringify({ draftUi, draftOpen }, null, 2));
  if (String(draftOpen.r).startsWith('throw')) record('P0-DRAFT-THROW', 'FAIL', 'draftStart 抛错: ' + draftOpen.r, JSON.stringify(draftOpen));
  if (draftOpen.hasDraft && draftOpen.btnCount === 0) {
    record('P1-DRAFT-NO-BUTTONS', 'FAIL', '选秀竞拍面板无任何竞拍/点名按钮（点了没反应风险）', JSON.stringify(draftOpen));
  }

  // try one bid if buttons exist
  const bidClick = await page.evaluate(() => {
    const bidBtn = [...document.querySelectorAll('button')].find((b) => /draftBid|draftRaise|叫价|加价/.test((b.textContent || '') + (b.getAttribute('onclick') || '')));
    const pickBtn = [...document.querySelectorAll('button')].find((b) => /draftPick|点名/.test((b.textContent || '') + (b.getAttribute('onclick') || '')));
    window.__toasts = [];
    const before = S.draft ? { bid: S.draft.bid, leader: S.draft.leader, phase: S.draft.phase, slot: S.draft.slot } : null;
    try {
      if (bidBtn) { bidBtn.click(); return { action: 'bid', text: bidBtn.textContent.trim(), before, after: S.draft ? { bid: S.draft.bid, leader: S.draft.leader, phase: S.draft.phase, slot: S.draft.slot } : null, toasts: (window.__toasts || []).slice() }; }
      if (pickBtn) { pickBtn.click(); return { action: 'pick', text: pickBtn.textContent.trim(), before, after: S.draft ? { bid: S.draft.bid, leader: S.draft.leader, phase: S.draft.phase, slot: S.draft.slot, picks: (S.draft.picks || []).length } : null, toasts: (window.__toasts || []).slice() }; }
      return { action: 'none', before };
    } catch (e) { return { throw: e.message, before }; }
  });
  console.log('BID_CLICK', JSON.stringify(bidClick, null, 2));
  if (bidClick.throw) record('P0-DRAFT-CLICK-THROW', 'FAIL', '竞拍按钮抛错', JSON.stringify(bidClick));
  if (bidClick.action !== 'none' && bidClick.before && bidClick.after && JSON.stringify(bidClick.before) === JSON.stringify(bidClick.after) && !(bidClick.toasts || []).length) {
    record('P1-DRAFT-CLICK-NOOP', 'FAIL', '竞拍/点名按钮点击后状态无变化且无 toast', JSON.stringify(bidClick));
  }

  await shot(page, 'pcsub-draft');

  fs.writeFileSync('E:\\sex\\kpl-manager\\.bug-hunt\\pc-subagent-probe3.json', JSON.stringify({ findings, bp, bpDone, draftGate, draftOpen, bidClick, pageErrors }, null, 2), 'utf8');
  console.log('FINDINGS3', JSON.stringify(findings, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e.stack || e); process.exit(1); });
