// Real-browser player+coach bug hunt (subagent probe 8)
// Covers: player career/train/social/media → club match → goPage gates → kjia promote leak
//          coach apply → lineup/train → market sell leak → coachOffer accept/reject → pre-match/BP
const fs = require('fs');
const { launch, shot, clearAndStart } = require('../tests/playthrough/pw.js');

const findings = [];
const events = { pageerror: [], consoleError: [], dialogs: [], toasts: [] };
function rec(id, sev, title, detail, evidence) {
  findings.push({ id, sev, title, detail, evidence: evidence || null });
  console.log(`[${sev}] ${id} ${title}`);
  if (detail) console.log('   ', String(detail).slice(0, 500));
}

function hook(page) {
  page.on('pageerror', (e) => {
    events.pageerror.push(String(e.message));
    rec('PAGEERROR', 'P0', 'pageerror: ' + e.message, e.stack || null);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      events.consoleError.push(t);
      // filter known noise
      if (!/favicon|net::ERR|Download the React/.test(t)) {
        rec('CONSOLE', 'P1', 'console.error: ' + t.slice(0, 200), t);
      }
    }
  });
  page.on('dialog', async (d) => {
    events.dialogs.push({ type: d.type(), msg: String(d.message()).slice(0, 200) });
    try { await d.accept(); } catch (e) {}
  });
}

