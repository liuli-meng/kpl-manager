// Player + Coach mode bug hunt probe
const { launch, shot } = require('../tests/playthrough/pw.js');

const findings = [];
const steps = [];
const pageErrors = [];
const consoleErrors = [];
const toasts = [];

function record(id, severity, title, detail, evidence) {
  findings.push({ id, severity, title, detail, evidence: evidence || null });
  console.log(`[${severity}] ${id} ${title}`);
  if (detail) console.log('   ', String(detail).slice(0, 400));
}

async function captureToasts(page) {
  await page.evaluate(() => {
    window.__toasts = window.__toasts || [];
    if (window.__toastHooked) return;
    window.__toastHooked = true;
    const orig = window.toast;
    if (typeof orig === 'function') {
      window.toast = function (msg) {
        try { window.__toasts.push(String(msg)); } catch (e) {}
        return orig.apply(this, arguments);
      };
    }
  });
}

async function drainToasts(page) {
  const t = await page.evaluate(() => {
    const arr = (window.__toasts || []).slice();
    window.__toasts = [];
    return arr;
  });
  t.forEach(x => toasts.push(x));
  return t;
}

async function pageInfo(page) {
  return page.evaluate(() => {
    const curNav = document.querySelector('nav button.on');
    const onSections = [...document.querySelectorAll('section.page.on')].map(p => p.id);
    const cur = curNav ? curNav.dataset.page : null;
    const sec = document.getElementById(cur ? 'page-' + cur : '');
    const buttons = sec ? [...sec.querySelectorAll('button')].map(b => ({
      text: (b.textContent || '').trim().slice(0, 40),
      onclick: b.getAttribute('onclick'),
      disabled: !!b.disabled,
      visible: b.offsetParent !== null || b.style.display !== 'none',
    })) : [];
    return {
      currentPage: cur,
      onSections,
      textLen: sec ? (sec.innerText || '').length : -1,
      htmlLen: sec ? (sec.innerHTML || '').length : -1,
      buttonCount: buttons.length,
      buttons: buttons.slice(0, 30),
      mode: (typeof S !== 'undefined' && S) ? S.mode : null,
      teamName: (typeof S !== 'undefined' && S) ? S.teamName : null,
      navVisible: [...document.querySelectorAll('#nav button')]
        .filter(b => b.style.display !== 'none')
        .map(b => b.dataset.page),
      __errLog: (window.__errLog || []).slice(-5),
      toastDump: (window.__toasts || []).slice(),
    };
  });
}

