// Playtest: 自建经理开局体验
const { launch, clearAndStart, shot, call } = require('./pw.js');

const pages = ['club', 'lineup', 'train', 'league', 'kjia', 'union', 'hall', 'biz'];

(async () => {
  const issues = [];
  const shots = [];
  const { browser, page } = await launch();

  try {
    // 1) Boot + start modal
    await page.waitForTimeout(600);
    shots.push(await shot(page, 'pt_self_boot'));

    const modalHtml1 = await page.evaluate(() => {
      const m = document.getElementById('app-modal') || document.querySelector('.modal');
      return {
        hasModal: !!(m && m.offsetParent !== null) || !!(m && getComputedStyle(m).display !== 'none'),
        title: document.querySelector('#app-modal h2, #app-modal h3, .modal h2, .modal h3')?.innerText || '',
        snippet: (document.getElementById('app-modal')?.innerText || document.body.innerText || '').slice(0, 200),
        hasInput: !!document.getElementById('new-team-name'),
      };
    });
    if (!modalHtml1.hasInput) issues.push('boot: no #new-team-name input on first load');

    // 2) Fresh start
    await clearAndStart(page);
    await page.waitForTimeout(700);
    const afterClear = await page.evaluate(() => ({
      hasInput: !!document.getElementById('new-team-name'),
      lsKeys: Object.keys(localStorage),
      bodyStart: (document.body.innerText || '').slice(0, 180),
    }));
    if (!afterClear.hasInput) issues.push('after clear: no #new-team-name');

    // 3) Create team
    const createResult = await page.evaluate(() => {
      const el = document.getElementById('new-team-name');
      if (!el) return { ok: false, reason: 'no input' };
      el.value = '雷霆战队';
      if (typeof createTeam !== 'function') return { ok: false, reason: 'no createTeam' };
      try {
        createTeam();
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: String(e && e.message || e) };
      }
    });
    if (!createResult.ok) issues.push('createTeam failed: ' + createResult.reason);

    await page.waitForTimeout(600);
    shots.push(await shot(page, 'pt_self_market'));

    // 5) Read state
    const state = await page.evaluate(() => {
      const S = window.S;
      if (!S) return { ok: false, reason: 'no S' };
      return {
        ok: true,
        teamName: S.teamName,
        fund: S.fund,
        wageCap: S.wageCap,
        players: (S.players || []).map(p => p.name + '/' + p.pos),
        playerCount: (S.players || []).length,
        preseason: S.preseason,
        transferWindow: S.transferWindow,
        marketCount: (S.market || []).length,
        freeAgents: (S.freeAgents || []).map(p => p.name + '/' + p.pos + '/' + (p.ova ?? p.overall ?? '')),
        transferList: (S.transferList || []).length,
        mode: S.mode,
        day: S.day,
        season: S.season,
      };
    });
    if (!state.ok) issues.push('state read failed: ' + state.reason);
    if (state.ok && state.playerCount === 0) issues.push('created team has 0 players');
    if (state.ok && !state.transferWindow) issues.push('transferWindow not open after create');
    if (state.ok && state.teamName !== '雷霆战队') issues.push('teamName mismatch: ' + state.teamName);

    // 6) Navigate all pages
    const pageInfo = {};
    for (const p of pages) {
      const r = await page.evaluate((name) => {
        try {
          if (typeof goPage !== 'function') return { ok: false, reason: 'no goPage' };
          goPage(name);
          const el = document.getElementById('page-' + name) || document.querySelector(`[data-page="${name}"]`);
          // nav section
          const section = document.getElementById('page-' + name);
          const text = (section && section.innerText) || '';
          const htmlLen = (section && section.innerHTML) || '';
          // overflow check
          const overflowX = section ? section.scrollWidth > section.clientWidth + 8 : false;
          const navVisible = (() => {
            const btn = document.querySelector(`nav button[data-page="${name}"]`);
            return btn ? getComputedStyle(btn).display !== 'none' && btn.offsetParent !== null : false;
          })();
          return {
            ok: true,
            textLen: text.trim().length,
            htmlLen: htmlLen.length,
            preview: text.trim().slice(0, 120),
            hasChinese: /[\u4e00-\u9fff]/.test(text),
            overflowX,
            navVisible,
            pageDisplay: section ? getComputedStyle(section).display : 'missing',
          };
        } catch (e) {
          return { ok: false, reason: String(e && e.message || e) };
        }
      }, p);

      await page.waitForTimeout(250);
      shots.push(await shot(page, 'pt_self_' + p));
      pageInfo[p] = r;

      if (!r.ok) {
        issues.push(`page ${p}: nav fail ${r.reason}`);
      } else {
        if (r.textLen <= 50) issues.push(`page ${p}: empty content textLen=${r.textLen}`);
        if (!r.hasChinese) issues.push(`page ${p}: no Chinese text`);
        if (r.overflowX) issues.push(`page ${p}: horizontal overflow`);
        if (!r.navVisible) issues.push(`page ${p}: nav button not visible`);
        if (r.pageDisplay === 'none' || r.pageDisplay === 'missing') issues.push(`page ${p}: section display=${r.pageDisplay}`);
      }
    }

    // 7) Market action
    // Ensure on market page
    await page.evaluate(() => { if (typeof goPage === 'function') goPage('market'); });
    await page.waitForTimeout(300);

    const marketButtons = await page.evaluate(() => {
      const section = document.getElementById('page-market');
      if (!section) return [];
      return Array.from(section.querySelectorAll('button')).map(b => ({
        text: (b.innerText || '').trim().slice(0, 60),
        onclick: b.getAttribute('onclick') || '',
      }));
    });

    const marketAction = await page.evaluate(() => {
      const S = window.S;
      if (!S) return { ok: false, reason: 'no S' };
      const beforeCount = (S.players || []).length;
      const beforeFund = S.fund;

      // Prefer free agent via signFreeAgent
      if (typeof signFreeAgent === 'function' && S.freeAgents && S.freeAgents.length) {
        const fa = S.freeAgents[0];
        try {
          signFreeAgent(S, fa.id);
          return {
            ok: true,
            method: 'signFreeAgent',
            signed: fa.name + '/' + fa.pos,
            beforeCount,
            afterCount: (S.players || []).length,
            beforeFund,
            afterFund: S.fund,
            freeAgentsLeft: (S.freeAgents || []).length,
          };
        } catch (e) {
          return { ok: false, reason: 'signFreeAgent: ' + (e && e.message || e), method: 'signFreeAgent' };
        }
      }

      // Try buyPlayer on first market player
      if (typeof buyPlayer === 'function' && S.market && S.market.length) {
        const mp = S.market[0];
        try {
          buyPlayer(S, mp);
          return {
            ok: true,
            method: 'buyPlayer',
            signed: mp.name + '/' + mp.pos,
            beforeCount,
            afterCount: (S.players || []).length,
            beforeFund,
            afterFund: S.fund,
            marketLeft: (S.market || []).length,
          };
        } catch (e) {
          return { ok: false, reason: 'buyPlayer: ' + (e && e.message || e), method: 'buyPlayer' };
        }
      }

      // Try open negotiation on first transferList
      if (typeof openNego === 'function' && S.transferList && S.transferList.length) {
        try {
          openNego(S, S.transferList[0].id);
          return { ok: true, method: 'openNego', opened: S.transferList[0].name };
        } catch (e) {
          return { ok: false, reason: 'openNego: ' + (e && e.message || e), method: 'openNego' };
        }
      }

      return {
        ok: false,
        reason: 'no freeAgents/market/signFreeAgent/buyPlayer',
        hasFA: !!(S.freeAgents && S.freeAgents.length),
        hasMarket: !!(S.market && S.market.length),
        hasTL: !!(S.transferList && S.transferList.length),
      };
    });

    await page.waitForTimeout(400);
    shots.push(await shot(page, 'pt_self_market_after_buy'));
    const afterBuyState = await page.evaluate(() => ({
      players: (window.S?.players || []).map(p => p.name + '/' + p.pos),
      fund: window.S?.fund,
      freeAgents: (window.S?.freeAgents || []).length,
      market: (window.S?.market || []).length,
    }));

    // Capture any toasts
    const toast = await page.evaluate(() => {
      const t = document.querySelector('.toast, #toast, [class*="toast"]');
      return t ? (t.innerText || '').trim() : '';
    });

    // Collect results
    const result = {
      issues,
      modalHtml1,
      afterClear,
      createResult,
      state,
      pageInfo,
      marketButtons: marketButtons.slice(0, 25),
      marketButtonCount: marketButtons.length,
      marketAction,
      afterBuyState,
      toast,
      shots,
    };

    console.log('===PLAYTEST_RESULT===');
    console.log(JSON.stringify(result, null, 2));
    console.log('===END===');
  } catch (e) {
    console.error('[fatal]', e);
    issues.push('fatal: ' + (e && e.message || e));
    console.log('===PLAYTEST_RESULT===');
    console.log(JSON.stringify({ issues, shots }, null, 2));
  } finally {
    await browser.close();
  }
})();
