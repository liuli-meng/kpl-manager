// Supplement: club-page board panel screenshot for debt playtest
const { launch, clearAndStart, shot } = require('./pw');

(async () => {
  const { browser, page } = await launch();
  try {
    await clearAndStart(page);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      pickScenario('debt');
      document.getElementById('new-team-name').value = '破产边缘';
      createTeam();
      // dismiss guide if any
      try {
        const skip = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('跳过'));
        if (skip) skip.click();
      } catch (e) {}
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => { try { closeModal('app-modal'); } catch (e) {} goPage('club'); });
    await page.waitForTimeout(400);
    const board = await page.evaluate(() => {
      const panel = Array.from(document.querySelectorAll('#page-club h3')).map(h => h.textContent.trim());
      const boardText = (document.querySelector('#page-club') || {}).innerText || '';
      return {
        headings: panel,
        boardSnippet: boardText.slice(0, 900),
        fund: S.fund,
        wageCap: S.wageCap,
        weeklyWage: weeklyWage(S),
        trust: S.board.trust,
        kpi: S.board.kpi,
      };
    });
    console.log(JSON.stringify(board, null, 2));
    await shot(page, 'debt-04-club-board');
  } finally {
    await browser.close();
  }
})();
