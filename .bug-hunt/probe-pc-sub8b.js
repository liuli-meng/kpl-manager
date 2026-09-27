// Deep privilege + dead-click probe (sub8b)
const fs = require('fs');
const { launch, shot, clearAndStart } = require('../tests/playthrough/pw.js');

const findings = [];
function rec(id, sev, title, detail, evidence) {
  findings.push({ id, sev, title, detail, evidence: evidence || null });
  console.log(`[${sev}] ${id} ${title}`);
  if (detail) console.log('   ', String(detail).slice(0, 500));
}
function hook(page) {
  page.on('pageerror', (e) => {
    rec('PAGEERROR', 'P0', 'pageerror: ' + e.message, e.stack || null);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!/favicon|net::ERR/.test(t)) rec('CONSOLE', 'P1', 'console.error: ' + t.slice(0, 180), t);
    }
  });
  page.on('dialog', async (d) => {
    try { await d.accept(); } catch (e) {}
  });
}

(async () => {
  const { browser, page } = await launch();
  hook(page);
  try {
    await clearAndStart(page);
    await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });

    // ========== COACH: clubLoanOutPlayer / sendKjia UI presence + engine ==========
    const coachBoot = await page.evaluate(() => {
      switchStartTab('coach');
      pickCoachClub(1);
      applyCoachClub();
      try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
      return { mode: S.mode, team: S.teamName, n: S.players.length };
    });
    console.log('COACH', JSON.stringify(coachBoot));

    const lineupLeak = await page.evaluate(() => {
      goPage('lineup');
      const el = document.getElementById('page-lineup');
      const btns = [...(el ? el.querySelectorAll('button') : [])].map(b => ({
        text: b.textContent.trim().slice(0, 24),
        onclick: b.getAttribute('onclick'),
        disabled: !!b.disabled,
      }));
      return {
        loanOutBtns: btns.filter(b => /clubLoanOutPlayer/.test(b.onclick || '')),
        sendKjiaBtns: btns.filter(b => /sendKjia/.test(b.onclick || '')),
        sellBtns: btns.filter(b => /openSellNego|listPlayer/.test(b.onclick || '')),
        recallBtns: btns.filter(b => /recallKjia/.test(b.onclick || '')),
        swapBtns: btns.filter(b => /swapPlayer/.test(b.onclick || '')),
        benchCount: (rosterBench(S) || []).length,
      };
    });
    console.log('LINEUP_LEAK', JSON.stringify(lineupLeak, null, 2));

    // Click 外租练级 as coach (UI reachable)
    const loanClick = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('#page-lineup button')].find(b => /clubLoanOutPlayer/.test(b.getAttribute('onclick') || '') && !b.disabled);
      if (!btn) return { ok: false, reason: 'no-btn' };
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      let err = null;
      const before = S.players.map(p => ({ id: p.id, loanOut: p.loanOut }));
      try { btn.click(); } catch (e) { err = e.message; } finally { toast = orig; }
      const after = S.players.map(p => ({ id: p.id, loanOut: p.loanOut }));
      return {
        ok: true,
        onclick: btn.getAttribute('onclick'),
        err, toasts,
        changed: JSON.stringify(before) !== JSON.stringify(after),
        before, after,
      };
    });
    console.log('LOAN_CLICK', JSON.stringify(loanClick, null, 2));
    if (loanClick.ok && loanClick.changed && (loanClick.toasts || []).join('').indexOf('教练') < 0 && (loanClick.toasts || []).join('').indexOf('不能') < 0) {
      rec('P0-COACH-LOANOUT-UI', 'P0', '教练阵容页「外租练级」实际生效（loanOut 本应仅经理）', JSON.stringify(loanClick));
    } else if (loanClick.ok && !loanClick.changed && (loanClick.toasts || []).length === 0) {
      rec('P1-COACH-LOANOUT-DEAD', 'P1', '教练点「外租练级」无 toast 无效果', JSON.stringify(loanClick));
    } else if (loanClick.ok && !loanClick.changed) {
      // blocked with toast is OK-ish, but UI still shows the button = P2
      rec('P2-COACH-LOANOUT-BTN-LEAK', 'P2', '教练阵容页仍渲染「外租练级」按钮（引擎已挡）', JSON.stringify({ loanClick, lineupLeak }));
    }

    // sendKjia as coach (should be allowed - kjiaDown)
    const kjiaClick = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('#page-lineup button')].find(b => /sendKjia/.test(b.getAttribute('onclick') || '') && !b.disabled);
      if (!btn) return { ok: false, reason: 'no-btn' };
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      let err = null;
      const before = (S.players || []).map(p => p.kjia || 0);
      try { btn.click(); } catch (e) { err = e.message; } finally { toast = orig; }
      const after = (S.players || []).map(p => p.kjia || 0);
      return { ok: true, err, toasts, changed: JSON.stringify(before) !== JSON.stringify(after), before, after };
    });
    console.log('KJIA_CLICK', JSON.stringify(kjiaClick, null, 2));

    // openSellNego as coach via engine (already know blocked) + UI swap
    const sellUiCheck = await page.evaluate(() => {
      // open player card / bench card actions
      const all = [...document.querySelectorAll('#page-lineup button, #page-market button, #page-club button')].map(b => ({
        text: b.textContent.trim().slice(0, 20),
        onclick: b.getAttribute('onclick'),
      }));
      return {
        sell: all.filter(b => /openSellNego|listPlayer|出售|挂牌/.test((b.onclick || '') + b.text)),
        renew: all.filter(b => /renewPlayer/.test(b.onclick || '')),
        release: all.filter(b => /releasePlayer/.test(b.onclick || '')),
      };
    });
    console.log('SELL_UI', JSON.stringify(sellUiCheck, null, 2));

    await shot(page, 'pc8b-coach-lineup');

    // doTrain as coach (should work)
    const trainClick = await page.evaluate(() => {
      goPage('train');
      const btn = [...document.querySelectorAll('#page-train button')].find(b => /doTrain\(/.test(b.getAttribute('onclick') || '') && !b.disabled);
      if (!btn) return { ok: false };
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      let err = null;
      const before = JSON.stringify((S.players || []).map(p => p.attrs));
      try { btn.click(); } catch (e) { err = e.message; } finally { toast = orig; }
      const after = JSON.stringify((S.players || []).map(p => p.attrs));
      return { ok: true, err, toasts, changed: before !== after, trained: S.trained };
    });
    console.log('TRAIN_CLICK', JSON.stringify(trainClick, null, 2));
    if (trainClick.ok && !trainClick.changed && (trainClick.toasts || []).length === 0) {
      rec('P0-COACH-TRAIN-DEAD', 'P0', '教练训练按钮点击无反应', JSON.stringify(trainClick));
    }

    // setCaptain / setTactic dead-click
    const tacticClick = await page.evaluate(() => {
      goPage('lineup');
      const before = S.tactic;
      const btn = [...document.querySelectorAll('#page-lineup button')].find(b => /setTactic\(/.test(b.getAttribute('onclick') || ''));
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      let err = null;
      try { btn.click(); } catch (e) { err = e.message; } finally { toast = orig; }
      return { before, after: S.tactic, toasts, err, btnText: btn && btn.textContent.trim().slice(0, 16) };
    });
    console.log('TACTIC_CLICK', JSON.stringify(tacticClick));

    // ========== PLAYER: openBP crash + bench path + kjia self request ==========
    await clearAndStart(page);
    await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });
    const playerBoot = await page.evaluate(() => {
      switchStartTab('player');
      pickPlayerArch(0);
      pickPlayerPos('ad');
      const teams = window._pcTeams || [];
      if (teams[0]) pickPlayerTeam(teams[0].name);
      createPlayerCareer();
      try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
      const me = S.players.find(p => S.career && p.id === S.career.me);
      return {
        mode: S.mode,
        starter: (S.lineup || []).includes(S.career.me),
        age: me && me.age,
        pos: me && me.pos,
      };
    });
    console.log('PLAYER', JSON.stringify(playerBoot));

    // Force bench: remove me from lineup, advance a few days
    const benchPath = await page.evaluate(() => {
      const meId = S.career.me;
      S.lineup = (S.lineup || []).filter(id => id !== meId);
      // bump benchDays
      S.career.benchDays = 5;
      goPage('career');
      const el = document.getElementById('page-career');
      const text = (el && el.innerText) || '';
      const btns = [...(el ? el.querySelectorAll('button') : [])].map(b => ({
        text: b.textContent.trim().slice(0, 28),
        onclick: b.getAttribute('onclick'),
        disabled: !!b.disabled,
      }));
      return {
        hasBenchPanel: /板凳出路/.test(text),
        loanBtn: btns.find(b => /playerRequestLoanOut/.test(b.onclick || '')),
        kjiaBtn: btns.find(b => /playerRequestKjia/.test(b.onclick || '')),
        textHasLoan: /租借离队/.test(text),
        textHasKjia: /下放 K甲/.test(text),
      };
    });
    console.log('BENCH_PATH', JSON.stringify(benchPath, null, 2));
    if (!benchPath.hasBenchPanel && playerBoot.starter === false) {
      rec('P1-PLAYER-BENCH-PANEL-MISS', 'P1', '非首发选手生涯页无「板凳出路」', JSON.stringify(benchPath));
    }

    // Click 下放 K甲 (confirm dialog auto-accepted)
    const kjiaSelf = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('#page-career button')].find(b => /playerRequestKjia/.test(b.getAttribute('onclick') || '') && !b.disabled);
      if (!btn) return { ok: false, reason: 'no-btn' };
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      let err = null;
      const meBefore = (S.players.find(p => S.career && p.id === S.career.me) || {}).kjia;
      try { btn.click(); } catch (e) { err = e.message; } finally { toast = orig; }
      const meAfter = (S.players.find(p => S.career && p.id === S.career.me) || {}).kjia;
      return { ok: true, err, toasts, meBefore, meAfter, moved: meAfter > 0 };
    });
    console.log('KJIA_SELF', JSON.stringify(kjiaSelf, null, 2));
    if (kjiaSelf.ok && !kjiaSelf.moved && (kjiaSelf.toasts || []).length === 0) {
      rec('P1-PLAYER-KJIA-REQUEST-DEAD', 'P1', '选手自请下放K甲无反馈', JSON.stringify(kjiaSelf));
    }

    // openBP as player - expect crash (already saw)
    const openBp = await page.evaluate(() => {
      let err = null;
      let draftBefore = typeof window._draft;
      try { openBP('PRIV_TEST', function () {}); } catch (e) { err = e.message; }
      return { err, draftBefore, draftAfter: typeof window._draft, hasDraft: !!(window._draft && window._draft.ls) };
    });
    console.log('OPENBP', JSON.stringify(openBp));
    if (openBp.err) {
      rec('P1-OPENBP-NO-GUARD-THROW', 'P1', 'openBP 无权限门禁且无 series 时直接 TypeError（选手/任意模式）', JSON.stringify(openBp));
    } else if (openBp.hasDraft) {
      rec('P0-PLAYER-OPENBP-LEAK', 'P0', '选手身份 openBP 成功打开 BP', JSON.stringify(openBp));
    }

    // startPlayerMatch vs startMatch cross
    const cross = await page.evaluate(() => {
      const out = {};
      const run = (name, fn) => {
        const toasts = [];
        const orig = toast;
        toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
        let err = null;
        try { fn(); } catch (e) { err = e.message; } finally { toast = orig; }
        return { err, toasts, series: !!S.series, matchIdx: S.matchIdx };
      };
      out.startMatchAsPlayer = run('startMatch', () => startMatch());
      out.openBPAsPlayer = run('openBP', () => { try { openBP('X', function () {}); } catch (e) { return e.message; } });
      return out;
    });
    console.log('CROSS', JSON.stringify(cross, null, 2));

    // player media natural path - inject and ensure button only on career
    const mediaPriv = await page.evaluate(() => {
      const q = mediaPool()[0];
      S.career.media = { id: q.id, q: q.q, opts: q.opts.map(o => ({ id: o.id, l: o.l, tip: o.tip })), day: S.day, ctx: 'test' };
      goPage('club');
      const clubHas = /playerRespondMedia/.test((document.getElementById('page-club') || {}).innerHTML || '');
      goPage('career');
      const careerHas = /playerRespondMedia/.test((document.getElementById('page-career') || {}).innerHTML || '');
      return { clubHas, careerHas };
    });
    console.log('MEDIA_PRIV', JSON.stringify(mediaPriv));

    // ========== COACH: openBP without series + buyPlayer silent ==========
    await clearAndStart(page);
    await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });
    await page.evaluate(() => {
      switchStartTab('coach');
      pickCoachClub(0);
      applyCoachClub();
      try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
    });

    const coachOpenBp = await page.evaluate(() => {
      // wipe series like after match
      S.series = null;
      let err = null;
      try { openBP('NO_SERIES', function () {}); } catch (e) { err = e.message; }
      return { err, draft: typeof window._draft };
    });
    console.log('COACH_OPENBP_NOSERIES', JSON.stringify(coachOpenBp));
    if (coachOpenBp.err) {
      rec('P1-OPENBP-NOSERIES-THROW', 'P1', 'openBP 在无 series 时抛 TypeError（赛前/换队后误入会炸）', JSON.stringify(coachOpenBp));
    }

    // coachRequest vs loanPlayer dual buttons - click loanPlayer (立即租借)
    const loanInClick = await page.evaluate(() => {
      goPage('market');
      const btn = [...document.querySelectorAll('#page-market button')].find(b => /loanPlayer\(/.test(b.getAttribute('onclick') || '') && !b.disabled);
      if (!btn) return { ok: false, reason: 'no-btn' };
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      let err = null;
      const before = S.players.length;
      try { btn.click(); } catch (e) { err = e.message; } finally { toast = orig; }
      return { ok: true, err, toasts, before, after: S.players.length, grew: S.players.length > before };
    });
    console.log('LOANIN_CLICK', JSON.stringify(loanInClick, null, 2));

    // renewPlayer / releasePlayer as coach via engine
    const coachOps = await page.evaluate(() => {
      const p = (S.players || [])[0];
      const out = {};
      const run = (name, fn) => {
        const toasts = [];
        const orig = toast;
        toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
        let err = null;
        try { fn(); } catch (e) { err = e.message; } finally { toast = orig; }
        return { err, toasts };
      };
      if (p) {
        out.renewPlayer = run('renew', () => renewPlayer(S, p.id));
        out.releasePlayer = run('release', () => releasePlayer(S, p.id));
        out.openSellNego = run('sell', () => openSellNego(S, p.id));
      }
      out.signFreeAgent = run('fa', () => {
        const fa = (S.market || [])[0];
        if (fa && typeof signFreeAgent === 'function') signFreeAgent(S, fa.id);
        return 'tried';
      });
      out.draft = run('draft', () => { if (typeof runDraft === 'function') runDraft(S); return 'tried'; });
      return out;
    });
    console.log('COACH_OPS', JSON.stringify(coachOps, null, 2));

    // Check swapPlayer toast mentions 出售/挂牌 for coach (manager copy leak)
    const swapCopy = await page.evaluate(() => {
      goPage('lineup');
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      // remove a starter with no same-pos bench to trigger the "可出售/挂牌" toast
      const ls = rosterLineup(S);
      const target = ls[ls.length - 1];
      try {
        // force no same-pos bench
        const pos = target.pos;
        const saved = S.players.filter(x => x.pos === pos && !S.lineup.includes(x.id)).map(x => x.injury);
        S.players.forEach(x => { if (x.pos === pos && !S.lineup.includes(x.id)) x.injury = 5; });
        swapPlayer(target.id);
        S.players.forEach((x, i) => { if (x.pos === pos && !S.lineup.includes(x.id)) x.injury = 0; });
      } finally { toast = orig; }
      return { toasts, mode: S.mode };
    });
    console.log('SWAP_COPY', JSON.stringify(swapCopy, null, 2));
    if ((swapCopy.toasts || []).join('').match(/出售|挂牌/) && swapCopy.mode === 'coach') {
      rec('P2-COACH-SWAP-MANAGER-COPY', 'P2', '教练换下空位 toast 仍说「可出售/挂牌」', JSON.stringify(swapCopy));
    }

    // guide hints for coach market/lineup
    const hints = await page.evaluate(() => {
      return {
        market: (typeof PAGE_HINTS !== 'undefined' && PAGE_HINTS.market) || null,
        lineup: (typeof PAGE_HINTS !== 'undefined' && PAGE_HINTS.lineup) || null,
        kjia: (typeof PAGE_HINTS !== 'undefined' && PAGE_HINTS.kjia) || null,
      };
    });
    console.log('HINTS', JSON.stringify(hints, null, 2));
    if (hints.market && /买人卖人/.test(hints.market) ) {
      // only issue if rendered for coach - check page text
      goPage('market');
      const t = (document.getElementById('page-market') || {}).innerText || '';
      if (/买人卖人/.test(t)) {
        rec('P2-COACH-MARKET-HINT-MGR', 'P2', '教练转会页 hint 仍以经理「买人卖人」开头', t.slice(0, 120));
      }
    }
    if (hints.lineup && /挂牌出售/.test(hints.lineup)) {
      goPage('lineup');
      const t = (document.getElementById('page-lineup') || {}).innerText || '';
      if (/挂牌出售/.test(t)) {
        rec('P2-COACH-LINEUP-HINT-MGR', 'P2', '教练阵容页 hint 仍含经理向「挂牌出售」', t.slice(0, 120));
      }
    }

    // ========== PLAYER: retirement / injury train button + goPage after career ==========
    await clearAndStart(page);
    await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });
    const injRet = await page.evaluate(() => {
      switchStartTab('player');
      pickPlayerArch(2);
      pickPlayerPos('sup');
      const teams = window._pcTeams || [];
      if (teams[1]) pickPlayerTeam(teams[1].name);
      createPlayerCareer();
      try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
      const me = S.players.find(p => S.career && p.id === S.career.me);
      me.injury = 4;
      goPage('career');
      const btns = [...document.querySelectorAll('#page-career button')].map(b => ({
        text: b.textContent.trim().slice(0, 20),
        onclick: b.getAttribute('onclick'),
        disabled: !!b.disabled,
      }));
      const train = btns.filter(b => /playerTrain\(/.test(b.onclick || ''));
      // click disabled train? shouldn't work
      let clickRes = null;
      const btn = [...document.querySelectorAll('#page-career button')].find(b => /playerTrain\('lane'\)/.test(b.getAttribute('onclick') || ''));
      if (btn) {
        const toasts = [];
        const orig = toast;
        toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
        const before = S.career.stats.trained;
        btn.click(); // click even if disabled - browsers may still fire
        clickRes = { disabled: btn.disabled, toasts, trainedBefore: before, trainedAfter: S.career.stats.trained, injury: me.injury };
        toast = orig;
      }
      return { trainBtns: train, clickRes, injury: me.injury };
    });
    console.log('INJ', JSON.stringify(injRet, null, 2));
    if (injRet.clickRes && !injRet.clickRes.disabled && injRet.clickRes.injury > 0) {
      // if train still enabled while injured
      if (injRet.clickRes.trainedAfter > injRet.clickRes.trainedBefore) {
        rec('P2-PLAYER-TRAIN-WHILE-INJURED', 'P2', '伤停仍可加练', JSON.stringify(injRet));
      }
    }

    // underage player match
    const under = await page.evaluate(() => {
      const me = S.players.find(p => S.career && p.id === S.career.me);
      me.age = 16;
      S.lineup = (S.lineup || []).filter(id => id !== S.career.me);
      goPage('club');
      const btn = [...document.querySelectorAll('#page-club button')].find(b => /startPlayerMatch/.test(b.getAttribute('onclick') || ''));
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      let err = null;
      const before = S.matchIdx;
      try { if (btn) btn.click(); } catch (e) { err = e.message; } finally { toast = orig; }
      return { err, toasts, matchBefore: before, matchAfter: S.matchIdx, btnFound: !!btn, age: me.age, inLineup: (S.lineup || []).includes(S.career.me) };
    });
    console.log('UNDER_MATCH', JSON.stringify(under, null, 2));

    // pickPlayerPos invalid again for exact error
    await clearAndStart(page);
    const pos2 = await page.evaluate(() => {
      switchStartTab('player');
      pickPlayerArch(0);
      let err = null;
      let toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      try {
        pickPlayerPos('TOP'); // case
        createPlayerCareer();
      } catch (e) { err = e.message; } finally { toast = orig; }
      return { err, toasts, mode: S && S.mode };
    });
    console.log('POS_CASE', JSON.stringify(pos2, null, 2));

    // respondCoachOffer with empty/null team
    await clearAndStart(page);
    await page.evaluate(() => {
      switchStartTab('coach');
      pickCoachClub(0);
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
      out.weird = run('weird', { team: '  成都AG超玩会  ' }); // whitespace
      return out;
    });
    console.log('OFFER_EDGE', JSON.stringify(offerEdge, null, 2));
    for (const [k, v] of Object.entries(offerEdge)) {
      if ((v.toasts || []).length === 0 && !v.err) {
        rec('P1-OFFER-EDGE-SILENT', 'P1', `豪门邀约边界(${k})接受无 toast`, JSON.stringify(v));
      }
      if (v.err) rec('P1-OFFER-EDGE-THROW', 'P1', `豪门邀约边界(${k})抛错 ${v.err}`, JSON.stringify(v));
    }

    // Check coachDeal.log for invalid offer - code path doesn't write deal log
    const dealLog = await page.evaluate(() => {
      S.coachOffer = { team: 'NOT_A_CLUB' };
      respondCoachOffer(true);
      return {
        dealLog: (S.coachDeal && S.coachDeal.log || []).slice(0, 5),
        eventLog: (S.events || S.log || []).slice(-5).map(e => (e.t || e.text || e.msg || JSON.stringify(e)).slice(0, 80)),
      };
    });
    console.log('DEAL_LOG', JSON.stringify(dealLog, null, 2));

    await shot(page, 'pc8b-final');

    // unique findings
    const unique = [];
    const seen = new Set();
    for (const f of findings) {
      const key = f.id + '|' + f.title.slice(0, 50);
      if (!seen.has(key)) { seen.add(key); unique.push(f); }
    }
    const summary = {
      counts: {
        P0: unique.filter(f => f.sev === 'P0' || f.sev === 'FAIL').length,
        P1: unique.filter(f => f.sev === 'P1').length,
        P2: unique.filter(f => f.sev === 'P2').length,
      },
      findings: unique,
    };
    console.log('SUMMARY', JSON.stringify(summary, null, 2));
    fs.writeFileSync('E:\\sex\\kpl-manager\\.bug-hunt\\pc-subagent-probe8b.json',
      JSON.stringify({ summary, coachBoot, lineupLeak, loanClick, kjiaClick, sellUiCheck, trainClick, tacticClick, playerBoot, benchPath, kjiaSelf, openBp, cross, mediaPriv, coachOpenBp, loanInClick, coachOps, swapCopy, hints, injRet, under, pos2, offerEdge, dealLog }, null, 2), 'utf8');
  } catch (e) {
    console.error('FATAL', e && e.stack || e);
    rec('FATAL', 'P0', 'probe fatal', String(e && e.stack || e));
    try {
      fs.writeFileSync('E:\\sex\\kpl-manager\\.bug-hunt\\pc-subagent-probe8b.json',
        JSON.stringify({ findings, fatal: String(e && e.stack || e) }, null, 2), 'utf8');
    } catch (e2) {}
  } finally {
    await browser.close();
  }
})();
