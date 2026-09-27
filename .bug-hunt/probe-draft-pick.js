/* 复现「选秀选不了人」：真实 UI 点击竞拍/点名/卡片 */
const path = require('path');
const { launch, clearAndStart, shot } = require('../tests/playthrough/pw.js');

function log(...a) { console.log(...a); }

async function state(page) {
  return page.evaluate(() => {
    const d = (typeof S !== 'undefined' && S && S.draft) ? S.draft : null;
    const panel = document.getElementById('page-market');
    const text = panel ? (panel.innerText || '') : '';
    const draftSec = text.includes('选秀大会') ? text.slice(text.indexOf('选秀大会'), text.indexOf('选秀大会') + 800) : '';
    const pickWraps = [...document.querySelectorAll('#page-market [onclick*="draftPick"]')];
    const bidBtns = [...document.querySelectorAll('#page-market [onclick*="draftBid"]')];
    const skipBtns = [...document.querySelectorAll('#page-market [onclick*="draftSkip"]')];
    return {
      mode: S && S.mode,
      preseason: S && S.preseason,
      transferWindow: S && S.transferWindow,
      fund: S && S.fund,
      roster: S && S.players && S.players.length,
      draft: d ? {
        phase: d.phase, slot: d.slot, done: d.done, bid: d.bid, leader: d.leader,
        pool: (d.pool || []).length,
        picks: (d.picks || []).filter(x => x.playerId).length,
        orderLen: (d.order || []).length,
        passed: d.passed,
        samplePool: (d.pool || []).slice(0, 3).map(p => ({ id: p.id, name: p.name, fromClub: p.fromClub })),
      } : null,
      draftSec: draftSec.replace(/\n+/g, ' | ').slice(0, 500),
      pickWrapCount: pickWraps.length,
      pickOnlicks: pickWraps.slice(0, 3).map(el => el.getAttribute('onclick')),
      bidBtnCount: bidBtns.length,
      bidOnlicks: bidBtns.map(el => (el.textContent || '').trim() + ' :: ' + el.getAttribute('onclick')),
      skipCount: skipBtns.length,
      toast: (document.querySelector('#toast') || {}).textContent || '',
    };
  });
}