(async () => {
  const { browser, page } = await launch();
  page.on('pageerror', e => {
    pageErrors.push(String(e.message));
    console.log('[pageerror]', e.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text();
      // filter noisy non-game errors
      if (!/favicon|Failed to load resource.*sw\.js/i.test(t)) {
        consoleErrors.push(t);
        console.log('[console.error]', t.slice(0, 200));
      }
    }
  });
  page.on('dialog', async d => {
    console.log('[dialog]', d.type(), String(d.message()).slice(0, 160));
    try { await d.accept(); } catch (e) {}
  });

  try {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await captureToasts(page);
    await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });

    // ========== PLAYER START UI ==========
    const startModal = await page.evaluate(() => {
      const m = document.getElementById('start-modal');
      return {
        exists: !!m,
        hasOn: m ? m.classList.contains('on') : false,
        tabs: ['player', 'coach', 'self', 'club', 'era'].map(t => {
          const b = document.getElementById('tab-' + t);
          return { id: 'tab-' + t, exists: !!b, text: b ? b.textContent.trim() : null };
        }),
        playerBodyExists: !!document.getElementById('tab-player-body'),
        coachBodyExists: !!document.getElementById('tab-coach-body'),
        createPlayerBtn: !!document.querySelector('[onclick="createPlayerCareer()"]'),
        coachApplyBtn: !!document.getElementById('coach-apply-btn'),
      };
    });
    steps.push({ step: 'start-modal', data: startModal });
    console.log('START_MODAL', JSON.stringify(startModal));
    await shot(page, 'pc-start-modal');

    if (!startModal.hasOn || !startModal.playerBodyExists || !startModal.coachBodyExists) {
      record('P0-START', 'FAIL', '开局身份页缺失/不可见', JSON.stringify(startModal));
    }

    // Switch to player tab via real UI function
    const playerTab = await page.evaluate(() => {
      switchStartTab('player');
      const body = document.getElementById('tab-player-body');
      const teamsBox = document.getElementById('pc-teams');
      return {
        bodyDisplay: body ? body.style.display : null,
        bodyVisible: body ? body.style.display !== 'none' : false,
        teamCards: teamsBox ? teamsBox.querySelectorAll('.club-card').length : 0,
        _pcTeams: (window._pcTeams || []).map(c => c.name),
        _pcTeam: _pcTeam,
        _pcPos: _pcPos,
        _pcArch: _pcArch,
        createBtn: !!document.querySelector('[onclick="createPlayerCareer()"]'),
        nameInput: !!document.getElementById('pc-name'),
        posBtns: ['top', 'jungle', 'mid', 'bot', 'support', 'farm', 'lane'].filter(p => !!document.getElementById('pc-pos-' + p)),
        allPosBtns: [...document.querySelectorAll('[id^="pc-pos-"]')].map(b => b.id),
        archBtns: [...document.querySelectorAll('[id^="pc-arch-"]')].map(b => b.id + ':' + b.textContent.trim()),
        eraBtns: [...document.querySelectorAll('#pc-era-btns button')].map(b => b.textContent.trim()),
      };
    });
    steps.push({ step: 'player-tab', data: playerTab });
    console.log('PLAYER_TAB', JSON.stringify(playerTab));
    await shot(page, 'pc-player-tab');

    if (!playerTab.bodyVisible) {
      record('P0-PTAB', 'FAIL', '选手生涯标签页未显示', JSON.stringify(playerTab));
    }
    if (!playerTab.createBtn) {
      record('P0-PCREATE', 'FAIL', '「开启选手生涯」按钮不存在', null);
    }
    if (!playerTab.teamCards || playerTab.teamCards < 1) {
      record('P0-PTEAMS', 'FAIL', '选手开局无球队卡片可选', JSON.stringify(playerTab));
    }

    // Empty name path → 无名小将
    await page.evaluate(() => {
      const n = document.getElementById('pc-name');
      if (n) n.value = '';
      if (!_pcTeam && window._pcTeams && window._pcTeams.length) {
        pickPlayerTeam(window._pcTeams[0].name);
      }
    });
    // youth arch (17yo) first to test under-age messaging
    await page.evaluate(() => { pickPlayerArch(0); pickPlayerPos('mid'); });
    await page.evaluate(() => { createPlayerCareer(); });
    await page.waitForTimeout(400);
    await page.evaluate(() => { try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {} });

    const afterCreateDefault = await page.evaluate(() => {
      const me = myPlayer(S);
      return {
        mode: S && S.mode,
        teamName: S && S.teamName,
        career: !!S.career,
        meName: me && me.name,
        meAge: me && me.age,
        mePos: me && me.pos,
        starter: me && S.lineup.includes(me.id),
        pageCareerOn: !!document.querySelector('#page-career.on'),
        careerText: (document.querySelector('#page-career') || {}).innerText?.slice(0, 300) || '',
        modalOff: !document.getElementById('start-modal').classList.contains('on'),
        navVisible: [...document.querySelectorAll('#nav button')].filter(b => b.style.display !== 'none').map(b => b.dataset.page),
        eventLog: (S.eventLog || []).slice(0, 4).map(e => (e && (e.txt || e.text || String(e))).slice(0, 120)),
      };
    });
    steps.push({ step: 'create-player-default-name', data: afterCreateDefault });
    console.log('AFTER_CREATE_DEFAULT', JSON.stringify(afterCreateDefault));
    await shot(page, 'pc-career-after-create');

    if (afterCreateDefault.mode !== 'player') {
      record('P0-PCAREER', 'FAIL', 'createPlayerCareer 后 mode 不是 player', JSON.stringify(afterCreateDefault));
    }
    if (afterCreateDefault.meName !== '无名小将') {
      record('P2-DEFAULT-NAME', 'FAIL', '空名字未回落为「无名小将」', '实际: ' + afterCreateDefault.meName);
    }
    if (!afterCreateDefault.modalOff) {
      record('P0-PMODAL', 'FAIL', '开局后 start-modal 未关闭', null);
    }
    if (!afterCreateDefault.pageCareerOn) {
      record('P0-PCAREER-PAGE', 'FAIL', '开局后未进入生涯页', JSON.stringify(afterCreateDefault));
    }

    // MODE_PAGES.player all pages
    const expectedPlayerPages = ['career', 'club', 'league', 'kjia', 'union', 'hall'];
    const pageAudit = {};
    for (const p of expectedPlayerPages) {
      const t0 = toasts.length;
      await page.evaluate((name) => { goPage(name); }, p);
      await page.waitForTimeout(200);
      const info = await pageInfo(page);
      const t = await drainToasts(page);
      pageAudit[p] = { ...info, newToasts: t };
      await shot(page, 'pc-page-' + p);
      if (info.textLen < 40) {
        record('P1-EMPTY-' + p, 'FAIL', `选手模式「${p}」页疑似空页`, JSON.stringify({ textLen: info.textLen, htmlLen: info.htmlLen, onSections: info.onSections, toasts: t }));
      }
      if (info.currentPage !== p) {
        record('P1-NAV-' + p, 'FAIL', `goPage('${p}') 未落在该页`, JSON.stringify({ currentPage: info.currentPage, onSections: info.onSections, toasts: t }));
      }
      if (info.buttonCount === 0 && p === 'career') {
        record('P1-CAREER-BTN', 'FAIL', '生涯页无任何按钮', null);
      }
    }
    steps.push({ step: 'player-page-audit', data: pageAudit });

    // Illegal page for player: market should toast + fallback
    {
      const before = await pageInfo(page);
      const t = await page.evaluate(() => {
        const arr = [];
        const orig = toast;
        toast = function (m) { arr.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
        try { goPage('market'); } finally { toast = orig; }
        return {
          toasts: arr,
          currentPage: (document.querySelector('nav button.on') || {}).dataset?.page,
          onSections: [...document.querySelectorAll('section.page.on')].map(p => p.id),
        };
      });
      await drainToasts(page);
      steps.push({ step: 'player-goPage-market', data: t });
      console.log('PLAYER_MARKET_BLOCK', JSON.stringify(t));
      if (!t.toasts.length || !/没有|身份|回到|market|转会/i.test(t.toasts.join(' '))) {
        record('P1-MARKET-TOAST', 'FAIL', '选手 goPage(market) 无身份门禁 toast', JSON.stringify(t));
      }
      if (t.currentPage === 'market') {
        record('P0-MARKET-LEAK', 'FAIL', '选手模式仍可进入经理专属 market 页', JSON.stringify(t));
      }
    }

    // biz illegal page
    {
      const t = await page.evaluate(() => {
        const arr = [];
        const orig = toast;
        toast = function (m) { arr.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
        try { goPage('biz'); } finally { toast = orig; }
        return {
          toasts: arr,
          currentPage: (document.querySelector('nav button.on') || {}).dataset?.page,
        };
      });
      steps.push({ step: 'player-goPage-biz', data: t });
      console.log('PLAYER_BIZ_BLOCK', JSON.stringify(t));
      if (t.currentPage === 'biz') {
        record('P0-BIZ-LEAK', 'FAIL', '选手模式仍可进入经营 biz 页', JSON.stringify(t));
      }
      if (!t.toasts.length) {
        record('P2-BIZ-TOAST', 'FAIL', '选手 goPage(biz) 无 toast 提示', JSON.stringify(t));
      }
    }

    // Career page actions
    await page.evaluate(() => goPage('career'));
    await page.waitForTimeout(200);
    const careerBtns = await page.evaluate(() => {
      return [...document.querySelectorAll('#page-career button')].map(b => ({
        text: (b.textContent || '').trim(),
        onclick: b.getAttribute('onclick'),
        disabled: !!b.disabled,
      }));
    });
    steps.push({ step: 'career-buttons', data: careerBtns });
    console.log('CAREER_BTNS', JSON.stringify(careerBtns));
    const needCareer = ['playerTrain', 'playerRest', 'playerRequestTransfer', 'playerSocial'];
    const careerOnclick = careerBtns.map(b => b.onclick || '').join(' | ');
    needCareer.forEach(fn => {
      if (!careerOnclick.includes(fn)) {
        record('P1-CAREER-MISS-' + fn, 'FAIL', `生涯页缺少功能入口 ${fn}`, '按钮 onclick: ' + careerOnclick.slice(0, 300));
      }
    });

    // Train action
    const trainRes = await page.evaluate(() => {
      const me = myPlayer(S);
      const before = {
        trained: S.trained,
        energy: me && me.energy,
        attrs: me && { ...me.attrs },
        stats: S.career && S.career.stats ? { ...S.career.stats } : null,
        age: me && me.age,
      };
      const btns = [...document.querySelectorAll('#page-career button')]
        .filter(b => (b.getAttribute('onclick') || '').includes('playerTrain'))
        .map(b => ({ text: b.textContent.trim(), disabled: b.disabled, onclick: b.getAttribute('onclick') }));
      let result = null;
      try {
        playerTrain('lane');
        result = 'ok';
      } catch (e) {
        result = 'throw:' + e.message;
      }
      const after = {
        trained: S.trained,
        energy: me && me.energy,
        attrs: me && { ...me.attrs },
        stats: S.career && S.career.stats ? { ...S.career.stats } : null,
      };
      return { before, after, result, trainBtns: btns };
    });
    const tTrain = await drainToasts(page);
    steps.push({ step: 'player-train', data: { trainRes, toasts: tTrain } });
    console.log('PLAYER_TRAIN', JSON.stringify({ trainRes, toasts: tTrain }));
    if (trainRes.result && trainRes.result.startsWith('throw')) {
      record('P0-TRAIN-THROW', 'FAIL', 'playerTrain 抛异常', trainRes.result);
    }
    if (trainRes.before.trained === false && trainRes.after.trained !== true && trainRes.before.energy >= 10) {
      // may fail if under-age blocked - check toast
      if (!tTrain.some(x => /未成年|满|不能|今日|体力|伤停|租借|K甲|集训/.test(x))) {
        record('P1-TRAIN-NOOP', 'FAIL', '加练按钮点了无状态变化且无说明', JSON.stringify({ trainRes, toasts: tTrain }));
      }
    }

    // startPlayerMatch
    await page.evaluate(() => goPage('club'));
    await page.waitForTimeout(200);
    const clubBeforeMatch = await pageInfo(page);
    steps.push({ step: 'club-before-match', data: clubBeforeMatch });
    await shot(page, 'pc-club-before-match');

    const hasMatchBtn = clubBeforeMatch.buttons.some(b => (b.onclick || '').includes('startPlayerMatch') || /出战|比赛/.test(b.text || ''));
    if (!hasMatchBtn) {
      record('P1-MATCH-BTN', 'FAIL', '俱乐部页找不到选手出战按钮', JSON.stringify(clubBeforeMatch.buttons));
    }

    const matchRes = await page.evaluate(() => {
      const me = myPlayer(S);
      const before = {
        matchIdx: S.matchIdx,
        caps: me && me.caps,
        apps: me && me.apps,
        history: (S.history || []).length,
        phase: S.phase,
        lineupHasMe: me ? S.lineup.includes(me.id) : null,
        injury: me && me.injury,
      };
      let result = null;
      try {
        startPlayerMatch();
        result = 'ok';
      } catch (e) {
        result = 'throw:' + e.message;
      }
      return {
        before,
        result,
        after: {
          matchIdx: S.matchIdx,
          caps: me && me.caps,
          apps: me && me.apps,
          history: (S.history || []).length,
          series: !!S.series,
          phase: S.phase,
          injury: me && me.injury,
          careerMatches: S.career && S.career.stats ? S.career.stats.matches : null,
        },
        seriesMw: S.series && S.series.mw,
        seriesOw: S.series && S.series.ow,
        logs: (S.series && S.series.logs ? S.series.logs.slice(0, 3) : null),
      };
    });
    const tMatch = await drainToasts(page);
    await page.waitForTimeout(300);
    steps.push({ step: 'startPlayerMatch', data: { matchRes, toasts: tMatch } });
    console.log('PLAYER_MATCH', JSON.stringify({ matchRes, toasts: tMatch }));
    if (matchRes.result && matchRes.result.startsWith('throw')) {
      record('P0-MATCH-THROW', 'FAIL', 'startPlayerMatch 抛异常', matchRes.result);
    }
    if (matchRes.result === 'ok' && matchRes.before.matchIdx === matchRes.after.matchIdx && !(matchRes.after.history > matchRes.before.history)) {
      record('P0-MATCH-STUCK', 'FAIL', 'startPlayerMatch 调用后赛程/复盘无推进', JSON.stringify({ matchRes, toasts: tMatch }));
    }
    await shot(page, 'pc-after-match');

    // Injury state: can UI still operate / is there explanation
    const injuryRes = await page.evaluate(() => {
      const me = myPlayer(S);
      if (!me) return { error: 'no me' };
      me.injury = 5;
      me.energy = 100;
      S.trained = false;
      goPage('career');
      const trainBtns = [...document.querySelectorAll('#page-career button')]
        .filter(b => /playerTrain|playerHeroTrain|playerRest/.test(b.getAttribute('onclick') || ''))
        .map(b => ({ text: b.textContent.trim(), disabled: b.disabled, onclick: b.getAttribute('onclick') }));
      const careerText = (document.querySelector('#page-career') || {}).innerText || '';
      const hasInjuryText = /伤停/.test(careerText);
      // try train anyway
      let trainTry = null;
      try { playerTrain('lane'); trainTry = 'ok'; } catch (e) { trainTry = 'throw:' + e.message; }
      const afterTrained = S.trained;
      // startPlayerMatch while injured
      let matchTry = null;
      try { startPlayerMatch(); matchTry = 'ok'; } catch (e) { matchTry = 'throw:' + e.message; }
      return {
        trainBtns,
        hasInjuryText,
        injurySnippet: (careerText.match(/.{0,20}伤停.{0,40}/) || [])[0] || null,
        trainTry,
        afterTrained,
        matchTry,
        matchIdx: S.matchIdx,
        careerTextHead: careerText.slice(0, 200),
      };
    });
    const tInj = await drainToasts(page);
    steps.push({ step: 'player-injury-ui', data: { injuryRes, toasts: tInj } });
    console.log('PLAYER_INJURY', JSON.stringify({ injuryRes, toasts: tInj }));
    await shot(page, 'pc-injury-career');

    if (!injuryRes.hasInjuryText) {
      record('P1-INJ-TEXT', 'FAIL', '伤停状态生涯页无「伤停」说明文案', JSON.stringify(injuryRes));
    }
    const trainEnabledWhileInjured = (injuryRes.trainBtns || []).some(b => /练对线|练运营|练团战|练心态/.test(b.text) && !b.disabled);
    if (trainEnabledWhileInjured) {
      // engine may toast-block; check toast
      if (!tInj.some(x => /伤停|养伤|不能/.test(x))) {
        record('P1-INJ-TRAIN', 'FAIL', '伤停时训练按钮仍可点且无拦截提示', JSON.stringify({ injuryRes, toasts: tInj }));
      }
    }

    // Transfer request path
    const transferRes = await page.evaluate(() => {
      const me = myPlayer(S);
      if (!me) return { error: 'no me' };
      me.injury = 0;
      me.energy = 80;
      me.val = 140;
      me.popularity = 80;
      ['lane','farm','team','mind'].forEach(k => { me.attrs[k] = 90; });
      me.contract = 1;
      S.offers = S.offers || [];
      S.career.pendingMove = null;
      goPage('career');
      const btns = [...document.querySelectorAll('#page-career button')]
        .map(b => ({ text: b.textContent.trim(), onclick: b.getAttribute('onclick'), disabled: b.disabled }))
        .filter(b => /transfer|Transfer|loan|Loan|kjia|Kjia|retire|Retire|playerToCoach/.test(b.onclick || '') || /转会|租借|K甲|退役/.test(b.text || ''));
      let r = null;
      try { r = playerRequestTransfer(S); } catch (e) { r = 'throw:' + e.message; }
      return {
        btns,
        r,
        offers: (S.offers || []).filter(o => o.pid === me.id),
        meOverall: overall(me),
        careerTextHasTransfer: /申请转会|转会/.test((document.querySelector('#page-career') || {}).innerText || ''),
      };
    });
    const tTr = await drainToasts(page);
    steps.push({ step: 'player-transfer-request', data: { transferRes, toasts: tTr } });
    console.log('PLAYER_TRANSFER', JSON.stringify({ transferRes, toasts: tTr }));
    if (transferRes.r && String(transferRes.r).startsWith('throw')) {
      record('P0-TRANSFER-THROW', 'FAIL', 'playerRequestTransfer 抛异常', transferRes.r);
    }
    if (transferRes.r === false && !tTr.some(x => /接盘|报价|合同|集训|租借|退役|俱乐部/.test(x))) {
      record('P1-TRANSFER-SILENT', 'FAIL', '申请转会失败且无明确 toast 说明', JSON.stringify({ transferRes, toasts: tTr }));
    }

    // Force bench days and loan/kjia buttons
    const loanRes = await page.evaluate(() => {
      const me = myPlayer(S);
      if (!me) return { error: 'no me' };
      me.injury = 0;
      me.loanOut = null;
      me.kjia = 0;
      S.career.benchDays = 3;
      S.career.pendingMove = null;
      // force bench: remove from lineup
      const li = S.lineup.indexOf(me.id);
      if (li >= 0) S.lineup.splice(li, 1);
      goPage('career');
      const btns = [...document.querySelectorAll('#page-career button')].map(b => ({
        text: b.textContent.trim(),
        onclick: b.getAttribute('onclick'),
        disabled: !!b.disabled,
      }));
      const loanBtn = btns.find(b => (b.onclick || '').includes('playerRequestLoanOut'));
      const kjiaBtn = btns.find(b => (b.onclick || '').includes('playerRequestKjia'));
      const transferBtn = btns.find(b => (b.onclick || '').includes('playerRequestTransfer'));
      const careerText = (document.querySelector('#page-career') || {}).innerText || '';
      let loanR = null, kjiaR = null;
      try { loanR = playerRequestLoanOut(S); } catch (e) { loanR = 'throw:' + e.message; }
      const loanToasts = (window.__toasts || []).slice(); window.__toasts = [];
      try { kjiaR = playerRequestKjia(S); } catch (e) { kjiaR = 'throw:' + e.message; }
      return {
        loanBtn, kjiaBtn, transferBtn,
        hasBenchPanel: /板凳|租借离队|下放 K甲/.test(careerText),
        loanR, kjiaR,
        loanToasts,
        kjiaToasts: (window.__toasts || []).slice(),
        loanOut: me.loanOut,
        kjia: me.kjia,
        benchDays: S.career.benchDays,
      };
    });
    const tLoan = await drainToasts(page);
    steps.push({ step: 'player-loan-kjia', data: { loanRes, toasts: tLoan } });
    console.log('PLAYER_LOAN', JSON.stringify({ loanRes, toasts: tLoan }));
    await shot(page, 'pc-loan-career');

    if (!loanRes.loanBtn && !loanRes.kjiaBtn && !loanRes.hasBenchPanel) {
      record('P1-NO-EXIT', 'FAIL', '板凳出路（租借/K甲）入口未出现', JSON.stringify(loanRes));
    }
    if (loanRes.loanBtn && loanRes.loanBtn.disabled === false && loanRes.loanR === false) {
      if (![...(loanRes.loanToasts || []), ...tLoan].some(x => /替补|租借|观察|首发|不能|伤停|集训|K甲/.test(x))) {
        record('P1-LOAN-SILENT', 'FAIL', '租借按钮可点但失败且无说明', JSON.stringify({ loanRes, toasts: tLoan }));
      }
    }

    // Retired UI
    const retiredRes = await page.evaluate(() => {
      const me = myPlayer(S);
      if (!me) return { error: 'no me' };
      const meId = me.id;
      S.career.retired = true;
      S.career.legacy = {
        name: me.name, age: me.age, pos: me.pos, ovr: overall(me),
        mvp: me.mvp || 0, titles: S.career.titles || 0, fmvp: S.career.fmvp || 0,
        allstar: S.career.allstar || 0, seasons: (S.career.seasons || []).length,
      };
      // remove from roster like engine does
      S.players = S.players.filter(p => p.id !== meId);
      goPage('career');
      const text = (document.querySelector('#page-career') || {}).innerText || '';
      const btns = [...document.querySelectorAll('#page-career button')].map(b => ({
        text: b.textContent.trim(), onclick: b.getAttribute('onclick'), disabled: !!b.disabled,
      }));
      // try match / next day
      let matchTry = null, nextTry = null, trainTry = null;
      try { startPlayerMatch(); matchTry = 'ok'; } catch (e) { matchTry = 'throw:' + e.message; }
      try { uiNextDay(S); nextTry = 'ok'; } catch (e) { nextTry = 'throw:' + e.message; }
      try { playerTrain('lane'); trainTry = 'ok'; } catch (e) { trainTry = 'throw:' + e.message; }
      return {
        hasRetiredText: /退役/.test(text),
        textHead: text.slice(0, 300),
        btns,
        matchTry, nextTry, trainTry,
        hasCoachBtn: btns.some(b => /playerToCoach|转教练/.test((b.onclick || '') + b.text)),
        hasResetBtn: btns.some(b => /resetGame|重新开始|下一段旅程/.test((b.onclick || '') + b.text)),
      };
    });
    const tRet = await drainToasts(page);
    steps.push({ step: 'player-retired-ui', data: { retiredRes, toasts: tRet } });
    console.log('PLAYER_RETIRED', JSON.stringify({ retiredRes, toasts: tRet }));
    await shot(page, 'pc-retired-career');

    if (!retiredRes.hasRetiredText) {
      record('P0-RETIRED-UI', 'FAIL', '退役后生涯页无退役结算/说明', JSON.stringify(retiredRes));
    }
    if (retiredRes.matchTry === 'ok' && !tRet.some(x => /退役/.test(x))) {
      record('P1-RETIRED-MATCH', 'FAIL', '退役后 startPlayerMatch 仍可无提示通过', JSON.stringify({ retiredRes, toasts: tRet }));
    }
    if (!retiredRes.hasResetBtn && !retiredRes.hasCoachBtn) {
      record('P1-RETIRED-BTN', 'FAIL', '退役结算页无重新开始/转教练按钮', JSON.stringify(retiredRes));
    }

    // Under-age (youth) path: re-create career with 17yo
    await page.evaluate(() => {
      try { localStorage.clear(); } catch (e) {}
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await captureToasts(page);
    await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });
    const youthRes = await page.evaluate(() => {
      if (document.getElementById('start-modal') && !document.getElementById('start-modal').classList.contains('on')) {
        try { initStart(); } catch (e) {}
      }
      switchStartTab('player');
      pickPlayerArch(0); // youth 17
      pickPlayerPos('jungle');
      const n = document.getElementById('pc-name');
      if (n) n.value = '青训小将';
      if (!_pcTeam && window._pcTeams && window._pcTeams[0]) pickPlayerTeam(window._pcTeams[0].name);
      createPlayerCareer();
      const me = myPlayer(S);
      const starter = me ? S.lineup.includes(me.id) : null;
      const text = (document.querySelector('#page-career') || {}).innerText || '';
      let matchTry = null;
      try { startPlayerMatch(); matchTry = 'ok'; } catch (e) { matchTry = 'throw:' + e.message; }
      return {
        meName: me && me.name, meAge: me && me.age, starter,
        hasUnderAgeText: /未满|未成年|跟训|满 .{0,3} 岁/.test(text) || (S.eventLog || []).some(e => /未满|未成年|跟训/.test(e.txt || e.text || '')),
        eventLog: (S.eventLog || []).slice(0, 5).map(e => (e.txt || e.text || String(e)).slice(0, 120)),
        matchTry,
        matchIdx: S.matchIdx,
        mode: S.mode,
        page: (document.querySelector('nav button.on') || {}).dataset?.page,
      };
    });
    const tYouth = await drainToasts(page);
    steps.push({ step: 'player-youth-underage', data: { youthRes, toasts: tYouth } });
    console.log('PLAYER_YOUTH', JSON.stringify({ youthRes, toasts: tYouth }));
    await shot(page, 'pc-youth-career');
    if ((youthRes.meAge || 0) < 18 && youthRes.starter) {
      record('P1-UNDERAGE-START', 'FAIL', '未成年选手被排进首发', JSON.stringify(youthRes));
    }
    if ((youthRes.meAge || 0) < 18 && !youthRes.hasUnderAgeText) {
      record('P1-UNDERAGE-TEXT', 'FAIL', '未成年选手无「满龄才能出场」说明', JSON.stringify(youthRes));
    }

    // ========== COACH MODE ==========
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await captureToasts(page);
    await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });

    const coachTab = await page.evaluate(() => {
      switchStartTab('coach');
      const grid = document.getElementById('coach-clubs');
      const cards = grid ? [...grid.children].map((c, i) => ({
        i,
        onclick: c.getAttribute('onclick'),
        dataCi: c.getAttribute('data-ci'),
        text: (c.innerText || '').replace(/\s+/g, ' ').slice(0, 60),
      })) : [];
      return {
        bodyVisible: !!document.getElementById('tab-coach-body') && document.getElementById('tab-coach-body').style.display !== 'none',
        cardCount: cards.length,
        cards: cards.slice(0, 5),
        firstUsesPickCoachClub: cards[0] ? /pickCoachClub/.test(cards[0].onclick || '') : false,
        anyUsesPickClubWrong: cards.some(c => /^pickClub\(/.test(c.onclick || '')),
        applyBtnDisabled: (document.getElementById('coach-apply-btn') || {}).disabled,
        applyBtnText: (document.getElementById('coach-apply-btn') || {}).innerText,
      };
    });
    steps.push({ step: 'coach-tab', data: coachTab });
    console.log('COACH_TAB', JSON.stringify(coachTab));
    await shot(page, 'coach-tab');
    if (!coachTab.bodyVisible) {
      record('P0-CTAB', 'FAIL', '教练生涯标签页未显示', JSON.stringify(coachTab));
    }
    if (!coachTab.cardCount) {
      record('P0-CCARDS', 'FAIL', '教练选队无俱乐部卡片', JSON.stringify(coachTab));
    }
    if (!coachTab.firstUsesPickCoachClub) {
      record('P0-CPICK-BIND', 'FAIL', '教练卡片未绑定 pickCoachClub（开始执教会点不亮）', JSON.stringify(coachTab));
    }

    // pick without selection → toast
    const pickNone = await page.evaluate(() => {
      _coachPick = -1;
      const btn = document.getElementById('coach-apply-btn');
      if (btn) btn.disabled = true;
      const arr = [];
      const orig = toast;
      toast = function (m) { arr.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      try { applyCoachClub(); } finally { toast = orig; }
      return { toasts: arr, mode: S && S.mode, modalOn: document.getElementById('start-modal').classList.contains('on') };
    });
    steps.push({ step: 'coach-apply-no-pick', data: pickNone });
    console.log('COACH_NO_PICK', JSON.stringify(pickNone));
    if (!pickNone.toasts.some(x => /请先选择/.test(x))) {
      record('P2-CPICK-TOAST', 'FAIL', '未选队点开始执教无提示', JSON.stringify(pickNone));
    }

    // Real start coaching
    const applyCoach = await page.evaluate(() => {
      pickCoachClub(1);
      const tip = (document.getElementById('coach-pick-tip') || {}).textContent;
      const btnDisabled = (document.getElementById('coach-apply-btn') || {}).disabled;
      applyCoachClub();
      return {
        tip, btnDisabled,
        mode: S && S.mode,
        teamName: S && S.teamName,
        coach: S && S.coach && S.coach.name,
        coachDeal: S && S.coachDeal,
        lineupLen: S && S.lineup && S.lineup.length,
        lineupPos: (S.lineup || []).map(id => {
          const p = S.players.find(x => x.id === id);
          return p ? p.pos + ':' + p.name : '?';
        }),
        playersCount: S && S.players && S.players.length,
        transferWindow: S && S.transferWindow,
        preseason: S && S.preseason,
        modalOff: !document.getElementById('start-modal').classList.contains('on'),
        navVisible: [...document.querySelectorAll('#nav button')].filter(b => b.style.display !== 'none').map(b => b.dataset.page),
        currentPage: (document.querySelector('nav button.on') || {}).dataset?.page,
        eventLog: (S.eventLog || []).slice(0, 4).map(e => (e.txt || e.text || String(e)).slice(0, 140)),
      };
    });
    await page.waitForTimeout(400);
    const tApply = await drainToasts(page);
    steps.push({ step: 'apply-coach', data: { applyCoach, toasts: tApply } });
    console.log('APPLY_COACH', JSON.stringify({ applyCoach, toasts: tApply }));
    await shot(page, 'coach-after-apply-club');

    if (applyCoach.mode !== 'coach') {
      record('P0-COACH-MODE', 'FAIL', 'applyCoachClub 后 mode 不是 coach', JSON.stringify(applyCoach));
    }
    if (!applyCoach.modalOff) {
      record('P0-COACH-MODAL', 'FAIL', '开始执教后 start-modal 未关闭', null);
    }
    if (applyCoach.currentPage !== 'club') {
      record('P1-COACH-PAGE', 'FAIL', '开始执教后未进入俱乐部页', JSON.stringify(applyCoach));
    }

    const expectedCoachPages = ['club', 'lineup', 'market', 'train', 'league', 'kjia', 'union', 'hall'];
    const coachAudit = {};
    for (const p of expectedCoachPages) {
      await page.evaluate((name) => { goPage(name); }, p);
      await page.waitForTimeout(250);
      const info = await pageInfo(page);
      const t = await drainToasts(page);
      coachAudit[p] = { ...info, newToasts: t };
      await shot(page, 'coach-page-' + p);
      if (info.textLen < 40) {
        record('P1-COACH-EMPTY-' + p, 'FAIL', `教练模式「${p}」页疑似空页`, JSON.stringify({ textLen: info.textLen, htmlLen: info.htmlLen, onSections: info.onSections, toasts: t }));
      }
      if (info.currentPage !== p) {
        record('P1-COACH-NAV-' + p, 'FAIL', `教练 goPage('${p}') 未落在该页`, JSON.stringify({ currentPage: info.currentPage, toasts: t }));
      }
    }
    steps.push({ step: 'coach-page-audit', data: coachAudit });

    // Coach market page content
    await page.evaluate(() => goPage('market'));
    await page.waitForTimeout(250);
    const coachMarket = await page.evaluate(() => {
      const text = (document.getElementById('page-market') || {}).innerText || '';
      return {
        textLen: text.length,
        hasCoachWorkbench: /教练工作台|应急|引援/.test(text),
        hasBuyout: /买断|挂牌出售|出售（谈判）/.test(text),
        hasLoan: /租借/.test(text),
        hasSign: /直签|申请直签/.test(text),
        buttons: [...document.querySelectorAll('#page-market button')].map(b => ({
          text: b.textContent.trim().slice(0, 30),
          onclick: b.getAttribute('onclick'),
          disabled: !!b.disabled,
        })).slice(0, 40),
        textHead: text.slice(0, 350),
      };
    });
    const tMkt = await drainToasts(page);
    steps.push({ step: 'coach-market', data: { coachMarket, toasts: tMkt } });
    console.log('COACH_MARKET', JSON.stringify(coachMarket));
    await shot(page, 'coach-market');
    if (!coachMarket.hasCoachWorkbench) {
      record('P1-CMARKET-WB', 'FAIL', '教练市场页无教练工作台/应急引援内容', JSON.stringify(coachMarket));
    }
    if (!coachMarket.hasLoan) {
      record('P1-CMARKET-LOAN', 'FAIL', '教练市场页无租借入口', null);
    }

    // goPage market for coach is ALLOWED; goPage biz should fallback
    const coachBiz = await page.evaluate(() => {
      const arr = [];
      const orig = toast;
      toast = function (m) { arr.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      try { goPage('biz'); } finally { toast = orig; }
      return {
        toasts: arr,
        currentPage: (document.querySelector('nav button.on') || {}).dataset?.page,
        onSections: [...document.querySelectorAll('section.page.on')].map(p => p.id),
      };
    });
    await drainToasts(page);
    steps.push({ step: 'coach-goPage-biz', data: coachBiz });
    console.log('COACH_BIZ', JSON.stringify(coachBiz));
    if (coachBiz.currentPage === 'biz') {
      record('P0-COACH-BIZ-LEAK', 'FAIL', '教练模式仍可进入经理经营 biz 页', JSON.stringify(coachBiz));
    }
    if (!coachBiz.toasts.length) {
      record('P2-COACH-BIZ-TOAST', 'FAIL', '教练 goPage(biz) 无 toast/回退说明', JSON.stringify(coachBiz));
    }

    // lineup + train visibility
    const lineupTrain = await page.evaluate(() => {
      goPage('lineup');
      const lineText = (document.getElementById('page-lineup') || {}).innerText || '';
      const lineBtns = [...document.querySelectorAll('#page-lineup button')].map(b => ({
        text: b.textContent.trim().slice(0, 24),
        onclick: b.getAttribute('onclick'),
        disabled: !!b.disabled,
      }));
      goPage('train');
      const trainText = (document.getElementById('page-train') || {}).innerText || '';
      const trainBtns = [...document.querySelectorAll('#page-train button')].map(b => ({
        text: b.textContent.trim().slice(0, 24),
        onclick: b.getAttribute('onclick'),
        disabled: !!b.disabled,
      }));
      goPage('club');
      const clubText = (document.getElementById('page-club') || {}).innerText || '';
      return {
        lineTextLen: lineText.length,
        lineHasLineup: /首发阵容|替补席/.test(lineText),
        lineHasTactic: /战术板/.test(lineText),
        lineHasCoachGap: /阵容告急|应急租借/.test(lineText),
        lineHasSell: lineBtns.some(b => /出售/.test(b.text) || /openSellNego/.test(b.onclick || '')),
        lineBtnCount: lineBtns.length,
        lineBtns: lineBtns.slice(0, 20),
        trainTextLen: trainText.length,
        trainHasPlayers: /选手训练|没有选手/.test(trainText),
        trainBtnCount: trainBtns.filter(b => /doTrain|doHeroTrain/.test(b.onclick || '')).length,
        trainHasRest: /doRest|全队休息/.test(trainText) || trainBtns.some(b => /doRest/.test(b.onclick || '')),
        clubHasCoachDeal: /执教履历|执教合同|主教练/.test(clubText),
        clubHasBoard: /董事会/.test(clubText),
        clubHasMatch: /赛前准备|下一场比赛|BP|出战/.test(clubText),
        clubTextHead: clubText.slice(0, 300),
        clubBtns: [...document.querySelectorAll('#page-club button')].map(b => ({
          text: b.textContent.trim().slice(0, 30),
          onclick: b.getAttribute('onclick'),
          disabled: !!b.disabled,
        })).slice(0, 25),
      };
    });
    await drainToasts(page);
    steps.push({ step: 'coach-lineup-train-club', data: lineupTrain });
    console.log('COACH_LINEUP_TRAIN', JSON.stringify(lineupTrain));
    await shot(page, 'coach-club-panel');
    await page.evaluate(() => goPage('lineup')); await page.waitForTimeout(200); await shot(page, 'coach-lineup');
    await page.evaluate(() => goPage('train')); await page.waitForTimeout(200); await shot(page, 'coach-train');

    if (!lineupTrain.lineHasLineup) {
      record('P1-COACH-LINEUP', 'FAIL', '教练阵容页无首发/替补内容', JSON.stringify(lineupTrain));
    }
    if (lineupTrain.trainBtnCount < 1) {
      record('P1-COACH-TRAIN', 'FAIL', '教练训练页无训练按钮', JSON.stringify(lineupTrain));
    }
    if (lineupTrain.lineHasSell) {
      record('P2-COACH-SELL-UI', 'FAIL', '教练阵容页仍出现出售按钮（应归俱乐部）', JSON.stringify(lineupTrain.lineBtns));
    }
    if (!lineupTrain.clubHasCoachDeal) {
      record('P1-COACH-DEAL-UI', 'FAIL', '教练俱乐部页无执教合同/履历面板', JSON.stringify(lineupTrain));
    }

    // startMatch / BP for coach
    const coachMatch = await page.evaluate(() => {
      goPage('club');
      const before = {
        matchIdx: S.matchIdx,
        phase: S.phase,
        scheduleLen: (S.schedule || []).length,
        hasSeries: !!S.series,
        lineupLen: (S.lineup || []).length,
      };
      let startTry = null, uiTry = null;
      try { startMatch(); startTry = 'ok'; } catch (e) { startTry = 'throw:' + e.message; }
      const afterStart = {
        hasSeries: !!S.series,
        seriesStage: S.series && S.series.stage,
        seriesMid: S.series && S.series.mid,
        prepOpen: !!(window._prepTitle != null || document.querySelector('#prep-modal.on, #bp-modal.on, .modal.on')),
        modals: [...document.querySelectorAll('.modal')].filter(m => m.classList.contains('on')).map(m => m.id),
        bodyHasPrep: /赛前准备|BP|全局BP|开始第/.test(document.body.innerText || ''),
      };
      return { before, startTry, afterStart, scheduleHead: (S.schedule || []).slice(0, 2).map(m => ({ opp: m.opp, mid: m.mid })) };
    });
    const tCM = await drainToasts(page);
    await page.waitForTimeout(300);
    steps.push({ step: 'coach-startMatch', data: { coachMatch, toasts: tCM } });
    console.log('COACH_MATCH', JSON.stringify({ coachMatch, toasts: tCM }));
    await shot(page, 'coach-startMatch');

    if (coachMatch.startTry && coachMatch.startTry.startsWith('throw')) {
      record('P0-COACH-MATCH-THROW', 'FAIL', '教练 startMatch 抛异常', coachMatch.startTry);
    }
    if (coachMatch.startTry === 'ok' && !coachMatch.afterStart.hasSeries && coachMatch.before.scheduleLen > 0 && coachMatch.before.phase !== 'annual') {
      if (!tCM.some(x => /赛程|转会期|已结束|结束/.test(x))) {
        record('P1-COACH-MATCH-NOOP', 'FAIL', '教练 startMatch 无系列赛/无弹窗/无说明', JSON.stringify({ coachMatch, toasts: tCM }));
      }
    }

    // If prep modal open, check BP-related buttons
    const bpInfo = await page.evaluate(() => {
      const onModals = [...document.querySelectorAll('.modal.on')].map(m => m.id);
      const text = document.body.innerText || '';
      return {
        onModals,
        hasBpText: /全局BP|BAN|BP|英雄/.test(text),
        hasStartGame: /开始|进入|下一局|开赛/.test(text),
        buttons: [...document.querySelectorAll('.modal.on button, section.page.on button')].map(b => b.textContent.trim().slice(0, 20)).slice(0, 30),
      };
    });
    steps.push({ step: 'coach-bp-ui', data: bpInfo });
    console.log('COACH_BP_UI', JSON.stringify(bpInfo));

    // coachAutoSquad visibility: force a gap and advance / call coachAutoSquad
    const autoSquad = await page.evaluate(() => {
      const beforePlayers = S.players.length;
      // remove all from one position to force gap
      const pos = 'top';
      const removed = [];
      S.players = S.players.filter(p => {
        if (p.pos === pos && !removed.length) { removed.push(p); return false; }
        return true;
      });
      S.lineup = S.lineup.filter(id => S.players.some(p => p.id === id));
      let r = null;
      try { coachAutoSquad(S); r = 'ok'; } catch (e) { r = 'throw:' + e.message; }
      const afterPlayers = S.players.length;
      const hasTop = S.players.some(p => p.pos === pos);
      const logs = (S.eventLog || []).filter(e => /俱乐部|引援|签下|租借|教练/.test(e.txt || e.text || '')).slice(0, 6)
        .map(e => (e.txt || e.text || String(e)).slice(0, 120));
      return { r, beforePlayers, afterPlayers, hasTop, logs, lineupLen: S.lineup.length };
    });
    const tAS = await drainToasts(page);
    steps.push({ step: 'coach-auto-squad', data: { autoSquad, toasts: tAS } });
    console.log('COACH_AUTO_SQUAD', JSON.stringify(autoSquad));
    if (autoSquad.r && autoSquad.r.startsWith('throw')) {
      record('P0-AUTOSQUAD-THROW', 'FAIL', 'coachAutoSquad 抛异常', autoSquad.r);
    }
    if (!autoSquad.hasTop) {
      record('P1-AUTOSQUAD-GAP', 'FAIL', '俱乐部自动引援未补齐缺位', JSON.stringify(autoSquad));
    }
    if (!autoSquad.logs.length) {
      record('P2-AUTOSQUAD-LOG', 'FAIL', '自动引援无事件日志可见性', JSON.stringify(autoSquad));
    }

    // coach offer accept/reject
    const offerUI = await page.evaluate(() => {
      goPage('club');
      S.coachOffer = { team: (S.teamName === 'AG超玩会' ? '重庆狼队' : 'AG超玩会') };
      renderClub();
      const text = (document.getElementById('page-club') || {}).innerText || '';
      const btns = [...document.querySelectorAll('#page-club button')].filter(b =>
        /respondCoachOffer/.test(b.getAttribute('onclick') || '') || /邀约|接受|婉拒/.test(b.textContent || '')
      ).map(b => ({
        text: b.textContent.trim(),
        onclick: b.getAttribute('onclick'),
      }));
      return {
        hasOfferText: /豪门邀约/.test(text),
        btns,
        offerTeam: S.coachOffer.team,
      };
    });
    await drainToasts(page);
    await shot(page, 'coach-offer-ui');
    steps.push({ step: 'coach-offer-ui', data: offerUI });
    console.log('COACH_OFFER_UI', JSON.stringify(offerUI));
    if (!offerUI.hasOfferText) {
      record('P0-OFFER-UI', 'FAIL', '注入豪门邀约后俱乐部页无展示', JSON.stringify(offerUI));
    }
    if (!offerUI.btns.some(b => /true/.test(b.onclick || '')) || !offerUI.btns.some(b => /false/.test(b.onclick || ''))) {
      record('P0-OFFER-BTN', 'FAIL', '豪门邀约缺少 accept/reject 按钮', JSON.stringify(offerUI));
    }

    // reject offer
    const rejectRes = await page.evaluate(() => {
      const teamBefore = S.teamName;
      const offerTeam = S.coachOffer && S.coachOffer.team;
      const trustBefore = S.board && S.board.trust;
      let r = null;
      try { respondCoachOffer(false); r = 'ok'; } catch (e) { r = 'throw:' + e.message; }
      return {
        r, teamBefore, teamAfter: S.teamName, offerTeam,
        coachOffer: S.coachOffer,
        dealLog: S.coachDeal && S.coachDeal.log && S.coachDeal.log.slice(0, 3),
        trustBefore, trustAfter: S.board && S.board.trust,
      };
    });
    const tRej = await drainToasts(page);
    steps.push({ step: 'coach-offer-reject', data: { rejectRes, toasts: tRej } });
    console.log('COACH_REJECT', JSON.stringify({ rejectRes, toasts: tRej }));
    if (rejectRes.r && rejectRes.r.startsWith('throw')) {
      record('P0-REJECT-THROW', 'FAIL', 'respondCoachOffer(false) 抛异常', rejectRes.r);
    }
    if (rejectRes.coachOffer) {
      record('P1-REJECT-LEFT-OFFER', 'FAIL', '婉拒后 coachOffer 未清空', JSON.stringify(rejectRes));
    }

    // accept offer
    const acceptRes = await page.evaluate(() => {
      S.coachOffer = { team: (S.teamName === 'AG超玩会' ? '重庆狼队' : 'AG超玩会') };
      const teamBefore = S.teamName;
      const offerTeam = S.coachOffer.team;
      const playersBefore = S.players.length;
      const coachIdBefore = S.coach && S.coach.id;
      let r = null;
      try { respondCoachOffer(true); r = 'ok'; } catch (e) { r = 'throw:' + e.message; }
      return {
        r, teamBefore, teamAfter: S.teamName, offerTeam,
        playersBefore, playersAfter: S.players.length,
        coachIdBefore, coachIdAfter: S.coach && S.coach.id,
        coachOffer: S.coachOffer,
        lineupLen: S.lineup && S.lineup.length,
        dealLog: S.coachDeal && S.coachDeal.log && S.coachDeal.log.slice(0, 3),
        scheduleHasNewTeam: (S.schedule || []).some(m => m && (m.a === S.teamName || m.b === S.teamName || m.opp)),
        scheduleSample: (S.schedule || []).slice(0, 3).map(m => ({ opp: m && m.opp, a: m && m.a, b: m && m.b })),
        currentPage: (document.querySelector('nav button.on') || {}).dataset?.page,
      };
    });
    const tAcc = await drainToasts(page);
    await page.waitForTimeout(200);
    await shot(page, 'coach-offer-accept');
    steps.push({ step: 'coach-offer-accept', data: { acceptRes, toasts: tAcc } });
    console.log('COACH_ACCEPT', JSON.stringify({ acceptRes, toasts: tAcc }));
    if (acceptRes.r && acceptRes.r.startsWith('throw')) {
      record('P0-ACCEPT-THROW', 'FAIL', 'respondCoachOffer(true) 抛异常', acceptRes.r);
    }
    if (acceptRes.r === 'ok' && acceptRes.teamAfter === acceptRes.teamBefore) {
      record('P0-ACCEPT-NO-MOVE', 'FAIL', '接受豪门邀约后球队未切换', JSON.stringify(acceptRes));
    }
    if (acceptRes.r === 'ok' && acceptRes.coachIdAfter !== acceptRes.coachIdBefore) {
      record('P1-ACCEPT-COACH-OVERWRITE', 'FAIL', '接受邀约后玩家教练身份被覆盖', JSON.stringify(acceptRes));
    }

    // player club/league/kjia/union/hall already done; coach startMatch BP deeper if series exists
    const postAcceptMatch = await page.evaluate(() => {
      goPage('club');
      let startTry = null;
      try { startMatch(); startTry = 'ok'; } catch (e) { startTry = 'throw:' + e.message; }
      return {
        startTry,
        hasSeries: !!S.series,
        seriesOp: S.series && S.series.opName,
        onModals: [...document.querySelectorAll('.modal.on')].map(m => m.id),
        bodySnippet: (document.body.innerText || '').slice(0, 400),
      };
    });
    const tPAM = await drainToasts(page);
    await page.waitForTimeout(300);
    steps.push({ step: 'coach-match-after-accept', data: { postAcceptMatch, toasts: tPAM } });
    console.log('COACH_MATCH_AFTER_ACCEPT', JSON.stringify({ postAcceptMatch, toasts: tPAM }));
    await shot(page, 'coach-match-after-accept');

    // Harness-ish engine checks in browser
    const engineChecks = await page.evaluate(() => {
      const out = {};
      out.modePages = {
        player: MODE_PAGES.player,
        coach: MODE_PAGES.coach,
        manager: MODE_PAGES.manager,
      };
      out.fn = {
        createPlayerCareer: typeof createPlayerCareer,
        applyCoachClub: typeof applyCoachClub,
        startPlayerMatch: typeof startPlayerMatch,
        startMatch: typeof startMatch,
        playerTrain: typeof playerTrain,
        playerRequestTransfer: typeof playerRequestTransfer,
        playerRequestLoanOut: typeof playerRequestLoanOut,
        playerRequestKjia: typeof playerRequestKjia,
        respondCoachOffer: typeof respondCoachOffer,
        coachAutoSquad: typeof coachAutoSquad,
        coachAdvice: typeof coachAdvice,
        coachRequest: typeof coachRequest,
        playerToCoach: typeof playerToCoach,
        playerRetired: typeof playerRetired,
        applyModeNav: typeof applyModeNav,
        goPage: typeof goPage,
      };
      out.TOUR_TITLES_market = (typeof TOUR_TITLES !== 'undefined' && TOUR_TITLES.market) || null;
      return out;
    });
    steps.push({ step: 'engine-checks', data: engineChecks });
    console.log('ENGINE_CHECKS', JSON.stringify(engineChecks));

    // Missing function probes
    Object.keys(engineChecks.fn || {}).forEach(k => {
      if (engineChecks.fn[k] !== 'function') {
        record('P0-FN-' + k, 'FAIL', `关键函数 ${k} 不存在`, engineChecks.fn[k]);
      }
    });

    // toast capture residual
    await drainToasts(page);

    // Summary dump
    const summary = {
      findingsCount: findings.length,
      failCount: findings.filter(f => f.severity === 'FAIL').length,
      pageErrors,
      consoleErrors: consoleErrors.slice(0, 20),
      stepsCount: steps.length,
    };
    console.log('SUMMARY', JSON.stringify(summary));
    console.log('FINDINGS', JSON.stringify(findings, null, 2));

    // write json artifacts
    const fs = require('fs');
    fs.writeFileSync(
      'E:\\sex\\kpl-manager\\.bug-hunt\\player-coach-probe.json',
      JSON.stringify({ summary, findings, steps, pageErrors, consoleErrors, toasts }, null, 2),
      'utf8'
    );
    console.log('WROTE probe json');
  } catch (e) {
    console.error('FATAL', e && e.stack || e);
    findings.push({ id: 'FATAL', severity: 'FAIL', title: '探针脚本致命错误', detail: String(e && e.message || e) });
  } finally {
    await browser.close();
  }
})();