(async () => {
  const { browser, page } = await launch();
  hook(page);
  try {
    await clearAndStart(page);
    // skip tour if it pops
    await page.evaluate(() => {
      try { localStorage.setItem('km_tour', '1'); } catch (e) {}
    });

    // ========== PLAYER MODE ==========
    const playerBoot = await page.evaluate(() => {
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      try {
        switchStartTab('player');
        pickPlayerArch(1);
        pickPlayerPos('mid');
        const teams = (window._pcTeams || []);
        if (teams[0]) pickPlayerTeam(teams[0].name);
        createPlayerCareer();
        try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
      } finally { toast = orig; }
      return {
        mode: S.mode,
        team: S.teamName,
        page: (document.querySelector('nav button.on') || {}).dataset?.page,
        players: S.players.length,
        hasMe: !!S.career && !!S.career.me,
        meId: S.career && S.career.me,
        age: (S.players.find(p => S.career && p.id === S.career.me) || {}).age,
        lineup: (S.lineup || []).slice(),
        toasts,
        startModalOpen: !!document.querySelector('#start-modal.on'),
      };
    });
    console.log('PLAYER_BOOT', JSON.stringify(playerBoot, null, 2));
    if (playerBoot.mode !== 'player') rec('P0-PLAYER-BOOT', 'FAIL', '选手开局后 S.mode 不是 player', JSON.stringify(playerBoot));
    if (playerBoot.startModalOpen) rec('P1-PLAYER-MODAL-STUCK', 'FAIL', 'createPlayerCareer 后开局弹窗仍打开', JSON.stringify(playerBoot));
    await shot(page, 'pc8-player-career');

    // --- career page: train / social / media ---
    const careerUi = await page.evaluate(() => {
      goPage('career');
      const el = document.getElementById('page-career');
      const text = (el && el.innerText) || '';
      const btns = [...(el ? el.querySelectorAll('button') : [])].map(b => ({
        text: b.textContent.trim().slice(0, 24),
        onclick: b.getAttribute('onclick'),
        disabled: !!b.disabled,
      }));
      return {
        textLen: text.length,
        textHead: text.slice(0, 400),
        trainBtns: btns.filter(b => /playerTrain\(/.test(b.onclick || '')),
        socialBtns: btns.filter(b => /playerSocial\(/.test(b.onclick || '')),
        mediaBtns: btns.filter(b => /playerRespondMedia/.test(b.onclick || '')),
        loanBtn: btns.find(b => /playerRequestLoanOut/.test(b.onclick || '')),
        kjiaBtn: btns.find(b => /playerRequestKjia/.test(b.onclick || '')),
        transferBtn: btns.find(b => /playerRequestTransfer/.test(b.onclick || '')),
        allOns: btns.map(b => b.onclick).filter(Boolean),
      };
    });
    console.log('CAREER_UI', JSON.stringify(careerUi, null, 2));
    if (careerUi.trainBtns.length < 4) rec('P1-PLAYER-TRAIN-MISSING', 'FAIL', '生涯页加练按钮不足 4 个', JSON.stringify(careerUi.trainBtns));
    if (careerUi.socialBtns.length < 1) rec('P1-PLAYER-SOCIAL-MISSING', 'FAIL', '生涯页社交按钮缺失', JSON.stringify(careerUi));

    // click a train button via real DOM click (dead-click check)
    const trainClick = await page.evaluate(() => {
      const before = (S.players.find(p => S.career && p.id === S.career.me) || {}).attrs;
      const btn = [...document.querySelectorAll('#page-career button')].find(b => /playerTrain\('lane'\)/.test(b.getAttribute('onclick') || ''));
      if (!btn) return { ok: false, reason: 'no-btn' };
      if (btn.disabled) return { ok: false, reason: 'disabled', disabledText: btn.textContent };
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      try { btn.click(); } finally { toast = orig; }
      const after = (S.players.find(p => S.career && p.id === S.career.me) || {}).attrs;
      return {
        ok: true,
        toasts,
        trained: S.career && S.career.stats && S.career.stats.trained,
        energyBefore: before && before.energy,
        energyAfter: after && after.energy,
        laneBefore: before && before.lane,
        laneAfter: after && after.lane,
        anyGain: before && after && (after.lane !== before.lane || after.energy !== before.energy),
      };
    });
    console.log('TRAIN_CLICK', JSON.stringify(trainClick, null, 2));
    if (trainClick.ok && trainClick.trained > 0 === false && !trainClick.anyGain && (trainClick.toasts || []).length === 0) {
      rec('P0-PLAYER-TRAIN-DEAD', 'FAIL', '点击加练无任何反馈（无 toast/属性/计数变化）', JSON.stringify(trainClick));
    }
    if (trainClick.ok && trainClick.trained === 0 && !trainClick.anyGain && (trainClick.toasts || []).join('').match(/^(平稳|低迷|亢奋|疲|好|一般)/)) {
      rec('P2-TRAIN-TOAST-THIN', 'P2', '加练无收益 toast 仅状态词', JSON.stringify(trainClick));
    }

    // social click
    const socialClick = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('#page-career button')].find(b => /playerSocial\(/.test(b.getAttribute('onclick') || '') && !b.disabled);
      if (!btn) return { ok: false, reason: 'no-enabled-btn' };
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      const before = S.career && S.career.stats && S.career.stats.social;
      try { btn.click(); } finally { toast = orig; }
      const after = S.career && S.career.stats && S.career.stats.social;
      return {
        ok: true,
        label: btn.textContent.trim().slice(0, 20),
        toasts,
        socialBefore: before,
        socialAfter: after,
        changed: before !== after || (toasts || []).length > 0,
      };
    });
    console.log('SOCIAL_CLICK', JSON.stringify(socialClick, null, 2));
    if (socialClick.ok && !socialClick.changed) {
      rec('P0-PLAYER-SOCIAL-DEAD', 'FAIL', '点击社交无任何反馈', JSON.stringify(socialClick));
    }

    // media: inject offer and click respond
    const mediaClick = await page.evaluate(() => {
      const me = S.players.find(p => S.career && p.id === S.career.me);
      // force a media offer
      try {
        const pool = mediaPool();
        const q = pool[0];
        S.career.media = { id: q.id, q: q.q, opts: q.opts.map(o => ({ id: o.id, l: o.l, tip: o.tip })), day: S.day, ctx: 'test' };
      } catch (e) {
        return { ok: false, reason: 'inject-fail:' + e.message };
      }
      goPage('career');
      const btn = [...document.querySelectorAll('#page-career button')].find(b => /playerRespondMedia/.test(b.getAttribute('onclick') || ''));
      if (!btn) return { ok: false, reason: 'no-media-btn', media: S.career.media };
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      try { btn.click(); } finally { toast = orig; }
      return {
        ok: true,
        label: btn.textContent.trim().slice(0, 24),
        toasts,
        mediaCleared: !S.career.media,
        mediaStat: S.career.stats && S.career.stats.media,
      };
    });
    console.log('MEDIA_CLICK', JSON.stringify(mediaClick, null, 2));
    if (mediaClick.ok && !mediaClick.mediaCleared && (mediaClick.toasts || []).length === 0) {
      rec('P0-PLAYER-MEDIA-DEAD', 'FAIL', '媒体采访按钮点击无反馈', JSON.stringify(mediaClick));
    }

    await shot(page, 'pc8-player-career2');

    // --- club page match entry ---
    const clubUi = await page.evaluate(() => {
      goPage('club');
      const el = document.getElementById('page-club');
      const text = (el && el.innerText) || '';
      const btns = [...(el ? el.querySelectorAll('button') : [])].map(b => ({
        text: b.textContent.trim().slice(0, 40),
        onclick: b.getAttribute('onclick'),
        disabled: !!b.disabled,
      }));
      return {
        textLen: text.length,
        hasStartPlayer: /startPlayerMatch/.test(text) || btns.some(b => /startPlayerMatch/.test(b.onclick || '')),
        hasStartMatch: btns.some(b => /uiStartMatch|startMatch\(/.test(b.onclick || '')),
        matchBtns: btns.filter(b => /startPlayerMatch|uiStartMatch|startMatch|playGame|openBP/.test(b.onclick || '')),
        textHead: text.slice(0, 500),
      };
    });
    console.log('CLUB_UI', JSON.stringify(clubUi, null, 2));
    if (!clubUi.hasStartPlayer) rec('P1-PLAYER-NO-MATCH-ENTRY', 'FAIL', '选手俱乐部页找不到出战入口', JSON.stringify(clubUi));
    if (clubUi.hasStartMatch) rec('P0-PLAYER-STARTMATCH-LEAK', 'FAIL', '选手俱乐部页出现经理向 startMatch 入口', JSON.stringify(clubUi));

    // real click startPlayerMatch
    const matchClick = await page.evaluate(() => {
      const before = { matchIdx: S.matchIdx, history: (S.history || []).length, matches: S.career && S.career.stats && S.career.stats.matches };
      const btn = [...document.querySelectorAll('#page-club button')].find(b => /startPlayerMatch/.test(b.getAttribute('onclick') || ''));
      if (!btn) return { ok: false, reason: 'no-btn' };
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      try { btn.click(); } finally { toast = orig; }
      return {
        ok: true,
        disabled: !!btn.disabled,
        toasts,
        before,
        after: {
          matchIdx: S.matchIdx,
          history: (S.history || []).length,
          matches: S.career && S.career.stats && S.career.stats.matches,
          phase: S.phase,
        },
        modalOpen: !!document.querySelector('#app-modal.on'),
        bpVisible: !!document.querySelector('#bp-modal.on') || /bp/i.test((document.querySelector('#app-modal') || {}).className || ''),
      };
    });
    console.log('MATCH_CLICK', JSON.stringify(matchClick, null, 2));
    if (matchClick.ok && !matchClick.disabled) {
      const b = matchClick.before || {}, a = matchClick.after || {};
      const progressed = a.matchIdx !== b.matchIdx || a.history !== b.history || a.matches !== b.matches;
      if (!progressed && (matchClick.toasts || []).length === 0) {
        rec('P0-PLAYER-MATCH-DEAD', 'FAIL', '点击出战比赛无任何推进/toast', JSON.stringify(matchClick));
      } else if (!progressed && (matchClick.toasts || []).length > 0) {
        rec('P1-PLAYER-MATCH-BLOCKED-WITHOUT-REASON', 'P1', '出战被挡且仅 toast: ' + (matchClick.toasts || []).join('|'), JSON.stringify(matchClick));
      }
    }
    await shot(page, 'pc8-player-after-match');

    // --- goPage illegal pages ---
    const gates = await page.evaluate(() => {
      const illegal = ['market', 'lineup', 'biz', 'train', 'career'];
      const out = [];
      for (const name of illegal) {
        const toasts = [];
        const orig = toast;
        toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
        try { goPage(name); } catch (e) { toasts.push('throw:' + e.message); } finally { toast = orig; }
        const cur = (document.querySelector('nav button.on') || {}).dataset?.page;
        const visible = !!document.querySelector('#page-' + name + '.on');
        out.push({ name, cur, visible, toasts, onPage: cur === name });
      }
      return out;
    });
    console.log('PLAYER_GATES', JSON.stringify(gates, null, 2));
    for (const g of gates) {
      const isLegal = ['career', 'club', 'league', 'kjia', 'union', 'hall'].includes(g.name);
      if (!isLegal && (g.onPage || g.visible)) {
        rec('P0-PLAYER-GATE-BYPASS', 'FAIL', `选手 goPage('${g.name}') 越权进入`, JSON.stringify(g));
      }
      if (!isLegal && g.toasts.length === 0) {
        rec('P1-PLAYER-GATE-SILENT', 'P1', `选手 goPage('${g.name}') 拦截但无 toast`, JSON.stringify(g));
      }
      if (isLegal && g.name !== 'career' && !g.onPage) {
        rec('P1-PLAYER-LEGAL-PAGE-BLOCKED', 'P1', `选手合法页 ${g.name} 打不开`, JSON.stringify(g));
      }
    }

    // --- kjia promote leak ---
    const kjia = await page.evaluate(() => {
      goPage('kjia');
      const el = document.getElementById('page-kjia');
      const text = (el && el.innerText) || '';
      const btns = [...(el ? el.querySelectorAll('button') : [])].map(b => ({
        text: b.textContent.trim().slice(0, 30),
        onclick: b.getAttribute('onclick'),
        disabled: !!b.disabled,
      }));
      const promoteBtns = btns.filter(b => /promoteKjiaPlayer/.test(b.onclick || ''));
      const recallBtns = btns.filter(b => /recallKjia/.test(b.onclick || ''));
      // UI click first promote if any
      let uiClick = null;
      if (promoteBtns.length && !promoteBtns[0].disabled) {
        const btn = [...document.querySelectorAll('#page-kjia button')].find(b => /promoteKjiaPlayer/.test(b.getAttribute('onclick') || '') && !b.disabled);
        if (btn) {
          const toasts = [];
          const orig = toast;
          toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
          try { btn.click(); } catch (e) { toasts.push('throw:' + e.message); } finally { toast = orig; }
          uiClick = { toasts, players: S.players.length, squad: (S.kjia && S.kjia.squad || []).length };
        }
      } else uiClick = { skipped: true, count: promoteBtns.length, firstDisabled: promoteBtns[0] && promoteBtns[0].disabled };

      // engine call regardless of UI
      let engineTry = null;
      const beforeLen = S.players.length;
      const squadBefore = (S.kjia && S.kjia.squad || []).length;
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      try {
        const target = (S.kjia && S.kjia.squad && S.kjia.squad[0]) || null;
        if (target) promoteKjiaPlayer(S, target.id);
        else promoteKjiaPlayer(S, 'nobody');
        engineTry = { ok: true, toasts, playersAfter: S.players.length, beforeLen, squadAfter: (S.kjia && S.kjia.squad || []).length, squadBefore };
      } catch (e) {
        engineTry = { ok: false, throw: e.message, toasts, playersAfter: S.players.length, beforeLen };
      } finally { toast = orig; }

      // recall
      let recallTry = null;
      const demoted = (S.players || []).filter(p => p.kjia > 0);
      const t2 = [];
      const o2 = toast;
      toast = function (m) { t2.push(String(m)); try { return o2.apply(this, arguments); } catch (e) { return null; } };
      try {
        if (demoted[0]) { recallKjia(demoted[0].id); recallTry = { called: true, toasts: t2 }; }
        else { recallKjia('nobody'); recallTry = { called: false, toasts: t2 }; }
      } catch (e) { recallTry = { throw: e.message, toasts: t2 }; } finally { toast = o2; }

      return {
        hasPromoteHint: /提拔一线队/.test(text),
        hasManagerCopy: /阵容页/.test(text),
        hasCanPromoteTag: /可提拔一线队/.test(text),
        promoteBtnCount: promoteBtns.length,
        enabledPromoteCount: promoteBtns.filter(b => !b.disabled).length,
        recallBtnCount: recallBtns.length,
        uiClick, engineTry, recallTry,
        mode: S.mode,
        textHead: text.slice(0, 350),
      };
    });
    console.log('KJIA', JSON.stringify(kjia, null, 2));
    if (kjia.enabledPromoteCount > 0) {
      rec('P0-PLAYER-PROMOTE-BTN', 'FAIL', '选手二队页出现可用「提拔一线队」按钮', JSON.stringify(kjia));
    } else if (kjia.promoteBtnCount > 0) {
      rec('P2-PLAYER-PROMOTE-BTN-DISABLED', 'P2', '选手二队页仍有提拔按钮（仅禁用）', JSON.stringify(kjia));
    }
    if (kjia.engineTry && kjia.engineTry.ok && kjia.engineTry.playersAfter > kjia.engineTry.beforeLen) {
      rec('P0-PLAYER-PROMOTE-ENGINE', 'FAIL', '引擎 promoteKjiaPlayer 对选手身份放行（名单被改写）', JSON.stringify(kjia.engineTry));
    }
    if (kjia.engineTry && kjia.engineTry.ok && (kjia.engineTry.toasts || []).length === 0 && kjia.engineTry.playersAfter === kjia.engineTry.beforeLen && (S.kjia && S.kjia.squad || []).length !== kjia.engineTry.squadBefore) {
      rec('P1-PLAYER-PROMOTE-SILENT', 'P1', '引擎 promote 对选手静默吞掉或半改状态', JSON.stringify(kjia.engineTry));
    }
    if (kjia.hasManagerCopy && S.mode === 'player') {
      rec('P2-PLAYER-KJIA-MANAGER-COPY', 'P2', '选手二队页文案仍指向阵容页', kjia.textHead);
    }
    await shot(page, 'pc8-player-kjia');

    // --- player privilege: openBP / startMatch / listPlayer engine ---
    const priv = await page.evaluate(() => {
      const out = {};
      const run = (name, fn) => {
        const toasts = [];
        const orig = toast;
        toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
        let result = null, err = null;
        try { result = fn(); } catch (e) { err = e.message; } finally { toast = orig; }
        return { name, result: String(result).slice(0, 80), err, toasts };
      };
      out.startMatch = run('startMatch', () => startMatch());
      out.openBP = run('openBP', () => { openBP('TEST_BP', function () {}); return 'called'; });
      out.bpDom = { draft: typeof window._draft, bpModal: !!document.querySelector('#bp-modal, #app-modal.on, .bp-root, [id*=bp]') };
      const someP = (S.players || []).find(p => S.career && p.id !== S.career.me && !p.loan);
      out.listPlayer = run('listPlayer', () => { if (someP) listPlayer(S, someP.id); return 'no-p' + (someP ? '' : 'none'); });
      out.openSellNego = run('openSellNego', () => { if (someP) openSellNego(S, someP.id); return 'no-p'; });
      out.buyPlayer = run('buyPlayer', () => buyPlayer && buyPlayer.length !== undefined ? 'fn-exists' : 'fn-exists');
      // try buy via market if function exists
      if (typeof buyPlayer === 'function') {
        out.buyPlayer = run('buyPlayer-call', () => buyPlayer(S, 'x', 100));
      }
      out.endTransferWindow = run('endTransferWindow', () => endTransferWindow(S));
      out.upgradeSponsor = run('upgradeSponsor', () => upgradeSponsor());
      out.promoteRookie = run('promoteRookie', () => {
        const r = (S.rookies || [])[0];
        if (r) promoteRookie(S, r.id);
        return 'no-rookie-or-called';
      });
      return out;
    });
    console.log('PLAYER_PRIV', JSON.stringify(priv, null, 2));
    // Check privilege results
    if (priv.startMatch && !priv.startMatch.err && (priv.startMatch.toasts || []).join('').indexOf('不能') < 0 && (priv.startMatch.toasts || []).join('').indexOf('选手') < 0) {
      // startMatch may return early for other reasons; only flag if it actually advanced series
      const st = await page.evaluate(() => ({ series: !!S.series, matchIdx: S.matchIdx }));
      if (st.series) rec('P0-PLAYER-STARTMATCH-PRIV', 'FAIL', '选手身份 startMatch 可进入赛前准备', JSON.stringify({ priv: priv.startMatch, st }));
    }
    if (priv.openBP && priv.openBP.result === 'called' && !priv.openBP.err) {
      const bpState = await page.evaluate(() => ({ draft: typeof window._draft, hasOnConfirm: !!(window._draft && window._draft.onConfirm) }));
      if (bpState.draft === 'object' || bpState.hasOnConfirm) {
        rec('P1-PLAYER-OPENBP-PRIV', 'P1', '选手身份 openBP 无权限门禁，可打开 BP 状态', JSON.stringify({ priv: priv.openBP, bpState }));
      }
    }
    if (priv.listPlayer && priv.listPlayer.result !== 'no-p' && priv.listPlayer.result !== 'no-pnone') {
      const listed = await page.evaluate(() => (S.listed || []).length);
      if (listed > 0) rec('P0-PLAYER-LIST-PRIV', 'FAIL', '选手身份 listPlayer 成功挂牌', JSON.stringify({ priv: priv.listPlayer, listed }));
    }

    // ========== COACH MODE ==========
    await clearAndStart(page);
    await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });

    const coachBoot = await page.evaluate(() => {
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      try {
        switchStartTab('coach');
        pickCoachClub(2);
        applyCoachClub();
        try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
      } finally { toast = orig; }
      return {
        mode: S.mode,
        team: S.teamName,
        page: (document.querySelector('nav button.on') || {}).dataset?.page,
        players: S.players.length,
        toasts,
        startModalOpen: !!document.querySelector('#start-modal.on'),
        hasCoach: !!S.coach,
        coachDeal: !!S.coachDeal,
      };
    });
    console.log('COACH_BOOT', JSON.stringify(coachBoot, null, 2));
    if (coachBoot.mode !== 'coach') rec('P0-COACH-BOOT', 'FAIL', '教练开局后 S.mode 不是 coach', JSON.stringify(coachBoot));
    if (coachBoot.startModalOpen) rec('P1-COACH-MODAL-STUCK', 'FAIL', 'applyCoachClub 后开局弹窗仍打开', JSON.stringify(coachBoot));
    await shot(page, 'pc8-coach-club');

    // lineup / train
    const coachPages = await page.evaluate(() => {
      const out = {};
      for (const name of ['lineup', 'train', 'market', 'club']) {
        goPage(name);
        const el = document.getElementById('page-' + name);
        const text = (el && el.innerText) || '';
        const btns = [...(el ? el.querySelectorAll('button') : [])].map(b => ({
          text: b.textContent.trim().slice(0, 28),
          onclick: b.getAttribute('onclick'),
          disabled: !!b.disabled,
        }));
        out[name] = {
          visible: !!document.querySelector('#page-' + name + '.on'),
          textLen: text.length,
          sellBtns: btns.filter(b => /openSellNego|listPlayer|挂牌|出售/.test((b.onclick || '') + b.text)),
          loanOutBtns: btns.filter(b => /clubLoanOutPlayer|loanOut/.test(b.onclick || '')),
          trainBtns: btns.filter(b => /doTrain|trainPlayer|coachTrain/.test(b.onclick || '')),
          tacticBtns: btns.filter(b => /setTactic|switchTactic/.test(b.onclick || '')),
          coachReqBtns: btns.filter(b => /coachRequest|coachAutoSquad|coachLoan/.test(b.onclick || '')),
          lineupBtns: btns.filter(b => /setLineup|toggleStart|swapLineup|bench|setCaptain/.test(b.onclick || '')),
          btnCount: btns.length,
          textHead: text.slice(0, 280),
          allOns: btns.map(b => b.onclick).filter(Boolean).slice(0, 20),
        };
      }
      return out;
    });
    console.log('COACH_PAGES', JSON.stringify(coachPages, null, 2));
    for (const name of ['lineup', 'train', 'market', 'club']) {
      if (!coachPages[name].visible || coachPages[name].textLen < 80) {
        rec('P1-COACH-PAGE-EMPTY', 'FAIL', `教练 ${name} 页空白或打不开`, JSON.stringify(coachPages[name]));
      }
    }
    if ((coachPages.market.sellBtns || []).length > 0) {
      rec('P0-COACH-SELL-UI', 'FAIL', '教练转会页出现挂牌/出售按钮', JSON.stringify(coachPages.market.sellBtns));
    }
    if ((coachPages.lineup.sellBtns || []).length > 0) {
      rec('P0-COACH-LINEUP-SELL', 'FAIL', '教练阵容页出现挂牌/出售按钮', JSON.stringify(coachPages.lineup.sellBtns));
    }
    if ((coachPages.train.trainBtns || []).length === 0 && coachPages.train.btnCount < 5) {
      rec('P1-COACH-TRAIN-EMPTY', 'P1', '教练训练页按钮过少', JSON.stringify(coachPages.train));
    }

    // real click a lineup control if any
    const lineupClick = await page.evaluate(() => {
      goPage('lineup');
      const btns = [...document.querySelectorAll('#page-lineup button')].filter(b => !b.disabled && b.getAttribute('onclick'));
      // pick a non-destructive control: tactic
      const btn = btns.find(b => /setTactic|switchTactic|pickTactic/.test(b.getAttribute('onclick') || ''))
        || btns.find(b => /toggle|swap|bench|setCaptain|setLineup/.test(b.getAttribute('onclick') || ''))
        || null;
      if (!btn) return { ok: false, reason: 'no-interactive-btn', sample: btns.slice(0, 5).map(b => b.getAttribute('onclick')) };
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      let err = null;
      try { btn.click(); } catch (e) { err = e.message; } finally { toast = orig; }
      return { ok: true, onclick: btn.getAttribute('onclick'), text: btn.textContent.trim().slice(0, 24), toasts, err };
    });
    console.log('LINEUP_CLICK', JSON.stringify(lineupClick, null, 2));
    if (lineupClick.ok && lineupClick.err) rec('P1-LINEUP-CLICK-THROW', 'P1', '阵容按钮点击抛错: ' + lineupClick.err, JSON.stringify(lineupClick));

    // market real click: try any coach request button
    const marketClick = await page.evaluate(() => {
      goPage('market');
      const btns = [...document.querySelectorAll('#page-market button')].filter(b => !b.disabled && b.getAttribute('onclick'));
      const btn = btns.find(b => /coachRequest|coachAutoSquad|loanIn|coachLoan|requestSign/.test(b.getAttribute('onclick') || '')) || null;
      if (!btn) return { ok: false, reason: 'no-coach-action', sample: btns.map(b => (b.getAttribute('onclick') || '').slice(0, 40)).slice(0, 12) };
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      let err = null;
      try { btn.click(); } catch (e) { err = e.message; } finally { toast = orig; }
      return { ok: true, onclick: btn.getAttribute('onclick'), text: btn.textContent.trim().slice(0, 28), toasts, err };
    });
    console.log('MARKET_CLICK', JSON.stringify(marketClick, null, 2));

    await shot(page, 'pc8-coach-market');

    // coach engine sell attempt
    const coachSell = await page.evaluate(() => {
      const p = (S.players || []).find(x => !x.loan);
      const out = {};
      const run = (name, fn) => {
        const toasts = [];
        const orig = toast;
        toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
        let err = null;
        try { fn(); } catch (e) { err = e.message; } finally { toast = orig; }
        return { name, err, toasts, listed: (S.listed || []).length };
      };
      if (p) {
        out.listPlayer = run('listPlayer', () => listPlayer(S, p.id));
        out.openSellNego = run('openSellNego', () => openSellNego(S, p.id));
      }
      out.buyPlayer = run('buyPlayer', () => {
        // try a market buy if market has items
        const item = (S.market && S.market[0]) || null;
        if (item && typeof buyPlayer === 'function') buyPlayer(S, item.id, item.price || 100);
        return 'tried';
      });
      return out;
    });
    console.log('COACH_SELL', JSON.stringify(coachSell, null, 2));
    if (coachSell.listPlayer && coachSell.listPlayer.listed > 0) {
      rec('P0-COACH-LIST-ENGINE', 'FAIL', '教练身份 listPlayer 成功挂牌', JSON.stringify(coachSell.listPlayer));
    }

    // --- coach offer accept/reject ---
    const offerValid = await page.evaluate(() => {
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      const beforeTeam = S.teamName;
      const beforeId = S.coach && S.coach.id;
      try {
        const t = CLUB_TEMPLATES[0];
        S.coachOffer = { team: t.name };
        renderAll();
        respondCoachOffer(true);
      } finally { toast = orig; }
      return {
        beforeTeam,
        afterTeam: S.teamName,
        moved: S.teamName !== beforeTeam,
        toasts,
        offerCleared: !S.coachOffer,
        coachIdBefore: beforeId,
        coachIdAfter: S.coach && S.coach.id,
        dealLog: (S.coachDeal && S.coachDeal.log || []).slice(0, 3),
      };
    });
    console.log('OFFER_VALID', JSON.stringify(offerValid, null, 2));
    if (!offerValid.moved) rec('P0-COACH-OFFER-ACCEPT-FAIL', 'FAIL', '合法队名接受豪门邀约未换队', JSON.stringify(offerValid));

    const offerReject = await page.evaluate(() => {
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      const beforeTeam = S.teamName;
      try {
        S.coachOffer = { team: CLUB_TEMPLATES[1] ? CLUB_TEMPLATES[1].name : 'X' };
        respondCoachOffer(false);
      } finally { toast = orig; }
      return {
        beforeTeam,
        afterTeam: S.teamName,
        stayed: S.teamName === beforeTeam,
        toasts,
        offerCleared: !S.coachOffer,
        dealLog: (S.coachDeal && S.coachDeal.log || []).slice(0, 3),
        trust: S.board && S.board.trust,
      };
    });
    console.log('OFFER_REJECT', JSON.stringify(offerReject, null, 2));
    if (!offerReject.stayed) rec('P0-COACH-OFFER-REJECT-MOVED', 'FAIL', '婉拒豪门邀约却换了队', JSON.stringify(offerReject));
    if (!offerReject.offerCleared) rec('P2-COACH-OFFER-REJECT-LEFT', 'P2', '婉拒后 offer 未清空', JSON.stringify(offerReject));

    const offerBad = await page.evaluate(() => {
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      const beforeTeam = S.teamName;
      const beforeLog = (S.coachDeal && S.coachDeal.log || []).length;
      try {
        S.coachOffer = { team: 'AG超玩会' }; // not exact CLUB_TEMPLATES name
        respondCoachOffer(true);
      } finally { toast = orig; }
      return {
        beforeTeam,
        afterTeam: S.teamName,
        moved: S.teamName !== beforeTeam,
        toasts,
        offerCleared: !S.coachOffer,
        logAdded: ((S.coachDeal && S.coachDeal.log || []).length) > beforeLog,
        dealLog: (S.coachDeal && S.coachDeal.log || []).slice(0, 3),
      };
    });
    console.log('OFFER_BAD', JSON.stringify(offerBad, null, 2));
    if (offerBad.toasts.length === 0) {
      rec('P1-COACH-OFFER-BAD-SILENT', 'P1', '非法队名接受豪门邀约静默无 toast', JSON.stringify(offerBad));
    }
    if (offerBad.moved) rec('P0-COACH-OFFER-BAD-MOVED', 'P0', '非法队名竟换队成功', JSON.stringify(offerBad));

    // UI-level accept/reject buttons present on club page when offer exists
    const offerUi = await page.evaluate(() => {
      S.coachOffer = { team: (CLUB_TEMPLATES[3] || CLUB_TEMPLATES[0]).name };
      goPage('club');
      renderClub();
      const el = document.getElementById('page-club');
      const text = (el && el.innerText) || '';
      const btns = [...(el ? el.querySelectorAll('button') : [])].map(b => ({
        text: b.textContent.trim().slice(0, 30),
        onclick: b.getAttribute('onclick'),
      }));
      return {
        hasOfferCard: /豪门邀约/.test(text),
        acceptBtn: btns.find(b => /respondCoachOffer\(true\)/.test(b.onclick || '')),
        rejectBtn: btns.find(b => /respondCoachOffer\(false\)/.test(b.onclick || '')),
      };
    });
    console.log('OFFER_UI', JSON.stringify(offerUi, null, 2));
    if (!offerUi.hasOfferCard || !offerUi.acceptBtn || !offerUi.rejectBtn) {
      rec('P1-COACH-OFFER-UI-MISSING', 'P1', '豪门邀约 UI 缺失或无接受/婉拒按钮', JSON.stringify(offerUi));
    } else {
      // real click reject
      const uiReject = await page.evaluate(() => {
        const btn = [...document.querySelectorAll('#page-club button')].find(b => /respondCoachOffer\(false\)/.test(b.getAttribute('onclick') || ''));
        const toasts = [];
        const orig = toast;
        toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
        try { btn.click(); } finally { toast = orig; }
        return { offerCleared: !S.coachOffer, toasts };
      });
      console.log('UI_REJECT', JSON.stringify(uiReject));
    }
    await shot(page, 'pc8-coach-offer');

    // --- pre-match / BP entry ---
    const prep = await page.evaluate(() => {
      // ensure league match available
      const out = {
        phase: S.phase,
        matchIdx: S.matchIdx,
        hasSeries: !!S.series,
        scheduleLen: (S.schedule || []).length,
        preseason: S.preseason,
        transferWindow: S.transferWindow,
      };
      goPage('club');
      const btns = [...document.querySelectorAll('#page-club button')].map(b => ({
        text: b.textContent.trim().slice(0, 40),
        onclick: b.getAttribute('onclick'),
        disabled: !!b.disabled,
      }));
      out.matchBtns = btns.filter(b => /startMatch|uiStartMatch|startPlayerMatch|openBP|playGame/.test(b.onclick || ''));
      return out;
    });
    console.log('PREP', JSON.stringify(prep, null, 2));

    const prepClick = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('#page-club button')].find(b => /uiStartMatch/.test(b.getAttribute('onclick') || '') && !b.disabled);
      if (!btn) return { ok: false, reason: 'no-uiStartMatch' };
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      let err = null;
      try { btn.click(); } catch (e) { err = e.message; } finally { toast = orig; }
      return {
        ok: true,
        err,
        toasts,
        appModal: !!document.querySelector('#app-modal.on'),
        modalText: ((document.querySelector('#app-modal') || {}).innerText || '').slice(0, 300),
        hasEnterBP: /openBP|进入 BP/.test(((document.querySelector('#app-modal') || {}).innerHTML || '')),
      };
    });
    console.log('PREP_CLICK', JSON.stringify(prepClick, null, 2));
    if (!prepClick.ok) {
      rec('P1-COACH-NO-PREP-ENTRY', 'P1', '教练俱乐部页找不到赛前准备入口', JSON.stringify({ prep, prepClick }));
    } else if (prepClick.err) {
      rec('P0-COACH-PREP-THROW', 'P0', '赛前准备点击抛错: ' + prepClick.err, JSON.stringify(prepClick));
    } else if (!prepClick.appModal && (prepClick.toasts || []).length === 0) {
      rec('P0-COACH-PREP-DEAD', 'P0', '赛前准备点击无反应', JSON.stringify(prepClick));
    }

    // enter BP from modal
    const bpClick = await page.evaluate(() => {
      const modal = document.querySelector('#app-modal');
      const btn = modal && [...modal.querySelectorAll('button')].find(b => /openBP/.test(b.getAttribute('onclick') || '') || /进入 BP/.test(b.textContent || ''));
      if (!btn) return { ok: false, reason: 'no-enter-bp', modalHtml: ((modal || {}).innerHTML || '').slice(0, 200) };
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      let err = null;
      try { btn.click(); } catch (e) { err = e.message; } finally { toast = orig; }
      // inspect BP UI
      const bpText = (document.body.innerText || '').match(/BP|禁用|选用|全局/g);
      return {
        ok: true,
        err,
        toasts,
        draft: typeof window._draft,
        hasDraft: !!(window._draft && window._draft.ls),
        bodyHasBP: !!(bpText && bpText.length),
        snippet: (document.body.innerText || '').slice(0, 200),
      };
    });
    console.log('BP_CLICK', JSON.stringify(bpClick, null, 2));
    if (bpClick.ok && !bpClick.hasDraft && !bpClick.err) {
      rec('P1-COACH-BP-NO-STATE', 'P1', '点击进入 BP 后无 BP 状态', JSON.stringify(bpClick));
    }
    if (bpClick.ok && bpClick.err) rec('P0-COACH-BP-THROW', 'P0', '进入 BP 抛错: ' + bpClick.err, JSON.stringify(bpClick));
    await shot(page, 'pc8-coach-bp');

    // --- coach goPage illegal ---
    const coachGates = await page.evaluate(() => {
      const illegal = ['biz', 'career'];
      const out = [];
      for (const name of illegal) {
        const toasts = [];
        const orig = toast;
        toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
        try { goPage(name); } catch (e) { toasts.push('throw:' + e.message); } finally { toast = orig; }
        const cur = (document.querySelector('nav button.on') || {}).dataset?.page;
        out.push({ name, cur, onPage: cur === name, toasts });
      }
      return out;
    });
    console.log('COACH_GATES', JSON.stringify(coachGates));
    for (const g of coachGates) {
      if (g.onPage) rec('P0-COACH-GATE-BYPASS', 'FAIL', `教练 goPage('${g.name}') 越权进入`, JSON.stringify(g));
      if (!g.onPage && g.toasts.length === 0) rec('P2-COACH-GATE-SILENT', 'P2', `教练 goPage('${g.name}') 拦截无 toast`, JSON.stringify(g));
    }

    // --- extra: pickPlayerPos invalid ---
    const posBug = await page.evaluate(() => {
      await_clear = null; // noop
      return true;
    }).catch(() => true);

    await clearAndStart(page);
    const posInvalid = await page.evaluate(() => {
      switchStartTab('player');
      pickPlayerArch(0);
      const toasts = [];
      const orig = toast;
      toast = function (m) { toasts.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      let err = null;
      let boot = null;
      try {
        pickPlayerPos('jungle'); // invalid key
        createPlayerCareer();
        boot = { mode: S && S.mode, ok: true };
      } catch (e) {
        err = e.message;
      } finally { toast = orig; }
      return { err, boot, toasts };
    });
    console.log('POS_INVALID', JSON.stringify(posInvalid, null, 2));
    if (posInvalid.err && /undefined/.test(posInvalid.err)) {
      rec('P2-PICKPOS-INVALID', 'P2', 'pickPlayerPos 非法键导致 createPlayerCareer 抛 TypeError', JSON.stringify(posInvalid));
    }

    // summary
    const unique = [];
    const seen = new Set();
    for (const f of findings) {
      const key = f.id + '|' + f.title.slice(0, 40);
      if (!seen.has(key)) { seen.add(key); unique.push(f); }
    }
    const summary = {
      counts: {
        P0: unique.filter(f => f.sev === 'P0' || f.sev === 'FAIL').length,
        P1: unique.filter(f => f.sev === 'P1').length,
        P2: unique.filter(f => f.sev === 'P2').length,
      },
      events: {
        pageerror: events.pageerror,
        consoleError: events.consoleError.slice(0, 20),
        dialogs: events.dialogs,
      },
      findings: unique,
    };
    console.log('SUMMARY', JSON.stringify(summary, null, 2));
    fs.writeFileSync('E:\\sex\\kpl-manager\\.bug-hunt\\pc-subagent-probe8.json',
      JSON.stringify({ summary, playerBoot, careerUi, trainClick, socialClick, mediaClick, clubUi, matchClick, gates, kjia, priv, coachBoot, coachPages, lineupClick, marketClick, coachSell, offerValid, offerReject, offerBad, offerUi, prep, prepClick, bpClick, coachGates, posInvalid }, null, 2), 'utf8');
  } catch (e) {
    console.error('FATAL', e && e.stack || e);
    rec('FATAL', 'P0', 'probe fatal', String(e && e.stack || e));
    try {
      fs.writeFileSync('E:\\sex\\kpl-manager\\.bug-hunt\\pc-subagent-probe8.json',
        JSON.stringify({ findings, events, fatal: String(e && e.stack || e) }, null, 2), 'utf8');
    } catch (e2) {}
  } finally {
    await browser.close();
  }
})();
