// Coach-focused probe (continuation after player path)
const { launch, shot } = require('../tests/playthrough/pw.js');
const fs = require('fs');

const findings = [];
const steps = [];
const pageErrors = [];

function record(id, severity, title, detail, evidence) {
  findings.push({ id, severity, title, detail, evidence: evidence || null });
  console.log(`[${severity}] ${id} ${title}`);
  if (detail) console.log('   ', String(detail).slice(0, 400));
}

(async () => {
  const { browser, page } = await launch();
  page.on('pageerror', e => {
    pageErrors.push(String(e.message));
    console.log('[pageerror]', e.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[console.error]', msg.text().slice(0, 200));
  });
  page.on('dialog', async d => {
    console.log('[dialog]', d.type(), String(d.message()).slice(0, 160));
    try { await d.accept(); } catch (e) {}
  });

  async function drainToasts(page) {
    return page.evaluate(() => {
      const arr = (window.__toasts || []).slice();
      window.__toasts = [];
      return arr;
    });
  }
  async function hookToasts(page) {
    await page.evaluate(() => {
      if (window.__toastHooked) return;
      window.__toastHooked = true;
      const orig = window.toast;
      if (typeof orig === 'function') {
        window.toast = function (msg) {
          try { window.__toasts = window.__toasts || []; window.__toasts.push(String(msg)); } catch (e) {}
          return orig.apply(this, arguments);
        };
      }
    });
  }

  try {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await hookToasts(page);
    await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });

    // ---- player POS key validation / youth start ----
    const youthFix = await page.evaluate(() => {
      switchStartTab('player');
      pickPlayerArch(0);
      pickPlayerPos('jg');
      const n = document.getElementById('pc-name');
      if (n) n.value = '青训小将';
      if (!_pcTeam && window._pcTeams && window._pcTeams[0]) pickPlayerTeam(window._pcTeams[0].name);
      // invalid pos does not throw currently
      let invalidTry = null;
      const savePos = _pcPos;
      try {
        _pcPos = 'jungle';
        // recreate would throw; just call pick then create with valid
        invalidTry = 'set';
      } catch (e) { invalidTry = 'throw:' + e.message; }
      _pcPos = 'jg';
      let createTry = null;
      try { createPlayerCareer(); createTry = 'ok'; } catch (e) { createTry = 'throw:' + e.message; }
      const me = myPlayer(S);
      return {
        invalidTry, createTry,
        mode: S && S.mode,
        meName: me && me.name,
        meAge: me && me.age,
        mePos: me && me.pos,
        starter: me && S.lineup.includes(me.id),
        underAgeText: /未满|跟训|满 .{0,3} 岁/.test((document.querySelector('#page-career') || {}).innerText || '') ||
          (S.eventLog || []).some(e => /未满|跟训|满 18/.test(e.txt || e.text || '')),
        eventLog: (S.eventLog || []).slice(0, 4).map(e => (e.txt || e.text || String(e)).slice(0, 140)),
        matchTry: (() => { try { startPlayerMatch(); return 'ok'; } catch (e) { return 'throw:' + e.message; } })(),
        matchIdx: S.matchIdx,
        lineupHasMe: me ? S.lineup.includes(me.id) : null,
      };
    });
    const tYouth = await drainToasts(page);
    steps.push({ step: 'youth-start', data: { youthFix, toasts: tYouth } });
    console.log('YOUTH', JSON.stringify({ youthFix, toasts: tYouth }));
    await shot(page, 'pc-youth-career');
    if ((youthFix.meAge || 0) < 18 && youthFix.starter) {
      record('P1-UNDERAGE-START', 'FAIL', '未成年选手被排进首发', JSON.stringify(youthFix));
    }
    if ((youthFix.meAge || 0) < 18 && !youthFix.underAgeText) {
      record('P1-UNDERAGE-TEXT', 'FAIL', '未成年选手无满龄出场说明', JSON.stringify(youthFix));
    }

    // train gain note quality
    const trainNote = await page.evaluate(() => {
      const me = myPlayer(S);
      if (!me) return { error: 'no me' };
      me.injury = 0; me.energy = 100; S.trained = false;
      me.val = 100; me.morale = 50; me.age = 17;
      delete me.peak; if (typeof ensurePlayerPeak === 'function') ensurePlayerPeak(me);
      const before = me.attrs.lane;
      const outcome = trainOutcome(playerRole(S), me, 'lane');
      playerTrain('lane');
      return {
        before, after: me.attrs.lane,
        outcome,
        toasts: (window.__toasts || []).slice(),
        trained: S.trained,
      };
    });
    await drainToasts(page);
    steps.push({ step: 'train-note', data: trainNote });
    console.log('TRAIN_NOTE', JSON.stringify(trainNote));
    if (trainNote.outcome && trainNote.outcome.gain <= 0) {
      const note = String(trainNote.outcome.note || '');
      if (!note || note.length < 6 || !/练|状态|平稳|低迷|天花板|提升|属性/.test(note)) {
        record('P2-TRAIN-NOTE', 'FAIL', '加练无收益时 toast 文案残缺/无说明', JSON.stringify(trainNote));
      }
    }

    // player pages empty check with correct POS (already did); do coach now
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await hookToasts(page);
    await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });

    const coachTab = await page.evaluate(() => {
      switchStartTab('coach');
      const grid = document.getElementById('coach-clubs');
      const cards = grid ? [...grid.children].map((c, i) => ({
        i, onclick: c.getAttribute('onclick'),
        text: (c.innerText || '').replace(/\s+/g, ' ').slice(0, 70),
      })) : [];
      return {
        bodyVisible: !!document.getElementById('tab-coach-body') && document.getElementById('tab-coach-body').style.display !== 'none',
        cardCount: cards.length,
        firstOnclick: cards[0] && cards[0].onclick,
        usesPickCoachClub: !!(cards[0] && /pickCoachClub/.test(cards[0].onclick || '')),
        wrongPickClub: cards.some(c => /^pickClub\(/.test(c.onclick || '')),
        applyBtn: (document.getElementById('coach-apply-btn') || {}).disabled,
        sampleCards: cards.slice(0, 3),
      };
    });
    steps.push({ step: 'coach-tab', data: coachTab });
    console.log('COACH_TAB', JSON.stringify(coachTab));
    await shot(page, 'coach-tab');
    if (!coachTab.bodyVisible) record('P0-CTAB', 'FAIL', '教练标签页未显示', JSON.stringify(coachTab));
    if (!coachTab.usesPickCoachClub) record('P0-CPICK-BIND', 'FAIL', '教练卡片未绑定 pickCoachClub', JSON.stringify(coachTab));

    const pickNone = await page.evaluate(() => {
      _coachPick = -1;
      const arr = [];
      const orig = toast;
      toast = function (m) { arr.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      try { applyCoachClub(); } finally { toast = orig; }
      return { toasts: arr, mode: S && S.mode };
    });
    steps.push({ step: 'coach-no-pick', data: pickNone });
    console.log('COACH_NO_PICK', JSON.stringify(pickNone));

    const applyCoach = await page.evaluate(() => {
      pickCoachClub(1);
      applyCoachClub();
      try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
      return {
        mode: S && S.mode,
        teamName: S && S.teamName,
        coach: S && S.coach && S.coach.name,
        coachDeal: S && S.coachDeal,
        lineupLen: S.lineup && S.lineup.length,
        lineupDetail: (S.lineup || []).map(id => {
          const p = S.players.find(x => x.id === id);
          return p ? p.pos + ':' + p.name + ':' + overall(p) : '?';
        }),
        playersCount: S.players.length,
        transferWindow: S.transferWindow,
        preseason: S.preseason,
        modalOff: !document.getElementById('start-modal').classList.contains('on'),
        navVisible: [...document.querySelectorAll('#nav button')].filter(b => b.style.display !== 'none').map(b => b.dataset.page),
        currentPage: (document.querySelector('nav button.on') || {}).dataset?.page,
        eventLog: (S.eventLog || []).slice(0, 5).map(e => (e.txt || e.text || String(e)).slice(0, 140)),
      };
    });
    const tApply = await drainToasts(page);
    await page.waitForTimeout(400);
    steps.push({ step: 'apply-coach', data: { applyCoach, toasts: tApply } });
    console.log('APPLY_COACH', JSON.stringify({ applyCoach, toasts: tApply }));
    await shot(page, 'coach-after-apply-club');
    if (applyCoach.mode !== 'coach') record('P0-COACH-MODE', 'FAIL', 'mode 不是 coach', JSON.stringify(applyCoach));
    if (!applyCoach.modalOff) record('P0-COACH-MODAL', 'FAIL', '开局后 modal 未关', null);

    const expectedCoachPages = ['club', 'lineup', 'market', 'train', 'league', 'kjia', 'union', 'hall'];
    const coachAudit = {};
    for (const p of expectedCoachPages) {
      await page.evaluate((name) => { goPage(name); }, p);
      await page.waitForTimeout(250);
      const info = await page.evaluate(() => {
        const cur = (document.querySelector('nav button.on') || {}).dataset?.page;
        const sec = document.getElementById('page-' + cur);
        return {
          currentPage: cur,
          textLen: sec ? (sec.innerText || '').length : -1,
          htmlLen: sec ? (sec.innerHTML || '').length : -1,
          buttonCount: sec ? sec.querySelectorAll('button').length : 0,
          mode: S.mode,
        };
      });
      const t = await drainToasts(page);
      coachAudit[p] = { ...info, toasts: t };
      await shot(page, 'coach-page-' + p);
      if (info.textLen < 40) record('P1-COACH-EMPTY-' + p, 'FAIL', `教练「${p}」页疑似空页`, JSON.stringify(coachAudit[p]));
      if (info.currentPage !== p) record('P1-COACH-NAV-' + p, 'FAIL', `教练 goPage('${p}') 落到 ${info.currentPage}`, JSON.stringify(coachAudit[p]));
    }
    steps.push({ step: 'coach-page-audit', data: coachAudit });
    console.log('COACH_AUDIT', JSON.stringify(coachAudit));

    // market content
    await page.evaluate(() => goPage('market'));
    await page.waitForTimeout(250);
    const coachMarket = await page.evaluate(() => {
      const text = (document.getElementById('page-market') || {}).innerText || '';
      return {
        textLen: text.length,
        hasWorkbench: /教练工作台|应急与引援|应急/.test(text),
        hasLoan: /租借/.test(text),
        hasSignApply: /申请直签|引援建议|引援/.test(text),
        hasBuyoutBiz: /买断其他|挂牌出售选手|出售（谈判）/.test(text),
        buttons: [...document.querySelectorAll('#page-market button')].map(b => ({
          text: b.textContent.trim().slice(0, 28),
          onclick: b.getAttribute('onclick'),
          disabled: !!b.disabled,
        })).slice(0, 30),
        textHead: text.slice(0, 400),
      };
    });
    await drainToasts(page);
    steps.push({ step: 'coach-market', data: coachMarket });
    console.log('COACH_MARKET', JSON.stringify(coachMarket));
    await shot(page, 'coach-market');
    if (!coachMarket.hasWorkbench) record('P1-CMARKET-WB', 'FAIL', '教练市场页无工作台', JSON.stringify(coachMarket));
    if (!coachMarket.hasLoan) record('P1-CMARKET-LOAN', 'FAIL', '教练市场页无租借', null);

    // coach biz gate
    const coachBiz = await page.evaluate(() => {
      const arr = [];
      const orig = toast;
      toast = function (m) { arr.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      try { goPage('biz'); } finally { toast = orig; }
      return {
        toasts: arr,
        currentPage: (document.querySelector('nav button.on') || {}).dataset?.page,
        marketAllowed: MODE_PAGES.coach.includes('market'),
        playerHasMarket: MODE_PAGES.player.includes('market'),
        modePagesCoach: MODE_PAGES.coach,
      };
    });
    await drainToasts(page);
    steps.push({ step: 'coach-biz-gate', data: coachBiz });
    console.log('COACH_BIZ', JSON.stringify(coachBiz));
    if (coachBiz.currentPage === 'biz') record('P0-COACH-BIZ-LEAK', 'FAIL', '教练可进 biz', JSON.stringify(coachBiz));
    if (!coachBiz.toasts.length) record('P2-COACH-BIZ-TOAST', 'FAIL', '教练 goPage(biz) 无 toast', JSON.stringify(coachBiz));

    // lineup / train / club
    const panels = await page.evaluate(() => {
      goPage('lineup');
      const lineText = (document.getElementById('page-lineup') || {}).innerText || '';
      const lineBtns = [...document.querySelectorAll('#page-lineup button')].map(b => ({
        text: b.textContent.trim().slice(0, 24),
        onclick: b.getAttribute('onclick'),
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
      const clubBtns = [...document.querySelectorAll('#page-club button')].map(b => ({
        text: b.textContent.trim().slice(0, 30),
        onclick: b.getAttribute('onclick'),
        disabled: !!b.disabled,
      }));
      return {
        lineHasLineup: /首发阵容|替补席/.test(lineText),
        lineHasTactic: /战术板/.test(lineText),
        lineHasSell: lineBtns.some(b => /openSellNego/.test(b.onclick || '') || /出售/.test(b.text)),
        lineBtns: lineBtns.slice(0, 20),
        trainHasPanel: /选手训练|没有选手/.test(trainText),
        trainTrainBtns: trainBtns.filter(b => /doTrain|doHeroTrain/.test(b.onclick || '')).length,
        trainRest: trainBtns.some(b => /doRest/.test(b.onclick || '')),
        clubHasDeal: /执教履历|现合同|主教练/.test(clubText),
        clubHasBoard: /董事会/.test(clubText),
        clubHasMatch: /赛前准备|下一场比赛|BP|出战|开赛/.test(clubText),
        clubTextHead: clubText.slice(0, 350),
        clubBtns: clubBtns.slice(0, 25),
      };
    });
    await drainToasts(page);
    steps.push({ step: 'coach-panels', data: panels });
    console.log('COACH_PANELS', JSON.stringify(panels));
    await page.evaluate(() => goPage('lineup')); await page.waitForTimeout(200); await shot(page, 'coach-lineup');
    await page.evaluate(() => goPage('train')); await page.waitForTimeout(200); await shot(page, 'coach-train');
    await page.evaluate(() => goPage('club')); await page.waitForTimeout(200); await shot(page, 'coach-club');

    if (!panels.lineHasLineup) record('P1-COACH-LINEUP', 'FAIL', '阵容页无首发/替补', JSON.stringify(panels));
    if (panels.trainTrainBtns < 1) record('P1-COACH-TRAIN', 'FAIL', '训练页无训练按钮', JSON.stringify(panels));
    if (panels.lineHasSell) record('P2-COACH-SELL-UI', 'FAIL', '教练阵容页仍可出售选手', JSON.stringify(panels.lineBtns));
    if (!panels.clubHasDeal) record('P1-COACH-DEAL-UI', 'FAIL', '俱乐部页无执教合同面板', JSON.stringify(panels));

    // coachAutoSquad
    const autoSquad = await page.evaluate(() => {
      const before = S.players.length;
      const removed = [];
      S.players = S.players.filter(p => {
        if (p.pos === 'top' && !removed.length) { removed.push(p.name); return false; }
        return true;
      });
      S.lineup = S.lineup.filter(id => S.players.some(p => p.id === id));
      S.freeAgents = S.freeAgents || [];
      let r = null;
      try { coachAutoSquad(S); r = 'ok'; } catch (e) { r = 'throw:' + e.message; }
      return {
        r, removed, before, after: S.players.length,
        hasTop: S.players.some(p => p.pos === 'top'),
        logs: (S.eventLog || []).filter(e => /俱乐部|引援|签下|租借|教练/.test(e.txt || e.text || '')).slice(0, 8)
          .map(e => (e.txt || e.text || String(e)).slice(0, 140)),
      };
    });
    const tAS = await drainToasts(page);
    steps.push({ step: 'coach-auto-squad', data: { autoSquad, toasts: tAS } });
    console.log('AUTO_SQUAD', JSON.stringify({ autoSquad, toasts: tAS }));
    if (autoSquad.r && autoSquad.r.startsWith('throw')) record('P0-AUTOSQUAD-THROW', 'FAIL', 'coachAutoSquad 抛异常', autoSquad.r);
    if (!autoSquad.hasTop) record('P1-AUTOSQUAD-GAP', 'FAIL', '自动引援未补 top 缺位', JSON.stringify(autoSquad));
    if (!autoSquad.logs.length) record('P2-AUTOSQUAD-LOG', 'FAIL', '自动引援无日志', JSON.stringify(autoSquad));

    // coach offer UI
    const offerUI = await page.evaluate(() => {
      goPage('club');
      S.coachOffer = { team: (S.teamName === 'AG超玩会' || S.teamName === '成都AG超玩会') ? '重庆狼队' : 'AG超玩会' };
      renderClub();
      const text = (document.getElementById('page-club') || {}).innerText || '';
      const btns = [...document.querySelectorAll('#page-club button')].filter(b =>
        /respondCoachOffer/.test(b.getAttribute('onclick') || '')
      ).map(b => ({ text: b.textContent.trim(), onclick: b.getAttribute('onclick') }));
      return { hasOfferText: /豪门邀约/.test(text), btns, offerTeam: S.coachOffer.team, snippet: (text.match(/豪门邀约.{0,80}/) || [])[0] };
    });
    await drainToasts(page);
    await shot(page, 'coach-offer-ui');
    steps.push({ step: 'coach-offer-ui', data: offerUI });
    console.log('OFFER_UI', JSON.stringify(offerUI));
    if (!offerUI.hasOfferText) record('P0-OFFER-UI', 'FAIL', '豪门邀约未展示', JSON.stringify(offerUI));
    if (!offerUI.btns.some(b => /true/.test(b.onclick || '')) || !offerUI.btns.some(b => /false/.test(b.onclick || ''))) {
      record('P0-OFFER-BTN', 'FAIL', '豪门邀约 accept/reject 按钮缺失', JSON.stringify(offerUI));
    }

    const rejectRes = await page.evaluate(() => {
      const teamBefore = S.teamName;
      const offerTeam = S.coachOffer && S.coachOffer.team;
      const coachId = S.coach && S.coach.id;
      let r = null;
      try { respondCoachOffer(false); r = 'ok'; } catch (e) { r = 'throw:' + e.message; }
      return {
        r, teamBefore, teamAfter: S.teamName, offerTeam,
        coachOffer: S.coachOffer,
        coachIdBefore: coachId, coachIdAfter: S.coach && S.coach.id,
        dealLog: S.coachDeal && S.coachDeal.log && S.coachDeal.log.slice(0, 3),
      };
    });
    const tRej = await drainToasts(page);
    steps.push({ step: 'offer-reject', data: { rejectRes, toasts: tRej } });
    console.log('REJECT', JSON.stringify({ rejectRes, toasts: tRej }));
    if (rejectRes.r && rejectRes.r.startsWith('throw')) record('P0-REJECT-THROW', 'FAIL', '婉拒抛异常', rejectRes.r);
    if (rejectRes.coachOffer) record('P1-REJECT-LEFT-OFFER', 'FAIL', '婉拒后 offer 未清空', JSON.stringify(rejectRes));

    const acceptRes = await page.evaluate(() => {
      S.coachOffer = { team: (S.teamName === 'AG超玩会' || S.teamName === '成都AG超玩会') ? '重庆狼队' : 'AG超玩会' };
      const teamBefore = S.teamName;
      const offerTeam = S.coachOffer.team;
      const coachId = S.coach && S.coach.id;
      const playersBefore = S.players.length;
      let r = null;
      try { respondCoachOffer(true); r = 'ok'; } catch (e) { r = 'throw:' + e.message; }
      return {
        r, teamBefore, teamAfter: S.teamName, offerTeam,
        playersBefore, playersAfter: S.players.length,
        coachIdBefore: coachId, coachIdAfter: S.coach && S.coach.id,
        coachOffer: S.coachOffer,
        lineupLen: S.lineup && S.lineup.length,
        dealLog: S.coachDeal && S.coachDeal.log && S.coachDeal.log.slice(0, 3),
        phase: S.phase,
        scheduleSample: (S.schedule || []).slice(0, 4).map(m => ({ opp: m && m.opp, a: m && m.a, b: m && m.b })),
        currentPage: (document.querySelector('nav button.on') || {}).dataset?.page,
      };
    });
    const tAcc = await drainToasts(page);
    await page.waitForTimeout(250);
    await shot(page, 'coach-offer-accept');
    steps.push({ step: 'offer-accept', data: { acceptRes, toasts: tAcc } });
    console.log('ACCEPT', JSON.stringify({ acceptRes, toasts: tAcc }));
    if (acceptRes.r && acceptRes.r.startsWith('throw')) record('P0-ACCEPT-THROW', 'FAIL', '接受邀约抛异常', acceptRes.r);
    if (acceptRes.r === 'ok' && acceptRes.teamAfter === acceptRes.teamBefore) {
      record('P0-ACCEPT-NO-MOVE', 'FAIL', '接受后未换队', JSON.stringify(acceptRes));
    }
    if (acceptRes.r === 'ok' && acceptRes.coachIdAfter !== acceptRes.coachIdBefore) {
      record('P1-ACCEPT-COACH-OVERWRITE', 'FAIL', '接受后玩家教练被覆盖', JSON.stringify(acceptRes));
    }

    // startMatch / BP
    const coachMatch = await page.evaluate(() => {
      goPage('club');
      const before = {
        matchIdx: S.matchIdx,
        phase: S.phase,
        scheduleLen: (S.schedule || []).length,
        hasSeries: !!S.series,
        lineupLen: (S.lineup || []).length,
        teamName: S.teamName,
      };
      let startTry = null;
      try { startMatch(); startTry = 'ok'; } catch (e) { startTry = 'throw:' + e.message; }
      return {
        before, startTry,
        hasSeries: !!S.series,
        seriesOp: S.series && S.series.opName,
        seriesStage: S.series && S.series.stage,
        onModals: [...document.querySelectorAll('.modal.on')].map(m => m.id),
        bodyHasPrep: /赛前准备|全局BP|BAN|第1局|BP/.test(document.body.innerText || ''),
        bodySnippet: (document.body.innerText || '').slice(0, 450),
        scheduleHead: (S.schedule || []).slice(0, 3).map(m => ({ opp: m && m.opp, mid: m && m.mid })),
      };
    });
    const tCM = await drainToasts(page);
    await page.waitForTimeout(350);
    steps.push({ step: 'coach-startMatch', data: { coachMatch, toasts: tCM } });
    console.log('COACH_MATCH', JSON.stringify({ coachMatch, toasts: tCM }));
    await shot(page, 'coach-startMatch');

    if (coachMatch.startTry && coachMatch.startTry.startsWith('throw')) {
      record('P0-COACH-MATCH-THROW', 'FAIL', 'startMatch 抛异常', coachMatch.startTry);
    }
    if (coachMatch.startTry === 'ok' && !coachMatch.hasSeries && coachMatch.before.scheduleLen > 0) {
      if (!tCM.some(x => /赛程|转会期|已结束/.test(x))) {
        record('P1-COACH-MATCH-NOOP', 'FAIL', 'startMatch 无系列赛/弹窗/说明', JSON.stringify({ coachMatch, toasts: tCM }));
      }
    }

    // BP UI deeper: if pre-match modal exists, inspect buttons
    const bpUI = await page.evaluate(() => {
      const onModals = [...document.querySelectorAll('.modal.on')].map(m => m.id);
      const text = document.body.innerText || '';
      const allBtns = [...document.querySelectorAll('.modal.on button')].map(b => b.textContent.trim()).slice(0, 40);
      // try to see if renderPreMatch / BP functions exist and open
      const hasPrepFns = {
        showPreMatch: typeof showPreMatch,
        renderPreMatch: typeof renderPreMatch,
        // common bp
        startBP: typeof startBP,
        openBP: typeof openBP,
        beginBP: typeof beginBP,
        bpPick: typeof bpPick,
        doBPPick: typeof doBPPick,
        confirmBP: typeof confirmBP,
        startGame1: typeof startGame1,
        playGame: typeof playGame,
        seriesNextGame: typeof seriesNextGame,
      };
      let bpFns = [];
      try {
        bpFns = Object.keys(window).filter(k => /bp|BP|prep|series|game/i.test(k) && typeof window[k] === 'function').slice(0, 40);
      } catch (e) {}
      return {
        onModals,
        hasPrepText: /赛前准备|BP|全局BP|BAN|第.局/.test(text),
        modalBtns: allBtns,
        hasPrepFns,
        bpFns,
        series: S.series ? { op: S.series.opName, mw: S.series.mw, ow: S.series.ow, max: S.series.max, stage: S.series.stage } : null,
      };
    });
    steps.push({ step: 'coach-bp-ui', data: bpUI });
    console.log('BP_UI', JSON.stringify(bpUI));
    await shot(page, 'coach-bp-ui');

    // If series exists, try to advance one BP game via engine functions
    const bpAdvance = await page.evaluate(() => {
      if (!S.series) return { skipped: true, reason: 'no series' };
      // find a game-play function
      const candidates = ['playGame', 'startGame', 'simGame', 'nextGame', 'seriesPlayGame', 'finishGame', 'doGame'];
      const found = candidates.filter(c => typeof window[c] === 'function');
      return {
        found,
        series: { op: S.series.opName, logs: (S.series.logs || []).slice(0, 3) },
        // dump globals related
        related: Object.keys(window).filter(k => /Game|game|BP|bp|Series|series/i.test(k) && typeof window[k] === 'function').slice(0, 50),
      };
    });
    steps.push({ step: 'bp-advance-probe', data: bpAdvance });
    console.log('BP_ADVANCE', JSON.stringify(bpAdvance));

    // coach goPage('market') when explicitly allowed - toast should NOT fire for allowed pages
    const marketOk = await page.evaluate(() => {
      goPage('market');
      return {
        currentPage: (document.querySelector('nav button.on') || {}).dataset?.page,
        toasts: (window.__toasts || []).slice(),
        mode: S.mode,
        allowed: MODE_PAGES.coach.includes('market'),
      };
    });
    await drainToasts(page);
    steps.push({ step: 'coach-market-goto', data: marketOk });
    console.log('MARKET_OK', JSON.stringify(marketOk));
    if (!marketOk.allowed && marketOk.currentPage === 'market') {
      record('P0-MARKET-BYPASS', 'FAIL', 'market 不在教练页签却进入了 market', JSON.stringify(marketOk));
    }

    // coachRequest path
    const coachReq = await page.evaluate(() => {
      goPage('market');
      const adv = coachAdvice(S);
      let r = null;
      if (adv.signs && adv.signs[0]) {
        try { coachRequest(S, 'sign', adv.signs[0].id); r = 'sign:' + adv.signs[0].name; }
        catch (e) { r = 'throw:' + e.message; }
      } else if (adv.loans && adv.loans[0]) {
        try { coachRequest(S, 'loan', adv.loans[0].id); r = 'loan:' + adv.loans[0].name; }
        catch (e) { r = 'throw:' + e.message; }
      } else {
        r = 'no-candidates';
      }
      return {
        r,
        advice: {
          gaps: adv.gaps,
          weak: adv.weak && adv.weak.slice(0, 3),
          loanCnt: (adv.loans || []).length,
          signCnt: (adv.signs || []).length,
        },
        coachRecs: (S.coachRecs || []).slice(0, 3),
        playersCount: S.players.length,
        marketTextHasApply: /申请直签|申请租借|引援/.test((document.getElementById('page-market') || {}).innerText || ''),
      };
    });
    const tCR = await drainToasts(page);
    steps.push({ step: 'coach-request', data: { coachReq, toasts: tCR } });
    console.log('COACH_REQUEST', JSON.stringify({ coachReq, toasts: tCR }));
    if (coachReq.r && String(coachReq.r).startsWith('throw')) {
      record('P0-REQUEST-THROW', 'FAIL', 'coachRequest 抛异常', coachReq.r);
    }
    if (coachReq.r === 'no-candidates') {
      record('P2-REQUEST-NONE', 'FAIL', '教练引援建议无候选（loans/signs 皆空）', JSON.stringify(coachReq));
    }

    // engine function presence
    const engineChecks = await page.evaluate(() => {
      const names = [
        'createPlayerCareer', 'applyCoachClub', 'startPlayerMatch', 'startMatch',
        'playerTrain', 'playerRequestTransfer', 'playerRequestLoanOut', 'playerRequestKjia',
        'respondCoachOffer', 'coachAutoSquad', 'coachAdvice', 'coachRequest', 'playerToCoach',
        'playerRetired', 'applyModeNav', 'goPage', 'renderCoachMarket', 'coachPoach',
        'myPlayer', 'nextAction', 'uiDoNextAction', 'clubCoachDealPanel', 'renderCareer',
      ];
      const fn = {};
      names.forEach(n => { fn[n] = typeof window[n]; });
      return { fn, modePages: MODE_PAGES, tourTitles: typeof TOUR_TITLES !== 'undefined' ? TOUR_TITLES : null };
    });
    steps.push({ step: 'engine-checks', data: engineChecks });
    console.log('ENGINE', JSON.stringify(engineChecks));
    Object.keys(engineChecks.fn || {}).forEach(k => {
      if (engineChecks.fn[k] !== 'function') record('P0-FN-' + k, 'FAIL', `关键函数 ${k} 不存在`, engineChecks.fn[k]);
    });

    // player mode goPage('market') toast already verified; double-check MODE_PAGES comment vs reality
    if (engineChecks.modePages.coach.includes('market')) {
      // expected by design; task text said "无 market 时" — document as informational
      console.log('NOTE: coach MODE_PAGES includes market; goPage(market) is allowed by design');
    }

    const summary = {
      findingsCount: findings.length,
      failCount: findings.filter(f => f.severity === 'FAIL').length,
      pageErrors,
      stepsCount: steps.length,
    };
    console.log('SUMMARY', JSON.stringify(summary));
    console.log('FINDINGS', JSON.stringify(findings, null, 2));
    fs.writeFileSync(
      'E:\\sex\\kpl-manager\\.bug-hunt\\player-coach-probe-coach.json',
      JSON.stringify({ summary, findings, steps, pageErrors }, null, 2),
      'utf8'
    );
    console.log('WROTE coach probe json');
  } catch (e) {
    console.error('FATAL', e && e.stack || e);
    findings.push({ id: 'FATAL', severity: 'FAIL', title: '探针致命错误', detail: String(e && e.message || e) });
  } finally {
    await browser.close();
  }
})();
