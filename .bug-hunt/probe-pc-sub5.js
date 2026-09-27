// Round 5: pageHint copy + pickPlayerPos validation + summary of toast gaps
const { launch } = require('../tests/playthrough/pw.js');
const fs = require('fs');
const findings = [];
function record(id, severity, title, detail) {
  findings.push({ id, severity, title, detail: detail == null ? null : String(detail).slice(0, 1200) });
  console.log(`[${severity}] ${id} ${title}`);
  if (detail) console.log('   ', String(detail).slice(0, 300));
}

(async () => {
  const { browser, page } = await launch();
  const pageErrors = [];
  page.on('pageerror', (e) => { pageErrors.push(e.message); console.log('[pageerror]', e.message); });
  page.on('dialog', async (d) => { try { await d.accept(); } catch (e) {} });

  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    window.__toasts = [];
    if (!window.__toastHooked) {
      window.__toastHooked = true;
      const orig = window.toast;
      window.toast = function (msg) { try { window.__toasts.push(String(msg)); } catch (e) {} return orig.apply(this, arguments); };
    }
    localStorage.setItem('km_tour', '1');
    switchStartTab('coach');
    pickCoachClub(1);
    applyCoachClub();
    try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
    goPage('market');
  });
  await page.waitForTimeout(200);

  const hints = await page.evaluate(() => {
    const marketText = (document.getElementById('page-market') || {}).innerText || '';
    const hintFn = typeof pageHint === 'function' ? pageHint('market') : null;
    // strip tags from pageHint
    const hintPlain = hintFn ? hintFn.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null;
    goPage('kjia');
    const kjiaText = (document.getElementById('page-kjia') || {}).innerText || '';
    const kjiaHint = typeof pageHint === 'function' ? pageHint('kjia').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null;
    goPage('lineup');
    const lineupText = (document.getElementById('page-lineup') || {}).innerText || '';
    return {
      marketHint: hintPlain,
      marketHead: marketText.slice(0, 180),
      marketHasBuySellCopy: /买人卖人/.test(hintPlain || '') || /买人卖人/.test(marketText),
      marketHasCannotSell: /不能挂牌/.test(marketText),
      kjiaHint,
      kjiaHasPromoteCopy: /提拔/.test(kjiaText) || /提拔/.test(kjiaHint || ''),
      lineupHasSell: /openSellNego/.test((document.getElementById('page-lineup') || {}).innerHTML || ''),
      lineupHasTactic: /战术|对线压制|团战|运营/.test(lineupText),
    };
  });
  console.log('HINTS', JSON.stringify(hints, null, 2));
  if (hints.marketHasBuySellCopy && /教练/.test(hints.marketHint || hints.marketHead)) {
    record('P2-MARKET-HINT-MANAGER', 'WARN', '教练转会页 hint 仍有「买人卖人」经理向文案', JSON.stringify(hints.marketHint || hints.marketHead));
  }

  // pickPlayerPos invalid key
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(350);
  const posGuard = await page.evaluate(() => {
    window.__toasts = [];
    if (!window.__toastHooked) {
      window.__toastHooked = true;
      const orig = window.toast;
      window.toast = function (msg) { try { window.__toasts.push(String(msg)); } catch (e) {} return orig.apply(this, arguments); };
    }
    localStorage.setItem('km_tour', '1');
    switchStartTab('player');
    pickPlayerArch(1);
    let r = null;
    try { pickPlayerPos('jungle'); r = { called: true, _pcPos: _pcPos }; } catch (e) { r = { throw: e.message }; }
    let createR = null;
    try { createPlayerCareer(); createR = { mode: S && S.mode, err: null }; } catch (e) { createR = { throw: e.message }; }
    return { r, createR, toasts: (window.__toasts || []).slice() };
  });
  console.log('POS_GUARD', JSON.stringify(posGuard, null, 2));
  if (posGuard.createR && posGuard.createR.throw) {
    record('P2-PICKPOS-NOGUARD', 'WARN', 'pickPlayerPos 非法键导致 createPlayerCareer 抛错: ' + posGuard.createR.throw, JSON.stringify(posGuard));
  } else if (posGuard.r && posGuard.r._pcPos === 'jungle') {
    record('P2-PICKPOS-ACCEPTS-BAD', 'WARN', 'pickPlayerPos 接受非法位置键 jungle', JSON.stringify(posGuard));
  } else {
    record('P2-PICKPOS-GUARDED', 'PASS', 'pickPlayerPos 拒绝非法键', JSON.stringify(posGuard));
  }

  // media UI button path with real maybeOpenMedia
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(350);
  const mediaUi = await page.evaluate(() => {
    window.__toasts = [];
    if (!window.__toastHooked) {
      window.__toastHooked = true;
      const orig = window.toast;
      window.toast = function (msg) { try { window.__toasts.push(String(msg)); } catch (e) {} return orig.apply(this, arguments); };
    }
    localStorage.setItem('km_tour', '1');
    switchStartTab('player');
    pickPlayerArch(1);
    pickPlayerPos('mid');
    if (!_pcTeam && window._pcTeams && window._pcTeams[0]) pickPlayerTeam(window._pcTeams[0].name);
    createPlayerCareer();
    try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
    goPage('career');
    // force open real media
    maybeOpenMedia(S, 'title');
    const hasPanel = /媒体采访/.test((document.getElementById('page-career') || {}).innerText || '');
    const btns = [...document.querySelectorAll('#page-career button')].filter((b) => /playerRespondMedia/.test(b.getAttribute('onclick') || ''));
    window.__toasts = [];
    let clickR = null;
    if (btns[0]) {
      btns[0].click();
      clickR = { via: 'ui', toasts: (window.__toasts || []).slice(), mediaAfter: !!S.career.media, stats: S.career.stats && S.career.stats.media };
    } else {
      clickR = { via: 'none', hasPanel };
    }
    return { hasPanel, btnCount: btns.length, clickR };
  });
  console.log('MEDIA_UI', JSON.stringify(mediaUi, null, 2));
  if (mediaUi.hasPanel && mediaUi.btnCount === 0) record('P1-MEDIA-NO-BTN', 'FAIL', '真实媒体面板无应答按钮', JSON.stringify(mediaUi));
  if (mediaUi.clickR && mediaUi.clickR.via === 'ui' && (mediaUi.clickR.toasts || []).join('').includes('采访选项无效')) {
    record('P1-MEDIA-UI-INVALID', 'FAIL', '真实媒体 UI 按钮点击报「采访选项无效」', JSON.stringify(mediaUi));
  }
  if (mediaUi.clickR && mediaUi.clickR.via === 'ui' && (mediaUi.clickR.toasts || []).length === 0 && mediaUi.clickR.mediaAfter === false) {
    record('P2-MEDIA-UI-NO-TOAST', 'WARN', '媒体 UI 应答成功但无 toast', JSON.stringify(mediaUi));
  }

  fs.writeFileSync('E:\\sex\\kpl-manager\\.bug-hunt\\pc-subagent-probe5.json', JSON.stringify({ findings, hints, posGuard, mediaUi, pageErrors }, null, 2), 'utf8');
  console.log('FINDINGS5', JSON.stringify(findings, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e.stack || e); process.exit(1); });
