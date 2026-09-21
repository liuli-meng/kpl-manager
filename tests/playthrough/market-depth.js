/* 转会市场深度 playtest: createTeam → market structure → buy/sell nego */
const { launch, shot, call, BASE } = require('./pw');

async function main() {
  const { browser, page } = await launch();

  // Fresh start
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // Dismiss any tour/modal that may appear on first paint
  await page.evaluate(() => {
    try {
      if (typeof tourSkip === 'function' && window._tour) tourSkip();
      closeModal('start-modal');
      closeModal('app-modal');
    } catch (e) {}
  });
  await page.waitForTimeout(200);

  // ---- 1. createTeam '交易专家' ----
  const created = await page.evaluate(() => {
    const nameEl = document.querySelector('#new-team-name');
    if (nameEl) nameEl.value = '交易专家';
    createTeam();
    return {
      teamName: S.teamName,
      selfBuilt: S.selfBuilt,
      fund: S.fund,
      wageCap: S.wageCap,
      preseason: S.preseason,
      transferWindow: S.transferWindow,
      players: (S.players || []).map(p => ({ id: p.id, name: p.name, pos: p.pos, overall: overall(p), wage: p.wage, contract: p.contract })),
      marketLen: (S.market || []).length,
      transferListLen: (S.transferList || []).length,
      freeAgentsLen: (S.freeAgents || []).length,
      page: document.querySelector('.page.on') ? document.querySelector('.page.on').id : null,
    };
  });
  console.log('CREATE_TEAM', JSON.stringify(created, null, 2));
  await page.waitForTimeout(300);

  // Close tour if it popped after goPage
  await page.evaluate(() => {
    try { if (window._tour && typeof tourSkip === 'function') tourSkip(); } catch (e) {}
    try { closeModal('app-modal'); } catch (e) {}
  });
  await page.waitForTimeout(200);

  // ---- 2. goPage market + screenshot + dump structure ----
  await page.evaluate(() => { goPage('market'); });
  await page.waitForTimeout(400);
  await shot(page, 'market-depth-01-page');

  const structure = await page.evaluate(() => {
    const snap = (list, n) => (list || []).slice(0, n).map(p => ({
      id: p.id, name: p.name, pos: p.pos, age: p.age,
      overall: overall(p), power: playerPower(p, p.sig),
      wage: p.wage, willingness: p.willingness, untouchable: !!p.untouchable,
      freeAgent: !!p.freeAgent, ownerTeam: p.ownerTeam || null,
      signCost: p.signCost != null ? p.signCost : null,
      discount: !!p.discount, transferRequest: !!p.transferRequest,
      buyout: typeof buyoutPrice === 'function' ? buyoutPrice(p) : null,
      ask: typeof negoAskFee === 'function' ? negoAskFee(p) : null,
      wageDemand: typeof negoWageDemand === 'function' ? negoWageDemand(p) : null,
      attrs: p.attrs, skill: p.skill ? p.skill.n : null,
    }));

    const panels = [...document.querySelectorAll('#page-market .panel')].map(el => {
      const h = el.querySelector('h3');
      return h ? h.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) : '(no h3)';
    });

    const btns = [...document.querySelectorAll('#page-market button')].map(b => ({
      text: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
      onclick: b.getAttribute('onclick') || '',
      disabled: !!b.disabled,
    }));

    return {
      transferWindow: S.transferWindow,
      fund: S.fund,
      wageCap: S.wageCap,
      weeklyWage: weeklyWage(S),
      market: snap(S.market, 6),
      marketKeys: S.market && S.market[0] ? Object.keys(S.market[0]) : [],
      transferList: snap(S.transferList, 8),
      transferListKeys: S.transferList && S.transferList[0] ? Object.keys(S.transferList[0]) : [],
      freeAgents: snap(S.freeAgents, 6),
      freeAgentKeys: S.freeAgents && S.freeAgents[0] ? Object.keys(S.freeAgents[0]) : [],
      listed: S.listed || [],
      bids: S.bids || [],
      panels,
      buyButtons: btns.filter(b => /买|签|谈|挖|租|刷新/.test(b.text)),
      allButtonSamples: btns.slice(0, 25),
    };
  });
  console.log('MARKET_STRUCTURE', JSON.stringify(structure, null, 2));

  // ---- 3. Dump nego/transfer/market related globals ----
  const fns = await page.evaluate(() => {
    const re = /nego|transfer|market|buy|sell|list|offer|loan|raid|buyout|refresh/i;
    const names = Object.getOwnPropertyNames(window).filter(k => {
      try { return re.test(k) && typeof window[k] === 'function'; } catch (e) { return false; }
    }).sort();
    return names.map(n => {
      try { return { name: n, len: window[n].length, src: String(window[n]).slice(0, 120).replace(/\s+/g, ' ') }; }
      catch (e) { return { name: n, err: e.message }; }
    });
  });
  console.log('NEGO_FUNCS', JSON.stringify(fns, null, 2));

  // Explicit probe for the names the prompt mentioned
  const probe = await page.evaluate(() => ({
    openBuyout: typeof openBuyout,
    startNego: typeof startNego,
    openSellNego: typeof openSellNego,
    openNegotiation: typeof openNegotiation,
    buyPlayer: typeof buyPlayer,
    refreshMarket: typeof refreshMarket,
    listPlayer: typeof listPlayer,
    _nego: typeof window._nego,
    _sellNego: typeof window._sellNego,
  }));
  console.log('NAME_PROBE', JSON.stringify(probe, null, 2));

  // ---- 4a. Attempt BUY negotiation (openNegotiation on transferList) ----
  const buyTarget = await page.evaluate(() => {
    const candidates = (S.transferList || []).filter(p => !S.players.some(x => x.id === p.id));
    // Prefer willing, non-untouchable if possible
    const sorted = candidates.slice().sort((a, b) => {
      const au = a.untouchable ? 1 : 0, bu = b.untouchable ? 1 : 0;
      if (au !== bu) return au - bu;
      return (b.willingness || 0) - (a.willingness || 0);
    });
    const p = sorted[0];
    if (!p) return { ok: false, reason: 'transferList empty' };
    openNegotiation(S, p.id);
    const n = window._nego;
    return {
      ok: !!(n && n.pid),
      id: p.id, name: p.name, pos: p.pos, overall: overall(p),
      willingness: p.willingness, untouchable: !!p.untouchable, ownerTeam: p.ownerTeam,
      fundBefore: S.fund, playersBefore: (S.players || []).length,
      nego: n ? { round: n.round, freeAgent: n.freeAgent, askFee: n.askFee, askWage: n.askWage, pid: n.pid } : null,
      modalOpen: document.querySelector('#app-modal').classList.contains('on'),
      modalHasNego: /转会谈判|谈判/.test(document.querySelector('#app-modal-body').innerHTML || ''),
      modalSnippet: (document.querySelector('#app-modal-body').innerHTML || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400),
    };
  });
  console.log('BUY_OPEN', JSON.stringify(buyTarget, null, 2));
  await page.waitForTimeout(250);
  await shot(page, 'market-depth-02-buy-nego');

  // Try satisfy ask + submit if buy modal is open
  if (buyTarget.ok) {
    const buyResult = await page.evaluate(() => {
      const n = window._nego;
      if (!n) return { ok: false, reason: 'no _nego' };
      // Avoid over-cap confirm dialog blocking headless: temporarily raise cap if needed
      const s = n.s;
      const p = s.transferList.find(x => x.id === n.pid) || (s.freeAgents || []).find(x => x.id === n.pid);
      if (!p) return { ok: false, reason: 'player gone' };

      // Set fee/wage to exact ask (negoFillAsk or manual)
      try { negoFillAsk(); } catch (e) {}
      const feeEl = document.querySelector('#nego-fee');
      const wageEl = document.querySelector('#nego-wage');
      const feeVal = !n.freeAgent ? Math.round(n.askFee * ((p.willingness || 0) < 30 ? 1.3 : 1)) : 0;
      if (feeEl && !n.freeAgent) feeEl.value = String(feeVal);
      if (wageEl) wageEl.value = String(n.askWage);

      // If cap confirm would fire, auto-accept by monkeypatching confirm for one shot
      const origConfirm = window.confirm;
      window.confirm = () => true;
      let err = null;
      try { negoSubmit(); } catch (e) { err = e.message; }
      window.confirm = origConfirm;

      return {
        err,
        fundAfter: S.fund,
        playersAfter: (S.players || []).length,
        owns: S.players.some(x => x.id === n.pid || (p && x.name === p.name)),
        negoNull: !window._nego,
        modalOpen: document.querySelector('#app-modal').classList.contains('on'),
        toastText: (document.querySelector('#toast') || {}).textContent || '',
        eventTail: (S.eventLog || []).slice(-3),
      };
    });
    console.log('BUY_RESULT', JSON.stringify(buyResult, null, 2));
    await page.waitForTimeout(200);
    await shot(page, 'market-depth-03-buy-result');
  } else {
    // Try free agent path
    const fa = await page.evaluate(() => {
      const p = (S.freeAgents || [])[0];
      if (!p) return { ok: false, reason: 'no free agents' };
      openNegotiation(S, p.id);
      const n = window._nego;
      return { ok: !!(n && n.pid), id: p.id, name: p.name, freeAgent: !!(n && n.freeAgent), askWage: n && n.askWage, askFee: n && n.askFee };
    });
    console.log('BUY_FA_OPEN', JSON.stringify(fa, null, 2));
    await shot(page, 'market-depth-02b-buy-fa-nego');
    if (fa.ok) {
      const faRes = await page.evaluate(() => {
        const n = window._nego;
        if (!n) return { ok: false };
        const wageEl = document.querySelector('#nego-wage');
        if (wageEl) wageEl.value = String(n.askWage);
        const origConfirm = window.confirm;
        window.confirm = () => true;
        let err = null;
        try { negoSubmit(); } catch (e) { err = e.message; }
        window.confirm = origConfirm;
        return { err, playersAfter: (S.players || []).length, fundAfter: S.fund, negoNull: !window._nego, eventTail: (S.eventLog || []).slice(-2) };
      });
      console.log('BUY_FA_RESULT', JSON.stringify(faRes, null, 2));
    }
  }

  // Cancel-path probe: open another buy nego then quit
  const cancelBuy = await page.evaluate(() => {
    closeModal('app-modal');
    window._nego = null;
    const p = (S.transferList || []).find(x => !S.players.some(y => y.id === x.id));
    if (!p) return { ok: false, reason: 'no target' };
    openNegotiation(S, p.id);
    if (!window._nego) return { ok: false, reason: 'open failed' };
    const modalBefore = document.querySelector('#app-modal').classList.contains('on');
    negoQuit();
    return {
      ok: true,
      pid: p.id, name: p.name,
      modalBefore,
      modalAfter: document.querySelector('#app-modal').classList.contains('on'),
      _negoAfter: !!window._nego,
      playersUnchanged: (S.players || []).length,
    };
  });
  console.log('BUY_CANCEL', JSON.stringify(cancelBuy, null, 2));
  await shot(page, 'market-depth-04-buy-cancel');

  // ---- 4b. Attempt SELL negotiation ----
  const sellTarget = await page.evaluate(() => {
    // Pick a non-starter if possible (safer for sellGuard / lineup)
    const starters = new Set(S.lineup || []);
    const bench = (S.players || []).filter(p => !starters.has(p.id) && !p.loan && !p.loanOut);
    const pickP = bench[0] || (S.players || [])[0];
    if (!pickP) return { ok: false, reason: 'no players' };
    openSellNego(S, pickP.id);
    const n = window._sellNego;
    return {
      ok: !!(n && n.pid),
      id: pickP.id, name: pickP.name, pos: pickP.pos, overall: overall(pickP),
      isStarter: starters.has(pickP.id),
      fundBefore: S.fund, playersBefore: (S.players || []).length,
      sellNego: n ? {
        round: n.round, ask: n.ask, lowball: n.lowball,
        clubs: (n.clubs || []).map(c => ({ name: c.name, bid: c.bid, max: c.max, status: c.status })),
        lock: n.lock, msg: (n.msg || '').slice(0, 120),
      } : null,
      modalOpen: document.querySelector('#app-modal').classList.contains('on'),
      modalSnippet: (document.querySelector('#app-modal-body').innerHTML || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400),
    };
  });
  console.log('SELL_OPEN', JSON.stringify(sellTarget, null, 2));
  await page.waitForTimeout(250);
  await shot(page, 'market-depth-05-sell-nego');

  if (sellTarget.ok) {
    // First try a realistic mid ask submit, screenshot, then accept first active/lowball if needed
    const sellStep = await page.evaluate(() => {
      const n = window._sellNego;
      if (!n) return { ok: false, reason: 'no _sellNego' };
      // Set a moderate ask (half of max among clubs)
      const maxes = (n.clubs || []).map(c => c.max || 0);
      const mid = maxes.length ? Math.round(Math.max(...maxes) * 0.9) : Math.round(n.ask);
      const el = document.querySelector('#sell-ask');
      if (el) el.value = String(mid);
      sellSubmitAsk();
      return {
        askSubmitted: mid,
        clubs: (window._sellNego && window._sellNego.clubs || []).map(c => ({ name: c.name, bid: c.bid, max: c.max, status: c.status })),
        msg: window._sellNego && (window._sellNego.msg || '').slice(0, 160),
        round: window._sellNego && window._sellNego.round,
      };
    });
    console.log('SELL_SUBMIT', JSON.stringify(sellStep, null, 2));
    await shot(page, 'market-depth-06-sell-after-ask');

    // Accept first agreed club, else first active/final, else lowball
    const accept = await page.evaluate(() => {
      const n = window._sellNego;
      if (!n) return { ok: false, reason: 'nego closed' };
      const agreed = (n.clubs || []).findIndex(c => c.status === 'agreed');
      const final = (n.clubs || []).findIndex(c => c.status === 'final');
      const active = (n.clubs || []).findIndex(c => c.status === 'active');
      const idx = agreed >= 0 ? agreed : (final >= 0 ? final : (active >= 0 ? active : -1));
      const chosen = idx >= 0 ? n.clubs[idx] : { name: '回收商', bid: n.lowball, max: n.lowball, status: 'lowball' };
      const fundBefore = S.fund;
      const playersBefore = (S.players || []).length;
      sellAcceptClub(idx);
      return {
        idx, chosen,
        fundBefore, fundAfter: S.fund,
        playersBefore, playersAfter: (S.players || []).length,
        sellNegoNull: !window._sellNego,
        modalOpen: document.querySelector('#app-modal').classList.contains('on'),
        eventTail: (S.eventLog || []).slice(-3),
      };
    });
    console.log('SELL_ACCEPT', JSON.stringify(accept, null, 2));
    await page.waitForTimeout(200);
    await shot(page, 'market-depth-07-sell-result');
  }

  // Sell cancel-path: open on remaining player then quit
  const cancelSell = await page.evaluate(() => {
    closeModal('app-modal');
    window._sellNego = null;
    const p = (S.players || [])[0];
    if (!p) return { ok: false };
    const before = (S.players || []).length;
    openSellNego(S, p.id);
    if (!window._sellNego) return { ok: false, reason: 'open failed', players: before };
    const modalBefore = document.querySelector('#app-modal').classList.contains('on');
    sellQuit();
    return {
      ok: true, name: p.name,
      modalBefore,
      modalAfter: document.querySelector('#app-modal').classList.contains('on'),
      _sellNegoAfter: !!window._sellNego,
      playersUnchanged: (S.players || []).length === before,
    };
  });
  console.log('SELL_CANCEL', JSON.stringify(cancelSell, null, 2));
  await shot(page, 'market-depth-08-sell-cancel');

  // Final market page state
  const finalState = await page.evaluate(() => {
    goPage('market');
    return {
      teamName: S.teamName,
      fund: S.fund,
      players: (S.players || []).map(p => ({ name: p.name, pos: p.pos, overall: overall(p) })),
      transferListLen: (S.transferList || []).length,
      freeAgentsLen: (S.freeAgents || []).length,
      marketLen: (S.market || []).length,
      transfers: S.transfers || [],
      windowSold: S.windowSold || 0,
    };
  });
  console.log('FINAL_STATE', JSON.stringify(finalState, null, 2));
  await page.waitForTimeout(300);
  await shot(page, 'market-depth-09-final');

  await browser.close();
  console.log('DONE');
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
