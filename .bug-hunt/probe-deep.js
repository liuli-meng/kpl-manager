// Deep dive: coach offer accept with correct template names + BP/pre-match UI + player train note + silent accept
const { launch, shot } = require('../tests/playthrough/pw.js');
const fs = require('fs');
const findings = [];
const steps = [];
function record(id, severity, title, detail) {
  findings.push({ id, severity, title, detail });
  console.log(`[${severity}] ${id} ${title}`);
  if (detail) console.log('   ', String(detail).slice(0, 400));
}
(async () => {
  const { browser, page } = await launch();
  const pageErrors = [];
  page.on('pageerror', e => { pageErrors.push(String(e.message)); console.log('[pageerror]', e.message); });
  page.on('console', msg => { if (msg.type() === 'error') console.log('[console.error]', msg.text().slice(0, 200)); });
  page.on('dialog', async d => { console.log('[dialog]', d.type(), String(d.message()).slice(0, 160)); try { await d.accept(); } catch (e) {} });
  await page.evaluate(() => { if (!window.__toastHooked) {
    window.__toastHooked = true;
    const orig = window.toast;
    window.toast = function (msg) {
      try { window.__toasts = (window.__toasts || []); window.__toasts.push(String(msg)); } catch (e) {}
      return orig.apply(this, arguments);
    };
  }});
  async function drain() {
    return page.evaluate(() => { const a = (window.__toasts || []).slice(); window.__toasts = []; return a; });
  }
  try {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });

    // Start coach with known club
    const setup = await page.evaluate(() => {
      switchStartTab('coach');
      const names = CLUB_TEMPLATES.map((c, i) => ({ i, name: c.name, seed: c.seed }));
      const idx = CLUB_TEMPLATES.findIndex(c => c.name.indexOf('成都AG') >= 0 || c.name.indexOf('AG超玩') >= 0);
      pickCoachClub(idx >= 0 ? idx : 0);
      applyCoachClub();
      try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
      return {
        templates: names,
        pickedIdx: idx,
        mode: S.mode, teamName: S.teamName,
        coach: S.coach && S.coach.name,
        coachId: S.coach && S.coach.id,
        lineup: S.lineup.length,
        players: S.players.length,
        phase: S.phase,
        matchIdx: S.matchIdx,
        scheduleLen: (S.schedule || []).length,
      };
    });
    console.log('SETUP', JSON.stringify(setup));
    steps.push({ step: 'setup', data: setup });

    // Inject offer with EXACT template name
    const acceptExact = await page.evaluate(() => {
      const pool = CLUB_TEMPLATES.filter(c => c.name !== S.teamName && c.seed >= 440);
      const target = pool[0];
      S.coachOffer = { team: target.name };
      goPage('club');
      renderClub();
      const text = (document.getElementById('page-club') || '').innerText || '';
      const btns = [...document.querySelectorAll('#page-club button')]
        .filter(b => /respondCoachOffer/.test(b.getAttribute('onclick') || ''))
        .map(b => ({ text: b.textContent.trim(), onclick: b.getAttribute('onclick') }));
      const teamBefore = S.teamName;
      const playersBefore = S.players.map(p => p.name);
      const coachId = S.coach && S.coach.id;
      const fundBefore = S.fund;
      let r = null;
      try { respondCoachOffer(true); r = 'ok'; } catch (e) { r = 'throw:' + e.message; }
      return {
        target: target.name, teamBefore, teamAfter: S.teamName,
        moved: S.teamName !== teamBefore,
        playersBefore, playersAfter: S.players.map(p => p.name),
        coachIdBefore: coachId, coachIdAfter: S.coach && S.coach.id,
        fundBefore, fundAfter: S.fund,
        coachOffer: S.coachOffer,
        dealLog: S.coachDeal && S.coachDeal.log && S.coachDeal.log.slice(0, 4),
        lineupLen: S.lineup && S.lineup.length,
        offerUiHadBtns: btns,
        offerTextHit: /豪门邀约/.test(text),
        r,
        seedPower: S.seedPower,
        scheduleSample: (S.schedule || []).slice(0, 3).map(m => m && m.opp),
        phase: S.phase,
      };
    });
    const tA = await drain();
    await page.waitForTimeout(300);
    await shot(page, 'coach-accept-exact');
    steps.push({ step: 'accept-exact', data: { acceptExact, toasts: tA } });
    console.log('ACCEPT_EXACT', JSON.stringify({ acceptExact, toasts: tA }, null, 2));
    if (!acceptExact.moved) {
      record('P0-ACCEPT-STILL', 'FAIL', '使用 CLUB_TEMPLATES 精确队名仍无法接受邀约换队', JSON.stringify(acceptExact));
    }
    if (acceptExact.coachIdAfter !== acceptExact.coachIdBefore) {
      record('P1-ACCEPT-OVERWRITE', 'FAIL', '接受后玩家教练身份被覆盖', JSON.stringify(acceptExact));
    }

    // Silent fail path: invalid team name
    const silent = await page.evaluate(() => {
      S.coachOffer = { team: '不存在的俱乐部XYZ' };
      let r = null;
      try { respondCoachOffer(true); r = 'ok'; } catch (e) { r = 'throw:' + e.message; }
      return {
        r,
        teamAfter: S.teamName,
        coachOffer: S.coachOffer,
        dealLog: S.coachDeal && S.coachDeal.log && S.coachDeal.log.slice(0, 3),
        toasts: (window.__toasts || []).slice(),
      };
    });
    const tS = await drain();
    steps.push({ step: 'accept-silent-bad-name', data: { silent, toasts: tS } });
    console.log('SILENT_BAD', JSON.stringify({ silent, toasts: tS }));
    if (silent.r === 'ok' && silent.coachOffer === null && silent.teamAfter === (acceptExact.teamAfter) && !tS.length && !silent.toasts.length) {
      record('P1-ACCEPT-SILENT', 'FAIL', '豪门邀约队名非法时接受=静默清空 offer，无 toast/无日志/未换队', JSON.stringify({ silent, tS }));
    }

    // Pre-match / BP UI for coach
    const bpDeep = await page.evaluate(() => {
      // ensure no series leftover
      S.series = null;
      goPage('club');
      let startTry = null;
      try { startMatch(); startTry = 'ok'; } catch (e) { startTry = 'throw:' + e.message; }
      const bodyText = document.body.innerText || '';
      // look for prep container ids in DOM
      const ids = [...document.querySelectorAll('[id]')].map(el => el.id).filter(id => /prep|bp|match|modal/i.test(id));
      const prepEls = ids.map(id => {
        const el = document.getElementById(id);
        return { id, hasOn: el.classList.contains('on'), textLen: (el.innerText || '').length, display: el.style.display };
      }).filter(x => x.textLen > 20 || x.hasOn);
      // openBP path
      let openBpTry = null, openBpState = null;
      try {
        if (typeof openBP === 'function') {
          openBP();
          openBpTry = 'ok';
        } else openBpTry = 'missing';
      } catch (e) { openBpTry = 'throw:' + e.message; }
      openBpState = {
        onModals: [...document.querySelectorAll('.modal.on')].map(m => m.id),
        hasRenderBP: /BP|禁用|选用|BAN|PICK|全局/.test(document.body.innerText || ''),
        bodySnippet: (document.body.innerText || '').slice(0, 500),
        prepIds: [...document.querySelectorAll('[id]')].map(el => el.id).filter(id => /bp|prep/i.test(id)),
      };
      return {
        startTry,
        series: S.series ? { op: S.series.opName, mid: S.series.mid, stage: S.series.stage } : null,
        prepEls,
        idsSample: ids.slice(0, 40),
        openBpTry,
        openBpState,
        prepTitle: window._prepTitle,
        bodyHasPrep: /赛前准备|情报|首发|进入 BP|BP 开赛/.test(bodyText),
        bodyHasPrepSnippet: (bodyText.match(/赛前准备[\s\S]{0,200}/) || bodyText.match(/下一场比赛[\s\S]{0,200}/) || [])[0] || null,
      };
    });
    await page.waitForTimeout(300);
    await shot(page, 'coach-prematch-bp');
    steps.push({ step: 'bp-deep', data: bpDeep });
    console.log('BP_DEEP', JSON.stringify(bpDeep, null, 2));
    if (bpDeep.startTry && bpDeep.startTry.startsWith('throw')) {
      record('P0-BP-START-THROW', 'FAIL', '教练 startMatch 抛异常', bpDeep.startTry);
    }
    if (bpDeep.startTry === 'ok' && !bpDeep.series) {
      record('P0-BP-NO-SERIES', 'FAIL', 'startMatch 后无 series', JSON.stringify(bpDeep));
    }
    if (bpDeep.openBpTry && bpDeep.openBpTry.startsWith('throw')) {
      record('P1-BP-OPEN-THROW', 'FAIL', 'openBP 抛异常', bpDeep.openBpTry);
    }

    // If prep panel exists, try playGame / applyBp path
    const playPath = await page.evaluate(() => {
      const out = { steps: [] };
      // try applyBp then playGame
      try {
        if (typeof applyBp === 'function') { applyBp(); out.steps.push('applyBp:ok'); }
        else out.steps.push('applyBp:missing');
      } catch (e) { out.steps.push('applyBp:throw:' + e.message); }
      try {
        if (typeof bpAutoAll === 'function') { bpAutoAll(); out.steps.push('bpAutoAll:ok'); }
        else out.steps.push('bpAutoAll:missing');
      } catch (e) { out.steps.push('bpAutoAll:throw:' + e.message); }
      try {
        if (typeof bpConfirm === 'function') { bpConfirm(); out.steps.push('bpConfirm:ok'); }
        else out.steps.push('bpConfirm:missing');
      } catch (e) { out.steps.push('bpConfirm:throw:' + e.message); }
      const beforeLogs = S.series && S.series.logs ? S.series.logs.length : null;
      const beforeMw = S.series && S.series.mw;
      try {
        if (typeof playGame === 'function') { playGame(); out.steps.push('playGame:ok'); }
        else out.steps.push('playGame:missing');
      } catch (e) { out.steps.push('playGame:throw:' + e.message); }
      out.after = {
        hasSeries: !!S.series,
        mw: S.series && S.series.mw,
        ow: S.series && S.series.ow,
        logsLen: S.series && S.series.logs ? S.series.logs.length : null,
        beforeLogs, beforeMw,
        historyLen: (S.history || []).length,
        onModals: [...document.querySelectorAll('.modal.on')].map(m => m.id),
        bodySnippet: (document.body.innerText || '').slice(0, 400),
      };
      return out;
    });
    const tP = await drain();
    await page.waitForTimeout(250);
    await shot(page, 'coach-playgame');
    steps.push({ step: 'play-path', data: { playPath, toasts: tP } });
    console.log('PLAY_PATH', JSON.stringify({ playPath, toasts: tP }, null, 2));
    if ((playPath.steps || []).some(s => s.startsWith('playGame:throw'))) {
      record('P0-PLAYGAME-THROW', 'FAIL', 'playGame 抛异常', JSON.stringify(playPath.steps));
    }

    // Player train toast incompleteness + pickPlayerPos invalid key crash
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    const playerEdge = await page.evaluate(() => {
      switchStartTab('player');
      pickPlayerArch(1); // semi 19yo
      pickPlayerPos('mid');
      const n = document.getElementById('pc-name');
      if (n) n.value = '测试边路';
      if (!_pcTeam && window._pcTeams && window._pcTeams[0]) pickPlayerTeam(window._pcTeams[0].name);
      createPlayerCareer();
      try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
      const me = myPlayer(S);
      // force gain=0 train note: set form low by morale/val
      me.morale = 20; me.val = 80; me.energy = 100; S.trained = false;
      delete me.peak;
      const outcome = trainOutcome(playerRole(S), me, 'lane');
      // call playerTrainDay directly for deterministic note
      S.trained = false;
      // monkey: call multiple times until gain 0 or use note path
      const notes = [];
      for (let i = 0; i < 8 && notes.length < 3; i++) {
        S.trained = false; me.energy = 100;
        const r = playerTrainDay(S, 'lane');
        notes.push({ ok: r.ok, gain: r.gain, note: r.note });
      }
      // invalid POS crash
      let invalidCreate = null;
      try {
        pickPlayerPos('jungle'); // sets _pcPos='jungle'
        // don't actually create second career on same S; just eval the POS access
        invalidCreate = POS[_pcPos] ? 'ok' : 'POS[_pcPos] undefined → createPlayerCareer would throw at POS[_pcPos][0]';
      } catch (e) { invalidCreate = 'throw:' + e.message; }
      // restore
      pickPlayerPos('mid');
      return {
        meName: me.name, meAge: me.age, starter: S.lineup.includes(me.id),
        outcome, notes, invalidCreate,
        posKeys: POS_ORDER,
        posBtnIds: [...document.querySelectorAll('[id^="pc-pos-"]')].map(b => b.id),
        careerHasTransferBtn: !!document.querySelector('[onclick*="playerRequestTransfer"]'),
        careerHasLoanBtn: !!document.querySelector('[onclick*="playerRequestLoanOut"]'),
        careerHasKjiaBtn: !!document.querySelector('[onclick*="playerRequestKjia"]'),
        // force bench to show exit panel
        benchSetup: (() => {
          S.career.benchDays = 3;
          const li = S.lineup.indexOf(me.id);
          if (li >= 0) S.lineup.splice(li, 1);
          goPage('career');
          const text = (document.getElementById('page-career') || {}).innerText || '';
          const btns = [...document.querySelectorAll('#page-career button')].map(b => ({
            text: b.textContent.trim(), onclick: b.getAttribute('onclick'), disabled: !!b.disabled,
          }));
          return {
            hasBenchPanel: /板凳|租借离队|下放/.test(text),
            loanBtn: btns.find(b => /playerRequestLoanOut/.test(b.onclick || '')),
            kjiaBtn: btns.find(b => /playerRequestKjia/.test(b.onclick || '')),
            allExitBtns: btns.filter(b => /loan|kjia|Transfer|transfer|retire|Retire|coach/.test(b.onclick || '') || /租借|K甲|转会|退役/.test(b.text || '')),
          };
        })(),
      };
    });
    const tPE = await drain();
    steps.push({ step: 'player-edge', data: { playerEdge, toasts: tPE } });
    console.log('PLAYER_EDGE', JSON.stringify({ playerEdge, toasts: tPE }, null, 2));
    await shot(page, 'pc-edge-career');
    const zeroNotes = (playerEdge.notes || []).filter(n => n.gain === 0);
    if (zeroNotes.length && zeroNotes.some(n => !n.note || n.note.length < 8 || !/没有提升|天花板|巅峰|低迷|平稳|状态/.test(n.note))) {
      record('P2-TRAIN-NOTE', 'FAIL', '加练 0 收益 note 过短/不说明结果', JSON.stringify(zeroNotes));
    }
    // UI toast path: playerTrain toasts only r.note when gain<=0
    if (zeroNotes.length) {
      const note = zeroNotes[0].note;
      if (note && note.length < 10) {
        record('P2-TRAIN-TOAST', 'FAIL', '加练无收益时 UI toast 仅显示状态词「'+note+'」，未说明“今天没有提升”（引擎日志文案更完整）', JSON.stringify(zeroNotes));
      }
    }
    if (playerEdge.invalidCreate && /would throw|undefined/.test(playerEdge.invalidCreate)) {
      record('P2-POS-NOVALID', 'FAIL', 'pickPlayerPos 不校验非法位置，非法 _pcPos 会在 createPlayerCareer 抛错', playerEdge.invalidCreate);
    }

    // MODE_PAGES player: confirm all 6 pages have buttons/content after full create
    const playerPages = await page.evaluate(() => {
      const pages = MODE_PAGES.player;
      const out = {};
      pages.forEach(p => {
        goPage(p);
        const sec = document.getElementById('page-' + p);
        out[p] = {
          currentPage: (document.querySelector('nav button.on') || {}).dataset?.page,
          textLen: sec ? (sec.innerText || '').length : -1,
          buttonCount: sec ? sec.querySelectorAll('button').length : 0,
          sampleBtns: sec ? [...sec.querySelectorAll('button')].slice(0, 8).map(b => (b.textContent || '').trim().slice(0, 24)) : [],
        };
      });
      // illegal
      const illegal = {};
      ['market', 'lineup', 'biz', 'train'].forEach(name => {
        const arr = [];
        const orig = toast;
        toast = function (m) { arr.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
        try { goPage(name); } finally { toast = orig; }
        illegal[name] = {
          currentPage: (document.querySelector('nav button.on') || {}).dataset?.page,
          toasts: arr,
        };
      });
      return { pages: out, illegal, navVisible: [...document.querySelectorAll('#nav button')].filter(b => b.style.display !== 'none').map(b => b.dataset.page) };
    });
    steps.push({ step: 'player-pages-final', data: playerPages });
    console.log('PLAYER_PAGES', JSON.stringify(playerPages, null, 2));
    Object.keys(playerPages.pages || {}).forEach(p => {
      const info = playerPages.pages[p];
      if (info.textLen < 40) record('P1-PAGE-EMPTY-' + p, 'FAIL', `选手「${p}」空页`, JSON.stringify(info));
      if (info.currentPage !== p) record('P1-PAGE-NAV-' + p, 'FAIL', `选手 goPage('${p}') 未命中`, JSON.stringify(info));
    });
    Object.keys(playerPages.illegal || {}).forEach(name => {
      const info = playerPages.illegal[name];
      if (info.currentPage === name) record('P0-ILLEGAL-' + name, 'FAIL', `选手进入了禁止页 ${name}`, JSON.stringify(info));
      if (!info.toasts || !info.toasts.length) record('P2-ILLEGAL-TOAST-' + name, 'FAIL', `选手 goPage('${name}') 无 toast`, JSON.stringify(info));
    });

    // coach poach natural trigger: set conditions and call coachPoach
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    const poach = await page.evaluate(() => {
      switchStartTab('coach');
      const idx = Math.max(0, CLUB_TEMPLATES.findIndex(c => c.seed >= 440));
      pickCoachClub(idx);
      applyCoachClub();
      try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
      // force poach conditions
      S.managerCareer = S.managerCareer || {};
      S.managerCareer.lastRank = 2;
      S.board = S.board || { trust: 80 };
      S.board.trust = 80;
      S.board.fired = false;
      // force success by stubbing random? call multiple times
      let offers = [];
      for (let i = 0; i < 20 && !S.coachOffer; i++) coachPoach(S);
      // if still none, inject exact and accept
      if (!S.coachOffer) {
        const pool = CLUB_TEMPLATES.filter(c => c.name !== S.teamName && c.seed >= 440);
        if (pool[0]) S.coachOffer = { team: pool[0].name };
      }
      goPage('club');
      renderClub();
      const hasUi = /豪门邀约/.test((document.getElementById('page-club') || {}).innerText || '');
      const teamBefore = S.teamName;
      const offer = S.coachOffer;
      let r = null;
      if (offer) { try { respondCoachOffer(true); r = 'ok'; } catch (e) { r = 'throw:' + e.message; } }
      return {
        teamBefore, offer, r,
        teamAfter: S.teamName,
        moved: offer ? S.teamName !== teamBefore : null,
        hasUi,
        dealLog: S.coachDeal && S.coachDeal.log,
        coachStill: S.coach && S.coach.name,
        toasts: (window.__toasts || []).slice(),
      };
    });
    const tPo = await drain();
    await shot(page, 'coach-poach-accept');
    steps.push({ step: 'poach-natural', data: { poach, toasts: tPo } });
    console.log('POACH', JSON.stringify({ poach, toasts: tPo }, null, 2));
    if (poach.offer && poach.r === 'ok' && !poach.moved) {
      record('P0-POACH-ACCEPT-FAIL', 'FAIL', 'coachPoach 产生的邀约接受后未换队', JSON.stringify(poach));
    }
    if (poach.hasUi === false && poach.offer) {
      record('P1-POACH-UI', 'FAIL', 'coachPoach 有 offer 但俱乐部页未渲染邀约 UI', JSON.stringify(poach));
    }

    // coach train page: club rest button missing in earlier probe? check doRest
    const coachTrainRest = await page.evaluate(() => {
      goPage('train');
      const text = (document.getElementById('page-train') || {}).innerText || '';
      const btns = [...document.querySelectorAll('#page-train button')].map(b => ({
        text: b.textContent.trim().slice(0, 30),
        onclick: b.getAttribute('onclick'),
        disabled: !!b.disabled,
      }));
      goPage('club');
      const clubBtns = [...document.querySelectorAll('#page-club button')].map(b => ({
        text: b.textContent.trim().slice(0, 30),
        onclick: b.getAttribute('onclick'),
      }));
      return {
        trainTextHead: text.slice(0, 250),
        trainHasRest: btns.some(b => /doRest|全队休息/.test((b.onclick || '') + b.text)),
        trainBtnsSample: btns.filter(b => /doTrain|doRest|doHero/.test(b.onclick || '')).slice(0, 8),
        clubHasRest: clubBtns.some(b => /doRest/.test(b.onclick || '') || /全队休息/.test(b.text)),
        clubHasStartMatch: clubBtns.some(b => /uiStartMatch|startMatch|startPlayerMatch/.test(b.onclick || '')),
        clubHasStartBtnText: clubBtns.filter(b => /赛前准备|BP|开赛|出战/.test(b.text)).map(b => b.text),
      };
    });
    steps.push({ step: 'coach-train-rest', data: coachTrainRest });
    console.log('COACH_TRAIN_REST', JSON.stringify(coachTrainRest));
    if (!coachTrainRest.clubHasStartMatch) {
      record('P1-COACH-NO-START', 'FAIL', '教练俱乐部页无开赛/BP 按钮', JSON.stringify(coachTrainRest));
    }

    // pageHint market copy for coach
    const marketCopy = await page.evaluate(() => {
      goPage('market');
      const text = (document.getElementById('page-market') || {}).innerText || '';
      return {
        head: text.slice(0, 200),
        hasManagerCopy: /买人卖人：赛前转会期自由组队/.test(text),
        hasCoachCopy: /买断挂牌由俱乐部打理|教练工作台/.test(text),
        hasForbiddenSellUI: /挂牌出售|出售（谈判）|openSellNego/.test(text),
      };
    });
    steps.push({ step: 'coach-market-copy', data: marketCopy });
    console.log('MARKET_COPY', JSON.stringify(marketCopy));
    if (marketCopy.hasManagerCopy && marketCopy.hasCoachCopy) {
      record('P2-MARKET-HINT-COPY', 'FAIL', '教练转会页 pageHint 仍是经理向「买人卖人」文案，与下方教练工作台矛盾', marketCopy.head);
    }

    const summary = { findingsCount: findings.length, failCount: findings.filter(f => f.severity === 'FAIL').length, pageErrors, stepsCount: steps.length };
    console.log('SUMMARY', JSON.stringify(summary));
    console.log('FINDINGS', JSON.stringify(findings, null, 2));
    fs.writeFileSync('E:\\sex\\kpl-manager\\.bug-hunt\\player-coach-probe-deep.json',
      JSON.stringify({ summary, findings, steps, pageErrors }, null, 2), 'utf8');
  } catch (e) {
    console.error('FATAL', e && e.stack || e);
  } finally {
    await browser.close();
  }
})();
