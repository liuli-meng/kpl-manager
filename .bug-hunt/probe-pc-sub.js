// Player + Coach live browser bug-hunt (pc-subagent)
// Real Chrome via tests/playthrough/pw.js. No src changes.
const { launch, shot } = require('../tests/playthrough/pw.js');
const fs = require('fs');

const findings = [];
const steps = [];
const pageErrors = [];
const consoleErrors = [];
const toasts = [];
const deadClicks = [];

function record(id, severity, title, detail, evidence) {
  findings.push({ id, severity, title, detail: detail == null ? null : String(detail).slice(0, 2000), evidence: evidence || null });
  console.log(`[${severity}] ${id} ${title}`);
  if (detail) console.log('   ', String(detail).slice(0, 500));
}

async function hook(page) {
  await page.evaluate(() => {
    window.__toasts = [];
    if (!window.__toastHooked) {
      window.__toastHooked = true;
      const orig = window.toast;
      if (typeof orig === 'function') {
        window.toast = function (msg) {
          try { window.__toasts.push(String(msg)); } catch (e) {}
          return orig.apply(this, arguments);
        };
      }
    }
    if (!window.__clickLog) {
      window.__clickLog = [];
      document.addEventListener('click', (e) => {
        const b = e.target && e.target.closest ? e.target.closest('button,[onclick]') : null;
        if (!b) return;
        window.__clickLog.push({
          t: Date.now(),
          text: (b.textContent || '').trim().slice(0, 40),
          onclick: b.getAttribute && b.getAttribute('onclick'),
          disabled: !!b.disabled,
        });
      }, true);
    }
  });
}

async function drainToasts(page) {
  const t = await page.evaluate(() => {
    const a = (window.__toasts || []).slice();
    window.__toasts = [];
    return a;
  });
  t.forEach((x) => toasts.push(x));
  return t;
}

async function pageInfo(page) {
  return page.evaluate(() => {
    const curNav = document.querySelector('nav button.on');
    const cur = curNav ? curNav.dataset.page : null;
    const sec = document.getElementById(cur ? 'page-' + cur : '');
    const buttons = sec
      ? [...sec.querySelectorAll('button')].map((b) => ({
          text: (b.textContent || '').trim().slice(0, 48),
          onclick: b.getAttribute('onclick'),
          disabled: !!b.disabled,
          visible: b.offsetParent !== null || getComputedStyle(b).display !== 'none',
        }))
      : [];
    return {
      currentPage: cur,
      textLen: sec ? (sec.innerText || '').length : -1,
      buttonCount: buttons.length,
      buttons: buttons.slice(0, 40),
      mode: (typeof S !== 'undefined' && S) ? S.mode : null,
      teamName: (typeof S !== 'undefined' && S) ? S.teamName : null,
      navVisible: [...document.querySelectorAll('#nav button')]
        .filter((b) => b.style.display !== 'none')
        .map((b) => b.dataset.page),
      fabExists: !!document.getElementById('page-fab'),
      dockExists: !!document.getElementById('page-dock'),
    };
  });
}

async function reset(page) {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await hook(page);
  await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });
}

// click a button by selector inside a page; record if nothing changed / no toast
async function clickAndObserve(page, sel, label) {
  const before = await page.evaluate(() => ({
    page: (document.querySelector('nav button.on') || {}).dataset?.page,
    toasts: (window.__toasts || []).length,
    textLen: (() => {
      const cur = (document.querySelector('nav button.on') || {}).dataset?.page;
      const sec = document.getElementById('page-' + cur);
      return sec ? (sec.innerText || '').length : -1;
    })(),
  }));
  let clicked = false;
  try {
    const btn = page.locator(sel).first();
    const n = await btn.count();
    if (!n) {
      deadClicks.push({ label, sel, reason: 'not-found' });
      return { ok: false, reason: 'not-found' };
    }
    if (await btn.isDisabled()) {
      deadClicks.push({ label, sel, reason: 'disabled' });
      return { ok: false, reason: 'disabled' };
    }
    await btn.click({ timeout: 3000, force: true });
    clicked = true;
  } catch (e) {
    deadClicks.push({ label, sel, reason: 'click-err:' + e.message });
    return { ok: false, reason: 'click-err:' + e.message };
  }
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => ({
    page: (document.querySelector('nav button.on') || {}).dataset?.page,
    toasts: (window.__toasts || []).slice(),
    textLen: (() => {
      const cur = (document.querySelector('nav button.on') || {}).dataset?.page;
      const sec = document.getElementById('page-' + cur);
      return sec ? (sec.innerText || '').length : -1;
    })(),
  }));
  const newToasts = after.toasts.slice(before.toasts);
  const changed = after.page !== before.page || after.textLen !== before.textLen || newToasts.length > 0;
  if (!changed) deadClicks.push({ label, sel, reason: 'no-ui-change' });
  return { ok: clicked, changed, newToasts, after };
}

