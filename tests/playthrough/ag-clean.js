// Cleaner AG pass: dismiss tour, capture club preseason controls, then skip+match
const { launch, clearAndStart, shot } = require('./pw.js');

(async () => {
  const errors = [];
  const { browser, page } = await launch();
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('[console.error] ' + msg.text());
  });
  page.on('dialog', async (d) => {
    console.log('[dialog]', d.type(), d.message().slice(0, 100));
    await d.accept();
  });

  try {
    await clearAndStart(page);
    await page.waitForTimeout(500);

    // start as AG
    await page.evaluate(() => {
      switchStartTab('club');
      pickClub(0);
      applyClub();
    });
    await page.waitForTimeout(400);

    // dismiss tour if open
    const dismissed = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const skip = btns.find((b) => b.textContent.trim() === '跳过' && b.closest('.modal-bg, .modal, [id*=tour], [class*=tour]'));
      const anySkip = btns.find((b) => b.textContent.trim() === '跳过' && b.offsetParent);
      if (skip) { skip.click(); return 'skip'; }
      if (anySkip) { anySkip.click(); return 'any-skip'; }
      // also try closing any open modal
      const open = Array.from(document.querySelectorAll('.modal-bg.on, #app-modal.on, #start-modal.on'));
      return 'no-skip open=' + open.map(m=>m.id).join(',');
    });
    console.log('DISMISS_TOUR', dismissed);
    await page.waitForTimeout(300);

    // verify tour closed
    const tourState = await page.evaluate(() => {
      const openModals = Array.from(document.querySelectorAll('.modal-bg.on, #app-modal.on'))
        .map((m) => m.id);
      return { openModals, tourOn: !!(window._tour && window._tour.on) };
    });
    console.log('TOUR_STATE', JSON.stringify(tourState));

    // market clean shot
    await page.evaluate(() => goPage('market'));
    await page.waitForTimeout(300);
    await shot(page, 'ag-c01-market');

    // lineup clean
    await page.evaluate(() => goPage('lineup'));
    await page.waitForTimeout(300);
    await shot(page, 'ag-c02-lineup');

    // club during preseason — should show skip/end buttons
    await page.evaluate(() => goPage('club'));
    await page.waitForTimeout(300);
    await shot(page, 'ag-c03-club-preseason');

    const clubPre = await page.evaluate(() => {
      const pageClub = document.getElementById('page-club');
      const btns = Array.from(pageClub.querySelectorAll('button')).map((b) =>
        b.textContent.trim().replace(/\s+/g, ' ').slice(0, 50)
      );
      const text = pageClub.innerText.replace(/\n+/g, ' | ').slice(0, 600);
      return { btns, text, preseason: S.preseason, tw: S.transferWindow };
    });
    console.log('CLUB_PRE', JSON.stringify(clubPre, null, 2));

    // league clean
    await page.evaluate(() => goPage('league'));
    await page.waitForTimeout(300);
    await shot(page, 'ag-c04-league');

    // skip via UI button on club page
    await page.evaluate(() => goPage('club'));
    await page.waitForTimeout(200);
    const clickSkip = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('#page-club button')).find((b) =>
        b.textContent.includes('跳过剩余')
      );
      if (!btn) return { found: false };
      btn.click();
      return { found: true, label: btn.textContent.trim() };
    });
    console.log('CLICK_SKIP', JSON.stringify(clickSkip));
    await page.waitForTimeout(900);

    const afterSkip = await page.evaluate(() => ({
      preseason: S.preseason,
      tw: S.transferWindow,
      fund: S.fund,
      day: S.day,
      matchIdx: S.matchIdx,
    }));
    console.log('AFTER_SKIP', JSON.stringify(afterSkip));
    await shot(page, 'ag-c05-club-after-skip');

    // start match via UI button
    const startBtn = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('#page-club button')).find((b) =>
        b.textContent.includes('赛前准备')
      );
      if (!btn) return { found: false };
      btn.click();
      return { found: true, label: btn.textContent.trim() };
    });
    console.log('START_BTN', JSON.stringify(startBtn));
    await page.waitForTimeout(500);

    const preMatch = await page.evaluate(() => {
      const app = document.getElementById('app-modal');
      const open = app && app.classList.contains('on');
      const body = document.getElementById('app-modal-body');
      const text = body ? body.innerText.replace(/\n+/g, ' | ').slice(0, 400) : '';
      const hasEnterBp = Array.from(body ? body.querySelectorAll('button') : []).some((b) =>
        b.textContent.includes('进入 BP')
      );
      return { open, text, hasEnterBp };
    });
    console.log('PREMATCH', JSON.stringify(preMatch, null, 2));
    await shot(page, 'ag-c06-prematch');

    // enter BP
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('#app-modal-body button')).find((b) =>
        b.textContent.includes('进入 BP')
      );
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);
    await shot(page, 'ag-c07-bp');

    const bpState = await page.evaluate(() => {
      const app = document.getElementById('app-modal');
      const body = document.getElementById('app-modal-body');
      return {
        open: !!(app && app.classList.contains('on')),
        text: body ? body.innerText.replace(/\n+/g, ' | ').slice(0, 300) : null,
        series: S.series ? { mw: S.series.mw, ow: S.series.ow, stage: S.series.stage } : null,
      };
    });
    console.log('BP_STATE', JSON.stringify(bpState, null, 2));

    console.log('CONSOLE_ERRORS', JSON.stringify(errors));
  } catch (e) {
    console.error('SCRIPT_FAIL', e);
  } finally {
    await browser.close();
  }
})();
