// 浏览器实测：转会期市场刷新的「今日首刷免费」在真实 DOM 上成立
// 看三件事：按钮文案随额度切换、首刷不扣钱、二刷扣 5 万且 toast 报出扣费
// Run: node tests/playthrough/probe-market-refresh-free.js
const { launch, clearAndStart, shot } = require('./pw.js');

(async () => {
  const { browser, page } = await launch();
  await clearAndStart(page);
  await page.evaluate(() => {
    installEra(null);
    S = newState('刷新队', '⚔️');
    POS_ORDER.forEach(pos => S.players.push(genPlayer(genFreeAgentDef(pos, 'mid', new Set()))));
    S.lineup = S.players.map(p => p.id);
    S.coach = { ...COACH_POOL.find(c => c.id === 'co12') };
    S.seedPower = 400; initGroups(S);
    S.preseason = true; S.transferWindow = 7; S.fund = 1300;
    buildTransferMarket(S);
    refreshMarket(S, { seed: true });   // 模拟开局建队时的那次内部播种
    closeModal('start-modal');         // 真实开局由 createTeam 关掉，这里手动收
    renderAll(); goPage('market');
  });
  const btn = () => page.evaluate(() => {
    const b = [...document.querySelectorAll('#page-market button')].find(x => /刷新市场/.test(x.textContent));
    const tag = document.querySelector('#page-market .panel[data-fold="mmarket"] h3 .tag');
    return { label: b ? b.textContent.trim() : null, tag: tag ? tag.textContent.trim() : null, fund: S.fund, refreshed: !!S.marketRefreshed };
  });
  const r = { afterSeed: await btn() };
  await page.click('#page-market .panel[data-fold="mmarket"] button.btn.mt12');
  await page.waitForTimeout(350);
  r.firstClick = await btn();
  r.firstToast = await page.evaluate(() => (document.querySelector('.toast') || {}).textContent);
  await page.click('#page-market .panel[data-fold="mmarket"] button.btn.mt12');
  await page.waitForTimeout(350);
  r.secondClick = await btn();
  r.secondToast = await page.evaluate(() => (document.querySelector('.toast') || {}).textContent);
  await shot(page, 'market-refresh-free');
  await browser.close();

  console.log(JSON.stringify(r, null, 1));
  const fails = [];
  if (!/今日免费/.test(r.afterSeed.label || '')) fails.push('开局播种后按钮没写「今日免费」: ' + r.afterSeed.label);
  if (r.afterSeed.refreshed) fails.push('播种把当日免费额度吃掉了');
  if (r.firstClick.fund !== 1300) fails.push('首刷扣了钱: ' + r.firstClick.fund);
  if (!/免费/.test(r.firstToast || '')) fails.push('首刷 toast 没说明免费: ' + r.firstToast);
  if (r.secondClick.fund !== 1295) fails.push('二刷未扣 5 万: ' + r.secondClick.fund);
  if (!/（5万）/.test(r.secondClick.label || '')) fails.push('二刷后按钮仍写免费: ' + r.secondClick.label);
  if (!/5万/.test(r.secondToast || '')) fails.push('二刷 toast 没报扣费: ' + r.secondToast);
  console.log(fails.length ? '[FAIL] ' + fails.join(' ; ') : '[PASS] 转会期首刷免费 / 二刷扣费 / 文案与 toast 同口径');
  if (fails.length) process.exitCode = 1;
})();
