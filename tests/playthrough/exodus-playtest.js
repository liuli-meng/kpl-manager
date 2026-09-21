// Playtest: 核心出走 (exodus) scenario flow
// Run: node tests/playthrough/exodus-playtest.js
const { launch, clearAndStart, shot } = require('./pw');

(async () => {
  const report = [];
  const log = (s) => { console.log(s); report.push(s); };
  const ok = (s) => log('[PASS] ' + s);
  const warn = (s) => log('[WARN] ' + s);
  const fail = (s) => log('[FAIL] ' + s);

  let browser, page;
  try {
    ({ browser, page } = await launch());
    log('=== 核心出走剧本 playtest ===');
    log('URL: http://127.0.0.1:8931/game.html');

    // ---- Step 1: clear + reload ----
    await clearAndStart(page);
    await page.waitForTimeout(600);
    const startVisible = await page.evaluate(() => {
      const m = document.getElementById('start-modal');
      return !!(m && m.classList.contains('on'));
    });
    if (startVisible) ok('① 清档重载：开局弹窗可见');
    else fail('① 开局弹窗未出现');

    // ---- Step 2: pickScenario('exodus') + name '残阵重建' + createTeam ----
    const pickResult = await page.evaluate(() => {
      pickScenario('exodus');
      const btn = document.getElementById('sc-btn-exodus');
      const desc = document.getElementById('sc-desc');
      return {
        _scenario: typeof _scenario !== 'undefined' ? _scenario : null,
        btnClass: btn ? btn.className : null,
        desc: desc ? desc.textContent : null,
      };
    });
    log('   pickScenario(exodus): ' + JSON.stringify(pickResult));

    await page.evaluate(() => {
      document.getElementById('new-team-name').value = '残阵重建';
      createTeam();
    });
    await page.waitForTimeout(800);

    // ---- Step 3: Verify scenario + missing position ----
    const snap = await page.evaluate(() => {
      const posOrder = POS_ORDER.slice();
      const players = (S.players || []).map(p => ({
        id: p.id, name: p.name, pos: p.pos, ovr: overall(p),
      }));
      const lineupDetail = (S.lineup || []).map(id => {
        const p = S.players.find(x => x.id === id);
        return p ? { id: p.id, name: p.name, pos: p.pos, ovr: overall(p) } : { id, missing: true };
      });
      const emptyFromPlayers = posOrder.filter(pos => !S.players.some(p => p.pos === pos));
      const emptyFromLineup = posOrder.filter(pos =>
        !S.lineup.some(id => {
          const p = S.players.find(x => x.id === id);
          return p && p.pos === pos;
        })
      );
      return {
        scenario: S.scenario,
        teamName: S.teamName,
        playerCount: S.players.length,
        lineupCount: S.lineup.length,
        players,
        lineupDetail,
        emptyFromPlayers,
        emptyFromLineup,
        posOrder,
        fund: S.fund,
        wageCap: S.wageCap,
        preseason: S.preseason,
        transferWindow: S.transferWindow,
        marketLen: (S.transferList || []).length,
        freeAgents: (S.freeAgents || []).length,
        eventLogTail: (S.eventLog || []).slice(-8).map(e => e.txt),
        startModalOn: !!(document.getElementById('start-modal')?.classList.contains('on')),
      };
    });
    log('③ 开局状态: ' + JSON.stringify(snap, null, 2));

    if (snap.scenario === 'exodus') ok('③ S.scenario === exodus');
    else fail('③ S.scenario 应为 exodus，实际 ' + snap.scenario);

    if (snap.teamName === '残阵重建') ok('③ 队名「残阵重建」写入');
    else fail('③ 队名错误: ' + snap.teamName);

    if (snap.playerCount === 4) ok('③ 人数 4（正常满编 5 - 1 离队）');
    else if (snap.playerCount < 5) warn('③ 人数 ' + snap.playerCount + '（少于满编 5）');
    else fail('③ 人数 ' + snap.playerCount + '，exodus 应为 4');

    if (snap.emptyFromPlayers.length === 1) {
      const hole = snap.emptyFromPlayers[0];
      ok('③ 恰好空出 1 个位置: ' + hole);
    } else if (snap.emptyFromPlayers.length === 0) {
      fail('③ 无空缺位置 — exodus 未生效');
    } else {
      fail('③ 空出多个位置: ' + JSON.stringify(snap.emptyFromPlayers));
    }

    if (snap.emptyFromLineup.length === 1) {
      ok('③ 首发阵容也空出同一位置: ' + snap.emptyFromLineup[0]);
    } else {
      warn('③ 首发空缺检测: ' + JSON.stringify(snap.emptyFromLineup));
    }

    if (!snap.startModalOn) ok('③ 创建后开局弹窗已关闭');
    else warn('③ 开局弹窗仍打开');

    // ---- Step 4: Screenshot lineup page showing gap ----
    await page.evaluate(() => { if (typeof goPage === 'function') goPage('lineup'); });
    await page.waitForTimeout(500);
    await shot(page, 'exodus-01-lineup-gap');

    const lineupUi = await page.evaluate(() => {
      const pageEl = document.getElementById('page-lineup');
      const text = pageEl ? pageEl.innerText.replace(/\n+/g, ' | ').slice(0, 600) : '';
      // empty slots in lineup grid
      const emptySlots = Array.from(pageEl?.querySelectorAll('.slot.empty, .empty, [data-pos]') || [])
        .map(el => ({
          tag: el.tagName,
          cls: el.className,
          text: el.textContent.trim().slice(0, 40),
          dataPos: el.getAttribute('data-pos'),
        }))
        .filter(x => !x.text || x.cls.includes('empty') || x.text.includes('空'));
      const missPosDom = POS_ORDER.filter(pos => {
        // look for a rendered empty card for this pos
        const cards = Array.from(pageEl?.querySelectorAll('[data-pos="' + pos + '"]') || []);
        return cards.some(c => !c.textContent.trim() || c.className.includes('empty'));
      });
      return {
        pageText: text,
        emptySlots: emptySlots.slice(0, 10),
        missPosDom,
        hasMarketBtn: !!(pageEl && pageEl.innerHTML.includes("goPage('market')")),
      };
    });
    log('④ 阵容页 UI: ' + JSON.stringify(lineupUi, null, 2));

    // ---- Step 5: goPage('market') screenshot ----
    await page.evaluate(() => { if (typeof goPage === 'function') goPage('market'); });
    await page.waitForTimeout(500);
    await shot(page, 'exodus-02-market');

    const marketUi = await page.evaluate(() => {
      const pageEl = document.getElementById('page-market');
      const text = pageEl ? pageEl.innerText.replace(/\n+/g, ' | ').slice(0, 600) : '';
      const listingCount = S.transferList ? S.transferList.length : 0;
      const freeCount = S.freeAgents ? S.freeAgents.length : 0;
      // how many market players match empty positions?
      const empty = POS_ORDER.filter(pos => !S.players.some(p => p.pos === pos));
      const matchEmpty = (S.transferList || []).filter(p => empty.includes(p.pos)).length;
      const freeMatchEmpty = (S.freeAgents || []).filter(p => empty.includes(p.pos)).length;
      return {
        emptyPos: empty,
        listingCount,
        freeCount,
        matchEmptyOnTransferList: matchEmpty,
        matchEmptyAsFreeAgents: freeMatchEmpty,
        pageTextSample: text,
      };
    });
    log('⑤ 市场页: ' + JSON.stringify(marketUi, null, 2));

    if (marketUi.matchEmptyOnTransferList + marketUi.matchEmptyAsFreeAgents > 0) {
      ok('⑤ 市场有可补空缺的选手（挂牌 ' + marketUi.matchEmptyOnTransferList +
         ' / 自由身 ' + marketUi.matchEmptyAsFreeAgents + '）');
    } else {
      warn('⑤ 市场未检测到与空缺位置匹配的选手');
    }

    log('=== REPORT END ===');
  } catch (e) {
    console.error('SCRIPT_FAIL', e);
    report.push('SCRIPT_FAIL ' + (e && e.message ? e.message : e));
  } finally {
    if (browser) await browser.close();
  }
})();
