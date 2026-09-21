// 移动端适配 playtest: mobile viewport 390x844
// Flow: launch mobile → clear+reload → createTeam '手机端' → screenshots → nav/btn/overflow checks → goPage all
const { launch, clearAndStart, shot, BASE } = require('./pw.js');

const VIEWPORT = { width: 390, height: 844 };
const TAP_MIN = 40; // Apple/Android common minimum touch target

(async () => {
  const errors = [];
  const { browser, page } = await launch({ viewport: VIEWPORT });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('[console.error] ' + msg.text());
  });
  page.on('dialog', async (d) => {
    console.log('[dialog]', d.type(), (d.message() || '').slice(0, 120));
    await d.accept();
  });

  const report = {
    viewport: VIEWPORT,
    base: BASE,
    errors,
    steps: {},
    nav: {},
    buttons: {},
    overflow: {},
    pages: {},
  };

  try {
    // ---- 1. Mobile viewport launch; clear+reload ----
    await clearAndStart(page);
    await page.waitForTimeout(700);

    const boot = await page.evaluate(() => {
      const m = document.getElementById('start-modal');
      return {
        startVisible: !!(m && m.classList.contains('on')),
        hasCreateTeam: typeof createTeam === 'function',
        vw: window.innerWidth,
        vh: window.innerHeight,
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      };
    });
    report.steps.boot = boot;
    console.log('BOOT', JSON.stringify(boot));

    // Screenshot start modal (before createTeam)
    report.steps.shot_start = await shot(page, 'mobile-01-start-modal');

    // ---- 2. createTeam '手机端' ----
    const created = await page.evaluate(() => {
      const nameEl = document.getElementById('new-team-name');
      if (!nameEl) return { ok: false, reason: 'no #new-team-name' };
      nameEl.value = '手机端';
      createTeam();
      return {
        ok: true,
        teamName: S && S.teamName,
        selfBuilt: S && S.selfBuilt,
        preseason: S && S.preseason,
        lineupLen: S && S.lineup && S.lineup.length,
        modalOff: !document.getElementById('start-modal').classList.contains('on'),
        pageAfter: document.querySelector('nav button.on') && document.querySelector('nav button.on').dataset.page,
      };
    });
    report.steps.createTeam = created;
    console.log('CREATE_TEAM', JSON.stringify(created));

    // Close tour if it popped
    await page.waitForTimeout(500);
    const tourClosed = await page.evaluate(() => {
      try {
        if (typeof tourSkip === 'function') { tourSkip(); return true; }
      } catch (e) {}
      try {
        const x = document.querySelector('#app-modal .modal-close, #app-modal [onclick*="closeModal"], #app-modal .btn.sm');
        // Prefer explicit skip/close if present
        const btns = Array.from(document.querySelectorAll('#app-modal button'));
        const skip = btns.find(b => /跳过|关闭|知道了|完成/.test(b.textContent || ''));
        if (skip) { skip.click(); return true; }
      } catch (e) {}
      return false;
    });
    report.steps.tourClosed = tourClosed;
    await page.waitForTimeout(300);

    // ---- 3. Screenshots: market (post-create landing), lineup, club ----
    // createTeam lands on market
    await page.evaluate(() => { if (typeof goPage === 'function') goPage('market'); });
    await page.waitForTimeout(400);
    report.steps.shot_market = await shot(page, 'mobile-02-market');

    await page.evaluate(() => goPage('lineup'));
    await page.waitForTimeout(400);
    report.steps.shot_lineup = await shot(page, 'mobile-03-lineup');

    await page.evaluate(() => goPage('club'));
    await page.waitForTimeout(400);
    report.steps.shot_club = await shot(page, 'mobile-04-club');

    // ---- 4. Nav is bottom bar (CSS), tap sizes, horizontal overflow ----
    const navProbe = await page.evaluate((tapMin) => {
      const nav = document.getElementById('nav');
      if (!nav) return { ok: false, reason: 'no #nav' };
      const cs = getComputedStyle(nav);
      const navRect = nav.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Bottom bar heuristic: fixed position + near bottom of viewport
      const isFixed = cs.position === 'fixed';
      const nearBottom = Math.abs(navRect.bottom - vh) < 8 || Math.abs(vh - navRect.top - navRect.height) < 8;
      const bottomCss = cs.bottom;

      // Visible nav buttons (manager mode)
      const btns = Array.from(nav.querySelectorAll('button')).filter(b => {
        const st = getComputedStyle(b);
        return st.display !== 'none' && st.visibility !== 'hidden' && b.offsetParent !== null;
      });

      const btnDetails = btns.map(b => {
        const r = b.getBoundingClientRect();
        const bst = getComputedStyle(b);
        return {
          page: b.dataset.page,
          label: (b.textContent || '').trim().slice(0, 12),
          w: Math.round(r.width * 10) / 10,
          h: Math.round(r.height * 10) / 10,
          minH: bst.minHeight,
          inViewportX: r.left >= -1 && r.right <= vw + 1,
        };
      });

      const tooSmall = btnDetails.filter(d => d.h < tapMin || d.w < 36);
      const offscreen = btnDetails.filter(d => !d.inViewportX);

      // Horizontal overflow
      const de = document.documentElement;
      const scrollW = de.scrollWidth;
      const clientW = de.clientWidth;
      const bodyScrollW = document.body ? document.body.scrollWidth : null;
      const overflowPx = scrollW - clientW;

      // Find wide elements if overflowing
      let wideEls = [];
      if (overflowPx > 0) {
        wideEls = Array.from(document.querySelectorAll('body *'))
          .filter(el => {
            const r = el.getBoundingClientRect();
            return r.width > vw + 2 && r.right > vw + 1;
          })
          .slice(0, 12)
          .map(el => ({
            tag: el.tagName,
            id: el.id || null,
            cls: (el.className && el.className.toString) ? el.className.toString().slice(0, 80) : null,
            w: Math.round(el.getBoundingClientRect().width),
            right: Math.round(el.getBoundingClientRect().right),
          }));
      }

      return {
        ok: true,
        vw, vh,
        navCss: {
          position: cs.position,
          bottom: bottomCss,
          left: cs.left,
          right: cs.right,
          zIndex: cs.zIndex,
          top: cs.top,
        },
        navRect: {
          top: Math.round(navRect.top),
          bottom: Math.round(navRect.bottom),
          height: Math.round(navRect.height),
          width: Math.round(navRect.width),
        },
        isBottomBar: isFixed && nearBottom,
        isFixed,
        nearBottom,
        visibleBtnCount: btnDetails.length,
        btnDetails,
        tooSmall,
        offscreen,
        tapMin,
      };
    }, TAP_MIN);

    report.nav = {
      isBottomBar: navProbe.isBottomBar,
      isFixed: navProbe.isFixed,
      nearBottom: navProbe.nearBottom,
      css: navProbe.navCss,
      rect: navProbe.navRect,
      visibleBtnCount: navProbe.visibleBtnCount,
    };
    report.buttons = {
      tapMin: TAP_MIN,
      details: navProbe.btnDetails,
      tooSmallCount: (navProbe.tooSmall || []).length,
      tooSmall: navProbe.tooSmall || [],
      offscreenCount: (navProbe.offscreen || []).length,
      offscreen: navProbe.offscreen || [],
    };

    const overflowOnClub = await page.evaluate(() => {
      const de = document.documentElement;
      return {
        page: 'club',
        scrollW: de.scrollWidth,
        clientW: de.clientWidth,
        bodyScrollW: document.body ? document.body.scrollWidth : null,
        overflowPx: de.scrollWidth - de.clientWidth,
        ok: de.scrollWidth <= de.clientWidth,
      };
    });
    report.overflow.clinic_or_club = overflowOnClub;

    console.log('NAV', JSON.stringify(report.nav, null, 2));
    console.log('BUTTONS', JSON.stringify(report.buttons, null, 2));

    // Also measure non-nav buttons on club page (primary CTAs)
    const clubBtns = await page.evaluate(() => {
      const pageEl = document.getElementById('page-club');
      if (!pageEl) return [];
      return Array.from(pageEl.querySelectorAll('button, .btn'))
        .filter(b => getComputedStyle(b).display !== 'none' && b.offsetParent !== null)
        .slice(0, 20)
        .map(b => {
          const r = b.getBoundingClientRect();
          return {
            label: (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24),
            w: Math.round(r.width),
            h: Math.round(r.height),
            tooSmall: r.height < 36 || r.width < 24,
          };
        });
    });
    report.buttons.clubPage = clubBtns;
    report.buttons.clubPageTooSmall = clubBtns.filter(b => b.tooSmall);
    console.log('CLUB_BTNS', JSON.stringify(clubBtns, null, 2));

    // ---- 5. goPage each visible page; note overflow ----
    const pageList = await page.evaluate(() => {
      const nav = document.getElementById('nav');
      const pages = Array.from(nav.querySelectorAll('button'))
        .filter(b => getComputedStyle(b).display !== 'none' && b.offsetParent !== null)
        .map(b => b.dataset.page);
      return pages;
    });
    report.steps.visiblePages = pageList;
    console.log('VISIBLE_PAGES', JSON.stringify(pageList));

    const pageResults = [];
    for (const name of pageList) {
      const r = await page.evaluate((pg) => {
        try {
          if (typeof tourSkip === 'function') tourSkip();
        } catch (e) {}
        try {
          goPage(pg);
        } catch (e) {
          return { page: pg, ok: false, error: String(e.message || e) };
        }
        // force reflow then measure
        void document.documentElement.offsetWidth;
        const de = document.documentElement;
        const vw = window.innerWidth;
        const scrollW = de.scrollWidth;
        const clientW = de.clientWidth;
        const overflowPx = scrollW - clientW;

        let wideEls = [];
        if (overflowPx > 0) {
          wideEls = Array.from(document.querySelectorAll('.page.on, .page.on *'))
            .filter(el => {
              const rect = el.getBoundingClientRect();
              return rect.width > vw + 2 && rect.right > vw + 1;
            })
            .slice(0, 15)
            .map(el => ({
              tag: el.tagName,
              id: el.id || null,
              cls: (el.className && el.className.toString) ? el.className.toString().slice(0, 100) : null,
              w: Math.round(el.getBoundingClientRect().width),
              right: Math.round(el.getBoundingClientRect().right),
              left: Math.round(el.getBoundingClientRect().left),
            }));
        }

        // page section visible?
        const sec = document.getElementById('page-' + pg);
        const secVisible = !!(sec && sec.classList.contains('on'));

        return {
          page: pg,
          ok: true,
          secVisible,
          scrollW,
          clientW,
          overflowPx,
          noOverflow: overflowPx <= 0,
          wideEls,
        };
      }, name);

      await page.waitForTimeout(250);
      pageResults.push(r);
      console.log('PAGE_OVERFLOW', JSON.stringify(r));
    }
    report.pages.results = pageResults;
    report.pages.overflowPages = pageResults.filter(r => r.overflowPx > 0);
    report.pages.okPages = pageResults.filter(r => r.overflowPx <= 0).map(r => r.page);
    report.pages.failPages = pageResults.filter(r => r.overflowPx > 0).map(r => r.page);

    // Full overflow sweep summary
    const allOverflow = await page.evaluate(() => {
      const de = document.documentElement;
      return {
        scrollW: de.scrollWidth,
        clientW: de.clientWidth,
        overflowPx: de.scrollWidth - de.clientWidth,
        ok: de.scrollWidth <= de.clientWidth,
      };
    });
    report.overflow.final = allOverflow;

    // Extra screenshot after tour (on club)
    await page.evaluate(() => goPage('club'));
    await page.waitForTimeout(300);
    report.steps.shot_club_after = await shot(page, 'mobile-05-club-after-sweep');

    // ---- Verdict ----
    report.verdict = {
      navBottomBar: !!navProbe.isBottomBar,
      navButtonsTappable: (navProbe.tooSmall || []).length === 0,
      noHorizontalOverflowAllPages: report.pages.overflowPages.length === 0,
      createTeamOk: !!(created && created.ok),
      pageErrors: errors.length,
      pass:
        !!navProbe.isBottomBar &&
        (navProbe.tooSmall || []).length === 0 &&
        report.pages.overflowPages.length === 0 &&
        !!(created && created.ok) &&
        errors.length === 0,
    };

    console.log('REPORT_JSON');
    console.log(JSON.stringify(report, null, 2));
    console.log('VERDICT', JSON.stringify(report.verdict, null, 2));
  } catch (e) {
    report.fatal = String(e && e.stack ? e.stack : e);
    console.error('FATAL', report.fatal);
  } finally {
    await browser.close();
  }
})();
