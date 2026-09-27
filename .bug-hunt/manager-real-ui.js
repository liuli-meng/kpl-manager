/* manager real-UI regression: clear → createTeam → draft bid+pick (real clicks)
 * → all manager pages dirty scan → mobile 390x844 FAB vs bottom nav.
 * Output: manager-real-ui.json + screenshots in gui-test-screenshots/
 */
const path = require('path');
const fs = require('fs');
const { launch, clearAndStart, shot, call } = require('../tests/playthrough/pw.js');

const OUT = path.join(__dirname, 'manager-real-ui.json');
const bugs = [];
const log = [];
function bug(sev, title, detail) {
  const b = { sev, title, detail: String(detail || '').slice(0, 400) };
  bugs.push(b);
  console.log('BUG', sev, title, '|', b.detail);
}
function note(msg) { log.push(msg); console.log('…', msg); }

async function snapDirty(page, stage) {
  return page.evaluate((stage) => {
    const dirty = [];
    const nodes = document.querySelectorAll('#page-market,#page-club,#page-lineup,#page-train,#page-league,#page-kjia,#page-union,#page-hall,#page-biz,#page-career,body > .wrap');
    const seen = new Set();
    nodes.forEach((root) => {
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walk.nextNode())) {
        const t = (n.textContent || '').trim();
        if (!t || t.length < 2 || seen.has(t)) continue;
        if (/\bundefined\b|\bNaN\b|\[object Object\]|Infinity|万万|%%|null万|undefined万/.test(t)) {
          seen.add(t);
          dirty.push(t.slice(0, 120));
        }
      }
    });
    // dead onclick handlers (referenced fn missing)
    const dead = [];
    document.querySelectorAll('[onclick]').forEach((el) => {
      const code = el.getAttribute('onclick') || '';
      const m = code.match(/^\s*([A-Za-z_$][\w$]*)\s*\(/);
      if (m && typeof window[m[1]] !== 'function') dead.push(m[1] + ' :: ' + code.slice(0, 60));
    });
    return { stage, dirty: [...new Set(dirty)].slice(0, 12), dead: [...new Set(dead)].slice(0, 8) };
  }, stage);
}

async function clickSafe(page, sel, label, timeout = 2500) {
  try {
    const el = page.locator(sel).first();
    await el.waitFor({ state: 'visible', timeout });
    await el.click({ timeout });
    await page.waitForTimeout(220);
    log.push('click ok: ' + label);
    return true;
  } catch (e) {
    log.push('click FAIL: ' + label + ' :: ' + e.message.split('\n')[0]);
    return false;
  }
}

