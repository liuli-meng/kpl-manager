// Clean re-shoot after dismissing tour modal
const { launch, shot } = require('./pw');

(async () => {
  const { browser, page } = await launch();
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // create team
  await page.evaluate(() => {
    document.querySelector('#new-team-name').value = '二队总管';
    createTeam();
  });
  await page.waitForTimeout(300);

  // dismiss tour modal if present
  const dismissed = await page.evaluate(() => {
    // tour may open via maybeStartTour; try skip buttons / close
    const clicks = [];
    document.querySelectorAll('#app-modal, .modal, [id*=tour], [class*=tour]').forEach(el => {
      clicks.push({ id: el.id, cls: el.className, on: el.classList.contains('on') });
    });
    // common close patterns
    const skip = [...document.querySelectorAll('button')].find(b => /跳过|关闭|知道了/.test(b.textContent||''));
    if (skip) { skip.click(); return { method: 'skip-btn', text: skip.textContent.trim(), clicks }; }
    // kill tour state
    if (typeof _tour !== 'undefined' && _tour) { _tour.on = false; }
    try { localStorage.setItem('km_tour', '1'); } catch (e) {}
    const modal = document.querySelector('#start-modal');
    if (modal) modal.classList.remove('on');
    // also hide any .modal.on overlays
    document.querySelectorAll('.modal.on, #app-modal.on').forEach(m => m.classList.remove('on'));
    return { method: 'force', clicks };
  });
  console.log('DISMISS', JSON.stringify(dismissed));
  await page.waitForTimeout(200);

  // go kjia, re-init tour guard
  await page.evaluate(() => {
    try { localStorage.setItem('km_tour', '1'); } catch (e) {}
    goPage('kjia');
    // kill tour again after goPage may restart it
    document.querySelectorAll('button').forEach(b => { if ((b.textContent||'').includes('跳过')) b.click(); });
    document.querySelectorAll('.modal.on, #app-modal.on').forEach(m => m.classList.remove('on'));
    if (typeof _tour !== 'undefined' && _tour) _tour.on = false;
  });
  await page.waitForTimeout(250);
  await shot(page, 'kjia-clean-initial');

  // send a player
  await page.evaluate(() => {
    const p = S.players[S.players.length - 1];
    sendKjia(p.id);
    goPage('kjia');
    document.querySelectorAll('.modal.on, #app-modal.on').forEach(m => m.classList.remove('on'));
  });
  await page.waitForTimeout(200);
  await shot(page, 'kjia-clean-after-send');

  // advance 16 days
  await page.evaluate(() => {
    for (let i = 0; i < 16; i++) nextDay(S);
    goPage('kjia');
    document.querySelectorAll('.modal.on, #app-modal.on').forEach(m => m.classList.remove('on'));
  });
  await page.waitForTimeout(200);
  await shot(page, 'kjia-clean-after-advance');

  // also lineup page to see demoted player chip
  await page.evaluate(() => {
    goPage('lineup');
    document.querySelectorAll('.modal.on, #app-modal.on').forEach(m => m.classList.remove('on'));
  });
  await page.waitForTimeout(200);
  await shot(page, 'kjia-clean-lineup');

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
