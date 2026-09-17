// Playtest: 财政危机 (debt) scenario flow
// Run: node tests/playthrough/debt-playtest.js
const { launch, clearAndStart, shot, call } = require('./pw');

(async () => {
  const report = [];
  const log = (s) => { console.log(s); report.push(s); };
  const ok = (s) => log('[PASS] ' + s);
  const warn = (s) => log('[WARN] ' + s);
  const fail = (s) => log('[FAIL] ' + s);

  let browser, page;
  try {
    ({ browser, page } = await launch());
    log('=== 财政危机剧本 playtest ===');
    log('URL: http://127.0.0.1:8931/game.html');

    // ---- Step 1: clear + reload start modal ----
    await clearAndStart(page);
    await page.waitForTimeout(600);
    const startVisible = await page.evaluate(() => {
      const m = document.getElementById('start-modal');
      return !!(m && m.classList.contains('on'));
    });
    if (startVisible) ok('① 清档重载：开局弹窗可见');
    else fail('① 开局弹窗未出现');

    const scenBtns = await page.evaluate(() => {
      return ['normal','debt','exodus','cap','cursed'].map(id => ({
        id,
        exists: !!document.getElementById('sc-btn-' + id),
      }));
    });
    log('   剧本按钮: ' + JSON.stringify(scenBtns));

    // ---- Step 2: pickScenario('debt') + name + createTeam ----
    const pickResult = await page.evaluate(() => {
      pickScenario('debt');
      const btn = document.getElementById('sc-btn-debt');
      const desc = document.getElementById('sc-desc');
      return {
        _scenario: typeof _scenario !== 'undefined' ? _scenario : null,
        btnClass: btn ? btn.className : null,
        desc: desc ? desc.textContent : null,
      };
    });
    log('   pickScenario(debt): ' + JSON.stringify(pickResult));

    await page.evaluate(() => {
      document.getElementById('new-team-name').value = '破产边缘';
      createTeam();
    });
    await page.waitForTimeout(800);

    // ---- Step 3: Verify scenario + fund + wageCap ----
    const snap = await page.evaluate(() => {
      return {
        scenario: S.scenario,
        fund: S.fund,
        wageCap: S.wageCap,
        weeklyWage: typeof weeklyWage === 'function' ? weeklyWage(S) : null,
        teamName: S.teamName,
        players: S.players.length,
        lineup: S.lineup.length,
        preseason: S.preseason,
        transferWindow: S.transferWindow,
        sponsorLv: S.sponsorLv,
        board: S.board ? { trust: S.board.trust, kpi: S.board.kpi } : null,
        seedPower: S.seedPower,
        fans: S.fans,
        startModalOn: !!document.getElementById('start-modal')?.classList.contains('on'),
        marketLen: (S.transferList || []).length,
        freeAgents: (S.freeAgents || []).length,
        eventLogTail: (S.eventLog || []).slice(-6).map(e => e.txt),
      };
    });
    log('③ 开局状态: ' + JSON.stringify(snap, null, 2));

    if (snap.scenario === 'debt') ok('③ S.scenario === debt');
    else fail('③ S.scenario 应为 debt，实际 ' + snap.scenario);

    if (snap.fund === 330) ok('③ 资金 330（正确，非默认 1300）');
    else if (snap.fund === 1300) fail('③ 资金仍是默认 1300，debt 剧本未生效');
    else if (Math.abs(snap.fund - 330) <= 5) ok('③ 资金 ≈330（实际 ' + snap.fund + '）');
    else fail('③ 资金异常: ' + snap.fund + '（期望 ≈330）');

    if (snap.wageCap === 120) ok('③ 工资帽 120（正确，非默认 150）');
    else fail('③ 工资帽应为 120，实际 ' + snap.wageCap);

    if (snap.teamName === '破产边缘') ok('③ 队名「破产边缘」写入');
    else fail('③ 队名错误: ' + snap.teamName);

    if (!snap.startModalOn) ok('③ 创建后开局弹窗已关闭');
    else warn('③ 开局弹窗仍打开');

    // 检查是否开局即超帽
    if (snap.weeklyWage != null && snap.wageCap != null) {
      if (snap.weeklyWage > snap.wageCap)
        warn('③ 开局即超帽: 周薪 ' + snap.weeklyWage + ' > 帽 ' + snap.wageCap
          + '（超 ' + (snap.weeklyWage - snap.wageCap) + '，发薪日将缴 60% 奢侈税）');
      else
        ok('③ 帽内: 周薪 ' + snap.weeklyWage + ' / 帽 ' + snap.wageCap);
    }

    // ---- Step 4: Screenshot market; read fund/wageCap ----
    const pageName = await page.evaluate(() => {
      // which page is currently active?
      const active = document.querySelector('.page.on, .page.active, [data-page].on, #page-market.on');
      return {
        bodyClass: document.body.className,
        pages: Array.from(document.querySelectorAll('.page')).map(p => ({
          id: p.id, cls: p.className,
        })).slice(0, 15),
        curPage: typeof curPageName !== 'undefined' ? curPageName
          : (typeof _page !== 'undefined' ? _page : null),
      };
    });
    log('   当前页面: ' + JSON.stringify(pageName));
    await shot(page, 'debt-01-market-after-create');
    const fundOnUI = await page.evaluate(() => {
      const fundEl = document.querySelector('[data-num="fund"]');
      const wageEl = document.querySelector('.stat small');
      // also grab top fund display
      const stats = Array.from(document.querySelectorAll('.stat')).map(s => s.textContent.trim());
      return {
        fundText: fundEl ? fundEl.textContent : null,
        stats,
      };
    });
    log('   顶栏 KPI: ' + JSON.stringify(fundOnUI));

    // ---- Step 5: Try a purchase that should fail if fund low ----
    // Find a high-fee market player and try to open negotiation + submit an over-budget fee
    const purchaseProbe = await page.evaluate(() => {
      const s = S;
      const list = s.transferList || [];
      const fas = s.freeAgents || [];
      // Prefer a paid transfer (not free agent) with high fee
      const paid = list.filter(p => !p.freeAgent);
      const sorted = paid.slice().sort((a, b) => (valueOf(overall(b)) || 0) - (valueOf(overall(a)) || 0));
      const target = sorted[0] || list[0] || fas[0];
      if (!target) return { error: '转会市场为空' };
      const val = typeof valueOf === 'function' ? valueOf(overall(target)) : null;
      return {
        pid: target.id,
        name: target.name,
        pos: target.pos,
        overall: overall(target),
        freeAgent: !!target.freeAgent,
        wage: target.wage,
        value: val,
        askFeeGuess: val, // rough
        fundBefore: s.fund,
      };
    });
    log('⑤ 试探购买目标: ' + JSON.stringify(purchaseProbe));

    if (purchaseProbe.error) {
      warn('⑤ 转会市场为空，跳过购买试探');
    } else {
      // Open negotiation
      await page.evaluate((pid) => {
        openNegotiation(S, pid);
      }, purchaseProbe.pid);
      await page.waitForTimeout(300);
      const negoOpen = await page.evaluate(() => {
        const m = document.getElementById('app-modal');
        const body = document.getElementById('app-modal-body');
        return {
          modalOn: !!(m && m.classList.contains('on')),
          hasNego: !!window._nego,
          askFee: window._nego ? window._nego.askFee : null,
          askWage: window._nego ? window._nego.askWage : null,
          freeAgent: window._nego ? window._nego.freeAgent : null,
          bodySnippet: body ? body.textContent.slice(0, 200) : null,
        };
      });
      log('   谈判弹窗: ' + JSON.stringify(negoOpen));

      // Set fee higher than fund to force 资金不足
      const submitResult = await page.evaluate(() => {
        if (!window._nego) return { error: '无谈判对象' };
        const n = window._nego;
        // Force a fee way above current fund
        const feeInput = document.getElementById('nego-fee');
        const wageInput = document.getElementById('nego-wage');
        if (feeInput) feeInput.value = String(99999);
        if (wageInput) wageInput.value = String(n.askWage || 50);
        const fundBefore = S.fund;
        negoSubmit();
        // capture nego msg / toast
        const msgEl = document.querySelector('#app-modal-body .event-card');
        const toastEl = document.getElementById('toast');
        return {
          fundBefore,
          fundAfter: S.fund,
          stillNego: !!window._nego,
          negoMsg: msgEl ? msgEl.textContent.trim() : null,
          toast: toastEl ? toastEl.textContent.trim() : null,
          modalStillOn: !!document.getElementById('app-modal')?.classList.contains('on'),
        };
      });
      log('⑤ 高报价试探结果: ' + JSON.stringify(submitResult, null, 2));

      if (submitResult.negoMsg && /资金不足/.test(submitResult.negoMsg))
        ok('⑤ 资金不足拦截生效（谈判内提示）: ' + submitResult.negoMsg);
      else if (submitResult.toast && /资金不足/.test(submitResult.toast))
        ok('⑤ 资金不足拦截生效（toast）: ' + submitResult.toast);
      else if (submitResult.fundAfter === submitResult.fundBefore && submitResult.stillNego)
        ok('⑤ 高报价未扣款且谈判未完成（应被拦）');
      else if (submitResult.fundAfter !== submitResult.fundBefore)
        fail('⑤ 高报价却扣款了: ' + submitResult.fundBefore + '→' + submitResult.fundAfter);
      else
        warn('⑤ 资金不足提示不明确: ' + JSON.stringify(submitResult));

      // Also try refresh market which costs 50 if available, or a free agent sign
      const faProbe = await page.evaluate(() => {
        const s = S;
        const fas = s.freeAgents || [];
        if (!fas.length) return { skip: '无自由球员' };
        const fa = fas[0];
        const fundBefore = s.fund;
        // free agent sign fee is 0, but wage still matters; this should NOT fail on fund
        try {
          openNegotiation(s, fa.id);
        } catch (e) {
          return { err: e.message };
        }
        const feeInput = document.getElementById('nego-fee');
        const wageInput = document.getElementById('nego-wage');
        if (feeInput) feeInput.value = '0';
        if (wageInput) wageInput.value = String(window._nego ? window._nego.askWage : 10);
        try { negoSubmit(); } catch (e) { return { err: e.message, fundBefore }; }
        return {
          fundBefore,
          fundAfter: s.fund,
          toast: (document.getElementById('toast') || {}).textContent,
          stillNego: !!window._nego,
          modalOn: !!document.getElementById('app-modal')?.classList.contains('on'),
        };
      });
      log('⑤ 自由球员对照: ' + JSON.stringify(faProbe));

      // Also try a direct toast-path: refreshMarket if it costs 50 and fund is low-ish
      const refreshProbe = await page.evaluate(() => {
        const before = S.fund;
        try {
          // refreshMarket may be free in preseason
          if (typeof refreshMarket === 'function') refreshMarket(S);
        } catch (e) {
          return { err: e.message, before };
        }
        return { before, after: S.fund, toast: (document.getElementById('toast') || {}).textContent };
      });
      log('⑤ 刷新市场: ' + JSON.stringify(refreshProbe));

      // Force a clear "资金不足" toast via a known path if still no toast
      const forceToast = await page.evaluate(() => {
        // Temporarily zero fund and try refresh or renew
        const f0 = S.fund;
        S.fund = 0;
        let msg = null;
        try {
          if (typeof refreshMarket === 'function') refreshMarket(S);
        } catch (e) { msg = e.message; }
        const t = (document.getElementById('toast') || {}).textContent;
        S.fund = f0; // restore
        return { f0, restored: S.fund, toast: t, err: msg };
      });
      log('⑤ fund=0 试探刷新: ' + JSON.stringify(forceToast));
      if (forceToast.toast && /资金不足/.test(forceToast.toast))
        ok('⑤ fund=0 时刷新弹出「资金不足」toast');
      else
        warn('⑤ fund=0 刷新 toast=' + JSON.stringify(forceToast.toast));

      await shot(page, 'debt-02-after-purchase-probe');
    }

    // ---- Step 6: goPage('biz') screenshot board KPI ----
    await page.evaluate(() => {
      // close any modal
      try { closeModal('app-modal'); } catch (e) {}
      goPage('biz');
    });
    await page.waitForTimeout(500);
    const bizSnap = await page.evaluate(() => {
      const s = S;
      return {
        page: typeof curPageName !== 'undefined' ? curPageName : null,
        fund: s.fund,
        wageCap: s.wageCap,
        weeklyWage: typeof weeklyWage === 'function' ? weeklyWage(s) : null,
        board: s.board,
        sponsorLv: s.sponsorLv,
        fans: s.fans,
        // try to extract visible KPI text
        bodyText: (document.body.innerText || '').slice(0, 800),
      };
    });
    log('⑥ biz 页: ' + JSON.stringify(bizSnap, null, 2));
    await shot(page, 'debt-03-biz-board-kpi');

    // Final fund/wageCap re-check
    const final = await page.evaluate(() => ({
      scenario: S.scenario,
      fund: S.fund,
      wageCap: S.wageCap,
      weeklyWage: weeklyWage(S),
      trust: S.board.trust,
      kpi: S.board.kpi,
    }));
    log('⑦ 终态: ' + JSON.stringify(final));

    // Summary
    log('');
    log('=== SUMMARY ===');
    log('scenario=' + final.scenario + ' fund=' + final.fund + ' wageCap=' + final.wageCap
      + ' weeklyWage=' + final.weeklyWage + ' trust=' + final.trust);
    const passes = report.filter(r => r.startsWith('[PASS]')).length;
    const fails = report.filter(r => r.startsWith('[FAIL]')).length;
    const warns = report.filter(r => r.startsWith('[WARN]')).length;
    log('RESULT: ' + passes + ' pass / ' + fails + ' fail / ' + warns + ' warn');

  } catch (e) {
    console.error('PLAYTEST ERROR', e);
    log('[FAIL] 脚本异常: ' + e.message);
  } finally {
    if (browser) await browser.close();
    // dump report
    require('fs').writeFileSync(
      'E:/sex/gui-test-screenshots/debt-playtest-report.txt',
      report.join('\n'),
      'utf8'
    );
    console.log('\nReport written to E:/sex/gui-test-screenshots/debt-playtest-report.txt');
  }
})();
