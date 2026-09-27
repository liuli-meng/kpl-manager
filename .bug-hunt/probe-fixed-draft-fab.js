/* 用接近用户截图的状态：大资金/阵容较满 → 选秀能否叫价并点名；FAB 是否仍压底栏 */
const { launch, clearAndStart, shot } = require('../tests/playthrough/pw.js');

(async () => {
  const { browser, page } = await launch({ viewport: { width: 390, height: 844 } });
  try {
    await clearAndStart(page);
    await page.evaluate(() => {
      const nameEl = document.getElementById('new-team-name');
      if (nameEl) nameEl.value = '预算封顶测试';
      createTeam();
      // 接近截图：巨额资金 + 已有 6 人（多数位置已填）
      S.fund = 1315000; // 131.5亿
      // 确保位置都首发，压低 need
      S.lineup = S.players.slice(0, 5).map(p => p.id);
      if (typeof initDraft === 'function') initDraft(S, true);
      try { save(); renderAll(); goPage('market'); } catch (e) {}
    });
    await page.waitForTimeout(300);

    const before = await page.evaluate(() => {
      const d = S.draft;
      const max = typeof draftTeamMaxBid === 'function' ? draftTeamMaxBid(S, S.teamName, d.slot) : null;
      return {
        fund: S.fund,
        roster: S.players.length,
        lineup: S.lineup.length,
        phase: d.phase,
        slot: d.slot,
        bid: d.bid,
        leader: d.leader,
        maxBid: max,
        nextNeed: d.leader ? d.bid + 10 : d.bid,
        hint: (document.getElementById('page-market').innerText || '').split('\n').find(l => /签位预算上限/.test(l)) || null,
      };
    });
    console.log('BEFORE', JSON.stringify(before, null, 2));

    // 叫价
    const bidRes = await page.evaluate(() => {
      const toasts = [];
      const o = window.toast; window.toast = m => { toasts.push(String(m)); try { o(m); } catch (_) {} };
      draftBidRaise();
      window.toast = o;
      return {
        toasts,
        phase: S.draft.phase,
        bid: S.draft.bid,
        leader: S.draft.leader,
        pickPhase: S.draft.phase === 'pick',
      };
    });
    console.log('BID', JSON.stringify(bidRes, null, 2));
    await page.waitForTimeout(150);

    // 若进入点名，点击第一张卡
    const pickRes = await page.evaluate(() => {
      if (S.draft.phase !== 'pick') return { skip: true, phase: S.draft.phase, leader: S.draft.leader, bid: S.draft.bid };
      const wrap = document.querySelector('#page-market [onclick*="draftPick"]');
      if (!wrap) return { ok: false, reason: 'no-wrap' };
      const beforeN = S.players.length;
      wrap.click();
      return {
        ok: true,
        onclick: wrap.getAttribute('onclick'),
        beforeN,
        afterN: S.players.length,
        toast: (document.querySelector('#toast') || {}).textContent,
        pool: S.draft.pool.length,
      };
    });
    console.log('PICK', JSON.stringify(pickRes, null, 2));

    // FAB 重叠
    const hit = await page.evaluate(() => {
      const fab = document.getElementById('page-fab').getBoundingClientRect();
      const nav = document.getElementById('nav').getBoundingClientRect();
      const biz = document.querySelector('#nav button[data-page="biz"]');
      const br = biz.getBoundingClientRect();
      const overlap = (a, b) => {
        const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        return Math.round(x * y);
      };
      const cx = fab.left + fab.width / 2, cy = fab.top + fab.height / 2;
      const el = document.elementFromPoint(cx, cy);
      const bizEl = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2);
      return {
        fab: { y: fab.y, bottom: fab.bottom, h: fab.height },
        nav: { y: nav.y, bottom: nav.bottom },
        biz: { y: br.y, bottom: br.bottom, text: biz.textContent },
        overlapFabBiz: overlap(fab, br),
        fabCenter: el && (el.id || el.className),
        bizCenter: bizEl && ((bizEl.id || '') + ':' + (bizEl.textContent || '').trim().slice(0, 6)),
      };
    });
    console.log('OVERLAP', JSON.stringify(hit, null, 2));
    await shot(page, 'fixed-overlap-draft-mobile');
  } catch (e) {
    console.error('FATAL', e && e.stack || e);
  } finally {
    await browser.close();
  }
})();