(async () => {
  const { browser, page } = await launch();
  page.on('pageerror', (e) => {
    pageErrors.push(String(e.message));
    console.log('[pageerror]', e.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!/favicon|Failed to load resource.*sw\.js|net::ERR_/i.test(t)) {
        consoleErrors.push(t);
        console.log('[console.error]', t.slice(0, 220));
      }
    }
  });
  page.on('dialog', async (d) => {
    console.log('[dialog]', d.type(), String(d.message()).slice(0, 180));
    try { await d.accept(); } catch (e) {}
  });

  try {
    await reset(page);

    // ===================== PLAYER =====================
    console.log('\n===== PLAYER MODE =====');
    const startUi = await page.evaluate(() => {
      const m = document.getElementById('start-modal');
      return {
        hasOn: m ? m.classList.contains('on') : false,
        tabs: ['player', 'coach', 'self', 'club', 'era'].map((t) => {
          const b = document.getElementById('tab-' + t);
          return { id: t, exists: !!b, text: b ? b.textContent.trim() : null };
        }),
        createPlayerBtn: !!document.querySelector('[onclick="createPlayerCareer()"]'),
        coachApplyBtn: !!document.getElementById('coach-apply-btn'),
      };
    });
    steps.push({ step: 'start-ui', data: startUi });
    await shot(page, 'pcsub-start');

    const playerBoot = await page.evaluate(() => {
      switchStartTab('player');
      pickPlayerArch(1);
      pickPlayerPos('mid');
      if (!_pcTeam && window._pcTeams && window._pcTeams[0]) pickPlayerTeam(window._pcTeams[0].name);
      const nameInput = document.getElementById('pc-name');
      if (nameInput) nameInput.value = ''; // empty name → 无名小将
      createPlayerCareer();
      try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
      const me = myPlayer(S);
      return {
        mode: S.mode,
        teamName: S.teamName,
        meName: me && me.name,
        meAge: me && me.age,
        mePos: me && me.pos,
        currentPage: (document.querySelector('nav button.on') || {}).dataset?.page,
        nav: [...document.querySelectorAll('#nav button')].filter((b) => b.style.display !== 'none').map((b) => b.dataset.page),
        hasCareerFn: typeof renderCareer === 'function',
      };
    });
    steps.push({ step: 'player-boot', data: playerBoot });
    console.log('PLAYER_BOOT', JSON.stringify(playerBoot));
    if (playerBoot.mode !== 'player') record('P0-PLAYER-BOOT', 'FAIL', '选手开局未进入 player 模式', JSON.stringify(playerBoot));
    if (playerBoot.meName !== '无名小将') record('P2-PLAYER-NAME', 'WARN', '空名未默认「无名小将」: ' + playerBoot.meName, JSON.stringify(playerBoot));

    // career page: train / social / media
    await page.evaluate(() => goPage('career'));
    await page.waitForTimeout(200);
    const careerUi = await pageInfo(page);
    steps.push({ step: 'career-ui', data: careerUi });
    await shot(page, 'pcsub-career');
    const careerBtnOnclicks = careerUi.buttons.map((b) => b.onclick || '').join('|');
    const hasTrain = /playerTrain\(/.test(careerBtnOnclicks);
    const hasSocial = /playerSocial\(/.test(careerBtnOnclicks);
    const hasMedia = /playerRespondMedia\(/.test(careerBtnOnclicks) || /playerMedia/.test(careerBtnOnclicks);
    const hasHero = /playerHeroTrain\(/.test(careerBtnOnclicks);
    console.log('CAREER_BTNS', JSON.stringify({ hasTrain, hasSocial, hasMedia, hasHero, n: careerUi.buttonCount, textLen: careerUi.textLen }));
    if (!hasTrain) record('P1-PLAYER-TRAIN-MISSING', 'FAIL', '生涯页无训练按钮', JSON.stringify(careerUi.buttons));
    if (!hasSocial) record('P1-PLAYER-SOCIAL-MISSING', 'FAIL', '生涯页无社交按钮', JSON.stringify(careerUi.buttons));

    // train click
    const trainRes = await page.evaluate(() => {
      const me = myPlayer(S);
      const before = { energy: me.energy, trained: S.trained, attrs: { ...me.attrs } };
      let r = null;
      try { r = playerTrain('lane'); } catch (e) { r = { throw: e.message }; }
      return { before, r, after: { energy: myPlayer(S).energy, trained: S.trained, attrs: { ...myPlayer(S).attrs } }, toasts: (window.__toasts || []).slice() };
    });
    steps.push({ step: 'player-train', data: trainRes });
    console.log('TRAIN', JSON.stringify(trainRes));
    if (trainRes.r && trainRes.r.throw) record('P0-PLAYER-TRAIN-THROW', 'FAIL', 'playerTrain 抛错: ' + trainRes.r.throw, JSON.stringify(trainRes));
    if (trainRes.r && trainRes.r.gain <= 0 && String(trainRes.r.note || '').length < 6) {
      record('P2-TRAIN-NOTE', 'WARN', '加练无收益 toast 仅状态词: ' + trainRes.r.note, JSON.stringify(trainRes.r));
    }

    // social click (if buttons exist)
    const socialRes = await page.evaluate(() => {
      const me = myPlayer(S);
      const keys = Object.keys(SOCIAL_ACTIONS || {});
      if (!keys.length) return { skip: 'no-social-actions' };
      if (S.socialUsed) return { skip: 'socialUsed' };
      const before = { popularity: me.popularity, morale: me.morale, energy: me.energy };
      let r = null;
      try { r = playerSocial(S, keys[0]); } catch (e) { r = { throw: e.message }; }
      return { key: keys[0], before, r, after: { popularity: myPlayer(S).popularity, morale: myPlayer(S).morale, energy: myPlayer(S).energy }, toasts: (window.__toasts || []).slice() };
    });
    steps.push({ step: 'player-social', data: socialRes });
    console.log('SOCIAL', JSON.stringify(socialRes));
    if (socialRes.r && socialRes.r.throw) record('P0-PLAYER-SOCIAL-THROW', 'FAIL', 'playerSocial 抛错: ' + socialRes.r.throw, JSON.stringify(socialRes));

    // media: inject a media question then respond
    const mediaRes = await page.evaluate(() => {
      try {
        S.career = S.career || {};
        S.career.media = {
          day: S.day,
          q: '测试：新赛季目标是什么？',
          opts: [
            { l: '目标是冠军', tip: 't1' },
            { l: '打好每一场', tip: 't2' },
            { l: '暂时保密', tip: 't3' },
          ],
        };
        renderAll();
        const btns = [...document.querySelectorAll('#page-career button')].filter((b) => /playerRespondMedia/.test(b.getAttribute('onclick') || ''));
        let clickR = null;
        if (btns[0]) {
          btns[0].click();
          clickR = 'clicked';
        } else {
          // direct API
          try { playerRespondMedia(S, 0); clickR = 'api'; } catch (e) { clickR = 'throw:' + e.message; }
        }
        return {
          btnCount: btns.length,
          clickR,
          mediaAfter: S.career.media,
          mediaBuff: S.career.mediaBuff,
          toasts: (window.__toasts || []).slice(),
          hasPanelText: /媒体采访/.test((document.getElementById('page-career') || {}).innerText || ''),
        };
      } catch (e) {
        return { throw: e.message };
      }
    });
    steps.push({ step: 'player-media', data: mediaRes });
    console.log('MEDIA', JSON.stringify(mediaRes));
    if (mediaRes.throw) record('P0-PLAYER-MEDIA-THROW', 'FAIL', '媒体互动抛错: ' + mediaRes.throw, JSON.stringify(mediaRes));
    if (mediaRes.btnCount === 0 && mediaRes.clickR !== 'api') record('P1-PLAYER-MEDIA-NOBTN', 'FAIL', '媒体面板无应答按钮', JSON.stringify(mediaRes));
    // media panel may be tick-based (偶发); if injected panel didn't render, note as coverage gap not bug
    if (mediaRes.hasPanelText === false && mediaRes.btnCount === 0) {
      record('P2-MEDIA-UI-COVERAGE', 'INFO', '媒体 UI 未渲染（可能需 mediaDayTick 触发）——已用 API 验证响应路径', JSON.stringify(mediaRes));
    }

    // club page + player match
    await page.evaluate(() => goPage('club'));
    await page.waitForTimeout(200);
    const clubUi = await pageInfo(page);
    steps.push({ step: 'player-club-ui', data: clubUi });
    await shot(page, 'pcsub-player-club');
    const matchRes = await page.evaluate(() => {
      const before = { matchIdx: S.matchIdx, history: (S.history || []).length, matches: (S.career.stats || {}).matches };
      let r = null;
      try { startPlayerMatch(); r = 'ok'; } catch (e) { r = 'throw:' + e.message; }
      return {
        before,
        r,
        after: { matchIdx: S.matchIdx, history: (S.history || []).length, matches: (S.career.stats || {}).matches },
        toasts: (window.__toasts || []).slice(),
      };
    });
    steps.push({ step: 'player-match', data: matchRes });
    console.log('PLAYER_MATCH', JSON.stringify(matchRes));
    if (String(matchRes.r).startsWith('throw')) record('P0-PLAYER-MATCH', 'FAIL', 'startPlayerMatch 抛错: ' + matchRes.r, JSON.stringify(matchRes));
    else if (matchRes.after.history === matchRes.before.history && matchRes.after.matchIdx === matchRes.before.matchIdx) {
      record('P1-PLAYER-MATCH-NOOP', 'FAIL', 'startPlayerMatch 无推进（点了没反应）', JSON.stringify(matchRes));
    }

    // illegal page gating
    const illegal = await page.evaluate(() => {
      const results = [];
      const pages = ['market', 'lineup', 'biz', 'train'];
      for (const p of pages) {
        const toastsBefore = (window.__toasts || []).length;
        try { goPage(p); } catch (e) { results.push({ p, throw: e.message }); continue; }
        const cur = (document.querySelector('nav button.on') || {}).dataset?.page;
        const visible = !!document.querySelector('#page-' + p + '.on');
        const newToasts = (window.__toasts || []).slice(toastsBefore);
        results.push({ p, cur, visible, newToasts });
      }
      return { results, nav: [...document.querySelectorAll('#nav button')].filter((b) => b.style.display !== 'none').map((b) => b.dataset.page) };
    });
    steps.push({ step: 'player-illegal-pages', data: illegal });
    console.log('ILLEGAL', JSON.stringify(illegal));
    for (const r of illegal.results) {
      if (r.visible || r.cur === r.p) {
        record('P0-PLAYER-PAGE-LEAK', 'FAIL', '选手模式可进入非法页 ' + r.p, JSON.stringify(r));
      }
      if (!r.newToasts || !r.newToasts.length) {
        record('P2-GATE-NO-TOAST', 'WARN', 'goPage(' + r.p + ') 门禁无 toast', JSON.stringify(r));
      }
    }

    // kjia promote leak (the known P0)
    await page.evaluate(() => goPage('kjia'));
    await page.waitForTimeout(250);
    const kjiaLeak = await page.evaluate(() => {
      const text = (document.getElementById('page-kjia') || {}).innerText || '';
      const btns = [...document.querySelectorAll('#page-kjia button')].map((b) => ({
        text: b.textContent.trim().slice(0, 30),
        onclick: b.getAttribute('onclick'),
        disabled: !!b.disabled,
      }));
      const promoteBtns = btns.filter((b) => /promoteKjiaPlayer/.test(b.onclick || ''));
      const recallBtns = btns.filter((b) => /recallKjia/.test(b.onclick || ''));
      const sendBtns = btns.filter((b) => /sendKjia/.test(b.onclick || ''));

      let promoteTry = 'no-btn';
      let promoteToasts = [];
      let playersBefore = S.players.length;
      let squadBefore = (S.kjia && S.kjia.squad || []).length;
      if (promoteBtns.length && S.kjia && S.kjia.squad && S.kjia.squad[0]) {
        const id = S.kjia.squad[0].id;
        window.__toasts = [];
        try { promoteKjiaPlayer(id); promoteTry = 'called'; } catch (e) { promoteTry = 'throw:' + e.message; }
        promoteToasts = (window.__toasts || []).slice();
      }
      // even without button, force-call to test engine guard
      let forceTry = null, forceToasts = [];
      if (S.kjia && S.kjia.squad && S.kjia.squad[0]) {
        window.__toasts = [];
        try { promoteKjiaPlayer(S.kjia.squad[0].id); forceTry = 'called'; } catch (e) { forceTry = 'throw:' + e.message; }
        forceToasts = (window.__toasts || []).slice();
      } else forceTry = 'no-squad';

      return {
        mode: S.mode,
        hasPromoteHint: /提拔一线队/.test(text),
        hasManagerCopy: /阵容页/.test(text),
        promoteBtnCount: promoteBtns.length,
        recallBtnCount: recallBtns.length,
        sendBtnCount: sendBtns.length,
        promoteBtns: promoteBtns.slice(0, 3),
        promoteTry, promoteToasts,
        forceTry, forceToasts,
        squadBefore, squadAfter: (S.kjia && S.kjia.squad || []).length,
        playersBefore, playersAfter: S.players.length,
        textHead: text.slice(0, 400),
      };
    });
    steps.push({ step: 'player-kjia-leak', data: kjiaLeak });
    console.log('KJIA_LEAK', JSON.stringify(kjiaLeak, null, 2));
    await shot(page, 'pcsub-player-kjia');

    // Real UI click on promote button if present
    let uiPromote = null;
    if (kjiaLeak.promoteBtnCount > 0) {
      uiPromote = await clickAndObserve(page, '#page-kjia button[onclick*="promoteKjiaPlayer"]', 'player-kjia-promote');
      console.log('UI_PROMOTE', JSON.stringify(uiPromote));
      // Did roster actually change?
      const rosterDelta = await page.evaluate(() => ({ players: S.players.length, squad: (S.kjia && S.kjia.squad || []).length }));
      if (rosterDelta.players > kjiaLeak.playersBefore) {
        record('P0-PLAYER-PROMOTE-LEAK', 'FAIL',
          '选手模式二队页可提拔 K甲选手进一队（人事权泄漏）',
          JSON.stringify({ kjiaLeak, uiPromote, rosterDelta }));
      } else if (kjiaLeak.promoteBtnCount > 0) {
        record('P1-PLAYER-KJIA-UI-LEAK', 'FAIL',
          '选手模式二队页仍渲染「提拔/召回」经理操作按钮',
          JSON.stringify(kjiaLeak));
      }
    } else if (kjiaLeak.hasPromoteHint || kjiaLeak.hasManagerCopy) {
      record('P1-PLAYER-KJIA-COPY', 'FAIL', '选手二队页文案仍指向经理路径（阵容页/提拔）', JSON.stringify(kjiaLeak));
    } else {
      record('P0-PLAYER-PROMOTE-GUARDED', 'PASS', '选手二队页无提拔按钮且引擎拒绝', JSON.stringify(kjiaLeak));
    }

    // force-call engine guard
    if (kjiaLeak.forceTry === 'called' && kjiaLeak.playersAfter > kjiaLeak.playersBefore) {
      record('P0-PLAYER-PROMOTE-FORCE-LEAK', 'FAIL', '引擎 promoteKjiaPlayer 对选手无门禁（强制调用成功）', JSON.stringify(kjiaLeak));
    }

    // FAB / page dock (recently changed)
    const fab = await page.evaluate(() => {
      const fabEl = document.getElementById('page-fab');
      const dock = document.getElementById('page-dock');
      if (fabEl) fabEl.click();
      const dockOpen = dock ? dock.classList.contains('open') : false;
      const dockBtns = dock ? [...dock.querySelectorAll('button')].map((b) => ({ t: b.textContent.trim(), p: b.dataset.page })) : [];
      return {
        fabExists: !!fabEl,
        fabVisible: fabEl ? (fabEl.offsetParent !== null || getComputedStyle(fabEl).display !== 'none') : false,
        dockExists: !!dock,
        dockOpen,
        dockBtnCount: dockBtns.length,
        dockBtns: dockBtns.slice(0, 12),
      };
    });
    steps.push({ step: 'player-fab', data: fab });
    console.log('FAB', JSON.stringify(fab));
    if (!fab.fabExists || !fab.dockExists) record('P1-FAB-MISSING', 'FAIL', '底栏 FAB/页签抽屉缺失', JSON.stringify(fab));
    else if (!fab.dockOpen) record('P2-FAB-NO-OPEN', 'WARN', '点 FAB 后 page-dock 未打开', JSON.stringify(fab));

    // ===================== COACH =====================
    console.log('\n===== COACH MODE =====');
    await reset(page);
    const coachBoot = await page.evaluate(() => {
      switchStartTab('coach');
      pickCoachClub(1);
      const btn = document.getElementById('coach-apply-btn');
      if (btn) btn.click();
      else applyCoachClub();
      try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
      return {
        mode: S.mode,
        teamName: S.teamName,
        coach: S.coach && { name: S.coach.name, id: S.coach.id },
        deal: S.coachDeal,
        currentPage: (document.querySelector('nav button.on') || {}).dataset?.page,
        nav: [...document.querySelectorAll('#nav button')].filter((b) => b.style.display !== 'none').map((b) => b.dataset.page),
      };
    });
    steps.push({ step: 'coach-boot', data: coachBoot });
    console.log('COACH_BOOT', JSON.stringify(coachBoot));
    await shot(page, 'pcsub-coach-boot');
    if (coachBoot.mode !== 'coach') record('P0-COACH-BOOT', 'FAIL', '教练开局未进入 coach 模式', JSON.stringify(coachBoot));

    // lineup page
    await page.evaluate(() => goPage('lineup'));
    await page.waitForTimeout(200);
    const lineupUi = await pageInfo(page);
    steps.push({ step: 'coach-lineup', data: lineupUi });
    await shot(page, 'pcsub-coach-lineup');
    const lineupOnclicks = lineupUi.buttons.map((b) => b.onclick || '').join('|');
    const lineupHasSell = /openSellNego|listPlayer/.test(lineupOnclicks);
    const lineupHasTactic = /setTactic|tactic/.test(lineupOnclicks) || /战术|对线|团战|运营/.test(lineupUi.buttons.map((b) => b.text).join('|'));
    const lineupHasSwap = /swapPlayer/.test(lineupOnclicks);
    console.log('LINEUP', JSON.stringify({ hasSell: lineupHasSell, hasTactic: lineupHasTactic, hasSwap: lineupHasSwap, n: lineupUi.buttonCount }));
    if (lineupHasSell) record('P0-COACH-SELL-LEAK', 'FAIL', '教练阵容页出现出售/挂牌按钮', JSON.stringify(lineupUi.buttons));
    if (!lineupHasSwap) record('P1-COACH-LINEUP-NO-SWAP', 'FAIL', '教练阵容页无换人按钮', JSON.stringify(lineupUi.buttons));

    // train page
    await page.evaluate(() => goPage('train'));
    await page.waitForTimeout(200);
    const trainUi = await pageInfo(page);
    steps.push({ step: 'coach-train', data: trainUi });
    await shot(page, 'pcsub-coach-train');
    if (trainUi.buttonCount < 5) record('P1-COACH-TRAIN-THIN', 'FAIL', '教练训练页按钮过少: ' + trainUi.buttonCount, JSON.stringify(trainUi.buttons));
    // one train click via UI
    const coachTrainClick = await clickAndObserve(page, '#page-train button:not([disabled])', 'coach-train-btn');
    console.log('COACH_TRAIN_CLICK', JSON.stringify(coachTrainClick));

    // market: emergency loan, no sell
    await page.evaluate(() => goPage('market'));
    await page.waitForTimeout(250);
    const marketUi = await pageInfo(page);
    steps.push({ step: 'coach-market', data: marketUi });
    await shot(page, 'pcsub-coach-market');
    const mkt = await page.evaluate(() => {
      const text = (document.getElementById('page-market') || {}).innerText || '';
      const btns = [...document.querySelectorAll('#page-market button')].map((b) => ({
        text: b.textContent.trim().slice(0, 32),
        onclick: b.getAttribute('onclick'),
        disabled: !!b.disabled,
      }));
      return {
        textHead: text.slice(0, 500),
        hasSell: btns.some((b) => /openSellNego|listPlayer/.test(b.onclick || '')),
        hasSellText: /挂牌出售|出售选手|挂牌卖人/.test(text),
        hasCannotSellCopy: /不能挂牌|买断挂牌由俱乐部/.test(text),
        hasLoan: btns.some((b) => /loanPlayer|coachRequest/.test(b.onclick || '')),
        loanBtns: btns.filter((b) => /loanPlayer|coachRequest/.test(b.onclick || '')).slice(0, 6),
        allOnclicks: btns.map((b) => b.onclick).filter(Boolean).slice(0, 30),
        btnCount: btns.length,
      };
    });
    console.log('MARKET', JSON.stringify(mkt, null, 2));
    if (mkt.hasSell) record('P0-COACH-SELL-IN-MARKET', 'FAIL', '教练转会页出现出售/挂牌按钮', JSON.stringify(mkt));
    if (!mkt.hasLoan) record('P1-COACH-NO-LOAN', 'FAIL', '教练转会页无应急租借/引援按钮', JSON.stringify(mkt));
    if (!mkt.hasCannotSellCopy) record('P2-COACH-SELL-COPY', 'WARN', '教练转会页未写明「不能挂牌出售」', JSON.stringify(mkt).slice(0, 300));

    // try emergency loan click if any
    if (mkt.loanBtns.length) {
      const loanClick = await clickAndObserve(page, '#page-market button[onclick*="loanPlayer"]', 'coach-emergency-loan');
      console.log('LOAN_CLICK', JSON.stringify(loanClick));
      steps.push({ step: 'coach-loan-click', data: loanClick });
    }

    // force-call openSellNego as coach (engine guard)
    const sellGuard = await page.evaluate(() => {
      window.__toasts = [];
      let r = null;
      const p = (S.players || [])[0];
      if (!p) return { skip: 'no-players' };
      try { openSellNego(S, p.id); r = 'opened'; } catch (e) { r = 'throw:' + e.message; }
      return { r, toasts: (window.__toasts || []).slice(), modalOpen: !!document.querySelector('.modal.on, #nego-modal.on, [id*=nego].on') };
    });
    steps.push({ step: 'coach-sell-guard', data: sellGuard });
    console.log('SELL_GUARD', JSON.stringify(sellGuard));
    if (sellGuard.r === 'opened' && !sellGuard.modalOpen) {
      // opened but no modal? weird
      record('P2-SELL-GUARD-ODD', 'WARN', 'openSellNego 返回无 modal', JSON.stringify(sellGuard));
    } else if (sellGuard.r === 'opened' && sellGuard.modalOpen) {
      record('P0-COACH-SELL-FORCE-LEAK', 'FAIL', '教练可强制打开出售谈判', JSON.stringify(sellGuard));
    }

    // coach offer accept / reject / illegal name
    const offerRes = await page.evaluate(() => {
      const out = {};
      // exact name accept
      const pool = CLUB_TEMPLATES.filter((c) => c.name !== S.teamName);
      const target = pool[0];
      S.coachOffer = { team: target.name };
      const tb = S.teamName;
      const cid = S.coach && S.coach.id;
      window.__toasts = [];
      try { respondCoachOffer(true); out.acceptExact = { ok: true, moved: S.teamName !== tb, newTeam: S.teamName, coachKept: (S.coach && S.coach.id) === cid, toasts: (window.__toasts || []).slice() }; }
      catch (e) { out.acceptExact = { throw: e.message }; }
      // reject
      S.coachOffer = { team: (CLUB_TEMPLATES.find((c) => c.name !== S.teamName) || {}).name };
      const tb2 = S.teamName;
      const logLen = ((S.coachDeal && S.coachDeal.log) || []).length;
      window.__toasts = [];
      try {
        respondCoachOffer(false);
        out.reject = {
          ok: true,
          stayed: S.teamName === tb2,
          offerCleared: !S.coachOffer,
          logAdded: ((S.coachDeal && S.coachDeal.log) || []).length > logLen,
          toasts: (window.__toasts || []).slice(),
        };
      } catch (e) { out.reject = { throw: e.message }; }
      // illegal name accept
      S.coachOffer = { team: 'ZZZ_NO_SUCH_CLUB' };
      const tb3 = S.teamName;
      const logLen3 = ((S.coachDeal && S.coachDeal.log) || []).length;
      window.__toasts = [];
      try {
        respondCoachOffer(true);
        out.badName = {
          ok: true,
          moved: S.teamName !== tb3,
          newTeam: S.teamName,
          offerCleared: !S.coachOffer,
          logAdded: ((S.coachDeal && S.coachDeal.log) || []).length > logLen3,
          toasts: (window.__toasts || []).slice(),
          silent: ((window.__toasts || []).length === 0) && !S.coachOffer && S.teamName === tb3,
        };
      } catch (e) { out.badName = { throw: e.message }; }
      // UI: inject offer and click accept button
      S.coachOffer = { team: (CLUB_TEMPLATES.find((c) => c.name !== S.teamName) || CLUB_TEMPLATES[0]).name };
      try { renderAll(); } catch (e) {}
      const acceptBtn = [...document.querySelectorAll('button')].find((b) => /respondCoachOffer\(true\)/.test(b.getAttribute('onclick') || ''));
      const rejectBtn = [...document.querySelectorAll('button')].find((b) => /respondCoachOffer\(false\)/.test(b.getAttribute('onclick') || ''));
      out.uiButtons = {
        accept: acceptBtn ? acceptBtn.textContent.trim().slice(0, 30) : null,
        reject: rejectBtn ? rejectBtn.textContent.trim().slice(0, 30) : null,
      };
      return out;
    });
    steps.push({ step: 'coach-offer', data: offerRes });
    console.log('OFFER', JSON.stringify(offerRes, null, 2));
    if (offerRes.acceptExact && offerRes.acceptExact.throw) record('P0-OFFER-ACCEPT-THROW', 'FAIL', '接受邀约抛错', JSON.stringify(offerRes.acceptExact));
    if (offerRes.acceptExact && !offerRes.acceptExact.moved) record('P0-OFFER-ACCEPT-NOOP', 'FAIL', '接受邀约未换队（点了没反应）', JSON.stringify(offerRes.acceptExact));
    if (offerRes.badName && offerRes.badName.silent) {
      record('P1-OFFER-BADNAME-SILENT', 'FAIL', '非法队名接受邀约被静默吞掉', JSON.stringify(offerRes.badName));
    } else if (offerRes.badName && offerRes.badName.throw) {
      record('P1-OFFER-BADNAME-THROW', 'FAIL', '非法队名接受邀约抛错: ' + offerRes.badName.throw, JSON.stringify(offerRes.badName));
    } else if (offerRes.badName && (offerRes.badName.toasts || []).length) {
      record('P0-OFFER-BADNAME-FIXED', 'PASS', '非法队名有 toast 反馈', JSON.stringify(offerRes.badName));
    }
    if (offerRes.uiButtons && (!offerRes.uiButtons.accept || !offerRes.uiButtons.reject)) {
      record('P1-OFFER-UI-MISSING', 'FAIL', '俱乐部页缺豪门邀约接受/拒绝按钮', JSON.stringify(offerRes.uiButtons));
    }

    // BP / match entry via UI
    await page.evaluate(() => goPage('club'));
    await page.waitForTimeout(250);
    const matchUiRes = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('#page-club button, #page-club [onclick]')].map((b) => ({
        text: (b.textContent || '').trim().slice(0, 40),
        onclick: b.getAttribute('onclick'),
        disabled: !!b.disabled,
      }));
      return {
        btns: btns.slice(0, 30),
        hasStartMatch: btns.some((b) => /uiStartMatch|startMatch|startCard|startPlayoff/.test(b.onclick || '')),
        hasOpenBP: btns.some((b) => /openBP|uiStartMatch/.test(b.onclick || '')),
        textHead: ((document.getElementById('page-club') || {}).innerText || '').slice(0, 400),
      };
    });
    steps.push({ step: 'coach-club-match-ui', data: matchUiRes });
    console.log('MATCH_UI', JSON.stringify(matchUiRes, null, 2));
    if (!matchUiRes.hasStartMatch) record('P1-COACH-NO-MATCH-ENTRY', 'FAIL', '教练俱乐部页无开赛入口', JSON.stringify(matchUiRes));

    // Full BP chain via UI functions
    const bpChain = await page.evaluate(() => {
      const out = {};
      window.__toasts = [];
      try { startMatch(); out.startMatch = { ok: true, hasSeries: !!S.series, opName: S.series && S.series.opName, toasts: (window.__toasts || []).slice() }; }
      catch (e) { out.startMatch = { throw: e.message }; }
      window.__toasts = [];
      try { openBP('测试BP', typeof playGame === 'function' ? playGame : function () {}); out.openBP = { ok: true, bpOpen: !!(document.getElementById('bp-modal') || document.querySelector('[id*=bp].on')), toasts: (window.__toasts || []).slice() }; }
      catch (e) { out.openBP = { throw: e.message }; }
      window.__toasts = [];
      try {
        if (typeof bpAutoAll === 'function') bpAutoAll();
        if (typeof bpConfirm === 'function') bpConfirm();
        out.bpConfirm = { ok: true, hasSeries: !!S.series, toasts: (window.__toasts || []).slice() };
      } catch (e) { out.bpConfirm = { throw: e.message }; }
      window.__toasts = [];
      try {
        if (S.series) { playGame(); out.playGame = { ok: true, mw: S.series && S.series.mw, ow: S.series && S.series.ow, history: (S.history || []).length }; }
        else out.playGame = { skip: 'series-null-after-bp' };
      } catch (e) { out.playGame = { throw: e.message }; }
      return out;
    });
    steps.push({ step: 'coach-bp-chain', data: bpChain });
    console.log('BP_CHAIN', JSON.stringify(bpChain, null, 2));
    if (bpChain.startMatch && bpChain.startMatch.throw) record('P0-COACH-MATCH-THROW', 'FAIL', 'startMatch 抛错: ' + bpChain.startMatch.throw, JSON.stringify(bpChain.startMatch));
    if (bpChain.openBP && bpChain.openBP.throw) record('P0-COACH-BP-THROW', 'FAIL', 'openBP 抛错: ' + bpChain.openBP.throw, JSON.stringify(bpChain.openBP));
    if (bpChain.bpConfirm && bpChain.bpConfirm.throw) record('P0-COACH-BP-CONFIRM-THROW', 'FAIL', 'bpConfirm 抛错: ' + bpChain.bpConfirm.throw, JSON.stringify(bpChain.bpConfirm));
    if (bpChain.playGame && bpChain.playGame.throw) record('P1-COACH-PLAY-THROW', 'FAIL', 'playGame 抛错: ' + bpChain.playGame.throw, JSON.stringify(bpChain.playGame));

    // coach illegal page biz
    const coachBiz = await page.evaluate(() => {
      window.__toasts = [];
      try { goPage('biz'); } catch (e) { return { throw: e.message }; }
      return {
        cur: (document.querySelector('nav button.on') || {}).dataset?.page,
        bizVisible: !!document.querySelector('#page-biz.on'),
        toasts: (window.__toasts || []).slice(),
      };
    });
    steps.push({ step: 'coach-biz-gate', data: coachBiz });
    console.log('COACH_BIZ', JSON.stringify(coachBiz));
    if (coachBiz.bizVisible) record('P0-COACH-BIZ-LEAK', 'FAIL', '教练可进入经营页', JSON.stringify(coachBiz));

    // dead-click sweep: all visible enabled buttons on current page, see if any produce zero feedback
    for (const pg of ['club', 'lineup', 'market', 'train', 'career', 'kjia']) {
      const sweep = await page.evaluate((pageName) => {
        try { goPage(pageName); } catch (e) { return { throw: e.message }; }
        const sec = document.getElementById('page-' + pageName);
        if (!sec) return { skip: 'no-section' };
        const btns = [...sec.querySelectorAll('button')].filter((b) => !b.disabled && (b.offsetParent !== null));
        return {
          count: btns.length,
          samples: btns.slice(0, 15).map((b) => ({ text: b.textContent.trim().slice(0, 28), onclick: b.getAttribute('onclick') })),
        };
      }, pg);
      steps.push({ step: 'sweep-' + pg, data: sweep });
      console.log('SWEEP', pg, JSON.stringify(sweep).slice(0, 400));
    }

    // final FAB check in coach mode
    const coachFab = await page.evaluate(() => {
      const fabEl = document.getElementById('page-fab');
      const dock = document.getElementById('page-dock');
      if (fabEl) fabEl.click();
      return {
        fabExists: !!fabEl,
        dockOpen: dock ? dock.classList.contains('open') : false,
        dockBtns: dock ? dock.querySelectorAll('button').length : 0,
      };
    });
    console.log('COACH_FAB', JSON.stringify(coachFab));

  } catch (e) {
    console.error('FATAL', e && e.stack || e);
    record('P0-PROBE-FATAL', 'FAIL', '探针异常中断', e && e.stack || e);
  } finally {
    await browser.close();
  }

  const summary = {
    findings,
    failCount: findings.filter((f) => f.severity === 'FAIL').length,
    warnCount: findings.filter((f) => f.severity === 'WARN').length,
    passCount: findings.filter((f) => f.severity === 'PASS').length,
    pageErrors,
    consoleErrors,
    deadClicks,
    toastCount: toasts.length,
  };
  console.log('\n===== FINDINGS =====');
  console.log(JSON.stringify(summary, null, 2));
  fs.writeFileSync(
    'E:\\sex\\kpl-manager\\.bug-hunt\\pc-subagent-probe.json',
    JSON.stringify({ summary, steps, toasts }, null, 2),
    'utf8'
  );
  console.log('WROTE pc-subagent-probe.json');
})();
