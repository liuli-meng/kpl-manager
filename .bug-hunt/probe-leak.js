// Verify player-mode leaks on kjia page + promote/recall guards
const { launch, shot } = require('../tests/playthrough/pw.js');
const fs = require('fs');
const findings = [];
function record(id, severity, title, detail) {
  findings.push({ id, severity, title, detail });
  console.log(`[${severity}] ${id} ${title}`);
  if (detail) console.log('   ', String(detail).slice(0, 400));
}
(async () => {
  const { browser, page } = await launch();
  page.on('pageerror', e => { console.log('[pageerror]', e.message); record('P0-ERR', 'FAIL', e.message, null); });
  page.on('dialog', async d => { console.log('[dialog]', d.type(), String(d.message()).slice(0, 160)); try { await d.accept(); } catch (e) {} });
  try {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await page.evaluate(() => { try { localStorage.setItem('km_tour', '1'); } catch (e) {} });
    const leak = await page.evaluate(() => {
      switchStartTab('player');
      pickPlayerArch(1);
      pickPlayerPos('mid');
      if (!_pcTeam && window._pcTeams && window._pcTeams[0]) pickPlayerTeam(window._pcTeams[0].name);
      createPlayerCareer();
      try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
      goPage('kjia');
      const text = (document.getElementById('page-kjia') || {}).innerText || '';
      const btns = [...document.querySelectorAll('#page-kjia button')].map(b => ({
        text: b.textContent.trim().slice(0, 30),
        onclick: b.getAttribute('onclick'),
        disabled: !!b.disabled,
      }));
      const promoteBtns = btns.filter(b => /promoteKjiaPlayer/.test(b.onclick || ''));
      const recallBtns = btns.filter(b => /recallKjia/.test(b.onclick || ''));
      // try promote if any squad exists
      let promoteTry = null;
      if (promoteBtns[0]) {
        try { promoteKjiaPlayer((S.kjia.squad[0]||{}).id); promoteTry = 'ok'; }
        catch (e) { promoteTry = 'throw:' + e.message; }
      } else promoteTry = 'no-btn';
      let promoteToasts = (window.__toasts || []).slice(); window.__toasts = [];
      // try recall of demoted or any
      let recallTry = null;
      const demoted = (S.players || []).filter(p => p.kjia > 0);
      if (demoted[0]) {
        try { recallKjia(demoted[0].id); recallTry = 'ok'; }
        catch (e) { recallTry = 'throw:' + e.message; }
      } else recallTry = 'no-demoted';
      const recallToasts = (window.__toasts || []).slice(); window.__toasts = [];
      return {
        mode: S.mode,
        hasPromoteHint: /提拔一线队/.test(text),
        hasRecallHint: /召回一队/.test(text),
        hasManagerCopy: /阵容页「下放 K甲」/.test(text),
        promoteBtnCount: promoteBtns.length,
        recallBtnCount: recallBtns.length,
        promoteBtns: promoteBtns.slice(0, 3),
        recallBtns: recallBtns.slice(0, 3),
        promoteTry, promoteToasts,
        recallTry, recallToasts,
        squadLen: (S.kjia && S.kjia.squad || []).length,
        playersAfterPromote: S.players.length,
        textHead: text.slice(0, 350),
      };
    });
    await shot(page, 'player-kjia-leak');
    console.log('KJIA_LEAK', JSON.stringify(leak, null, 2));
    if (leak.promoteBtnCount > 0 || leak.recallBtnCount > 0 || leak.hasPromoteHint) {
      record('P1-PLAYER-KJIA-MANAGER-UI', 'FAIL',
        '选手模式二队页仍暴露经理操作（提拔/召回）且文案指向阵容页',
        JSON.stringify(leak));
    }
    if (leak.promoteTry === 'ok' && (leak.promoteToasts || []).join('').indexOf('选手') < 0) {
      record('P0-PLAYER-PROMOTE-LEAK', 'FAIL', '选手模式可成功提拔 K甲 选手进一队（俱乐部管理权泄漏）', JSON.stringify(leak));
    }
    // lineup page for player should be blocked
    const lineupGate = await page.evaluate(() => {
      const arr = [];
      const orig = toast;
      toast = function (m) { arr.push(String(m)); try { return orig.apply(this, arguments); } catch (e) { return null; } };
      try { goPage('lineup'); } finally { toast = orig; }
      return {
        currentPage: (document.querySelector('nav button.on') || {}).dataset?.page,
        toasts: arr,
        lineupVisible: !!document.querySelector('#page-lineup.on'),
      };
    });
    console.log('LINEUP_GATE', JSON.stringify(lineupGate));
    if (lineupGate.lineupVisible || lineupGate.currentPage === 'lineup') {
      record('P0-PLAYER-LINEUP-LEAK', 'FAIL', '选手模式可进入阵容页', JSON.stringify(lineupGate));
    }

    // coach market pageHint first line + any sell controls
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    const coachUi = await page.evaluate(() => {
      switchStartTab('coach');
      pickCoachClub(2);
      applyCoachClub();
      try { if (typeof tourSkip === 'function' && _tour && _tour.on) tourSkip(); } catch (e) {}
      goPage('market');
      const text = (document.getElementById('page-market') || {}).innerText || '';
      const btns = [...document.querySelectorAll('#page-market button')].map(b => ({
        text: b.textContent.trim().slice(0, 28),
        onclick: b.getAttribute('onclick'),
      }));
      goPage('kjia');
      const kjiaText = (document.getElementById('page-kjia') || {}).innerText || '';
      const kjiaBtns = [...document.querySelectorAll('#page-kjia button')].map(b => ({
        text: b.textContent.trim().slice(0, 24),
        onclick: b.getAttribute('onclick'),
      }));
      goPage('lineup');
      const lineBtns = [...document.querySelectorAll('#page-lineup button')].map(b => ({
        text: b.textContent.trim().slice(0, 24),
        onclick: b.getAttribute('onclick'),
      }));
      return {
        marketHintHead: (text.match(/^[\s\S]{0,120}/) || [''])[0],
        marketHasSell: btns.some(b => /openSellNego|listPlayer|挂牌/.test((b.onclick || '') + b.text)),
        marketHasLoanApply: btns.some(b => /coachRequest|loanPlayer/.test(b.onclick || '')),
        kjiaHasPromote: kjiaBtns.some(b => /promoteKjiaPlayer/.test(b.onclick || '')),
        kjiaHasRecall: kjiaBtns.some(b => /recallKjia/.test(b.onclick || '')),
        lineHasSell: lineBtns.some(b => /openSellNego/.test(b.onclick || '')),
        lineHasRecall: lineBtns.some(b => /recallKjia/.test(b.onclick || '')),
        lineHasLoanOut: lineBtns.some(b => /clubLoanOutPlayer/.test(b.onclick || '')),
        mode: S.mode,
      };
    });
    console.log('COACH_UI', JSON.stringify(coachUi, null, 2));
    // Coach promoting KJIA is legitimate (coach manages squad depth) - informational only
    if (coachUi.marketHasSell) {
      record('P1-COACH-SELL-LEAK', 'FAIL', '教练转会页仍出现出售/挂牌按钮', JSON.stringify(coachUi));
    }

    const summary = { findings, count: findings.filter(f => f.severity === 'FAIL').length };
    console.log('FINDINGS', JSON.stringify(findings, null, 2));
    fs.writeFileSync('E:\\sex\\kpl-manager\\.bug-hunt\\player-coach-probe-leak.json',
      JSON.stringify({ summary, leak, lineupGate, coachUi }, null, 2), 'utf8');
  } catch (e) {
    console.error('FATAL', e && e.stack || e);
  } finally {
    await browser.close();
  }
})();
