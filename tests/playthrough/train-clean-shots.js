/* Clean screenshots: dismiss tour, capture train sections */
const { launch, clearAndStart, shot } = require('./pw.js');

(async () => {
  const { browser, page } = await launch();
  try {
    await clearAndStart(page);
    await page.evaluate(() => {
      document.querySelector('#new-team-name').value = '练级营';
      createTeam();
      goPage('train');
    });
    await page.waitForTimeout(300);

    // dismiss any tour/modal overlay
    const dismissed = await page.evaluate(() => {
      const results = [];
      // try common dismiss buttons
      const btns = [...document.querySelectorAll('button')];
      const skip = btns.find(b => /跳过|知道了|关闭|×/.test((b.textContent||'').trim()));
      if (skip) { skip.click(); results.push('skip:'+skip.textContent.trim()); }
      // also close app-modal if on
      const m = document.querySelector('#app-modal.on, .modal.on');
      if (m) {
        const x = m.querySelector('.m-close, .modal-close, button');
        if (x) { x.click(); results.push('modal-close'); }
        m.classList.remove('on');
        results.push('modal-removed');
      }
      // guide overlay
      const tour = document.querySelector('#tour, .tour, [class*="tour"]');
      if (tour) { tour.remove(); results.push('tour-removed'); }
      return { dismissed: results, bodyHasTour: /3 步上手|完整引导/.test(document.body.innerText||'') };
    });
    await page.waitForTimeout(200);
    // dismiss again after re-render
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const skip = btns.find(b => /跳过/.test((b.textContent||'').trim()));
      if (skip) skip.click();
      // force hide guide if still present
      document.querySelectorAll('.guide-mask, #guide-mask, .tour-mask').forEach(e => e.remove());
    });
    await page.waitForTimeout(200);

    await shot(page, 'pt_train_20_clean_train_top');

    // scroll to academy
    await page.evaluate(() => {
      const panels = [...document.querySelectorAll('#page-train .panel')];
      if (panels[1]) panels[1].scrollIntoView({ block: 'start' });
      recruitRookie(S);
      trainRookie(S, (S.academy[0]||{}).id);
    });
    await page.waitForTimeout(200);
    await shot(page, 'pt_train_21_clean_academy');

    // scroll to convert
    await page.evaluate(() => {
      const panels = [...document.querySelectorAll('#page-train .panel')];
      if (panels[2]) panels[2].scrollIntoView({ block: 'start' });
    });
    await page.waitForTimeout(200);
    await shot(page, 'pt_train_22_clean_convert');

    // full page shot
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    await page.screenshot({ path: 'E:/sex/gui-test-screenshots/pt_train_23_fullpage.png', fullPage: true });
    console.log('SHOT fullpage');

    // list buttons again on clean page
    const btns = await page.evaluate(() => {
      const root = document.querySelector('#page-train');
      return [...root.querySelectorAll('button')].map(b => ({
        t: (b.textContent||'').trim().replace(/\s+/g,' '),
        d: !!b.disabled,
        o: b.getAttribute('onclick')||'',
      }));
    });
    console.log('BUTTONS', JSON.stringify(btns, null, 2));
  } finally {
    await browser.close();
  }
})();
