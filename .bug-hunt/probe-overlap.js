/* FAB 与 nav 重叠 + 选秀可点性 视觉/命中探针 */
const { launch, clearAndStart, shot } = require('../tests/playthrough/pw.js');

(async () => {
  const { browser, page } = await launch({ viewport: { width: 390, height: 844 } });
  try {
    await clearAndStart(page);
    await page.evaluate(() => {
      const nameEl = document.getElementById('new-team-name');
      if (nameEl) nameEl.value = '重叠测试队';
      if (typeof createTeam === 'function') createTeam();
    });
    await page.waitForTimeout(400);
    await shot(page, 'overlap-market-mobile');

    const hit = await page.evaluate(() => {
      const fab = document.getElementById('page-fab');
      const nav = document.getElementById('nav');
      const biz = document.querySelector('#nav button[data-page="biz"]');
      const fr = fab.getBoundingClientRect();
      const nr = nav.getBoundingClientRect();
      const br = biz.getBoundingClientRect();
      const overlap = (a, b) => {
        const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        return x * y;
      };
      // 中心命中
      const cx = fr.left + fr.width / 2, cy = fr.top + fr.height / 2;
      const el = document.elementFromPoint(cx, cy);
      const bizCx = br.left + br.width / 2, bizCy = br.top + br.height / 2;
      const bizEl = document.elementFromPoint(bizCx, bizCy);
      return {
        fab: { x: fr.x, y: fr.y, w: fr.width, h: fr.height, bottom: fr.bottom, right: fr.right },
        nav: { y: nr.y, h: nr.height, bottom: nr.bottom },
        biz: { x: br.x, y: br.y, w: br.width, h: br.height, text: biz && biz.textContent },
        overlapFabBiz: overlap(fr, br),
        fabCenterHits: el && (el.id || el.tagName + '.' + el.className),
        bizCenterHits: bizEl && (bizEl.id || bizEl.tagName + '.' + (bizEl.className || '') + ':' + (bizEl.textContent || '').slice(0, 8)),
        dockBottom: (document.getElementById('page-dock') || {}).style ? getComputedStyle(document.getElementById('page-dock')).bottom : null,
      };
    });
    console.log('OVERLAP', JSON.stringify(hit, null, 2));

    // draft 可点性
    const draft = await page.evaluate(() => {
      try { goPage('market'); } catch (e) {}
      const d = S.draft;
      const panel = document.querySelector('#page-market .panel[data-fold="mdraft"]');
      const fold = panel && panel.className;
      const wrap = document.querySelector('#page-market [onclick*="draftPick"]');
      const compact = /要先「叫价」/.test(document.getElementById('page-market').innerText || '');
      return {
        phase: d && d.phase,
        foldCls: fold,
        hasPickWrap: !!wrap,
        auctionHint: compact,
        pool: d && d.pool && d.pool.length,
        text: (document.getElementById('page-market').innerText || '').split('\n').filter(l => /选秀|点名|叫价|竞拍|签约/.test(l)).slice(0, 12),
      };
    });
    console.log('DRAFT', JSON.stringify(draft, null, 2));

    // 桌面视口再测
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(200);
    const desk = await page.evaluate(() => {
      const fab = document.getElementById('page-fab').getBoundingClientRect();
      const biz = document.querySelector('#nav button[data-page="biz"]').getBoundingClientRect();
      const x = Math.max(0, Math.min(fab.right, biz.right) - Math.max(fab.left, biz.left));
      const y = Math.max(0, Math.min(fab.bottom, biz.bottom) - Math.max(fab.top, biz.top));
      return { fab: {x:fab.x,y:fab.y,w:fab.width,h:fab.height}, biz: {x:biz.x,y:biz.y,w:biz.width,h:biz.height}, overlapArea: x * y };
    });
    console.log('DESKTOP', JSON.stringify(desk));
    await shot(page, 'overlap-desktop');
  } catch (e) {
    console.error('FATAL', e && e.stack || e);
  } finally {
    await browser.close();
  }
})();