(async () => {
  const { browser, page } = await launch();
  const out = [];
  try {
    await clearAndStart(page);
    // 开局：经理模式自建队
    const boot = await page.evaluate(() => {
      try {
        // 关掉开局弹窗相关，走 createTeam
        const nameEl = document.getElementById('team-name') || document.getElementById('tm-name') || document.querySelector('#start-modal input[type=text]');
        if (nameEl) nameEl.value = '选秀测试队';
        // 尝试常见入口
        if (typeof switchStartTab === 'function') switchStartTab('self');
        if (typeof createTeam === 'function') {
          createTeam('选秀测试队', '⚔️');
          return { via: 'createTeam', ok: true };
        }
        return { via: 'none', ok: false, hasCreate: typeof createTeam };
      } catch (e) {
        return { ok: false, err: String(e && e.message || e) };
      }
    });
    log('BOOT', JSON.stringify(boot));
    await page.waitForTimeout(300);

    let s = await state(page);
    log('AFTER_BOOT', JSON.stringify({ mode: s.mode, preseason: s.preseason, tw: s.transferWindow, roster: s.roster, draft: s.draft }, null, 1));

    // 若还没 draft，推进到 initDraft / 或直接调
    if (!s.draft) {
      await page.evaluate(() => {
        try { if (typeof initDraft === 'function') initDraft(S); } catch (e) {}
        try { S.preseason = true; if (S.transferWindow == null || S.transferWindow <= 0) S.transferWindow = 7; } catch (e) {}
        try { if (typeof initDraft === 'function' && !S.draft) initDraft(S); } catch (e) {}
        try { if (typeof save === 'function') save(); if (typeof renderAll === 'function') renderAll(); } catch (e) {}
      });
      await page.waitForTimeout(200);
      s = await state(page);
      log('AFTER_INITDRAFT', JSON.stringify(s.draft, null, 1));
    }

    await page.evaluate(() => { try { goPage('market'); } catch (e) {} });
    await page.waitForTimeout(200);
    s = await state(page);
    log('MARKET', JSON.stringify({ draftSec: s.draftSec, pick: s.pickWrapCount, bid: s.bidOnlicks, skip: s.skipCount }, null, 1));

    // 一路竞拍到点名
    for (let i = 0; i < 40; i++) {
      s = await state(page);
      if (!s.draft) { log('NO_DRAFT_AT', i); break; }
      if (s.draft.done) { log('DONE_AT', i, JSON.stringify(s.draft)); break; }
      if (s.draft.phase === 'pick') {
        log('PICK_PHASE', i, JSON.stringify({
          pickWrapCount: s.pickWrapCount,
          pickOnlicks: s.pickOnlicks,
          skip: s.skipCount,
          pool: s.draft.pool,
          toast: s.toast,
        }));
        await shot(page, 'draft-pick-phase');
        break;
      }
      // auction
      const acted = await page.evaluate(() => {
        const before = JSON.stringify({ phase: S.draft.phase, slot: S.draft.slot, bid: S.draft.bid, leader: S.draft.leader, passed: S.draft.passed });
        const btn = [...document.querySelectorAll('#page-market button')].find(b => /叫价/.test(b.textContent || '') && (b.getAttribute('onclick') || '').includes('draftBidRaise'));
        if (btn) {
          btn.click();
          const t = (document.querySelector('#toast') || {}).textContent || '';
          return { action: 'raise-click', toast: t, before, after: JSON.stringify({ phase: S.draft.phase, slot: S.draft.slot, bid: S.draft.bid, leader: S.draft.leader }) };
        }
        // 没有叫价按钮：用引擎推进 AI
        try {
          if (typeof draftAiAuction === 'function') { draftAiAuction(S); return { action: 'ai-auction' }; }
        } catch (e) { return { action: 'ai-err', err: String(e && e.message || e) }; }
        return { action: 'noop', html: (document.getElementById('page-market') || {}).innerText?.slice(0, 200) };
      });
      log('AUCT', i, JSON.stringify(acted));
      await page.waitForTimeout(80);
    }

    // 尝试真实点击点名卡片
    s = await state(page);
    if (s.draft && s.draft.phase === 'pick' && !s.draft.done) {
      const clickRes = await page.evaluate(() => {
        const wrap = document.querySelector('#page-market [onclick*="draftPick"]');
        if (!wrap) return { ok: false, reason: 'no-wrap', html: (document.getElementById('page-market') || {}).innerText?.slice(0, 400) };
        const before = {
          roster: S.players.length,
          pool: S.draft.pool.length,
          picks: S.draft.picks.filter(x => x.playerId).length,
          toast: (document.querySelector('#toast') || {}).textContent || '',
        };
        const err = [];
        const origToast = window.toast;
        window.toast = function (m) { err.push(String(m)); try { origToast(m); } catch (_) {} };
        try {
          wrap.click();
        } catch (e) {
          err.push('THROW:' + (e && e.message || e));
        }
        window.toast = origToast;
        return {
          ok: true,
          onclick: wrap.getAttribute('onclick'),
          before,
          after: {
            roster: S.players.length,
            pool: S.draft.pool.length,
            picks: S.draft.picks.filter(x => x.playerId).length,
            phase: S.draft.phase,
            slot: S.draft.slot,
            toast: (document.querySelector('#toast') || {}).textContent || '',
          },
          toasts: err,
          newPlayer: S.players[S.players.length - 1] && S.players[S.players.length - 1].name,
        };
      });
      log('CLICK_PICK', JSON.stringify(clickRes, null, 1));
      await shot(page, 'draft-after-click');
    } else {
      log('NOT_PICK_PHASE', JSON.stringify(s.draft));
    }

    // 再补：评估 draftPick 直接调用是否工作（区分 UI 绑定 vs 引擎）
    const direct = await page.evaluate(() => {
      if (!S.draft || S.draft.done || S.draft.phase !== 'pick') return { skip: true, phase: S.draft && S.draft.phase, done: S.draft && S.draft.done };
      const p = S.draft.pool[0];
      if (!p) return { skip: 'empty-pool' };
      const before = S.players.length;
      const toasts = [];
      const o = window.toast; window.toast = m => { toasts.push(String(m)); try { o(m); } catch (_) {} };
      try { draftPick(S, p.id); } catch (e) { toasts.push('THROW:' + (e && e.message || e)); }
      window.toast = o;
      return { player: p.name, before, after: S.players.length, toasts, phase: S.draft.phase };
    });
    log('DIRECT_PICK', JSON.stringify(direct, null, 1));

  } catch (e) {
    console.error('FATAL', e && e.stack || e);
  } finally {
    await browser.close();
  }
})();
