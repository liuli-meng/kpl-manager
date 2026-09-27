/* 竞拍热度：固定 draft order 位置后，AI 自动叫价到玩家轮时的「未放弃」队数
 * 说明：initDraft 会重算 order，故夹具在 initDraft 之后重写 order 再跑 draftAiAuction
 */
const { launch, clearAndStart } = require('../tests/playthrough/pw.js');

async function boot(page, name) {
  await clearAndStart(page);
  await page.evaluate(() => {
    document.querySelectorAll('.modal-bg.on').forEach(el => {
      if (el.id !== 'start-modal') el.classList.remove('on');
    });
    try { if (typeof ModalStack !== 'undefined' && ModalStack && ModalStack.clear) ModalStack.clear(); } catch (e) {}
  });
  await page.locator('#tab-self').click({ timeout: 5000 });
  await page.waitForTimeout(100);
  await page.locator('#new-team-name').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('#new-team-name').fill(name);
  await page.locator('button:has-text("创建战队")').first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
}

(async () => {
  const { browser, page } = await launch({ viewport: { width: 390, height: 844 } });
  const rows = [];

  for (const forceIdx of [0, 5, 10, 14, 17]) {
    await boot(page, '热度' + forceIdx);
    const snap = await page.evaluate((idx) => {
      if (!S.draft) initDraft(S, true);
      const d = S.draft;
      const my = S.teamName;
      const others = (d.order || draftOrder(S)).filter(t => t !== my);
      const arr = [...others];
      const pos = Math.max(0, Math.min(idx, arr.length));
      arr.splice(pos, 0, my);

      // 重开第 1 签竞拍，并把玩家放到指定顺位
      d.order = arr;
      d.phase = 'auction';
      d.slot = 0;
      d.bid = draftSlotPrice(0);
      d.leader = null;
      d.passed = {};
      d.picks = [];
      d.done = false;
      d.aiFund = {};
      d.log = [];

      // AI 轮转叫价直到轮到玩家或签位落定
      draftAiAuction(S);

      const alive = d.order.filter(t => !d.passed[t] && draftStillWant(S, t));
      return {
        orderIdx: d.order.indexOf(my),
        orderLen: d.order.length,
        alive: alive.length,
        passedN: Object.keys(d.passed).length,
        passed: Object.keys(d.passed),
        bid: d.bid,
        leader: d.leader,
        phase: d.phase,
        log: (d.log || []).slice(-12),
      };
    }, forceIdx);
    rows.push({ forceIdx, ...snap });
    console.log(JSON.stringify({ forceIdx, ...snap }));
  }

  // 用真实 UI 验证「晚顺位过冷」：强制 order 末位后 render，读页面「未放弃」
  await boot(page, '过冷实测');
  const ui = await page.evaluate(() => {
    if (!S.draft) initDraft(S, true);
    const d = S.draft;
    const my = S.teamName;
    const others = (d.order || draftOrder(S)).filter(t => t !== my);
    // 玩家放最后
    const arr = [...others, my];
    d.order = arr;
    d.phase = 'auction';
    d.slot = 0;
    d.bid = draftSlotPrice(0);
    d.leader = null;
    d.passed = {};
    d.done = false;
    d.aiFund = {};
    d.log = [];
    draftAiAuction(S);
    goPage('market');
    renderAll();
    const text = (document.getElementById('page-market') || {}).innerText || '';
    const m = /未放弃\s*(\d+)\s*队/.exec(text);
    const btn = [...document.querySelectorAll('#page-market button')].find(b => (b.getAttribute('onclick') || '').includes('draftBidRaise'));
    return {
      orderIdx: d.order.indexOf(my),
      uiAlive: m ? Number(m[1]) : null,
      bid: d.bid,
      leader: d.leader,
      passedN: Object.keys(d.passed).length,
      hasBid: !!btn,
      bidDisabled: btn ? btn.disabled : null,
      bidLabel: btn ? btn.textContent.trim() : null,
      log: (d.log || []).slice(-10),
    };
  });
  console.log('UI_LAST', JSON.stringify(ui, null, 2));

  // 真实点击叫价 1 次，看未放弃是否仍为 1~2
  if (ui.hasBid && !ui.bidDisabled) {
    await page.locator('#page-market button[onclick*="draftBidRaise"]').first().click({ timeout: 3000 });
    await page.waitForTimeout(100);
    const after = await page.evaluate(() => {
      const text = (document.getElementById('page-market') || {}).innerText || '';
      const m = /未放弃\s*(\d+)\s*队/.exec(text);
      return {
        uiAlive: m ? Number(m[1]) : null,
        bid: S.draft.bid,
        leader: S.draft.leader,
        phase: S.draft.phase,
        passedN: Object.keys(S.draft.passed).length,
      };
    });
    console.log('UI_AFTER_RAISE', JSON.stringify(after, null, 2));
    rows.push({ tag: 'ui-last-order', before: ui, after });
  }

  console.log('SUMMARY', JSON.stringify(rows.map(r => ({
    forceIdx: r.forceIdx, orderIdx: r.orderIdx, alive: r.alive, passedN: r.passedN, bid: r.bid, leader: r.leader,
  })), null, 2));

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