(async () => {
  const { browser, page } = await launch({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  const consoleErrors = [];
  const origPe = page.listeners ? null : null;
  page.on('pageerror', (e) => { pageErrors.push(e.message); console.error('[pageerror]', e.message); });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      consoleErrors.push(t);
      console.error('[console.error]', t);
    }
  });

  // 0) HTTP alive
  const title = await page.title();
  note('page title: ' + title);

  // 1) clear + createTeam via real UI
  await clearAndStart(page);
  await page.waitForTimeout(400);
  const hasStart = await page.locator('#start-modal').count();
  const nameVisible = await page.locator('#new-team-name').isVisible().catch(() => false);
  note('start-modal=' + hasStart + ' nameInputVisible=' + nameVisible);
  if (!nameVisible) {
    // may need to open start
    await page.evaluate(() => { try { initStart(); } catch (e) {} });
    await page.waitForTimeout(200);
  }
  await page.fill('#new-team-name', '封顶回归');
  await shot(page, 'mgr-01-start');
  const createBtn = page.locator('#start-modal button', { hasText: '创建战队' }).first();
  await createBtn.click({ timeout: 4000 }).catch((e) => bug('P0', '创建战队按钮点不动', e.message));
  await page.waitForTimeout(600);

  const afterCreate = await page.evaluate(() => {
    const modal = document.getElementById('start-modal');
    return {
      modalOn: !!(modal && modal.classList.contains('on')),
      mode: S && S.mode,
      teamName: S && S.teamName,
      fund: S && S.fund,
      players: S && S.players && S.players.length,
      transferWindow: S && S.transferWindow,
      preseason: S && S.preseason,
      draft: S && S.draft ? { phase: S.draft.phase, slot: S.draft.slot, pool: (S.draft.pool || []).length, done: S.draft.done, order: (S.draft.order || []).length, bid: S.draft.bid, leader: S.draft.leader } : null,
      page: document.querySelector('section.page.on') && document.querySelector('section.page.on').id,
    };
  });
  note('afterCreate ' + JSON.stringify(afterCreate));
  await shot(page, 'mgr-02-after-create');
  if (afterCreate.modalOn) bug('P0', 'createTeam 后开局弹窗未关闭', '');
  if (afterCreate.mode !== 'manager') bug('P0', 'createTeam 未进入 manager 模式', String(afterCreate.mode));
  if (!afterCreate.draft) bug('P1', 'createTeam 后未初始化选秀', JSON.stringify(afterCreate));

  // ensure market page + enough fund to exercise "资金充足能叫价"
  await page.evaluate(() => {
    try { goPage('market'); } catch (e) {}
    if (S && S.fund < 800) S.fund = 1315000; // 资金充足场景（回归点①）
  });
  await page.waitForTimeout(300);
  await shot(page, 'mgr-03-market');

  // 2) DRAFT: real button click for 叫价, then real card click for 点名
  const draftTrace = { raises: 0, raiseClicks: 0, pickClicks: 0, passClicks: 0, toasts: [], pickedName: null, beforeLen: 0, afterLen: 0 };
  draftTrace.beforeLen = await page.evaluate(() => S.players.length);

  for (let i = 0; i < 60; i++) {
    const st = await page.evaluate(() => {
      const d = S.draft;
      if (!d) return { err: 'no draft' };
      const mePick = d.phase === 'pick' && !d.done && d.order[d.slot] === S.teamName;
      const meAuction = d.phase === 'auction' && !d.done && d.order[d.slot] === S.teamName && !d.passed[S.teamName];
      const wrap = document.querySelector('#page-market [onclick*="draftPick"]');
      const raiseBtn = document.querySelector('#page-market button[onclick*="draftBidRaise"]');
      const passBtn = document.querySelector('#page-market button[onclick*="draftBidPass"]');
      const skipBtn = document.querySelector('#page-market button[onclick*="draftSkip"]');
      const hint = [...document.querySelectorAll('#page-market .hint')].map((h) => h.textContent).filter((t) => /上限|叫价|点名|资金|封顶/.test(t)).slice(0, 4);
      return {
        phase: d.phase, done: d.done, slot: d.slot, leader: d.leader, bid: d.bid,
        mePick, meAuction, hasWrap: !!wrap, hasRaise: !!raiseBtn, hasPass: !!passBtn, hasSkip: !!skipBtn,
        max: typeof draftTeamMaxBid === 'function' ? draftTeamMaxBid(S, S.teamName, d.slot) : null,
        fund: S.fund, pool: d.pool.length, hint,
        raiseText: raiseBtn ? raiseBtn.textContent.trim() : null,
        wrapPid: wrap ? (wrap.getAttribute('onclick') || '') : null,
      };
    });
    if (st.err) { draftTrace.err = st.err; break; }
    if (st.done && !st.mePick) break;

    // capture toast-ish hint
    if (st.hint && st.hint.length) draftTrace.toasts = st.hint.slice(-3);

    if (st.mePick && st.hasWrap) {
      // REAL card click
      const beforePlayers = await page.evaluate(() => S.players.length);
      const clicked = await clickSafe(page, '#page-market [onclick*="draftPick"]', 'prospect-card');
      draftTrace.pickClicks++;
      await page.waitForTimeout(350);
      const afterPick = await page.evaluate(() => {
        const d = S.draft;
        const last = S.players[S.players.length - 1];
        return {
          players: S.players.length,
          lastName: last && last.name,
          lastId: last && last.id,
          phase: d.phase, done: d.done,
          picks: (d.picks || []).filter((x) => x.playerId).length,
          toast: (document.getElementById('toast') || {}).textContent || '',
        };
      });
      note('pick click → ' + JSON.stringify(afterPick));
      if (afterPick.players > beforePlayers) {
        draftTrace.pickedName = afterPick.lastName;
        draftTrace.afterLen = afterPick.players;
        await shot(page, 'mgr-04-draft-picked');
        break;
      } else {
        // click didn't sign — try the inner 点名签约 button if present
        const btn = await clickSafe(page, '#page-market button:has-text("点名签约")', 'sign-btn');
        draftTrace.pickClicks++;
        await page.waitForTimeout(350);
        const after2 = await page.evaluate(() => {
          const last = S.players[S.players.length - 1];
          return { players: S.players.length, lastName: last && last.name, toast: (document.getElementById('toast') || {}).textContent || '' };
        });
        note('sign-btn → ' + JSON.stringify(after2));
        if (after2.players > beforePlayers) {
          draftTrace.pickedName = after2.lastName;
          draftTrace.afterLen = after2.players;
          await shot(page, 'mgr-04-draft-picked');
          break;
        }
        bug('P1', '点名卡/签约按钮点击后未签约', JSON.stringify({ afterPick, after2, wrapPid: st.wrapPid }));
        await shot(page, 'mgr-04-draft-pick-fail');
        break;
      }
    }

    if (st.meAuction && st.hasRaise) {
      const btn = page.locator('#page-market button[onclick*="draftBidRaise"]').first();
      const txt = await btn.textContent().catch(() => '?');
      await btn.click({ timeout: 2500 }).then(() => { draftTrace.raiseClicks++; draftTrace.raises++; }).catch((e) => {
        bug('P1', '叫价按钮点不动', e.message.split('\n')[0] + ' btn=' + txt);
      });
      await page.waitForTimeout(280);
      continue;
    }

    if (st.meAuction && st.hasPass) {
      // cannot afford → pass this slot but keep looping
      await clickSafe(page, '#page-market button[onclick*="draftBidPass"]', 'bid-pass');
      draftTrace.passClicks++;
      continue;
    }

    if (st.mePick && st.hasSkip && !st.hasWrap) {
      bug('P2', '点名阶段无可点新秀卡但池非空?', JSON.stringify(st));
      await clickSafe(page, '#page-market button[onclick*="draftSkip"]', 'draft-skip');
      continue;
    }

    // waiting on AI
    await page.waitForTimeout(250);
  }

  // if still no pick, try forced path but still via DOM click when possible
  if (!draftTrace.pickedName) {
    const forced = await page.evaluate(() => {
      const d = S.draft;
      if (!d) return { err: 'no draft' };
      // drive auction/pick via engine then leave a clickable card
      for (let i = 0; i < 50 && !d.done; i++) {
        if (d.phase === 'pick') {
          if (d.order[d.slot] === S.teamName) return { ready: true, phase: d.phase, pool: d.pool.length, slot: d.slot };
          if (d.pool[0]) draftPick(S, d.pool[0].id);
          else draftSkip(S);
          continue;
        }
        const max = draftTeamMaxBid(S, S.teamName, d.slot);
        const need = d.leader ? d.bid + 10 : d.bid;
        if (d.order[d.slot] === S.teamName && need <= max && (S.fund || 0) >= need) draftBidRaise(S);
        else if (d.order[d.slot] === S.teamName) draftBidPass(S);
        else draftAiAuction(S);
      }
      return {
        ready: d.phase === 'pick' && d.order[d.slot] === S.teamName && !d.done,
        phase: d.phase, done: d.done, pool: d.pool.length, slot: d.slot,
      };
    });
    note('forced draft state ' + JSON.stringify(forced));
    if (forced && forced.ready) {
      const beforePlayers = await page.evaluate(() => S.players.length);
      await clickSafe(page, '#page-market [onclick*="draftPick"]', 'prospect-card-forced');
      draftTrace.pickClicks++;
      await page.waitForTimeout(350);
      const after = await page.evaluate(() => {
        const last = S.players[S.players.length - 1];
        return { players: S.players.length, lastName: last && last.name };
      });
      if (after.players > beforePlayers) {
        draftTrace.pickedName = after.lastName;
        draftTrace.afterLen = after.players;
        await shot(page, 'mgr-04-draft-picked');
      } else {
        bug('P0', '点名签约真实点击无效（引擎已到点名阶段）', JSON.stringify({ forced, after }));
        await shot(page, 'mgr-04-draft-pick-fail');
      }
    } else {
      bug('P1', '资金充足仍走不到「轮到你点名」', JSON.stringify({ forced, draftTrace }));
      await shot(page, 'mgr-04-draft-noreach');
    }
  }

  note('draftTrace ' + JSON.stringify(draftTrace));

  // 3) open every manager page via real nav clicks, scan dirty
  const pages = ['club', 'lineup', 'market', 'train', 'league', 'kjia', 'union', 'hall', 'biz'];
  const pageSnaps = {};
  for (const pg of pages) {
    // real nav button click
    const navSel = `#nav button[data-page="${pg}"]`;
    const okNav = await clickSafe(page, navSel, 'nav-' + pg);
    if (!okNav) {
      await page.evaluate((p) => { try { goPage(p); } catch (e) { window.__goErr = e.message; } }, pg);
      const ge = await page.evaluate(() => window.__goErr || null);
      if (ge) bug('P0', `goPage('${pg}') 抛错`, ge);
    }
    await page.waitForTimeout(280);
    const on = await page.evaluate((p) => {
      const el = document.querySelector('section.page.on');
      return el ? el.id : null;
    }, pg);
    if (on !== 'page-' + pg) bug('P1', `点击 nav 后未切换到 ${pg}`, 'on=' + on);
    const snap = await snapDirty(page, pg);
    pageSnaps[pg] = snap;
    if (snap.dirty.length) bug('P1', `${pg} 页脏文本`, snap.dirty.join(' | '));
    if (snap.dead.length) bug('P1', `${pg} 页 onclick 断链`, snap.dead.join(' | '));
    await shot(page, 'mgr-page-' + pg);
  }

  // 4) mobile FAB overlap regression (390x844)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  await page.evaluate(() => { try { goPage('club'); } catch (e) {} });
  await page.waitForTimeout(250);
  await shot(page, 'mgr-mobile-club');
  const fabTest = await page.evaluate(() => {
    const fab = document.getElementById('page-fab');
    const nav = document.getElementById('nav');
    const results = {};
    const targets = ['hall', 'biz', 'union', 'kjia'];
    for (const p of targets) {
      const b = document.querySelector(`#nav button[data-page="${p}"]`);
      if (!b) { results[p] = { missing: true }; continue; }
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const el = document.elementFromPoint(cx, cy);
      results[p] = {
        btn: { x: Math.round(cx), y: Math.round(cy), w: Math.round(r.width), h: Math.round(r.height) },
        hit: el ? (el.id || el.tagName) + (el.className ? '.' + String(el.className).split(' ').join('.') : '') : null,
        hitIsNavBtn: !!(el && (el === b || b.contains(el))),
        hitIsFab: !!(el && (el.id === 'page-fab' || (el.closest && el.closest('#page-fab')))),
      };
    }
    const fr = fab ? fab.getBoundingClientRect() : null;
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      fab: fr ? { x: Math.round(fr.left), y: Math.round(fr.top), w: Math.round(fr.width), h: Math.round(fr.height), bottom: Math.round(fr.bottom), right: Math.round(fr.right) } : null,
      nav: nav ? (() => { const r = nav.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height) }; })() : null,
      results,
    };
  });
  note('fabTest ' + JSON.stringify(fabTest));
  for (const [p, r] of Object.entries(fabTest.results || {})) {
    if (r.hitIsFab) bug('P0', `移动端 FAB 仍盖住底栏 ${p}`, JSON.stringify(r));
    else if (!r.hitIsNavBtn) bug('P1', `移动端底栏 ${p} 中心未命中 nav 按钮`, JSON.stringify(r));
  }

  // also try real click on hall/biz from mobile
  for (const pg of ['hall', 'biz']) {
    const ok = await clickSafe(page, `#nav button[data-page="${pg}"]`, 'mobile-nav-' + pg);
    await page.waitForTimeout(250);
    const on = await page.evaluate(() => {
      const el = document.querySelector('section.page.on');
      return el ? el.id : null;
    });
    if (on !== 'page-' + pg) bug('P1', `移动端点击 ${pg} 未切换`, 'on=' + on + ' navClick=' + ok);
    await shot(page, 'mgr-mobile-' + pg);
  }

  // collect final
  const report = {
    ts: new Date().toISOString(),
    afterCreate,
    draftTrace,
    pageSnaps,
    fabTest,
    pageErrors,
    consoleErrors,
    bugs,
    log,
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log('WROTE', OUT);
  console.log('BUGS', bugs.length, JSON.stringify(bugs, null, 2));
  console.log('PAGEERRORS', pageErrors.length, 'CONSOLE_ERRORS', consoleErrors.length);
  await browser.close();
})().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
