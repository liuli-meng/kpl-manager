// probe-pc-sub8c.js — finish remaining checks after 8b FATAL
const fs = require('fs');
const { launch, shot, clearAndStart } = require('../tests/playthrough/pw.js');
const findings = [];
function rec(id, sev, title, detail) {
  findings.push({ id, sev, title, detail });
  console.log(`[${sev}] ${id} ${title}`);
  if (detail) console.log('   ', String(detail).slice(0, 500));
}
function hook(page) {
  page.on('pageerror', (e) => rec('PAGEERROR', 'P0', 'pageerror: ' + e.message, e.stack || null));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!/favicon|net::ERR/.test(t)) rec('CONSOLE', 'P1', 'console.error: ' + t.slice(0, 180), t);
    }
  });
  page.on('dialog', async (d) => { try { await d.accept(); } catch (e) {} });
}

(async () => {
  const { browser, page } = await launch();
  hook(page);
  try {
    // ========== COACH with bench: 外租/下放 buttons ==========
    await clearAndStart(page);
    await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });
    const coach = await page.evaluate(() => {
      switchStartTab('coach');
      pickCoachClub(0);
      applyCoachClub();
      try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
      // ensure bench: add a clone-ish extra player if needed
      const bench = rosterBench(S);
      return { n: S.players.length, bench: bench.length, mode: S.mode, team: S.teamName };
    });
    console.log('COACH', JSON.stringify(coach));

    // If no bench, force one out of lineup
    const benchUI = await page.evaluate(() => {
      if (!rosterBench(S).length) {
        const ls = rosterLineup(S);
        const t = ls[ls.length - 1];
        if (t) {
          // remove from lineup without replacement by temporarily emptying same-pos bench injuries
          S.players.forEach(x => { if (x.pos === t.pos && x.id !== t.id) x.injury = 9; });
          S.lineup = S.lineup.filter(id => id !== t.id);
        }
      }
      goPage('lineup');
      const btns = [...document.querySelectorAll('#page-lineup button')].map(b => ({
        text: b.textContent.trim().slice(0, 24),
        onclick: b.getAttribute('onclick'),
        disabled: !!b.disabled,
      }));
      return {
        benchCount: rosterBench(S).length,
        loanOutBtns: btns.filter(b => /clubLoanOutPlayer/.test(b.onclick || '')),
        sendKjiaBtns: btns.filter(b => /sendKjia/.test(b.onclick || '')),
        sellBtns: btns.filter(b => /openSellNego/.test(b.onclick || '')),
        recallBtns: btns.filter(b => /recallKjia/.test(b.onclick || '')),
        all: btns.map(b => b.onclick).filter(Boolean),
      };
    });
    console.log('BENCH_UI', JSON.stringify(benchUI, null, 2));

    // Click 外租 as coach
    const loanOutClick = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('#page-lineup button')].find(b => /clubLoanOutPlayer/.test(b.getAttribute('onclick') || '') && !b.disabled);
      if (!btn) return { ok: false, reason: 'no-btn', bench: rosterBench(S).length };
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      let err = null;
      const before = S.players.map(p => ({ id: p.id, lo: !!p.loanOut }));
      try { btn.click(); } catch (e) { err = e.message; } finally { toast = orig; }
      const after = S.players.map(p => ({ id: p.id, lo: !!p.loanOut }));
      return { ok: true, err, toasts, changed: JSON.stringify(before) !== JSON.stringify(after), before, after };
    });
    console.log('LOANOUT_CLICK', JSON.stringify(loanOutClick, null, 2));
    if (loanOutClick.ok && loanOutClick.changed) {
      const t = (loanOutClick.toasts || []).join('|');
      if (!/教练|不能/.test(t)) {
        rec('P0-COACH-LOANOUT-PRIV', 'P0', '教练「外租练级」实际生效（loanOut 规则仅经理）', JSON.stringify(loanOutClick));
      }
    } else if (loanOutClick.ok && !loanOutClick.changed) {
      const t = (loanOutClick.toasts || []).join('|');
      if (!t) rec('P1-COACH-LOANOUT-DEAD', 'P1', '教练点外租无反馈', JSON.stringify(loanOutClick));
      else rec('P2-COACH-LOANOUT-BTN-UI', 'P2', '教练阵容页暴露「外租练级」按钮（引擎有挡则仅 UI 泄漏）', JSON.stringify({ loanOutClick, benchUI }));
    }

    // sendKjia as coach (expected allowed)
    const sendKjia = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('#page-lineup button')].find(b => /sendKjia/.test(b.getAttribute('onclick') || '') && !b.disabled);
      if (!btn) return { ok: false };
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      let err = null;
      try { btn.click(); } catch (e) { err = e.message; } finally { toast = orig; }
      return { ok: true, err, toasts, anyKjia: S.players.some(p => (p.kjia || 0) > 0) };
    });
    console.log('SEND_KJIA', JSON.stringify(sendKjia, null, 2));

    // clubLoanOutPlayer engine direct
    const engineLoanOut = await page.evaluate(() => {
      const p = rosterBench(S)[0] || S.players.find(x => !S.lineup.includes(x.id));
      if (!p) return { ok: false, reason: 'no-bench' };
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      let err = null, res = null;
      try { res = clubLoanOutPlayer(S, p.id); } catch (e) { err = e.message; } finally { toast = orig; }
      return { ok: true, err, res, toasts, loanOut: !!(S.players.find(x => x.id === p.id) || {}).loanOut, pid: p.id };
    });
    console.log('ENGINE_LOANOUT', JSON.stringify(engineLoanOut, null, 2));
    if (engineLoanOut.loanOut && !/教练|不能/.test((engineLoanOut.toasts || []).join('|'))) {
      rec('P0-COACH-LOANOUT-ENGINE', 'P0', 'clubLoanOutPlayer 对教练无 denyIfBlocked，外租生效', JSON.stringify(engineLoanOut));
    }

    // coach page hints rendered
    const hints = await page.evaluate(() => {
      const out = {};
      for (const name of ['market', 'lineup', 'kjia']) {
        goPage(name);
        const t = (document.getElementById('page-' + name) || {}).innerText || '';
        out[name] = t.slice(0, 180);
      }
      return out;
    });
    console.log('HINTS', JSON.stringify(hints, null, 2));
    if (/买人卖人/.test(hints.market || '')) rec('P2-COACH-MARKET-HINT', 'P2', '教练转会页 hint 经理向「买人卖人」', hints.market);
    if (/挂牌出售/.test(hints.lineup || '')) rec('P2-COACH-LINEUP-HINT', 'P2', '教练阵容页 hint 含「挂牌出售」', hints.lineup);
    if (/表现好可提拔上一队/.test(hints.kjia || '')) rec('P2-COACH-KJIA-HINT-PROMOTE', 'P2', '教练二队页 hint 仍写「表现好可提拔上一队」', hints.kjia);

    // ========== PLAYER: age>=18 bench panel + self kjia/loan ==========
    await clearAndStart(page);
    await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });
    const player = await page.evaluate(() => {
      switchStartTab('player');
      pickPlayerArch(1); // often adult
      pickPlayerPos('mid');
      const teams = window._pcTeams || [];
      if (teams[0]) pickPlayerTeam(teams[0].name);
      createPlayerCareer();
      try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
      const me = S.players.find(p => S.career && p.id === S.career.me);
      // force adult + bench
      me.age = 20;
      me.injury = 0;
      S.lineup = (S.lineup || []).filter(id => id !== S.career.me);
      S.career.benchDays = 4;
      goPage('career');
      const t = (document.getElementById('page-career') || {}).innerText || '';
      const btns = [...document.querySelectorAll('#page-career button')].map(b => ({
        text: b.textContent.trim().slice(0, 28),
        onclick: b.getAttribute('onclick'),
        disabled: !!b.disabled,
      }));
      return {
        age: me.age,
        starter: (S.lineup || []).includes(S.career.me),
        hasBench: /板凳出路/.test(t),
        loanBtn: btns.find(b => /playerRequestLoanOut/.test(b.onclick || '')),
        kjiaBtn: btns.find(b => /playerRequestKjia/.test(b.onclick || '')),
        head: t.slice(0, 250),
      };
    });
    console.log('PLAYER_BENCH', JSON.stringify(player, null, 2));
    if (!player.hasBench) {
      rec('P1-PLAYER-BENCH-MISS-ADULT', 'P1', '成年非首发无「板凳出路」面板', JSON.stringify(player));
    }

    // click 下放K甲
    const kjiaReq = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('#page-career button')].find(b => /playerRequestKjia/.test(b.getAttribute('onclick') || '') && !b.disabled);
      if (!btn) return { ok: false, reason: 'no-btn' };
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      let err = null;
      try { btn.click(); } catch (e) { err = e.message; } finally { toast = orig; }
      const me = S.players.find(p => S.career && p.id === S.career.me);
      return { ok: true, err, toasts, kjia: me && me.kjia };
    });
    console.log('KJIA_REQ', JSON.stringify(kjiaReq, null, 2));

    // underage: confirm panel hidden and whether playerRequestKjia still callable
    const under = await page.evaluate(() => {
      const me = S.players.find(p => S.career && p.id === S.career.me);
      me.age = 16;
      me.kjia = 0;
      me.loanOut = null;
      S.career.benchDays = 5;
      S.lineup = (S.lineup || []).filter(id => id !== S.career.me);
      goPage('career');
      const t = (document.getElementById('page-career') || {}).innerText || '';
      const hasBench = /板凳出路/.test(t);
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      let err = null, res = null;
      try { res = playerRequestKjia(S); } catch (e) { err = e.message; } finally { toast = orig; }
      return { hasBench, err, res, toasts, kjia: me.kjia, age: me.age };
    });
    console.log('UNDER_KJIA', JSON.stringify(under, null, 2));
    if (!under.hasBench && under.age < 18) {
      rec('P2-PLAYER-UNDERAGE-NO-BENCH-UI', 'P2', '未成年非首发无板凳出路 UI（文案写「K甲可随时申请」却入口隐藏）', JSON.stringify(under));
    }

    // ========== offer edge + deal log ==========
    await clearAndStart(page);
    await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });
    await page.evaluate(() => {
      switchStartTab('coach');
      pickCoachClub(2);
      applyCoachClub();
      try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
    });
    const offerEdge = await page.evaluate(() => {
      const out = {};
      const run = (label, offer) => {
        const toasts = [];
        const orig = toast;
        toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
        let err = null;
        const beforeTeam = S.teamName;
        try {
          S.coachOffer = offer;
          respondCoachOffer(true);
        } catch (e) { err = e.message; } finally { toast = orig; }
        return { label, err, toasts, beforeTeam, afterTeam: S.teamName, offerLeft: !!S.coachOffer };
      };
      out.empty = run('empty', { team: '' });
      out.nullTeam = run('nullTeam', { team: null });
      out.noTeam = run('noTeam', {});
      out.spaces = run('spaces', { team: '  成都AG超玩会  ' });
      return out;
    });
    console.log('OFFER_EDGE', JSON.stringify(offerEdge, null, 2));
    for (const [k, v] of Object.entries(offerEdge)) {
      if ((v.toasts || []).length === 0 && !v.err) {
        rec('P1-OFFER-EDGE-SILENT', 'P1', `豪门邀约边界(${k})无 toast`, JSON.stringify(v));
      }
      if (v.err) rec('P1-OFFER-EDGE-THROW', 'P1', `豪门邀约边界(${k})抛错 ${v.err}`, JSON.stringify(v));
    }

    // deal log for invalid offer
    const dealLog = await page.evaluate(() => {
      S.coachOffer = { team: 'NOT_A_CLUB' };
      respondCoachOffer(true);
      return {
        dealLog: ((S.coachDeal && S.coachDeal.log) || []).slice(0, 6),
        hasLog: /无法接受|作废|NOT_A/.test(JSON.stringify((S.coachDeal && S.coachDeal.log) || [])),
      };
    });
    console.log('DEAL_LOG', JSON.stringify(dealLog, null, 2));
    if (!dealLog.hasLog) {
      rec('P2-OFFER-BAD-NO-DEALLOG', 'P2', '非法邀约未写入执教履历 deal.log（仅 toast/事件）', JSON.stringify(dealLog));
    }

    // ========== player match after result modal dead buttons ==========
    await clearAndStart(page);
    await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });
    const matchUi = await page.evaluate(() => {
      switchStartTab('player');
      pickPlayerArch(0);
      pickPlayerPos('jg');
      const teams = window._pcTeams || [];
      if (teams[0]) pickPlayerTeam(teams[0].name);
      createPlayerCareer();
      try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
      goPage('club');
      const btn = [...document.querySelectorAll('#page-club button')].find(b => /startPlayerMatch/.test(b.getAttribute('onclick') || ''));
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      try { if (btn) btn.click(); } finally { toast = orig; }
      const modal = document.querySelector('#app-modal');
      const modalBtns = modal ? [...modal.querySelectorAll('button')].map(b => ({
        text: b.textContent.trim().slice(0, 30),
        onclick: b.getAttribute('onclick'),
        disabled: !!b.disabled,
      })) : [];
      return {
        modalOpen: !!document.querySelector('#app-modal.on'),
        modalText: ((modal || {}).innerText || '').slice(0, 300),
        modalBtns,
        toasts,
        matchIdx: S.matchIdx,
        history: (S.history || []).length,
      };
    });
    console.log('MATCH_UI', JSON.stringify(matchUi, null, 2));
    // click every modal button and see if anything dead
    const modalClicks = await page.evaluate(() => {
      const results = [];
      const modal = document.querySelector('#app-modal');
      if (!modal) return { ok: false };
      const btns = [...modal.querySelectorAll('button')];
      for (const btn of btns) {
        const toasts = [];
        const orig = toast;
        toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
        let err = null;
        const beforeOpen = !!document.querySelector('#app-modal.on');
        try { btn.click(); } catch (e) { err = e.message; } finally { toast = orig; }
        results.push({
          text: btn.textContent.trim().slice(0, 30),
          onclick: btn.getAttribute('onclick'),
          err, toasts,
          stillOpen: !!document.querySelector('#app-modal.on'),
          wasOpen: beforeOpen,
        });
        // reopen? if modal closed, stop
        if (!document.querySelector('#app-modal.on')) break;
      }
      return { ok: true, results };
    });
    console.log('MODAL_CLICKS', JSON.stringify(modalClicks, null, 2));
    for (const r of (modalClicks.results || [])) {
      if (!r.err && r.wasOpen && r.stillOpen && (r.toasts || []).length === 0) {
        rec('P1-MODAL-BTN-DEAD', 'P1', `赛后弹窗按钮无反应: ${r.text}`, JSON.stringify(r));
      }
      if (r.err) rec('P1-MODAL-BTN-THROW', 'P1', `赛后弹窗按钮抛错: ${r.text} ${r.err}`, JSON.stringify(r));
    }

    // ========== openBP after real startMatch (coach) then wipe series ==========
    await clearAndStart(page);
    await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });
    const coachBp = await page.evaluate(() => {
      switchStartTab('coach');
      pickCoachClub(3);
      applyCoachClub();
      try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
      goPage('club');
      const btn = [...document.querySelectorAll('#page-club button')].find(b => /uiStartMatch/.test(b.getAttribute('onclick') || ''));
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      let err = null;
      try { if (btn) btn.click(); } catch (e) { err = e.message; } finally { toast = orig; }
      const modal = document.querySelector('#app-modal');
      const enter = modal && [...modal.querySelectorAll('button')].find(b => /进入 BP|openBP/.test((b.textContent || '') + (b.getAttribute('onclick') || '')));
      let bpErr = null, draft = typeof window._draft;
      if (enter) {
        try { enter.click(); draft = typeof window._draft; } catch (e) { bpErr = e.message; }
      }
      return {
        err, bpErr, draft,
        hasEnter: !!enter,
        modalText: ((modal || {}).innerText || '').slice(0, 200),
        toasts,
      };
    });
    console.log('COACH_BP', JSON.stringify(coachBp, null, 2));

    // After BP, try confirm/playGame path briefly
    const bpConfirm = await page.evaluate(() => {
      if (typeof window._draft !== 'object' || !window._draft) return { ok: false, reason: 'no-draft' };
      // look for confirm button
      const btns = [...document.querySelectorAll('button')].filter(b => /确认|开赛|确定/.test(b.textContent || '') && b.offsetParent !== null);
      return {
        ok: true,
        draftIdx: window._draft.idx,
        steps: window._draft.steps && window._draft.steps.length,
        btns: btns.map(b => ({ text: b.textContent.trim().slice(0, 20), onclick: b.getAttribute('onclick') })).slice(0, 8),
      };
    });
    console.log('BP_CONFIRM', JSON.stringify(bpConfirm, null, 2));

    await shot(page, 'pc8c-final');

    const unique = [];
    const seen = new Set();
    for (const f of findings) {
      const key = f.id + '|' + f.title.slice(0, 50);
      if (!seen.has(key)) { seen.add(key); unique.push(f); }
    }
    const summary = {
      counts: {
        P0: unique.filter(f => f.sev === 'P0').length,
        P1: unique.filter(f => f.sev === 'P1').length,
        P2: unique.filter(f => f.sev === 'P2').length,
      },
      findings: unique,
    };
    console.log('SUMMARY', JSON.stringify(summary, null, 2));
    fs.writeFileSync('E:\\sex\\kpl-manager\\.bug-hunt\\pc-subagent-probe8c.json',
      JSON.stringify({ summary, coach, benchUI, loanOutClick, sendKjia, engineLoanOut, hints, player, kjiaReq, under, offerEdge, dealLog, matchUi, modalClicks, coachBp, bpConfirm }, null, 2), 'utf8');
  } catch (e) {
    console.error('FATAL', e && e.stack || e);
    rec('FATAL', 'P0', 'probe fatal', String(e && e.stack || e));
    try {
      fs.writeFileSync('E:\\sex\\kpl-manager\\.bug-hunt\\pc-subagent-probe8c.json', JSON.stringify({ findings, fatal: String(e.stack || e) }, null, 2), 'utf8');
    } catch (e2) {}
  } finally {
    await browser.close();
  }
})();
